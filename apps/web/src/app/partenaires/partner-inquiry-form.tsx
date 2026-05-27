'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { submitPartnerInquiry } from './actions'
import type { PartnerInquiryInput } from './schemas'

interface FormState {
  status: 'idle' | 'submitting' | 'success' | 'error'
  message?: string
  fieldErrors?: Record<string, string>
}

const PARTNERSHIP_OPTIONS = [
  { value: 'notaires', label: 'Étude notariale' },
  { value: 'agences-immobilieres', label: 'Agence immobilière' },
  { value: 'banques-courtiers', label: 'Banque ou courtier en crédit' },
  { value: 'fournisseurs-energie', label: 'Fournisseur énergie / installateur' },
  { value: 'autre', label: 'Autre' },
] as const

export function PartnerInquiryForm() {
  const [state, setState] = useState<FormState>({ status: 'idle' })

  async function handleSubmit(formData: FormData) {
    setState({ status: 'submitting' })

    if (formData.get('consent_rgpd') !== 'on') {
      setState({
        status: 'error',
        message: 'Vous devez accepter la politique de confidentialité pour envoyer la demande.',
      })
      return
    }

    const payload: PartnerInquiryInput = {
      first_name: String(formData.get('first_name') ?? ''),
      last_name: String(formData.get('last_name') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      company_name: String(formData.get('company_name') ?? ''),
      company_role: String(formData.get('company_role') ?? ''),
      partnership_type: (formData.get('partnership_type') ??
        'autre') as PartnerInquiryInput['partnership_type'],
      message: String(formData.get('message') ?? ''),
      honeypot: String(formData.get('website') ?? ''),
      consent_rgpd: true,
    }

    const result = await submitPartnerInquiry(payload)

    if (result.ok) {
      setState({ status: 'success', message: result.message })
    } else {
      setState({
        status: 'error',
        message: result.error,
        fieldErrors: result.fieldErrors,
      })
    }
  }

  if (state.status === 'success') {
    return (
      <Card variant="opaque" padding="lg" className="max-w-3xl space-y-3">
        <h3 className="text-lg font-semibold text-[#0F1419]">Demande enregistrée.</h3>
        <p className="text-sm text-[#0F1419]/72 leading-relaxed">{state.message}</p>
      </Card>
    )
  }

  return (
    <form action={handleSubmit} className="max-w-3xl space-y-5" noValidate>
      <div className="hidden" aria-hidden="true">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field name="first_name" label="Prénom" required error={state.fieldErrors?.first_name} />
        <Field name="last_name" label="Nom" required error={state.fieldErrors?.last_name} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field name="email" label="Email" type="email" required error={state.fieldErrors?.email} />
        <Field
          name="phone"
          label="Téléphone"
          type="tel"
          required
          placeholder="+33 ..."
          error={state.fieldErrors?.phone}
        />
      </div>

      <Field
        name="company_name"
        label="Nom de la structure"
        required
        error={state.fieldErrors?.company_name}
      />

      <Field
        name="company_role"
        label="Votre rôle"
        placeholder="Directeur d'agence, notaire associé..."
        required
        error={state.fieldErrors?.company_role}
      />

      <label className="block space-y-1.5">
        <span className="text-xs font-mono uppercase tracking-wider text-[#0F1419]/72">
          Type de partenariat envisagé *
        </span>
        <select
          name="partnership_type"
          required
          defaultValue=""
          className={cn(
            'w-full rounded-md border bg-paper/70 px-3.5 py-2.5 text-sm text-[#0F1419]',
            'focus:outline-none focus:ring-4 focus:ring-navy/15 focus:border-[#0F1419]/40',
            state.fieldErrors?.partnership_type ? 'border-red-400' : 'border-[#0F1419]/[0.15]',
          )}
        >
          <option value="" disabled>
            Sélectionnez un type
          </option>
          {PARTNERSHIP_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {state.fieldErrors?.partnership_type ? (
          <p className="text-xs text-red-600">{state.fieldErrors.partnership_type}</p>
        ) : null}
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-mono uppercase tracking-wider text-[#0F1419]/72">
          Message *
        </span>
        <textarea
          name="message"
          required
          rows={6}
          placeholder="Décris ta structure, le partenariat envisagé et ses bénéfices attendus de ton côté."
          className={cn(
            'w-full rounded-md border bg-paper/70 px-3.5 py-2.5 text-sm text-[#0F1419] placeholder:text-[#0F1419]/40 leading-relaxed',
            'focus:outline-none focus:ring-4 focus:ring-navy/15 focus:border-[#0F1419]/40',
            state.fieldErrors?.message ? 'border-red-400' : 'border-[#0F1419]/[0.15]',
          )}
        />
        {state.fieldErrors?.message ? (
          <p className="text-xs text-red-600">{state.fieldErrors.message}</p>
        ) : null}
      </label>

      <label className="flex items-start gap-3 text-sm text-[#0F1419]/72">
        <input
          type="checkbox"
          name="consent_rgpd"
          required
          className="mt-1 size-4 rounded border-[#0F1419]/[0.2]"
        />
        <span>
          J&apos;accepte que mes informations soient utilisées pour étudier ma demande de
          partenariat, conformément à la politique de confidentialité KOVAS.
        </span>
      </label>

      {state.status === 'error' && state.message ? (
        <p className="text-sm text-red-600">{state.message}</p>
      ) : null}

      <div>
        <Button type="submit" variant="accent" size="lg" disabled={state.status === 'submitting'}>
          {state.status === 'submitting' ? 'Envoi en cours…' : 'Envoyer la demande'}
        </Button>
      </div>
    </form>
  )
}

interface FieldProps {
  name: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
  error?: string
}

function Field({ name, label, type = 'text', required, placeholder, error }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-mono uppercase tracking-wider text-[#0F1419]/72">
        {label}
        {required ? ' *' : ''}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border bg-paper/70 px-3.5 py-2.5 text-sm text-[#0F1419] placeholder:text-[#0F1419]/40',
          'focus:outline-none focus:ring-4 focus:ring-navy/15 focus:border-[#0F1419]/40',
          error ? 'border-red-400' : 'border-[#0F1419]/[0.15]',
        )}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </label>
  )
}
