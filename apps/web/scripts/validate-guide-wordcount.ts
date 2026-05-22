/**
 * Script de validation des comptages de mots des 9 guides longs.
 *
 * Usage : `pnpm tsx apps/web/scripts/validate-guide-wordcount.ts`
 * Exit code : 0 si tous les guides ≥ 5000 mots, 1 sinon.
 *
 * Vérifie chaque guide en calculant le total réel des mots (paragraphes +
 * bullets + callouts + how-to steps + FAQ) et compare avec le champ
 * `wordCount` déclaré dans la fixture (qui doit être proche de la valeur
 * réelle).
 */

import { GUIDES_LIST } from '../src/lib/guides/registry'
import { computeGuideWordCount } from '../src/lib/guides/types'

const MIN_WORDS = 5000

let totalWords = 0
let failures = 0

console.log(`\nValidation des ${GUIDES_LIST.length} guides longs :\n`)
console.log('─'.repeat(72))

for (const guide of GUIDES_LIST) {
  const actual = computeGuideWordCount(guide.sections, guide.faq)
  const declared = guide.wordCount
  const ok = actual >= MIN_WORDS
  const status = ok ? 'OK ' : 'KO '
  const drift = ((actual - declared) / declared) * 100
  console.log(
    `  [${status}] ${guide.slug.padEnd(20)} actual=${actual.toString().padStart(5)}  ` +
      `declared=${declared.toString().padStart(5)}  drift=${drift.toFixed(1)}%`,
  )
  totalWords += actual
  if (!ok) failures++
}

console.log('─'.repeat(72))
console.log(`Total : ${totalWords.toLocaleString('fr-FR')} mots cumulés`)
console.log(`Échecs : ${failures} / ${GUIDES_LIST.length}\n`)

if (failures > 0) {
  console.error(`✗ ${failures} guide(s) en dessous de ${MIN_WORDS} mots.`)
  process.exit(1)
}

console.log(`✓ Tous les guides atteignent ${MIN_WORDS}+ mots.`)
