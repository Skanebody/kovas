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
    <div className="max-w-4xl space-y-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/account">
          <ArrowLeft className="size-4" /> Mon compte
        </Link>
      </Button>

      <AppPageHeader
        title="Vos"
        accent="intégrations"
        description="Synchronisez vos factures et devis vers votre outil de comptabilité. Vous pouvez activer plusieurs connecteurs simultanément."
      />

      {/* Bandeau info — vouvoiement sobre */}
      <div className="rounded-lg border border-rule glass-opaque p-4 flex gap-3 items-start">
        <Info className="size-4 mt-0.5 text-ink-mute shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">
            Activez les connecteurs que vous utilisez réellement.
          </p>
          <p className="text-xs text-ink-mute leading-relaxed">
            Chaque connecteur fonctionne indépendamment. Vous gardez la main sur les destinations de
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
      <section className="rounded-lg border border-rule glass-opaque p-6 space-y-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="font-bold text-lg text-ink">
            Réforme <span className="font-serif italic font-normal">2026-2027</span>
          </h2>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-ink-mute">
            Facturation électronique obligatoire
          </span>
        </div>
        <div className="space-y-2 text-sm text-ink-mute leading-relaxed">
          <p>
            À compter de septembre 2026 pour les grandes entreprises et septembre 2027 pour les TPE,
            l'émission et la réception de factures électroniques via une Plateforme de
            Dématérialisation Partenaire (PDP) deviennent obligatoires.
          </p>
          <p>
            Pour rester conforme sans changer d'outil, nous recommandons{' '}
            <strong className="text-ink font-semibold">Qonto</strong> (gratuit avec un compte pro)
            ou <strong className="text-ink font-semibold">Pennylane</strong> (à partir de 22€
            HT/mois). Ces deux outils sont des PDP officiellement agréées par la DGFiP.
          </p>
          <p>
            <strong className="text-ink font-semibold">Indy et Tiime</strong> ne sont pas des PDP.
            Vous pouvez les utiliser pour votre comptabilité quotidienne, mais devrez transiter par
            une PDP pour la transmission officielle des factures.
          </p>
        </div>
      </section>

      {/* Add-on info — sobre */}
      <section className="rounded-lg border border-rule glass-opaque p-5 space-y-2">
        <h3 className="font-bold text-sm text-ink">Add-on Connecteurs Pro · 9€ HT/mois</h3>
        <p className="text-xs text-ink-mute leading-relaxed">
          Un seul add-on débloque la synchronisation vers les 4 connecteurs (Qonto, Pennylane, Indy,
          Tiime). Activez-le depuis Compte → Abonnement.
        </p>
      </section>
    </div>
  )
}
