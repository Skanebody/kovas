'use client'

/**
 * PropertyInteractiveMap — Carte Leaflet + OpenStreetMap pour la fiche bien.
 *
 * Stack :
 *   - leaflet (lib core, gratuit, no API key)
 *   - react-leaflet (wrapper React)
 *   - tuiles OpenStreetMap standard (gratuit, attribution obligatoire)
 *
 * Source coordonnées : `properties.location` PostGIS column au format
 * `SRID=4326;POINT(lng lat)` (parse côté server → passer {lat, lng} props).
 *
 * Brand V5 : marker navy `#0F1419` + chartreuse `#D4F542` ring.
 */

import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { useEffect } from 'react'

/**
 * Custom marker DivIcon brand V5 : cercle navy + dot chartreuse interne +
 * pin shape avec triangle pointant vers le bas (positionnement précis).
 */
const KOVAS_MARKER = L.divIcon({
  className: 'kovas-property-marker',
  html: `
    <div style="
      position: relative;
      width: 32px;
      height: 40px;
    ">
      <div style="
        width: 32px;
        height: 32px;
        background: #0F1419;
        border: 2px solid #D4F542;
        border-radius: 50%;
        box-shadow: 0 4px 12px rgba(15, 20, 25, 0.35);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 10px;
          height: 10px;
          background: #D4F542;
          border-radius: 50%;
        "></div>
      </div>
      <div style="
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid #0F1419;
      "></div>
    </div>
  `,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -36],
})

interface PropertyInteractiveMapProps {
  /** Latitude WGS84 */
  lat: number
  /** Longitude WGS84 */
  lng: number
  /** Adresse complète à afficher dans le popup */
  address: string
  /** Sous-titre (CP + ville) optionnel */
  subtitle?: string
  /** Zoom initial (12 = quartier, 16 = rue, 18 = bâtiment) */
  zoom?: number
  /** Hauteur fixe (défaut 280px pour BottomSheet). */
  height?: number | string
  /** className additionnelle pour le container */
  className?: string
}

export function PropertyInteractiveMap({
  lat,
  lng,
  address,
  subtitle,
  zoom = 16,
  height = 280,
  className,
}: PropertyInteractiveMapProps) {
  // Sécurité : si Leaflet rencontre des icônes par défaut manquantes (Webpack),
  // on remet manuellement le path pour les fallbacks.
  useEffect(() => {
    // biome-ignore lint: leaflet types
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    })
  }, [])

  return (
    <div
      className={className}
      style={{
        height,
        width: '100%',
        borderRadius: '10px',
        overflow: 'hidden',
        border: '1px solid hsl(var(--rule) / 0.4)',
      }}
    >
      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        attributionControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={KOVAS_MARKER}>
          <Popup>
            <div style={{ fontFamily: 'system-ui, sans-serif' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: '13px' }}>{address}</p>
              {subtitle ? (
                <p
                  style={{
                    margin: '4px 0 0',
                    fontSize: '11px',
                    color: '#7E8AA4',
                    fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
                  }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}

// Helpers de parsing PostGIS extraits vers @/lib/property/location pour pouvoir
// être importés depuis Server Components (ce fichier reste 'use client'
// uniquement pour la carte Leaflet interactive).
export {
  parsePostGisPoint,
  parsePostGisHexEWKB,
  parsePropertyLocation,
} from '@/lib/property/location'
