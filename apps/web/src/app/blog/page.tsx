import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Conseils diagnostiqueurs',
  description:
    'Articles, guides et analyses pour les diagnostiqueurs immobiliers indépendants. Réglementation, productivité terrain, outils, bonnes pratiques.',
}

interface BlogPost {
  slug: string
  title: string
  excerpt: string
  publishedAt: string
  readingTimeMinutes: number
  category: 'Réglementation' | 'Productivité' | 'Outils' | 'Bonnes pratiques' | 'Témoignages'
}

const POSTS: BlogPost[] = [
  {
    slug: 'decret-2023-417-checklist',
    title: 'Décret 2023-417 : la checklist complète pour rester conforme',
    excerpt:
      'Les 12 obligations introduites par le décret 2023-417, leur impact concret sur ton quotidien et la checklist KOVAS pour ne rien oublier.',
    publishedAt: '2026-05-18',
    readingTimeMinutes: 8,
    category: 'Réglementation',
  },
  {
    slug: 'saisie-vocale-terrain-mode-emploi',
    title: "Saisie vocale terrain : mode d'emploi en 5 étapes",
    excerpt:
      'Comment passer de 2 heures de re-saisie à 30 secondes de partage. Témoignage chiffré et bonnes pratiques pour démarrer dès lundi.',
    publishedAt: '2026-05-15',
    readingTimeMinutes: 6,
    category: 'Productivité',
  },
  {
    slug: 'fraude-dpe-4-patterns',
    title: 'Fraude DPE : les 4 patterns que KOVAS détecte avant ADEME',
    excerpt:
      "Étiquettes suspectes, sauts de classe, incohérences typologiques, données aberrantes : comment l'IA repère les profils douteux.",
    publishedAt: '2026-05-12',
    readingTimeMinutes: 9,
    category: 'Réglementation',
  },
  {
    slug: 'optimiser-tournee-mission-multiple',
    title: 'Optimiser sa tournée : 4 missions dans la journée, sans stress',
    excerpt:
      'La planification iPad terrain, les templates pré-remplis, la sync automatique. Comment doubler son volume sans embaucher.',
    publishedAt: '2026-05-09',
    readingTimeMinutes: 7,
    category: 'Productivité',
  },
  {
    slug: 'maprimerenov-recos-post-dpe',
    title: "MaPrimeRénov' : générer les recommandations post-DPE F/G automatiquement",
    excerpt:
      'Les aides applicables selon les caractéristiques du logement et du foyer. Comment KOVAS calcule le scénario optimal en V2.',
    publishedAt: '2026-05-05',
    readingTimeMinutes: 11,
    category: 'Outils',
  },
  {
    slug: 'liciel-vs-kovas-cohabitation',
    title: 'Cohabiter avec Liciel, OBBC, AnalysImmo ou ORIS : workflow KOVAS compagnon',
    excerpt:
      'Le terrain dans KOVAS, le calcul DPE certifié dans ton éditeur. Comment configurer le bouton Partager pour zéro re-saisie quel que soit ton logiciel.',
    publishedAt: '2026-05-02',
    readingTimeMinutes: 6,
    category: 'Outils',
  },
  {
    slug: 'check-list-amiante-avant-1997',
    title: 'Amiante avant 1997 : la check-list que tu oublies probablement',
    excerpt:
      "Les 23 matériaux à inspecter, les pièces souvent négligées, les pièges des sous-sols. Retour d'expérience cabinet.",
    publishedAt: '2026-04-28',
    readingTimeMinutes: 8,
    category: 'Bonnes pratiques',
  },
  {
    slug: 'annuaire-kovas-leads-gratuits',
    title: 'Annuaire kovas.fr : 11 leads en 2 mois sans budget marketing',
    excerpt:
      'Comment configurer ta fiche publique pour capter les leads particuliers. Témoignage Thomas R. (cabinet Lyonnais).',
    publishedAt: '2026-04-24',
    readingTimeMinutes: 5,
    category: 'Témoignages',
  },
  {
    slug: 'mode-offline-sous-sols',
    title: 'Mode offline complet : travailler sans réseau dans les sous-sols',
    excerpt:
      'Service Worker + IndexedDB. Comment KOVAS reste fonctionnel sans 4G et sync automatiquement au retour en surface.',
    publishedAt: '2026-04-20',
    readingTimeMinutes: 5,
    category: 'Outils',
  },
  {
    slug: 'facturation-laft-decret',
    title: "Facturation séquentielle et LAFT : ce qu'il faut savoir",
    excerpt:
      'Article 289 du CGI, attestation LAFT, séquentialité des numéros : comment KOVAS verrouille ta conformité.',
    publishedAt: '2026-04-17',
    readingTimeMinutes: 7,
    category: 'Réglementation',
  },
  {
    slug: 'devis-30-secondes-conversion',
    title: 'Devis en 30 secondes : doubler son taux de conversion',
    excerpt:
      "Le devis automatique pré-rempli à partir d'un lead annuaire. Pourquoi la vitesse de réponse change tout.",
    publishedAt: '2026-04-13',
    readingTimeMinutes: 4,
    category: 'Productivité',
  },
  {
    slug: 'photos-geolocalisees-evidence',
    title: 'Photos géolocalisées : ta meilleure défense juridique',
    excerpt:
      'Géolocalisation EXIF, horodatage, traçabilité. Comment KOVAS protège ta responsabilité en cas de litige.',
    publishedAt: '2026-04-10',
    readingTimeMinutes: 6,
    category: 'Bonnes pratiques',
  },
]

const CATEGORY_VARIANT: Record<
  BlogPost['category'],
  'blue' | 'green' | 'orange' | 'muted' | 'yellow'
> = {
  Réglementation: 'orange',
  Productivité: 'green',
  Outils: 'blue',
  'Bonnes pratiques': 'yellow',
  Témoignages: 'muted',
}

const POSTS_PER_PAGE = 12

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export default function ProsBlogPage() {
  const visiblePosts = POSTS.slice(0, POSTS_PER_PAGE)

  return (
    <div className="px-6 py-16">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="mx-auto max-w-2xl space-y-3 text-center">
          <Badge variant="muted">Conseils diagnostiqueurs</Badge>
          <h1 className="font-display text-display-m font-light tracking-tight text-ink sm:text-display-l">
            Le blog <span className="text-display-serif text-chartreuse-deep">métier</span> KOVAS
          </h1>
          <p className="text-ink-mute">
            Articles, guides et analyses pour les diagnostiqueurs immobiliers indépendants.
            Réglementation, productivité terrain, outils, bonnes pratiques.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visiblePosts.map((post) => (
            <Card
              key={post.slug}
              variant="opaque"
              padding="default"
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant={CATEGORY_VARIANT[post.category]}>{post.category}</Badge>
                <span className="font-mono text-[11px] text-ink-faint">
                  {post.readingTimeMinutes} min
                </span>
              </div>
              <h2 className="text-lg font-semibold leading-tight text-ink">{post.title}</h2>
              <p className="text-sm text-ink-mute">{post.excerpt}</p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
                  {formatDate(post.publishedAt)}
                </span>
                <a
                  href={`/blog/${post.slug}`}
                  aria-label={`Lire ${post.title}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:text-navy-deep"
                >
                  Lire <ArrowRight className="size-3.5" />
                </a>
              </div>
            </Card>
          ))}
        </div>

        {POSTS.length > POSTS_PER_PAGE && (
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-ink-faint">
              Page 1 sur {Math.ceil(POSTS.length / POSTS_PER_PAGE)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
