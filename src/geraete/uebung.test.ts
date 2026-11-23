import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WKR_ANNAHMEN } from '../wkr/annahmen'
import { fertig, leererEntwurf, maskeFuer, restRichtig, setzeZeit, tippe, zellenAus } from '../wkr/maske'
import { naechsterOffener } from '../wkr/tisch'
import { oeffneUebung, UEBUNG_FOLGE_MS, UEBUNG_FRUEH_JEDER } from './uebung'
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
  it('Tor 5: Zeile → unterwegs → nach 300 ms übernommen; nächster Start nach 2–6 s; nie Netz, nie Ablage', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'tor5' })
    expect([q.uebung, q.verbunden.value, q.entzogen.value]).toEqual([true, true, false])
    const kopf = q.schlange.value[liste][0]
    expect(kopf.startNr).toBe('1')
    const aufbau = maskeFuer(q.sichten.value[liste]!, kopf.klasse)!
    const zellen = zellenAus(tippe(leererEntwurf(), aufbau.teile[0].feld, aufbau.teile[0].codes[0].code), aufbau)
    const z = q.schicke(liste, { s: kopf.key, zellen })!
    expect(q.stufen.value[z]).toEqual({ stufe: 'unterwegs', gesendet: true })
    expect(q.wartend.value).toBe(1)
    // Nutzer 21.11.2026: Der nächste kommt erst nach dem Abschicken – nicht gleich.
    expect(q.schlange.value[liste]).toEqual([])
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungQuittungMs)
    expect(q.stufen.value[z]).toEqual({ stufe: 'uebernommen' })
    vi.advanceTimersByTime(UEBUNG_FOLGE_MS[1])
    expect(q.schlange.value[liste].map((s) => s.startNr)).toEqual(['2'])
    expect(q.zuletzt.value[0]).toMatchObject({ z, sn: '1', zellen })
    expect(netz.fetch).not.toHaveBeenCalled()
    expect(netz.WebSocket).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it('eine Beispiel-Rückfrage beim 5. Start; Korrektur beantwortet sie', () => {
    const { q, liste } = uebe({ regelwerk: 'uim-2026', typeId: 'mueb' })
    const zs: number[] = []
    for (let i = 0; i < 6; i++) {
      zs.push(q.schicke(liste, { s: q.schlange.value[liste][0].key, zellen: {} })!)
      vi.advanceTimersByTime(UEBUNG_FOLGE_MS[1])
    }
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

  it('Rückfall-Takt: Tut der WKR nichts, kommt alle 30 s ein Start; pausiert nicht', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'tor5' })
    expect(q.schlange.value[liste]).toHaveLength(1)
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungTaktSek * 1000 - 1)
    expect(q.schlange.value[liste]).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(q.schlange.value[liste]).toHaveLength(2)
    expect(q.pausiere(liste)).not.toBeNull()
    expect(q.sichten.value[liste]!.status).toBe('pausiert')
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungTaktSek * 1000)
    expect(q.schlange.value[liste]).toHaveLength(2)
    q.weiter(liste)
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungTaktSek * 1000)
    expect(q.schlange.value[liste]).toHaveLength(3)
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
    vi.advanceTimersByTime(UEBUNG_FOLGE_MS[1])
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

/** Wartet in 100-ms-Schritten (Fake-Uhr), bis die eigene Schlange mehr als `n` Starts hat; gibt die Wartezeit zurück. */
function bisMehrAls(q: ErfassungsQuelle, liste: string, n: number, hoechstens = 60_000): number {
  let ms = 0
  while (q.schlange.value[liste].length <= n && ms < hoechstens) {
    vi.advanceTimersByTime(100)
    ms += 100
  }
  return ms
}

