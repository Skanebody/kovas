import { AppPageHeader } from '@/components/app-page-header'
import { DiagnosticRequirementsCalculator } from '@/components/utilities/tools/DiagnosticRequirementsCalculator'

export const metadata = {
  title: 'Diagnostics obligatoires — KOVAS',
}

export default function DiagnosticsObligatoiresPage() {
  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Diagnostics"
        accent="obligatoires"
        description="Quels diagnostics sont réellement requis pour ce bien ? Saisissez les caractéristiques, le calcul s'effectue en direct."
      />
      <DiagnosticRequirementsCalculator />
    </div>
  )
}
