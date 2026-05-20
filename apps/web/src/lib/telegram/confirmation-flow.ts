/**
 * Confirmations 2-étapes pour les actions destructives via bot Telegram.
 *
 * Workflow :
 *   1. NLP / commande produit un descripteur ToolUseCall[] + une description
 *      humaine (ex: "Suspendre user@example.com pour : impayé").
 *   2. createPendingAction() insère dans pending_admin_actions (status='pending',
 *      expires_at = now() + 10 min via DEFAULT SQL).
 *   3. Le bot envoie un message avec 2 boutons inline : ✓ Confirmer / ✕ Annuler,
 *      callback_data = `confirm:<pending_id>` ou `cancel:<pending_id>`.
 *   4. Sur clic → executePendingAction() ou cancelPendingAction(). Status migre.
 *
 * Sécurité : l'exécution vérifie status='pending' ET expires_at > now() avant
 * d'exécuter. Toute action expirée est marquée 'expired' et refusée.
 *
 * Note V1 partie 1 (cette itération) : on n'EXÉCUTE PAS encore les tool_uses
 * — c'est l'itération NLP (autre agent, en parallèle) qui ajoute le dispatch
 * sur tool registry. Ici on marque juste 'confirmed' et on retourne le
 * descripteur pour permettre au caller d'afficher un récap.
 */

import type { Database, Json } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ToolUseCall } from './types'

type AdminSupabase = SupabaseClient<Database>

interface PendingActionInsertRow {
  chat_id: number
  user_id: string | null
  description: string
  tool_uses: Json
  original_message: string | null
}

interface PendingActionRow {
  id: string
  chat_id: number
  user_id: string | null
  description: string
  tool_uses: Json
  original_message: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired'
  resolved_at: string | null
  expires_at: string
  created_at: string
}

interface PendingActionsInsertBuilder {
  insert: (row: PendingActionInsertRow) => {
    select: (cols: string) => {
      single: () => Promise<{
        data: { id: string } | null
        error: { message: string } | null
      }>
    }
  }
}

interface PendingActionsSelectBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: PendingActionRow | null
        error: { message: string } | null
      }>
    }
  }
}

interface PendingActionsUpdateBuilder {
  update: (row: Record<string, unknown>) => {
    eq: (
      col: string,
      val: string,
    ) => Promise<{
      error: { message: string } | null
    }>
  }
}

export interface PendingAction {
  id: string
  chatId: number
  userId: string | null
  description: string
  toolUses: ToolUseCall[]
  originalMessage: string | null
  status: 'pending' | 'confirmed' | 'cancelled' | 'expired'
  expiresAt: string
  createdAt: string
}

function rowToPending(row: PendingActionRow): PendingAction {
  const tools = Array.isArray(row.tool_uses) ? (row.tool_uses as unknown as ToolUseCall[]) : []
  return {
    id: row.id,
    chatId: row.chat_id,
    userId: row.user_id,
    description: row.description,
    toolUses: tools,
    originalMessage: row.original_message,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

/**
 * Crée un enregistrement dans pending_admin_actions et retourne son UUID.
 *
 * Le row sera lu par le button-handler quand l'admin clique sur
 * `confirm:<id>` ou `cancel:<id>`. Expiration auto 10min (DEFAULT SQL).
 *
 * Signature : on prend `supabase` en argument explicite (cohérent avec le
 * reste de la lib telegram qui reçoit le service-role client depuis le
 * webhook-handler).
 */
export async function createPendingAction(
  supabase: AdminSupabase,
  chatId: number,
  userId: string | null,
  description: string,
  toolUses: ToolUseCall[],
  originalMessage: string,
): Promise<string> {
  const inserter = supabase.from('pending_admin_actions') as unknown as PendingActionsInsertBuilder

  const { data, error } = await inserter
    .insert({
      chat_id: chatId,
      user_id: userId,
      description,
      tool_uses: toolUses as unknown as Json,
      original_message: originalMessage,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`createPendingAction failed : ${error?.message ?? 'unknown'}`)
  }
  return data.id
}

/**
 * Lit un pending_admin_action par UUID. Retourne null si introuvable.
 */
export async function getPendingAction(
  supabase: AdminSupabase,
  pendingId: string,
): Promise<PendingAction | null> {
  const builder = supabase.from('pending_admin_actions') as unknown as PendingActionsSelectBuilder
  const { data, error } = await builder.select('*').eq('id', pendingId).maybeSingle()
  if (error) {
    console.error('[telegram/confirmation-flow] getPendingAction failed', error)
    return null
  }
  if (!data) return null
  return rowToPending(data)
}

/**
 * Met à jour le `status` d'une pending action (helper interne).
 */
async function markStatus(
  supabase: AdminSupabase,
  pendingId: string,
  status: 'confirmed' | 'cancelled' | 'expired',
): Promise<void> {
  const builder = supabase.from('pending_admin_actions') as unknown as PendingActionsUpdateBuilder
  const { error } = await builder
    .update({
      status,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', pendingId)
  if (error) {
    console.error('[telegram/confirmation-flow] markStatus failed', error)
  }
}

/**
 * Marque une action `cancelled` (clic sur ✕ Annuler).
 */
export async function cancelPendingAction(
  supabase: AdminSupabase,
  pendingId: string,
): Promise<void> {
  await markStatus(supabase, pendingId, 'cancelled')
}

/**
 * Exécute une action confirmée (clic sur ✓ Confirmer).
 *
 * V1 partie 1 : on n'exécute PAS encore les tool_uses (NLP itération
 * parallèle s'en charge). On marque juste 'confirmed' et on retourne
 * le descripteur des tools comme `results` pour permettre au caller
 * d'afficher un récap.
 *
 * V2 (NLP) : remplacer le corps par un dispatch sur registry tools.
 */
export async function executePendingAction(
  supabase: AdminSupabase,
  pendingId: string,
  userId: string,
): Promise<{ ok: boolean; results: ToolUseCall[]; error?: string }> {
  const pending = await getPendingAction(supabase, pendingId)
  if (!pending) {
    return { ok: false, results: [], error: 'Action introuvable' }
  }
  if (pending.status !== 'pending') {
    return { ok: false, results: [], error: `Action déjà ${pending.status}` }
  }
  if (new Date(pending.expiresAt).getTime() < Date.now()) {
    await markStatus(supabase, pendingId, 'expired')
    return { ok: false, results: [], error: 'Action expirée (>10 min)' }
  }
  // Sécurité : on vérifie que l'admin qui confirme est bien celui qui a créé
  // le pending (ou n'importe quel admin si user_id null = action système).
  if (pending.userId !== null && pending.userId !== userId) {
    return { ok: false, results: [], error: 'Action appartient à un autre admin' }
  }

  // V1 partie 1 : pas d'exécution NLP — on marque juste confirmed.
  await markStatus(supabase, pendingId, 'confirmed')

  return { ok: true, results: pending.toolUses }
}
