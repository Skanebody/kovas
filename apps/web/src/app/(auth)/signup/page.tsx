import { isValidReferralCodeFormat, normalizeReferralCode } from '@/lib/referral/code-generator'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: 'Essai gratuit 30 jours',
}

const REFERRAL_COOKIE = 'kovas_ref_code'
const REFERRAL_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60

interface SignupPageProps {
  searchParams: Promise<{ ref?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { ref } = await searchParams
  const cookieStore = await cookies()

  // Si un ?ref=XXX valide est présent dans l'URL, on (re)pose le cookie
  // pour porter la donnée jusqu'à la soumission, même si l'utilisateur
  // navigue ailleurs avant de revenir.
  let activeRef: string | null = null
  if (ref && isValidReferralCodeFormat(ref)) {
    activeRef = normalizeReferralCode(ref)
    cookieStore.set(REFERRAL_COOKIE, activeRef, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFERRAL_COOKIE_MAX_AGE_S,
      path: '/',
    })
  } else {
    const cookieRef = cookieStore.get(REFERRAL_COOKIE)?.value
    if (cookieRef && isValidReferralCodeFormat(cookieRef)) {
      activeRef = cookieRef
    }
  }

  return (
    <div className="w-full space-y-7">
      {/* Hero serif italic — pattern signature v4 */}
      <div className="space-y-3 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-amber font-semibold">
          30 jours gratuits · Résiliable en 2 clics
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Démarrer.
        </h1>
        <p className="text-sm md:text-base text-ink-mute">
          Carte bancaire requise · Aucun débit avant J+30 · Tous les exports inclus.
        </p>
        {activeRef ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-chartreuse-deep">
            Parrainage actif · {activeRef} · 1 mois offert
          </p>
        ) : null}
      </div>

      <SignupForm referralCode={activeRef} />

      <p className="text-center text-[13px] text-ink-mute pt-2 border-t border-rule/40">
        Déjà un compte ?{' '}
        <Link
          href="/login"
          className="text-navy-700 font-semibold underline-offset-4 hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  )
}
