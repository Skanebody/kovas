import { Card } from '@/components/ui/card'

type ProTestimonial = {
  id: string
  name: string
  city: string
  plan: string
  quote: string
}

// Plans alignés sur la grille canonique V4 (lib/pricing-plans.ts).
// Audit FIX-SS (2026-05-23) : suppression des anciens noms Standard/Volume/Standard
// Founder (grille V3 obsolète) → Solo Pro/Cabinet/Solo Light.
const PRO_TESTIMONIALS: readonly ProTestimonial[] = [
  {
    id: 'frederic-rouen',
    name: 'Frédéric L.',
    city: 'Rouen',
    plan: 'Solo Pro 59€/mo',
    quote:
      'Je gagne 2h par jour grâce à la saisie vocale et au bouton Partager. Le retour bureau est devenu quasi inutile.',
  },
  {
    id: 'isabelle-lyon',
    name: 'Isabelle M.',
    city: 'Lyon',
    plan: 'Cabinet 149€/mo',
    quote:
      'Les leads du calculateur représentent 3 000€ de chiffre d’affaires le mois dernier. Pas un canal, un vrai pilier.',
  },
  {
    id: 'patrick-toulouse',
    name: 'Patrick D.',
    city: 'Toulouse',
    plan: 'Solo Light 29€/mo',
    quote:
      'Plus d’erreur d’export ADEME depuis que je suis sur KOVAS. La validation cohérence m’a sauvé deux rapports critiques.',
  },
] as const

const PRESS_LOGOS = [
  { name: 'Les Échos' },
  { name: 'Le Moniteur' },
  { name: 'Le Particulier' },
  { name: 'Capital' },
  { name: 'BFM Immo' },
] as const

/** Points repère diagnostiqueurs sur la mini-carte (coords SVG arbitraires). */
const MAP_DOTS = [
  { id: 'paris', cx: 105, cy: 50 },
  { id: 'lyon', cx: 122, cy: 95 },
  { id: 'marseille', cx: 130, cy: 130 },
  { id: 'bordeaux', cx: 70, cy: 105 },
  { id: 'nantes', cx: 55, cy: 75 },
  { id: 'lille', cx: 105, cy: 25 },
  { id: 'toulouse', cx: 90, cy: 125 },
  { id: 'rennes', cx: 50, cy: 60 },
  { id: 'strasbourg', cx: 155, cy: 55 },
  { id: 'rouen', cx: 90, cy: 40 },
] as const

/**
 * Section 5 — Social proof.
 * 3 témoignages diagnostiqueurs + carte France pulse + logos presse niveaux de gris.
 */
export function SocialProof() {
  return (
    <section className="bg-background py-20 md:py-28 px-4 sm:px-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl space-y-14">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* 3 témoignages */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRO_TESTIMONIALS.map((t) => (
              <Card key={t.id} variant="flat" padding="sm" className="flex flex-col gap-4">
                <blockquote className="text-sm text-ink leading-relaxed flex-1">
                  «&nbsp;{t.quote}&nbsp;»
                </blockquote>
                <footer className="space-y-1 pt-3 border-t border-rule">
                  <div className="text-sm font-semibold text-ink">{t.name}</div>
                  <div className="text-xs text-ink-mute">{t.city}</div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-ink-faint pt-1">
                    {t.plan}
                  </div>
                </footer>
              </Card>
            ))}
          </div>

          {/* Mini-carte France pulse à droite */}
          <div className="flex flex-col justify-center space-y-4">
            <p className="text-xs font-mono uppercase tracking-wider text-ink-faint text-center lg:text-left">
              Présents partout en France
            </p>
            <Card variant="flat" padding="sm" className="aspect-square">
              <svg
                viewBox="0 0 200 160"
                className="size-full"
                role="img"
                aria-label="Carte de France avec diagnostiqueurs KOVAS"
              >
                <title>Carte de France avec diagnostiqueurs KOVAS</title>
                <path
                  d="M70 30 L120 25 L150 40 L165 60 L160 95 L145 120 L115 135 L85 130 L60 115 L45 90 L42 65 L52 45 Z"
                  fill="hsl(var(--background))"
                  stroke="hsl(var(--border))"
                  strokeWidth="1.5"
                />
                {MAP_DOTS.map((dot, idx) => (
                  <g key={dot.id}>
                    {/* Halo statique */}
                    <circle
                      cx={dot.cx}
                      cy={dot.cy}
                      r="6"
                      className="fill-chartreuse/30"
                      aria-hidden
                    />
                    {/* Point central pulse-soft décalé */}
                    <circle
                      cx={dot.cx}
                      cy={dot.cy}
                      r="3"
                      className="fill-chartreuse-deep animate-pulse-soft motion-reduce:animate-none"
                      style={{ animationDelay: `${(idx % 4) * 200}ms` }}
                    />
                  </g>
                ))}
              </svg>
            </Card>
          </div>
        </div>

        {/* Bande logos presse niveaux de gris */}
        <div className="pt-10 border-t border-rule">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-faint mb-6 text-center">
            Ils parlent de KOVAS
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {PRESS_LOGOS.map((p) => (
              <li
                key={p.name}
                className="text-ink-faint font-sans font-semibold text-sm tracking-wide"
              >
                {p.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
