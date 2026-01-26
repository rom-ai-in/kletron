/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx,jsx,js}",
    "./src/**/*.{ts,tsx,jsx,js}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          app: "var(--bg-app)",
          surface: "var(--bg-surface)",
          elevated: "var(--bg-elevated)"
        },
        border: {
          subtle: "var(--border-subtle)",
          strong: "var(--border-strong)"
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)"
        },
        state: {
          hover: "var(--state-hover)",
          active: "var(--state-active)",
          selected: "var(--state-selected)"
        },
        focusRing: "var(--focus-ring)",
      },
      borderRadius: {
        none: "0",
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "9999px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.25)",
        DEFAULT: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.25)",
        xl: "0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.25)",
        none: "none",
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
