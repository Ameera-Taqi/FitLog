import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image, ImageSourcePropType } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { theme } from "@/lib/theme";

interface Product {
  id: string; name: string; category: string; flavor: string | null;
  price: number; currency: string; rating: number | null; badge: string | null;
  description: string | null; color: string; image: string | null;
}

// Static require map — React Native bundles local assets at build time, so the
// image slug from the DB is resolved to a bundled asset here.
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

const money = (n: number, cur = "USD") =>
  `${cur === "USD" ? "$" : cur + " "}${n.toFixed(2)}`;

export default function Shop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cat, setCat] = useState("all");
  // cart is a productId -> quantity map, kept in sync with the cart_items table.
  const [cart, setCart] = useState<Record<string, number>>({});
  const router = useRouter();

  const load = useCallback(async () => {
    const { data } = await supabase.from("products").select("*").eq("in_stock", true).order("position");
    setProducts((data ?? []) as Product[]);
    const { data: c } = await supabase.from("cart_items").select("product_id, quantity");
    if (c) {
      const next: Record<string, number> = {};
      for (const r of c as { product_id: string; quantity: number }[]) next[r.product_id] = r.quantity;
      setCart(next);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Add one to the cart and persist (upsert increments the existing row's quantity).
  async function add(id: string) {
    const nextQty = (cart[id] ?? 0) + 1;
    setCart((c) => ({ ...c, [id]: nextQty }));
    const { error } = await supabase
      .from("cart_items")
      .upsert({ product_id: id, quantity: nextQty }, { onConflict: "user_id,product_id" });
    if (error) { load(); Alert.alert("Cart", "Couldn't add to cart. Please try again."); }
  }

  async function clearCart() {
    setCart({});
    await supabase.from("cart_items").delete().neq("product_id", "00000000-0000-0000-0000-000000000000");
  }

  const categories = useMemo(() => ["all", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const shown = cat === "all" ? products : products.filter((p) => p.category === cat);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const total = Object.entries(cart).reduce((s, [id, q]) => s + (products.find((p) => p.id === id)?.price ?? 0) * q, 0);
  const currency = products[0]?.currency ?? "USD";

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.title}>Shop</Text>
        <Text style={s.subtitle}>Fuel your goals — nutrition & supplements.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cats}>
        {categories.map((c) => (
          <TouchableOpacity key={c} onPress={() => setCat(c)} style={[s.pill, cat === c && s.pillOn]}>
            <Text style={[s.pillText, cat === c && s.pillTextOn]}>{c === "all" ? "All" : c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: count > 0 ? 96 : 24 }}>
        <View style={s.grid}>
          {shown.map((p) => (
            <View key={p.id} style={s.card}>
              <View style={[s.tile, { backgroundColor: p.color }]}>
                {p.image && PRODUCT_IMAGES[p.image] ? (
                  <Image source={PRODUCT_IMAGES[p.image]} style={s.tileImg} resizeMode="cover" />
                ) : null}
                {p.badge ? <Text style={s.badge}>{p.badge}</Text> : null}
                <Text style={s.tileRating}>★ {p.rating?.toFixed(1) ?? "—"}</Text>
                {!(p.image && PRODUCT_IMAGES[p.image]) ? <Text style={s.tileCat}>{p.category}</Text> : null}
              </View>
              <View style={s.body}>
                <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                {p.flavor ? <Text style={s.flavor} numberOfLines={1}>{p.flavor}</Text> : null}
                <View style={s.priceRow}>
                  <Text style={s.price}>{money(p.price, p.currency)}</Text>
                  <TouchableOpacity style={s.addBtn} onPress={() => add(p.id)}>
                    <Text style={s.addText}>{cart[p.id] ? `Add · ${cart[p.id]}` : "Add"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {count > 0 && (
        <View style={s.cartBar}>
          <Text style={s.cartText}>{count} {count === 1 ? "item" : "items"} · {money(total, currency)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity onPress={clearCart}><Text style={s.clear}>Clear</Text></TouchableOpacity>
            <TouchableOpacity style={s.checkout} onPress={() => router.push("/cart")}>
              <Text style={s.checkoutText}>View cart</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.ink900 },
  subtitle: { marginTop: 4, fontSize: 13, color: theme.colors.ink500 },
  cats: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.full, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.ink200 },
  pillOn: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  pillText: { fontSize: 13, fontWeight: "700", color: theme.colors.ink600 },
  pillTextOn: { color: theme.colors.white },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "47%", flexGrow: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, overflow: "hidden", ...theme.shadow },
  tile: { aspectRatio: 1, justifyContent: "flex-end", padding: 10 },
  tileImg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" },
  badge: { position: "absolute", top: 8, left: 8, backgroundColor: "rgba(0,0,0,0.45)", color: "#fff", fontSize: 9, fontWeight: "800", textTransform: "uppercase", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  tileRating: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.35)", color: "#fff", fontSize: 11, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, overflow: "hidden" },
  tileCat: { color: "rgba(255,255,255,0.9)", fontSize: 18, fontWeight: "900", textTransform: "uppercase" },
  body: { padding: 12 },
  name: { fontSize: 14, fontWeight: "800", color: theme.colors.ink900 },
  flavor: { marginTop: 2, fontSize: 12, color: theme.colors.ink500 },
  priceRow: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { fontSize: 16, fontWeight: "900", color: theme.colors.ink900 },
  addBtn: { backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.ink200, borderRadius: theme.radius.full, paddingHorizontal: 14, paddingVertical: 7 },
  addText: { color: theme.colors.ink700, fontWeight: "800", fontSize: 12 },
  cartBar: { position: "absolute", left: 16, right: 16, bottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.colors.brand, borderRadius: theme.radius.full, paddingHorizontal: 18, paddingVertical: 14, ...theme.shadow },
  cartText: { color: theme.colors.white, fontWeight: "800", fontSize: 14 },
  clear: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 13, paddingHorizontal: 8 },
  checkout: { backgroundColor: theme.colors.white, borderRadius: theme.radius.full, paddingHorizontal: 16, paddingVertical: 8, minWidth: 92, alignItems: "center" },
  checkoutText: { color: theme.colors.brandDark, fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
});
