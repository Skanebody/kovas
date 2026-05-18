import { createServerClient } from '@supabase/ssr'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import type { Database } from '@kovas/database/types'
import { validateProEmail } from '@/lib/validation/email'

/** SIRET Luhn valide — aligné sur tools/test-trial-protection.mjs (SNCF test) */
const DEV_BOOTSTRAP_SIRET = '36252187900001'

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient<Database>>,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  let page = 1
  const perPage = 200

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error || !data?.users?.length) return null
    const match = data.users.find((u) => u.email?.toLowerCase() === normalized)
    if (match) return match.id
    if (data.users.length < perPage) return null
    page += 1
  }
}

/**
 * Dev uniquement : crée / resynchronise un compte local et ouvre une session navigateur.
 * Activer avec NODE_ENV=development + KOVAS_DEV_ENTER=1 + variables prefill (cf. .env.example).
 */
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development' || process.env.KOVAS_DEV_ENTER !== '1') {
    return new NextResponse(null, { status: 404 })
  }

  const email = process.env.KOVAS_DEV_LOGIN_PREFILL_EMAIL?.trim() ?? ''
  const password = process.env.KOVAS_DEV_LOGIN_PREFILL_PASSWORD ?? ''

  if (!email || password.length < 8) {
    return NextResponse.json(
      {
        error:
          'Définir KOVAS_DEV_LOGIN_PREFILL_EMAIL et KOVAS_DEV_LOGIN_PREFILL_PASSWORD dans .env.local',
      },
      { status: 500 },
    )
  }

  const emailCheck = validateProEmail(email)
  if (!emailCheck.valid) {
    return NextResponse.json(
      { error: 'Email dev refusé : utiliser un domaine « pro » (ex. @kovas-e2e.fr)' },
      { status: 400 },
    )
  }

  const redirectUrl = new URL('/app/dashboard', request.nextUrl.origin)
  let response = NextResponse.redirect(redirectUrl)

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  const trySignIn = () => supabase.auth.signInWithPassword({ email, password })

  let { error: signInError } = await trySignIn()
  if (!signInError) {
    return response
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Dev KOVAS' },
  })

  const duplicateEmail =
    createError &&
    /already|registered|exists/i.test(createError.message ?? '')

  if (createError && !duplicateEmail) {
    return NextResponse.json({ error: createError.message }, { status: 500 })
  }

  if (created?.user) {
    const { data: profile } = await admin
      .from('profiles')
      .select('default_org_id')
      .eq('id', created.user.id)
      .single()

    const { error: trialError } = await admin.from('cabinet_trials').insert({
      siret: DEV_BOOTSTRAP_SIRET,
      email,
      user_id: created.user.id,
      organization_id: profile?.default_org_id ?? null,
    })

    if (trialError && !/duplicate|unique/i.test(trialError.message ?? '')) {
      console.error('[dev/enter] cabinet_trials insert:', trialError)
    }
  } else if (duplicateEmail) {
    const userId = await findAuthUserIdByEmail(admin, email)
    if (!userId) {
      return NextResponse.json(
        { error: 'Compte existant mais introuvable via Admin API (listUsers).' },
        { status: 500 },
      )
    }
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    })
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }
  }

  const retry = await trySignIn()
  if (retry.error) {
    return NextResponse.json(
      { error: retry.error.message ?? 'Connexion impossible après bootstrap dev.' },
      { status: 401 },
    )
  }

  return response
}
