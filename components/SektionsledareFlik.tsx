'use client'

import { useState, useTransition } from 'react'
import { kopplaSLTillSektion } from '@/app/dashboard/sektionsledare-actions'
import type { SektionsledareInfo, SektionBemanningsgrad } from '@/lib/database.types'

interface Props {
  sektionsledare: SektionsledareInfo[]
  sektioner: SektionBemanningsgrad[]
}

export default function SektionsledareFlik({ sektionsledare, sektioner }: Props) {
  const [lokala, setLokala] = useState(sektionsledare)
  const [pending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [fel, setFel] = useState<Record<string, string>>({})

  function hanteraKoppling(slId: string, sektionId: string) {
    setPendingId(slId)
    setFel((prev) => ({ ...prev, [slId]: '' }))

    startTransition(async () => {
      const res = await kopplaSLTillSektion(slId, sektionId || null)
      if (res.ok) {
        const sektionNamn = sektioner.find((s) => s.id === sektionId)?.namn ?? null
        setLokala((prev) =>
          prev.map((sl) =>
            sl.id === slId
              ? { ...sl, sektion_preferens: sektionId || null, sektion_namn: sektionNamn }
              : sl
          )
        )
      } else {
        setFel((prev) => ({ ...prev, [slId]: res.meddelande ?? 'Fel' }))
      }
      setPendingId(null)
    })
  }

  if (lokala.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
        Inga sektionsledare finns ännu. Bjud in dem och sätt deras roll till "sektionsledare" i databasen.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Koppla varje sektionsledare till sin sektion. De ser sedan sin sektion och sina funktionärer när de loggar in.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {lokala.map((sl) => (
          <div key={sl.id} className="px-4 py-4 flex items-center gap-4 flex-wrap sm:flex-nowrap">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900">{sl.full_name ?? sl.email}</p>
              <p className="text-xs text-gray-400">{sl.email}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
              <select
                value={sl.sektion_preferens ?? ''}
                onChange={(e) => hanteraKoppling(sl.id, e.target.value)}
                disabled={pending && pendingId === sl.id}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0066CC] disabled:opacity-50 flex-1 sm:w-48"
              >
                <option value="">Ingen sektion</option>
                {sektioner.map((s) => (
                  <option key={s.id} value={s.id}>{s.namn}</option>
                ))}
              </select>

              {pending && pendingId === sl.id && (
                <span className="text-xs text-gray-400">Sparar…</span>
              )}
              {sl.sektion_preferens && !(pending && pendingId === sl.id) && (
                <span className="text-xs text-green-600">✓</span>
              )}
            </div>

            {fel[sl.id] && (
              <p className="w-full text-xs text-red-600">{fel[sl.id]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
