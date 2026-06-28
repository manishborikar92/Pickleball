import { Header, Footer } from "@/components/layout";
import { Button, Card } from "@/components/shared";
import { XCircle, RefreshCw, ArrowRight } from "lucide-react";
import { getPageMetadata } from "@/config/metadata";
import { VENUE } from "@/config/venue.config";

export const metadata = getPageMetadata({
  title: "Payment Failed",
  description: "Your payment could not be processed. Please try again or contact support.",
  path: "/booking/failed",
  isPrivate: true,
});

export default async function BookingFailedPage(props) {
  const searchParams = await props.searchParams;
  const orderId = searchParams.orderId || "";
  const error = searchParams.error || "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:py-24">
        <Card className="w-full max-w-lg p-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
            <XCircle className="h-10 w-10 text-red-400" />
          </div>

          <h1 className="mb-2 text-2xl font-bold text-foreground">
            Payment Failed
          </h1>

          <p className="mb-6 text-muted">
            {error === "missing_order_id"
              ? "We couldn't identify your payment. Please try booking again."
              : "Your payment could not be processed. Don't worry — no amount has been deducted. You can try again if your booking slot is still available."}
          </p>

          {orderId && (
            <p className="mb-6 text-sm text-muted">
              Order ID: <span className="font-mono text-foreground">{orderId}</span>
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button href={`/venues/${VENUE.slug}/book`} variant="primary">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>

            <Button href="/support" variant="secondary">
              <ArrowRight className="mr-2 h-4 w-4" />
              Contact Support
            </Button>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
