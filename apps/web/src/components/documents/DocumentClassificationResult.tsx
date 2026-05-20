'use client'

import { Badge } from '@/components/ui/badge'
import { DOCUMENT_TYPE_EMOJI, DOCUMENT_TYPE_LABEL } from '@/lib/documents/labels'
import type { DocumentType } from '@/lib/documents/types'
import { cn } from '@/lib/utils'

interface DocumentClassificationResultProps {
  type: DocumentType
  /** Confiance 0-1 (affichée en %). */
  confidence: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Badge type + confidence — primitive réutilisée dans plusieurs vues.
 *
 * - Cartouche carré pastel + code 3-lettres (DPE, CHA, etc.)
 * - Label FR à droite
 * - Badge confiance coloré selon palier (vert ≥90, ambre 70-89, rouge <70)
 */
export function DocumentClassificationResult({
  type,
  confidence,
  size = 'md',
  className,
}: DocumentClassificationResultProps) {
  const pct = Math.round(confidence * 100)
  const variant: 'green' | 'amber' | 'red' = pct >= 90 ? 'green' : pct >= 70 ? 'amber' : 'red'

  const boxSize =
    size === 'lg' ? 'size-14 text-sm' : size === 'sm' ? 'size-9 text-[10px]' : 'size-11 text-[11px]'
  const labelSize = size === 'lg' ? 'text-base' : size === 'sm' ? 'text-xs' : 'text-sm'

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md bg-sage-alt font-mono font-semibold uppercase tracking-wider text-navy',
          boxSize,
        )}
      >
        {DOCUMENT_TYPE_EMOJI[type]}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium text-ink truncate', labelSize)}>
          {DOCUMENT_TYPE_LABEL[type]}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant={variant}>{pct}% confiance</Badge>
        </div>
      </div>
    </div>
  )
}
