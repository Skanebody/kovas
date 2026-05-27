'use client'

import { Card } from '@/components/ui/card'
import { LOGICIEL_OFFERS } from '@/lib/decouvrir/recommendations'
import { Check, Minus } from 'lucide-react'

/**
 * Section 8 — FAQ courte + tableau récapitulatif comparatif.
 *
 * Le tableau présente les 4 critères structurants par plan logiciel
 * (missions / surplus / stockage / utilisateurs).
 */
export function FaqComparatif() {
  const faqs = [
    {
      q: "Que se passe-t-il après l'essai 30 jours ?",
      a: "Le débit du plan choisi se déclenche automatiquement à J+30 sur la CB enregistrée à l'inscription. Tu peux résilier en 2 clics depuis Mon compte avant cette date — aucun prélèvement. Stripe envoie un email de rappel à J+27.",
    },
    {
      q: "Puis-je changer de plan en cours d'abonnement ?",
      a: 'Oui, à tout moment depuis Mon compte. La différence est calculée au prorata et appliquée sur la prochaine facture.',
    },
    {
      q: "Comment fonctionne l'annuaire KOVAS ?",
      a: 'Une fiche gratuite donne une visibilité de base. Les plans Présence / Boost / Premium te donnent une priorité géographique + des fonctions avancées (avis vérifiés, statistiques temps réel, notifications leads, profil enrichi).',
    },
    {
      q: 'Les bundles sont-ils résiliables séparément ?',
      a: 'Oui, tu peux résilier le volet logiciel ou annuaire indépendamment. La remise est conservée sur les 30 jours suivants pour te laisser le temps de décider.',
    },
    {
      q: 'KOVAS remplace-t-il Liciel ?',
      a: 'En Phase 1, KOVAS est un compagnon terrain qui exporte vers Liciel via ZIP / Email / Drive. En Phase 2 (M10-M18), KOVAS produira les calculs DPE certifiés ADEME en autonomie complète.',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Tableau comparatif */}
      <Card variant="flat" padding="default" className="overflow-x-auto">
        <h3 className="font-sans font-semibold tracking-tight text-base mb-4 text-[#0F1419]">
          Comparatif des plans KOVAS
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#0F1419]/[0.08]">
              <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-[#0F1419]/72 py-2 pr-4">
                Plan
              </th>
              {LOGICIEL_OFFERS.map((offer) => (
                <th
                  key={offer.code}
                  className="text-left font-sans font-semibold tracking-tight text-[12px] text-[#0F1419] py-2 px-3 whitespace-nowrap"
                >
                  {offer.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[12px] text-[#0F1419]/82">
            <tr className="border-b border-[#0F1419]/[0.06]">
              <td className="py-2 pr-4 font-medium">Prix</td>
              {LOGICIEL_OFFERS.map((offer) => (
                <td key={offer.code} className="py-2 px-3 text-[#0F1419]">
                  {offer.priceLabel}
                </td>
              ))}
            </tr>
            <tr className="border-b border-[#0F1419]/[0.06]">
              <td className="py-2 pr-4 font-medium">Saisie vocale</td>
              {LOGICIEL_OFFERS.map((offer) => (
                <td key={offer.code} className="py-2 px-3">
                  <Check className="size-3.5 text-accent-green" />
                </td>
              ))}
            </tr>
            <tr className="border-b border-[#0F1419]/[0.06]">
              <td className="py-2 pr-4 font-medium">Exports universels</td>
              {LOGICIEL_OFFERS.map((offer) => (
                <td key={offer.code} className="py-2 px-3">
                  <Check className="size-3.5 text-accent-green" />
                </td>
              ))}
            </tr>
            <tr className="border-b border-[#0F1419]/[0.06]">
              <td className="py-2 pr-4 font-medium">Conformité ADEME</td>
              {LOGICIEL_OFFERS.map((offer) => (
                <td key={offer.code} className="py-2 px-3">
                  {offer.priceMonthlyCents !== null && offer.priceMonthlyCents >= 7900 ? (
                    <Check className="size-3.5 text-accent-green" />
                  ) : (
                    <Minus className="size-3.5 text-[#0F1419]/40" />
                  )}
                </td>
              ))}
            </tr>
            <tr className="border-b border-[#0F1419]/[0.06]">
              <td className="py-2 pr-4 font-medium">Utilisateurs multiples</td>
              {LOGICIEL_OFFERS.map((offer) => (
                <td key={offer.code} className="py-2 px-3">
                  {offer.code === 'logiciel_cabinet_plus' ? (
                    <Check className="size-3.5 text-accent-green" />
                  ) : (
                    <Minus className="size-3.5 text-[#0F1419]/40" />
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-4 font-medium">Account manager</td>
              {LOGICIEL_OFFERS.map((offer) => (
                <td key={offer.code} className="py-2 px-3">
                  {offer.code === 'logiciel_cabinet_plus' ? (
                    <Check className="size-3.5 text-accent-green" />
                  ) : (
                    <Minus className="size-3.5 text-[#0F1419]/40" />
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </Card>

      {/* FAQ */}
      <div className="space-y-3">
        <h3 className="font-sans font-semibold tracking-tight text-base text-[#0F1419]">
          Questions fréquentes
        </h3>
        {faqs.map((f) => (
          <details
            key={f.q}
            className="group rounded-lg border border-[#0F1419]/[0.08] bg-paper px-4 py-3 transition-colors hover:bg-paper"
          >
            <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-sm font-medium text-[#0F1419]">
              <span>{f.q}</span>
              <span
                aria-hidden
                className="font-mono text-[18px] text-[#0F1419]/72 group-open:rotate-45 transition-transform"
              >
                +
              </span>
            </summary>
            <p className="text-xs text-[#0F1419]/72 mt-2 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  )
}
