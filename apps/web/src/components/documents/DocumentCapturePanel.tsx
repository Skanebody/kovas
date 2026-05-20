'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type {
  CapturedDocument,
  ClassificationResult,
  Document,
  DocumentType,
  ExtractionResult,
  PrefillResult,
  ProcessedDocument,
  RegulatoryValidation,
} from '@/lib/documents/types'
import { cn } from '@/lib/utils'
import { useCallback, useState } from 'react'
import { ClassificationResultView } from './ClassificationResultView'
import { DocumentCaptureView } from './DocumentCaptureView'
import { DocumentExtractionReview } from './DocumentExtractionReview'
import { LoadingView } from './LoadingView'
import { SuccessView } from './SuccessView'

export type CaptureStep =
  | 'capture'
  | 'classifying'
  | 'classified'
  | 'extracting'
  | 'reviewing'
  | 'completed'

interface DocumentCapturePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si dossierId fourni, on propose le pre-fill final. */
  dossierId?: string
  /** Callback après traitement complet. */
  onDocumentProcessed?: (doc: ProcessedDocument) => void
}

// ============================================
// API contract (côté backend, autre agent)
// ============================================

interface UploadResponse {
  document: Document
  classification: ClassificationResult
}

interface ExtractResponse {
  extraction: ExtractionResult
  validation: RegulatoryValidation | null
}

// ============================================
// Composant principal
// ============================================

interface FlowState {
  step: CaptureStep
  /** Document tel que reçu du backend après upload. */
  document: Document | null
  classification: ClassificationResult | null
  extraction: ExtractionResult | null
  validation: RegulatoryValidation | null
  /** Erreur affichée à l'écran courant. */
  error: string | null
  /** Preview URL local (avant upload) ou URL signée backend. */
  previewUrl: string | null
  /** Stats finales pour SuccessView. */
  finalStats: { autoValidated: number; pendingReview: number; ignored: number } | null
  /** Type confirmé par le user (peut différer de classification.detectedType). */
  confirmedType: DocumentType | null
}

const INITIAL_STATE: FlowState = {
  step: 'capture',
  document: null,
  classification: null,
  extraction: null,
  validation: null,
  error: null,
  previewUrl: null,
  finalStats: null,
  confirmedType: null,
}

/**
 * Modal flow 5 étapes : capture → classifying → classified → extracting → reviewing → completed.
 *
 * Radix Dialog full-screen mobile, max-w-2xl desktop.
 * Le body change selon `step` ; le header reste compact.
 */
