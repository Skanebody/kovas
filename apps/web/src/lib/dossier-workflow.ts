/**
 * Workflow stepper — étapes guidées pour un dossier.
 * Adaptatif selon les diagnostics inclus dans le dossier.
 *
 * 6 étapes principales :
 * 1. Pré-visite      — préparation au bureau avant de partir
 * 2. Identité bien   — surface, année, type, niveau
 * 3. Pièces          — définition des pièces + templates
 * 4. Saisie terrain  — photos + notes par pièce
 * 5. Relevés spécifiques — items requis par diagnostic
 * 6. Validation      — check-list + cohérence + prêt à exporter
 */

export type WorkflowStepId =
  | 'pre_visite'
  | 'identite'
  | 'pieces'
  | 'saisie_terrain'
  | 'releves_specifiques'
  | 'validation'

export interface WorkflowItem {
  id: string
  label: string
  /** Si défini, KOVAS vérifie automatiquement → status auto_ok ou auto_pending */
  autoCheck?: (ctx: WorkflowContext) => boolean
  /** Indique pour quels diagnostics cet item s'applique (vide = tous) */
  forDiagnostics?: string[]
  required?: boolean
}

export interface WorkflowStep {
  id: WorkflowStepId
  title: string
  description: string
  items: WorkflowItem[]
}

export interface WorkflowContext {
  dossier: {
    status: string
    started_at: string | null
    completed_at: string | null
    notes: string | null
  }
  property: {
    surface_total: number | null
    year_built: number | null
    property_type: string | null
  }
  rooms: { id: string; room_type: string | null }[]
  photos: { room_id: string | null }[]
  voiceNotes: { room_id: string | null }[]
  ownerDocuments: { doc_kind: string | null }[]
  missionTypes: string[]
}

