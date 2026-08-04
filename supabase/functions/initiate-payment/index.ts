import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Pay step. Frontend sends ONLY an orderId. We look the order up (RLS-scoped),
// create a MyFatoorah invoice from the server-side amount, then set the order's
// payment_status to 'awaiting_payment' and return the hosted payment URL.
//
// IDEMPOTENCY (Failure 3 — double-tap Pay): if the order is already
// awaiting_payment and has a payment_url, we return that SAME url instead of
// creating a second invoice, so the customer is never charged twice.

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

type LineItem = { ItemName: string; Quantity: number; UnitPrice: number };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    if (!MF_TOKEN) return json({ error: "not_configured", message: "MYFATOORAH_API_KEY is not set." }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const orderId = body?.orderId;
    if (!orderId) return json({ error: "bad_request", message: "orderId is required" }, 400);

    // Read the order (RLS ensures it belongs to this user).
    const { data: order, error: readErr } = await supabase
      .from("orders")
      .select("id, reference, amount, currency, items, payment_status, payment_url")
      .eq("id", orderId)
      .single();
    if (readErr || !order) return json({ error: "not_found", message: "Order not found" }, 404);

    if (order.payment_status === "paid") return json({ error: "already_paid" }, 409);

    // Idempotency: reuse the existing invoice URL on a repeat Pay click.
    if (order.payment_status === "awaiting_payment" && order.payment_url) {
      return json({ paymentUrl: order.payment_url, reference: order.reference, reused: true });
    }

    const invoiceItems = (order.items as LineItem[] | null) ?? [];
    const origin = req.headers.get("origin") || Deno.env.get("APP_URL") || "https://web-kappa-mocha-29.vercel.app";
    const customerName = (user.user_metadata?.display_name as string) || user.email?.split("@")[0] || "Customer";

    const mfRes = await fetch(`${MF_BASE}/v2/SendPayment`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${MF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        CustomerName: customerName,
        NotificationOption: "LNK",
        InvoiceValue: Number(order.amount),
        DisplayCurrencyIso: order.currency ?? "KWD",
        CustomerReference: order.reference,
        CustomerEmail: user.email ?? undefined,
        CallBackUrl: `${origin}/shop/return`,
        ErrorUrl: `${origin}/shop/return`,
        InvoiceItems: invoiceItems,
      }),
    });
    const mfData = await mfRes.json().catch(() => null);
    if (!mfRes.ok || !mfData?.IsSuccess) {
      return json({ error: "gateway_error", status: mfRes.status, message: mfData?.Message ?? "MyFatoorah request failed", validationErrors: mfData?.ValidationErrors ?? null }, 502);
    }

    const paymentUrl = mfData.Data.InvoiceURL as string;
    const invoiceId = String(mfData.Data.InvoiceId);

    // Move the order to awaiting_payment and store invoice details (service role).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin
      .from("orders")
      .update({ payment_status: "awaiting_payment", invoice_id: invoiceId, payment_url: paymentUrl })
      .eq("id", order.id)
      .neq("payment_status", "paid");

    return json({ paymentUrl, reference: order.reference, invoiceId });
  } catch (e) {
    return json({ error: "exception", message: String(e) }, 500);
  }
});
