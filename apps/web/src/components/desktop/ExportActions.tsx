/**
 * KOVAS — Pré-export · `ExportActions`
 *
 * Barre sticky bottom avec :
 *   - "Tout corriger d'abord" (outline navy) — déclenche la liste des findings
 *   - "Exporter vers {format}" (chartreuse, TOUJOURS ACTIF) — confirme l'export
 *
 * Règle non négociable : JAMAIS bloquer l'export.
 */

'use client'

import { Button } from '@/components/ui/button'
import {
  TARGET_FORMAT_LABEL,
  type TargetExportFormat,
} from '@/lib/pre-export/types'
import { ArrowRight, Wrench } from 'lucide-react'

interface ExportActionsProps {
  targetFormat: TargetExportFormat
  /** Au moins une finding critique => CTA "Tout corriger" plus visible (mais
   * pas blocant). */
  hasCritical: boolean
  onFixFirst: () => void
  onExport: () => void
  isExporting?: boolean
}

export function ExportActions({
  targetFormat,
  hasCritical,
  onFixFirst,
  onExport,
  isExporting,
}: ExportActionsProps) {
  return (
    <div className="sticky bottom-0 left-0 right-0 z-40 bg-sage/95 backdrop-blur-md border-t border-rule">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-[12px] text-ink-mute hidden md:block">
          {hasCritical
            ? 'Tu peux exporter quand même — KOVAS ne bloque jamais l\'envoi.'
            : 'Dossier prêt à l\'export.'}
        </p>

        <div className="flex items-center gap-3 ml-auto">
          <Button
            variant="outline"
            size="default"
            onClick={onFixFirst}
            disabled={isExporting}
          >
            <Wrench className="size-4" aria-hidden />
            Tout corriger d'abord
          </Button>

          <Button
            variant="accent"
            size="default"
            onClick={onExport}
            disabled={isExporting}
            aria-label={`Exporter vers ${TARGET_FORMAT_LABEL[targetFormat]}`}
          >
            {isExporting ? 'Export en cours…' : `Exporter vers ${TARGET_FORMAT_LABEL[targetFormat]}`}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
