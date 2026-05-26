import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DIAGNOSTIC_TYPE_LABELS,
  type DiagnosticType,
  getValidityStatus,
} from '@/lib/diagnostic-validity/expiration-calculator'
import { cn } from '@/lib/utils'
import { CalendarClock, FileText, ShieldAlert, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

export interface DiagnosticValidityRow {
  id: string
  diagnostic_type:
    | 'dpe'
    | 'amiante'
    | 'plomb'
    | 'gaz'
    | 'electricite'
    | 'termites'
    | 'carrez'
    | 'erp'
    | null
  date_emission: string | null
  date_expiration: string | null
  energy_class: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  status: string
  original_name: string | null
  signedUrl?: string | null
}

interface Props {
  scans: DiagnosticValidityRow[]
  title?: string
  emptyHint?: string
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/**
 * Encart "Diagnostics existants" — affiché sur la fiche client et la fiche
 * bien. Code couleur : vert (valide >1 an), ambre (expire dans <1 an), rouge
 * (expiré). Illimité = vert. Cliquer ouvre le PDF/scan original.
 */
export function DiagnosticValidityCard({ scans, title, emptyHint }: Props) {
  if (scans.length === 0) {
    if (!emptyHint) return null
    return (
      <Card variant="opaque" padding="default">
        <CardHeader>
          <CardTitle className="text-base">{title ?? 'Diagnostics existants'}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-mute">{emptyHint}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card variant="opaque" padding="default">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="size-4 text-ink-mute" />
          {title ?? 'Diagnostics existants'}
          <Badge variant="muted" className="ml-1">
            {scans.length}
          </Badge>
        </CardTitle>
        <p className="text-xs text-ink-mute mt-1">
          Issus des scans confirmés via{' '}
          <Link href="/dashboard/outils/verification-validite" className="underline hover:text-ink">
            Vérification de validité
          </Link>
          .
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-rule/60">
          {scans.map((s) => {
            const status = getValidityStatus(s.date_expiration)
            const typeLabel = s.diagnostic_type
              ? DIAGNOSTIC_TYPE_LABELS[s.diagnostic_type as DiagnosticType]
              : 'Diagnostic'
            return (
              <li key={s.id} className="py-3 flex items-start gap-3">
                <FileText className="size-4 text-ink-mute shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{typeLabel}</span>
                    {s.energy_class ? (
                      <Badge variant="muted" className="font-mono">
                        {s.energy_class}
                      </Badge>
                    ) : null}
                    <ValidityBadge status={status} />
                  </div>
                  <div className="text-xs text-ink-mute mt-1 space-x-2">
                    <span>
                      <CalendarClock className="size-3 inline -mt-0.5 mr-1" />
                      Émis le {formatDate(s.date_emission)}
                    </span>
                    {s.date_expiration ? (
                      <span
                        className={cn(
                          'font-mono',
                          status === 'expired' && 'text-accent-red',
                          status === 'expiring' && 'text-amber',
                        )}
                      >
                        · Expire le {formatDate(s.date_expiration)}
                      </span>
                    ) : (
                      <span className="text-accent-green">· Validité illimitée</span>
                    )}
                  </div>
                </div>
                {s.signedUrl ? (
                  <a
                    href={s.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline text-ink-mute hover:text-ink shrink-0 mt-1"
                  >
                    Voir le PDF
                  </a>
                ) : null}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function ValidityBadge({
  status,
}: {
  status: ReturnType<typeof getValidityStatus>
}) {
  if (status === 'expired') {
    return (
      <Badge variant="red">
        <ShieldAlert className="size-3 mr-1" /> Expiré
      </Badge>
    )
  }
  if (status === 'expiring') {
    return (
      <Badge variant="orange">
        <ShieldAlert className="size-3 mr-1" /> Bientôt expiré
      </Badge>
    )
  }
  if (status === 'unlimited') {
    return (
      <Badge variant="green">
        <ShieldCheck className="size-3 mr-1" /> Illimité
      </Badge>
    )
  }
  return (
    <Badge variant="green">
      <ShieldCheck className="size-3 mr-1" /> Valide
    </Badge>
  )
}
