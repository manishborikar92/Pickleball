import { Header, Footer } from "@/components/layout";

export default function MarketingLayout({ children }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
