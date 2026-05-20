import type { DossierHeaderInfo } from '@/lib/dossier/types'
import { cn } from '@/lib/utils'

interface DossierHeaderProps {
  info: DossierHeaderInfo
  className?: string
}

/**
 * Header de la page dossier — Design system v5.
 *
 * - Adresse principale en Instrument Serif italic 4xl (accent éditorial)
 * - Méta secondaire (ville · type · surface · année) en sans condensé
 * - Référence + client en JetBrains Mono uppercase tracking-[0.1em]
 */
export function DossierHeader({ info, className }: DossierHeaderProps) {
  const metaItems: string[] = []
  if (info.city) metaItems.push(info.city)
  if (info.propertyType) metaItems.push(info.propertyType)
  if (typeof info.surface === 'number') metaItems.push(`${info.surface} m²`)
  if (typeof info.year === 'number') metaItems.push(String(info.year))

  return (
    <header className={cn('flex flex-col gap-3', className)}>
      <h1 className="font-serif italic text-4xl md:text-5xl font-normal leading-[1.05] text-ink">
        {info.address}
      </h1>

      {metaItems.length > 0 && <p className="text-sm text-ink-mute">{metaItems.join(' · ')}</p>}

      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
        <span className="rounded-pill bg-sage-alt px-2.5 py-1 text-ink-soft">{info.reference}</span>
        {info.clientName && (
          <>
            <span aria-hidden className="text-ink-ghost">
              ·
            </span>
            <span className="text-ink-soft">{info.clientName}</span>
          </>
        )}
      </div>
    </header>
  )
}
