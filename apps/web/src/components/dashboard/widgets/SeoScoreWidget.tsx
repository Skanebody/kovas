/**
 * KOVAS — Widget "SEO de ta fiche annuaire" (Lot B82 — Vague 3A,
 * branchement réel B90).
 *
 * Expose l'algo A1.3.12 (`lib/algos/seo-quality-scorer.ts`) côté
 * diagnostiqueur dans la page Compte > Parrainage. Calcule un score 0-100
 * sur la qualité de la fiche publique kovas.fr du diagnostiqueur connecté
 * et liste 3-5 recommandations actionnables.
 *
 * Source data réelle (B90) : table `diagnosticians` via jointure
 * `claimed_by_user_id = auth.uid()`. Le score est calculé en live à partir
 * des champs réels de la fiche (photo_url, bio, gmb_rating, gmb_review_count,
 * certif_valid_count, slug, dept_code, city_slug). Approche pragmatique car
 * la table `seo_page_quality_signals` n'existe pas encore (TODO batch GC2).
 *
 * Cas d'usage :
 *   1. Fiche annuaire réclamée → score live + recos dynamiques basées sur
 *      les champs effectivement vides ou faibles
 *   2. Pas de fiche réclamée → empty state + CTA `/reclamer-ma-fiche/[id]`
 *      (ou `/dashboard/account/verification` si l'user vient de signup)
 */

import { type SeoQualityInput, scoreSeoQuality } from '@/lib/algos/seo-quality-scorer'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowUpRight, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface DiagnosticianFiche {
  id: string
  slug: string | null
  city_slug: string | null
  dept_code: string | null
  city: string | null
  photo_url: string | null
  bio: string | null
  gmb_rating: number | null
  gmb_review_count: number | null
  certif_valid_count: number | null
  updated_at: string | null
}

interface Recommendation {
  title: string
  detail: string
}

/**
 * Charge la fiche annuaire du diagnostiqueur connecté. Renvoie null si l'user
 * n'a pas (encore) réclamé de fiche.
 */
async function loadDiagnosticianFiche(): Promise<DiagnosticianFiche | null> {
  try {
    const { supabase, user } = await getCurrentUser()
    // biome-ignore lint/suspicious/noExplicitAny: schéma diagnosticians multi-migrations
    const { data } = await (supabase as any)
      .from('diagnosticians')
      .select(
        'id, slug, city_slug, dept_code, city, photo_url, bio, gmb_rating, gmb_review_count, certif_valid_count, updated_at',
      )
      .eq('claimed_by_user_id', user.id)
      .maybeSingle()

    if (!data) return null
    return data as DiagnosticianFiche
  } catch {
    return null
  }
}

/**
 * Calcule des heuristiques live à partir des champs réels de la fiche pour
 * construire l'input scoring. Pondération conservative quand un signal manque.
 *
 * - `has_human_signature` : true si photo_url ET bio
 * - `has_local_data` : true si dept_code + city_slug renseignés
 * - `has_real_diagnostician` : true si fiche réclamée (== existe)
 * - `word_count` : longueur de la bio (proxy)
 * - `last_content_revision_at` : updated_at de la fiche
 * - `bounce_rate` / `avg_time_on_page_sec` : null (pas de GSC plug Phase 1)
 */
function buildInputFromFiche(fiche: DiagnosticianFiche): SeoQualityInput {
  const wordCount = fiche.bio ? fiche.bio.trim().split(/\s+/).filter(Boolean).length : 0
  return {
    page_type: 'city',
    has_real_diagnostician: true,
    has_local_data: Boolean(fiche.dept_code && fiche.city_slug),
    has_human_signature: Boolean(fiche.photo_url && fiche.bio && fiche.bio.length > 50),
    bounce_rate: null,
    avg_time_on_page_sec: null,
    word_count: wordCount,
    last_content_revision_at: fiche.updated_at,
    pogo_sticking_detected: false,
    is_duplicate_template: false,
  }
}

/**
 * Construit les recommandations en croisant les `refresh_reasons` retournées
 * par l'algo ET les champs spécifiques effectivement vides côté fiche réelle.
 */
