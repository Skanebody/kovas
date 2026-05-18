/**
 * Check-lists par type de diagnostic — feature 5 des 10 MVP V1.
 * Cf. CLAUDE.md §3 — "Tu n'as pas saisi la VMC, c'est volontaire ?"
 *
 * Vérification automatique avant export pour éviter les oublis terrain.
 * Chaque item peut être :
 * - resolved côté KOVAS (par ex. "Au moins 1 photo de la chaudière" vérifiable via la DB)
 * - manual (le diagnostiqueur coche lui-même : "Conduits de fumée vérifiés")
 */

export interface ChecklistItem {
  id: string
  label: string
  category: 'pieces' | 'equipements' | 'documents' | 'observations'
  /** Si défini, KOVAS vérifie automatiquement la complétude */
  autoCheck?: (mission: ChecklistAutoContext) => boolean
  /** Si true, l'item est obligatoire pour valider la mission */
  required: boolean
}

export interface ChecklistAutoContext {
  rooms: { id: string; room_type: string | null }[]
  photos: { room_id: string | null }[]
  voiceNotes: { room_id: string | null; transcript_structured: unknown }[]
  property: {
    surface_total: number | null
    year_built: number | null
    property_type: string | null
  }
}

const COMMON_CHECKLIST: ChecklistItem[] = [
  {
    id: 'rooms_defined',
    label: 'Au moins 1 pièce définie',
    category: 'pieces',
    required: true,
    autoCheck: (ctx) => ctx.rooms.length >= 1,
  },
  {
    id: 'photos_general',
    label: 'Au moins 3 photos prises',
    category: 'pieces',
    required: true,
    autoCheck: (ctx) => ctx.photos.length >= 3,
  },
  {
    id: 'property_surface',
    label: 'Surface totale renseignée',
    category: 'documents',
    required: true,
    autoCheck: (ctx) => Boolean(ctx.property.surface_total),
  },
  {
    id: 'property_year',
    label: 'Année de construction renseignée',
    category: 'documents',
    required: false,
    autoCheck: (ctx) => Boolean(ctx.property.year_built),
  },
]

const DPE_CHECKLIST: ChecklistItem[] = [
  {
    id: 'dpe_heating',
    label: 'Système de chauffage identifié (chaudière, PAC, élec...)',
    category: 'equipements',
    required: true,
  },
  {
    id: 'dpe_ecs',
    label: 'Production d\'eau chaude sanitaire identifiée',
    category: 'equipements',
    required: true,
  },
  {
    id: 'dpe_ventilation',
    label: 'Type de ventilation noté (VMC simple/double flux, naturelle)',
    category: 'equipements',
    required: true,
  },
  {
    id: 'dpe_windows',
    label: 'Type de vitrage relevé (simple/double/triple)',
    category: 'equipements',
    required: true,
  },
  {
    id: 'dpe_isolation',
    label: 'Type et état de l\'isolation noté (murs, toiture, planchers)',
    category: 'equipements',
    required: true,
  },
  {
    id: 'dpe_consumption',
    label: 'Factures énergie 3 dernières années récupérées',
    category: 'documents',
    required: false,
  },
]

const AMIANTE_CHECKLIST: ChecklistItem[] = [
  {
    id: 'amiante_built_before_1997',
    label: 'Bâtiment construit avant 1997 (sinon hors champ)',
    category: 'documents',
    required: true,
    autoCheck: (ctx) => (ctx.property.year_built ?? 9999) < 1997,
  },
  {
    id: 'amiante_locaux_visited',
    label: 'Tous les locaux accessibles visités (caves, combles, locaux techniques)',
    category: 'pieces',
    required: true,
  },
  {
    id: 'amiante_materials',
    label: 'Matériaux suspects photographiés (flocage, calorifugeage, fibrociment, dalles vinyle)',
    category: 'equipements',
    required: true,
  },
  {
    id: 'amiante_prelevements',
    label: 'Prélèvements effectués si doute (sinon expliquer pourquoi)',
    category: 'observations',
    required: false,
  },
]

const PLOMB_CHECKLIST: ChecklistItem[] = [
  {
    id: 'plomb_built_before_1949',
    label: 'Bâtiment construit avant 1949 (sinon hors champ)',
    category: 'documents',
    required: true,
    autoCheck: (ctx) => (ctx.property.year_built ?? 9999) < 1949,
  },
  {
    id: 'plomb_mesures',
    label: 'Mesures XRF effectuées dans toutes les pièces',
    category: 'equipements',
    required: true,
  },
  {
    id: 'plomb_ecaillage',
    label: 'Photos des zones d\'écaillage / dégradation',
    category: 'pieces',
    required: true,
  },
]

