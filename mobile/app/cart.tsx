import { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image, ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, Stack } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";

const money = (n: number, cur = "USD") => `${cur === "USD" ? "$" : cur + " "}${n.toFixed(2)}`;

const PRODUCT_IMAGES: Record<string, ImageSourcePropType> = {
  "whey-protein": require("@/assets/products/whey-protein.png"),
  "creatine": require("@/assets/products/creatine.png"),
  "pre-workout": require("@/assets/products/pre-workout.png"),
  "omega-3": require("@/assets/products/omega-3.png"),
  "shaker": require("@/assets/products/shaker.png"),
  "water-jug": require("@/assets/products/water-jug.png"),
  "jump-rope": require("@/assets/products/jump-rope.png"),
  "wrist-wraps": require("@/assets/products/wrist-wraps.png"),
  "lifting-belt": require("@/assets/products/lifting-belt.png"),
  "duffel-bag": require("@/assets/products/duffel-bag.png"),
  "tshirt": require("@/assets/products/tshirt.png"),
  "meal-prep": require("@/assets/products/meal-prep.png"),
  "whey-vanilla": require("@/assets/products/whey-vanilla.png"),
  "bcaa-amino": require("@/assets/products/bcaa-amino.png"),
  "protein-bars": require("@/assets/products/protein-bars.png"),
  "multivitamin": require("@/assets/products/multivitamin.png"),
  "fat-burner": require("@/assets/products/fat-burner.png"),
  "protein-cookie": require("@/assets/products/protein-cookie.png"),
  "l-glutamine": require("@/assets/products/l-glutamine.png"),
};

interface CartRow {
  product_id: string;
  quantity: number;
  product: { id: string; name: string; flavor: string | null; price: number; currency: string; image: string | null } | null;
}

export default function Cart() {
  const router = useRouter();
  const [rows, setRows] = useState<CartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("cart_items")
      .select("product_id, quantity, product:products(id, name, flavor, price, currency, image)")
      .order("created_at", { ascending: true });
    setRows((data ?? []) as unknown as CartRow[]);
    setLoading(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function setQty(productId: string, qty: number) {
    if (qty <= 0) return remove(productId);
    setRows((rs) => rs.map((r) => (r.product_id === productId ? { ...r, quantity: qty } : r)));
    await supabase.from("cart_items").upsert({ product_id: productId, quantity: qty }, { onConflict: "user_id,product_id" });
  }
  async function remove(productId: string) {
    setRows((rs) => rs.filter((r) => r.product_id !== productId));
    await supabase.from("cart_items").delete().eq("product_id", productId);
  }

  const currency = rows[0]?.product?.currency ?? "USD";
  const subtotal = rows.reduce((s, r) => s + (r.product ? r.product.price * r.quantity : 0), 0);

  // Place the order (creates a 'pending' order + clears the cart), then go to
  // the Orders screen where the customer taps Pay.
  async function checkout() {
    setCheckingOut(true);
    const { data, error } = await supabase.functions.invoke("checkout-cart", { body: {} });
    setCheckingOut(false);
    if (error || !data?.orderId) {
      let msg = "Couldn't place your order. Please try again.";
      try {
        const ctx = (error as { context?: Response } | null)?.context;
        const j = ctx ? await ctx.json() : null;
        if (j?.error === "empty_cart") msg = "Your cart is empty.";
      } catch { /* keep generic */ }
      Alert.alert("Checkout", msg);
      return;
    }
    router.replace("/orders");
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <Stack.Screen options={{ title: "Your Cart" }} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={s.back}>← Shop</Text></TouchableOpacity>
        <Text style={s.title}>Your Cart</Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={theme.colors.brand} /></View>
      ) : rows.length === 0 ? (
        <View style={s.center}>
          <Text style={s.empty}>Your cart is empty.</Text>
          <TouchableOpacity style={s.shopBtn} onPress={() => router.back()}><Text style={s.shopBtnText}>Continue shopping</Text></TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
            {rows.map((r) => (
              <View key={r.product_id} style={s.row}>
                <View style={s.thumb}>
                  {r.product?.image && PRODUCT_IMAGES[r.product.image] ? (
                    <Image source={PRODUCT_IMAGES[r.product.image]} style={s.thumbImg} resizeMode="cover" />
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.name} numberOfLines={1}>{r.product?.name}</Text>
                  {r.product?.flavor ? <Text style={s.flavor}>{r.product.flavor}</Text> : null}
                  <Text style={s.price}>{money(r.product?.price ?? 0, r.product?.currency)}</Text>
                </View>
                <View style={s.qtyWrap}>
                  <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(r.product_id, r.quantity - 1)}><Text style={s.qtySign}>−</Text></TouchableOpacity>
                  <Text style={s.qty}>{r.quantity}</Text>
                  <TouchableOpacity style={s.qtyBtn} onPress={() => setQty(r.product_id, r.quantity + 1)}><Text style={s.qtySign}>+</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={s.footer}>
            <View style={s.subtotalRow}>
              <Text style={s.subtotalLabel}>Subtotal</Text>
              <Text style={s.subtotalVal}>{money(subtotal, currency)}</Text>
            </View>
            <TouchableOpacity style={s.checkout} onPress={checkout} disabled={checkingOut}>
              {checkingOut ? <ActivityIndicator color={theme.colors.white} /> : <Text style={s.checkoutText}>Checkout</Text>}
            </TouchableOpacity>
          </View>
        </>
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 10, marginBottom: 10, ...theme.shadow },
  thumb: { width: 60, height: 60, borderRadius: 12, overflow: "hidden", backgroundColor: theme.colors.surface2 },
  thumbImg: { width: "100%", height: "100%" },
  name: { fontSize: 15, fontWeight: "800", color: theme.colors.ink900 },
  flavor: { fontSize: 12, color: theme.colors.ink500, marginTop: 1 },
  price: { fontSize: 14, fontWeight: "900", color: theme.colors.ink900, marginTop: 3 },
  qtyWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  qtyBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.ink200 },
  qtySign: { fontSize: 18, fontWeight: "800", color: theme.colors.ink700 },
  qty: { width: 22, textAlign: "center", fontSize: 15, fontWeight: "800", color: theme.colors.ink900 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.ink200, backgroundColor: theme.colors.surface, gap: 12 },
  subtotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subtotalLabel: { fontSize: 18, fontWeight: "900", color: theme.colors.ink900 },
  subtotalVal: { fontSize: 18, fontWeight: "900", color: theme.colors.ink900 },
  checkout: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.full, paddingVertical: 15, alignItems: "center", minHeight: 50, justifyContent: "center" },
  checkoutText: { color: theme.colors.white, fontWeight: "900", fontSize: 15, textTransform: "uppercase" },
});
