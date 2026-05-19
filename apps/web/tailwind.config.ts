import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * Tailwind — KOVAS Design System v2 (2026-05-19)
 * Cream dominant · Navy primaire · Ambre accent chaud · Pastels catégoriels
 * Typo : Manrope (UI) + Instrument Serif italic (KPIs/accents) + JetBrains Mono (labels)
 * Réf. canonique : docs/design/kovas-design-system-v2.html
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', '../../packages/*/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
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
          DEFAULT: 'hsl(var(--cta) / <alpha-value>)',
          deep: 'hsl(var(--cta-hover) / <alpha-value>)',
          soft: 'hsl(var(--navy-soft) / <alpha-value>)',
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
          yellow: 'hsl(var(--accent-yellow) / <alpha-value>)',
          'yellow-soft': 'hsl(var(--accent-yellow-soft) / <alpha-value>)',
          orange: 'hsl(var(--accent-orange) / <alpha-value>)',
          'orange-soft': 'hsl(var(--accent-orange-soft) / <alpha-value>)',
        },
        pastel: {
          butter: 'hsl(var(--pastel-butter) / <alpha-value>)',
          lime: 'hsl(var(--pastel-lime) / <alpha-value>)',
          peach: 'hsl(var(--pastel-peach) / <alpha-value>)',
          lavender: 'hsl(var(--pastel-lavender) / <alpha-value>)',
          sky: 'hsl(var(--pastel-sky) / <alpha-value>)',
        },
      },
      borderRadius: {
        sm: '0.5rem',     // 8px — inputs petits
        md: '0.75rem',    // 12px — inputs standards
        lg: '1.125rem',   // 18px — cards intérieures
        xl: '1.5rem',     // 24px — cards principales
        '2xl': '2rem',    // 32px — hero / cards premium
        pill: '999px',    // pilules CTA, badges, status
      },
      backdropBlur: {
        md: '12px',
        xl: '20px',
      },
      boxShadow: {
        // Ombres signature Ron — neutres navy, 5 niveaux gradués
        'glass-xs': '0 1px 2px hsl(var(--foreground) / 0.04)',
        'glass-sm': '0 2px 6px hsl(var(--foreground) / 0.06)',
        glass: '0 6px 18px hsl(var(--foreground) / 0.06), 0 2px 6px hsl(var(--foreground) / 0.04)',
        'glass-lg': '0 18px 40px hsl(var(--foreground) / 0.08), 0 4px 12px hsl(var(--foreground) / 0.04)',
        'glass-hover': '0 12px 28px hsl(var(--foreground) / 0.10), 0 2px 6px hsl(var(--foreground) / 0.04)',
        cta: '0 4px 16px hsl(var(--cta) / 0.22)',
        'cta-hover': '0 6px 24px hsl(var(--cta) / 0.28)',
        accent: '0 8px 24px hsl(var(--cta) / 0.12)',
        warm: '0 4px 16px hsl(var(--accent-warm) / 0.22)',
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
        'fade-in': 'fade-in 0.3s ease',
        'pulse-soft': 'pulse-soft 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
