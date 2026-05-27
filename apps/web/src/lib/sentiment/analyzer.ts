/**
 * KOVAS — Système 9 : Sentiment analyzer.
 *
 * Pure function qui prend la réponse JSON brute de Claude Haiku (analyse
 * d'un message utilisateur — support ticket, review, survey, in-app chat,
 * email reply) + le message original + son contexte, valide le schéma,
 * applique les règles métier KOVAS (override urgency/intent selon keywords,
 * rating, tenure) et retourne une analyse structurée.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` (Système 9 — Sentiment monitoring).
 *
 * Stratégie :
 *   - Claude Haiku donne un score brut (-1 à +1) + topics + urgency + intent.
 *   - On clamp les scores, on mappe les topics vers l'enum KOVAS, on garde max 3.
 *   - Règles métier prioritaires sur la classification IA :
 *       · keywords churn FR → force intent=churn_signal + urgency≥high
 *       · rating ≤ 2 (review) → force intent=complaint + urgency≥high
 *       · keywords bug → force topic=bug + urgency≥medium
 *       · user fidèle (tenure≥12) + complaint → urgency upgrade d'1 cran
 *   - Deux flags actionnables : triggers_retention, triggers_immediate_response.
 *
 * Déterministe, testable, zéro IO. Le caller (Edge Function Supabase)
 * fournit le payload Claude + le contexte, persiste le résultat en DB.
 *
 * Avatar SOBRE PROFESSIONNEL — tutoiement dans human_summary.
 */

export type Sentiment = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive'

export type Urgency = 'low' | 'medium' | 'high' | 'critical'

export type Intent =
  | 'complaint'
  | 'question'
  | 'praise'
  | 'suggestion'
  | 'churn_signal'
  | 'support_request'
  | 'other'

export type Topic =
  | 'pricing'
  | 'voice_capture'
  | 'cross_check'
  | 'liciel_export'
  | 'annuaire'
  | 'mission_flow'
  | 'billing'
  | 'bug'
  | 'support'
  | 'feature_request'
  | 'ademe'
  | 'other'

export type MessageSource = 'support_ticket' | 'review' | 'survey' | 'in_app_chat' | 'email_reply'

export interface RawClaudeAnalysis {
  /** Score sentiment brut -1 à +1 (clampé côté analyzer) */
  sentiment_score: number
  /** Topics bruts retournés par Claude (free-form, à mapper sur Topic) */
  topics: string[]
  /** Urgency brute string (à valider vs enum) */
  urgency: string
  /** Intent brute string (à valider vs enum) */
  intent: string
  /** Phrases-clés extraites du message (max 5 retenues) */
  key_phrases: string[]
}

export interface MessageContext {
  source: MessageSource
  /** Note 1-5 pour les reviews (undefined sinon) */
  rating?: number
  /** Ancienneté user en mois (undefined si user anonyme/non-loggué) */
  user_tenure_months?: number
}

export interface SentimentAnalysisResult {
  sentiment: Sentiment
  /** Score clampé -1 à +1 strict */
  sentiment_score: number
  /** Topics mappés sur l'enum KOVAS, max 3 distincts */
  topics: Topic[]
  /** Urgency finale après application des règles métier */
  urgency: Urgency
  /** Intent finale après application des règles métier */
  intent: Intent
  /** Phrases-clés (max 5) */
  key_phrases: string[]
  /** True si intent=churn_signal OU urgency=critical */
  triggers_retention: boolean
  /** True si urgency=critical */
  triggers_immediate_response: boolean
  /** Résumé humain 1 phrase pour admin UI (tutoiement, sobre) */
  human_summary: string
}

// ---------------------------------------------------------------------------
// Mots-clés métier FR (regex compilées une fois, indépendantes de la casse)
// ---------------------------------------------------------------------------

const CHURN_KEYWORDS_RE =
  /\b(annuler|annulation|résilier|résiliation|partir|quitter|arrêter\s+mon\s+abonnement|stopper\s+mon\s+abonnement|me\s+désinscrire|désabonner|désabonnement|concurrent|liciel\s+suffit|trop\s+cher|trop\s+chere|trop\s+chère)\b/i

const BUG_KEYWORDS_RE =
  /\b(bug|cassé|cassée|cassés|cassees|marche\s+pas|fonctionne\s+pas|erreur|crash|crashe|plantage|plante|404|500|exception|stack\s*trace|écran\s+blanc)\b/i

// ---------------------------------------------------------------------------
// Mapping topics bruts → enum KOVAS
// ---------------------------------------------------------------------------

