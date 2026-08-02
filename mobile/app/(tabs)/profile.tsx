import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { Workout, totalVolume, isWorkoutCompleted } from "@/lib/types";

type Unit = "kg" | "lb";
type Sex = "" | "male" | "female";

const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "lb", label: "Pounds (lb)" },
];
const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: "", label: "Prefer not to say" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];
const GOALS: { value: string; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Muscle growth" },
  { value: "endurance", label: "Endurance" },
  { value: "weight_loss", label: "Weight loss" },
  { value: "general_fitness", label: "General fitness" },
];

const num = (v: string) => (v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export default function Profile() {
  const [email, setEmail] = useState("");
  const [stats, setStats] = useState({ total: 0, completed: 0, volume: 0, prs: 0, calories: 0 });

  const [displayName, setDisplayName] = useState("");
  const [unit, setUnit] = useState<Unit>("kg");
  const [height, setHeight] = useState("");
  const [bodyWeight, setBodyWeight] = useState("");
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState<Sex>("");
  const [goal, setGoal] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    setEmail(u.user?.email ?? "");
    // Display name lives in Supabase Auth user metadata.
    setDisplayName(((u.user?.user_metadata?.display_name as string) ?? "").trim());
    const uid = u.user?.id;
    if (uid) {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).single();
      if (prof) {
        setUnit((prof.unit_preference as Unit) ?? "kg");
        setHeight(prof.height_cm != null ? String(prof.height_cm) : "");
        setBodyWeight(prof.body_weight_kg != null ? String(prof.body_weight_kg) : "");
        setDob(prof.date_of_birth ?? "");
        setSex(prof.sex && prof.sex !== "prefer_not_to_say" ? (prof.sex as Sex) : "");
        setGoal(prof.fitness_goal ?? "");
        setBio(prof.bio ?? "");
      }
    }
    const { data } = await supabase.from("workouts").select("*, exercises(*, exercise_sets(*))").limit(500);
    const ws = (data ?? []) as Workout[];
    setStats({
      total: ws.length,
      completed: ws.filter(isWorkoutCompleted).length,
      volume: ws.reduce((s, w) => s + totalVolume(w.exercises), 0),
      prs: ws.reduce((s, w) => s + (w.exercises?.filter((e) => e.is_pr).length ?? 0), 0),
      calories: ws.reduce((s, w) => s + (w.calories_burned ?? 0), 0),
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const name = displayName.trim() || (email || "Athlete").split("@")[0];

  async function save() {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    if (!uid) { Alert.alert("Session expired", "Please sign in again."); return; }
    setSaving(true);
    setSaved(false);
    // Display name → Supabase Auth user metadata.
    const { error: metaErr } = await supabase.auth.updateUser({ data: { display_name: displayName.trim() || null } });
    if (metaErr) { setSaving(false); Alert.alert("Couldn't save", metaErr.message); return; }
    // Everything else → the profiles table.
    const { error } = await supabase.from("profiles").upsert({
      id: uid,
      unit_preference: unit,
      height_cm: num(height),
      body_weight_kg: num(bodyWeight),
      date_of_birth: dob.trim() || null,
      sex: sex || null,
      fitness_goal: goal || null,
      bio: bio.trim() || null,
    }, { onConflict: "id" });
    setSaving(false);
    if (error) { Alert.alert("Couldn't save", error.message); return; }
    setSaved(true);
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Profile</Text>
        <Text style={s.subtitle}>Your details and preferences.</Text>

        <View style={s.identity}>
          <View style={s.avatar}><Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{name}</Text>
            <Text style={s.email} numberOfLines={1}>{email}</Text>
          </View>
        </View>

        {/* Lifetime stats */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Lifetime Stats</Text>
          <View style={s.statGrid}>
            <Stat label="Workouts" value={stats.total} />
            <Stat label="Completed" value={stats.completed} />
            <Stat label="Volume (kg)" value={stats.volume.toLocaleString()} />
            <Stat label="PRs" value={stats.prs} />
            <Stat label="Calories" value={stats.calories.toLocaleString()} />
          </View>
        </View>

        {/* Account */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Account</Text>
          <Text style={s.label}>Email</Text>
          <TextInput style={[s.input, s.inputDisabled]} value={email} editable={false} />
          <Text style={s.label}>Display name</Text>
          <TextInput style={s.input} value={displayName} onChangeText={setDisplayName} placeholder="e.g. Alex" placeholderTextColor={theme.colors.ink400} />
        </View>

        {/* Preferences */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Preferences</Text>
          <Text style={s.label}>Weight units</Text>
          <View style={s.wrap}>
            {UNIT_OPTIONS.map((u) => (
              <TouchableOpacity key={u.value} onPress={() => setUnit(u.value)} style={[s.pill, unit === u.value && s.pillOn]}>
                <Text style={[s.pillText, unit === u.value && s.pillTextOn]}>{u.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.hint}>Weights are stored in kilograms and shown in your chosen unit across the app.</Text>
        </View>

        {/* About you */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>About you</Text>
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Height (cm)</Text>
              <TextInput style={s.input} value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="178" placeholderTextColor={theme.colors.ink400} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Body weight (kg)</Text>
              <TextInput style={s.input} value={bodyWeight} onChangeText={setBodyWeight} keyboardType="numeric" placeholder="81.5" placeholderTextColor={theme.colors.ink400} />
            </View>
          </View>
          <Text style={s.label}>Date of birth</Text>
          <TextInput style={s.input} value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.ink400} />
          <Text style={s.label}>Sex</Text>
          <View style={s.wrap}>
            {SEX_OPTIONS.map((o) => (
              <TouchableOpacity key={o.value || "none"} onPress={() => setSex(o.value)} style={[s.pill, sex === o.value && s.pillOn]}>
                <Text style={[s.pillText, sex === o.value && s.pillTextOn]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>Primary goal</Text>
          <View style={s.wrap}>
            {GOALS.map((g) => (
              <TouchableOpacity key={g.value} onPress={() => setGoal(goal === g.value ? "" : g.value)} style={[s.pill, goal === g.value && s.pillAccent]}>
                <Text style={[s.pillText, goal === g.value && s.pillTextOn]}>{g.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>Bio</Text>
          <TextInput style={[s.input, { height: 84, textAlignVertical: "top" }]} value={bio} onChangeText={setBio} multiline placeholder="A little about your training…" placeholderTextColor={theme.colors.ink400} />
        </View>

        <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveText}>Save profile</Text>}
        </TouchableOpacity>
        {saved ? <Text style={s.savedText}>✓ Saved</Text> : null}

        <TouchableOpacity style={s.signOut} onPress={() => supabase.auth.signOut()}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.ink900 },
  subtitle: { marginTop: 4, fontSize: 13, color: theme.colors.ink500, marginBottom: 16 },
  identity: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  avatar: { width: 56, height: 56, borderRadius: theme.radius.full, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 24, fontWeight: "800", color: theme.colors.white },
  name: { fontSize: 18, fontWeight: "800", color: theme.colors.ink900, textTransform: "capitalize" },
  email: { marginTop: 2, fontSize: 13, color: theme.colors.ink500 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, marginBottom: 12, ...theme.shadow },
  sectionTitle: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, color: theme.colors.ink500, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: theme.colors.ink500, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.ink200, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.colors.ink900 },
  inputDisabled: { color: theme.colors.ink400, backgroundColor: theme.colors.bg },
  hint: { marginTop: 8, fontSize: 12, color: theme.colors.ink400 },
  row2: { flexDirection: "row", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.ink200, backgroundColor: theme.colors.surface2 },
  pillOn: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  pillAccent: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  pillText: { fontSize: 13, fontWeight: "600", color: theme.colors.ink600 },
  pillTextOn: { color: theme.colors.white },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  statCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: theme.colors.surface2, borderRadius: theme.radius.md, padding: 14 },
  statValue: { fontSize: 22, fontWeight: "800", color: theme.colors.brand },
  statLabel: { fontSize: 11, color: theme.colors.ink500, marginTop: 2, textTransform: "uppercase", fontWeight: "700" },
  saveBtn: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.full, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  saveText: { color: theme.colors.white, fontWeight: "800", fontSize: 16 },
  savedText: { textAlign: "center", color: theme.colors.brand, fontWeight: "700", marginTop: 10 },
  signOut: { marginTop: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.dangerSoft, borderRadius: theme.radius.full, paddingVertical: 14, alignItems: "center" },
  signOutText: { color: theme.colors.danger, fontWeight: "700", fontSize: 15 },
});
