'use client'

import { useState, useTransition } from 'react'
import { skapaPass, uppdateraPass, taBortPass } from '@/app/dashboard/pass-actions'
import type { PassMedSektion } from '@/lib/database.types'

interface Props {
  sektionId: string
  sektionNamn: string
  pass?: PassMedSektion          // undefined = nytt pass
  onClose: () => void
  onSparat: (uppdaterat: PassMedSektion, nyskapad: boolean) => void
  onBorttagen: (passId: string) => void
}

export default function PassModal({
  sektionId,
  sektionNamn,
  pass,
  onClose,
  onSparat,
  onBorttagen,
}: Props) {
  const arNytt = !pass

  const [namn,        setNamn]        = useState(pass?.pass_namn     ?? '')
  const [starttid,    setStarttid]    = useState(pass?.starttid      ?? '08:00')
  const [sluttid,     setSluttid]     = useState(pass?.sluttid       ?? '14:00')
  const [behovsAntal, setBehovsAntal] = useState(pass?.behovs_antal  ?? 2)

  const [isPending, startTransition] = useTransition()
  const [fel, setFel]   = useState<string | null>(null)
  const [raderar, setRaderar] = useState(false)

  function handleSpara(e: React.FormEvent) {
    e.preventDefault()
    setFel(null)

    if (!namn.trim()) { setFel('Ange ett namn för passet.'); return }
    if (starttid >= sluttid) { setFel('Sluttid måste vara efter starttid.'); return }

    startTransition(async () => {
      if (arNytt) {
        const res = await skapaPass({ sektion_id: sektionId, namn, starttid, sluttid, behovs_antal: behovsAntal })
        if (!res.ok) { setFel(res.meddelande ?? 'Fel'); return }
        onSparat({
          pass_id:      res.passId!,
          pass_namn:    namn,
          starttid,
          sluttid,
          behovs_antal: behovsAntal,
          tilldelade:   0,
          saknas:       behovsAntal,
          sektion_id:   sektionId,
          sektion_namn: sektionNamn,
          sektion_farg: '#0066CC',
        }, true)
      } else {
        const res = await uppdateraPass(pass.pass_id, { namn, starttid, sluttid, behovs_antal: behovsAntal })
        if (!res.ok) { setFel(res.meddelande ?? 'Fel'); return }
        onSparat({
          ...pass,
          pass_namn:    namn,
          starttid,
          sluttid,
          behovs_antal: behovsAntal,
          saknas:       Math.max(0, behovsAntal - pass.tilldelade),
        }, false)
      }
    })
  }

  function handleTaBort() {
    if (!pass) return
    if (!confirm(`Ta bort passet "${pass.pass_namn}"?\n\nDetta går inte att ångra.`)) return
    setRaderar(true)
    startTransition(async () => {
      const res = await taBortPass(pass.pass_id)
      if (!res.ok) {
        setFel(res.meddelande ?? 'Kunde inte ta bort.')
        setRaderar(false)
        return
      }
      onBorttagen(pass.pass_id)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[85dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {arNytt ? 'Nytt pass' : 'Redigera pass'}
            </h2>
            <p className="text-xs text-gray-400">{sektionNamn}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-3" aria-label="Stäng">×</button>
        </div>

        {/* Formulär */}
        <form onSubmit={handleSpara} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {fel && <p className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{fel}</p>}

          <div>
            <label className="block text-xs text-gray-500 mb-1">Passnamn</label>
            <input
              type="text"
              value={namn}
              onChange={e => setNamn(e.target.value)}
              placeholder="T.ex. Tävling, Förberedelse"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Starttid</label>
              <input
                type="time"
                value={starttid}
                onChange={e => setStarttid(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sluttid</label>
              <input
                type="time"
                value={sluttid}
                onChange={e => setSluttid(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Antal funktionärer som behövs</label>
            <input
              type="number"
              min={1}
              max={50}
              value={behovsAntal}
              onChange={e => setBehovsAntal(Number(e.target.value))}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 space-y-2">
          <button
            onClick={() => { const f = document.querySelector('form'); f?.requestSubmit() }}
            disabled={isPending}
            className="w-full bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {isPending && !raderar ? 'Sparar…' : arNytt ? 'Skapa pass' : 'Spara ändringar'}
          </button>
          {!arNytt && (
            <button
              type="button"
              onClick={handleTaBort}
              disabled={isPending}
              className="w-full bg-white hover:bg-red-50 disabled:opacity-60 text-red-600 border border-red-200 font-medium py-3 rounded-xl text-sm transition-colors"
            >
              {raderar ? 'Tar bort…' : 'Ta bort pass'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