const TOPIC_MAP: Record<string, Topic> = {
  // Pricing
  pricing: 'pricing',
  prix: 'pricing',
  tarif: 'pricing',
  tarification: 'pricing',
  abonnement: 'pricing',
  plan: 'pricing',
  cout: 'pricing',
  coût: 'pricing',
  // Voice
  voice: 'voice_capture',
  voice_capture: 'voice_capture',
  vocal: 'voice_capture',
  voix: 'voice_capture',
  whisper: 'voice_capture',
  dictée: 'voice_capture',
  dictee: 'voice_capture',
  transcription: 'voice_capture',
  // Cross-check
  cross_check: 'cross_check',
  crosscheck: 'cross_check',
  cohérence: 'cross_check',
  coherence: 'cross_check',
  validation: 'cross_check',
  // Liciel export
  liciel: 'liciel_export',
  liciel_export: 'liciel_export',
  export: 'liciel_export',
  zip: 'liciel_export',
  // Annuaire
  annuaire: 'annuaire',
  doctolib: 'annuaire',
  visibilité: 'annuaire',
  visibilite: 'annuaire',
  référencement: 'annuaire',
  referencement: 'annuaire',
  // Mission flow
  mission: 'mission_flow',
  mission_flow: 'mission_flow',
  workflow: 'mission_flow',
  rendez_vous: 'mission_flow',
  planning: 'mission_flow',
  terrain: 'mission_flow',
  // Billing
  billing: 'billing',
  facturation: 'billing',
  facture: 'billing',
  paiement: 'billing',
  stripe: 'billing',
  carte: 'billing',
  prélèvement: 'billing',
  prelevement: 'billing',
  // Bug
  bug: 'bug',
  erreur: 'bug',
  crash: 'bug',
  // Support
  support: 'support',
  aide: 'support',
  ticket: 'support',
  réponse: 'support',
  reponse: 'support',
  // Feature request
  feature: 'feature_request',
  feature_request: 'feature_request',
  suggestion: 'feature_request',
  fonctionnalité: 'feature_request',
  fonctionnalite: 'feature_request',
  demande: 'feature_request',
  // ADEME
  ademe: 'ademe',
  certification: 'ademe',
  '3cl': 'ademe',
  dpe: 'ademe',
  agrément: 'ademe',
  agrement: 'ademe',
}

function mapTopic(raw: string): Topic {
  const normalized = raw
    .toLowerCase()
    .trim()
    .normalize('NFD')
    // Garder les accents pour le matching FR (cohérence/coherence handled dans TOPIC_MAP)
    .replace(/\p{Diacritic}/gu, '')
  // Cherche d'abord match exact, puis substring sur les clés
  if (TOPIC_MAP[normalized]) return TOPIC_MAP[normalized]
  for (const [key, value] of Object.entries(TOPIC_MAP)) {
    const normalizedKey = key.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return value
    }
  }
  return 'other'
}

// ---------------------------------------------------------------------------
// Validation enums
// ---------------------------------------------------------------------------

const VALID_URGENCIES: ReadonlyArray<Urgency> = ['low', 'medium', 'high', 'critical']
const VALID_INTENTS: ReadonlyArray<Intent> = [
  'complaint',
  'question',
  'praise',
  'suggestion',
  'churn_signal',
  'support_request',
  'other',
]

function parseUrgency(raw: string): Urgency {
  const normalized = raw.toLowerCase().trim()
  if ((VALID_URGENCIES as ReadonlyArray<string>).includes(normalized)) {
    return normalized as Urgency
  }
  return 'low'
}

function parseIntent(raw: string): Intent {
  const normalized = raw.toLowerCase().trim()
  if ((VALID_INTENTS as ReadonlyArray<string>).includes(normalized)) {
    return normalized as Intent
  }
  return 'other'
}

// ---------------------------------------------------------------------------
// Urgency upgrade helpers
// ---------------------------------------------------------------------------

const URGENCY_RANK: Record<Urgency, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
}

function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b
}

function upgradeUrgency(u: Urgency): Urgency {
  if (u === 'low') return 'medium'
  if (u === 'medium') return 'high'
  if (u === 'high') return 'critical'
  return 'critical'
}

// ---------------------------------------------------------------------------
// Sentiment label depuis le score
// ---------------------------------------------------------------------------

function sentimentFromScore(score: number): Sentiment {
  if (score < -0.6) return 'very_negative'
  if (score < -0.2) return 'negative'
  if (score <= 0.2) return 'neutral'
  if (score <= 0.6) return 'positive'
  return 'very_positive'
}

const SENTIMENT_LABEL: Record<Sentiment, string> = {
  very_negative: 'très négatif',
  negative: 'négatif',
  neutral: 'neutre',
  positive: 'positif',
  very_positive: 'très positif',
}

