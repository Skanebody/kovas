import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/** KOVAS DS v1.0 — Ron Design Lab adapté (docs/design/kovas-design-system.html) */
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
        cream: {
          DEFAULT: 'hsl(var(--background) / <alpha-value>)',
          deep: 'hsl(var(--bg-gradient-to) / <alpha-value>)',
        },
        cta: {
          DEFAULT: 'hsl(var(--cta) / <alpha-value>)',
          hover: 'hsl(var(--cta-hover) / <alpha-value>)',
          foreground: 'hsl(var(--cta-foreground) / <alpha-value>)',
        },
        pastel: {
          butter: 'hsl(var(--pastel-butter) / <alpha-value>)',
          lime: 'hsl(var(--pastel-lime) / <alpha-value>)',
          peach: 'hsl(var(--pastel-peach) / <alpha-value>)',
          lavender: 'hsl(var(--pastel-lavender) / <alpha-value>)',
          sky: 'hsl(var(--pastel-sky) / <alpha-value>)',
        },
        accent: {
          blue: 'hsl(var(--accent-blue) / <alpha-value>)',
          'blue-soft': 'hsl(var(--accent-blue-soft) / <alpha-value>)',
          yellow: 'hsl(var(--accent-yellow) / <alpha-value>)',
          red: 'hsl(var(--accent-red) / <alpha-value>)',
          'red-soft': 'hsl(var(--accent-red-soft) / <alpha-value>)',
          green: 'hsl(var(--accent-green) / <alpha-value>)',
          'green-soft': 'hsl(var(--accent-green-soft) / <alpha-value>)',
          orange: 'hsl(var(--accent-orange) / <alpha-value>)',
          'orange-soft': 'hsl(var(--accent-orange-soft) / <alpha-value>)',
          warm: 'hsl(var(--accent-warm) / <alpha-value>)',
          'warm-soft': 'hsl(var(--accent-warm-soft) / <alpha-value>)',
          'warm-glow': 'hsl(var(--accent-warm-glow) / <alpha-value>)',
          'warm-foreground': 'hsl(var(--accent-warm-foreground) / <alpha-value>)',
        },
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '18px',
        xl: '24px',
        '2xl': '32px',
        pill: '999px',
      },
      boxShadow: {
        'glass-sm': '0 2px 6px hsl(218 60% 15% / 0.06)',
        glass: '0 6px 18px hsl(218 60% 15% / 0.06), 0 2px 6px hsl(218 60% 15% / 0.04)',
        'glass-hover': '0 12px 28px hsl(218 60% 15% / 0.10), 0 2px 6px hsl(218 60% 15% / 0.04)',
        cta: '0 4px 16px hsl(218 60% 15% / 0.2)',
        'cta-hover': '0 6px 24px hsl(218 60% 15% / 0.28)',
        accent: '0 8px 24px hsl(218 60% 15% / 0.12)',
        warm: '0 4px 16px hsl(32 95% 44% / 0.22)',
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
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
