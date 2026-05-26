/**
 * Stub Vitest pour `@xenova/transformers` (Lot B99).
 *
 * Pourquoi : Vite analyse statiquement les `await import('@xenova/transformers')`
 * du module `use-local-whisper.ts` AVANT que `vi.mock()` ne s'applique. Si la
 * dep n'est pas installée (sandbox CI fresh, ou avant `pnpm install`), Vite
 * throw "Failed to resolve import".
 *
 * Solution : un alias Vitest (cf. `vitest.config.ts > resolve.alias`) redirige
 * `@xenova/transformers` vers ce fichier en mode test. Les tests qui veulent
 * un comportement réaliste utilisent `vi.mock('@xenova/transformers')` qui
 * prend le pas sur cet alias via le système de mocks Vitest.
 *
 * Ce stub est purement défensif — il n'est jamais exécuté en prod (Next.js
 * webpack résout le vrai package).
 */

export function pipeline(): Promise<unknown> {
  return Promise.reject(new Error('xenova_transformers_stub_used_in_test'))
}

export const env: {
  allowLocalModels?: boolean
  useBrowserCache?: boolean
} = {
  allowLocalModels: true,
  useBrowserCache: false,
}
