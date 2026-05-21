// Edge Function: compute-diagnostician-activity-score
//
// Recalcule l'activity_score de chaque diagnostiqueur en SQL (un seul UPDATE
// batch, idempotent). Applique ensuite la regle d'auto-promotion du
// validation_status :
//   - score >= 70 + sirene actif + ban precise + status 'unverified'
//     => promotion en 'verified'
//   - sirene 'ceased' (priorite absolue) => 'ceased'
//
// Formule du score (clamp 0-100) :
//   30 si dhup_imported_at IS NOT NULL
// + 25 si sirene_last_synced_at IS NOT NULL AND sirene_state = 'active'
// + 25 si ademe_last_dpe_at >= now() - interval '12 months'
// + 10 si ban_accuracy IN ('housenumber','street')
// + 10 si inpi_last_synced_at IS NOT NULL
//
// Auth: header Authorization: Bearer <SERVICE_ROLE_KEY> ou x-cron-secret.

import { serve } from "https://deno.land/std@0.220.1/http/server.ts";
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.46.0";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RequestMode = "batch" | "single";

interface RequestBody {
  mode?: RequestMode;
  diagnostician_id?: string;
}

interface UpdateRow {
  validation_status: string | null;
  sirene_state: string | null;
}

interface ScoreSummary {
  ok: boolean;
  processed: number;
  verified: number;
  ceased: number;
  pending: number;
  durationMs: number;
}

interface RpcResult {
  processed: number;
  verified: number;
  ceased: number;
  pending: number;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DEFAULT_BATCH_LIMIT = 5000;

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request): boolean {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");

  const auth = req.headers.get("authorization") ?? "";
  if (serviceRoleKey && auth === `Bearer ${serviceRoleKey}`) return true;

  const headerSecret = req.headers.get("x-cron-secret");
  if (cronSecret && headerSecret === cronSecret) return true;

  return false;
}

// ---------------------------------------------------------------------------
// SQL: deux statements idempotents
// ---------------------------------------------------------------------------
//
// Statement 1 — recalcul du score pour le perimetre demande.
// Filtres (perimetre) :
//   - mode=single  -> WHERE id = $1
//   - mode=batch   -> WHERE activity_score IS NULL
//                       OR activity_score_computed_at < now() - interval '24 hours'
//                     ORDER BY activity_score_computed_at NULLS FIRST
//                     LIMIT 5000
//
// Statement 2 — application des regles validation_status :
//   - sirene_state = 'ceased' => 'ceased' (priorite absolue)
//   - score >= 70 + sirene active + ban precise + status unverified
//     => 'verified'
//
// Le SQL est exécuté via la fonction RPC `recompute_diagnostician_activity_score`
// (helper SECURITY DEFINER cote DB, declare dans la migration
// 20260606100000_diagnostician_cross_validation.sql).
//
// Statement 1 (recompute) :
//
//   WITH targets AS (
//     SELECT id
//     FROM diagnosticians
//     WHERE
//       (CASE WHEN p_diagnostician_id IS NOT NULL
//             THEN id = p_diagnostician_id
//             ELSE (activity_score IS NULL
//                   OR activity_score_computed_at < now() - interval '24 hours')
//        END)
//     ORDER BY activity_score_computed_at NULLS FIRST
//     LIMIT CASE WHEN p_diagnostician_id IS NOT NULL THEN 1 ELSE p_limit END
//   )
//   UPDATE diagnosticians d
//   SET
//     activity_score = LEAST(100, GREATEST(0,
//         (CASE WHEN d.dhup_imported_at IS NOT NULL THEN 30 ELSE 0 END)
//       + (CASE WHEN d.sirene_last_synced_at IS NOT NULL
//                AND d.sirene_state = 'active' THEN 25 ELSE 0 END)
//       + (CASE WHEN d.ademe_last_dpe_at IS NOT NULL
//                AND d.ademe_last_dpe_at >= (now() - interval '12 months')
//              THEN 25 ELSE 0 END)
//       + (CASE WHEN d.ban_accuracy IN ('housenumber','street') THEN 10 ELSE 0 END)
//       + (CASE WHEN d.inpi_last_synced_at IS NOT NULL THEN 10 ELSE 0 END)
//     )),
//     activity_score_computed_at = now()
//   FROM targets t
//   WHERE d.id = t.id
//   RETURNING d.id, d.validation_status, d.sirene_state;
//
// Statement 2 (auto-promotion) sur le RETURNING :
//
//   UPDATE diagnosticians d
//   SET
//     validation_status = CASE
//       WHEN d.sirene_state = 'ceased' THEN 'ceased'
//       WHEN d.activity_score >= 70
//            AND d.sirene_state = 'active'
//            AND d.ban_accuracy IN ('housenumber','street')
//            AND d.validation_status = 'unverified'
//         THEN 'verified'
//       ELSE d.validation_status
//     END,
//     validation_status_changed_at = CASE
//       WHEN d.sirene_state = 'ceased' AND d.validation_status <> 'ceased'
//         THEN now()
//       WHEN d.activity_score >= 70
//            AND d.sirene_state = 'active'
//            AND d.ban_accuracy IN ('housenumber','street')
//            AND d.validation_status = 'unverified'
//         THEN now()
//       ELSE d.validation_status_changed_at
//     END,
//     validation_status_reason = CASE
//       WHEN d.sirene_state = 'ceased' AND d.validation_status <> 'ceased'
//         THEN 'auto: sirene ceased'
//       WHEN d.activity_score >= 70
//            AND d.sirene_state = 'active'
//            AND d.ban_accuracy IN ('housenumber','street')
//            AND d.validation_status = 'unverified'
//         THEN 'auto: score >= 70'
//       ELSE d.validation_status_reason
//     END
//   WHERE d.id = ANY(p_target_ids);

