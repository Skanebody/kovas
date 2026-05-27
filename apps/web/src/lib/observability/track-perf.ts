/**
 * Helper d'instrumentation des opérations non-IA (export ZIP, génération PDF, etc.).
 *
 * Usage :
 *   const result = await trackPerf(
 *     { operation: 'export_zip_liciel', organizationId: org.id },
 *     async () => buildZip(missionId),
 *   )
 *
 * Insère une ligne dans `perf_metrics` avec status success/error/timeout.
 * Best-effort : si l'insert échoue, on log l'erreur et on n'interrompt pas
 * le flux applicatif (l'observabilité ne doit jamais casser la prod).
 *
 * Côté serveur uniquement (service_role).
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'

interface TrackPerfParams {
  operation: string
  organizationId?: string | null
  /** Métadonnées optionnelles (sera stockée en jsonb) */
  metadata?: Record<string, unknown>
}

interface PerfMetricInsertRow {
  operation: string
  duration_ms: number
  status: 'success' | 'error' | 'timeout'
  organization_id: string | null
  error_code: string | null
  metadata: Record<string, unknown> | null
}

async function insertPerfMetric(row: PerfMetricInsertRow): Promise<void> {
  try {
    const supabase = createAdminClient()
    await (
      supabase.from('perf_metrics') as unknown as {
        insert: (r: PerfMetricInsertRow) => Promise<{ error: { message: string } | null }>
      }
    ).insert(row)
  } catch (err) {
    // best-effort : on log mais on ne propage pas
    console.error('[trackPerf] insert failed', err)
  }
}

export async function trackPerf<T>(params: TrackPerfParams, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - start
    await insertPerfMetric({
      operation: params.operation,
      duration_ms: duration,
      status: 'success',
      organization_id: params.organizationId ?? null,
      error_code: null,
      metadata: params.metadata ?? null,
    })
    return result
  } catch (err) {
    const duration = Date.now() - start
    const errorCode =
      err instanceof Error ? err.name : typeof err === 'string' ? err.slice(0, 64) : 'unknown_error'
    await insertPerfMetric({
      operation: params.operation,
      duration_ms: duration,
      status: duration > 30000 ? 'timeout' : 'error',
      organization_id: params.organizationId ?? null,
      error_code: errorCode,
      metadata: params.metadata ?? null,
    })
    throw err
  }
}
