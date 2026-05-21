/**
 * /app/veille/[documentId] — Détail d'un document réglementaire.
 *
 * Server component. Affiche :
 *   - Header : titre, source, dates, lien texte source
 *   - Résumé IA (markdown via FaqAnswer)
 *   - Modules affectés
 *   - Actions appliquées (system_auto_updates rattachées)
 *   - Discussion communauté (placeholder V1, recherche par topics)
 *   - Sidebar : autres docs liés
 */

import { FaqAnswer } from '@/components/faq-answer'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  CHANGE_TYPE_LABEL,
  DOC_TYPE_LABEL,
  IMPORTANCE_BADGE,
  IMPORTANCE_LABEL,
  MODULE_LABEL,
  STATUS_BADGE,
  STATUS_LABEL,
  type AutoUpdateStatus,
  type RegulatoryDocType,
  type RegulatoryDocumentDetail,
  type RegulatoryImportance,
  type RegulatoryModule,
} from '@/lib/regulatory/types'
import { ChevronLeft, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Document réglementaire',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PageProps {
  params: Promise<{ documentId: string }>
}

interface RawDetail {
  id: string
  doc_type: string
  title: string
  url: string
  published_at: string | null
  effective_at: string | null
  ai_summary: string | null
  topics: string[] | null
  diagnostic_kinds: string[] | null
  applies_to: string[] | null
  importance: string
  is_superseded: boolean
  processed_at: string | null
  raw_text: string
  jurisdiction: string
  created_at: string
  regulatory_sources:
    | { id: string; name: string; authority: string }
    | { id: string; name: string; authority: string }[]
    | null
}

interface RelatedDocRow {
  id: string
  title: string
  doc_type: string
  published_at: string | null
  importance: string
}

interface AutoUpdateRowLite {
  id: string
  title: string
  status: AutoUpdateStatus
  change_type: string
  affected_areas: string[] | null
  applied_at: string | null
  summary: string
}

interface NotifUpdateBuilder {
  update: (patch: { read_at: string }) => {
    eq: (col: string, val: string) => {
      eq: (col: string, val: string) => {
        is: (col: string, val: null) => Promise<{ error: { message: string } | null }>
      }
    }
  }
}

function unwrapSource(
  value:
    | { id: string; name: string; authority: string }
    | { id: string; name: string; authority: string }[]
    | null,
): { id: string; name: string; authority: string } | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function moduleLabel(topic: string): string {
  return (MODULE_LABEL as Record<string, string>)[topic] ?? topic
}

