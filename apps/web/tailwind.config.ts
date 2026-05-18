import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * Tailwind config — KOVAS Glassmorphism Premium Soft UI
 * Référence canonique : CLAUDE.md §9 + docs/design-system.md
 * Révision 2026-05-18 : navy KOVAS + accents vifs
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', '../../packages/*/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          accent: 'hsl(var(--card-accent) / <alpha-value>)',
        },
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        subtle: {
          DEFAULT: 'hsl(var(--subtle) / <alpha-value>)',
          foreground: 'hsl(var(--subtle-foreground) / <alpha-value>)',
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        cta: {
          DEFAULT: 'hsl(var(--cta) / <alpha-value>)',
          hover: 'hsl(var(--cta-hover) / <alpha-value>)',
          foreground: 'hsl(var(--cta-foreground) / <alpha-value>)',
        },
        accent: {
          blue: 'hsl(var(--accent-blue) / <alpha-value>)',
          red: 'hsl(var(--accent-red) / <alpha-value>)',
          green: 'hsl(var(--accent-green) / <alpha-value>)',
          orange: 'hsl(var(--accent-orange) / <alpha-value>)',
        },
      },
      borderRadius: {
        sm: '0.375rem', // 6px
        md: '0.75rem', // 12px (inputs, icon-buttons)
        lg: '1rem', // 16px (cards intérieures)
        xl: '1.25rem', // 20px (cards principales)
        '2xl': '1.5rem', // 24px (cards XL)
        pill: '100px', // pills/CTA/tabs/badges ronds
      },
      backdropBlur: {
        md: '12px',
        xl: '20px', // standard glassmorphism KOVAS
      },
      boxShadow: {
        // Doubles couches subtiles (cf. design-system.md)
        glass: '0 4px 24px hsl(var(--cta) / 0.04), 0 1px 2px hsl(var(--cta) / 0.02)',
        'glass-hover': '0 8px 32px hsl(var(--cta) / 0.08), 0 2px 4px hsl(var(--cta) / 0.04)',
        cta: '0 4px 16px hsl(var(--cta) / 0.2)',
        'cta-hover': '0 6px 24px hsl(var(--cta) / 0.3)',
        accent: '0 8px 24px hsl(var(--cta) / 0.15)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
