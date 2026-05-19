'use client'

import { Loader2 } from 'lucide-react'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { type SignupState, signupAction } from './actions'

export function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signupAction,
    undefined,
  )

  const errors = state?.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-4">
      <FormField label="Nom complet" htmlFor="fullName" required error={errors.fullName}>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          placeholder="Pierre Martin"
        />
      </FormField>

      <FormField
        label="Email professionnel"
        htmlFor="email"
        required
        hint="Avec votre nom de domaine (pas gmail/yahoo)"
        error={errors.email}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nom@cabinet.fr"
        />
      </FormField>

      <FormField
        label="Numéro SIRET du cabinet"
        htmlFor="siret"
        required
        hint="14 chiffres — réservé aux cabinets de diagnostic immobilier"
        error={errors.siret}
      >
        <Input
          id="siret"
          name="siret"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          required
          maxLength={17}
          pattern="[\d\s]{14,17}"
          placeholder="123 456 789 00012"
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
        Commencer l'essai 14 jours
      </Button>

      <p className="text-xs text-ink-faint text-center">
        En créant un compte, vous acceptez nos{' '}
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
