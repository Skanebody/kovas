/**
 * Helpers de manipulation prénom / nom.
 *
 * Stratégie KOVAS : la table `profiles` stocke `full_name` (single column) pour
 * compat avec le trigger `handle_new_user()` et `auth.users.user_metadata`. Les
 * formulaires saisissent prénom + nom séparément (UX FR standard) et les
 * concatènent à l'enregistrement.
 */

export interface NameParts {
  firstName: string
  lastName: string
}

/**
 * Découpe un nom complet en (prénom, nom). Convention :
 *   - 1er token = prénom
 *   - tokens suivants = nom (composés "de la Tour" gardés intacts)
 *
 * Exemple :
 *   "Pierre Martin"       → { firstName: "Pierre", lastName: "Martin" }
 *   "Jean-Marc de la Tour" → { firstName: "Jean-Marc", lastName: "de la Tour" }
 *   "Madonna"             → { firstName: "Madonna", lastName: "" }
 *   null / ""             → { firstName: "", lastName: "" }
 */
export function splitFullName(full: string | null | undefined): NameParts {
  const trimmed = (full ?? '').trim()
  if (!trimmed) return { firstName: '', lastName: '' }

  const tokens = trimmed.split(/\s+/)
  if (tokens.length === 1) {
    return { firstName: tokens[0] ?? '', lastName: '' }
  }
  return {
    firstName: tokens[0] ?? '',
    lastName: tokens.slice(1).join(' '),
  }
}

/**
 * Recompose "prénom nom" pour stockage `full_name`. Trim + collapse spaces.
 * Renvoie chaîne vide si les deux sont vides.
 */
export function joinFullName(firstName: string, lastName: string): string {
  const fn = (firstName ?? '').trim()
  const ln = (lastName ?? '').trim()
  if (!fn && !ln) return ''
  if (!ln) return fn
  if (!fn) return ln
  return `${fn} ${ln}`
}
