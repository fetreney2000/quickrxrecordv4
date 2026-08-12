import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        success: {
          DEFAULT: "var(--success)",
          foreground: "var(--success-foreground)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          foreground: "var(--warning-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          accent: "var(--sidebar-accent)",
          border: "var(--sidebar-border)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "Roboto",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "contentOrb1": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(30px, -20px)" },
        },
        "contentOrb2": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(-25px, 15px)" },
        },
        "contentOrb3": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(20px, 25px)" },
        },
        "sidebarOrbFloat1": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(20px, -30px) scale(1.05)" },
        },
        "sidebarOrbFloat2": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-15px, 20px) scale(1.03)" },
        },
        "sidebarOrbFloat3": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(25px, -10px) scale(1.04)" },
        },
        "headerOrbFloat1": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(15px, 8px)" },
        },
        "headerOrbFloat2": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(-12px, 10px)" },
        },
        "headerOrbFloat3": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(8px, -12px)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "count-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fadeIn 0.5s ease-out forwards",
        "slide-up": "slideUp 0.5s ease-out forwards",
        "slide-down": "slideDown 0.3s ease-out forwards",
        "slide-in-right": "slideInRight 0.4s ease-out forwards",
        "slide-in-left": "slideInLeft 0.4s ease-out forwards",
        "scale-in": "scaleIn 0.3s ease-out forwards",
        "content-orb-1": "contentOrb1 20s ease-in-out infinite",
        "content-orb-2": "contentOrb2 25s ease-in-out infinite",
        "content-orb-3": "contentOrb3 18s ease-in-out infinite",
        "sidebar-orb-1": "sidebarOrbFloat1 20s ease-in-out infinite",
        "sidebar-orb-2": "sidebarOrbFloat2 25s ease-in-out infinite",
        "sidebar-orb-3": "sidebarOrbFloat3 18s ease-in-out infinite",
        "header-orb-1": "headerOrbFloat1 12s ease-in-out infinite",
        "header-orb-2": "headerOrbFloat2 15s ease-in-out infinite",
        "header-orb-3": "headerOrbFloat3 18s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "count-up": "count-up 0.6s ease-out forwards",
        "gradient-x": "gradient-x 8s ease infinite",
        shimmer: "shimmer 1.5s infinite linear",
      },
      backgroundImage: {
        "gradient-primary": "var(--gradient-primary)",
        "gradient-success": "var(--gradient-success)",
        "gradient-warning": "var(--gradient-warning)",
        "gradient-danger": "var(--gradient-danger)",
        "gradient-purple": "var(--gradient-purple)",
        "gradient-card": "var(--gradient-card)",
        "gradient-header":
          "linear-gradient(90deg, rgba(24,119,242,0.03) 0%, rgba(124,58,237,0.02) 50%, rgba(6,182,212,0.02) 100%)",
        "gradient-sidebar":
          "linear-gradient(180deg, #0c1329 0%, #0a0e27 50%, #0d1117 100%)",
        "gradient-mobile-nav":
          "linear-gradient(180deg, rgba(12,16,42,0.98) 0%, rgba(10,14,35,1) 100%)",
      },
      boxShadow: {
        "card": "var(--shadow-card)",
        "card-hover": "var(--shadow-card-hover)",
        "dropdown": "var(--shadow-dropdown)",
        "sidebar": "4px 0 24px rgba(0,0,0,0.2)",
        "header": "0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "mobile-nav": "0 -4px 24px rgba(0,0,0,0.3)",
      },
      fontSize: {
        "2xs": ["0.75rem", { lineHeight: "1rem" }],
        xs: ["0.8125rem", { lineHeight: "1.125rem" }],
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],
        base: ["1rem", { lineHeight: "1.625rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.375rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.625rem", { lineHeight: "2rem" }],
        "3xl": ["2rem", { lineHeight: "2.5rem" }],
        "4xl": ["2.5rem", { lineHeight: "3rem" }],
        "5xl": ["3.25rem", { lineHeight: "3.75rem" }],
        "6xl": ["4rem", { lineHeight: "4.25rem" }],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
