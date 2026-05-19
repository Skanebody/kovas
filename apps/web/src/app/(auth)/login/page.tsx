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
    <div className="w-full space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-display font-light text-display-s tracking-tight text-ink">Connexion</h1>
        <p className="text-[13px] text-ink-mute">Accédez à votre compte KOVAS.</p>
      </div>

      <LoginForm defaultEmail={devPrefill.email} defaultPassword={devPrefill.password} />

      <p className="text-center text-[13px] text-ink-mute">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="text-ink font-medium underline-offset-4 hover:underline">
          Essai gratuit 14 jours
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
