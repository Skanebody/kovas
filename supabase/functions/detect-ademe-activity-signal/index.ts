// Edge Function: detect-ademe-activity-signal
//
// Detecte le signal d'activite reelle d'un diagnostiqueur en interrogeant
// l'API publique ADEME (dataset dpe-v2-logements-existants) sur les 12
// derniers mois, soit via le numero de certificat DPE, soit via le couple
// nom + prenom (fallback).
//
// Met a jour les colonnes diagnosticians.{ademe_dpe_count_12mo,
// ademe_last_dpe_at, ademe_last_synced_at} et trace l'execution dans
// diagnostician_cross_validation_logs.
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
  limit?: number;
  diagnostician_id?: string;
}

interface DiagnosticianRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface CertificationRow {
  certification_number: string;
}

interface AdemeLine {
  numero_dpe?: string;
  date_etablissement_dpe?: string;
  nom_du_diagnostiqueur?: string;
  prenom_du_diagnostiqueur?: string;
  numero_diagnostiqueur_certificat?: string;
  etiquette_dpe?: string;
}

interface AdemeLineResponse {
  total: number;
  next?: string;
  results: AdemeLine[];
}

interface DetectionOutcome {
  dpeCount: number;
  lastDpeAt: string | null;
  outcome: "matched" | "not_found" | "error";
  errorMessage?: string;
}

interface BatchSummary {
  ok: boolean;
  processed: number;
  withActivity: number;
  withoutActivity: number;
  errors: number;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ADEME_ENDPOINT =
  "https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines";
const DEFAULT_BATCH_LIMIT = 100;
const MAX_BATCH_LIMIT = 500;
const PAGE_SIZE = 1000;
// Limite conservatrice (l'API ne publie pas de quota officiel).
const RATE_LIMIT_DELAY_MS = 200;

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildIsoTwelveMonthsAgo(): string {
  const now = new Date();
  const past = new Date(now);
  past.setUTCMonth(past.getUTCMonth() - 12);
  return past.toISOString().slice(0, 10);
}

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
  if (serviceRoleKey && auth === `Bearer ${serviceRoleKey}`) {
    return true;
  }

  const headerSecret = req.headers.get("x-cron-secret");
  if (cronSecret && headerSecret === cronSecret) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Acces ADEME
// ---------------------------------------------------------------------------

async function fetchAdemeByCertificate(
  certNumber: string,
  fromDate: string,
): Promise<AdemeLine[]> {
  const url = new URL(ADEME_ENDPOINT);
  url.searchParams.set("q_fields", "numero_diagnostiqueur_certificat");
  url.searchParams.set("q", `"${certNumber}"`);
  url.searchParams.set("qs", `date_etablissement_dpe:>${fromDate}`);
  url.searchParams.set("size", String(PAGE_SIZE));
  url.searchParams.set(
    "select",
    "numero_dpe,date_etablissement_dpe,numero_diagnostiqueur_certificat,nom_du_diagnostiqueur,prenom_du_diagnostiqueur,etiquette_dpe",
  );

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`ADEME HTTP ${res.status} (cert=${certNumber})`);
  }
  const data = (await res.json()) as AdemeLineResponse;
  return data.results ?? [];
}

async function fetchAdemeByName(
  firstName: string,
  lastName: string,
  fromDate: string,
): Promise<AdemeLine[]> {
  const url = new URL(ADEME_ENDPOINT);
  url.searchParams.set(
    "q_fields",
    "nom_du_diagnostiqueur,prenom_du_diagnostiqueur",
  );
  url.searchParams.set("q", `"${lastName}" "${firstName}"`);
  url.searchParams.set("qs", `date_etablissement_dpe:>${fromDate}`);
  url.searchParams.set("size", String(PAGE_SIZE));
  url.searchParams.set(
    "select",
    "numero_dpe,date_etablissement_dpe,numero_diagnostiqueur_certificat,nom_du_diagnostiqueur,prenom_du_diagnostiqueur,etiquette_dpe",
  );

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `ADEME HTTP ${res.status} (name=${lastName} ${firstName})`,
    );
  }
  const data = (await res.json()) as AdemeLineResponse;
  return data.results ?? [];
}

// ---------------------------------------------------------------------------
// Detection par diagnostiqueur
// ---------------------------------------------------------------------------

function aggregate(lines: AdemeLine[]): { count: number; last: string | null } {
  let count = 0;
  let last: string | null = null;
  for (const line of lines) {
    const date = line.date_etablissement_dpe;
    if (!date) continue;
    count += 1;
    if (last === null || date > last) {
      last = date;
    }
  }
  return { count, last };
}

