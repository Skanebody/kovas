/**
 * ChecklistTracker — moteur de tracking en temps réel des items checklist
 * couverts par les messages utilisateur (texte ou voix transcrite).
 *
 * 100% local, déterministe, zéro réseau. Aucun side effect global —
 * 1 instance par mission (durée de vie = capture-first session).
 *
 * Flux d'utilisation typique :
 *   const tracker = new ChecklistTracker(['dpe', 'amiante'], Date.now())
 *   const event = tracker.processMessage({ kind: 'text', text: '...', at: now })
 *   if (event.transition) { /* afficher TransitionAlert *\/ }
 *   if (event.overdue.length) { /* afficher MissingFieldQuestion *\/ }
 *   const status = tracker.getCompletionStatus()  // pour ChecklistPanel
 *
 * Sources :
 * - Checklists métier dans `./checklists/*.ts`
 * - Détection pièce dans `./room-transition-detector.ts`
 * - Lexique métier (jargon) côté Whisper/Claude, pas requis ici (keywords inline)
 */

import { getChecklists, type DiagnosticKind } from './checklists'
import type { ChecklistItem, ChecklistSection } from './checklists/types'
import {
  type RoomType,
  ROOM_LABEL_FR,
  detectRoomTransition,
  detectRoomInText,
} from './room-transition-detector'
import { containsAnyKeyword, foldText } from './text-folding'

// ============================================================================
// Types publics
// ============================================================================

/** Message ingéré par le tracker. */
export type TrackerMessage =
  | {
      kind: 'text' | 'audio_transcript'
      text: string
      /** Timestamp Unix ms. */
      at: number
    }
  | {
      kind: 'photo'
      /** Légende ou contexte de la photo (optionnel). */
      caption?: string
      /** Pièce où la photo a été prise (si connue). */
      room?: RoomType | null
      /** Mots-clés du contexte (équipement détecté). */
      tags?: readonly string[]
      at: number
    }

/** État d'un item suivi. */
export interface ItemState {
  item: ChecklistItem
  covered: boolean
  /** Timestamp ms de la première couverture. */
  covered_at: number | null
  /** Pour les items per_room : pièces où c'est couvert. */
  covered_in_rooms: Set<RoomType>
  /** Nombre de photos attribuées. */
  photos_count: number
  /** Mention dans transcript (texte couvrant). */
  evidence_text: string | null
}

/** Item en retard de couverture (overdue). */
export interface OverdueItem {
  item: ChecklistItem
  /** Combien de temps depuis le début de la mission. */
  elapsed_ms: number
  /** Pour les items per_room : la pièce concernée. */
  room: RoomType | null
}

/** Événement produit lors du traitement d'un message. */
export interface ProcessMessageEvent {
  /** Items nouvellement couverts par ce message. */
  newly_covered: ChecklistItem[]
  /** Transition de pièce détectée par ce message. */
  transition: RoomTransitionEvent | null
  /** Items overdue actifs à la fin du processMessage. */
  overdue: OverdueItem[]
}

/** Transition de pièce avec les items per_room restés non couverts. */
export interface RoomTransitionEvent {
  from: RoomType | null
  to: RoomType
  raw_label: string
  /** Items per_room obligatoires (severity = critical/important) non couverts dans `from`. */
  per_room_gaps: ChecklistItem[]
}

/** Statut complet (vue ChecklistPanel + CheckoutScreen). */
export interface CompletionStatus {
  /** Diagnostics suivis. */
  diagnostics: DiagnosticKind[]
  /** Items couverts (toutes scopes confondues). */
  covered: ChecklistItem[]
  /** Items critiques non couverts. */
  missing_critical: ChecklistItem[]
  /** Items importants non couverts (warning). */
  missing_important: ChecklistItem[]
  /** Items optionnels non couverts (info). */
  missing_optional: ChecklistItem[]
  /** Items nécessitant une photo mais sans photo encore. */
  photos_missing: ChecklistItem[]
  /** Pourcentage [0-100] basé sur items required uniquement. */
  percentage: number
  /** Détail par section (diagnostic.section_id → covered/total). */
  by_section: SectionProgress[]
  /** Pièces visitées (pour debug et CheckoutScreen). */
  rooms_visited: RoomType[]
  /** Pièce courante (dernière transition). */
  current_room: RoomType | null
}

