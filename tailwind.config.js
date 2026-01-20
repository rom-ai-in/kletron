/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#38bdf8", 500: "#38bdf8" },
        accent: "#22d3ee",
      },
      fontFamily: {
        display: ["var(--font-sans)", "Space Grotesk", "sans-serif"],
        body: ["var(--font-sans)", "Space Grotesk", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