async function recomputeViaRpc(
  supabase: SupabaseClient,
  diagnosticianId: string | null,
  limit: number,
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(
    "recompute_diagnostician_activity_score",
    {
      p_diagnostician_id: diagnosticianId,
      p_limit: limit,
    },
  );

  if (error) {
    throw new Error(`rpc_failed: ${error.message}`);
  }

  // La RPC retourne une seule row {processed, verified, ceased, pending}.
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { processed: 0, verified: 0, ceased: 0, pending: 0 };
  }
  return row as RpcResult;
}

// ---------------------------------------------------------------------------
// Fallback TS si la RPC n'est pas encore deployee : recompute + promotion via
// requetes successives (perf inferieure mais identique fonctionnellement).
// ---------------------------------------------------------------------------

async function recomputeViaQueries(
  supabase: SupabaseClient,
  diagnosticianId: string | null,
  limit: number,
): Promise<RpcResult> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 12);
  const ademeFloor = twelveMonthsAgo.toISOString();

  const query = supabase
    .from("diagnosticians")
    .select(
      "id, dhup_imported_at, sirene_last_synced_at, sirene_state, ademe_last_dpe_at, ban_accuracy, inpi_last_synced_at, validation_status, validation_status_reason",
    );

  if (diagnosticianId) {
    query.eq("id", diagnosticianId);
  } else {
    query
      .or(`activity_score.is.null,activity_score_computed_at.lt.${cutoff}`)
      .order("activity_score_computed_at", {
        ascending: true,
        nullsFirst: true,
      })
      .limit(limit);
  }

  const { data: rows, error } = await query;
  if (error) {
    throw new Error(`fetch_failed: ${error.message}`);
  }

  let processed = 0;
  let verified = 0;
  let ceased = 0;
  let pending = 0;

  for (const row of rows ?? []) {
    const typed = row as {
      id: string;
      dhup_imported_at: string | null;
      sirene_last_synced_at: string | null;
      sirene_state: string | null;
      ademe_last_dpe_at: string | null;
      ban_accuracy: string | null;
      inpi_last_synced_at: string | null;
      validation_status: string | null;
      validation_status_reason: string | null;
    };

    const score = Math.max(
      0,
      Math.min(
        100,
        (typed.dhup_imported_at ? 30 : 0) +
          (typed.sirene_last_synced_at && typed.sirene_state === "active"
            ? 25
            : 0) +
          (typed.ademe_last_dpe_at && typed.ademe_last_dpe_at >= ademeFloor
            ? 25
            : 0) +
          (typed.ban_accuracy === "housenumber" ||
          typed.ban_accuracy === "street"
            ? 10
            : 0) +
          (typed.inpi_last_synced_at ? 10 : 0),
      ),
    );

    // Determine nouveau validation_status.
    const banPrecise =
      typed.ban_accuracy === "housenumber" ||
      typed.ban_accuracy === "street";

    let newStatus = typed.validation_status;
    let newReason = typed.validation_status_reason;
    let statusChanged = false;

    if (typed.sirene_state === "ceased") {
      if (typed.validation_status !== "ceased") {
        newStatus = "ceased";
        newReason = "auto: sirene ceased";
        statusChanged = true;
      }
    } else if (
      score >= 70 &&
      typed.sirene_state === "active" &&
      banPrecise &&
      typed.validation_status === "unverified"
    ) {
      newStatus = "verified";
      newReason = "auto: score >= 70";
      statusChanged = true;
    }

    const payload: Record<string, unknown> = {
      activity_score: score,
      activity_score_computed_at: new Date().toISOString(),
    };
    if (statusChanged) {
      payload.validation_status = newStatus;
      payload.validation_status_changed_at = new Date().toISOString();
      payload.validation_status_reason = newReason;
    }

    const { error: updateError } = await supabase
      .from("diagnosticians")
      .update(payload)
      .eq("id", typed.id);

    if (updateError) {
      throw new Error(`update_failed: ${updateError.message}`);
    }

    processed += 1;
    if (newStatus === "verified") verified += 1;
    else if (newStatus === "ceased") ceased += 1;
    else pending += 1;
  }

  return { processed, verified, ceased, pending };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }
  if (!isAuthorized(req)) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      { ok: false, error: "missing_supabase_env" },
      500,
    );
  }

  let body: RequestBody = {};
  try {
    if (req.headers.get("content-length") !== "0") {
      body = (await req.json()) as RequestBody;
    }
  } catch {
    body = {};
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const startedAt = Date.now();
  const mode: RequestMode = body.mode ?? "batch";
  const targetId = mode === "single" ? body.diagnostician_id ?? null : null;
  const limit = DEFAULT_BATCH_LIMIT;

  if (mode === "single" && !targetId) {
    return jsonResponse(
      { ok: false, error: "missing_diagnostician_id" },
      400,
    );
  }

  let result: RpcResult;
  try {
    // Tentative RPC (rapide, un seul aller-retour).
    result = await recomputeViaRpc(supabase, targetId, limit);
  } catch (rpcErr) {
    // Fallback queries TS si la RPC n'existe pas encore en base.
    const message = rpcErr instanceof Error ? rpcErr.message : String(rpcErr);
    if (
      message.includes("rpc_failed") &&
      (message.includes("not exist") ||
        message.includes("404") ||
        message.includes("not found"))
    ) {
      try {
        result = await recomputeViaQueries(supabase, targetId, limit);
      } catch (fallbackErr) {
        const fallbackMessage =
          fallbackErr instanceof Error
            ? fallbackErr.message
            : String(fallbackErr);
        return jsonResponse(
          { ok: false, error: fallbackMessage },
          500,
        );
      }
    } else {
      return jsonResponse({ ok: false, error: message }, 500);
    }
  }

  // diagnostician_cross_validation_logs : on trace les batchs avec
  // diagnostician_id NULL n'est pas autorise par le schema actuel.
  // On log uniquement en mode 'single'.
  if (targetId) {
    await supabase.from("diagnostician_cross_validation_logs").insert({
      diagnostician_id: targetId,
      source: "ACTIVITY_SCORE",
      outcome: "matched",
      payload: result as unknown as Record<string, unknown>,
    });
  }

  const summary: ScoreSummary = {
    ok: true,
    processed: result.processed,
    verified: result.verified,
    ceased: result.ceased,
    pending: result.pending,
    durationMs: Date.now() - startedAt,
  };
  return jsonResponse(summary);
}

