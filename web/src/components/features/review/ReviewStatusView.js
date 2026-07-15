import { Card, Button } from "@/components/shared";
import { CalendarClock, Lock, LogIn, SearchX, ShieldAlert, ArrowRight } from "lucide-react";

import { formatSessionDate } from "./ReviewShell";

/**
 * Presentational views for every non-form review state, mirroring
 * BookingErrorView: one component, typed variants, no message-string branching.
 *
 * @param {Object} props
 * @param {string} props.type - "unauthorized" | "not_completed" | "not_reviewable"
 *                              | "forbidden" | "not_found" | "error".
 * @param {string} props.bookingId - Booking id from the URL (login next + booking links).
 * @param {Object} [props.booking]  - Normalized booking, when the state has one.
 * @param {string} [props.message]  - Explicit system error message.
 */
export function ReviewStatusView({ type, bookingId, booking, message }) {
  if (type === "unauthorized") {
    const nextUrl = `/review/${bookingId}`;
    return (
      <StatusCard
        accent="accent"
        icon={<Lock className="h-10 w-10" />}
        title="Sign In to Rate Your Session"
        description="This review is linked to your booking. Verify your phone number and we'll bring you right back here — nothing you've done is lost."
      >
        <Button href={`/login?next=${encodeURIComponent(nextUrl)}`} className="w-full justify-center">
          <LogIn className="mr-2 h-4 w-4" />
          <span>Log In to Continue</span>
        </Button>
      </StatusCard>
    );
  }

  if (type === "not_completed") {
    const sessionDate = formatSessionDate(booking?.slotDate);
    return (
      <StatusCard
        accent="amber"
        icon={<CalendarClock className="h-10 w-10" />}
        title="This Session Hasn't Been Played Yet"
        description={`Reviews open after your session is completed${sessionDate ? ` — your booking is for ${sessionDate}` : ""}. Come back once you've played to rate your experience.`}
      >
        <Button href={`/booking/${bookingId}`} variant="primary" className="w-full justify-center sm:w-auto">
          <span>View Booking</span>
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
        <Button href="/dashboard/bookings" variant="secondary" className="w-full justify-center sm:w-auto">
          My Bookings
        </Button>
      </StatusCard>
    );
  }

  if (type === "not_reviewable") {
    return (
      <StatusCard
        accent="amber"
        icon={<CalendarClock className="h-10 w-10" />}
        title="This Booking Can't Be Reviewed"
        description="Only completed sessions can be rated. This booking was cancelled or expired before it was played."
      >
        <Button href="/dashboard/bookings" variant="primary" className="w-full justify-center sm:w-auto">
          My Bookings
        </Button>
        <Button href="/" variant="secondary" className="w-full justify-center sm:w-auto">
          Back to Home
        </Button>
      </StatusCard>
    );
  }

  if (type === "forbidden") {
    return (
      <StatusCard
        accent="red"
        icon={<ShieldAlert className="h-10 w-10" />}
        title="Access Denied"
        description="Only the player who made this booking can review it. Make sure you're signed in to the correct account."
      >
        <Button href="/dashboard/bookings" variant="primary" className="w-full justify-center sm:w-auto">
          Go to My Bookings
        </Button>
        <Button href="/" variant="secondary" className="w-full justify-center sm:w-auto">
          Back to Home
        </Button>
      </StatusCard>
    );
  }

  if (type === "not_found") {
    return (
      <StatusCard
        accent="red"
        icon={<SearchX className="h-10 w-10" />}
        title="Booking Not Found"
        description="We couldn't locate this booking. Check the link, or find the session you want to rate in your bookings."
      >
        <Button href="/dashboard/bookings" variant="primary" className="w-full justify-center sm:w-auto">
          Go to My Bookings
        </Button>
        <Button href="/" variant="secondary" className="w-full justify-center sm:w-auto">
          Back to Home
        </Button>
      </StatusCard>
    );
  }

  return (
    <StatusCard
      accent="red"
      icon={<ShieldAlert className="h-10 w-10" />}
      title="Something Went Wrong"
      description="We're having trouble loading this review right now. Please try again in a few minutes."
    >
      {message && (
        <p className="w-full select-all rounded border border-line bg-surface-soft/40 p-3 font-mono text-xs text-red-400/80">
          Message: {message}
        </p>
      )}
      <Button href="/dashboard/bookings" variant="primary" className="w-full justify-center sm:w-auto">
        Go to My Bookings
      </Button>
      <Button href="/" variant="secondary" className="w-full justify-center sm:w-auto">
        Back to Home
      </Button>
    </StatusCard>
  );
}

const ACCENTS = {
  accent: { border: "border-t-accent", iconWrap: "bg-accent/10 text-accent" },
  amber: { border: "border-t-amber-500", iconWrap: "bg-amber-500/10 text-amber-500" },
  red: { border: "border-t-red-500", iconWrap: "bg-red-500/10 text-red-400" },
};

function StatusCard({ accent, icon, title, description, children }) {
  const tone = ACCENTS[accent] || ACCENTS.red;
  return (
    <div className="flex w-full items-center justify-center px-4 py-16 sm:py-24">
      <Card className={`w-full max-w-lg border-t-4 p-8 text-center ${tone.border}`}>
        <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full ${tone.iconWrap}`}>
          {icon}
        </div>
        <h2 className="mb-2 text-2xl font-bold text-foreground">{title}</h2>
        <p className="mb-6 text-sm leading-relaxed text-muted">{description}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {children}
        </div>
      </Card>
    </div>
  );
}
