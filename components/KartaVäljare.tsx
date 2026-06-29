'use client'

import dynamic from 'next/dynamic'

// Leaflet kräver window — laddas bara på klientsidan
const KartaVäljareLive = dynamic(
  () => import('./KartaVäljareLive'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-52 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
        <span className="text-sm text-gray-400">Laddar karta…</span>
      </div>
    ),
  }
)

export default KartaVäljareLive
