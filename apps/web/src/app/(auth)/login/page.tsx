import Link from 'next/link'
import type { Metadata } from 'next'
import { LoginForm } from './login-form'

export const metadata: Metadata = {
  title: 'Connexion',
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
      {/* Hero serif italic — pattern signature v4 wireframe §1.1 */}
      <div className="space-y-3 text-center">
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Bienvenue.
        </h1>
        <p className="text-sm md:text-base text-ink-mute">
          Connectez-vous pour continuer.
        </p>
      </div>

      <LoginForm defaultEmail={devPrefill.email} defaultPassword={devPrefill.password} />

      <p className="text-center text-[13px] text-ink-mute pt-2 border-t border-rule/40">
        Pas encore de compte ?{' '}
        <Link
          href="/signup"
          className="text-navy-700 font-semibold underline-offset-4 hover:underline"
        >
          Essai gratuit 30 jours
        </Link>
      </p>

      {process.env.NODE_ENV === 'development' && process.env.KOVAS_DEV_ENTER === '1' ? (
        <p className="text-center text-[11px] text-ink-faint">
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
