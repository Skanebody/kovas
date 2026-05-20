import { AppPageHeader } from '@/components/app-page-header'
import { PreDepartureChecklist } from '@/components/utilities/tools/PreDepartureChecklist'

export const metadata = {
  title: 'Checklist avant de partir — KOVAS',
}

export default function ChecklistDepartPage() {
  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Avant de"
        accent="partir"
        description="Photos critiques, mesures et infos à vérifier avant de quitter le site — adapté aux diagnostics actifs."
      />
      <PreDepartureChecklist />
    </div>
  )
}
