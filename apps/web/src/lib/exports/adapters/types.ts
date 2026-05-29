import type { MissionExportData } from '@/lib/exports/build-mission-data'

/**
 * Architecture d'adaptateurs d'export par éditeur de logiciel de diagnostic.
 *
 * Chaque éditeur cible (Liciel, OBBC, AnalysImmo) est branché via un
 * module isolé implémentant `EditorExportAdapter`. Brancher un nouvel éditeur =
 * créer un module `adapters/<id>.ts` + l'enregistrer dans `registry.ts`.
 *
 * Deux niveaux de fidélité d'export :
 *  - `nativeMapping: true`  → mapping natif EXACT du format propriétaire de
 *    l'éditeur (import 1-clic chez lui). Aujourd'hui : Liciel uniquement, cf.
 *    `lib/liciel/export` qui sert de patron de référence.
 *  - `nativeMapping: false` → fallback universel honnête : on délègue à
 *    l'export multi-format (`buildExportZip`, PDF/Word/CSV/JSON/XML) en
 *    attendant de recevoir la spec d'import native de l'éditeur. AUCUN champ
 *    propriétaire n'est inventé tant que la spec n'est pas documentée.
 */

/** Résultat binaire d'un export prêt à streamer en réponse HTTP. */
export interface EditorExportResult {
  /** Contenu binaire de l'archive/document. */
  buffer: Buffer
  /** Nom de fichier proposé (Content-Disposition). */
  filename: string
  /** Type MIME (ex. `application/zip`). */
  mimeType: string
}

/** Contrat commun à tous les adaptateurs d'export éditeur. */
export interface EditorExportAdapter {
  /** Identifiant stable, utilisé comme valeur `?format=` (ex. `liciel`). */
  id: string
  /** Libellé lisible affiché à l'utilisateur (ex. `Liciel`). */
  label: string
  /**
   * `true` = mapping natif exact du format propriétaire de l'éditeur.
   * `false` = fallback universel (`buildExportZip`) en attendant la spec native.
   */
  nativeMapping: boolean
  /** Construit l'export pour une mission donnée. */
  build(data: MissionExportData): Promise<EditorExportResult>
}

/** Identifiants d'éditeurs supportés par le registre. */
export type EditorAdapterId = 'liciel' | 'obbc' | 'analysimmo'
