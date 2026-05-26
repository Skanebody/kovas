/**
 * KOVAS — Widget "SEO de ta fiche annuaire" (Lot B82 — Vague 3A).
 *
 * Expose l'algo A1.3.12 (`lib/algos/seo-quality-scorer.ts`) côté
 * diagnostiqueur dans la page Compte > Parrainage. Calcule un score 0-100
 * sur la qualité de la fiche publique kovas.fr du diagnostiqueur connecté
 * et liste 3-5 recommandations actionnables.
 *
 * Server Component. Source data : `seo_page_quality_signals` agrégée par
 * fiche annuaire. Pour B82, on charge le snapshot le plus récent associé
 * à l'org via `directory_listings` si présent.
 *
 * TODO B82+ : brancher la lecture réelle sur `seo_page_quality_signals` une
 * fois la table peuplée par le batch GC2. En attendant, placeholder
 * déterministe + 3 recommandations standards.
 */

import { type SeoQualityInput, scoreSeoQuality } from '@/lib/algos/seo-quality-scorer'
import { ArrowUpRight, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface SeoScoreWidgetProps {
  /** Slug fiche publique (si fiche annuaire existe). */
  publicSlug?: string | null
  /** Code département + ville pour lien fiche publique. */
  publicDept?: string | null
  publicCity?: string | null
}

/**
 * Construit l'input scoring. TODO : remplacer par lecture réelle de la table
 * `seo_page_quality_signals` quand le batch GC2 sera en place.
 */
function buildPlaceholderInput(): SeoQualityInput {
  return {
    page_type: 'city',
    has_real_diagnostician: true,
    has_local_data: true,
    has_human_signature: false, // recommandation : ajouter signature
    bounce_rate: 0.42,
    avg_time_on_page_sec: 95,
    word_count: 280, // recommandation : enrichir contenu
    last_content_revision_at: new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString(),
    pogo_sticking_detected: false,
    is_duplicate_template: false,
  }
}

interface Recommendation {
  title: string
  detail: string
}

function buildRecommendations(
  result: ReturnType<typeof scoreSeoQuality>,
): ReadonlyArray<Recommendation> {
  const recs: Recommendation[] = []
  for (const reason of result.refresh_reasons) {
    switch (reason) {
      case 'missing_signature':
        recs.push({
          title: 'Ajoute ta signature humaine',
          detail:
            'Une bio courte (200 caractères) + photo professionnelle améliorent ton classement Google de 15 à 25 %.',
        })
        break
      case 'low_word_count':
        recs.push({
          title: 'Enrichis la description de ta zone',
          detail:
            'Vise 600-800 mots : tes spécialités, types de biens couverts, références récentes anonymisées.',
        })
        break
      case 'stale':
        recs.push({
          title: 'Mets à jour ta fiche tous les trimestres',
          detail:
            "Google favorise les pages rafraîchies. Ajoute un paragraphe d'actualité réglementaire.",
        })
        break
      case 'high_bounce':
        recs.push({
          title: 'Réduis le taux de rebond',
          detail:
            'Ajoute un appel à l’action visible en haut de page + un témoignage client texte.',
        })
        break
      case 'low_engagement':
        recs.push({
          title: 'Améliore le temps passé sur la page',
          detail:
            'Insère une FAQ locale (3-5 questions) sur les spécificités diagnostic de ta ville.',
        })
        break
      case 'no_real_diag':
      case 'no_local_data':
      case 'pogo_stick':
      case 'duplicate_template':
      case 'none':
        break
    }
  }
  // Recommandations de fond si pas assez générées
  if (recs.length < 3) {
    const fallbacks: Recommendation[] = [
      {
        title: 'Réponds aux avis Google',
        detail: 'Chaque réponse publique compte comme signal de fraîcheur SEO et engagement.',
      },
      {
        title: 'Liens vers tes 3 dernières missions anonymisées',
        detail: 'Le maillage interne sur ta fiche annuaire boost ta visibilité locale.',
      },
      {
        title: 'Demande à 1 client/mois un témoignage texte',
        detail: 'Le contenu généré par tes clients augmente ta crédibilité E-E-A-T.',
      },
    ]
    for (const rec of fallbacks) {
      if (recs.length >= 4) break
      if (!recs.find((r) => r.title === rec.title)) recs.push(rec)
    }
  }
  return recs.slice(0, 4)
}

export function SeoScoreWidget({ publicSlug, publicDept, publicCity }: SeoScoreWidgetProps = {}) {
  const input = buildPlaceholderInput()
  const result = scoreSeoQuality(input)
  const recommendations = buildRecommendations(result)

  const fichePubliqueHref =
    publicSlug && publicDept && publicCity
      ? `/trouver-un-diagnostiqueur/${publicDept}/${publicCity}/${publicSlug}`
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
