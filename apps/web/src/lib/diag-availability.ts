/**
 * KOVAS — Helpers de réactivité/fraîcheur pour la fiche publique diagnostiqueur.
 *
 * Pure-fn déterministes (zéro IO) qui calculent les libellés affichés dans la
 * section "Réactivité & vérification" de la fiche publique (modèle Doctolib
 * SOBRE — pas d'illusion de booking temps réel, juste des signaux honnêtes).
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §6.3 (GC3 Annuaire B2C enrichi) + avatar
 * client sobre/professionnel (vouvoiement, jamais d'emoji gaming).
 */

export type ResponseSpeedBucket = 'fast' | 'standard' | 'slow' | 'unknown'

export interface AvailabilitySignals {
  /** Phrase sobre type "Répond généralement sous X heures" (NULL si data insuffisante) */
  responseSentence: string | null
  /** Bucket pour la pastille visuelle ("fast" = chartreuse, "standard" = navy clair, etc.) */
  responseBucket: ResponseSpeedBucket
  /** Phrase sobre type "Profil vérifié le 12 mai 2026" (NULL si jamais vérifié) */
  verifiedSentence: string | null
  /** Phrase sobre type "Mis à jour le 22 mai 2026" */
  updatedSentence: string | null
  /** Nombre d'éléments à afficher (utile pour ne pas afficher la section si 0) */
  signalsCount: number
}

interface ComputeAvailabilityInput {
  /** Médiane de réponse aux N derniers leads (en minutes). NULL = pas assez de data. */
  median_response_minutes: number | null
  /** Nombre de leads échantillon (pour décider si la médiane est fiable) */
  sample_size: number
  /** Date dernière vérification (cross-validation COFRAC/SIRENE/INPI) — peut être NULL */
  last_verified_at: string | Date | null
  /** Date dernière mise à jour profil (toujours non-NULL en pratique) */
  updated_at: string | Date | null
  /** Date de référence pour les calculs (default: now()) — facilite les tests */
  now?: Date
}

/**
 * Bucket de vitesse de réponse à partir d'une médiane (en minutes).
 * Seuils calibrés conservativement (modèle Doctolib) :
 *   - fast : <= 4h (signal Premium, mérite badge chartreuse)
 *   - standard : <= 24h ouvrées (objectif annoncé sur la fiche CTA devis)
 *   - slow : > 24h (signal honnête sans cacher la réalité)
 */
export function bucketResponseSpeed(minutes: number | null): ResponseSpeedBucket {
  if (minutes === null || minutes < 0) return 'unknown'
  if (minutes <= 4 * 60) return 'fast'
  if (minutes <= 24 * 60) return 'standard'
  return 'slow'
}

/**
 * Formate une phrase sobre du type "Répond généralement sous X heures".
 * Jamais d'emoji ni de gamification. Si data insuffisante ou bucket inconnu,
 * retourne NULL pour que l'UI omette le bloc plutôt que d'afficher du vide.
 */
export function formatResponseSentence(
  minutes: number | null,
  sample_size: number,
): { sentence: string | null; bucket: ResponseSpeedBucket } {
  // Seuil de fiabilité : il faut au moins 3 leads de référence pour publier une médiane.
  if (sample_size < 3 || minutes === null) {
    return { sentence: null, bucket: 'unknown' }
  }

  const bucket = bucketResponseSpeed(minutes)

  if (bucket === 'fast') {
    if (minutes <= 60) return { sentence: 'Répond généralement sous 1 heure', bucket }
    if (minutes <= 120) return { sentence: 'Répond généralement sous 2 heures', bucket }
    return { sentence: 'Répond généralement sous 4 heures', bucket }
  }
  if (bucket === 'standard') {
    if (minutes <= 8 * 60) return { sentence: 'Répond généralement sous 8 heures', bucket }
    return { sentence: 'Répond généralement sous 24 heures ouvrées', bucket }
  }
  if (bucket === 'slow') {
    if (minutes <= 48 * 60) return { sentence: 'Répond généralement sous 48 heures', bucket }
    return { sentence: 'Répond généralement sous quelques jours', bucket }
  }
  return { sentence: null, bucket: 'unknown' }
}

const MOIS_FR: ReadonlyArray<string> = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

function parseDateInput(input: string | Date | null): Date | null {
  if (input === null) return null
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Formate une date FR sobre : "12 mai 2026" (jamais d'heure côté fiche publique
 * pour ne pas donner illusion d'un suivi temps réel).
 */
export function formatDateFr(input: string | Date | null): string | null {
  const d = parseDateInput(input)
  if (!d) return null
  const day = d.getUTCDate()
  const month = MOIS_FR[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} ${month} ${year}`
}

/**
 * Phrase de vérification sobre. Si jamais vérifié, retourne NULL.
 * Si vérifié il y a > 180 jours, suffixe discret "(vérification renouvelée régulièrement)".
 */
export function formatVerifiedSentence(
  last_verified_at: string | Date | null,
  now: Date = new Date(),
): string | null {
  const d = parseDateInput(last_verified_at)
  if (!d) return null
  const formatted = formatDateFr(d)
  if (!formatted) return null
  const ageMs = now.getTime() - d.getTime()
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
  if (ageDays <= 30) {
    return `Profil vérifié le ${formatted}`
  }
  if (ageDays <= 180) {
    return `Profil vérifié le ${formatted}`
  }
  return `Profil vérifié le ${formatted} (vérification renouvelée régulièrement)`
}

/**
 * Phrase de mise à jour sobre.
 */
export function formatUpdatedSentence(updated_at: string | Date | null): string | null {
  const formatted = formatDateFr(updated_at)
  if (!formatted) return null
  return `Profil mis à jour le ${formatted}`
}

/**
 * Composition finale — utilisée par le server component.
 * Toutes les phrases peuvent être NULL indépendamment (la section masque ses
 * lignes une par une plutôt que de tout cacher).
 */
export function computeAvailabilitySignals(input: ComputeAvailabilityInput): AvailabilitySignals {
  const now = input.now ?? new Date()
  const responseSpeed = formatResponseSentence(input.median_response_minutes, input.sample_size)
  const verifiedSentence = formatVerifiedSentence(input.last_verified_at, now)
  const updatedSentence = formatUpdatedSentence(input.updated_at)

  let count = 0
  if (responseSpeed.sentence) count += 1
  if (verifiedSentence) count += 1
  if (updatedSentence) count += 1

  return {
    responseSentence: responseSpeed.sentence,
    responseBucket: responseSpeed.bucket,
    verifiedSentence,
    updatedSentence,
    signalsCount: count,
  }
}
