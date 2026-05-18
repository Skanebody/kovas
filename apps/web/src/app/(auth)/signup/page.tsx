import Link from 'next/link'
import type { Metadata } from 'next'
import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: 'Essai gratuit 14 jours',
}

export default function SignupPage() {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Essai gratuit 14 jours</h1>
        <p className="text-sm text-muted-foreground">
          Sans carte bancaire · 30 missions · Tous les exports.
        </p>
      </div>

      <SignupForm />

      <p className="text-center text-sm text-muted-foreground">
        Déjà un compte ?{' '}
        <Link
          href="/login"
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  )
}
