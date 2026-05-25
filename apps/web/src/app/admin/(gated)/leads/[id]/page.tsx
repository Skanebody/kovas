/**
 * /admin/leads/[id] — Détail d'un lead assignment + audit intent scoring.
 *
 * Affiche :
 *   - Données du quote_request (demandeur, bien, diagnostics)
 *   - Score d'intent A1.3.5 avec breakdown signal par signal (audit transparent)
 *   - Routing strategy + acceptance_count
 *   - Liens vers le diagnostiqueur destinataire (si subscribed_nearby)
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §6.3 (Game Changer 3 — audit du scoring
 * pour comprendre / calibrer les pondérations en production).
 */

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Détail lead — Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface IntentSignal {
  code: string
  label: string
  points: number
  detail: string
}

type IntentBucket = 'spam' | 'low' | 'mid' | 'high' | 'premium'

interface QuoteRequestRow {
  id: string
  requester_first_name: string | null
  requester_last_name: string | null
  requester_email: string | null
  requester_phone: string | null
  property_type: string | null
  property_situation: string | null
  property_address: string | null
  property_postal_code: string | null
  property_city: string | null
  property_surface_m2: number | null
  property_year_built: number | null
  diagnostics_requested: string[] | null
  diagnostics_suggested: unknown
  message: string | null
  status: string
  intent_score: number | null
  intent_bucket: IntentBucket | null
  intent_signals: unknown
  intent_scored_at: string | null
  created_at: string
}

interface AssignmentRow {
  id: string
  quote_request_id: string
  routing_strategy: string | null
  acceptance_count: number | null
  assigned_count: number | null
  closed_at: string | null
  created_at: string | null
}

function isSignal(v: unknown): v is IntentSignal {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.code === 'string' &&
    typeof o.label === 'string' &&
    typeof o.points === 'number' &&
    typeof o.detail === 'string'
  )
}

function safeSignals(v: unknown): IntentSignal[] {
  if (!Array.isArray(v)) return []
  return v.filter(isSignal)
}

