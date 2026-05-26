import { fetchSignupAnomalies } from '@/lib/admin/signup-anomalies'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'
import { AnomalyRowActions } from './anomaly-row-actions'

export const metadata: Metadata = {
  title: 'Anomalies SIRET signup',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})

const ANOMALY_LABELS: Record<string, string> = {
  naf_mismatch: 'NAF hors périmètre diagnostic',
}

function formatDate(iso: string): string {
  try {
    return DATE_FORMATTER.format(new Date(iso))
  } catch {
    return iso
  }
}

export default async function SignupAnomaliesPage() {
  const supabase = createAdminClient()
  const rows = await fetchSignupAnomalies(supabase)

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Modération · Vérifications SIRET
        </p>
        <h1 className="text-2xl font-display font-bold text-ink mt-1">Anomalies SIRET signup</h1>
        <p className="text-sm text-ink-mute mt-1 max-w-3xl">
          Cabinets dont le SIRET est actif au registre SIRENE mais dont le code NAF déclaré n&apos;est
          pas dans le périmètre diagnostic immobilier (71.20B ou 71.12B). Cas typique : cabinet
          récemment immatriculé pas encore catégorisé, ou activité multi-secteurs. L&apos;essai
          continue tant que vous n&apos;avez pas validé manuellement.
        </p>
      </header>

      <section className="rounded-xl border border-rule bg-paper">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-ink-mute">
              Aucune anomalie en attente. Toutes les inscriptions récentes ont un code NAF cohérent.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-rule">
              <tr className="text-left font-mono text-[11px] uppercase tracking-[0.12em] text-ink-mute">
                <th className="px-4 py-3">SIRET</th>
                <th className="px-4 py-3">Entreprise</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">NAF déclaré</th>
                <th className="px-4 py-3">Anomalie</th>
                <th className="px-4 py-3">Date signup</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {rows.map((row) => (
                <tr key={row.id} className={row.bloked ? 'opacity-50' : ''}>
                  <td className="px-4 py-3 font-mono text-xs">{row.siret}</td>
                  <td className="px-4 py-3">
                    {row.sireneCompanyName ?? <span className="text-ink-mute">—</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-mute">{row.email}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.sireneVerifiedNaf ?? <span className="text-ink-mute">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {row.signupAnomaly
                        ? (ANOMALY_LABELS[row.signupAnomaly] ?? row.signupAnomaly)
                        : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-mute text-xs">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {row.bloked ? (
                        <span className="text-xs font-medium text-red-700">Déjà bloqué</span>
                      ) : (
                        <AnomalyRowActions trialId={row.id} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
