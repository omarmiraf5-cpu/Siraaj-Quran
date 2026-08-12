import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Siraaj Quran — Quranic School Portal",
  description:
    "Siraaj Quran is a Quranic school management portal featuring Tajweed color coding, assignments, and progress tracking.",
  icons: { icon: "/crest.jpg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
