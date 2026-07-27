export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-extrabold tracking-tight ${className}`}>
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 6.5v11M4 9v6M17.5 6.5v11M20 9v6M6.5 12h11" />
        </svg>
      </span>
      <span className="text-ink-900">
        Fit<span className="text-brand-500">Log</span>
      </span>
    </span>
  );
}
