import { AppPageHeader } from '@/components/app-page-header'
import { CriterionProgress } from '@/components/gamification/CriterionProgress'
import { LevelBadgeShield } from '@/components/gamification/LevelBadgeShield'
import { ProgressionHero } from '@/components/gamification/ProgressionHero'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { LEVELS, type Level, type LevelId, getLevelById } from '@/lib/gamification/levels'
import {
  type LevelHistoryEntry,
  getLevelHistory,
  recomputeUserLevel,
} from '@/lib/gamification/progression-engine'
import { ArrowLeft, ArrowRight, Check, Lock, TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Votre progression' }

export default async function ProgressionPage() {
  const { supabase, user, orgId } = await getCurrentUser()

  const result = await recomputeUserLevel(supabase, user.id, orgId)
  const history = await getLevelHistory(supabase, user.id)

  // Lit la date d'obtention du statut courant pour l'afficher dans le hero.
  const { data: progRow } = await supabase
    .from('user_progression')
    .select('current_level_unlocked_at')
    .eq('user_id', user.id)
    .maybeSingle()

  const currentLevel = result.currentLevel
  const next = result.nextLevel
  const progress = result.progressToNext

  const unlockedAt =
    (progRow as { current_level_unlocked_at: string } | null)?.current_level_unlocked_at ?? null

  const progressPercent = computeOverallPercent(progress)

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 animate-fade-in">
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

      {/* HERO — Badge XL + statut + barre globale */}
      <Card variant="flat" padding="lg">
        <ProgressionHero
          level={currentLevel.id as LevelId}
          label={currentLevel.label}
          unlockedAt={unlockedAt}
          description={currentLevel.description}
          progressPercent={progressPercent}
          nextLabel={next?.label ?? null}
        />
      </Card>

      {/* PROCHAIN PALIER — critères détaillés */}
      {next ? (
        <Card variant="flat" padding="lg" className="space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
              <TrendingUp className="size-3.5" /> Comment atteindre le prochain statut
            </div>
            <LevelBadgeShield
              level={next.id as LevelId}
              unlocked={false}
              size="md"
              showLabel={false}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {progress.missions ? (
              <CriterionProgress
                label="Missions réalisées"
                current={progress.missions.current}
                needed={progress.missions.needed}
                delay={0}
              />
            ) : null}
            {progress.subscriptionDays ? (
              <CriterionProgress
                label="Ancienneté d'abonnement"
                current={progress.subscriptionDays.current}
                needed={progress.subscriptionDays.needed}
                unit=" jours"
                delay={0.05}
              />
            ) : null}
            {progress.referralsPaid ? (
              <CriterionProgress
                label="Filleuls payants"
                current={progress.referralsPaid.current}
                needed={progress.referralsPaid.needed}
                delay={0.1}
              />
            ) : null}
            {progress.ademeScore ? (
              <CriterionProgress
                label="Score ADEME"
                current={Math.round(progress.ademeScore.current * 100)}
                needed={Math.round(progress.ademeScore.needed * 100)}
                unit=" %"
                delay={0.15}
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

      {/* TOUS LES STATUTS — grille responsive */}
      <section className="space-y-5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
            Les 7 statuts professionnels
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">
            {currentLevel.id} / 7 atteint{currentLevel.id > 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {LEVELS.map((lvl) => (
            <LevelGridCard key={lvl.id} level={lvl} currentLevelId={currentLevel.id as LevelId} />
          ))}
        </div>
      </section>

      {/* HISTORIQUE */}
      {history.length > 0 ? (
        <Card variant="flat" padding="lg" className="space-y-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
            Historique des paliers franchis
          </div>
          <ol className="relative space-y-4">
            {history.map((entry, idx) => (
              <HistoryTimelineRow
                key={entry.id}
                entry={entry}
                isLast={idx === history.length - 1}
              />
            ))}
          </ol>
        </Card>
      ) : null}

      {/* MENTION LÉGALE / CGU */}
      <p className="text-[11px] text-ink-faint leading-relaxed pt-4 border-t border-rule/40">
        Le statut est calculé automatiquement à partir de votre activité sur KOVAS. Il ne donne
        accès à aucun avantage tarifaire et ne constitue ni une certification professionnelle ni une
        qualification réglementaire.
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

/**
 * Carte unitaire d'un statut dans la grille responsive.
 * 3 états visuels :
 *   - passé   : badge plein + check vert
 *   - actuel  : badge plein + ribbon "Actuel" + bordure chartreuse + ring
 *   - futur   : badge grisé + cadenas + critères verrouillés
 */
function LevelGridCard({
  level,
  currentLevelId,
}: {
  level: Level
  currentLevelId: LevelId
}) {
  const isCurrent = level.id === currentLevelId
  const isUnlocked = level.id <= currentLevelId
  const isPast = level.id < currentLevelId

  const criteriaParts = formatCriteria(level)

  return (
    <div
      className={[
        'relative flex flex-col items-center text-center gap-3 rounded-lg border bg-paper p-5 transition-all',
        isCurrent
          ? 'border-chartreuse-deep ring-2 ring-chartreuse/60 shadow-md'
          : isUnlocked
            ? 'border-rule shadow-xs'
            : 'border-rule/60',
      ].join(' ')}
    >
      {isCurrent ? (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-pill bg-chartreuse-deep px-3 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-paper">
          Actuel
        </span>
      ) : null}

      <div className="pt-1">
        <LevelBadgeShield
          level={level.id}
          unlocked={isUnlocked}
          size="lg"
          current={isCurrent}
          animate
        />
      </div>

      <div className="space-y-1">
        <h3
          className={[
            'font-sans text-[15px] font-semibold leading-tight',
            isUnlocked ? 'text-ink' : 'text-ink-mute',
          ].join(' ')}
        >
          {level.label}
        </h3>
        <p
          className={[
            'text-[12px] leading-relaxed',
            isUnlocked ? 'text-ink-mute' : 'text-ink-faint',
          ].join(' ')}
        >
          {level.description}
        </p>
      </div>

      {/* Critères / état */}
      <div className="mt-auto pt-2 w-full">
        {isPast ? (
          <div className="inline-flex items-center gap-1.5 rounded-pill bg-chartreuse/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-chartreuse-deep">
            <Check className="size-3" strokeWidth={3} /> Atteint
          </div>
        ) : isCurrent ? (
          <div className="inline-flex items-center gap-1.5 rounded-pill bg-navy/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-navy">
            Statut actuel
          </div>
        ) : (
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-pill bg-rule/50 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">
              <Lock className="size-3" /> Verrouillé
            </div>
            {criteriaParts.length > 0 ? (
              <p className="font-mono text-[10px] text-ink-faint leading-snug">
                {criteriaParts.join(level.unlockCriteria.requireAll ? ' ET ' : ' ou ')}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Ligne timeline d'un déblocage historique.
 */
function HistoryTimelineRow({
  entry,
  isLast,
}: {
  entry: LevelHistoryEntry
  isLast: boolean
}) {
  const lvl = getLevelById(entry.toLevel)
  if (!lvl) return null
  return (
    <li className="relative flex gap-4 pl-1">
      {!isLast ? (
        <span
          aria-hidden
          className="absolute left-[18px] top-12 h-[calc(100%-32px)] w-px bg-rule/50"
        />
      ) : null}
      <div className="shrink-0">
        <LevelBadgeShield level={entry.toLevel as LevelId} unlocked size="sm" animate={false} />
      </div>
      <div className="flex-1 min-w-0 pt-1">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <span className="text-[14px] font-semibold text-ink">{lvl.label}</span>
          <span className="font-mono text-[11px] text-ink-mute">
            {formatDateShort(entry.unlockedAt)}
          </span>
        </div>
        {entry.reason ? (
          <p className="text-[12px] text-ink-mute leading-relaxed mt-0.5">{entry.reason}</p>
        ) : null}
      </div>
    </li>
  )
}

function formatCriteria(level: Level): string[] {
  const c = level.unlockCriteria
  const parts: string[] = []
  if (c.missions !== undefined) parts.push(`${c.missions} missions`)
  if (c.subscriptionDays !== undefined) {
    const months = Math.round(c.subscriptionDays / 30)
    parts.push(`${months} mois`)
  }
  if (c.referralsPaid !== undefined) parts.push(`${c.referralsPaid} filleuls`)
  if (c.ademeScore !== undefined) parts.push(`ADEME ≥ ${Math.round(c.ademeScore * 100)} %`)
  return parts
}

function formatDateShort(iso: string): string {
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

/**
 * Pourcentage global de progression vers le prochain palier — moyenne pondérée
 * sur tous les critères présents (chacun saturé à 100%).
 */
function computeOverallPercent(progress: {
  missions?: { current: number; needed: number }
  subscriptionDays?: { current: number; needed: number }
  referralsPaid?: { current: number; needed: number }
  ademeScore?: { current: number; needed: number }
}): number {
  const ratios: number[] = []
  if (progress.missions) {
    ratios.push(Math.min(1, progress.missions.current / Math.max(progress.missions.needed, 1)))
  }
  if (progress.subscriptionDays) {
    ratios.push(
      Math.min(
        1,
        progress.subscriptionDays.current / Math.max(progress.subscriptionDays.needed, 1),
      ),
    )
  }
  if (progress.referralsPaid) {
    ratios.push(
      Math.min(1, progress.referralsPaid.current / Math.max(progress.referralsPaid.needed, 1)),
    )
  }
  if (progress.ademeScore) {
    ratios.push(Math.min(1, progress.ademeScore.current / Math.max(progress.ademeScore.needed, 1)))
  }
  if (ratios.length === 0) return 0
  const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length
  return Math.round(avg * 100)
}
