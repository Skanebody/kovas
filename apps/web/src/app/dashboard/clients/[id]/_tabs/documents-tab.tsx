import { FileText, Receipt } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import { EmptyTabState } from './empty-tab-state'
import { formatDate } from './format-helpers'

type Props = {
  clientId: string
  orgId: string
}

type DocItem = {
  id: string
  kind: 'devis' | 'facture'
  reference: string
  href: string
  pdfPath: string | null
  date: string | null
}

/**
 * Onglet Documents — agrégat PDF associés au client.
 *
 * V1 : devis PDF + factures PDF. V2 : attestations, mandats, owner_documents
 * (liés via missions/dossiers du client).
 */
export async function ClientDocumentsTab({ clientId, orgId }: Props) {
  const supabase = await createClient()

  const [{ data: quotes }, { data: invoices }] = await Promise.all([
    supabase
      .from('quotes')
      .select('id, reference, pdf_path, issued_at, created_at')
      .eq('organization_id', orgId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('invoices')
      .select('id, reference, pdf_path, issued_at, created_at')
      .eq('organization_id', orgId)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const items: DocItem[] = [
    ...(quotes ?? []).map(
      (q): DocItem => ({
        id: `quote-${q.id}`,
        kind: 'devis',
        reference: q.reference,
        href: `/dashboard/devis/${q.id}`,
        pdfPath: q.pdf_path ?? null,
        date: q.issued_at ?? q.created_at ?? null,
      }),
    ),
    ...(invoices ?? []).map(
      (i): DocItem => ({
        id: `invoice-${i.id}`,
        kind: 'facture',
        reference: i.reference,
        href: `/dashboard/factures/${i.id}`,
        pdfPath: i.pdf_path ?? null,
        date: i.issued_at ?? i.created_at ?? null,
      }),
    ),
  ].sort((a, b) => {
    const aT = a.date ? new Date(a.date).getTime() : 0
    const bT = b.date ? new Date(b.date).getTime() : 0
    return bT - aT
  })

  return (
    <div className="space-y-4">
      <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-ink-mute">
        Documents
      </h2>

      {items.length === 0 ? (
        <EmptyTabState
          icon={FileText}
          title="Aucun document pour ce client."
          description="Les PDF de devis, factures et attestations apparaîtront ici dès qu'ils seront générés."
        />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((doc) => {
            const Icon = doc.kind === 'facture' ? Receipt : FileText
            return (
              <li key={doc.id}>
                <Link
                  href={doc.href}
                  className="flex items-start gap-3 rounded-xl border border-rule/60 bg-paper/85 p-4 shadow-glass-xs hover:shadow-glass-sm transition-shadow"
                >
                  <div className="shrink-0 size-10 rounded-pill bg-cream-deep flex items-center justify-center">
                    <Icon className="size-4 text-ink-mute" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-ink truncate">
                        {doc.reference}
                      </span>
                      <Badge variant={doc.kind === 'facture' ? 'blue' : 'muted'}>
                        {doc.kind === 'facture' ? 'Facture' : 'Devis'}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-ink-mute">{formatDate(doc.date)}</div>
                    {doc.pdfPath ? (
                      <div className="text-[10px] font-mono uppercase tracking-wider text-ink-mute">
                        PDF disponible
                      </div>
                    ) : (
                      <div className="text-[10px] font-mono uppercase tracking-wider text-ink-ghost italic">
                        PDF non généré
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
