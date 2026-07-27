import { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { Workout, typeMeta, difficultyLabel, formatDate, formatDuration, totalVolume } from "@/lib/types";

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [w, setW] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("workouts").select("*, exercises(*, exercise_sets(*))").eq("id", id).single();
    setW((data as Workout) ?? null);
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmDelete() {
    Alert.alert("Delete workout", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.from("workouts").delete().eq("id", id);
        router.back();
      } },
    ]);
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>;
  }
  if (!w) {
    return <View style={s.center}><Text style={{ color: theme.colors.ink500 }}>Workout not found.</Text></View>;
  }

  const meta = typeMeta(w.workout_type);
  const exercises = (w.exercises ?? []).slice().sort((a, b) => a.position - b.position);
  const setCount = exercises.reduce((n, e) => n + (e.exercise_sets?.length ?? 0), 0);
  const volume = totalVolume(exercises);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete}><Text style={s.delete}>Delete</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View style={s.card}>
          <View style={s.headerRow}>
            <View style={s.icon}><Text style={{ fontSize: 28 }}>{meta.icon}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{w.name}</Text>
              <Text style={s.date}>{formatDate(w.workout_date)}{w.location ? ` · ${w.location}` : ""}</Text>
            </View>
          </View>
          <View style={s.badgeRow}>
            <View style={[s.badge, s.badgeGreen]}><Text style={[s.badgeText, { color: theme.colors.brandDark }]}>{meta.label}</Text></View>
            <View style={[s.badge, w.completed ? s.badgeGreen : s.badgeGray]}>
              <Text style={[s.badgeText, { color: w.completed ? theme.colors.brandDark : theme.colors.ink500 }]}>{w.completed ? "✓ Completed" : "In progress"}</Text>
            </View>
            {exercises.some((e) => e.is_pr) && <View style={[s.badge, s.badgeAmber]}><Text style={[s.badgeText, { color: theme.colors.amber }]}>★ PR</Text></View>}
          </View>
          <View style={s.statBar}>
            <Stat label="Duration" value={formatDuration(w.duration_minutes)} />
            <Stat label="Exercises" value={`${exercises.length}·${setCount}`} />
            <Stat label="Volume" value={volume ? `${volume}kg` : "—"} />
            <Stat label="Calories" value={w.calories_burned != null ? String(w.calories_burned) : "—"} />
          </View>
        </View>

        {(w.muscle_groups ?? []).length > 0 && (
          <View style={s.muscleWrap}>
            {(w.muscle_groups ?? []).map((m) => <View key={m} style={s.muscleChip}><Text style={s.muscleText}>{m}</Text></View>)}
          </View>
        )}

        <Text style={s.sectionTitle}>Exercises</Text>
        {exercises.length === 0 ? (
          <View style={s.card}><Text style={{ color: theme.colors.ink400 }}>No exercises recorded.</Text></View>
        ) : exercises.map((ex, i) => {
          const sets = (ex.exercise_sets ?? []).slice().sort((a, b) => a.set_number - b.set_number);
          return (
            <View key={ex.id ?? i} style={s.card}>
              <View style={s.exTitleRow}>
                <View style={s.exNum}><Text style={s.exNumText}>{i + 1}</Text></View>
                <Text style={s.exName}>{ex.name}</Text>
                {ex.is_pr && <View style={[s.badge, s.badgeAmber]}><Text style={[s.badgeText, { color: theme.colors.amber }]}>★ PR</Text></View>}
              </View>
              {sets.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <View style={s.setHead}>
                    <Text style={[s.setHeadText, { width: 32 }]}>SET</Text>
                    <Text style={[s.setHeadText, { flex: 1 }]}>REPS</Text>
                    <Text style={[s.setHeadText, { flex: 1 }]}>WEIGHT</Text>
                    <Text style={[s.setHeadText, { flex: 1 }]}>REST</Text>
                  </View>
                  {sets.map((st) => (
                    <View key={st.id} style={s.setRow}>
                      <Text style={[s.setCell, { width: 32, color: theme.colors.ink400, fontWeight: "700" }]}>{st.set_number}</Text>
                      <Text style={[s.setCell, { flex: 1 }]}>{st.reps ?? "—"}</Text>
                      <Text style={[s.setCell, { flex: 1 }]}>{st.weight != null ? `${st.weight} kg` : "—"}</Text>
                      <Text style={[s.setCell, { flex: 1 }]}>{st.rest_seconds != null ? `${st.rest_seconds}s` : "—"}</Text>
                    </View>
                  ))}
                </View>
              )}
              {ex.notes ? <Text style={s.exNotes}>{ex.notes}</Text> : null}
            </View>
          );
        })}

        <View style={s.card}>
          <Text style={s.detailTitle}>Session details</Text>
          <Detail label="Difficulty" value={difficultyLabel(w.difficulty)} />
          <Detail label="Energy before" value={w.energy_before != null ? `${w.energy_before}/5` : "—"} />
          <Detail label="Body weight" value={w.body_weight != null ? `${w.body_weight} kg` : "—"} />
          <Detail label="Notes" value={w.notes || "—"} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg },
  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  back: { color: theme.colors.ink600, fontWeight: "700", fontSize: 15 },
  delete: { color: theme.colors.danger, fontWeight: "700", fontSize: 15 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, marginBottom: 12, ...theme.shadow },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 56, height: 56, borderRadius: theme.radius.lg, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: theme.colors.ink900 },
  date: { fontSize: 13, color: theme.colors.ink500, marginTop: 2 },
  badgeRow: { flexDirection: "row", gap: 6, marginTop: 12, flexWrap: "wrap" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.full },
  badgeGreen: { backgroundColor: theme.colors.brandSoft },
  badgeGray: { backgroundColor: theme.colors.ink100 },
  badgeAmber: { backgroundColor: theme.colors.amberSoft },
  badgeText: { fontSize: 11, fontWeight: "700" },
  statBar: { flexDirection: "row", marginTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.ink100, paddingTop: 12 },
  statLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", color: theme.colors.ink400 },
  statValue: { fontSize: 15, fontWeight: "800", color: theme.colors.ink900, marginTop: 2 },
  muscleWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  muscleChip: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.ink200, paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.full },
  muscleText: { fontSize: 12, color: theme.colors.ink700, fontWeight: "600" },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.ink900, marginBottom: 8 },
  exTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  exNum: { width: 26, height: 26, borderRadius: 8, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center" },
  exNumText: { fontWeight: "800", color: theme.colors.brandDark, fontSize: 12 },
  exName: { fontSize: 16, fontWeight: "700", color: theme.colors.ink900, flex: 1 },
  setHead: { flexDirection: "row", gap: 8 },
  setHeadText: { fontSize: 10, fontWeight: "700", color: theme.colors.ink400 },
  setRow: { flexDirection: "row", gap: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: theme.colors.ink50, paddingTop: 6 },
  setCell: { fontSize: 14, color: theme.colors.ink800 },
  exNotes: { marginTop: 8, color: theme.colors.ink500, fontSize: 13 },
  detailTitle: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, color: theme.colors.ink500, marginBottom: 8 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.ink50 },
  detailLabel: { color: theme.colors.ink500, fontSize: 14 },
  detailValue: { color: theme.colors.ink800, fontWeight: "600", fontSize: 14, flexShrink: 1, textAlign: "right", marginLeft: 12 },
});
