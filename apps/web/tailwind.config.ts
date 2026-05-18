import type { Config } from 'tailwindcss'

/**
 * Tailwind config — KOVAS Glassmorphism Premium Soft UI
 * Cf. CLAUDE.md §9 pour la palette complète + règles strictes
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', '../../packages/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Light palette
        background: 'hsl(var(--background))', // #F4F4F5
        card: 'hsl(var(--card))', // #FFFFFF
        foreground: 'hsl(var(--foreground))', // #0A0A0A
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))', // #404040
        },
        subtle: {
          DEFAULT: 'hsl(var(--subtle))',
          foreground: 'hsl(var(--subtle-foreground))', // #737373
        },
        border: 'hsl(var(--border))', // #D4D4D8
        cta: {
          DEFAULT: 'hsl(var(--cta))', // #0A0A0A
          hover: 'hsl(var(--cta-hover))', // #262626
          foreground: 'hsl(var(--cta-foreground))', // #FAFAFA
        },
        // Accents délavés (pills/badges seulement)
        accent: {
          blue: 'hsl(var(--accent-blue))', // #7B96C4
          red: 'hsl(var(--accent-red))', // #C46969
          green: 'hsl(var(--accent-green))', // #8AB57B
          orange: 'hsl(var(--accent-orange))', // #D4A574
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
  plugins: [],
}

export default config
