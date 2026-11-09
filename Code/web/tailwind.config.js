/** @type {import('tailwindcss').Config} */
// Brand colours are design references, not verified Penser brand values.
const navy = {
  50: "#EEF3F8", 100: "#D6E1EC", 200: "#AFC3D9", 300: "#7F9DBF", 400: "#4F77A3",
  500: "#2A5684", 600: "#1B4772", 700: "#123B65", 800: "#0E2F51", 900: "#0A233D",
};
const slate = {
  50: "#F8FAFC", 100: "#F1F5F9", 200: "#E2E8F0", 300: "#CBD5E1", 400: "#94A3B8",
  500: "#64748B", 600: "#475569", 700: "#334155", 800: "#1E293B", 900: "#0F172A",
};

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}"],
  theme: {
    transparent: "transparent",
    current: "currentColor",
    extend: {
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Helvetica Neue", "Arial", "system-ui", "sans-serif"],
      },
      colors: {
        navy,
        charcoal: "#333333",
        // Reserved for genuine warnings and errors. Use sparingly: never for decoration.
        accent: { DEFAULT: "#E53B45", soft: "#FDECEE", dark: "#B42831" },
        canvas: "#F5F7FA",
        // Chart series, one colour per measure on every chart (validated for colour-vision
        // deficiency on white, all pairs): baseline estimates, recorded incurred, final cost,
        // illustrative inflation.
        chart: { estimate: "#2F6299", incurred: "#A8772E", final: "#1A9583", illustrative: "#7E5BAA" },
        tremor: {
          brand: {
            faint: navy[50], muted: navy[200], subtle: navy[400],
            DEFAULT: navy[700], emphasis: navy[800], inverted: "#FFFFFF",
          },
          background: { muted: slate[50], subtle: slate[100], DEFAULT: "#FFFFFF", emphasis: slate[700] },
          border: { DEFAULT: slate[200] },
          ring: { DEFAULT: slate[200] },
          content: {
            subtle: slate[400], DEFAULT: slate[500], emphasis: "#333333", strong: "#1F2937", inverted: "#FFFFFF",
          },
        },
      },
      boxShadow: {
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card": "0 1px 2px 0 rgb(16 24 40 / 0.06), 0 1px 3px 0 rgb(16 24 40 / 0.06)",
        "tremor-dropdown": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
      borderRadius: { "tremor-small": "0.25rem", "tremor-default": "0.375rem", "tremor-full": "9999px" },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1rem", { lineHeight: "1.5rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },
      keyframes: {
        "panel-in": { from: { transform: "translateX(100%)" }, to: { transform: "translateX(0)" } },
      },
      animation: { "panel-in": "panel-in 180ms ease-out" },
    },
  },
  // Tremor chart colour classes are built at runtime from the colour names in
  // src/components/charts.ts, so they must be safelisted.
  safelist: [
    { pattern: /^(bg|fill|stroke|text|border)-chart-(estimate|incurred|final|illustrative)$/ },
  ],
  plugins: [],
};
