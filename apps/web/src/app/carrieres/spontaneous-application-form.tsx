'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import {
  submitSpontaneousApplication,
  type SpontaneousApplicationInput,
} from './actions'

interface FormState {
  status: 'idle' | 'submitting' | 'success' | 'error'
  message?: string
  fieldErrors?: Record<string, string>
}

const initialState: FormState = { status: 'idle' }

/**
 * Formulaire candidature spontanée /carrieres (Lot #147).
 *
 * Champs : nom, email, LinkedIn URL (optionnel), rôle visé, message,
 * honeypot + consentement RGPD. Validation Zod côté serveur uniquement
 * — la Server Action retourne les erreurs par champ pour affichage.
 */
export function SpontaneousApplicationForm() {
  const [state, setState] = useState<FormState>(initialState)

  async function handleSubmit(formData: FormData) {
    setState({ status: 'submitting' })

    if (formData.get('consent_rgpd') !== 'on') {
      setState({
        status: 'error',
        message: 'Vous devez accepter la politique de confidentialité pour envoyer la candidature.',
      })
      return
    }

    const payload: SpontaneousApplicationInput = {
      first_name: String(formData.get('first_name') ?? ''),
      last_name: String(formData.get('last_name') ?? ''),
      email: String(formData.get('email') ?? ''),
      linkedin_url: (formData.get('linkedin_url') as string) || undefined,
      target_role: String(formData.get('target_role') ?? ''),
      message: String(formData.get('message') ?? ''),
      honeypot: String(formData.get('website') ?? ''),
      consent_rgpd: true,
    }

    const result = await submitSpontaneousApplication(payload)

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
        <h3 className="text-lg font-semibold text-[#0F1419]">Merci pour votre candidature.</h3>
        <p className="text-sm text-[#0F1419]/72 leading-relaxed">{state.message}</p>
      </Card>
    )
  }

  return (
    <form
      action={handleSubmit}
      className="max-w-3xl space-y-5"
      noValidate
    >
      {/* Honeypot — caché aux humains, visible aux bots */}
      <div className="hidden" aria-hidden="true">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <FieldText
          name="first_name"
          label="Prénom"
          required
          error={state.fieldErrors?.first_name}
        />
        <FieldText
          name="last_name"
          label="Nom"
          required
          error={state.fieldErrors?.last_name}
        />
      </div>

      <FieldText
        name="email"
        label="Email professionnel"
        type="email"
        required
        error={state.fieldErrors?.email}
      />

      <FieldText
        name="linkedin_url"
        label="URL LinkedIn (recommandé)"
        type="url"
        placeholder="https://www.linkedin.com/in/..."
        error={state.fieldErrors?.linkedin_url}
      />

      <FieldText
        name="target_role"
        label="Rôle visé"
        placeholder="Ingénieur frontend, support métier..."
        required
        error={state.fieldErrors?.target_role}
      />

      <FieldTextarea
        name="message"
        label="Votre message"
        placeholder="Présentez-vous en quelques lignes et expliquez ce qui vous attire chez KOVAS."
        required
        rows={6}
        error={state.fieldErrors?.message}
      />

      <label className="flex items-start gap-3 text-sm text-[#0F1419]/72">
        <input
          type="checkbox"
          name="consent_rgpd"
          required
          className="mt-1 size-4 rounded border-[#0F1419]/[0.2]"
        />
        <span>
          J&apos;accepte que mes informations soient conservées pour le suivi de ma candidature
          spontanée, conformément à la politique de confidentialité KOVAS. Je peux demander
          leur suppression à tout moment à contact@kovas.fr.
        </span>
      </label>

      {state.status === 'error' && state.message ? (
        <p className="text-sm text-red-600">{state.message}</p>
      ) : null}

      <div>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          disabled={state.status === 'submitting'}
        >
          {state.status === 'submitting' ? 'Envoi en cours…' : 'Envoyer ma candidature'}
        </Button>
      </div>
    </form>
  )
}

interface FieldTextProps {
  name: string
  label: string
  type?: string
  required?: boolean
  placeholder?: string
  error?: string
}

function FieldText({ name, label, type = 'text', required, placeholder, error }: FieldTextProps) {
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

interface FieldTextareaProps {
  name: string
  label: string
  required?: boolean
  rows?: number
  placeholder?: string
  error?: string
}

function FieldTextarea({
  name,
  label,
  required,
  rows = 5,
  placeholder,
  error,
}: FieldTextareaProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-mono uppercase tracking-wider text-[#0F1419]/72">
        {label}
        {required ? ' *' : ''}
      </span>
      <textarea
        name={name}
        required={required}
        rows={rows}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border bg-paper/70 px-3.5 py-2.5 text-sm text-[#0F1419] placeholder:text-[#0F1419]/40 leading-relaxed',
          'focus:outline-none focus:ring-4 focus:ring-navy/15 focus:border-[#0F1419]/40',
          error ? 'border-red-400' : 'border-[#0F1419]/[0.15]',
        )}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </label>
  )
}