async function detectForDiagnostician(
  supabase: SupabaseClient,
  diagnostician: DiagnosticianRow,
  fromDate: string,
): Promise<DetectionOutcome> {
  try {
    const { data: certs, error: certsError } = await supabase
      .from("diagnostician_certifications")
      .select("certification_number")
      .eq("diagnostician_id", diagnostician.id)
      .eq("certification_type", "DPE")
      .eq("status", "valid");

    if (certsError) {
      return {
        dpeCount: 0,
        lastDpeAt: null,
        outcome: "error",
        errorMessage: certsError.message,
      };
    }

    const certifications = (certs ?? []) as CertificationRow[];

    // Dedup par numero_dpe pour eviter doublons cross-strategie.
    const merged = new Map<string, AdemeLine>();

    for (const cert of certifications) {
      const num = cert.certification_number?.trim();
      if (!num) continue;
      const lines = await fetchAdemeByCertificate(num, fromDate);
      for (const line of lines) {
        const key = line.numero_dpe ?? `${num}:${line.date_etablissement_dpe}`;
        if (!merged.has(key)) merged.set(key, line);
      }
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    // Fallback nom + prenom uniquement si certificat n'a rien ramene.
    if (
      merged.size === 0 &&
      diagnostician.first_name &&
      diagnostician.last_name
    ) {
      const lines = await fetchAdemeByName(
        diagnostician.first_name,
        diagnostician.last_name,
        fromDate,
      );
      for (const line of lines) {
        const key =
          line.numero_dpe ??
          `${diagnostician.last_name}:${line.date_etablissement_dpe}`;
        if (!merged.has(key)) merged.set(key, line);
      }
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    const { count, last } = aggregate(Array.from(merged.values()));

    const lastIso = last ? new Date(last).toISOString() : null;

    const { error: updateError } = await supabase
      .from("diagnosticians")
      .update({
        ademe_dpe_count_12mo: count,
        ademe_last_dpe_at: lastIso,
        ademe_last_synced_at: new Date().toISOString(),
      })
      .eq("id", diagnostician.id);

    if (updateError) {
      return {
        dpeCount: count,
        lastDpeAt: lastIso,
        outcome: "error",
        errorMessage: updateError.message,
      };
    }

    return {
      dpeCount: count,
      lastDpeAt: lastIso,
      outcome: count > 0 ? "matched" : "not_found",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      dpeCount: 0,
      lastDpeAt: null,
      outcome: "error",
      errorMessage: message,
    };
  }
}

async function logOutcome(
  supabase: SupabaseClient,
  diagnosticianId: string,
  detection: DetectionOutcome,
): Promise<void> {
  await supabase.from("diagnostician_cross_validation_logs").insert({
    diagnostician_id: diagnosticianId,
    source: "ADEME",
    outcome: detection.outcome,
    payload: {
      dpe_count_12mo: detection.dpeCount,
      last_dpe_at: detection.lastDpeAt,
      error: detection.errorMessage ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Handler principal
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
  const fromDate = buildIsoTwelveMonthsAgo();
  const mode: RequestMode = body.mode ?? "batch";

  let targets: DiagnosticianRow[] = [];

  if (mode === "single") {
    if (!body.diagnostician_id) {
      return jsonResponse(
        { ok: false, error: "missing_diagnostician_id" },
        400,
      );
    }
    const { data, error } = await supabase
      .from("diagnosticians")
      .select("id, first_name, last_name")
      .eq("id", body.diagnostician_id)
      .single();
    if (error || !data) {
      return jsonResponse(
        { ok: false, error: "diagnostician_not_found" },
        404,
      );
    }
    targets = [data as DiagnosticianRow];
  } else {
    const requestedLimit = Math.min(
      Math.max(body.limit ?? DEFAULT_BATCH_LIMIT, 1),
      MAX_BATCH_LIMIT,
    );
    const cutoff = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data, error } = await supabase
      .from("diagnosticians")
      .select("id, first_name, last_name")
      .or(
        `ademe_last_synced_at.is.null,ademe_last_synced_at.lt.${cutoff}`,
      )
      .order("ademe_last_synced_at", {
        ascending: true,
        nullsFirst: true,
      })
      .limit(requestedLimit);
    if (error) {
      return jsonResponse(
        { ok: false, error: error.message },
        500,
      );
    }
    targets = (data ?? []) as DiagnosticianRow[];
  }

  let processed = 0;
  let withActivity = 0;
  let withoutActivity = 0;
  let errors = 0;

  for (const diagnostician of targets) {
    const detection = await detectForDiagnostician(
      supabase,
      diagnostician,
      fromDate,
    );
    await logOutcome(supabase, diagnostician.id, detection);
    processed += 1;
    if (detection.outcome === "matched") withActivity += 1;
    else if (detection.outcome === "not_found") withoutActivity += 1;
    else errors += 1;
  }

  const summary: BatchSummary = {
    ok: true,
    processed,
    withActivity,
    withoutActivity,
    errors,
    durationMs: Date.now() - startedAt,
  };
  return jsonResponse(summary);
}

serve(handleRequest);
