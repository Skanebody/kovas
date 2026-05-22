/**
 * Génère dynamiquement une image OG 1200×630 pour les partages réseaux sociaux.
 *
 * Endpoint : GET /api/og?title=...&subtitle=...&theme=light|dark
 *
 * Brand v5 strict :
 *  - Background sage pâle `#F5F7F4` (light) ou navy `#0F1419` (dark)
 *  - Titre Urbanist semi-bold navy `#0F1A2E`
 *  - Subtitle ink-mute
 *  - Accent chartreuse `#D4F542` pour le wordmark KOVAS bas-droit
 *
 * Le runtime `edge` est requis par `ImageResponse` (Vercel Edge Functions).
 *
 * Référence : https://nextjs.org/docs/app/api-reference/functions/image-response
 */

import { ImageResponse } from 'next/og'
import type { NextRequest } from 'next/server'

export const runtime = 'edge'

const WIDTH = 1200
const HEIGHT = 630

/** Trim et capping pour éviter les overflow visuels. */
function clamp(input: string | null, max: number, fallback: string): string {
  if (input === null) return fallback
  const trimmed = input.trim()
  if (trimmed.length === 0) return fallback
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

export function GET(request: NextRequest): ImageResponse {
  const url = new URL(request.url)
  const title = clamp(
    url.searchParams.get('title'),
    90,
    'KOVAS — Diagnostic immobilier IA',
  )
  const subtitle = clamp(
    url.searchParams.get('subtitle'),
    120,
    "L'app qui transforme 3h de DPE en 30 minutes",
  )
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light'

  const bg = theme === 'dark' ? '#0F1419' : '#F5F7F4'
  const fg = theme === 'dark' ? '#F5F7F4' : '#0F1A2E'
  const muted = theme === 'dark' ? 'rgba(245, 247, 244, 0.72)' : 'rgba(15, 26, 46, 0.62)'
  const accent = '#D4F542'

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        background: bg,
        color: fg,
        fontFamily: '"Urbanist", "Inter", sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: 18,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: muted,
          fontWeight: 500,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            background: accent,
          }}
        />
        KOVAS · kovas.fr
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '960px',
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.08,
            letterSpacing: '-0.025em',
            color: fg,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 28,
            lineHeight: 1.4,
            color: muted,
            fontWeight: 400,
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <div
          style={{
            fontSize: 20,
            color: muted,
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          Logiciel pour diagnostiqueurs immobiliers
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            fontSize: 36,
            fontWeight: 800,
            color: fg,
            letterSpacing: '-0.02em',
          }}
        >
          <div
            style={{
              width: 14,
              height: 36,
              background: accent,
              borderRadius: 4,
            }}
          />
          KOVAS
        </div>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    },
  )
}