serve(handleRequest);

// ---------------------------------------------------------------------------
// SQL de reference pour la RPC (a creer cote migration DB) :
// ---------------------------------------------------------------------------
//
// CREATE OR REPLACE FUNCTION recompute_diagnostician_activity_score(
//   p_diagnostician_id uuid DEFAULT NULL,
//   p_limit int DEFAULT 5000
// )
// RETURNS TABLE(processed int, verified int, ceased int, pending int)
// LANGUAGE plpgsql
// SECURITY DEFINER
// SET search_path = public
// AS $$
// DECLARE
//   v_target_ids uuid[];
// BEGIN
//   -- Statement 1: selection + recalcul du score
//   WITH targets AS (
//     SELECT id
//     FROM diagnosticians d
//     WHERE
//       (p_diagnostician_id IS NOT NULL AND d.id = p_diagnostician_id)
//       OR (
//         p_diagnostician_id IS NULL AND (
//           d.activity_score IS NULL
//           OR d.activity_score_computed_at < now() - interval '24 hours'
//         )
//       )
//     ORDER BY d.activity_score_computed_at NULLS FIRST
//     LIMIT CASE WHEN p_diagnostician_id IS NOT NULL THEN 1 ELSE p_limit END
//   ),
//   updated AS (
//     UPDATE diagnosticians d
//     SET
//       activity_score = LEAST(100, GREATEST(0,
//         (CASE WHEN d.dhup_imported_at IS NOT NULL THEN 30 ELSE 0 END)
//       + (CASE WHEN d.sirene_last_synced_at IS NOT NULL
//                AND d.sirene_state = 'active' THEN 25 ELSE 0 END)
//       + (CASE WHEN d.ademe_last_dpe_at IS NOT NULL
//                AND d.ademe_last_dpe_at >= (now() - interval '12 months')
//               THEN 25 ELSE 0 END)
//       + (CASE WHEN d.ban_accuracy IN ('housenumber','street') THEN 10 ELSE 0 END)
//       + (CASE WHEN d.inpi_last_synced_at IS NOT NULL THEN 10 ELSE 0 END)
//       )),
//       activity_score_computed_at = now()
//     FROM targets t
//     WHERE d.id = t.id
//     RETURNING d.id
//   )
//   SELECT array_agg(id) INTO v_target_ids FROM updated;
//
//   -- Statement 2: auto-promotion validation_status
//   UPDATE diagnosticians d
//   SET
//     validation_status = CASE
//       WHEN d.sirene_state = 'ceased' THEN 'ceased'
//       WHEN d.activity_score >= 70
//            AND d.sirene_state = 'active'
//            AND d.ban_accuracy IN ('housenumber','street')
//            AND d.validation_status = 'unverified'
//         THEN 'verified'
//       ELSE d.validation_status
//     END,
//     validation_status_changed_at = CASE
//       WHEN d.sirene_state = 'ceased' AND d.validation_status <> 'ceased'
//         THEN now()
//       WHEN d.activity_score >= 70
//            AND d.sirene_state = 'active'
//            AND d.ban_accuracy IN ('housenumber','street')
//            AND d.validation_status = 'unverified'
//         THEN now()
//       ELSE d.validation_status_changed_at
//     END,
//     validation_status_reason = CASE
//       WHEN d.sirene_state = 'ceased' AND d.validation_status <> 'ceased'
//         THEN 'auto: sirene ceased'
//       WHEN d.activity_score >= 70
//            AND d.sirene_state = 'active'
//            AND d.ban_accuracy IN ('housenumber','street')
//            AND d.validation_status = 'unverified'
//         THEN 'auto: score >= 70'
//       ELSE d.validation_status_reason
//     END
//   WHERE d.id = ANY(v_target_ids);
//
//   RETURN QUERY
//     SELECT
//       COALESCE(array_length(v_target_ids, 1), 0) AS processed,
//       (SELECT COUNT(*)::int FROM diagnosticians
//          WHERE id = ANY(v_target_ids) AND validation_status = 'verified') AS verified,
//       (SELECT COUNT(*)::int FROM diagnosticians
//          WHERE id = ANY(v_target_ids) AND validation_status = 'ceased') AS ceased,
//       (SELECT COUNT(*)::int FROM diagnosticians
//          WHERE id = ANY(v_target_ids)
//          AND validation_status NOT IN ('verified','ceased')) AS pending;
// END;
// $$;