function buildRecommendations(
  result: ReturnType<typeof scoreSeoQuality>,
  fiche: DiagnosticianFiche,
): ReadonlyArray<Recommendation> {
  const recs: Recommendation[] = []

  // Recos contextuelles basées sur les champs vides détectés en live
  if (!fiche.photo_url) {
    recs.push({
      title: 'Ajoute une photo professionnelle',
      detail:
        'Les fiches avec photo convertissent 2 à 3× plus. Format recommandé : portrait carré 800×800px.',
    })
  }
  if (!fiche.bio || fiche.bio.length < 150) {
    recs.push({
      title: 'Enrichis ta bio',
      detail:
        'Vise 150 à 300 caractères : ton expérience, tes spécialités diagnostic, ta zone d’intervention.',
    })
  }
  if ((fiche.gmb_review_count ?? 0) < 5) {
    recs.push({
      title: 'Collecte plus d’avis Google',
      detail:
        'Demande à 3 derniers clients satisfaits de laisser un avis. 5+ avis = boost de visibilité local.',
    })
  }
  if (!fiche.certif_valid_count || fiche.certif_valid_count < 3) {
    recs.push({
      title: 'Renseigne tes certifications COFRAC',
      detail:
        'Plus tu déclares de domaines (DPE, Amiante, Plomb…), plus tu apparais sur des recherches ciblées.',
    })
  }

  // Recos issues des refresh_reasons de l'algo (compléments si pas déjà couvert)
  for (const reason of result.refresh_reasons) {
    if (recs.length >= 5) break
    switch (reason) {
      case 'stale':
        if (!recs.find((r) => r.title.startsWith('Mets à jour'))) {
          recs.push({
            title: 'Mets à jour ta fiche tous les trimestres',
            detail:
              "Google favorise les pages rafraîchies. Ajoute un paragraphe d'actualité réglementaire.",
          })
        }
        break
      case 'low_word_count':
        if (!recs.find((r) => r.title.startsWith('Enrichis'))) {
          recs.push({
            title: 'Enrichis la description de ta zone',
            detail:
              'Vise 600-800 mots : tes spécialités, types de biens couverts, références récentes anonymisées.',
          })
        }
        break
      case 'missing_signature':
        if (!recs.find((r) => r.title.startsWith('Ajoute une photo'))) {
          recs.push({
            title: 'Ajoute ta signature humaine',
            detail:
              'Une bio courte (200 caractères) + photo professionnelle améliorent ton classement Google de 15 à 25 %.',
          })
        }
        break
      case 'high_bounce':
      case 'low_engagement':
      case 'no_real_diag':
      case 'no_local_data':
      case 'pogo_stick':
      case 'duplicate_template':
      case 'none':
        break
    }
  }

  // Fallback éditorial si pas assez de recos générées
  if (recs.length < 3) {
    const fallbacks: Recommendation[] = [
      {
        title: 'Réponds aux avis Google',
        detail: 'Chaque réponse publique compte comme signal de fraîcheur SEO et engagement.',
      },
      {
        title: 'Demande à 1 client/mois un témoignage texte',
        detail: 'Le contenu généré par tes clients augmente ta crédibilité E-E-A-T.',
      },
      {
        title: 'Liens vers tes 3 dernières missions anonymisées',
        detail: 'Le maillage interne sur ta fiche annuaire boost ta visibilité locale.',
      },
    ]
    for (const rec of fallbacks) {
      if (recs.length >= 4) break
      if (!recs.find((r) => r.title === rec.title)) recs.push(rec)
    }
  }
  return recs.slice(0, 5)
}

function bucketLabel(bucket: ReturnType<typeof scoreSeoQuality>['bucket']): string {
  switch (bucket) {
    case 'thin':
      return 'À retravailler'
    case 'mid':
      return 'Correct'
    case 'good':
      return 'Bon'
    case 'excellent':
      return 'Excellent'
  }
}

/**
 * Empty state — pas de fiche annuaire réclamée. Invite à réclamer ou
 * compléter la verification (selon le workflow de signup).
 */
function EmptyState() {
  return (
    <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4 space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-[#0F1419]/72" aria-hidden />
          <h2 className="text-sm font-semibold text-[#0F1419]">SEO de ta fiche annuaire</h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">A1.3.12</p>
      </header>
      <p className="text-[13px] text-[#0F1419]/72 leading-relaxed">
        Réclame ta fiche annuaire pour activer le score SEO et débloquer les recommandations
        d’optimisation Google.
      </p>
      <footer className="pt-2 border-t border-[#0F1419]/[0.06]">
        <Link
          href="/trouver-un-diagnostiqueur"
          className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419] hover:text-[#0F1419]/72 transition-colors inline-flex items-center gap-1"
        >
          Trouver ma fiche
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </footer>
    </section>
  )
}

export async function SeoScoreWidget() {
  const fiche = await loadDiagnosticianFiche()

  if (!fiche) {
    return <EmptyState />
  }

  const input = buildInputFromFiche(fiche)
  const result = scoreSeoQuality(input)
  const recommendations = buildRecommendations(result, fiche)

  const fichePubliqueHref =
    fiche.slug && fiche.dept_code && fiche.city_slug
      ? `/trouver-un-diagnostiqueur/${fiche.dept_code}/${fiche.city_slug}/${fiche.slug}`
      : '/trouver-un-diagnostiqueur'

  return (
    <section className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-[#0F1419]/72" aria-hidden />
          <h2 className="text-sm font-semibold text-[#0F1419]">SEO de ta fiche annuaire</h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">A1.3.12</p>
      </header>

      {/* Score hero — Instrument Serif italic V5 signature */}
      <div className="flex items-baseline gap-3">
        <span
          className="font-serif italic font-normal text-[#0F1419] leading-none"
          style={{ fontSize: 'clamp(40px, 4vw, 64px)' }}
        >
          {result.quality_score}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
          / 100 · {bucketLabel(result.bucket)}
        </span>
      </div>

      <p className="text-[13px] text-[#0F1419]/72 leading-relaxed">{result.human_message}</p>

      {/* Recommandations actionnables */}
      <div className="space-y-3 pt-2 border-t border-[#0F1419]/[0.06]">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
          {recommendations.length} recommandation{recommendations.length > 1 ? 's' : ''}
        </p>
        <ul className="space-y-2.5">
          {recommendations.map((rec) => (
            <li key={rec.title} className="space-y-0.5">
              <p className="text-[13px] font-medium text-[#0F1419]">{rec.title}</p>
              <p className="text-[12px] text-[#0F1419]/72 leading-relaxed">{rec.detail}</p>
            </li>
          ))}
        </ul>
      </div>

      <footer className="pt-2 border-t border-[#0F1419]/[0.06]">
        <Link
          href={fichePubliqueHref}
          className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419] hover:text-[#0F1419]/72 transition-colors inline-flex items-center gap-1"
        >
          Voir ma fiche publique
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </footer>
    </section>
  )
}
