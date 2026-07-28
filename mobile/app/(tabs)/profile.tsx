import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { Workout, totalVolume, isWorkoutCompleted } from "@/lib/types";

export default function Profile() {
  const [email, setEmail] = useState("");
  const [stats, setStats] = useState({ total: 0, completed: 0, volume: 0, prs: 0, calories: 0 });

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    setEmail(u.user?.email ?? "");
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
  const name = (email || "Athlete").split("@")[0];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={s.header}>
          <Text style={s.title}>Profile</Text>
          <Text style={s.subtitle}>Account & lifetime stats</Text>
        </View>

        <View style={s.card}>
          <View style={s.avatar}><Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
          <Text style={s.name}>{name}</Text>
          <Text style={s.email}>{email}</Text>
        </View>

        <View style={s.sheet}>
          <Text style={s.sheetTitle}>Lifetime Stats</Text>
          <View style={s.statGrid}>
            <Stat label="Workouts" value={stats.total} />
            <Stat label="Completed" value={stats.completed} />
            <Stat label="Volume (kg)" value={stats.volume.toLocaleString()} />
            <Stat label="PRs" value={stats.prs} />
            <Stat label="Calories" value={stats.calories.toLocaleString()} />
          </View>

          <TouchableOpacity style={s.signOut} onPress={() => supabase.auth.signOut()}>
            <Text style={s.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
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
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.ink900 },
  subtitle: { marginTop: 4, fontSize: 13, color: theme.colors.ink500 },
  card: {
    marginHorizontal: 16, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    padding: 20, alignItems: "center", ...theme.shadow,
  },
  avatar: {
    width: 64, height: 64, borderRadius: theme.radius.full, backgroundColor: theme.colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 26, fontWeight: "800", color: theme.colors.white },
  name: { marginTop: 12, fontSize: 18, fontWeight: "800", color: theme.colors.ink900, textTransform: "capitalize" },
  email: { marginTop: 4, fontSize: 14, color: theme.colors.ink500 },
  sheet: {
    marginTop: 20, backgroundColor: theme.colors.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, minHeight: 360,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.onSheet, marginBottom: 14 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    flexBasis: "47%", flexGrow: 1, backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg, padding: 16,
  },
  statValue: { fontSize: 24, fontWeight: "800", color: theme.colors.brand },
  statLabel: { fontSize: 12, color: theme.colors.onSheetMuted, marginTop: 2, textTransform: "uppercase", fontWeight: "700" },
  signOut: {
    marginTop: 24, backgroundColor: theme.colors.white, borderWidth: 1, borderColor: "#FECACA",
    borderRadius: theme.radius.full, paddingVertical: 14, alignItems: "center",
  },
  signOutText: { color: theme.colors.danger, fontWeight: "700", fontSize: 15 },
});
