/**
 * Validation email professionnel — Protection 1 anti-abus.
 * Cf. docs/trial-protection.md §2
 */

// Free email providers grand public — bloqués pour les essais B2B
const FREE_PROVIDERS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.fr',
  'yahoo.com',
  'yahoo.co.uk',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'live.fr',
  'live.com',
  'msn.com',
  'wanadoo.fr',
  'orange.fr',
  'free.fr',
  'sfr.fr',
  'laposte.net',
  'bbox.fr',
  'numericable.fr',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'tutanota.com',
  'gmx.fr',
  'gmx.com',
  'mailo.com',
  'zoho.com',
])

// Domaines temporaires / jetables (échantillon — liste complète maintenable via tools/sync-disposable-domains.mjs)
const DISPOSABLE_PROVIDERS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'mailinator.com',
  'mailinator.net',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.com',
  'yopmail.com',
  'yopmail.fr',
  'getairmail.com',
  'getnada.com',
  'mintemail.com',
  'mohmal.com',
  'throwawaymail.com',
  'maildrop.cc',
  'mailnesia.com',
  'sharklasers.com',
  'spambox.us',
  'trashmail.com',
  'dispostable.com',
  'mytemp.email',
  'tmpmail.org',
  'tmail.ws',
  '0-mail.com',
  'fakeinbox.com',
])

export type EmailValidationResult =
  | { valid: true; domain: string }
  | { valid: false; reason: 'invalid_format' | 'free_provider' | 'disposable_provider' | 'no_mx' }

const EMAIL_REGEX = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/

/**
 * Valide qu'un email est professionnel (pas free provider, pas jetable).
 * Phase 1 dev : pas de DNS MX lookup (server-side seulement si nécessaire plus tard).
 */
export function validateProEmail(rawEmail: string): EmailValidationResult {
  const email = rawEmail.trim().toLowerCase()
  const match = email.match(EMAIL_REGEX)
  if (!match) return { valid: false, reason: 'invalid_format' }

  const domain = match[1] ?? ''
  if (FREE_PROVIDERS.has(domain)) return { valid: false, reason: 'free_provider' }
  if (DISPOSABLE_PROVIDERS.has(domain)) return { valid: false, reason: 'disposable_provider' }

  return { valid: true, domain }
}

/**
 * Validation email à l'INSCRIPTION — funnel sans friction (décision Benjamin
 * 2026-05-30). Contrairement à `validateProEmail`, on ACCEPTE les adresses grand
 * public (gmail, outlook, orange, free, icloud…) : beaucoup d'auto-entrepreneurs
 * et de diagnostiqueurs indépendants n'ont pas d'email à leur nom de domaine.
 * On bloque uniquement :
 *   - le format invalide,
 *   - les adresses jetables / temporaires (anti-spam).
 * La vraie légitimité professionnelle est contrôlée par le SIRET (vérifié au
 * registre SIRENE) demandé APRÈS le paiement, pas par le domaine de l'email.
 */
export function validateSignupEmail(rawEmail: string): EmailValidationResult {
  const email = rawEmail.trim().toLowerCase()
  const match = email.match(EMAIL_REGEX)
  if (!match) return { valid: false, reason: 'invalid_format' }

  const domain = match[1] ?? ''
  if (DISPOSABLE_PROVIDERS.has(domain)) return { valid: false, reason: 'disposable_provider' }

  return { valid: true, domain }
}

export function getEmailValidationMessage(
  reason: Exclude<EmailValidationResult, { valid: true }>['reason'],
): string {
  switch (reason) {
    case 'invalid_format':
      return 'Adresse email invalide.'
    case 'free_provider':
      return "KOVAS est réservé aux professionnels. Merci d'utiliser votre adresse email professionnelle (avec votre nom de domaine)."
    case 'disposable_provider':
      return "Les adresses email temporaires ne sont pas autorisées. Merci d'utiliser votre adresse professionnelle."
    case 'no_mx':
      return 'Domaine email non joignable.'
  }
}
