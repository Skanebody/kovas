'use client'

import {
  type AnnuaireTier,
  getInterventionVisualConfig,
} from '@/lib/annuaire/intervention-zone-tier'
import { useEffect, useRef } from 'react'

type HighlightedCity = {
  lat: number
  lng: number
  name: string
}

type DiagMapProps = {
  lat: number
  lng: number
  radiusKm: number
  name: string
  city: string
  /**
   * Tier d'abonnement annuaire du diagnostiqueur. Détermine le rendu visuel
   * (couleur, opacité, animation, cercles concentriques, markers).
   * Default : `'free'` (fiche non revendiquée ou pas d'abonnement annuaire).
   */
  annuaireTier?: AnnuaireTier
  /**
   * Villes principales mises en avant (Premium uniquement). Affichées comme
   * markers chartreuse autour du périmètre.
   */
  highlightedCities?: HighlightedCity[]
}

/**
 * Carte Leaflet — zone d'intervention diagnostiqueur, rendu adapté au tier
 * d'abonnement annuaire (free/presence/boost/premium).
 *
 * Charge Leaflet auto-hébergé (`/vendor/leaflet/`, origine self — plus de CDN
 * unpkg qui était injoignable depuis certains réseaux). Tile layer CartoDB Positron
 * (palette beige clair cohérente Design System v5 KOVAS sage `#F5F7F4`).
 *
 * Marker custom (divIcon HTML) : pin navy `#0F1419` + halo chartreuse subtle,
 * remplace le marker Leaflet bleu par défaut.
 *
 * Animation `pulse` (cercle Boost/Premium) injectée via classe CSS Leaflet
 * custom. Désactivée automatiquement sous `prefers-reduced-motion`.
 */
export function DiagMap({
  lat,
  lng,
  radiusKm,
  name,
  city,
  annuaireTier = 'free',
  highlightedCities,
}: DiagMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    if (initializedRef.current) return
    if (!containerRef.current) return

    let cancelled = false
    let mapInstance: { remove: () => void } | null = null

    async function init() {
      // 1) CSS Leaflet (auto-hébergé, même origine — idempotent)
      const cssId = 'leaflet-css-local'
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link')
        link.id = cssId
        link.rel = 'stylesheet'
        link.href = '/vendor/leaflet/leaflet.css'
        document.head.appendChild(link)
      }

      // 2) Styles custom KOVAS (marker + pulse) injectés une fois
      injectKovasMapStyles()

      // 3) Charge Leaflet
      const L = await loadLeaflet()
      if (cancelled || !containerRef.current) return

      // 4) Init carte
      // biome-ignore lint/suspicious/noExplicitAny: Leaflet types non installés (CDN dynamic load)
      const map: any = (L as any).map(containerRef.current, {
        center: [lat, lng],
        zoom: 10,
        scrollWheelZoom: false,
        attributionControl: true,
      })
      mapInstance = map

      // 5) Tile layer CartoDB Positron (palette claire, cohérent DS v5)
      // biome-ignore lint/suspicious/noExplicitAny: Leaflet types non installés
      ;(L as any)
        .tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: 'abcd',
          attribution: '© OpenStreetMap · CartoDB · KOVAS Annuaire',
        })
        .addTo(map)

      // 6) Cercle(s) d'intervention selon le tier annuaire
      const config = getInterventionVisualConfig(annuaireTier)
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const pulse = config.pulseAnimation && !prefersReducedMotion

      const baseRadiusMeters = radiusKm * 1000
      // biome-ignore lint/suspicious/noExplicitAny: Leaflet types non installés
      let outerCircle: any = null
      for (let i = 0; i < config.concentricRings; i++) {
        // Premium : 3 cercles concentriques (1x, 1.5x, 2x)
        const ringMultiplier = config.concentricRings === 1 ? 1 : 1 + i * 0.5
        const radius = baseRadiusMeters * ringMultiplier
        const fillOpacity =
          config.concentricRings === 1
            ? config.fillOpacity
            : Math.max(0.03, config.fillOpacity - i * 0.025)

        // biome-ignore lint/suspicious/noExplicitAny: Leaflet types non installés
        const circle: any = (L as any).circle([lat, lng], {
          radius,
          color: config.primaryColor,
          weight: config.borderWeight,
          fillColor: config.primaryColor,
          fillOpacity,
          className: pulse && i === 0 ? 'kovas-pulse-ring' : '',
        })
        circle.addTo(map)
        outerCircle = circle // le dernier = le plus grand
      }

      // Cadre la vue sur le cercle entier (+ marge) plutôt qu'un zoom figé :
      // sinon le périmètre déborde du cadre et la carte paraît trop zoomée.
      if (outerCircle) {
        try {
          map.fitBounds(outerCircle.getBounds(), { padding: [24, 24] })
        } catch {
          /* getBounds peut échouer si la carte n'a pas de taille — on garde le zoom par défaut */
        }
      }

      // 7) Marker principal — divIcon SVG navy + halo chartreuse
      // biome-ignore lint/suspicious/noExplicitAny: Leaflet types non installés
      const mainIcon: any = (L as any).divIcon({
        className: 'kovas-main-marker',
        html: `<div class="kovas-main-marker__inner" aria-hidden="true">
          <svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="kovas-halo" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
                <feOffset dx="0" dy="1" result="off"/>
                <feFlood flood-color="#D4F542" flood-opacity="0.55"/>
                <feComposite in2="off" operator="in"/>
                <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <path d="M16 0 C7.16 0 0 7.16 0 16 c0 11 16 24 16 24 s16-13 16-24 C32 7.16 24.84 0 16 0 z"
                  fill="#0F1419" filter="url(#kovas-halo)"/>
            <circle cx="16" cy="15" r="5" fill="#D4F542"/>
          </svg>
        </div>`,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
        popupAnchor: [0, -34],
      })

      // biome-ignore lint/suspicious/noExplicitAny: Leaflet types non installés
      ;(L as any)
        .marker([lat, lng], { icon: mainIcon, keyboard: false })
        .addTo(map)
        .bindPopup(buildPopupHtml(name, city), {
          className: 'kovas-popup',
          maxWidth: 240,
        })

      // 8) Markers villes mises en avant (Premium uniquement)
      if (config.showHighlightedCities && highlightedCities && highlightedCities.length > 0) {
        for (const hc of highlightedCities.slice(0, 3)) {
          // biome-ignore lint/suspicious/noExplicitAny: Leaflet types non installés
          const cityIcon: any = (L as any).divIcon({
            className: 'kovas-city-marker',
            html: `<div class="kovas-city-marker__dot" aria-hidden="true"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            popupAnchor: [0, -10],
          })
          // biome-ignore lint/suspicious/noExplicitAny: Leaflet types non installés
          ;(L as any)
            .marker([hc.lat, hc.lng], { icon: cityIcon, keyboard: false })
            .addTo(map)
            .bindPopup(`<strong>${escapeHtml(hc.name)}</strong>`, {
              className: 'kovas-popup',
              maxWidth: 180,
            })
        }
      }

      initializedRef.current = true
    }

    init().catch((err: unknown) => {
      // La carte est non-critique pour le métier (la fiche reste lisible
      // sans), mais on log en dev pour repérer rapidement les régressions
      // CSP / CDN. En prod le log est silencieux côté navigateur.
      if (process.env.NODE_ENV !== 'production') {
        console.error('[DiagMap] init failed', err)
      }
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
  }, [lat, lng, radiusKm, name, city, annuaireTier, highlightedCities])

  const ariaSuffix = describeTierAria(annuaireTier)
  return (
    <div
      ref={containerRef}
      className="h-[260px] sm:h-[320px] md:h-[360px] w-full rounded-2xl border border-black/8 overflow-hidden bg-black/[0.03]"
      aria-label={`Zone d'intervention : ${radiusKm} km autour de ${city}${ariaSuffix}`}
    />
  )
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic CDN load
async function loadLeaflet(): Promise<any> {
  // biome-ignore lint/suspicious/noExplicitAny: global window
  const w = window as any
  if (w.L) return w.L
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('leaflet-js-local') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve(w.L))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.id = 'leaflet-js-local'
    // Auto-hébergé (origine `self`) — le CDN unpkg était injoignable depuis
    // certains réseaux, la carte ne s'affichait alors jamais. Le fichier est
    // servi depuis /public, garanti disponible et couvert par la CSP `'self'`.
    script.src = '/vendor/leaflet/leaflet.js'
    script.async = true
    script.addEventListener('load', () => resolve(w.L))
    script.addEventListener('error', reject)
    document.head.appendChild(script)
  })
}