/** Progression par section (UI panel). */
export interface SectionProgress {
  diagnostic: DiagnosticKind
  section_id: string
  section_label: string
  covered_count: number
  total_count: number
  /** Items required de la section non encore couverts. */
  remaining_required: ChecklistItem[]
}

// ============================================================================
// ChecklistTracker
// ============================================================================

/**
 * Moteur principal. Stateful, 1 instance par mission.
 *
 * Pure JS / TS — pas de dépendance React, IndexedDB ou réseau.
 * Le snapshot est récupérable via `toJSON()` pour persistance offline.
 */
export class ChecklistTracker {
  private readonly diagnostics: DiagnosticKind[]
  private readonly missionStartedAt: number
  /** Items globaux indexés par id. */
  private readonly itemsById: Map<string, ItemState>
  /** Items par section pour reconstruction rapide. */
  private readonly sections: Array<{
    diagnostic: DiagnosticKind
    section: ChecklistSection
  }>

  private currentRoom: RoomType | null = null
  private readonly roomsVisited: Set<RoomType> = new Set()

  constructor(diagnostics: readonly DiagnosticKind[], missionStartedAt: number) {
    if (diagnostics.length === 0) {
      throw new Error('ChecklistTracker requires at least one diagnostic')
    }
    this.diagnostics = [...diagnostics]
    this.missionStartedAt = missionStartedAt
    this.itemsById = new Map()
    this.sections = []

    for (const checklist of getChecklists(this.diagnostics)) {
      for (const section of checklist.sections) {
        this.sections.push({ diagnostic: checklist.diagnostic, section })
        for (const item of section.items) {
          this.itemsById.set(this.makeStateKey(item, null), {
            item,
            covered: false,
            covered_at: null,
            covered_in_rooms: new Set(),
            photos_count: 0,
            evidence_text: null,
          })
        }
      }
    }
  }

  /**
   * Génère la clé d'état d'un item. Pour scope `per_room`, la clé inclut la pièce
   * (les items per_room ont 1 état par pièce visitée). Pour `global`, clé sans pièce.
   */
  private makeStateKey(item: ChecklistItem, room: RoomType | null): string {
    if (item.scope === 'per_room' && room) {
      return `${item.id}::${room}`
    }
    return item.id
  }

  /**
   * Traite un nouveau message et met à jour le tracker.
   * Retourne un event décrivant les changements (UI peut réagir).
   */
  processMessage(message: TrackerMessage): ProcessMessageEvent {
    const newlyCovered: ChecklistItem[] = []
    let transition: RoomTransitionEvent | null = null

    // ── 1. Détecter transition de pièce (uniquement pour texte/audio)
    if (message.kind === 'text' || message.kind === 'audio_transcript') {
      const transitionRaw = detectRoomTransition(message.text, this.currentRoom, message.at)
      if (transitionRaw) {
        // Calculer les gaps per_room dans la pièce qu'on quitte
        const perRoomGaps =
          transitionRaw.from !== null ? this.computePerRoomGaps(transitionRaw.from) : []
        transition = {
          from: transitionRaw.from,
          to: transitionRaw.to,
          raw_label: transitionRaw.raw_label,
          per_room_gaps: perRoomGaps,
        }
        this.currentRoom = transitionRaw.to
        this.roomsVisited.add(transitionRaw.to)
      } else {
        // Pas de transition explicite, mais une pièce détectée → maj currentRoom
        const detected = detectRoomInText(message.text)
        if (detected && detected.confidence >= 0.8 && this.currentRoom === null) {
          this.currentRoom = detected.type
          this.roomsVisited.add(detected.type)
        }
      }
    } else if (message.kind === 'photo' && message.room && message.room !== this.currentRoom) {
      // Photo prise dans une pièce explicite (info contextuelle, pas une transition)
      this.roomsVisited.add(message.room)
    }

    // ── 2. Cross-référencer keywords des items avec le contenu du message
    const haystack = this.extractHaystack(message)
    for (const [, state] of this.itemsById) {
      // Pour scope per_room : on instancie l'état dans la pièce courante au besoin
      if (state.item.scope === 'per_room') {
        const roomForCheck = message.kind === 'photo' && message.room ? message.room : this.currentRoom
        if (!roomForCheck) continue
        const key = this.makeStateKey(state.item, roomForCheck)
        let perRoomState = this.itemsById.get(key)
        if (!perRoomState) {
          perRoomState = {
            item: state.item,
            covered: false,
            covered_at: null,
            covered_in_rooms: new Set(),
            photos_count: 0,
            evidence_text: null,
          }
          this.itemsById.set(key, perRoomState)
        }

        // Photo requise et présente
        if (message.kind === 'photo' && state.item.requires_photo) {
          if (this.photoMatchesItem(message, state.item)) {
            perRoomState.photos_count += 1
            if (!perRoomState.covered) {
              perRoomState.covered = true
              perRoomState.covered_at = message.at
              perRoomState.covered_in_rooms.add(roomForCheck)
              newlyCovered.push(state.item)
            }
          }
          continue
        }

        if (haystack && containsAnyKeyword(haystack, state.item.keywords)) {
          if (!perRoomState.covered) {
            perRoomState.covered = true
            perRoomState.covered_at = message.at
            perRoomState.evidence_text = this.extractEvidence(haystack, state.item.keywords)
            perRoomState.covered_in_rooms.add(roomForCheck)
            newlyCovered.push(state.item)
          }
        }
        continue
      }

      // Scope global et per_equipment : 1 état total
      if (state.covered) continue

      if (message.kind === 'photo' && state.item.requires_photo) {
        if (this.photoMatchesItem(message, state.item)) {
          state.photos_count += 1
          state.covered = true
          state.covered_at = message.at
          newlyCovered.push(state.item)
        }
        continue
      }

      if (haystack && containsAnyKeyword(haystack, state.item.keywords)) {
        state.covered = true
        state.covered_at = message.at
        state.evidence_text = this.extractEvidence(haystack, state.item.keywords)
        newlyCovered.push(state.item)
      }
    }

    return {
      newly_covered: newlyCovered,
      transition,
      overdue: this.getOverdueQuestions(message.at),
    }
  }

