import { useCallback, useMemo, useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { Workout, typeMeta, formatDuration, totalVolume, isWorkoutCompleted, formatVolumeKg } from "@/lib/types";
import { DumbbellIcon, FlameIcon, ChartIcon, TrophyIcon } from "@/components/icons";
import type { ReactNode } from "react";

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function HomeDashboard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: u }, { data }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("workouts").select("*, exercises(*, exercise_sets(*))").order("workout_date", { ascending: false }).limit(300),
    ]);
    setEmail(u.user?.email ?? "");
    if (u.user?.id) {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("id", u.user.id).single();
      setDisplayName((prof?.display_name ?? "").trim());
    }
    setWorkouts((data ?? []) as Workout[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const name = displayName || (email || "Athlete").split("@")[0];
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekStart = startOfWeek(new Date());
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const totalWorkouts = workouts.length;
  const completed = workouts.filter(isWorkoutCompleted).length;
  const thisWeekWorkouts = workouts.filter((w) => new Date(w.workout_date + "T00:00:00") >= weekStart);
  const calories = workouts.reduce((s, w) => s + (w.calories_burned ?? 0), 0);
  const caloriesThisWeek = thisWeekWorkouts.reduce((s, w) => s + (w.calories_burned ?? 0), 0);
  const volume = workouts.reduce((s, w) => s + totalVolume(w.exercises), 0);
  const volumeStat = formatVolumeKg(volume);
  const prsAllTime = workouts.reduce((s, w) => s + (w.exercises?.filter((e) => e.is_pr).length ?? 0), 0);
  const prsThisMonth = workouts
    .filter((w) => new Date(w.workout_date + "T00:00:00") >= monthStart)
    .reduce((s, w) => s + (w.exercises?.filter((e) => e.is_pr).length ?? 0), 0);
  const todayWorkouts = workouts.filter((w) => w.workout_date === todayStr);
  const recent = workouts.slice(0, 5);
  const sheetList = todayWorkouts.length > 0 ? todayWorkouts : recent;

  const weeks = useMemo(() => {
    const out: { label: string; value: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(weekStart);
      ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws);
      we.setDate(we.getDate() + 7);
      const count = workouts.filter((w) => {
        const d = new Date(w.workout_date + "T00:00:00");
        return d >= ws && d < we;
      }).length;
      out.push({
        label: ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        value: count,
      });
    }
    return out;
  }, [workouts, weekStart]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.brand} />}
      >
        <View style={s.header}>
          <View style={s.welcomeRow}>
            <View style={s.avatar}><Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
            <View>
              <Text style={s.welcome}>Welcome Back</Text>
              <Text style={s.name}>{name}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.newBtn} onPress={() => router.push("/(tabs)/new")}>
            <Text style={s.newBtnText}>+ Log</Text>
          </TouchableOpacity>
        </View>

        <View style={s.statGrid}>
          <StatTile
            label="Total workouts"
            value={String(totalWorkouts)}
            sub={`${completed} completed`}
            icon={<DumbbellIcon color={theme.colors.brand} />}
          />
          <StatTile
            label="Calories Burnt"
            value={calories.toLocaleString()}
            sub={`This week: ${caloriesThisWeek.toLocaleString()}`}
            icon={<FlameIcon color={theme.colors.brand} />}
          />
          <StatTile
            label="Total volume"
            value={volumeStat.value}
            sub={volumeStat.sub}
            icon={<ChartIcon color={theme.colors.brand} />}
          />
          <StatTile
            label="PRs this month"
            value={String(prsThisMonth)}
            sub={`${prsAllTime} all time`}
            icon={<TrophyIcon color={theme.colors.brand} />}
          />
        </View>

        <View style={s.chartCard}>
          <View style={s.chartHead}>
            <Text style={s.chartTitle}>Training Volume</Text>
            <Text style={s.chartSub}>Last 8 weeks</Text>
          </View>
          <WeeklyChart data={weeks} />
        </View>

        <View style={s.sheet}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>{todayWorkouts.length > 0 ? "Today's Workouts" : "Recent Workouts"}</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/workouts")}>
              <Text style={s.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {sheetList.length === 0 ? (
            <Text style={s.emptySheet}>No workouts yet. Log your first session.</Text>
          ) : sheetList.map((w) => {
            const meta = typeMeta(w.workout_type);
            const exCount = w.exercises?.length ?? 0;
            return (
              <TouchableOpacity key={w.id} style={s.row} onPress={() => router.push(`/workout/${w.id}`)} activeOpacity={0.85}>
                <View style={s.rowIcon}><Text style={{ fontSize: 20 }}>{meta.icon}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{w.name}</Text>
                  <Text style={s.rowMeta}>
                    {exCount} {exCount === 1 ? "exercise" : "exercises"}
                    {w.duration_minutes != null ? ` · ${formatDuration(w.duration_minutes)}` : ""}
                  </Text>
                </View>
                <View style={s.play}><Text style={s.playText}>▶</Text></View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
}) {
  return (
    <View style={s.statTile}>
      <View style={s.statTileIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.statTileValue} numberOfLines={1}>{value}</Text>
        <Text style={s.statTileLabel} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={s.statTileSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function WeeklyChart({ data }: { data: { label: string; value: number }[] }) {
  const width = Dimensions.get("window").width - 64;
  const height = 120;
  const max = Math.max(1, ...data.map((d) => d.value));
  const padX = 8;
  const padY = 16;
  const points = data.map((d, i) => {
    const x = padX + (i / Math.max(1, data.length - 1)) * (width - padX * 2);
    const y = height - padY - (d.value / max) * (height - padY * 2);
    return { x, y, ...d };
  });
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${line} L ${points[points.length - 1]?.x ?? 0},${height} L ${points[0]?.x ?? 0},${height} Z`;
  const active = points[Math.min(points.length - 1, Math.floor(points.length / 2))];

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FF6B4E" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#FF6B4E" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#fill)" />
        <Path d={line} stroke="#FF6B4E" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {active && <Circle cx={active.x} cy={active.y} r={5} fill="#FF6B4E" />}
      </Svg>
      <View style={s.chartLabels}>
        {data.map((d, i) => (
          <Text key={i} style={s.chartLabel}>{d.label}</Text>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  welcomeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52, height: 52, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "800", color: theme.colors.white },
  welcome: { fontSize: 13, color: theme.colors.ink500 },
  name: { fontSize: 20, fontWeight: "800", color: theme.colors.ink900, textTransform: "capitalize" },
  newBtn: { backgroundColor: theme.colors.brand, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.full },
  newBtnText: { color: theme.colors.white, fontWeight: "700" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 16 },
  statTile: {
    width: "48%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, ...theme.shadow,
  },
  statTileIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.brandSoft,
    alignItems: "center", justifyContent: "center",
  },
  statTileValue: { fontSize: 22, fontWeight: "800", color: theme.colors.ink900 },
  statTileLabel: { marginTop: 2, fontSize: 11, color: theme.colors.ink500, fontWeight: "600" },
  statTileSub: { marginTop: 2, fontSize: 10, color: theme.colors.ink400 },
  chartCard: { marginTop: 16, marginHorizontal: 16, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, ...theme.shadow },
  chartHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  chartTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.ink900 },
  chartSub: { fontSize: 12, color: theme.colors.ink500, fontWeight: "600" },
  chartLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  chartLabel: { flex: 1, textAlign: "center", fontSize: 9, color: theme.colors.ink400 },
  sheet: {
    marginTop: 20, backgroundColor: theme.colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20, minHeight: 280,
  },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.ink900 },
  seeAll: { fontSize: 14, fontWeight: "700", color: theme.colors.brand },
  emptySheet: { color: theme.colors.ink500, fontSize: 14 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, padding: 12, marginBottom: 10, ...theme.shadow,
  },
  rowIcon: {
    width: 48, height: 48, borderRadius: theme.radius.full, backgroundColor: theme.colors.surface2,
    alignItems: "center", justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.ink900 },
  rowMeta: { marginTop: 2, fontSize: 12, color: theme.colors.ink500 },
  play: {
    width: 36, height: 36, borderRadius: theme.radius.full, backgroundColor: theme.colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  playText: { color: theme.colors.white, fontSize: 12, fontWeight: "800" },
});
