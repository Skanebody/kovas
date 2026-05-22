'use client'

/**
 * KOVAS — Calculateur DPE gratuit (Lot #143)
 *
 * `<LeadForm>` — formulaire coordonnées affiché après la ResultCard.
 *
 * Champs :
 *  - Nom complet (required)
 *  - Email (required, regex client + Zod côté server)
 *  - Téléphone (required, normalisé E.164 server-side)
 *  - Code postal (required, 5 chiffres)
 *  - Ville (required, autocomplete BAN debounce 300ms)
 *  - Adresse (optionnel)
 *  - Type de demande (radio)
 *  - Consentement RGPD (required)
 *  - Honeypot caché 'website'
 *
 * Soumission via Server Action `submitDpeLead`. PostHog track event à
 * la soumission réussie.
 */

import { Loader2 } from 'lucide-react'
import posthog from 'posthog-js'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { searchBanAddress, type BanFeature } from '@/lib/ban'
import type {
  CalculatorAnswers,
  DpeClass,
} from '@/lib/dpe-calculator/question-tree'

import { submitDpeLead, type SubmitDpeLeadInput } from './actions'

interface LeadFormProps {
  answers: CalculatorAnswers
  estimatedClass: DpeClass
  detectedCity: string | null
  detectedPostalCode: string | null
  onCancel: () => void
  onSuccess: () => void
}

type RequestType = 'quote_only' | 'estimation_only' | 'both'

interface FormState {
  full_name: string
  email: string
  phone: string
  postal_code: string
  city: string
  address: string
  request_type: RequestType
  consent_rgpd: boolean
}

const INITIAL: FormState = {
  full_name: '',
  email: '',
  phone: '',
  postal_code: '',
  city: '',
  address: '',
  request_type: 'both',
  consent_rgpd: false,
}

