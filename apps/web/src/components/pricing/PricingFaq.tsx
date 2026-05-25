import { Card } from '@/components/ui/card'

/**
 * FAQ tarification — page /pricing (refonte V3 dual track 2026-05-21).
 *
 * 5 FAQ dual track ajoutées en tête, suivies des questions historiques.
 * Ton sobre professionnel (avatar : diagnostiqueur 43 ans, cf. docs/avatar-client.md).
 */
interface FaqEntry {
  question: string
  answer: string
}

const PRICING_FAQ: readonly FaqEntry[] = [
  {
    question: 'Quelle différence entre KOVAS Annuaire et KOVAS ?',
    answer:
      "KOVAS Annuaire est un service B2C : votre fiche apparaît dans l'annuaire public et reçoit des demandes de particuliers (vendeurs, bailleurs, acheteurs). Vous payez pour la visibilité et les leads. " +
      'KOVAS est le logiciel SaaS B2B qui vous accompagne sur le terrain : saisie vocale, photos géolocalisées, exports universels, sync iPad/iPhone/Web, conformité ADEME. Vous payez pour la productivité. ' +
      "Les deux produits sont indépendants. Vous pouvez prendre l'un, l'autre, ou les deux ensemble via un Bundle remisé.",
  },
  {
    question: 'Puis-je prendre les deux ?',
    answer:
      "Oui, et c'est le cas typique pour les diagnostiqueurs qui veulent maximiser visibilité et productivité. Quatre Bundles combinent Annuaire + KOVAS avec une économie de 9 à 99 € / mois par rapport à la souscription séparée. " +
      "Exemple : Annuaire Présence 19 € + KOVAS Pro 79 € séparément = 98 €. En bundle « Acquisition » = 89 €/mo, soit 9 € d'économie chaque mois (108 €/an).",
  },
  {
    question: 'Que se passe-t-il si je suis sur un ancien forfait ?',
    answer:
      'Si vous êtes déjà client sur une ancienne grille (Essential 19 €, Découverte 29 €, Pro 39 €, All Inclusive 99 €, Cabinet 149 €, Standard 59 €, Volume 99 €, Founder 49 €, Solo Light 29 €, Solo Pro 59 €), votre prix actuel est verrouillé à vie. ' +
      'Vous gardez votre tarif tant que votre abonnement reste actif, même quand la grille publique évolue. Aucune migration forcée. Si vous souhaitez basculer sur la grille V5 actuelle (Solo 29, Pro 79, Cabinet 199, Cabinet+ 499), nous calculons les économies estimées avant tout changement.',
  },
  {
    question: 'Comment fonctionne le Sponsored Slot ?',
    answer:
      "Le Sponsored Slot est un emplacement exclusif en tête des résultats de l'annuaire, par ville. Un seul diagnostiqueur par ville, badge « Recommandé » visible sur fiche, 30 leads premium / mois inclus. " +
      "Le surcoût mensuel dépend de la population : 9 € (commune < 10 000 hab) à 149 € (mégapole > 1 M hab). Il s'ajoute à l'abonnement Annuaire Premium (79 €/mo). " +
      "Réservation par ordre d'arrivée, priorité aux diagnostiqueurs avec un score d'activité ≥ 70. Pas de surenchère cachée.",
  },
  {
    question: "Puis-je changer de plan en cours d'abonnement ?",
    answer:
      'Oui, sans frais ni engagement. Vous pouvez passer du Solo au Pro (ou au Cabinet, ou Cabinet+), upgrader votre Annuaire de Présence à Boost ou Premium, ou basculer vers un Bundle, depuis votre compte. ' +
      'Le prorata est calculé automatiquement par Stripe : vous ne payez que la différence pour le mois en cours. Le downgrade prend effet à la fin du cycle de facturation pour éviter toute interruption de service.',
  },
  // ─── FAQ historiques conservées ───
  {
    question: 'Que se passe-t-il si je dépasse mon quota de missions ?',
    answer:
      'Les caps sont en « fair-use » : nous ne vous bloquons pas brutalement. ' +
      'À 80 % du quota, vous recevez une notification. À 100 %, vous pouvez continuer en mode dégradé léger. ' +
      'Au-delà de 150 % sur 2 mois consécutifs, nous vous suggérons la formule supérieure (plus économique pour votre profil).',
  },
  {
    question: 'Y a-t-il un engagement de durée ?',
    answer:
      'Aucun. Toutes les formules sont mensuelles, résiliables à tout moment depuis votre compte. ' +
      "Si vous payez à l'année, vous bénéficiez de 2 mois offerts (10 mois facturés sur 12).",
  },
  {
    question: "L'essai gratuit est-il vraiment sans engagement ?",
    answer:
      "Oui. 30 jours d'accès complet à KOVAS, avec carte bancaire enregistrée à la souscription et débit automatique à l'issue, sans engagement long terme. " +
      "Vous pouvez annuler à tout moment depuis votre compte avant J+30 sans aucun débit. À la fin de l'essai, votre formule est activée automatiquement (ou vous résiliez — votre compte est gelé 90 jours puis archivé).",
  },
  {
    question: 'Quel niveau de support est inclus ?',
    answer:
      'Tous les tiers payants bénéficient du support par email avec réponse sous 24 h ouvrées. ' +
      'À partir du forfait Pro (79 €/mo), le support est prioritaire (réponse sous 4 h ouvrées). ' +
      'Les formules Cabinet et Cabinet+ incluent un account manager dédié.',
  },
]

export function PricingFaq() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight text-center mb-6">
        Questions fréquentes sur la tarification
      </h2>
      <div className="space-y-3">
        {PRICING_FAQ.map((entry) => (
          <Card key={entry.question} className="p-0 overflow-hidden">
            <details className="group">
              <summary className="cursor-pointer list-none px-5 py-4 flex items-start justify-between gap-3 hover:bg-ink/5 transition-colors">
                <h3 className="text-base font-semibold flex-1 min-w-0">{entry.question}</h3>
                <span
                  aria-hidden
                  className="text-ink-mute shrink-0 transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <div className="px-5 pb-5 pt-1 border-t border-rule/50 text-sm text-ink-mute leading-relaxed">
                {entry.answer}
              </div>
            </details>
          </Card>
        ))}
      </div>
    </div>
  )
}
