/**
 * @deprecated Utiliser `@/lib/local-ai/vocabulary/diagnostic-jargon`.
 *
 * Ce fichier est conservé comme façade de rétrocompatibilité. Il délègue au
 * nouveau module lexique métier (`diagnostic-jargon.ts`) qui couvre ~600 termes
 * répartis sur 10 sections (vs 8 sous-listes statiques ici à l'origine).
 *
 * Cf. apps/web/src/lib/local-ai/vocabulary/README.md
 */

import { buildWhisperPrompt as buildWhisperPromptV2 } from './local-ai/vocabulary/diagnostic-jargon'

/**
 * Construit le `prompt` Whisper pour un type de mission donné.
 * Accepte un type unique, un array, ou null/undefined.
 */
export function buildWhisperPrompt(missionTypes?: string | string[] | null): string {
  const typesArray = Array.isArray(missionTypes) ? missionTypes : missionTypes ? [missionTypes] : []
  return buildWhisperPromptV2(typesArray)
}
