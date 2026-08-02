import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// MyFatoorah hosted-payment initiation.
// TRUST BOUNDARY: the frontend sends ONLY a productId. Amount, currency, and
// reference are computed server-side from the products table. The API key is a
// Supabase secret (MYFATOORAH_API_KEY) and never reaches the client.
//   supabase secrets set MYFATOORAH_API_KEY=<sandbox token>
// Optional: MYFATOORAH_BASE_URL (defaults to sandbox), APP_URL (return origin).

const MF_TOKEN = Deno.env.get("MYFATOORAH_API_KEY");
const MF_BASE = Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://apitest.myfatoorah.com";
const CURRENCY = "KWD"; // server-controlled; MyFatoorah does not accept USD

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
    if (!MF_TOKEN) {
      return json({ error: "not_configured", message: "MYFATOORAH_API_KEY is not set for this project." }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    // The ONLY thing we trust from the client.
    const body = await req.json().catch(() => ({}));
    const productId = body?.productId;
    if (!productId || typeof productId !== "string") {
      return json({ error: "bad_request", message: "productId is required" }, 400);
    }

    // Price + currency come from the database, never the request body.
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, price, currency, in_stock")
      .eq("id", productId)
      .single();
    if (pErr || !product) return json({ error: "not_found", message: "Product not found" }, 404);
    if (product.in_stock === false) return json({ error: "out_of_stock" }, 409);

    const amount = Number(product.price);
    if (!(amount > 0)) return json({ error: "invalid_price" }, 500);

    const reference = `FITLOG-${String(product.id).slice(0, 8)}-${Date.now()}`;
    const origin = req.headers.get("origin") || Deno.env.get("APP_URL") || "https://web-kappa-mocha-29.vercel.app";
    const customerName =
      (user.user_metadata?.display_name as string) || user.email?.split("@")[0] || "Customer";

    const mfPayload = {
      CustomerName: customerName,
      NotificationOption: "LNK",
      InvoiceValue: amount,
      DisplayCurrencyIso: CURRENCY,
      CustomerReference: reference,
      CustomerEmail: user.email ?? undefined,
      CallBackUrl: `${origin}/shop/return`,
      ErrorUrl: `${origin}/shop/return`,
      InvoiceItems: [{ ItemName: product.name, Quantity: 1, UnitPrice: amount }],
    };

    const mfRes = await fetch(`${MF_BASE}/v2/SendPayment`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${MF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(mfPayload),
    });
    const mfData = await mfRes.json().catch(() => null);

    if (!mfRes.ok || !mfData?.IsSuccess) {
      return json({
        error: "gateway_error",
        status: mfRes.status,
        message: mfData?.Message ?? "MyFatoorah request failed",
        validationErrors: mfData?.ValidationErrors ?? null,
      }, 502);
    }

    return json({
      paymentUrl: mfData.Data.InvoiceURL,
      invoiceId: mfData.Data.InvoiceId,
      reference,
      amount,
      currency: CURRENCY,
    });
  } catch (e) {
    return json({ error: "exception", message: String(e) }, 500);
  }
});
