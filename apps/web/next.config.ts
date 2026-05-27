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
  // unpkg.com : CDN Leaflet (JS) sur les fiches diagnostiqueurs publiques
  // (zone d'intervention). Pas de dep npm pour rester léger sur le bundle.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.vercel-insights.com https://unpkg.com",
  // unpkg.com : CSS Leaflet associé au script ci-dessus.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  "font-src 'self' https://fonts.gstatic.com",
  // Tuiles cartographiques :
  //   - tile.openstreetmap.org : fallback historique.
  //   - basemaps.cartocdn.com  : tile layer CartoDB Positron (style sage clair
  //     cohérent DS v5, utilisé par DiagMap depuis 2026-05-27).
  // unpkg.com : images de l'asset Leaflet (markers PNG legacy, au cas où).
  "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com https://unpkg.com",
  // media-src : blob: requis pour la réécoute des messages vocaux (MediaRecorder
  // produit des blob: URLs). Sans ça, <audio src='blob:...'> renvoie
  // NotSupportedError (default-src 'self' rejette).
  "media-src 'self' blob: https://*.supabase.co",
  // wss:// requis pour Supabase Realtime (préférences sidebar, etc.)
  "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://api.anthropic.com https://api.groq.com https://api.stripe.com https://api.brevo.com https://*.vercel-insights.com https://app.dvf.etalab.gouv.fr https://geo.api.gouv.fr https://api-adresse.data.gouv.fr https://data.ademe.fr",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
  // CSP violation reporting (endpoint /api/security/csp-report).
  // report-uri : legacy (Firefox/Safari), report-to : moderne (Chrome).
  'report-uri /api/security/csp-report',
  'report-to csp-endpoint',
].join('; ')

/**
 * Report-To groupe pour les violations CSP modernes (Chrome/Edge).
 * Référence un endpoint POST qui log dans Sentry.
 */
const REPORT_TO_HEADER = JSON.stringify({
  group: 'csp-endpoint',
  max_age: 10886400,
  endpoints: [{ url: '/api/security/csp-report' }],
  include_subdomains: true,
})

/**
 * Security headers appliqués à toutes les routes.
 * Cf. docs/SECURITY.md > "Headers HTTP appliqués".
 *
 * Cross-Origin isolation :
 * - COOP same-origin : isole le browsing context (anti Spectre + window.opener leaks)
 * - COEP credentialless : autorise les ressources cross-origin sans CORS si elles
 *   sont chargées sans credentials (mode permissif vs require-corp). Si régression
 *   constatée (images tiers cassées : tuiles OSM, avatars, etc.), basculer sur
 *   'unsafe-none' (désactive l'isolation mais aucune régression possible).
 *   Décision Benjamin requise post-monitoring 7j.
 * - CORP same-site : empêche les autres sites de charger nos ressources.
 */
const SECURITY_HEADERS = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // X-Frame-Options DENY : cohérent avec frame-ancestors 'none' dans la CSP.
  // KOVAS n'est jamais embarqué (anti-clickjacking).
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=(self), payment=(self)',
  },
  // Cross-Origin isolation (cf. commentaire ci-dessus).
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  // Report-To groupe utilisé par la directive CSP report-to.
  { key: 'Report-To', value: REPORT_TO_HEADER },
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  transpilePackages: ['@kovas/shared', '@kovas/database', '@kovas/ai', '@kovas/liciel-bridge'],
  // ─── B99 — Whisper local WASM via @xenova/transformers ────────────────
  // La lib embarque `onnxruntime-node` (binaire Node-only) et `sharp`
  // (image processing) qui ne doivent JAMAIS finir dans le bundle client.
  // L'option `serverExternalPackages` les marque comme externals serveur
  // pour les Server Actions / Route Handlers (sinon Vercel timeout deploy
  // sur l'analyse du .so).
  serverExternalPackages: ['@xenova/transformers', 'sharp', 'onnxruntime-node'],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Côté client : alias false sur les binaires Node-only que
      // @xenova/transformers conditionnellement require. Sans ça, webpack
      // tente de bundler le .node natif → erreur résolution module.
      config.resolve = config.resolve ?? {}
      config.resolve.alias = {
        ...(typeof config.resolve.alias === 'object' && config.resolve.alias !== null
          ? config.resolve.alias
          : {}),
        'onnxruntime-node$': false,
        sharp$: false,
      }
    }
    return config
  },
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
      // Fusion /dashboard/upgrade/{annuaire,logiciel,bundle} → /dashboard/decouvrir
      // (page dynamique unifiee avec algorithme d'intention d'achat).
      {
        source: '/dashboard/upgrade/annuaire',
        destination: '/dashboard/decouvrir',
        permanent: true,
      },
      {
        source: '/dashboard/upgrade/logiciel',
        destination: '/dashboard/decouvrir',
        permanent: true,
      },
      { source: '/dashboard/upgrade/bundle', destination: '/dashboard/decouvrir', permanent: true },
      { source: '/dashboard/upgrade', destination: '/dashboard/decouvrir', permanent: true },
      // B2B canonique : /pros remplace /pour-les-diagnostiqueurs (Lot #142).
      { source: '/pour-les-diagnostiqueurs', destination: '/pros', permanent: true },
      { source: '/pour-les-diagnostiqueurs/:path*', destination: '/pros/:path*', permanent: true },
      // SEO intent transactionnel (FIX-T) : /diagnostiqueurs → /trouver-un-diagnostiqueur
      // (slug long-tail action ciblant la requête « trouver un diagnostiqueur DPE »,
      // 14k recherches/mois SEMrush FR). Préserve le link juice via 301 permanent.
      { source: '/diagnostiqueurs', destination: '/trouver-un-diagnostiqueur', permanent: true },
      {
        source: '/diagnostiqueurs/:path*',
        destination: '/trouver-un-diagnostiqueur/:path*',
        permanent: true,
      },
      // Sitemap segment rename (cohérent avec rename racine).
      {
        source: '/sitemap-diagnostiqueurs.xml',
        destination: '/sitemap-trouver-un-diagnostiqueur.xml',
        permanent: true,
      },
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
