import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface City {
  slug: string
  name: string
  dept: string // code INSEE département (ex "75")
  departmentSlug: string // slug département (ex "paris")
}

const TOP_CITIES: City[] = [
  { slug: 'paris', name: 'Paris', dept: '75', departmentSlug: '75-paris' },
  { slug: 'marseille', name: 'Marseille', dept: '13', departmentSlug: '13-bouches-du-rhone' },
  { slug: 'lyon', name: 'Lyon', dept: '69', departmentSlug: '69-rhone' },
  { slug: 'toulouse', name: 'Toulouse', dept: '31', departmentSlug: '31-haute-garonne' },
  { slug: 'nice', name: 'Nice', dept: '06', departmentSlug: '06-alpes-maritimes' },
  { slug: 'nantes', name: 'Nantes', dept: '44', departmentSlug: '44-loire-atlantique' },
  { slug: 'strasbourg', name: 'Strasbourg', dept: '67', departmentSlug: '67-bas-rhin' },
  { slug: 'montpellier', name: 'Montpellier', dept: '34', departmentSlug: '34-herault' },
  { slug: 'bordeaux', name: 'Bordeaux', dept: '33', departmentSlug: '33-gironde' },
  { slug: 'lille', name: 'Lille', dept: '59', departmentSlug: '59-nord' },
  { slug: 'rennes', name: 'Rennes', dept: '35', departmentSlug: '35-ille-et-vilaine' },
  { slug: 'reims', name: 'Reims', dept: '51', departmentSlug: '51-marne' },
  { slug: 'le-havre', name: 'Le Havre', dept: '76', departmentSlug: '76-seine-maritime' },
  { slug: 'saint-etienne', name: 'Saint-Étienne', dept: '42', departmentSlug: '42-loire' },
  { slug: 'toulon', name: 'Toulon', dept: '83', departmentSlug: '83-var' },
  { slug: 'grenoble', name: 'Grenoble', dept: '38', departmentSlug: '38-isere' },
  { slug: 'dijon', name: 'Dijon', dept: '21', departmentSlug: '21-cote-d-or' },
  { slug: 'angers', name: 'Angers', dept: '49', departmentSlug: '49-maine-et-loire' },
  { slug: 'nimes', name: 'Nîmes', dept: '30', departmentSlug: '30-gard' },
  { slug: 'villeurbanne', name: 'Villeurbanne', dept: '69', departmentSlug: '69-rhone' },
]

/**
 * Maillage SEO 20 villes top France pour annuaire B2C.
 * Liens vers /diagnostiqueurs/[dept]/[city].
 */
export function TopCitiesGrid() {
  return (
    <section className="px-6 py-20 md:py-24 bg-paper">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">
            04 · Annuaire
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Trouvez un diagnostiqueur dans votre ville
          </h2>
          <p className="text-ink-mute leading-relaxed">
            L&apos;annuaire le plus complet de France, mis à jour quotidiennement depuis
            l&apos;annuaire officiel DHUP.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {TOP_CITIES.map((c) => (
            <Link
              key={`${c.slug}-${c.dept}`}
              href={`/diagnostiqueurs/${c.departmentSlug}/${c.slug}`}
              className="group flex items-center justify-between gap-2 px-4 py-3 rounded-md border border-rule/60 bg-paper hover:border-ink/20 hover:bg-cream transition-all"
            >
              <span className="text-sm font-medium text-ink-soft group-hover:text-ink truncate">
                {c.name}
              </span>
              <span className="font-mono text-[10px] text-ink-faint">{c.dept}</span>
            </Link>
          ))}
        </div>

        <div className="text-center">
          <Button variant="outline" asChild>
            <Link href="/diagnostiqueurs">
              Voir toutes les villes
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
