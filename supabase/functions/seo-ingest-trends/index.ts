// ============================================
// KOVAS App — Edge Function : seo-ingest-trends
//
// Mission : remonter le trend_score Google Trends (0-100) sur les 30 derniers
//   jours pour ~50 keywords d'amorcage immobilier diagnostic FR, et alimenter
//   les tables seo_keywords + seo_keyword_signals + seo_sources.
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: pg_cron hebdomadaire (mardi 03:00 UTC) + appels admin manuels.
//
// Source : Google Trends n'a pas d'API officielle gratuite. On utilise un
//   proxy SerpAPI (engine=google_trends) si SERPAPI_API_KEY present. Sinon
//   mode mock (trend_score aleatoire 30-90).
//
// Signaux emis par keyword :
//   - source_code='google_trends', signal_type='trend', signal_value=score (0-100)
//
// Variables env :
//   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (admin)
//   - CRON_SECRET (auth alternative cron)
//   - SERPAPI_API_KEY (cle SerpAPI, optionnelle — mode mock sinon)
//   - GOOGLE_TRENDS_API_URL (override URL endpoint, defaut SerpAPI)
//   - SERPAPI_THROTTLE_MS (defaut 1200ms, anti-rate-limit)
// ============================================

import { serve } from "https://deno.land/std@0.220.1/http/server.ts";
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.46.0";

// ============================================
// Types
// ============================================

interface RequestBody {
  /** Liste de keywords additionnels a interroger (en plus des 50 seeds). */
  additionalKeywords?: string[];
  /** Geo code (defaut FR). */
  geo?: string;
}

interface SerpapiTrendsTimelineValue {
  query?: string;
  value: number;
  extracted_value?: number;
}

interface SerpapiTrendsTimelineData {
  date: string;
  timestamp: string;
  values: SerpapiTrendsTimelineValue[];
}

interface SerpapiTrendsResponse {
  interest_over_time?: {
    timeline_data?: SerpapiTrendsTimelineData[];
  };
  search_metadata?: { status?: string };
  error?: string;
}

type KeywordCategory =
  | "dpe"
  | "amiante"
  | "plomb"
  | "gaz"
  | "electricite"
  | "termites"
  | "carrez"
  | "erp"
  | "general";

interface KeywordCategoryInput {
  display: string;
  category: KeywordCategory;
  geo_scope?: string | null;
  language?: string;
  intent_type?: string | null;
}

interface RunSummary {
  ok: boolean;
  mock: boolean;
  keywords: number;
  signals: number;
  durationMs: number;
  ingestion_run_id: string;
  error?: string;
}

// ============================================
// Helpers communs
// ============================================

