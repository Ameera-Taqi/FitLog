"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/product";
import { ORDER_STATUS_BADGE, ORDER_STATUSES, type PaymentStatus } from "@/lib/orderStatus";

// Admin panel is owner-only. This matches the RLS policy that lets this email
// read every order (all other clients see only their own).
const ADMIN_EMAIL = "ameera.taqi@gmail.com";

const STATUS_LABEL: Record<PaymentStatus, string> = {
  pending: "Pending",
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
};

interface AdminOrder {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  payment_status: PaymentStatus;
  created_at: string;
  user_id: string;
}

export function AdminOrdersClient() {
  const supabase = createClient();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, reference, amount, currency, payment_status, created_at, user_id")
      .order("created_at", { ascending: false });
    setOrders((data ?? []) as unknown as AdminOrder[]);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      await load();
      setLoading(false);
    })();
    // Live updates: any insert/update to orders re-pulls the list (no refresh).
    const channel = supabase
      .channel("orders-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [load, supabase]);

  const counts = ORDER_STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.payment_status === s).length;
    return acc;
  }, {} as Record<PaymentStatus, number>);

  if (loading) {
    return (
      <div className="card p-10 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
      </div>
    );
  }

  if (email !== ADMIN_EMAIL) {
    return (
      <div className="card p-10 text-center">
        <h1 className="text-lg font-black text-ink-900">Not authorized</h1>
        <p className="mt-2 text-sm text-ink-400">This page is for the shop owner only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-ink-900">Orders — Admin</h1>
          <p className="text-sm text-ink-500">All customer orders and payment status.</p>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${live ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/40" : "bg-ink-100 text-ink-500 ring-ink-200"}`}>
          <span className={`h-2 w-2 rounded-full ${live ? "bg-emerald-500" : "bg-ink-400"}`} />
          {live ? "Live" : "Offline"}
        </span>
      </div>

      {/* status summary chips */}
      <div className="flex flex-wrap gap-2">
        {ORDER_STATUSES.map((s) => (
          <span key={s} className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${ORDER_STATUS_BADGE[s]}`}>
            {STATUS_LABEL[s]}: {counts[s]}
          </span>
        ))}
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Placed</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-ink-400">No orders yet.</td></tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-ink-600">{o.reference}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-500">{o.user_id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-bold text-ink-900">{formatPrice(Number(o.amount), o.currency)}</td>
                  <td className="px-4 py-3 text-ink-500">{new Date(o.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${ORDER_STATUS_BADGE[o.payment_status] ?? ORDER_STATUS_BADGE.pending}`}>
                      {STATUS_LABEL[o.payment_status] ?? o.payment_status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
