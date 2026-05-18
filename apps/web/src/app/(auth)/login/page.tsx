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
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Connexion</h1>
        <p className="text-sm text-muted-foreground">
          Accédez à votre compte KOVAS.
        </p>
      </div>

      <LoginForm defaultEmail={devPrefill.email} defaultPassword={devPrefill.password} />

      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ?{' '}
        <Link href="/signup" className="text-foreground font-medium underline-offset-4 hover:underline">
          Essai gratuit 14 jours
        </Link>
      </p>

      {process.env.NODE_ENV === 'development' && process.env.KOVAS_DEV_ENTER === '1' ? (
        <p className="text-center text-xs text-muted-foreground">
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
