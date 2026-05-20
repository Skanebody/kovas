/**
 * KOVAS — PackEditor
 *
 * Liste les packs custom du user (CRUD via /api/pricing/packs[/id]) :
 *   - Cards individuelles avec édition inline (nom, prix HT, diagnostics, actif).
 *   - Bouton "+ Activer un pack prédéfini" → dropdown des 8 PREDEFINED_PACKS.
 *   - Bouton "+ Créer un pack custom".
 *
 * Pas d'optimistic updates : on rechargemente après chaque action via router.refresh().
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { PREDEFINED_PACKS, type PredefinedPack } from '@/lib/pricing/pack-definitions'
import type { PricingDiagnosticType } from '@/lib/pricing/pricing-templates'
import { cn } from '@/lib/utils'
import { ChevronDown, Loader2, Package, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

export interface UserPackRow {
  id: string
  name: string
  description: string | null
  predefined_pack_id: string | null
  diagnostics: string[]
  price_ht: number
  applicable_for: string[] | null
  min_property_age: number | null
  is_active: boolean
}

interface PackEditorProps {
  initial: UserPackRow[]
}

const DIAGNOSTIC_LABEL: Record<string, string> = {
  DPE: 'DPE',
  AMIANTE: 'Amiante',
  PLOMB: 'Plomb',
  GAZ: 'Gaz',
  ELEC: 'Élec',
  TERMITES: 'Termites',
  CARREZ: 'Carrez',
  BOUTIN: 'Boutin',
  ERP: 'ERP',
}

function formatEur(n: number): string {
  if (Number.isInteger(n)) return `${n} €`
  return `${n.toFixed(2).replace('.', ',')} €`
}

export function PackEditor({ initial }: PackEditorProps) {
  const router = useRouter()
  const [packs, setPacks] = useState<UserPackRow[]>(initial)
  const [pending, startTransition] = useTransition()
  const [customOpen, setCustomOpen] = useState(false)

  async function refresh() {
    const res = await fetch('/api/pricing/packs', { cache: 'no-store' })
    if (res.ok) {
      const { packs: fresh } = (await res.json()) as { packs: UserPackRow[] }
      setPacks(fresh)
    }
    router.refresh()
  }

  function activatePredefined(predefined: PredefinedPack) {
    const defaultPrice = 0
    startTransition(async () => {
      const res = await fetch('/api/pricing/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: predefined.name,
          description: predefined.description,
          predefinedPackId: predefined.id,
          diagnostics: predefined.diagnostics,
          priceHt: defaultPrice,
          applicableFor: predefined.applicableFor,
          minPropertyAge: predefined.propertyConditions?.minAge ?? null,
        }),
      })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error ?? 'Erreur création pack')
        return
      }
      toast.success(`Pack "${predefined.name}" activé`)
      await refresh()
    })
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/pricing/packs/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error ?? 'Erreur suppression')
        return
      }
      toast.success('Pack supprimé')
      await refresh()
    })
  }

  async function handleSavePack(id: string, updates: Partial<UserPackRow>) {
    startTransition(async () => {
      const res = await fetch(`/api/pricing/packs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: updates.name,
          priceHt: updates.price_ht,
          diagnostics: updates.diagnostics,
          isActive: updates.is_active,
        }),
      })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error ?? 'Erreur enregistrement')
        return
      }
      toast.success('Pack enregistré')
      await refresh()
    })
  }

  return (
    <Card variant="opaque" padding="default" className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">Packs</p>
          <h3 className="text-[16px] font-semibold text-ink mt-1">Combinaisons remisées</h3>
          <p className="text-[12px] text-ink-mute mt-1 max-w-md">
            Un pack remplace la somme à l'unité quand la sélection correspond exactement.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="glass" size="sm" disabled={pending}>
                <Plus className="size-4" />
                Pack prédéfini
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-w-sm">
              {PREDEFINED_PACKS.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onSelect={() => activatePredefined(p)}
                  className="flex-col items-start gap-0.5 py-2"
                >
                  <span className="text-[13px] font-semibold text-ink">{p.name}</span>
                  <span className="text-[11px] text-ink-mute leading-snug">{p.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => setCustomOpen(true)}
            disabled={pending}
          >
            <Plus className="size-4" /> Pack custom
          </Button>
        </div>
      </div>

      {packs.length === 0 && !customOpen ? (
        <div className="rounded-lg border border-dashed border-rule bg-paper/40 p-6 text-center space-y-1">
          <Package className="size-5 mx-auto text-ink-mute" strokeWidth={1.5} />
          <p className="text-[13px] text-ink">Aucun pack actif</p>
          <p className="text-[11px] text-ink-mute">
            Active un pack prédéfini ou crée un pack custom pour proposer des remises.
          </p>
        </div>
      ) : null}

      {customOpen && (
        <PackCustomForm
          onCancel={() => setCustomOpen(false)}
          onCreated={async () => {
            setCustomOpen(false)
            await refresh()
          }}
        />
      )}

      <div className="space-y-3">
        {packs.map((pack) => (
          <PackRow
            key={pack.id}
            pack={pack}
            disabled={pending}
            onSave={handleSavePack}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </Card>
  )
}

// ============================================
// Sous-composant : ligne pack éditable
// ============================================
function PackRow({
  pack,
  disabled,
  onSave,
  onDelete,
}: {
  pack: UserPackRow
  disabled: boolean
  onSave: (id: string, updates: Partial<UserPackRow>) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState(pack.name)
  const [priceHt, setPriceHt] = useState<string>(String(pack.price_ht))
  const [isActive, setIsActive] = useState(pack.is_active)

  function commit() {
    const numeric = Number(priceHt.replace(',', '.').trim())
    onSave(pack.id, {
      name: name.trim(),
      price_ht: Number.isFinite(numeric) && numeric >= 0 ? numeric : pack.price_ht,
      is_active: isActive,
      diagnostics: pack.diagnostics,
    })
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-rule/70 p-4 space-y-3 bg-paper/70',
        !isActive && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0 space-y-1">
          <FormField label="Nom" htmlFor={`pack-name-${pack.id}`}>
            <Input
              id={`pack-name-${pack.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-[13px]"
            />
          </FormField>
        </div>
        <div className="flex flex-col gap-2">
          <FormField label="Prix HT" htmlFor={`pack-price-${pack.id}`}>
            <div className="relative w-32">
              <Input
                id={`pack-price-${pack.id}`}
                type="text"
                inputMode="decimal"
                value={priceHt}
                onChange={(e) => setPriceHt(e.target.value)}
                className="pr-7 text-right font-mono text-[12px]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-ink-mute">
                €
              </span>
            </div>
          </FormField>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {pack.diagnostics.map((d) => (
          <span
            key={d}
            className="inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.05em] bg-cream-deep text-ink-mute"
          >
            {DIAGNOSTIC_LABEL[d] ?? d}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="flex items-center gap-2 text-[12px] text-ink select-none cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-3.5 accent-navy"
          />
          Actif
        </label>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(pack.id)}
            disabled={disabled}
            className="text-accent-red hover:text-accent-red"
          >
            <Trash2 className="size-4" />
            Supprimer
          </Button>
          <Button type="button" variant="default" size="sm" onClick={commit} disabled={disabled}>
            {disabled && <Loader2 className="size-4 animate-spin" />}
            Enregistrer
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-ink-faint font-mono tabular-nums">
        Prix actuel : {formatEur(pack.price_ht)}
      </p>
    </div>
  )
}

// ============================================
// Formulaire de création pack custom
// ============================================
const ALL_DIAGNOSTICS: PricingDiagnosticType[] = [
  'DPE',
  'AMIANTE',
  'PLOMB',
  'GAZ',
  'ELEC',
  'TERMITES',
  'CARREZ',
  'BOUTIN',
  'ERP',
]

function PackCustomForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [priceHt, setPriceHt] = useState('')
  const [selected, setSelected] = useState<Set<PricingDiagnosticType>>(new Set())
  const [pending, startTransition] = useTransition()

  function toggle(d: PricingDiagnosticType) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  function submit() {
    if (name.trim().length === 0) {
      toast.error('Nom requis')
      return
    }
    if (selected.size === 0) {
      toast.error('Au moins un diagnostic requis')
      return
    }
    const numeric = Number(priceHt.replace(',', '.').trim())
    if (!Number.isFinite(numeric) || numeric < 0) {
      toast.error('Prix HT invalide')
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/pricing/packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          diagnostics: Array.from(selected),
          priceHt: numeric,
        }),
      })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error ?? 'Erreur création pack')
        return
      }
      toast.success(`Pack "${name.trim()}" créé`)
      await onCreated()
    })
  }

  return (
    <div className="rounded-lg border border-navy/30 bg-navy/[0.03] p-4 space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
        Nouveau pack custom
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Nom du pack" htmlFor="custom-pack-name" required>
          <Input
            id="custom-pack-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Pack location standard"
          />
        </FormField>
        <FormField label="Prix HT" htmlFor="custom-pack-price" required>
          <div className="relative">
            <Input
              id="custom-pack-price"
              type="text"
              inputMode="decimal"
              value={priceHt}
              onChange={(e) => setPriceHt(e.target.value)}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-mute">
              €
            </span>
          </div>
        </FormField>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-ink">Diagnostics inclus</p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_DIAGNOSTICS.map((d) => {
            const active = selected.has(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggle(d)}
                className={cn(
                  'rounded-pill px-3 py-1 text-[11px] font-mono uppercase tracking-[0.05em] border transition-colors',
                  active
                    ? 'border-navy bg-navy text-paper'
                    : 'border-rule bg-paper text-ink hover:border-ink-mute',
                )}
              >
                {DIAGNOSTIC_LABEL[d] ?? d}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button variant="default" size="sm" onClick={submit} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Créer le pack
        </Button>
      </div>
    </div>
  )
}
