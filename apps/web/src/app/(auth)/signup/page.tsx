import Link from 'next/link'
import type { Metadata } from 'next'
import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: 'Essai gratuit 14 jours',
}

export default function SignupPage() {
  return (
    <div className="w-full space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="font-display font-light text-display-s tracking-tight text-ink">
          Essai gratuit 14 jours
        </h1>
        <p className="text-[13px] text-ink-mute">
          Sans carte bancaire · 30 missions · Tous les exports.
        </p>
      </div>

      <SignupForm />

      <p className="text-center text-[13px] text-ink-mute">
        Déjà un compte ?{' '}
        <Link href="/login" className="text-ink font-medium underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  )
}
