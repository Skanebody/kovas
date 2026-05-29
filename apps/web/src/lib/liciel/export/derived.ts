/**
 * Champs dérivés / calculés du mapping Liciel.
 *
 * Implémente les transformations documentées dans docs/liciel-parser-specs.md :
 *   - periode_construction (enum 5 valeurs ADEME) depuis year_built
 *   - date_fin_validite = date_visite + 10 ans
 *   - mapping mission.type → fichier LIV_<diag>.xml
 *   - type_mission / methode_calcul
 *
 * RÈGLE D'HONNÊTETÉ : aucune valeur n'est inventée. Les enums proviennent
 * strictement de la spec (§A périodes ADEME, §C type_mission).
 */

/**
 * Périodes de construction ADEME (LIV_DPE.periode_construction).
 * Source : docs/liciel-parser-specs.md §A.
 */
export type PeriodeConstruction =
  | 'avant_1948'
  | '1949_1974'
  | '1975_1988'
  | '1989_2000'
  | 'apres_2001'

/**
 * Dérive la période de construction ADEME depuis l'année de construction.
 * Retourne null si l'année est absente (champ laissé vide dans le XML).
 *
 * Bornes (spec §A) :
 *   avant_1948 : ≤ 1948
 *   1949_1974  : 1949–1974
 *   1975_1988  : 1975–1988
 *   1989_2000  : 1989–2000
 *   apres_2001 : ≥ 2001
 */
export function derivePeriodeConstruction(
  yearBuilt: number | null | undefined,
): PeriodeConstruction | null {
  if (yearBuilt === null || yearBuilt === undefined || !Number.isFinite(yearBuilt)) {
    return null
  }
  if (yearBuilt <= 1948) return 'avant_1948'
  if (yearBuilt <= 1974) return '1949_1974'
  if (yearBuilt <= 1988) return '1975_1988'
  if (yearBuilt <= 2000) return '1989_2000'
  return 'apres_2001'
}

/**
 * Calcule la date de fin de validité du DPE = date de visite + 10 ans.
 * Cf. spec §C (LIV_DPE.date_fin_validite). Retourne null si pas de date source.
 */
export function deriveDateFinValidite(dateVisiteIso: string | null | undefined): string | null {
  if (!dateVisiteIso) return null
  const d = new Date(dateVisiteIso)
  if (Number.isNaN(d.getTime())) return null
  const end = new Date(d)
  end.setFullYear(end.getFullYear() + 10)
  return end.toISOString().slice(0, 10)
}

/**
 * Contexte de transaction Liciel (LIV_DPE.type_mission).
 * Valeurs spec §C : 'vente' | 'location' | 'neuf'.
 * KOVAS n'a pas de type "neuf" distinct → on mappe ce qui existe.
 */
export function deriveTypeMission(missionType: string): 'vente' | 'location' | null {
  if (missionType === 'dpe_location') return 'location'
  if (missionType === 'dpe_vente') return 'vente'
  if (missionType === 'amiante_vente') return 'vente'
  // copropriete / amiante_avant_travaux / autres : pas de mapping vente|location
  // documenté → on laisse vide.
  return null
}

/**
 * Nom de fichier LIV_<diag>.xml correspondant au type de mission KOVAS.
 * Source : structure ZIP cible spec §1.
 * Retourne null pour les types sans fichier diagnostic dédié dans la spec
 * (ex : copropriete).
 */
export function diagnosticFileForMissionType(missionType: string): string | null {
  if (missionType.startsWith('dpe_')) return 'XML/LIV_DPE.xml'
  if (missionType.startsWith('amiante_')) return 'XML/LIV_amiante.xml'
  if (missionType === 'plomb_crep') return 'XML/LIV_plomb.xml'
  if (missionType === 'gaz') return 'XML/LIV_gaz.xml'
  if (missionType === 'electricite') return 'XML/LIV_electricite.xml'
  if (missionType === 'termites') return 'XML/LIV_termites.xml'
  if (missionType === 'carrez_boutin') return 'XML/LIV_carrez.xml'
  if (missionType === 'erp') return 'XML/LIV_erp.xml'
  return null
}

/**
 * Identifiant court de pièce Liciel : PIECE_001, PIECE_002, …
 * (cf. spec §H — dossier Photos/PIECE_xxx + attribut id dans <pieces>).
 * Retourne une Map room_id (uuid KOVAS) → identifiant Liciel.
 */
export function buildRoomNumbering(rooms: readonly { id: string }[]): Map<string, string> {
  const map = new Map<string, string>()
  rooms.forEach((room, index) => {
    map.set(room.id, `PIECE_${String(index + 1).padStart(3, '0')}`)
  })
  return map
}
