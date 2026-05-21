'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface VariantInput {
  id: string
  name: string
  label: string
  weight: number
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function NewExperimentForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [experimentKey, setExperimentKey] = useState('')
  const [description, setDescription] = useState('')
  const [hypothesis, setHypothesis] = useState('')
  const [primaryMetric, setPrimaryMetric] = useState('')
  const [variants, setVariants] = useState<VariantInput[]>([
    { id: newId(), name: 'control', label: 'Contrôle', weight: 50 },
    { id: newId(), name: 'variant_a', label: 'Variant A', weight: 50 },
  ])

  function updateVariant(i: number, patch: Partial<VariantInput>) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))
  }
  function addVariant() {
    const next = variants.length
    setVariants((prev) => [
      ...prev,
      {
        id: newId(),
        name: `variant_${String.fromCharCode(97 + next - 1)}`,
        label: `Variant ${next}`,
        weight: 0,
      },
    ])
  }
  function removeVariant(i: number) {
    setVariants((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (pending) return
    setPending(true)
    try {
      const res = await fetch('/api/ab/admin/experiments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          experimentKey: experimentKey.trim(),
          description: description.trim(),
          hypothesis: hypothesis.trim() || null,
          primaryMetric: primaryMetric.trim() || null,
          variants: variants.map((v) => ({
            name: v.name.trim(),
            weight: Number(v.weight),
            label: v.label.trim() || undefined,
          })),
        }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string }
        setError(json.error ?? 'Erreur création')
        return
      }
      const json = (await res.json()) as { id: string }
      router.push(`/admin/ab-testing/${json.id}`)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <FormField label="Clé technique" hint="kebab-case, unique. Exemple : email-1-tone">
        <input
          type="text"
          required
          value={experimentKey}
          onChange={(e) => setExperimentKey(e.target.value)}
          placeholder="email-1-tone"
          className="w-full px-3 py-2 rounded-md border border-rule bg-paper text-[13px] text-ink font-mono"
        />
      </FormField>

      <FormField label="Description" hint="Visible dans le dashboard admin">
        <textarea
          required
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Email J+1 : tutoiement vs vouvoiement"
          className="w-full px-3 py-2 rounded-md border border-rule bg-paper text-[13px] text-ink"
        />
      </FormField>

      <FormField label="Hypothèse" hint="Optionnel — la conviction testée">
        <textarea
          rows={2}
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          placeholder="Le tutoiement augmente le taux de clic vs vouvoiement"
          className="w-full px-3 py-2 rounded-md border border-rule bg-paper text-[13px] text-ink"
        />
      </FormField>

      <FormField
        label="Métrique principale"
        hint="Optionnel — événement de conversion (texte libre)"
      >
        <input
          type="text"
          value={primaryMetric}
          onChange={(e) => setPrimaryMetric(e.target.value)}
          placeholder="email_click_rate"
          className="w-full px-3 py-2 rounded-md border border-rule bg-paper text-[13px] text-ink font-mono"
        />
      </FormField>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-ink-mute">
            Variants ({variants.length})
          </span>
          <button
            type="button"
            onClick={addVariant}
            className="text-[11px] text-navy hover:underline"
          >
            + Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {variants.map((v, i) => (
            <div key={v.id} className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 items-center">
              <input
                type="text"
                value={v.name}
                onChange={(e) => updateVariant(i, { name: e.target.value })}
                placeholder="control"
                className="px-2 py-1.5 rounded-md border border-rule bg-paper text-[12px] font-mono text-ink"
              />
              <input
                type="text"
                value={v.label}
                onChange={(e) => updateVariant(i, { label: e.target.value })}
                placeholder="Contrôle"
                className="px-2 py-1.5 rounded-md border border-rule bg-paper text-[12px] text-ink"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={v.weight}
                onChange={(e) => updateVariant(i, { weight: Number(e.target.value) })}
                className="px-2 py-1.5 rounded-md border border-rule bg-paper text-[12px] font-mono text-ink text-right"
              />
              <button
                type="button"
                onClick={() => removeVariant(i)}
                disabled={variants.length <= 2}
                className="text-[11px] text-ink-mute hover:text-[#8B1414] disabled:opacity-30 px-2"
                aria-label="Retirer ce variant"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-ink-mute mt-1">
          Les poids sont normalisés automatiquement à la création. Minimum 2 variants.
        </p>
      </div>

      {error ? (
        <div className="text-[12px] text-[#8B1414] bg-coral-mist rounded-md px-3 py-2">{error}</div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/ab-testing')}
        >
          Annuler
        </Button>
        <Button type="submit" variant="default" size="sm" disabled={pending}>
          {pending ? 'Création…' : 'Créer en brouillon'}
        </Button>
      </div>
    </form>
  )
}

function FormField({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="block">
      <span className="text-[11px] font-mono uppercase tracking-wider text-ink-mute block mb-1.5">
        {label}
      </span>
      {children}
      {hint ? <p className="text-[10px] text-ink-mute mt-1">{hint}</p> : null}
    </div>
  )
}
