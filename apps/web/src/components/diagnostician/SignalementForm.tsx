'use client'

import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'

/**
 * Formulaire public de signalement d'un diagnostiqueur (anonymisable).
 *
 * Soumet à /api/public/signalements qui :
 *   - vérifie 1 signalement / IP / diag / 24h
 *   - insère dans diagnostician_signalements (status='new')
 *   - le trigger SQL trg_signalement_threshold déclenche l'alerte si 3+ en 6 mois.
 */

const REASONS: Array<{ value: string; label: string }> = [
  { value: 'faux_diagnostiqueur', label: 'Faux diagnostiqueur (non certifié)' },
  { value: 'rapport_frauduleux', label: 'Rapport frauduleux ou falsifié' },
  { value: 'dpe_aberrant', label: 'Résultat DPE manifestement aberrant' },
  { value: 'disparu_apres_paiement', label: 'Disparu après paiement / impossible à joindre' },
  { value: 'identite_usurpee', label: "Suspicion d'usurpation d'identité" },
  { value: 'non_certifie', label: "Affirme être certifié alors qu'il ne l'est pas" },
  { value: 'autre', label: 'Autre (préciser ci-dessous)' },
]

interface Props {
  diagnosticianId: string
}

export function SignalementForm({ diagnosticianId }: Props) {
  const [reason, setReason] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [reporterEmail, setReporterEmail] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError(null)

    if (!reason) {
      setError('Sélectionnez une raison.')
      return
    }
    if (description.length < 20) {
      setError('Décrivez la situation en 20 caractères minimum.')
      return
    }

    setSubmitting(true)
    try {
      const resp = await fetch('/api/public/signalements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosticianId,
          reason,
          description: description.trim(),
          reporterEmail: reporterEmail.trim() || undefined,
        }),
      })

      if (resp.status === 429) {
        const data = (await resp.json().catch(() => ({}))) as { message?: string }
        setError(
          data.message ?? 'Vous avez déjà signalé ce diagnostiqueur dans les dernières 24 heures.',
        )
        setSubmitting(false)
        return
      }

      if (!resp.ok) {
        setError('Erreur de soumission. Merci de réessayer dans quelques instants.')
        setSubmitting(false)
        return
      }

      setDone(true)
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-rule bg-paper p-6 text-center">
        <div className="mx-auto inline-flex items-center justify-center size-12 rounded-full bg-lime-mist text-[#2D4015]">
          <CheckCircle2 className="size-6" aria-hidden />
        </div>
        <h2 className="text-lg font-display font-bold text-ink mt-4">Signalement transmis</h2>
        <p className="text-sm text-ink-mute mt-2 max-w-md mx-auto">
          Notre équipe modération étudiera votre signalement sous 48 heures ouvrables. Si vous nous
          avez communiqué votre email, vous recevrez un retour le cas échéant.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-rule bg-paper p-6 space-y-5">
      <div>
        <label
          htmlFor="reason"
          className="block font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-1.5"
        >
          Raison principale *
        </label>
        <select
          id="reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-md border border-rule bg-paper px-3 py-2.5 text-[14px] text-ink"
        >
          <option value="">— Choisir une raison —</option>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="description"
          className="block font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-1.5"
        >
          Description précise * (min. 20 caractères)
        </label>
        <textarea
          id="description"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Décrivez les faits, dates, montants éventuels, références de DPE concernés..."
          className="w-full rounded-md border border-rule bg-paper px-3 py-2.5 text-[14px] text-ink"
        />
        <p className="text-[11px] text-ink-faint mt-1">{description.length} / 2000 caractères</p>
      </div>

      <div>
        <label
          htmlFor="email"
          className="block font-mono text-[10px] uppercase tracking-wider text-ink-mute mb-1.5"
        >
          Votre email (optionnel — pour suivi)
        </label>
        <input
          id="email"
          type="email"
          value={reporterEmail}
          onChange={(e) => setReporterEmail(e.target.value)}
          placeholder="vous@exemple.fr"
          className="w-full rounded-md border border-rule bg-paper px-3 py-2.5 text-[14px] text-ink"
        />
        <p className="text-[11px] text-ink-faint mt-1">
          Jamais communiqué au diagnostiqueur. Uniquement utilisé par l'équipe KOVAS pour vous
          recontacter si nécessaire.
        </p>
      </div>

      {error ? (
        <div className="rounded-md bg-coral-mist border border-coral-mist-foreground/30 p-3 flex items-start gap-2 text-[13px]">
          <AlertCircle className="size-4 text-coral-mist-foreground shrink-0 mt-0.5" aria-hidden />
          <span className="text-[#8B1414]">{error}</span>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        <Button type="submit" variant="default" disabled={submitting}>
          {submitting ? 'Envoi…' : 'Envoyer le signalement'}
        </Button>
      </div>
    </form>
  )
}
