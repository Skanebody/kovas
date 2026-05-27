/**
 * KOVAS — Système 2 : Email subject auto-optimization — Claude prompt builder.
 *
 * Pure builder qui produit le prompt envoyé à Claude Sonnet pour générer
 * 5 nouveaux subjects challengers à partir des top winners actuels d'un
 * template. Inclut un parser strict qui filtre les subjects non conformes
 * (trop long, vide, emoji, vous→tu).
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §5.
 *
 * Stratégie de génération :
 *   - On expose à Claude les top 3 winners actuels avec leur open_rate,
 *     pour qu'il s'en inspire SANS les copier.
 *   - On impose 5 méthodes copywriting Tugan Bara (specificity, loss aversion,
 *     curiosity gap, contraste, language match) — un subject par méthode.
 *   - On force le tutoiement systématique (avatar SOBRE PROFESSIONNEL).
 *   - On bannit les emojis (réservés au registre marketing kovas.fr).
 *   - On contraint < 50 chars (sweet spot Brevo + smartphone preview).
 *   - Format de sortie JSON strict pour parsing déterministe.
 *
 * Le parser applique une seconde couche de garanties :
 *   - Trim + filter empty
 *   - Filter > 50 chars (Claude peut rater le compte de chars)
 *   - Filter emojis (regex \p{Emoji_Presentation} avec flag u)
 *   - Convert "vous" → "tu" automatique (word boundary regex)
 *   - Max 5 subjects retournés
 *
 * Déterministe, testable, zéro IO.
 */

import type { EmailTemplateId } from './templates'

export interface SubjectGenerationContext {
  template_id: EmailTemplateId
  template_description: string
  target_audience: string
  primary_kpi: 'open_rate' | 'click_rate' | 'conversion_rate'
  /** Top 3 (max) winners actuels avec leur taux d'ouverture */
  top_winners: ReadonlyArray<{ content: string; open_rate: number }>
}

export interface RawClaudeSubjectsResponse {
  subjects: string[]
}

// ---------------------------------------------------------------------------
// System prompt (system message Anthropic)
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPT = `Tu es un copywriter senior spécialisé en email marketing B2B pour KOVAS, un logiciel SaaS destiné aux diagnostiqueurs immobiliers indépendants français.

Ton rôle : générer 5 nouveaux subject lines challengers pour un email transactionnel ou lifecycle, à intégrer dans un multi-armed bandit en compétition avec les top winners actuels.

Contraintes ABSOLUES (non négociables) :
- Langue : FRANÇAIS strict.
- Vouvoiement INTERDIT — TUTOIEMENT systématique. "Tu" et non "vous".
- Aucun emoji, aucun pictogramme. Texte pur.
- Maximum 50 caractères PAR subject (sweet spot smartphone preview + Brevo).
- Vocabulaire métier diagnostiqueur : DPE, mission, terrain, ADEME, Liciel, cabinet, essai, quota.
- Ton SOBRE PROFESSIONNEL. Jamais gaming, jamais lifestyle, jamais millennial.
- Pas de superlatifs creux (incroyable, fou, dingue, génial).
- Pas de hyperboles fausses (révolutionnaire, magique, miraculeux).

Méthodes copywriting à appliquer (un subject par méthode, dans l'ordre) :
1. Specificity — chiffre précis ou détail concret ("12 DPE F", "30 min gagnées", "le 30 du mois").
2. Loss aversion — ce que l'utilisateur va perdre ("Plus que 3 jours", "Tu paies trop", "Évite 1 retour terrain").
3. Curiosity gap — promesse intrigante sans tout dévoiler ("3 raccourcis qui changent tout", "On a corrigé ce qui te bloquait").
4. Contraste — opposition forte ("Solo vs Pro", "Avant / Après", "10 min vs 1h30").
5. Language match — phrase que dirait le diagnostiqueur lui-même ("Encore un retour terrain", "Trop cher pour ce que c'est").

Format de sortie OBLIGATOIRE (JSON strict, aucune autre clé, aucun texte avant/après) :
{
  "subjects": ["<subject 1 specificity>", "<subject 2 loss aversion>", "<subject 3 curiosity gap>", "<subject 4 contraste>", "<subject 5 language match>"]
}

RÉPONDS UNIQUEMENT EN JSON. AUCUN AUTRE TEXTE.`

// ---------------------------------------------------------------------------
// KPI labels FR
// ---------------------------------------------------------------------------