  /**
   * Détecte les transitions de pièce et renvoie les items per_room manquants
   * pour la pièce précédente — invoqué manuellement (utile pour pré-checkout).
   */
  detectRoomTransitionWithGaps(
    message: string,
    currentRoom: RoomType | null,
    now: number = Date.now(),
  ): RoomTransitionEvent | null {
    const tr = detectRoomTransition(message, currentRoom, now)
    if (!tr) return null
    const gaps = tr.from !== null ? this.computePerRoomGaps(tr.from) : []
    return { ...tr, per_room_gaps: gaps }
  }

  /**
   * Calcule les items per_room critiques/importants non couverts dans la pièce
   * `room`.
   */
  private computePerRoomGaps(room: RoomType): ChecklistItem[] {
    const gaps: ChecklistItem[] = []
    for (const [, state] of this.itemsById) {
      if (state.item.scope !== 'per_room') continue
      if (state.item.severity === 'optional') continue
      if (!state.item.required) continue
      const key = this.makeStateKey(state.item, room)
      const perRoomState = this.itemsById.get(key)
      if (!perRoomState || !perRoomState.covered) {
        gaps.push(state.item)
      }
    }
    return gaps
  }

  /** Renvoie les items required dont le délai d'attente est dépassé. */
  getOverdueQuestions(now: number = Date.now()): OverdueItem[] {
    const elapsed = now - this.missionStartedAt
    const overdue: OverdueItem[] = []
    const seen = new Set<string>()

    for (const [, state] of this.itemsById) {
      if (state.covered) continue
      if (!state.item.required) continue
      if (state.item.severity === 'optional') continue
      if (elapsed < state.item.trigger_question_after_ms) continue
      // Dedupe sur item.id (per_room peut avoir N états — on remonte 1 fois)
      if (seen.has(state.item.id)) continue
      seen.add(state.item.id)

      overdue.push({
        item: state.item,
        elapsed_ms: elapsed,
        room: state.item.scope === 'per_room' ? this.currentRoom : null,
      })
    }
    return overdue
  }

