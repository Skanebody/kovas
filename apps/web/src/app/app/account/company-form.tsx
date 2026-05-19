'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { Loader2 } from 'lucide-react'
import { useActionState, useEffect } from 'react'
import { type FormState, updateOrganizationAction } from './actions'

interface CompanyFormProps {
  initial: {
    name: string | null
    siret: string | null
    vat_number: string | null
    address: string | null
    postal_code: string | null
    city: string | null
    certification_n: string | null
  }
}

export function CompanyForm({ initial }: CompanyFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateOrganizationAction,
    undefined,
  )

  useEffect(() => {
    if (state?.success) toast.success('Informations entreprise mises à jour')
    else if (state?.error) toast.error(state.error)
  }, [state])

  return (
    <form action={formAction} className="space-y-4">
      <FormField label="Raison sociale" htmlFor="name" required>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={200}
          defaultValue={initial.name ?? ''}
          placeholder="Cabinet Diagnostic Dupont"
          autoComplete="organization"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="SIRET" htmlFor="siret" hint="14 chiffres">
          <Input
            id="siret"
            name="siret"
            inputMode="numeric"
            maxLength={14}
            defaultValue={initial.siret ?? ''}
            placeholder="123 456 789 00012"
          />
        </FormField>
        <FormField label="N° TVA intracom." htmlFor="vat_number" hint="Format FR + 11 chiffres">
          <Input
            id="vat_number"
            name="vat_number"
            maxLength={13}
            defaultValue={initial.vat_number ?? ''}
            placeholder="FR12345678901"
          />
        </FormField>
      </div>

      <FormField label="Adresse de facturation" htmlFor="address">
        <Input
          id="address"
          name="address"
          maxLength={200}
          defaultValue={initial.address ?? ''}
          autoComplete="street-address"
          placeholder="12 rue de la République"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-3">
        <FormField label="Code postal" htmlFor="postal_code">
          <Input
            id="postal_code"
            name="postal_code"
            inputMode="numeric"
            maxLength={5}
            pattern="\d{5}"
            defaultValue={initial.postal_code ?? ''}
            autoComplete="postal-code"
            placeholder="76200"
          />
        </FormField>
        <FormField label="Ville" htmlFor="city">
          <Input
            id="city"
            name="city"
            maxLength={100}
            defaultValue={initial.city ?? ''}
            autoComplete="address-level2"
            placeholder="Dieppe"
          />
        </FormField>
      </div>

      <FormField
        label="N° de certification COFRAC"
        htmlFor="certification_n"
        hint="Apparaîtra sur les en-têtes de rapports et exports"
      >
        <Input
          id="certification_n"
          name="certification_n"
          maxLength={50}
          defaultValue={initial.certification_n ?? ''}
          placeholder="CERT-12345"
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
