import { Suspense } from "react";
import { PaymentReturn } from "@/components/PaymentReturn";

export const dynamic = "force-dynamic";

export default function ShopReturnPage() {
  return (
    <Suspense fallback={null}>
      <PaymentReturn />
    </Suspense>
  );
}
