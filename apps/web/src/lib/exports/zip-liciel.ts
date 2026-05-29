/**
 * Export ZIP Liciel — façade de compatibilité.
 *
 * L'implémentation conforme à docs/liciel-parser-specs.md vit désormais dans
 * `@/lib/liciel/export` (un module par fichier XML + builders par catégorie
 * A-H). Ce fichier conserve le point d'import historique pour la route
 * `app/api/missions/[id]/export/route.ts` (?format=liciel).
 *
 * Cf. lib/liciel/export/index.ts pour la structure ZIP, le mapping exact des
 * champs et les champs dérivés (periode_construction, date_fin_validite, …).
 */

export { buildLicielZip } from '@/lib/liciel/export'
