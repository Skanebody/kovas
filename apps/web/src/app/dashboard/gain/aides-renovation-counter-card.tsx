import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface AnnexeAggregateRow {
  payload: {
    aides?: { montant_eur?: number }[]
  }
}

/**
 * Compteur Gain : "X dossiers F/G enrichis avec annexe Aides → ~Y € d'aides
 * facilitées pour vos clients".
 *
 * Lit la table `dossier_export_annexes` (annexe_type='aides_renovation')
 * pour la période courante de l'organisation. Pas de filtre temporel V1 :
 * on cumule depuis le début (le diagnostiqueur veut voir son impact).
 */
export async function AidesRenovationCounterCard() {
  const { supabase, orgId } = await getCurrentUser()

  const { data: rawRows } = await supabase
    .from('dossier_export_annexes' as never)
    .select('payload')
    .eq('organization_id', orgId)
    .eq('annexe_type', 'aides_renovation')

  const rows = (rawRows ?? []) as unknown as AnnexeAggregateRow[]
  const count = rows.length

  let totalEur = 0
  for (const row of rows) {
    const aides = row.payload.aides ?? []
    for (const a of aides) {
      totalEur += a.montant_eur ?? 0
    }
  }
  const totalRounded = Math.round(totalEur / 1000) * 1000

  return (
    <Card variant="flat" className="relative overflow-hidden flex flex-col justify-between">
      <div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-mute mb-3">
          Aides facilitées pour vos clients
        </p>

        {count > 0 ? (
          <>
            <p className="font-serif italic font-normal text-ink leading-[0.9] tracking-tight text-6xl md:text-7xl mb-3">
              {formatCompactEur(totalRounded)}
            </p>
            <p className="text-sm text-ink-soft max-w-sm">
              Sur{' '}
              <span className="font-semibold text-ink">
                {count} dossier{count > 1 ? 's' : ''} DPE F/G
              </span>{' '}
              enrichi{count > 1 ? 's' : ''} d'une annexe Aides Rénovation France Rénov'.
            </p>
          </>
        ) : (
          <>
            <p className="font-serif italic font-normal text-ink/40 leading-[0.9] tracking-tight text-5xl md:text-6xl mb-3">
              —
            </p>
            <p className="text-sm text-ink-mute max-w-sm">
              Dès que vous exporterez un DPE de classe F ou G, KOVAS générera automatiquement
              l'annexe officielle Aides Rénovation à remettre au propriétaire.
            </p>
          </>
        )}
      </div>

      <Link
        href="/app/dossiers?dpe=fg"
        className="mt-6 inline-flex items-center gap-2 self-start rounded-pill border border-rule bg-paper px-4 py-2 text-sm font-semibold text-ink transition-all hover:-translate-y-px"
      >
        Voir les dossiers <ArrowRight className="size-4" />
      </Link>
    </Card>
  )
}

function formatCompactEur(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.', ',')} M€`
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} k€`
  return `${amount.toLocaleString('fr-FR')} €`
}
