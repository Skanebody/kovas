/**
 * Helpers de normalisation texte pour le tracker checklist.
 *
 * - Décompose les caractères Unicode et supprime les diacritiques (NFKD)
 * - Met en minuscules
 * - Préserve les chiffres et apostrophes
 *
 * Pure utilitaire, pas de I/O.
 */

/**
 * Normalise un texte pour matching insensible aux accents et à la casse.
 *
 *   foldText("DALLE vinyl-amiante 30x30, salle d'eau, chambre n°2") →
 *   "dalle vinyl-amiante 30x30, salle d'eau, chambre n°2".toLowerCase()
 *   sans diacritiques
 */
export function foldText(input: string): string {
  return input.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Vérifie si l'un des `keywords` apparaît dans `haystack` (matching insensible
 * aux accents / casse / espaces multiples).
 *
 * Matche en mode "contient" (substring) après folding. Pour des matches plus
 * stricts, l'appelant peut passer un keyword commençant/finissant par espace.
 */
export function containsAnyKeyword(haystack: string, keywords: readonly string[]): boolean {
  const folded = foldText(haystack)
  for (const kw of keywords) {
    const foldedKw = foldText(kw)
    if (!foldedKw) continue
    if (folded.includes(foldedKw)) return true
  }
  return false
}
