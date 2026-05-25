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

export function SupportClient() {
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

        {/* Support Grid: Contact Form + Location details */}
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
                  <p className="mt-1 text-sm leading-relaxed text-muted">{venue.address}</p>
                </div>
              </Card>

              <Card className="flex items-start gap-4 rounded-xl border border-line/50 bg-surface/40 p-4">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Operational Hours</h4>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{venue.hours}</p>
                </div>
              </Card>

              <Card className="flex items-start gap-4 rounded-xl border border-line/50 bg-surface/40 p-4">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Telephone</h4>
                  <p className="mt-1 text-sm">
                    <a
                      href={`tel:${venue.phone.replace(/\D/g, "")}`}
                      className="font-semibold text-muted transition-colors hover:text-accent"
                    >
                      {venue.phone}
                    </a>
                  </p>
                </div>
              </Card>

              <Card className="flex items-start gap-4 rounded-xl border border-line/50 bg-surface/40 p-4">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Email Support</h4>
                  <p className="mt-1 text-sm">
                    <a
                      href={`mailto:${venue.email}`}
                      className="font-semibold text-muted transition-colors hover:text-accent"
                    >
                      {venue.email}
                    </a>
                  </p>
                </div>
              </Card>
            </div>

            {/* Embedded interactive map */}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-surface-panel shadow-md">
              <Map
                lat={venue.location.lat}
                lng={venue.location.lng}
                name={venue.name}
                address={venue.address}
              />
            </div>

            {/* Contact Form */}
            <div className="glass-panel mt-6 rounded-2xl p-5 sm:p-8">
              <h3 className="text-lg font-black text-foreground sm:text-xl">
                Send a Message
              </h3>
              <p className="mt-1.5 text-xs text-muted sm:text-sm">
                Have a question or request? Complete the form and our team will get back to you within 24 hours.
              </p>
              
              {submitSuccess ? (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-accent/20 bg-accent/5 p-4 text-accent">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div>
                    <h4 className="font-bold text-sm">Message Sent!</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">Thank you for reaching out. We will get in touch with you shortly.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {formError && (
                    <p className="text-xs font-bold text-destructive" role="alert">
                      {formError}
                    </p>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-bold text-muted uppercase tracking-wider">
                      Your Name
                      <input
                        type="text"
                        name="name"
                        value={formState.name}
                        onChange={handleInputChange}
                        placeholder="John Doe"
                        className="rounded-lg border border-line bg-surface/50 p-3 text-sm text-foreground outline-none focus:border-accent"
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs font-bold text-muted uppercase tracking-wider">
                      Email Address
                      <input
                        type="email"
                        name="email"
                        value={formState.email}
                        onChange={handleInputChange}
                        placeholder="john@example.com"
                        className="rounded-lg border border-line bg-surface/50 p-3 text-sm text-foreground outline-none focus:border-accent"
                      />
                    </label>
                  </div>
                  <label className="grid gap-1.5 text-xs font-bold text-muted uppercase tracking-wider">
                    Phone Number
                    <input
                      type="text"
                      name="phone"
                      value={formState.phone}
                      onChange={handleInputChange}
                      placeholder="9876543210"
                      className="rounded-lg border border-line bg-surface/50 p-3 text-sm text-foreground outline-none focus:border-accent"
                    />
                  </label>
                  <label className="grid gap-1.5 text-xs font-bold text-muted uppercase tracking-wider">
                    Message
                    <textarea
                      name="message"
                      rows="4"
                      value={formState.message}
                      onChange={handleInputChange}
                      placeholder="How can we help you?"
                      className="rounded-lg border border-line bg-surface/50 p-3 text-sm text-foreground outline-none focus:border-accent resize-none"
                    />
                  </label>
                  <Button type="submit" disabled={isSubmitting} className="w-full justify-center">
                    <Send className="mr-2 h-4 w-4" />
                    <span>{isSubmitting ? "Sending..." : "Send Message"}</span>
                  </Button>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </InfoPageLayout>
  );
}
