import { PRESS_MENTIONS } from '@/lib/institutional/press-mentions'
import { listPublicPressCitations } from '@/lib/observatoire/press-citations'
import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

/**
 * Section 6 — Mentions presse de l'observatoire.
 *
 * FIX-E (2026-05-24) : refonte en CARDS contenant logo SVG + extrait cité
 * + lien interne `/observatoire/citation/[id]`. Les citations proviennent
 * de la table `observatoire_press_citations` (workflow admin pending → verified).
 *
 * Comportement :
 *   - Liste les citations `verified` (RLS l'enforce) avec leur logo média.
 *   - Logo média résolu depuis `PRESS_MENTIONS` (mapping slug → logoPath).
 *   - Card cliquable → page interne `/observatoire/citation/[id]` qui affiche
 *     l'extrait complet + lien article original + bouton "Vérifier la source".
 *   - Si aucune citation vérifiée : retombe sur la grille de logos PRESS_MENTIONS
 *     comme avant (placeholder sobre).
 *
 * Source de vérité logos : `apps/web/public/press/logos/{slug}.svg`
 * (typo monochrome `#7E8AA4`, créés en interne pour éviter toute reproduction
 * de logo officiel sous droit).
 */
export async function PressMentions() {
  const citations = await listPublicPressCitations()

  // Fallback : aucune citation validée, on retombe sur l'ancienne grille
  // logos sobres avec tooltip "Article à venir".
  if (citations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-8">
        <p className="text-center text-[15px] sm:text-[17px] text-ink/72 max-w-[600px]">
          Ces données sont régulièrement citées et reprises par la presse économique et la presse
          spécialisée immobilier en France. Les premières publications sont en cours de validation
          éditoriale.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-10 gap-y-8 items-center justify-items-center w-full max-w-[1000px]">
          {PRESS_MENTIONS.map((logo) => (
            <span
              key={logo.id}
              data-status="placeholder"
              title="Citation à venir"
              aria-label={`${logo.name} — citation à venir`}
              className="group flex flex-col items-center gap-2 cursor-help"
            >
              <img
                src={logo.logoPath}
                alt={`Logo ${logo.name}`}
                className="h-10 max-w-[140px] object-contain opacity-60 group-hover:opacity-100 transition-opacity"
                loading="lazy"
                decoding="async"
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
                {logo.name}
              </span>
            </span>
          ))}
        </div>
      </div>
    )
  }

  // Map slug → logoPath/name pour rendu rapide
  const mediaIndex = new Map(
    PRESS_MENTIONS.map((m) => [m.id, { name: m.name, logoPath: m.logoPath }] as const),
  )

  return (
    <div className="flex flex-col items-center gap-12">
      <p className="text-center text-[15px] sm:text-[17px] text-ink/72 max-w-[700px]">
        Ces données sont régulièrement citées et reprises par la presse économique et la presse
        spécialisée immobilier en France. Chaque extrait ci-dessous est référencé dans notre
        bibliothèque éditoriale.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-[1100px]">
        {citations.map((citation) => {
          const media = mediaIndex.get(citation.mediaSlug)
          const mediaName = media?.name ?? citation.mediaSlug
          const logoPath = media?.logoPath ?? null

          const publishedLabel = new Date(citation.publishedAt).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })

          return (
            <Link
              key={citation.id}
              href={`/observatoire/citation/${citation.id}`}
              className="group flex flex-col bg-paper border border-rule/60 rounded-2xl p-6 hover:border-navy/40 hover:shadow-glass-sm transition-all"
            >
              <div className="flex items-center justify-between mb-5">
                {logoPath ? (
                  <img
                    src={logoPath}
                    alt={`Logo ${mediaName}`}
                    className="h-8 max-w-[120px] object-contain opacity-70 group-hover:opacity-100 transition-opacity"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55">
                    {mediaName}
                  </span>
                )}
                <ArrowUpRight
                  className="size-4 text-ink/40 group-hover:text-chartreuse-deep transition-colors"
                  aria-hidden
                />
              </div>
              <blockquote className="text-[14px] sm:text-[15px] text-ink/85 leading-relaxed mb-5 line-clamp-4">
                {`« ${citation.quoteExcerpt} »`}
              </blockquote>
              <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-rule/40">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
                  {mediaName}
                </span>
                <span className="font-mono text-[10px] text-ink/45">{publishedLabel}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
