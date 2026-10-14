import type { Metadata, Viewport } from "next";
import { Anuphan, Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const sans = Figtree({
  variable: "--font-sans-latin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const thai = Anuphan({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Learning Suite · Siam Pinnacle Group",
  description: "AI-powered learning suite prototype with a Thai/English AI coach, 70-20-10 path engine, and manager approvals. Mock data only.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0c6368",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${display.variable} ${sans.variable} ${thai.variable} h-full antialiased`}>
      <body className="min-h-full selection:bg-brand-soft selection:text-brand">{children}</body>
    </html>
  );
}
