import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";
import { Workout, totalVolume } from "@/lib/types";

export default function Profile() {
  const [email, setEmail] = useState("");
  const [stats, setStats] = useState({ total: 0, completed: 0, volume: 0, prs: 0 });

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
    });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}><Text style={s.title}>Profile</Text></View>
      <View style={{ padding: 16 }}>
        <View style={s.card}>
          <View style={s.avatar}><Text style={s.avatarText}>{(email || "?").charAt(0).toUpperCase()}</Text></View>
          <Text style={s.email}>{email}</Text>
        </View>

        <View style={s.statGrid}>
          <Stat label="Workouts" value={stats.total} />
          <Stat label="Completed" value={stats.completed} />
          <Stat label="Volume (kg)" value={stats.volume.toLocaleString()} />
          <Stat label="PRs" value={stats.prs} />
        </View>

        <TouchableOpacity style={s.signOut} onPress={() => supabase.auth.signOut()}>
          <Text style={s.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
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
  header: { paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.ink900 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 20, alignItems: "center", ...theme.shadow },
  avatar: { width: 64, height: 64, borderRadius: theme.radius.full, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 26, fontWeight: "800", color: theme.colors.brand },
  email: { marginTop: 12, fontSize: 15, fontWeight: "600", color: theme.colors.ink800 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  statCard: { flexBasis: "47%", flexGrow: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, ...theme.shadow },
  statValue: { fontSize: 26, fontWeight: "800", color: theme.colors.ink900 },
  statLabel: { fontSize: 12, color: theme.colors.ink500, marginTop: 2, textTransform: "uppercase", fontWeight: "700", letterSpacing: 0.4 },
  signOut: { marginTop: 24, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.dangerSoft, borderRadius: theme.radius.md, paddingVertical: 14, alignItems: "center" },
  signOutText: { color: theme.colors.danger, fontWeight: "700", fontSize: 15 },
});
