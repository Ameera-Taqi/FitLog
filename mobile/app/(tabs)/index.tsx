import { useCallback, useState } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import {
  Workout, WORKOUT_TYPES, typeMeta, formatDate, formatDuration, WorkoutType,
} from "@/lib/types";

export default function WorkoutsList() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<WorkoutType | "">("");
  const [status, setStatus] = useState<"" | "completed" | "incomplete">("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("workouts")
      .select("*, exercises(*, exercise_sets(*))")
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
    if (type) q = q.eq("workout_type", type);
    if (status === "completed") q = q.eq("completed", true);
    if (status === "incomplete") q = q.eq("completed", false);

    const { data } = await q.limit(100);
    setWorkouts((data ?? []) as Workout[]);
    setLoading(false);
  }, [search, type, status]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const weekCount = workouts.filter((w) => {
    const d = new Date(w.workout_date + "T00:00:00");
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }).length;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View style={s.titleRow}>
          <Text style={s.titleIcon}>🏋️</Text>
          <View>
            <Text style={s.title}>Workout Plans</Text>
            <Text style={s.subtitle}>{workouts.length} sessions · {weekCount} this week</Text>
          </View>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => router.push("/(tabs)/new")}>
          <Text style={s.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        <Text style={[s.tab, s.tabActive]}>Explore</Text>
        <Text style={s.tab}>Your Plans</Text>
      </View>

      <View style={s.searchRow}>
        <View style={s.searchWrap}>
          <Text style={s.searchIcon}>⌕</Text>
          <TextInput
            style={s.search}
            placeholder="Search"
            placeholderTextColor={theme.colors.ink400}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={load}
            returnKeyType="search"
          />
          <Text style={s.filterIcon}>☰</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterRow}>
        <Chip label="All types" active={type === ""} onPress={() => setType("")} />
        {WORKOUT_TYPES.map((t) => (
          <Chip key={t.value} label={`${t.icon} ${t.label}`} active={type === t.value} onPress={() => setType(type === t.value ? "" : t.value)} />
        ))}
        <View style={s.sep} />
        <Chip label="✓ Done" active={status === "completed"} onPress={() => setStatus(status === "completed" ? "" : "completed")} />
        <Chip label="In progress" active={status === "incomplete"} onPress={() => setStatus(status === "incomplete" ? "" : "incomplete")} />
      </ScrollView>

      <FlatList
        data={workouts}
        keyExtractor={(w) => w.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={theme.colors.brand} />}
        ListEmptyComponent={
          !loading ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>🏋️</Text>
              <Text style={s.emptyTitle}>No workouts found</Text>
              <Text style={s.emptyText}>Log your first session to get started.</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <WorkoutTile workout={item} onPress={() => router.push(`/workout/${item.id}`)} />}
      />
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && s.chipActive]}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function WorkoutTile({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const meta = typeMeta(workout.workout_type);
  const hasPR = workout.exercises?.some((e) => e.is_pr);
  return (
    <TouchableOpacity style={s.tile} onPress={onPress} activeOpacity={0.85}>
      <View style={s.tileHero}>
        <Text style={s.tileEmoji}>{meta.icon}</Text>
        <View style={s.tileOverlay}>
          <Text style={s.tileBadge}>{meta.label}</Text>
          {workout.duration_minutes != null && (
            <Text style={s.tileBadge}>{formatDuration(workout.duration_minutes)}</Text>
          )}
        </View>
      </View>
      <Text style={s.tileTitle} numberOfLines={1}>{workout.name}</Text>
      <Text style={s.tileMeta} numberOfLines={1}>
        {formatDate(workout.workout_date)}{hasPR ? " · ★ PR" : ""}
      </Text>
      <Text style={s.tileSub} numberOfLines={1}>
        {workout.completed ? "Completed" : "In progress"}
        {(workout.muscle_groups ?? [])[0] ? ` · ${(workout.muscle_groups ?? [])[0]}` : ""}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleIcon: { fontSize: 22 },
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.ink900 },
  subtitle: { color: theme.colors.ink500, fontSize: 12, marginTop: 2 },
  newBtn: { backgroundColor: theme.colors.brand, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.full },
  newBtnText: { color: theme.colors.white, fontWeight: "700" },
  tabs: { flexDirection: "row", gap: 22, paddingHorizontal: 16, paddingTop: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.ink200 },
  tab: { paddingBottom: 10, color: theme.colors.ink400, fontWeight: "600", fontSize: 14 },
  tabActive: { color: theme.colors.ink900, borderBottomWidth: 2, borderBottomColor: theme.colors.ink900 },
  searchRow: { paddingHorizontal: 16, paddingTop: 14 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full, paddingHorizontal: 14, gap: 8,
  },
  searchIcon: { color: theme.colors.ink400, fontSize: 16 },
  search: { flex: 1, paddingVertical: 12, fontSize: 15, color: theme.colors.ink900 },
  filterIcon: { color: theme.colors.ink400, fontSize: 14, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: theme.colors.ink200 },
  filterScroll: { maxHeight: 52, marginTop: 12 },
  filterRow: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  sep: { width: 1, height: 22, backgroundColor: theme.colors.ink200, marginHorizontal: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.full, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.ink200 },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.colors.ink600 },
  chipTextActive: { color: theme.colors.white },
  tile: { flex: 1, maxWidth: "48%" },
  tileHero: {
    height: 140, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface,
    overflow: "hidden", justifyContent: "flex-end", ...theme.shadow,
  },
  tileEmoji: { position: "absolute", alignSelf: "center", top: "28%", fontSize: 42 },
  tileOverlay: {
    flexDirection: "row", justifyContent: "space-between", padding: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  tileBadge: { color: theme.colors.white, fontSize: 11, fontWeight: "700" },
  tileTitle: { marginTop: 8, fontSize: 14, fontWeight: "700", color: theme.colors.ink900 },
  tileMeta: { marginTop: 2, fontSize: 11, color: theme.colors.ink500 },
  tileSub: { marginTop: 2, fontSize: 11, color: theme.colors.ink400 },
  empty: { alignItems: "center", paddingTop: 80, width: "100%" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.ink900 },
  emptyText: { color: theme.colors.ink500, marginTop: 4 },
});
