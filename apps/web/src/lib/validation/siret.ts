/**
 * Validation SIRET — Protection 2 anti-abus.
 * Cf. docs/trial-protection.md §3
 *
 * V1 (actuel) : format 14 digits + checksum Luhn.
 * V1.5 : branchement INSEE Sirene API pour valider le code NAF.
 */

export type SiretValidationResult =
  | { valid: true; siret: string; siren: string; nic: string }
  | { valid: false; reason: 'invalid_format' | 'invalid_checksum' }

/**
 * Vérifie qu'un SIRET est valide selon l'algorithme de Luhn.
 * Le SIRET est composé de 14 chiffres : SIREN (9 digits) + NIC (5 digits).
 * Validation : somme pondérée (×1, ×2 alternés) % 10 == 0.
 *
 * Cas particulier La Poste (SIREN 356000000) : le SIRET utilise un calcul spécial
 * (somme directe des digits ≡ 0 mod 5) — on accepte si Luhn classique échoue.
 */
export function validateSiret(rawSiret: string): SiretValidationResult {
  const siret = rawSiret.replace(/\s/g, '')

  if (!/^\d{14}$/.test(siret)) {
    return { valid: false, reason: 'invalid_format' }
  }

  // Algorithme de Luhn
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let digit = Number.parseInt(siret[i]!, 10)
    // Position impaire (1-indexed) = poids 2, paire = poids 1
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }

  const isLuhnValid = sum % 10 === 0

  // Cas spécial La Poste (SIREN 356000000)
  const siren = siret.slice(0, 9)
  if (siren === '356000000') {
    const directSum = siret.split('').reduce((acc, d) => acc + Number.parseInt(d, 10), 0)
    if (directSum % 5 === 0) return { valid: true, siret, siren, nic: siret.slice(9) }
  }

  if (!isLuhnValid) {
    return { valid: false, reason: 'invalid_checksum' }
  }

  return { valid: true, siret, siren, nic: siret.slice(9) }
}

export function getSiretValidationMessage(
  reason: Exclude<SiretValidationResult, { valid: true }>['reason'],
): string {
  switch (reason) {
    case 'invalid_format':
      return 'Le SIRET doit contenir exactement 14 chiffres.'
    case 'invalid_checksum':
      return 'Ce numéro SIRET est invalide (somme de contrôle incorrecte).'
  }
}

/**
 * Bypass DEV pour les scripts de test automatisés.
 * Activé via NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=1.
 */
export function isFakeSiretAllowed(): boolean {
  return process.env.NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET === '1'
}
