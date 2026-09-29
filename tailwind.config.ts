// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink, #0F172A)",
        paper: "var(--bg-paper, #F8F9FA)",
        surface: "var(--color-surface, #FFFFFF)",
        marigold: "#F59E0B",   // warm exam energy
        teal: "#0D9488",       // modern vibrant teal
        coral: "#EF4444",      // alerts & warnings
        slate: "var(--color-slate, #64748B)",
        "ink-100": "var(--color-ink-subtle, #1E293B)",
        "ink-50": "var(--color-surface-elevated, #243044)",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        ticket: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
