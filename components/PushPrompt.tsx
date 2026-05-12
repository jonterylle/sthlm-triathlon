'use client'

import { useEffect, useState } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function PushPrompt() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'aktiv' | 'nekad' | 'ej-stod'>('idle')

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('ej-stod')
      return
    }
    if (Notification.permission === 'granted') setStatus('aktiv')
    else if (Notification.permission === 'denied') setStatus('nekad')
  }, [])

  async function aktivera() {
    if (!VAPID_PUBLIC_KEY) return
    setStatus('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setStatus('nekad'); return }

      const reg  = await navigator.serviceWorker.ready
      const sub  = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as unknown as ArrayBuffer,
      })

      const subJson = sub.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subJson),
      })

      setStatus(res.ok ? 'aktiv' : 'idle')
    } catch (e) {
      console.error('[PushPrompt]', e)
      setStatus('idle')
    }
  }

  if (status === 'ej-stod' || status === 'aktiv' || !VAPID_PUBLIC_KEY) return null

  if (status === 'nekad') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
        Push-notiser är blockerade i webbläsarinställningarna. Tillåt dem för att få påminnelser på tävlingsdagen.
      </div>
    )
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0066CC]">Aktivera påminnelser</p>
        <p className="text-xs text-blue-600 mt-0.5">Få en push-notis 30 min innan ditt pass börjar på tävlingsdagen.</p>
      </div>
      <button
        onClick={aktivera}
        disabled={status === 'loading'}
        className="flex-shrink-0 bg-[#0066CC] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#0052a3] disabled:opacity-60 transition-colors"
      >
        {status === 'loading' ? '…' : 'Aktivera'}
      </button>
    </div>
  )
}
