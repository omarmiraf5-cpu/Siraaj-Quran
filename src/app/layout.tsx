import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Newsreader, Amiri, Aref_Ruqaa, Noto_Sans_Arabic } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import "./globals.css";

/* Loaded here rather than through an @import in globals.css. CSS ignores an
   @import that follows any other rule, and postcss inlines the 48 Mushaf
   @font-face rules ahead of it, so the import was dropped and every face on
   the site — Arabic included — fell back to a system font. next/font emits
   real @font-face rules and self-hosts the files, so there is no ordering to
   get wrong and no round trip to Google on first paint. */

const jakarta = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const newsreader = Newsreader({
  weight: ["500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-newsreader",
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

// A UI-weight Arabic sans, distinct from Amiri/Aref Ruqaa above — those two
// are literary/Quranic display faces, right for the calligraphic verses and
// quotes they're already used for, wrong for a button label at 13px. Added
// to the `sans` stack's fallback chain in tailwind.config.ts rather than
// applied with its own class, so Arabic UI text picks it up automatically
// wherever the app already uses font-sans (the default), with no per-string
// dir-checking needed.
const notoSansArabic = Noto_Sans_Arabic({
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic"],
  variable: "--font-noto-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MyDiiwaan — Quran School Portal",
  description:
    "MyDiiwaan is a Quranic school management portal featuring Tajweed color coding, assignments, and progress tracking.",
  icons: { icon: "/crest.jpg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${newsreader.variable} ${amiri.variable} ${arefRuqaa.variable} ${notoSansArabic.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen">
        <ThemeProvider>
          <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
