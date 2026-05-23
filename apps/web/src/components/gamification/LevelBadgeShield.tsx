'use client'

import { type LevelId, getLevelById } from '@/lib/gamification/levels'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Lock } from 'lucide-react'

/**
 * Écusson visuel par niveau — inspiré Waze (bouclier distinctif + numéro + picto)
 * MAIS palette SOBRE KOVAS V5 (navy + accents subtils, JAMAIS gaming/néon).
 *
 * 7 variantes :
 *   1. Pro       — écusson simple, navy clair
 *   2. Confirmé  — + 2 étoiles, bleu acier
 *   3. Sénior    — + couronne discrète, navy profond
 *   4. Premium   — + diamant central, ambre sobre
 *   5. Ambassadeur — + rayons, doré sobre
 *   6. Fidèle    — + cercle laurier, vert sage
 *   7. Expert    — + 3 étoiles + bordure chartreuse, accent signature V5
 *
 * État verrouillé : monochrome ink-faint + cadenas.
 */

export type LevelBadgeShieldSize = 'sm' | 'md' | 'lg' | 'xl' | 'hero'

interface LevelBadgeShieldProps {
  level: LevelId
  unlocked?: boolean
  size?: LevelBadgeShieldSize
  showLabel?: boolean
  current?: boolean
  className?: string
  animate?: boolean
}

interface LevelTheme {
  /** Couleur principale de l'écusson (fill du corps) */
  body: string
  /** Couleur de la bordure / ornement */
  border: string
  /** Couleur du texte du numéro */
  number: string
  /** Couleur du picto secondaire (étoiles, couronne, etc.) */
  ornament: string
  /** Ombre subtile sous le shield */
  shadow: string
}

const THEMES: Record<LevelId, LevelTheme> = {
  1: {
    body: '#5B7088',
    border: '#475F77',
    number: '#FFFFFF',
    ornament: '#FFFFFF',
    shadow: 'rgba(91, 112, 136, 0.18)',
  },
  2: {
    body: '#3B6995',
    border: '#2A5478',
    number: '#FFFFFF',
    ornament: '#DBEAFE',
    shadow: 'rgba(59, 105, 149, 0.22)',
  },
  3: {
    body: '#1B405B',
    border: '#0F2436',
    number: '#FFFFFF',
    ornament: '#DBEAFE',
    shadow: 'rgba(27, 64, 91, 0.28)',
  },
  4: {
    body: '#163144',
    border: '#0F2436',
    number: '#FFFFFF',
    ornament: '#D97706',
    shadow: 'rgba(22, 49, 68, 0.32)',
  },
  5: {
    body: '#0F2436',
    border: '#0B1D2E',
    number: '#FFFFFF',
    ornament: '#D4A574',
    shadow: 'rgba(15, 36, 54, 0.38)',
  },
  6: {
    body: '#0F2436',
    border: '#A3C920',
    number: '#FFFFFF',
    ornament: '#7AA84C',
    shadow: 'rgba(163, 201, 32, 0.22)',
  },
  7: {
    body: '#0F1419',
    border: '#D4F542',
    number: '#D4F542',
    ornament: '#D4F542',
    shadow: 'rgba(212, 245, 66, 0.30)',
  },
}

const SIZE_MAP: Record<LevelBadgeShieldSize, { w: number; h: number; labelClass: string }> = {
  sm: { w: 40, h: 48, labelClass: 'text-[10px]' },
  md: { w: 60, h: 72, labelClass: 'text-[11px]' },
  lg: { w: 100, h: 120, labelClass: 'text-[12px]' },
  xl: { w: 160, h: 192, labelClass: 'text-[13px]' },
  hero: { w: 220, h: 264, labelClass: 'text-[14px]' },
}

