'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { DOCUMENT_TYPE_LABEL, DOCUMENT_TYPE_ORDER } from '@/lib/documents/labels'
import type { ClassificationResult, DocumentType } from '@/lib/documents/types'
import { cn } from '@/lib/utils'
import { Check, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { DocumentClassificationResult } from './DocumentClassificationResult'

interface ClassificationResultViewProps {
  classification: ClassificationResult
  /** Confirme le type (potentiellement corrigé). */
  onConfirm: (finalType: DocumentType, userCorrected: boolean) => void
  /** Preview URL si disponible. */
  previewUrl?: string | null
  className?: string
}

/**
 * Vue de confirmation du type détecté.
 *
 * - Type principal avec confidence
 * - Alternatives proposées si confidence < 90%
 * - Dropdown "Choisir un autre type" toujours accessible
 * - CTA "Confirmer ce type" (accent chartreuse)
 */
export function ClassificationResultView({
  classification,
  onConfirm,
  previewUrl,
  className,
}: ClassificationResultViewProps) {
  const [selectedType, setSelectedType] = useState<DocumentType>(classification.detectedType)
  const [overrideMode, setOverrideMode] = useState(false)

  const isUncertain = classification.confidence < 0.9
  const corrected = selectedType !== classification.detectedType

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {previewUrl ? (
        <div className="mx-auto max-w-xs overflow-hidden rounded-lg border border-rule">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Aperçu du document" className="h-44 w-full object-cover" />
        </div>
      ) : null}

      <Card variant="opaque" padding="default" className="space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Type détecté
        </p>
        <DocumentClassificationResult
          type={selectedType}
          confidence={selectedType === classification.detectedType ? classification.confidence : 1}
          size="lg"
        />

        {isUncertain && classification.alternatives.length > 0 && !overrideMode && (
          <div className="rounded-md bg-orange-mist/40 px-4 py-3">
            <p className="text-xs font-medium text-ink">
              Confiance modérée — vérifiez le type ou choisissez une alternative.
            </p>
            <ul className="mt-2 space-y-1.5">
              {classification.alternatives.map((alt) => (
                <li key={alt.type}>
                  <button
                    type="button"
                    onClick={() => setSelectedType(alt.type)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                      'hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30',
                      selectedType === alt.type && 'bg-paper text-navy font-medium',
                    )}
                  >
                    <span>{DOCUMENT_TYPE_LABEL[alt.type]}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
                      {Math.round(alt.confidence * 100)}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {overrideMode ? (
          <div className="space-y-2">
            <label
              htmlFor="document-type-override"
              className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute"
            >
              Choisir un autre type
            </label>
            <Select
              id="document-type-override"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as DocumentType)}
            >
              {DOCUMENT_TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOverrideMode(true)}
            className="w-full"
          >
            <RotateCcw className="size-3.5" />
            Choisir un autre type
          </Button>
        )}
      </Card>

      <Button
        type="button"
        variant="accent"
        size="lg"
        onClick={() => onConfirm(selectedType, corrected)}
      >
        <Check className="size-4" />
        Confirmer ce type
      </Button>
    </div>
  )
}