const INTENT_LABEL: Record<Intent, string> = {
  complaint: 'réclamation',
  question: 'question',
  praise: 'éloge',
  suggestion: 'suggestion',
  churn_signal: 'signal de churn',
  support_request: 'demande de support',
  other: 'autre',
}

const SOURCE_LABEL: Record<MessageSource, string> = {
  support_ticket: 'Ticket support',
  review: 'Avis',
  survey: 'Sondage',
  in_app_chat: 'Chat in-app',
  email_reply: 'Réponse email',
}

const TOPIC_LABEL: Record<Topic, string> = {
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Analyse un message utilisateur en combinant la sortie Claude Haiku
 * et les règles métier KOVAS.
 *
 * @example
 * ```ts
 * const result = analyzeSentiment(
 *   {
 *     sentiment_score: -0.8,
 *     topics: ['pricing', 'liciel'],
 *     urgency: 'high',
 *     intent: 'complaint',
 *     key_phrases: ['trop cher', 'je vais résilier'],
 *   },
 *   'Franchement trop cher, je vais résilier et retourner sur Liciel.',
 *   { source: 'support_ticket', user_tenure_months: 14 },
 * )
 * // → { sentiment: 'very_negative', intent: 'churn_signal',
 * //     urgency: 'critical', triggers_retention: true, ... }
 * ```
 */
export function analyzeSentiment(
  raw: RawClaudeAnalysis,
  message: string,
  context: MessageContext,
): SentimentAnalysisResult {
  // 1. Clamp sentiment score strict [-1, +1]
  const sentiment_score = Math.max(-1, Math.min(1, raw.sentiment_score))
  const sentiment = sentimentFromScore(sentiment_score)

  // 2. Topics : mapping + dédoublonnage + max 3
  const mappedTopics: Topic[] = []
  for (const t of raw.topics) {
    if (typeof t !== 'string' || t.trim() === '') continue
    const mapped = mapTopic(t)
    if (!mappedTopics.includes(mapped)) {
      mappedTopics.push(mapped)
    }
    if (mappedTopics.length >= 3) break
  }

  // 3. Key phrases : max 5
  const key_phrases = raw.key_phrases
    .filter((p) => typeof p === 'string' && p.trim() !== '')
    .slice(0, 5)

  // 4. Parse urgency + intent depuis brute
  let urgency: Urgency = parseUrgency(raw.urgency)
  let intent: Intent = parseIntent(raw.intent)

  // 5. Règle : keywords churn FR → force intent=churn_signal + urgency≥high
  if (CHURN_KEYWORDS_RE.test(message)) {
    intent = 'churn_signal'
    urgency = maxUrgency(urgency, 'high')
  }

  // 6. Règle : rating ≤ 2 (review) → force intent=complaint + urgency≥high
  //    Sauf si déjà churn_signal (priorité churn_signal > complaint)
  if (context.source === 'review' && typeof context.rating === 'number' && context.rating <= 2) {
    if (intent !== 'churn_signal') {
      intent = 'complaint'
    }
    urgency = maxUrgency(urgency, 'high')
  }

  // 7. Règle : keywords bug → topic incluant 'bug' + urgency≥medium
  if (BUG_KEYWORDS_RE.test(message)) {
    if (!mappedTopics.includes('bug')) {
      // Insère bug en tête, pousse 'other' éventuels en dehors si > 3
      mappedTopics.unshift('bug')
      if (mappedTopics.length > 3) mappedTopics.length = 3
    }
    urgency = maxUrgency(urgency, 'medium')
  }

  // 8. Règle : user fidèle (tenure ≥ 12) + complaint → urgency upgrade d'1 cran
  if (
    typeof context.user_tenure_months === 'number' &&
    context.user_tenure_months >= 12 &&
    intent === 'complaint'
  ) {
    urgency = upgradeUrgency(urgency)
  }

  // 9. Flags actionnables
  const triggers_retention = intent === 'churn_signal' || urgency === 'critical'
  const triggers_immediate_response = urgency === 'critical'

  // 10. Topic principal pour le résumé (premier après mapping, fallback 'other')
  const principalTopic: Topic = mappedTopics[0] ?? 'other'

  // 11. Human summary — format : "{Source} · {sentiment_label} · {intent} · {topic principal}"
  const human_summary = `${SOURCE_LABEL[context.source]} · ${SENTIMENT_LABEL[sentiment]} · ${INTENT_LABEL[intent]} · ${TOPIC_LABEL[principalTopic]}`

  return {
    sentiment,
    sentiment_score,
    topics: mappedTopics,
    urgency,
    intent,
    key_phrases,
    triggers_retention,
    triggers_immediate_response,
    human_summary,
  }
}
