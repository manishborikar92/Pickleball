import { Card, Button } from "@/components/shared";
import { ShieldAlert, LogIn, Calendar, Lock, AlertTriangle, ArrowRight } from "lucide-react";
import { VENUE } from "@/config/venue.config";

/**
 * Presentational component for various booking error/exception views.
 *
 * @param {Object} props
 * @param {string} props.type - The error type: 'expired' | 'cancelled' | 'unauthorized' | 'forbidden' | 'notFound' | 'api_failure' | 'generic'.
 * @param {Object} [props.booking] - Booking details (if available).
 * @param {string} [props.redirectBookingId] - Booking ID to append as next param on login redirects.
 * @param {string} [props.message] - Explicit system error message.
 */
export function BookingErrorView({ type, booking, redirectBookingId, message }) {
  const venueSlug = booking?.venue?.slug || VENUE.slug;
  const retryUrl = `/venues/${venueSlug}/book`;

  if (type === "unauthorized") {
    const nextUrl = redirectBookingId ? `/booking/${redirectBookingId}` : "/dashboard/overview";
    return (
      <div className="flex items-center justify-center px-4 py-16 sm:py-24 w-full">
        <Card className="w-full max-w-lg p-8 text-center border-t-4 border-t-accent">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Lock className="h-10 w-10" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Authentication Required</h1>
          <p className="mb-6 text-muted text-sm leading-relaxed">
            Please log in to view the receipt and details of this court booking.
          </p>
          <Button href={`/login?next=${encodeURIComponent(nextUrl)}`} className="w-full justify-center">
            <LogIn className="mr-2 h-4 w-4" />
            <span>Log In to Account</span>
          </Button>
        </Card>
      </div>
    );
  }

  if (type === "forbidden") {
    return (
      <div className="flex items-center justify-center px-4 py-16 sm:py-24 w-full">
        <Card className="w-full max-w-lg p-8 text-center border-t-4 border-t-red-500">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <ShieldAlert className="h-10 w-10" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="mb-6 text-muted text-sm leading-relaxed">
            You do not have permission to view this booking. Ensure you are signed in to the correct account.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button href="/dashboard/bookings" variant="primary" className="w-full sm:w-auto">
              Go to My Bookings
            </Button>
            <Button href="/" variant="secondary" className="w-full sm:w-auto">
              Back to Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (type === "expired") {
    return (
      <div className="flex items-center justify-center px-4 py-16 sm:py-24 w-full">
        <Card className="w-full max-w-lg p-8 text-center border-t-4 border-t-amber-500">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <Calendar className="h-10 w-10" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Slot Hold Expired</h1>
          <p className="mb-6 text-muted text-sm leading-relaxed">
            The 10-minute hold window for these courts has expired. The slots have been released for other players.
          </p>
          <Button href={retryUrl} className="w-full justify-center">
            <span>Book New Slots</span>
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Card>
      </div>
    );
  }

  if (type === "cancelled") {
    return (
      <div className="flex items-center justify-center px-4 py-16 sm:py-24 w-full">
        <Card className="w-full max-w-lg p-8 text-center border-t-4 border-t-red-500">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Booking Cancelled</h1>
          <p className="mb-6 text-muted text-sm leading-relaxed">
            This reservation has been cancelled. If any payment was captured, wallet credits have been automatically refunded to your balance.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button href="/dashboard/bookings" variant="primary" className="w-full sm:w-auto">
              Check Booking History
            </Button>
            <Button href="/support" variant="secondary" className="w-full sm:w-auto">
              Contact Support
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Terminal error states that carry no actionable booking context.
  // Copy is accurate per cause and never blames the user's connection for a
  // server/gateway-side failure.
  const COPY = {
    notFound: {
      header: "Booking Not Found",
      desc: "We couldn't locate this booking record. Check the link, or view all your reservations in your dashboard.",
    },
    missing_order_id: {
      header: "Payment Not Identified",
      desc: "We couldn't identify your payment. If you completed a transaction it will appear on your dashboard shortly — otherwise please try booking again.",
    },
    api_failure: {
      header: "Something Went Wrong",
      desc: "We're having trouble completing this request right now. If you made a payment it will reflect on your dashboard shortly — please check back in a few minutes.",
    },
    unknown_status: {
      header: "Booking Unavailable",
      desc: "This booking can't be displayed right now. Please check your dashboard, or contact support if the problem persists.",
    },
  };
  const { header: headerText, desc: descText } = COPY[type] || {
    header: "Something Went Wrong",
    desc: "An unexpected error occurred. Please check your dashboard or try again in a few minutes.",
  };

  return (
    <div className="flex items-center justify-center px-4 py-16 sm:py-24 w-full">
      <Card className="w-full max-w-lg p-8 text-center border-t-4 border-t-red-500">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">{headerText}</h1>
        <p className="mb-6 text-muted text-sm leading-relaxed">{descText}</p>
        {message && (
          <p className="mb-6 text-xs text-red-400/80 font-mono bg-surface-soft/40 p-3 rounded border border-line select-all">
            Message: {message}
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button href="/dashboard/bookings" variant="primary" className="w-full sm:w-auto">
            Go to My Bookings
          </Button>
          <Button href="/" variant="secondary" className="w-full sm:w-auto">
            Back to Home
          </Button>
        </div>
      </Card>
    </div>
  );
}
