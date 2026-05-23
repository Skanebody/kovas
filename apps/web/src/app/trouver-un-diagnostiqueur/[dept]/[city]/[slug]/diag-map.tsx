'use client'

import { useEffect, useRef } from 'react'

type DiagMapProps = {
  lat: number
  lng: number
  radiusKm: number
  name: string
  city: string
}

/**
 * Carte Leaflet pour zone d'intervention diagnostiqueur.
 * Import dynamique du CSS et du JS Leaflet via CDN unpkg (pas de dep npm).
 * Affiche un marker au centre + un cercle de rayon `radiusKm`.
 */
export function DiagMap({ lat, lng, radiusKm, name, city }: DiagMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    if (!containerRef.current) return

    let cancelled = false
    let mapInstance: { remove: () => void } | null = null

    async function init() {
      // Inject Leaflet CSS once
      const cssId = 'leaflet-css-cdn'
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link')
        link.id = cssId
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
        link.crossOrigin = ''
        document.head.appendChild(link)
      }

      // Dynamic import of Leaflet from CDN via script tag
      // (avoids adding leaflet as npm dep)
      // biome-ignore lint/suspicious/noExplicitAny: Leaflet global injected dynamically
      const L = await loadLeaflet()
      if (cancelled || !containerRef.current) return

      // biome-ignore lint/suspicious/noExplicitAny: Leaflet types not installed
      const map: any = (L as any).map(containerRef.current, {
        center: [lat, lng],
        zoom: 10,
        scrollWheelZoom: false,
        attributionControl: true,
      })
      mapInstance = map
      ;(L as any)
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap',
        })
        .addTo(map)
      ;(L as any)
        .circle([lat, lng], {
          radius: radiusKm * 1000,
          color: '#0B1D33',
          weight: 2,
          fillColor: '#0B1D33',
          fillOpacity: 0.08,
        })
        .addTo(map)
      ;(L as any)
        .marker([lat, lng])
        .addTo(map)
        .bindPopup(`<strong>${escapeHtml(name)}</strong><br/><span>${escapeHtml(city)}</span>`)

      initializedRef.current = true
    }

    init().catch(() => {
      /* swallow — map is non-critical */
    })

    return () => {
      cancelled = true
      if (mapInstance) {
        try {
          mapInstance.remove()
        } catch {
          /* noop */
        }
      }
    }
  }, [lat, lng, radiusKm, name, city])

  return (
    <div
      ref={containerRef}
      className="h-[360px] w-full rounded-2xl border border-black/8 overflow-hidden bg-black/[0.03]"
      aria-label={`Zone d'intervention : ${radiusKm} km autour de ${city}`}
    />
  )
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic CDN load
async function loadLeaflet(): Promise<any> {
  // biome-ignore lint/suspicious/noExplicitAny: global window
  const w = window as any
  if (w.L) return w.L
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('leaflet-js-cdn') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(w.L))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.id = 'leaflet-js-cdn'
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
    script.crossOrigin = ''
    script.async = true
    script.addEventListener('load', () => resolve(w.L))
    script.addEventListener('error', reject)
    document.head.appendChild(script)
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