  /** Bilan complet (pour ChecklistPanel + CheckoutScreen). */
  getCompletionStatus(): CompletionStatus {
    const covered: ChecklistItem[] = []
    const missingCritical: ChecklistItem[] = []
    const missingImportant: ChecklistItem[] = []
    const missingOptional: ChecklistItem[] = []
    const photosMissing: ChecklistItem[] = []
    const seenForCovered = new Set<string>()
    const seenForMissing = new Set<string>()

    for (const [, state] of this.itemsById) {
      if (state.covered) {
        if (!seenForCovered.has(state.item.id)) {
          seenForCovered.add(state.item.id)
          covered.push(state.item)
        }
        if (state.item.requires_photo && state.photos_count === 0) {
          if (!photosMissing.find((i) => i.id === state.item.id)) {
            photosMissing.push(state.item)
          }
        }
      } else {
        if (seenForMissing.has(state.item.id)) continue
        seenForMissing.add(state.item.id)
        if (state.item.severity === 'critical') missingCritical.push(state.item)
        else if (state.item.severity === 'important') missingImportant.push(state.item)
        else missingOptional.push(state.item)
      }
    }

    // Pourcentage = couvert / required total (critical + important)
    const totalRequired = covered.length + missingCritical.length + missingImportant.length
    const percentage = totalRequired === 0 ? 100 : Math.round((covered.length / totalRequired) * 100)

    return {
      diagnostics: [...this.diagnostics],
      covered,
      missing_critical: missingCritical,
      missing_important: missingImportant,
      missing_optional: missingOptional,
      photos_missing: photosMissing,
      percentage,
      by_section: this.buildSectionProgress(),
      rooms_visited: Array.from(this.roomsVisited),
      current_room: this.currentRoom,
    }
  }

  private buildSectionProgress(): SectionProgress[] {
    const result: SectionProgress[] = []
    for (const { diagnostic, section } of this.sections) {
      let coveredCount = 0
      const remainingRequired: ChecklistItem[] = []
      const seenItems = new Set<string>()
      for (const item of section.items) {
        if (seenItems.has(item.id)) continue
        seenItems.add(item.id)
        const key = this.makeStateKey(item, null)
        const state = this.itemsById.get(key)
        if (state?.covered) {
          coveredCount += 1
        } else if (item.required && item.severity !== 'optional') {
          remainingRequired.push(item)
        }
      }
      result.push({
        diagnostic,
        section_id: section.id,
        section_label: section.label,
        covered_count: coveredCount,
        total_count: section.items.length,
        remaining_required: remainingRequired,
      })
    }
    return result
  }

  /** Pièce courante du tracker. */
  getCurrentRoom(): RoomType | null {
    return this.currentRoom
  }

  /** Force la pièce courante (utilisé par UI sélection manuelle). */
  setCurrentRoom(room: RoomType | null): void {
    this.currentRoom = room
    if (room) this.roomsVisited.add(room)
  }

  /** Pièces visitées. */
  getRoomsVisited(): readonly RoomType[] {
    return Array.from(this.roomsVisited)
  }

  /** Label FR d'une pièce. */
  static labelOfRoom(room: RoomType): string {
    return ROOM_LABEL_FR[room]
  }

  /** Liste des diagnostics suivis. */
  getDiagnostics(): readonly DiagnosticKind[] {
    return this.diagnostics
  }

  // ── Helpers internes ──────────────────────────────────────────────────────

  private extractHaystack(message: TrackerMessage): string {
    if (message.kind === 'photo') {
      const parts: string[] = []
      if (message.caption) parts.push(message.caption)
      if (message.tags && message.tags.length) parts.push(...message.tags)
      return parts.join(' ')
    }
    return message.text
  }

  private photoMatchesItem(
    message: Extract<TrackerMessage, { kind: 'photo' }>,
    item: ChecklistItem,
  ): boolean {
    // Photo générique = couverte si scope = per_room + item d'overview pièce
    // (cas du dpe_room_photo : pas de keyword spécifique requis si pièce connue)
    if (item.id.endsWith('_photo') && item.scope === 'per_room') {
      return true
    }
    // Sinon, on essaye de matcher caption + tags
    const haystack = this.extractHaystack(message)
    if (!haystack) return false
    return containsAnyKeyword(haystack, item.keywords)
  }

  /** Extrait jusqu'à 80 caractères autour du premier keyword matché. */
  private extractEvidence(haystack: string, keywords: readonly string[]): string {
    const folded = foldText(haystack)
    for (const kw of keywords) {
      const idx = folded.indexOf(foldText(kw))
      if (idx >= 0) {
        const start = Math.max(0, idx - 30)
        const end = Math.min(haystack.length, idx + kw.length + 30)
        return haystack.slice(start, end).trim()
      }
    }
    return haystack.slice(0, 80).trim()
  }
}
