import { Redirect } from "expo-router";

/** Calendar now lives under Workouts → Your Plans. */
export default function CalendarScreen() {
  return <Redirect href="/(tabs)/workouts" />;
}
