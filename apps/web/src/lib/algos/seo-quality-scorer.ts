/**
 * KOVAS — Algo A1.3.12 : SEO page quality auto-scorer.
 *
 * Pure function qui score 0-100 la qualité d'une page programmatique (les
 * 35 000 pages SEO type [diagnostic]/[ville]) selon les signaux Helpful
 * Content Update Google (mars 2024 + mai 2026).
 *
 * Sert à :
 *   - Décider quelles pages refresh en priorité (refresh-city-stats batch)
 *   - Identifier les pages à dépublier (quality < 35 = thin content)
 *   - Alimenter le Kanban admin SEO
 *
 * Inputs lus depuis seo_page_quality_signals + agrégat data lake.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §A1.3.12.
 */

export type QualityBucket = 'thin' | 'mid' | 'good' | 'excellent'
export type RefreshReason =
  | 'high_bounce'
  | 'low_engagement'
  | 'no_real_diag'
  | 'no_local_data'
  | 'pogo_stick'
  | 'stale'
  | 'missing_signature'
  | 'duplicate_template'
  | 'low_word_count'
  | 'none'

export interface SeoQualityInput {
  /** Type de page */
  page_type: 'city' | 'department' | 'diagnostic_type' | 'guide' | 'other'
  /** Diagnostiqueur réel sur la page (pas mock/placeholder) */
  has_real_diagnostician: boolean
  /** Données locales réelles (ADEME/DVF/INSEE pour cette ville) */
  has_local_data: boolean
  /** Signature humaine présente (mention auteur, date révision) */
  has_human_signature: boolean
  /** Taux de rebond GSC 0-1, null = pas mesuré */
  bounce_rate: number | null
  /** Temps moyen sur la page en secondes, null = pas mesuré */
  avg_time_on_page_sec: number | null
  /** Nombre de mots du body principal */
  word_count: number | null
  /** Dernière révision du contenu (date ISO) */
  last_content_revision_at: string | null
  /** Pogo-sticking détecté (GSC bounce + return-to-SERP) */
  pogo_sticking_detected: boolean
  /** Page possède un template trop générique (similar_pages_count > 100) */
  is_duplicate_template: boolean
}

export interface SeoQualitySignal {
  code: string
  label: string
  points: number
  detail: string
}

export interface SeoQualityResult {
  /** Score 0-100 */
  quality_score: number
  /** Bucket dérivé */
  bucket: QualityBucket
  /** Raisons (peuvent être plusieurs) pour lesquelles refresh recommandé */
  refresh_reasons: ReadonlyArray<RefreshReason>
  /** Si true, page à dépublier (thin content au sens Google) */
  should_unpublish: boolean
  /** Si true, page à rafraîchir en priorité */
  needs_refresh: boolean
  /** Signaux contributeurs (audit + debug) */
  signals: ReadonlyArray<SeoQualitySignal>
  /** Recommandation lisible pour le diagnostiqueur / l'admin */
  human_message: string
}

/**
 * Pondération (max 100) selon Helpful Content Update :
 * - has_real_diagnostician   25  (signal expérience humaine fort)
 * - has_local_data           20  (signal expertise locale)
 * - has_human_signature      10  (signal autorité / EEAT)
 * - bounce_rate inverse      15  (engagement)
 * - avg_time_on_page         10  (engagement)
 * - word_count adapté        10  (≥800 mots pour city, ≥1500 pour guide)
 * - freshness                 5  (révisé < 6 mois)
 * - not pogo_sticking         3  (signal négatif fort si stuck)
 * - not duplicate_template    2
 */

function pointsRealDiag(has: boolean): SeoQualitySignal {
  return {
    code: 'REAL_DIAGNOSTICIAN',
    label: has ? 'Diagnostiqueur réel présenté' : 'Aucun diagnostiqueur réel sur la page',
    points: has ? 25 : 0,
    detail: has
      ? 'Signal Helpful Content : expérience humaine visible'
      : 'Page sans présence humaine → contenu thin au sens Google',
  }
}

