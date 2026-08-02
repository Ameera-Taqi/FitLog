"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function PaymentReturn() {
  const { t } = useI18n();
  const supabase = createClient();
  const params = useSearchParams();
  // MyFatoorah appends paymentId to the CallBackUrl.
  const paymentId = params.get("paymentId") ?? params.get("Id");
  const [state, setState] = useState<"loading" | "paid" | "notpaid">("loading");
  const [detail, setDetail] = useState<{ amount?: number | string; reference?: string } | null>(null);

  useEffect(() => {
    if (!paymentId) { setState("notpaid"); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke("payment-status", { body: { paymentId } });
      if (error || !data) { setState("notpaid"); return; }
      setDetail({ amount: data.amount, reference: data.reference });
      setState(data.paid ? "paid" : "notpaid");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <div className="card p-8">
        {state === "loading" && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-ink-200 border-t-brand-500" />
            <p className="text-sm text-ink-500">{t("shop.verifying")}</p>
          </>
        )}
        {state === "paid" && (
          <>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-brand-500/15 text-2xl text-brand-500">✓</div>
            <h1 className="text-xl font-black text-ink-900">{t("shop.paid")}</h1>
            {detail?.reference && <p className="mt-2 text-xs text-ink-400">Ref: {detail.reference}</p>}
          </>
        )}
        {state === "notpaid" && (
          <>
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-red-500/15 text-2xl text-red-500">✕</div>
            <h1 className="text-xl font-black text-ink-900">{t("shop.notPaid")}</h1>
          </>
        )}
        <Link href="/shop" className="btn-primary mt-6 inline-flex">{t("shop.backToShop")}</Link>
      </div>
    </div>
  );
}
