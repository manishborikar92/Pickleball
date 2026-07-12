import { SupportClient } from "@/components/features/support";
import { JsonLd } from "@/components/seo";
import { getPageMetadata } from "@/config/metadata.config";

export const metadata = getPageMetadata({
  title: "Help & Support",
  description:
    "Need help with court bookings? Review our FAQ lists regarding equipment, cancellations, refunds, court specifications, and rules, or contact Baseline Arena.",
  path: "/support",
});

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do I need my own equipment to play?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No, you don't! While you are welcome to bring your own gear, paddles and balls are available on-site for free for all players.",
      },
    },
    {
      "@type": "Question",
      "name": "How early can I book a court?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can book up to 7 days in advance. Slots open daily at our rollover time of 8:00 AM. We suggest booking early for peak hours (mornings and weekends).",
      },
    },
    {
      "@type": "Question",
      "name": "Can I cancel or get a refund after booking?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No, all customer-confirmed bookings are 100% non-refundable and non-reschedulable. If Baseline Arena cancels a booking due to weather or maintenance, we will issue 100% wallet credits.",
      },
    },
    {
      "@type": "Question",
      "name": "How do wallet credits work?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "If we have to close the courts (force majeure), equivalent credits are added to your phone's wallet. They will be applied as an automatic discount on your very next booking.",
      },
    },
    {
      "@type": "Question",
      "name": "What footwear is required?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Non-marking sports shoes are strictly mandatory on our Pro Cushion courts to preserve the professional grip and prevent scuffing. Casual shoes, sandals, or heels are not permitted.",
      },
    },
    {
      "@type": "Question",
      "name": "Can I host a corporate event or private tournament?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes! We support group bookings and private events. Please fill out our contact form below or reach out via email/phone to discuss custom arrangements.",
      },
    },
  ],
};

export default function SupportPage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <SupportClient />
    </>
  );
}