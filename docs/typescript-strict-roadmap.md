# TypeScript Strict — Roadmap d'activation

> **Couche 1 industrialisation qualité** — état initial des flags `tsconfig.json` à la racine, et plan de durcissement progressif.

## Flags activés (EXIT 0 actuel)

| Flag | Statut | Raison |
|---|---|---|
| `strict` | ✅ on | Pack standard |
| `noImplicitAny` | ✅ on | Zéro `any` (règle KOVAS) |
| `strictNullChecks` | ✅ on | Évite TypeError runtime |
| `noUnusedLocals` | ✅ on | Détecte code mort local |
| `noUnusedParameters` | ✅ on | Force usage ou prefix `_` |
| `noImplicitReturns` | ✅ on | Toutes les branches retournent |
| `noFallthroughCasesInSwitch` | ✅ on | Pas de fallthrough involontaire |
| `noImplicitOverride` | ✅ on (nouveau Couche 1) | Force `override` explicite |
| `useUnknownInCatchVariables` | ✅ on (nouveau Couche 1) | `catch (e: unknown)` |
| `allowUnusedLabels` | ❌ false (nouveau Couche 1) | Erreur si label inutilisé |
| `allowUnreachableCode` | ❌ false (nouveau Couche 1) | Erreur si dead code |

## Flags désactivés volontairement — TODO durcissement

### `noUncheckedIndexedAccess: false`

**Impact si activé** : 6 erreurs initiales détectées (estimation Couche 1).
- `src/components/ui/bar-chart-pills.tsx:148` — accès `array[i]` sans guard
- `src/components/ui/mission-tour.tsx:108,143,148,167` — `ref.current` possibly undefined
- `src/components/ui/workflow-stepper-v4.tsx:133` — `array.map(x => x.label)` peut être undefined

**Plan de fix** :
- Sprint dédié 1-2j pour ajouter guards ou non-null assertions justifiées
- Réactiver `noUncheckedIndexedAccess: true` une fois les 6 erreurs corrigées

### `exactOptionalPropertyTypes: false`

**Impact si activé** : 32 erreurs initiales.
- Surtout sur les props Radix UI optionnelles passées avec `prop={undefined}` au lieu d'absence de la prop
- Quelques handlers `onClick`/`onChange` optionnels avec `undefined` explicite

**Plan de fix** :
- Sprint cleanup 1j pour réécrire les props "absentes" plutôt que `undefined` explicit
- Helper de spread conditionnel `...(value !== undefined && { prop: value })` pour cas dynamique
- Réactiver après cleanup ciblé

### `noPropertyAccessFromIndexSignature: false`

**Impact si activé** : 100+ erreurs (trop pour Couche 1).
- `process.env.NEXT_PUBLIC_*` partout (la signature `[key: string]: string | undefined` force `process.env['KEY']`)
- Quelques accès dynamiques sur dictionnaires métier (mission-pastels, status colors)

**Plan de fix** :
- Centraliser tous les accès `process.env.*` dans un helper `env.ts` typé strict (Zod ou simple cast)
- Migrer dictionnaires métier vers `as const` + key types stricts
- Réactiver Phase 2 (M10+) quand l'abstraction est complète

## Métriques cible

| Phase | Flags actifs | Erreurs résiduelles |
|---|---|---|
| Couche 1 (actuel) | 11/14 strict flags | EXIT 0 |
| Couche 2 (post-fix index access) | 12/14 | EXIT 0 |
| Couche 3 (post-cleanup optional props) | 13/14 | EXIT 0 |
| Phase 2 (env.ts abstrait) | 14/14 (tous) | EXIT 0 |
