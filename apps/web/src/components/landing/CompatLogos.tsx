/* eslint-disable @next/next/no-img-element */

/**
 * Logos SVG des 8 logiciels métier compatibles KOVAS.
 *
 * Stratégie documentée dans `apps/web/public/logos/compat/MANIFEST.md`
 * (refonte 2026-05-28) : chaque logo a désormais son identité visuelle
 * propre (couleurs, glyphes) au lieu du wordmark uniforme précédent.
 *
 * Sources :
 *  - **Liciel** : SVG officiel récupéré sur liciel.fr (rouge `#E84242`)
 *  - **4 logos retracés fidèlement** depuis sources officielles PNG/AVIF :
 *    AnalysImmo (atlibitum.com), WinDiagnostics (obbc.fr), GestionDiag
 *    (gestiondiag.fr), Argos (ithaque-renovation.fr)
 *  - **3 wordmarks stylés** créés ex-nihilo faute de source officielle :
 *    Im'Diag, ORIS, DPEWin — couleurs d'accent uniques pour différenciation
 *
 * Tous les SVG sont autonomes (couleurs hex hardcodées, pas de currentColor)
 * et chargés via `<img src>` — pas d'inline SVG (HTML/CSS plus simple, cache
 * navigateur efficace, et le scope copyright reste sur fichiers statiques
 * versionnés).
 *
 * Cadre juridique : art. L.713-3 CPI (usage informatif descriptif de marques
 * tierces) + CJUE BMW c/ Deenik (C-63/97) (compatibilité réelle signalable).
 * Disclaimer en pied de CompatGrid. Procédure de retrait sous 7 jours
 * documentée dans MANIFEST.md si demande amiable d'un éditeur.
 */

const RENDER_HEIGHT = 32 // h-8 du grid wrapper

interface LogoProps {
  className?: string
}

/**
 * Factory : crée un composant logo `<img>` standardisé pointant vers le
 * fichier SVG dans `/public/logos/compat/`.
 *
 * Sizing "fit-within" :
 *  - max-height = 32px (cale sur la hauteur du wrapper h-8)
 *  - max-width = plafond logo selon ratio (évite les SVG trop étirés)
 *  - height/width = auto + object-contain → le navigateur scale-down
 *    proportionnellement quand la cellule mobile est plus étroite que le
 *    plafond, sans déformer ni couper le logo.
 */
function makeLogoComponent(
  slug: string,
  alt: string,
  options: { maxWidth?: number } = {},
): (props: LogoProps) => React.ReactElement {
  const maxWidth = options.maxWidth ?? 140
  return function LogoImage({ className }: LogoProps) {
    return (
      <img
        src={`/logos/compat/${slug}-logo.svg`}
        alt={alt}
        className={className}
        style={{
          maxHeight: RENDER_HEIGHT,
          maxWidth,
          width: 'auto',
          height: 'auto',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    )
  }
}

/* ============================================================
   8 logos compatibles — identités visuelles propres
   ============================================================ */

export const LicielLogo = makeLogoComponent('liciel', 'Liciel — logo officiel', { maxWidth: 130 })

export const AnalysImmoLogo = makeLogoComponent('analysimmo', 'AnalysImmo — logiciel Atlibitum', {
  maxWidth: 140,
})

export const WinDiagnosticsLogo = makeLogoComponent(
  'windiagnostics',
  'WinDiagnostics — logiciel OBBC',
  { maxWidth: 150 },
)

export const GestionDiagLogo = makeLogoComponent('gestiondiag', 'GestionDiag — CRM diagnostic', {
  maxWidth: 145,
})

export const ImDiagLogo = makeLogoComponent('imdiag', "Im'Diag — multi-modules diagnostic", {
  maxWidth: 125,
})

export const OrisLogo = makeLogoComponent('oris', 'ORIS — diagnostic immobilier', {
  maxWidth: 115,
})

export const ArgosLogo = makeLogoComponent('argos', 'Argos — Ithaque audit & diagnostic', {
  maxWidth: 125,
})

export const DpeWinLogo = makeLogoComponent('dpewin', 'DPEWin — logiciel Perrenoud', {
  maxWidth: 125,
})
