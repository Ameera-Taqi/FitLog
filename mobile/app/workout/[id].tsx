import { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
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
  const doneExercises = exercises.filter((e) => e.completed).length;
  const pct =
    exercises.length > 0
      ? Math.round((doneExercises / exercises.length) * 100)
      : w.completed
        ? 100
        : 0;
  const rests = exercises.flatMap((e) => (e.exercise_sets ?? []).map((st) => st.rest_seconds).filter((n): n is number => n != null));
  const avgRest = rests.length ? Math.round(rests.reduce((a, b) => a + b, 0) / rests.length) : null;

  async function toggleExerciseComplete(exerciseId: string, next: boolean) {
    const siblings = exercises.filter((e) => e.id !== exerciseId);
    const allDone = next && siblings.every((e) => e.completed);

    setW((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        completed: allDone,
        exercises: (prev.exercises ?? []).map((e) =>
          e.id === exerciseId ? { ...e, completed: next } : e,
        ),
      };
    });

    const { error } = await supabase.from("exercises").update({ completed: next }).eq("id", exerciseId);
    if (error) {
      Alert.alert("Couldn't update", error.message);
      load();
      return;
    }
    await supabase.from("workouts").update({ completed: allDone }).eq("id", id);
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></TouchableOpacity>
        <Text style={s.topTitle}>Workout Insights</Text>
        <TouchableOpacity onPress={confirmDelete}><Text style={s.delete}>Delete</Text></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={s.workoutName}>{w.name}</Text>
        <ProgressRing pct={pct} />
        <Text style={s.dateLine}>
          {formatDate(w.workout_date)}{w.location ? ` · ${w.location}` : ""} · {meta.icon} {meta.label}
        </Text>

        <View style={s.sheet}>
          <View style={s.insightGrid}>
            <Insight icon="🔥" value={w.calories_burned != null ? `${w.calories_burned} Cal` : "—"} label="Calories Burnt" />
            <Insight icon="⏱" value={formatDuration(w.duration_minutes) || "—"} label="Time Taken" />
            <Insight icon="⏳" value={avgRest != null ? `${avgRest}s` : "—"} label="Average Rest" />
            <Insight icon="🏋️" value={`${setCount} Set`} label="Exercises Performed" />
          </View>

          <Text style={s.sectionTitle}>Exercise Insights</Text>
          {exercises.length === 0 ? (
            <View style={s.whiteCard}><Text style={{ color: theme.colors.onSheetMuted }}>No exercises recorded.</Text></View>
          ) : exercises.map((ex, i) => {
            const sets = (ex.exercise_sets ?? []).slice().sort((a, b) => a.set_number - b.set_number);
            const maxWeight = Math.max(0, ...sets.map((st) => st.weight ?? 0));
            return (
              <View key={ex.id ?? i} style={[s.whiteCard, ex.completed && s.whiteCardDone]}>
                <View style={s.exTitleRow}>
                  <Text style={s.exName}>Exercise {i + 1} — {ex.name}</Text>
                  {ex.id ? (
                    <TouchableOpacity
                      onPress={() => toggleExerciseComplete(ex.id!, !ex.completed)}
                      style={[s.doneChip, ex.completed && s.doneChipOn]}
                    >
                      <View style={[s.miniCheck, ex.completed && s.miniCheckOn]}>
                        {ex.completed ? <Text style={s.miniCheckMark}>✓</Text> : null}
                      </View>
                      <Text style={[s.doneChipText, ex.completed && s.doneChipTextOn]}>Done</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <View style={s.metricRow}>
                  <View style={s.darkMetric}>
                    <Text style={s.metricIcon}>🏋️</Text>
                    <View>
                      <Text style={s.metricValue}>{maxWeight ? `${maxWeight} kg` : "—"}</Text>
                      <Text style={s.metricLabel}>Weight Lifted</Text>
                    </View>
                  </View>
                  <View style={s.darkMetric}>
                    <Text style={s.metricIcon}>★</Text>
                    <View>
                      <Text style={s.metricValue}>{volume ? `${volume} kg` : "—"}</Text>
                      <Text style={s.metricLabel}>Session Volume</Text>
                    </View>
                  </View>
                </View>
                {sets.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    <View style={s.setHead}>
                      <Text style={[s.setHeadText, { width: 32 }]}>SET</Text>
                      <Text style={[s.setHeadText, { flex: 1 }]}>REPS</Text>
                      <Text style={[s.setHeadText, { flex: 1 }]}>WEIGHT</Text>
                      <Text style={[s.setHeadText, { flex: 1 }]}>REST</Text>
                    </View>
                    {sets.map((st) => (
                      <View key={st.id} style={s.setRow}>
                        <Text style={[s.setCell, { width: 32, color: theme.colors.onSheetMuted, fontWeight: "700" }]}>{st.set_number}</Text>
                        <Text style={[s.setCell, { flex: 1 }]}>{st.reps ?? "—"}</Text>
                        <Text style={[s.setCell, { flex: 1 }]}>{st.weight != null ? `${st.weight} kg` : "—"}</Text>
                        <Text style={[s.setCell, { flex: 1 }]}>{st.rest_seconds != null ? `${st.rest_seconds}s` : "—"}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {ex.is_pr && <Text style={s.prTag}>★ Personal Record</Text>}
                {ex.notes ? <Text style={s.exNotes}>{ex.notes}</Text> : null}
              </View>
            );
          })}

          <View style={s.whiteCard}>
            <Text style={s.detailTitle}>Session details</Text>
            <Detail label="Difficulty" value={difficultyLabel(w.difficulty)} />
            <Detail label="Energy before" value={w.energy_before != null ? `${w.energy_before}/5` : "—"} />
            <Detail label="Body weight" value={w.body_weight != null ? `${w.body_weight} kg` : "—"} />
            <Detail label="Notes" value={w.notes || "—"} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const size = 180;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c - (clamped / 100) * c;
  return (
    <View style={{ alignItems: "center", marginTop: 12 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#FF8A6B" />
              <Stop offset="100%" stopColor="#FF6B4E" />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#ringGrad)"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={s.ringInner}>
          <Text style={s.ringPct}>{clamped}%</Text>
          <Text style={s.ringSub}>Of workout completed!</Text>
        </View>
      </View>
    </View>
  );
}

function Insight({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <View style={s.insightCard}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={s.insightValue}>{value}</Text>
      <Text style={s.insightLabel}>{label}</Text>
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
  safe: { flex: 1, backgroundColor: "#1E2128" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.bg },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  back: { color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 15 },
  topTitle: { color: theme.colors.white, fontWeight: "700", fontSize: 14, textTransform: "uppercase", letterSpacing: 0.4 },
  delete: { color: theme.colors.danger, fontWeight: "700", fontSize: 15 },
  workoutName: { textAlign: "center", color: theme.colors.white, fontSize: 18, fontWeight: "800", paddingHorizontal: 16 },
  dateLine: { textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 10, marginBottom: 8 },
  ringInner: {
    ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", paddingHorizontal: 16,
  },
  ringPct: { fontSize: 40, fontWeight: "800", color: theme.colors.white },
  ringSub: { marginTop: 4, fontSize: 11, color: "rgba(255,255,255,0.65)", textAlign: "center", maxWidth: 110 },
  sheet: {
    marginTop: 16, backgroundColor: theme.colors.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 16, minHeight: 500,
  },
  insightGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  insightCard: {
    width: "48%", flexGrow: 1, backgroundColor: theme.colors.white, borderRadius: theme.radius.lg,
    padding: 14, alignItems: "center",
  },
  insightValue: { marginTop: 6, fontSize: 18, fontWeight: "800", color: theme.colors.brand },
  insightLabel: { marginTop: 2, fontSize: 11, color: theme.colors.onSheetMuted, fontWeight: "600" },
  sectionTitle: { marginTop: 22, marginBottom: 10, fontSize: 18, fontWeight: "800", color: theme.colors.onSheet },
  whiteCard: { backgroundColor: theme.colors.white, borderRadius: theme.radius.lg, padding: 14, marginBottom: 10 },
  whiteCardDone: { borderWidth: 2, borderColor: "rgba(255,107,78,0.45)" },
  exTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  exName: { fontSize: 15, fontWeight: "700", color: theme.colors.onSheet, flex: 1 },
  doneChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.full, backgroundColor: "#F0F1F3",
  },
  doneChipOn: { backgroundColor: theme.colors.brand },
  doneChipText: { fontSize: 12, fontWeight: "800", color: theme.colors.onSheetMuted },
  doneChipTextOn: { color: theme.colors.white },
  miniCheck: {
    width: 16, height: 16, borderRadius: 4, borderWidth: 2, borderColor: "#9CA3AF",
    alignItems: "center", justifyContent: "center",
  },
  miniCheckOn: { borderColor: theme.colors.white, backgroundColor: theme.colors.white },
  miniCheckMark: { color: theme.colors.brand, fontSize: 10, fontWeight: "800", lineHeight: 12 },
  metricRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  darkMetric: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#2A2D36", borderRadius: theme.radius.md, padding: 10,
  },
  metricIcon: { fontSize: 16 },
  metricValue: { color: theme.colors.white, fontWeight: "700", fontSize: 13 },
  metricLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, marginTop: 1 },
  setHead: { flexDirection: "row", gap: 8 },
  setHeadText: { fontSize: 10, fontWeight: "700", color: theme.colors.onSheetMuted },
  setRow: { flexDirection: "row", gap: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: "#EEE", paddingTop: 6 },
  setCell: { fontSize: 14, color: theme.colors.onSheet },
  prTag: { marginTop: 8, color: theme.colors.amber, fontWeight: "700", fontSize: 12 },
  exNotes: { marginTop: 8, color: theme.colors.onSheetMuted, fontSize: 13 },
  detailTitle: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, color: theme.colors.onSheetMuted, marginBottom: 8 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  detailLabel: { color: theme.colors.onSheetMuted, fontSize: 14 },
  detailValue: { color: theme.colors.onSheet, fontWeight: "600", fontSize: 14, flexShrink: 1, textAlign: "right", marginLeft: 12 },
});
