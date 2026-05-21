/**
 * KOVAS — RAG / Recherche hybride documents réglementaires + cas communauté.
 *
 * Workflow d'une requête chatbot :
 *  1. Embed query (OpenAI text-embedding-3-small via embeddings.ts)
 *  2. Top-K `regulatory_documents` via similarité cosine (pgvector `<=>` operator)
 *  3. Top-K `community_cases` via recherche full-text français (to_tsvector)
 *  4. Compose un contexte markdown structuré avec n° de référence pour citation.
 *
 * Sécurité : filtre stricte côté serveur — `processed_at IS NOT NULL` (jamais de doc en cours
 * d'indexation) + `is_superseded = false` + `status = 'approved'` côté communauté.
 *
 * Authority : CLAUDE.md §3 + module 8 RAG.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateEmbedding } from './embeddings'

/** Seuil minimal de similarité cosine pour considérer un doc pertinent. Ajustable. */
const DEFAULT_SIMILARITY_THRESHOLD = 0.65

export interface RegulatoryHit {
  id: string
  title: string
  aiSummary: string | null
  sourceUrl: string
  similarity: number
  publishedAt: string | null
  importance: 'low' | 'normal' | 'high' | 'critical'
}

export interface CommunityHit {
  id: string
  title: string
  question: string
  decisionMade: string | null
  justification: string | null
  rank: number
}

export interface RagSearchResult {
  documents: RegulatoryHit[]
  cases: CommunityHit[]
  embeddingTokens: number
  embeddingCostEur: number
  embeddingCached: boolean
}

interface RegDocRow {
  id: string
  title: string
  ai_summary: string | null
  url: string
  similarity: number
  published_at: string | null
  importance: 'low' | 'normal' | 'high' | 'critical'
}

interface CommunityCaseRow {
  id: string
  title: string
  question: string
  decision_made: string | null
  justification: string | null
  rank: number
}

/**
 * Recherche sémantique top-K dans regulatory_documents.
 * Renvoie uniquement les docs `processed_at IS NOT NULL` et `is_superseded=false`.
 */
export async function searchRegulatoryDocuments(
  supabase: SupabaseClient,
  query: string,
  topK = 5,
  similarityThreshold: number = DEFAULT_SIMILARITY_THRESHOLD,
): Promise<{ hits: RegulatoryHit[]; tokens: number; costEur: number; cached: boolean }> {
  const embedding = await generateEmbedding(query)

  // pgvector cosine distance : `embedding <=> $1` retourne [0,2]. Similarity = 1 - distance.
  // On utilise un RPC pour passer le vector littéral proprement.
  // biome-ignore lint/suspicious/noExplicitAny: RPC `match_regulatory_documents` à ajouter migration RAG
  const { data, error } = await (supabase.rpc as any)('match_regulatory_documents', {
    query_embedding: embedding.vector,
    match_threshold: similarityThreshold,
    match_count: topK,
  })

  if (error) {
    throw new Error(`searchRegulatoryDocuments RPC failed: ${error.message}`)
  }

  const rows = (data ?? []) as RegDocRow[]
  const hits: RegulatoryHit[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    aiSummary: row.ai_summary,
    sourceUrl: row.url,
    similarity: row.similarity,
    publishedAt: row.published_at,
    importance: row.importance,
  }))

  return {
    hits,
    tokens: embedding.tokens,
    costEur: embedding.costEur,
    cached: embedding.cached,
  }
}

/**
 * Recherche full-text dans community_cases (status='approved' uniquement).
 * Utilise la configuration française de PostgreSQL pour le stemming.
 */
export async function searchCommunityCases(
  supabase: SupabaseClient,
  query: string,
  topK = 3,
): Promise<CommunityHit[]> {
  // biome-ignore lint/suspicious/noExplicitAny: RPC `match_community_cases` à ajouter migration RAG
  const { data, error } = await (supabase.rpc as any)('match_community_cases', {
    query_text: query,
    match_count: topK,
  })

  if (error) {
    throw new Error(`searchCommunityCases RPC failed: ${error.message}`)
  }

  const rows = (data ?? []) as CommunityCaseRow[]
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    question: row.question,
    decisionMade: row.decision_made,
    justification: row.justification,
    rank: row.rank,
  }))
}

/**
 * Lance les 2 recherches en parallèle (embedding compté 1 fois).
 */
export async function ragSearch(
  supabase: SupabaseClient,
  query: string,
  options: { topKDocs?: number; topKCases?: number; similarityThreshold?: number } = {},
): Promise<RagSearchResult> {
  const topKDocs = options.topKDocs ?? 5
  const topKCases = options.topKCases ?? 3
  const threshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD

  // L'embedding est utilisé seulement par searchRegulatoryDocuments — searchCommunityCases
  // utilise full-text. On parallélise les 2 appels SQL une fois l'embedding obtenu.
  const docsPromise = searchRegulatoryDocuments(supabase, query, topKDocs, threshold)
  const casesPromise = searchCommunityCases(supabase, query, topKCases)
  const [docsResult, casesResult] = await Promise.all([docsPromise, casesPromise])

  return {
    documents: docsResult.hits,
    cases: casesResult,
    embeddingTokens: docsResult.tokens,
    embeddingCostEur: docsResult.costEur,
    embeddingCached: docsResult.cached,
  }
}

/**
 * Assemble docs + cas en un contexte markdown structuré pour Claude.
 * Chaque source reçoit un numéro `[D1]`, `[D2]` ... `[C1]`, `[C2]` pour que le modèle
 * puisse citer précisément.
 *
 * Limite la taille à ~6000 caractères par contexte (cap soft pour économiser tokens).
 */
export function composeRagContext(
  docs: RegulatoryHit[],
  cases: CommunityHit[],
  maxChars = 6000,
): string {
  if (docs.length === 0 && cases.length === 0) {
    return 'AUCUN DOCUMENT PERTINENT TROUVÉ DANS LA BASE RÉGLEMENTAIRE.'
  }

  const blocks: string[] = []
  let used = 0

  const pushBlock = (block: string): boolean => {
    if (used + block.length > maxChars) return false
    blocks.push(block)
    used += block.length
    return true
  }

  if (docs.length > 0) {
    pushBlock('## Documents réglementaires pertinents\n')
    docs.forEach((doc, i) => {
      const ref = `[D${i + 1}]`
      const summary = doc.aiSummary ?? '(pas de résumé)'
      const block = `### ${ref} ${doc.title}\n- URL : ${doc.sourceUrl}\n- Publié : ${doc.publishedAt ?? 'n/a'}\n- Importance : ${doc.importance}\n- Similarité : ${doc.similarity.toFixed(3)}\n- Résumé : ${summary}\n\n`
      pushBlock(block)
    })
  }

  if (cases.length > 0) {
    pushBlock('## Cas communauté (anonymisés) en lien\n')
    cases.forEach((c, i) => {
      const ref = `[C${i + 1}]`
      const decision = c.decisionMade ?? '(pas de décision)'
      const justification = c.justification ?? '(pas de justification)'
      const block = `### ${ref} ${c.title}\n- Question : ${c.question}\n- Décision : ${decision}\n- Justification : ${justification}\n\n`
      pushBlock(block)
    })
  }

  return blocks.join('')
}
