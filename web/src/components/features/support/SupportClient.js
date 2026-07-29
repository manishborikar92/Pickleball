"use client";

import { useState } from "react";
import { InfoPageLayout } from "@/components/layout";
import { VENUE } from "@/config/venue.config";
import { Map } from "@/components/shared/Map";
import { Card } from "@/components/shared";
import { Mail, Phone, Clock, MapPin, ChevronDown } from "lucide-react";

const FAQS = [
  {
    question: "Do I need my own equipment to play?",
    answer: "No, you don't! While you are welcome to bring your own gear, paddles and balls are available on-site for free for all players.",
  },
  {
    question: "How early can I book a court?",
    answer: "You can book up to 7 days in advance. Slots open daily at our rollover time of 8:00 AM. We suggest booking early for peak hours (mornings and weekends).",
  },
  {
    question: "Can I cancel or get a refund after booking?",
    answer: "No, all customer-confirmed bookings are 100% non-refundable and non-reschedulable. If Baseline Arena cancels a booking due to weather or maintenance, we will issue 100% wallet credits.",
  },
  {
    question: "How do wallet credits work?",
    answer: "If we have to close the courts (force majeure), equivalent credits are added to your phone's wallet. They will be applied as an automatic discount on your very next booking.",
  },
  {
    question: "What footwear is required?",
    answer: "Non-marking sports shoes are strictly mandatory on our Pro Cushion courts to preserve the professional grip and prevent scuffing. Casual shoes, sandals, or heels are not permitted.",
  },
  {
    question: "Can I host a corporate event or private tournament?",
    answer: "Yes! We support group bookings and private events. Please reach out via email/phone to discuss custom arrangements.",
  },
];

export function SupportClient() {
  const [openFAQIndex, setOpenFAQIndex] = useState(null);

  return (
    <InfoPageLayout
      eyebrow="Customer Support"
      title="Help & Support Center"
      description="Need help with a booking? Have a question about our court rules? Get in touch or browse common questions below."
    >
      <div className="space-y-12">
        {/* FAQs Section */}
        <section className="space-y-5">
          <h2 className="text-xl font-black text-foreground sm:text-2xl">
            Frequently Asked Questions
          </h2>
          <div className="grid gap-3.5">
            {FAQS.map(({ question, answer }, index) => {
              const isOpen = openFAQIndex === index;
              return (
                <div
                  key={index}
                  className="overflow-hidden rounded-xl border border-line bg-surface-panel/40 transition-colors duration-200 hover:border-line/75"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFAQIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between p-4 text-left outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent sm:p-5"
                  >
                    <span className="text-sm font-bold text-foreground sm:text-base pr-4">
                      {question}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-accent transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-line/40 bg-surface/30 px-4 py-4 sm:px-5">
                      <p className="text-xs sm:text-sm lg:text-base leading-relaxed text-muted">
                        {answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Location details */}
        <section className="mt-8 border-t border-line/45 pt-8">
          <div className="space-y-6">
            <h2 className="text-xl font-black text-foreground sm:text-2xl">
              Location &amp; Details
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Card className="flex items-start gap-4 rounded-xl border border-line/50 bg-surface/40 p-4">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Address</h4>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{VENUE.address}</p>
                </div>
              </Card>

              <Card className="flex items-start gap-4 rounded-xl border border-line/50 bg-surface/40 p-4">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Operational Hours</h4>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{VENUE.hours}</p>
                </div>
              </Card>

              <Card className="flex items-start gap-4 rounded-xl border border-line/50 bg-surface/40 p-4">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Telephone</h4>
                  <div className="mt-1 flex flex-col gap-1 text-sm font-semibold text-muted">
                    <a
                      href={`tel:${VENUE.phone.replace(/\D/g, "")}`}
                      className="transition-colors hover:text-accent"
                    >
                      {VENUE.phone}
                    </a>
                    {VENUE.secondaryPhone && (
                      <a
                        href={`tel:${VENUE.secondaryPhone.replace(/\D/g, "")}`}
                        className="transition-colors hover:text-accent"
                      >
                        {VENUE.secondaryPhone}
                      </a>
                    )}
                  </div>
                </div>
              </Card>

              <Card className="flex items-start gap-4 rounded-xl border border-line/50 bg-surface/40 p-4">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Email Support</h4>
                  <p className="mt-1 text-sm">
                    <a
                      href={`mailto:${VENUE.email}`}
                      className="font-semibold text-muted transition-colors hover:text-accent"
                    >
                      {VENUE.email}
                    </a>
                  </p>
                </div>
              </Card>
            </div>

            {/* Embedded interactive map */}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-surface-panel shadow-md">
              <Map
                lat={VENUE.location.lat}
                lng={VENUE.location.lng}
                name={VENUE.name}
                address={VENUE.address}
              />
            </div>
          </div>
        </section>
      </div>
    </InfoPageLayout>
  );
}
