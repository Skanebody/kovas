'use client'

import { Loader2, MapPin } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface BanFeatureLite {
  label: string
  housenumber?: string
  name?: string
  postcode?: string
  city?: string
  citycode?: string
  coordinates: [number, number]
}

export interface AddressValue {
  label: string
  street?: string
  postalCode?: string
  city?: string
  insee?: string
  longitude?: number
  latitude?: number
}

interface AddressAutocompleteProps {
  name: string
  defaultValue?: string
  placeholder?: string
  required?: boolean
  onSelect?: (value: AddressValue) => void
}

export function AddressAutocomplete({
  name,
  defaultValue = '',
  placeholder = '12 rue de Rivoli, 75001 Paris',
  required,
  onSelect,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(defaultValue)
  const [features, setFeatures] = useState<BanFeatureLite[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedMeta, setSelectedMeta] = useState<AddressValue | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query.length < 3) {
      setFeatures([])
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ban/search?q=${encodeURIComponent(query)}`)
        const data = await res.json()
        const items: BanFeatureLite[] = (data.features ?? []).map(
          // biome-ignore lint/suspicious/noExplicitAny: BAN response
          (f: any) => ({
            label: f.properties.label,
            housenumber: f.properties.housenumber,
            name: f.properties.name,
            postcode: f.properties.postcode,
            city: f.properties.city,
            citycode: f.properties.citycode,
            coordinates: f.geometry.coordinates,
          }),
        )
        setFeatures(items)
      } catch {
        setFeatures([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleSelect(f: BanFeatureLite) {
    const value: AddressValue = {
      label: f.label,
      street: f.name,
      postalCode: f.postcode,
      city: f.city,
      insee: f.citycode,
      longitude: f.coordinates[0],
      latitude: f.coordinates[1],
    }
    setQuery(f.label)
    setSelectedMeta(value)
    setOpen(false)
    onSelect?.(value)
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="text"
        name={name}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setSelectedMeta(null)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        required={required}
        aria-autocomplete="list"
        aria-controls={listId}
        autoComplete="off"
      />
      {loading && (
        <Loader2 className="size-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute" />
      )}

      {/* Hidden fields to submit structured meta alongside the label */}
      {selectedMeta && (
        <>
          <input type="hidden" name={`${name}_street`} value={selectedMeta.street ?? ''} />
          <input type="hidden" name={`${name}_postcode`} value={selectedMeta.postalCode ?? ''} />
          <input type="hidden" name={`${name}_city`} value={selectedMeta.city ?? ''} />
          <input type="hidden" name={`${name}_insee`} value={selectedMeta.insee ?? ''} />
          <input type="hidden" name={`${name}_lng`} value={String(selectedMeta.longitude ?? '')} />
          <input type="hidden" name={`${name}_lat`} value={String(selectedMeta.latitude ?? '')} />
        </>
      )}

      {open && features.length > 0 && (
        <ul
          id={listId}
          className={cn(
            'absolute z-50 mt-1 w-full rounded-md border border-rule bg-paper shadow-glass-sm',
            'max-h-72 overflow-auto p-1',
          )}
          role="listbox"
        >
          {features.map((f, i) => (
            <li key={`${f.label}-${i}`}>
              <button
                type="button"
                onClick={() => handleSelect(f)}
                className="w-full text-left rounded-sm px-3 py-2 text-sm hover:bg-cream-deep flex items-start gap-2"
              >
                <MapPin className="size-4 mt-0.5 text-ink-mute shrink-0" />
                <span>{f.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