const STEPS: WorkflowStep[] = [
  {
    id: 'pre_visite',
    title: 'Pré-visite',
    description: 'Avant de partir : préparation au bureau.',
    items: [
      {
        id: 'pre_documents_received',
        label: 'Documents du propriétaire récupérés (factures énergie, anciens DPE, plans)',
        autoCheck: (ctx) => ctx.ownerDocuments.length > 0,
      },
      {
        id: 'pre_appointment_confirmed',
        label: 'Rendez-vous confirmé auprès du client',
      },
      {
        id: 'pre_material_xrf',
        label: 'Appareil XRF chargé',
        forDiagnostics: ['plomb_crep'],
      },
      {
        id: 'pre_material_distometer',
        label: 'Télémètre / mètre laser chargé',
      },
      {
        id: 'pre_material_dpe_sondes',
        label: 'Sondes DPE prêtes',
        forDiagnostics: ['dpe_vente', 'dpe_location', 'copropriete'],
      },
    ],
  },
  {
    id: 'identite',
    title: 'Identité du bien',
    description: 'Caractéristiques générales — auto-remplies depuis la fiche bien.',
    items: [
      {
        id: 'id_address',
        label: 'Adresse complète + GPS confirmés',
        autoCheck: () => true, // address is required on property creation
      },
      {
        id: 'id_year_built',
        label: 'Année de construction renseignée',
        autoCheck: (ctx) => ctx.property.year_built !== null,
        required: true,
      },
      {
        id: 'id_surface',
        label: 'Surface totale renseignée',
        autoCheck: (ctx) => ctx.property.surface_total !== null,
        required: true,
      },
      {
        id: 'id_type',
        label: 'Type de bâtiment renseigné (maison / appart / immeuble)',
        autoCheck: (ctx) => ctx.property.property_type !== null,
      },
    ],
  },
  {
    id: 'pieces',
    title: 'Pièces du bien',
    description: 'Listez les pièces — utilisez les templates pour gagner du temps.',
    items: [
      {
        id: 'rooms_min_one',
        label: 'Au moins 1 pièce définie',
        autoCheck: (ctx) => ctx.rooms.length >= 1,
        required: true,
      },
      {
        id: 'rooms_kitchen',
        label: 'Cuisine identifiée',
        autoCheck: (ctx) => ctx.rooms.some((r) => r.room_type === 'cuisine'),
      },
      {
        id: 'rooms_bathroom',
        label: 'Salle de bain identifiée',
        autoCheck: (ctx) => ctx.rooms.some((r) => r.room_type === 'salle_de_bain'),
      },
    ],
  },
  {
    id: 'saisie_terrain',
    title: 'Saisie terrain',
    description: 'Pour chaque pièce : photos + note vocale descriptive.',
    items: [
      {
        id: 'field_photos_min',
        label: 'Au moins 3 photos prises',
        autoCheck: (ctx) => ctx.photos.length >= 3,
        required: true,
      },
      {
        id: 'field_photos_tagged',
        label: 'Toutes les photos sont taggées à une pièce',
        autoCheck: (ctx) =>
          ctx.photos.length === 0 || ctx.photos.every((p) => p.room_id !== null),
      },
      {
        id: 'field_voice_one_per_room',
        label: 'Une note vocale par pièce minimum',
        autoCheck: (ctx) => {
          if (ctx.rooms.length === 0) return false
          const roomsWithVoice = new Set(
            ctx.voiceNotes.filter((v) => v.room_id !== null).map((v) => v.room_id),
          )
          return roomsWithVoice.size >= ctx.rooms.length
        },
      },
    ],
  },
  {
    id: 'releves_specifiques',
    title: 'Relevés spécifiques par diagnostic',
    description: 'Items à vérifier selon les diags inclus dans le dossier.',
    items: [
      // DPE
      {
        id: 'spec_dpe_heating',
        label: 'Système de chauffage identifié + photographié (chaudière, PAC, radiateurs)',
        forDiagnostics: ['dpe_vente', 'dpe_location', 'copropriete'],
        required: true,
      },
      {
        id: 'spec_dpe_ecs',
        label: 'Production d\'eau chaude identifiée',
        forDiagnostics: ['dpe_vente', 'dpe_location', 'copropriete'],
        required: true,
      },
      {
        id: 'spec_dpe_ventilation',
        label: 'Ventilation notée (VMC simple/double flux, naturelle)',
        forDiagnostics: ['dpe_vente', 'dpe_location', 'copropriete'],
        required: true,
      },
      {
        id: 'spec_dpe_windows',
        label: 'Vitrage relevé (simple/double/triple)',
        forDiagnostics: ['dpe_vente', 'dpe_location', 'copropriete'],
        required: true,
      },
      {
        id: 'spec_dpe_isolation',
        label: 'Isolation murs/toiture/planchers notée',
        forDiagnostics: ['dpe_vente', 'dpe_location', 'copropriete'],
        required: true,
      },
      {
        id: 'spec_dpe_meter',
        label: 'Compteur électrique photographié + factures récupérées',
        forDiagnostics: ['dpe_vente', 'dpe_location', 'copropriete'],
      },
      // Amiante
      {
        id: 'spec_amiante_combles',
        label: 'Combles / caves / locaux techniques inspectés',
        forDiagnostics: ['amiante_vente', 'amiante_avant_travaux'],
        required: true,
      },
      {
        id: 'spec_amiante_materiaux',
        label: 'Matériaux suspects photographiés (flocage, calorifugeage, fibrociment)',
        forDiagnostics: ['amiante_vente', 'amiante_avant_travaux'],
        required: true,
      },
      // Plomb
      {
        id: 'spec_plomb_xrf',
        label: 'Mesures XRF effectuées dans toutes les pièces',
        forDiagnostics: ['plomb_crep'],
        required: true,
      },
      {
        id: 'spec_plomb_ecaillage',
        label: 'Photos des zones d\'écaillage / dégradation',
        forDiagnostics: ['plomb_crep'],
        required: true,
      },
      // Gaz
      {
        id: 'spec_gaz_compteur',
        label: 'Compteur gaz photographié',
        forDiagnostics: ['gaz'],
        required: true,
      },
      {
        id: 'spec_gaz_robinets',
        label: 'Robinets d\'arrêt accessibles et fonctionnels',
        forDiagnostics: ['gaz'],
        required: true,
      },
      {
        id: 'spec_gaz_conduits',
        label: 'Conduits d\'évacuation vérifiés',
        forDiagnostics: ['gaz'],
        required: true,
      },
      // Électricité
      {
        id: 'spec_elec_tableau',
        label: 'Tableau électrique photographié + disjoncteur 30mA identifié',
        forDiagnostics: ['electricite'],
        required: true,
      },
      {
        id: 'spec_elec_terre',
        label: 'Prise de terre vérifiée',
        forDiagnostics: ['electricite'],
        required: true,
      },
      // Termites
      {
        id: 'spec_termites_bois',
        label: 'Tous les éléments bois visibles inspectés',
        forDiagnostics: ['termites'],
        required: true,
      },
      {
        id: 'spec_termites_indices',
        label: 'Recherche d\'indices (galeries, cordonnets, sciure)',
        forDiagnostics: ['termites'],
        required: true,
      },
      // Carrez
      {
        id: 'spec_carrez_mesures',
        label: 'Mesures Carrez prises pour chaque pièce > 1,80m h.s.p.',
        forDiagnostics: ['carrez_boutin'],
        required: true,
      },
      // ERP
      {
        id: 'spec_erp_georisques',
        label: 'Document Géorisques téléchargé pour l\'adresse exacte',
        forDiagnostics: ['erp'],
        required: true,
      },
    ],
  },
  {
    id: 'validation',
    title: 'Validation avant départ',
    description: 'Dernière vérification — assurez-vous de ne rien oublier.',
    items: [
      {
        id: 'final_data_complete',
        label: 'Toutes les pièces ont au moins une photo',
        autoCheck: (ctx) => {
          if (ctx.rooms.length === 0) return false
          const photoedRooms = new Set(ctx.photos.filter((p) => p.room_id).map((p) => p.room_id))
          return photoedRooms.size >= ctx.rooms.length
        },
      },
      {
        id: 'final_review_visual',
        label: 'Revue visuelle des données avant de partir',
      },
      {
        id: 'final_client_briefed',
        label: 'Client informé du délai de rapport',
      },
    ],
  },
]

