import { AppPageHeader } from '@/components/app-page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { selectConnector } from '@/lib/pennylane'
import { decryptSecret, maskSecret } from '@/lib/security/encrypt'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ConnectorForm } from './connector-form'

export const metadata: Metadata = { title: 'Intégration Pennylane' }

export default async function PennylaneIntegrationPage() {
  const { supabase, orgId } = await getCurrentUser()
  const connector = await selectConnector(supabase, orgId, 'pennylane')

  let tokenMasked: string | null = null
  if (connector?.encrypted_token) {
    try {
      tokenMasked = maskSecret(decryptSecret(connector.encrypted_token))
    } catch {
      tokenMasked = '•••• (token illisible — ressaisissez)'
    }
  }

  return (
    <div className="max-w-3xl space-y-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/account">
          <ArrowLeft className="size-4" /> Mon compte
        </Link>
      </Button>

      <AppPageHeader
        title="Intégration"
        accent="Pennylane"
        description="Synchronise tes devis et factures KOVAS vers ta comptabilité Pennylane (PDP DGFiP 2024)."
      />

      {/* Présentation */}
      <section className="rounded-xl border border-[#0F1419]/[0.08] bg-paper p-6 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-bold text-[#0F1419]">À propos de Pennylane</h2>
          <Badge variant="muted" className="text-[10px]">
            PDP officielle DGFiP
          </Badge>
        </div>
        <p className="text-sm text-[#0F1419]/72">
          Pennylane est une Plateforme de Dématérialisation Partenaire enregistrée auprès de la
          DGFiP. Largement adoptée par les diagnostiqueurs indépendants français pour la tenue
          comptable et la facturation Factur-X.
        </p>
        <ul className="text-xs text-[#0F1419]/72 space-y-1.5">
          <li>· Création automatique de la fiche client Pennylane (par SIRET ou email)</li>
          <li>· Synchronisation des factures avec finalisation et numérotation officielle</li>
          <li>· Stockage chiffré AES-256-GCM du token API — tu gardes la main sur la révocation</li>
        </ul>
        <div>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://pennylane.readme.io/reference"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-4" /> Documentation API Pennylane
            </a>
          </Button>
        </div>
      </section>

      {/* Procédure */}
      <section className="rounded-xl border border-[#0F1419]/[0.08] bg-paper p-6 space-y-3">
        <h2 className="text-base font-bold text-[#0F1419]">
          Comment récupérer ton token Pennylane
        </h2>
        <ol className="text-sm text-[#0F1419]/72 space-y-2 list-decimal pl-5">
          <li>
            Connecte-toi à ton espace{' '}
            <a
              href="https://app.pennylane.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2"
            >
              app.pennylane.com
            </a>{' '}
            (forfait Pro ~22€/mois requis pour l’accès API).
          </li>
          <li>
            Ouvre{' '}
            <span className="font-medium text-[#0F1419]">Paramètres → API → Générer un token</span>.
          </li>
          <li>Donne-lui un nom explicite (ex. « KOVAS sync »).</li>
          <li>
            Copie le token affiché une seule fois et colle-le dans le champ ci-dessous, puis clique
            sur <span className="font-medium text-[#0F1419]">Tester</span> avant d’enregistrer.
          </li>
        </ol>
        <p className="text-[11px] text-[#0F1419]/55">
          Tu peux révoquer le token à tout moment depuis Pennylane — la sync KOVAS sera alors mise
          en pause silencieusement.
        </p>
      </section>

      {/* Formulaire */}
      <section className="rounded-xl border border-[#0F1419]/[0.08] bg-paper p-6 space-y-4">
        <h2 className="text-base font-bold text-[#0F1419]">Configuration du connecteur</h2>
        <ConnectorForm
          initial={{
            status: connector?.status ?? null,
            tokenMasked,
            lastTestAt: connector?.last_test_at ?? null,
            lastTestStatus: connector?.last_test_status ?? null,
            lastTestError: connector?.last_test_error ?? null,
            lastSyncAt: connector?.last_sync_at ?? null,
          }}
        />
      </section>

      <p className="text-[11px] text-[#0F1419]/55">
        Une fois le connecteur actif, le bouton « Synchroniser Pennylane » sur chaque facture et
        chaque devis appellera l’API Pennylane et stockera la référence retournée côté KOVAS pour
        traçabilité.
      </p>
    </div>
  )
}
