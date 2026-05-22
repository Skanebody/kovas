/**
 * Banque de formulations — philosophie alertes KOVAS.
 *
 * Principe : ton aidant, jamais accusateur.
 * Avatar client (diagnostiqueur 43 ans, ex-cadre reconverti) : SOBRE,
 * vouvoiement par défaut, vocabulaire métier — JAMAIS millennial/gaming.
 *
 * 1. Le diagnostiqueur a toujours raison (jamais bloquant)
 * 2. Marges de tolérance larges
 * 3. Max 3 alertes par mission
 * 4. Max 1 suggestion proactive par jour
 * 5. Ton aidant ("Vous pouvez..." au lieu de "Vous devez...")
 * 6. Apprentissage : 5 ignorances = auto-disable
 * 7. Pas de "vous devriez"
 */

/**
 * Formulations bannies. Match insensible à la casse.
 * Toute alerte / message présenté au diagnostiqueur les voit remplacées.
 */
export const BANNED_PHRASES: ReadonlyArray<{
  pattern: RegExp
  replacement: string
}> = [
  // Tonalité accusatrice / dramatique
  { pattern: /\banomalie(s)?\b/gi, replacement: 'petit écart' },
  { pattern: /\berreur(s)?\b/gi, replacement: 'point à vérifier' },
  { pattern: /\bnon[\s-]?conforme(s)?\b/gi, replacement: 'à confirmer' },
  { pattern: /\brisque grave\b/gi, replacement: 'point d’attention' },
  { pattern: /\béchec(s)?\b/gi, replacement: 'à reprendre' },
  { pattern: /\bproblème(s)?\b/gi, replacement: 'point à vérifier' },
  // Mode obligatoire / impératif
  { pattern: /\bvous devez\b/gi, replacement: 'vous pouvez' },
  { pattern: /\btu dois\b/gi, replacement: 'tu peux' },
  { pattern: /\bvous devriez\b/gi, replacement: 'vous pouvez' },
  { pattern: /\btu devrais\b/gi, replacement: 'tu peux' },
  { pattern: /\bil est obligatoire\b/gi, replacement: 'il est utile' },
  { pattern: /\bil faut absolument\b/gi, replacement: 'pensez à' },
  { pattern: /\bobligatoirement\b/gi, replacement: 'idéalement' },
  // Dramatisation
  { pattern: /\battention\s*!?\s*:?/gi, replacement: 'Bon à savoir : ' },
  { pattern: /\balerte\s*!?\s*:?/gi, replacement: 'Pour info : ' },
  { pattern: /\bincohérent(e|s|es)?\b/gi, replacement: 'à confirmer' },
  { pattern: /\bcritique(s)?\b/gi, replacement: 'à regarder' },
]

/**
 * Formulations OK — exemples canoniques pour rédaction de nouveaux messages.
 * Ces tournures sont sobres, aidantes et préservent l'agentivité du diagnostiqueur.
 */
export const APPROVED_OPENERS: readonly string[] = [
  'J’ai vu un petit écart',
  'Tu peux jeter un œil',
  'Petit point',
  'Bon à savoir',
  'Pour info',
  'À confirmer si vous le souhaitez',
  'Vous pouvez vérifier',
  'Un point à regarder',
]

/**
 * Remplace toutes les formulations bannies par leurs équivalents aidants.
 * Idempotent. Préserve la ponctuation et la casse hors mots clés.
 *
 * @example
 *   filterTone("Anomalie : vous devez vérifier") // "petit écart : vous pouvez vérifier"
 */
export function filterTone(text: string | null | undefined): string {
  if (!text) return ''
  let out = String(text)
  for (const { pattern, replacement } of BANNED_PHRASES) {
    out = out.replace(pattern, replacement)
  }
  // Nettoie doubles espaces résiduels.
  out = out.replace(/\s{2,}/g, ' ').trim()
  // Capitalise première lettre si nécessaire (politesse FR).
  if (out.length > 0) {
    out = out.charAt(0).toUpperCase() + out.slice(1)
  }
  return out
}

/**
 * Vrai si le texte contient au moins une formulation bannie.
 * Utile pour tests / lint.
 */
export function containsBannedTone(text: string): boolean {
  return BANNED_PHRASES.some(({ pattern }) => {
    pattern.lastIndex = 0
    return pattern.test(text)
  })
}
