export type PaymentStatus = "pending" | "awaiting_payment" | "paid" | "failed" | "expired";

// Colour-coded badge classes per the spec:
// gray pending, blue awaiting_payment, green paid, red failed, orange expired.
export const ORDER_STATUS_BADGE: Record<PaymentStatus, string> = {
  pending: "bg-ink-100 text-ink-600 ring-ink-200",
  awaiting_payment: "bg-blue-500/15 text-blue-600 ring-blue-500/40",
  paid: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/40",
  failed: "bg-red-500/15 text-red-600 ring-red-500/40",
  expired: "bg-orange-500/15 text-orange-600 ring-orange-500/40",
};

export const ORDER_STATUSES: PaymentStatus[] = ["pending", "awaiting_payment", "paid", "failed", "expired"];
