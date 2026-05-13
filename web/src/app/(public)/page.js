import { Header } from "@/components/layout";
import { CourtsSection } from "@/components/features/landing";
import { FAQSection } from "@/components/features/landing";
import { FacilitySection } from "@/components/features/landing";
import { HeroSection } from "@/components/features/landing";
import { HowItWorksSection } from "@/components/features/landing";
import { Footer } from "@/components/layout";
import { LocationSection } from "@/components/features/landing";
import { ReviewsSection } from "@/components/features/landing";

export default function HomePage() {
  return (
    <main>
      <Header />
      <HeroSection />
      <FacilitySection />
      <CourtsSection />
      <HowItWorksSection />
      <ReviewsSection />
      <LocationSection />
      <FAQSection />
      <Footer />
    </main>
  );
}
