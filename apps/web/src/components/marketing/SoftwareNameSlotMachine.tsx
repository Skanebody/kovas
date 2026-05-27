'use client'

/**
 * KOVAS — Slot machine pour cyclage des noms de logiciels concurrents.
 *
 * Composant client qui rend un effet "roue de loterie" sur les 4 noms du
 * marché FR du diagnostic immobilier (Liciel · OBBC · AnalysImmo · ORIS).
 *
 * Pourquoi : Benjamin a demandé un défilement dynamique compact "comme à
 * la loterie" pour remplacer la liste statique "Liciel, OBBC, AnalysImmo
 * ou ORIS" dans le H1 de la homepage. Économie d'espace + caractère
 * vivant + parle à 100% du marché (pas seulement 65% Liciel-only).
 *
 * Stratégie :
 * - Animation CSS pure (zéro JS state, zéro tick) — performante, pas de
 *   re-renders React, fonctionne offline, ne consomme pas de batterie.
 * - 4 stops × 1.5s pause + transition 0.4s en ease-out-expo (cubic-bezier
 *   0.16, 1, 0.3, 1) pour le caractéristique "spin & stop" de loterie.
 * - Durée totale 8s (loop infinite).
 * - SSR-friendly : premier rendu = "Liciel" (translateY 0) — SEO préservé.
 * - Boucle seamless : 5e item Liciel dupliqué à la fin = transition ORIS →
 *   Liciel invisible quand l'animation reset 100% → 0%.
 * - Largeur stabilisée : span fantôme avec "AnalysImmo" (le mot le plus
 *   long) en `visibility: hidden` qui réserve l'espace → zéro reflow.
 *
 * Accessibilité :
 * - `aria-hidden` sur l'animation visuelle (décoration).
 * - `sr-only` exposant tous les 4 noms en clair pour screen readers + SEO.
 * - Respect `prefers-reduced-motion` (CSS @media query → animation
 *   désactivée, affichage statique du premier nom "Liciel").
 *
 * Référence : remplace la liste statique introduite commit `02bf693`
 * (qui avait elle-même remplacé le `RotatingSoftwareName` à crossfade
 * commit `0fb0399`).
 */

import styles from './SoftwareNameSlotMachine.module.css'

const SOFTWARE_NAMES = ['Liciel', 'OBBC', 'AnalysImmo', 'ORIS'] as const

/** Mot le plus long parmi les 4 noms (pour réservation largeur). */
const LONGEST_NAME = 'AnalysImmo'

export interface SoftwareNameSlotMachineProps {
  /** Classe additionnelle à appliquer au conteneur. */
  className?: string
}

export function SoftwareNameSlotMachine({
  className,
}: SoftwareNameSlotMachineProps): React.ReactElement {
  return (
    <>
      {/* Spacer largeur stable : le wrapper extérieur fait min-width
          = largeur du mot le plus long, évite le reflow horizontal du
          texte autour quand le slot tourne. */}
      <span aria-hidden className={[styles.slot, className].filter(Boolean).join(' ')}>
        <span className={styles.widthSpacer} aria-hidden>
          {LONGEST_NAME}
        </span>
        <span className={styles.stack}>
          {SOFTWARE_NAMES.map((name) => (
            <span key={name} className={styles.item}>
              {name}
            </span>
          ))}
          {/* Dupliqué pour boucle seamless ORIS → Liciel */}
          <span className={styles.item} aria-hidden>
            {SOFTWARE_NAMES[0]}
          </span>
        </span>
      </span>
      {/* SEO + a11y : tous les 4 noms exposés en clair dans le DOM. */}
      <span className="sr-only">
        Compatible avec les principaux logiciels de diagnostic immobilier : Liciel, OBBC, AnalysImmo
        et ORIS.
      </span>
    </>
  )
}
