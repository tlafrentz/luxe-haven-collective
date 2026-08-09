import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Geist,
  Inter,
  Lato,
  Merriweather,
  Montserrat,
  Playfair_Display,
  Source_Sans_3,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-serif", subsets: ["latin"] });
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-cormorant-garamond",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
});
const sourceSans3 = Source_Sans_3({
  variable: "--font-source-sans-3",
  subsets: ["latin"],
});
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});
const lato = Lato({
  variable: "--font-lato",
  weight: ["400", "700"],
  subsets: ["latin"],
});
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

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
    <html lang="en" data-theme="system">
      <body
        className={`${geistSans.variable} ${playfair.variable} ${cormorantGaramond.variable} ${merriweather.variable} ${sourceSans3.variable} ${montserrat.variable} ${lato.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
