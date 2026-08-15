import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1e3f7a",
          "navy-mid": "#15305f",
          "navy-dark": "#0e2347",
          gold: "#c6a253",
          "gold-light": "#d9bd74",
          "gold-dark": "#b8862f",
          emerald: "#26a06c",
          "emerald-dark": "#1f8a5b",
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
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        serif: ["var(--font-newsreader)", "Georgia", "serif"],
        display: ["var(--font-newsreader)", "Georgia", "serif"],
        arabic: ["var(--font-amiri)", "serif"],
        calligraphy: ["var(--font-ruqaa)", "var(--font-amiri)", "serif"],
      },
      borderRadius: {
        card: "16px",
        "card-lg": "20px",
        pill: "20px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(20,24,35,.04)",
        "card-hover": "0 4px 16px rgba(20,24,35,.10)",
        dark: "0 8px 32px rgba(10,15,30,.35)",
      },
    },
  },
  plugins: [],
};

export default config;
