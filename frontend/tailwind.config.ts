import type { Config } from "tailwindcss";

const status = (n: string) => ({
  DEFAULT: `var(--${n}-fg)`,
  fg: `var(--${n}-fg)`,
  bg: `var(--${n}-bg)`,
  bd: `var(--${n}-bd)`,
});

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // dark: explicit [data-theme=dark], or the system preference unless the user picked light
  darkMode: ["variant", ['&:is([data-theme="dark"] *)', '@media (prefers-color-scheme: dark) { &:not([data-theme="light"] *) }']],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: { DEFAULT: "var(--surface)", 2: "var(--surface-2)" },
        border: "var(--border)",
        text: { DEFAULT: "var(--text)", 2: "var(--text-2)", 3: "var(--text-3)" },
        accent: { DEFAULT: "var(--accent)", soft: "var(--accent-soft)" },
        blocker: status("blocker"),
        high: status("high"),
        medium: status("medium"),
        evidence: status("evidence"),
        uncertain: status("uncertain"),
        satisfied: status("satisfied"),
        na: status("na"),
        counsel: status("counsel"),
      },
      fontFamily: {
        sans: ['"Geist"', "system-ui", "-apple-system", '"Segoe UI"', "sans-serif"],
        law: ['"Source Serif 4"', "Georgia", '"Times New Roman"', "serif"],
        mono: ['"Geist Mono"', "ui-monospace", '"SF Mono"', "Menlo", "monospace"],
      },
      fontSize: {
        xs: ["12px", { lineHeight: "16px", fontWeight: "500" }],
        sm: ["13px", "20px"],
        base: ["14px", "22px"],
        lg: ["16px", { lineHeight: "24px", fontWeight: "600" }],
        xl: ["20px", { lineHeight: "28px", fontWeight: "600", letterSpacing: "-0.01em" }],
        "2xl": ["28px", { lineHeight: "34px", fontWeight: "600", letterSpacing: "-0.01em" }],
        gate: ["40px", { lineHeight: "44px", fontWeight: "600", letterSpacing: "-0.02em" }],
        code: ["12.5px", "20px"],
      },
      // 6px cards, 4px chips (DESIGN §5)
      borderRadius: { sm: "4px", md: "6px", lg: "10px" },
      transitionTimingFunction: { DEFAULT: "cubic-bezier(.2,.7,.2,1)" },
      transitionDuration: { fast: "120ms", base: "200ms", slow: "320ms" },
      boxShadow: { overlay: "var(--shadow-overlay)" },
      keyframes: {
        flash: { "0%": { backgroundColor: "var(--accent-soft)" }, "100%": { backgroundColor: "transparent" } },
        pulse2: { "0%,100%": { opacity: "1" }, "50%": { opacity: ".45" } },
      },
      animation: { flash: "flash 600ms cubic-bezier(.2,.7,.2,1)", pulse2: "pulse2 1.2s ease-in-out infinite" },
    },
  },
  plugins: [],
} satisfies Config;
