/**
 * Template partagé pour les OG images dynamiques `opengraph-image.tsx`.
 *
 * Génère un visuel 1200×630 strictement conforme au Design System V5 :
 *  - background sage `#F5F7F4`
 *  - texte navy `#0F1419`
 *  - mot-clé éditorial via `accent` (italic serif, chartreuse optionnel)
 *
 * Édité une seule fois pour les 8 routes publiques (Lot B88). Importé par
 * chaque `opengraph-image.tsx` collocaté à sa route.
 *
 * IMPORTANT : ne pas charger de fonte custom — `next/og` exige fetch + buffer.
 * On reste sur `sans-serif` + `serif` système, suffisant pour V5 sobre.
 */

import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 } as const
export const OG_CONTENT_TYPE = 'image/png' as const

/** Tokens couleurs canoniques V5 utilisés sur OG. */
const COLOR_SAGE = '#F5F7F4'
const COLOR_NAVY = '#0F1419'
const COLOR_WHITE = '#FFFFFF'
const COLOR_CHARTREUSE = '#D4F542'

/** Mot-clé éditorial mis en italic serif dans le H1. */
export interface OgEditorial {
  /** Texte qui précède le mot italic (peut être vide). */
  readonly before: string
  /** Mot-clé en italic serif. */
  readonly italic: string
  /** Texte qui suit le mot italic (peut être vide). */
  readonly after: string
  /**
   * Mettre en chartreuse le mot italic (réservé célébration / essai / gain).
   * Par défaut navy (visuel V5 sobre).
   */
  readonly chartreuse?: boolean
}

export interface OgImageParams {
  /** Eyebrow uppercase en tête de carte (mono-look). */
  readonly eyebrow: string
  /** H1 éditorial structuré (avant + italic + après). */
  readonly editorial: OgEditorial
  /** Sous-titre / tagline sous le H1. */
  readonly tagline: string
  /** Pied de page footer-right (par défaut : "Sage · Navy · Chartreuse"). */
  readonly footerRight?: string
}

/**
 * Construit la `Response` ImageResponse 1200×630 prête à exporter en
 * default export d'un fichier `opengraph-image.tsx`.
 */
export function buildOgImage(params: OgImageParams): ImageResponse {
  const { eyebrow, editorial, tagline } = params
  const footerRight = params.footerRight ?? 'Sage · Navy · Chartreuse'
  const italicColor = editorial.chartreuse === true ? COLOR_CHARTREUSE : COLOR_NAVY

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        background: COLOR_SAGE,
        color: COLOR_NAVY,
        padding: '72px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'sans-serif',
      }}
    >
      {/* En-tête : logo K + eyebrow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div
          style={{
            width: 44,
            height: 44,
            background: COLOR_NAVY,
            color: COLOR_WHITE,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          K
        </div>
        <span
          style={{
            fontSize: 16,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: COLOR_NAVY,
            opacity: 0.55,
          }}
        >
          {eyebrow}
        </span>
      </div>

      {/* Bloc éditorial */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <div
          style={{
            fontSize: 84,
            lineHeight: 1.05,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            maxWidth: 1040,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0 18px',
          }}
        >
          {editorial.before.length > 0 ? <span>{editorial.before}</span> : null}
          <span
            style={{
              fontStyle: 'italic',
              fontFamily: 'serif',
              fontWeight: 400,
              color: italicColor,
            }}
          >
            {editorial.italic}
          </span>
          {editorial.after.length > 0 ? <span>{editorial.after}</span> : null}
        </div>
        <div
          style={{
            fontSize: 26,
            color: COLOR_NAVY,
            opacity: 0.72,
            maxWidth: 980,
            lineHeight: 1.4,
            display: 'flex',
          }}
        >
          {tagline}
        </div>
      </div>

      {/* Pied : domaine + signature couleurs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          color: COLOR_NAVY,
          opacity: 0.55,
          fontSize: 15,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
        }}
      >
        <span>kovas.fr</span>
        <span>{footerRight}</span>
      </div>
    </div>,
    { ...OG_SIZE },
  )
}
