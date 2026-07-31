import { BookingErrorView } from "@/components/features/booking";

// This route is the terminal sink the /booking/redirect landing falls back to
// when it cannot resolve a bookingId (missing/unknown orderId, backend unreachable).
// `type` is the only contract callers send — whitelist it and never reflect a
// free-form `message` from the URL, so this official-looking page can't be used to
// surface attacker-supplied text.
const KNOWN_ERROR_TYPES = new Set([
  "missing_order_id",
  "notFound",
  "api_failure",
  "generic",
]);

export default async function BookingErrorPage(props) {
  const searchParams = await props.searchParams;
  const type = KNOWN_ERROR_TYPES.has(searchParams.type) ? searchParams.type : "generic";

  return <BookingErrorView type={type} />;
}