const BUCKET_VARIANT: Record<IntentBucket, 'green' | 'blue' | 'yellow' | 'muted' | 'red'> = {
  premium: 'green',
  high: 'blue',
  mid: 'yellow',
  low: 'muted',
  spam: 'red',
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: assignmentId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(assignmentId)) {
    notFound()
  }

  const supabase = createAdminClient()

  // 1. Charge l'assignment
  // biome-ignore lint/suspicious/noExplicitAny: lead_assignments pas dans Database.types
  const { data: assignmentRaw } = await (supabase as any)
    .from('lead_assignments')
    .select(
      'id, quote_request_id, routing_strategy, acceptance_count, assigned_count, closed_at, created_at',
    )
    .eq('id', assignmentId)
    .maybeSingle()

  const assignment = (assignmentRaw ?? null) as AssignmentRow | null
  if (!assignment) {
    notFound()
  }

  // 2. Charge le quote_request lié
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data: leadRaw } = await (supabase as any)
    .from('quote_requests')
    .select(
      'id, requester_first_name, requester_last_name, requester_email, requester_phone, property_type, property_situation, property_address, property_postal_code, property_city, property_surface_m2, property_year_built, diagnostics_requested, diagnostics_suggested, message, status, intent_score, intent_bucket, intent_signals, intent_scored_at, created_at',
    )
    .eq('id', assignment.quote_request_id)
    .maybeSingle()

  const lead = (leadRaw ?? null) as QuoteRequestRow | null
  if (!lead) {
    notFound()
  }

  const signals = safeSignals(lead.intent_signals)
  const totalPoints = signals.reduce((acc, s) => acc + s.points, 0)

  return (
    <div className="space-y-6 animate-fade-in motion-reduce:animate-none">
      <div>
        <Link
          href="/admin/leads/queue"
          className="inline-flex items-center gap-1.5 text-[12px] text-ink-mute hover:text-ink"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Retour à la queue
        </Link>
      </div>

      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Admin · Lead
        </p>
        <h1 className="font-sans font-light text-3xl tracking-tight text-ink">
          Détail <span className="font-serif italic font-normal">{lead.id.slice(0, 8)}</span>
          <span className="text-ink-mute">.</span>
        </h1>
        <p className="text-sm text-ink-mute">
          Créé {formatDateTime(lead.created_at)} · Status{' '}
          <Badge variant="muted">{lead.status}</Badge>
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score d'intent — colonne principale */}
        <Card variant="opaque" padding="default" className="lg:col-span-2 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                Score d&apos;intent (A1.3.5)
              </p>
              <p
                className="font-serif italic font-normal text-ink leading-none mt-2"
                style={{ fontSize: 'clamp(56px, 6vw, 88px)' }}
              >
                {lead.intent_score ?? '—'}
                {lead.intent_score != null ? (
                  <span className="text-ink-mute text-[24px]"> / 100</span>
                ) : null}
              </p>
              {lead.intent_bucket ? (
                <p className="mt-2">
                  <Badge variant={BUCKET_VARIANT[lead.intent_bucket]}>
                    Bucket : {lead.intent_bucket}
                  </Badge>
                </p>
              ) : null}
            </div>
            <p className="text-[11px] text-ink-mute">
              Scoré {formatDateTime(lead.intent_scored_at)}
            </p>
          </div>

          {signals.length > 0 ? (
            <div className="space-y-2 mt-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
                Breakdown signal par signal ({totalPoints} pts cumulés)
              </p>
              <ul className="space-y-1.5">
                {signals.map((s) => (
                  <li
                    key={s.code}
                    className="flex items-start justify-between gap-3 rounded-md border border-rule/60 bg-paper px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink">{s.label}</p>
                      <p className="text-[11px] text-ink-mute mt-0.5">{s.detail}</p>
                    </div>
                    <p className="font-mono text-[13px] font-semibold text-ink shrink-0">
                      +{s.points}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[12px] text-ink-mute italic">
              Aucun breakdown disponible — lead créé avant déploiement A1.3.5 ou échec scoring.
            </p>
          )}
        </Card>

        {/* Routing + demandeur */}
        <div className="space-y-4">
          <Card variant="opaque" padding="default" className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
              Routing
            </p>
            <dl className="space-y-1.5 text-[13px]">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-mute">Stratégie</dt>
                <dd className="text-ink">{assignment.routing_strategy ?? 'none'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-mute">Assigné</dt>
                <dd className="text-ink">{assignment.assigned_count ?? 0} diag</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-mute">Accepté</dt>
                <dd className="text-ink">{assignment.acceptance_count ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-mute">Status</dt>
                <dd className="text-ink">
                  {assignment.closed_at ? (
                    <Badge variant="muted">Clôturé</Badge>
                  ) : (
                    <Badge variant="green">Ouvert</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card variant="opaque" padding="default" className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
              Demandeur
            </p>
            <dl className="space-y-1.5 text-[13px]">
              <div>
                <dt className="text-ink-mute text-[11px]">Nom</dt>
                <dd className="text-ink">
                  {lead.requester_first_name} {lead.requester_last_name}
                </dd>
              </div>
              <div>
                <dt className="text-ink-mute text-[11px]">Email</dt>
                <dd className="text-ink font-mono text-[12px]">{lead.requester_email}</dd>
              </div>
              {lead.requester_phone ? (
                <div>
                  <dt className="text-ink-mute text-[11px]">Téléphone</dt>
                  <dd className="text-ink font-mono text-[12px]">{lead.requester_phone}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>
      </div>

      <Card variant="opaque" padding="default" className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">Bien</p>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[13px]">
          <div>
            <dt className="text-ink-mute text-[11px]">Situation</dt>
            <dd className="text-ink">{lead.property_situation}</dd>
          </div>
          <div>
            <dt className="text-ink-mute text-[11px]">Type</dt>
            <dd className="text-ink">{lead.property_type}</dd>
          </div>
          <div>
            <dt className="text-ink-mute text-[11px]">Surface</dt>
            <dd className="text-ink">{lead.property_surface_m2 ?? '—'} m²</dd>
          </div>
          <div>
            <dt className="text-ink-mute text-[11px]">Année</dt>
            <dd className="text-ink">{lead.property_year_built ?? '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-ink-mute text-[11px]">Adresse</dt>
            <dd className="text-ink">
              {[lead.property_address, lead.property_postal_code, lead.property_city]
                .filter(Boolean)
                .join(' ')}
            </dd>
          </div>
          <div className="col-span-2 md:col-span-3">
            <dt className="text-ink-mute text-[11px]">Diagnostics demandés</dt>
            <dd className="text-ink flex flex-wrap gap-1.5 mt-1">
              {(lead.diagnostics_requested ?? []).length > 0 ? (
                (lead.diagnostics_requested ?? []).map((d) => (
                  <Badge key={d} variant="muted">
                    {d}
                  </Badge>
                ))
              ) : (
                <span className="text-ink-mute">—</span>
              )}
            </dd>
          </div>
          {lead.message ? (
            <div className="col-span-2 md:col-span-3">
              <dt className="text-ink-mute text-[11px]">Message</dt>
              <dd className="text-ink whitespace-pre-wrap">{lead.message}</dd>
            </div>
          ) : null}
        </dl>
      </Card>
    </div>
  )
}