export function LeadForm({
  answers,
  estimatedClass,
  detectedCity,
  detectedPostalCode,
  onCancel,
  onSuccess,
}: LeadFormProps) {
  const [form, setForm] = useState<FormState>(() => ({
    ...INITIAL,
    city: detectedCity ?? '',
    postal_code: detectedPostalCode ?? '',
  }))
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // BAN autocomplete pour la ville
  const [citySuggestions, setCitySuggestions] = useState<BanFeature[]>([])
  const [cityOpen, setCityOpen] = useState(false)
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (fieldErrors[`contact.${key}`]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[`contact.${key}`]
        return next
      })
    }
  }

  useEffect(() => {
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current)
    if (form.city.trim().length < 3) {
      setCitySuggestions([])
      return
    }
    cityDebounceRef.current = setTimeout(async () => {
      const features = await searchBanAddress(form.city, 5)
      // Filtre : on garde les municipalités ou résultats avec city+postcode
      const onlyCities = features.filter(
        (f) =>
          f.properties.type === 'municipality' ||
          f.properties.type === 'locality' ||
          (f.properties.city && f.properties.postcode),
      )
      setCitySuggestions(onlyCities)
    }, 300)
    return () => {
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current)
    }
  }, [form.city])

  function selectCity(f: BanFeature) {
    const city = f.properties.city ?? f.properties.name ?? ''
    const postcode = f.properties.postcode ?? form.postal_code
    setForm((prev) => ({ ...prev, city, postal_code: postcode }))
    setCityOpen(false)
    setCitySuggestions([])
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting) return
    setGlobalError(null)
    setFieldErrors({})

    if (!form.consent_rgpd) {
      setFieldErrors({ 'contact.consent_rgpd': 'Le consentement est obligatoire.' })
      return
    }

    // Honeypot caché
    const honeypotValue = (
      e.currentTarget.elements.namedItem('website') as HTMLInputElement | null
    )?.value
    setSubmitting(true)
    try {
      // À ce stade, `areAllAnswersComplete(answers)` est garanti par le
      // composant parent (la ResultCard ne s'affiche qu'après les 8 réponses).
      // Le re-cast `as SubmitDpeLeadInput['answers']` est nécessaire car
      // `CalculatorAnswers` autorise des null pour le state intermédiaire du
      // stepper — la Server Action re-valide via Zod de toute façon.
      const result = await submitDpeLead({
        answers: answers as SubmitDpeLeadInput['answers'],
        contact: {
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          postal_code: form.postal_code,
          city: form.city,
          address: form.address.trim() ? form.address.trim() : null,
          request_type: form.request_type,
          consent_rgpd: true,
        },
        honeypot: honeypotValue ?? '',
      })

      if (!result.ok) {
        setGlobalError(result.error ?? 'Une erreur est survenue.')
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        return
      }

      // PostHog tracking event
      try {
        posthog.capture('lead.dpe-calculator.submitted', {
          estimated_class: estimatedClass,
          request_type: form.request_type,
          recipient_count: result.recipientCount ?? 0,
          city: form.city,
          postal_code: form.postal_code,
        })
      } catch {
        // ignore — posthog peut ne pas être initialisé en dev
      }

      onSuccess()
    } catch (err) {
      console.error('[lead-form] submit failed', err)
      setGlobalError(
        'Erreur réseau. Vérifiez votre connexion et réessayez dans un instant.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <header className="space-y-1.5">
        <h2 className="font-display text-[22px] font-bold text-ink sm:text-[26px]">
          Recevez votre estimation détaillée
        </h2>
        <p className="text-[14px] text-ink-mute">
          Vos coordonnées nous permettent de vous envoyer le détail du calcul et,
          si vous le souhaitez, des devis de diagnostiqueurs certifiés.
        </p>
      </header>

      {globalError ? (
        <div
          role="alert"
          className="rounded-md border border-accent-red/30 bg-accent-red-soft px-4 py-3 text-[13px] text-accent-red"
        >
          {globalError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Nom complet"
          required
          error={fieldErrors['contact.full_name']}
        >
          <input
            type="text"
            name="full_name"
            autoComplete="name"
            value={form.full_name}
            onChange={(e) => patch('full_name', e.target.value)}
            className={inputClass}
            required
          />
        </Field>

        <Field label="Email" required error={fieldErrors['contact.email']}>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => patch('email', e.target.value)}
            className={inputClass}
            required
          />
        </Field>

        <Field label="Téléphone" required error={fieldErrors['contact.phone']}>
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            placeholder="06 12 34 56 78"
            value={form.phone}
            onChange={(e) => patch('phone', e.target.value)}
            className={inputClass}
            required
          />
        </Field>

        <Field
          label="Code postal du bien"
          required
          error={fieldErrors['contact.postal_code']}
        >
          <input
            type="text"
            name="postal_code"
            autoComplete="postal-code"
            inputMode="numeric"
            pattern="\d{5}"
            maxLength={5}
            value={form.postal_code}
            onChange={(e) =>
              patch('postal_code', e.target.value.replace(/[^0-9]/g, '').slice(0, 5))
            }
            className={inputClass}
            required
          />
        </Field>

        <div className="relative sm:col-span-2">
          <Field
            label="Ville du bien"
            required
            error={fieldErrors['contact.city']}
          >
            <input
              type="text"
              name="city"
              autoComplete="address-level2"
              value={form.city}
              onChange={(e) => {
                patch('city', e.target.value)
                setCityOpen(true)
              }}
              onFocus={() => setCityOpen(true)}
              onBlur={() => setTimeout(() => setCityOpen(false), 150)}
              className={inputClass}
              required
            />
          </Field>
          {cityOpen && citySuggestions.length > 0 ? (
            <ul
              role="listbox"
              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-paper shadow-glass-lg"
            >
              {citySuggestions.map((f, idx) => (
                <li key={`${f.properties.label}-${idx}`}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectCity(f)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-[13px] hover:bg-ink/5 focus-visible:bg-ink/5 focus-visible:outline-none"
                  >
                    <span className="font-medium text-ink">
                      {f.properties.city ?? f.properties.name}
                    </span>
                    {f.properties.postcode ? (
                      <span className="text-ink-mute">({f.properties.postcode})</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="sm:col-span-2">
          <Field
            label="Adresse du bien (optionnel)"
            error={fieldErrors['contact.address']}
          >
            <input
              type="text"
              name="address"
              autoComplete="street-address"
              value={form.address}
              onChange={(e) => patch('address', e.target.value)}
              className={inputClass}
              placeholder="12 rue de la République"
            />
          </Field>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 block text-[13px] font-semibold text-ink">
          Type de demande
        </legend>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {(
            [
              { v: 'quote_only', label: 'Je veux un devis' },
              { v: 'estimation_only', label: "Juste l'estimation par email" },
              { v: 'both', label: 'Les deux' },
            ] as Array<{ v: RequestType; label: string }>
          ).map((opt) => (
            <label
              key={opt.v}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg border bg-paper px-3 py-2.5 text-[13px]',
                'min-h-[48px]',
                'transition-all duration-fast hover:border-ink/40',
                form.request_type === opt.v
                  ? 'border-chartreuse bg-chartreuse/10 font-semibold text-ink'
                  : 'border-border text-ink-mute',
              )}
            >
              <input
                type="radio"
                name="request_type"
                value={opt.v}
                checked={form.request_type === opt.v}
                onChange={() => patch('request_type', opt.v)}
                className="accent-chartreuse-deep"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-start gap-3 rounded-lg border border-border bg-paper p-3">
        <input
          type="checkbox"
          checked={form.consent_rgpd}
          onChange={(e) => patch('consent_rgpd', e.target.checked)}
          className="mt-0.5 size-4 accent-chartreuse-deep"
          required
        />
        <span className="text-[12px] leading-relaxed text-ink">
          J'accepte que mes coordonnées soient transmises à des diagnostiqueurs
          certifiés près de chez moi pour me proposer un devis. Conformément au
          RGPD, je peux exercer mes droits via{' '}
          <a
            href="/confidentialite"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-chartreuse-deep"
          >
            la politique de confidentialité
          </a>
          .
        </span>
      </label>
      {fieldErrors['contact.consent_rgpd'] ? (
        <p className="text-[12px] text-accent-red">
          {fieldErrors['contact.consent_rgpd']}
        </p>
      ) : null}

      {/* Honeypot caché */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        aria-hidden
      />

      <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border pt-5 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={onCancel}
          disabled={submitting}
        >
          Retour à l'estimation
        </Button>
        <Button type="submit" variant="accent" size="lg" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Envoi en cours…
            </>
          ) : (
            'Envoyer ma demande'
          )}
        </Button>
      </div>
    </form>
  )
}

const inputClass = cn(
  'block w-full rounded-lg border border-border bg-paper px-3.5 py-2.5',
  'text-[14px] text-ink',
  'placeholder:text-ink-faint',
  'transition-all duration-fast',
  'focus-visible:outline-none focus-visible:border-chartreuse-deep focus-visible:ring-4 focus-visible:ring-chartreuse/20',
  'min-h-[44px]',
)

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink">
        {label}
        {required ? <span className="ml-0.5 text-accent-red">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[12px] text-accent-red">{error}</span>
      ) : null}
    </label>
  )
}
