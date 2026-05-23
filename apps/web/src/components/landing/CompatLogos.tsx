/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from 'react'

/**
 * Wordmarks SVG des 8 logiciels métier compatibles KOVAS.
 *
 * Stratégie hybride documentée dans `apps/web/public/logos/compat/MANIFEST.md` :
 *
 *  - **LICIEL** : SVG officiel récupéré depuis liciel.fr (logo figuratif rouge
 *    #E84242 + wordmark). Affiché tel quel via <img>, hauteur normalisée 28px.
 *
 *  - **7 autres** (AnalysImmo, WinDiagnostics, GestionDiag, Im'Diag, ORIS,
 *    Argos, DPEWin) : wordmarks SVG inline en typographie KOVAS (Urbanist
 *    600, fill currentColor). Les éléments figuratifs propriétaires (couleurs
 *    spécifiques, glyphes, icônes) **ne sont PAS reproduits** — uniquement le
 *    nom du logiciel en typographie neutre. Cette approche :
 *      (a) garantit l'uniformité visuelle dans la grille
 *      (b) évite la contrefaçon de marque figurative (jurisprudence FR :
 *          la marque verbale reste citable en usage informatif, art. L.713-3
 *          CPI + droit à l'information du consommateur)
 *      (c) reste défendable comme citation factuelle de compatibilité
 *
 * Disclaimer à afficher dans CompatGrid : "Les marques citées appartiennent à
 * leurs propriétaires respectifs. KOVAS n'est ni affilié à, ni endossé par
 * ces éditeurs." (rendu en font-mono petit format sous la grille).
 */

interface WordmarkProps {
  className?: string
  ariaLabel: string
  /** viewBox width — calibré pour text-anchor middle centré. */
  width: number
  /** Texte du wordmark. */
  text: string
  /** Si présent : point accent rendu après le texte (mimétisme "LICIEL." du mockup original). */
  trailingDot?: boolean
  /** Lettrage spécial : letter-spacing custom (ex: ORIS étiré). */
  letterSpacing?: number
}

const VIEWBOX_HEIGHT = 40
const FONT_SIZE = 22
const RENDER_HEIGHT = 28

/**
 * Wordmark générique — SVG inline, font-family hérité du DOM parent (Urbanist
 * via next/font). fill `currentColor` permet de styler depuis le parent.
 */
function Wordmark({
  className,
  ariaLabel,
  width,
  text,
  trailingDot = false,
  letterSpacing = 0,
}: WordmarkProps): ReactNode {
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${VIEWBOX_HEIGHT}`}
      height={RENDER_HEIGHT}
      width="auto"
      className={className}
      style={{ display: 'block' }}
    >
      <text
        x="0"
        y="28"
        fontFamily="Urbanist, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
        fontWeight={600}
        fontSize={FONT_SIZE}
        letterSpacing={letterSpacing}
        fill="currentColor"
      >
        {text}
      </text>
      {trailingDot && <circle cx={width - 6} cy={32} r={3.5} fill="#95B11A" aria-hidden />}
    </svg>
  )
}

/* ============================================================
   LICIEL — logo officiel (récupéré depuis liciel.fr)
   ============================================================ */
export function LicielLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logos/compat/liciel-logo.svg"
      alt="LICIEL — logo officiel"
      width={120}
      height={RENDER_HEIGHT}
      className={className}
      style={{
        height: RENDER_HEIGHT,
        width: 'auto',
        maxWidth: 130,
        display: 'block',
      }}
    />
  )
}

/* ============================================================
   7 wordmarks SVG style KOVAS
   ============================================================ */

export function AnalysImmoLogo({ className }: { className?: string }) {
  return (
    <Wordmark
      className={className}
      ariaLabel="AnalysImmo — logiciel diagnostic Atlibitum"
      width={138}
      text="AnalysImmo"
    />
  )
}

export function WinDiagnosticsLogo({ className }: { className?: string }) {
  // Plus long — viewBox étiré pour préserver la lisibilité.
  return (
    <Wordmark
      className={className}
      ariaLabel="WinDiagnostics — logiciel diagnostic"
      width={172}
      text="WinDiagnostics"
    />
  )
}

export function GestionDiagLogo({ className }: { className?: string }) {
  return (
    <Wordmark
      className={className}
      ariaLabel="GestionDiag — logiciel CRM diagnostic"
      width={142}
      text="GestionDiag"
    />
  )
}

export function ImDiagLogo({ className }: { className?: string }) {
  return (
    <Wordmark
      className={className}
      ariaLabel="Im'Diag — logiciel multi-modules diagnostic"
      width={86}
      text="Im'Diag"
    />
  )
}

export function OrisLogo({ className }: { className?: string }) {
  // Court (4 lettres) — letter-spacing élargi pour densité visuelle.
  return (
    <Wordmark
      className={className}
      ariaLabel="ORIS — logiciel diagnostic immobilier"
      width={82}
      text="ORIS"
      letterSpacing={2.5}
    />
  )
}

export function ArgosLogo({ className }: { className?: string }) {
  return (
    <Wordmark
      className={className}
      ariaLabel="Argos — logiciel Ithaque audit & diagnostic"
      width={74}
      text="Argos"
    />
  )
}

export function DpeWinLogo({ className }: { className?: string }) {
  return (
    <Wordmark
      className={className}
      ariaLabel="DPEWin — logiciel Perrenoud thermique"
      width={86}
      text="DPEWin"
    />
  )
}