const GAZ_CHECKLIST: ChecklistItem[] = [
  {
    id: 'gaz_compteur',
    label: 'Photo du compteur gaz + numéro relevé',
    category: 'equipements',
    required: true,
  },
  {
    id: 'gaz_robinets',
    label: 'Robinets d\'arrêt accessibles et fonctionnels',
    category: 'equipements',
    required: true,
  },
  {
    id: 'gaz_conduits',
    label: 'Conduits d\'évacuation vérifiés (chaudière, chauffe-eau)',
    category: 'equipements',
    required: true,
  },
  {
    id: 'gaz_ventilation',
    label: 'Ventilation des locaux gaz (grilles hautes/basses)',
    category: 'equipements',
    required: true,
  },
]

const ELEC_CHECKLIST: ChecklistItem[] = [
  {
    id: 'elec_tableau',
    label: 'Photo du tableau électrique + identification disjoncteur 30mA',
    category: 'equipements',
    required: true,
  },
  {
    id: 'elec_prise_terre',
    label: 'Prise de terre vérifiée',
    category: 'equipements',
    required: true,
  },
  {
    id: 'elec_compteur',
    label: 'Photo du compteur + puissance souscrite notée',
    category: 'equipements',
    required: true,
  },
  {
    id: 'elec_salles_eau',
    label: 'Liaison équipotentielle vérifiée dans salles d\'eau',
    category: 'equipements',
    required: true,
  },
]

const TERMITES_CHECKLIST: ChecklistItem[] = [
  {
    id: 'termites_zones_concernees',
    label: 'Bien situé dans une zone à risque (arrêté préfectoral)',
    category: 'documents',
    required: true,
  },
  {
    id: 'termites_bois_visibles',
    label: 'Tous les éléments bois visibles inspectés (charpente, plinthes, parquet)',
    category: 'pieces',
    required: true,
  },
  {
    id: 'termites_indices',
    label: 'Indices recherchés (galeries, cordonnets, sciure)',
    category: 'observations',
    required: true,
  },
]

const ERP_CHECKLIST: ChecklistItem[] = [
  {
    id: 'erp_georisques',
    label: 'Document Géorisques téléchargé pour l\'adresse exacte',
    category: 'documents',
    required: true,
  },
  {
    id: 'erp_pprn',
    label: 'PPRN (naturels) consulté',
    category: 'documents',
    required: true,
  },
  {
    id: 'erp_pprt',
    label: 'PPRT (technologiques) consulté',
    category: 'documents',
    required: true,
  },
  {
    id: 'erp_pollution',
    label: 'Sols pollués / sites BASIAS-BASOL consultés',
    category: 'documents',
    required: false,
  },
]

const CARREZ_CHECKLIST: ChecklistItem[] = [
  {
    id: 'carrez_mesures',
    label: 'Mesures Carrez prises pour chaque pièce > 1,80m h.s.p.',
    category: 'pieces',
    required: true,
  },
  {
    id: 'carrez_deductions',
    label: 'Surfaces déduites (cloisons, gaines, embrasures > 0,5m²)',
    category: 'pieces',
    required: true,
  },
]

const CHECKLISTS_BY_TYPE: Record<string, ChecklistItem[]> = {
  dpe_vente: DPE_CHECKLIST,
  dpe_location: DPE_CHECKLIST,
  copropriete: DPE_CHECKLIST,
  amiante_vente: AMIANTE_CHECKLIST,
  amiante_avant_travaux: AMIANTE_CHECKLIST,
  plomb_crep: PLOMB_CHECKLIST,
  gaz: GAZ_CHECKLIST,
  electricite: ELEC_CHECKLIST,
  termites: TERMITES_CHECKLIST,
  carrez_boutin: CARREZ_CHECKLIST,
  erp: ERP_CHECKLIST,
}

export function getChecklistForMissionType(missionType: string): ChecklistItem[] {
  return [...COMMON_CHECKLIST, ...(CHECKLISTS_BY_TYPE[missionType] ?? [])]
}

/**
 * Item sérialisable (sans la fonction `autoCheck`) pour passage RSC → Client.
 */
export interface ChecklistRunItem {
  id: string
  label: string
  category: ChecklistItem['category']
  required: boolean
  status: 'auto_ok' | 'auto_pending' | 'manual'
  manualChecked?: boolean
}

export function runChecklist(
  missionType: string,
  ctx: ChecklistAutoContext,
  manualState: Record<string, boolean> = {},
): { items: ChecklistRunItem[]; completion: number; requiredOk: boolean } {
  const items = getChecklistForMissionType(missionType).map((it): ChecklistRunItem => {
    const base = {
      id: it.id,
      label: it.label,
      category: it.category,
      required: it.required,
    }
    if (it.autoCheck) {
      return { ...base, status: it.autoCheck(ctx) ? 'auto_ok' : 'auto_pending' }
    }
    return { ...base, status: 'manual', manualChecked: manualState[it.id] === true }
  })

  const total = items.length
  const done = items.filter((it) => it.status === 'auto_ok' || it.manualChecked === true).length
  const completion = total === 0 ? 1 : Math.round((done / total) * 100) / 100

  const required = items.filter((it) => it.required)
  const requiredOk = required.every(
    (it) => it.status === 'auto_ok' || it.manualChecked === true,
  )

  return { items, completion, requiredOk }
}
