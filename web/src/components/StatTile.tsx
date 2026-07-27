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
    accent === "accent" ? "bg-accent-50 text-accent-600" : accent === "ink" ? "bg-ink-100 text-ink-600" : "bg-brand-50 text-brand-600";
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        {icon && <span className={`grid h-8 w-8 place-items-center rounded-lg ${accentBg}`}>{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-ink-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
    </div>
  );
}
