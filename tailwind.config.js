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
        display: ["-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        body: ["-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
