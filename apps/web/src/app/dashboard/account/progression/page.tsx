import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LevelBadge } from '@/components/gamification/LevelBadge'
import { ProgressionTimeline } from '@/components/gamification/ProgressionTimeline'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getLevelById, type LevelId } from '@/lib/gamification/levels'
import {
  type LevelHistoryEntry,
  getLevelHistory,
  recomputeUserLevel,
} from '@/lib/gamification/progression-engine'
import { ArrowLeft, ArrowRight, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Votre progression' }

export default async function ProgressionPage() {
  const { supabase, user, orgId } = await getCurrentUser()

  // Recalcule + persiste à chaque visite — léger et idempotent
  const result = await recomputeUserLevel(supabase, user.id, orgId)
  const history = await getLevelHistory(supabase, user.id)

  const current = result.currentLevel
  const next = result.nextLevel
  const progress = result.progressToNext

  return (
    <div className="max-w-3xl space-y-8">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/account">
          <ArrowLeft className="size-4" /> Mon compte
        </Link>
      </Button>

      <AppPageHeader
        title="Votre"
        accent="progression"
        eyebrow="Statut professionnel"
        description="Le statut KOVAS reconnaît votre engagement et votre activité. Il est calculé automatiquement et n'ouvre aucun avantage tarifaire."
      />

      {/* STATUT ACTUEL */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Statut actuel
        </div>
        <div className="flex items-center gap-5 flex-wrap">
          <LevelBadge level={current.id as LevelId} size="xl" showLabel={false} />
          <div className="space-y-1 min-w-0 flex-1">
            <h2 className="font-sans text-[28px] font-light tracking-tight text-ink leading-tight">
              <span className="font-serif italic font-normal">{current.label}</span>
            </h2>
            <p className="text-[13px] text-ink-mute leading-relaxed">{current.description}</p>
          </div>
        </div>
      </Card>

      {/* PROCHAIN PALIER */}
      {next ? (
        <Card variant="flat" padding="lg" className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
              <TrendingUp className="size-3.5" /> Prochain palier
            </div>
            <LevelBadge level={next.id as LevelId} size="sm" />
          </div>

          <div className="space-y-4">
            {progress.missions ? (
              <ProgressRow
                label="Missions réalisées"
                current={progress.missions.current}
                needed={progress.missions.needed}
                unit=""
              />
            ) : null}
            {progress.subscriptionDays ? (
              <ProgressRow
                label="Ancienneté d'abonnement"
                current={progress.subscriptionDays.current}
                needed={progress.subscriptionDays.needed}
                unit=" jours"
              />
            ) : null}
            {progress.referralsPaid ? (
              <ProgressRow
                label="Filleuls payants"
                current={progress.referralsPaid.current}
                needed={progress.referralsPaid.needed}
                unit=""
              />
            ) : null}
            {progress.ademeScore ? (
              <ProgressRow
                label="Score ADEME"
                current={Math.round(progress.ademeScore.current * 100)}
                needed={Math.round(progress.ademeScore.needed * 100)}
                unit=" %"
              />
            ) : null}
          </div>

          <p className="text-[12px] text-ink-mute leading-relaxed">
            {next.unlockCriteria.requireAll
              ? 'Tous les critères ci-dessus doivent être satisfaits pour débloquer ce statut.'
              : 'Un seul des critères ci-dessus suffit à débloquer ce statut.'}
          </p>
        </Card>
      ) : (
        <Card variant="flat" padding="lg" className="space-y-2">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
            Statut maximum atteint
          </div>
          <p className="text-[14px] text-ink">
            Vous avez débloqué l'ensemble des statuts professionnels KOVAS. Merci pour votre
            engagement.
          </p>
        </Card>
      )}

      {/* TIMELINE COMPLÈTE */}
      <Card variant="flat" padding="lg" className="space-y-5">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Les 7 statuts professionnels
        </div>
        <ProgressionTimeline
          currentLevel={current.id as LevelId}
        />
      </Card>

      {/* HISTORIQUE */}
      {history.length > 0 ? (
        <Card variant="flat" padding="lg" className="space-y-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
            Historique des déblocages
          </div>
          <ul className="space-y-3">
            {history.map((h) => (
              <HistoryRow key={h.id} entry={h} />
            ))}
          </ul>
        </Card>
      ) : null}

      {/* MENTION LÉGALE / CGU */}
      <p className="text-[11px] text-ink-faint leading-relaxed pt-4 border-t border-rule/40">
        Le statut est calculé automatiquement à partir de votre activité sur KOVAS. Il ne donne
        accès à aucun avantage tarifaire et ne constitue ni une certification professionnelle ni
        une qualification réglementaire.
      </p>

      <div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/account/parrainage">
            Programme parrainage
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

function ProgressRow({
  label,
  current,
  needed,
  unit,
}: {
  label: string
  current: number
  needed: number
  unit: string
}) {
  const pct = Math.min(100, Math.round((current / Math.max(needed, 1)) * 100))
  const remaining = Math.max(0, needed - current)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="font-mono text-[12px] text-ink-mute tabular-nums">
          {current}
          {unit} / {needed}
          {unit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-rule/40 overflow-hidden">
        <div
          className="h-full bg-navy transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {remaining > 0 ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
          Reste {remaining}
          {unit}
        </div>
      ) : (
        <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-chartreuse-deep">
          Critère atteint
        </div>
      )}
    </div>
  )
}

function HistoryRow({ entry }: { entry: LevelHistoryEntry }) {
  const lvl = getLevelById(entry.toLevel)
  return (
    <li className="flex items-start gap-3 text-[13px]">
      <LevelBadge level={entry.toLevel as LevelId} size="sm" showLabel={false} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="font-medium text-ink">{lvl?.label ?? `Niveau ${entry.toLevel}`}</span>
          <span className="font-mono text-[11px] text-ink-mute">
            {formatDate(entry.unlockedAt)}
          </span>
        </div>
        {entry.reason ? (
          <p className="text-[12px] text-ink-mute leading-relaxed">{entry.reason}</p>
        ) : null}
      </div>
    </li>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
