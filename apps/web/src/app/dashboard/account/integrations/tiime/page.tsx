/**
 * Page Compte → Intégrations → Tiime.
 *
 * Saisie du bearer token Tiime + companyId. Statut affiché en haut.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { TiimeConfigForm } from './config-form'

export const metadata: Metadata = { title: 'Tiime — Intégration' }

export default async function TiimePage() {
  const { orgId, supabase } = await getCurrentUser()

  const { data: connector } = await supabase
    .from('accounting_connectors')
    .select('status, workspace_id, last_sync_at, last_error')
    .eq('organization_id', orgId)
    .eq('provider', 'tiime')
    .maybeSingle()

  const status = (connector?.status ?? 'inactive') as 'active' | 'inactive' | 'error' | 'pending'

  const statusVariant = status === 'active' ? 'blue' : status === 'error' ? 'coral' : 'muted'
  const statusLabel =
    status === 'active'
      ? 'Configuré'
      : status === 'error'
        ? 'Erreur de synchronisation'
        : 'Non configuré'

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/account/integrations">
          <ArrowLeft className="size-4" /> Intégrations
        </Link>
      </Button>

      <AppPageHeader
        title="Tiime"
        accent="intégration"
        description="Comptabilité automatique mobile-first. Synchronisation par bearer token."
      />

      <div className="rounded-lg border border-rule glass-opaque p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-base text-ink">État du connecteur</h3>
          <StatusPill size="sm" variant={statusVariant} label={statusLabel} />
        </div>
        {connector?.last_error && (
          <p className="text-xs text-danger leading-relaxed">{connector.last_error}</p>
        )}
        {connector?.last_sync_at && (
          <p className="text-xs text-ink-mute">
            Dernière synchronisation : {new Date(connector.last_sync_at).toLocaleString('fr-FR')}
          </p>
        )}
      </div>

      <TiimeConfigForm
        initial={{
          workspaceId: connector?.workspace_id ?? '',
          isActive: status === 'active',
        }}
      />

      <div className="rounded-lg border border-rule glass-opaque p-5 space-y-2">
        <h3 className="font-bold text-sm text-ink">Comment obtenir vos identifiants</h3>
        <ol className="text-xs text-ink-mute leading-relaxed space-y-1.5 list-decimal pl-4">
          <li>Connectez-vous à votre espace Tiime sur tiime.fr.</li>
          <li>Ouvrez Paramètres → API ou contactez votre conseiller Tiime.</li>
          <li>Demandez un token API et l'identifiant de votre société (companyId).</li>
          <li>Copiez ces deux valeurs ci-dessus et enregistrez.</li>
        </ol>
        <Button variant="ghost" size="sm" asChild>
          <a href="https://www.tiime.fr" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" /> tiime.fr
          </a>
        </Button>
      </div>
    </div>
  )
}
