import { ReviewForm } from "@/components/features/review/ReviewForm";

export const metadata = {
  title: "Rate Your Experience",
};

export default async function ReviewPage({ params }) {
  const { bookingId } = await params;
  return <ReviewForm bookingId={bookingId} />;
}
