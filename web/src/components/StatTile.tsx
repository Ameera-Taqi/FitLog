export function StatTile({
  label,
  value,
  sub,
  icon,
  accent = "brand",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: "brand" | "accent" | "ink";
}) {
  const accentBg =
    accent === "accent"
      ? "bg-accent-500/15 text-accent-400"
      : accent === "ink"
        ? "bg-ink-100 text-ink-500"
        : "bg-brand-500/15 text-brand-400";
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        {icon && <span className={`grid h-9 w-9 place-items-center rounded-xl ${accentBg}`}>{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-ink-900 sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
    </div>
  );
}
