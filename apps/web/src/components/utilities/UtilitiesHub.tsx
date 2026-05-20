import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { ClipboardList, FileCheck, MessageSquareText, Ruler, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

interface UtilityCardSpec {
  slug: string
  icon: LucideIcon
  title: string
  description: string
}

const UTILITIES: readonly UtilityCardSpec[] = [
  {
    slug: 'diagnostics-obligatoires',
    icon: Sparkles,
    title: 'Calculateur de diagnostics obligatoires',
    description:
      'Quels diags sont réellement requis pour ce bien ? Réponse en 5 secondes, croisée avec les arrêtés préfectoraux.',
  },
  {
    slug: 'verification-validite',
    icon: FileCheck,
    title: 'Vérificateur de validité',
    description:
      'Le DPE de 2017 du client est-il encore opposable ? Et son CREP positif de 2021 ? Validité calculée selon le régime exact.',
  },
  {
    slug: 'calculatrice-surface',
    icon: Ruler,
    title: 'Calculatrice surface multi-formes',
    description:
      'Rectangle, L, T, trapèze, triangle, cercle : entrez les cotes, le total Carrez/Boutin se calcule en direct.',
  },
  {
    slug: 'modeles-client',
    icon: MessageSquareText,
    title: 'Pré-formulaires client (email / SMS)',
    description:
      "5 modèles email + 3 SMS prêts à l'emploi : demande documents, confirmation RDV, rappel J-1, envoi rapport.",
  },
  {
    slug: 'checklist-depart',
    icon: ClipboardList,
    title: 'Checklist avant de partir',
    description:
      'Avant de quitter le bien, vérifiez les photos critiques, mesures et infos manquantes — adapté aux diags actifs.',
  },
]

/**
 * Hub des 5 utilities — grille 2×3 desktop, stack mobile.
 * Design v5 : cards opaques, accent inline Instrument Serif italic sur le titre,
 * pas de chartreuse (réservé CTA primaires).
 */
export function UtilitiesHub() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {UTILITIES.map((u) => {
        const Icon = u.icon
        return (
          <Link key={u.slug} href={`/app/outils/${u.slug}`} className="group">
            <Card
              variant="opaque"
              padding="default"
              className="h-full transition-transform group-hover:-translate-y-px"
            >
              <div className="flex items-start gap-4">
                <div
                  aria-hidden
                  className="flex size-11 shrink-0 items-center justify-center rounded-md bg-navy/5 text-navy"
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <CardTitle className="text-[15px] leading-snug">{u.title}</CardTitle>
                  <CardDescription className="text-[12px] leading-relaxed">
                    {u.description}
                  </CardDescription>
                </div>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
