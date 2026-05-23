import { getCurrentUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

interface PriorityAlert {
  key: string
  priority: 'P1' | 'P2' | 'P3'
  title: string
  meta: string
  cta: string
  href: string
}

/**
 * Section 06 — Priorités.
 *
 * Agrège des alertes multi-sources en 3 niveaux de priorité (P1 critique /
 * P2 important / P3 info utile). Style mockup data-dense : grid 3 colonnes
 * (badge priority / content / action) avec bordures 1px entre items.
 *
 * Sources :
 *   P1 — regulatory_notifications.severity='critical' non lue,
 *        litigation_workflows.status IN ('opened','in_progress') >48h,
 *        ademe_prevalidations status='completed' avec quality_score<0.5
 *   P2 — quotes.status='sent' avec valid_until -7j,
 *        invoices.status='overdue' due_date passée,
 *        missions.status='done' >24h (à valider)
 *   P3 — module_trials.trial_ends_at <7j
 *
 * Tri : P1 d'abord, puis P2, puis P3. Limite 6 items totaux pour ne pas
 * surcharger. Si 0 alerte : état vide sobre "Aucune priorité — vous êtes à jour."
 *
 * AUDIT-B (2026-05-23) : sweep colonnes legacy + tables manquantes.
 *  - `regulatory_notifications` : pas de col `title` / `priority` —
 *    on utilise `severity` + on récupère le titre via JOIN regulatory_documents.
 *  - `ademe_prevalidations` : pas de col `verdict` / `decision` / `address_label`
 *    — on utilise `status` + `quality_score` + `acknowledged`.
 *  - `quotes` : pas de col `total_ht_cents` — la col canonique est `amount_ht`.
 *  - `prescriber_relationships` : table inexistante en prod — bloc retiré.
 *  - `addon_modules` : DB a `name`, pas `display_name` — bug fix.
 *  - `missions.status='to_review'` : statut inexistant — utilise `done` à la place.
 *  - Chaque requête est entourée d'un try/catch silencieux pour éviter
 *    qu'une erreur DB plante la section entière (UX dashboard).
 */

interface AnyRow {
  [key: string]: unknown
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch {
    return fallback
  }
}

export async function PrioritiesAlerts() {
  const { supabase, orgId, user } = await getCurrentUser()
  const now = Date.now()
  const dayMs = 24 * 3600 * 1000

  // biome-ignore lint/suspicious/noExplicitAny: queries sur tables avec types DB pas encore régénérés
  const sb = supabase as any

  const [
    regCriticalRes,
    litOpenRes,
    prevalidLowQualityRes,
    quotesExpiringRes,
    missionsToReviewRes,
    invoicesOverdueRes,
    trialsExpiringRes,
  ] = await Promise.all([
    safeQuery(
      async () =>
        (await sb
          .from('regulatory_notifications')
          .select('id, document_id, reason, severity, created_at')
          .eq('user_id', user.id)
          .eq('severity', 'critical')
          .is('read_at', null)
          .limit(3)) as { data: AnyRow[] | null },
      { data: null },
    ),
    safeQuery(
      async () =>
        (await sb
          .from('litigation_workflows')
          .select('id, mission_id, opened_at')
          .eq('organization_id', orgId)
          .in('status', ['opened', 'in_progress'])
          .lte('opened_at', new Date(now - 2 * dayMs).toISOString())
          .limit(3)) as { data: AnyRow[] | null },
      { data: null },
    ),
    safeQuery(
      async () =>
        (await sb
          .from('ademe_prevalidations')
          .select('id, mission_id, quality_score, status, acknowledged')
          .eq('organization_id', orgId)
          .eq('status', 'completed')
          .eq('acknowledged', false)
          .lt('quality_score', 0.5)
          .limit(3)) as { data: AnyRow[] | null },
      { data: null },
    ),
    safeQuery(
      async () =>
        (await sb
          .from('quotes')
          .select('id, reference, valid_until, amount_ht, client:clients(display_name)')
          .eq('organization_id', orgId)
          .eq('status', 'sent')
          .lte('valid_until', new Date(now + 7 * dayMs).toISOString())
          .order('valid_until', { ascending: true })
          .limit(3)) as { data: AnyRow[] | null },
      { data: null },
    ),
    safeQuery(
      async () =>
        (await sb
          .from('missions')
          .select('id, dossier_id, type', { count: 'exact' })
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .eq('status', 'done')
          .lte('updated_at', new Date(now - dayMs).toISOString())
          .limit(3)) as { data: AnyRow[] | null; count: number | null },
      { data: null, count: 0 },
    ),
    safeQuery(
      async () =>
        (await sb
          .from('invoices')
          .select('id, reference, due_date, amount_ttc, client:clients(display_name)')
          .eq('organization_id', orgId)
          .eq('status', 'overdue')
          .order('due_date', { ascending: true })
          .limit(3)) as { data: AnyRow[] | null },
      { data: null },
    ),
    safeQuery(
      async () =>
        (await sb
          .from('module_trials')
          .select('id, trial_ends_at, module:addon_modules(name)')
          .eq('organization_id', orgId)
          .eq('status', 'active')
          .lte('trial_ends_at', new Date(now + 7 * dayMs).toISOString())
          .limit(3)) as { data: AnyRow[] | null },
      { data: null },
    ),
  ])

  const alerts: PriorityAlert[] = []

  // P1 — réglementaire critique
  for (const row of regCriticalRes.data ?? []) {
    const n = row as { id: string; document_id?: string | null; reason?: string | null }
    alerts.push({
      key: `reg-${n.id}`,
      priority: 'P1',
      title: 'Nouveau document réglementaire critique',
      meta: n.reason ?? 'Veille réglementaire',
      cta: 'Lire',
      href: n.document_id ? `/dashboard/veille/${n.document_id}` : '/dashboard/veille',
    })
  }
  // P1 — litiges ouverts
  for (const row of litOpenRes.data ?? []) {
    const l = row as { id: string; mission_id: string; opened_at: string }
    const days = Math.floor((now - new Date(l.opened_at).getTime()) / dayMs)
    alerts.push({
      key: `lit-${l.id}`,
      priority: 'P1',
      title: 'Litige ouvert non traité',
      meta: `Ouvert il y a ${days} jour${days > 1 ? 's' : ''}`,
      cta: 'Traiter',
      href: `/dashboard/dossiers/${l.mission_id}`,
    })
  }
  // P1 — pré-validations ADEME en qualité basse
  for (const row of prevalidLowQualityRes.data ?? []) {
    const p = row as { id: string; mission_id: string; quality_score: number }
    const pct = Math.round((p.quality_score ?? 0) * 100)
    alerts.push({
      key: `prev-${p.id}`,
      priority: 'P1',
      title: 'Pré-validation ADEME en qualité basse',
      meta: `Score qualité ${pct}% · à ne pas publier en l'état`,
      cta: 'Voir',
      href: `/dashboard/dossiers/${p.mission_id}/prevalidation`,
    })
  }

  // P2 — devis expirants
  for (const row of quotesExpiringRes.data ?? []) {
    const q = row as {
      id: string
      reference: string
      valid_until: string
      amount_ht: number | null
      client?: { display_name?: string | null } | { display_name?: string | null }[] | null
    }
    const days = Math.max(0, Math.ceil((new Date(q.valid_until).getTime() - now) / dayMs))
    const eur = ((q.amount_ht ?? 0) / 100).toLocaleString('fr-FR', {
      maximumFractionDigits: 0,
    })
    const client = Array.isArray(q.client) ? q.client[0] : q.client
    alerts.push({
      key: `quote-${q.id}`,
      priority: 'P2',
      title: `Devis ${q.reference} expire dans ${days} jour${days > 1 ? 's' : ''}`,
      meta: `Client : ${client?.display_name ?? '—'} · ${eur} € HT`,
      cta: 'Relancer',
      href: '/dashboard/devis',
    })
  }
  const toReviewCount = missionsToReviewRes.count ?? 0
  if (toReviewCount > 0) {
    alerts.push({
      key: 'missions-review',
      priority: 'P2',
      title: `${toReviewCount} mission${toReviewCount > 1 ? 's' : ''} à relire`,
      meta: 'Validation cohérence avant export',
      cta: 'Relire',
      href: '/dashboard/dossiers',
    })
  }
  // P2 — factures en retard
  for (const row of invoicesOverdueRes.data ?? []) {
    const inv = row as {
      id: string
      reference: string
      due_date: string | null
      amount_ttc: number | null
      client?: { display_name?: string | null } | { display_name?: string | null }[] | null
    }
    const lateDays = inv.due_date
      ? Math.floor((now - new Date(inv.due_date).getTime()) / dayMs)
      : null
    const eur = ((inv.amount_ttc ?? 0) / 100).toLocaleString('fr-FR', {
      maximumFractionDigits: 0,
    })
    const client = Array.isArray(inv.client) ? inv.client[0] : inv.client
    alerts.push({
      key: `inv-${inv.id}`,
      priority: 'P2',
      title: `Facture ${inv.reference}${lateDays !== null ? ` en retard de ${lateDays}j` : ' impayée'}`,
      meta: `Client : ${client?.display_name ?? '—'} · ${eur} € TTC`,
      cta: 'Relancer',
      href: '/dashboard/relances',
    })
  }

  // P3 — essais expirants
  for (const row of trialsExpiringRes.data ?? []) {
    const t = row as {
      id: string
      trial_ends_at: string
      module?: { name?: string | null } | { name?: string | null }[] | null
    }
    const days = Math.max(0, Math.ceil((new Date(t.trial_ends_at).getTime() - now) / dayMs))
    const module = Array.isArray(t.module) ? t.module[0] : t.module
    alerts.push({
      key: `trial-${t.id}`,
      priority: 'P3',
      title: `Essai ${module?.name ?? 'module'} : ${days}j restants`,
      meta: 'Conversion automatique sinon désactivation',
      cta: 'Décider',
      href: '/dashboard/account',
    })
  }

  // Tri par priorité puis limite 6
  const order = { P1: 0, P2: 1, P3: 2 } as const
  const sorted = alerts.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 6)

  if (sorted.length === 0) {
    return (
      <div className="border border-rule/60 px-5 py-10 flex flex-col items-center justify-center gap-2.5">
        <CheckCircle2 className="size-6 text-accent-green" aria-hidden />
        <p className="text-sm text-ink font-medium">Aucune priorité.</p>
        <p className="text-xs text-ink-mute max-w-[300px] text-center">
          Vous êtes à jour. Profitez-en pour préparer demain.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-rule/60">
      {sorted.map((alert, idx) => (
        <div
          key={alert.key}
          className={cn(
            'grid grid-cols-[36px_1fr_auto] gap-4 items-center px-5 py-3.5',
            idx < sorted.length - 1 && 'border-b border-rule/60',
          )}
        >
          <span
            className={cn(
              'font-mono text-[10px] font-bold uppercase tracking-[0.05em]',
              alert.priority === 'P1' && 'text-accent-red',
              alert.priority === 'P2' && 'text-ink',
              alert.priority === 'P3' && 'text-ink-mute',
            )}
          >
            {alert.priority}
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink leading-snug">{alert.title}</p>
            <p className="font-mono text-[11px] text-ink-mute mt-0.5 truncate">{alert.meta}</p>
          </div>
          <Link
            href={alert.href}
            className="font-mono text-[11px] text-ink border-b border-ink pb-0.5 hover:opacity-70 inline-flex items-center gap-1 transition-opacity"
          >
            {alert.cta} <ArrowRight className="size-3" />
          </Link>
        </div>
      ))}
    </div>
  )
}