export function LevelBadgeShield({
  level,
  unlocked = true,
  size = 'md',
  showLabel = false,
  current = false,
  className,
  animate = true,
}: LevelBadgeShieldProps) {
  const def = getLevelById(level)
  if (!def) return null

  const dims = SIZE_MAP[size]
  const theme = unlocked ? THEMES[level] : LOCKED_THEME

  const Wrapper = animate ? motion.div : 'div'
  const wrapperProps = animate
    ? {
        initial: { opacity: 0, scale: 0.92, y: 6 },
        animate: { opacity: 1, scale: 1, y: 0 },
        transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
      }
    : {}

  return (
    <Wrapper className={cn('inline-flex flex-col items-center gap-2', className)} {...wrapperProps}>
      <div
        className="relative"
        style={{ width: dims.w, height: dims.h }}
        aria-label={`Écusson niveau ${level} ${def.label}`}
      >
        <ShieldSvg level={level} theme={theme} width={dims.w} height={dims.h} unlocked={unlocked} />
        {current && unlocked ? (
          <span
            className="absolute -top-1 -right-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-chartreuse ring-2 ring-paper"
            aria-hidden
          />
        ) : null}
      </div>

      {showLabel ? (
        <span
          className={cn(
            'font-mono uppercase tracking-[0.08em] text-center',
            dims.labelClass,
            unlocked ? 'text-ink-soft font-medium' : 'text-ink-faint',
          )}
        >
          {def.label}
        </span>
      ) : null}
    </Wrapper>
  )
}

const LOCKED_THEME: LevelTheme = {
  body: '#D4D9E0',
  border: '#B8C2D2',
  number: '#8A99AE',
  ornament: '#8A99AE',
  shadow: 'rgba(0,0,0,0.06)',
}

/**
 * SVG shield rendu en pure React, 200x240 viewBox.
 * La géométrie de base est identique pour les 7 niveaux,
 * seul l'ornement central diffère selon le niveau.
 */
