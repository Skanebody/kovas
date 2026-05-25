'use client'

/**
 * KOVAS — FAQ section pliable pour la page tarifs simplifiée.
 *
 * Section accordion via <details> natif (zéro dépendance, accessible, animate
 * via group-open Tailwind). 7 questions ciblées tarification.
 */

import { ChevronDown } from 'lucide-react'

interface FaqEntry {
  question: string
  answer: string
}

const FAQ: readonly FaqEntry[] = [
  {
    question: "Quelle différence entre l'Annuaire et KOVAS ?",
    answer:
      "L'Annuaire est un service B2C : votre fiche apparaît dans l'annuaire public et reçoit des demandes de particuliers. Vous payez pour la visibilité et les leads. KOVAS est le logiciel SaaS B2B qui vous accompagne sur le terrain : saisie vocale, photos géolocalisées, exports universels, sync iPad / iPhone / Web. Vous payez pour la productivité. Les deux produits sont indépendants — vous pouvez prendre l'un, l'autre, ou les deux en bundle remisé.",
  },
  {
    question: "L'essai gratuit est-il vraiment sans engagement ?",
    answer:
      "Oui. 30 jours d'accès complet à KOVAS avec carte bancaire enregistrée à la souscription et débit automatique à l'issue, sans engagement long terme. Vous pouvez annuler à tout moment avant J+30 sans aucun débit. À la fin de l'essai, votre formule est activée automatiquement (ou vous résiliez — votre compte est gelé 90 jours puis archivé).",
  },
  {
    question: "Puis-je changer de plan en cours d'abonnement ?",
    answer:
      'Oui, sans frais ni engagement. Vous pouvez passer du Solo au Pro (ou au Cabinet, ou Cabinet+), upgrader votre Annuaire de Présence à Boost ou Premium, ou basculer vers un bundle, depuis votre compte. Le prorata est calculé automatiquement par Stripe. Le downgrade prend effet à la fin du cycle de facturation pour éviter toute interruption.',
  },
  {
    question: 'Que se passe-t-il si je dépasse mon quota de missions ?',
    answer:
      'Les caps sont en fair-use : nous ne vous bloquons pas brutalement. À 80 % du quota, vous recevez une notification. À 100 %, vous pouvez continuer en mode dégradé léger. Au-delà de 150 % sur 2 mois consécutifs, nous vous suggérons la formule supérieure (plus économique pour votre profil).',
  },
  {
    question: 'Y a-t-il un engagement de durée ?',
    answer:
      "Aucun. Toutes les formules sont mensuelles, résiliables à tout moment depuis votre compte (loi Le Maire — résiliation en 3 clics). Si vous payez à l'année, vous bénéficiez de 2 mois offerts (10 mois facturés sur 12).",
  },
  {
    question: 'Quel niveau de support est inclus ?',
    answer:
      'Tous les tiers payants bénéficient du support par email avec réponse sous 24 h ouvrées. À partir du forfait Pro (79 €/mo), le support est prioritaire (réponse sous 4 h ouvrées). Les formules Cabinet et Cabinet+ incluent un account manager dédié.',
  },
  {
    question: 'Que se passe-t-il si je suis sur un ancien forfait ?',
    answer:
      'Si vous êtes déjà client sur une ancienne grille (Essential 19 €, Découverte 29 €, Pro 39 €, All Inclusive 99 €, Cabinet 149 €, Standard 59 €, Volume 99 €, Founder 49 €, Solo Light 29 €, Solo Pro 59 €), votre prix actuel est verrouillé à vie. Aucune migration forcée. Si vous souhaitez basculer sur la grille V5 actuelle (Solo 29, Pro 79, Cabinet 199, Cabinet+ 499), nous calculons les économies estimées avant tout changement.',
  },
]

export function PricingFAQ() {
  return (
    <div className="space-y-2">
      {FAQ.map((entry) => (
        <details
          key={entry.question}
          className="group rounded-2xl bg-white border border-[#0B1D33]/[0.08] overflow-hidden transition-colors hover:border-[#0B1D33]/20"
        >
          <summary className="cursor-pointer list-none px-5 sm:px-6 py-5 flex items-start justify-between gap-4">
            <h3 className="text-[15px] sm:text-[16px] font-medium text-[#0B1D33] flex-1 min-w-0 leading-snug">
              {entry.question}
            </h3>
            <ChevronDown
              aria-hidden
              className="size-4 text-[#0B1D33]/55 shrink-0 mt-0.5 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-5 sm:px-6 pb-5 -mt-1 text-[14px] text-[#0B1D33]/72 leading-relaxed">
            {entry.answer}
          </div>
        </details>
      ))}
    </div>
  )
}
