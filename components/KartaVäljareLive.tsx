'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type L from 'leaflet'

// Stora Skuggan, Stockholm
const STANDARD_LAT = 59.3665
const STANDARD_LNG = 18.0345
const STANDARD_ZOOM = 15

interface Props {
  lat: number | null
  lng: number | null
  onChange: (lat: number, lng: number) => void
}

export default function KartaVäljareLive({ lat, lng, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map | null>(null)
  const markerRef    = useRef<L.Marker | null>(null)

  // Initialisera kartan
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cleanup = false

    import('leaflet').then(Leaflet => {
      if (cleanup || !containerRef.current) return

      // Fixa standard-ikonen (webpack slår sönder standard-pathen)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (Leaflet.Icon.Default.prototype as any)._getIconUrl
      Leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const center: [number, number] = lat != null && lng != null
        ? [lat, lng]
        : [STANDARD_LAT, STANDARD_LNG]

      const map = Leaflet.map(containerRef.current!, {
        center,
        zoom: lat != null ? 16 : STANDARD_ZOOM,
        zoomControl: true,
      })
      mapRef.current = map

      Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      if (lat != null && lng != null) {
        markerRef.current = Leaflet.marker([lat, lng]).addTo(map)
      }

      map.on('click', (e: L.LeafletMouseEvent) => {
        const clickedLat = Math.round(e.latlng.lat * 1_000_000) / 1_000_000
        const clickedLng = Math.round(e.latlng.lng * 1_000_000) / 1_000_000

        if (markerRef.current) {
          markerRef.current.setLatLng([clickedLat, clickedLng])
        } else {
          markerRef.current = Leaflet.marker([clickedLat, clickedLng]).addTo(map)
        }
        onChange(clickedLat, clickedLng)
      })
    })

    return () => {
      cleanup = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Synka extern lat/lng till markören (t.ex. vid manuell input)
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(Leaflet => {
      if (!mapRef.current) return
      if (lat != null && lng != null) {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng])
        } else {
          markerRef.current = Leaflet.marker([lat, lng]).addTo(mapRef.current!)
        }
        mapRef.current.setView([lat, lng], mapRef.current.getZoom())
      } else if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
    })
  }, [lat, lng])

  return (
    <div ref={containerRef} className="w-full h-52 rounded-xl overflow-hidden border border-gray-200" />
  )
}
