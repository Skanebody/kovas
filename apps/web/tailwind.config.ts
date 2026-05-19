import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * Tailwind — KOVAS Ron Design Lab (produit) × Tectra
 * Outfit UI · Instrument Serif KPIs · crème + cobalt + jaune
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', '../../packages/*/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-outfit)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-instrument-serif)', 'Georgia', 'serif'],
      },
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          accent: 'hsl(var(--card-accent) / <alpha-value>)',
          'accent-foreground': 'hsl(var(--card-accent-foreground) / <alpha-value>)',
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
          yellow: 'hsl(var(--accent-yellow) / <alpha-value>)',
          red: 'hsl(var(--accent-red) / <alpha-value>)',
          green: 'hsl(var(--accent-green) / <alpha-value>)',
          orange: 'hsl(var(--accent-orange) / <alpha-value>)',
        },
      },
      borderRadius: {
        sm: '0.375rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        pill: '100px',
      },
      backdropBlur: {
        md: '12px',
        xl: '20px',
      },
      boxShadow: {
        glass: '0 8px 24px hsl(var(--foreground) / 0.06), 0 1px 2px hsl(var(--foreground) / 0.04)',
        'glass-hover':
          '0 12px 32px hsl(var(--foreground) / 0.08), 0 2px 4px hsl(var(--foreground) / 0.04)',
        cta: '0 4px 16px hsl(var(--cta) / 0.22)',
        'cta-hover': '0 6px 24px hsl(var(--cta) / 0.28)',
        accent: '0 8px 24px hsl(var(--cta) / 0.12)',
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
