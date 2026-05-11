'use client'

import { useState, useTransition } from 'react'
import { uppdateraFunktionar, taBortFunktionar } from '@/app/dashboard/actions'
import type { Profile } from '@/lib/database.types'

const KOMPETENSER = [
  { value: 'sjukvard',             label: 'Sjukvård / HLR' },
  { value: 'korkort',              label: 'Körkort' },
  { value: 'triathlon_erfarenhet', label: 'Triathlonerfarenhet' },
  { value: 'simning',              label: 'Simkunnig / livräddning' },
  { value: 'cykel_teknik',         label: 'Cykelmekanik' },
  { value: 'engelska',             label: 'Engelska (muntlig)' },
]

interface Props {
  funktionar: Profile
  onClose: () => void
  onSparat: (uppdaterad: Profile) => void
  onBorttagen: (profilId: string) => void
}

export default function FunktionarRedigeraModal({
  funktionar,
  onClose,
  onSparat,
  onBorttagen,
}: Props) {
  const [fullName, setFullName]       = useState(funktionar.full_name ?? '')
  const [telefon, setTelefon]         = useState(funktionar.telefon ?? '')
  const [klubb, setKlubb]             = useState(funktionar.klubb ?? '')
  const [erfarenhet, setErfarenhet]   = useState(funktionar.erfarenhet ?? '')
  const [specialkost, setSpecialkost] = useState(funktionar.specialkost ?? '')
  const [kompetenser, setKompetenser] = useState<string[]>(funktionar.kompetenser ?? [])

  const [isPending, startTransition] = useTransition()
  const [fel, setFel] = useState<string | null>(null)
  const [raderar, setRaderar] = useState(false)

  function toggleKompetens(k: string) {
    setKompetenser(prev =>
      prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]
    )
  }

  function handleSpara(e: React.FormEvent) {
    e.preventDefault()
    setFel(null)
    startTransition(async () => {
      const res = await uppdateraFunktionar(funktionar.id, {
        full_name:   fullName || null,
        telefon:     telefon || null,
        klubb:       klubb || null,
        kompetenser,
        erfarenhet:  erfarenhet || null,
        specialkost: specialkost || null,
      })
      if (res.ok) {
        onSparat({
          ...funktionar,
          full_name:   fullName || null,
          telefon:     telefon || null,
          klubb:       klubb || null,
          kompetenser,
          erfarenhet:  erfarenhet || null,
          specialkost: specialkost || null,
        })
      } else {
        setFel(res.meddelande ?? 'Något gick fel.')
      }
    })
  }

  function handleTaBort() {
    if (!confirm(`Ta bort ${funktionar.full_name ?? funktionar.email} helt?\n\nDetta raderar inloggningskontot och kan inte ångras.`)) return
    setRaderar(true)
    startTransition(async () => {
      const res = await taBortFunktionar(funktionar.id, funktionar.email)
      if (res.ok) {
        onBorttagen(funktionar.id)
      } else {
        setFel(res.meddelande ?? 'Kunde inte ta bort.')
        setRaderar(false)
      }
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {funktionar.full_name ?? '(inget namn)'}
            </h2>
            <p className="text-xs text-gray-400 truncate">{funktionar.email}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Stäng"
          >
            ×
          </button>
        </div>

        {/* Formulär */}
        <form onSubmit={handleSpara} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {fel && (
            <p className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{fel}</p>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Namn</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="För- och efternamn"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Telefon</label>
              <input
                type="tel"
                value={telefon}
                onChange={e => setTelefon(e.target.value)}
                placeholder="07X-XXX XX XX"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Klubb</label>
              <input
                type="text"
                value={klubb}
                onChange={e => setKlubb(e.target.value)}
                placeholder="Klubbtillhörighet"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              />
            </div>
          </div>

          {/* Kompetenser */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">Kompetenser</label>
            <div className="grid grid-cols-2 gap-2">
              {KOMPETENSER.map(k => (
                <label
                  key={k.value}
                  className={`flex items-center gap-2 rounded-xl px-3 py-3 min-h-[44px] cursor-pointer border transition-colors ${
                    kompetenser.includes(k.value)
                      ? 'bg-blue-50 border-[#0066CC] text-[#0066CC]'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={kompetenser.includes(k.value)}
                    onChange={() => toggleKompetens(k.value)}
                    className="sr-only"
                  />
                  <span className="text-xs font-medium">{k.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Erfarenhet</label>
            <textarea
              value={erfarenhet}
              onChange={e => setErfarenhet(e.target.value)}
              rows={2}
              placeholder="Tidigare erfarenhet..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Specialkost / allergier</label>
            <input
              type="text"
              value={specialkost}
              onChange={e => setSpecialkost(e.target.value)}
              placeholder="Lämna tomt om inga"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
            />
          </div>

        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 space-y-2">
          <button
            onClick={() => { const form = document.querySelector('form'); form?.requestSubmit() }}
            disabled={isPending}
            className="w-full bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {isPending && !raderar ? 'Sparar…' : 'Spara ändringar'}
          </button>
          <button
            type="button"
            onClick={handleTaBort}
            disabled={isPending}
            className="w-full bg-white hover:bg-red-50 disabled:opacity-60 text-red-600 border border-red-200 font-medium py-3 rounded-xl text-sm transition-colors"
          >
            {raderar ? 'Tar bort…' : 'Ta bort funktionär'}
          </button>
        </div>

      </div>
    </div>
  )
}
