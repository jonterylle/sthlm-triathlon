'use client'

import { useEffect, useRef } from 'react'
import type { TilldelningInfo } from '@/components/FunktionarApp'

// Arena: Stora Skuggan / STHLM Triathlon 2026
const ARENA_LAT = 59.364585
const ARENA_LNG = 18.074520
const KARTA_ZOOM = 14

/** Escapa HTML-specialtecken för Leaflet-popupar */
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

interface Props {
  tilldelningar: TilldelningInfo[]
}

export default function FunktionarKarta({ tilldelningar }: Props) {
  const mapRef         = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    import('leaflet').then((L) => {
      // Fixa default-ikon-paths i Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!).setView([ARENA_LAT, ARENA_LNG], KARTA_ZOOM)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // ── Arena-markering ─────────────────────────────────────────
      const arenaIkon = L.divIcon({
        className: '',
        html: `
          <div style="
            background: #FF6B35;
            border: 3px solid white;
            border-radius: 8px;
            padding: 4px 8px;
            color: white;
            font-weight: 700;
            font-size: 11px;
            font-family: sans-serif;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            🏁 Arena
          </div>
        `,
        iconSize: [80, 28],
        iconAnchor: [40, 14],
      })

      L.marker([ARENA_LAT, ARENA_LNG], { icon: arenaIkon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;font-size:13px;">
            <strong>🏁 Arena – STHLM Triathlon 2026</strong><br>
            <span style="color:#666;">Stora Skuggan, Norra Djurgården</span>
          </div>
        `)

      // ── Frivilligens tilldelade pass ────────────────────────────
      // Använd sektionens koordinater (fall-back till arenans om pass saknar koordinat)
      const passMarkerIkon = L.divIcon({
        className: '',
        html: `
          <div style="
            background: #0066CC;
            border: 3px solid white;
            border-radius: 50%;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
              <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      tilldelningar.forEach((t) => {
        const lat = t.lat ?? ARENA_LAT
        const lng = t.lng ?? ARENA_LNG

        L.marker([lat, lng], { icon: passMarkerIkon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family:sans-serif;min-width:180px;">
              <div style="font-weight:bold;font-size:13px;margin-bottom:4px;color:#0066CC;">
                📍 Din plats
              </div>
              <div style="font-weight:600;font-size:13px;margin-bottom:2px;">${esc(t.pass_namn)}</div>
              <div style="font-size:12px;color:#555;margin-bottom:4px;">${esc(t.sektion_namn)}</div>
              <div style="font-size:12px;background:#f3f4f6;border-radius:4px;padding:4px 8px;display:inline-block;">
                🕐 ${esc(t.starttid)} – ${esc(t.sluttid)}
              </div>
            </div>
          `, { maxWidth: 240 })
      })

      // Zooma in så att alla markeringar syns om det finns tilldelningar med koordinater
      const giltiga = tilldelningar.filter((t) => t.lat && t.lng)
      if (giltiga.length > 0) {
        const bounds = L.latLngBounds([[ARENA_LAT, ARENA_LNG]])
        giltiga.forEach((t) => bounds.extend([t.lat!, t.lng!]))
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
      }
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [tilldelningar])

  return (
    <div className="relative">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div ref={mapRef} className="w-full h-[320px] sm:h-[460px] rounded-xl border border-gray-200 z-0" />

      {/* Förklaring */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3 z-[1000] text-xs space-y-1.5">
        <div className="flex items-center gap-2">
          <span style={{ background: '#FF6B35' }} className="w-3 h-3 rounded-sm inline-block" />
          Arena
        </div>
        <div className="flex items-center gap-2">
          <span style={{ background: '#0066CC' }} className="w-3 h-3 rounded-full inline-block" />
          Din plats
        </div>
      </div>
    </div>
  )
}
