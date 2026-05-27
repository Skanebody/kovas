'use client'

/**
 * File d'attente DSAR — vue admin.
 *
 * Affiche les demandes pending + processing avec deadline qui s'approche.
 * Couleurs sémantiques :
 *   - rouge < 7j ou retard
 *   - ambre < 14j
 *   - vert ≥ 21j
 *
 * Actions admin (chaque action journalisée dans admin_audit_log via API) :
 *   - Marquer en cours
 *   - Marquer comme complétée (note obligatoire)
 *   - Rejeter (motif obligatoire)
 */

import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  type DsarQueueData,
  type DsarRequestRow,
  type DsarStatus,
  daysUntilDeadline,
  urgencyVariant,
} from '@/lib/admin/dsar'
import { AlertOctagon, CheckCircle2, Clock, ListChecks, Play, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

interface Props {
  data: DsarQueueData
}

type DialogKind = null | 'processing' | 'completed' | 'rejected'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function typeBadge(type: 'export' | 'erasure') {
  return type === 'export' ? (
    <Badge variant="blue">Export (Art. 15)</Badge>
  ) : (
    <Badge variant="red">Effacement (Art. 17)</Badge>
  )
}

function statusBadge(status: DsarStatus) {
  switch (status) {
    case 'pending':
      return <Badge variant="yellow">En attente</Badge>
    case 'processing':
      return <Badge variant="orange">En cours</Badge>
    case 'completed':
      return <Badge variant="green">Complétée</Badge>
    case 'rejected':
      return <Badge variant="muted">Rejetée</Badge>
  }
}

function DsarRowItem({
  row,
  onAction,
}: {
  row: DsarRequestRow
  onAction: (kind: DialogKind, row: DsarRequestRow) => void
}) {
  const days = daysUntilDeadline(row.deadline)
  const variant = urgencyVariant(days)

  return (
    <tr className="border-b border-rule/40 last:border-0 hover:bg-cream-deep/30">
      <td className="px-3 py-3 text-[13px]">
        <div className="font-medium text-ink">
          {row.user_full_name ?? <span className="text-ink-faint">sans nom</span>}
        </div>
        <div className="text-[11px] text-ink-mute font-mono">{row.user_email ?? '—'}</div>
      </td>
      <td className="px-3 py-3 text-[12px] text-ink-mute">{row.organization_name ?? '—'}</td>
      <td className="px-3 py-3">{typeBadge(row.type)}</td>
      <td className="px-3 py-3">{statusBadge(row.status)}</td>
      <td className="px-3 py-3 text-[12px] text-ink-mute">{formatDate(row.requested_at)}</td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] text-ink">{formatDate(row.deadline)}</span>
          <Badge variant={variant}>
            <span className="tabular-nums">{days < 0 ? `${-days} j de retard` : `${days} j`}</span>
          </Badge>
        </div>
      </td>
      <td className="px-3 py-3 text-right">
        {row.status === 'pending' || row.status === 'processing' ? (
          <div className="flex justify-end gap-1.5 flex-wrap">
            {row.status === 'pending' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction('processing', row)}
                aria-label="Marquer en cours"
              >
                <Play className="size-3.5" aria-hidden />
                En cours
              </Button>
            ) : null}
            <Button
              variant="default"
              size="sm"
              onClick={() => onAction('completed', row)}
              aria-label="Marquer comme complétée"
            >
              <CheckCircle2 className="size-3.5" aria-hidden />
              Complétée
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onAction('rejected', row)}
              aria-label="Rejeter la demande"
            >
              <XCircle className="size-3.5" aria-hidden />
              Rejeter
            </Button>
          </div>
        ) : (
          <span className="text-[11px] text-ink-faint italic">
            {row.completed_at ? formatDate(row.completed_at) : '—'}
          </span>
        )}
      </td>
    </tr>
  )
}

