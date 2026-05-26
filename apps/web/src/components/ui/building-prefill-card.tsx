'use client'

/**
 * Encart de pré-remplissage RNB + BDNB.
 *
 * Affiche les champs reconnus depuis l'open data officiel État FR sous l'adresse
 * BAN. L'utilisateur reste maître : il peut écraser n'importe quelle valeur
 * dans le formulaire (les inputs sont contrôlés par le parent).
 *
 * Aucune mention "IA" — c'est de l'open data : RNB (beta.gouv) + BDNB (CSTB).
 */

import { Badge } from '@/components/ui/badge'
import type { PrefillResult } from '@/lib/data-gouv/rnb-bdnb'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Loader2, Lock } from 'lucide-react'

interface BuildingPrefillCardProps {
  loading: boolean
  prefill: PrefillResult | null
  /** Vrai uniquement après une tentative effective (pas à l'état initial). */
  attempted: boolean
  className?: string
}

const PROPERTY_TYPE_LABEL: Record<string, string> = {
  maison: 'Maison individuelle',
  appartement: 'Appartement',
  bureau: 'Bureau',
  local_commercial: 'Local commercial',
  immeuble: 'Immeuble',
  autre: 'Autre',
}

const WALL_MATERIAL_LABEL: Record<string, string> = {
  beton: 'Béton',
  brique: 'Brique',
  pierre: 'Pierre',
  bois: 'Bois',
  metal: 'Métal',
  isole: 'Mur isolé',
}

const ROOF_MATERIAL_LABEL: Record<string, string> = {
  tuile: 'Tuile',
  ardoise: 'Ardoise',
  metal: 'Métal',
  beton: 'Béton',
  vegetal: 'Végétal',
}

function format(value: string, dict: Record<string, string>): string {
  return dict[value.toLowerCase()] ?? value
}

export function BuildingPrefillCard({
  loading,
  prefill,
  attempted,
  className,
}: BuildingPrefillCardProps) {
  if (!attempted && !loading) {
    return (
      <div
        className={cn(
          'rounded-md border border-rule/60 bg-cream-deep/40 px-3 py-2 text-xs text-ink-mute flex items-start gap-2',
          className,
        )}
      >
        <Lock className="size-3.5 mt-0.5 shrink-0" />
        <span>
          Tes infos seront enrichies automatiquement depuis le Référentiel National des Bâtiments
          (données officielles État).
        </span>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-md border border-rule/60 bg-cream-deep/40 px-3 py-2 text-xs text-ink-mute flex items-center gap-2',
          className,
        )}
      >
        <Loader2 className="size-3.5 animate-spin shrink-0" />
        <span>Recherche dans le Référentiel National des Bâtiments…</span>
      </div>
    )
  }

  if (!prefill) {
    return (
      <div
        className={cn(
          'rounded-md border border-rule/60 bg-cream-deep/40 px-3 py-2 text-xs text-ink-mute flex items-start gap-2',
          className,
        )}
      >
        <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
        <span>
          Aucune donnée pré-remplie pour cette adresse (bâtiment hors référentiel ou service
          temporairement indisponible). Saisis les infos manuellement, c'est ok.
        </span>
      </div>
    )
  }

  // Au moins une donnée utile à afficher ?
  const hasData =
    prefill.year_built ||
    prefill.surface_total ||
    prefill.property_type ||
    prefill.wall_material ||
    prefill.roof_material ||
    prefill.dpe_class ||
    prefill.asbestos_probable ||
    prefill.lead_probable

  if (!hasData) {
    return (
      <div
        className={cn(
          'rounded-md border border-rule/60 bg-cream-deep/40 px-3 py-2 text-xs text-ink-mute flex items-start gap-2',
          className,
        )}
      >
        <Lock className="size-3.5 mt-0.5 shrink-0" />
        <span>
          Bâtiment identifié (RNB&nbsp;{prefill.rnb_id}) — aucune donnée détaillée disponible côté
          BDNB. Saisis manuellement.
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-md border border-rule bg-paper px-3 py-3 space-y-2.5 animate-fade-in',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs text-ink-mute">
        <CheckCircle2 className="size-3.5 text-accent-green shrink-0" />
        <span>
          Données pré-remplies depuis le{' '}
          <strong className="text-ink font-medium">Référentiel National des Bâtiments</strong>{' '}
          officiel
          {prefill.meta.degraded && (
            <span className="ml-1 text-[10px] text-ink-mute">(enrichissement partiel)</span>
          )}
        </span>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {prefill.year_built && (
          <li className="flex justify-between gap-2">
            <span className="text-ink-mute">Année de construction</span>
            <span className="font-medium text-ink">
              {prefill.year_built.value}
              {prefill.year_built.confidence < 0.8 && (
                <Badge variant="muted" className="ml-1.5 text-[9px]">
                  à valider
                </Badge>
              )}
            </span>
          </li>
        )}
        {prefill.surface_total && (
          <li className="flex justify-between gap-2">
            <span className="text-ink-mute">Surface estimée</span>
            <span className="font-medium text-ink">
              {prefill.surface_total.value.toFixed(0)} m²
              <Badge variant="muted" className="ml-1.5 text-[9px]">
                estimation
              </Badge>
            </span>
          </li>
        )}
        {prefill.property_type && (
          <li className="flex justify-between gap-2">
            <span className="text-ink-mute">Type de bien</span>
            <span className="font-medium text-ink">
              {format(prefill.property_type.value, PROPERTY_TYPE_LABEL)}
            </span>
          </li>
        )}
        {prefill.wall_material && (
          <li className="flex justify-between gap-2">
            <span className="text-ink-mute">Murs</span>
            <span className="font-medium text-ink">
              {format(prefill.wall_material.value, WALL_MATERIAL_LABEL)}
            </span>
          </li>
        )}
        {prefill.roof_material && (
          <li className="flex justify-between gap-2">
            <span className="text-ink-mute">Toiture</span>
            <span className="font-medium text-ink">
              {format(prefill.roof_material.value, ROOF_MATERIAL_LABEL)}
            </span>
          </li>
        )}
        {prefill.dpe_class && (
          <li className="flex justify-between gap-2">
            <span className="text-ink-mute">DPE consolidé</span>
            <span className="font-medium text-ink">
              {prefill.dpe_class.value}{' '}
              <Badge variant="muted" className="ml-1 text-[9px]">
                indicatif
              </Badge>
            </span>
          </li>
        )}
        {prefill.asbestos_probable?.value && (
          <li className="flex justify-between gap-2">
            <span className="text-ink-mute">Amiante</span>
            <span className="font-medium text-ink">
              Probable
              <Badge variant="orange" className="ml-1.5 text-[9px]">
                bâti pré-1997
              </Badge>
            </span>
          </li>
        )}
        {prefill.lead_probable?.value && (
          <li className="flex justify-between gap-2">
            <span className="text-ink-mute">Plomb (CREP)</span>
            <span className="font-medium text-ink">
              Probable
              <Badge variant="orange" className="ml-1.5 text-[9px]">
                bâti pré-1949
              </Badge>
            </span>
          </li>
        )}
      </ul>

      <p className="text-[10px] text-ink-mute pt-1">
        RNB&nbsp;<span className="font-mono">{prefill.rnb_id}</span> — tu restes maître, modifie les
        champs ci-dessous si besoin.
      </p>
    </div>
  )
}
