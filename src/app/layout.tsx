import type { Metadata } from "next";
import { Playfair_Display, Amiri, Aref_Ruqaa } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const playfair = Playfair_Display({
  weight: ["600", "700", "800", "900"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const amiri = Amiri({
  weight: ["400", "700"],
  subsets: ["arabic"],
  variable: "--font-amiri",
  display: "swap",
});

const arefRuqaa = Aref_Ruqaa({
  weight: ["400", "700"],
  subsets: ["arabic"],
  variable: "--font-ruqaa",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyDiiwaan — School Portal",
  description:
    "MyDiiwaan is a school management portal for Alberta curriculum schools serving the international and diaspora community.",
  icons: { icon: "/crest.jpg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${amiri.variable} ${arefRuqaa.variable}`} suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
