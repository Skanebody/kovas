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
 *  - **2 wordmarks stylés** créés ex-nihilo faute de source officielle :
 *    Im'Diag, DPEWin — couleurs d'accent uniques pour différenciation
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
 * Sizing robuste cross-browser :
 *  - height = 32px (explicite, pas auto) → fixe la hauteur visible
 *  - width = auto → dérivée du ratio viewBox du SVG par le navigateur
 *  - max-width = 100% du wrapper → scale-down si cellule mobile étroite
 *  - SVG sources : ont tous `width`/`height` attributes ET viewBox sur
 *    le `<svg>` root (sinon Safari peut tomber sur fallback 300×150).
 */
function makeLogoComponent(slug: string, alt: string): (props: LogoProps) => React.ReactElement {
  return function LogoImage({ className }: LogoProps) {
    return (
      <img
        src={`/logos/compat/${slug}-logo.svg`}
        alt={alt}
        height={RENDER_HEIGHT}
        className={className}
        style={{
          height: RENDER_HEIGHT,
          width: 'auto',
          maxWidth: '100%',
          display: 'block',
        }}
      />
    )
  }
}

/* ============================================================
   8 logos compatibles — identités visuelles propres
   ============================================================ */

export const LicielLogo = makeLogoComponent('liciel', 'Liciel — logo officiel')
export const AnalysImmoLogo = makeLogoComponent('analysimmo', 'AnalysImmo — logiciel Atlibitum')
export const ObbcLogo = makeLogoComponent('obbc', 'OBBC — éditeur du logiciel WinDiagnostics')
export const WinDiagnosticsLogo = makeLogoComponent(
  'windiagnostics',
  'WinDiagnostics — logiciel OBBC',
)
export const GestionDiagLogo = makeLogoComponent('gestiondiag', 'GestionDiag — CRM diagnostic')
export const ImDiagLogo = makeLogoComponent('imdiag', "Im'Diag — multi-modules diagnostic")
export const ArgosLogo = makeLogoComponent('argos', 'Argos — Ithaque audit & diagnostic')
export const DpeWinLogo = makeLogoComponent('dpewin', 'DPEWin — logiciel Perrenoud')
