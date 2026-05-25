'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'

type Status = 'idle' | 'submitting' | 'success' | 'error'

interface FormState {
  fullName: string
  cabinet: string
  city: string
  email: string
  phone: string
  monthlyVolume: string
  currentSoftware: string
}

const INITIAL_STATE: FormState = {
  fullName: '',
  cabinet: '',
  city: '',
  email: '',
  phone: '',
  monthlyVolume: '',
  currentSoftware: '',
}

const MONTHLY_VOLUMES = [
  { value: '', label: 'Sélectionner' },
  { value: '0-20', label: 'Moins de 20 missions' },
  { value: '20-60', label: '20 à 60 missions' },
  { value: '60-150', label: '60 à 150 missions' },
  { value: '150-500', label: '150 à 500 missions' },
  { value: '500+', label: 'Plus de 500 missions' },
]

const SOFTWARES = [
  { value: '', label: 'Sélectionner' },
  { value: 'Liciel', label: 'Liciel' },
  { value: 'OBBC', label: 'OBBC' },
  { value: 'AnalysImmo', label: 'AnalysImmo' },
  { value: 'ORIS', label: 'ORIS' },
  { value: 'Autre', label: 'Autre' },
  { value: 'Aucun', label: 'Aucun pour le moment' },
]

export function DemoForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setStatus('submitting')
    setErrorMessage(null)

    try {
      const response = await fetch('/api/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        setStatus('error')
        setErrorMessage(data.error ?? 'Une erreur est survenue. Merci de réessayer.')
        return
      }

      setStatus('success')
      setForm(INITIAL_STATE)
    } catch {
      setStatus('error')
      setErrorMessage('Connexion impossible. Merci de réessayer dans un instant.')
    }
  }

  if (status === 'success') {
    return (
      <output className="block space-y-4 text-center" aria-live="polite">
        <CheckCircle2 className="mx-auto size-10 text-chartreuse-deep" />
        <h2 className="text-2xl font-semibold tracking-tight">Demande bien reçue</h2>
        <p className="text-ink-mute">
          Nous vous recontactons sous 48h ouvrées pour planifier votre démo. Un email de
          confirmation vient de partir vers votre boîte.
        </p>
      </output>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold tracking-tight">Réserver ma démo</h2>
        <p className="text-sm text-ink-mute">
          Tous les champs sont obligatoires sauf le volume mensuel et le logiciel actuel.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nom complet</Label>
          <Input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={form.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            disabled={status === 'submitting'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cabinet">Nom du cabinet</Label>
          <Input
            id="cabinet"
            name="cabinet"
            type="text"
            autoComplete="organization"
            required
            value={form.cabinet}
            onChange={(e) => updateField('cabinet', e.target.value)}
            disabled={status === 'submitting'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="city">Ville</Label>
          <Input
            id="city"
            name="city"
            type="text"
            autoComplete="address-level2"
            required
            value={form.city}
            onChange={(e) => updateField('city', e.target.value)}
            disabled={status === 'submitting'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email professionnel</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            disabled={status === 'submitting'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Téléphone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            required
            placeholder="+33 6 12 34 56 78"
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            disabled={status === 'submitting'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthlyVolume">Volume mensuel</Label>
          <select
            id="monthlyVolume"
            name="monthlyVolume"
            value={form.monthlyVolume}
            onChange={(e) => updateField('monthlyVolume', e.target.value)}
            disabled={status === 'submitting'}
            className="flex min-h-[44px] w-full rounded-md border border-rule bg-paper px-4 py-3 text-[13px] text-ink transition-all duration-fast ease-spring focus-visible:border-[1.5px] focus-visible:border-navy focus-visible:outline-none focus-visible:ring-[5px] focus-visible:ring-navy/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {MONTHLY_VOLUMES.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="currentSoftware">Logiciel actuel</Label>
          <select
            id="currentSoftware"
            name="currentSoftware"
            value={form.currentSoftware}
            onChange={(e) => updateField('currentSoftware', e.target.value)}
            disabled={status === 'submitting'}
            className="flex min-h-[44px] w-full rounded-md border border-rule bg-paper px-4 py-3 text-[13px] text-ink transition-all duration-fast ease-spring focus-visible:border-[1.5px] focus-visible:border-navy focus-visible:outline-none focus-visible:ring-[5px] focus-visible:ring-navy/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {SOFTWARES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status === 'error' && errorMessage && (
        <p role="alert" className="text-sm text-[#8B1414]">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col items-center gap-3 pt-2">
        <Button
          type="submit"
          size="lg"
          variant="accent"
          disabled={status === 'submitting'}
          className="w-full sm:w-auto"
        >
          {status === 'submitting' ? 'Envoi en cours…' : 'Envoyer ma demande'}
        </Button>
        <p className="text-xs text-ink-faint">Démo planifiée sous 48h ouvrées. Sans engagement.</p>
      </div>
    </form>
  )
}