/**
 * Injecte une seule fois les styles KOVAS (marker, popup, pulse).
 * `prefers-reduced-motion` désactive complètement l'animation.
 */
function injectKovasMapStyles(): void {
  const styleId = 'kovas-map-styles'
  if (document.getElementById(styleId)) return
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    /* Marker principal — pin SVG navy + halo chartreuse */
    .kovas-main-marker { background: transparent !important; border: 0 !important; }
    .kovas-main-marker__inner { width: 32px; height: 40px; display: block; }

    /* Marker secondaire (villes mises en avant Premium) */
    .kovas-city-marker { background: transparent !important; border: 0 !important; }
    .kovas-city-marker__dot {
      width: 18px; height: 18px; border-radius: 999px;
      background: #D4F542; border: 2px solid #0F1419;
      box-shadow: 0 1px 4px rgba(15, 20, 25, 0.25);
    }

    /* Popup style cohérent DS v5 */
    .kovas-popup .leaflet-popup-content-wrapper {
      border-radius: 12px;
      border: 1px solid rgba(15, 20, 25, 0.08);
      box-shadow: 0 4px 16px rgba(15, 20, 25, 0.08);
      font-family: var(--font-manrope, -apple-system, BlinkMacSystemFont, sans-serif);
    }
    .kovas-popup .leaflet-popup-content {
      margin: 12px 14px;
      font-size: 13px;
      color: #0F1419;
      line-height: 1.4;
    }
    .kovas-popup .leaflet-popup-tip { background: #FDFBF6; }

    /* Pulse animation — cercle d'intervention Boost / Premium */
    @keyframes kovas-pulse {
      0%   { stroke-opacity: 0.85; }
      50%  { stroke-opacity: 0.35; }
      100% { stroke-opacity: 0.85; }
    }
    .kovas-pulse-ring {
      animation: kovas-pulse 2.4s ease-in-out infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .kovas-pulse-ring { animation: none !important; }
    }
  `
  document.head.appendChild(style)
}

function buildPopupHtml(name: string, city: string): string {
  return `<div>
    <strong style="font-weight:600;color:#0F1419;">${escapeHtml(name)}</strong><br/>
    <span style="color:#4A5878;font-size:12px;">${escapeHtml(city)}</span>
  </div>`
}

function describeTierAria(tier: AnnuaireTier): string {
  switch (tier) {
    case 'boost':
      return ' (abonnement Boost — visibilité départementale)'
    case 'premium':
      return ' (abonnement Premium — visibilité régionale)'
    case 'presence':
      return ' (abonnement Présence)'
    default:
      // `free` ou tier inconnu — pas de suffixe.
      return ''
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
