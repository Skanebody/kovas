'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface CurrentValues {
  first_name: string
  last_name: string
  email: string
  city: string
  department_name: string
  certifications: string
  certification_organization: string
}

interface CorrectionFormProps {
  diagId: string
  currentValues: CurrentValues
}

const FIELD_LABELS: Record<keyof CurrentValues, string> = {
  first_name: 'Prénom',
  last_name: 'Nom',
  email: 'Email',
  city: 'Ville',
  department_name: 'Département',
  certifications: 'Certifications',
  certification_organization: 'Organisme certificateur',
}

export function CorrectionForm({ diagId, currentValues }: CorrectionFormProps) {
  const [values, setValues] = useState<CurrentValues>(currentValues)
  const [message, setMessage] = useState('')
  const [contactEmail, setContactEmail] = useState(currentValues.email)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function updateField(field: keyof CurrentValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  function computeProposedChanges(): Partial<CurrentValues> {
    const changes: Partial<CurrentValues> = {}
    for (const key of Object.keys(currentValues) as Array<keyof CurrentValues>) {
      if (values[key] !== currentValues[key]) {
        changes[key] = values[key]
      }
    }
    return changes
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const changes = computeProposedChanges()
    if (Object.keys(changes).length === 0 && !message.trim()) {
      setError('Veuillez modifier au moins un champ ou ajouter un message.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const resp = await fetch(`/api/diagnostiqueurs/${diagId}/corriger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_values: currentValues,
          proposed_changes: changes,
          message: message.trim() || null,
          contact_email: contactEmail.trim() || null,
        }),
      })
      if (!resp.ok) {
        const data = (await resp.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Une erreur est survenue. Réessayez.')
        return
      }
      setDone(true)
    } catch {
      setError('Erreur réseau. Réessaie dans un instant.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-3 text-center py-4">
        <CheckCircle2 className="size-10 mx-auto text-success" />
        <h2 className="font-display text-lg font-semibold text-ink">Correction transmise</h2>
        <p className="text-[13px] text-ink-mute leading-relaxed">
          Merci. Nous traitons ta demande sous 72&nbsp;heures et te tiendrons informé(e) par email
          dès la mise à jour effectuée.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-[11px] text-ink-faint font-mono uppercase tracking-wider">
        Informations actuelles (modifiables ci-dessous)
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Object.keys(FIELD_LABELS) as Array<keyof CurrentValues>).map((field) => (
          <FormField key={field} label={FIELD_LABELS[field]}>
            <Input
              type="text"
              value={values[field]}
              onChange={(e) => updateField(field, e.target.value)}
              maxLength={200}
            />
          </FormField>
        ))}
      </div>

      <FormField label="Message libre (facultatif)">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Explique les corrections à apporter, ajoute des justificatifs, ou indique tout autre détail utile."
        />
      </FormField>

      <FormField label="Email pour te recontacter">
        <Input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          maxLength={200}
          required
        />
      </FormField>

      {error ? (
        <p className="text-[13px] text-danger bg-danger/5 border border-danger/20 rounded-md px-3 py-2">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="default" size="lg" disabled={submitting} className="w-full">
        {submitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Envoi…
          </>
        ) : (
          'Envoyer la correction'
        )}
      </Button>
    </form>
  )
}
