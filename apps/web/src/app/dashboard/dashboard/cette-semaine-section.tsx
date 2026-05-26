import { getCurrentUser } from '@/lib/auth/current-user'

/**
 * Section « Cette semaine » — 2 mini-stats :
 *  - CA prévu sur la semaine (somme metadata.price_eur des dossiers actifs)
 *  - Missions à finaliser (statut 'to_review' ou 'done' non exportées)
 *
 * Calcul CA défensif : si metadata absent ou price_eur non posé, fallback 0.
 */

interface DossierMetadata {
  price_eur?: number
  [key: string]: unknown
}

function parisStartOfWeek(): { startIso: string; endIso: string } {
  const now = new Date()
  // Approche défensive : on prend bornes [début jour Paris - 7j ; +7j depuis maintenant]
  // pour ne pas se planter sur le lundi exact.
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay() === 0 ? 6 : start.getDay() - 1
  start.setDate(start.getDate() - day)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

function formatEuros(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export async function CetteSemaineSection() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, endIso } = parisStartOfWeek()

  const [{ data: dossiersWeek }, { count: toFinalizeCount }] = await Promise.all([
    supabase
      .from('dossiers')
      .select('id, metadata, status, scheduled_at')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('scheduled_at', startIso)
      .lt('scheduled_at', endIso),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['to_review', 'done']),
  ])

  const rows = dossiersWeek ?? []
  const ca = rows.reduce((acc, d) => {
    const md = (d.metadata ?? {}) as DossierMetadata
    const price = typeof md.price_eur === 'number' ? md.price_eur : 0
    return acc + price
  }, 0)

  const missionsToFinalize = toFinalizeCount ?? 0

  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#0F1419]/72 mb-3">
        CETTE SEMAINE
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        <div className="rounded-xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4">
          <p className="font-serif italic text-[28px] leading-none text-[#0F1419] mb-1.5">
            {formatEuros(ca)}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F1419]/72">
            CA prévu
          </p>
        </div>
        <div className="rounded-xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4">
          <p className="font-serif italic text-[28px] leading-none text-[#0F1419] mb-1.5 tabular-nums">
            {missionsToFinalize}
          </p>
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F1419]/72">
            Missions à finaliser
          </p>
        </div>
      </div>
    </section>
  )
}
