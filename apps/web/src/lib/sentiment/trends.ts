/**
 * KOVAS — Système 9 : Trend detection sur sentiment analyses agrégées.
 *
 * Pure functions qui agrègent N analyses de sentiment sur une fenêtre
 * temporelle (ex: 7 derniers jours) et détectent les dégradations vs
 * une fenêtre de référence (ex: 30 derniers jours).
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` (Système 9 — Sentiment monitoring,
 * sous-partie "Trend detection & alerting").
 *
 * Use case côté caller :
 *   1. Cron quotidien lit `sentiment_analyses` table (résultat analyzer.ts)
 *      sur fenêtre 7j et 30j.
 *   2. Appelle aggregateByTopic() sur chaque fenêtre.
 *   3. Appelle detectDegradation() pour générer alertes admin.
 *   4. Persiste les alertes + notifie via Slack/email.
 *
 * Déterministe, testable, zéro IO.
 */

import type { SentimentAnalysisResult, Topic, Urgency } from './analyzer'

export interface AggregatedTopic {
  topic: Topic
  avg_sentiment_score: number
  message_count: number
  urgency_distribution: Record<Urgency, number>
  /** Top 5 phrases-clés les plus fréquentes sur ce topic */
  top_phrases: string[]
}

export interface TrendAlert {
  topic: Topic
  /** current_avg - previous_avg (négatif = dégradation) */
  delta: number
  current_avg: number
  previous_avg: number
  message_count_current: number
  severity: 'info' | 'warning' | 'critical'
  /** Phrase humaine prête pour l'admin UI (tutoiement, sobre) */
  human_message: string
}

const ALL_URGENCIES: ReadonlyArray<Urgency> = ['low', 'medium', 'high', 'critical']

const TOPIC_LABEL_FR: Record<Topic, string> = {
  pricing: 'pricing',
  voice_capture: 'saisie vocale',
  cross_check: 'cross-check',
  liciel_export: 'export Liciel',
  annuaire: 'annuaire',
  mission_flow: 'flux mission',
  billing: 'facturation',
  bug: 'bug',
  support: 'support',
  feature_request: 'demande de feature',
  ademe: 'ADEME',
  other: 'autre',
}

/**
 * Agrège un ensemble d'analyses par topic.
 *
 * Chaque analyse peut avoir plusieurs topics (max 3) → chaque topic
 * compte 1 mention dans son bucket. Le score sentiment est moyenné
 * sur les mentions, pas pondéré.
 *
 * @example
 * ```ts
 * const agg = aggregateByTopic([analysis1, analysis2, ...])
 * // → [
 * //     { topic: 'voice_capture', avg_sentiment_score: -0.35, message_count: 12, ... },
 * //     ...
 * //   ]
 * ```
 */
export function aggregateByTopic(
  analyses: ReadonlyArray<SentimentAnalysisResult>,
): AggregatedTopic[] {
  // Map topic → { sum_score, count, urgency_counts, phrase_counts }
  const buckets = new Map<
    Topic,
    {
      sum_score: number
      count: number
      urgencyCounts: Record<Urgency, number>
      phraseCounts: Map<string, number>
    }
  >()

  for (const a of analyses) {
    for (const topic of a.topics) {
      let bucket = buckets.get(topic)
      if (!bucket) {
        bucket = {
          sum_score: 0,
          count: 0,
          urgencyCounts: { low: 0, medium: 0, high: 0, critical: 0 },
          phraseCounts: new Map(),
        }
        buckets.set(topic, bucket)
      }
      bucket.sum_score += a.sentiment_score
      bucket.count += 1
      bucket.urgencyCounts[a.urgency] += 1
      for (const phrase of a.key_phrases) {
        const normalized = phrase.toLowerCase().trim()
        if (normalized === '') continue
        bucket.phraseCounts.set(normalized, (bucket.phraseCounts.get(normalized) ?? 0) + 1)
      }
    }
  }

  const result: AggregatedTopic[] = []
  for (const [topic, bucket] of buckets.entries()) {
    // Top 5 phrases par fréquence (puis ordre alphabétique pour déterminisme)
    const top_phrases = Array.from(bucket.phraseCounts.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1]
        return a[0].localeCompare(b[0])
      })
      .slice(0, 5)
      .map(([phrase]) => phrase)

    result.push({
      topic,
      avg_sentiment_score: bucket.sum_score / bucket.count,
      message_count: bucket.count,
      urgency_distribution: { ...bucket.urgencyCounts },
      top_phrases,
    })
  }

  // Tri stable par message_count desc puis topic asc
  result.sort((a, b) => {
    if (b.message_count !== a.message_count) return b.message_count - a.message_count
    return a.topic.localeCompare(b.topic)
  })

  return result
}

