import { AppPageHeader } from '@/components/app-page-header'
import { ClientTemplateGenerator } from '@/components/utilities/tools/ClientTemplateGenerator'

export const metadata = {
  title: 'Modèles client — KOVAS',
}

export default function ModelesClientPage() {
  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Modèles"
        accent="client"
        description="5 modèles email et 3 SMS prêts à envoyer — demande de documents, confirmation RDV, rappel J-1, envoi rapport."
      />
      <ClientTemplateGenerator />
    </div>
  )
}
