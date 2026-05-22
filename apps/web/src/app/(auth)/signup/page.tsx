import Link from 'next/link'
import type { Metadata } from 'next'
import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: 'Essai gratuit 30 jours',
}

export default function SignupPage() {
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
      </div>

      <SignupForm />

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
