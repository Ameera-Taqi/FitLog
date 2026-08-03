import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cart checkout via MyFatoorah.
// TRUST BOUNDARY: the frontend sends NOTHING about pricing. The function reads
// the caller's cart_items (RLS-scoped by JWT), joins products for prices, and
// computes the total server-side. The API key is a Supabase secret.

const MF_TOKEN = Deno.env.get("MYFATOORAH_API_KEY");
const MF_BASE = Deno.env.get("MYFATOORAH_BASE_URL") ?? "https://apitest.myfatoorah.com";
const CURRENCY = "KWD";

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

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    // Read the cart with server-side product prices (RLS scopes to this user).
    const { data: rows, error } = await supabase
      .from("cart_items")
      .select("quantity, products(id, name, price, in_stock)")
      .order("created_at", { ascending: true });
    if (error) return json({ error: "query_error", message: error.message }, 400);

    type Row = { quantity: number; products: { id: string; name: string; price: number; in_stock: boolean } | null };
    const items = (rows ?? []) as unknown as Row[];
    const invoiceItems = items
      .filter((r) => r.products && r.products.in_stock !== false && r.quantity > 0)
      .map((r) => ({ ItemName: r.products!.name, Quantity: r.quantity, UnitPrice: Number(r.products!.price) }));

    if (invoiceItems.length === 0) return json({ error: "empty_cart", message: "Your cart is empty." }, 400);

    const total = invoiceItems.reduce((s, i) => s + i.UnitPrice * i.Quantity, 0);
    if (!(total > 0)) return json({ error: "invalid_total" }, 500);

    const reference = `FITLOG-CART-${user.id.slice(0, 8)}-${Date.now()}`;
    const origin = req.headers.get("origin") || Deno.env.get("APP_URL") || "https://web-kappa-mocha-29.vercel.app";
    const customerName = (user.user_metadata?.display_name as string) || user.email?.split("@")[0] || "Customer";

    const mfRes = await fetch(`${MF_BASE}/v2/SendPayment`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${MF_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        CustomerName: customerName,
        NotificationOption: "LNK",
        InvoiceValue: total,
        DisplayCurrencyIso: CURRENCY,
        CustomerReference: reference,
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

    // Persist the order so the payment-webhook can look it up by reference and
    // flip payment_status. RLS blocks client writes, so use the service role.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin.from("orders").insert({
      user_id: user.id,
      reference,
      invoice_id: String(mfData.Data.InvoiceId),
      amount: total,
      currency: CURRENCY,
      items: invoiceItems,
      payment_status: "awaiting_payment",
    });

    return json({ paymentUrl: mfData.Data.InvoiceURL, invoiceId: mfData.Data.InvoiceId, reference, total, currency: CURRENCY });
  } catch (e) {
    return json({ error: "exception", message: String(e) });
  }
});