function DsarTable({
  title,
  rows,
  onAction,
  emptyHint,
}: {
  title: string
  rows: DsarRequestRow[]
  onAction: (kind: DialogKind, row: DsarRequestRow) => void
  emptyHint: string
}) {
  return (
    <section className="space-y-3">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">{title}</p>
        <p className="text-sm text-ink-mute mt-1">{rows.length} demande(s)</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-mute italic px-3 py-6 rounded-md border border-rule bg-paper">
          {emptyHint}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-rule bg-paper">
          <table className="w-full text-left">
            <thead className="bg-cream-deep/40 border-b border-rule">
              <tr>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
                  Utilisateur
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
                  Organisation
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
                  Type
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
                  Statut
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
                  Déposée
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
                  Deadline
                </th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <DsarRowItem key={row.id} row={row} onAction={onAction} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function DsarQueue({ data }: Props) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ kind: DialogKind; row: DsarRequestRow | null }>({
    kind: null,
    row: null,
  })
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const openDialog = (kind: DialogKind, row: DsarRequestRow) => {
    setDialog({ kind, row })
    setNote('')
    setError(null)
  }

  const closeDialog = () => {
    setDialog({ kind: null, row: null })
    setNote('')
    setError(null)
  }

  const submit = () => {
    if (!dialog.row || !dialog.kind) return
    const requireNote = dialog.kind === 'completed' || dialog.kind === 'rejected'
    if (requireNote && !note.trim()) {
      setError(
        dialog.kind === 'rejected'
          ? 'Motif de rejet obligatoire'
          : 'Note obligatoire (description du traitement)',
      )
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await fetch(`/api/admin/rgpd/${dialog.row!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: dialog.kind, notes: note.trim() || null }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? `HTTP ${res.status}`)
        return
      }
      closeDialog()
      router.refresh()
    })
  }

  const dialogTitle =
    dialog.kind === 'processing'
      ? 'Marquer en cours de traitement'
      : dialog.kind === 'completed'
        ? 'Marquer la demande comme complétée'
        : dialog.kind === 'rejected'
          ? 'Rejeter la demande'
          : ''

  const dialogDescription =
    dialog.kind === 'processing'
      ? "L'admin prend la demande en charge. Vous pouvez ajouter une note explicative (facultatif)."
      : dialog.kind === 'completed'
        ? 'Saisissez le détail du traitement (lien export, ID confirmation suppression, etc.). Cette note est journalisée dans admin_audit_log.'
        : dialog.kind === 'rejected'
          ? "Motif du rejet (obligatoire). La demande reste consultable et l'utilisateur sera notifié."
          : ''

  return (
    <div className="space-y-10">
      {/* KPIs */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="KPI RGPD"
      >
        <AdminMetricCard
          eyebrow="En attente"
          value={String(data.kpi.pendingCount)}
          hint="non encore traitées"
          icon={Clock}
        />
        <AdminMetricCard
          eyebrow="En cours"
          value={String(data.kpi.processingCount)}
          hint="admin a pris en charge"
          icon={ListChecks}
        />
        <AdminMetricCard
          eyebrow="En retard"
          value={String(data.kpi.overdueCount)}
          hint="deadline 30j dépassée"
          icon={AlertOctagon}
        />
        <AdminMetricCard
          eyebrow="Résolution moyenne"
          value={
            data.kpi.averageResolutionDays !== null ? `${data.kpi.averageResolutionDays} j` : '—'
          }
          hint="sur demandes complétées"
          icon={CheckCircle2}
        />
      </section>

      <DsarTable
        title="🚨 À traiter (pending + processing)"
        rows={[...data.pending, ...data.processing]}
        onAction={openDialog}
        emptyHint="Aucune demande RGPD active. Excellent !"
      />

      <DsarTable
        title="✅ Complétées (archives)"
        rows={data.completed}
        onAction={openDialog}
        emptyHint="Aucune demande complétée pour le moment."
      />

      {data.rejected.length > 0 ? (
        <DsarTable
          title="🚫 Rejetées (archives)"
          rows={data.rejected}
          onAction={openDialog}
          emptyHint="Aucune demande rejetée."
        />
      ) : null}

      {/* Dialog action */}
      <Dialog open={dialog.kind !== null} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          {dialog.row ? (
            <div className="rounded-md border border-rule bg-cream-deep/30 px-3 py-2 text-[12px] text-ink-mute">
              <div>
                <strong className="text-ink">{dialog.row.user_email ?? 'sans email'}</strong> ·{' '}
                {dialog.row.type === 'export' ? 'Export RGPD' : 'Effacement RGPD'}
              </div>
              <div>
                Déposée le {formatDate(dialog.row.requested_at)} · deadline{' '}
                {formatDate(dialog.row.deadline)}
              </div>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="dsar-note"
              className="text-[11px] font-mono uppercase tracking-wider text-ink-mute"
            >
              Note {dialog.kind === 'processing' ? '(facultative)' : '(obligatoire)'}
            </label>
            <Textarea
              id="dsar-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                dialog.kind === 'completed'
                  ? "Lien export généré : .../downloads/...zip — données livrées par email à l'utilisateur le 2026-XX-XX."
                  : dialog.kind === 'rejected'
                    ? 'Motif : demande déjà traitée le… / identité non vérifiée / …'
                    : 'Action en cours, ETA estimé…'
              }
              rows={4}
              className="mt-1"
            />
          </div>

          {error ? (
            <p className="text-[12px] text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={closeDialog} disabled={isPending}>
              Annuler
            </Button>
            <Button
              variant={dialog.kind === 'rejected' ? 'destructive' : 'default'}
              size="sm"
              onClick={submit}
              disabled={isPending}
            >
              {isPending ? 'Application…' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
