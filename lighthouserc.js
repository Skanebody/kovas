/**
 * Lighthouse CI — Couche 5 industrialisation qualité
 *
 * Audits perf + SEO + a11y + best-practices sur les pages publiques clés de kovas.fr.
 * Seuils stricts qui font échouer la CI dès qu'une régression dépasse les budgets.
 *
 * Pour lancer : `pnpm lighthouse` (depuis la racine) après `pnpm -F @kovas/web build`.
 *
 * URLs auditées (mises à jour B46 post-refonte) :
 *   - `/` (homepage 8 sections — Lot B35)
 *   - `/tarifs` (page tarifs V5 canonique — Lot B43)
 *   - `/pricing` (alias SEO legacy toujours en place)
 *   - `/trouver-un-diagnostiqueur/76/dieppe` (annuaire ville après FIX-T)
 *   - `/blog`, `/a-propos`, `/pour-les-diagnostiqueurs` (pages publiques marketing)
 *
 * En mode partiel : `LHCI_URLS_OVERRIDE=http://localhost:3000/tarifs pnpm lighthouse`.
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
        'http://localhost:3000/tarifs',
        'http://localhost:3000/pricing',
        'http://localhost:3000/trouver-un-diagnostiqueur/76/dieppe',
        'http://localhost:3000/blog',
        'http://localhost:3000/a-propos',
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
