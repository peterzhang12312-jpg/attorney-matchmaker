/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Geist",
          "-apple-system",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "Geist Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      colors: {
        navy: {
          900: "#0f172a",
          800: "#1e293b",
        },
        ios: {
          blue: "#FCAA2D",
        },
        accent: "#FCAA2D",
        ink: "#191918",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseGreen: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        "fade-in": "fadeIn 0.35s ease-out",
        "pulse-green": "pulseGreen 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