export default async function VeilleDocumentPage({ params }: PageProps) {
  const { documentId } = await params
  if (!documentId) notFound()

  const { supabase, user } = await getCurrentUser()

  // 1. Document
  const { data, error } = await supabase
    .from('regulatory_documents')
    .select(
      'id, doc_type, title, url, published_at, effective_at, ai_summary, topics, diagnostic_kinds, applies_to, importance, is_superseded, processed_at, raw_text, jurisdiction, created_at, regulatory_sources:regulatory_sources!source_id ( id, name, authority )',
    )
    .eq('id', documentId)
    .maybeSingle()
  if (error || !data) notFound()
  const raw = data as unknown as RawDetail
  const doc: RegulatoryDocumentDetail = {
    id: raw.id,
    doc_type: raw.doc_type as RegulatoryDocType,
    title: raw.title,
    url: raw.url,
    published_at: raw.published_at,
    effective_at: raw.effective_at,
    ai_summary: raw.ai_summary,
    topics: raw.topics ?? [],
    diagnostic_kinds: raw.diagnostic_kinds ?? [],
    applies_to: raw.applies_to ?? [],
    importance: raw.importance as RegulatoryImportance,
    is_superseded: raw.is_superseded,
    processed_at: raw.processed_at,
    raw_text: raw.raw_text,
    jurisdiction: raw.jurisdiction,
    created_at: raw.created_at,
    source: unwrapSource(raw.regulatory_sources),
  }

  // 2. Actions appliquées (system_auto_updates)
  const { data: autoUpdatesData } = await supabase
    .from('system_auto_updates')
    .select('id, title, status, change_type, affected_areas, applied_at, summary')
    .eq('triggered_by_doc_id', documentId)
    .order('created_at', { ascending: false })
  const autoUpdates: AutoUpdateRowLite[] = (autoUpdatesData ?? []) as unknown as AutoUpdateRowLite[]

  // 3. Documents liés (overlap topics, hors lui-même, 5 max)
  let relatedDocs: RelatedDocRow[] = []
  if (doc.topics.length > 0) {
    const { data: relatedData } = await supabase
      .from('regulatory_documents')
      .select('id, title, doc_type, published_at, importance')
      .neq('id', documentId)
      .eq('is_superseded', false)
      .overlaps('topics', doc.topics)
      .order('published_at', { ascending: false })
      .limit(5)
    relatedDocs = (relatedData ?? []) as unknown as RelatedDocRow[]
  }

  // 4. Mark-as-read pour ce user (best effort, silent on error).
  try {
    const builder = supabase.from('regulatory_notifications') as unknown as NotifUpdateBuilder
    await builder
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('document_id', documentId)
      .is('read_at', null)
  } catch {
    // silencieux
  }

  const moduleTopics = doc.topics.filter((t): t is RegulatoryModule =>
    (['dpe', 'amiante', 'plomb', 'gaz', 'electricite', 'termites', 'carrez', 'erp'] as string[]).includes(t),
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full">
      <Link
        href="/dashboard/veille"
        className="inline-flex items-center gap-1 text-[12px] text-ink-mute hover:text-ink"
      >
        <ChevronLeft className="size-3.5" /> Retour à la veille
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="space-y-6 min-w-0">
          {/* Header */}
          <header className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-faint">
                {DOC_TYPE_LABEL[doc.doc_type]}
              </span>
              {doc.source && (
                <Badge variant="outline" className="text-[10px]">
                  {doc.source.name}
                </Badge>
              )}
              <Badge variant={IMPORTANCE_BADGE[doc.importance]}>
                Importance · {IMPORTANCE_LABEL[doc.importance]}
              </Badge>
            </div>
            <h1 className="font-serif italic font-normal text-3xl md:text-4xl tracking-tight text-ink leading-[1.1]">
              {doc.title}
            </h1>
            <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[12px] text-ink-mute">
              <div>
                <dt className="inline font-mono uppercase tracking-[0.14em] text-ink-faint mr-1">
                  Publié :
                </dt>
                <dd className="inline text-ink">{formatDate(doc.published_at)}</dd>
              </div>
              <div>
                <dt className="inline font-mono uppercase tracking-[0.14em] text-ink-faint mr-1">
                  Entrée en vigueur :
                </dt>
                <dd className="inline text-ink">{formatDate(doc.effective_at)}</dd>
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-ink hover:underline"
              >
                Texte source <ExternalLink className="size-3" />
              </a>
            </dl>
          </header>

          {/* Résumé IA */}
          {doc.ai_summary && (
            <Card variant="flat" padding="default">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-3">
                Résumé IA · Analyse d'impact
              </p>
              <FaqAnswer markdown={doc.ai_summary} />
            </Card>
          )}

          {/* Modules + applies_to */}
          {(moduleTopics.length > 0 || doc.applies_to.length > 0) && (
            <Card variant="flat" padding="default">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-3">
                Périmètre
              </p>
              {moduleTopics.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] text-ink-mute mb-1.5">Modules affectés</p>
                  <div className="flex flex-wrap gap-1.5">
                    {moduleTopics.map((m) => (
                      <Badge key={m} variant="blue" className="text-[11px]">
                        {moduleLabel(m)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {doc.applies_to.length > 0 && (
                <div>
                  <p className="text-[11px] text-ink-mute mb-1.5">Concerne</p>
                  <div className="flex flex-wrap gap-1.5">
                    {doc.applies_to.map((a) => (
                      <Badge key={a} variant="outline" className="text-[11px]">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Actions appliquées */}
          {autoUpdates.length > 0 && (
            <Card variant="flat" padding="default">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-3">
                Actions appliquées dans KOVAS
              </p>
              <ul className="space-y-3">
                {autoUpdates.map((u) => (
                  <li
                    key={u.id}
                    className="rounded-lg border border-rule p-3 flex items-start gap-3"
                  >
                    <Badge variant={STATUS_BADGE[u.status]} className="shrink-0">
                      {STATUS_LABEL[u.status]}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink leading-snug">
                        {u.title}
                      </p>
                      <p className="text-[12px] text-ink-mute mt-1 leading-relaxed line-clamp-2">
                        {u.summary}
                      </p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint mt-1.5">
                        {(CHANGE_TYPE_LABEL as Record<string, string>)[u.change_type] ??
                          u.change_type}
                        {u.applied_at ? ` · Appliquée le ${formatDate(u.applied_at)}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Discussion communauté (placeholder V1) */}
          <Card variant="flat" padding="default">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-2">
              Discussion communauté
            </p>
            <p className="text-[12px] text-ink-mute">
              Les retours de la communauté KOVAS sur ce sujet apparaîtront ici prochainement.
            </p>
          </Card>
        </article>

        {/* Sidebar : autres docs liés */}
        <aside className="space-y-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint mb-2">
              Documents liés
            </p>
            {relatedDocs.length === 0 ? (
              <Card variant="flat" padding="sm">
                <p className="text-[12px] text-ink-mute">Aucun document lié.</p>
              </Card>
            ) : (
              <ul className="space-y-2">
                {relatedDocs.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/dashboard/veille/${r.id}`}
                      className="block focus:outline-none focus-visible:ring-4 focus-visible:ring-navy/15 rounded-lg"
                    >
                      <Card
                        variant="flat"
                        padding="sm"
                        className="hover:-translate-y-px transition-transform duration-fast"
                      >
                        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                          {(DOC_TYPE_LABEL as Record<string, string>)[r.doc_type] ?? r.doc_type}
                        </span>
                        <p className="text-[12px] font-semibold text-ink leading-snug mt-1 line-clamp-3">
                          {r.title}
                        </p>
                        <p className="text-[11px] text-ink-mute mt-1">
                          {formatDate(r.published_at)}
                        </p>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
