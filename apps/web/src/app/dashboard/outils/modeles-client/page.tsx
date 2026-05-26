import { AppPageHeader } from '@/components/app-page-header'
import { ClientTemplateGenerator } from '@/components/utilities/tools/ClientTemplateGenerator'

export const metadata = {
  title: 'Modèles client — KOVAS',
}

export default function ModelesClientPage() {
  return (
    <div className="space-y-8">
      <AppPageHeader title="Modèles" accent="client" description="Emails et SMS prêts à envoyer." />
      <ClientTemplateGenerator />
    </div>
  )
}
