'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'
import { submitStep1Account } from '../actions'

export function Step1AccountForm() {
  const [state, formAction, pending] = useActionState(submitStep1Account, undefined)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/55 font-semibold">
          Étape 1 sur 7
        </p>
        <h1 className="font-serif italic text-3xl sm:text-4xl text-[#0F1419] leading-tight">
          Bienvenue sur KOVAS, créez votre compte en cinq minutes.
        </h1>
        <p className="text-[14px] text-[#0F1419]/70">
          Votre compte est créé immédiatement. Les quatre vérifications (identité, COFRAC, RC Pro,
          SIRENE) se font ensuite en 24-48 h.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <FormField label="Email professionnel" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="vous@cabinet.fr"
          />
        </FormField>

        <FormField label="Mot de passe" htmlFor="password" required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="8 caractères minimum"
          />
        </FormField>

        <FormField
          label="Téléphone mobile"
          htmlFor="phone"
          required
          hint="Format français : 06 12 34 56 78 ou +33 6 12 34 56 78"
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            placeholder="06 12 34 56 78"
          />
        </FormField>

        <fieldset className="space-y-2 pt-2">
          <label className="flex gap-3 items-start cursor-pointer">
            <input
              type="checkbox"
              name="cgu"
              required
              className="mt-1 size-4 rounded border-[#0F1419]/20"
            />
            <span className="text-[13px] text-[#0F1419]/75">
              J&apos;accepte les{' '}
              <Link href="/cgu" target="_blank" className="underline">
                CGU
              </Link>{' '}
              et les{' '}
              <Link href="/cgv" target="_blank" className="underline">
                CGV
              </Link>{' '}
              de KOVAS 360 (SASU Nexus 1993, SIREN 944 037 220).
            </span>
          </label>
        </fieldset>

        {state?.error && (
          <p className="text-[13px] text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Créer mon compte et continuer
        </Button>

        <p className="text-center text-[12px] text-[#0F1419]/55">
          Déjà inscrit ?{' '}
          <Link href="/login" className="underline">
            Se connecter
          </Link>
        </p>
      </form>
    </div>
  )
}
