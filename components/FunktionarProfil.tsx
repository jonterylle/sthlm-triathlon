'use client'

import { useState, useTransition } from 'react'
import { sparaRegistrering } from '@/app/registrera/actions'
import type { ProfilData, SektionVal } from '@/components/FunktionarApp'

const TILLÅTNA_KOMPETENSER = [
  { value: 'sjukvard',            label: 'Sjukvård / HLR' },
  { value: 'korkort',             label: 'Körkort' },
  { value: 'triathlon_erfarenhet', label: 'Triathlonerfarenhet' },
  { value: 'simning',             label: 'Simkunnig / livräddning' },
  { value: 'cykel_teknik',        label: 'Cykelmekanik' },
  { value: 'engelska',            label: 'Engelska (muntlig)' },
]

const PASS_PREFERENSER = [
  { value: 'forberedelse',    label: 'Förberedelse',  sub: '06:00–08:00' },
  { value: 'tavling',         label: 'Tävlingspass',  sub: '08:00–14:00' },
  { value: 'heldagen',        label: 'Hela dagen',    sub: '06:00–16:00' },
  { value: 'ingen_preferens', label: 'Ingen preferens', sub: '' },
]

interface Props {
  profil: ProfilData
  sektionVal: SektionVal[]
}

export default function FunktionarProfil({ profil, sektionVal }: Props) {
  const [sparat, setSparat] = useState(false)
  const [isPending, startTransition] = useTransition()
  const kompetenser: string[] = profil.kompetenser ?? []

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await sparaRegistrering(formData)
      setSparat(true)
      setTimeout(() => setSparat(false), 3000)
    })
  }

  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Min profil</h2>

      {sparat && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <span>✅</span> Sparad!
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">

        {/* Personuppgifter */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Personuppgifter</p>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Namn *</label>
            <input
              type="text"
              name="full_name"
              defaultValue={profil.full_name ?? ''}
              required
              placeholder="För- och efternamn"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">E-post</label>
            <input
              type="email"
              value={profil.email}
              disabled
              className="w-full rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Telefon</label>
            <input
              type="tel"
              name="telefon"
              defaultValue={profil.telefon ?? ''}
              placeholder="07X-XXX XX XX"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Klubb</label>
            <input
              type="text"
              name="klubb"
              defaultValue={profil.klubb ?? ''}
              placeholder="T.ex. Stockholms Triallsällskap"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
            />
          </div>
        </div>

        {/* Preferenser */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Preferenser</p>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Önskad sektion</label>
            <select
              name="sektion_preferens"
              defaultValue={profil.sektion_preferens ?? ''}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
            >
              <option value="">Ingen preferens</option>
              {sektionVal.map((s) => (
                <option key={s.id} value={s.id}>{s.namn}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2">Önskat pass</label>
            <div className="space-y-1.5">
              {PASS_PREFERENSER.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="pass_preferens"
                    value={opt.value}
                    defaultChecked={
                      profil.pass_preferens === opt.value ||
                      (!profil.pass_preferens && opt.value === 'ingen_preferens')
                    }
                    className="text-[#0066CC] focus:ring-[#0066CC]"
                  />
                  <span className="text-sm text-gray-700">
                    {opt.label}
                    {opt.sub && <span className="text-gray-400 ml-1 text-xs">({opt.sub})</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Kompetenser */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Kompetenser</p>
          <div className="grid grid-cols-2 gap-2">
            {TILLÅTNA_KOMPETENSER.map((k) => (
              <label key={k.value} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  name="kompetenser"
                  value={k.value}
                  defaultChecked={kompetenser.includes(k.value)}
                  className="rounded text-[#0066CC] focus:ring-[#0066CC]"
                />
                <span className="text-xs text-gray-700">{k.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Övrigt */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Övrigt</p>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Erfarenhet</label>
            <textarea
              name="erfarenhet"
              defaultValue={profil.erfarenhet ?? ''}
              rows={3}
              placeholder="Tidigare erfarenhet av tävlingsarrangemang..."
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Specialkost / allergier</label>
            <input
              type="text"
              name="specialkost"
              defaultValue={profil.specialkost ?? ''}
              placeholder="Lämna tomt om inga"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white font-semibold py-3 rounded-2xl text-sm transition-colors"
        >
          {isPending ? 'Sparar…' : 'Spara profil'}
        </button>
      </form>
    </div>
  )
}
