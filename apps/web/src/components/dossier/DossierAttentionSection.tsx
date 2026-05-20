import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { DiagChip } from '@/components/ui/diag-chip'
import { diagnosticToDiagChip } from '@/lib/dossier/diagnostic-to-diag-chip'
import type { DossierVisualState, PreparationItem, ProgressionData } from '@/lib/dossier/types'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  type LucideIcon,
  Sparkles,
} from 'lucide-react'

interface AttentionDataToStart {
  state: 'to-start'
  data: { preparation: PreparationItem[] }
}
interface AttentionDataInProgress {
  state: 'in-progress'
  data: ProgressionData
}
interface AttentionDataCompleted {
  state: 'completed'
  data: {
    /** Lignes de récap final ("DPE classe D", "3 matériaux amiante détectés", etc.). */
    recap: string[]
  }
}

type DossierAttentionSectionProps = (
  | AttentionDataToStart
  | AttentionDataInProgress
  | AttentionDataCompleted
) & { className?: string }

interface VariantHeader {
  icon: LucideIcon
  title: string
  /** Couleur du wrapper icône. */
  iconWrapperClass: string
  iconClass: string
}

const HEADER_BY_STATE: Record<DossierVisualState, VariantHeader> = {
  'to-start': {
    icon: ClipboardCheck,
    title: 'Préparation',
    iconWrapperClass: 'bg-blue-mist',
    iconClass: 'text-[#1E3A8A]',
  },
  'in-progress': {
    icon: AlertTriangle,
    title: 'Points d’attention',
    iconWrapperClass: 'bg-orange-mist',
    iconClass: 'text-[#7C3F0A]',
  },
  completed: {
    icon: Sparkles,
    title: 'Récapitulatif',
    iconWrapperClass: 'bg-lime-mist',
    iconClass: 'text-[#2D4015]',
  },
}

/**
 * Section "Attention" — contenu varie selon état du dossier.
 *
 * - to-start → liste de préparation (4 items checklist visuels)
 * - in-progress → liste des manques avec chips diagnostics (badge warning)
 * - completed → récap final (chiffres clés mission)
 */
export function DossierAttentionSection(props: DossierAttentionSectionProps) {
  const header = HEADER_BY_STATE[props.state]
  const HeaderIcon = header.icon

  const count = computeCount(props)

  return (
    <Card variant="opaque" padding="default" className={cn(props.className)}>
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
            header.iconWrapperClass,
          )}
        >
          <HeaderIcon className={cn('size-4', header.iconClass)} />
        </div>
        <h3 className="font-serif italic font-normal text-xl text-ink flex-1">{header.title}</h3>
        {typeof count === 'number' && count > 0 && <Badge variant="muted">{count}</Badge>}
      </div>

      <div className="mt-5">{renderBody(props)}</div>
    </Card>
  )
}

function computeCount(props: DossierAttentionSectionProps): number | null {
  if (props.state === 'to-start') return props.data.preparation.length
  if (props.state === 'in-progress') return props.data.missingFields.length
  return props.data.recap.length
}

function renderBody(props: DossierAttentionSectionProps) {
  if (props.state === 'to-start') {
    return (
      <ul className="flex flex-col gap-2">
        {props.data.preparation.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-sage-alt/60"
          >
            <CheckCircle2
              aria-hidden
              className={cn('size-4 shrink-0', item.done ? 'text-success' : 'text-ink-ghost')}
            />
            <span className={cn('text-sm', item.done ? 'text-ink' : 'text-ink-mute')}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if (props.state === 'in-progress') {
    if (props.data.missingFields.length === 0) {
      return (
        <p className="text-sm text-ink-mute">Tous les champs critiques sont collectés. Bravo !</p>
      )
    }
    return (
      <ul className="flex flex-col divide-y divide-rule/40">
        {props.data.missingFields.map((field) => (
          <li key={`${field.diagnostic}-${field.label}`} className="flex items-center gap-3 py-2.5">
            <AlertTriangle aria-hidden className="size-4 shrink-0 text-warning" />
            <span className="text-sm text-ink flex-1">{field.label}</span>
            <DiagChip type={diagnosticToDiagChip(field.diagnostic)} />
          </li>
        ))}
      </ul>
    )
  }

  // completed
  if (props.data.recap.length === 0) {
    return <p className="text-sm text-ink-mute">Mission terminée. Prête à l’export.</p>
  }
  return (
    <ul className="flex flex-col gap-2">
      {props.data.recap.map((line) => (
        <li
          key={line}
          className="flex items-center gap-3 rounded-md bg-sage-alt/60 px-3 py-2 text-sm text-ink"
        >
          <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />
          {line}
        </li>
      ))}
    </ul>
  )
}
