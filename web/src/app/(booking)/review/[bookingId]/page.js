import { ReviewForm } from "@/components/features/review";
import { getPageMetadata } from "@/config/metadata.config";

export async function generateMetadata({ params }) {
  const { bookingId } = await params;
  return getPageMetadata({
    title: "Rate Your Experience",
    description: "Rate your pickleball court booking experience at Baseline Arena, Nagpur.",
    path: `/review/${bookingId}`,
    isPrivate: true,
  });
}

export default async function ReviewPage({ params }) {
  const { bookingId } = await params;
  return <ReviewForm bookingId={bookingId} />;
}
