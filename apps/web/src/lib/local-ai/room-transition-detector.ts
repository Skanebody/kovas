/**
 * Room transition detector — détecte les changements de pièce dans le
 * transcript utilisateur (texte ou voix transcrite).
 *
 * 100% local, regex/keywords, zéro réseau.
 *
 * Pieces reconnues (30+ keywords + variantes orthographiques FR) :
 * - salon / séjour / living
 * - cuisine
 * - chambre (+ ordinaux)
 * - salle de bain / sdb / salle d'eau
 * - WC / toilettes
 * - entrée / hall / vestibule
 * - couloir / corridor
 * - bureau
 * - dressing / penderie
 * - garage
 * - cave / sous-sol
 * - grenier / combles
 * - balcon / loggia / terrasse
 * - buanderie / cellier
 * - palier
 */

import { foldText } from './text-folding'

/** Type canonique de pièce (sortie normalisée). */
export type RoomType =
  | 'salon'
  | 'cuisine'
  | 'chambre'
  | 'salle_de_bain'
  | 'wc'
  | 'entree'
  | 'couloir'
  | 'bureau'
  | 'dressing'
  | 'garage'
  | 'cave'
  | 'grenier'
  | 'balcon'
  | 'terrasse'
  | 'loggia'
  | 'buanderie'
  | 'palier'

/** Résultat de détection d'une pièce dans un texte. */
export interface RoomDetection {
  /** Type canonique normalisé. */
  type: RoomType
  /** Libellé exact tel qu'il apparaissait dans le texte. */
  raw_label: string
  /** Position (index) dans le texte original. */
  position: number
  /** Score de confiance (0-1) — basé sur la spécificité du match. */
  confidence: number
}

/** Résultat d'une transition de pièce détectée. */
export interface RoomTransition {
  /** Pièce précédente (null si premier message). */
  from: RoomType | null
  /** Pièce vers laquelle on transite. */
  to: RoomType
  /** Timestamp de la détection. */
  detected_at: number
  /** Raw label de la pièce détectée. */
  raw_label: string
}

/** Vocabulaire pièces : mots-clés → type canonique. */
interface RoomKeyword {
  pattern: RegExp
  type: RoomType
  /** Confiance par défaut (0-1) — abaissée si keyword très court/générique. */
  confidence: number
}

