/**
 * /admin/diagnostiqueurs/import — Déclencheur manuel de l'import DHUP.
 *
 * Server Component qui pré-fetche l'état de la dernière exécution
 * (dernier `dhup_imported_at` + total publié) et délègue au composant client
 * `DhupImportButton` pour le déclenchement + affichage en temps réel.
 */

import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import { DhupImportPanel } from './dhup-import-panel'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Import DHUP annuaire',
}

interface DhupSnapshot {
  totalRows: number
  lastImportAt: string | null
  publishedRows: number
  withSiret: number
  withGeo: number
}

async function fetchSnapshot(): Promise<DhupSnapshot> {
  try {
    const supabase = await createClient()
    // biome-ignore lint/suspicious/noExplicitAny: types Database à régénérer post-FIX-D
    const client = supabase as any

    const [
      { count: total },
      { count: published },
      { data: lastRow },
      { count: withSiret },
      { count: withGeo },
    ] = await Promise.all([
      client.from('diagnosticians').select('id', { count: 'exact', head: true }),
      client
        .from('diagnosticians')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),
      client
        .from('diagnosticians')
        .select('dhup_imported_at')
        .not('dhup_imported_at', 'is', null)
        .order('dhup_imported_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from('diagnosticians')
        .select('id', { count: 'exact', head: true })
        .not('sirene_siret', 'is', null),
      client
        .from('diagnosticians')
        .select('id', { count: 'exact', head: true })
        .not('latitude', 'is', null),
    ])

    return {
      totalRows: total ?? 0,
      lastImportAt: (lastRow?.dhup_imported_at as string | null) ?? null,
      publishedRows: published ?? 0,
      withSiret: withSiret ?? 0,
      withGeo: withGeo ?? 0,
    }
  } catch {
    return { totalRows: 0, lastImportAt: null, publishedRows: 0, withSiret: 0, withGeo: 0 }
  }
}

export default async function AdminDhupImportPage() {
  const snapshot = await fetchSnapshot()

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Import annuaire DHUP</h1>
        <p className="text-[13px] text-ink-mute">
          Déclenche manuellement l'absorption du dataset DHUP officiel (Ministère du Logement,
          data.gouv.fr — Etalab 2.0). Idempotent : chaque fiche est dédupliquée par hash
          SHA-256(siret|nom+prénom+dept).
        </p>
        <p className="text-[12px] text-ink-faint">
          Le cron équivalent tourne <strong>chaque lundi à 03:00 UTC</strong>
          via <code>.github/workflows/cron-dhup-weekly.yml</code>. Cette page est destinée aux
          imports d'urgence ou aux toutes premières synchronisations.
        </p>
        <p className="text-[12px] text-ink-faint">
          Voir aussi :{' '}
          <a
            href="/admin/diagnostiqueurs/audit"
            className="font-medium text-cta underline underline-offset-2 hover:text-cta-hover"
          >
            Audit pipeline (DHUP + Sirene + GMB) → /admin/diagnostiqueurs/audit
          </a>
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SnapshotCard label="Fiches totales" value={snapshot.totalRows.toLocaleString('fr-FR')} />
        <SnapshotCard label="Publiées" value={snapshot.publishedRows.toLocaleString('fr-FR')} />
        <SnapshotCard label="Avec SIRET" value={snapshot.withSiret.toLocaleString('fr-FR')} />
        <SnapshotCard label="Géolocalisées" value={snapshot.withGeo.toLocaleString('fr-FR')} />
        <SnapshotCard
          label="Dernier import"
          value={snapshot.lastImportAt ? formatDate(snapshot.lastImportAt) : '—'}
        />
      </section>

      <DhupImportPanel initialLastImportAt={snapshot.lastImportAt} />
    </div>
  )
}

function SnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-rule/60 bg-paper p-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink tabular-nums">{value}</p>
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}
