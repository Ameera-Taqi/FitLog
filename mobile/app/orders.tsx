import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Linking, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";

const money = (n: number, cur = "KWD") =>
  cur === "KWD" ? `KWD ${n.toFixed(3)}` : `${cur === "USD" ? "$" : cur + " "}${n.toFixed(2)}`;

type PaymentStatus = "pending" | "awaiting_payment" | "paid" | "failed" | "expired" | "refunded";

const STATUS: Record<PaymentStatus, { label: string; bg: string; fg: string }> = {
  pending: { label: "Pending", bg: "rgba(156,163,175,0.18)", fg: "#6b7280" },
  awaiting_payment: { label: "Awaiting payment", bg: "rgba(59,130,246,0.18)", fg: "#3b82f6" },
  paid: { label: "Paid", bg: "rgba(16,185,129,0.18)", fg: "#10b981" },
  failed: { label: "Failed", bg: "rgba(239,68,68,0.18)", fg: "#ef4444" },
  expired: { label: "Expired", bg: "rgba(245,158,11,0.18)", fg: "#f59e0b" },
  refunded: { label: "Refunded", bg: "rgba(139,92,246,0.18)", fg: "#8b5cf6" },
};

interface Order {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  payment_status: PaymentStatus;
  created_at: string;
  items: { ItemName: string; Quantity: number; UnitPrice: number }[] | null;
}

export default function Orders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, reference, amount, currency, payment_status, created_at, items")
      .order("created_at", { ascending: false });
    setOrders((data ?? []) as unknown as Order[]);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live status: reflect paid/failed/refunded changes in real time.
  useEffect(() => {
    const channel = supabase
      .channel("orders-mine-mobile")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // Guarded against double-tap: disabled while in flight + backend idempotency.
  async function pay(id: string) {
    if (paying) return;
    setPaying(id);
    const { data, error } = await supabase.functions.invoke("initiate-payment", { body: { orderId: id } });
    setPaying(null);
    if (error || !data?.paymentUrl) {
      Alert.alert("Payment", "Couldn't start payment. Please try again.");
      return;
    }
    Linking.openURL(data.paymentUrl as string);
  }

  const itemCount = (o: Order) => (o.items ?? []).reduce((s, i) => s + i.Quantity, 0);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <Stack.Screen options={{ title: "Your Orders" }} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/shop")}><Text style={s.back}>← Shop</Text></TouchableOpacity>
        <Text style={s.title}>Your Orders</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={theme.colors.brand} /></View>
      ) : orders.length === 0 ? (
        <View style={s.center}>
          <Text style={s.empty}>You have no orders yet.</Text>
          <TouchableOpacity style={s.shopBtn} onPress={() => router.replace("/(tabs)/shop")}>
            <Text style={s.shopBtnText}>Continue shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          {orders.map((o) => {
            const st = STATUS[o.payment_status] ?? STATUS.pending;
            return (
              <View key={o.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.ref} numberOfLines={1}>{o.reference}</Text>
                    <Text style={s.meta}>
                      {itemCount(o)} {itemCount(o) === 1 ? "item" : "items"} · {new Date(o.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: st.bg }]}>
                    <Text style={[s.badgeText, { color: st.fg }]}>{st.label}</Text>
                  </View>
                </View>
                <View style={s.cardBottom}>
                  <Text style={s.amount}>{money(Number(o.amount), o.currency)}</Text>
                  {!["paid", "refunded"].includes(o.payment_status) && (
                    <TouchableOpacity style={s.payBtn} onPress={() => pay(o.id)} disabled={paying !== null}>
                      {paying === o.id ? <ActivityIndicator color={theme.colors.white} size="small" /> : <Text style={s.payText}>Pay now</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  back: { color: theme.colors.brand, fontWeight: "700", fontSize: 14, marginBottom: 4 },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.ink900 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  empty: { color: theme.colors.ink500, fontSize: 15 },
  shopBtn: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.full, paddingHorizontal: 20, paddingVertical: 12 },
  shopBtnText: { color: theme.colors.white, fontWeight: "800" },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, marginBottom: 10, gap: 12, ...theme.shadow },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  ref: { fontSize: 12, color: theme.colors.ink400, fontVariant: ["tabular-nums"] },
  meta: { fontSize: 13, color: theme.colors.ink500, marginTop: 2 },
  badge: { borderRadius: theme.radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  amount: { fontSize: 18, fontWeight: "900", color: theme.colors.ink900 },
  payBtn: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.full, paddingHorizontal: 20, paddingVertical: 10, minWidth: 96, minHeight: 40, alignItems: "center", justifyContent: "center" },
  payText: { color: theme.colors.white, fontWeight: "900", fontSize: 14 },
});
