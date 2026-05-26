/**
 * KOVAS — Page Mission Flow Continu (GC2, Lot B83 scaffold).
 *
 * Server Component coquille qui :
 *   1. Récupère le dossier + sa première mission (scaffold simple)
 *   2. Charge l'état persistant `mission_flow_states` (peut être absent)
 *   3. Charge l'historique `mission_flow_events`
 *   4. Délègue à <MissionFlowComposer> avec server action pré-bindée
 *
 * Si le flow n'est pas encore initialisé en DB (pas de row dans
 * `mission_flow_states`), affiche un EmptyState avec CTA "Initialiser le flow"
 * qui déclenche une première transition preparation → preparation (création
 * implicite par la RPC).
 *
 * SCAFFOLD MINIMAL — pas de Realtime, pas de presence cursor multi-device.
 *
 * Authority : CLAUDE.md §3 + REFONTE-ACQUI-TARGET-V2 §6.2 (GC2).
 */

import { AppPageHeader } from '@/components/app-page-header'
import { MissionFlowComposer } from '@/components/mission-flow/MissionFlowComposer'
import type { MissionFlowEvent } from '@/components/mission-flow/MissionFlowTimeline'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { MissionFlowPhase } from '@/lib/mission-flow/state-machine'
import { Workflow } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { initializeMissionFlowAction, transitionMissionFlowAction } from './actions'

export const metadata: Metadata = {
  title: 'Mode mission — Flow continu',
  robots: { index: false, follow: false },
}

interface FlowStateRow {
  current_phase: MissionFlowPhase
  current_step: string | null
  version: number
  updated_at: string
}

interface FlowEventRow {
  id: string
  from_phase: string | null
  to_phase: string
  from_step: string | null
  to_step: string | null
  trigger: string
  trigger_payload: Record<string, unknown> | null
  occurred_at: string
}

export default async function MissionFlowPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: dossierId } = await params
  const { supabase, orgId } = await getCurrentUser()

  // 1. Charge dossier (RLS s'occupe de l'auth)
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('id, reference')
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!dossier) {
    notFound()
  }

  // 2. Charge la première mission du dossier (scaffold simple — pas de sélection multi-mission)
  type MissionRow = { id: string; type: string }
  const { data: missions } = (await supabase
    .from('missions')
    .select('id, type')
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true })
    .limit(1)) as unknown as { data: MissionRow[] | null }

  const mission = missions?.[0] ?? null

  if (!mission) {
    return (
      <div className="space-y-8">
        <AppPageHeader
          eyebrow="Mode mission"
          title="Flow"
          accent="continu"
          description="Reprendre la mission là où tu l'as laissée, même après changement d'appareil."
        />
        <EmptyState
          icon={Workflow}
          title="Aucune mission pour ce dossier"
          description="Crée une mission depuis la page dossier pour démarrer le flow continu."
        />
      </div>
    )
  }

  // 3. Charge l'état persistant (peut être null si jamais initialisé)
  const flowStatesTbl = supabase.from('mission_flow_states' as never) as unknown as {
    select: (q: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{ data: FlowStateRow | null }>
      }
    }
  }
  const { data: flowState } = await flowStatesTbl
    .select('current_phase, current_step, version, updated_at')
    .eq('mission_id', mission.id)
    .maybeSingle()

  // 4. Charge l'historique d'événements (vide si flow jamais initialisé)
  const flowEventsTbl = supabase.from('mission_flow_events' as never) as unknown as {
    select: (q: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        order: (
          k: string,
          o: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{ data: FlowEventRow[] | null }>
        }
      }
    }
  }
  const { data: events } = await flowEventsTbl
    .select('id, from_phase, to_phase, from_step, to_step, trigger, trigger_payload, occurred_at')
    .eq('mission_id', mission.id)
    .order('occurred_at', { ascending: false })
    .limit(50)

  const eventHistory: MissionFlowEvent[] = (events ?? []).map((e) => ({
    eventType: e.trigger,
    payload: e.trigger_payload,
    timestamp: e.occurred_at,
    fromPhase: (e.from_phase as MissionFlowPhase | null) ?? null,
    toPhase: (e.to_phase as MissionFlowPhase | null) ?? null,
  }))

  return (
    <div className="space-y-8">
      <AppPageHeader
        eyebrow="Mode mission"
        title="Flow"
        accent="continu"
        description="Reprendre la mission là où tu l'as laissée, même après changement d'appareil."
      />

      {flowState === null ? (
        <EmptyState
          icon={Workflow}
          title="Flow non encore initialisé"
          description="Démarre la première phase pour activer le flow continu de cette mission."
          action={
            <form action={initializeMissionFlowAction.bind(null, mission.id)}>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-pill bg-chartreuse px-[22px] py-[11px] text-[13px] font-medium text-ink shadow-[0_6px_18px_rgba(212,245,66,0.35)] transition-all hover:bg-chartreuse-deep hover:-translate-y-px"
              >
                Initialiser le flow
              </button>
            </form>
          }
        />
      ) : (
        <MissionFlowComposer
          missionId={mission.id}
          dossierReference={dossier.reference}
          initialState={flowState.current_phase}
          initialEventHistory={eventHistory}
          onTransition={transitionMissionFlowAction}
        />
      )}
    </div>
  )
}
