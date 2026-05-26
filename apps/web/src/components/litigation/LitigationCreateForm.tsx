'use client'

/**
 * KOVAS — Formulaire de création d'un litige.
 *
 * Appelé quand aucun `litigation_workflows` n'existe pour le dossier.
 * Soumet à POST /api/litigation (à créer par l'agent backend, hors scope ici).
 * Pour V1 on insère directement côté client via supabase ? Non — convention
 * projet : on POST une route Next. Si elle n'existe pas, on tombe en mock toast.
 */

import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Select } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'

export interface LitigationCreateFormProps {
  dossierId: string
  missionId: string | null
}

const LITIGATION_TYPES = [
  { value: 'dpe_contestation', label: 'Contestation étiquette DPE' },
  { value: 'erreur_surface_carrez', label: 'Erreur surface Carrez/Boutin' },
  { value: 'oubli_diagnostic', label: 'Oubli de diagnostic' },
  { value: 'amiante_non_detecte', label: 'Amiante non détecté' },
  { value: 'plomb_non_detecte', label: 'Plomb non détecté' },
  { value: 'gaz_securite', label: 'Anomalie gaz / sécurité' },
  { value: 'electricite_securite', label: 'Anomalie électricité / sécurité' },
  { value: 'demande_remboursement', label: 'Demande de remboursement' },
  { value: 'autre', label: 'Autre' },
] as const

export function LitigationCreateForm({ dossierId, missionId }: LitigationCreateFormProps) {
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      dossier_id: dossierId,
      mission_id: missionId,
      litigation_type: String(fd.get('litigation_type') ?? 'autre'),
      client_complaint: String(fd.get('client_complaint') ?? ''),
    }
    if (!payload.client_complaint.trim()) {
      toast.error('Décrivez la plainte du client')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/litigation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      toast.success('Litige ouvert')
      // Refresh côté server component parent
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Création impossible')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card variant="opaque" padding="default" className="space-y-5">
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold text-[#0F1419]">Ouvrir un litige</h3>
        <p className="text-[11px] text-[#0F1419]/72">
          KOVAS générera un projet de réponse argumentée et juridiquement référencée.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Type de litige" required>
          <Select name="litigation_type" required defaultValue="dpe_contestation">
            {LITIGATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField
          label="Plainte du client"
          required
          hint="Recopiez le courrier ou décrivez les griefs reçus"
        >
          <textarea
            name="client_complaint"
            required
            rows={6}
            className="flex w-full rounded-md border border-[#0F1419]/[0.08] bg-paper px-4 py-3 text-[13px] text-[#0F1419] transition-all duration-fast ease-spring placeholder:text-[#0F1419]/55 focus-visible:outline-none focus-visible:border-[1.5px] focus-visible:border-navy focus-visible:ring-[5px] focus-visible:ring-navy/10 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Le client conteste l'étiquette DPE en arguant que…"
          />
        </FormField>
        <div className="flex items-center justify-end">
          <Button type="submit" variant="accent" size="lg" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Ouverture…
              </>
            ) : (
              'Ouvrir le litige'
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}
