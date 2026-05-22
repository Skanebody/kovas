interface PressLogo {
  name: string
  /** Chemin vers logo SVG dans /public/press/. Si fichier absent, placeholder gris. */
  src: string
  /** Description courte pour aria-label */
  alt: string
}

const PRESS_LOGOS: readonly PressLogo[] = [
  { name: 'Les Échos', src: '/press/les-echos.svg', alt: 'Logo Les Échos' },
  { name: 'Le Moniteur', src: '/press/le-moniteur.svg', alt: 'Logo Le Moniteur' },
  { name: 'Le Particulier', src: '/press/le-particulier.svg', alt: 'Logo Le Particulier' },
  { name: 'Capital', src: '/press/capital.svg', alt: 'Logo Capital' },
  { name: 'BFM Immo', src: '/press/bfm-immo.svg', alt: 'Logo BFM Immo' },
  { name: 'Décideurs Magazine', src: '/press/decideurs.svg', alt: 'Logo Décideurs Magazine' },
]

/**
 * Section 6 — Mentions presse.
 *
 * Affiche jusqu'à 8 logos presse en grille. Les fichiers SVG sont attendus
 * dans `/public/press/`. Si un fichier est absent, le rectangle grisé tient lieu
 * de placeholder visuel — on garde toujours le nom textuel pour l'accessibilité
 * et le SEO.
 *
 * Convention : 120x40 hauteur uniformisée, opacity 60% par défaut, 100% au hover
 * pour engagement.
 */
export function PressMentions() {
  return (
    <div className="flex flex-col items-center gap-8">
      <p className="text-center text-[15px] sm:text-[17px] text-ink/72 max-w-[600px]">
        Ces données sont régulièrement citées et reprises par la presse économique et la presse
        spécialisée immobilier en France.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-10 gap-y-8 items-center justify-items-center w-full max-w-[1000px]">
        {PRESS_LOGOS.map((logo) => (
          <div
            key={logo.name}
            className="flex flex-col items-center gap-2 opacity-60 hover:opacity-100 transition-opacity"
          >
            <div
              className="relative h-10 w-[120px] rounded-md bg-paper/60 border border-rule/40"
              style={{
                backgroundImage: `url(${logo.src})`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                backgroundSize: 'contain',
              }}
              role="img"
              aria-label={logo.alt}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55">
              {logo.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
