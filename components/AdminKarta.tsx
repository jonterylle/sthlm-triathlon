'use client'

import { useEffect, useRef, useState } from 'react'
import type { PassForKarta } from '@/lib/database.types'

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
  allePass: PassForKarta[]
}

export default function AdminKarta({ allePass }: Props) {
  const mapRef         = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const [valdSektion, setValdSektion] = useState<string | null>(null)

  // Unika sektioner för filter
  const sektioner = Array.from(
    new Map(allePass.map((p) => [p.sektion_id, { id: p.sektion_id, namn: p.sektion_namn, farg: p.sektion_farg }])).values()
  )

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    import('leaflet').then((L) => {
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
            padding: 5px 10px;
            color: white;
            font-weight: 700;
            font-size: 12px;
            font-family: sans-serif;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            gap: 5px;
          ">🏁 Arena</div>
        `,
        iconSize: [88, 30],
        iconAnchor: [44, 15],
      })

      L.marker([ARENA_LAT, ARENA_LNG], { icon: arenaIkon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:sans-serif;font-size:13px;">
            <strong>🏁 Arena – STHLM Triathlon 2026</strong><br>
            <span style="color:#666;">Stora Skuggan, Norra Djurgården</span>
          </div>
        `)

      // ── Alla pass som röda punkter ───────────────────────────────
      // Lägg lager i ett LayerGroup-objekt som kan återanvändas
      const passLager = L.layerGroup().addTo(map)
      ;(map as any)._passLager = passLager

      function ritar(filterSektionId: string | null) {
        passLager.clearLayers()

        allePass
          .filter((p) => !filterSektionId || p.sektion_id === filterSektionId)
          .forEach((p) => {
            if (!p.lat || !p.lng) return

            const ikon = L.divIcon({
              className: '',
              html: `
                <div style="
                  background: ${esc(p.sektion_farg)};
                  border: 2.5px solid white;
                  border-radius: 50%;
                  width: 18px;
                  height: 18px;
                  box-shadow: 0 1px 4px rgba(0,0,0,0.5);
                "></div>
              `,
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            })

            L.marker([p.lat, p.lng], { icon: ikon })
              .addTo(passLager)
              .bindPopup(`
                <div style="font-family:sans-serif;min-width:180px;">
                  <div style="
                    display:inline-block;
                    background:${esc(p.sektion_farg)};
                    color:white;
                    border-radius:4px;
                    padding:1px 7px;
                    font-size:11px;
                    font-weight:600;
                    margin-bottom:5px;
                  ">${esc(p.sektion_namn)}</div>
                  <div style="font-weight:600;font-size:13px;margin-bottom:3px;">${esc(p.pass_namn)}</div>
                  <div style="font-size:12px;color:#555;">
                    🕐 ${esc(p.starttid)} – ${esc(p.sluttid)}
                  </div>
                </div>
              `, { maxWidth: 240 })
          })
      }

      ritar(null)

      // Exponera ritar-funktionen så React-state kan trigga omritning
      ;(map as any)._ritar = ritar
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // kör bara vid mount — allePass ändras inte

  // Synka filter med kartan utan att montera om Leaflet
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    const ritar = map._ritar as ((id: string | null) => void) | undefined
    ritar?.(valdSektion)
  }, [valdSektion])

  return (
    <div className="space-y-3">
      {/* Filter per sektion */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setValdSektion(null)}
          className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
            valdSektion === null
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          Alla sektioner
        </button>
        {sektioner.map((s) => (
          <button
            key={s.id}
            onClick={() => setValdSektion(s.id)}
            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
              valdSektion === s.id
                ? 'text-white border-transparent'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
            style={valdSektion === s.id ? { background: s.farg, borderColor: s.farg } : {}}
          >
            {s.namn}
          </button>
        ))}
      </div>

      {/* Karta */}
      <div className="relative">
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
        />
        <div ref={mapRef} className="w-full h-[500px] lg:h-[640px] rounded-xl border border-gray-200 z-0" />

        {/* Förklaring */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3 z-[1000] text-xs space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-4 h-4 rounded-sm inline-block" style={{ background: '#FF6B35' }} />
            Arena
          </div>
          {sektioner.slice(0, 8).map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full inline-block border border-white shadow-sm" style={{ background: s.farg }} />
              {s.namn}
            </div>
          ))}
        </div>
      </div>

      {/* Statistik */}
      <p className="text-xs text-gray-400 text-right">
        {allePass.filter((p) => p.lat && p.lng).length} av {allePass.length} uppdrag har koordinater
      </p>
    </div>
  )
}