describe('Übungstakt (Nutzer 21.11.2026, Y1–Y3)', () => {
  it('nach dem Abschicken kommt der nächste nach 2–6 s; gleiche Saat, gleiche Wartezeiten', () => {
    const lauf = (saat: number) => {
      const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'tor5', saat })
      const zeiten: number[] = []
      for (let i = 0; i < 12; i++) {
        // Steht schon einer an („vorher“), erst ihn abarbeiten – gemessen wird nur ab leerer Schlange.
        while (q.schlange.value[liste].length > 1) q.schicke(liste, { s: q.schlange.value[liste][0].key, zellen: {} })
        q.schicke(liste, { s: q.schlange.value[liste][0].key, zellen: {} })
        if (q.schlange.value[liste].length > 0) continue
        zeiten.push(bisMehrAls(q, liste, 0))
      }
      return zeiten
    }
    const a = lauf(7)
    expect(a.length).toBeGreaterThan(5)
    for (const ms of a) {
      expect(ms).toBeGreaterThanOrEqual(UEBUNG_FOLGE_MS[0])
      expect(ms).toBeLessThanOrEqual(UEBUNG_FOLGE_MS[1] + 100)
    }
    // Nicht immer dieselbe Zeit – sonst wäre es ein Takt.
    expect(new Set(a).size).toBeGreaterThan(1)
    expect(lauf(7)).toEqual(a)
  })

  it('hin und wieder steht der nächste schon vorher an (jeder 4.–6. gezeigte Start)', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'tor5', saat: 11 })
    let vorher = 0
    for (let i = 0; i < 30; i++) {
      // Der WKR lässt sich 7 s Zeit: in der Zeit kommt höchstens der „frühe“ Start (Rückfall erst nach 30 s).
      vi.advanceTimersByTime(UEBUNG_FOLGE_MS[1] + 1000)
      if (q.schlange.value[liste].length > 1) vorher++
      while (q.schlange.value[liste].length > 0) q.schicke(liste, { s: q.schlange.value[liste][0].key, zellen: {} })
      bisMehrAls(q, liste, 0)
    }
    expect(vorher).toBeGreaterThanOrEqual(Math.floor(30 / (UEBUNG_FRUEH_JEDER[1] + 1)))
    expect(vorher).toBeLessThanOrEqual(Math.ceil(30 / UEBUNG_FRUEH_JEDER[0]) + 1)
  })

  it('Zurückholen vor der Quittung: der geplante nächste kommt nicht; Pause hält ihn an, „Weiter“ holt ihn nach', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'tor5', saat: 3 })
    const z = q.schicke(liste, { s: q.schlange.value[liste][0].key, zellen: {} })!
    expect(q.holeZurueck(z)).not.toBeNull()
    vi.advanceTimersByTime(UEBUNG_FOLGE_MS[1])
    expect(q.schlange.value[liste].map((s) => s.startNr)).toEqual(['1'])

    q.schicke(liste, { s: q.schlange.value[liste][0].key, zellen: {} })
    q.pausiere(liste)
    vi.advanceTimersByTime(UEBUNG_FOLGE_MS[1])
    expect(q.schlange.value[liste]).toEqual([])
    q.weiter(liste)
    const ms = bisMehrAls(q, liste, 0)
    expect(ms).toBeGreaterThanOrEqual(UEBUNG_FOLGE_MS[0])
    expect(ms).toBeLessThanOrEqual(UEBUNG_FOLGE_MS[1] + 100)
  })

  it.each([
    ['steg', 'an'],
    ['steg', 'ab'],
    ['steg', undefined],
    ['vorsteg', undefined],
    ['gate135', undefined],
  ] as const)('%s %s: nach dem Abschicken kommt immer wieder ein Start (am Anlegen nie hängen)', (typeId, teil) => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId, ...(teil ? { teil } : {}), saat: 5 })
    const eigene = () => (teil ? q.schlangeTeil(liste, teil) : q.schlange.value[liste]).filter((s) => !s.vorab)
    for (let i = 0; i < 8; i++) {
      let ms = 0
      while (eigene().length === 0 && ms < UEBUNG_FOLGE_MS[1] + 100) {
        vi.advanceTimersByTime(100)
        ms += 100
      }
      expect(eigene().length, `Runde ${i}`).toBeGreaterThan(0)
      const s = eigene()[0]
      const t = teil ?? (s.teile && !s.teile.ab ? 'ab' : s.teile ? 'an' : undefined)
      q.schicke(liste, { s: s.key, ...(t && !teil ? { teil: t } : {}), zellen: {} })
    }
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

describe('Übung: Zeit-Liste mit mehreren Zeitfeldern (22.11.2026, R8-35, ZT5)', () => {
  it('nur die erste Zeit genügt; eine zweite Zeit nachtragen und wieder leeren geht über die Korrektur', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'zeit' })
    const kopf = q.schlange.value[liste][0]
    const aufbau = maskeFuer(q.sichten.value[liste]!, kopf.klasse)!
    expect(aufbau.zeiten.length).toBeGreaterThan(1)
    const [erstes, zweites] = aufbau.zeiten.map((z) => z.feld)
    const e = setzeZeit(leererEntwurf(), aufbau, erstes, '83,45')
    expect(fertig(e, aufbau)).toBe(true)
    const z = q.schicke(liste, { s: kopf.key, zellen: zellenAus(e, aufbau) })!
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungQuittungMs)
    expect(q.stufen.value[z]).toEqual({ stufe: 'uebernommen' })
    expect(q.stand(z)).toMatchObject({ [erstes]: '83,45' })
    const mitZweiter = setzeZeit(e, aufbau, zweites, '84,10')
    const z2 = q.korrigiere(z, zellenAus(mitZweiter, aufbau))!
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungQuittungMs)
    expect(q.stand(z2)).toMatchObject({ [erstes]: '83,45', [zweites]: '84,10' })
    const z3 = q.korrigiere(z2, zellenAus(setzeZeit(mitZweiter, aufbau, zweites, ''), aufbau))!
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungQuittungMs)
    expect(q.stand(z3)?.[zweites] ?? '').toBe('')
    expect(netz.fetch).not.toHaveBeenCalled()
  })
})

