/**
 * Matrice Pièce × Diagnostic — détermine pour une pièce donnée :
 * 1. Quels diagnostics sont applicables (toutes les pièces ne sont pas concernées par tout)
 * 2. Quelles tâches faire pour chaque (room_type, diag_type) couple
 *
 * Cette logique alimente la "Vue par pièce" : le diagnostiqueur voit pour
 * chaque pièce les checks à faire pour tous les diags du dossier.
 */

export type DiagType =
  | 'dpe_vente'
  | 'dpe_location'
  | 'copropriete'
  | 'amiante_vente'
  | 'amiante_avant_travaux'
  | 'plomb_crep'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez_boutin'
  | 'erp'

/** Famille de diag pour simplifier la logique des règles */
type DiagFamily = 'dpe' | 'amiante' | 'plomb' | 'gaz' | 'electricite' | 'termites' | 'carrez' | 'erp'

function diagFamily(diag: DiagType): DiagFamily {
  if (diag.startsWith('dpe_') || diag === 'copropriete') return 'dpe'
  if (diag.startsWith('amiante_')) return 'amiante'
  if (diag === 'plomb_crep') return 'plomb'
  if (diag === 'gaz') return 'gaz'
  if (diag === 'electricite') return 'electricite'
  if (diag === 'termites') return 'termites'
  if (diag === 'carrez_boutin') return 'carrez'
  return 'erp'
}

/**
 * Pour un type de pièce et une liste de diags du dossier, renvoie ceux qui
 * s'appliquent à cette pièce. Ex : ERP ne s'applique pas par pièce (c'est
 * un doc admin à part). Termites se concentre sur les pièces avec bois.
 */
export function applicableDiagsForRoom(
  roomType: string | null,
  missionTypes: DiagType[],
): DiagType[] {
  const rt = roomType ?? 'autre'
  return missionTypes.filter((diag) => {
    const fam = diagFamily(diag)
    // ERP / Carrez ne sont pas par-pièce (ERP = doc admin, Carrez = mesures totales)
    if (fam === 'erp') return false
    if (fam === 'carrez') return rt !== 'wc' && rt !== 'cave' && rt !== 'grenier' && rt !== 'garage'
    // Amiante : surtout caves, combles, locaux techniques + tout le bâti pre-1997
    if (fam === 'amiante') return true // partout (matériaux suspects partout)
    // Plomb CREP : parties privatives + communes peintes (toutes pièces sauf cave/grenier nus)
    if (fam === 'plomb') return rt !== 'cave' && rt !== 'grenier' && rt !== 'garage'
    // Gaz : pièces avec appareils gaz potentiels
    if (fam === 'gaz') {
      return ['cuisine', 'salle_de_bain', 'buanderie', 'cave', 'garage', 'autre'].includes(rt)
    }
    // Élec : toutes pièces (prises, interrupteurs, équipotentielle SDB)
    if (fam === 'electricite') return true
    // Termites : pièces avec bois apparent (et caves/greniers en priorité)
    if (fam === 'termites') {
      return ['cave', 'grenier', 'garage', 'salon', 'sejour', 'chambre', 'cuisine', 'autre'].includes(rt)
    }
    // DPE : toutes pièces chauffées + cave/grenier pour isolation
    return true
  })
}

export interface RoomTask {
  id: string
  label: string
  diag: DiagType
  /** True si on peut auto-vérifier ailleurs (photo posée, equipment_finding posé) */
  auto?: boolean
  required?: boolean
}

/**
 * Tâches à faire dans une pièce pour un diag donné.
 * Heuristiques de bon sens + check-list métier simplifiée.
 */
