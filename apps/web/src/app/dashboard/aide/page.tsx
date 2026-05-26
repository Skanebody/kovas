/**
 * KOVAS — Hub Centre d'aide (Lot B96).
 *
 * Liste les 7 tutoriels intégrés disponibles dans `/dashboard/aide/*`.
 * Ton SOBRE PROFESSIONNEL, tutoiement strict, avatar diagnostiqueur 43 ans.
 *
 * Authority : CLAUDE.md §3 (10 features) + Lot B96.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Card } from '@/components/ui/card'
import { buildNoindexMetadata } from '@/lib/seo/metadata'
import {
  AudioLines,
  Compass,
  FileArchive,
  Inbox,
  LayoutGrid,
  type LucideIcon,
  Play,
  ShieldCheck,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildNoindexMetadata({
  title: "Centre d'aide — KOVAS",
  description:
    'Tous les guides pas-à-pas pour maîtriser KOVAS : première mission, vérification ADEME, export Liciel, leads B2C, saisie vocale, mission flow continu.',
  path: '/dashboard/aide',
})

interface Tutorial {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly readTime: string
  readonly icon: LucideIcon
}

const TUTORIALS: ReadonlyArray<Tutorial> = [
  {
    slug: 'premiere-mission',
    title: 'Ta première mission en 10 minutes',
    description:
      "De la création du dossier à l'export ZIP Liciel : le parcours complet de bout en bout.",
    readTime: '10 min',
    icon: Play,
  },
  {
    slug: 'demarrer-mission',
    title: 'Où démarrer une mission ?',
    description:
      "Les 6 points d'accès au mode mission tchat IA, avec astuces offline et raccourcis clavier.",
    readTime: '5 min',
    icon: Compass,
  },
  {
    slug: 'verification-ademe',
    title: 'Vérifie ton DPE avant envoi ADEME',
    description:
      'Les 13 algorithmes de pré-validation qui te protègent des signalements et sanctions.',
    readTime: '7 min',
    icon: ShieldCheck,
  },
  {
    slug: 'export-liciel-zip',
    title: 'Exporte ton dossier vers Liciel',
    description:
      "3 modes d'export (Email, GDrive auto-sync, téléchargement) et fallback PDF + Word + CSV + JSON.",
    readTime: '6 min',
    icon: FileArchive,
  },
  {
    slug: 'recevoir-leads-b2c',
    title: 'Reçois tes premiers leads B2C',
    description:
      "Activation de l'annuaire, lead scoring intent, routing Thompson sampling et réclamation de fiche.",
    readTime: '8 min',
    icon: Inbox,
  },
  {
    slug: 'saisie-vocale-terrain',
    title: 'Saisie vocale terrain',
    description:
      'Le mode mission tchat IA hybride Whisper + parser custom + Claude Haiku pour gagner 1h30 par mission.',
    readTime: '7 min',
    icon: AudioLines,
  },
  {
    slug: 'mission-flow-continu',
    title: 'Reprends une mission en cours',
    description:
      'Mission flow continu, multi-mission par dossier (DPE + amiante + plomb), realtime cabinet collaboratif.',
    readTime: '6 min',
    icon: LayoutGrid,
  },
] as const

export default function AideHubPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        eyebrow="Centre d'aide"
        title="Tu n'es jamais"
        accent="seul"
        description="Tous les guides pas-à-pas pour maîtriser KOVAS, du premier dossier jusqu'à l'export Liciel."
      />

      <section
        aria-labelledby="tutorials-heading"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <h2 id="tutorials-heading" className="sr-only">
          Liste des tutoriels
        </h2>
        {TUTORIALS.map((tutorial) => {
          const Icon = tutorial.icon
          return (
            <Link
              key={tutorial.slug}
              href={`/dashboard/aide/${tutorial.slug}`}
              className="group rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 transition-all duration-base ease-spring hover:-translate-y-0.5 hover:border-[#0F1419]/[0.16] hover:shadow-glass-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/20"
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className="flex size-10 items-center justify-center rounded-full bg-sage-alt/60 text-ink shrink-0 group-hover:bg-chartreuse/40 transition-colors"
                  aria-hidden
                >
                  <Icon className="size-5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
                    {tutorial.readTime} de lecture
                  </p>
                  <h3 className="text-[15px] font-semibold text-ink leading-tight mt-1">
                    {tutorial.title}
                  </h3>
                </div>
              </div>
              <p className="text-[13px] text-ink-soft leading-relaxed">{tutorial.description}</p>
            </Link>
          )
        })}
      </section>

      <Card variant="opaque" padding="default" className="space-y-2">
        <p className="text-[14px] font-semibold text-ink">Tu ne trouves pas ta réponse ?</p>
        <p className="text-[13px] text-ink-soft leading-relaxed">
          Écris-nous à{' '}
          <a href="mailto:contact@kovas.fr" className="underline underline-offset-4 hover:text-ink">
            contact@kovas.fr
          </a>
          . Réponse sous 24 heures ouvrées (24/7 pour les abonnés Cabinet+).
        </p>
      </Card>
    </div>
  )
}
