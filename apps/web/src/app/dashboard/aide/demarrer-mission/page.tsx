/**
 * KOVAS — Page d'aide "Où démarrer une mission ?" (FIX-JJ).
 *
 * Tutoriel visuel des 6 points d'accès au mode mission tchat IA, avec astuces
 * offline et vidéo placeholder.
 *
 * Authority : CLAUDE.md §3 features 1-2-10 + FIX-JJ chantier D.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Card } from '@/components/ui/card'
import {
  Calendar,
  CheckCircle2,
  Command,
  Eye,
  ListTree,
  Lightbulb,
  Play,
  Sparkles,
  Wifi,
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Démarrer une mission — Aide',
  description:
    "Six points d'accès au mode mission tchat IA depuis n'importe où dans KOVAS.",
}

interface AccessPoint {
  number: number
  title: string
  description: string
  where: string
  icon: typeof Play
}

const ACCESS_POINTS: ReadonlyArray<AccessPoint> = [
  {
    number: 1,
    title: 'Tableau de bord — Action du jour',
    description:
      'Card "Action du jour" en haut du tableau de bord avec un gros bouton chartreuse "Démarrer ma prochaine mission". Affiche le nom du RDV et l\'horaire. Pré-sélectionne automatiquement le prochain rendez-vous en cours ou imminent (< 30 min).',
    where: '/dashboard/dashboard',
    icon: Play,
  },
  {
    number: 2,
    title: 'Sidebar — Item "Capture"',
    description:
      'Bouton "Capture" mis en avant chartreuse dans la sidebar gauche. Au clic, redirige intelligemment vers : la mission en cours (si vous étiez en train de saisir), le mode mission du RDV imminent (< 60 min), ou le wizard nouveau dossier si rien d\'urgent.',
    where: 'Sidebar → "Capture"',
    icon: Sparkles,
  },
  {
    number: 3,
    title: 'Calendrier — Bouton "Démarrer"',
    description:
      'Sur chaque RDV du calendrier (Jour/Semaine/Mois/Agenda), un clic ouvre la fiche RDV avec un bouton chartreuse "Démarrer la mission". Idéal en mobilité quand vous arrivez sur place sans passer par le dossier.',
    where: '/dashboard/calendar',
    icon: Calendar,
  },
  {
    number: 4,
    title: 'Liste des dossiers — Bouton "Mission" inline',
    description:
      'Dans la liste des dossiers, un petit bouton "Mission" chartreuse apparaît sur chaque ligne dont le RDV est planifié aujourd\'hui ou demain, ou dont la mission est déjà démarrée. Un clic = mode mission direct.',
    where: '/dashboard/dossiers',
    icon: ListTree,
  },
  {
    number: 5,
    title: 'FAB mobile (Floating Action Button)',
    description:
      'En mobile, une icône Sparkles chartreuse flotte en bas à droite. Un clic lance directement le mode mission de votre prochain RDV éligible (en cours ou dans les 48h). Distinct du bouton "+" central qui sert à créer un nouveau dossier.',
    where: 'Mobile, bottom-right',
    icon: Sparkles,
  },
  {
    number: 6,
    title: 'Command palette (Cmd+K)',
    description:
      'Ouvrez la palette de commandes avec Cmd+K (ou Ctrl+K sur Windows), puis tapez "mission" ou utilisez le raccourci direct Cmd+M pour démarrer la mission imminente sans passer par l\'UI.',
    where: 'Partout — Cmd+K ou Cmd+M',
    icon: Command,
  },
] as const

const TIPS: ReadonlyArray<{ icon: typeof Wifi; title: string; text: string }> = [
  {
    icon: Wifi,
    title: 'Activez le mode hors ligne avant zone blanche',
    text: 'Le mode mission fonctionne sans internet — Service Worker + IndexedDB conservent vos saisies et photos en local. La synchronisation reprend automatiquement au retour du réseau. Avant de partir, ouvrez l\'app une fois sur le réseau pour précharger les données du dossier.',
  },
  {
    icon: CheckCircle2,
    title: 'Vérifiez votre synchronisation avant de partir',
    text: 'L\'indicateur de sync en haut à droite doit afficher "Synchronisé". Si vous voyez des photos en attente d\'upload sur un précédent dossier, attendez la fin de la sync pour libérer de la place IndexedDB.',
  },
  {
    icon: Eye,
    title: 'La pause sauvegarde tout',
    text: 'Pendant le mode mission tchat, le bouton "Pause" en haut sauvegarde la conversation et l\'état des saisies. Vous pouvez reprendre exactement là où vous en étiez, depuis n\'importe quel point d\'accès parmi les 6.',
  },
] as const

export default function AideDemarrerMissionPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <AppPageHeader
        title="Où démarrer"
        accent="une mission ?"
        description="Six points d'accès pour lancer le mode mission tchat IA depuis n'importe où dans KOVAS."
      />

      {/* Vidéo placeholder */}
      <Card variant="opaque" padding="lg" className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
          Vidéo tutoriel — 2 min
        </p>
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-sage-alt/40 flex items-center justify-center text-ink-mute">
          <p className="text-sm italic">
            La vidéo de démonstration sera ajoutée prochainement (YouTube unlisted)
          </p>
        </div>
        <p className="text-[12px] text-ink-mute">
          En attendant la vidéo, le guide ci-dessous décrit les 6 points d&apos;accès.
        </p>
      </Card>

      {/* 6 points d'accès */}
      <section className="space-y-4">
        <h2 className="font-serif italic text-[24px] text-ink">
          Les 6 points d&apos;accès
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ACCESS_POINTS.map((point) => {
            const Icon = point.icon
            return (
              <Card key={point.number} variant="opaque" padding="default" className="space-y-3">
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-9 items-center justify-center rounded-full bg-chartreuse text-ink shrink-0"
                    aria-hidden
                  >
                    <Icon className="size-4" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
                      Point {point.number}
                    </p>
                    <h3 className="text-[15px] font-semibold text-ink leading-tight">
                      {point.title}
                    </h3>
                  </div>
                </div>
                <p className="text-[13px] text-ink-soft leading-relaxed">
                  {point.description}
                </p>
                <p className="font-mono text-[11px] text-ink-mute border-t border-rule/40 pt-2">
                  {point.where}
                </p>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Astuces */}
      <section className="space-y-4">
        <h2 className="font-serif italic text-[24px] text-ink">Astuces terrain</h2>
        <div className="space-y-3">
          {TIPS.map((tip, i) => {
            const Icon = tip.icon
            return (
              <Card key={i} variant="warm" padding="default" className="flex gap-3">
                <Icon className="size-5 text-accent-warm shrink-0 mt-0.5" aria-hidden />
                <div className="space-y-1">
                  <p className="text-[14px] font-semibold text-ink">{tip.title}</p>
                  <p className="text-[13px] text-ink-soft leading-relaxed">{tip.text}</p>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Légende symboles */}
      <Card variant="opaque" padding="default" className="space-y-2">
        <div className="flex items-start gap-3">
          <Lightbulb className="size-5 text-chartreuse-deep shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-1">
            <p className="text-[14px] font-semibold text-ink">
              Astuce : Cmd+M est le raccourci le plus rapide
            </p>
            <p className="text-[13px] text-ink-soft leading-relaxed">
              Depuis n&apos;importe quelle page de l&apos;app, Cmd+M (ou Ctrl+M sur Windows)
              démarre directement la mission imminente. Plus rapide que la sidebar ou
              le tableau de bord.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
