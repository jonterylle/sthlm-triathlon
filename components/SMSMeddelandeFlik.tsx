'use client'

import { useState, useTransition, useMemo } from 'react'
import { skickaGroupSMS } from '@/app/dashboard/actions'
import type { GroupSMSResultat } from '@/app/dashboard/actions'

const MAX_TECKEN = 612
const SMS_GRANS  = 160

export interface SMSMottagare {
  id: string
  full_name: string | null
  email: string
  telefon: string
}

interface Props {
  mottagare: SMSMottagare[]
}

type Läge = 'alla' | 'valda'

export default function SMSMeddelandeFlik({ mottagare }: Props) {
  const [läge, setLäge]               = useState<Läge>('alla')
  const [valda, setValda]             = useState<Set<string>>(new Set())
  const [sök, setSök]                 = useState('')
  const [meddelande, setMeddelande]   = useState('')
  const [bekraftad, setBekraftad]     = useState(false)
  const [resultat, setResultat]       = useState<GroupSMSResultat | null>(null)
  const [felText, setFelText]         = useState('')
  const [pending, startTransition]    = useTransition()

  const tecken = meddelande.length
  const segment = tecken === 0 ? 1 : Math.ceil(tecken / SMS_GRANS)
  const ärLång  = tecken > MAX_TECKEN

  // Filtrera listan baserat på sök
  const filtrerade = useMemo(() => {
    const q = sök.toLowerCase()
    if (!q) return mottagare
    return mottagare.filter(m =>
      (m.full_name ?? '').toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.telefon.includes(q)
    )
  }, [mottagare, sök])

  const antalMottagare = läge === 'alla' ? mottagare.length : valda.size

  function växlaVald(id: string) {
    setValda(prev => {
      const nästa = new Set(prev)
      nästa.has(id) ? nästa.delete(id) : nästa.add(id)
      return nästa
    })
    setBekraftad(false)
  }

  function markAllaFiltrerade() {
    setValda(prev => {
      const nästa = new Set(prev)
      filtrerade.forEach(m => nästa.add(m.id))
      return nästa
    })
    setBekraftad(false)
  }

  function avmarkAllaFiltrerade() {
    setValda(prev => {
      const nästa = new Set(prev)
      filtrerade.forEach(m => nästa.delete(m.id))
      return nästa
    })
    setBekraftad(false)
  }

  function hanteraSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!bekraftad || ärLång || !meddelande.trim()) return
    if (läge === 'valda' && valda.size === 0) return
    setFelText('')
    setResultat(null)

    const fd = new FormData()
    fd.set('meddelande', meddelande)
    if (läge === 'valda') fd.set('profilIds', Array.from(valda).join(','))

    startTransition(async () => {
      const res = await skickaGroupSMS(fd)
      if (!res.ok) {
        setFelText(res.meddelande ?? 'Något gick fel.')
        setBekraftad(false)
      } else if (res.resultat) {
        setResultat(res.resultat)
        setMeddelande('')
        setValda(new Set())
        setBekraftad(false)
      }
    })
  }

  function resetaResultat() {
    setResultat(null)
    setSök('')
  }

  // ── Resultatvy ───────────────────────────────────────────────
  if (resultat) {
    return (
      <div className={`rounded-xl border p-5 space-y-3 ${
        resultat.misslyckade === 0 ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'
      }`}>
        <p className="text-sm font-semibold text-gray-800">
          {resultat.misslyckade === 0 ? '✅' : '⚠️'} Skickat!{' '}
          {resultat.skickade} av {resultat.totalt} SMS levererade.
        </p>
        {resultat.misslyckade > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-amber-700 font-medium">Misslyckades för:</p>
            {resultat.fel.map((f, i) => (
              <p key={i} className="text-xs text-amber-600 font-mono">
                {f.namn} ({f.telefon})
              </p>
            ))}
          </div>
        )}
        <button onClick={resetaResultat} className="text-xs text-gray-500 underline">
          Skicka nytt meddelande
        </button>
      </div>
    )
  }

  // ── Formulärvy ───────────────────────────────────────────────
  return (
    <form onSubmit={hanteraSubmit} className="space-y-5">

      {/* ── Lägeväljare ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Skicka till</p>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
            <button
              type="button"
              onClick={() => { setLäge('alla'); setBekraftad(false) }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                läge === 'alla' ? 'bg-[#0066CC] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Alla ({mottagare.length})
            </button>
            <button
              type="button"
              onClick={() => { setLäge('valda'); setBekraftad(false) }}
              className={`px-4 py-2 text-sm font-medium border-l border-gray-200 transition-colors ${
                läge === 'valda'
                  ? 'bg-[#0066CC] text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              Välj mottagare{valda.size > 0 ? ` (${valda.size} valda)` : ''}
            </button>
          </div>
        </div>

        {/* ── Mottagarlista (läge: valda) ── */}
        {läge === 'valda' && (
          <div className="space-y-2">
            {/* Sök + snabbval */}
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="search"
                value={sök}
                onChange={e => setSök(e.target.value)}
                placeholder="Sök namn, e-post eller nummer…"
                className="flex-1 min-w-[200px] rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC]"
              />
              <button type="button" onClick={markAllaFiltrerade} className="text-xs text-[#0066CC] hover:underline whitespace-nowrap">
                Markera alla
              </button>
              <button type="button" onClick={avmarkAllaFiltrerade} className="text-xs text-gray-400 hover:underline whitespace-nowrap">
                Avmarkera alla
              </button>
            </div>

            {/* Lista */}
            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
              {filtrerade.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Inga träffar.</p>
              ) : filtrerade.map(m => (
                <label
                  key={m.id}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                    valda.has(m.id) ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={valda.has(m.id)}
                    onChange={() => växlaVald(m.id)}
                    className="w-4 h-4 rounded accent-[#0066CC] flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {m.full_name ?? m.email}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{m.telefon}</p>
                  </div>
                </label>
              ))}
            </div>

            {mottagare.length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                Inga funktionärer har mobilnummer registrerat ännu.
              </p>
            )}
          </div>
        )}

        {/* Info alla */}
        {läge === 'alla' && (
          <p className="text-xs text-gray-500">
            SMS skickas till alla {mottagare.length} funktionärer med mobilnummer via 46elks.
          </p>
        )}
      </div>

      {/* ── Meddelande ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Meddelande</label>
          <textarea
            value={meddelande}
            onChange={e => { setMeddelande(e.target.value); setBekraftad(false) }}
            rows={5}
            placeholder="Skriv ditt meddelande här…"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none ${
              ärLång ? 'border-red-300 focus:ring-red-400' : 'border-gray-300'
            }`}
          />
          <div className="flex justify-between mt-1.5">
            <span className={`text-xs ${ärLång ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
              {tecken} / {MAX_TECKEN} tecken
            </span>
            <span className="text-xs text-gray-400">
              {segment} SMS-{segment === 1 ? 'segment' : 'segment'} per mottagare
            </span>
          </div>
        </div>

        {/* Förhandsgranskning */}
        {meddelande.trim().length > 0 && !ärLång && (
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-500 mb-1.5">Förhandsgranskning</p>
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{meddelande}</p>
              <p className="text-[10px] text-gray-400 mt-2">Avsändare: STHLMTriath</p>
            </div>
          </div>
        )}

        {/* Bekräftelse */}
        {meddelande.trim().length > 0 && !ärLång && antalMottagare > 0 && (
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={bekraftad}
              onChange={e => setBekraftad(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-[#0066CC]"
            />
            <span className="text-sm text-gray-600">
              Jag bekräftar att meddelandet ska skickas till{' '}
              <strong>{antalMottagare} {antalMottagare === 1 ? 'funktionär' : 'funktionärer'}</strong>.
            </span>
          </label>
        )}

        {felText && <p className="text-sm text-red-500">{felText}</p>}

        {läge === 'valda' && valda.size === 0 && meddelande.trim().length > 0 && (
          <p className="text-xs text-amber-600">Välj minst en mottagare.</p>
        )}

        <button
          type="submit"
          disabled={
            !bekraftad || !meddelande.trim() || ärLång || pending ||
            (läge === 'valda' && valda.size === 0)
          }
          className="w-full bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          {pending
            ? `Skickar till ${antalMottagare} mottagare…`
            : `📱 Skicka SMS till ${antalMottagare} ${antalMottagare === 1 ? 'funktionär' : 'funktionärer'}`}
        </button>
      </div>
    </form>
  )
}
