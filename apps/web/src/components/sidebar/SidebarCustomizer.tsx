'use client'

/**
 * KOVAS — SidebarCustomizer (refonte Linear-style 2026-05-23).
 *
 * Modale de personnalisation de la sidebar. Affiche :
 *  - 2 colonnes drag&drop : Visibles dans la sidebar / Dans le menu Plus
 *  - 3 boutons d'action : Restaurer défauts / Appliquer un profil / Valider
 *  - 1 dropdown profil preset
 *
 * Drag&drop natif HTML5 (sans dépendance, suffisant pour 17 items max).
 */

import type { SidebarPreferences, SidebarPreferencesItem } from '@/lib/sidebar/preferences-types'
import {
  ALL_PROFILE_PRESETS,
  type ProfilePresetCode,
  expandPreset,
  getPreset,
} from '@/lib/sidebar/profile-presets'
import {
  SIDEBAR_ITEMS_BY_ID,
  SIDEBAR_ITEMS_REGISTRY,
  type SidebarItemId,
} from '@/lib/sidebar/sidebar-items'
import { cn } from '@/lib/utils'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ChevronRight, GripVertical, RotateCcw, X } from 'lucide-react'
import { useMemo, useState } from 'react'

const CHARTREUSE = '#D4F542'
const CHARTREUSE_DEEP = '#A8C547'

interface SidebarCustomizerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefs: SidebarPreferences
  onSave: (next: SidebarPreferences) => void
}

interface DragState {
  fromZone: 'main' | 'more'
  fromIndex: number
}

