"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createClient } from "@/lib/supabase/client";
import { formatPrice, productImageSrc } from "@/lib/product";

interface CartRow {
  product_id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    flavor: string | null;
    price: number;
    currency: string;
    image: string | null;
  } | null;
}

export function CartClient() {
  const { t } = useI18n();
  const supabase = createClient();
  const [rows, setRows] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("cart_items")
      .select("product_id, quantity, product:products(id, name, flavor, price, currency, image)")
      .order("created_at", { ascending: true });
    setRows((data ?? []) as unknown as CartRow[]);
    setLoading(false);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  async function setQty(productId: string, qty: number) {
    if (qty <= 0) return remove(productId);
    setRows((rs) => rs.map((r) => (r.product_id === productId ? { ...r, quantity: qty } : r)));
    await supabase.from("cart_items").upsert(
      { product_id: productId, quantity: qty },
      { onConflict: "user_id,product_id" },
    );
  }

  async function remove(productId: string) {
    setRows((rs) => rs.filter((r) => r.product_id !== productId));
    await supabase.from("cart_items").delete().eq("product_id", productId);
  }

  const currency = rows[0]?.product?.currency ?? "USD";
  const subtotal = rows.reduce((s, r) => s + (r.product ? r.product.price * r.quantity : 0), 0);

  async function checkout() {
    setCheckingOut(true);
    const { data, error } = await supabase.functions.invoke("checkout-cart", { body: {} });
    if (error || !data?.paymentUrl) {
      setCheckingOut(false);
      let msg = t("shop.payError");
      try {
        const ctx = (error as { context?: Response } | null)?.context;
        const j = ctx ? await ctx.json() : null;
        if (j?.error === "not_configured") msg = t("shop.payNotConfigured");
        else if (j?.error === "empty_cart") msg = t("shop.emptyCart");
      } catch { /* keep generic */ }
      alert(msg);
      return;
    }
    window.location.href = data.paymentUrl as string;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black uppercase tracking-tight text-ink-900">{t("shop.yourCart")}</h1>
        <Link href="/shop" className="text-sm font-semibold text-brand-600 hover:underline">
          ← {t("shop.continueShopping")}
        </Link>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-ink-400">{t("shop.emptyCart")}</p>
          <Link href="/shop" className="btn-primary mt-5 inline-flex">{t("shop.continueShopping")}</Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.product_id} className="card flex items-center gap-3 p-3">
                <div
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl"
                  style={{ background: "linear-gradient(150deg,#334155,rgba(0,0,0,0.4))" }}
                >
                  {productImageSrc(r.product?.image ?? null) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImageSrc(r.product?.image ?? null)!} alt={r.product?.name ?? ""} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-ink-900">{r.product?.name}</h3>
                  {r.product?.flavor && <p className="text-xs text-ink-500">{r.product.flavor}</p>}
                  <p className="mt-0.5 text-sm font-black text-ink-900">
                    {formatPrice(r.product?.price ?? 0, r.product?.currency)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setQty(r.product_id, r.quantity - 1)} className="grid h-8 w-8 place-items-center rounded-full bg-surface2 text-lg font-bold text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-100">−</button>
                  <span className="w-5 text-center text-sm font-bold text-ink-900">{r.quantity}</span>
                  <button type="button" onClick={() => setQty(r.product_id, r.quantity + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-surface2 text-lg font-bold text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-100">+</button>
                </div>
                <button type="button" onClick={() => remove(r.product_id)} className="ml-1 text-xs font-semibold text-ink-400 hover:text-red-500">
                  {t("shop.remove")}
                </button>
              </div>
            ))}
          </div>

          <div className="card space-y-4 p-5">
            <div className="flex items-center justify-between text-lg font-black text-ink-900">
              <span>{t("shop.subtotal")}</span>
              <span>{formatPrice(subtotal, currency)}</span>
            </div>
            <button type="button" onClick={checkout} disabled={checkingOut} className="btn-primary w-full py-3 disabled:opacity-70">
              {checkingOut ? t("shop.starting") : t("shop.checkout")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
