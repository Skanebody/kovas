'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { Settings2 } from 'lucide-react'
import { useState } from 'react'

export interface PropertyEssentialSpecs {
  /** Surface habitable totale en m² (number ou null) */
  surface_total: number | null
  /** Surface Carrez */
  surface_carrez: number | null
  /** Nombre de pièces */
  rooms_count: number | null
  /** Étage (number ou null) */
  floor_number: number | null
  /** Type d'énergie chauffage (libellé) */
  heating_type: string | null
  /** Année construction */
  year_built: number | null
  /** Date dernier DPE ISO (V1 : null sauf dérivé) */
  last_dpe_iso: string | null
  /** Date dernier amiante ISO (V1 : null sauf dérivé) */
  last_amiante_iso: string | null
}

export interface PropertyTechnicalSpecs {
  /** Préfixe cadastre */
  cadastre_prefix: string | null
  /** Section cadastre */
  cadastre_section: string | null
  /** Numéro cadastre */
  cadastre_number: string | null
  /** Référence permis de construire (V1 : non en DB) */
  permis_construire: string | null
  /** Zone ABF (Architecte des Bâtiments de France) — V1 : non en DB */
  zone_abf: string | null
  /** Code INSEE */
  insee_code: string | null
}

interface Props {
  essential: PropertyEssentialSpecs
  technical: PropertyTechnicalSpecs
}

const dateFr = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return dateFr.format(d)
}

function fmtFloor(n: number | null): string {
  if (n === null || n === undefined) return '—'
  if (n === 0) return 'RDC'
  if (n > 0) return `${n}e étage`
  return `Sous-sol ${Math.abs(n)}`
}

/**
 * Section 2 — Caractéristiques (page property SIMP-2).
 *
 * Grid 2 colonnes — 8 champs essentiels :
 *   Surface · Pièces · Étage · Chauffage · ECS · Année · Dernier DPE · Dernier amiante
 *
 * Bouton ghost "Détails techniques" → BottomSheet (cadastre, permis, ABF, INSEE…).
 */
export function PropertyCaracteristiquesSection({ essential, technical }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <section aria-labelledby="property-specs-title" className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h2
          id="property-specs-title"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute"
        >
          Caractéristiques
        </h2>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Field
          label="Surface"
          value={essential.surface_total ? `${essential.surface_total} m²` : null}
        />
        <Field label="Pièces" value={essential.rooms_count?.toString() ?? null} />
        <Field label="Étage" value={fmtFloor(essential.floor_number)} />
        <Field label="Chauffage" value={essential.heating_type} />
        <Field label="Énergie ECS" value={null} hint="Non renseigné" />
        <Field label="Année" value={essential.year_built?.toString() ?? null} />
        <Field label="Dernier DPE" value={fmtDate(essential.last_dpe_iso)} />
        <Field label="Dernier amiante" value={fmtDate(essential.last_amiante_iso)} />
      </dl>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Voir les détails techniques"
      >
        <Settings2 className="size-4" strokeWidth={1.5} />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] ml-1.5">
          Détails techniques
        </span>
      </Button>

      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Détails techniques"
        description="Cadastre, urbanisme, références administratives"
      >
        <dl className="divide-y divide-rule/40 px-2 pb-4">
          <SheetRow label="Préfixe cadastre" value={technical.cadastre_prefix ?? null} />
          <SheetRow label="Section cadastre" value={technical.cadastre_section ?? null} />
          <SheetRow label="Numéro cadastre" value={technical.cadastre_number ?? null} />
          <SheetRow label="Permis de construire" value={technical.permis_construire ?? null} />
          <SheetRow label="Zone ABF" value={technical.zone_abf ?? null} />
          <SheetRow
            label="Surface Carrez"
            value={essential.surface_carrez ? `${essential.surface_carrez} m²` : null}
          />
          <SheetRow label="Code INSEE" value={technical.insee_code ?? null} />
        </dl>
      </BottomSheet>
    </section>
  )
}

function Field({
  label,
  value,
  hint,
}: {
  label: string
  value: string | null
  hint?: string
}) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">{label}</dt>
      <dd className="text-[14px] font-medium text-ink">
        {value ?? <span className="text-ink-mute font-normal">{hint ?? '—'}</span>}
      </dd>
    </div>
  )
}

function SheetRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
        {label}
      </span>
      <span className="font-mono text-[12px] text-ink">{value ?? '—'}</span>
    </div>
  )
}
