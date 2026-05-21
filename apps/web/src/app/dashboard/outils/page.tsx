import { AppPageHeader } from '@/components/app-page-header'
import { UtilitiesHub } from '@/components/utilities/UtilitiesHub'

export const metadata = {
  title: 'Outils — KOVAS',
}

export default function OutilsPage() {
  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Vos"
        accent="outils"
        description="5 gadgets pour gagner du temps au quotidien — sans quitter KOVAS."
      />
      <UtilitiesHub />
    </div>
  )
}
