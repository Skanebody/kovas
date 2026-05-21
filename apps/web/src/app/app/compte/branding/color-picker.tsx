'use client'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import { Check, Loader2 } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { updateBrandColorAction } from './actions'

interface BrandPreset {
  hex: string
  label: string
}

/**
 * 8 presets sobres alignés DS v5 (pas de couleurs flashy, registre métier).
 * L'utilisateur reste libre via le color input natif + champ texte hex.
 */
const BRAND_PRESETS: ReadonlyArray<BrandPreset> = [
  { hex: '#0F1419', label: 'Noir' },
  { hex: '#1A2238', label: 'Navy' },
  { hex: '#4A5878', label: 'Gris' },
  { hex: '#5B3A1E', label: 'Marron' },
  { hex: '#6B1F2B', label: 'Bordeaux' },
  { hex: '#2C4A2E', label: 'Forêt' },
  { hex: '#1B2D4A', label: 'Bleu nuit' },
  { hex: '#2B2E33', label: 'Anthracite' },
]

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/

interface BrandColorPickerProps {
  /** Couleur actuelle (#RRGGBB). */
  currentHex: string
}

export function BrandColorPicker({ currentHex }: BrandColorPickerProps) {
  const [hex, setHex] = useState<string>(currentHex.toUpperCase())
  const [dirty, setDirty] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setHex(currentHex.toUpperCase())
    setDirty(false)
  }, [currentHex])

  const isValid = HEX_PATTERN.test(hex)

  const onPickPreset = (preset: string) => {
    setHex(preset)
    setDirty(preset.toUpperCase() !== currentHex.toUpperCase())
  }

  const onNativeColorChange = (value: string) => {
    const normalized = value.toUpperCase()
    setHex(normalized)
    setDirty(normalized !== currentHex.toUpperCase())
  }

  const onTextChange = (value: string) => {
    // Auto-prefix `#` si l'utilisateur tape juste les 6 hex
    let normalized = value.trim().toUpperCase()
    if (normalized.length > 0 && !normalized.startsWith('#')) {
      normalized = `#${normalized}`
    }
    if (normalized.length > 7) {
      normalized = normalized.slice(0, 7)
    }
    setHex(normalized)
    setDirty(normalized !== currentHex.toUpperCase())
  }

  const handleSave = () => {
    if (!isValid) {
      toast.error('Code couleur invalide (format attendu : #RRGGBB)')
      return
    }
    startTransition(async () => {
      const result = await updateBrandColorAction(hex)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Couleur enregistrée.')
        setDirty(false)
      }
    })
  }

  return (
    <div className="space-y-5">
      {/* ============ Ligne principale : swatch + input texte + input natif ============ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Aperçu swatch large */}
        <label
          htmlFor="brand-color-native"
          className={cn(
            'relative size-[80px] shrink-0 rounded-[16px] border border-[#0F1419]/[0.08]',
            'cursor-pointer transition-shadow hover:shadow-md',
          )}
          style={{ backgroundColor: isValid ? hex : '#FFFFFF' }}
          aria-label="Choisir une couleur personnalisée"
        >
          <input
            id="brand-color-native"
            type="color"
            value={isValid ? hex : '#000000'}
            onChange={(e) => onNativeColorChange(e.target.value)}
            className="sr-only"
          />
        </label>

        {/* Champ hex */}
        <div className="flex-1 space-y-1.5">
          <label
            htmlFor="brand-color-hex"
            className="block font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F1419]/55"
          >
            Code couleur
          </label>
          <input
            id="brand-color-hex"
            type="text"
            value={hex}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="#0F1419"
            maxLength={7}
            spellCheck={false}
            autoComplete="off"
            className={cn(
              'w-full max-w-[200px] min-h-[44px] rounded-md px-4 py-2.5',
              'font-mono text-[13px] tracking-[0.05em] uppercase tabular-nums',
              'bg-white border transition-all',
              'focus-visible:outline-none focus-visible:ring-[4px]',
              isValid
                ? 'border-[#0F1419]/15 text-[#0F1419] focus-visible:border-[#0F1419] focus-visible:ring-[#0F1419]/10'
                : 'border-accent-red/40 text-accent-red focus-visible:border-accent-red focus-visible:ring-accent-red/10',
            )}
          />
          {!isValid && (
            <p className="text-[11px] text-accent-red">
              Format attendu : #RRGGBB (6 caractères hexa)
            </p>
          )}
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={!isValid || !dirty || pending}
          size="default"
          className="shrink-0"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          Enregistrer
        </Button>
      </div>

      {/* ============ Presets sobres ============ */}
      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-[#0F1419]/55">
          Suggestions
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {BRAND_PRESETS.map((preset) => {
            const isActive = preset.hex.toUpperCase() === hex.toUpperCase()
            return (
              <button
                key={preset.hex}
                type="button"
                onClick={() => onPickPreset(preset.hex)}
                aria-label={preset.label}
                aria-pressed={isActive}
                className={cn(
                  'group relative flex flex-col items-center gap-1.5 rounded-[12px] p-2',
                  'transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F1419]/10',
                  isActive
                    ? 'bg-[#0F1419]/[0.04] ring-1 ring-[#0F1419]/20'
                    : 'hover:bg-[#0F1419]/[0.03]',
                )}
              >
                <span
                  className={cn(
                    'relative size-10 rounded-full border border-[#0F1419]/[0.08] shadow-sm',
                    'transition-transform group-hover:scale-105',
                  )}
                  style={{ backgroundColor: preset.hex }}
                >
                  {isActive && (
                    <Check
                      className="absolute inset-0 m-auto size-4 text-white drop-shadow-sm"
                      strokeWidth={3}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    'font-mono text-[10px] tracking-[0.05em]',
                    isActive ? 'text-[#0F1419]' : 'text-[#0F1419]/55',
                  )}
                >
                  {preset.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
