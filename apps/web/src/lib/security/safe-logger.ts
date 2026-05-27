/**
 * KOVAS — Wrapper console qui strip automatiquement les PII et secrets.
 *
 * Utilisation : remplacer `console.log/warn/error` dans le code prod par
 * `safeLog.log/warn/error`. Les emails, téléphones FR, SIRET, JWT et clés
 * API sont automatiquement masqués.
 *
 * En tests Vitest, comportement identique. En dev (NODE_ENV !== production),
 * les valeurs ne sont PAS scrubbées (pour debug).
 */

// Ordre important : les patterns les plus spécifiques (clés API, JWT, SIRET)
// passent AVANT les plus génériques (phone, email) pour éviter qu'une string
// matchée par 2 patterns voie son scrubbing partiel.
const PII_PATTERNS: ReadonlyArray<{ regex: RegExp; replacement: string }> = [
  // Clés API (très spécifiques, prefix unique)
  { regex: /sk-ant-[A-Za-z0-9_-]+/g, replacement: '[ANTHROPIC_KEY]' },
  { regex: /sk-(?:proj-)?[A-Za-z0-9_-]{8,}/g, replacement: '[OPENAI_KEY]' },
  { regex: /(?:sk|pk|rk|whsec)_(?:test|live)_[A-Za-z0-9]+/g, replacement: '[STRIPE_KEY]' },
  { regex: /(?:sb_(?:secret|publishable)|sbp)_[A-Za-z0-9_-]+/g, replacement: '[SUPABASE_KEY]' },
  // JWT (signature en 3 segments base64url)
  {
    regex: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: '[JWT]',
  },
  // Email (avant SIRET pour ne pas masquer des chunks numériques d'email)
  { regex: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replacement: '[EMAIL]' },
  // SIRET (14 chiffres consécutifs) — utilise lookaround au lieu de \b
  // (`\b` est insensible aux frontières numériques quand encadré de digits).
  { regex: /(?<!\d)\d{14}(?!\d)/g, replacement: '[SIRET]' },
  // Téléphones FR : +33 ne match pas `\b` (+ n'est pas word char), donc lookaround.
  { regex: /(?<![\w+])\+33[1-9]\d{8}(?!\d)/g, replacement: '[PHONE_FR]' },
  { regex: /(?<!\d)0[1-9](?:[\s.-]?\d{2}){4}(?!\d)/g, replacement: '[PHONE_FR]' },
]

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') {
    let scrubbed = value
    for (const { regex, replacement } of PII_PATTERNS) {
      scrubbed = scrubbed.replace(regex, replacement)
    }
    return scrubbed
  }
  if (typeof value === 'object' && value !== null) {
    try {
      const json = JSON.stringify(value)
      let scrubbed = json
      for (const { regex, replacement } of PII_PATTERNS) {
        scrubbed = scrubbed.replace(regex, replacement)
      }
      return JSON.parse(scrubbed)
    } catch {
      return '[OBJECT_SERIALIZATION_ERROR]'
    }
  }
  return value
}

function scrubArgs(args: unknown[]): unknown[] {
  // En dev (NODE_ENV !== production), bypass scrub pour debug
  if (process.env.NODE_ENV !== 'production') {
    return args
  }
  return args.map(scrubValue)
}

export const safeLog = {
  log: (...args: unknown[]) => console.log(...scrubArgs(args)),
  info: (...args: unknown[]) => console.info(...scrubArgs(args)),
  warn: (...args: unknown[]) => console.warn(...scrubArgs(args)),
  error: (...args: unknown[]) => console.error(...scrubArgs(args)),
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') console.debug(...args)
  },
}

// Helper pour scrubber une string seule (utile pour error messages avant throw)
export function scrubPiiString(value: string): string {
  let scrubbed = value
  for (const { regex, replacement } of PII_PATTERNS) {
    scrubbed = scrubbed.replace(regex, replacement)
  }
  return scrubbed
}
