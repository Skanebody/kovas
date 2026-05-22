// supabase/functions/bandit-decay/index.ts
// Edge Function — applique le decay journalier aux stats bandit annuaire.
// Cron : "0 3 * * *" (chaque jour à 03h UTC = 04h Paris hors heure d'été).
//
// Déclenche RPC public.bandit_apply_decay() côté Postgres.
// Lecture côté admin : nombre de stats mises à jour (utile pour monitoring Sentry).

// @ts-expect-error — Deno globals available at runtime, not in tsconfig
import { createClient } from 'jsr:@supabase/supabase-js@2'
// @ts-expect-error — Deno globals available at runtime, not in tsconfig
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

declare const Deno: {
  env: { get(key: string): string | undefined }
}

interface DecayResponse {
  ok: boolean
  decayed_rows: number
  duration_ms: number
  error?: string
}

serve(async (_req: Request): Promise<Response> => {
  const startedAt = Date.now()

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    const body: DecayResponse = {
      ok: false,
      decayed_rows: 0,
      duration_ms: Date.now() - startedAt,
      error: 'missing_env',
    }
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data, error } = await supabase.rpc('bandit_apply_decay')

  if (error) {
    const body: DecayResponse = {
      ok: false,
      decayed_rows: 0,
      duration_ms: Date.now() - startedAt,
      error: error.message,
    }
    return new Response(JSON.stringify(body), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body: DecayResponse = {
    ok: true,
    decayed_rows: typeof data === 'number' ? data : 0,
    duration_ms: Date.now() - startedAt,
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
