'use client'

/**
 * KOVAS — Wrapper Google reCAPTCHA v3 (anti-spam K1).
 *
 * Usage :
 *   1. Charger <RecaptchaV3Provider /> à la racine de la page (layout ou page client).
 *   2. Dans un composant, `const { getToken } = useRecaptcha('action_name')`.
 *   3. Au submit du form, await getToken() → string | null.
 *
 * V3 = score-based (pas de challenge visible). On envoie le token au serveur
 * qui appelle l'API `siteverify` Google (cf. lib/anti-spam/recaptcha.ts).
 *
 * Env var requise : NEXT_PUBLIC_RECAPTCHA_SITE_KEY
 * Si absente → le hook retourne null sans erreur (fail-open dev-friendly).
 */

import Script from 'next/script'
import { useCallback, useEffect, useState } from 'react'

interface GrecaptchaApi {
  ready(cb: () => void): void
  execute(siteKey: string, options: { action: string }): Promise<string>
}

declare global {
  interface Window {
    grecaptcha?: GrecaptchaApi
  }
}

interface RecaptchaV3ProviderProps {
  children?: React.ReactNode
}

/**
 * À placer une seule fois dans la page (par exemple dans le layout client
 * du formulaire). Charge le script Google. Pas de UI rendue.
 */
export function RecaptchaV3Provider({ children }: RecaptchaV3ProviderProps) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  if (!siteKey) {
    return <>{children}</>
  }
  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`}
        strategy="afterInteractive"
      />
      {children}
    </>
  )
}

interface UseRecaptchaReturn {
  /** Récupère un token côté client. Retourne null si script pas chargé / pas de site_key. */
  getToken: () => Promise<string | null>
  ready: boolean
}

export function useRecaptcha(action: string): UseRecaptchaReturn {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !siteKey) {
      return
    }
    // Poll for grecaptcha presence (script async)
    const checkReady = () => {
      if (window.grecaptcha) {
        window.grecaptcha.ready(() => setReady(true))
        return true
      }
      return false
    }
    if (checkReady()) return
    const interval = setInterval(() => {
      if (checkReady()) {
        clearInterval(interval)
      }
    }, 300)
    const timeout = setTimeout(() => clearInterval(interval), 10_000)
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [siteKey])

  const getToken = useCallback(async (): Promise<string | null> => {
    if (typeof window === 'undefined') return null
    if (!siteKey) return null
    const api = window.grecaptcha
    if (!api) return null
    try {
      const token = await api.execute(siteKey, { action })
      return token
    } catch (err) {
      console.warn('[useRecaptcha] execute failed', err)
      return null
    }
  }, [siteKey, action])

  return { getToken, ready }
}
