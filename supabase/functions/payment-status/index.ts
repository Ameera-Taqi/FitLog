import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Verifies a MyFatoorah payment via GetPaymentStatus. The return page passes the
// paymentId that MyFatoorah appended to the CallBackUrl; we confirm server-side
// rather than trusting the URL. Amount/status come straight from the gateway.

const MF_TOKEN = Deno.env.get("MYFATOORAH_API_KEY");
const MF_BASE = Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://apitest.myfatoorah.com";

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
    const body = await req.json().catch(() => ({}));
    const key = body?.paymentId ?? body?.key;
    const keyType = body?.keyType ?? "PaymentId";
    if (!key) return json({ error: "bad_request", message: "paymentId is required" }, 400);

    const mfRes = await fetch(`${MF_BASE}/v2/GetPaymentStatus`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${MF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ Key: String(key), KeyType: keyType }),
    });
    const mfData = await mfRes.json().catch(() => null);
    if (!mfRes.ok || !mfData?.IsSuccess) {
      return json({ error: "gateway_error", status: mfRes.status, message: mfData?.Message ?? "Lookup failed" }, 502);
    }

    const d = mfData.Data ?? {};
    return json({
      status: d.InvoiceStatus ?? "Unknown",       // "Paid" | "Pending" | "Failed" | "Expired" ...
      paid: d.InvoiceStatus === "Paid",
      invoiceId: d.InvoiceId,
      reference: d.CustomerReference ?? null,
      amount: d.InvoiceValue ?? null,
    });
  } catch (e) {
    return json({ error: "exception", message: String(e) }, 500);
  }
});
