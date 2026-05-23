import { InfoPageLayout } from "@/components/layout";

export const metadata = {
  title: "Cancellation & Refund Policy",
  description:
    "Learn about our strict cancellation policy, refund terms, and how wallet credits are handled for booking closures at Baseline Arena.",
};

export default function RefundPage() {
  return (
    <InfoPageLayout
      eyebrow="Booking Rules"
      title="Cancellation & Refund Policy"
      description="Read our terms regarding slot cancellations, customer refunds, and wallet credit allocations."
    >
      {/*
        FIX: text-xs sm:text-sm → text-xs sm:text-sm lg:text-base
        Body text now scales to 16px on desktop instead of freezing at 14px.
      */}
      <div className="space-y-6 text-xs sm:text-sm lg:text-base">

        {/* Section 1: Customer-Initiated Policy */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            1. Customer-Initiated Cancellation &amp; No-Show Policy
          </h2>
          <p className="leading-relaxed">
            Baseline Arena operates on a highly structured scheduling model to ensure fair court availability for all players. Once a booking checkout is completed, the slots are reserved exclusively for you, preventing other players from booking that time.
          </p>
          {/*
            FIX: Original JSX had literal ** markdown syntax inside text nodes:
              **100% final, non-cancellable, and non-reschedulable**
            These rendered as "**100% final...**" in the browser — not bold.
            Replaced all occurrences with proper <strong> tags.
          */}
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <strong>No Cancellations:</strong> All confirmed bookings are{" "}
              <strong>100% final, non-cancellable, and non-reschedulable</strong> by the customer.
            </li>
            <li>
              <strong>No Refunds:</strong> We do not issue cash refunds, UPI reversals, or wallet credits if you decide to cancel, miss your slot, or are unable to play due to personal reasons.
            </li>
            <li>
              <strong>No-Shows:</strong> If you fail to arrive at the venue for your reserved slot, the booking will be marked as a no-show. The reserved time is forfeited, and no compensation will be provided.
            </li>
          </ul>
        </section>

        {/* Section 2: Business-Initiated Policy */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            2. Business-Initiated Cancellations (Force Majeure)
          </h2>
          <p className="leading-relaxed">
            In rare cases, Baseline Arena may be forced to cancel your booking due to reasons beyond our control (e.g., severe localized flooding, electrical grid/power failures, facility damage, or unexpected safety issues).
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <strong>Resolution:</strong> If we cancel your reservation, you will immediately receive full compensation.
            </li>
            <li>
              {/* FIX: ** around "monetary wallet credits" replaced with <strong> */}
              <strong>No Cash/Bank Refunds:</strong> To avoid gateway transaction processing delays, we do not issue credit card or UPI bank account refunds. Instead, we issue{" "}
              <strong>monetary wallet credits</strong> directly to your registered phone profile.
            </li>
            <li>
              <strong>Notification:</strong> An automated WhatsApp cancellation alert will be dispatched to your phone specifying the canceled booking reference and the credits added.
            </li>
          </ul>
        </section>

        {/* Section 3: Wallet Credit Rules */}
        <section className="space-y-3 pt-4 border-t border-line/30">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            3. Wallet Credit Rules &amp; Rollover
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            Wallet credits act as virtual store credits linked directly to your verified phone number. They are subject to the following rules:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <strong>Automatic Redemption:</strong> When you select slots for a new booking, our pricing engine checks your wallet balance server-side. The available wallet credits are automatically applied as a discount on your subtotal.
            </li>
            <li>
              <strong>Zero Cash Value:</strong> Wallet credits cannot be withdrawn, refunded to a bank account, or transferred to another player&apos;s phone profile. They can only be used for court bookings at Baseline Arena.
            </li>
            <li>
              <strong>No Expiry:</strong> Once issued, wallet credits remain linked to your account indefinitely and do not expire.
            </li>
          </ul>
        </section>

      </div>
    </InfoPageLayout>
  );
}