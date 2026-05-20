import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Download } from 'lucide-react'

interface ExportSectionPlaceholderProps {
  className?: string
}

/**
 * Placeholder pour la section Export — sera remplacée par l'agent D.
 *
 * Ancre `#export-section` utilisée par le bouton "Exporter" de la sticky bar
 * (cf. `DossierStickyBar` → `defaultHref: '#export-section'`).
 */
export function ExportSectionPlaceholder({ className }: ExportSectionPlaceholderProps) {
  return (
    <section id="export-section" className={cn('scroll-mt-24', className)}>
      <Card variant="opaque" padding="default">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sage-alt text-ink-mute"
          >
            <Download className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-serif italic font-normal text-xl text-ink">Section export</h2>
            <p className="text-[12px] text-ink-mute">
              Placeholder — composant produit par l’agent D.
            </p>
          </div>
        </div>
      </Card>
    </section>
  )
}
