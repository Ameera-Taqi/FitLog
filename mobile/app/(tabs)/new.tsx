import { useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { WORKOUT_TYPES, MUSCLE_GROUPS, WorkoutType } from "@/lib/types";

type ExDifficulty = "" | "easy" | "moderate" | "hard";
interface ExRow {
  name: string; is_pr: boolean; completed: boolean; difficulty: ExDifficulty;
  setsCount: string; reps: string; weight: string; rest: string; notes: string;
}

// Per-exercise difficulty — three levels.
const EX_DIFFICULTIES: { value: Exclude<ExDifficulty, "">; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "moderate", label: "Moderate" },
  { value: "hard", label: "Hard" },
];

const emptyEx = (): ExRow => ({
  name: "", is_pr: false, completed: false, difficulty: "",
  setsCount: "", reps: "", weight: "", rest: "", notes: "",
});
const num = (v: string) => (v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export default function NewWorkout() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [type, setType] = useState<WorkoutType>("strength");
  const [muscles, setMuscles] = useState<string[]>([]);
  const [exercises, setExercises] = useState<ExRow[]>([emptyEx()]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  function toggleMuscle(m: string) {
    setMuscles((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m]));
  }
  function setEx(i: number, patch: Partial<ExRow>) {
    setExercises((c) => c.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }

  async function save() {
    if (savingRef.current) return;
    if (!name.trim()) { Alert.alert("Name required", "Please give your workout a name."); return; }
    savingRef.current = true;
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setSaving(false); Alert.alert("Session expired", "Please sign in again."); return; }

    try {
      const clean = exercises.filter((e) => e.name.trim());
      const workoutCompleted = clean.length > 0 && clean.every((ex) => ex.completed);

      const workoutDate = new Date().toISOString().slice(0, 10);
      // Library workout only — schedule days from Your Plans.
      const { data: w, error: wErr } = await supabase.from("workouts").insert({
        user_id: uid,
        name: name.trim(),
        workout_date: workoutDate,
        location: location.trim() || null,
        duration_minutes: num(duration),
        calories_burned: num(calories),
        workout_type: type,
        muscle_groups: muscles,
        completed: workoutCompleted,
      }).select("id").single();
      if (wErr) throw wErr;

      for (let i = 0; i < clean.length; i++) {
        const ex = clean[i];
        const { data: exRow, error: exErr } = await supabase.from("exercises").insert({
          workout_id: w.id,
          name: ex.name.trim(),
          position: i,
          is_pr: ex.is_pr,
          completed: ex.completed,
          difficulty: ex.difficulty || null,
          notes: ex.notes.trim() || null,
        }).select("id").single();
        if (exErr) throw exErr;
        // Expand the "number of sets" into that many identical set rows.
        const wanted = Math.floor(Number(ex.setsCount) || 0);
        const hasData = Boolean(ex.reps || ex.weight || ex.rest);
        const count = wanted > 0 ? wanted : hasData ? 1 : 0;
        const reps = num(ex.reps), weight = num(ex.weight), rest = num(ex.rest);
        const sets = Array.from({ length: count }, (_, si) => ({
          exercise_id: exRow.id, set_number: si + 1, reps, weight, rest_seconds: rest,
        }));
        if (sets.length) {
          const { error: sErr } = await supabase.from("exercise_sets").insert(sets);
          if (sErr) throw sErr;
        }
      }

      // reset & navigate
      setName(""); setLocation(""); setDuration(""); setCalories(""); setMuscles([]); setExercises([emptyEx()]);
      router.push(`/workout/${w.id}`);
    } catch (err: any) {
      Alert.alert("Couldn't save", err?.message ?? "Something went wrong.");
      savingRef.current = false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}><Text style={s.title}>Log a workout</Text></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {/* Session */}
        <View style={s.card}>
          <Text style={s.section}>Session</Text>
          <Field label="Workout name *">
            <TextInput style={s.input} value={name} onChangeText={setName} placeholder="e.g. Push Day" placeholderTextColor={theme.colors.ink400} />
          </Field>
          <Field label="Duration (min)">
            <TextInput style={s.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="60" placeholderTextColor={theme.colors.ink400} />
          </Field>
          <Field label="Calories burned">
            <TextInput style={s.input} value={calories} onChangeText={setCalories} keyboardType="numeric" placeholder="450" placeholderTextColor={theme.colors.ink400} />
          </Field>
          <Field label="Location">
            <TextInput style={s.input} value={location} onChangeText={setLocation} placeholder="e.g. Home gym" placeholderTextColor={theme.colors.ink400} />
          </Field>

          <Text style={s.label}>Type</Text>
          <View style={s.wrap}>
            {WORKOUT_TYPES.map((t) => (
              <TouchableOpacity key={t.value} onPress={() => setType(t.value)} style={[s.pill, type === t.value && s.pillBrand]}>
                <Text style={[s.pillText, type === t.value && s.pillTextActive]}>{t.icon} {t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.label}>Muscle groups</Text>
          <View style={s.wrap}>
            {MUSCLE_GROUPS.map((m) => (
              <TouchableOpacity key={m} onPress={() => toggleMuscle(m)} style={[s.pill, muscles.includes(m) && s.pillAccent]}>
                <Text style={[s.pillText, muscles.includes(m) && s.pillTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Exercises */}
        <Text style={[s.exTitle, { marginBottom: 8, marginTop: 4 }]}>Exercises</Text>

        {exercises.map((ex, ei) => (
          <View key={ei} style={[s.card, ex.completed && s.cardDone]}>
            <View style={s.exTop}>
              <View style={[s.exNum, ex.completed && s.exNumOn]}>
                <Text style={ex.completed ? s.exNumCheck : s.exNumText}>{ex.completed ? "✓" : ei + 1}</Text>
              </View>
              <TextInput style={[s.input, { flex: 1 }]} value={ex.name} onChangeText={(v) => setEx(ei, { name: v })} placeholder={`Exercise ${ei + 1}`} placeholderTextColor={theme.colors.ink400} />
              {exercises.length > 1 && (
                <TouchableOpacity onPress={() => setExercises((c) => c.filter((_, idx) => idx !== ei))} style={s.delBtn}><Text style={s.delText}>✕</Text></TouchableOpacity>
              )}
            </View>

            <View style={s.metricsPanel}>
              <View style={s.metricCol}><Text style={s.metricHead}>Sets</Text><TextInput style={s.setInput} value={ex.setsCount} onChangeText={(v) => setEx(ei, { setsCount: v })} keyboardType="numeric" placeholder="3" placeholderTextColor={theme.colors.ink400} /></View>
              <View style={s.metricCol}><Text style={s.metricHead}>Reps</Text><TextInput style={s.setInput} value={ex.reps} onChangeText={(v) => setEx(ei, { reps: v })} keyboardType="numeric" placeholder="10" placeholderTextColor={theme.colors.ink400} /></View>
              <View style={s.metricCol}><Text style={s.metricHead}>Weight</Text><TextInput style={s.setInput} value={ex.weight} onChangeText={(v) => setEx(ei, { weight: v })} keyboardType="numeric" placeholder="60" placeholderTextColor={theme.colors.ink400} /></View>
              <View style={s.metricCol}><Text style={s.metricHead}>Rest (s)</Text><TextInput style={s.setInput} value={ex.rest} onChangeText={(v) => setEx(ei, { rest: v })} keyboardType="numeric" placeholder="90" placeholderTextColor={theme.colors.ink400} /></View>
            </View>

            <TextInput style={[s.input, { marginTop: 10 }]} value={ex.notes} onChangeText={(v) => setEx(ei, { notes: v })} placeholder="Exercise notes (optional)" placeholderTextColor={theme.colors.ink400} />

            <View style={s.metaFooter}>
              <Text style={s.label}>Difficulty</Text>
              <View style={s.wrap}>
                {EX_DIFFICULTIES.map((d) => (
                  <TouchableOpacity
                    key={d.value}
                    onPress={() => setEx(ei, { difficulty: ex.difficulty === d.value ? "" : d.value })}
                    style={[s.pill, ex.difficulty === d.value && s.pillDark]}
                  >
                    <Text style={[s.pillText, ex.difficulty === d.value && s.pillTextActive]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.toggleRow}>
                <TouchableOpacity onPress={() => setEx(ei, { is_pr: !ex.is_pr })} style={[s.togglePill, ex.is_pr && s.prOn]}>
                  <Text style={[s.togglePillText, ex.is_pr && s.togglePillTextOn]}>★ PR</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEx(ei, { completed: !ex.completed })} style={[s.togglePill, ex.completed && s.doneOn]}>
                  <Text style={[s.togglePillText, ex.completed && s.togglePillTextOn]}>✓ Completed</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        <View style={s.addExRow}>
          <TouchableOpacity onPress={() => setExercises((c) => [...c, emptyEx()])} style={s.addExBtn}>
            <Text style={s.addExText}>+ Add exercise</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save workout</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <View style={[{ marginTop: 12 }, flex && { flex: 1 }]}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.ink900 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, marginBottom: 12, ...theme.shadow },
  section: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, color: theme.colors.ink500, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: theme.colors.ink500, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.ink200, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.ink900 },
  row2: { flexDirection: "row", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.ink200, backgroundColor: theme.colors.surface2 },
  pillBrand: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  pillAccent: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  pillDark: { backgroundColor: theme.colors.ink800, borderColor: theme.colors.ink800 },
  pillText: { fontSize: 13, fontWeight: "600", color: theme.colors.ink600 },
  pillTextActive: { color: theme.colors.white },
  exHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, marginTop: 4 },
  exTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.ink900 },
  addExRow: { alignItems: "flex-end", marginBottom: 12 },
  addExBtn: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.ink200,
    borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 10,
  },
  addExText: { color: theme.colors.ink800, fontWeight: "700", fontSize: 14 },
  link: { color: theme.colors.brand, fontWeight: "700", fontSize: 14, marginTop: 4 },
  exDiffRow: { marginTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.ink200, paddingTop: 6 },
  cardDone: { borderWidth: 1.5, borderColor: theme.colors.brand },
  exNum: { width: 28, height: 28, borderRadius: 8, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center" },
  exNumOn: { backgroundColor: theme.colors.brand },
  exNumText: { color: theme.colors.brand, fontWeight: "800", fontSize: 13 },
  exNumCheck: { color: theme.colors.white, fontWeight: "800", fontSize: 14 },
  metricsPanel: { flexDirection: "row", gap: 8, backgroundColor: theme.colors.bg, borderRadius: theme.radius.md, padding: 10, marginTop: 12 },
  metricCol: { flex: 1 },
  metricHead: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, color: theme.colors.ink500, marginBottom: 4 },
  metaFooter: { marginTop: 14, borderTopWidth: 1, borderTopColor: theme.colors.ink200, paddingTop: 4 },
  toggleRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  togglePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.ink200, backgroundColor: theme.colors.surface2 },
  togglePillText: { fontWeight: "700", fontSize: 13, color: theme.colors.ink600 },
  togglePillTextOn: { color: theme.colors.white },
  prOn: { backgroundColor: theme.colors.amber, borderColor: theme.colors.amber },
  doneOn: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  exTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  prBtn: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.ink200 },
  prBtnActive: { borderColor: theme.colors.amber, backgroundColor: theme.colors.amberSoft },
  prText: { fontWeight: "700", color: theme.colors.ink400, fontSize: 13 },
  delBtn: { padding: 8 },
  delText: { color: theme.colors.ink400, fontWeight: "700" },
  setHeaderRow: { flexDirection: "row", gap: 8, marginTop: 12, paddingHorizontal: 2 },
  setHead: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", color: theme.colors.ink400 },
  setRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 6 },
  setNum: { fontWeight: "700", color: theme.colors.ink400, textAlign: "center" },
  setInput: { backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.ink200, borderRadius: theme.radius.sm, paddingHorizontal: 8, paddingVertical: 8, textAlign: "center", color: theme.colors.ink900 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, backgroundColor: theme.colors.surface2, padding: 12, borderRadius: theme.radius.md },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: theme.colors.ink300, alignItems: "center", justifyContent: "center" },
  checkboxOn: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  checkMark: { color: theme.colors.white, fontWeight: "800", fontSize: 13 },
  checkLabel: { fontWeight: "700", color: theme.colors.ink800 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.ink200 },
  saveBtn: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.full, paddingVertical: 15, alignItems: "center" },
  saveText: { color: theme.colors.white, fontWeight: "800", fontSize: 16 },
});
