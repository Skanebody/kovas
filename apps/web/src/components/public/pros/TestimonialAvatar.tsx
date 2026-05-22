/**
 * Avatar vectoriel déterministe pour cartes de témoignages.
 *
 * Génère un portrait illustré sobre via DiceBear "Notionists Neutral"
 * (style line-art monochromatique, niveau professionnel B2B compatible
 * brand KOVAS V5). Le seed combine nom + ville pour garantir l'unicité
 * et la stabilité (même seed = même portrait à chaque rendu).
 *
 * Justification légale : les témoignages /pros/temoignages sont
 * explicitement marqués "illustratifs V1" en attendant la collecte
 * de retours bêta-testeurs réels (cf. mention en haut de la page).
 * Les avatars vectoriels stylisés ne sont pas des photos de personnes
 * réelles — il s'agit d'illustrations génériques anonymisées, ce qui
 * écarte toute qualification de pratique commerciale trompeuse au
 * sens de l'article L121-2 du Code de la consommation.
 */

interface TestimonialAvatarProps {
  /** Nom affiché (ex: "Pierre L.") */
  name: string
  /** Localisation (ex: "Rouen (76)") — combiné au nom pour le seed */
  city: string
  /** Taille en pixels (carré). Défaut 48px (size-12 du layout actuel). */
  size?: number
  /** Classes additionnelles (bordure, ring, etc.) */
  className?: string
}

/**
 * Construit l'URL DiceBear pour générer le SVG d'avatar.
 * Style "notionists-neutral" : portraits illustrés monochromatiques
 * dans le ton Notion (line-art noir/blanc, pas de couleur). Compatible
 * avec le brand V5 sage/navy/chartreuse.
 */
function buildAvatarUrl(name: string, city: string, size: number): string {
  const seed = `${name}-${city}`.toLowerCase().replace(/\s+/g, '-')
  const params = new URLSearchParams({
    seed,
    backgroundColor: 'f5f7f4', // sage background brand V5
    backgroundType: 'solid',
    size: String(size),
    // Réduction des artefacts de style trop "cartoon" pour rester pro
    radius: '50', // arrondi total (cercle parfait)
  })
  return `https://api.dicebear.com/9.x/notionists-neutral/svg?${params.toString()}`
}

export function TestimonialAvatar({
  name,
  city,
  size = 48,
  className,
}: TestimonialAvatarProps) {
  const url = buildAvatarUrl(name, city, size)

  return (
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={
        className ??
        'rounded-full bg-sage ring-1 ring-rule/60 shrink-0 select-none'
      }
      // L'alt est volontairement vide : l'avatar est purement décoratif,
      // l'info nominative est déjà fournie en texte à côté.
      aria-hidden
    />
  )
}
