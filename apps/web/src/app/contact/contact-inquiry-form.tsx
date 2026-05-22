'use client'

import { useState } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { submitContactInquiry } from './actions'
import type { ContactInquiryInput } from './schemas'

type InquiryType = ContactInquiryInput['inquiry_type']

interface FormState {
  status: 'idle' | 'submitting' | 'success' | 'error'
  message?: string
  fieldErrors?: Record<string, string>
}

const INQUIRY_OPTIONS: Array<{
  value: InquiryType
  title: string
  description: string
}> = [
  {
    value: 'particulier',
    title: 'Je suis particulier',
    description: 'Question sur un diagnostic, une étiquette DPE, un projet vente ou location.',
  },
  {
    value: 'diagnostiqueur',
    title: 'Je suis diagnostiqueur',
    description: "Démo de l'app, question abonnement, migration depuis Liciel ou OBBC.",
  },
  {
    value: 'journaliste',
    title: 'Je suis journaliste',
    description: 'Interview, source experte, données marché. Réponse sous 24h ouvrées.',
  },
  {
    value: 'partenariat',
    title: 'Partenariat / B2B',
    description: 'Notaires, agences, banques, fournisseurs énergie. Étude au cas par cas.',
  },
]

export function ContactInquiryForm() {
  const [inquiryType, setInquiryType] = useState<InquiryType>('particulier')
  const [state, setState] = useState<FormState>({ status: 'idle' })

  async function handleSubmit(formData: FormData) {
    setState({ status: 'submitting' })

    const honeypot = String(formData.get('website') ?? '')
    const consentChecked = formData.get('consent_rgpd') === 'on'

    if (!consentChecked) {
      setState({
        status: 'error',
        message: 'Vous devez accepter la politique de confidentialité pour envoyer le message.',
      })
      return
    }

    // Construction du payload typé selon discriminated union
    const base = {
      first_name: String(formData.get('first_name') ?? ''),
      last_name: String(formData.get('last_name') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: (formData.get('phone') as string) || undefined,
      message: String(formData.get('message') ?? ''),
      honeypot,
      consent_rgpd: true as const,
    }

    let payload: ContactInquiryInput

    switch (inquiryType) {
      case 'particulier':
        payload = {
          ...base,
          inquiry_type: 'particulier',
          city: (formData.get('city') as string) || undefined,
          project_type:
            ((formData.get('project_type') as string) || undefined) as
              | 'vente'
              | 'location'
              | 'renovation'
              | 'achat'
              | 'curiosite'
              | undefined,
        }
        break
      case 'diagnostiqueur':
        payload = {
          ...base,
          inquiry_type: 'diagnostiqueur',
          monthly_volume: formData.get('monthly_volume')
            ? Number(formData.get('monthly_volume'))
            : undefined,
          current_software: (formData.get('current_software') as string) || undefined,
        }
        break
      case 'journaliste':
        payload = {
          ...base,
          inquiry_type: 'journaliste',
          media: String(formData.get('media') ?? ''),
          deadline: (formData.get('deadline') as string) || undefined,
        }
        break
      case 'partenariat':
        payload = {
          ...base,
          inquiry_type: 'partenariat',
          company: String(formData.get('company') ?? ''),
          partnership_type:
            ((formData.get('partnership_type') as string) || undefined) as
              | 'notaires'
              | 'agences-immobilieres'
              | 'banques-courtiers'
              | 'fournisseurs-energie'
              | 'autre'
              | undefined,
        }
        break
    }

    const result = await submitContactInquiry(payload)

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
      <Card variant="opaque" padding="lg" className="space-y-3">
        <h3 className="text-lg font-semibold text-[#0F1419]">Message envoyé.</h3>
        <p className="text-sm text-[#0F1419]/72 leading-relaxed">{state.message}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      {/* Choix typologie */}
      <div className="space-y-3">
        <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
          Type de demande
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {INQUIRY_OPTIONS.map((opt) => {
            const isSelected = inquiryType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setInquiryType(opt.value)}
                className={cn(
                  'text-left rounded-lg border p-4 transition-colors',
                  isSelected
                    ? 'border-[#0F1419] bg-paper shadow-sm'
                    : 'border-[#0F1419]/[0.12] bg-paper/60 hover:border-[#0F1419]/30',
                )}
                aria-pressed={isSelected}
              >
                <p className="text-sm font-semibold text-[#0F1419]">{opt.title}</p>
                <p className="text-xs text-[#0F1419]/72 mt-1 leading-relaxed">{opt.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Bandeau redirection pour journaliste / partenariat */}
      {inquiryType === 'journaliste' ? (
        <Card variant="warm" padding="sm" className="text-sm text-[#0F1419]/80">
          Pour les sujets de fond, communiqués officiels et kit médias, vous pouvez consulter
          notre{' '}
          <Link href="/presse" className="underline underline-offset-4 font-medium">
            espace presse
          </Link>
          .
        </Card>
      ) : null}
      {inquiryType === 'partenariat' ? (
        <Card variant="warm" padding="sm" className="text-sm text-[#0F1419]/80">
          Pour découvrir nos programmes partenaires détaillés (notaires, agences, banques,
          fournisseurs énergie), consultez la page{' '}
          <Link href="/partenaires" className="underline underline-offset-4 font-medium">
            partenaires
          </Link>
          .
        </Card>
      ) : null}

      {/* Formulaire dynamique */}
      <form action={handleSubmit} className="space-y-5" noValidate>
        <input type="hidden" name="inquiry_type" value={inquiryType} />

        {/* Honeypot */}
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
          <Field
            name="email"
            label="Email"
            type="email"
            required
            error={state.fieldErrors?.email}
          />
          <Field
            name="phone"
            label="Téléphone (optionnel)"
            type="tel"
            placeholder="+33 ..."
            error={state.fieldErrors?.phone}
          />
        </div>

        {/* Champs spécifiques par typologie */}
        {inquiryType === 'particulier' ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field name="city" label="Ville du bien (optionnel)" />
            <SelectField
              name="project_type"
              label="Votre projet (optionnel)"
              options={[
                { value: '', label: 'Sans précision' },
                { value: 'vente', label: 'Vente' },
                { value: 'location', label: 'Location' },
                { value: 'renovation', label: 'Rénovation' },
                { value: 'achat', label: 'Achat' },
                { value: 'curiosite', label: 'Simple curiosité' },
              ]}
            />
          </div>
        ) : null}

        {inquiryType === 'diagnostiqueur' ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              name="monthly_volume"
              label="Volume mensuel (missions)"
              type="number"
              placeholder="Par exemple 60"
              error={state.fieldErrors?.['context.monthly_volume']}
            />
            <Field
              name="current_software"
              label="Logiciel actuel"
              placeholder="Liciel, OBBC, AnalysImmo..."
            />
          </div>
        ) : null}

        {inquiryType === 'journaliste' ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              name="media"
              label="Média"
              required
              placeholder="Nom du média ou de la rédaction"
              error={state.fieldErrors?.['context.media']}
            />
            <Field
              name="deadline"
              label="Échéance article (optionnel)"
              placeholder="Sous 7 jours, semaine prochaine..."
            />
          </div>
        ) : null}

        {inquiryType === 'partenariat' ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              name="company"
              label="Entreprise"
              required
              error={state.fieldErrors?.['context.company']}
            />
            <SelectField
              name="partnership_type"
              label="Type de partenariat"
              options={[
                { value: '', label: 'À préciser' },
                { value: 'notaires', label: 'Étude notariale' },
                { value: 'agences-immobilieres', label: 'Agence immobilière' },
                { value: 'banques-courtiers', label: 'Banque / courtier' },
                { value: 'fournisseurs-energie', label: 'Fournisseur énergie' },
                { value: 'autre', label: 'Autre' },
              ]}
            />
          </div>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-xs font-mono uppercase tracking-wider text-[#0F1419]/72">
            Message *
          </span>
          <textarea
            name="message"
            required
            rows={6}
            placeholder="Décrivez votre demande en quelques lignes."
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
            J&apos;accepte que mes informations soient utilisées pour traiter ma demande,
            conformément à la politique de confidentialité KOVAS.
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
            {state.status === 'submitting' ? 'Envoi en cours…' : 'Envoyer'}
          </Button>
        </div>
      </form>
    </div>
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

interface SelectFieldProps {
  name: string
  label: string
  options: Array<{ value: string; label: string }>
}

function SelectField({ name, label, options }: SelectFieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-mono uppercase tracking-wider text-[#0F1419]/72">{label}</span>
      <select
        name={name}
        defaultValue=""
        className="w-full rounded-md border border-[#0F1419]/[0.15] bg-paper/70 px-3.5 py-2.5 text-sm text-[#0F1419] focus:outline-none focus:ring-4 focus:ring-navy/15 focus:border-[#0F1419]/40"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
