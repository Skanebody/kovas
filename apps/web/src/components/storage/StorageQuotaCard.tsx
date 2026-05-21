/**
 * KOVAS — Storage quota visualization card.
 *
 * Design system v5 (sage/dark/chartreuse) :
 *   - Background : bg-sage (sage pâle #F5F7F4)
 *   - Track jauge : sage-alt (#EEF2F0)
 *   - Fill jauge : chartreuse (#D4F542), accent-warm (>80%), danger (>100%)
 *   - Pourcentage : font-serif italic (Instrument Serif)
 *
 * Composant pur (UI only). Pas de fetch interne — `usedBytes` / `quotaBytes`
 * fournis par le parent (server component recommandé pour SSR usage temps réel).
 */

import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/storage/quota'
import { AlertTriangle, HardDrive } from 'lucide-react'

export interface StorageQuotaCardProps {
  usedBytes: bigint | number
  quotaBytes: bigint | number
  /** Compact = pas de titre/icône ; embed dans une section existante. */
  compact?: boolean
  className?: string
}

export function StorageQuotaCard({
  usedBytes,
  quotaBytes,
  compact = false,
  className,
}: StorageQuotaCardProps) {
  const used = typeof usedBytes === 'bigint' ? usedBytes : BigInt(Math.max(0, Number(usedBytes)))
  const quota =
    typeof quotaBytes === 'bigint' ? quotaBytes : BigInt(Math.max(1, Number(quotaBytes)))

  const usagePct =
    quota === 0n
      ? 0
      : Math.min(999, Math.max(0, Number((used * 10000n) / quota) / 100))

  const isWarning = usagePct >= 80 && usagePct < 100
  const isExceeded = usagePct >= 100

  // Largeur barre visible (cap à 100% même si over-quota — l'alerte texte gère le >100%)
  const fillPct = Math.min(100, usagePct)
  const fillColor = isExceeded
    ? 'bg-danger'
    : isWarning
      ? 'bg-accent-warm'
      : 'bg-chartreuse'

  return (
    <div
      className={cn(
        'rounded-xl border border-rule/60 bg-sage p-5 space-y-4',
        className,
      )}
    >
      {!compact && (
        <div className="flex items-center gap-2 text-ink-soft">
          <HardDrive className="size-4" />
          <h3 className="font-sans text-sm font-semibold uppercase tracking-wider">
            Stockage
          </h3>
        </div>
      )}

      {/* Pourcentage hero — font-serif italic, signature v5 */}
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div
            className={cn(
              'font-serif italic font-normal leading-none tracking-tight',
              compact ? 'text-4xl' : 'text-5xl md:text-6xl',
              isExceeded ? 'text-danger' : 'text-ink',
            )}
          >
            {usagePct.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}%
          </div>
          <p className="font-sans text-sm text-ink-mute tabular-nums">
            {formatBytes(used)}{' '}
            <span className="text-ink-faint">/ {formatBytes(quota)} utilisés</span>
          </p>
        </div>
      </div>

      {/* Barre de progression dark — track sage-alt + fill chartreuse */}
      <div
        className="h-2.5 rounded-full bg-sage-alt overflow-hidden"
        role="progressbar"
        aria-valuenow={Math.round(usagePct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Quota stockage utilisé"
      >
        <div
          className={cn('h-full transition-all duration-500', fillColor)}
          style={{ width: `${fillPct}%` }}
        />
      </div>

      {/* Avertissement contextuel — sobre, pas de glow */}
      {isWarning && !isExceeded && (
        <div className="flex items-start gap-2 rounded-lg border border-accent-warm/30 bg-accent-warm/5 p-3">
          <AlertTriangle className="size-4 mt-0.5 shrink-0 text-accent-warm" />
          <p className="text-sm text-ink leading-snug">
            Vous approchez de votre quota. Pour archiver, exportez vos missions terminées et
            supprimez les dossiers anciens.
          </p>
        </div>
      )}

      {isExceeded && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/[0.06] p-3">
          <AlertTriangle className="size-4 mt-0.5 shrink-0 text-danger" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-danger">Quota atteint</p>
            <p className="text-sm text-ink leading-snug">
              Les nouvelles missions ne pourront plus stocker de fichiers. Passez à un tier
              supérieur ou supprimez d'anciens dossiers.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
