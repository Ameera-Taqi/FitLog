import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";

export default function Login() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    setNotice(null);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else if (!data.session) { setNotice("Account created! Check your email to confirm, then sign in."); setMode("signin"); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.flex}>
        <View style={s.container}>
          <View style={s.logoWrap}>
            <View style={s.logoBadge}><Text style={s.logoIcon}>🏋️</Text></View>
            <Text style={s.logoText}>Fit<Text style={{ color: theme.colors.brand }}>Log</Text></Text>
            <Text style={s.tagline}>Your training log, sets & PRs — all in one place.</Text>
          </View>

          <View style={s.card}>
            <View style={s.tabs}>
              <TouchableOpacity style={[s.tab, mode === "signin" && s.tabActive]} onPress={() => setMode("signin")}>
                <Text style={[s.tabText, mode === "signin" && s.tabTextActive]}>Sign in</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.tab, mode === "signup" && s.tabActive]} onPress={() => setMode("signup")}>
                <Text style={[s.tabText, mode === "signup" && s.tabTextActive]}>Create account</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Email</Text>
            <TextInput
              style={s.input} value={email} onChangeText={setEmail}
              autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com"
              placeholderTextColor={theme.colors.ink400}
            />
            <Text style={s.label}>Password</Text>
            <TextInput
              style={s.input} value={password} onChangeText={setPassword}
              secureTextEntry placeholder="••••••••" placeholderTextColor={theme.colors.ink400}
            />

            {error && <Text style={s.error}>{error}</Text>}
            {notice && <Text style={s.notice}>{notice}</Text>}

            <TouchableOpacity style={s.btn} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color={theme.colors.white} /> : <Text style={s.btnText}>{mode === "signin" ? "Sign in" : "Create account"}</Text>}
            </TouchableOpacity>
          </View>
          <Text style={s.footer}>Secured with Supabase Auth · Your data is private.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: "center", padding: 24 },
  logoWrap: { alignItems: "center", marginBottom: 28 },
  logoBadge: {
    width: 68, height: 68, borderRadius: 22,
    backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", marginBottom: 14,
  },
  logoIcon: { fontSize: 30 },
  logoText: { fontSize: 30, fontWeight: "800", color: theme.colors.ink900 },
  tagline: { marginTop: 8, color: theme.colors.ink500, textAlign: "center", fontSize: 13, lineHeight: 18 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: 20, ...theme.shadow },
  tabs: { flexDirection: "row", backgroundColor: theme.colors.surface2, borderRadius: theme.radius.md, padding: 4, marginBottom: 18 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.sm, alignItems: "center" },
  tabActive: { backgroundColor: theme.colors.brand },
  tabText: { fontWeight: "700", color: theme.colors.ink500, fontSize: 13 },
  tabTextActive: { color: theme.colors.white },
  label: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: theme.colors.ink500, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.ink200,
    borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.ink900,
  },
  error: { marginTop: 12, color: theme.colors.danger, backgroundColor: theme.colors.dangerSoft, padding: 10, borderRadius: theme.radius.sm, fontSize: 13 },
  notice: { marginTop: 12, color: theme.colors.brand, backgroundColor: theme.colors.brandSoft, padding: 10, borderRadius: theme.radius.sm, fontSize: 13 },
  btn: { marginTop: 20, backgroundColor: theme.colors.brand, borderRadius: theme.radius.full, paddingVertical: 15, alignItems: "center" },
  btnText: { color: theme.colors.white, fontWeight: "700", fontSize: 15 },
  footer: { marginTop: 20, textAlign: "center", color: theme.colors.ink400, fontSize: 11 },
});
