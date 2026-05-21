'use client'

import { useState } from 'react'

interface Props {
  diagnosticianId: string
  diagnosticianName: string
}

/**
 * Formulaire de demande de devis B2C.
 * TOUJOURS visible (même sur fiche basic) — c'est le hook pay-to-unlock :
 * tous les diag peuvent recevoir des leads, mais seuls les abonnés
 * voient les coordonnées.
 *
 * Le POST est traité par /api/quote-requests (à créer côté B2).
 * En attendant, on simule un envoi optimiste pour ne pas bloquer la page.
 */
export function QuoteRequestForm({ diagnosticianId, diagnosticianName }: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')

    const form = event.currentTarget
    const formData = new FormData(form)
    const payload = {
      diagnostician_id: diagnosticianId,
      requester_first_name: formData.get('first_name'),
      requester_last_name: formData.get('last_name'),
      requester_email: formData.get('email'),
      requester_phone: formData.get('phone'),
      property_address: formData.get('property_address'),
      property_postal_code: formData.get('postal_code'),
      property_city: formData.get('city'),
      property_type: formData.get('property_type'),
      property_surface_m2: formData.get('surface'),
      diagnostics_requested: formData.getAll('diagnostics'),
      message: formData.get('message'),
    }

    try {
      const res = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('failed')
      setStatus('sent')
      form.reset()
    } catch {
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-2xl bg-green-50 border border-green-200 p-6 text-center">
        <p className="font-semibold text-green-800">Demande envoyée.</p>
        <p className="text-sm text-green-700 mt-2">
          {diagnosticianName} recevra votre demande par email et vous recontactera sous 48 h.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="font-semibold text-lg text-[#0B1D33]">Demander un devis</h2>
      <p className="text-sm text-neutral-600">Réponse sous 48 h, gratuit, sans engagement.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field name="first_name" label="Prénom" required />
        <Field name="last_name" label="Nom" required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field name="email" label="Email" type="email" required />
        <Field name="phone" label="Téléphone" type="tel" required />
      </div>

      <Field name="property_address" label="Adresse du bien" required />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field name="postal_code" label="Code postal" required />
        <Field name="city" label="Ville" required className="sm:col-span-2" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SelectField
          name="property_type"
          label="Type de bien"
          options={[
            { value: 'appartement', label: 'Appartement' },
            { value: 'maison', label: 'Maison' },
            { value: 'local_commercial', label: 'Local commercial' },
          ]}
          required
        />
        <Field name="surface" label="Surface (m²)" type="number" required />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[#0B1D33]">Diagnostics souhaités</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {['dpe', 'amiante', 'plomb', 'gaz', 'electricite', 'termites', 'carrez', 'erp'].map(
            (diag) => (
              <label
                key={diag}
                className="inline-flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg hover:bg-neutral-50"
              >
                <input
                  type="checkbox"
                  name="diagnostics"
                  value={diag}
                  className="size-4 accent-[#0B1D33]"
                />
                <span className="capitalize">{diag === 'erp' ? 'ERP' : diag}</span>
              </label>
            ),
          )}
        </div>
      </fieldset>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-[#0B1D33] mb-1">
          Message complémentaire (optionnel)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1D33]/30"
        />
      </div>

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full rounded-full bg-[#0B1D33] text-white font-medium py-3 hover:bg-[#0B1D33]/90 transition disabled:opacity-50"
      >
        {status === 'sending' ? 'Envoi…' : 'Envoyer la demande'}
      </button>

      {status === 'error' ? (
        <p className="text-sm text-red-600">
          Erreur lors de l&apos;envoi. Réessayez ou contactez support@kovas.fr.
        </p>
      ) : null}

      <p className="text-xs text-neutral-500 leading-relaxed">
        En envoyant cette demande, vous acceptez que vos coordonnées soient transmises au
        diagnostiqueur sélectionné. Cf.{' '}
        <a href="/confidentialite" className="underline">
          politique de confidentialité
        </a>
        .
      </p>
    </form>
  )
}

function Field({
  name,
  label,
  type = 'text',
  required,
  className,
}: {
  name: string
  label: string
  type?: string
  required?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="block text-sm font-medium text-[#0B1D33] mb-1">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1D33]/30"
      />
    </div>
  )
}

function SelectField({
  name,
  label,
  options,
  required,
}: {
  name: string
  label: string
  options: { value: string; label: string }[]
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-[#0B1D33] mb-1">
        {label}
        {required ? ' *' : ''}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B1D33]/30"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
