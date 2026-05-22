import { getCurrentUser } from '@/lib/auth/current-user'
import type { UserAccess } from '@/lib/decouvrir/recommendations'
import type { Metadata } from 'next'
import { DecouvrirClient } from './decouvrir-client'

export const metadata: Metadata = {
  title: 'Découvrir KOVAS',
  description:
    'Catalogue unifié des offres KOVAS 360 et KOVAS Annuaire — bundles, add-ons, sponsorisé.',
}

/**
 * Page Découvrir — point d'entrée unique pour le catalogue d'offres.
 *
 * Charge la situation actuelle de l'utilisateur depuis Supabase
 * (abonnement logiciel actif + plan annuaire si présent) puis délègue
 * au composant client pour le scoring d'intention.
 */
export default async function DecouvrirPage() {
  const { supabase, orgId } = await getCurrentUser()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('organization_id', orgId)
    .maybeSingle()

  const hasLogiciel = subscription?.status === 'active'
  const logicielTier = subscription?.tier as UserAccess['logicielTier'] | undefined

  // L'annuaire n'a pas encore de table dédiée Phase 1 — le champ sera ajouté
  // quand la table KOVAS Annuaire arrivera (M9+). En attendant : aucune fiche
  // payante détectée par défaut.
  const annuaireTier: UserAccess['annuaireTier'] | undefined = undefined
  const hasAnnuaire = false

  const access: UserAccess = {
    hasLogiciel,
    hasAnnuaire,
    logicielTier,
    annuaireTier,
  }

  const logicielTierToCode: Record<NonNullable<UserAccess['logicielTier']>, string> = {
    discovery: 'logiciel_solo_light',
    standard: 'logiciel_solo_pro',
    volume: 'logiciel_cabinet',
  }
  const annuaireTierToCode: Record<NonNullable<UserAccess['annuaireTier']>, string> = {
    local: 'annuaire_local',
    regional: 'annuaire_regional',
    national: 'annuaire_national',
  }

  const currentLogicielCode = logicielTier ? logicielTierToCode[logicielTier] : undefined
  const currentAnnuaireCode = annuaireTier ? annuaireTierToCode[annuaireTier] : undefined

  return (
    <DecouvrirClient
      access={access}
      currentLogicielCode={currentLogicielCode}
      currentAnnuaireCode={currentAnnuaireCode}
    />
  )
}
