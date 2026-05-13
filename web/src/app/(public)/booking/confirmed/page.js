import Link from "next/link";

import { Button } from "@/components/shared";
import { Card } from "@/components/shared";

export const metadata = {
  title: "Booking Confirmed",
};

export default function BookingConfirmedPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-3xl text-black">OK</div>
        <h1 className="mt-6 text-4xl font-black">You are booked!</h1>
        <p className="mt-4 text-muted">
          Court 1 at Besa, Nagpur is reserved. The payment webhook architecture
          is ready for PhonePe confirmation and WhatsApp receipt delivery.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <Button href="/dashboard/bookings">View My Bookings</Button>
          <Button href="/venues/besa-nagpur/book" variant="secondary">Book Again</Button>
        </div>
        <Link href="/" className="mt-6 inline-block text-sm font-bold text-accent">Return home</Link>
      </Card>
    </main>
  );
}
