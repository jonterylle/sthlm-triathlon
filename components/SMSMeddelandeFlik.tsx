'use client'

import { useState, useTransition } from 'react'
import { skickaGroupSMS } from '@/app/dashboard/actions'
import type { GroupSMSResultat } from '@/app/dashboard/actions'

const MAX_TECKEN = 612  // 4 × 153 tecken (multi-part SMS)
const SMS_GRANS  = 160  // tecken per SMS-segment

interface Props {
  antalMedTelefon: number
}

export default function SMSMeddelandeFlik({ antalMedTelefon }: Props) {
  const [meddelande, setMeddelande]   = useState('')
  const [bekraftad, setBekraftad]     = useState(false)
  const [resultat, setResultat]       = useState<GroupSMSResultat | null>(null)
  const [felText, setFelText]         = useState('')
  const [pending, startTransition]    = useTransition()

  const tecken    = meddelande.length
  const segment   = tecken === 0 ? 1 : Math.ceil(tecken / SMS_GRANS)
  const ärLång    = tecken > MAX_TECKEN

  function hanteraSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!bekraftad || ärLång || !meddelande.trim()) return
    setFelText('')
    setResultat(null)

    const fd = new FormData()
    fd.set('meddelande', meddelande)

    startTransition(async () => {
      const res = await skickaGroupSMS(fd)
      if (!res.ok) {
        setFelText(res.meddelande ?? 'Något gick fel.')
        setBekraftad(false)
      } else if (res.resultat) {
        setResultat(res.resultat)
        setMeddelande('')
        setBekraftad(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Förhandsinfo */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <span className="text-xl mt-0.5">📱</span>
        <div>
          <p className="text-sm font-semibold text-blue-800">
            {antalMedTelefon} funktionärer har mobilnummer registrerat
          </p>
          <p className="text-xs text-blue-600 mt-0.5">
            SMS skickas via 46elks till alla med telefonnummer i profilen.
          </p>
        </div>
      </div>

      {/* Skickat-resultat */}
      {resultat && (
        <div className={`rounded-xl border p-4 space-y-2 ${
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
          <button
            onClick={() => setResultat(null)}
            className="text-xs text-gray-500 underline mt-1"
          >
            Skicka nytt meddelande
          </button>
        </div>
      )}

      {!resultat && (
        <form onSubmit={hanteraSubmit} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meddelande
            </label>
            <textarea
              value={meddelande}
              onChange={e => { setMeddelande(e.target.value); setBekraftad(false) }}
              rows={6}
              placeholder="Skriv ditt meddelande här…"
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0066CC] resize-none ${
                ärLång ? 'border-red-300 focus:ring-red-400' : 'border-gray-300'
              }`}
            />
            {/* Teckenräknare */}
            <div className="flex items-center justify-between mt-1.5">
              <span className={`text-xs ${ärLång ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                {tecken} / {MAX_TECKEN} tecken
              </span>
              <span className="text-xs text-gray-400">
                {segment} {segment === 1 ? 'SMS-segment' : 'SMS-segment'} per mottagare
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
          {meddelande.trim().length > 0 && !ärLång && (
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bekraftad}
                onChange={e => setBekraftad(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-[#0066CC]"
              />
              <span className="text-sm text-gray-600">
                Jag bekräftar att meddelandet ska skickas till{' '}
                <strong>{antalMedTelefon} funktionärer</strong>.
              </span>
            </label>
          )}

          {felText && (
            <p className="text-sm text-red-500">{felText}</p>
          )}

          <button
            type="submit"
            disabled={!bekraftad || !meddelande.trim() || ärLång || pending}
            className="w-full bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            {pending
              ? `Skickar till ${antalMedTelefon} mottagare…`
              : `📱 Skicka SMS till ${antalMedTelefon} funktionärer`}
          </button>
        </form>
      )}
    </div>
  )
}
