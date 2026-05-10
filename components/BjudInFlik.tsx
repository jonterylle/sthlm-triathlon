'use client'

import { useState, useTransition } from 'react'
import { bjudIn, skickaSMSInbjudan, bjudInFranSMS, skickaOmInbjudan, taBortInbjudan } from '@/app/dashboard/actions'
import type { InbjudanResultat, SMSResultat } from '@/app/dashboard/actions'

interface SMSRad {
  id: string
  telefon: string
  skickad_at: string
  email_inkommen: string | null
  status: string
}

interface EmailRad {
  id: string
  email: string
  skickad_at: string
  status: string
  roll?: string
}

interface Props {
  smsInbjudningar: SMSRad[]
  emailInbjudningar: EmailRad[]
}

export default function BjudInFlik({ smsInbjudningar, emailInbjudningar }: Props) {
  const [aktivSektion, setAktivSektion] = useState<'email' | 'sms'>('email')

  return (
    <div className="space-y-6">
      {/* Sektion-väljare */}
      <div className="flex gap-2">
        <SektionKnapp aktiv={aktivSektion === 'email'} onClick={() => setAktivSektion('email')} label="📧 E-post" />
        <SektionKnapp aktiv={aktivSektion === 'sms'} onClick={() => setAktivSektion('sms')} label="📱 SMS" />
      </div>

      {aktivSektion === 'email' && (
        <EmailSektion emailInbjudningar={emailInbjudningar} />
      )}
      {aktivSektion === 'sms' && (
        <SMSSektion smsInbjudningar={smsInbjudningar} />
      )}
    </div>
  )
}

// ── E-postsektion ─────────────────────────────────────────────

type Roll = 'funktionar' | 'sektionsledare' | 'tl'

