import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Place an order from the cart. This is the "submit" step of the lifecycle:
// it creates the order at payment_status = 'pending' and clears the cart. The
// separate Pay step (initiate-payment) then moves it to 'awaiting_payment'.
//
// TRUST BOUNDARY: the frontend sends NOTHING about pricing. The function reads
// the caller's cart_items (RLS-scoped by JWT) and computes the total server-side.

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
    const lineItems = items
      .filter((r) => r.products && r.products.in_stock !== false && r.quantity > 0)
      .map((r) => ({ ItemName: r.products!.name, Quantity: r.quantity, UnitPrice: Number(r.products!.price) }));

    if (lineItems.length === 0) return json({ error: "empty_cart", message: "Your cart is empty." }, 400);

    const total = lineItems.reduce((s, i) => s + i.UnitPrice * i.Quantity, 0);
    if (!(total > 0)) return json({ error: "invalid_total" }, 500);

    const reference = `FITLOG-${user.id.slice(0, 8)}-${Date.now()}`;

    // Create the pending order with the service role (RLS blocks client writes).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: order, error: insErr } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        reference,
        amount: total,
        currency: CURRENCY,
        items: lineItems,
        payment_status: "pending",
      })
      .select("id, reference")
      .single();
    if (insErr || !order) return json({ error: "order_error", message: insErr?.message ?? "Could not create order" }, 500);

    // Move the cart into the order: clear it (RLS-scoped delete).
    await supabase.from("cart_items").delete().neq("product_id", "00000000-0000-0000-0000-000000000000");

    return json({ orderId: order.id, reference: order.reference, total, currency: CURRENCY });
  } catch (e) {
    return json({ error: "exception", message: String(e) }, 500);
  }
});
