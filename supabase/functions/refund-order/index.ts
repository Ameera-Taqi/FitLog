import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Admin-only refund. Verifies the caller is the shop owner, calls MyFatoorah's
// MakeRefund endpoint for the order's invoice, then flips payment_status to
// 'refunded' through the audited RPC (source 'refund'). The customer's orders
// page reflects it in real time via Realtime.

const MF_TOKEN = Deno.env.get("MYFATOORAH_API_KEY");
const MF_BASE = Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://apitest.myfatoorah.com";
const ADMIN_EMAIL = "ameera.taqi@gmail.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    if (!MF_TOKEN) return json({ error: "not_configured", message: "MYFATOORAH_API_KEY is not set." }, 500);

    // Authenticate the caller and require the admin email.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);
    if (user.email !== ADMIN_EMAIL) return json({ error: "forbidden", message: "Admin only." }, 403);

    const body = await req.json().catch(() => ({}));
    const orderId = body?.orderId;
    const refByBody = body?.reference;
    if (!orderId && !refByBody) return json({ error: "bad_request", message: "orderId or reference required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const q = admin.from("orders").select("id, reference, invoice_id, amount, currency, payment_status");
    const { data: order, error: readErr } = orderId
      ? await q.eq("id", orderId).single()
      : await q.eq("reference", refByBody).single();
    if (readErr || !order) return json({ error: "not_found", message: "Order not found" }, 404);

    if (order.payment_status === "refunded") return json({ ok: true, reference: order.reference, alreadyRefunded: true });
    if (order.payment_status !== "paid") return json({ error: "not_refundable", message: "Only paid orders can be refunded." }, 409);
    if (!order.invoice_id) return json({ error: "no_invoice", message: "Order has no invoice to refund." }, 409);

    // Call the gateway's refund endpoint.
    const mfRes = await fetch(`${MF_BASE}/v2/MakeRefund`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${MF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        KeyType: "InvoiceId",
        Key: String(order.invoice_id),
        RefundChargeOnCustomer: "No",
        ServiceChargeOnCustomer: "No",
        Amount: Number(order.amount),
        Comment: `Refund for ${order.reference}`,
        CustomerReference: order.reference,
      }),
    });
    const mfData = await mfRes.json().catch(() => null);
    if (!mfRes.ok || !mfData?.IsSuccess) {
      return json({ error: "gateway_error", status: mfRes.status, message: mfData?.Message ?? "Refund request failed", validationErrors: mfData?.ValidationErrors ?? null }, 502);
    }

    // Audited transition paid -> refunded (source 'refund').
    const { data: result, error } = await admin.rpc("set_order_status", {
      p_reference: order.reference,
      p_new_status: "refunded",
      p_source: "refund",
    });
    if (error) return json({ error: "db_error", message: error.message }, 500);
    const changed = Array.isArray(result) ? result[0]?.changed : result?.changed;

    return json({ ok: true, reference: order.reference, refundId: mfData.Data?.RefundId ?? null, changed: !!changed });
  } catch (e) {
    return json({ error: "exception", message: String(e) }, 500);
  }
});
