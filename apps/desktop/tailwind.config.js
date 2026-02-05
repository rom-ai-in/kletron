/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,jsx,js}",
    "../../packages/ui/src/**/*.{ts,tsx,jsx,js}"
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
        focusRing: "var(--focus-ring)"
      },
      borderRadius: {
        none: "0",
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "9999px"
      },
      fontFamily: {
        display: ["-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        body: ["-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      }
    }
  },
  plugins: []
};
