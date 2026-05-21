import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { asUntyped } from '@/lib/diagnosticians/supabase-untyped'
import { CheckCircle2, Lock, MapPin } from 'lucide-react'
import Link from 'next/link'

interface DiagRow {
  id: string
  claim_status: string
}

interface LeadRow {
  id: string
  requester_first_name: string | null
  property_city: string | null
  property_postal_code: string | null
  property_type: string | null
  diagnostics_requested: string[] | null
  created_at: string
}

interface UnlockRow {
  quote_request_id: string
}

/**
 * Widget dashboard "Leads en attente" — affiche 3 derniers leads anonymisés
 * + CTA "Voir tous les leads". Rendu uniquement si l'user a une fiche claimed.
 *
 * Cf. CLAUDE.md §4 + spec G1 §10.
 */
export async function LeadsWidget() {
  const { user, supabase } = await getCurrentUser()
  const sb = asUntyped(supabase)

  const { data: diagsRaw } = await sb
    .from('diagnosticians')
    .select('id, claim_status')
    .eq('claimed_by_user_id', user.id)

  const diags = (diagsRaw ?? []) as DiagRow[]
  if (diags.length === 0) return null

  const diagIds = diags.map((d) => d.id)

  const { data: leadsRaw, count } = await sb
    .from('quote_requests')
    .select(
      'id, requester_first_name, property_city, property_postal_code, property_type, diagnostics_requested, created_at',
      { count: 'exact' },
    )
    .in('diagnostician_id', diagIds)
    .order('created_at', { ascending: false })
    .limit(3)

  const leads = (leadsRaw ?? []) as LeadRow[]
  const total = count ?? leads.length

  if (total === 0) return null

  // Marque verrouillage : on regarde si l'user a unlocked chaque lead
  const ids = leads.map((l) => l.id)
  let unlockedSet = new Set<string>()
  if (ids.length > 0) {
    const { data: unlocksRaw } = await sb
      .from('quote_request_unlocks')
      .select('quote_request_id')
      .eq('user_id', user.id)
      .in('quote_request_id', ids)
    const unlocks = (unlocksRaw ?? []) as UnlockRow[]
    unlockedSet = new Set(unlocks.map((u) => u.quote_request_id))
  }

  return (
    <Card variant="flat" padding="default">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-ink-mute">
            Leads en attente
          </p>
          <h3 className="text-xl font-serif italic font-normal text-ink mt-1">
            {total} demande{total > 1 ? 's' : ''} de devis
          </h3>
        </div>
        <Link
          href="/app/leads"
          className="text-xs font-medium text-ink-mute hover:text-ink transition"
        >
          Voir tous →
        </Link>
      </div>
      <ul className="space-y-2">
        {leads.map((lead) => {
          const isUnlocked = unlockedSet.has(lead.id)
          return (
            <li
              key={lead.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-ink/5 transition"
            >
              {isUnlocked ? (
                <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-[#D4F542]" aria-hidden />
              ) : (
                <Lock className="size-4 shrink-0 mt-0.5 text-ink-faint" aria-hidden />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {lead.requester_first_name ?? 'Prospect'} ·{' '}
                  {labelForPropertyType(lead.property_type)}
                </p>
                <p className="text-xs text-ink-mute flex items-center gap-1 truncate">
                  <MapPin className="size-3" aria-hidden />
                  {lead.property_city ?? '—'}{' '}
                  {lead.property_postal_code ? `(${lead.property_postal_code})` : ''}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function labelForPropertyType(t: string | null): string {
  if (!t) return '—'
  switch (t) {
    case 'appartement':
      return 'Appartement'
    case 'maison':
      return 'Maison'
    case 'local_commercial':
      return 'Local'
    default:
      return t
  }
}
