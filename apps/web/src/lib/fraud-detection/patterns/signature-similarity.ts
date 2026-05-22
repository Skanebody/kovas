/**
 * Pattern 4 — Signature similarity.
 *
 * Détecte des similarités anormales entre opérateurs différents :
 *  - 2 diagnostiqueurs distincts signent avec des commentaires quasi-identiques
 *    (cosine similarity > 0.92 sur n-grams)
 *  - Réutilisation massive de templates ADEME entre opérateurs
 *
 * Algo V1 (MVP) : cosine similarity sur trigrams (3-grams de mots).
 * Phase 2 : hash perceptif DCT sur le PDF complet + embeddings sentence
 * (Phase 3 — auto-apprentissage avec Llama 3.3 fine-tuné).
 *
 * Note : la fonction `detectSignatureSimilarity` détecte une paire à la fois ;
 * l'orchestrator est responsable de lancer la matrice N×N de candidats.
 */

import type { FraudSignal } from '../types'

export interface SignatureCandidate {
  scanId: string
  diagnosticianId: string
  comments: string
}

/**
 * Normalise un texte : minuscules, espaces uniques, retire ponctuation simple.
 */
export function normalizeForSimilarity(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}+/gu, '') // Diacritiques combinants (NFD)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Génère les n-grams de mots (par défaut trigrams).
 */
export function wordNgrams(text: string, n = 3): string[] {
  const words = normalizeForSimilarity(text).split(' ').filter(Boolean)
  if (words.length < n) return words.length > 0 ? [words.join(' ')] : []
  const grams: string[] = []
  for (let i = 0; i <= words.length - n; i++) {
    grams.push(words.slice(i, i + n).join(' '))
  }
  return grams
}

/**
 * Cosine similarity entre deux multisets de tokens (TF, pas TF-IDF).
 * Retourne valeur ∈ [0, 1].
 */
export function cosineSimilarity(
  tokensA: ReadonlyArray<string>,
  tokensB: ReadonlyArray<string>,
): number {
  if (tokensA.length === 0 || tokensB.length === 0) return 0

  const freqA = new Map<string, number>()
  const freqB = new Map<string, number>()
  for (const t of tokensA) freqA.set(t, (freqA.get(t) ?? 0) + 1)
  for (const t of tokensB) freqB.set(t, (freqB.get(t) ?? 0) + 1)

  let dot = 0
  for (const [token, fa] of freqA) {
    const fb = freqB.get(token)
    if (fb !== undefined) dot += fa * fb
  }

  let normA = 0
  for (const fa of freqA.values()) normA += fa * fa
  let normB = 0
  for (const fb of freqB.values()) normB += fb * fb

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (denom === 0) return 0
  return dot / denom
}

export interface SignatureSimilarityInput {
  candidate: SignatureCandidate
  others: ReadonlyArray<SignatureCandidate>
}

/**
 * Détecte si le candidat partage des commentaires anormalement similaires
 * avec un autre opérateur (diagnosticianId différent).
 *
 * Severity = max similarity trouvée mappée :
 *   sim < 0.85 → 0
 *   sim 0.85-0.92 → 0.40-0.60
 *   sim ≥ 0.92 → 0.80-1.00
 */
export function detectSignatureSimilarity(input: SignatureSimilarityInput): FraudSignal {
  const candidateGrams = wordNgrams(input.candidate.comments, 3)
  if (candidateGrams.length === 0) {
    return {
      pattern: 'signature_similarity',
      severity: 0,
      flagged: false,
      reason: 'Commentaires vides — comparaison impossible.',
      details: { skipped: true, reason: 'empty_comments' },
    }
  }

  let maxSim = 0
  let maxMatch: { scanId: string; diagnosticianId: string; similarity: number } | null = null
  const allMatches: Array<{ scanId: string; diagnosticianId: string; similarity: number }> = []

  for (const other of input.others) {
    if (other.diagnosticianId === input.candidate.diagnosticianId) continue // même opérateur OK
    if (other.scanId === input.candidate.scanId) continue
    const otherGrams = wordNgrams(other.comments, 3)
    const sim = cosineSimilarity(candidateGrams, otherGrams)
    if (sim >= 0.7) {
      allMatches.push({
        scanId: other.scanId,
        diagnosticianId: other.diagnosticianId,
        similarity: sim,
      })
    }
    if (sim > maxSim) {
      maxSim = sim
      maxMatch = { scanId: other.scanId, diagnosticianId: other.diagnosticianId, similarity: sim }
    }
  }

  let severity = 0
  if (maxSim >= 0.92) {
    severity = 0.8 + (maxSim - 0.92) * (0.2 / 0.08) // 0.92 → 0.80, 1.0 → 1.0
  } else if (maxSim >= 0.85) {
    severity = 0.4 + (maxSim - 0.85) * (0.2 / 0.07) // 0.85 → 0.40, 0.92 → 0.60
  } else if (maxSim >= 0.75) {
    severity = 0.2 + (maxSim - 0.75) * (0.2 / 0.1) // 0.75 → 0.20, 0.85 → 0.40
  }

  const flagged = severity >= 0.5

  const reason =
    severity > 0 && maxMatch
      ? `Similarité ${(maxSim * 100).toFixed(1)}% avec scan ${maxMatch.scanId} (opérateur ${maxMatch.diagnosticianId}) — réutilisation de commentaires suspecte.`
      : `Pas de similarité significative détectée (max ${(maxSim * 100).toFixed(1)}%).`

  return {
    pattern: 'signature_similarity',
    severity: Math.min(1, severity),
    flagged,
    reason,
    details: {
      maxSimilarity: Number(maxSim.toFixed(4)),
      bestMatch: maxMatch,
      allMatches: allMatches.slice(0, 10), // top 10 max
      candidateGramCount: candidateGrams.length,
    },
  }
}
