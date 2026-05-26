import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getConnector } from '@/lib/qonto/connector-store'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { QontoConnectorForm } from './qonto-connector-form'

export const metadata: Metadata = { title: 'Intégration Qonto' }

export default async function QontoIntegrationPage() {
  const { orgId } = await getCurrentUser()
  const connector = await getConnector(orgId, 'qonto')

  const initial = connector
    ? {
        connected: true as const,
        status: connector.status,
        lastSyncAt: connector.last_sync_at,
        lastError: connector.last_error,
      }
    : { connected: false as const }

  return (
    <div className="max-w-3xl space-y-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/account">
          <ArrowLeft className="size-4" /> Mon compte
        </Link>
      </Button>

      <AppPageHeader
        title="Intégration"
        accent="Qonto"
        eyebrow="Connecteur comptable · PDP DGFiP"
        description="Synchronise automatiquement tes factures et clients KOVAS vers ton compte Qonto. Qonto est Plateforme de Dématérialisation Partenaire (PDP) officielle DGFiP depuis 2024."
      />

      <section className="rounded-xl border border-[#0F1419]/[0.08] bg-paper p-6 space-y-4">
        <header className="space-y-1">
          <h2 className="text-base font-semibold text-[#0F1419]">Connexion</h2>
          <p className="text-sm text-[#0F1419]/72">
            Récupère tes identifiants API depuis ton espace Qonto :
            <Link
              href="https://app.qonto.com/organizations/-/settings/integrations"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 inline-flex items-center gap-1 text-[#0F1419] hover:underline"
            >
              Paramètres → Intégrations → Clés API <ExternalLink className="size-3" />
            </Link>
          </p>
        </header>

        <QontoConnectorForm initial={initial} />
      </section>

      <section className="rounded-xl border border-[#0F1419]/[0.08] bg-paper p-6 space-y-3">
        <h2 className="text-base font-semibold text-[#0F1419]">Ce que la synchronisation fait</h2>
        <ul className="space-y-2 text-sm text-[#0F1419]/72">
          <li>
            <span className="font-medium text-[#0F1419]">Clients KOVAS → Clients Qonto</span> :
            création automatique à la première facture (réutilisé ensuite via{' '}
            <code className="font-mono text-[11px] px-1 py-0.5 rounded bg-[#0F1419]/[0.06]">
              qonto_customer_id
            </code>
            ).
          </li>
          <li>
            <span className="font-medium text-[#0F1419]">Factures émises → Qonto</span> : référence,
            client, lignes, TVA et échéance reproduites fidèlement. Statut Qonto : « Unpaid ».
          </li>
          <li>
            <span className="font-medium text-[#0F1419]">Devis</span> : le client est préparé côté
            Qonto. La facture est créée à la conversion (Qonto ne dispose pas d'objet devis dédié).
          </li>
          <li>
            <span className="font-medium text-[#0F1419]">Multi-tenant strict</span> : ton token est
            chiffré (AES-256-GCM) et isolé par organisation.
          </li>
        </ul>
        <p className="text-xs text-[#0F1419]/72 pt-2">
          La transmission e-invoicing officielle DGFiP via Qonto PDP sera activée en Phase 2 KOVAS
          (option par facture). Aujourd'hui : sync miroir comptable uniquement.
        </p>
      </section>
    </div>
  )
}
