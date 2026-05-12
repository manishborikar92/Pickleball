import { BookingClient } from "@/components/features/booking/BookingClient";
import { getAvailability, getVenue } from "@/lib/api";

export const metadata = {
  title: "Book Court",
  description: "Select live pickleball court slots and complete secure checkout.",
};

export default async function BookPage() {
  const [venue, availability] = await Promise.all([getVenue(), getAvailability()]);

  return (
    <BookingClient venue={venue} courts={venue.courts} availability={availability} />
  );
}
