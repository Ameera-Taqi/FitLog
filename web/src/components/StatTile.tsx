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
    <div className="card flex h-full items-center gap-4 p-4 sm:p-5">
      {icon && (
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${accentBg}`}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-2xl font-extrabold tabular-nums tracking-tight text-ink-900">{value}</p>
        <p className="mt-0.5 text-xs font-medium text-ink-500">{label}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-ink-400">{sub}</p>}
      </div>
    </div>
  );
}