describe('Knoten-Übung (KN9–KN11, 22.11.2026)', () => {
  it('Vorschlag aus Bestand und eigenen Zeilen: 8 → 9, 10 → 11, 9 → 11; selbst geschickt zählt sofort; „Alle richtig“ = leere Zellen', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'knoten' })
    const bestand = () => q.bestand.value[liste]
    const key = (nr: string) => bestand().find((b) => b.startNr === nr)!.key
    const vorschlag = () => naechsterOffener(bestand(), q.zuletzt.value.find((z) => z.liste === liste)?.s)?.startNr
    const aufbau = maskeFuer(q.sichten.value[liste]!, bestand()[0].klasse)!
    // „Alle richtig“ ohne einen Tipp: fertig, alle Zellen leer (= ✓).
    const alle = zellenAus(restRichtig(leererEntwurf(), aufbau), aufbau)
    expect(fertig(leererEntwurf(), aufbau)).toBe(true)
    expect(Object.values(alle).every((w) => w === '')).toBe(true)
    expect(vorschlag()).toBe('1')
    for (const nr of ['8', '10', '9']) {
      expect(q.schicke(liste, { s: key(nr), zellen: alle })).not.toBeNull()
      // Vor der Quittung (300 ms) zählt die eigene Zeile schon als erledigt.
      expect(bestand().find((b) => b.startNr === nr)!.z).toBeDefined()
      expect(vorschlag()).toBe(nr === '8' ? '9' : '11')
    }
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungQuittungMs)
    expect(vorschlag()).toBe('11')
    // Kein Takt am Tisch (KN8): auch nach langer Zeit kommt nichts von selbst.
    vi.advanceTimersByTime(WKR_ANNAHMEN.uebungTaktSek * 2000)
    expect(q.schlange.value[liste] ?? []).toEqual([])
    expect(netz.fetch).not.toHaveBeenCalled()
  })
})

describe('Übung: Klasse vorziehen (Nutzer 22.11.2026, R7-45, Y4)', () => {
  it('steht kein Start an, kommt der vorgezogene sofort; danach die normale Folge; nie Netz, nie Ablage', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'tor5', folgeMs: [0, 0] })
    const erster = q.schlange.value[liste][0]
    expect(erster.startNr).toBe('1')
    q.schicke(liste, { s: erster.key, zellen: {} })
    expect(q.schlange.value[liste]).toEqual([])
    // Klasse der Nummer 20 (letzter Block).
    const ziel = Object.keys(q.sichten.value[liste]!.klassen).find((k) => k !== erster.klasse)!
    expect(q.zieheKlasseVor!(liste, ziel as never)).toBe(true)
    // Sofort, ohne auf den Takt zu warten.
    const vor = q.schlange.value[liste][0]
    expect(vor.klasse).toBe(ziel)
    expect(vor.startNr).not.toBe('2')
    q.schicke(liste, { s: vor.key, zellen: {} })
    vi.advanceTimersByTime(1)
    expect(q.schlange.value[liste][0].startNr).toBe('2')
    // Fremde Liste oder unbekannte Klasse: nichts.
    expect(q.zieheKlasseVor!('andere', ziel as never)).toBe(false)
    expect(q.zieheKlasseVor!(liste, 'gibtsnicht' as never)).toBe(false)
    expect(netz.fetch).not.toHaveBeenCalled()
    expect(netz.WebSocket).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
  })

  it('steht schon ein Start an, kommt der vorgezogene als nächster (nicht sofort)', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'tor5', folgeMs: [0, 0] })
    const erster = q.schlange.value[liste][0]
    const ziel = Object.keys(q.sichten.value[liste]!.klassen).find((k) => k !== erster.klasse)!
    q.zieheKlasseVor!(liste, ziel as never)
    expect(q.schlange.value[liste].map((s) => s.startNr)).toEqual(['1'])
    q.schicke(liste, { s: erster.key, zellen: {} })
    vi.advanceTimersByTime(1)
    expect(q.schlange.value[liste][0].klasse).toBe(ziel)
  })

  it('Knoten: der Vorschlag springt auf den ersten offenen der Klasse, bis zur nächsten Zeile', () => {
    const { q, liste } = uebe({ regelwerk: 'dm-2026', typeId: 'knoten' })
    const bestand = () => q.bestand.value[liste]
    const vorschlag = () => naechsterOffener(bestand(), q.zuletzt.value.find((z) => z.liste === liste)?.s, q.vorgezogen?.value)
    expect(vorschlag()?.startNr).toBe('1')
    const letzte = bestand().at(-1)!.klasse
    expect(q.zieheKlasseVor!(liste, letzte)).toBe(true)
    expect(q.vorgezogen?.value).toBe(letzte)
    const v = vorschlag()!
    expect(v.klasse).toBe(letzte)
    expect(v.startNr).toBe(bestand().find((b) => b.klasse === letzte)!.startNr)
    q.schicke(liste, { s: v.key, zellen: {} })
    expect(q.vorgezogen?.value).toBeNull()
    expect(q.schlange.value[liste] ?? []).toEqual([])
  })
})
