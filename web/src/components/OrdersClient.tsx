"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/product";
import { ORDER_STATUS_BADGE, type PaymentStatus } from "@/lib/orderStatus";

interface Order {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  payment_status: PaymentStatus;
  created_at: string;
  items: { ItemName: string; Quantity: number; UnitPrice: number }[] | null;
}

export function OrdersClient() {
  const { t } = useI18n();
  const supabase = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, reference, amount, currency, payment_status, created_at, items")
      .order("created_at", { ascending: false });
    setOrders((data ?? []) as unknown as Order[]);
    setLoading(false);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  // Pay step. Guarded against double-tap: the button is disabled while in flight,
  // and the backend is idempotent (returns the same invoice URL).
  async function pay(id: string) {
    if (paying) return;
    setPaying(id);
    const { data, error } = await supabase.functions.invoke("initiate-payment", { body: { orderId: id } });
    if (error || !data?.paymentUrl) {
      setPaying(null);
      let msg = t("shop.payError");
      try {
        const ctx = (error as { context?: Response } | null)?.context;
        const j = ctx ? await ctx.json() : null;
        if (j?.error === "not_configured") msg = t("shop.payNotConfigured");
      } catch { /* keep generic */ }
      alert(msg);
      return;
    }
    window.location.href = data.paymentUrl as string;
  }

  const itemCount = (o: Order) => (o.items ?? []).reduce((s, i) => s + i.Quantity, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-ink-900">{t("orders.title")}</h1>
          <p className="text-sm text-ink-500">{t("orders.subtitle")}</p>
        </div>
        <Link href="/shop" className="text-sm font-semibold text-brand-600 hover:underline">
          ← {t("shop.continueShopping")}
        </Link>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-ink-400">{t("orders.empty")}</p>
          <Link href="/shop" className="btn-primary mt-5 inline-flex">{t("shop.continueShopping")}</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <div key={o.id} className="card space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-ink-400">{o.reference}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {itemCount(o)} {itemCount(o) === 1 ? t("shop.item") : t("shop.items")} · {new Date(o.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${ORDER_STATUS_BADGE[o.payment_status] ?? ORDER_STATUS_BADGE.pending}`}>
                  {t(`orders.status.${o.payment_status}`)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black text-ink-900">{formatPrice(Number(o.amount), o.currency)}</span>
                {o.payment_status !== "paid" && (
                  <button
                    type="button"
                    onClick={() => pay(o.id)}
                    disabled={paying !== null}
                    className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
                  >
                    {paying === o.id ? t("orders.paying") : t("orders.pay")}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
