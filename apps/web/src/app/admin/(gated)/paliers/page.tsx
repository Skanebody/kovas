import { MilestonesAchieved } from '@/components/admin/milestones/MilestonesAchieved'
import { MilestonesInProgress } from '@/components/admin/milestones/MilestonesInProgress'
import { OKRsList } from '@/components/admin/milestones/OKRsList'
import { RoadmapEditor } from '@/components/admin/milestones/RoadmapEditor'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import {
  groupRoadmapByVersion,
  loadMilestonesWithProgress,
  loadOkrs,
  loadRoadmapItems,
  splitMilestonesByAchievement,
} from '@/lib/admin/milestones-calculator'
import {
  currentQuarter as computeCurrentQuarter,
  nextQuarter as computeNextQuarter,
} from '@/lib/admin/milestones-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { CheckCircle2, ListTodo, Map as MapIcon, Target } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Paliers · Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminPaliersPage() {
  const supabase = createAdminClient()
  const currentQuarter = computeCurrentQuarter()
  const nextQuarter = computeNextQuarter()

  const [milestones, okrs, roadmap] = await Promise.all([
    loadMilestonesWithProgress(supabase),
    loadOkrs(supabase),
    loadRoadmapItems(supabase),
  ])

  const { achieved, inProgress } = splitMilestonesByAchievement(milestones)
  const itemsByVersion = groupRoadmapByVersion(roadmap)

  // OKRs courants (trimestre actuel) + draft prochain
  const okrsCurrentQuarter = okrs.filter(
    (o) => o.quarter === currentQuarter && (o.status === 'active' || o.status === 'draft'),
  )
  // Sinon fallback : tous les actifs/draft récents
  const okrsToDisplay = okrsCurrentQuarter.length > 0 ? okrsCurrentQuarter : okrs.slice(0, 5)

  // Métriques header
  const achievedCount = achieved.length
  const inProgressCount = inProgress.length
  const activeOkrCount = okrs.filter((o) => o.status === 'active').length
  const shippedRoadmapCount = roadmap.filter((r) => r.status === 'shipped').length

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          🎯 Paliers · OKRs · Roadmap
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Vos paliers.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Suivi des paliers business franchis, objectifs trimestriels (OKRs) et roadmap produit.
          Auto-update à chaque chargement.
        </p>
      </div>

      {/* Métriques principales */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Métriques paliers / OKRs"
      >
        <AdminMetricCard
          eyebrow="Paliers atteints"
          value={String(achievedCount)}
          hint={`sur ${milestones.length} total`}
          icon={CheckCircle2}
        />
        <AdminMetricCard
          eyebrow="Paliers en cours"
          value={String(inProgressCount)}
          hint="Cibles à franchir"
          icon={Target}
        />
        <AdminMetricCard
          eyebrow={`OKRs actifs · ${currentQuarter}`}
          value={String(activeOkrCount)}
          hint="Objectifs trimestriels en cours"
          icon={ListTodo}
        />
        <AdminMetricCard
          eyebrow="Roadmap livré"
          value={String(shippedRoadmapCount)}
          hint={`sur ${roadmap.length} items`}
          icon={MapIcon}
        />
      </section>

      {/* Section 1 : MilestonesAchieved */}
      <section aria-label="Paliers atteints">
        <MilestonesAchieved milestones={achieved} />
      </section>

      {/* Section 2 : MilestonesInProgress */}
      <section aria-label="Paliers en cours">
        <MilestonesInProgress milestones={inProgress} />
      </section>

      {/* Section 3 : OKRs */}
      <section aria-label="OKRs">
        <OKRsList okrs={okrsToDisplay} currentQuarter={currentQuarter} nextQuarter={nextQuarter} />
      </section>

      {/* Section 4 : Roadmap */}
      <section aria-label="Roadmap">
        <RoadmapEditor itemsByVersion={itemsByVersion} />
      </section>
    </div>
  )
}
