'use server'

/**
 * KOVAS — Server actions de la page Mission Flow (GC2, Lot B83 scaffold).
 *
 * `transitionMissionFlow` : appelle la RPC `mission_flow_transition` qui gère
 * la transition atomique de la state machine côté DB + append-only event log.
 *
 * La RPC est SECURITY DEFINER et fait elle-même le check is_member_of(org_id),
 * donc l'appel via supabase user-context fonctionne directement.
 *
 * Authority : CLAUDE.md §3 + REFONTE-ACQUI-TARGET-V2 §6.2 (GC2).
 *
 * Note: les tables mission_flow_states/events + RPC ne sont pas encore dans
 * `@kovas/database/types` — casts ciblés `(... as unknown as { ... })` comme
 * dans validation/actions.ts.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { MissionFlowPhase } from '@/lib/mission-flow/state-machine'
import { isTransitionAllowed } from '@/lib/mission-flow/state-machine'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

interface TransitionResult {
  success: boolean
  error?: string
  /** Code machine (ex: 'version_mismatch') exposé pour gestion fine côté client */
  code?:
    | 'mission_not_found'
    | 'forbidden'
    | 'version_mismatch'
    | 'terminal_state'
    | 'invalid_transition'
    | 'rpc_error'
    | 'unknown'
  /** Version actuelle côté DB (renvoyée en cas de mismatch pour resync) */
  currentVersion?: number
  /** Nouvelle version après transition réussie */
  newVersion?: number
}

interface RpcRow {
  ok: boolean
  new_version: number | null
  prev_phase: string | null
  error_reason: string | null
}

const PHASE_ERROR_LABELS: Record<string, string> = {
  mission_not_found: 'Mission introuvable.',
  forbidden: 'Accès refusé.',
  version_mismatch: 'Le flow a été modifié ailleurs, recharge la page.',
  terminal_state: 'Mission déjà envoyée, transition impossible.',
}

export async function transitionMissionFlowAction(
  missionId: string,
  targetPhase: MissionFlowPhase,
  expectedVersion: number | null = null,
): Promise<TransitionResult> {
  // 1. Auth + récupération supabase user-context
  const { supabase, orgId } = await getCurrentUser()

  // 2. SÉCURITÉ — Vérifier que la mission appartient à l'org de l'user
  //    AVANT toute autre lecture (cf. audit P1-4). Sans ce check, un attaquant
  //    pouvait énumérer les UUIDs valides via timing oracle (mission_not_found
  //    vs version_mismatch) car la RPC ne re-check pas l'ownership cross-org.
  type MissionOwnershipRow = { id: string }
  const missionTbl = supabase.from('missions' as never) as unknown as {
    select: (q: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        eq: (
          k: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{ data: MissionOwnershipRow | null }>
        }
      }
    }
  }
  const { data: missionRow } = await missionTbl
    .select('id')
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!missionRow) {
    // Message constant-time (pas de différence avec un autre code) pour
    // ne pas leaker l'existence de missions d'autres orgs.
    return { success: false, code: 'mission_not_found', error: 'Mission introuvable.' }
  }

  // 3. Récupère la phase courante + version pour valider la transition côté code
  //    avant le round-trip RPC (early-fail UX).
  type FlowStateRow = { current_phase: MissionFlowPhase; mission_id: string; version: number }
  const flowTbl = supabase.from('mission_flow_states' as never) as unknown as {
    select: (q: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{ data: FlowStateRow | null }>
      }
    }
  }

  const { data: existing } = await flowTbl
    .select('current_phase, mission_id, version')
    .eq('mission_id', missionId)
    .maybeSingle()

  // Si pas encore initialisé, on traite comme 'preparation' (la RPC créera la row).
  const currentPhase: MissionFlowPhase = existing?.current_phase ?? 'preparation'
  const dbVersion: number | undefined = existing?.version

  // 3. Validation pure-fn (state machine)
  if (!isTransitionAllowed(currentPhase, targetPhase)) {
    return {
      success: false,
      code: 'invalid_transition',
      error: `Transition non autorisée : ${currentPhase} → ${targetPhase}.`,
      ...(typeof dbVersion === 'number' ? { currentVersion: dbVersion } : {}),
    }
  }

  // 4. Appel RPC atomique (transition + append event log + check optimistic ver)
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: RpcRow[] | RpcRow | null; error: { message: string } | null }>

  const { data, error } = await rpc('mission_flow_transition', {
    p_mission_id: missionId,
    p_to_phase: targetPhase,
    p_to_step: null,
    p_expected_ver: expectedVersion,
    p_trigger: 'user_action',
    p_payload: {},
  })

  if (error) {
    return { success: false, code: 'rpc_error', error: error.message }
  }

  // La RPC RETURNS TABLE → tableau de 1 row
  const row: RpcRow | null = Array.isArray(data) ? (data[0] ?? null) : data

  if (!row || !row.ok) {
    const reason = (row?.error_reason ?? 'unknown') as TransitionResult['code']
    return {
      success: false,
      code: reason ?? 'unknown',
      error: PHASE_ERROR_LABELS[reason ?? 'unknown'] ?? `Échec transition (${reason}).`,
      ...(typeof row?.new_version === 'number' ? { currentVersion: row.new_version } : {}),
    }
  }

  // 5. Revalidate la route pour recharger la timeline + état
  //    Note : on revalidate la route /flow ; le caller server peut récupérer
  //    dossierId depuis params s'il en a besoin pour d'autres routes.
  //    Ici on utilise un wildcard implicite via revalidatePath du segment parent.
  revalidatePath('/dashboard/dossiers', 'layout')

  return {
    success: true,
    ...(typeof row.new_version === 'number' ? { newVersion: row.new_version } : {}),
  }
}

/**
 * Initialise le flow pour une mission donnée — première transition
 * preparation → capture_terrain. Utilisé par le formulaire EmptyState.
 *
 * Cf. audit P1-5 : la signature `void` perdait les erreurs RPC, l'utilisateur
 * voyait juste la page rechargée avec l'EmptyState toujours là (zéro feedback).
 * Maintenant, en cas d'échec on redirige avec `?flow_error=…` que le caller
 * peut lire pour afficher un toast / banner.
 */
export async function initializeMissionFlowAction(
  missionId: string,
  formData: FormData,
): Promise<void> {
  const result = await transitionMissionFlowAction(missionId, 'capture_terrain', null)
  // Le dossierId vient du form action côté caller (`<input type=hidden name=dossierId>`)
  const dossierId = formData.get('dossierId')
  if (!result.success && typeof dossierId === 'string' && dossierId.length > 0) {
    const errorCode = result.code ?? 'unknown'
    redirect(`/dashboard/dossiers/${dossierId}/mission/flow?flow_error=${errorCode}`)
  }
}
