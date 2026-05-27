/**
 * KOVAS — Vérification reCAPTCHA v3 score-based (anti-spam V1).
 *
 * reCAPTCHA v3 retourne un score 0.0 (bot certain) à 1.0 (humain certain).
 * Seuil V1 : 0.5 (Google recommandation par défaut).
 *
 * Configuration :
 *   - NEXT_PUBLIC_RECAPTCHA_SITE_KEY : clé publique (côté client, hook useRecaptcha)
 *   - RECAPTCHA_SECRET_KEY            : clé serveur (verifyRecaptchaToken)
 *
 * Si RECAPTCHA_SECRET_KEY non défini → le wrapper retourne { valid: true, score: 1 }
 * pour ne pas bloquer le dev/staging sans clé Google provisionnée. Logger un warn
 * dans Sentry pour suivi.
 */

export interface RecaptchaVerdict {
  valid: boolean
  score: number
  /** True si le secret est absent (mode dev permissif). */
  bypassed: boolean
  /** Erreur côté Google si valid=false. */
  errorCodes?: string[]
}

export async function verifyRecaptchaToken(
  token: string | null | undefined,
  expectedAction: string,
  minScore = 0.5,
): Promise<RecaptchaVerdict> {
  const secret = process.env.RECAPTCHA_SECRET_KEY
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[recaptcha] RECAPTCHA_SECRET_KEY missing — bypassing verification')
    }
    return { valid: true, score: 1, bypassed: true }
  }

  if (!token) {
    return { valid: false, score: 0, bypassed: false, errorCodes: ['missing-token'] }
  }

  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }).toString(),
    })

    if (!res.ok) {
      return {
        valid: false,
        score: 0,
        bypassed: false,
        errorCodes: [`http-${res.status}`],
      }
    }

    const data = (await res.json()) as {
      success?: boolean
      score?: number
      action?: string
      'error-codes'?: string[]
    }

    if (!data.success) {
      return {
        valid: false,
        score: data.score ?? 0,
        bypassed: false,
        errorCodes: data['error-codes'] ?? ['unsuccessful'],
      }
    }

    if (typeof data.action === 'string' && data.action !== expectedAction) {
      return {
        valid: false,
        score: data.score ?? 0,
        bypassed: false,
        errorCodes: ['action-mismatch'],
      }
    }

    const score = typeof data.score === 'number' ? data.score : 0
    return {
      valid: score >= minScore,
      score,
      bypassed: false,
    }
  } catch (err) {
    console.error('[recaptcha] verify error', err)
    return {
      valid: false,
      score: 0,
      bypassed: false,
      errorCodes: ['fetch-error'],
    }
  }
}
