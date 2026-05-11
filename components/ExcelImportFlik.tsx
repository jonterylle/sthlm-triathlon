'use client'

import { useState, useRef, useTransition } from 'react'
import { importeraFunktionarer } from '@/app/dashboard/actions'

// ── Typer ─────────────────────────────────────────────────────
interface ParsedRow {
  rad: number
  namn: string
  email: string
  telefon: string
  klubb: string
  kompetenser: string[]
  fel: string | null
}

type ImportResultat = {
  email: string
  status: 'skickad' | 'redan_inbjuden' | 'redan_registrerad' | 'fel'
  meddelande?: string
}

const KOMPETENS_MAP: Record<string, string> = {
  sjukvård: 'sjukvard', hlr: 'sjukvard',
  körkort: 'korkort',
  triathlon: 'triathlon_erfarenhet', tri: 'triathlon_erfarenhet',
  simning: 'simning', simkunnig: 'simning', livräddning: 'simning',
  cykel: 'cykel_teknik', mekanik: 'cykel_teknik', cykelmekanik: 'cykel_teknik',
  engelska: 'engelska',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseKompetenser(raw: string): string[] {
  return raw
    .split(/[,;/]+/)
    .map(s => s.trim().toLowerCase())
    .flatMap(s => {
      const mapped = KOMPETENS_MAP[s]
      return mapped ? [mapped] : []
    })
    .filter((v, i, a) => a.indexOf(v) === i)
}

function parseRader(data: unknown[][]): ParsedRow[] {
  // Hitta rubrikrad (rad med 'email' eller 'e-post')
  let headerIdx = 0
  let emailKol = -1, namnKol = -1, telefonKol = -1, klubbKol = -1, kompKol = -1

  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i].map(c => String(c ?? '').toLowerCase().trim())
    const ei = row.findIndex(c => c.includes('email') || c.includes('e-post') || c === 'mail')
    if (ei !== -1) {
      headerIdx = i
      emailKol   = ei
      namnKol    = row.findIndex(c => c.includes('namn') || c === 'name')
      telefonKol = row.findIndex(c => c.includes('telefon') || c.includes('phone') || c.includes('mobil'))
      klubbKol   = row.findIndex(c => c.includes('klubb') || c.includes('club'))
      kompKol    = row.findIndex(c => c.includes('kompetens') || c.includes('skill'))
      break
    }
  }

  if (emailKol === -1) return []

  const rader: ParsedRow[] = []
  for (let i = headerIdx + 1; i < data.length; i++) {
    const row = data[i]
    const email = String(row[emailKol] ?? '').trim().toLowerCase()
    if (!email) continue

    const namn      = namnKol    >= 0 ? String(row[namnKol]    ?? '').trim() : ''
    const telefon   = telefonKol >= 0 ? String(row[telefonKol] ?? '').trim() : ''
    const klubb     = klubbKol   >= 0 ? String(row[klubbKol]   ?? '').trim() : ''
    const kompRaw   = kompKol    >= 0 ? String(row[kompKol]    ?? '').trim() : ''

    rader.push({
      rad: i + 1,
      namn,
      email,
      telefon,
      klubb,
      kompetenser: parseKompetenser(kompRaw),
      fel: !EMAIL_RE.test(email) ? 'Ogiltig e-postadress' : null,
    })
  }
  return rader
}

