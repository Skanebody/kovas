import Link from 'next/link'
import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Connexion KOVAS 360',
}

export default function LoginPage() {
  const devPrefill =
    process.env.NODE_ENV === 'development'
      ? {
          email: process.env.KOVAS_DEV_LOGIN_PREFILL_EMAIL ?? '',
          password: process.env.KOVAS_DEV_LOGIN_PREFILL_PASSWORD ?? '',
        }
      : { email: '', password: '' }

  return (
    <div className="w-full space-y-7">
      {/* Hero serif italic — pattern signature v5 (Instrument Serif italic) */}
      <div className="space-y-3 text-center">
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-[#0F1419] leading-[1.05]">
          Bienvenue.
        </h1>
        <p className="text-sm md:text-base text-[#0F1419]/72">
          Connectez-vous pour continuer.
        </p>
      </div>

      <LoginForm defaultEmail={devPrefill.email} defaultPassword={devPrefill.password} />

      <p className="text-center text-[13px] text-[#0F1419]/72 pt-2 border-t border-[#0F1419]/[0.08]">
        Pas encore de compte ?{' '}
        <Link
          href="/signup"
          className="text-[#0F1419] font-semibold underline-offset-4 hover:underline"
        >
          Essai 30 jours · CB enregistrée
        </Link>
      </p>

      {process.env.NODE_ENV === 'development' && process.env.KOVAS_DEV_ENTER === '1' ? (
        <p className="text-center text-[11px] text-[#0F1419]/55">
          <Link
            href="/api/dev/enter"
            className="font-medium underline-offset-4 hover:underline"
            prefetch={false}
          >
            Mode dev : ouvrir une session sans saisie
          </Link>
        </p>
      ) : null}
    </div>
  )
}
