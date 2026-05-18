import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/**
 * Tailwind config — KOVAS Glassmorphism Premium Soft UI
 * Cf. CLAUDE.md §9 pour la palette complète + règles strictes
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
        // Light palette — channel-based HSL pour permettre l'opacité (bg-color/50)
        background: 'hsl(var(--background) / <alpha-value>)', // #F4F4F5
        card: 'hsl(var(--card) / <alpha-value>)', // #FFFFFF
        foreground: 'hsl(var(--foreground) / <alpha-value>)', // #0A0A0A
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)', // #404040
        },
        subtle: {
          DEFAULT: 'hsl(var(--subtle) / <alpha-value>)',
          foreground: 'hsl(var(--subtle-foreground) / <alpha-value>)', // #737373
        },
        border: 'hsl(var(--border) / <alpha-value>)', // #D4D4D8
        cta: {
          DEFAULT: 'hsl(var(--cta) / <alpha-value>)', // #0A0A0A
          hover: 'hsl(var(--cta-hover) / <alpha-value>)', // #262626
          foreground: 'hsl(var(--cta-foreground) / <alpha-value>)', // #FAFAFA
        },
        // Accents délavés (pills/badges seulement)
        accent: {
          blue: 'hsl(var(--accent-blue) / <alpha-value>)', // #7B96C4
          red: 'hsl(var(--accent-red) / <alpha-value>)', // #C46969
          green: 'hsl(var(--accent-green) / <alpha-value>)', // #8AB57B
          orange: 'hsl(var(--accent-orange) / <alpha-value>)', // #D4A574
        },
      },
      borderRadius: {
        // Border-radius cohérents (cf. CLAUDE.md §9.4)
        sm: '0.375rem', // 6px
        md: '0.75rem', // 12px (boutons)
        lg: '1rem', // 16px
        xl: '1.5rem', // 24px (cartes)
        pill: '100px', // pills/badges
      },
      backdropBlur: {
        md: '12px', // Glassmorphism md (cf. CLAUDE.md §9.4)
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
