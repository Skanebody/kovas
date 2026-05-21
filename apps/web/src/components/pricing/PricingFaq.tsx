import { Card } from '@/components/ui/card'

/**
 * FAQ tarification — page /pricing.
 * Ton sobre professionnel (avatar : diagnostiqueur 43 ans, cf. docs/avatar-client.md).
 */
interface FaqEntry {
  question: string
  answer: string
}

const PRICING_FAQ: readonly FaqEntry[] = [
  {
    question: 'Quelles différences entre les 5 formules ?',
    answer:
      "Les formules diffèrent principalement par le volume mensuel autorisé : jusqu'à 30, 60, 150, 250 ou 400 missions par mois. " +
      "Les limites de saisie vocale Whisper suivent la même progression (1h, 5h, 10h, 25h, 40h max par mois). " +
      "Les fonctionnalités cœur (saisie vocale, photos, exports universels, sync iPad/iPhone/Web) sont incluses partout. " +
      'La formule Cabinet ajoute le multi-utilisateurs (jusqu’à 3).',
  },
  {
    question: 'Que se passe-t-il si je dépasse mon quota de missions ?',
    answer:
      "Les caps sont en « fair-use » : nous ne vous bloquons pas brutalement. " +
      "À 80% du quota, vous recevez une notification. À 100%, vous pouvez continuer en mode dégradé léger. " +
      "Au-delà de 150% sur 2 mois consécutifs, nous vous suggérons la formule supérieure (plus économique pour votre profil).",
  },
  {
    question: 'Puis-je changer de formule à tout moment ?',
    answer:
      "Oui, sans frais ni engagement. Vous pouvez passer d’Essential à Pro (ou à Cabinet) en un clic dans votre compte. " +
      "Le prorata est calculé automatiquement par Stripe : vous ne payez que la différence pour le mois en cours.",
  },
  {
    question: 'Y a-t-il un engagement de durée ?',
    answer:
      "Aucun. Toutes les formules sont mensuelles, résiliables à tout moment depuis votre compte. " +
      "Si vous payez à l’année, vous bénéficiez de 2 mois offerts (10 mois facturés sur 12).",
  },
  {
    question: 'Comment fonctionnent les add-ons et les packs ?',
    answer:
      "Les add-ons sont des modules optionnels (signatures eIDAS, rapports bilingues, SMS, Pennylane, Factur-X, etc.) " +
      "que vous pouvez activer indépendamment, quelle que soit votre formule. " +
      "Les packs thématiques (Croissance, Cabinet, International) regroupent plusieurs add-ons à tarif réduit.",
  },
  {
    question: 'L’essai gratuit est-il vraiment sans engagement ?',
    answer:
      "Oui. 14 jours d’accès complet, sans carte bancaire, sans engagement. " +
      "À la fin de l’essai, vous choisissez librement votre formule (ou vous ne renouvelez pas — votre compte est gelé 90 jours puis archivé).",
  },
  {
    question: 'Quel niveau de support est inclus ?',
    answer:
      "Tous les tiers bénéficient du support par email avec réponse sous 24h ouvrées. " +
      "À partir de la formule Pro, le support est prioritaire (réponse sous 4h ouvrées). " +
      "La formule Cabinet inclut un account manager dédié.",
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
