'use client'

import { useEffect, useRef } from 'react'
import type { SektionBemanningsgrad } from '@/lib/database.types'

interface Props {
  sektioner: SektionBemanningsgrad[]
}

const statusFarg = (status: string) => {
  if (status === 'full') return '#16A34A'
  if (status === 'delvis') return '#F59E0B'
  return '#DC2626'
}

/** Escapa HTML-specialtecken för att förhindra XSS i Leaflet-popupar */
const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export default function SektionKarta({ sektioner }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Dynamisk import för att undvika SSR-problem med Leaflet
    import('leaflet').then((L) => {
      // Fix för default marker-ikoner i Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!).setView([59.364839, 18.073025], 14)
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      sektioner.forEach((s) => {
        if (!s.lat || !s.lng) return

        const farg = statusFarg(s.status)
        const procent = s.behovs_totalt > 0
          ? Math.round((s.tilldelade_totalt / s.behovs_totalt) * 100)
          : 0

        const icon = L.divIcon({
          className: '',
          html: `
            <div style="
              background: ${farg};
              border: 3px solid white;
              border-radius: 50%;
              width: 36px;
              height: 36px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-weight: bold;
              font-size: 11px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              font-family: sans-serif;
            ">${procent}%</div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })

        const statusText = s.status === 'full' ? '✅ Fullbemannad'
          : s.status === 'delvis' ? '⚠️ Delvis bemannad'
          : '❌ Ej bemannad'

        L.marker([s.lat, s.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; min-width: 160px;">
              <div style="font-weight: bold; font-size: 14px; margin-bottom: 6px;">${esc(s.namn)}</div>
              <div style="color: #666; font-size: 12px; margin-bottom: 8px;">${esc(s.beskrivning ?? '')}</div>
              <div style="font-size: 13px;">${statusText}</div>
              <div style="margin-top: 6px; font-size: 13px;">
                <strong>${s.tilldelade_totalt}</strong> / ${s.behovs_totalt} funktionärer
              </div>
            </div>
          `)
      })
    })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [sektioner])

  return (
    <div className="relative">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div ref={mapRef} className="w-full h-[450px] rounded-xl border border-gray-200 z-0" />
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md p-3 z-[1000] text-xs space-y-1">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-600 inline-block" /> Fullbemannad</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Delvis bemannad</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> Ej bemannad</div>
      </div>
    </div>
  )
}
