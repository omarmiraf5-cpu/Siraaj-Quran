import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#102A56",
          "navy-mid": "#0d2348",
          "navy-dark": "#0a1c3a",
          gold: "#c6a15a",
          "gold-light": "#e6cd8a",
          "gold-dark": "#8a6424",
          emerald: "#0e7a48",
          "emerald-dark": "#0c643c",
        },
        attend: {
          present: "var(--attend-present)",
          "present-ink": "var(--attend-present-ink)",
          "present-bg": "var(--attend-present-bg)",
          late: "var(--attend-late)",
          "late-ink": "var(--attend-late-ink)",
          "late-bg": "var(--attend-late-bg)",
          absent: "var(--attend-absent)",
          "absent-ink": "var(--attend-absent-ink)",
          "absent-bg": "var(--attend-absent-bg)",
          excused: "var(--attend-excused)",
          "excused-ink": "var(--attend-excused-ink)",
          "excused-bg": "var(--attend-excused-bg)",
        },
        ink: {
          DEFAULT: "var(--c-ink)",
          body: "var(--c-ink-body)",
          muted: "var(--c-ink-muted)",
          "muted-2": "var(--c-ink-muted-2)",
        },
        surface: {
          bg: "var(--c-surface-bg)",
          "bg-warm": "var(--c-surface-bg-warm)",
          card: "var(--c-surface-card)",
          border: "var(--c-surface-border)",
        },
        status: {
          "success-text": "#1f8a5b",
          "success-bg": "#eaf4ee",
          "warning-text": "#b8862f",
          "warning-bg": "#f7f0dd",
          "error-text": "#c15242",
          "error-bg": "#fbeeeb",
          "info-text": "#4a5b86",
          "info-bg": "#eceef4",
        },
        subject: {
          purple: "#6c5ce7",
          teal: "#00b894",
          orange: "#ff8a3d",
          blue: "#3d9dff",
          pink: "#ff5e8a",
        },
        // Illumination palette — the colours a Qur'anic manuscript is
        // decorated with: lapis, verdigris, saffron, vermilion, aubergine.
        // The student portal wants to be colourful, and these are bright
        // without being the default Tailwind primaries, so they sit on the
        // cream ground and beside the gold instead of shouting over them.
        illum: {
          lapis: "#2f5ea8",
          turquoise: "#1f8b9b",
          verdigris: "#1f8a6d",
          saffron: "#d2941f",
          vermilion: "#c4553c",
          aubergine: "#834272",
        },
      },
      fontFamily: {
        // Jakarta has no Arabic glyphs, so Arabic UI text (nav labels, form
        // fields, buttons under the ar language setting) falls through to
        // Noto Sans Arabic automatically — a UI-weight face, not the
        // literary/Quranic ones below, which stay reserved for verses and
        // display quotes.
        sans: ["var(--font-jakarta)", "var(--font-noto-arabic)", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "var(--font-amiri)", "var(--font-noto-arabic)", "Georgia", "serif"],
        display: ["var(--font-newsreader)", "var(--font-amiri)", "var(--font-noto-arabic)", "Georgia", "serif"],
        arabic: ["var(--font-amiri)", "serif"],
        calligraphy: ["var(--font-ruqaa)", "var(--font-amiri)", "serif"],
      },
      borderRadius: {
        card: "14px",
        "card-lg": "20px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,35,71,.05), 0 8px 24px -16px rgba(14,35,71,.18)",
        "card-hover": "0 10px 28px -14px rgba(14,35,71,.22)",
        dark: "0 16px 40px -18px rgba(8,16,36,.55)",
        e1: "0 1px 2px rgba(14,35,71,.06)",
        e2: "0 8px 24px -14px rgba(14,35,71,.18)",
        e3: "0 18px 40px -20px rgba(14,35,71,.28)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
