'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Building2, CheckCircle2, Lock, MapPin, Phone, Mail } from 'lucide-react'
import { useState } from 'react'

interface DiagRow {
  id: string
  display_name: string | null
  claim_status: string
}

interface Lead {
  id: string
  requester_first_name: string | null
  requester_last_name: string | null
  property_city: string | null
  property_postal_code: string | null
  property_type: string | null
  property_surface_m2: number | null
  diagnostics_requested: string[] | null
  created_at: string
  status: string
  unlocked: boolean
}

interface UnlockedDetail {
  requester_email?: string | null
  requester_phone?: string | null
  requester_last_name?: string | null
  property_address?: string | null
  message?: string | null
}

type Filter = 'all' | 'locked' | 'unlocked'

interface Props {
  leads: Lead[]
  diags: DiagRow[]
}

export function LeadsListClient({ leads, diags }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [unlockedDetail, setUnlockedDetail] = useState<UnlockedDetail | null>(null)
  const [quotaError, setQuotaError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const diag = diags[0] ?? null // V1 : un user = un diag

  const filtered = leads.filter((l) => {
    if (filter === 'locked') return !l.unlocked
    if (filter === 'unlocked') return l.unlocked
    return true
  })

  async function handleUnlock(lead: Lead) {
    if (!diag) return
    setBusy(true)
    setQuotaError(null)
    try {
      const res = await fetch(
        `/api/diagnosticians/${diag.id}/leads/${lead.id}/unlock`,
        { method: 'POST' },
      )
      if (res.status === 402) {
        const body = (await res.json()) as { message?: string }
        setQuotaError(body.message ?? 'Quota atteint.')
        return
      }
      if (!res.ok) {
        setQuotaError('Impossible de déverrouiller.')
        return
      }
      const body = (await res.json()) as { lead: UnlockedDetail }
      setUnlockedDetail(body.lead)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <FilterTab active={filter === 'all'} onClick={() => setFilter('all')}>
          Tous ({leads.length})
        </FilterTab>
        <FilterTab active={filter === 'locked'} onClick={() => setFilter('locked')}>
          Verrouillés ({leads.filter((l) => !l.unlocked).length})
        </FilterTab>
        <FilterTab active={filter === 'unlocked'} onClick={() => setFilter('unlocked')}>
          Déverrouillés ({leads.filter((l) => l.unlocked).length})
        </FilterTab>
      </div>

      {filtered.length === 0 ? (
        <Card variant="flat" padding="default" className="text-center py-12">
          <p className="text-ink-mute">Aucun lead {filter !== 'all' ? labelForFilter(filter) : ''}.</p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtered.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                onClick={() => {
                  setActiveLead(lead)
                  setUnlockedDetail(null)
                  setQuotaError(null)
                }}
                className="w-full text-left"
              >
                <Card
                  variant="flat"
                  padding="default"
                  className="hover:shadow-md transition cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`size-10 rounded-full flex items-center justify-center shrink-0 ${
                        lead.unlocked
                          ? 'bg-[#D4F542]/20 text-ink'
                          : 'bg-ink/5 text-ink-mute'
                      }`}
                      aria-hidden
                    >
                      {lead.unlocked ? (
                        <CheckCircle2 className="size-5" />
                      ) : (
                        <Lock className="size-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-ink">
                          {lead.requester_first_name ?? 'Prospect'}{' '}
                          {(lead.requester_last_name ?? '').charAt(0)}.
                        </p>
                        {lead.unlocked ? (
                          <Badge variant="green">Déverrouillé</Badge>
                        ) : (
                          <Badge variant="muted">Verrouillé</Badge>
                        )}
                      </div>
                      <p className="text-sm text-ink-mute flex items-center gap-1 mt-1">
                        <MapPin className="size-3.5" aria-hidden />
                        {lead.property_city ?? '—'}{' '}
                        {lead.property_postal_code ? `(${lead.property_postal_code})` : ''}
                      </p>
                      <p className="text-sm text-ink-mute flex items-center gap-1 mt-1">
                        <Building2 className="size-3.5" aria-hidden />
                        {labelForPropertyType(lead.property_type)}
                        {lead.property_surface_m2 ? ` · ${lead.property_surface_m2} m²` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(lead.diagnostics_requested ?? []).map((d) => (
                          <span
                            key={d}
                            className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-cream-deep text-ink-mute font-mono"
                          >
                            {d === 'erp' ? 'ERP' : d}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="text-xs text-ink-faint shrink-0 mt-1">
                      {timeAgo(lead.created_at)}
                    </span>
                  </div>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={activeLead !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveLead(null)
            setUnlockedDetail(null)
            setQuotaError(null)
          }
        }}
      >
        <DialogContent>
          {activeLead ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {activeLead.requester_first_name ?? 'Prospect'}{' '}
                  {(activeLead.requester_last_name ?? '').charAt(0)}.
                </DialogTitle>
                <DialogDescription>
                  {labelForPropertyType(activeLead.property_type)}
                  {activeLead.property_surface_m2
                    ? ` · ${activeLead.property_surface_m2} m²`
                    : ''}{' '}
                  · {activeLead.property_city ?? '—'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="flex flex-wrap gap-1.5">
                  {(activeLead.diagnostics_requested ?? []).map((d) => (
                    <span
                      key={d}
                      className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-cream-deep text-ink-mute font-mono"
                    >
                      {d === 'erp' ? 'ERP' : d}
                    </span>
                  ))}
                </div>

                {activeLead.unlocked || unlockedDetail ? (
                  <UnlockedView lead={activeLead} detail={unlockedDetail} />
                ) : (
                  <LockedView
                    onUnlock={() => handleUnlock(activeLead)}
                    busy={busy}
                    quotaError={quotaError}
                  />
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function LockedView({
  onUnlock,
  busy,
  quotaError,
}: {
  onUnlock: () => void
  busy: boolean
  quotaError: string | null
}) {
  if (quotaError) {
    return (
      <div className="rounded-2xl bg-coral-mist/40 border border-coral-mist p-5">
        <p className="font-semibold text-[#8B1414]">Quota atteint</p>
        <p className="text-sm text-ink-mute mt-2">{quotaError}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/pricing/checkout?plan=pro"
            className="inline-block rounded-pill bg-chartreuse text-ink font-semibold px-5 py-2 text-sm hover:bg-chartreuse-deep transition"
          >
            Démarrer mon essai Pro
          </a>
          <a
            href="/dashboard/account/subscription"
            className="inline-block rounded-pill bg-paper border border-rule/60 text-ink font-medium px-5 py-2 text-sm hover:bg-paper-soft transition"
          >
            Voir mon abonnement
          </a>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-ink/5 p-5 text-center space-y-3">
      <Lock className="size-6 mx-auto text-ink-mute" aria-hidden />
      <p className="font-semibold text-ink">Coordonnées verrouillées</p>
      <p className="text-sm text-ink-mute">
        Déverrouillez pour voir le téléphone et l&apos;email de ce prospect.
      </p>
      <Button onClick={onUnlock} disabled={busy} variant="accent">
        {busy ? 'Déverrouillage…' : 'Déverrouiller (1 unlock)'}
      </Button>
    </div>
  )
}

function UnlockedView({
  lead,
  detail,
}: {
  lead: Lead
  detail: UnlockedDetail | null
}) {
  const fullLastName = detail?.requester_last_name ?? lead.requester_last_name
  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-lime-mist/40 border border-lime-mist p-4">
        <p className="text-xs uppercase tracking-wide text-[#2D4015] font-mono mb-2">
          Coordonnées
        </p>
        <p className="font-semibold text-ink">
          {lead.requester_first_name ?? 'Prospect'} {fullLastName ?? ''}
        </p>
        {detail?.requester_phone ? (
          <a
            href={`tel:${detail.requester_phone}`}
            className="flex items-center gap-2 mt-2 text-sm text-ink hover:underline"
          >
            <Phone className="size-4" aria-hidden />
            {detail.requester_phone}
          </a>
        ) : null}
        {detail?.requester_email ? (
          <a
            href={`mailto:${detail.requester_email}`}
            className="flex items-center gap-2 mt-1 text-sm text-ink hover:underline"
          >
            <Mail className="size-4" aria-hidden />
            {detail.requester_email}
          </a>
        ) : null}
        {detail?.property_address ? (
          <p className="flex items-center gap-2 mt-1 text-sm text-ink-mute">
            <MapPin className="size-4" aria-hidden />
            {detail.property_address}
          </p>
        ) : null}
      </div>
      {detail?.message ? (
        <div className="rounded-2xl bg-paper border border-rule p-4">
          <p className="text-xs uppercase tracking-wide text-ink-mute font-mono mb-2">
            Message
          </p>
          <p className="text-sm text-ink leading-relaxed">{detail.message}</p>
        </div>
      ) : null}
    </div>
  )
}

function FilterTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-pill bg-navy text-paper px-4 py-1.5 text-sm font-medium'
          : 'rounded-pill bg-paper border border-rule text-ink-mute px-4 py-1.5 text-sm hover:text-ink transition'
      }
    >
      {children}
    </button>
  )
}

function labelForFilter(f: Filter): string {
  switch (f) {
    case 'locked':
      return 'verrouillé'
    case 'unlocked':
      return 'déverrouillé'
    default:
      return ''
  }
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
