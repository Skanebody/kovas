'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ExtractedField, RegulatoryValidation } from '@/lib/documents/types'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Infinity as InfinityIcon,
  Loader2,
  Save,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { useMemo, useState } from 'react'

interface DocumentExtractionReviewProps {
  /** Champs extraits (clé → ExtractedField). */
  fields: Record<string, ExtractedField>
  /** Validation réglementaire (optionnelle selon type). */
  validation: RegulatoryValidation | null
  /** Si un dossier est rattaché, on propose le pre-fill. */
  dossierId?: string
  /** Pre-fill → POST /api/documents/[id]/prefill. */
  onPrefill?: () => void | Promise<void>
  /** Sauvegarde simple (sans pre-fill). */
  onSaveOnly: () => void | Promise<void>
  busy?: boolean
  className?: string
}

type AutoValidateMode = 'all' | 'one_by_one'

/**
 * Vue de relecture des champs extraits + validation réglementaire.
 *
 * - Card validation status (icon coloré + message FR)
 * - Liste des champs avec badge confidence par palier
 * - Toggle "Tout valider auto" / "Vérifier un par un"
 * - CTA Pré-remplir + CTA Enregistrer
 */
export function DocumentExtractionReview({
  fields,
  validation,
  dossierId,
  onPrefill,
  onSaveOnly,
  busy = false,
  className,
}: DocumentExtractionReviewProps) {
  const [mode, setMode] = useState<AutoValidateMode>('all')
  const [acceptedFields, setAcceptedFields] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const f of Object.values(fields)) {
      initial[f.key] = f.routing === 'auto'
    }
    return initial
  })

  const fieldsList = useMemo(() => Object.values(fields), [fields])
  const counts = useMemo(() => {
    const total = fieldsList.length
    const auto = fieldsList.filter((f) => f.routing === 'auto').length
    const review = fieldsList.filter((f) => f.routing === 'review').length
    const manual = fieldsList.filter((f) => f.routing === 'manual').length
    return { total, auto, review, manual }
  }, [fieldsList])

  function toggleField(key: string) {
    setAcceptedFields((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function applyAllAuto() {
    const next: Record<string, boolean> = {}
    for (const f of fieldsList) {
      next[f.key] = true
    }
    setAcceptedFields(next)
    setMode('all')
  }

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {validation ? <ValidationCard validation={validation} /> : null}

      <Card variant="opaque" padding="default" className="space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
              Champs extraits
            </p>
            <h3 className="mt-1 font-serif italic font-normal text-xl text-ink">
              {counts.total} champ{counts.total > 1 ? 's' : ''} détecté
              {counts.total > 1 ? 's' : ''}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1 text-[11px] text-ink-mute">
            <span className="font-mono uppercase tracking-wider">
              {counts.auto} auto · {counts.review} à vérifier · {counts.manual} manuel
            </span>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 border-y border-rule/60 py-3">
          <button
            type="button"
            onClick={applyAllAuto}
            className={cn(
              'rounded-pill px-4 py-1.5 text-xs font-semibold transition-colors',
              mode === 'all'
                ? 'bg-navy text-paper'
                : 'bg-paper border border-rule text-ink hover:bg-sage-alt',
            )}
          >
            Tout valider auto
          </button>
          <button
            type="button"
            onClick={() => setMode('one_by_one')}
            className={cn(
              'rounded-pill px-4 py-1.5 text-xs font-semibold transition-colors',
              mode === 'one_by_one'
                ? 'bg-navy text-paper'
                : 'bg-paper border border-rule text-ink hover:bg-sage-alt',
            )}
          >
            Vérifier un par un
          </button>
        </div>

        <ul className="divide-y divide-rule/60">
          {fieldsList.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              accepted={acceptedFields[field.key] ?? false}
              interactive={mode === 'one_by_one'}
              onToggle={() => toggleField(field.key)}
            />
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={() => onSaveOnly()} disabled={busy}>
          <Save className="size-4" />
          Enregistrer sans pré-remplir
        </Button>
        {dossierId && onPrefill ? (
          <Button type="button" variant="accent" onClick={() => onPrefill()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Pré-remplir le dossier
          </Button>
        ) : null}
      </div>
    </div>
  )
}

// ============================================
// Sous-composants
// ============================================

function ValidationCard({ validation }: { validation: RegulatoryValidation }) {
  const config = validationVisualConfig(validation.status)
  return (
    <Card
      variant={validation.status === 'expired' ? 'warm' : 'opaque'}
      padding="sm"
      className="flex items-start gap-3"
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full',
          config.bg,
          config.color,
        )}
      >
        <config.Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{config.title}</p>
        <p className="mt-0.5 text-xs text-ink-mute">{validation.message}</p>
        {validation.legalReference ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink-mute">
            {validation.legalReference}
          </p>
        ) : null}
      </div>
    </Card>
  )
}

function validationVisualConfig(status: RegulatoryValidation['status']) {
  switch (status) {
    case 'valid':
      return {
        Icon: CheckCircle2,
        title: 'Document valide',
        bg: 'bg-lime-mist',
        color: 'text-[#2D4015]',
      }
    case 'expiring':
      return {
        Icon: Clock,
        title: 'Bientôt expiré',
        bg: 'bg-orange-mist',
        color: 'text-[#7C3F0A]',
      }
    case 'expired':
      return {
        Icon: XCircle,
        title: 'Document expiré',
        bg: 'bg-coral-mist',
        color: 'text-[#8B1414]',
      }
    case 'unlimited':
      return {
        Icon: InfinityIcon,
        title: 'Validité illimitée',
        bg: 'bg-blue-mist',
        color: 'text-[#1E3A8A]',
      }
    case 'unknown':
      return {
        Icon: AlertTriangle,
        title: 'Validité indéterminée',
        bg: 'bg-sage-alt',
        color: 'text-ink-mute',
      }
  }
}

function FieldRow({
  field,
  accepted,
  interactive,
  onToggle,
}: {
  field: ExtractedField
  accepted: boolean
  interactive: boolean
  onToggle: () => void
}) {
  const pct = Math.round(field.confidence * 100)
  const variant: 'green' | 'amber' | 'red' =
    field.routing === 'auto' ? 'green' : field.routing === 'review' ? 'amber' : 'red'

  const displayValue =
    field.value === null || field.value === undefined || field.value === ''
      ? '—'
      : typeof field.value === 'boolean'
        ? field.value
          ? 'Oui'
          : 'Non'
        : String(field.value)

  return (
    <li className="flex items-center gap-3 py-3">
      {interactive ? (
        <button
          type="button"
          aria-pressed={accepted}
          onClick={onToggle}
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition-colors',
            accepted
              ? 'border-success bg-success text-paper'
              : 'border-rule bg-paper text-transparent',
          )}
        >
          {accepted ? <CheckCircle2 className="size-3" /> : null}
        </button>
      ) : (
        <span
          aria-hidden
          className={cn(
            'inline-flex size-5 shrink-0 items-center justify-center rounded-sm',
            accepted ? 'bg-success text-paper' : 'bg-rule/30 text-transparent',
          )}
        >
          {accepted ? <CheckCircle2 className="size-3" /> : null}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-mono uppercase tracking-wider text-ink-mute">{field.label}</p>
        <p className="mt-0.5 truncate text-sm text-ink">{displayValue}</p>
      </div>
      <Badge variant={variant}>{pct}%</Badge>
    </li>
  )
}
