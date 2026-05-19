import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * Tailwind — KOVAS Design System v3 (2026-05-19)
 * Cream dominant · Navy KOVAS · Cyan liquide signature · Ambre accent · Pastels mist
 * Typo : Urbanist (UI) + Instrument Serif italic + JetBrains Mono
 * Réf. : docs/design/KOVAS_UIUX_Design_v3.pdf + CLAUDE.md §9
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', '../../packages/*/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-urbanist)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        paper: 'hsl(var(--paper) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          accent: 'hsl(var(--card-accent) / <alpha-value>)',
          'accent-foreground': 'hsl(var(--card-accent-foreground) / <alpha-value>)',
        },
        cream: {
          DEFAULT: 'hsl(var(--background) / <alpha-value>)',
          deep: 'hsl(var(--cream-deep) / <alpha-value>)',
        },
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        ink: {
          DEFAULT: 'hsl(var(--foreground) / <alpha-value>)',
          soft: 'hsl(var(--ink-soft) / <alpha-value>)',
          mute: 'hsl(var(--muted-foreground) / <alpha-value>)',
          faint: 'hsl(var(--subtle-foreground) / <alpha-value>)',
          ghost: 'hsl(var(--ink-ghost) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        subtle: {
          DEFAULT: 'hsl(var(--subtle) / <alpha-value>)',
          foreground: 'hsl(var(--subtle-foreground) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'hsl(var(--border) / <alpha-value>)',
          soft: 'hsl(var(--border-soft) / <alpha-value>)',
        },
        cta: {
          DEFAULT: 'hsl(var(--cta) / <alpha-value>)',
          hover: 'hsl(var(--cta-hover) / <alpha-value>)',
          foreground: 'hsl(var(--cta-foreground) / <alpha-value>)',
        },
        navy: {
          DEFAULT: 'hsl(var(--navy-primary) / <alpha-value>)',
          primary: 'hsl(var(--navy-primary) / <alpha-value>)',
          deep: 'hsl(var(--navy-deep) / <alpha-value>)',
          soft: 'hsl(var(--navy-soft) / <alpha-value>)',
          mute: 'hsl(var(--navy-mute) / <alpha-value>)',
        },
        cyan: {
          deep: 'hsl(var(--cyan-deep) / <alpha-value>)',
          mid: 'hsl(var(--cyan-mid) / <alpha-value>)',
          light: 'hsl(var(--cyan-light) / <alpha-value>)',
        },
        accent: {
          warm: 'hsl(var(--accent-warm) / <alpha-value>)',
          'warm-soft': 'hsl(var(--accent-warm-soft) / <alpha-value>)',
          'warm-glow': 'hsl(var(--accent-warm-glow) / <alpha-value>)',
          'warm-foreground': 'hsl(var(--accent-warm-foreground) / <alpha-value>)',
          blue: 'hsl(var(--accent-blue) / <alpha-value>)',
          'blue-soft': 'hsl(var(--accent-blue-soft) / <alpha-value>)',
          green: 'hsl(var(--accent-green) / <alpha-value>)',
          'green-soft': 'hsl(var(--accent-green-soft) / <alpha-value>)',
          red: 'hsl(var(--accent-red) / <alpha-value>)',
          'red-soft': 'hsl(var(--accent-red-soft) / <alpha-value>)',
          orange: 'hsl(var(--accent-orange) / <alpha-value>)',
          'orange-soft': 'hsl(var(--accent-orange-soft) / <alpha-value>)',
          yellow: 'hsl(var(--accent-yellow) / <alpha-value>)',
        },
        pastel: {
          /* v3 mist (signature) */
          'blue-mist': 'hsl(var(--pastel-blue-mist) / <alpha-value>)',
          'orange-mist': 'hsl(var(--pastel-orange-mist) / <alpha-value>)',
          'lime-mist': 'hsl(var(--pastel-lime-mist) / <alpha-value>)',
          'coral-mist': 'hsl(var(--pastel-coral-mist) / <alpha-value>)',
          /* v2 conservés (alias MissionTypeTag) */
          butter: 'hsl(var(--pastel-butter) / <alpha-value>)',
          lime: 'hsl(var(--pastel-lime) / <alpha-value>)',
          peach: 'hsl(var(--pastel-peach) / <alpha-value>)',
          lavender: 'hsl(var(--pastel-lavender) / <alpha-value>)',
          sky: 'hsl(var(--pastel-sky) / <alpha-value>)',
        },
      },
      borderRadius: {
        /* v3 scale page 7 PDF */
        sm: '8px',    // R-SM 8 — inputs petits, tags
        md: '14px',   // R-MD 14 — inputs standards
        lg: '22px',   // R-LG 22 — cards intérieures
        xl: '32px',   // R-XL 32 — cards principales
        '2xl': '40px',
        pill: '999px',
      },
      backdropBlur: {
        md: '12px',
        xl: '20px',
      },
      boxShadow: {
        /* v3 shadows diffuses 4 niveaux */
        'glass-xs': '0 1px 2px hsl(207 47% 17% / 0.04)',
        'glass-sm': '0 2px 6px hsl(207 47% 17% / 0.06)',
        glass: '0 6px 18px hsl(207 47% 17% / 0.06), 0 2px 6px hsl(207 47% 17% / 0.04)',
        'glass-hover': '0 12px 28px hsl(207 47% 17% / 0.10), 0 2px 6px hsl(207 47% 17% / 0.04)',
        'glass-lg': '0 18px 40px hsl(207 47% 17% / 0.08), 0 4px 12px hsl(207 47% 17% / 0.04)',
        cta: '0 4px 16px hsl(207 47% 17% / 0.2)',
        'cta-hover': '0 6px 24px hsl(207 47% 17% / 0.28)',
        accent: '0 8px 24px hsl(207 47% 17% / 0.12)',
        warm: '0 4px 16px hsl(34 99% 47% / 0.22)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
