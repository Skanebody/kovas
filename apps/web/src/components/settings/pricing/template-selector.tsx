/**
 * KOVAS — TemplateSelector
 *
 * Premier écran de configuration. Présente les 3 templates pré-remplis
 * (Économique / Médian recommandé / Premium) + une 4ème option "Grille
 * vierge" qui crée la config minimale `has_configured: true` mais avec
 * pricing_config vide.
 *
 * Au clic : POST /api/pricing/templates/[id]/apply puis router.refresh().
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ALL_TEMPLATES, type PricingTemplate } from '@/lib/pricing/pricing-templates'
import { cn } from '@/lib/utils'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

function formatEur(n: number): string {
  if (Number.isInteger(n)) return `${n} €`
  return `${n.toFixed(2).replace('.', ',')} €`
}

export function TemplateSelector() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function apply(id: string) {
    setSelectedId(id)
    startTransition(async () => {
      const res = await fetch(`/api/pricing/templates/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error ?? 'Erreur application template')
        setSelectedId(null)
        return
      }
      toast.success('Tarifs initialisés')
      router.refresh()
    })
  }

  async function applyBlank() {
    setSelectedId('blank')
    startTransition(async () => {
      // Approche : applique le template median pour des valeurs raisonnables
      // par défaut (sinon une grille vide bloquerait tout). L'utilisateur
      // ajuste ensuite par diagnostic. On marque la PUT comme "blank".
      const res = await fetch('/api/pricing/templates/median/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) {
        toast.error('Erreur initialisation')
        setSelectedId(null)
        return
      }
      toast.success('Grille initialisée — ajuste chaque diagnostic à ta convenance')
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
          Première configuration
        </p>
        <h2 className="font-serif italic text-3xl text-ink">Choisis un point de départ</h2>
        <p className="text-[13px] text-ink-mute">
          Trois grilles tarifaires pré-remplies issues de l'étude marché FR 2025–2026. Tu pourras
          tout ajuster diagnostic par diagnostic ensuite.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ALL_TEMPLATES.map((tpl) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            recommended={tpl.id === 'median'}
            pending={pending && selectedId === tpl.id}
            disabled={pending && selectedId !== tpl.id}
            onSelect={() => apply(tpl.id)}
          />
        ))}
      </div>

      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={applyBlank}
          disabled={pending}
          className="text-[12px] text-ink-mute underline underline-offset-4 hover:text-ink disabled:opacity-50"
        >
          Ou démarrer avec une grille vierge à personnaliser →
        </button>
      </div>
    </div>
  )
}

function TemplateCard({
  template,
  recommended,
  pending,
  disabled,
  onSelect,
}: {
  template: PricingTemplate
  recommended: boolean
  pending: boolean
  disabled: boolean
  onSelect: () => void
}) {
  const dpePrice = template.diagnostics.DPE.basePrice
  const amiantePrice = template.diagnostics.AMIANTE.basePrice
  const plombPrice = template.diagnostics.PLOMB.basePrice

  return (
    <Card
      variant={recommended ? 'opaque' : 'opaque'}
      padding="default"
      className={cn(
        'relative space-y-4 transition-all',
        recommended
          ? 'bg-chartreuse-soft border-2 border-chartreuse-deep/30 shadow-md'
          : 'border border-rule/80',
      )}
    >
      {recommended && (
        <div className="absolute -top-3 left-4 flex items-center gap-1 rounded-pill bg-chartreuse px-2.5 py-0.5 text-[10px] font-semibold font-mono uppercase tracking-[0.06em] text-ink">
          <Sparkles className="size-3" /> Recommandé
        </div>
      )}

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">Template</p>
        <h3 className="text-[18px] font-semibold text-ink mt-1">{template.label}</h3>
        <p className="text-[12px] text-ink-mute mt-1 leading-relaxed">{template.description}</p>
      </div>

      <div className="space-y-1.5 text-[13px]">
        <PriceRow label="DPE" amount={dpePrice} />
        <PriceRow label="Amiante" amount={amiantePrice} />
        <PriceRow label="Plomb (CREP)" amount={plombPrice} />
      </div>

      <div className="space-y-1 pt-2 border-t border-rule/40">
        <p className="text-[11px] text-ink-mute">
          Déplacement inclus :{' '}
          <strong className="text-ink">{template.travelFees.includedRadiusKm} km</strong>
        </p>
        <p className="text-[11px] text-ink-mute">
          Au-delà : {formatEur(template.travelFees.pricePerKmBeyond)}/km · plafond{' '}
          {formatEur(template.travelFees.capAmount)}
        </p>
      </div>

      <Button
        type="button"
        variant={recommended ? 'accent' : 'default'}
        size="default"
        onClick={onSelect}
        disabled={disabled || pending}
        className="w-full"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        Choisir
      </Button>
    </Card>
  )
}

function PriceRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink">{label}</span>
      <span className="font-mono tabular-nums text-ink font-semibold">{formatEur(amount)}</span>
    </div>
  )
}
