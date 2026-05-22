import { withSentryConfig } from '@sentry/nextjs'
import withSerwistInit from '@serwist/next'
import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: isDev,
})

/**
 * Content Security Policy — KOVAS App (Phase 1).
 *
 * Sources autorisées :
 *  - 'self' partout par défaut
 *  - script-src : Stripe.js + Vercel Insights ; 'unsafe-inline' + 'unsafe-eval' tolérés
 *    pour Next.js inline scripts et React DevTools en dev (à durcir en V2 via nonce)
 *  - connect-src : Supabase + Anthropic + Groq + Stripe + Brevo + Vercel + APIs publiques FR
 *  - frame-src : Stripe Checkout + webhooks
 *  - frame-ancestors 'none' : KOVAS n'est jamais embarqué (anti-clickjacking)
 *
 * Cf. docs/SECURITY.md pour la matrice complète.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.vercel-insights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://unpkg.com",
  "connect-src 'self' https://*.supabase.co https://api.anthropic.com https://api.groq.com https://api.stripe.com https://api.brevo.com https://*.vercel-insights.com https://app.dvf.etalab.gouv.fr https://geo.api.gouv.fr https://data.ademe.fr",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

/**
 * Security headers appliqués à toutes les routes.
 * Cf. docs/SECURITY.md > "Headers HTTP appliqués".
 */
const SECURITY_HEADERS = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=(self), payment=(self)',
  },
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  transpilePackages: ['@kovas/shared', '@kovas/database', '@kovas/ai', '@kovas/liciel-bridge'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  poweredByHeader: false,
  async redirects() {
    return [
      // Redirection 301 permanente : ancien préfixe authentifié /app/* → /dashboard/*
      // (rename Phase C pour clarifier que l'espace authentifié est le tableau de bord
      // dual track Annuaire + Logiciel).
      { source: '/app/:path*', destination: '/dashboard/:path*', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ]
  },
}

// En dev, bypass withSerwist : il injecte une config webpack qui déclenche un
// warning sous Turbopack alors qu'il n'a rien à faire (disable: true en dev).
const configWithSerwist = isDev ? nextConfig : withSerwist(nextConfig)

// Wrap Sentry : source maps upload + tunnel proxy + auto-instrumentation
// (uniquement si SENTRY_AUTH_TOKEN configuré, sinon no-op en dev/local).
export default withSentryConfig(configWithSerwist, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: '/monitoring',
  // Nouvelles APIs Sentry 9+ : options webpack regroupées sous `webpack`.
  webpack: {
    reactComponentAnnotation: { enabled: true },
    automaticVercelMonitors: true,
    treeshake: { removeDebugLogging: true },
  },
})