export interface WorkflowItemRun {
  id: string
  label: string
  status: 'auto_ok' | 'auto_pending' | 'manual'
  checked?: boolean
  required: boolean
}

export interface WorkflowStepRun {
  id: WorkflowStepId
  title: string
  description: string
  items: WorkflowItemRun[]
  progress: number
  completed: boolean
}

export function runWorkflow(
  ctx: WorkflowContext,
  manualState: Record<string, boolean> = {},
): { steps: WorkflowStepRun[]; overallProgress: number } {
  const steps: WorkflowStepRun[] = STEPS.map((step) => {
    // Filter items based on dossier's mission types
    const applicableItems = step.items.filter((it) => {
      if (!it.forDiagnostics || it.forDiagnostics.length === 0) return true
      return it.forDiagnostics.some((d) => ctx.missionTypes.includes(d))
    })

    const runItems: WorkflowItemRun[] = applicableItems.map((it) => {
      if (it.autoCheck) {
        return {
          id: it.id,
          label: it.label,
          status: it.autoCheck(ctx) ? 'auto_ok' : 'auto_pending',
          required: it.required ?? false,
        }
      }
      return {
        id: it.id,
        label: it.label,
        status: 'manual',
        checked: manualState[it.id] === true,
        required: it.required ?? false,
      }
    })

    const done = runItems.filter(
      (it) => it.status === 'auto_ok' || it.checked === true,
    ).length
    const progress = runItems.length === 0 ? 1 : done / runItems.length
    const completed = progress >= 1

    return {
      id: step.id,
      title: step.title,
      description: step.description,
      items: runItems,
      progress,
      completed,
    }
  })

  const totalItems = steps.reduce((acc, s) => acc + s.items.length, 0)
  const totalDone = steps.reduce(
    (acc, s) => acc + s.items.filter((it) => it.status === 'auto_ok' || it.checked === true).length,
    0,
  )
  const overallProgress = totalItems === 0 ? 0 : totalDone / totalItems

  return { steps, overallProgress }
}
