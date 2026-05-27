/**
 * KOVAS — Système 9 : Prompt template Claude Haiku pour sentiment analysis.
 *
 * Pure builder qui produit le prompt envoyé à Claude Haiku pour analyser
 * un message utilisateur (support ticket, review, survey, in-app chat,
 * email reply) et retourner un JSON strict conforme à RawClaudeAnalysis.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` (Système 9).
 *
 * Schéma de sortie attendu (validé côté analyzer.ts) :
 *   {
 *     "sentiment_score": number,     // -1 à +1
 *     "topics": string[],            // free-form, mappé sur enum Topic
 *     "urgency": string,             // "low" | "medium" | "high" | "critical"
 *     "intent": string,              // complaint | question | praise |
 *                                    // suggestion | churn_signal |
 *                                    // support_request | other
 *     "key_phrases": string[]        // 3-5 phrases-clés extraites
 *   }
 *
 * Le caller (Edge Function) envoie SYSTEM_PROMPT comme system + le résultat
 * de buildSentimentPrompt comme user message.
 */

import type { MessageContext, MessageSource } from './analyzer'

/**
 * Instructions système — comportement, contexte métier, format de sortie.
 * À envoyer dans le champ `system` de l'API Anthropic.
 */
export const SYSTEM_PROMPT = `Tu es un assistant d'analyse de feedback pour KOVAS, un logiciel SaaS B2B destiné aux diagnostiqueurs immobiliers indépendants français.

Ton rôle : analyser un message utilisateur (en français) et retourner UNIQUEMENT un objet JSON strict, sans aucun commentaire ni texte avant/après.

Contexte métier KOVAS — lexique à reconnaître :
- DPE : Diagnostic de Performance Énergétique (étiquettes A-G)
- ADEME : autorité de certification française pour DPE
- Certification 3CL-2021 : méthode de calcul DPE certifié
- Liciel : principal concurrent (logiciel desktop, 40-52% PdM)
- Mission : intervention terrain chez un client (DPE, amiante, plomb, gaz, élec, termites, Carrez, ERP)
- Cross-check : validation de cohérence entre diagnostics
- Annuaire KOVAS : marketplace de visibilité (modèle Doctolib)
- Saisie vocale : feature signature de KOVAS (Whisper + Claude)
- Export Liciel : bouton "Partager vers logiciel principal"

Tu dois être factuel, neutre, et NE PAS deviner. Si un signal n'est pas clair, choisis "other" ou "neutral".

Format de sortie OBLIGATOIRE (JSON strict, aucune autre clé) :
{
  "sentiment_score": <number entre -1 et +1, float à 2 décimales>,
  "topics": [<array de strings>, max 3 topics],
  "urgency": <"low" | "medium" | "high" | "critical">,
  "intent": <"complaint" | "question" | "praise" | "suggestion" | "churn_signal" | "support_request" | "other">,
  "key_phrases": [<array de 3-5 phrases courtes extraites du message>]
}

Règles d'analyse :
- sentiment_score : -1 = très négatif, 0 = neutre, +1 = très positif
- urgency=critical : utilisateur menace de partir, bug critique bloquant, perte de données, problème de paiement
- urgency=high : utilisateur frustré, bug important, blocage workflow
- urgency=medium : question ouverte sans urgence, suggestion détaillée
- urgency=low : info, éloge, question casual
- intent=churn_signal : utilisateur mentionne résiliation, départ, retour vers concurrent
- key_phrases : phrases courtes du message (5-15 mots max chacune), pas de paraphrase

RÉPONDS UNIQUEMENT EN JSON. AUCUN AUTRE TEXTE.`

const SOURCE_DESCRIPTION: Record<MessageSource, string> = {
  support_ticket: 'Ticket support écrit par un diagnostiqueur',
  review: 'Avis public déposé sur Trustpilot / Capterra / G2 / Annuaire KOVAS',
  survey: 'Réponse à un sondage NPS / CSAT envoyé par KOVAS',
  in_app_chat: 'Message dans le chat in-app KOVAS (bouton Aide flottant)',
  email_reply: 'Réponse à un email transactionnel ou marketing KOVAS',
}

/**
 * Construit le user message à envoyer à Claude Haiku.
 *
 * @param message - Texte du feedback utilisateur (sera échappé côté caller).
 * @param context - Métadonnées du message (source, rating optionnel, tenure).
 *
 * @example
 * ```ts
 * const prompt = buildSentimentPrompt(
 *   'Franchement votre saisie vocale est nulle, je retourne sur Liciel.',
 *   { source: 'review', rating: 1, user_tenure_months: 8 }
 * )
 * ```
 */
export function buildSentimentPrompt(message: string, context: MessageContext): string {
  const sourceLine = `Source : ${SOURCE_DESCRIPTION[context.source]}`

  const ratingLine =
    typeof context.rating === 'number'
      ? `Note attribuée : ${context.rating}/5 (à prendre en compte pour calibrer le sentiment_score)`
      : null

  const tenureLine =
    typeof context.user_tenure_months === 'number'
      ? `Ancienneté utilisateur : ${context.user_tenure_months} mois (un utilisateur fidèle qui se plaint est un signal fort)`
      : null

  const contextLines = [sourceLine, ratingLine, tenureLine].filter((l): l is string => l !== null)

  return `Analyse ce message d'un diagnostiqueur immobilier français et retourne UNIQUEMENT le JSON demandé.

${contextLines.join('\n')}

--- DÉBUT DU MESSAGE ---
${message}
--- FIN DU MESSAGE ---

Retourne maintenant le JSON strict (sentiment_score, topics, urgency, intent, key_phrases). Aucun autre texte.`
}
