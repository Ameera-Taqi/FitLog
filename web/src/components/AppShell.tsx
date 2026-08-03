"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { PreferenceControls } from "./PreferenceControls";
import { Logo } from "./Logo";

const NAV = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: DashIcon },
  { href: "/workouts", labelKey: "nav.workouts", icon: ListIcon },
  { href: "/workouts/new", labelKey: "nav.log", icon: PlusIcon },
  { href: "/shop", labelKey: "nav.shop", icon: ShopIcon },
  { href: "/profile", labelKey: "nav.profile", icon: UserIcon },
];

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { t } = useI18n();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isActive = (href: string) => {
    if (href === "/workouts") {
      return pathname === "/workouts" || (pathname.startsWith("/workouts/") && pathname !== "/workouts/new");
    }
    return pathname === href || (href === "/dashboard" && pathname === "/");
  };

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-ink-100/80 bg-ink-50/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" aria-label={t("nav.home")}>
            <Logo className="text-xl" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-brand-500/15 text-brand-400"
                      : "text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <PreferenceControls />
            <div className="group relative">
              <button className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white shadow-sm">
                {email.charAt(0).toUpperCase()}
              </button>
              <div className="invisible absolute end-0 top-full z-40 w-56 translate-y-1 rounded-2xl bg-surface p-2 opacity-0 shadow-cardhover ring-1 ring-ink-100 transition-all group-hover:visible group-hover:translate-y-2 group-hover:opacity-100">
                <p className="truncate px-3 py-2 text-xs text-ink-500">{email}</p>
                <Link href="/profile" className="block w-full rounded-xl px-3 py-2 text-start text-sm font-medium text-ink-700 hover:bg-ink-100">
                  {t("nav.profile")}
                </Link>
                <button onClick={signOut} className="w-full rounded-xl px-3 py-2 text-start text-sm font-medium text-red-400 hover:bg-red-500/10">
                  {t("nav.signOut")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8 lg:px-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100/80 bg-surface/95 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 px-1 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${
                  active ? "text-brand-500" : "text-ink-400"
                }`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${active ? "bg-brand-500/15" : ""}`}>
                  <Icon className="h-5 w-5" />
                </span>
                {t(item.labelKey)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function DashIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}
function ListIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
function PlusIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function UserIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function ShopIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h18l-1.4 9.3a2 2 0 0 1-2 1.7H6.4a2 2 0 0 1-2-1.7L3 9zM8 9V6a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
