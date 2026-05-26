import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Vitest config — KOVAS App (couche 2 industrialisation).
 *
 * Couvre :
 *   - tests unitaires `src/**\/*.test.ts(x)`
 *   - tests d'intégration légers (mocks Supabase via vi.mock)
 *   - tests RLS Supabase `tests/rls/*.test.ts` (env Node, anon vs service role)
 *
 * Coverage v8 avec seuils CLAUDE.md §12 (>= 70% lines/functions/statements,
 * >= 65% branches). Exclusions standards (config, types générés, scripts, supabase
 * Edge Functions testées séparément côté Deno).
 *
 * Lancement :
 *   pnpm test:unit            # run
 *   pnpm test:unit:watch      # watch
 *   pnpm test:unit:coverage   # avec coverage HTML + lcov
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // ─── B99 — Whisper local WASM ────────────────────────────────────
      // En mode test, `@xenova/transformers` est aliasé vers un stub local
      // pour permettre à Vite de résoudre l'import statique même si la dep
      // n'est pas installée (CI fresh, sandbox sans pnpm). Les tests qui
      // veulent un comportement réaliste utilisent `vi.mock(...)` qui
      // s'applique par-dessus cet alias. Cf. JSDoc du stub pour le contexte.
      '@xenova/transformers': fileURLToPath(
        new URL('./src/lib/audio/__mocks__/xenova-transformers-stub.ts', import.meta.url),
      ),
    },
  },
  // JSX runtime "automatic" : permet d'écrire des tests `.test.tsx` sans
  // importer React explicitement, aligné sur la pratique Next.js 15 + React 19.
  // Aucun impact sur la build prod (gérée par Next/SWC).
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/rls/**/*.test.ts'],
    // Exclusion : les fichiers .test.ts pré-existants écrits avec `node:test`
    // (avant introduction de Vitest) — on les laisse vivre sous leur runner
    // d'origine pour ne pas casser les commits précédents. Migration au cas
    // par cas via tâches dédiées.
    exclude: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'tests/e2e/**',
      'tests/smart-defaults/**', // tsx + node:test
      '**/*.spec.ts', // Playwright specs
      '**/*.stories.tsx',
      'src/lib/ab-testing/assign.test.ts',
      'src/lib/billing/ai-cost-tracker.test.ts',
      'src/lib/billing/fair-use-monitor.test.ts',
      'src/lib/business-card/vcard.test.ts',
      'src/lib/quotes/generate-pdf.test.ts',
      'src/lib/upsell/behavioral-triggers.test.ts',
      'src/lib/diagnosticians/mask-contact.test.ts',
      'src/lib/diagnosticians/verification-code.test.ts',
      'src/lib/diagnosticians/siret-claim-flow.test.ts',
    ],
    css: false,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/**',
        '.next/**',
        '**/*.config.*',
        '**/*.d.ts',
        'src/types/**',
        '**/types.ts',
        'supabase/functions/**',
        'scripts/**',
        '**/*.stories.tsx',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        'src/app/**/layout.tsx',
        'src/app/**/page.tsx',
        'src/app/**/loading.tsx',
        'src/app/**/not-found.tsx',
        'src/app/**/error.tsx',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
})
