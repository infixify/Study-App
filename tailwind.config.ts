// tailwind.config.ts
import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme-aware semantic colors (switch automatically in dark mode)
        ink: "rgb(var(--text-primary) / <alpha-value>)",
        paper: "rgb(var(--bg-page) / <alpha-value>)",
        marigold: "#F59E0B",
        teal: { ...colors.teal, DEFAULT: "#0D9488" },
        coral: "#EF4444",
        slate: { ...colors.slate, DEFAULT: "#64748B" },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        ticket: "16px",
      },
    },
  },
  plugins: [],
};

export default config;