function severityFromDelta(delta: number): 'info' | 'warning' | 'critical' | null {
  if (delta <= -0.4) return 'critical'
  if (delta <= -0.2) return 'warning'
  return null
}

const SEVERITY_RANK: Record<'info' | 'warning' | 'critical', number> = {
  info: 0,
  warning: 1,
  critical: 2,
}

function formatScore(n: number): string {
  return n.toFixed(2)
}

function buildAlertMessage(
  topic: Topic,
  delta: number,
  prev: number,
  current: number,
  count: number,
): string {
  return `Topic ${TOPIC_LABEL_FR[topic]} dégradation ${formatScore(delta)} sur ${count} mentions (de ${formatScore(prev)} à ${formatScore(current)})`
}

/**
 * Détecte les topics qui se dégradent significativement vs la fenêtre
 * de référence. Seuil minimum : 5 mentions dans current_window.
 *
 * Règles :
 *   - delta = current_avg - previous_avg
 *   - delta ≤ -0.4 → severity 'critical'
 *   - delta ≤ -0.2 → severity 'warning'
 *   - sinon → topic non inclus dans alerts
 *   - tri : severity desc puis message_count desc
 *
 * @example
 * ```ts
 * const alerts = detectDegradation(
 *   analyzesLast7Days,
 *   analyzesLast30Days,
 * )
 * // → [
 * //     { topic: 'voice_capture', delta: -0.42, severity: 'critical', ... },
 * //     ...
 * //   ]
 * ```
 */
export function detectDegradation(
  current_window: ReadonlyArray<SentimentAnalysisResult>,
  previous_window: ReadonlyArray<SentimentAnalysisResult>,
): TrendAlert[] {
  const currentAgg = aggregateByTopic(current_window)
  const previousAgg = aggregateByTopic(previous_window)

  const prevByTopic = new Map<Topic, AggregatedTopic>()
  for (const a of previousAgg) prevByTopic.set(a.topic, a)

  const alerts: TrendAlert[] = []

  for (const current of currentAgg) {
    // Seuil minimum 5 mentions dans current_window
    if (current.message_count < 5) continue

    const previous = prevByTopic.get(current.topic)
    // Si le topic n'existait pas avant, on ne peut pas calculer un delta
    // → on skip (pas d'historique pour comparer).
    if (!previous) continue

    const delta = current.avg_sentiment_score - previous.avg_sentiment_score
    const severity = severityFromDelta(delta)
    if (!severity) continue

    alerts.push({
      topic: current.topic,
      delta,
      current_avg: current.avg_sentiment_score,
      previous_avg: previous.avg_sentiment_score,
      message_count_current: current.message_count,
      severity,
      human_message: buildAlertMessage(
        current.topic,
        delta,
        previous.avg_sentiment_score,
        current.avg_sentiment_score,
        current.message_count,
      ),
    })
  }

  // Tri : severity desc puis message_count desc puis topic asc (déterminisme)
  alerts.sort((a, b) => {
    if (SEVERITY_RANK[b.severity] !== SEVERITY_RANK[a.severity]) {
      return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    }
    if (b.message_count_current !== a.message_count_current) {
      return b.message_count_current - a.message_count_current
    }
    return a.topic.localeCompare(b.topic)
  })

  return alerts
}

// Re-export pour les consommateurs
export { ALL_URGENCIES }
