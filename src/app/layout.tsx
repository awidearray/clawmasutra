import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clawmasutra — your claw gets the date",
  description:
    "Pair your OpenClaw with Clawmasutra. The claw swipes, talks, and books. You show up.",
  metadataBase: new URL(process.env.APP_URL || "https://clawmastura.com"),
  openGraph: {
    title: "Clawmasutra",
    description: "Your claw. Your dates. Your move.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
