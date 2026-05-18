/**
 * @kovas/liciel-bridge — Reverse-engineering du format Liciel
 *
 * Cf. research/liciel-format.md pour le contexte légal (L122-6-1 §III CPI + CJEU SAS Institute)
 * et kovas-defense-strategy.md pour la stratégie multi-voies (XML/Excel Imports spécifiques + ZIP).
 *
 * Stratégie de l'écriture .mdb :
 * - Linux/Node ne peut PAS écrire .mdb directement (mdbtools = read-only)
 * - Microservice Java/Jackcess sur Railway Linux endpoint POST /api/build-liciel-zip
 *
 * Cette task sera implémentée Sprint MVP J11-J12 (Phase 4 implementation).
 */

export const LICIEL_SCHEMA_VERSION = '2024.1' // Target conservateur, last 3 minors

export type LicielExportPayload = {
  missionId: string
  dossierAdmin: Record<string, unknown> // ODM, facturation, client
  dossierTerrain: Record<string, unknown> // XML données terrain
  photos: Array<{ path: string; metadata: Record<string, unknown> }>
}

export type LicielExportResult = {
  zipBlob: Blob
  filename: string
  checksum: string
}

/**
 * Stub — appel au microservice Java/Jackcess.
 * Implémentation Sprint MVP J12.
 */
export async function buildLicielZip(
  _payload: LicielExportPayload,
): Promise<LicielExportResult> {
  // TODO Task 4.2 sprint MVP J12
  throw new Error('Not implemented yet — Sprint MVP J12')
}
