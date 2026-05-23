'use client'

import {
  approveAllPhasesAction,
  grantVerifiedPlusAction,
  rejectPhaseAction,
  rerunAutomatedVerificationAction,
  suspendDiagnosticianAction,
} from '@/app/admin/(gated)/verifications/actions'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ShieldCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Modal de review d'un diagnostiqueur en attente de vérification.
 *
 * 4 phases (identité / COFRAC / RC Pro / SIRENE) + signalements + actions admin.
 * Server actions :
 *   - Approve all                 → approveAllPhasesAction
 *   - Reject phase X with reason  → rejectPhaseAction
 *   - Re-run verify-X             → rerunAutomatedVerificationAction
 *   - Grant Vérifié+              → grantVerifiedPlusAction
 *   - Suspend                     → suspendDiagnosticianAction
 *
 * Brand v5 strict : navy + sage + chartreuse.
 */

interface PhaseDetail {
  status: string | null
  rejectionReason?: string | null
  verifiedAt?: string | null
  fields?: Record<string, string | number | null>
}

interface CheckLogEntry {
  id: string
  checkType: string
  checkSource: string
  status: string
  performedAt: string
  resultSummary?: string
}

interface SignalementEntry {
  id: string
  reason: string
  description: string | null
  status: string
  createdAt: string
}

export interface VerificationReviewModalProps {
  diagId: string
  fullName: string
  city: string | null
  email: string | null
  overallStatus: string | null
  badgeLevel: string | null
  signalementsCount: number
  identity: PhaseDetail
  cofrac: PhaseDetail
  rcpro: PhaseDetail
  sirene: PhaseDetail
  history: CheckLogEntry[]
  signalements: SignalementEntry[]
  onClose: () => void
}

function statusColor(status: string | null | undefined): string {
  switch (status) {
    case 'verified':
      return 'bg-lime-mist text-[#2D4015] border border-[#2D4015]/20'
    case 'rejected':
    case 'suspended':
    case 'radiated':
    case 'liquidation':
      return 'bg-coral-mist text-[#8B1414] border border-[#8B1414]/20'
    case 'expired':
      return 'bg-orange-mist text-[#7C3F0A] border border-[#7C3F0A]/20'
    case 'in_review':
      return 'bg-blue-mist text-[#1E3A8A] border border-[#1E3A8A]/20'
    default:
      return 'bg-cream-deep text-ink-mute border border-rule'
  }
}

