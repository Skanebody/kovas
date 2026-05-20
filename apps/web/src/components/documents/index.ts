/**
 * KOVAS — Composants Document Intelligence (V1.5).
 *
 * Cf. CLAUDE.md §3 + Modification 18 — scan + classification + extraction
 * documents propriétaire (DPE antérieur, plaque chaudière, facture énergie,
 * plan, etc.) pour pré-remplir le dossier.
 */

export { ClassificationResultView } from './ClassificationResultView'
export { DocumentCapturePanel } from './DocumentCapturePanel'
export type { CaptureStep } from './DocumentCapturePanel'
export { DocumentCaptureView } from './DocumentCaptureView'
export { DocumentClassificationResult } from './DocumentClassificationResult'
export { DocumentDetailModal } from './DocumentDetailModal'
export { DocumentExtractionReview } from './DocumentExtractionReview'
export { DocumentImporter } from './DocumentImporter'
export { DocumentList } from './DocumentList'
export {
  DocumentScanButton,
  type ScanButtonPlacement,
  type ScanButtonVariant,
} from './DocumentScanButton'
export { LoadingView } from './LoadingView'
export { ScanQuotaLimitModal } from './ScanQuotaLimitModal'
export { ScanQuotaWidget } from './ScanQuotaWidget'
export { SuccessView } from './SuccessView'
