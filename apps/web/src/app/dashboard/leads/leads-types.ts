import type { MissionType } from '@kovas/shared'

/**
 * Représentation UI d'un lead (assignement diagnostiqueur ↔ demande client).
 * La table `lead_assignments` (Phase E) n'existe pas encore en DB : la page
 * fonctionne en empty state tant que la table n'est pas déployée.
 */
export interface LeadItem {
  id: string
  /** Statut côté UI : pending = en attente d'action, responded = traité. */
  status: 'pending' | 'responded' | 'expired'
  /** Date d'arrivée du lead (ISO) — pour tri "premier arrivé premier servi". */
  receivedAt: string
  clientDisplayName: string
  /** Téléphone E.164 (+33...) prêt pour `tel:` */
  clientPhone: string | null
  propertyAddress: string
  propertyCity: string | null
  propertyPostalCode: string | null
  propertyType: string | null
  propertySurface: number | null
  propertyYearBuilt: number | null
  missionTypes: MissionType[]
  /** Mention "URGENT", "Avant le 30 mai", etc. — texte libre. */
  urgency: string | null
}

export type PostCallOutcome = 'quote_sent' | 'not_interested' | 'callback_later'

export const POST_CALL_OUTCOMES: { value: PostCallOutcome; label: string; hint: string }[] = [
  {
    value: 'quote_sent',
    label: 'Devis envoyé',
    hint: "Le client souhaite un devis. Vous lui enverrez après l'appel.",
  },
  {
    value: 'not_interested',
    label: 'Pas intéressé',
    hint: 'Le client a refusé ou ne donne pas suite.',
  },
  {
    value: 'callback_later',
    label: 'À rappeler',
    hint: 'Le client est intéressé mais demande un rappel ultérieur.',
  },
]