export function DocumentCapturePanel({
  open,
  onOpenChange,
  dossierId,
  onDocumentProcessed,
}: DocumentCapturePanelProps) {
  const [state, setState] = useState<FlowState>(INITIAL_STATE)

  const reset = useCallback(() => {
    if (state.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(state.previewUrl)
    }
    setState(INITIAL_STATE)
  }, [state.previewUrl])

  const handleClose = useCallback(() => {
    reset()
    onOpenChange(false)
  }, [onOpenChange, reset])

  // ---------- Étape 1 : capture ----------
  const handleCapture = useCallback(async (captured: CapturedDocument) => {
    setState((prev) => ({
      ...prev,
      step: 'classifying',
      error: null,
      previewUrl: captured.previewUrl,
    }))

    try {
      const formData = new FormData()
      formData.append('file', captured.file)
      formData.append('source', captured.source)
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errBody.error ?? 'Échec du téléversement')
      }
      const json = (await res.json()) as UploadResponse
      setState((prev) => ({
        ...prev,
        step: 'classified',
        document: json.document,
        classification: json.classification,
        confirmedType: json.classification.detectedType,
      }))
    } catch (e) {
      setState((prev) => ({
        ...prev,
        step: 'capture',
        error: e instanceof Error ? e.message : 'Erreur réseau',
      }))
    }
  }, [])

  // ---------- Étape 3 : confirmation type → extraction ----------
  const handleConfirmType = useCallback(
    async (finalType: DocumentType, userCorrected: boolean) => {
      setState((prev) => ({
        ...prev,
        step: 'extracting',
        confirmedType: finalType,
        error: null,
        classification: prev.classification
          ? { ...prev.classification, detectedType: finalType, userCorrected }
          : prev.classification,
      }))

      const documentId = state.document?.id
      if (!documentId) {
        setState((prev) => ({
          ...prev,
          step: 'classified',
          error: 'Document introuvable, veuillez recommencer.',
        }))
        return
      }

      try {
        const res = await fetch('/api/documents/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId, confirmedType: finalType, userCorrected }),
        })
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(errBody.error ?? "Échec de l'extraction")
        }
        const json = (await res.json()) as ExtractResponse
        setState((prev) => ({
          ...prev,
          step: 'reviewing',
          extraction: json.extraction,
          validation: json.validation,
        }))
      } catch (e) {
        setState((prev) => ({
          ...prev,
          step: 'classified',
          error: e instanceof Error ? e.message : 'Erreur réseau',
        }))
      }
    },
    [state.document?.id],
  )

  // ---------- Étape 4 : review → pre-fill ----------
  const handlePrefill = useCallback(async () => {
    const documentId = state.document?.id
    if (!documentId || !dossierId) return
    try {
      const res = await fetch(`/api/documents/${documentId}/prefill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossierId }),
      })
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(errBody.error ?? 'Échec du pré-remplissage')
      }
      const json = (await res.json()) as PrefillResult
      const processed: ProcessedDocument = {
        document: state.document as Document,
        classification: state.classification as ClassificationResult,
        extraction: state.extraction,
        validation: state.validation,
      }
      onDocumentProcessed?.(processed)
      setState((prev) => ({
        ...prev,
        step: 'completed',
        finalStats: json.stats,
      }))
    } catch (e) {
      setState((prev) => ({
        ...prev,
        error: e instanceof Error ? e.message : 'Erreur réseau',
      }))
    }
  }, [
    dossierId,
    onDocumentProcessed,
    state.classification,
    state.document,
    state.extraction,
    state.validation,
  ])

  const handleSaveOnly = useCallback(() => {
    const processed: ProcessedDocument = {
      document: state.document as Document,
      classification: state.classification as ClassificationResult,
      extraction: state.extraction,
      validation: state.validation,
    }
    onDocumentProcessed?.(processed)
    setState((prev) => ({
      ...prev,
      step: 'completed',
      finalStats: { autoValidated: 0, pendingReview: 0, ignored: 0 },
    }))
  }, [
    onDocumentProcessed,
    state.classification,
    state.document,
    state.extraction,
    state.validation,
  ])

  const handleScanAnother = useCallback(() => {
    if (state.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(state.previewUrl)
    }
    setState(INITIAL_STATE)
  }, [state.previewUrl])

  // ---------- Render ----------
  const titleByStep: Record<CaptureStep, string> = {
    capture: 'Scanner un document',
    classifying: 'Identification…',
    classified: 'Confirmer le type',
    extracting: 'Extraction…',
    reviewing: 'Relire les données',
    completed: 'Terminé',
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : handleClose())}>
      <DialogContent
        className={cn(
          'max-w-2xl max-h-[90vh] overflow-y-auto',
          'sm:max-h-[85vh]',
          'p-0 gap-0 sm:rounded-xl',
          // Full-screen mobile (< sm)
          'h-[100dvh] sm:h-auto w-screen sm:w-full rounded-none sm:rounded-xl',
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-rule/60">
          <DialogTitle className="font-serif italic font-normal text-xl text-ink">
            {titleByStep[state.step]}
          </DialogTitle>
          <DialogDescription>
            {state.step === 'capture' &&
              'Photo, fichier ou glisser-déposer — KOVAS identifie le type et extrait les données.'}
            {state.step === 'classifying' && 'Analyse du document en cours.'}
            {state.step === 'classified' && 'Vérifiez ou corrigez le type détecté.'}
            {state.step === 'extracting' && 'Lecture des champs.'}
            {state.step === 'reviewing' &&
              'Validez ou corrigez les valeurs proposées avant pré-remplissage.'}
            {state.step === 'completed' && 'Le document est enregistré.'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-6">
          {state.step === 'capture' && (
            <DocumentCaptureView onCapture={handleCapture} error={state.error} />
          )}

          {state.step === 'classifying' && (
            <LoadingView message="J'identifie le type de document…" hint="Quelques secondes" />
          )}

          {state.step === 'classified' && state.classification && (
            <ClassificationResultView
              classification={state.classification}
              previewUrl={state.previewUrl}
              onConfirm={handleConfirmType}
            />
          )}

          {state.step === 'extracting' && state.confirmedType && (
            <LoadingView
              message={`J'extrais les données du ${labelOfType(state.confirmedType)}…`}
              hint="~ 10-20 secondes"
            />
          )}

          {state.step === 'reviewing' && state.extraction && (
            <DocumentExtractionReview
              fields={state.extraction.fields}
              validation={state.validation}
              dossierId={dossierId}
              onPrefill={handlePrefill}
              onSaveOnly={handleSaveOnly}
            />
          )}

          {state.step === 'completed' && state.finalStats && (
            <SuccessView
              stats={state.finalStats}
              onClose={handleClose}
              onScanAnother={handleScanAnother}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function labelOfType(type: DocumentType): string {
  // Lazy import-light : on évite un import cyclique, le mapping reste local court.
  const map: Record<DocumentType, string> = {
    dpe_anterior: 'DPE antérieur',
    boiler_plate: 'plaque chaudière',
    energy_bill: 'facture énergie',
    floor_plan: 'plan',
    property_deed: 'acte de propriété',
    amiante_anterior: 'diagnostic amiante',
    electrical_diagnosis: 'diagnostic électricité',
    gas_diagnosis: 'diagnostic gaz',
    lead_diagnosis: 'diagnostic plomb',
    termite_diagnosis: 'état termites',
    carrez_measurement: 'mesurage Carrez',
    cadastral_extract: 'extrait cadastral',
    building_permit: 'permis de construire',
    invoice: 'facture',
    other: 'document',
  }
  return map[type]
}
