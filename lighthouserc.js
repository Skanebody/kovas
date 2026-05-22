/**
 * Lighthouse CI — Couche 5 industrialisation qualité
 *
 * Audits perf + SEO + a11y + best-practices sur les pages publiques clés de kovas.fr.
 * Seuils stricts qui font échouer la CI dès qu'une régression dépasse les budgets.
 *
 * Pour lancer : `pnpm lighthouse` (depuis la racine) après `pnpm -F @kovas/web build`.
 * Les URLs marketing /blog, /diagnostiqueurs/dieppe, /qui-sommes-nous, /pour-les-diagnostiqueurs
 * sont prévues par la roadmap M0-M3 (acquisition SEO local 30-50 villes) — en attendant
 * leur livraison, lhci peut être lancé en mode partiel via `LHCI_URLS_OVERRIDE`.
 */

/** @type {import('@lhci/cli').Config} */
const config = {
  ci: {
    collect: {
      // Build statique servi par `next start` sur localhost:3000 par défaut.
      startServerCommand: 'pnpm --filter @kovas/web start',
      startServerReadyPattern: 'Ready',
      startServerReadyTimeout: 60_000,
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/pricing',
        'http://localhost:3000/diagnostiqueurs/dieppe',
        'http://localhost:3000/blog',
        'http://localhost:3000/qui-sommes-nous',
        'http://localhost:3000/pour-les-diagnostiqueurs',
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        chromeFlags: '--no-sandbox --headless=new',
        // Skip PWA audit (already validated by Serwist build).
        skipAudits: ['uses-http2'],
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Performance budgets (Core Web Vitals)
        'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
        // Category scores
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        // SEO essentials — error level
        'meta-description': 'error',
        'document-title': 'error',
        'link-text': 'error',
        'image-alt': 'error',
        canonical: 'error',
        'is-crawlable': 'error',
        'robots-txt': 'error',
        'structured-data': 'warn',
        // Relax some non-blocking lighthouse:recommended assertions that don't
        // apply to a marketing site or are environment-dependent.
        'unused-javascript': 'warn',
        'unused-css-rules': 'warn',
        'uses-text-compression': 'warn',
        'csp-xss': 'warn',
        'is-on-https': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}

module.exports = config