export function SidebarCustomizer({ open, onOpenChange, prefs, onSave }: SidebarCustomizerProps) {
  const [mainItems, setMainItems] = useState<SidebarPreferencesItem[]>(prefs.mainItems)
  const [moreItems, setMoreItems] = useState<SidebarPreferencesItem[]>(prefs.moreItems)
  const [presetCode, setPresetCode] = useState<ProfilePresetCode | null>(prefs.profilePreset)
  const [drag, setDrag] = useState<DragState | null>(null)

  // Reset l'état local quand le modal s'ouvre / les props changent
  useMemo(() => {
    if (open) {
      setMainItems(prefs.mainItems)
      setMoreItems(prefs.moreItems)
      setPresetCode(prefs.profilePreset)
    }
  }, [open, prefs])

  function handleDragStart(zone: 'main' | 'more', index: number) {
    setDrag({ fromZone: zone, fromIndex: index })
  }

  function handleDrop(targetZone: 'main' | 'more', targetIndex: number) {
    if (!drag) return
    const { fromZone, fromIndex } = drag

    const fromList = fromZone === 'main' ? mainItems : moreItems
    const toList = targetZone === 'main' ? mainItems : moreItems

    const moved = fromList[fromIndex]
    if (!moved) return

    // Construit les nouvelles listes
    const newFrom = fromList.filter((_, i) => i !== fromIndex)
    let newTo: SidebarPreferencesItem[]
    if (fromZone === targetZone) {
      // Réordonnage intra-zone
      const adjusted = targetIndex > fromIndex ? targetIndex - 1 : targetIndex
      newTo = [...newFrom]
      newTo.splice(adjusted, 0, moved)
    } else {
      newTo = [...toList]
      newTo.splice(targetIndex, 0, moved)
    }

    // Re-positionne (positions = index dans la liste)
    const reposition = (list: SidebarPreferencesItem[]): SidebarPreferencesItem[] =>
      list.map((it, idx) => ({ ...it, position: idx }))

    if (fromZone === targetZone) {
      if (targetZone === 'main') setMainItems(reposition(newTo))
      else setMoreItems(reposition(newTo))
    } else {
      if (fromZone === 'main') {
        setMainItems(reposition(newFrom))
        setMoreItems(reposition(newTo))
      } else {
        setMoreItems(reposition(newFrom))
        setMainItems(reposition(newTo))
      }
    }
    setPresetCode(null) // edit manuel = on perd le preset
    setDrag(null)
  }

  function toggleVisibility(zone: 'main' | 'more', id: SidebarItemId) {
    const update = (list: SidebarPreferencesItem[]) =>
      list.map((it) => (it.id === id ? { ...it, visible: !it.visible } : it))
    if (zone === 'main') setMainItems(update(mainItems))
    else setMoreItems(update(moreItems))
    setPresetCode(null)
  }

  function moveToOtherZone(zone: 'main' | 'more', index: number) {
    const fromList = zone === 'main' ? mainItems : moreItems
    const toList = zone === 'main' ? moreItems : mainItems
    const moved = fromList[index]
    if (!moved) return
    const newFrom = fromList
      .filter((_, i) => i !== index)
      .map((it, idx) => ({
        ...it,
        position: idx,
      }))
    const newTo = [...toList, moved].map((it, idx) => ({ ...it, position: idx }))
    if (zone === 'main') {
      setMainItems(newFrom)
      setMoreItems(newTo)
    } else {
      setMoreItems(newFrom)
      setMainItems(newTo)
    }
    setPresetCode(null)
  }

  function applyPresetLocal(code: ProfilePresetCode) {
    const preset = getPreset(code)
    if (!preset) return
    const { mainItems: m, moreItems: o } = expandPreset(preset)
    setMainItems(m)
    setMoreItems(o)
    setPresetCode(code)
  }

  function resetDefaults() {
    const defaultMain = SIDEBAR_ITEMS_REGISTRY.filter((d) => d.defaultZone === 'main')
      .sort((a, b) => a.defaultPosition - b.defaultPosition)
      .map((d, idx) => ({ id: d.id, position: idx, visible: true }))
    const defaultMore = SIDEBAR_ITEMS_REGISTRY.filter((d) => d.defaultZone === 'more')
      .sort((a, b) => a.defaultPosition - b.defaultPosition)
      .map((d, idx) => ({ id: d.id, position: idx, visible: true }))
    setMainItems(defaultMain)
    setMoreItems(defaultMore)
    setPresetCode(null)
  }

  function save() {
    onSave({
      ...prefs,
      mainItems,
      moreItems,
      profilePreset: presetCode,
    })
    onOpenChange(false)
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-[min(900px,calc(100vw-32px))] max-h-[calc(100vh-64px)] overflow-hidden flex flex-col',
            'rounded-[20px] border border-rule/60 bg-paper shadow-xl',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            'data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-rule/40 shrink-0">
            <div>
              <DialogPrimitive.Title className="text-2xl font-serif italic text-foreground">
                Personnaliser la barre latérale
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-muted-foreground mt-1">
                Glissez-déposez les éléments pour réorganiser votre navigation.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Fermer"
              className="flex size-9 items-center justify-center rounded-full bg-sage/60 text-foreground/70 hover:bg-sage hover:text-foreground transition-colors"
            >
              <X className="size-4" strokeWidth={2} />
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 overflow-y-auto flex-1">
            <CustomizerColumn
              title="Visibles dans la barre"
              hint="Max 8 conseillé pour rester lisible"
              zone="main"
              items={mainItems}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onToggleVisibility={toggleVisibility}
              onMoveToOther={moveToOtherZone}
              otherZoneLabel="Déplacer vers Plus"
            />
            <CustomizerColumn
              title="Dans le menu Plus"
              hint="Accessibles via le bouton « Plus »"
              zone="more"
              items={moreItems}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onToggleVisibility={toggleVisibility}
              onMoveToOther={moveToOtherZone}
              otherZoneLabel="Remonter dans la barre"
            />
          </div>

          {/* Footer */}
          <div className="border-t border-rule/40 px-6 py-4 shrink-0 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetDefaults}
                className="inline-flex items-center gap-2 rounded-[10px] border border-rule/60 px-3 py-2 text-sm font-medium text-foreground/85 hover:bg-sage/60 transition-colors"
              >
                <RotateCcw className="size-4" strokeWidth={1.75} />
                Restaurer le défaut
              </button>
              <div className="relative">
                <select
                  aria-label="Appliquer un profil"
                  value={presetCode ?? ''}
                  onChange={(e) => {
                    const code = e.target.value as ProfilePresetCode | ''
                    if (code) applyPresetLocal(code)
                  }}
                  className="appearance-none rounded-[10px] border border-rule/60 bg-paper px-3 py-2 pr-8 text-sm font-medium text-foreground/85 hover:bg-sage/60 transition-colors cursor-pointer"
                >
                  <option value="">Appliquer un profil…</option>
                  {ALL_PROFILE_PRESETS.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <ChevronRight
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-4 rotate-90 pointer-events-none text-foreground/50"
                  strokeWidth={1.5}
                />
              </div>
              {presetCode ? (
                <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-foreground/55">
                  Profil actif : {getPreset(presetCode)?.label}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <DialogPrimitive.Close className="rounded-pill border border-rule/60 px-4 py-2 text-sm font-medium text-foreground/80 hover:bg-sage/60 transition-colors">
                Annuler
              </DialogPrimitive.Close>
              <button
                type="button"
                onClick={save}
                className="rounded-pill px-5 py-2 text-sm font-semibold transition-colors"
                style={{ backgroundColor: '#0F1419', color: CHARTREUSE }}
              >
                Valider
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

interface CustomizerColumnProps {
  title: string
  hint: string
  zone: 'main' | 'more'
  items: SidebarPreferencesItem[]
  onDragStart: (zone: 'main' | 'more', index: number) => void
  onDrop: (zone: 'main' | 'more', index: number) => void
  onToggleVisibility: (zone: 'main' | 'more', id: SidebarItemId) => void
  onMoveToOther: (zone: 'main' | 'more', index: number) => void
  otherZoneLabel: string
}

function CustomizerColumn({
  title,
  hint,
  zone,
  items,
  onDragStart,
  onDrop,
  onToggleVisibility,
  onMoveToOther,
  otherZoneLabel,
}: CustomizerColumnProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  return (
    <div className="rounded-[14px] border border-rule/60 bg-sage/30 p-3 flex flex-col min-h-[280px]">
      <header className="px-1 pb-3 mb-2 border-b border-rule/40 shrink-0">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-[11px] font-mono uppercase tracking-[0.06em] text-foreground/55 mt-1">
          {hint}
        </p>
      </header>
      <ul
        className="flex-1 flex flex-col gap-1.5"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          onDrop(zone, items.length)
          setHoveredIndex(null)
        }}
      >
        {items.map((item, index) => {
          const def = SIDEBAR_ITEMS_BY_ID.get(item.id)
          if (!def) return null
          const Icon = def.icon
          return (
            <li
              key={item.id}
              draggable
              onDragStart={() => onDragStart(zone, index)}
              onDragOver={(e) => {
                e.preventDefault()
                setHoveredIndex(index)
              }}
              onDragLeave={() => {
                if (hoveredIndex === index) setHoveredIndex(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDrop(zone, index)
                setHoveredIndex(null)
              }}
              className={cn(
                'flex items-center gap-3 rounded-[10px] bg-paper border px-2.5 py-2 transition-colors',
                hoveredIndex === index
                  ? 'border-[color:var(--chartreuse,#D4F542)] shadow-[0_0_0_2px_rgba(212,245,66,0.15)]'
                  : 'border-rule/50',
                !item.visible && 'opacity-50',
              )}
              style={{
                ['--chartreuse' as string]: CHARTREUSE,
              }}
            >
              <span className="cursor-grab text-foreground/40" aria-hidden>
                <GripVertical className="size-4" strokeWidth={1.5} />
              </span>
              <Icon className="size-4 shrink-0 text-foreground/70" strokeWidth={1.5} />
              <span className="flex-1 text-sm text-foreground/85 truncate">{def.label}</span>
              <button
                type="button"
                onClick={() => onMoveToOther(zone, index)}
                title={otherZoneLabel}
                aria-label={otherZoneLabel}
                className="text-[11px] font-medium text-foreground/55 hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-sage/60"
              >
                <ChevronRight
                  className={cn('size-4', zone === 'main' ? 'rotate-90' : '-rotate-90')}
                  strokeWidth={1.5}
                  style={{ color: CHARTREUSE_DEEP }}
                />
              </button>
              <label className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.06em] text-foreground/55 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-[#D4F542] size-3.5"
                  checked={item.visible}
                  onChange={() => onToggleVisibility(zone, item.id)}
                />
                Visible
              </label>
            </li>
          )
        })}
        {items.length === 0 ? (
          <li className="text-[12px] text-foreground/45 italic px-2 py-4 text-center">
            Glissez un élément ici
          </li>
        ) : null}
      </ul>
    </div>
  )
}
