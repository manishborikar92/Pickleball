import { InfoPageLayout } from "@/components/layout";
import { getPageMetadata } from "@/config/metadata.config";

export const metadata = getPageMetadata({
  title: "Terms & Conditions & Liability Waiver",
  description:
    "Review the Terms and Conditions, Liability Waiver, and Court Safety Guidelines for playing at Baseline Arena Nagpur.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <InfoPageLayout
      eyebrow="Rules & Agreements"
      title="Terms of Service & Liability Waiver"
      description="Please read these terms carefully. By booking a court or entering our facility, you agree to comply with all guidelines, safety procedures, and liability waivers."
    >
      {/*
        FIX: text-xs sm:text-sm → text-xs sm:text-sm lg:text-base
        Legal content stays compact on mobile/tablet but scales to 16px on desktop.
      */}
      <div className="space-y-8 text-xs sm:text-sm lg:text-base">

        {/* Section 1: Court Booking & Slot Reservation */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            1. Court Booking &amp; Slot Reservation
          </h2>
          <p className="leading-relaxed">
            Baseline Arena provides outdoor pickleball court reservations at our facility in Besa, Nagpur. Bookings are processed online through our mobile checkout system.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <strong>Booking Window:</strong> Court bookings can be made up to 7 days in advance. Live slots open daily at our Rollover Trigger Time of 8:00 AM.
            </li>
            <li>
              <strong>Slot Locking:</strong> When you select slots and initiate the checkout process, the selected slots are locked and held for exactly 10 minutes to allow completion of authentication and payment. If payment is not completed within 10 minutes, the hold expires and slots are automatically released back to the general pool.
            </li>
            <li>
              <strong>Verification:</strong> To prevent slot hoarding and automated booking abuse, a verified mobile phone number (via WhatsApp OTP) is required to secure any booking. Users may not hold more than 2 pending payment bookings simultaneously.
            </li>
          </ul>
        </section>

        {/* Section 2: Payments and Fees */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            2. Pricing, Payments &amp; Wallet Credits
          </h2>
          <p className="leading-relaxed">
            All booking fees are calculated server-side and must be paid in full at the time of reservation.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <strong>UPI Checkout:</strong> Payments are processed securely via the PhonePe payment gateway (UPI-only).
            </li>
            <li>
              <strong>Non-Refundable:</strong> All confirmed customer bookings are final and 100% non-refundable and non-reschedulable under any circumstances.
            </li>
            <li>
              <strong>Wallet Credits:</strong> In cases of facility-initiated cancellations (force majeure events such as extreme weather, power outages, or court maintenance), equivalent booking fees will be refunded directly to your user wallet account. Wallet credits are non-withdrawable but apply automatically as a discount on your next reservation.
            </li>
          </ul>
        </section>

        {/* Section 3: Court Safety & Footwear Rules */}
        <section id="rules" className="space-y-3 pt-4 border-t border-line/30">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            3. Court Safety, Footwear &amp; Etiquette
          </h2>
          <p className="leading-relaxed">
            To maintain our high court standards and protect all players, the following rules are strictly enforced inside the playing arena:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <strong>Footwear:</strong> All players must wear appropriate athletic, non-marking sports shoes on the Pro Cushion courts. Sandals, heels, boots, and casual flat-soled non-sports shoes are strictly forbidden on court surfaces.
            </li>
            <li>
              <strong>Equipment Care:</strong> Paddles and balls provided by Baseline Arena must be handled with care and returned to the front desk after play. Damages caused by clear abuse may result in replacement fees.
            </li>
            <li>
              <strong>Conduct:</strong> Courteous and respectful behavior toward staff and fellow players is required. Foul language, verbal abuse, or physical confrontation will result in immediate removal and permanent ban from the facility.
            </li>
            <li>
              <strong>Food &amp; Drinks:</strong> No outside food or colored beverages are permitted on the court surfaces. Only sealed water bottles are allowed courtside.
            </li>
          </ul>
        </section>

        {/* Section 4: Liability Waiver
            FIX: Original had BOTH `border-t border-line/30` AND `border border-line/40`
            on the same element. The `border` utility sets all four sides and overrides
            `border-t`. The `border-line/40` also overrides `border-line/30`. So only
            `border border-line/40` was actually rendering — the first pair was dead CSS.
            Removed the redundant `border-t border-line/30` for clean, explicit styling.
        */}
        <section id="waiver" className="space-y-3 pt-4 bg-surface/20 p-4 rounded-xl border border-line/40">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg text-accent">
            4. Digital Liability Waiver &amp; Release of Liability
          </h2>
          <p className="leading-relaxed">
            By accepting these terms and proceeding with a booking, you represent that you are physically fit to play and release Baseline Arena, its operators, and staff from any liability:
          </p>
          <div className="space-y-2 text-muted-foreground leading-relaxed">
            <p>
              <strong>Assumption of Risk:</strong> You acknowledge that participation in pickleball involves physical exertion, quick movements, and collision risk, which carry inherent risks of minor or major physical injury, including but not limited to sprains, fractures, concussions, or cardiac emergencies. You voluntarily assume all risks associated with playing at our facility.
            </p>
            <p>
              <strong>Liability Release:</strong> You hereby release, waive, and discharge Baseline Arena and its operator team from any and all liability, claims, or demands arising out of any personal injury, loss, or property damage sustained while inside the facility, whether caused by negligence or otherwise.
            </p>
            <p>
              <strong>Compliance Logging:</strong> To satisfy legal compliance, when you accept these terms during the checkout flow, the system logs a permanent timestamp, your verified phone number, and your request IP address. This digital signature serves as a legally binding liability waiver.
            </p>
          </div>
        </section>

        {/* Section 5: Governing Law */}
        <section className="space-y-3 pt-4 border-t border-line/30">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            5. Governing Law &amp; Dispute Resolution
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            These terms are governed by and construed in accordance with the laws of India. Any legal dispute, claim, or controversy arising out of these terms or facility usage shall be subject to the exclusive jurisdiction of the competent courts located in Nagpur, Maharashtra, India.
          </p>
        </section>

      </div>
    </InfoPageLayout>
  );
}