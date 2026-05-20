'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DiagChip } from '@/components/ui/diag-chip'
import { diagnosticToDiagChip } from '@/lib/dossier/diagnostic-to-diag-chip'
import type {
  CriticalField,
  CriticalFieldBucketId,
  CriticalFieldBucket as CriticalFieldBucketModel,
} from '@/lib/dossier/types'
import type { DiagnosticType } from '@/lib/mission/types'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eye,
  type LucideIcon,
  Pencil,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'

interface BucketVisualConfig {
  /** Couleur de l'icône du header bucket. */
  icon: LucideIcon
  iconClass: string
  /** Variant Badge KOVAS (count). */
  badge: 'orange' | 'blue' | 'green' | 'muted'
  /** Bucket ouvert par défaut. */
  defaultOpen: boolean
}

const BUCKET_VISUAL: Record<CriticalFieldBucketId, BucketVisualConfig> = {
  'to-verify': {
    icon: AlertTriangle,
    iconClass: 'text-warning',
    badge: 'orange',
    defaultOpen: true,
  },
  edited: {
    icon: Pencil,
    iconClass: 'text-info',
    badge: 'blue',
    defaultOpen: false,
  },
  validated: {
    icon: CheckCircle2,
    iconClass: 'text-success',
    badge: 'green',
    defaultOpen: false,
  },
  missing: {
    icon: XCircle,
    iconClass: 'text-ink-mute',
    badge: 'muted',
    defaultOpen: false,
  },
}

interface CriticalFieldBucketProps {
  bucket: CriticalFieldBucketModel
  /** Filtre par diagnostic ("ALL" = tous les diagnostics). */
  activeDiagnostic: DiagnosticType | 'ALL'
  /** Handlers actions (no-op par défaut, override depuis page d'assemblage). */
  onEditField?: (field: CriticalField) => void
  onViewSource?: (field: CriticalField) => void
  className?: string
}

/** Section collapsible représentant un bucket de champs critiques. */
export function CriticalFieldBucket({
  bucket,
  activeDiagnostic,
  onEditField,
  onViewSource,
  className,
}: CriticalFieldBucketProps) {
  const visual = BUCKET_VISUAL[bucket.id]
  const [open, setOpen] = useState<boolean>(visual.defaultOpen)

  const filtered =
    activeDiagnostic === 'ALL'
      ? bucket.fields
      : bucket.fields.filter((f) => f.diagnostic === activeDiagnostic)

  const Icon = visual.icon

  return (
    <div className={cn('overflow-hidden rounded-md border border-rule/60 bg-paper', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sage-alt/50"
      >
        <Icon aria-hidden className={cn('size-4 shrink-0', visual.iconClass)} />
        <span className="text-sm font-medium text-ink">{bucket.label}</span>
        <Badge variant={visual.badge}>{filtered.length}</Badge>
        <ChevronDown
          aria-hidden
          className={cn('ml-auto size-4 text-ink-mute transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul className="flex flex-col divide-y divide-rule/40 border-t border-rule/40">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-ink-mute">
              Aucun champ dans cette catégorie pour ce filtre.
            </li>
          ) : (
            filtered.map((field, idx) => (
              <li
                key={`${field.diagnostic}-${field.path}-${idx}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <DiagChip type={diagnosticToDiagChip(field.diagnostic)} />
                    <span className="truncate text-sm font-medium text-ink">{field.path}</span>
                  </div>
                  <p className="mt-1 truncate text-[12px] text-ink-mute">
                    {field.value === null || field.value === ''
                      ? 'Valeur non renseignée'
                      : field.value}
                    {field.sourceLabel && <span aria-hidden> · {field.sourceLabel}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {onEditField && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditField(field)}
                      aria-label={`Modifier ${field.path}`}
                    >
                      <Pencil className="size-3.5" />
                      <span className="hidden sm:inline">Modifier</span>
                    </Button>
                  )}
                  {onViewSource && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewSource(field)}
                      aria-label={`Voir la source de ${field.path}`}
                    >
                      <Eye className="size-3.5" />
                      <span className="hidden sm:inline">Source</span>
                    </Button>
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

interface ViewByCriticalFieldProps {
  buckets: CriticalFieldBucketModel[]
  /** Diagnostics actifs sur le dossier (utilisés pour filter tabs dynamiques). */
  activeDiagnostics: DiagnosticType[]
  onEditField?: (field: CriticalField) => void
  onViewSource?: (field: CriticalField) => void
  className?: string
}

const ALL_TAB_ID = 'ALL' as const

export function ViewByCriticalField({
  buckets,
  activeDiagnostics,
  onEditField,
  onViewSource,
  className,
}: ViewByCriticalFieldProps) {
  const [activeDiagnostic, setActiveDiagnostic] = useState<DiagnosticType | 'ALL'>(ALL_TAB_ID)

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterTab
          label="Tous"
          active={activeDiagnostic === ALL_TAB_ID}
          onClick={() => setActiveDiagnostic(ALL_TAB_ID)}
        />
        {activeDiagnostics.map((diag) => (
          <FilterTab
            key={diag}
            label={diag}
            active={activeDiagnostic === diag}
            onClick={() => setActiveDiagnostic(diag)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {buckets.map((bucket) => (
          <CriticalFieldBucket
            key={bucket.id}
            bucket={bucket}
            activeDiagnostic={activeDiagnostic}
            onEditField={onEditField}
            onViewSource={onViewSource}
          />
        ))}
      </div>
    </div>
  )
}

interface FilterTabProps {
  label: string
  active: boolean
  onClick: () => void
}

function FilterTab({ label, active, onClick }: FilterTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-pill px-3 py-1 text-[11px] font-mono uppercase tracking-[0.1em] transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30',
        active ? 'bg-navy text-paper' : 'bg-sage-alt text-ink-soft hover:bg-paper hover:text-ink',
      )}
    >
      {label}
    </button>
  )
}