const KPI_LABEL: Record<'open_rate' | 'click_rate' | 'conversion_rate', string> = {
  open_rate: "taux d'ouverture",
  click_rate: 'taux de clic',
  conversion_rate: 'taux de conversion',
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/**
 * Construit le user message envoyé à Claude Sonnet.
 *
 * @example
 * ```ts
 * const prompt = buildSubjectGenerationPrompt({
 *   template_id: 'trial_day_27_will_end',
 *   template_description: 'J+27 : essai termine dans 3 jours.',
 *   target_audience: 'Diagnostiqueurs J+27',
 *   primary_kpi: 'conversion_rate',
 *   top_winners: [
 *     { content: 'Ton essai termine dans 3 jours', open_rate: 0.42 },
 *     { content: 'On débite ta carte le 30', open_rate: 0.38 },
 *   ],
 * })
 * ```
 */
export function buildSubjectGenerationPrompt(ctx: SubjectGenerationContext): string {
  const winnersBlock =
    ctx.top_winners.length === 0
      ? 'Aucun winner actuel — tu génères les premiers challengers from scratch.'
      : ctx.top_winners
          .slice(0, 3)
          .map(
            (w, i) => `  ${i + 1}. "${w.content}" — open_rate ${(w.open_rate * 100).toFixed(1)}%`,
          )
          .join('\n')

  return `Génère 5 nouveaux subject lines challengers pour ce template d'email KOVAS.

Template : ${ctx.template_id}
Description : ${ctx.template_description}
Audience cible : ${ctx.target_audience}
KPI optimisé : ${KPI_LABEL[ctx.primary_kpi]}

Top winners actuels (à NE PAS copier — t'en inspirer pour battre leur performance) :
${winnersBlock}

Génère maintenant 5 subjects challengers, un par méthode (specificity / loss aversion / curiosity gap / contraste / language match), au format JSON strict :

{"subjects": ["...", "...", "...", "...", "..."]}

AUCUN AUTRE TEXTE. Tutoiement strict. Pas d'emoji. Max 50 caractères chacun.`
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Regex Unicode pour détecter emojis présentationnels (drapeaux, smileys,
 * pictogrammes, dingbats, etc.). On utilise `\p{Emoji_Presentation}` au lieu
 * de `\p{Emoji}` car ce dernier match aussi les chiffres et le `#` — trop large.
 *
 * On ajoute aussi `\p{Extended_Pictographic}` pour capturer les variants
 * (avec sélecteur VS16). Compilée une fois.
 */
const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u

/**
 * Regex word-boundary pour convertir "vous" → "tu" et formes dérivées.
 * On gère les principales formes : vous, votre, vos, vôtre, vôtres.
 */
const VOUS_REPLACEMENTS: Array<[RegExp, string]> = [
  // Conjugaisons : "vous êtes", "vous avez" → "tu es", "tu as" — couverture
  // partielle (Claude ne devrait pas livrer ce cas mais on couvre les bavures)
  [/\bvous\s+êtes\b/gi, 'tu es'],
  [/\bvous\s+avez\b/gi, 'tu as'],
  [/\bvos\b/gi, 'tes'],
  [/\bvôtres\b/gi, 'tiens'],
  [/\bvôtre\b/gi, 'tien'],
  [/\bvotre\b/gi, 'ton'],
  [/\bvous\b/gi, 'tu'],
]

function convertVousToTu(s: string): string {
  let result = s
  for (const [re, replacement] of VOUS_REPLACEMENTS) {
    result = result.replace(re, replacement)
  }
  return result
}

/**
 * Parse + filtre la réponse JSON de Claude.
 *
 * Garanties post-parse :
 *   - Max 5 subjects
 *   - Trim + filter strings vides
 *   - Filter > 50 chars
 *   - Filter emojis
 *   - Convertit "vous" → "tu" (sécurité au cas où Claude rate)
 *
 * @param raw - Objet parsé depuis `JSON.parse(response_text)` (caller responsable).
 * @param template_id - Pour log / observability (pas utilisé pour filtrer).
 */
export function parseAndFilterSubjects(
  raw: RawClaudeSubjectsResponse,
  template_id: EmailTemplateId,
): string[] {
  if (!raw || !Array.isArray(raw.subjects)) {
    return []
  }
  // Marqueur pour permettre l'audit (param non utilisé filter-wise, on l'accroche en debug noop)
  void template_id

  const result: string[] = []
  for (const raw_subject of raw.subjects) {
    if (typeof raw_subject !== 'string') continue
    const trimmed = raw_subject.trim()
    if (trimmed.length === 0) continue
    if (EMOJI_RE.test(trimmed)) continue
    const converted = convertVousToTu(trimmed)
    // Recheck length post-conversion (vous→tu raccourcit en général)
    if (converted.length === 0) continue
    if (converted.length > 50) continue
    result.push(converted)
    if (result.length >= 5) break
  }
  return result
}
