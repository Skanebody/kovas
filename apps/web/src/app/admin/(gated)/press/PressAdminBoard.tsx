'use client'

/**
 * KOVAS — Admin presse : board client interactif.
 *
 * Affiche les KPI + tableau communiqués + actions (générer, approuver,
 * diffuser, archiver). Ton sobre, V5 sage.
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, FileText, Loader2, Send, Sparkles } from 'lucide-react'
import { useState, useTransition } from 'react'
import {
  approvePressRelease,
  archivePressRelease,
  dispatchPressRelease,
  triggerPressReleaseDraft,
} from './actions'
import type { PressAdminSummary, PressReleaseAdminRow } from './page'

interface Props {
  releases: PressReleaseAdminRow[]
  summary: PressAdminSummary
}

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const STATUS_LABEL: Record<PressReleaseAdminRow['status'], string> = {
  draft: 'Brouillon',
  pending_review: 'À relire',
  approved: 'Approuvé',
  sent: 'Diffusé',
  archived: 'Archivé',
}

const STATUS_BADGE: Record<PressReleaseAdminRow['status'], string> = {
  draft: 'bg-pastel-butter text-[#0F1419]',
  pending_review: 'bg-pastel-butter text-[#0F1419]',
  approved: 'bg-pastel-lime text-[#0F1419]',
  sent: 'bg-pastel-sky text-[#0F1419]',
  archived: 'bg-[#0F1419]/[0.04] text-[#0F1419]/55',
}

export function PressAdminBoard({ releases, summary }: Props): React.ReactElement {
  const [pending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; message: string } | null>(null)

  function showToast(kind: 'ok' | 'err', message: string): void {
    setToast({ kind, message })
    setTimeout(() => setToast(null), 6000)
  }

  function handleGenerate(): void {
    startTransition(async () => {
      const res = await triggerPressReleaseDraft()
      if (res.ok) {
        showToast('ok', 'Brouillon généré. Rechargez la page pour le voir.')
      } else {
        showToast('err', res.error ?? 'Échec génération')
      }
    })
  }

  function handleApprove(id: string): void {
    startTransition(async () => {
      const res = await approvePressRelease(id)
      showToast(res.ok ? 'ok' : 'err', res.ok ? 'Communiqué approuvé.' : (res.error ?? 'Échec'))
    })
  }

  function handleDispatch(id: string, title: string): void {
    const confirmed = window.confirm(
      `Confirmer la diffusion de « ${title} » à tous les contacts presse opt-in (${summary.activeContacts}) ?\n\nCette action est irréversible.`,
    )
    if (!confirmed) return
    startTransition(async () => {
      const res = await dispatchPressRelease(id)
      if (res.ok) {
        showToast(
          'ok',
          `Diffusé à ${res.sent ?? 0} contact(s) (${res.failed ?? 0} échec(s)). Rechargez pour voir le statut.`,
        )
      } else {
        showToast('err', res.error ?? 'Échec diffusion')
      }
    })
  }

  function handleArchive(id: string): void {
    if (!window.confirm('Archiver ce communiqué ?')) return
    startTransition(async () => {
      const res = await archivePressRelease(id)
      showToast(res.ok ? 'ok' : 'err', res.ok ? 'Archivé.' : (res.error ?? 'Échec'))
    })
  }

  return (
    <div className="space-y-8 animate-fade-in motion-reduce:animate-none">
      <header className="space-y-3">
        <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
          Admin — Presse
        </p>
        <h1 className="font-sans font-medium tracking-tight text-3xl text-[#0F1419] leading-tight">
          <span className="font-serif italic font-normal">Communiqués</span> et diffusion.
        </h1>
        <p className="text-sm text-[#0F1419]/72 max-w-2xl">
          Génération mensuelle automatique adossée à l&apos;Observatoire. Diffusion manuelle aux
          contacts presse opt-in après votre relecture.
        </p>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="opaque" padding="default">
          <p className="font-mono uppercase tracking-wider text-[10px] text-[#0F1419]/55">
            Contacts presse opt-in
          </p>
          <p
            className="font-serif italic font-normal text-[#0F1419] leading-none mt-2"
            style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}
          >
            {summary.activeContacts}
          </p>
        </Card>
        <Card variant="opaque" padding="default">
          <p className="font-mono uppercase tracking-wider text-[10px] text-[#0F1419]/55">
            Communiqués diffusés
          </p>
          <p
            className="font-serif italic font-normal text-[#0F1419] leading-none mt-2"
            style={{ fontSize: 'clamp(36px, 4vw, 56px)' }}
          >
            {summary.totalReleasesSent}
          </p>
        </Card>
        <Card variant="opaque" padding="default">
          <p className="font-mono uppercase tracking-wider text-[10px] text-[#0F1419]/55">
            Dernier envoi
          </p>
          <p className="text-base font-semibold text-[#0F1419] mt-2">
            {summary.lastSentAt ? formatDateFr(summary.lastSentAt) : 'Jamais'}
          </p>
        </Card>
      </section>

      {/* Actions */}
      <section className="flex flex-wrap items-center gap-3">
        <Button onClick={handleGenerate} disabled={pending} variant="default" size="default">
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          Générer un brouillon
        </Button>
        <p className="text-xs text-[#0F1419]/55">
          Appelle l&apos;Edge Function pour le mois écoulé. Délai ~10-20s.
        </p>
      </section>

      {/* Toast */}
      {toast ? (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 flex items-start gap-3 text-sm',
            toast.kind === 'ok'
              ? 'border-accent-green/30 bg-pastel-lime text-[#0F1419]'
              : 'border-accent-red/30 bg-pastel-peach text-[#0F1419]',
          )}
        >
          {toast.kind === 'ok' ? (
            <CheckCircle2 className="size-4 mt-0.5 shrink-0" aria-hidden />
          ) : (
            <AlertCircle className="size-4 mt-0.5 shrink-0" aria-hidden />
          )}
          <p>{toast.message}</p>
        </div>
      ) : null}

      {/* Liste */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[#0F1419]">Communiqués ({releases.length})</h2>
        {releases.length === 0 ? (
          <Card variant="opaque" padding="default">
            <div className="flex items-start gap-3">
              <FileText className="size-5 text-[#0F1419]/40 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-medium text-[#0F1419]">
                  Aucun communiqué pour l&apos;instant.
                </p>
                <p className="text-xs text-[#0F1419]/55 mt-1">
                  Cliquez « Générer un brouillon » pour produire le premier communiqué depuis le
                  dernier rapport observatoire envoyé.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <ul className="space-y-2">
            {releases.map((release) => (
              <li
                key={release.id}
                className="rounded-lg border border-[#0F1419]/[0.08] bg-paper px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-[10px] font-mono uppercase tracking-wide rounded-pill px-2 py-0.5',
                          STATUS_BADGE[release.status],
                        )}
                      >
                        {STATUS_LABEL[release.status]}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wide text-[#0F1419]/45">
                        {release.bodyWordCount} mots · IA {release.aiCostEur.toFixed(3)}€
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-[#0F1419] leading-snug">
                      {release.title}
                    </h3>
                    {release.subtitle ? (
                      <p className="text-xs text-[#0F1419]/72 leading-relaxed">
                        {release.subtitle}
                      </p>
                    ) : null}
                    <p className="text-[11px] font-mono text-[#0F1419]/45">
                      Créé {formatDateFr(release.createdAt)}
                      {release.approvedAt ? ` · Approuvé ${formatDateFr(release.approvedAt)}` : ''}
                      {release.sentAt
                        ? ` · Diffusé ${formatDateFr(release.sentAt)} (${release.emailsSent}✓ / ${release.emailsFailed}✗)`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {release.status === 'draft' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApprove(release.id)}
                        disabled={pending}
                      >
                        Approuver
                      </Button>
                    ) : null}
                    {release.status === 'approved' || release.status === 'sent' ? (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleDispatch(release.id, release.title)}
                        disabled={pending || summary.activeContacts === 0}
                      >
                        <Send className="size-3.5" aria-hidden />
                        {release.status === 'sent' ? 'Rediffuser' : 'Diffuser'}
                      </Button>
                    ) : null}
                    {release.status !== 'archived' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleArchive(release.id)}
                        disabled={pending}
                      >
                        Archiver
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