const ROOM_KEYWORDS: ReadonlyArray<RoomKeyword> = [
  // salon / séjour
  { pattern: /\bsalon\b/i, type: 'salon', confidence: 0.95 },
  { pattern: /\bsejour\b/i, type: 'salon', confidence: 0.95 },
  { pattern: /\bpiece de vie\b/i, type: 'salon', confidence: 0.9 },
  { pattern: /\bliving( room)?\b/i, type: 'salon', confidence: 0.85 },
  { pattern: /\bsalle a manger\b/i, type: 'salon', confidence: 0.9 },
  // cuisine
  { pattern: /\bcuisine\b/i, type: 'cuisine', confidence: 0.95 },
  { pattern: /\bcoin cuisine\b/i, type: 'cuisine', confidence: 0.9 },
  { pattern: /\bkitchenette\b/i, type: 'cuisine', confidence: 0.9 },
  // chambres
  { pattern: /\bchambre( principale| parentale| des parents| d'amis| enfant| numero \d+| \d+)?\b/i, type: 'chambre', confidence: 0.95 },
  { pattern: /\bbedroom\b/i, type: 'chambre', confidence: 0.8 },
  // salles de bain
  { pattern: /\bsalle de bain[s]?\b/i, type: 'salle_de_bain', confidence: 0.95 },
  { pattern: /\bsalle d'eau\b/i, type: 'salle_de_bain', confidence: 0.95 },
  { pattern: /\bsdb\b/i, type: 'salle_de_bain', confidence: 0.9 },
  { pattern: /\bbathroom\b/i, type: 'salle_de_bain', confidence: 0.85 },
  // WC
  { pattern: /\bwc\b/i, type: 'wc', confidence: 0.95 },
  { pattern: /\btoilette[s]?\b/i, type: 'wc', confidence: 0.95 },
  { pattern: /\bcabinet[s]? d'aisance\b/i, type: 'wc', confidence: 0.9 },
  // entrée
  { pattern: /\bentree\b/i, type: 'entree', confidence: 0.9 },
  { pattern: /\bhall( d'entree)?\b/i, type: 'entree', confidence: 0.9 },
  { pattern: /\bvestibule\b/i, type: 'entree', confidence: 0.9 },
  // couloir
  { pattern: /\bcouloir\b/i, type: 'couloir', confidence: 0.9 },
  { pattern: /\bcorridor\b/i, type: 'couloir', confidence: 0.85 },
  { pattern: /\bdegagement\b/i, type: 'couloir', confidence: 0.85 },
  // bureau
  { pattern: /\bbureau\b/i, type: 'bureau', confidence: 0.9 },
  { pattern: /\bpiece de travail\b/i, type: 'bureau', confidence: 0.85 },
  // dressing
  { pattern: /\bdressing\b/i, type: 'dressing', confidence: 0.95 },
  { pattern: /\bpenderie\b/i, type: 'dressing', confidence: 0.9 },
  // garage
  { pattern: /\bgarage\b/i, type: 'garage', confidence: 0.95 },
  // cave / sous-sol
  { pattern: /\bcave\b/i, type: 'cave', confidence: 0.9 },
  { pattern: /\bsous[- ]?sol\b/i, type: 'cave', confidence: 0.9 },
  // grenier / combles
  { pattern: /\bgrenier\b/i, type: 'grenier', confidence: 0.95 },
  { pattern: /\bcomble[s]?\b/i, type: 'grenier', confidence: 0.9 },
  // balcon / terrasse / loggia
  { pattern: /\bbalcon\b/i, type: 'balcon', confidence: 0.95 },
  { pattern: /\bterrasse\b/i, type: 'terrasse', confidence: 0.95 },
  { pattern: /\bloggia\b/i, type: 'loggia', confidence: 0.95 },
  // buanderie / cellier
  { pattern: /\bbuanderie\b/i, type: 'buanderie', confidence: 0.95 },
  { pattern: /\bcellier\b/i, type: 'buanderie', confidence: 0.9 },
  // palier
  { pattern: /\bpalier\b/i, type: 'palier', confidence: 0.85 },
]

/** Mots déclencheurs de transition explicite (renforce confidence). */
const TRANSITION_TRIGGERS: ReadonlyArray<RegExp> = [
  /\bmaintenant (dans|on passe|on est dans|je suis dans)\b/i,
  /\bpassons (au|a la|aux|dans le|dans la)\b/i,
  /\bje passe (au|a la|aux|dans le|dans la)\b/i,
  /\bon va (au|a la|aux|dans le|dans la)\b/i,
  /\bdans le (suivant|prochain)\b/i,
  /\b(au|dans le|dans la|dans les|aux) (?=salon|cuisine|chambre|sdb|salle|wc|toilettes|bureau|couloir|garage|cave|grenier|comble|balcon|terrasse|loggia|buanderie|cellier|palier|entree)/i,
]

/**
 * Détecte la première pièce mentionnée dans un texte.
 * Si plusieurs pièces sont mentionnées, retourne celle avec le score le plus haut
 * (et la plus tardive si égalité — signal "transition vers").
 */
export function detectRoomInText(text: string): RoomDetection | null {
  const folded = foldText(text)
  const candidates: RoomDetection[] = []

  for (const { pattern, type, confidence } of ROOM_KEYWORDS) {
    const match = pattern.exec(folded)
    if (!match) continue

    let adjusted = confidence
    // Renforcer si un trigger de transition est présent à proximité
    for (const trigger of TRANSITION_TRIGGERS) {
      if (trigger.test(folded)) {
        adjusted = Math.min(1, adjusted + 0.1)
        break
      }
    }

    candidates.push({
      type,
      raw_label: match[0],
      position: match.index,
      confidence: adjusted,
    })
  }

  if (candidates.length === 0) return null

  // Priorité : score le plus haut, en cas d'égalité la position la plus tardive
  candidates.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence
    return b.position - a.position
  })

  return candidates[0]!
}

/**
 * Détecte si un message texte/voix introduit une transition de pièce.
 *
 * @param text Message utilisateur (texte ou transcript voix)
 * @param currentRoom Pièce courante avant ce message (null si aucune)
 * @param now Timestamp courant (injectable pour tests)
 * @returns Transition détectée ou null
 */
export function detectRoomTransition(
  text: string,
  currentRoom: RoomType | null,
  now: number = Date.now(),
): RoomTransition | null {
  const detected = detectRoomInText(text)
  if (!detected) return null
  // Seuil confiance minimum pour considérer une transition
  if (detected.confidence < 0.7) return null
  // Même pièce → pas de transition
  if (currentRoom === detected.type) return null

  return {
    from: currentRoom,
    to: detected.type,
    detected_at: now,
    raw_label: detected.raw_label,
  }
}

/** Libellé FR d'un type de pièce (UI). */
export const ROOM_LABEL_FR: Readonly<Record<RoomType, string>> = {
  salon: 'Salon',
  cuisine: 'Cuisine',
  chambre: 'Chambre',
  salle_de_bain: 'Salle de bain',
  wc: 'WC',
  entree: 'Entrée',
  couloir: 'Couloir',
  bureau: 'Bureau',
  dressing: 'Dressing',
  garage: 'Garage',
  cave: 'Cave',
  grenier: 'Grenier / combles',
  balcon: 'Balcon',
  terrasse: 'Terrasse',
  loggia: 'Loggia',
  buanderie: 'Buanderie',
  palier: 'Palier',
}
