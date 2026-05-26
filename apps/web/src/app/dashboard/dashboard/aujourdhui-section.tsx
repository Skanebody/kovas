import { getCurrentUser } from '@/lib/auth/current-user'
import { parisDayBounds } from '@/lib/paris-dates'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

/**
 * Section « Aujourd'hui » — liste sobre verticale des RDV du jour.
 * Affichage compact : heure mono · client + adresse · chevron navigation.
 * Empty state micro (pas de card vide encombrante).
 */
export async function AujourdhuiSection() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, endIso } = parisDayBounds()

  const { data } = await supabase
    .from('dossiers')
    .select('id, scheduled_at, properties(address, postal_code, city), clients(display_name)')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true })

  const rows = data ?? []

  return (
    <section>
      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-[#0F1419]/72 mb-3">
        AUJOURD&apos;HUI
      </p>
      {rows.length === 0 ? (
        <p className="text-[14px] text-[#0F1419]/72 italic py-2">Aucun rendez-vous planifié.</p>
      ) : (
        <ul>
          {rows.map((d, idx) => {
            const time = d.scheduled_at
              ? new Date(d.scheduled_at).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Europe/Paris',
                })
              : '—'
            const client = Array.isArray(d.clients) ? d.clients[0] : d.clients
            const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
            const address = prop
              ? [prop.address, prop.postal_code, prop.city].filter(Boolean).join(', ')
              : '—'
            const isLast = idx === rows.length - 1
            return (
              <li key={d.id}>
                <Link
                  href={`/dashboard/dossiers/${d.id}`}
                  className={cn(
                    'flex items-center gap-3 py-2.5 group',
                    !isLast && 'border-b border-[#0F1419]/[0.08]',
                  )}
                >
                  <span className="font-mono text-[14px] font-medium text-[#0F1419] tabular-nums w-12 shrink-0">
                    {time}
                  </span>
                  <span className="flex-1 min-w-0 text-[14px] text-[#0F1419] truncate">
                    <span className="font-medium">{client?.display_name ?? 'Sans client'}</span>
                    <span className="text-[#0F1419]/72"> · {address}</span>
                  </span>
                  <ChevronRight
                    className="size-4 text-[#0F1419]/72 group-hover:text-[#0F1419] transition-colors"
                    aria-hidden
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
