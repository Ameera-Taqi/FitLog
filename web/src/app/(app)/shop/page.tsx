import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { ShopClient } from "@/components/ShopClient";
import type { Product } from "@/lib/product";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("in_stock", true)
    .order("position", { ascending: true });
  const products = (data ?? []) as Product[];
  const { t } = await getT();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight text-ink-900">{t("shop.title")}</h1>
        <p className="text-sm text-ink-500">{t("shop.subtitle")}</p>
      </div>

      {products.length === 0 ? (
        <p className="card p-8 text-center text-sm text-ink-400">{t("shop.empty")}</p>
      ) : (
        <ShopClient products={products} />
      )}
    </div>
  );
}
