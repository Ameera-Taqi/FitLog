import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// MyFatoorah payment webhook.
//
// SECURITY (two layers):
//  1. Signature: if MYFATOORAH_WEBHOOK_SECRET is set, verify the
//     `MyFatoorah-Signature` header (Base64 HMAC-SHA256 over the Data object's
//     "Key=Value" pairs sorted by key). Reject on mismatch.
//  2. Authoritative re-query: never trust the webhook body's status. Take the
//     InvoiceId and call MyFatoorah GetPaymentStatus with OUR secret API key;
//     the status from that call is what we write. A forged "paid" webhook fails
//     here because the attacker can't make MyFatoorah report Paid.
//
// The DB write uses the service role (SUPABASE_SERVICE_ROLE_KEY) because RLS
// forbids all client-side writes to orders.payment_status.
//
// Deploy with verify_jwt = false (gateways don't send a Supabase JWT).

const MF_TOKEN = Deno.env.get("MYFATOORAH_API_KEY");
const MF_BASE = Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://apitest.myfatoorah.com";
const WEBHOOK_SECRET = Deno.env.get("MYFATOORAH_WEBHOOK_SECRET"); // optional but recommended

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

// Constant-time-ish string comparison.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signatureValid(secret: string, data: Record<string, unknown>, header: string | null): Promise<boolean> {
  if (!header) return false;
  // MyFatoorah builds the string from Data properties as Key=Value, comma-joined,
  // with keys ordered alphabetically.
  const payload = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k] ?? ""}`)
    .join(",");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return safeEqual(toBase64(sig), header.trim());
}

Deno.serve(async (req: Request) => {
  // Gateways may probe the endpoint with GET; acknowledge it.
  if (req.method === "GET") return json({ ok: true, service: "payment-webhook" });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const raw = await req.text();
    let body: Record<string, unknown> = {};
    try { body = JSON.parse(raw); } catch { /* some gateways form-encode; handled below */ }

    const data = (body?.Data ?? body ?? {}) as Record<string, unknown>;

    // Layer 1 — signature (only enforced when a secret is configured).
    if (WEBHOOK_SECRET) {
      const header = req.headers.get("MyFatoorah-Signature") ?? req.headers.get("myfatoorah-signature");
      const ok = await signatureValid(WEBHOOK_SECRET, data, header);
      if (!ok) return json({ error: "invalid_signature" }, 401);
    }

    const invoiceId = data["InvoiceId"] ?? data["invoiceId"] ?? (data["Invoice"] as { Id?: unknown } | undefined)?.Id;
    const webhookTxnStatus = String(data["TransactionStatus"] ?? "").toUpperCase();

    // Layer 2 — authoritative re-query with our API key.
    let invoiceStatus = "";
    let reference = String(data["CustomerReference"] ?? "");
    if (MF_TOKEN && invoiceId != null) {
      const stRes = await fetch(`${MF_BASE}/v2/GetPaymentStatus`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${MF_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ Key: String(invoiceId), KeyType: "InvoiceId" }),
      });
      const stData = await stRes.json().catch(() => null);
      if (stData?.IsSuccess) {
        invoiceStatus = String(stData.Data?.InvoiceStatus ?? "");
        reference = String(stData.Data?.CustomerReference ?? reference);
      }
    }

    // Map to our payment_status. "Paid" is only ever set from the authoritative
    // GetPaymentStatus result, never from the raw webhook body.
    let status: "paid" | "failed" | "expired" | null = null;
    if (invoiceStatus === "Paid") status = "paid";
    else if (invoiceStatus === "Expired") status = "expired";
    else if (invoiceStatus === "Failed" || webhookTxnStatus === "FAILED") status = "failed";

    if (!reference) return json({ ok: false, reason: "no_reference" }, 200);
    if (!status) return json({ ok: true, reference, note: "no terminal status yet", invoiceStatus }, 200);

    // Audited, idempotent status change via service role. The RPC is a no-op if
    // the status is unchanged (Failure 4 — webhook retries) or already paid, and
    // records the transition in payment_events with source 'webhook'.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: result, error } = await admin.rpc("set_order_status", {
      p_reference: reference,
      p_new_status: status,
      p_source: "webhook",
    });
    if (error) return json({ error: "db_error", message: error.message }, 500);
    const changed = Array.isArray(result) ? result[0]?.changed : result?.changed;

    return json({ ok: true, reference, status, changed: !!changed });
  } catch (e) {
    return json({ error: "exception", message: String(e) }, 500);
  }
});
