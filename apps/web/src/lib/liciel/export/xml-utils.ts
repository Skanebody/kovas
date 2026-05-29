/**
 * Utilitaires bas niveau pour la sérialisation XML Liciel.
 *
 * Tous les fichiers LIV_*.xml partagent : déclaration UTF-8, échappement strict
 * des 5 entités XML, valeurs typées (décimal avec point, dates ISO, enums).
 *
 * Cf. docs/liciel-parser-specs.md §3 (échappement) — RÈGLE : on n'émet que des
 * noms de balises présents dans la spec.
 */

/** Échappe les 5 entités XML dans une valeur texte. */
export function esc(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Élément simple `<tag>valeur</tag>`.
 * Valeur null/undefined/'' → élément vide auto-fermant `<tag/>` (champ présent
 * mais non renseigné, conformément à la spec : « laisse le champ absent/vide »).
 */
export function el(tag: string, value: unknown, indent = ''): string {
  if (value === null || value === undefined || value === '') {
    return `${indent}<${tag}/>`
  }
  return `${indent}<${tag}>${esc(value)}</${tag}>`
}

/**
 * Formate un nombre décimal avec point comme séparateur (jamais virgule),
 * pour respecter le typage `decimal` attendu par Liciel.
 */
export function decimal(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return String(value)
}

/**
 * Normalise une date (ISO timestamp ou date) en `YYYY-MM-DD`.
 * Liciel attend des dates ISO sans composante horaire pour date_visite /
 * date_fin_validite.
 */
export function isoDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

/** Enveloppe un corps XML dans la déclaration + une racine donnée. */
export function xmlDocument(rootTag: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n${body}\n</${rootTag}>\n`
}