function PhaseBlock({
  label,
  phase,
  detail,
  diagId,
}: {
  label: string
  phase: 'identity' | 'cofrac' | 'rcpro' | 'sirene'
  detail: PhaseDetail
  diagId: string
}) {
  const [showReject, setShowReject] = useState(false)
  return (
    <div className="rounded-lg border border-rule bg-paper p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-ink">{label}</h3>
        <span
          className={cn(
            'inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-display font-semibold',
            statusColor(detail.status),
          )}
        >
          {detail.status ?? 'pending'}
        </span>
      </div>

      {detail.fields ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] mb-3">
          {Object.entries(detail.fields).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-mute font-mono text-[10px] uppercase tracking-wider">{k}</dt>
              <dd className="text-ink">{v ?? '—'}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {detail.rejectionReason ? (
        <p className="text-[12px] text-coral-mist-foreground bg-coral-mist/40 rounded-md p-2 mb-3">
          <span className="font-semibold">Raison rejet :</span> {detail.rejectionReason}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <form action={rerunAutomatedVerificationAction}>
          <input type="hidden" name="diagId" value={diagId} />
          <input type="hidden" name="phase" value={phase} />
          <Button type="submit" variant="outline" size="sm">
            Relancer la vérification
          </Button>
        </form>
        {!showReject ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowReject(true)}
            className="text-danger hover:text-danger"
          >
            Rejeter cette phase
          </Button>
        ) : null}
      </div>

      {showReject ? (
        <form action={rejectPhaseAction} className="mt-3 space-y-2 border-t border-rule pt-3">
          <input type="hidden" name="diagId" value={diagId} />
          <input type="hidden" name="phase" value={phase} />
          <textarea
            name="reason"
            required
            minLength={5}
            placeholder="Motif du rejet (visible par le diagnostiqueur)"
            className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-[13px] text-ink"
            rows={2}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="destructive" size="sm">
              Confirmer le rejet
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowReject(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

export function VerificationReviewModal({
  diagId,
  fullName,
  city,
  email,
  overallStatus,
  badgeLevel,
  signalementsCount,
  identity,
  cofrac,
  rcpro,
  sirene,
  history,
  signalements,
  onClose,
}: VerificationReviewModalProps) {
  const [showSuspend, setShowSuspend] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Escape close handled by useEffect ci-dessus. Backdrop click via dedicated button.
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto">
      <button
        type="button"
        aria-label="Fermer la fenêtre"
        onClick={onClose}
        className="fixed inset-0 z-0 bg-ink/40 backdrop-blur-sm cursor-default"
      />
      <div
        className="relative z-10 w-full max-w-3xl bg-paper rounded-xl shadow-2xl my-auto"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-rule">
          <div>
            <h2 className="text-xl font-display font-bold text-ink">{fullName}</h2>
            <p className="text-sm text-ink-mute mt-0.5">
              {city ?? 'Ville inconnue'}
              {email ? ` · ${email}` : ''}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span
                className={cn(
                  'inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-display font-semibold',
                  statusColor(overallStatus),
                )}
              >
                {overallStatus ?? 'pending'}
              </span>
              {badgeLevel && badgeLevel !== 'unverified' ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-navy text-paper px-2.5 py-0.5 text-[11px] font-display font-semibold">
                  <ShieldCheck className="size-3" aria-hidden />
                  {badgeLevel === 'verified_plus' ? 'Vérifié+' : 'Vérifié'}
                </span>
              ) : null}
              {signalementsCount > 0 ? (
                <span className="inline-flex items-center rounded-pill bg-coral-mist text-[#8B1414] px-2.5 py-0.5 text-[11px] font-display font-semibold">
                  {signalementsCount} signalement{signalementsCount > 1 ? 's' : ''}
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-md p-1.5 text-ink-mute hover:text-ink hover:bg-cream-deep transition-colors"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <PhaseBlock
            label="Phase 1 — Identité civile"
            phase="identity"
            detail={identity}
            diagId={diagId}
          />
          <PhaseBlock
            label="Phase 2 — Certification COFRAC"
            phase="cofrac"
            detail={cofrac}
            diagId={diagId}
          />
          <PhaseBlock label="Phase 3 — RC Pro" phase="rcpro" detail={rcpro} diagId={diagId} />
          <PhaseBlock
            label="Phase 4 — Entreprise SIRENE"
            phase="sirene"
            detail={sirene}
            diagId={diagId}
          />

          {/* Signalements */}
          {signalements.length > 0 ? (
            <div className="rounded-lg border border-rule bg-paper p-4">
              <h3 className="text-[14px] font-semibold text-ink mb-3">
                Signalements ({signalements.length})
              </h3>
              <ul className="space-y-2">
                {signalements.map((s) => (
                  <li
                    key={s.id}
                    className="border-l-2 border-coral-mist-foreground pl-3 py-1 text-[12px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">{s.reason}</span>
                      <span className="text-ink-faint font-mono text-[10px]">
                        {new Date(s.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    {s.description ? <p className="text-ink-mute mt-0.5">{s.description}</p> : null}
                    <p className="text-ink-faint text-[10px] mt-0.5">Statut : {s.status}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Historique */}
          {history.length > 0 ? (
            <div className="rounded-lg border border-rule bg-paper p-4">
              <h3 className="text-[14px] font-semibold text-ink mb-3">
                Historique des vérifications
              </h3>
              <ul className="space-y-1.5">
                {history.slice(0, 10).map((h) => (
                  <li
                    key={h.id}
                    className="flex items-center justify-between text-[12px] py-1 border-b border-rule/50 last:border-0"
                  >
                    <span className="font-mono text-[10px] text-ink-mute">
                      {new Date(h.performedAt).toLocaleDateString('fr-FR')}
                    </span>
                    <span className="text-ink">{h.checkType}</span>
                    <span className="text-ink-faint">{h.checkSource}</span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-display font-semibold',
                        h.status === 'success'
                          ? 'bg-lime-mist text-[#2D4015]'
                          : h.status === 'warning'
                            ? 'bg-orange-mist text-[#7C3F0A]'
                            : 'bg-coral-mist text-[#8B1414]',
                      )}
                    >
                      {h.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-rule bg-sage/50 rounded-b-xl">
          <div className="flex flex-wrap gap-2">
            <form action={approveAllPhasesAction}>
              <input type="hidden" name="diagId" value={diagId} />
              <Button type="submit" variant="default" size="sm">
                Approuver toutes les phases
              </Button>
            </form>

            {overallStatus === 'verified' && badgeLevel !== 'verified_plus' ? (
              <form action={grantVerifiedPlusAction}>
                <input type="hidden" name="diagId" value={diagId} />
                <Button type="submit" variant="accent" size="sm">
                  Octroyer Vérifié+
                </Button>
              </form>
            ) : null}

            {!showSuspend ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowSuspend(true)}
                className="text-danger hover:text-danger"
              >
                Suspendre
              </Button>
            ) : null}

            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Fermer
            </Button>
          </div>

          {showSuspend ? (
            <form action={suspendDiagnosticianAction} className="mt-4 space-y-2">
              <input type="hidden" name="diagId" value={diagId} />
              <textarea
                name="reason"
                required
                minLength={10}
                placeholder="Motif de suspension (audit interne)"
                className="w-full rounded-md border border-rule bg-paper px-3 py-2 text-[13px] text-ink"
                rows={2}
              />
              <div className="flex gap-2">
                <Button type="submit" variant="destructive" size="sm">
                  Confirmer la suspension
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSuspend(false)}
                >
                  Annuler
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  )
}
