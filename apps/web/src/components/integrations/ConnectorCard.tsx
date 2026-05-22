/**
 * ConnectorCard — card unique pour un connecteur (Qonto/Pennylane/Indy/Tiime).
 *
 * Tokens v5 stricts : paper + border-rule, logo cercle 48px, StatusPill,
 * bouton CTA bottom. Pas de pastel, pas de glow.
 */

import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { cn } from '@/lib/utils'
import Link from 'next/link'

export type ConnectorStatus = 'active' | 'inactive' | 'error' | 'pending'

const STATUS_VARIANT: Record<ConnectorStatus, 'blue' | 'muted' | 'coral' | 'amber'> = {
  active: 'blue',
  inactive: 'muted',
  error: 'coral',
  pending: 'amber',
}

const STATUS_LABEL: Record<ConnectorStatus, string> = {
  active: 'Configuré',
  inactive: 'Non configuré',
  error: 'Erreur de synchronisation',
  pending: 'Demande en cours',
}

export interface ConnectorCardProps {
  name: string
  description: string
  /** Badge contextuel (ex : "PDP agréée", "Freemium", "API sur demande") */
  tagline?: string
  status: ConnectorStatus
  lastSyncAt?: string | null
  href: string
  /** Lettre affichée dans le cercle (Q/P/I/T) */
  logoChar: string
  /** Couleur du cercle logo — restera dans la palette neutre */
  accentColor?: 'navy' | 'paper' | 'ink-mute'
}

function formatRelative(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return "à l'instant"
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 7) return `il y a ${diffD} j`
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export function ConnectorCard({
  name,
  description,
  tagline,
  status,
  lastSyncAt,
  href,
  logoChar,
  accentColor = 'navy',
}: ConnectorCardProps) {
  const isConfigured = status !== 'inactive'
  const logoBg =
    accentColor === 'navy'
      ? 'bg-navy text-paper'
      : accentColor === 'paper'
        ? 'bg-paper text-ink border border-rule'
        : 'bg-ink/10 text-ink'

  const lastSync = formatRelative(lastSyncAt)

  return (
    <div className="rounded-lg border border-rule glass-opaque p-5 flex flex-col gap-4">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'size-12 rounded-full flex items-center justify-center text-base font-bold shrink-0',
            logoBg,
          )}
          aria-hidden
        >
          {logoChar}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-base text-ink leading-tight">{name}</h3>
            {tagline && (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-mute">
                · {tagline}
              </span>
            )}
          </div>
          <p className="text-xs text-ink-mute mt-1 leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-rule">
        <div className="flex flex-col gap-1">
          <StatusPill size="sm" variant={STATUS_VARIANT[status]} label={STATUS_LABEL[status]} />
          {lastSync && <span className="text-[10px] text-ink-mute">Dernière sync {lastSync}</span>}
        </div>
        <Button size="sm" variant={isConfigured ? 'glass' : 'default'} asChild>
          <Link href={href}>{isConfigured ? 'Gérer' : 'Configurer'}</Link>
        </Button>
      </div>
    </div>
  )
}