function pointsLocalData(has: boolean): SeoQualitySignal {
  return {
    code: 'LOCAL_DATA',
    label: has ? 'Données locales présentes (ADEME/DVF/INSEE)' : 'Aucune donnée locale',
    points: has ? 20 : 0,
    detail: has
      ? 'Signal expertise locale : statistiques propres à la ville/département'
      : 'Page générique sans donnée locale → faible utilité',
  }
}

function pointsSignature(has: boolean): SeoQualitySignal {
  return {
    code: 'HUMAN_SIGNATURE',
    label: has ? 'Signature humaine + date de révision' : 'Aucune signature humaine',
    points: has ? 10 : 0,
    detail: has ? 'Signal EEAT (auteur identifié)' : 'Manque pour respecter EEAT',
  }
}

function pointsBounceRate(rate: number | null): SeoQualitySignal {
  if (rate == null) {
    return {
      code: 'BOUNCE_NULL',
      label: 'Bounce rate non mesuré',
      points: 8,
      detail: "Pas assez d'historique GSC — pondération neutre",
    }
  }
  // Bounce rate inversé : 0% = 15pts, 30% = 15, 50% = 10, 70% = 5, ≥80% = 0
  let pts: number
  if (rate <= 0.3) pts = 15
  else if (rate <= 0.5) pts = 10
  else if (rate <= 0.7) pts = 5
  else pts = 0
  return {
    code: 'BOUNCE_RATE',
    label: `Bounce rate : ${Math.round(rate * 100)}%`,
    points: pts,
    detail: rate <= 0.5 ? 'Engagement satisfaisant' : 'Engagement insuffisant',
  }
}

function pointsTimeOnPage(seconds: number | null): SeoQualitySignal {
  if (seconds == null) {
    return {
      code: 'TIME_NULL',
      label: 'Temps moyen non mesuré',
      points: 5,
      detail: 'Pas de GA4/GSC analytics — pondération neutre',
    }
  }
  // 0-30s = 0, 30-60s = 4, 60-120s = 7, 120-300s = 10, >300s = 10
  let pts: number
  if (seconds < 30) pts = 0
  else if (seconds < 60) pts = 4
  else if (seconds < 120) pts = 7
  else pts = 10
  return {
    code: 'TIME_ON_PAGE',
    label: `Temps moyen : ${Math.round(seconds)}s`,
    points: pts,
    detail:
      seconds < 60
        ? 'Lecture superficielle — risque pogo'
        : 'Lecture engagée, signal positif Google',
  }
}

function pointsWordCount(
  count: number | null,
  pageType: SeoQualityInput['page_type'],
): SeoQualitySignal {
  const target = pageType === 'guide' ? 1500 : 800
  if (count == null) {
    return {
      code: 'WORDS_NULL',
      label: 'Word count non extrait',
      points: 5,
      detail: 'Extraction body manquante',
    }
  }
  let pts: number
  if (count >= target) pts = 10
  else if (count >= target * 0.7) pts = 7
  else if (count >= target * 0.4) pts = 4
  else pts = 0
  return {
    code: 'WORD_COUNT',
    label: `Mots : ${count} (cible : ${target})`,
    points: pts,
    detail:
      count >= target * 0.7
        ? 'Volume éditorial suffisant'
        : 'Contenu trop court pour ranker durablement',
  }
}

function pointsFreshness(iso: string | null): SeoQualitySignal {
  if (!iso) {
    return {
      code: 'FRESHNESS_NULL',
      label: 'Date de révision absente',
      points: 0,
      detail: 'Pas de date affichée → signal EEAT manquant',
    }
  }
  const last = new Date(iso)
  if (Number.isNaN(last.getTime())) {
    return {
      code: 'FRESHNESS_INVALID',
      label: 'Date de révision invalide',
      points: 0,
      detail: 'Format de date corrompu',
    }
  }
  const days = (Date.now() - last.getTime()) / (24 * 60 * 60 * 1000)
  let pts: number
  if (days < 180) pts = 5
  else if (days < 365) pts = 3
  else if (days < 730) pts = 1
  else pts = 0
  return {
    code: 'FRESHNESS',
    label: `Révisé il y a ${Math.round(days)} jours`,
    points: pts,
    detail: days < 180 ? 'Fraîcheur OK' : 'Contenu vieillissant — refresh utile',
  }
}

