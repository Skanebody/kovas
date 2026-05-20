/**
 * Panneau outils techniques.
 */

import { Card } from '@/components/ui/card'
import { ActionRunner } from './ActionRunner'

export function TechnicalToolsPanel() {
  return (
    <Card variant="opaque" padding="default" className="space-y-3">
      <header className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          ⚙️ Technique · Maintenance
        </p>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          Outils techniques
        </h2>
      </header>

      <ActionRunner
        label="Purger le cache Next.js"
        description="revalidatePath sur /admin, /, /app/dashboard"
        endpoint="/api/admin/tools/cache-purge"
      />
      <ActionRunner
        label="Trigger cron alert check"
        description="Déclenche manuellement le job alertes (utilise CRON_SECRET)"
        endpoint="/api/admin/tools/trigger-cron"
      />
      <ActionRunner
        label="Restart Supabase Realtime channel"
        description="V1 log only (V2 reconnect WS côté infra Supabase)"
        endpoint="/api/admin/tools/restart-realtime"
      />
      <ActionRunner
        label="Forcer regeneration des types DB"
        description="Affiche les instructions CLI à exécuter en local"
        endpoint="/api/admin/tools/regen-types"
      />
    </Card>
  )
}
