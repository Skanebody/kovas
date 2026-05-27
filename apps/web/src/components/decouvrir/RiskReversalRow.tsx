/**
 * KOVAS — Risk Reversal Row (Hormozi + Colucci) pour la page Découvrir.
 *
 * Pattern "Grand Slam Offer" §14 + "Risque-nul" §9 : afficher les 4 garanties
 * structurantes JUSTE après la situation actuelle, avant que le diagnostiqueur
 * ne commence à scanner les prix. Objectif : désamorcer les peurs cognitives
 * (engagement, perte de données, complexité) en moins de 2 secondes de lecture.
 *
 * 4 garanties non négociables (alignées avec CGV v1.4 + §6 essai 30j AVEC CB) :
 *   1. Essai 30 jours sans débit       — modèle Qonto / Linear / ManyChat 2026
 *   2. Résiliation 2 clics              — Customer Portal Stripe accessible 24/7
 *   3. Tes données restent à toi        — export PDF/Word/CSV/JSON/ZIP universel
 *   4. Aucun engagement                 — mensuel, sans frais de sortie
 *
 * Design System v5 :
 *   - Card flat sage `#F5F7F4` + bordure rule
 *   - Pas d'accent chartreuse (parcimonie : réservé aux CTA primaires de la page)
 *   - Icones Lucide 16px navy
 *   - Typo Manrope, micro-copy 13px (Krug — half the words)
 *   - Layout 1 col mobile / 2 col tablet / 4 col desktop
 *
 * Avatar SOBRE PROFESSIONNEL : tutoiement, ton factuel, pas d'emojis, pas de
 * superlatifs marketing. Le diagnostiqueur 43 ans veut des faits.
 */

import { Card } from '@/components/ui/card'
import { CalendarCheck, DoorOpen, FileDown, ShieldCheck } from 'lucide-react'

interface Guarantee {
  icon: typeof ShieldCheck
  title: string
  description: string
}

const GUARANTEES: readonly Guarantee[] = [
  {
    icon: CalendarCheck,
    title: 'Essai 30 jours sans débit',
    description:
      'CB requise à l’inscription pour valider ton identité pro. Aucun prélèvement avant J+30.',
  },
  {
    icon: DoorOpen,
    title: 'Résiliation en 2 clics',
    description:
      'Customer Portal Stripe accessible 24/7 depuis ton compte. Aucune négociation, aucun appel.',
  },
  {
    icon: FileDown,
    title: 'Tes données restent à toi',
    description:
      'Export PDF, Word, CSV, JSON ou ZIP Liciel à tout moment. Aucun verrou propriétaire.',
  },
  {
    icon: ShieldCheck,
    title: 'Aucun engagement',
    description: 'Mensuel ou annuel (−15 %), changement de plan au prorata, aucun frais de sortie.',
  },
] as const

export function RiskReversalRow() {
  return (
    <Card
      variant="flat"
      padding="default"
      className="bg-[#F5F7F4] border-[#0F1419]/[0.08]"
      aria-label="Garanties KOVAS — risque zéro"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {GUARANTEES.map((g) => {
          const Icon = g.icon
          return (
            <div key={g.title} className="flex items-start gap-3">
              <div
                className="shrink-0 size-9 rounded-full bg-paper border border-[#0F1419]/[0.08] flex items-center justify-center"
                aria-hidden
              >
                <Icon className="size-4 text-[#0F1419]" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="font-sans font-semibold tracking-tight text-[13px] text-[#0F1419]">
                  {g.title}
                </p>
                <p className="text-[12px] leading-relaxed text-[#0F1419]/72">{g.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