function EmailSektion({ emailInbjudningar }: { emailInbjudningar: EmailRad[] }) {
  const [resultat, setResultat] = useState<InbjudanResultat[]>([])
  const [isPending, startTransition] = useTransition()
  const [valdRoll, setValdRoll] = useState<Roll>('funktionar')

  // Lokal kopia av listan så att borttagningar och om-skickningar syns direkt
  const [lokalaInbjudningar, setLokalaInbjudningar] = useState(emailInbjudningar)

  // Vilken underflik visas i listan
  const [listaFlik, setListaFlik] = useState<'inväntar' | 'alla'>('inväntar')

  // Vilken rad är i gång med en åtgärd
  const [åtgärdId, setÅtgärdId] = useState<string | null>(null)
  const [åtgärdFel, setÅtgärdFel] = useState<Record<string, string>>({})

  const visadeRader = lokalaInbjudningar.filter((r) =>
    listaFlik === 'inväntar' ? r.status === 'skickad' || r.status === 'fel' : true
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    fd.set('roll', valdRoll)
    startTransition(async () => {
      const res = await bjudIn(fd)
      setResultat(res.resultat)
      if (res.resultat.some(r => r.status === 'skickad')) {
        // Lägg till nya rader lokalt
        const nyaRader: EmailRad[] = res.resultat
          .filter(r => r.status === 'skickad')
          .map(r => ({
            id: crypto.randomUUID(),
            email: r.email,
            skickad_at: new Date().toISOString(),
            status: 'skickad',
            roll: valdRoll,
          }))
        setLokalaInbjudningar(prev => [...nyaRader, ...prev])
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  function handleSkickaOm(rad: EmailRad) {
    setÅtgärdId(rad.id)
    setÅtgärdFel(prev => ({ ...prev, [rad.id]: '' }))
    startTransition(async () => {
      const res = await skickaOmInbjudan(rad.id, rad.email)
      if (res.ok) {
        setLokalaInbjudningar(prev =>
          prev.map(r => r.id === rad.id ? { ...r, status: 'skickad' } : r)
        )
      } else {
        setÅtgärdFel(prev => ({ ...prev, [rad.id]: res.meddelande ?? 'Fel' }))
      }
      setÅtgärdId(null)
    })
  }

  function handleTaBort(rad: EmailRad) {
    if (!confirm(`Ta bort inbjudan för ${rad.email}?\n\nOm personen har ett konto tas det också bort.`)) return
    setÅtgärdId(rad.id)
    startTransition(async () => {
      const res = await taBortInbjudan(rad.id, rad.email)
      if (res.ok) {
        setLokalaInbjudningar(prev => prev.filter(r => r.id !== rad.id))
      } else {
        setÅtgärdFel(prev => ({ ...prev, [rad.id]: res.meddelande ?? 'Fel' }))
      }
      setÅtgärdId(null)
    })
  }

  const inväntar = lokalaInbjudningar.filter(r => r.status === 'skickad' || r.status === 'fel').length
  const accepterade = lokalaInbjudningar.filter(r => r.status === 'accepterad').length

  return (
    <div className="space-y-6">
      {/* Skicka ny inbjudan */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Skicka e-postinbjudan</h3>
        <p className="text-xs text-gray-500 mb-4">
          Ange en eller flera e-postadresser (komma- eller radbrytningsseparerade). Varje person får ett magic link-mail.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Roll-väljare */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Roll vid registrering</p>
            <div className="flex gap-2">
              <RollKnapp aktiv={valdRoll === 'funktionar'} onClick={() => setValdRoll('funktionar')} label="Funktionär" beskrivning="Ser sin tilldelning" />
              <RollKnapp aktiv={valdRoll === 'sektionsledare'} onClick={() => setValdRoll('sektionsledare')} label="Sektionsledare" beskrivning="Hanterar sin sektion" />
              <RollKnapp aktiv={valdRoll === 'tl'} onClick={() => setValdRoll('tl')} label="Tävlingsledare" beskrivning="Fullständig åtkomst" />
            </div>
          </div>

          <textarea
            name="emails"
            rows={4}
            placeholder={'anna@exempel.se\nbj@exempel.se'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent resize-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? 'Skickar…' : `Skicka inbjudningar som ${
              valdRoll === 'sektionsledare' ? 'sektionsledare'
              : valdRoll === 'tl' ? 'tävlingsledare'
              : 'funktionär'
            }`}
          </button>
        </form>

        {resultat.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {resultat.map((r) => (
              <div key={r.email} className="flex items-center gap-2 text-xs">
                <span>{statusIkon(r.status)}</span>
                <span className="font-mono text-gray-700">{r.email}</span>
                <span className="text-gray-400">{statusText(r.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skickade inbjudningar */}
      {lokalaInbjudningar.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Skickade inbjudningar</h3>

          {/* Underflikar */}
          <div className="flex gap-1 border-b border-gray-200 mb-3">
            <ListaFlikKnapp
              aktiv={listaFlik === 'inväntar'}
              onClick={() => setListaFlik('inväntar')}
              label="Inväntar svar"
              antal={inväntar}
            />
            <ListaFlikKnapp
              aktiv={listaFlik === 'alla'}
              onClick={() => setListaFlik('alla')}
              label="Alla"
              antal={lokalaInbjudningar.length}
            />
          </div>

          {visadeRader.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">
              {listaFlik === 'inväntar' ? 'Inga inbjudningar inväntar svar.' : 'Inga inbjudningar ännu.'}
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {visadeRader.map((r) => (
                <div key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-mono text-gray-800 truncate">{r.email}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadgeFarg(r.status)}`}>
                          {r.status === 'skickad' ? 'Inväntar svar' : r.status === 'accepterad' ? 'Accepterad' : 'Fel'}
                        </span>
                        {r.roll && r.roll !== 'funktionar' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
                            {r.roll === 'sektionsledare' ? 'Sektionsledare' : 'Tävlingsledare'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {r.status !== 'accepterad' && (
                        <button
                          onClick={() => handleSkickaOm(r)}
                          disabled={åtgärdId === r.id}
                          className="text-xs text-[#0066CC] hover:underline disabled:opacity-50"
                        >
                          {åtgärdId === r.id ? '…' : 'Skicka om'}
                        </button>
                      )}
                      <button
                        onClick={() => handleTaBort(r)}
                        disabled={åtgärdId === r.id}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        {åtgärdId === r.id ? '…' : 'Ta bort'}
                      </button>
                    </div>
                  </div>
                  {åtgärdFel[r.id] && (
                    <p className="text-xs text-red-600 mt-1">{åtgärdFel[r.id]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── SMS-sektion ───────────────────────────────────────────────

function SMSSektion({ smsInbjudningar }: { smsInbjudningar: SMSRad[] }) {
  const [resultat, setResultat] = useState<SMSResultat[]>([])
  const [isPending, startTransition] = useTransition()
  const [skickarId, setSkickarId] = useState<string | null>(null)
  const [lokalStatus, setLokalStatus] = useState<Record<string, string>>({})

  function handleSMSSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await skickaSMSInbjudan(fd)
      setResultat(res.resultat)
      if (res.resultat.some(r => r.status === 'skickad')) {
        ;(e.target as HTMLFormElement).reset()
      }
    })
  }

  function handleBjudIn(id: string) {
    setSkickarId(id)
    startTransition(async () => {
      const res = await bjudInFranSMS(id)
      setLokalStatus(prev => ({
        ...prev,
        [id]: res.ok ? 'inbjudan_skickad' : 'fel',
      }))
      setSkickarId(null)
    })
  }

  const vantar = smsInbjudningar.filter(r => r.email_inkommen && r.status === 'email_inkommen')

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Skicka SMS-inbjudan</h3>
        <p className="text-xs text-gray-500 mb-4">
          Ange ett eller flera mobilnummer (ett per rad). Personen får ett SMS med en länk där de anger sin e-post.
        </p>
        <form onSubmit={handleSMSSubmit} className="space-y-3">
          <textarea
            name="telefonnummer"
            rows={4}
            placeholder={'0701234567\n0739876543'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0066CC] focus:border-transparent resize-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {isPending ? 'Skickar…' : 'Skicka SMS'}
          </button>
        </form>

        {resultat.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {resultat.map((r) => (
              <div key={r.telefon} className="flex items-center gap-2 text-xs">
                <span>{r.status === 'skickad' ? '✅' : r.status === 'redan_inbjuden' ? '⚠️' : '❌'}</span>
                <span className="font-mono text-gray-700">{r.telefon}</span>
                <span className="text-gray-400">
                  {r.status === 'skickad' ? 'SMS skickat' : r.status === 'redan_inbjuden' ? 'Redan inbjuden' : 'Fel'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inkomna e-postadresser som väntar på e-postinbjudan */}
      {vantar.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-3">
            ⏳ Väntar på e-postinbjudan ({vantar.length})
          </h3>
          <div className="space-y-2">
            {vantar.map((r) => {
              const status = lokalStatus[r.id] ?? r.status
              return (
                <div key={r.id} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-2 border border-amber-100">
                  <div>
                    <span className="font-mono text-gray-700">{r.email_inkommen}</span>
                    <span className="text-gray-400 ml-2">({r.telefon})</span>
                  </div>
                  {status === 'inbjudan_skickad' ? (
                    <span className="text-green-600 font-medium">✅ Skickad</span>
                  ) : (
                    <button
                      onClick={() => handleBjudIn(r.id)}
                      disabled={skickarId === r.id}
                      className="bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white px-3 py-1 rounded-lg transition-colors font-medium"
                    >
                      {skickarId === r.id ? 'Skickar…' : 'Skicka inbjudan'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {smsInbjudningar.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Skickade SMS ({smsInbjudningar.length})
          </h3>
          <div className="divide-y divide-gray-100">
            {smsInbjudningar.map((r) => (
              <div key={r.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono text-gray-700">{r.telefon}</span>
                  {r.email_inkommen && (
                    <span className="text-gray-400 ml-2">→ {r.email_inkommen}</span>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded-full ${smsStatusFarg(lokalStatus[r.id] ?? r.status)}`}>
                  {smsStatusLabel(lokalStatus[r.id] ?? r.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hjälpfunktioner ───────────────────────────────────────────

function ListaFlikKnapp({
  aktiv,
  onClick,
  label,
  antal,
}: {
  aktiv: boolean
  onClick: () => void
  label: string
  antal: number
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
        aktiv
          ? 'border-[#0066CC] text-[#0066CC]'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
        aktiv ? 'bg-blue-100 text-[#0066CC]' : 'bg-gray-100 text-gray-500'
      }`}>
        {antal}
      </span>
    </button>
  )
}

function RollKnapp({
  aktiv,
  onClick,
  label,
  beskrivning,
}: {
  aktiv: boolean
  onClick: () => void
  label: string
  beskrivning: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors ${
        aktiv
          ? 'border-[#0066CC] bg-blue-50 text-[#0066CC]'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      <p className="text-sm font-semibold leading-tight">{label}</p>
      <p className={`text-xs mt-0.5 ${aktiv ? 'text-blue-500' : 'text-gray-400'}`}>{beskrivning}</p>
    </button>
  )
}

function SektionKnapp({ aktiv, onClick, label }: { aktiv: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        aktiv ? 'bg-[#0066CC] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )
}

function statusIkon(s: string) {
  if (s === 'skickad') return '✅'
  if (s === 'redan_inbjuden') return '⚠️'
  if (s === 'redan_registrerad') return 'ℹ️'
  return '❌'
}

function statusText(s: string) {
  if (s === 'skickad') return 'Inbjudan skickad'
  if (s === 'redan_inbjuden') return 'Redan inbjuden'
  if (s === 'redan_registrerad') return 'Redan registrerad'
  return 'Misslyckades'
}

function statusBadgeFarg(s: string) {
  if (s === 'accepterad') return 'bg-green-100 text-green-700'
  if (s === 'skickad') return 'bg-blue-100 text-blue-700'
  return 'bg-red-100 text-red-700'
}

function smsStatusLabel(s: string) {
  if (s === 'skickad') return 'Inväntar e-post'
  if (s === 'email_inkommen') return 'E-post inkommen'
  if (s === 'inbjudan_skickad') return 'Inbjudan skickad'
  return s
}

function smsStatusFarg(s: string) {
  if (s === 'inbjudan_skickad') return 'bg-green-100 text-green-700'
  if (s === 'email_inkommen') return 'bg-amber-100 text-amber-700'
  return 'bg-blue-100 text-blue-700'
}
