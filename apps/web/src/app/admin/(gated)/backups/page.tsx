/**
 * /admin/backups — statut PITR Supabase (Point-In-Time Recovery).
 *
 * Section d'information principalement. La restauration s'effectue depuis le
 * dashboard Supabase directement — pas d'action côté admin KOVAS pour limiter
 * la surface de risque.
 *
 * PITR activé selon CLAUDE.md §19 à M5+ (Supabase Pro requis).
 *
 * V2 — câbler Supabase Management API (SUPABASE_MANAGEMENT_API_KEY) pour
 * récupérer les vrais snapshots et leur taille.
 */

import { SnapshotsTimeline } from '@/components/admin/backups/SnapshotsTimeline'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { Card } from '@/components/ui/card'
import { getBackupStatus } from '@/lib/admin/observability'
import { Archive, Clock, ExternalLink, Shield, Timer } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'PITR Backups',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / (1000 * 60))
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

export default function AdminBackupsPage() {
  const status = getBackupStatus()

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Backups · Observabilité
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Continuité de service.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Statut du Point-In-Time Recovery (PITR) Supabase et indicateurs de restauration. Section
          en <strong>lecture seule</strong> — la restauration s'effectue depuis le dashboard
          Supabase directement.
        </p>
      </div>

      {/* Statut global */}
      {!status.pitrEnabled ? (
        <Card variant="warm" padding="default">
          <div className="flex items-start gap-3">
            <Shield className="size-5 text-amber shrink-0 mt-0.5" aria-hidden />
            <div>
              <h3 className="text-[14px] font-semibold text-ink mb-1">PITR non activé</h3>
              <p className="text-[12px] text-ink/80">
                Le Point-In-Time Recovery requiert un plan Supabase Pro. Cf. CLAUDE.md §19 —
                activation prévue à M5+ avant la bêta privée.
              </p>
              <p className="text-[11px] text-ink/60 mt-2 font-mono">
                Définir <code>SUPABASE_PITR_ENABLED=true</code> en variable d'environnement après
                activation.
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      {/* KPIs hero */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Métriques backup clés"
      >
        <AdminMetricCard
          eyebrow="Dernier backup"
          value={formatRelative(status.lastBackupAt)}
          hint={status.pitrEnabled ? 'PITR actif · backups continus' : 'PITR désactivé'}
          icon={Clock}
        />
        <AdminMetricCard
          eyebrow="RPO actuel"
          value={status.rpoMinutes !== null ? `${status.rpoMinutes} min` : '—'}
          hint="Recovery Point Objective"
          icon={Timer}
        />
        <AdminMetricCard
          eyebrow="RTO estimé"
          value={`${status.rtoMinutesEstimate} min`}
          hint="Recovery Time Objective (estimation)"
          icon={Shield}
        />
        <AdminMetricCard
          eyebrow="Rétention"
          value={`${status.retentionDays} j`}
          hint={`${status.snapshots.length} snapshots indicatifs`}
          icon={Archive}
        />
      </section>

      {/* Timeline snapshots */}
      <section aria-label="Snapshots indicatifs">
        <SnapshotsTimeline
          snapshots={status.snapshots}
          retentionDays={status.retentionDays}
        />
      </section>

      {/* Lien dashboard Supabase + procédure restauration */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2" aria-label="Actions externes">
        <Card variant="opaque" padding="default">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink mb-2">
            Restauration PITR
          </h2>
          <p className="text-[12px] text-ink-mute mb-4">
            La restauration s'effectue exclusivement depuis le dashboard Supabase pour limiter la
            surface de risque. Aucun bouton de restauration depuis KOVAS Admin.
          </p>
          {status.supabaseDashboardUrl ? (
            <Link
              href={status.supabaseDashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-ink text-paper px-3.5 py-2 text-[12px] font-medium hover:bg-ink/90 transition-colors"
            >
              <ExternalLink className="size-3.5" aria-hidden />
              Ouvrir Supabase Dashboard
            </Link>
          ) : (
            <p className="text-[11px] text-ink-faint font-mono">
              SUPABASE_URL non configuré côté env.
            </p>
          )}
        </Card>

        <Card variant="opaque" padding="default">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink mb-2">
            Procédure d'urgence
          </h2>
          <ol className="text-[12px] text-ink-mute space-y-1.5 list-decimal pl-4">
            <li>Mettre l'app en mode maintenance (banner + read-only)</li>
            <li>Identifier le moment précis avant l'incident (UTC ISO 8601)</li>
            <li>Dashboard Supabase → Database → Backups → Restore to point in time</li>
            <li>Valider sur un projet de staging d'abord si possible</li>
            <li>Communiquer aux utilisateurs (statut page + email Resend)</li>
            <li>Post-mortem dans <code className="font-mono">/admin/audit</code></li>
          </ol>
        </Card>
      </section>
    </div>
  )
}
