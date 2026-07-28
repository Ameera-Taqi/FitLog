import { redirect } from "next/navigation";

type SP = { [key: string]: string | string[] | undefined };

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? "" : v ?? "";
}

/** Calendar now lives under Workouts → Your Plans. */
export default function CalendarPage({ searchParams }: { searchParams: SP }) {
  const month = one(searchParams.month);
  redirect(month ? `/workouts?tab=yours&month=${month}` : "/workouts?tab=yours");
}
