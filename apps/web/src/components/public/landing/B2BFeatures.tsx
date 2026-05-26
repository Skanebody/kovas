import { cn } from '@/lib/utils'
import {
  FileCheck2,
  FileText,
  Mic,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

interface Feature {
  icon: LucideIcon
  number: string
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: Mic,
    number: '01',
    title: 'Saisie vocale terrain → rapport en 1 clic',
    description:
      'Dictée vocale structurée par pièce. Compatible mode hors-ligne. Transcription FR + structuration métier locale, exports immédiats.',
  },
  {
    icon: FileText,
    number: '02',
    title: 'Exports universels',
    description:
      'Compatible Liciel, OBBC, AnalysImmo et ORIS (Imports spécifiques XML, ZIP générique, XML CII, JSON) + PDF, Word, CSV. Aucune migration : votre logiciel certifié reste votre moteur ADEME.',
  },
  {
    icon: ShieldCheck,
    number: '03',
    title: 'Conformité ADEME automatique',
    description:
      'Cockpit ADEME monitoring quotidien. Détection automatique des écarts de cohérence avant publication. Pré-validation 3CL.',
  },
  {
    icon: FileCheck2,
    number: '04',
    title: 'Devis & factures conformes (Factur-X)',
    description:
      'Génération automatique des devis et factures conformes loi 2024. QR Code SEPA, relances automatiques, conformité PPF Iopole 2027.',
  },
  {
    icon: Users,
    number: '05',
    title: 'Annuaire public — leads qualifiés',
    description:
      'Votre fiche publique enrichie + demandes de devis directes des particuliers. Aucun frais d’acquisition de leads.',
  },
]

/**
 * 5 piliers fonctionnels B2B en grille zigzag (alterne gauche/droite).
 */
export function B2BFeatures() {
  return (
    <section id="features" className="px-6 py-20 md:py-24 bg-paper">
      <div className="mx-auto max-w-6xl space-y-14">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">
            02 · La solution
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Tout votre métier dans un seul outil.
          </h2>
          <p className="text-ink-mute leading-relaxed">
            5 piliers conçus pour les diagnostiqueurs immobiliers indépendants.
          </p>
        </div>

        <ul className="space-y-12 md:space-y-16">
          {FEATURES.map((f, i) => (
            <li
              key={f.number}
              className={cn(
                'grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-14 items-center',
              )}
            >
              {/* Mock visuel */}
              <div
                className={cn(
                  'order-1 rounded-xl border border-rule/60 bg-sage aspect-[4/3] flex items-center justify-center p-8',
                  i % 2 === 1 && 'md:order-2',
                )}
                aria-hidden
              >
                <div className="flex flex-col items-center gap-3 text-ink-mute">
                  <div className="size-14 rounded-md bg-chartreuse-soft flex items-center justify-center">
                    <f.icon className="size-7 text-chartreuse-deep" />
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-wider">
                    Capture · {f.title.split('—')[0]?.trim() || f.title}
                  </span>
                </div>
              </div>

              {/* Texte */}
              <div
                className={cn(
                  'order-2 space-y-4',
                  i % 2 === 1 && 'md:order-1',
                )}
              >
                <p className="font-serif italic text-4xl text-ink-faint leading-none">
                  {f.number}
                </p>
                <h3 className="text-2xl font-bold text-ink leading-tight">{f.title}</h3>
                <p className="text-ink-mute leading-relaxed">{f.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
