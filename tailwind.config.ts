import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#12172B",        // deep navy — dark surface / hero numerals
        paper: "#FAF7F0",      // warm paper — light surface
        marigold: "#F2A93B",   // primary accent — exam energy
        teal: "#3FA796",       // success / accuracy
        coral: "#E4572E",      // streak-break / negative marking
        slate: "#8A93A6",      // muted secondary text
        "ink-100": "#1C2340",
        "ink-50": "#232B4D",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        ticket: "12px",
      },
    },
  },
  plugins: [],
};
export default config;