function ShieldSvg({
  level,
  theme,
  width,
  height,
  unlocked,
}: {
  level: LevelId
  theme: LevelTheme
  width: number
  height: number
  unlocked: boolean
}) {
  const gradId = `shield-grad-${level}-${unlocked ? 'u' : 'l'}`
  const shadowId = `shield-shadow-${level}-${unlocked ? 'u' : 'l'}`
  return (
    <svg
      viewBox="0 0 200 240"
      width={width}
      height={height}
      role="img"
      aria-hidden="true"
      style={{ filter: `drop-shadow(0 6px 14px ${theme.shadow})` }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lighten(theme.body, 0.12)} />
          <stop offset="100%" stopColor={theme.body} />
        </linearGradient>
        <radialGradient id={shadowId} cx="0.5" cy="0.3" r="0.7">
          <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

      {/* Corps écusson — forme bouclier classique pointe vers le bas */}
      <path
        d="M100 8
           L184 32
           L184 120
           C184 168 150 208 100 232
           C50 208 16 168 16 120
           L16 32
           Z"
        fill={`url(#${gradId})`}
        stroke={theme.border}
        strokeWidth="4"
      />

      {/* Highlight subtil top */}
      <path
        d="M100 8
           L184 32
           L184 120
           C184 168 150 208 100 232
           C50 208 16 168 16 120
           L16 32
           Z"
        fill={`url(#${shadowId})`}
      />

      {/* Bordure intérieure liseré */}
      <path
        d="M100 22
           L172 42
           L172 118
           C172 158 145 195 100 218
           C55 195 28 158 28 118
           L28 42
           Z"
        fill="none"
        stroke={theme.border}
        strokeWidth="1.5"
        opacity="0.45"
      />

      {/* Ornement haut spécifique au niveau */}
      <g transform="translate(100, 78)">
        <LevelOrnament level={level} color={theme.ornament} />
      </g>

      {/* Numéro central */}
      <text
        x="100"
        y="172"
        textAnchor="middle"
        fontFamily="Georgia, 'Instrument Serif', serif"
        fontStyle="italic"
        fontWeight="400"
        fontSize="76"
        fill={theme.number}
      >
        {level}
      </text>

      {/* Cadenas si verrouillé */}
      {!unlocked ? (
        <g transform="translate(100, 210)">
          <circle r="18" fill="#F5F7F4" stroke={theme.border} strokeWidth="2" />
          <foreignObject x="-10" y="-10" width="20" height="20">
            <div
              style={{
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Lock size={14} color="#5B7088" strokeWidth={2.5} />
            </div>
          </foreignObject>
        </g>
      ) : null}
    </svg>
  )
}

/**
 * Ornement central spécifique au niveau (sobre, pas de gaming).
 * Tous rendus à viewBox-relative around (0,0).
 */
function LevelOrnament({ level, color }: { level: LevelId; color: string }) {
  switch (level) {
    case 1:
      // Étoile unique petite
      return <Star color={color} size={20} />
    case 2:
      // 2 étoiles côte à côte
      return (
        <g>
          <g transform="translate(-14, 0)">
            <Star color={color} size={16} />
          </g>
          <g transform="translate(14, 0)">
            <Star color={color} size={16} />
          </g>
        </g>
      )
    case 3:
      // Couronne discrète
      return <CrownIcon color={color} />
    case 4:
      // Diamant central
      return <DiamondIcon color={color} />
    case 5:
      // Étoile centrale entourée de rayons
      return (
        <g>
          <Sunburst color={color} />
          <Star color={color} size={18} />
        </g>
      )
    case 6:
      // Cercle laurier
      return <LaurelIcon color={color} />
    case 7:
      // 3 étoiles + bordure
      return (
        <g>
          <g transform="translate(-22, 4)">
            <Star color={color} size={14} />
          </g>
          <g transform="translate(0, -4)">
            <Star color={color} size={18} />
          </g>
          <g transform="translate(22, 4)">
            <Star color={color} size={14} />
          </g>
        </g>
      )
  }
}

function Star({ color, size }: { color: string; size: number }) {
  const points = computeStarPoints(0, 0, 5, size, size * 0.4)
  return <polygon points={points} fill={color} />
}

function computeStarPoints(
  cx: number,
  cy: number,
  spikes: number,
  outer: number,
  inner: number,
): string {
  const pts: string[] = []
  const step = Math.PI / spikes
  let rot = (Math.PI / 2) * 3
  for (let i = 0; i < spikes; i++) {
    pts.push(`${cx + Math.cos(rot) * outer},${cy + Math.sin(rot) * outer}`)
    rot += step
    pts.push(`${cx + Math.cos(rot) * inner},${cy + Math.sin(rot) * inner}`)
    rot += step
  }
  return pts.join(' ')
}

function CrownIcon({ color }: { color: string }) {
  return (
    <g>
      <path
        d="M -22 6 L -14 -10 L -8 -2 L 0 -14 L 8 -2 L 14 -10 L 22 6 Z"
        fill={color}
        stroke={color}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <rect x="-22" y="6" width="44" height="4" fill={color} rx="1" />
    </g>
  )
}

function DiamondIcon({ color }: { color: string }) {
  return (
    <g>
      <polygon
        points="-14,-2 -7,-12 7,-12 14,-2 0,14"
        fill={color}
        stroke={color}
        strokeWidth="0.5"
      />
      <polygon points="-14,-2 -7,-12 0,-2" fill="rgba(255,255,255,0.25)" />
      <polygon points="0,-2 7,-12 14,-2" fill="rgba(0,0,0,0.08)" />
    </g>
  )
}

function Sunburst({ color }: { color: string }) {
  const rays: number[] = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]
  return (
    <g opacity="0.55">
      {rays.map((deg) => (
        <line
          key={deg}
          x1="0"
          y1="0"
          x2="0"
          y2="-24"
          stroke={color}
          strokeWidth="1.5"
          transform={`rotate(${deg})`}
        />
      ))}
    </g>
  )
}

function LaurelIcon({ color }: { color: string }) {
  return (
    <g fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      {/* Branche gauche */}
      <path d="M -22 8 C -22 -6 -16 -16 -6 -18" />
      <path d="M -20 0 L -16 -4" />
      <path d="M -20 -6 L -14 -10" />
      <path d="M -18 -12 L -10 -16" />
      {/* Branche droite */}
      <path d="M 22 8 C 22 -6 16 -16 6 -18" />
      <path d="M 20 0 L 16 -4" />
      <path d="M 20 -6 L 14 -10" />
      <path d="M 18 -12 L 10 -16" />
    </g>
  )
}

/**
 * Légère éclaircie sur une couleur hex (mix avec blanc) — pour le gradient top.
 */
function lighten(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return hex
  const r = Number.parseInt(m[1], 16)
  const g = Number.parseInt(m[2], 16)
  const b = Number.parseInt(m[3], 16)
  const lr = Math.round(r + (255 - r) * amount)
  const lg = Math.round(g + (255 - g) * amount)
  const lb = Math.round(b + (255 - b) * amount)
  return `#${[lr, lg, lb].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
