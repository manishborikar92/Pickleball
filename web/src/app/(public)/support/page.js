"use client";

import { useState } from "react";
import { InfoPageLayout } from "@/components/layout";
import { venue } from "@/data/platform";
import { Map } from "@/components/shared/Map";
import { Button, Card } from "@/components/shared";
import { Mail, Phone, Clock, MapPin, Send, CheckCircle2, ChevronDown } from "lucide-react";

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
    answer: "Yes! We support group bookings and private events. Please fill out our contact form below or reach out via email/phone to discuss custom arrangements.",
  },
];

export default function SupportPage() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState("");
  const [openFAQIndex, setOpenFAQIndex] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
    setFormError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formState.name.trim() || !formState.email.trim() || !formState.phone.trim() || !formState.message.trim()) {
      setFormError("All fields are required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formState.email.trim())) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setFormState({ name: "", email: "", phone: "", message: "" });
    }, 1000);
  };

  return (
    <InfoPageLayout
      eyebrow="Help Desk"
      title="Support & Contact Center"
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
                    {/*
                      FIX: Original used `h-4.5 w-4.5` — not a default Tailwind class.
                      Changed to `h-4 w-4` (standard) which renders the icon correctly.
                      If the project has a custom Tailwind config defining h-4.5, this
                      can be reverted to h-4.5 without breaking anything.
                    */}
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-accent transition-transform duration-300 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="border-t border-line/40 bg-surface/30 px-4 py-4 sm:px-5">
                      {/*
                        FIX: FAQ answer text was `text-xs sm:text-sm`.
                        Added `lg:text-base` so answers are comfortably readable on desktop.
                      */}
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

        {/* Support Grid: Contact Form + Location details
            NOTE: This grid correctly stays at `lg:grid-cols-2` (not md).
            Reason: with the InfoPageLayout fix, the article is ~480px at md.
            Splitting form + location at 240px each at that width would make the
            contact form extremely cramped. At lg, article is ~720px, giving each
            half a comfortable ~360px — ideal for form + map layout.
        */}
        <section className="mt-8 grid gap-8 grid-cols-1 lg:grid-cols-2 border-t border-line/45">

          {/* Contact Details & Map */}
          <div className="mt-6 space-y-6 lg:order-last">
            <h2 className="text-xl font-black text-foreground sm:text-2xl">
              Location &amp; Details
            </h2>

            {/*
              Contact info cards: sm:grid-cols-2 gives 2-col at 640px+.
              lg:grid-cols-1 collapses to 1-col when this div is inside the
              lg:grid-cols-2 parent column (~360px) — correct at that width.
            */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Card className="flex items-start gap-4 p-4 border-line/50 bg-surface/40">
                <MapPin className="h-5 w-5 shrink-0 text-accent mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Address</h4>
                  <p className="mt-1 text-sm text-muted leading-relaxed">{venue.address}</p>
                </div>
              </Card>

              <Card className="flex items-start gap-4 p-4 border-line/50 bg-surface/40">
                <Clock className="h-5 w-5 shrink-0 text-accent mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Operational Hours</h4>
                  <p className="mt-1 text-sm text-muted leading-relaxed">{venue.hours}</p>
                </div>
              </Card>

              <Card className="flex items-start gap-4 p-4 border-line/50 bg-surface/40">
                <Phone className="h-5 w-5 shrink-0 text-accent mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Telephone</h4>
                  <p className="mt-1 text-sm">
                    <a
                      href={`tel:${venue.phone.replace(/\D/g, "")}`}
                      className="text-muted hover:text-accent font-semibold transition-colors"
                    >
                      {venue.phone}
                    </a>
                  </p>
                </div>
              </Card>

              <Card className="flex items-start gap-4 p-4 border-line/50 bg-surface/40">
                <Mail className="h-5 w-5 shrink-0 text-accent mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Email Support</h4>
                  <p className="mt-1 text-sm">
                    <a
                      href={`mailto:${venue.email}`}
                      className="text-muted hover:text-accent font-semibold transition-colors"
                    >
                      {venue.email}
                    </a>
                  </p>
                </div>
              </Card>
            </div>

            {/* Embedded interactive map — aspect-video is responsive by nature */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-line bg-surface-panel shadow-md">
              <Map
                lat={venue.location.lat}
                lng={venue.location.lng}
                name={venue.name}
                address={venue.address}
              />
            </div>
          </div>

        </section>
      </div>
    </InfoPageLayout>
  );
}