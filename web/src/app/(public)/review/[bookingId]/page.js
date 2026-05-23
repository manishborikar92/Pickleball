import { ReviewForm } from "@/components/features/review";

export async function generateMetadata({ params }) {
  const { bookingId } = await params;
  return {
    title: `Rate Your Experience - ${bookingId}`,
    description: `Rate your pickleball court booking experience at Baseline Arena Nagpur for booking ${bookingId}.`,
    alternates: {
      canonical: `/review/${bookingId}`,
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function ReviewPage({ params }) {
  const { bookingId } = await params;
  return <ReviewForm bookingId={bookingId} />;
}
