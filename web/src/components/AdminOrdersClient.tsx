"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  refunded: "Refunded",
};

// Colour per audit source.
const SOURCE_STYLE: Record<string, string> = {
  checkout: "bg-ink-100 text-ink-600 ring-ink-200",
  pay: "bg-blue-500/15 text-blue-600 ring-blue-500/40",
  webhook: "bg-violet-500/15 text-violet-600 ring-violet-500/40",
  return: "bg-teal-500/15 text-teal-600 ring-teal-500/40",
  cron: "bg-amber-500/15 text-amber-600 ring-amber-500/40",
  refund: "bg-rose-500/15 text-rose-600 ring-rose-500/40",
  system: "bg-ink-100 text-ink-500 ring-ink-200",
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

interface PaymentEvent {
  id: string;
  old_status: PaymentStatus | null;
  new_status: PaymentStatus;
  source: string;
  created_at: string;
}

function StatusPill({ s }: { s: PaymentStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${ORDER_STATUS_BADGE[s] ?? ORDER_STATUS_BADGE.pending}`}>
      {STATUS_LABEL[s] ?? s}
    </span>
  );
}

export function AdminOrdersClient() {
  const supabase = createClient();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [events, setEvents] = useState<Record<string, PaymentEvent[]>>({});
  const [refunding, setRefunding] = useState<string | null>(null);
  const expandedRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, reference, amount, currency, payment_status, created_at, user_id")
      .order("created_at", { ascending: false });
    setOrders((data ?? []) as unknown as AdminOrder[]);
  }, [supabase]);

  const loadEvents = useCallback(async (orderId: string) => {
    const { data } = await supabase
      .from("payment_events")
      .select("id, old_status, new_status, source, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    setEvents((m) => ({ ...m, [orderId]: (data ?? []) as unknown as PaymentEvent[] }));
  }, [supabase]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
      await load();
      setLoading(false);
    })();
    // Live updates: any change to orders re-pulls the list; any new audit event
    // for the currently-open order refreshes its history — all with no refresh.
    const channel = supabase
      .channel("orders-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_events" }, (payload) => {
        const row = (payload.new ?? payload.old) as { order_id?: string } | null;
        if (row?.order_id && row.order_id === expandedRef.current) loadEvents(row.order_id);
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => { supabase.removeChannel(channel); };
  }, [load, loadEvents, supabase]);

  function toggle(orderId: string) {
    const next = expandedRef.current === orderId ? null : orderId;
    expandedRef.current = next;
    setExpanded(next);
    if (next) loadEvents(next);
  }

  // Refund a paid order: the edge function calls MyFatoorah's refund endpoint
  // and flips payment_status to 'refunded'. Realtime updates the badge + history.
  async function refund(o: AdminOrder) {
    if (refunding) return;
    if (!confirm(`Refund order ${o.reference} for ${formatPrice(Number(o.amount), o.currency)}? This cannot be undone.`)) return;
    setRefunding(o.id);
    const { data, error } = await supabase.functions.invoke("refund-order", { body: { orderId: o.id } });
    setRefunding(null);
    if (error || !data?.ok) {
      let msg = "Refund failed. Please try again.";
      try {
        const ctx = (error as { context?: Response } | null)?.context;
        const j = ctx ? await ctx.json() : null;
        if (j?.message) msg = j.message;
        else if (data?.message) msg = data.message;
      } catch { /* keep generic */ }
      alert(msg);
      return;
    }
    load();
    if (expandedRef.current === o.id) loadEvents(o.id);
  }

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
          <p className="text-sm text-ink-500">All customer orders and payment status. Click a row for its full payment history.</p>
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
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-ink-200 text-xs uppercase tracking-wide text-ink-400">
            <tr>
              <th className="w-6 px-4 py-3" />
              <th className="px-4 py-3 font-semibold">Reference</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Placed</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-400">No orders yet.</td></tr>
            ) : (
              orders.map((o) => (
                <ExpandableRow
                  key={o.id}
                  order={o}
                  open={expanded === o.id}
                  events={events[o.id]}
                  onToggle={() => toggle(o.id)}
                  onRefund={() => refund(o)}
                  refunding={refunding === o.id}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpandableRow({
  order: o,
  open,
  events,
  onToggle,
  onRefund,
  refunding,
}: {
  order: AdminOrder;
  open: boolean;
  events: PaymentEvent[] | undefined;
  onToggle: () => void;
  onRefund: () => void;
  refunding: boolean;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b border-ink-100 last:border-0 hover:bg-ink-50"
      >
        <td className="px-4 py-3 text-ink-400">
          <span className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-ink-600">{o.reference}</td>
        <td className="px-4 py-3 font-mono text-xs text-ink-500">{o.user_id.slice(0, 8)}</td>
        <td className="px-4 py-3 font-bold text-ink-900">{formatPrice(Number(o.amount), o.currency)}</td>
        <td className="px-4 py-3 text-ink-500">{new Date(o.created_at).toLocaleString()}</td>
        <td className="px-4 py-3"><StatusPill s={o.payment_status} /></td>
      </tr>
      {open && (
        <tr className="border-b border-ink-100 bg-ink-50/60">
          <td colSpan={6} className="px-6 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">Payment history</p>
              {o.payment_status === "paid" && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRefund(); }}
                  disabled={refunding}
                  className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {refunding ? "Refunding…" : "Refund"}
                </button>
              )}
            </div>
            {events === undefined ? (
              <p className="text-sm text-ink-400">Loading…</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-ink-400">No events recorded.</p>
            ) : (
              <ol className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-44 shrink-0 font-mono text-xs text-ink-500">
                      {new Date(e.created_at).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {e.old_status ? <StatusPill s={e.old_status} /> : <span className="text-xs text-ink-400">created</span>}
                      <span className="text-ink-400">→</span>
                      <StatusPill s={e.new_status} />
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${SOURCE_STYLE[e.source] ?? SOURCE_STYLE.system}`}>
                      {e.source}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
