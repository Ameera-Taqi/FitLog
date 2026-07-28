import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ScrollView, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import {
  Workout, WORKOUT_TYPES, typeMeta, formatDuration, WorkoutType,
} from "@/lib/types";
import { fetchWorkoutPhotoHeroMap } from "@/lib/hero";
import { CalendarPanel } from "@/components/CalendarPanel";

const fallbackHero = require("../../assets/workout-hero.png");

export default function WorkoutsList() {
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [photoHeroMap, setPhotoHeroMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"explore" | "yours">(tabParam === "yours" ? "yours" : "explore");
  const [type, setType] = useState<WorkoutType | "">("");
  const [status, setStatus] = useState<"" | "completed" | "incomplete">("");

  useEffect(() => {
    if (tabParam === "yours") setTab("yours");
  }, [tabParam]);

  const load = useCallback(async () => {
    if (tab === "yours") {
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase
      .from("workouts")
      .select("*, exercises(*, exercise_sets(*)), progress_photos(id, storage_path, created_at)")
      .order("workout_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
    if (type) q = q.eq("workout_type", type);
    if (status === "completed") q = q.eq("completed", true);
    if (status === "incomplete") q = q.eq("completed", false);

    const { data } = await q.limit(100);
    const seen = new Set<string>();
    const unique = ((data ?? []) as Workout[])
      .filter((w) => {
        if (!w?.id || seen.has(w.id)) return false;
        seen.add(w.id);
        return true;
      })
      .sort((a, b) => {
        const byDate = (b.workout_date ?? "").localeCompare(a.workout_date ?? "");
        if (byDate !== 0) return byDate;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      });
    setWorkouts(unique);
    const heroes = await fetchWorkoutPhotoHeroMap(unique);
    setPhotoHeroMap(heroes);
    setLoading(false);
  }, [search, type, status, tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <View style={s.titleRow}>
          <Text style={s.titleIcon}>🏋️</Text>
          <View>
            <Text style={s.title}>Workout Library</Text>
            <Text style={s.subtitle}>
              {tab === "yours"
                ? "Tap a day to assign a workout"
                : `${workouts.length} workouts · Explore your library`}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => router.push("/(tabs)/new")}>
          <Text style={s.newBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <View style={s.tabs}>
        <TouchableOpacity onPress={() => setTab("explore")}>
          <Text style={[s.tab, tab === "explore" && s.tabActive]}>Explore</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab("yours")}>
          <Text style={[s.tab, tab === "yours" && s.tabActive]}>Your Plans</Text>
        </TouchableOpacity>
      </View>

      {tab === "yours" ? (
        <CalendarPanel />
      ) : (
        <>
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
        renderItem={({ item }) => (
          <WorkoutTile
            workout={item}
            heroUri={photoHeroMap.get(item.id)}
            onPress={() => router.push(`/workout/${item.id}`)}
          />
        )}
      />
        </>
      )}
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

function WorkoutTile({
  workout,
  heroUri,
  onPress,
}: {
  workout: Workout;
  heroUri?: string;
  onPress: () => void;
}) {
  const meta = typeMeta(workout.workout_type);
  const hasPR = workout.exercises?.some((e) => e.is_pr);
  const hasUserPhoto = Boolean(heroUri);
  const exCount = workout.exercises?.length ?? 0;
  const setCount = (workout.exercises ?? []).reduce((n, e) => n + (e.exercise_sets?.length ?? 0), 0);
  return (
    <TouchableOpacity style={s.tile} onPress={onPress} activeOpacity={0.85}>
      <View style={s.tileHero}>
        <Image
          source={hasUserPhoto ? { uri: heroUri } : fallbackHero}
          style={hasUserPhoto ? s.tileImageUser : s.tileImageDefault}
          resizeMode="cover"
        />
        <View style={s.tileGradient} />
        <View style={s.tileOverlay}>
          <Text style={s.tileBadge}>{meta.label}</Text>
          {workout.duration_minutes != null && (
            <Text style={s.tileBadge}>{formatDuration(workout.duration_minutes)}</Text>
          )}
        </View>
      </View>
      <Text style={s.tileTitle} numberOfLines={1}>{workout.name}</Text>
      <View style={s.tileStatusRow}>
        <Text style={[s.tileStatus, workout.completed ? s.tileStatusDone : s.tileStatusProgress]}>
          {workout.completed ? "Completed" : "In progress"}
        </Text>
        {hasPR ? <Text style={s.tilePr}>★ PR</Text> : null}
      </View>
      {(workout.exercises?.length ?? 0) > 0 && (
        <Text style={s.tileMeta} numberOfLines={1}>
          {exCount} {exCount === 1 ? "exercise" : "exercises"} · {setCount} sets
          {workout.difficulty ? ` · ${workout.difficulty}` : ""}
        </Text>
      )}
      {(workout.muscle_groups ?? []).length > 0 && (
        <Text style={s.tileSub} numberOfLines={1}>
          {(workout.muscle_groups ?? []).slice(0, 3).join(" · ")}
        </Text>
      )}
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
    aspectRatio: 16 / 10,
    borderRadius: theme.radius.lg,
    backgroundColor: "#12141A",
    overflow: "hidden",
    justifyContent: "flex-end",
    ...theme.shadow,
  },
  tileImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  // Always anchor to the top of the photo (faces stay in frame)
  tileImageUser: {
    position: "absolute",
    left: 0,
    right: 0,
    width: "100%",
    height: "100%",
    top: 0,
  },
  tileImageDefault: {
    ...StyleSheet.absoluteFillObject,
    width: "114%",
    height: "114%",
    left: "-7%",
    top: "-7%",
  },
  tileGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  tileOverlay: {
    flexDirection: "row", justifyContent: "space-between", padding: 10,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  tileBadge: { color: theme.colors.white, fontSize: 11, fontWeight: "700" },
  tileTitle: { marginTop: 8, fontSize: 14, fontWeight: "700", color: theme.colors.ink900 },
  tileStatusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" },
  tileStatus: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  tileStatusDone: { color: theme.colors.brand },
  tileStatusProgress: { color: theme.colors.ink400 },
  tilePr: { fontSize: 10, fontWeight: "800", color: theme.colors.amber },
  tileMeta: { marginTop: 4, fontSize: 11, color: theme.colors.ink500 },
  tileSub: { marginTop: 2, fontSize: 11, color: theme.colors.ink400 },
  empty: { alignItems: "center", paddingTop: 80, width: "100%" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: theme.colors.ink900 },
  emptyText: { color: theme.colors.ink500, marginTop: 4 },
});
