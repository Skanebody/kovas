/**
 * Masquage RGPD-friendly des contacts affichés sur la page publique
 * de claim (l'utilisateur doit reconnaître son contact sans qu'il soit
 * lisible par n'importe qui).
 */

/**
 * Masque un email : pierre.dupont@cabinet.fr → p******.d*****@c******.fr
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***'
  const [local, domain] = email.split('@') as [string, string]
  const [domainName, ...tld] = domain.split('.')
  return `${maskMiddle(local)}@${maskMiddle(domainName ?? '')}${tld.length ? `.${tld.join('.')}` : ''}`
}

/**
 * Masque un téléphone E.164 : +33612345678 → +33 6 ** ** ** 78
 */
export function maskPhone(phone: string): string {
  if (!phone) return '***'
  const clean = phone.replace(/\s/g, '')
  if (clean.length < 4) return '***'
  const last2 = clean.slice(-2)
  const prefix = clean.startsWith('+33') ? '+33' : clean.slice(0, 2)
  const middle = clean.slice(prefix.length, -2).replace(/\d/g, '*')
  // Format lisible : +33 X ** ** ** XX
  return `${prefix} ${middle.slice(0, 1)} ${
    middle
      .slice(1)
      .match(/.{1,2}/g)
      ?.join(' ') ?? ''
  } ${last2}`
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Masque un SIRET : 12345678900012 → 123 *** *** 00012
 */
export function maskSiret(siret: string): string {
  if (!siret || siret.length !== 14) return '***'
  return `${siret.slice(0, 3)} *** *** ${siret.slice(9)}`
}

/** Helper : remplace le milieu d'une chaîne par des étoiles, garde 1er + dernier char. */
function maskMiddle(s: string): string {
  if (s.length <= 2) return s[0] ? `${s[0]}*` : '*'
  return `${s[0]}${'*'.repeat(Math.max(s.length - 2, 1))}${s[s.length - 1]}`
}

/**
 * Détecte si un téléphone FR est mobile (06 / 07 / +336 / +337).
 * Utilisé pour activer ou non l'onglet SMS (qui n'a aucun sens en fixe).
 */
export function isFrenchMobile(phone: string): boolean {
  if (!phone) return false
  const clean = phone.replace(/\s/g, '')
  return /^(\+33|0)[67]/.test(clean)
}
