"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createClient } from "@/lib/supabase/client";
import { type Product, formatPrice, productImageSrc } from "@/lib/product";

export function ShopClient({ products }: { products: Product[] }) {
  const { t } = useI18n();
  const supabase = createClient();
  const [cat, setCat] = useState<string>("all");
  // cart is a productId -> quantity map, kept in sync with the cart_items table.
  const [cart, setCart] = useState<Record<string, number>>({});
  const [adding, setAdding] = useState<string | null>(null);

  // Load the persisted cart on mount.
  const loadCart = useCallback(async () => {
    const { data } = await supabase.from("cart_items").select("product_id, quantity");
    if (data) {
      const next: Record<string, number> = {};
      for (const r of data as { product_id: string; quantity: number }[]) next[r.product_id] = r.quantity;
      setCart(next);
    }
  }, [supabase]);
  useEffect(() => { loadCart(); }, [loadCart]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ["all", ...Array.from(set)];
  }, [products]);

  const shown = cat === "all" ? products : products.filter((p) => p.category === cat);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find((x) => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);
  const currency = products[0]?.currency ?? "USD";

  // Add one to the cart and persist (upsert increments the existing row's quantity).
  async function add(id: string) {
    setAdding(id);
    const nextQty = (cart[id] ?? 0) + 1;
    setCart((c) => ({ ...c, [id]: nextQty })); // optimistic
    const { error } = await supabase
      .from("cart_items")
      .upsert({ product_id: id, quantity: nextQty }, { onConflict: "user_id,product_id" });
    if (error) { await loadCart(); alert(t("shop.payError")); }
    setAdding(null);
  }

  async function clearCart() {
    setCart({});
    await supabase.from("cart_items").delete().neq("product_id", "00000000-0000-0000-0000-000000000000");
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={`chip px-4 py-2 text-sm font-semibold ring-1 ring-inset transition ${
              cat === c ? "bg-brand-600 text-white ring-brand-600" : "bg-surface2 text-ink-600 ring-ink-200 hover:bg-ink-100"
            }`}
          >
            {c === "all" ? t("shop.all") : c}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {shown.map((p) => (
          <div key={p.id} className="card group flex flex-col overflow-hidden">
            {/* Product tile: real photo when available, gradient otherwise */}
            <div
              className="relative flex aspect-square items-end p-3"
              style={{ background: `linear-gradient(150deg, ${p.color} 0%, rgba(0,0,0,0.35) 100%)` }}
            >
              {productImageSrc(p.image) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={productImageSrc(p.image)!}
                  alt={p.name}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              )}
              {p.badge && (
                <span className="absolute start-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                  {p.badge}
                </span>
              )}
              <span className="absolute end-3 top-3 rounded-full bg-black/35 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                ★ {p.rating?.toFixed(1) ?? "—"}
              </span>
              {!productImageSrc(p.image) && (
                <span className="text-2xl font-black uppercase leading-none tracking-tight text-white/90 drop-shadow">
                  {p.category}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col p-3">
              <h3 className="font-bold text-ink-900">{p.name}</h3>
              {p.flavor && <p className="text-xs text-ink-500">{p.flavor}</p>}
              <p className="mt-1 line-clamp-2 text-xs text-ink-400">{p.description}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-lg font-black text-ink-900">{formatPrice(p.price, p.currency)}</span>
                <button
                  type="button"
                  onClick={() => add(p.id)}
                  disabled={adding === p.id}
                  className="btn-secondary px-3 py-1.5 text-xs"
                >
                  {cart[p.id] ? `${t("shop.add")} · ${cart[p.id]}` : t("shop.add")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-4 sm:bottom-4">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-full bg-brand-600 px-5 py-3 text-white shadow-cardhover">
            <span className="text-sm font-bold">
              {cartCount} {cartCount === 1 ? t("shop.item") : t("shop.items")} · {formatPrice(cartTotal, currency)}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={clearCart} className="rounded-full px-3 py-1.5 text-xs font-bold text-white/80 hover:bg-white/10">
                {t("shop.clear")}
              </button>
              <Link
                href="/shop/cart"
                className="rounded-full bg-white px-4 py-1.5 text-xs font-black uppercase tracking-wide text-brand-700"
              >
                {t("shop.viewCart")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
