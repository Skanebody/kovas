/**
 * Wrapper d'audit pour les actions admin destructives.
 *
 * Pattern : exécute `fn()` puis log SUCCESS/FAILURE dans `admin_audit_log` via
 * `logAdminAction()`. Source toujours = 'dashboard_web' (le bot Telegram aura
 * son propre wrapper itération 9+).
 *
 * Usage type :
 *   await withAuditWrapper(
 *     {
 *       adminUserId: access.user.id,
 *       actionType: 'user_suspended',
 *       targetType: 'user',
 *       targetId: userId,
 *       targetLabel: profile.email,
 *       payload: { reason },
 *     },
 *     async () => {
 *       // mutation Supabase ici
 *     },
 *   )
 *
 * L'erreur est re-throw pour que la route API renvoie 500 — l'audit log est
 * inscrit AVANT le re-throw, garantissant la traçabilité même en cas d'échec.
 */

import { logAdminAction } from './audit-log'

export interface AuditWrapperParams {
  adminUserId: string
  actionType: string
  targetType: string
  targetId: string
  targetLabel?: string | null
  payload?: Record<string, unknown>
  previousState?: Record<string, unknown> | null
  newState?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
}

export async function withAuditWrapper<T>(
  params: AuditWrapperParams,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn()
    await logAdminAction({
      adminUserId: params.adminUserId,
      actionType: params.actionType,
      actionSource: 'dashboard_web',
      targetType: params.targetType,
      targetId: params.targetId,
      targetLabel: params.targetLabel ?? null,
      payload: params.payload,
      previousState: params.previousState ?? null,
      newState: params.newState ?? { ok: true },
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      succeeded: true,
    })
    return result
  } catch (err) {
    await logAdminAction({
      adminUserId: params.adminUserId,
      actionType: params.actionType,
      actionSource: 'dashboard_web',
      targetType: params.targetType,
      targetId: params.targetId,
      targetLabel: params.targetLabel ?? null,
      payload: params.payload,
      previousState: params.previousState ?? null,
      newState: null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      succeeded: false,
      errorMessage: err instanceof Error ? err.message : 'unknown error',
    })
    throw err
  }
}
