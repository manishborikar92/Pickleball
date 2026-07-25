import { Suspense } from "react";

import { Header, Footer } from "@/components/layout";
import { PaymentRedirectCard, PaymentRedirectView } from "@/components/features/booking";

// Post-payment redirect landing — the target of PhonePe's merchantUrls.redirectUrl.
// PhonePe (and the sandbox provider) redirect the customer's browser here;
// `?orderId=<merchantOrderId>` is the whole contract. The client view verifies
// the order via a server action (the backend origin never reaches the browser)
// and replaces this transient route with the unified /booking/[bookingId] page
// or the whitelisted /booking/error page.
// useSearchParams requires the Suspense boundary; its fallback renders the same
// interstitial card, so the spinner paints with the prerendered shell.
export default function PaymentRedirectPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <Suspense fallback={<PaymentRedirectCard />}>
          <PaymentRedirectView />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
