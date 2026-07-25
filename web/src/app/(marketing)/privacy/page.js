import { InfoPageLayout } from "@/components/layout";
import { getPageMetadata } from "@/config/metadata.config";

export const metadata = getPageMetadata({
  title: "Privacy Policy",
  description:
    "Review the privacy policy for Baseline Arena, detailing how we collect, use, and protect your personal and booking information.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <InfoPageLayout
      eyebrow="Data Protection"
      title="Privacy Policy"
      description="We respect your privacy and are committed to protecting the personal data you share with us. Learn how we handle your booking and account details."
    >
      {/*
        FIX: Original wrapper was `text-xs sm:text-sm` — text frozen at 14px for all
        screens 640px+, including large 1440px desktops.
        Added `lg:text-base` so body text scales to 16px on desktop for better readability.
      */}
      <div className="space-y-6 text-xs sm:text-sm lg:text-base">

        {/* Section 1: Information Collected */}
        <section className="space-y-3">
          {/*
            FIX: Section headings were `text-sm sm:text-base` — stopped scaling at sm.
            Added `lg:text-lg` to maintain heading hierarchy on large screens.
          */}
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            1. Information We Collect
          </h2>
          <p className="leading-relaxed">
            To provide a secure and functional booking environment, we collect the minimum necessary data from our users:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <strong>Account Information:</strong> Your full name and verified phone number are collected when verifying via OTP.
            </li>
            <li>
              <strong>Booking Data:</strong> Details of court reservations, times, fees, and transactions are logged in our database.
            </li>
            <li>
              <strong>Legal Compliance Logs:</strong> When you agree to the digital Liability Waiver during checkout, we log your request IP address and the exact server-side timestamp.
            </li>
            <li>
              <strong>Technical Logs:</strong> IP addresses and standard browser metadata are logged automatically by our servers for safety, DDoS mitigation, and diagnostic purposes.
            </li>
          </ul>
        </section>

        {/* Section 2: How We Use Data */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            2. How We Use Your Information
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            We use your collected personal information strictly to manage facilities and ensure secure operation of bookings:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>To authenticate logins via WhatsApp OTP.</li>
            <li>To dispatch booking confirmations, receipts, wallet credit updates, and closure alerts.</li>
            <li>To process secure checkout payments via PhonePe.</li>
            <li>To verify compliance with our mandatory Liability Waiver using logged IP and timestamp.</li>
          </ul>
        </section>

        {/* Section 3: Data Sharing & Third-Parties */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            3. Data Sharing &amp; Third-Party Service Integrations
          </h2>
          <p className="leading-relaxed">
            We do not sell, rent, trade, or distribute your personal details to third-party marketers. Your data is shared strictly with secure utility APIs to complete transactions:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li>
              <strong>PhonePe Gateway:</strong> Booking amounts and transaction references are shared to generate payment links. PhonePe complies with Payment Card Industry Data Security Standards (PCI-DSS) and Indian banking regulations.
            </li>
            <li>
              <strong>Meta Cloud API (WhatsApp):</strong> Phone numbers and session names are transmitted to Meta Cloud servers to deliver automated OTP codes, confirmation receipts, and wallet notifications.
            </li>
          </ul>
        </section>

        {/* Section 4: Cookies & Storage */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            4. Cookies, Session &amp; Local Storage
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            We utilize lightweight cookies and local storage tokens to store active booking sessions, authentication tokens, and user credentials locally on your device. These prevent you from having to re-authenticate with OTP on every visit. You can clear cookies or storage via your web browser settings at any time, which will log you out of the platform.
          </p>
        </section>

        {/* Section 5: Data Security & Retention */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            5. Data Security &amp; Retention
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            All data transferred between your browser and our servers is encrypted using Secure Sockets Layer/Transport Layer Security (SSL/TLS) technology. We store your account and booking data as long as you maintain an active history with us, or until you request its deletion.
          </p>
        </section>

        {/* Section 6: User Rights */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground sm:text-base lg:text-lg">
            6. Your Privacy Rights &amp; Contact
          </h2>
          <p className="leading-relaxed text-muted-foreground">
            If you wish to review, update, export, or delete your account records (including phone number and booking records) from our system, please contact us at{" "}
            <a href="mailto:support@baselinearena.in" className="text-accent hover:underline font-semibold">
              support@baselinearena.in
            </a>
            . We will process and respond to verified requests within 30 business days.
          </p>
        </section>

      </div>
    </InfoPageLayout>
  );
}