function pointsPogoStick(detected: boolean): SeoQualitySignal {
  return {
    code: 'POGO_STICKING',
    label: detected ? 'Pogo-sticking détecté' : 'Pas de pogo-sticking',
    points: detected ? 0 : 3,
    detail: detected
      ? 'Les visiteurs reviennent à Google immédiatement (signal négatif fort)'
      : 'Visiteurs satisfaits',
  }
}

function pointsDuplicateTemplate(isDup: boolean): SeoQualitySignal {
  return {
    code: 'DUPLICATE_TEMPLATE',
    label: isDup ? 'Template trop générique' : 'Contenu unique',
    points: isDup ? 0 : 2,
    detail: isDup
      ? '> 100 pages avec le même template → pénalité Google'
      : 'Différenciation suffisante',
  }
}

function bucketFromScore(score: number): QualityBucket {
  if (score >= 75) return 'excellent'
  if (score >= 55) return 'good'
  if (score >= 35) return 'mid'
  return 'thin'
}

export function scoreSeoQuality(input: SeoQualityInput): SeoQualityResult {
  const signals: SeoQualitySignal[] = [
    pointsRealDiag(input.has_real_diagnostician),
    pointsLocalData(input.has_local_data),
    pointsSignature(input.has_human_signature),
    pointsBounceRate(input.bounce_rate),
    pointsTimeOnPage(input.avg_time_on_page_sec),
    pointsWordCount(input.word_count, input.page_type),
    pointsFreshness(input.last_content_revision_at),
    pointsPogoStick(input.pogo_sticking_detected),
    pointsDuplicateTemplate(input.is_duplicate_template),
  ]

  const score = Math.min(
    100,
    signals.reduce((acc, s) => acc + s.points, 0),
  )
  const bucket = bucketFromScore(score)

  // Refresh reasons (peuvent être multiples)
  const reasons: RefreshReason[] = []
  if (!input.has_real_diagnostician) reasons.push('no_real_diag')
  if (!input.has_local_data) reasons.push('no_local_data')
  if (!input.has_human_signature) reasons.push('missing_signature')
  if (input.bounce_rate != null && input.bounce_rate > 0.7) reasons.push('high_bounce')
  if (input.avg_time_on_page_sec != null && input.avg_time_on_page_sec < 30) {
    reasons.push('low_engagement')
  }
  if (input.pogo_sticking_detected) reasons.push('pogo_stick')
  if (input.is_duplicate_template) reasons.push('duplicate_template')
  if (input.word_count != null) {
    const target = input.page_type === 'guide' ? 1500 : 800
    if (input.word_count < target * 0.4) reasons.push('low_word_count')
  }
  if (input.last_content_revision_at) {
    const days =
      (Date.now() - new Date(input.last_content_revision_at).getTime()) / (24 * 60 * 60 * 1000)
    if (days > 365) reasons.push('stale')
  }
  if (reasons.length === 0) reasons.push('none')

  // Should unpublish si bucket=thin ET deux signaux thin fort
  const thinSignalsCount =
    Number(!input.has_real_diagnostician) +
    Number(!input.has_local_data) +
    Number(input.is_duplicate_template) +
    Number(input.pogo_sticking_detected)
  const shouldUnpublish = bucket === 'thin' && thinSignalsCount >= 2

  // Needs refresh si bucket < good (et pas à dépublier)
  const needsRefresh = !shouldUnpublish && bucket !== 'excellent' && bucket !== 'good'

  const humanMessage = (() => {
    if (shouldUnpublish) {
      return `Page de qualité insuffisante (${score}/100) — dépublication recommandée pour éviter une pénalité de site.`
    }
    if (needsRefresh) {
      return `Page à enrichir (${score}/100) — priorité de refresh : ${reasons.slice(0, 2).join(', ')}.`
    }
    if (bucket === 'good') {
      return `Page de bonne qualité (${score}/100) — quelques optimisations possibles.`
    }
    return `Page de qualité éditoriale élevée (${score}/100) — maintenir le suivi.`
  })()

  return {
    quality_score: score,
    bucket,
    refresh_reasons: reasons,
    should_unpublish: shouldUnpublish,
    needs_refresh: needsRefresh,
    signals,
    human_message: humanMessage,
  }
}
