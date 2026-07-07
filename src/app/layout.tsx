import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://luxehavencollective.com"),
  title: {
    default: "Luxe Haven Collective | Boutique Short-Term Rental Hospitality",
    template: "%s | Luxe Haven Collective"
  },
  description: "Premium short-term rental stays, owner services, and hospitality management for elevated guest experiences and stronger property performance.",
  openGraph: {
    title: "Luxe Haven Collective",
    description: "Boutique STR hospitality for elevated stays and smarter owner performance.",
    url: "/",
    siteName: "Luxe Haven Collective",
    locale: "en_US",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${playfair.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
