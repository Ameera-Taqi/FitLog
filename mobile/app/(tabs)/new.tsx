import { useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { WORKOUT_TYPES, DIFFICULTIES, MUSCLE_GROUPS, WorkoutType, Difficulty } from "@/lib/types";

interface SetRow { reps: string; weight: string; rest: string }
interface ExRow { name: string; is_pr: boolean; completed: boolean; sets: SetRow[] }

const emptySet = (): SetRow => ({ reps: "", weight: "", rest: "" });
const emptyEx = (): ExRow => ({ name: "", is_pr: false, completed: false, sets: [emptySet()] });
const num = (v: string) => (v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export default function NewWorkout() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [type, setType] = useState<WorkoutType>("strength");
  const [muscles, setMuscles] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ExRow[]>([emptyEx()]);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  function toggleMuscle(m: string) {
    setMuscles((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m]));
  }
  function setEx(i: number, patch: Partial<ExRow>) {
    setExercises((c) => c.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function setSet(ei: number, si: number, patch: Partial<SetRow>) {
    setExercises((c) => c.map((e, idx) => idx === ei ? { ...e, sets: e.sets.map((st, sidx) => sidx === si ? { ...st, ...patch } : st) } : e));
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

      const { data: w, error: wErr } = await supabase.from("workouts").insert({
        user_id: uid,
        name: name.trim(),
        workout_date: date,
        location: location.trim() || null,
        duration_minutes: num(duration),
        workout_type: type,
        muscle_groups: muscles,
        difficulty: difficulty || null,
        notes: notes.trim() || null,
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
        }).select("id").single();
        if (exErr) throw exErr;
        const sets = ex.sets.filter((st) => st.reps || st.weight).map((st, si) => ({
          exercise_id: exRow.id, set_number: si + 1, reps: num(st.reps), weight: num(st.weight), rest_seconds: num(st.rest),
        }));
        if (sets.length) {
          const { error: sErr } = await supabase.from("exercise_sets").insert(sets);
          if (sErr) throw sErr;
        }
      }

      // reset & navigate
      setName(""); setLocation(""); setDuration(""); setMuscles([]); setDifficulty(""); setNotes(""); setExercises([emptyEx()]);
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
          <View style={s.row2}>
            <Field label="Date" flex>
              <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.ink400} />
            </Field>
            <Field label="Duration (min)" flex>
              <TextInput style={s.input} value={duration} onChangeText={setDuration} keyboardType="numeric" placeholder="60" placeholderTextColor={theme.colors.ink400} />
            </Field>
          </View>
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
        <View style={s.exHeader}>
          <Text style={s.exTitle}>Exercises</Text>
          <TouchableOpacity onPress={() => setExercises((c) => [...c, emptyEx()])}><Text style={s.link}>+ Add exercise</Text></TouchableOpacity>
        </View>

        {exercises.map((ex, ei) => (
          <View key={ei} style={s.card}>
            <View style={s.exTop}>
              <TextInput style={[s.input, { flex: 1 }]} value={ex.name} onChangeText={(v) => setEx(ei, { name: v })} placeholder={`Exercise ${ei + 1}`} placeholderTextColor={theme.colors.ink400} />
              <TouchableOpacity onPress={() => setEx(ei, { is_pr: !ex.is_pr })} style={[s.prBtn, ex.is_pr && s.prBtnActive]}>
                <Text style={[s.prText, ex.is_pr && { color: theme.colors.amber }]}>★ PR</Text>
              </TouchableOpacity>
              {exercises.length > 1 && (
                <TouchableOpacity onPress={() => setExercises((c) => c.filter((_, idx) => idx !== ei))} style={s.delBtn}><Text style={s.delText}>✕</Text></TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={s.checkRow} onPress={() => setEx(ei, { completed: !ex.completed })}>
              <View style={[s.checkbox, ex.completed && s.checkboxOn]}>{ex.completed && <Text style={s.checkMark}>✓</Text>}</View>
              <Text style={s.checkLabel}>Completed</Text>
            </TouchableOpacity>

            <View style={s.setHeaderRow}>
              <Text style={[s.setHead, { width: 24 }]}>#</Text>
              <Text style={[s.setHead, { flex: 1 }]}>Reps</Text>
              <Text style={[s.setHead, { flex: 1 }]}>Weight</Text>
              <Text style={[s.setHead, { flex: 1 }]}>Rest (s)</Text>
              <View style={{ width: 28 }} />
            </View>
            {ex.sets.map((st, si) => (
              <View key={si} style={s.setRow}>
                <Text style={[s.setNum, { width: 24 }]}>{si + 1}</Text>
                <TextInput style={[s.setInput, { flex: 1 }]} value={st.reps} onChangeText={(v) => setSet(ei, si, { reps: v })} keyboardType="numeric" placeholder="—" placeholderTextColor={theme.colors.ink300} />
                <TextInput style={[s.setInput, { flex: 1 }]} value={st.weight} onChangeText={(v) => setSet(ei, si, { weight: v })} keyboardType="numeric" placeholder="—" placeholderTextColor={theme.colors.ink300} />
                <TextInput style={[s.setInput, { flex: 1 }]} value={st.rest} onChangeText={(v) => setSet(ei, si, { rest: v })} keyboardType="numeric" placeholder="—" placeholderTextColor={theme.colors.ink300} />
                <TouchableOpacity style={{ width: 28, alignItems: "center" }} onPress={() => ex.sets.length > 1 && setEx(ei, { sets: ex.sets.filter((_, idx) => idx !== si) })}>
                  {ex.sets.length > 1 && <Text style={s.delText}>✕</Text>}
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => setEx(ei, { sets: [...ex.sets, emptySet()] })}><Text style={s.link}>+ Add set</Text></TouchableOpacity>
          </View>
        ))}

        {/* How it went */}
        <View style={s.card}>
          <Text style={s.section}>How it went</Text>
          <Text style={s.label}>Difficulty</Text>
          <View style={s.wrap}>
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity key={d.value} onPress={() => setDifficulty(difficulty === d.value ? "" : d.value)} style={[s.pill, difficulty === d.value && s.pillDark]}>
                <Text style={[s.pillText, difficulty === d.value && s.pillTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field label="Notes">
            <TextInput style={[s.input, { height: 84, textAlignVertical: "top" }]} value={notes} onChangeText={setNotes} multiline placeholder="How did it feel?" placeholderTextColor={theme.colors.ink400} />
          </Field>
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
  link: { color: theme.colors.brand, fontWeight: "700", fontSize: 14, marginTop: 4 },
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
