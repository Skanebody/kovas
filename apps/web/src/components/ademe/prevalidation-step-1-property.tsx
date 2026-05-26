'use client'

import { ArrowRight, Building2, Home, Layers } from 'lucide-react'

import { AddressAutocomplete, type AddressValue } from '@/components/ui/address-autocomplete'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { FieldHint } from './field-hint'

export type BuildingType = 'maison' | 'appartement' | 'immeuble'

export interface PropertyStepValues {
  address: AddressValue | null
  type_batiment: BuildingType
  annee_construction: number | null
  surface_habitable_m2: number | null
}

interface Step1Props {
  values: PropertyStepValues
  onChange: (patch: Partial<PropertyStepValues>) => void
  onContinue: () => void
  /** Adresse pré-saisie pour le defaultValue de l'Autocomplete. */
  initialAddressLabel?: string
}

const BUILDING_TYPES: Array<{
  value: BuildingType
  label: string
  icon: React.ComponentType<{ className?: string }>
}> = [
  { value: 'maison', label: 'Maison', icon: Home },
  { value: 'appartement', label: 'Appartement', icon: Building2 },
  { value: 'immeuble', label: 'Immeuble', icon: Layers },
]

/**
 * Step 1 — Identifier le bien à diagnostiquer.
 * 4 champs : adresse BAN, type bâtiment (radio chips), année, surface.
 */
export function PrevalidationStep1Property({
  values,
  onChange,
  onContinue,
  initialAddressLabel,
}: Step1Props) {
  const canContinue =
    values.address !== null &&
    values.address.label.length > 0 &&
    values.annee_construction !== null &&
    values.annee_construction > 1800 &&
    values.surface_habitable_m2 !== null &&
    values.surface_habitable_m2 > 0

  return (
    <Card variant="opaque" padding="default" className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold text-[#0F1419]">Le bien à diagnostiquer</h3>
        <p className="text-[11px] text-[#0F1419]/72">
          Adresse et caractéristiques principales — données issues du dossier ou de la pré-visite.
        </p>
      </div>

      <FormField label="Adresse du bien" required htmlFor="address">
        <AddressAutocomplete
          name="address"
          defaultValue={initialAddressLabel ?? values.address?.label ?? ''}
          placeholder="12 rue de Rivoli, 75001 Paris"
          required
          onSelect={(addr) => onChange({ address: addr })}
        />
        <FieldHint tooltip="L'adresse est utilisée pour le contrôle de cohérence géographique avec les bases ADEME (BAN, IGN, Géorisques).">
          Sélectionnez une adresse précise dans la liste BAN (numéro + rue + code postal).
        </FieldHint>
      </FormField>

      <FormField label="Type de bâtiment" required>
        <div className="grid grid-cols-3 gap-2.5">
          {BUILDING_TYPES.map(({ value, label, icon: Icon }) => {
            const selected = values.type_batiment === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ type_batiment: value })}
                aria-pressed={selected}
                className={cn(
                  'flex flex-col items-center justify-center gap-2 rounded-md border-2 px-3 py-4 transition-colors duration-200',
                  'min-h-[88px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/20',
                  selected
                    ? 'border-navy bg-navy/5'
                    : 'border-[#0F1419]/[0.08] bg-paper hover:border-[#0F1419]/30',
                )}
              >
                <Icon
                  className={cn(
                    'size-5 transition-colors',
                    selected ? 'text-navy' : 'text-[#0F1419]/72',
                  )}
                />
                <span
                  className={cn(
                    'text-[12px] font-medium',
                    selected ? 'text-[#0F1419]' : 'text-[#0F1419]/72',
                  )}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Année de construction" required>
          <Input
            name="annee_construction"
            type="number"
            min={1800}
            max={2100}
            required
            value={values.annee_construction ?? ''}
            onChange={(e) =>
              onChange({
                annee_construction: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder="1990"
          />
          <FieldHint tooltip="Ex : pour une maison construite en 1985, l'année figure sur les plans d'origine ou l'acte de propriété.">
            Date des plans d&apos;origine, pas date des rénovations.
          </FieldHint>
        </FormField>

        <FormField label="Surface habitable (m²)" required>
          <Input
            name="surface_habitable_m2"
            type="number"
            min={1}
            max={5000}
            step="0.1"
            required
            value={values.surface_habitable_m2 ?? ''}
            onChange={(e) =>
              onChange({
                surface_habitable_m2: e.target.value === '' ? null : Number(e.target.value),
              })
            }
            placeholder="80"
          />
          <FieldHint tooltip="Surface au sens loi Boutin pour les locations, ou Carrez pour les appartements en copropriété. Exclut balcons, terrasses, caves non aménagées.">
            Surface utile, hors balcons et caves.
          </FieldHint>
        </FormField>
      </div>

      <div className="flex items-center justify-end pt-2">
        <Button
          type="button"
          variant="accent"
          size="lg"
          disabled={!canContinue}
          onClick={onContinue}
        >
          Continuer
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </Card>
  )
}
