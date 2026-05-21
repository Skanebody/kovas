import { AppPageHeader } from '@/components/app-page-header'
import { ValidityChecker } from '@/components/utilities/tools/ValidityChecker'

export const metadata = {
  title: 'Vérification de validité — KOVAS',
}

export default function VerificationValiditePage() {
  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Validité des"
        accent="diagnostics"
        description="DPE, amiante, plomb, gaz, élec, termites… vérifiez en quelques clics si un diagnostic existant est encore opposable."
      />
      <ValidityChecker />
    </div>
  )
}
