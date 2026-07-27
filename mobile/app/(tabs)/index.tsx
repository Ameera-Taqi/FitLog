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
        <View>
          <Text style={s.title}>Workouts</Text>
          <Text style={s.subtitle}>{workouts.length} sessions · {weekCount} this week</Text>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => router.push("/(tabs)/new")}>
          <Text style={s.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchRow}>
        <TextInput
          style={s.search}
          placeholder="Search workout name…"
          placeholderTextColor={theme.colors.ink400}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={load}
          returnKeyType="search"
        />
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
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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
        renderItem={({ item }) => <WorkoutRow workout={item} onPress={() => router.push(`/workout/${item.id}`)} />}
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

function WorkoutRow({ workout, onPress }: { workout: Workout; onPress: () => void }) {
  const meta = typeMeta(workout.workout_type);
  const exCount = workout.exercises?.length ?? 0;
  const setCount = workout.exercises?.reduce((n, e) => n + (e.exercise_sets?.length ?? 0), 0) ?? 0;
  const hasPR = workout.exercises?.some((e) => e.is_pr);
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.7}>
      <View style={s.cardTop}>
        <View style={s.cardIcon}><Text style={{ fontSize: 22 }}>{meta.icon}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle} numberOfLines={1}>{workout.name}</Text>
          <Text style={s.cardDate}>{formatDate(workout.workout_date)}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={[s.badge, workout.completed ? s.badgeGreen : s.badgeGray]}>
            <Text style={[s.badgeText, workout.completed ? s.badgeTextGreen : s.badgeTextGray]}>
              {workout.completed ? "Completed" : "In progress"}
            </Text>
          </View>
          {hasPR && <View style={[s.badge, s.badgeAmber]}><Text style={[s.badgeText, s.badgeTextAmber]}>★ PR</Text></View>}
        </View>
      </View>
      <View style={s.cardMeta}>
        <Text style={s.metaStrong}>{meta.label}</Text>
        {exCount > 0 && <Text style={s.metaText}>· {exCount} ex · {setCount} sets</Text>}
        {workout.duration_minutes != null && <Text style={s.metaText}>· {formatDuration(workout.duration_minutes)}</Text>}
      </View>
      {(workout.muscle_groups ?? []).length > 0 && (
        <View style={s.muscleRow}>
          {(workout.muscle_groups ?? []).slice(0, 4).map((m) => (
            <View key={m} style={s.muscleChip}><Text style={s.muscleText}>{m}</Text></View>
          ))}
          {(workout.muscle_groups ?? []).length > 4 && <Text style={s.metaText}>+{(workout.muscle_groups ?? []).length - 4}</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.ink900 },
  subtitle: { color: theme.colors.ink500, fontSize: 13, marginTop: 2 },
  newBtn: { backgroundColor: theme.colors.brand, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.md },
  newBtnText: { color: "#fff", fontWeight: "700" },
  searchRow: { paddingHorizontal: 16, paddingTop: 10 },
  search: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.ink200, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: theme.colors.ink900 },
  filterScroll: { maxHeight: 52, marginTop: 10 },
  filterRow: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  sep: { width: 1, height: 22, backgroundColor: theme.colors.ink200, marginHorizontal: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.full, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.ink200 },
  chipActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.colors.ink600 },
  chipTextActive: { color: "#fff" },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, marginBottom: 10, ...theme.shadow },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.ink900 },
  cardDate: { fontSize: 12, color: theme.colors.ink500, marginTop: 1 },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4, marginTop: 10 },
  metaStrong: { fontSize: 12, fontWeight: "700", color: theme.colors.ink700 },
  metaText: { fontSize: 12, color: theme.colors.ink500 },
  muscleRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" },
  muscleChip: { backgroundColor: theme.colors.ink100, paddingHorizontal: 9, paddingVertical: 4, borderRadius: theme.radius.full },
  muscleText: { fontSize: 11, color: theme.colors.ink600, fontWeight: "500" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.full },
  badgeGreen: { backgroundColor: theme.colors.brandSoft },
  badgeGray: { backgroundColor: theme.colors.ink100 },
  badgeAmber: { backgroundColor: theme.colors.amberSoft },
  badgeText: { fontSize: 10, fontWeight: "700" },
  badgeTextGreen: { color: theme.colors.brandDark },
  badgeTextGray: { color: theme.colors.ink500 },
  badgeTextAmber: { color: theme.colors.amber },
  empty: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.ink900 },
  emptyText: { color: theme.colors.ink500, marginTop: 4 },
});
