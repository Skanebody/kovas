'use client'

import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import {
  type EnergyClass,
  type OwnershipType,
  type PropertyType,
  type RequirementsInput,
  type RequirementsResult,
  type TransactionType,
  calculateRequiredDiagnostics,
} from '@/lib/utilities/diagnostic-requirements-calculator'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, MinusCircle } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

const DEFAULT_INPUT: RequirementsInput = {
  constructionYear: 1985,
  propertyType: 'apartment',
  ownership: 'copropriete',
  transactionType: 'sale',
  postalCode: '75008',
  hasGas: false,
  hasElectricity15Plus: true,
  knownEnergyClass: null,
}

export function DiagnosticRequirementsCalculator() {
  const [input, setInput] = useState<RequirementsInput>(DEFAULT_INPUT)
  const [result, setResult] = useState<RequirementsResult | null>(null)
  const [notRequiredOpen, setNotRequiredOpen] = useState(false)

  // Debounce 300ms + tracking serveur
  useEffect(() => {
    const handle = setTimeout(() => {
      // Calcul local immédiat
      const local = calculateRequiredDiagnostics(input)
      setResult(local)

      // Tracking serveur fire-and-forget
      void fetch('/api/utilities/diagnostic-requirements', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }).catch(() => {
        /* silencieux : on garde le résultat local affiché */
      })
    }, 300)
    return () => clearTimeout(handle)
  }, [input])

  const suggestedMissions = useMemo(() => {
    if (!result) return ''
    const types = result.required
      .map((r) => r.suggestedMissionType)
      .filter((s): s is string => Boolean(s))
    return Array.from(new Set(types)).join(',')
  }, [result])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
      {/* Formulaire */}
      <Card variant="opaque" padding="default">
        <CardTitle className="mb-4">Caractéristiques du bien</CardTitle>
        <CardDescription className="mb-5">
          Le calcul se met à jour en direct dès qu'un champ change.
        </CardDescription>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cy" className="mb-1.5">
                Année de construction
              </Label>
              <Input
                id="cy"
                type="number"
                value={input.constructionYear}
                min={1700}
                max={new Date().getUTCFullYear() + 1}
                onChange={(e) => setInput({ ...input, constructionYear: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="pc" className="mb-1.5">
                Code postal
              </Label>
              <Input
                id="pc"
                type="text"
                inputMode="numeric"
                pattern="\d{5}"
                maxLength={5}
                value={input.postalCode}
                onChange={(e) => setInput({ ...input, postalCode: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="pt" className="mb-1.5">
              Type de bien
            </Label>
            <Select
              id="pt"
              value={input.propertyType}
              onChange={(e) => setInput({ ...input, propertyType: e.target.value as PropertyType })}
            >
              <option value="apartment">Appartement</option>
              <option value="house">Maison</option>
              <option value="commercial">Local commercial</option>
              <option value="other">Autre</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="ow" className="mb-1.5">
              Détention
            </Label>
            <Select
              id="ow"
              value={input.ownership}
              onChange={(e) => setInput({ ...input, ownership: e.target.value as OwnershipType })}
            >
              <option value="single">Mono-propriété</option>
              <option value="copropriete">Copropriété</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="tx" className="mb-1.5">
              Transaction
            </Label>
            <Select
              id="tx"
              value={input.transactionType}
              onChange={(e) =>
                setInput({ ...input, transactionType: e.target.value as TransactionType })
              }
            >
              <option value="sale">Vente</option>
              <option value="rental">Location</option>
            </Select>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={input.hasGas}
                onChange={(e) => setInput({ ...input, hasGas: e.target.checked })}
                className="size-4 rounded border-rule accent-navy"
              />
              Installation gaz présente
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink">
              <input
                type="checkbox"
                checked={input.hasElectricity15Plus}
                onChange={(e) => setInput({ ...input, hasElectricity15Plus: e.target.checked })}
                className="size-4 rounded border-rule accent-navy"
              />
              Installation électrique &gt; 15 ans
            </label>
          </div>

          <div>
            <Label htmlFor="ec" className="mb-1.5">
              Classe DPE existante (optionnel)
            </Label>
            <Select
              id="ec"
              value={input.knownEnergyClass ?? ''}
              onChange={(e) =>
                setInput({
                  ...input,
                  knownEnergyClass: (e.target.value || null) as EnergyClass,
                })
              }
            >
              <option value="">Non connu</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="E">E</option>
              <option value="F">F</option>
              <option value="G">G</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Résultat */}
      <div className="space-y-5">
        {result === null ? (
          <Card variant="opaque" padding="default">
            <CardDescription>Saisissez les caractéristiques du bien.</CardDescription>
          </Card>
        ) : (
          <>
            <ResultSection
              title="Obligatoires"
              accent={`${result.required.length}`}
              tone="ok"
              items={result.required}
              icon={CheckCircle2}
            />
            {result.conditional.length > 0 ? (
              <ResultSection
                title="À vérifier"
                accent={`${result.conditional.length}`}
                tone="warn"
                items={result.conditional}
                icon={AlertTriangle}
              />
            ) : null}

            {result.warnings.length > 0 ? (
              <Card variant="warm" padding="default">
                <CardTitle className="text-[14px] mb-2">
                  <span className="inline-flex items-center gap-2">
                    <AlertTriangle className="size-4" /> Points de vigilance
                  </span>
                </CardTitle>
                <ul className="space-y-1.5 text-[13px] text-ink">
                  {result.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Card variant="opaque" padding="default">
              <button
                type="button"
                onClick={() => setNotRequiredOpen(!notRequiredOpen)}
                className="flex w-full items-center justify-between text-left"
              >
                <CardTitle className="text-[14px]">
                  Non obligatoires{' '}
                  <span className="font-mono text-[11px] text-ink-mute">
                    ({result.notRequired.length})
                  </span>
                </CardTitle>
                {notRequiredOpen ? (
                  <ChevronDown className="size-4 text-ink-mute" />
                ) : (
                  <ChevronRight className="size-4 text-ink-mute" />
                )}
              </button>
              {notRequiredOpen ? (
                <ul className="mt-4 space-y-3">
                  {result.notRequired.map((r) => (
                    <li key={r.diagnosticType} className="flex items-start gap-3">
                      <MinusCircle className="size-4 text-ink-mute mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[13px] font-medium text-ink">{r.label}</p>
                        <p className="text-[12px] text-ink-mute">{r.rationale}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  toast.info('Export PDF', {
                    description: "Disponible en V2 — pour l'instant, copiez/collez le texte.",
                  })
                }
              >
                Exporter en PDF
              </Button>
              <Button asChild variant="accent">
                <Link
                  href={
                    suggestedMissions
                      ? `/dashboard/dossiers/new?diags=${encodeURIComponent(suggestedMissions)}`
                      : '/dashboard/dossiers/new'
                  }
                >
                  Créer un dossier avec ces diags
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface ResultSectionProps {
  title: string
  accent: string
  tone: 'ok' | 'warn'
  items: RequirementsResult['required']
  icon: typeof CheckCircle2
}

function ResultSection({ title, accent, tone, items, icon: Icon }: ResultSectionProps) {
  const dotClass = tone === 'ok' ? 'bg-success' : 'bg-amber'
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-3">
        <CardTitle className="text-[15px]">
          {title}{' '}
          <span className="font-serif italic font-normal text-ink-mute text-[15px]">{accent}</span>
        </CardTitle>
        <span className={`size-2 rounded-full ${dotClass}`} aria-hidden />
      </div>
      {items.length === 0 ? (
        <CardDescription>Aucun item.</CardDescription>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.diagnosticType + item.label} className="flex items-start gap-3">
              <Icon className="size-4 text-ink mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">{item.label}</p>
                <p className="text-[12px] text-ink-mute">{item.rationale}</p>
                <p className="text-[11px] font-mono text-ink-faint mt-1">{item.referenceRule}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
