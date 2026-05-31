'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { type SignupState, signupAction } from './actions'

export function SignupForm({ referralCode }: { referralCode?: string | null } = {}) {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signupAction,
    undefined,
  )

  const errors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-4">
      {referralCode ? <input type="hidden" name="ref" value={referralCode} /> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Prénom" htmlFor="firstName" required error={errors.firstName}>
          <Input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            placeholder="Pierre"
          />
        </FormField>
        <FormField label="Nom" htmlFor="lastName" required error={errors.lastName}>
          <Input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            placeholder="Martin"
          />
        </FormField>
      </div>

      <FormField
        label="Ton email"
        htmlFor="email"
        required
        hint="Pro ou perso (gmail, outlook…) — on t'envoie les infos de ton compte ici"
        error={errors.email}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="ton.email@exemple.fr"
        />
      </FormField>

      <FormField label="Mot de passe" htmlFor="password" required error={errors.password}>
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

      {state?.error && (
        <p className="text-sm text-accent-red" role="alert">
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Commencer l&apos;essai 30 jours
      </Button>

      <p className="text-xs text-ink-faint text-center">
        En créant un compte, tu acceptes nos{' '}
        <a href="/cgu" className="underline">
          CGU
        </a>{' '}
        et notre{' '}
        <a href="/confidentialite" className="underline">
          politique de confidentialité
        </a>
        .
      </p>
    </form>
  )
}
