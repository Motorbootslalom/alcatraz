import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WKR_ANNAHMEN } from '../wkr/annahmen'
import { leererEntwurf, maskeFuer, tippe, zellenAus } from '../wkr/maske'
import { oeffneUebung } from './uebung'
import type { ErfassungsQuelle } from './erfassen'

// Übung ohne Netz (W3.1, G13): dieselbe Schnittstelle wie die Erfassung, kein Transport, keine Ablage, kein Store.

const offen: ErfassungsQuelle[] = []
const netz = { fetch: vi.fn(), WebSocket: vi.fn() }

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  vi.stubGlobal('fetch', netz.fetch)
  vi.stubGlobal('WebSocket', netz.WebSocket)
})

afterEach(() => {
  for (const q of offen.splice(0)) q.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  netz.fetch.mockClear()
  netz.WebSocket.mockClear()
})

function uebe(o: Parameters<typeof oeffneUebung>[0]) {
  const q = oeffneUebung(o)
  offen.push(q)
  const liste = q.listen.value[0].liste
  return { q, liste }
}

describe('Übungs-Kern', () => {
  it('Tor 5: Zeile → unterwegs → nach 300 ms übernommen; nächster Start rückt nach; nie Netz, nie Ablage', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'tor5' })
    expect([q.uebung, q.verbunden.value, q.entzogen.value]).toEqual([true, true, false])
    const kopf = q.schlange.value[liste][0]
    expect(kopf.startNr).toBe('1')
    const aufbau = maskeFuer(q.sichten.value[liste]!, kopf.klasse)!
    const zellen = zellenAus(tippe(leererEntwurf(), aufbau.teile[0].feld, aufbau.teile[0].codes[0].code), aufbau)
    const z = q.schicke(liste, { s: kopf.key, zellen })!
    expect(q.stufen.value[z]).toEqual({ stufe: 'unterwegs', gesendet: true })
    expect(q.wartend.value).toBe(1)
    expect(q.schlange.value[liste].map((s) => s.startNr)).toEqual(['2', '3'])
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungQuittungMs)
    expect(q.stufen.value[z]).toEqual({ stufe: 'uebernommen' })
    expect(q.zuletzt.value[0]).toMatchObject({ z, sn: '1', zellen })
    expect(netz.fetch).not.toHaveBeenCalled()
    expect(netz.WebSocket).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it('eine Beispiel-Rückfrage beim 5. Start; Korrektur beantwortet sie', () => {
    const { q, liste } = uebe({ regelwerk: 'uim-2026', typeId: 'mueb' })
    const zs: number[] = []
    for (let i = 0; i < 6; i++) zs.push(q.schicke(liste, { s: q.schlange.value[liste][0].key, zellen: {} })!)
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungQuittungMs)
    const stufen = zs.map((z) => q.stufen.value[z].stufe)
    expect(stufen.filter((x) => x === 'rueckfrage')).toHaveLength(1)
    expect(stufen[WKR_ANNAHMEN.uebungRueckfrageBei - 1]).toBe('rueckfrage')
    const rf = q.stufen.value[zs[4]]
    expect(rf.stufe === 'rueckfrage' && rf.zellen[0].steht).not.toBe('')
    const k = q.korrigiere(zs[4], {})!
    expect(q.stufen.value[zs[4]]).toEqual({ stufe: 'uebernommen', nachRueckfrage: true })
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungQuittungMs)
    expect(q.stufen.value[k]).toEqual({ stufe: 'uebernommen' })
  })

  it('Takt zeigt alle 30 s einen Start; pausiert nicht', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'tor5' })
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungTaktSek * 1000)
    expect(q.schlange.value[liste]).toHaveLength(3)
    expect(q.pausiere(liste)).not.toBeNull()
    expect(q.sichten.value[liste]!.status).toBe('pausiert')
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungTaktSek * 1000)
    expect(q.schlange.value[liste]).toHaveLength(3)
    q.weiter(liste)
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungTaktSek * 1000)
    expect(q.schlange.value[liste]).toHaveLength(4)
  })

  it('Steg nur Anlegen: Schlange des Teils; Ablegen-Zeilen nicht erlaubt', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'steg', teil: 'an' })
    expect(q.listen.value[0].teil).toBe('an')
    const k = q.schlange.value[liste][0].key
    expect(q.schicke(liste, { s: k, teil: 'ab', zellen: {} })).toBeNull()
    q.schicke(liste, { s: k, zellen: {} })
    expect(q.schlangeTeil(liste, 'an').some((s) => s.key === k)).toBe(false)
    expect(q.schlangeTeil(liste, 'ab').some((s) => s.key === k)).toBe(false)
  })

  it('Entwurf, holeZurueck vor der Quittung, Abschluss mit offenen Starts nur mit „Rest auf Papier“', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'tor5' })
    const kopf = q.schlange.value[liste][0]
    q.merkeEntwurf(liste, kopf.key, undefined, { 'katalog:tor5': '1' })
    expect(q.entwuerfe.value).toEqual([{ liste, s: kopf.key, sn: '1', zellen: { 'katalog:tor5': '1' } }])
    const z = q.schicke(liste, { s: kopf.key, zellen: { 'katalog:tor5': '1' } })!
    expect(q.entwuerfe.value).toEqual([])
    expect(q.holeZurueck(z)).toEqual({ s: kopf.key, zellen: { 'katalog:tor5': '1' } })
    expect(q.schlange.value[liste][0].key).toBe(kopf.key)
    expect(q.entwurf(liste, kopf.key)).toEqual({ 'katalog:tor5': '1' })
    const z2 = q.schicke(liste, { s: kopf.key, zellen: { 'katalog:tor5': '1' } })!
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungQuittungMs)
    expect(q.holeZurueck(z2)).toBeNull()
    const p = q.pruefung(liste, 'lauf:1')
    expect(p.zeilen.map((x) => x.sn)).toEqual(['1'])
    expect(p.offen.length).toBeGreaterThan(0)
    const a1 = q.schliesseAb(liste, 'lauf:1', 'Muster WKR', false)!
    const a2 = q.schliesseAb(liste, 'lauf:1', 'Muster WKR', true)!
    expect(q.schliesseAb(liste, 'lauf:1', '  ', true)).toBeNull()
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungQuittungMs)
    expect(q.abschluesse.value.find((a) => a.id === a1)).toMatchObject({ stufe: 'abgelehnt', grund: 'offen' })
    expect(q.abschluesse.value.find((a) => a.id === a2)).toMatchObject({ stufe: 'angenommen' })
    // Nirgends ein Name – auch nicht der des Abschlusses.
    expect(JSON.stringify([q.zuletzt.value, q.abschluesse.value, q.sichten.value])).not.toContain('Muster WKR')
  })

  it('nach stop() nichts mehr', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'vorsteg' })
    const k = q.schlange.value[liste][0].key
    q.stop()
    expect(q.schicke(liste, { s: k, zellen: {} })).toBeNull()
    vi.advanceTimersByTime(60_000)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('Übung: „Nicht vorbeigekommen“ (W4.3, R8)', () => {
  it('Zeile ohne Zellen erledigt den Start; Zuletzt ⊘, Prüfansicht zählt; Korrektur hebt es auf; nie Netz', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'gate135' })
    const kopf = q.schlange.value[liste][0]
    const punkt = q.sichten.value[liste]!.punkt!.id
    const z = q.schicke(liste, { s: kopf.key, zellen: { 't1a|hin seiteA': '5' }, nv: true })!
    expect(q.schlange.value[liste].map((s) => s.key)).not.toContain(kopf.key)
    expect(q.zuletzt.value[0]).toMatchObject({ z, nv: true, zellen: {} })
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungQuittungMs)
    let p = q.pruefung(liste, punkt)
    expect(p.nichtVorbei).toEqual([kopf.startNr])
    expect(p.zeilen[0]).toMatchObject({ nv: true, zellen: {} })
    q.korrigiere(z, {})
    p = q.pruefung(liste, punkt)
    expect(p.nichtVorbei).toEqual([])
    expect(netz.fetch).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })
})