export function tasksForRoomAndDiag(roomType: string | null, diag: DiagType): RoomTask[] {
  const rt = roomType ?? 'autre'
  const fam = diagFamily(diag)
  const tasks: RoomTask[] = []

  // Commun : photo + voix
  tasks.push({
    id: `${diag}_room_${rt}_photo`,
    label: 'Au moins 1 photo de la pièce',
    diag,
    auto: true,
  })

  if (fam === 'dpe') {
    if (['salon', 'sejour', 'chambre', 'cuisine', 'salle_de_bain', 'buanderie'].includes(rt)) {
      tasks.push({
        id: `${diag}_${rt}_emetteur`,
        label: 'Émetteur de chauffage identifié (radiateur, plancher chauffant…)',
        diag,
        required: true,
      })
      tasks.push({
        id: `${diag}_${rt}_vitrage`,
        label: 'Type de vitrage relevé (simple/double/triple)',
        diag,
        required: true,
      })
    }
    if (rt === 'cuisine' || rt === 'salle_de_bain' || rt === 'buanderie') {
      tasks.push({
        id: `${diag}_${rt}_ecs`,
        label: "Point d'eau chaude présent (lavabo/évier/douche)",
        diag,
      })
    }
    if (rt === 'cuisine' || rt === 'cave' || rt === 'buanderie') {
      tasks.push({
        id: `${diag}_${rt}_chaudiere`,
        label: 'Chaudière / chauffe-eau photographié (si présent)',
        diag,
      })
    }
    if (rt === 'grenier' || rt === 'cave') {
      tasks.push({
        id: `${diag}_${rt}_isolation`,
        label: "Type d'isolation (planchers/combles) photographié",
        diag,
        required: true,
      })
    }
  }

  if (fam === 'amiante') {
    tasks.push({
      id: `${diag}_${rt}_materiaux`,
      label: 'Matériaux suspects photographiés (sols, plafonds, conduits)',
      diag,
      required: true,
    })
    if (rt === 'cave' || rt === 'grenier' || rt === 'buanderie') {
      tasks.push({
        id: `${diag}_${rt}_flocage`,
        label: 'Flocage / calorifugeage vérifié',
        diag,
        required: true,
      })
    }
  }

  if (fam === 'plomb') {
    tasks.push({
      id: `${diag}_${rt}_xrf`,
      label: 'Mesures XRF effectuées (peintures)',
      diag,
      required: true,
    })
    tasks.push({
      id: `${diag}_${rt}_ecaillage`,
      label: "Photos des zones d'écaillage / dégradation",
      diag,
    })
  }

  if (fam === 'gaz') {
    if (rt === 'cuisine' || rt === 'cave' || rt === 'buanderie') {
      tasks.push({
        id: `${diag}_${rt}_appareil`,
        label: 'Appareil gaz identifié + photographié',
        diag,
        required: true,
      })
      tasks.push({
        id: `${diag}_${rt}_robinet`,
        label: "Robinet d'arrêt accessible et fonctionnel",
        diag,
        required: true,
      })
      tasks.push({
        id: `${diag}_${rt}_ventilation`,
        label: 'Ventilation haute/basse vérifiée',
        diag,
      })
    }
  }

  if (fam === 'electricite') {
    tasks.push({
      id: `${diag}_${rt}_prises`,
      label: 'Prises de courant inspectées',
      diag,
    })
    if (rt === 'salle_de_bain' || rt === 'cuisine') {
      tasks.push({
        id: `${diag}_${rt}_equipotentielle`,
        label: 'Liaison équipotentielle vérifiée',
        diag,
        required: true,
      })
    }
    if (rt === 'entree' || rt === 'cuisine' || rt === 'buanderie') {
      tasks.push({
        id: `${diag}_${rt}_tableau`,
        label: 'Tableau électrique photographié + disjoncteur 30mA vérifié',
        diag,
      })
    }
  }

  if (fam === 'termites') {
    tasks.push({
      id: `${diag}_${rt}_bois`,
      label: 'Éléments bois apparents inspectés (parquet, plinthes, charpente)',
      diag,
      required: true,
    })
    tasks.push({
      id: `${diag}_${rt}_indices`,
      label: 'Recherche indices (galeries, cordonnets, sciure)',
      diag,
    })
  }

  return tasks
}

/**
 * Évalue les tâches d'une pièce sur la base des données disponibles :
 * - photos taggées (room_id)
 * - voice notes (room_id + structured equipment)
 * - manual state (depuis dossier.metadata.roomTasksState)
 *
 * Retourne pour chaque (room, diag) la liste des tasks avec statut.
 */
export interface RoomTaskWithStatus extends RoomTask {
  status: 'auto_ok' | 'auto_pending' | 'manual'
  checked?: boolean
}

export interface RoomMatrixContext {
  photos: { room_id: string | null }[]
  voiceNotes: { room_id: string | null; transcript_structured: unknown }[]
  manualState: Record<string, boolean>
}

export function evaluateRoomTasks(
  roomId: string,
  roomType: string | null,
  diag: DiagType,
  ctx: RoomMatrixContext,
): RoomTaskWithStatus[] {
  const tasks = tasksForRoomAndDiag(roomType, diag)
  const hasPhotoInRoom = ctx.photos.some((p) => p.room_id === roomId)
  const voicesInRoom = ctx.voiceNotes.filter((v) => v.room_id === roomId)
  const equipmentInRoom: string[] = []
  for (const v of voicesInRoom) {
    const parsed = (v.transcript_structured as { equipment?: { kind: string }[] } | null) ?? null
    for (const e of parsed?.equipment ?? []) equipmentInRoom.push(e.kind)
  }

  return tasks.map((t): RoomTaskWithStatus => {
    if (t.auto) {
      // Photo de la pièce
      if (t.label.includes('photo')) {
        return { ...t, status: hasPhotoInRoom ? 'auto_ok' : 'auto_pending' }
      }
      return { ...t, status: 'auto_pending' }
    }

    // Auto-check basé sur l'extraction voice
    if (t.label.includes('Chaudière') && equipmentInRoom.includes('chaudiere')) {
      return { ...t, status: 'auto_ok' }
    }
    if (t.label.includes('Vitrage') && equipmentInRoom.includes('fenetre')) {
      return { ...t, status: 'auto_ok' }
    }
    if (t.label.includes('Tableau') && equipmentInRoom.includes('tableau_elec')) {
      return { ...t, status: 'auto_ok' }
    }
    if (t.label.includes('Isolation') && equipmentInRoom.includes('isolation')) {
      return { ...t, status: 'auto_ok' }
    }
    if (t.label.includes('Émetteur') && equipmentInRoom.includes('radiateur')) {
      return { ...t, status: 'auto_ok' }
    }
    if (t.label.includes('Ventilation') && equipmentInRoom.includes('ventilation')) {
      return { ...t, status: 'auto_ok' }
    }

    return {
      ...t,
      status: 'manual',
      checked: ctx.manualState[t.id] === true,
    }
  })
}
