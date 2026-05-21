/**
 * KOVAS — Tracker d'events comportementaux pour l'upsell intelligent (L1).
 *
 * À appeler depuis les routes API server-side / server actions quand on
 * observe un comportement utilisateur pertinent pour les règles de trigger.
 *
 * Fail-soft : un échec d'insert ne doit JAMAIS bloquer le flux métier
 * (logique : on log un warning et on continue).
 *
 * Cf. supabase/migrations/20260605100000_upsell_system.sql
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type BehaviorEventType =
  | 'mission_created'
  | 'mission_exported'
  | 'invoice_created'
  | 'invoice_emitted'
  | 'invoice_paid'
  | 'devis_created'
  | 'devis_sent'
  | 'lead_received'
  | 'lead_responded'
  | 'lead_ignored'
  | 'pennylane_attempted'
  | 'analytics_attempted'
  | 'cockpit_m2_attempted'
  | 'bilingual_report_attempted'
  | 'signature_attempted'
  | 'whisper_quota_80pct'
  | 'storage_quota_80pct'
  | 'missions_quota_80pct'
  | 'vision_quota_80pct'

export interface TrackEventOptions {
  organizationId?: string | null
  eventData?: Record<string, unknown>
}

/**
 * Insère un event comportemental. Ne lève jamais : en cas d'échec on logge.
 *
 * Usage :
 *   await trackBehaviorEvent(supabase, user.id, 'mission_created', {
 *     organizationId: orgId,
 *     eventData: { missionId },
 *   })
 */
export async function trackBehaviorEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: BehaviorEventType,
  options: TrackEventOptions = {},
): Promise<void> {
  try {
    const { error } = await (supabase as unknown as {
      from(table: 'user_behavior_events'): {
        insert(payload: {
          user_id: string
          organization_id: string | null
          event_type: string
          event_data: Record<string, unknown> | null
        }): Promise<{ error: unknown }>
      }
    })
      .from('user_behavior_events')
      .insert({
        user_id: userId,
        organization_id: options.organizationId ?? null,
        event_type: eventType,
        event_data: options.eventData ?? null,
      })
    if (error) {
      // Logique fail-soft : un event manqué ne casse jamais le flux métier.
      console.warn('[trackBehaviorEvent] insert failed', { eventType, error })
    }
  } catch (err) {
    console.warn('[trackBehaviorEvent] threw', { eventType, err })
  }
}