function normalizeKeyword(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectCategory(query: string): KeywordCategory {
  const q = normalizeKeyword(query);
  if (/\b(amiante)\b/.test(q)) return "amiante";
  if (/\b(plomb|crep)\b/.test(q)) return "plomb";
  if (/\b(termites?)\b/.test(q)) return "termites";
  if (/\b(gaz)\b/.test(q)) return "gaz";
  if (/\b(electric(ite|ity|ique)|electrique)\b/.test(q)) return "electricite";
  if (/\b(carrez|boutin|surface)\b/.test(q)) return "carrez";
  if (/\b(erp|etat des risques|georisques?)\b/.test(q)) return "erp";
  if (/\b(dpe|diagnostic de performance|performance energetique)\b/.test(q)) {
    return "dpe";
  }
  return "general";
}

async function upsertKeyword(
  supabase: SupabaseClient,
  kw: KeywordCategoryInput,
): Promise<string> {
  const normalized = normalizeKeyword(kw.display);
  const { data, error } = await supabase
    .from("seo_keywords")
    .upsert(
      {
        keyword_normalized: normalized,
        keyword_display: kw.display,
        language: kw.language ?? "fr",
        geo_scope: kw.geo_scope ?? null,
        category: kw.category,
        intent_type: kw.intent_type ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "keyword_normalized" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`upsertKeyword failed: ${error.message}`);
  if (!data) throw new Error("upsertKeyword returned no row");
  return data.id as string;
}

interface SignalInsert {
  keyword_id: string;
  source_code: string;
  signal_value: number;
  signal_type: string;
  metadata?: Record<string, unknown>;
  ingestion_run_id: string;
}

async function insertSignal(
  supabase: SupabaseClient,
  params: SignalInsert,
): Promise<void> {
  const { error } = await supabase.from("seo_keyword_signals").insert({
    keyword_id: params.keyword_id,
    source_code: params.source_code,
    signal_value: params.signal_value,
    signal_type: params.signal_type,
    metadata: params.metadata ?? {},
    ingestion_run_id: params.ingestion_run_id,
    captured_at: new Date().toISOString(),
  });
  if (error) throw new Error(`insertSignal failed: ${error.message}`);
}

async function bumpSourceCounter(
  supabase: SupabaseClient,
  sourceCode: string,
  addedSignals: number,
): Promise<void> {
  const { data, error } = await supabase
    .from("seo_sources")
    .select("total_signals_count")
    .eq("code", sourceCode)
    .maybeSingle();
  if (error) {
    console.warn(`bumpSourceCounter read failed: ${error.message}`);
    return;
  }
  const nowIso = new Date().toISOString();
  if (!data) {
    const { error: upErr } = await supabase.from("seo_sources").upsert(
      {
        code: sourceCode,
        display_name: sourceCode,
        weight: 1,
        last_ingested_at: nowIso,
        total_signals_count: addedSignals,
      },
      { onConflict: "code" },
    );
    if (upErr) console.warn(`bumpSourceCounter insert failed: ${upErr.message}`);
    return;
  }
  const current = (data.total_signals_count as number | undefined) ?? 0;
  const { error: updErr } = await supabase
    .from("seo_sources")
    .update({
      last_ingested_at: nowIso,
      total_signals_count: current + addedSignals,
    })
    .eq("code", sourceCode);
  if (updErr) console.warn(`bumpSourceCounter update failed: ${updErr.message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// Liste de 50 keywords d'amorcage (top intent immobilier diagnostic FR)
// ============================================

const SEED_KEYWORDS_50: string[] = [
  // DPE
  "dpe paris",
  "dpe lyon",
  "dpe vente obligatoire",
  "dpe location obligatoire",
  "dpe prix",
  "dpe maison ancienne",
  "dpe appartement",
  "etiquette dpe f g",
  "audit energetique obligatoire",
  "dpe collectif copropriete",
  // Amiante
  "amiante avant 1997",
  "diagnostic amiante prix",
  "amiante toiture",
  "amiante dalle vinyle",
  "reperage amiante avant travaux",
  // Plomb
  "diagnostic plomb crep",
  "plomb peinture immeuble",
  "crep duree validite",
  // Gaz
  "diagnostic gaz copropriete",
  "diagnostic gaz prix",
  "duree validite diagnostic gaz",
  // Electricite
  "diagnostic electricite obligatoire",
  "diagnostic electricite location",
  "duree validite diagnostic electrique",
  // Termites
  "termites definition",
  "diagnostic termites zone",
  "termites prefecture arrete",
  // Carrez / Boutin
  "loi carrez calcul",
  "loi carrez vs boutin",
  "surface habitable boutin",
  // ERP
  "etat des risques erp",
  "georisques etat des risques",
  "erp obligatoire vente",
  // Geo principales
  "diagnostic immobilier paris",
  "diagnostic immobilier lyon",
  "diagnostic immobilier marseille",
  "diagnostic immobilier bordeaux",
  "diagnostic immobilier toulouse",
  "diagnostic immobilier lille",
  "diagnostic immobilier dieppe",
  "diagnostic immobilier rouen",
  "diagnostic immobilier nantes",
  // Generaux
  "diagnostic obligatoire vente",
  "diagnostic obligatoire location",
  "diagnostic immobilier prix",
  "diagnostic immobilier en ligne",
  "logiciel diagnostiqueur",
  "logiciel dpe",
  "certification diagnostiqueur",
  "diagnostiqueur immobilier independant",
  "tarif diagnostic immobilier 2026",
];

// ============================================
// Appel SerpAPI Google Trends
// ============================================

async function fetchSerpapiTrendScore(
  apiKey: string,
  endpoint: string,
  keyword: string,
  geo: string,
): Promise<number | null> {
  // Period "today 1-m" = 30 derniers jours
  const url = new URL(endpoint);
  url.searchParams.set("engine", "google_trends");
  url.searchParams.set("q", keyword);
  url.searchParams.set("geo", geo);
  url.searchParams.set("data_type", "TIMESERIES");
  url.searchParams.set("date", "today 1-m");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`SerpAPI ${res.status}: ${txt.substring(0, 200)}`);
  }
  const data = (await res.json()) as SerpapiTrendsResponse;
  if (data.error) throw new Error(`SerpAPI error: ${data.error}`);

  const timeline = data.interest_over_time?.timeline_data ?? [];
  if (timeline.length === 0) return null;

  // Moyenne sur les 30 jours
  let sum = 0;
  let count = 0;
  for (const point of timeline) {
    const v = point.values?.[0]?.extracted_value ?? point.values?.[0]?.value;
    if (typeof v === "number" && Number.isFinite(v)) {
      sum += v;
      count += 1;
    }
  }
  if (count === 0) return null;
  return Math.round((sum / count) * 100) / 100;
}

function mockTrendScore(): number {
  // Score pseudo-aleatoire 30-90 (cohérent avec un trend FR moyennement actif)
  return Math.round(30 + Math.random() * 60);
}

// ============================================
// Handler principal
// ============================================

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const t0 = Date.now();
  const ingestionRunId = crypto.randomUUID();

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const cronSecretHeader = req.headers.get("x-cron-secret") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";

    const isServiceRole = serviceKey && authHeader === `Bearer ${serviceKey}`;
    const isCron = cronSecret && cronSecretHeader === cronSecret;
    if (!isServiceRole && !isCron) {
      return jsonResponse(401, { ok: false, error: "unauthorized" });
    }

    // --- Body ---
    let body: RequestBody = {};
    try {
      const raw = await req.text();
      if (raw) body = JSON.parse(raw) as RequestBody;
    } catch {
      return jsonResponse(400, { ok: false, error: "invalid json body" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse(500, {
        ok: false,
        error: "missing supabase env (SUPABASE_URL/SERVICE_ROLE_KEY)",
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const geo = body.geo ?? "FR";
    const keywords = Array.from(
      new Set(
        [...SEED_KEYWORDS_50, ...(body.additionalKeywords ?? [])].map((k) =>
          k.trim(),
        ),
      ),
    ).filter((k) => k.length > 0);

    const apiKey = Deno.env.get("SERPAPI_API_KEY") ?? "";
    const endpoint =
      Deno.env.get("GOOGLE_TRENDS_API_URL") ?? "https://serpapi.com/search.json";
    const throttleMs = Number.parseInt(
      Deno.env.get("SERPAPI_THROTTLE_MS") ?? "1200",
      10,
    );

    const mock = !apiKey;
    if (mock) {
      console.warn(
        "seo-ingest-trends : SERPAPI_API_KEY absent — bascule mode mock (scores aleatoires 30-90)",
      );
    }

    let signalsInserted = 0;
    const errors: string[] = [];

    for (const keyword of keywords) {
      try {
        const keywordId = await upsertKeyword(supabase, {
          display: keyword,
          category: detectCategory(keyword),
          language: "fr",
          geo_scope: geo,
        });

        let trendScore: number | null = null;
        const meta: Record<string, unknown> = { geo, period: "today 1-m" };

        if (mock) {
          trendScore = mockTrendScore();
          meta.mock = true;
        } else {
          trendScore = await fetchSerpapiTrendScore(
            apiKey,
            endpoint,
            keyword,
            geo,
          );
          if (throttleMs > 0) await sleep(throttleMs);
        }

        if (trendScore !== null) {
          await insertSignal(supabase, {
            keyword_id: keywordId,
            source_code: "google_trends",
            signal_value: trendScore,
            signal_type: "trend",
            metadata: meta,
            ingestion_run_id: ingestionRunId,
          });
          signalsInserted += 1;
        }
      } catch (err) {
        errors.push(`${keyword}: ${(err as Error).message}`);
      }
    }

    await bumpSourceCounter(supabase, "google_trends", signalsInserted);

    const summary: RunSummary = {
      ok: true,
      mock,
      keywords: keywords.length,
      signals: signalsInserted,
      durationMs: Date.now() - t0,
      ingestion_run_id: ingestionRunId,
    };
    if (errors.length > 0) {
      summary.error = `${errors.length} erreurs partielles: ${errors.slice(0, 3).join(" | ")}`;
    }
    return jsonResponse(200, summary as unknown as Record<string, unknown>);
  } catch (err) {
    return jsonResponse(200, {
      ok: false,
      error: (err as Error).message,
      durationMs: Date.now() - t0,
      ingestion_run_id: ingestionRunId,
    });
  }
});

// ============================================
// Setup cron hebdomadaire (mardi 03:00 UTC) :
//
//   SELECT cron.schedule(
//     'seo-ingest-trends-weekly',
//     '0 3 * * 2',
//     $$
//     SELECT net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/seo-ingest-trends',
//       headers := jsonb_build_object(
//         'Content-Type', 'application/json',
//         'x-cron-secret', current_setting('app.cron_secret', true)
//       ),
//       body := '{}'::jsonb
//     );
//     $$
//   );
// ============================================
