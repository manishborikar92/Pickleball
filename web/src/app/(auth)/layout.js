import "../globals.css";
import { Geist } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Baseline Arena | Security Portal",
    template: "%s | Baseline Arena Security",
  },
  description: "Secure Single Sign-On (SSO) Portal for Baseline Arena",
  // Strict robots configuration: Auth subdomain and login paths must NEVER be indexed
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AuthLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Isolated Security CSP Header Hook for Auth Portal */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="frame-ancestors 'none'; object-src 'none';"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground" suppressHydrationWarning>
        <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-surface-panel/30">
          {children}
        </div>
      </body>
    </html>
  );
}
