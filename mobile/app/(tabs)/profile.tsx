import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { Workout, totalVolume } from "@/lib/types";

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
      completed: ws.filter((w) => w.completed).length,
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
          <View style={s.welcomeRow}>
            <View style={s.avatar}><Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
            <View>
              <Text style={s.welcome}>Welcome Back</Text>
              <Text style={s.name}>{name}</Text>
            </View>
          </View>
        </View>

        <View style={s.highlightRow}>
          <View style={s.highlightCard}>
            <Text style={s.highlightIcon}>🏋️</Text>
            <Text style={s.highlightValue}>{stats.completed}</Text>
            <Text style={s.highlightLabel}>Workouts Completed</Text>
          </View>
          <View style={s.highlightCard}>
            <Text style={s.highlightIcon}>🔥</Text>
            <Text style={s.highlightValue}>{stats.calories.toLocaleString()}</Text>
            <Text style={s.highlightLabel}>Calories Burnt</Text>
          </View>
        </View>

        <View style={s.sheet}>
          <Text style={s.sheetTitle}>Your Stats</Text>
          <View style={s.statGrid}>
            <Stat label="Workouts" value={stats.total} />
            <Stat label="Completed" value={stats.completed} />
            <Stat label="Volume (kg)" value={stats.volume.toLocaleString()} />
            <Stat label="PRs" value={stats.prs} />
          </View>

          <View style={s.accountCard}>
            <Text style={s.accountLabel}>Signed in as</Text>
            <Text style={s.email}>{email}</Text>
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
  welcomeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52, height: 52, borderRadius: theme.radius.full,
    backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "800", color: theme.colors.white },
  welcome: { fontSize: 13, color: theme.colors.ink500 },
  name: { fontSize: 20, fontWeight: "800", color: theme.colors.ink900, textTransform: "capitalize" },
  highlightRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16 },
  highlightCard: {
    flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    padding: 16, ...theme.shadow,
  },
  highlightIcon: { fontSize: 22, marginBottom: 8 },
  highlightValue: { fontSize: 26, fontWeight: "800", color: theme.colors.ink900 },
  highlightLabel: { marginTop: 4, fontSize: 12, color: theme.colors.ink500, fontWeight: "600" },
  sheet: {
    marginTop: 20, backgroundColor: theme.colors.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, minHeight: 420,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.onSheet, marginBottom: 14 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    flexBasis: "47%", flexGrow: 1, backgroundColor: theme.colors.white,
    borderRadius: theme.radius.lg, padding: 16, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  statValue: { fontSize: 24, fontWeight: "800", color: theme.colors.brand },
  statLabel: { fontSize: 12, color: theme.colors.onSheetMuted, marginTop: 2, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.4 },
  accountCard: {
    marginTop: 16, backgroundColor: theme.colors.white, borderRadius: theme.radius.lg, padding: 16,
  },
  accountLabel: { fontSize: 11, fontWeight: "700", color: theme.colors.onSheetMuted, textTransform: "uppercase" },
  email: { marginTop: 6, fontSize: 15, fontWeight: "600", color: theme.colors.onSheet },
  signOut: {
    marginTop: 20, backgroundColor: theme.colors.white, borderWidth: 1, borderColor: "#FECACA",
    borderRadius: theme.radius.full, paddingVertical: 14, alignItems: "center",
  },
  signOutText: { color: theme.colors.danger, fontWeight: "700", fontSize: 15 },
});
