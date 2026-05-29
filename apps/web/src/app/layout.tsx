import { AddToHomeScreen } from '@/components/add-to-home-screen'
import { CookieConsentProvider } from '@/components/cookies/CookieConsentProvider'
import { QueryProvider } from '@/components/query-provider'
import { JsonLd } from '@/components/seo/JsonLd'
import { ToastProvider } from '@/components/shared/Toast'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { buildOrganizationSchema, buildWebSiteSchema } from '@/lib/seo/schema-org'
import type { Metadata, Viewport } from 'next'
import { instrumentSerif, jetbrainsMono, urbanist } from './fonts'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'KOVAS — Diagnostic immobilier IA',
    template: '%s | KOVAS',
  },
  description:
    "L'app iPad qui transforme 3h de DPE en 30 minutes. Couche terrain compagnon de Liciel, OBBC et AnalysImmo — IA-first.",
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KOVAS',
    startupImage: '/icons/apple-touch-icon.png',
  },
  formatDetection: { telephone: false, email: false, address: false },
  applicationName: 'KOVAS',
  authors: [{ name: 'Benjamin Bel', url: 'https://kovas.fr' }],
  generator: 'Next.js',
  keywords: [
    'diagnostic immobilier',
    'DPE',
    'iPad',
    'Liciel',
    'OBBC',
    'AnalysImmo',
    'amiante',
    'plomb',
  ],
  metadataBase: new URL('https://kovas.fr'),
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://kovas.fr',
    siteName: 'KOVAS',
    title: 'KOVAS — Diagnostic immobilier IA',
    description: "L'app iPad qui transforme 3h de DPE en 30 minutes",
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'KOVAS — Diagnostic immobilier IA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KOVAS — Diagnostic immobilier IA',
    description:
      "L'app iPad qui transforme 3h de DPE en 30 minutes. Couche terrain compagnon de Liciel, OBBC et AnalysImmo — IA-first.",
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://kovas.fr',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F6F0' },
    { media: '(prefers-color-scheme: dark)', color: '#0B1D2E' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

/**
 * Resource hints CWV (B95) — proactive DNS/TLS handshake pour les domaines
 * critiques sollicités dans les 100 premières ms post-hydratation.
 *
 *  - Supabase (data lake) : preconnect TLS car fetch SSR `getPublicStats`
 *    / `getObservatoireStats` part dans le RSC render. URL lue depuis
 *    `NEXT_PUBLIC_SUPABASE_URL` (env publique côté client safe) avec fallback
 *    statique pour le build CI sans secrets.
 *  - Stripe.js : dns-prefetch only (pas de preconnect car Stripe.js n'est
 *    chargé qu'au clic CTA signup, pas globalement). Évite un DNS roundtrip
 *    de 30-80 ms à la conversion essai 30 jours.
 *
 * Ne PAS ajouter de preconnect vers `fonts.googleapis.com` ni
 * `fonts.gstatic.com` — `next/font/google` self-host les fonts au build
 * (zéro requête tierce, pas besoin de hints).
 */
const SUPABASE_PRECONNECT_URL = (() => {
  const fromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (fromEnv?.startsWith('https://')) {
    try {
      return new URL(fromEnv).origin
    } catch {
      return 'https://kovas.supabase.co'
    }
  }
  return 'https://kovas.supabase.co'
})()

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${urbanist.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <link rel="preconnect" href={SUPABASE_PRECONNECT_URL} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://js.stripe.com" />
      </head>
      <body className="font-display antialiased">
        <JsonLd id="root-org-website" data={[buildOrganizationSchema(), buildWebSiteSchema()]} />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <QueryProvider>
            <ToastProvider>
              {children}
              <AddToHomeScreen />
              <Toaster />
              {/* Bandeau cookies CNIL — masqué sur /dashboard/* et /admin/*
                  (consent implicite via CGU). Init conditionnelle PostHog
                  + Sentry session replay selon préférences utilisateur. */}
              <CookieConsentProvider />
            </ToastProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
