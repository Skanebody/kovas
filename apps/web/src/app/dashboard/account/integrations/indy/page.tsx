/**
 * Page Compte → Intégrations → Indy.
 *
 * Tant qu'Indy n'a pas ouvert son API publique, cette page affiche un état
 * "API sur demande" et un CTA "Demander l'accès" qui crée une ligne dans
 * `connector_api_access_requests`.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getPendingApiAccessRequest } from '@/lib/hooks/use-connectors'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { RequestApiAccessForm } from './request-form'

export const metadata: Metadata = { title: 'Indy — Intégration' }

export default async function IndyPage() {
  const { orgId, profile } = await getCurrentUser()
  const pending = await getPendingApiAccessRequest(orgId, 'indy')

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/account/integrations">
          <ArrowLeft className="size-4" /> Intégrations
        </Link>
      </Button>

      <AppPageHeader
        title="Indy"
        accent="intégration"
        description="Comptabilité automatique freemium pour indépendants. API en cours d'ouverture."
      />

      <div className="rounded-lg border border-rule glass-opaque p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-base text-ink">État du connecteur</h3>
          <StatusPill
            size="sm"
            variant={pending ? 'amber' : 'muted'}
            label={pending ? 'Demande en cours' : 'Non configuré'}
          />
        </div>
        <p className="text-xs text-ink-mute leading-relaxed">
          L'API publique d'Indy n'est pas encore généralement disponible. Vous pouvez nous signaler
          votre intérêt — nous activerons votre connecteur dès qu'Indy aura ouvert son accès
          partenaire.
        </p>
      </div>

      {pending ? (
        <div className="rounded-lg border border-rule glass-opaque p-5 space-y-2">
          <p className="text-sm font-medium text-ink">Demande enregistrée</p>
          <p className="text-xs text-ink-mute">
            Reçue le{' '}
            {new Date(pending.requested_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
            . Vous serez notifié par email à l'activation.
          </p>
        </div>
      ) : (
        <RequestApiAccessForm defaultEmail={profile.email} />
      )}

      <div className="rounded-lg border border-rule glass-opaque p-5 space-y-2">
        <h3 className="font-bold text-sm text-ink">En attendant</h3>
        <p className="text-xs text-ink-mute leading-relaxed">
          Vous pouvez exporter manuellement vos factures KOVAS au format PDF + Facture-X, puis les
          importer dans Indy depuis votre tableau de bord Indy.
        </p>
        <Button variant="ghost" size="sm" asChild>
          <a href="https://www.indy.fr" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" /> indy.fr
          </a>
        </Button>
      </div>
    </div>
  )
}