// ── Komponent ─────────────────────────────────────────────────
export default function ExcelImportFlik() {
  const [rader, setRader]             = useState<ParsedRow[]>([])
  const [filnamn, setFilnamn]         = useState('')
  const [resultat, setResultat]       = useState<ImportResultat[] | null>(null)
  const [laddas, setLaddas]           = useState(false)
  const [fel, setFel]                 = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  async function hanteraFil(fil: File) {
    setFel(null)
    setResultat(null)
    setRader([])

    // Validera filtyp och storlek innan parsning
    if (!fil.name.match(/\.(xlsx|xls)$/i)) {
      setFel('Endast .xlsx och .xls-filer stöds.')
      return
    }
    if (fil.size > 5 * 1024 * 1024) {
      setFel('Filen är för stor (max 5 MB).')
      return
    }

    setFilnamn(fil.name)
    setLaddas(true)

    try {
      // Ladda SheetJS dynamiskt (xlsx installeras via package.json / npm install)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX: any = await import('xlsx')
      const buffer = await fil.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const parsed = parseRader(data)
      if (parsed.length === 0) {
        setFel('Kunde inte hitta data. Kontrollera att filen har en rubrikrad med "E-post" eller "Email".')
      } else {
        setRader(parsed)
      }
    } catch {
      setFel('Kunde inte läsa filen. Kontrollera att det är en giltig .xlsx-fil.')
    } finally {
      setLaddas(false)
    }
  }

  function hanteraDropZone(e: React.DragEvent) {
    e.preventDefault()
    const fil = e.dataTransfer.files[0]
    if (fil) hanteraFil(fil)
  }

  function hanteraInput(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0]
    if (fil) hanteraFil(fil)
  }

  function hanteraImport() {
    const giltiga = rader.filter(r => !r.fel)
    if (giltiga.length === 0) return

    startTransition(async () => {
      const fd = new FormData()
      fd.append('rader', JSON.stringify(giltiga))
      const res = await importeraFunktionarer(fd)
      setResultat(res.resultat)
    })
  }

  function resetera() {
    setRader([])
    setResultat(null)
    setFilnamn('')
    setFel(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const giltiga  = rader.filter(r => !r.fel)
  const ogiltiga = rader.filter(r => r.fel)

  // ── Resultatvy ───────────────────────────────────────────────
  if (resultat) {
    const skickade       = resultat.filter(r => r.status === 'skickad')
    const redanInbjudna  = resultat.filter(r => r.status === 'redan_inbjuden')
    const redanRegg      = resultat.filter(r => r.status === 'redan_registrerad')
    const felrader       = resultat.filter(r => r.status === 'fel')

    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h3 className="font-semibold text-green-800 mb-1">Import klar</h3>
          <p className="text-sm text-green-700">
            {skickade.length} inbjudningsmail skickade
            {redanInbjudna.length > 0  && `, ${redanInbjudna.length} redan inbjudna`}
            {redanRegg.length > 0      && `, ${redanRegg.length} redan registrerade`}
            {felrader.length > 0       && `, ${felrader.length} misslyckades`}
          </p>
        </div>

        {felrader.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-700 mb-2">Misslyckades:</p>
            {felrader.map(r => (
              <p key={r.email} className="text-xs text-red-600">{r.email} — {r.meddelande}</p>
            ))}
          </div>
        )}

        <button
          onClick={resetera}
          className="text-sm text-[#0066CC] hover:underline"
        >
          ← Importera fler
        </button>
      </div>
    )
  }

  // ── Förhandsvisning ──────────────────────────────────────────
  if (rader.length > 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">{filnamn}</p>
            <p className="text-xs text-gray-500">
              {giltiga.length} giltiga rader
              {ogiltiga.length > 0 && <span className="text-red-500 ml-1">· {ogiltiga.length} med fel (hoppas över)</span>}
            </p>
          </div>
          <button onClick={resetera} className="text-xs text-gray-400 hover:text-gray-600">Byt fil</button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Namn</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">E-post</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 hidden sm:table-cell">Telefon</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 hidden md:table-cell">Klubb</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500 hidden lg:table-cell">Kompetenser</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rader.map(r => (
                  <tr key={r.rad} className={r.fel ? 'bg-red-50' : ''}>
                    <td className="px-3 py-2 text-gray-900">{r.namn || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-gray-700">{r.email}</td>
                    <td className="px-3 py-2 text-gray-500 hidden sm:table-cell">{r.telefon || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 hidden md:table-cell">{r.klubb || '—'}</td>
                    <td className="px-3 py-2 hidden lg:table-cell">
                      {r.kompetenser.length > 0
                        ? r.kompetenser.map(k => (
                            <span key={k} className="inline-block bg-blue-50 text-[#0066CC] text-[10px] px-1.5 py-0.5 rounded-full mr-1">{k}</span>
                          ))
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    <td className="px-3 py-2">
                      {r.fel && (
                        <span className="text-[10px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">{r.fel}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {giltiga.length > 0 && (
          <button
            onClick={hanteraImport}
            disabled={isPending}
            className="w-full bg-[#0066CC] hover:bg-[#0052a3] disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors"
          >
            {isPending
              ? 'Skickar inbjudningar…'
              : `Skicka ${giltiga.length} inbjudningsmail`}
          </button>
        )}
      </div>
    )
  }

  // ── Uppladdningsvy ───────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Importera funktionärer från Excel</h2>
        <p className="text-xs text-gray-500">
          Ladda upp en .xlsx-fil med kolumnerna <strong>Namn</strong>, <strong>E-post</strong>, Telefon, Klubb och Kompetenser.
          Varje giltig rad får ett inbjudningsmail.
        </p>
      </div>

      {fel && (
        <p className="bg-red-50 text-red-700 text-sm rounded-xl px-4 py-3">{fel}</p>
      )}

      <div
        onDragOver={e => e.preventDefault()}
        onDrop={hanteraDropZone}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 hover:border-[#0066CC] transition-colors rounded-xl p-10 text-center cursor-pointer bg-white"
      >
        {laddas ? (
          <p className="text-sm text-gray-500">Läser fil…</p>
        ) : (
          <>
            <div className="text-3xl mb-3">📂</div>
            <p className="text-sm font-medium text-gray-700">Dra och släpp din .xlsx-fil här</p>
            <p className="text-xs text-gray-400 mt-1">eller klicka för att välja fil</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={hanteraInput}
          className="sr-only"
        />
      </div>

      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2">Förväntad kolumnstruktur:</p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left pr-4 py-1 font-medium">Namn</th>
                <th className="text-left pr-4 py-1 font-medium">E-post *</th>
                <th className="text-left pr-4 py-1 font-medium">Telefon</th>
                <th className="text-left pr-4 py-1 font-medium">Klubb</th>
                <th className="text-left py-1 font-medium">Kompetenser</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-gray-400">
                <td className="pr-4 py-1">Anna Svensson</td>
                <td className="pr-4 py-1">anna@example.se</td>
                <td className="pr-4 py-1">0701234567</td>
                <td className="pr-4 py-1">IFK Göteborg</td>
                <td className="py-1">sjukvård, körkort</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">* Obligatorisk. Kolumnnamnen kan vara på svenska eller engelska.</p>
      </div>
    </div>
  )
}
