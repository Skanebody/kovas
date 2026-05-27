import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { asUntyped } from '@/lib/diagnosticians/supabase-untyped'
import { createClient } from '@/lib/supabase/server'
import { Building2, Lock, MapPin } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Demandes de devis en attente | KOVAS',
  robots: { index: false, follow: false },
}

interface PageProps {
  params: Promise<{ id: string }>
}

interface DiagRow {
  id: string
  slug: string
  display_name: string | null
  claim_status: string
  city: string | null
}

interface LeadRow {
  id: string
  requester_first_name: string | null
  requester_last_name: string | null
  property_city: string | null
  property_postal_code: string | null
  property_type: string | null
  property_surface_m2: number | null
  diagnostics_requested: string[] | null
  created_at: string
}

export default async function LeadsEnAttentePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const sb = asUntyped(supabase)

  const { data: diagRaw } = await sb
    .from('diagnosticians')
    .select('id, slug, display_name, claim_status, city')
    .eq('id', id)
    .maybeSingle()

  const diag = diagRaw as DiagRow | null
  if (!diag) notFound()

  const { data: leadsRaw } = await sb
    .from('quote_requests')
    .select(
      'id, requester_first_name, requester_last_name, property_city, property_postal_code, property_type, property_surface_m2, diagnostics_requested, created_at',
    )
    .eq('diagnostician_id', id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50)

  const leads = (leadsRaw ?? []) as LeadRow[]
  const claimUrl = `/reclamer-ma-fiche/${diag.id}?next=leads`

  return (
    <div className="min-h-dvh flex flex-col bg-[#FAFBFC]">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-[#0B1D33]" aria-hidden />
            <span className="font-bold text-[#0B1D33]">KOVAS</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-3xl w-full px-6 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#0B1D33]">
            {leads.length} demande{leads.length > 1 ? 's' : ''} de devis en attente
          </h1>
          <p className="text-neutral-600 mt-2">
            Fiche : <strong>{diag.display_name ?? '—'}</strong>
            {diag.city ? ` · ${diag.city}` : ''}
          </p>
        </div>

        <div className="rounded-2xl bg-[#0B1D33] text-white p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <Lock className="size-5 shrink-0 mt-1 text-[#D4F542]" aria-hidden />
            <div>
              <h2 className="font-semibold text-lg">Coordonnées verrouillées</h2>
              <p className="text-sm text-white/80 mt-1">
                Pour découvrir les téléphones et emails de ces prospects, réclame ta fiche KOVAS.
                Activation immédiate, essai 30 jours puis débit automatique à J+30. Résiliation
                libre en 2 clics.
              </p>
              <Link
                href={claimUrl}
                className="inline-block mt-4 rounded-full bg-[#D4F542] text-[#0B1D33] font-semibold px-6 py-3 text-sm hover:bg-[#c2e335] transition"
              >
                Réclamer ma fiche pour les voir
              </Link>
            </div>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-2xl bg-white border border-neutral-200 p-8 text-center">
            <p className="text-neutral-600">
              Aucune demande de devis en attente pour l&apos;instant.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {leads.map((lead) => (
              <li
                key={lead.id}
                className="rounded-2xl bg-white border border-neutral-200 p-5 flex items-start gap-4"
              >
                <div className="size-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 shrink-0">
                  <Lock className="size-4" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0B1D33]">
                    {lead.requester_first_name ?? 'Prospect'}{' '}
                    {(lead.requester_last_name ?? '').charAt(0)}.
                  </p>
                  <p className="text-sm text-neutral-600 flex items-center gap-1 mt-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {lead.property_city ?? '—'}{' '}
                    {lead.property_postal_code ? `(${lead.property_postal_code})` : ''}
                  </p>
                  <p className="text-sm text-neutral-600 flex items-center gap-1 mt-1">
                    <Building2 className="size-3.5" aria-hidden />
                    {labelForPropertyType(lead.property_type)}
                    {lead.property_surface_m2 ? ` · ${lead.property_surface_m2} m²` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(lead.diagnostics_requested ?? []).map((d) => (
                      <span
                        key={d}
                        className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700"
                      >
                        {d === 'erp' ? 'ERP' : d}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-xs text-neutral-400 shrink-0 mt-1">
                  {timeAgo(lead.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>

      <SiteFooter />
    </div>
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
      return 'Local commercial'
    default:
      return t
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'à l’instant'
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  return `il y a ${days} j`
}
