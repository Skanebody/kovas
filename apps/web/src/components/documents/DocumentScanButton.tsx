'use client'

import { Button } from '@/components/ui/button'
import type { ProcessedDocument, ScanQuota } from '@/lib/documents/types'
import { cn } from '@/lib/utils'
import { Camera, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { DocumentCapturePanel } from './DocumentCapturePanel'
import { ScanQuotaLimitModal } from './ScanQuotaLimitModal'

export type ScanButtonPlacement =
  | 'dashboard'
  | 'dossier_toolbar'
  | 'mode_terrain'
  | 'preparation'
  | 'client_page'

export type ScanButtonVariant = 'primary' | 'secondary' | 'icon_only'

interface DocumentScanButtonProps {
  /** Si fourni, le document scanné peut être rattaché et pré-remplir le dossier. */
  dossierId?: string
  /** Emplacement — pilote la copie et la valeur par défaut du variant. */
  placement: ScanButtonPlacement
  /** Override visuel — sinon dérivé de `placement`. */
  variant?: ScanButtonVariant
  /** Callback après pipeline complet (upload + extraction + éventuel pre-fill). */
  onDocumentProcessed?: (doc: ProcessedDocument) => void
  className?: string
}

const PLACEMENT_LABEL: Record<ScanButtonPlacement, { full: string; short: string }> = {
  dashboard: { full: 'Scanner un document', short: 'Scanner' },
  dossier_toolbar: { full: 'Scanner un document', short: 'Scan' },
  mode_terrain: { full: 'Scanner un document', short: 'Scan' },
  preparation: { full: 'Scanner les documents propriétaire', short: 'Scanner' },
  client_page: { full: 'Scanner un document client', short: 'Scan' },
}

const DEFAULT_VARIANT_BY_PLACEMENT: Record<ScanButtonPlacement, ScanButtonVariant> = {
  dashboard: 'primary',
  dossier_toolbar: 'secondary',
  mode_terrain: 'icon_only',
  preparation: 'primary',
  client_page: 'secondary',
}

/**
 * Bouton réutilisable pour ouvrir le flow Document Intelligence.
 *
 * - Fetch le quota au mount via /api/quota/scans
 * - Si quota épuisé sur plan Découverte → ouvre ScanQuotaLimitModal
 * - Sinon ouvre DocumentCapturePanel
 * - Affiche un compteur "X restants" si remaining < 20
 */
export function DocumentScanButton({
  dossierId,
  placement,
  variant,
  onDocumentProcessed,
  className,
}: DocumentScanButtonProps) {
  const resolvedVariant = variant ?? DEFAULT_VARIANT_BY_PLACEMENT[placement]
  const labels = PLACEMENT_LABEL[placement]

  const [quota, setQuota] = useState<ScanQuota | null>(null)
  const [quotaLoaded, setQuotaLoaded] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [limitModalOpen, setLimitModalOpen] = useState(false)

  // Fetch quota au mount + après chaque traitement
  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch('/api/quota/scans')
      if (!res.ok) return
      const json = (await res.json()) as ScanQuota
      setQuota(json)
    } catch {
      // Silencieux — le bouton reste fonctionnel, la limite sera détectée serveur.
    } finally {
      setQuotaLoaded(true)
    }
  }, [])

  useEffect(() => {
    void refreshQuota()
  }, [refreshQuota])

  const handleClick = useCallback(() => {
    if (quota && quota.remaining <= 0 && isLimitedPlan(quota.planId)) {
      setLimitModalOpen(true)
      return
    }
    setPanelOpen(true)
  }, [quota])

  const handleProcessed = useCallback(
    (doc: ProcessedDocument) => {
      onDocumentProcessed?.(doc)
      void refreshQuota()
    },
    [onDocumentProcessed, refreshQuota],
  )

  // Compteur "X restants" visible si quota chargé et < 20 (ou == 0)
  const showRemainingBadge = quotaLoaded && quota !== null && quota.remaining < 20
  const remainingLabel = quota
    ? quota.remaining === 0
      ? 'Limite atteinte'
      : `${quota.remaining} restants`
    : null

  return (
    <>
      {resolvedVariant === 'primary' && (
        <div className={cn('flex flex-wrap items-center gap-2', className)}>
          <Button type="button" variant="accent" size="default" onClick={handleClick}>
            {!quotaLoaded ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Camera className="size-4" aria-hidden />
            )}
            <span>{labels.full}</span>
          </Button>
          {showRemainingBadge && remainingLabel ? (
            <span
              className={cn(
                'inline-flex items-center rounded-pill px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider',
                quota && quota.remaining === 0
                  ? 'bg-coral-mist text-[#8B1414]'
                  : 'bg-orange-mist text-[#7C3F0A]',
              )}
            >
              {remainingLabel}
            </span>
          ) : null}
        </div>
      )}

      {resolvedVariant === 'secondary' && (
        <div className={cn('inline-flex items-center gap-2', className)}>
          <Button type="button" variant="outline" size="default" onClick={handleClick}>
            <Camera className="size-4" aria-hidden />
            <span>{labels.short}</span>
          </Button>
          {showRemainingBadge && remainingLabel ? (
            <span
              className={cn(
                'inline-flex items-center rounded-pill px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider',
                quota && quota.remaining === 0
                  ? 'bg-coral-mist text-[#8B1414]'
                  : 'bg-orange-mist text-[#7C3F0A]',
              )}
            >
              {remainingLabel}
            </span>
          ) : null}
        </div>
      )}

      {resolvedVariant === 'icon_only' && (
        <Button
          type="button"
          variant="accent"
          size="icon"
          onClick={handleClick}
          className={cn('shadow-lg', className)}
          aria-label={labels.full}
          title={labels.full}
        >
          <Camera className="size-5" aria-hidden />
        </Button>
      )}

      <DocumentCapturePanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        dossierId={dossierId}
        onDocumentProcessed={handleProcessed}
      />

      <ScanQuotaLimitModal open={limitModalOpen} onOpenChange={setLimitModalOpen} quota={quota} />
    </>
  )
}

function isLimitedPlan(planId: string): boolean {
  // Le plan Découverte (29€/mo) a un quota strict. Standard/Volume/Founder ont
  // quotas plus généreux ou illimité — la limite n'est appliquée que sur Découverte.
  return planId === 'decouverte' || planId === 'trial'
}
