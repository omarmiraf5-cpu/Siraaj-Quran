import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Newsreader, Amiri, Aref_Ruqaa, Noto_Sans_Arabic } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { NativeBridge } from "@/components/NativeBridge";
import { ToastProvider } from "@/components/motion-ui";
import { SITE_URL } from "@/lib/site";
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
  metadataBase: new URL(SITE_URL),
  title: "MyDiiwaan — Quran School Portal",
  description:
    "MyDiiwaan is a Quranic school management portal featuring Tajweed color coding, assignments, and progress tracking.",
  icons: { icon: "/crest.jpg" },
  alternates: { canonical: "/" },
};

// viewport-fit=cover lets the page draw under a phone's notch and home
// indicator, which is what makes env(safe-area-inset-*) report real values;
// the layout pads itself by those (globals.css, the status strip below, the
// mobile header and bottom bars). In a browser tab they are all 0.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#102A56",
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
        <svg width="0" height="0" className="absolute" aria-hidden>
          <defs>
            <linearGradient id="myd-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f0d48a" />
              <stop offset="46%" stopColor="#c4963c" />
              <stop offset="100%" stopColor="#6e4e16" />
            </linearGradient>
            <linearGradient id="myd-gold-rich" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#ffe7a8" />
              <stop offset="40%" stopColor="#e0b04a" />
              <stop offset="100%" stopColor="#7a5414" />
            </linearGradient>
          </defs>
        </svg>
        {/* Behind the phone's status bar: in the app the page starts below
            it, and this keeps the strip the portal's navy in either theme. */}
        <div aria-hidden className="status-bar-strip" />
        <NativeBridge />
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>{children}</ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
