'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { splitFullName } from '@/lib/name-utils'
import { Loader2 } from 'lucide-react'
import { useActionState, useEffect } from 'react'
import { type FormState, updateProfileAction } from './actions'

interface ProfileFormProps {
  initial: {
    full_name: string | null
    email: string
    phone: string | null
  }
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateProfileAction,
    undefined,
  )

  useEffect(() => {
    if (state?.success) toast.success('Profil mis à jour')
    else if (state?.error) toast.error(state.error)
  }, [state])

  // Découpe `full_name` legacy → prénom + nom pour préremplir
  const { firstName, lastName } = splitFullName(initial.full_name)

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Prénom" htmlFor="first_name" required>
          <Input
            id="first_name"
            name="first_name"
            required
            minLength={1}
            maxLength={60}
            defaultValue={firstName}
            autoComplete="given-name"
            placeholder="Pierre"
          />
        </FormField>
        <FormField label="Nom" htmlFor="last_name" required>
          <Input
            id="last_name"
            name="last_name"
            required
            minLength={1}
            maxLength={60}
            defaultValue={lastName}
            autoComplete="family-name"
            placeholder="Martin"
          />
        </FormField>
      </div>
      <FormField label="Email" htmlFor="email" hint="L'email se modifie via Supabase Auth.">
        <Input id="email" type="email" defaultValue={initial.email} disabled />
      </FormField>
      <FormField
        label="Téléphone"
        htmlFor="phone"
        hint="Format français. Stocké en E.164 (+33...)."
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="06 12 34 56 78"
          defaultValue={initial.phone ?? ''}
        />
      </FormField>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </form>
  )
}
