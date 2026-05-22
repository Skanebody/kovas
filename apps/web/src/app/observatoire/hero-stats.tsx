'use client'

import { useEffect, useRef, useState } from 'react'

interface HeroStat {
  /** Valeur numérique à animer (ex. 32) */
  value: number
  /** Suffixe (ex. "%", " €", " jours") */
  suffix: string
  /** Libellé descriptif sous le chiffre */
  label: string
  /** Précision décimale (default 0) */
  decimals?: number
}

interface HeroStatsProps {
  stats: readonly HeroStat[]
}

/**
 * 3 KPI hero animés au scroll (compteur croissant).
 *
 * Respect `prefers-reduced-motion` : affichage statique direct.
 * Animation 1200ms easeOutCubic via requestAnimationFrame.
 * IntersectionObserver : déclenche une seule fois à 30% de visibilité.
 *
 * Typo : `.kpi-hero` (Instrument Serif italic clamp 60-120px) pour le chiffre
 * + texte descriptif sous le chiffre (signature v5).
 */
export function HeroStats({ stats }: HeroStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14">
      {stats.map((stat, idx) => (
        <AnimatedStat key={`hero-${stat.label.slice(0, 20)}`} stat={stat} delay={idx * 120} />
      ))}
    </div>
  )
}

function AnimatedStat({ stat, delay }: { stat: HeroStat; delay: number }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [displayValue, setDisplayValue] = useState(0)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    // Respect prefers-reduced-motion
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setDisplayValue(stat.value)
      return
    }

    let rafId = 0
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !hasAnimatedRef.current) {
            hasAnimatedRef.current = true
            const start = performance.now() + delay
            const duration = 1200
            const startValue = 0
            const endValue = stat.value
            const tick = (now: number) => {
              if (now < start) {
                rafId = requestAnimationFrame(tick)
                return
              }
              const t = Math.min(1, (now - start) / duration)
              // easeOutCubic
              const eased = 1 - Math.pow(1 - t, 3)
              const current = startValue + (endValue - startValue) * eased
              setDisplayValue(current)
              if (t < 1) {
                rafId = requestAnimationFrame(tick)
              }
            }
            rafId = requestAnimationFrame(tick)
          }
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(node)
    return () => {
      observer.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [stat.value, delay])

  const formatted =
    stat.decimals && stat.decimals > 0
      ? displayValue.toFixed(stat.decimals)
      : Math.round(displayValue).toString()

  return (
    <div ref={ref} className="flex flex-col">
      <p
        className="font-serif italic font-normal text-ink leading-none tracking-[-0.02em]"
        style={{ fontSize: 'clamp(60px, 10vw, 120px)' }}
      >
        {formatted}
        <span className="text-ink/72">{stat.suffix}</span>
      </p>
      <p className="mt-5 text-[15px] sm:text-[17px] text-ink/72 leading-relaxed max-w-[280px]">
        {stat.label}
      </p>
    </div>
  )
}
