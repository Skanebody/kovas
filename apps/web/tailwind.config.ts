import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

/** KOVAS Design System v3 — kovas-design-system.mdc */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', '../../packages/*/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-display)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        /* === v5 piliers (3) — sage / navy-deep / chartreuse === */
        navy: {
          /* v5 5 niveaux canoniques #0F2436/#163144/#1B405B/#2A5478/#3B6995 */
          900: '#0F2436',
          800: '#163144',
          700: '#1B405B',
          600: '#2A5478',
          500: '#3B6995',
          /* Rétrocompat v3 — aliases */
          DEFAULT: '#163144',
          deep: '#0B1D2E',
          soft: '#2C4A63',
          mute: '#475F77',
          hover: '#0B1D2E',
        },
        /* v5 sidebar/navy-deep Synthex #0F1419 noir bleuté */
        'navy-deep': '#0F1419',
        cyan: {
          deep: '#4E8FA8',
          mid: '#7FB5C7',
          light: '#DFF3EB',
        },
        amber: { DEFAULT: '#D97706' },
        /* v5 accent unique chartreuse Synthex (signature) — USAGE STRICT
         * Réservé exclusivement à : badge "Actif/En direct" · underline tab actif ·
         * validation IA confirmée · CTA conversion principale · dot notification.
         * JAMAIS pour : fonds larges, textes permanents, bordures container,
         * séparateurs, gradients. */
        chartreuse: {
          DEFAULT: '#D4F542',
          soft: '#F4FAD9',
          deep: '#A3C920',
        },
        paper: '#FFFFFF',
        /* v5 sage pâle remplace cream Ron sur l'app prod.
         * Conventions addendum V5 finale (2026-05-22) :
         *   - sage flat hex pour utilisation directe (bg-sage, border-sage)
         *   - sage-alt pour les surfaces alternées
         *   - cream conservé en alias rétrocompat vers sage pour migration
         *     douce des 30+ fichiers legacy (bg-cream → rendu sage v5 sans
         *     toucher chaque fichier). */
        sage: '#F5F7F4',
        'sage-alt': '#EEF2F0',
        cream: { DEFAULT: '#F5F7F4', deep: '#EEF2F0' },
        /* v5 sidebar Synthex #0F1419 noir bleuté */
        'sidebar-bg': '#0F1419',
        rule: '#E7E2D2',
        ink: {
          DEFAULT: '#163144',
          soft: '#2C4A63',
          mute: '#5B7088',
          faint: '#8A99AE',
          ghost: '#B8C2D2',
        },
        'blue-mist': '#DBEAFE',
        'orange-mist': '#FFE5C9',
        'lime-mist': '#F0FBD5',
        'coral-mist': '#FCE3E1',
        success: '#16A66B',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
        /* v5 accent ambre saturé (alertes douces, énergie célébration). */
        'accent-warm': '#D97706',
        /* v5 status pills — 5 figés (amber/blue/green/coral/muted) */
        status: {
          amber: '#F59E0B',
          blue: '#3B82F6',
          green: '#16A66B',
          coral: '#FB7185',
          muted: '#94A3B8',
        },
        /* v5 diagnostic chips — 8 types canoniques (fonds pastel) */
        chip: {
          dpe: '#DBEAFE',
          amiante: '#FFE4C9',
          plomb: '#FECACA',
          gaz: '#ECFCCB',
          elec: '#DDD6FE',
          termites: '#FEF3C7',
          carrez: '#E0E7FF',
          erp: '#FCE7F3',
        },
        // HSL aliases (composants existants)
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        border: {
          DEFAULT: 'hsl(var(--border) / <alpha-value>)',
          soft: 'hsl(var(--border-soft) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        cta: {
          DEFAULT: 'hsl(var(--cta) / <alpha-value>)',
          hover: 'hsl(var(--cta-hover) / <alpha-value>)',
          foreground: 'hsl(var(--cta-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          accent: 'hsl(var(--card-accent) / <alpha-value>)',
          'accent-foreground': 'hsl(var(--card-accent-foreground) / <alpha-value>)',
        },
        accent: {
          blue: 'hsl(var(--accent-blue) / <alpha-value>)',
          'blue-soft': 'hsl(var(--accent-blue-soft) / <alpha-value>)',
          green: 'hsl(var(--accent-green) / <alpha-value>)',
          'green-soft': 'hsl(var(--accent-green-soft) / <alpha-value>)',
          red: 'hsl(var(--accent-red) / <alpha-value>)',
          'red-soft': 'hsl(var(--accent-red-soft) / <alpha-value>)',
          orange: 'hsl(var(--accent-orange) / <alpha-value>)',
          'orange-soft': 'hsl(var(--accent-orange-soft) / <alpha-value>)',
          warm: 'hsl(var(--accent-warm) / <alpha-value>)',
          'warm-soft': 'hsl(var(--accent-warm-soft) / <alpha-value>)',
          'warm-foreground': 'hsl(var(--accent-warm-foreground) / <alpha-value>)',
        },
        pastel: {
          butter: 'hsl(var(--pastel-butter) / <alpha-value>)',
          lime: 'hsl(var(--pastel-lime) / <alpha-value>)',
          peach: 'hsl(var(--pastel-peach) / <alpha-value>)',
          lavender: 'hsl(var(--pastel-lavender) / <alpha-value>)',
          sky: 'hsl(var(--pastel-sky) / <alpha-value>)',
          'blue-mist': '#DBEAFE',
          'orange-mist': '#FFE5C9',
          'lime-mist': '#F0FBD5',
          'coral-mist': '#FCE3E1',
        },
      },
      fontSize: {
        'display-xl': ['154px', { lineHeight: '0.9', letterSpacing: '-0.045em', fontWeight: '200' }],
        'display-l': ['84px', { lineHeight: '0.94', letterSpacing: '-0.035em', fontWeight: '300' }],
        'display-m': ['54px', { lineHeight: '1', letterSpacing: '-0.028em', fontWeight: '300' }],
        'display-s': ['34px', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '400' }],
        'kpi-xl': ['168px', { lineHeight: '0.85', letterSpacing: '-0.04em' }],
        'kpi-l': ['110px', { lineHeight: '0.9', letterSpacing: '-0.035em' }],
        'kpi-m': ['64px', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        'kpi-s': ['40px', { lineHeight: '1', letterSpacing: '-0.025em' }],
      },
      borderRadius: {
        sm: '8px',
        md: '14px',
        lg: '22px',
        xl: '32px',
        pill: '9999px',
      },
      boxShadow: {
        xs: '0 1px 3px rgba(22, 49, 68, 0.04)',
        sm: '0 3px 10px rgba(22, 49, 68, 0.06)',
        md: '0 8px 22px rgba(22, 49, 68, 0.08)',
        lg: '0 20px 50px rgba(22, 49, 68, 0.1)',
        glass: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 12px 36px rgba(22,49,68,0.10), 0 4px 12px rgba(22,49,68,0.06)',
        'glass-sm': '0 3px 10px rgba(22, 49, 68, 0.06)',
        'glass-hover': '0 12px 28px rgba(22, 49, 68, 0.10), 0 2px 6px rgba(22, 49, 68, 0.04)',
        cta: '0 6px 20px rgba(22, 49, 68, 0.18)',
        warm: '0 6px 18px rgba(217, 119, 6, 0.25)',
        accent: '0 16px 40px rgba(22, 49, 68, 0.25)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        fast: '150ms',
        base: '250ms',
        slow: '400ms',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        'progress-stripe': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '24px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 300ms ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'progress-stripe': 'progress-stripe 1.2s linear infinite',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
