/**
 * KOVAS — Cyclage des noms de logiciels concurrents (crossfade).
 *
 * Composant qui cycle les 4 noms du marché FR du diagnostic immobilier
 * (Liciel · OBBC · AnalysImmo · ORIS) par crossfade : chaque nom apparaît
 * en fondu enchaîné, l'un après l'autre, cycle 8s en boucle.
 *
 * Historique de l'effet :
 *  - v1 : RotatingSoftwareName à crossfade JS (commit 0fb0399)
 *  - v2 : liste statique "Liciel, OBBC, AnalysImmo ou ORIS" (commit 02bf693)
 *  - v3 : slot machine défilement vertical translateY (commit 640e029)
 *  - v4 (présent) : crossfade pur CSS (Benjamin : "faut pas qu'ils défilent,
 *    faut qu'ils apparaissent à la suite")
 *
 * Stratégie :
 *  - Animation CSS pure (zéro JS state, zéro tick) — performante, pas de
 *    re-renders React, fonctionne offline, ne consomme pas de batterie.
 *  - 4 items absolument positionnés sur la même origine, animation
 *    décalée de 2s pour chacun avec fondu enchaîné de 0.4s aux transitions.
 *  - Server Component (pas `'use client'`) car aucune interactivité JS.
 *  - SSR-friendly : item 1 (Liciel) utilise `animation-delay: -0.4s` →
 *    à t=0 il est déjà à 5% du cycle = opacity 1. Premier paint = Liciel
 *    immédiatement visible, sans fade-in initial. SEO préservé.
 *  - Largeur stabilisée : widthSpacer avec le mot le plus long
 *    "AnalysImmo" (suffix compris) en `visibility: hidden` → zéro reflow.
 *
 * Accessibilité :
 *  - `aria-hidden` sur l'animation visuelle (décoration).
 *  - `sr-only` exposant tous les 4 noms en clair pour screen readers + SEO.
 *  - Respect `prefers-reduced-motion` : animation désactivée, Liciel figé.
 */

import styles from './SoftwareNameSlotMachine.module.css'

const SOFTWARE_NAMES = ['Liciel', 'OBBC', 'AnalysImmo', 'ORIS'] as const

/** Mot le plus long parmi les 4 noms (pour réservation largeur). */
const LONGEST_NAME = 'AnalysImmo'

export interface SoftwareNameSlotMachineProps {
  /** Classe additionnelle à appliquer au conteneur. */
  className?: string
  /**
   * Suffixe optionnel collé à chaque nom (typiquement le point de fin de
   * phrase). Inclus dans la widthSpacer pour préserver l'alignement.
   *
   * Sans suffixe, la widthSpacer fait la largeur de "AnalysImmo" mais quand
   * le composant affiche "Liciel" (plus court), un point écrit après le
   * composant resterait visuellement détaché. Avec suffixe ici, le point
   * voyage avec le nom et reste "collé".
   */
  suffix?: string
}

export function SoftwareNameSlotMachine({
  className,
  suffix = '',
}: SoftwareNameSlotMachineProps): React.ReactElement {
  return (
    <>
      <span aria-hidden className={[styles.slot, className].filter(Boolean).join(' ')}>
        {/* Spacer largeur stable : visibility:hidden pour réserver le footprint
            horizontal sans rendu visuel. Le mot le plus long + suffix. */}
        <span className={styles.widthSpacer} aria-hidden>
          {`${LONGEST_NAME}${suffix}`}
        </span>
        {/* Les 4 noms positionnés absolument à la même origine. Le décalage
            d'animation (configuré en CSS via :nth-child) crée le crossfade
            séquentiel. */}
        {SOFTWARE_NAMES.map((name) => (
          <span key={name} className={styles.item}>
            {`${name}${suffix}`}
          </span>
        ))}
      </span>
      {/* SEO + a11y : tous les 4 noms exposés en clair dans le DOM. */}
      <span className="sr-only">
        Compatible avec les principaux logiciels de diagnostic immobilier : Liciel, OBBC, AnalysImmo
        et ORIS.
      </span>
    </>
  )
}
