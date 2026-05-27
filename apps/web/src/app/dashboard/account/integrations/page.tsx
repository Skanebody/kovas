/**
 * Page Compte → Intégrations.
 *
 * Vue unifiée des 4 connecteurs comptables disponibles (Qonto, Pennylane,
 * Indy, Tiime). Permet d'activer plusieurs connecteurs en parallèle.
 *
 * Ton : sobre, vouvoiement, pas d'emoji. Tokens v5.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { ConnectorCard } from '@/components/integrations/ConnectorCard'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getConnectorsForOrg } from '@/lib/hooks/use-connectors'
import { ArrowLeft, Info } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Intégrations comptables',
  description: 'Connectez KOVAS à Qonto, Pennylane, Indy ou Tiime.',
}

export default async function IntegrationsPage() {
  const { orgId } = await getCurrentUser()
  const state = await getConnectorsForOrg(orgId)

  return (
    <div className="space-y-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/account">
          <ArrowLeft className="size-4" /> Mon compte
        </Link>
      </Button>

      <AppPageHeader
        title="Tes"
        accent="intégrations"
        description="Synchronise tes factures et devis vers ton outil de comptabilité. Tu peux activer plusieurs connecteurs simultanément."
      />

      {/* Bandeau info — ton sobre */}
      <div className="rounded-lg border border-[#0F1419]/[0.08] bg-paper p-4 flex gap-3 items-start">
        <Info className="size-4 mt-0.5 text-[#0F1419]/72 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#0F1419]">
            Active les connecteurs que tu utilises réellement.
          </p>
          <p className="text-xs text-[#0F1419]/72 leading-relaxed">
            Chaque connecteur fonctionne indépendamment. Tu gardes la main sur les destinations de
            synchronisation depuis chaque facture ou devis.
          </p>
        </div>
      </div>

      {/* Grille connecteurs — 4 cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConnectorCard
          name="Qonto"
          description="Banque pro qui devient PDP agréée. Facturation électronique incluse sans surcoût avec un compte Qonto."
          tagline="PDP · banque pro"
          status={state.qonto.status}
          lastSyncAt={state.qonto.lastSyncAt}
          href="/dashboard/account/integrations/qonto"
          logoChar="Q"
          accentColor="navy"
        />
        <ConnectorCard
          name="Pennylane"
          description="Plateforme de gestion comptable complète. PDP agréée pour la réforme 2026-2027. À partir de 22€ HT/mois."
          tagline="PDP · gestion complète"
          status={state.pennylane.status}
          lastSyncAt={state.pennylane.lastSyncAt}
          href="/dashboard/account/integrations/pennylane"
          logoChar="P"
          accentColor="navy"
        />
        <ConnectorCard
          name="Indy"
          description="Comptabilité automatique freemium pour indépendants. Bien adapté aux solos en BNC. API en cours d'ouverture."
          tagline="freemium · indépendants"
          status={state.indy.status}
          lastSyncAt={state.indy.lastSyncAt}
          href="/dashboard/account/integrations/indy"
          logoChar="I"
          accentColor="navy"
        />
        <ConnectorCard
          name="Tiime"
          description="Comptabilité automatique avec connexion bancaire et reporting. Solution mobile-first. Tarif sur devis selon volume."
          tagline="payant · mobile-first"
          status={state.tiime.status}
          lastSyncAt={state.tiime.lastSyncAt}
          href="/dashboard/account/integrations/tiime"
          logoChar="T"
          accentColor="navy"
        />
      </section>

      {/* Section recommandation réforme 2026-2027 */}
      <section className="rounded-lg border border-[#0F1419]/[0.08] bg-paper p-6 space-y-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="font-bold text-lg text-[#0F1419]">
            Réforme <span className="font-serif italic font-normal">2026-2027</span>
          </h2>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#0F1419]/72">
            Facturation électronique obligatoire
          </span>
        </div>
        <div className="space-y-2 text-sm text-[#0F1419]/72 leading-relaxed">
          <p>
            À compter de septembre 2026 pour les grandes entreprises et septembre 2027 pour les TPE,
            l'émission et la réception de factures électroniques via une Plateforme de
            Dématérialisation Partenaire (PDP) deviennent obligatoires.
          </p>
          <p>
            Pour rester conforme sans changer d'outil, on te recommande{' '}
            <strong className="text-[#0F1419] font-semibold">Qonto</strong> (gratuit avec un compte
            pro) ou <strong className="text-[#0F1419] font-semibold">Pennylane</strong> (à partir de
            22€ HT/mois). Ces deux outils sont des PDP officiellement agréées par la DGFiP.
          </p>
          <p>
            <strong className="text-[#0F1419] font-semibold">Indy et Tiime</strong> ne sont pas des
            PDP. Tu peux les utiliser pour ta comptabilité quotidienne, mais devras transiter par
            une PDP pour la transmission officielle des factures.
          </p>
        </div>
      </section>

      {/* Add-on info — sobre */}
      <section className="rounded-lg border border-[#0F1419]/[0.08] bg-paper p-5 space-y-2">
        <h3 className="font-bold text-sm text-[#0F1419]">Add-on Connecteurs Pro · 9€ HT/mois</h3>
        <p className="text-xs text-[#0F1419]/72 leading-relaxed">
          Un seul add-on débloque la synchronisation vers les 4 connecteurs (Qonto, Pennylane, Indy,
          Tiime). Active-le depuis Compte → Abonnement.
        </p>
      </section>
    </div>
  )
}
