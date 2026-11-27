import { describe, expect, it } from 'vitest'
import { NACHNAMEN, VORNAMEN_M, VORNAMEN_W } from '../data/names'
import { WKR_ANNAHMEN } from './annahmen'
import { maskeFuer } from './maske'
import { LISTEN_SICHT_FASSUNG } from './sicht'
import type { ClassId } from '../types'
import { uebungsAusgleich, uebungsBoot, uebungsCoPiloten, uebungsSchritt, uebungsSicht, uebungsStand, ziehVor, type UebungsStand } from './uebung'
import { ausgleichAmSteg, coPilotenAmSteg } from '../lib/ausgleich'
import { coPilotVorgesehen } from '../lib/besetzung'
import { BOOTSNAMEN } from '../data/boote'

// Übung ohne Netz (W3.1, G13): Sicht wie vom Bedienrechner (`lv`, Masken), erfundene Starts ohne Namen, Schritt.
// Seit 27.11.2026 (CP8) mit erfundenem Boot je Klasse und – nur am Steg – erfundenen Co-Piloten.

/** Erfundene Namen aus src/data (länger als drei Zeichen, damit „Ben“ nicht in „Benutzer“ trifft). */
const NAMEN = [...VORNAMEN_M, ...VORNAMEN_W, ...NACHNAMEN].filter((n) => n.length > 3)

describe('Übungs-Sicht', () => {
  it('Fassung und Form wie die echte Sicht; Sprache des Regelwerks; Masken für jede Klasse der Starts', () => {
    const dm = uebungsSicht(uebungsStand('dm-2026', 'tor5'))
    expect(dm.lv).toBe(LISTEN_SICHT_FASSUNG)
    expect([dm.sprache, dm.modus, dm.status, dm.punkt?.id]).toEqual(['de', 'digital', 'aktiv', 'lauf:1'])
    expect(dm.andere).toBeUndefined()
    expect(dm.schlange.map((s) => s.startNr)).toEqual(['1', '2'])
    expect(dm.danach.map((s) => s.startNr)).toEqual(['3', '4', '5', '6', '7'])
    for (const s of [...dm.schlange, ...dm.danach]) expect(maskeFuer(dm, s.klasse)?.art).toBe('katalog')
    const uim = uebungsSicht(uebungsStand('uim-2026', 'steg'))
    expect([uim.sprache, uim.andere?.sprache]).toEqual(['en', 'de'])
    expect(uim.teile).toEqual({ ab: { status: 'aktiv', abgeschlossen: [] }, an: { status: 'aktiv', abgeschlossen: [] } })
    expect(uim.schlange[0].teile).toEqual({ ab: false, an: false })
  })

  it('MüB: nur Klassen, die die Liste haben (keine „entfällt“ in der Übung); Vorsteg sieht zwei vorab', () => {
    const mueb = uebungsSicht(uebungsStand('dm-2026', 'mueb'))
    for (const s of [...mueb.schlange, ...mueb.danach]) expect(mueb.klassen[s.klasse]!.felder).not.toBeNull()
    const vorsteg = uebungsSicht(uebungsStand('dm-2026', 'vorsteg'))
    expect(vorsteg.schlange.map((s) => [s.startNr, !!s.vorab])).toEqual([['1', false], ['2', false], ['3', true], ['4', true]])
    expect(vorsteg.danach[0].startNr).toBe('5')
  })

  it('ohne Starter-Namen: Namen nur als Co-Piloten am Steg (CP8); Boot je Klasse an jedem Start, fest nach Klasse', () => {
    const steg = uebungsSicht(uebungsStand('dm-2026', 'steg'))
    const { coPiloten: _c, ...ohneCoPiloten } = steg
    const text = JSON.stringify([ohneCoPiloten, uebungsSicht(uebungsStand('uim-2026', 'vorsteg'))])
    for (const n of NAMEN) expect(text, n).not.toContain(`"${n}`)
    for (const regelwerk of ['dm-2026', 'uim-2026'])
      for (const typeId of ['steg', 'vorsteg', 'tor5']) {
        const sicht = uebungsSicht(uebungsStand(regelwerk, typeId))
        for (const x of [...sicht.schlange, ...sicht.danach]) expect(x.boot, `${regelwerk}/${typeId}/${x.startNr}`).toBe(uebungsBoot(x.klasse))
      }
    // Je Klasse ein anderes Boot aus den Beispiel-Bootsnamen (src/data/boote.ts).
    const boote = (['E', '1', '2', '3', '4', '5', '6', '7'] as ClassId[]).map(uebungsBoot)
    expect(new Set(boote).size).toBe(boote.length)
    for (const b of boote) expect(BOOTSNAMEN).toContain(b)
  })
})

describe('Übung: Ausgleichsgewicht am Steg (Nutzer 24.11.2026, WKR_ANNAHMEN AG4)', () => {
  it('Steg-Listen tragen erfundene Werte durch dieselbe Rechnung – „AG n kg“, 0 und „fehlt“; andere Listen nicht', () => {
    const steg = uebungsSicht(uebungsStand('dm-2026', 'steg'))
    const starts = [...steg.schlange, ...steg.danach]
    expect(starts.length).toBeGreaterThan(5)
    for (const x of starts) expect(x.ausgleich, x.startNr).toBe(uebungsAusgleich('dm-2026', x.klasse, Number(x.startNr)))
    const werte = new Set(starts.map((x) => (typeof x.ausgleich === 'number' ? (x.ausgleich > 0 ? 'kg' : 'kein') : x.ausgleich)))
    expect(werte).toEqual(new Set(['kg', 'kein', 'fehlt']))
    // Feste Folge je Startnummer (AG4): Nr. 1 ist 4,4 kg leichter, Nr. 2 schwerer, Nr. 4 nicht gewogen.
    expect([1, 2, 4].map((nr) => uebungsAusgleich('dm-2026', '4', nr))).toEqual([4, 0, 'fehlt'])
    expect(uebungsAusgleich('dm-2026', '4', 1)).toBe(ausgleichAmSteg({ regelwerk: 'dm-2026', sollgewicht: {} }, { klasse: '4', gewicht: 60.6 }))
    // UIM kennt Durchschnittsgewichte ebenso; Tor 5 trägt keines.
    for (const x of uebungsSicht(uebungsStand('uim-2026', 'steg')).schlange) expect(x.ausgleich, x.startNr).toBeDefined()
    for (const x of uebungsSicht(uebungsStand('dm-2026', 'tor5')).schlange) expect(x.ausgleich, x.startNr).toBeUndefined()
  })
})

describe('Übung: Co-Piloten am Steg (Nutzer 27.11.2026, WKR_ANNAHMEN CP8)', () => {
  it('nur in Klassen mit Co-Pilot laut Regelwerk, Namen aus src/data, reihum mit und ohne Ersatz, Klammer durch dieselbe Rechnung', () => {
    for (const regelwerk of ['dm-2026', 'uim-2026']) {
      const sicht = uebungsSicht(uebungsStand(regelwerk, 'steg'))
      const klassen = Object.keys(sicht.klassen) as ClassId[]
      const mit = klassen.filter((k) => coPilotVorgesehen(regelwerk, k))
      expect(mit.length, regelwerk).toBeGreaterThan(2)
      expect(Object.keys(sicht.coPiloten ?? {}).sort(), regelwerk).toEqual([...mit].sort())
      // Dieselbe Auswahl und Rechnung wie am Bedienrechner (lib/ausgleich.ts coPilotenAmSteg, „je Klasse“, 1 kg).
      const stand = uebungsCoPiloten(regelwerk, klassen)
      for (const k of mit) expect(sicht.coPiloten![k], `${regelwerk}/${k}`).toEqual(coPilotenAmSteg(stand, k).map((c) => ({ rolle: c.rolle, coPilot: c.name, ...(c.ausgleich !== undefined ? { ausgleich: c.ausgleich } : {}) })))
      const alle = Object.values(sicht.coPiloten!).flat()
      for (const c of alle) for (const teil of c!.coPilot.split(' ')) expect([...VORNAMEN_M, ...VORNAMEN_W, ...NACHNAMEN], c!.coPilot).toContain(teil)
      // Reihum (WKR_ANNAHMEN.coPilotUebung): einige mit Ersatz, einige ohne; Klammern „(+n kg)“ und „(nicht gewogen)“.
      const zahl = Object.values(sicht.coPiloten!).map((l) => l!.length)
      expect(new Set(zahl)).toEqual(new Set([1, 2]))
      expect(new Set(alle.map((c) => (typeof c!.ausgleich === 'number' ? 'kg' : c!.ausgleich)))).toEqual(new Set(['kg', 'fehlt', undefined]))
      // Kein Name doppelt, und dieselbe Übung zeigt dieselben Personen.
      expect(new Set(alle.map((c) => c!.coPilot)).size).toBe(alle.length)
      expect(uebungsSicht(uebungsStand(regelwerk, 'steg')).coPiloten).toEqual(sicht.coPiloten)
    }
    // DM, erste Klasse mit Co-Pilot (E): Co-Pilot 64,2 kg, Ersatz 70,5 kg → der Co-Pilot bekommt 6,3 → 6 kg.
    const e = uebungsSicht(uebungsStand('dm-2026', 'steg')).coPiloten!.E!
    expect(e.map((c) => [c.rolle, c.ausgleich])).toEqual([['haupt', 6], ['ersatz', undefined]])
    // Nur am Steg: andere Listen der Übung tragen keine Co-Piloten.
    for (const typeId of ['vorsteg', 'tor5', 'mueb', 'zeit']) expect(uebungsSicht(uebungsStand('dm-2026', typeId)).coPiloten, typeId).toBeUndefined()
  })
})

describe('Übung mit Bojen-Listen (W4.1, P12)', () => {
  it('Tor 1/3/5, Tor 2/4/5, Parcours mit Start/Ziel (DM) und Parallelslalom (UIM): Bojen-Masken, ohne Namen, mit Boot (CP8)', () => {
    for (const [regelwerk, typeId] of [['dm-2026', 'gate135'], ['dm-2026', 'gate245'], ['dm-2026', 'parcoursms'], ['uim-2026', 'gate135'], ['uim-2026', 'parallelparcours']] as const) {
      const sicht = uebungsSicht(uebungsStand(regelwerk, typeId))
      expect(sicht.lv, typeId).toBe(LISTEN_SICHT_FASSUNG)
      for (const s of [...sicht.schlange, ...sicht.danach]) {
        const m = maskeFuer(sicht, s.klasse)!
        expect(m.art, `${regelwerk}/${typeId}/${s.klasse}`).toBe('bojen')
        expect(m.abschnitte.length).toBeGreaterThan(0)
      }
      const text = JSON.stringify(sicht)
      for (const n of NAMEN) expect(text, n).not.toContain(`"${n}`)
      expect(sicht.coPiloten, typeId).toBeUndefined()
      for (const s of [...sicht.schlange, ...sicht.danach]) expect(s.boot, `${typeId}/${s.startNr}`).toBe(uebungsBoot(s.klasse))
    }
  })
})

describe('Übungs-Schritt', () => {
  it('erledigter Start fällt weg, der nächste rückt nach; Takt zeigt weitere, höchstens die Schlange', () => {
    let st = uebungsStand('dm-2026', 'tor5')
    const erster = uebungsSicht(st).schlange[0].key
    st = uebungsSchritt(st, { s: erster })
    expect(uebungsSicht(st).schlange.map((s) => s.startNr)).toEqual(['2', '3'])
    st = uebungsSchritt(st, null)
    expect(uebungsSicht(st).schlange.map((s) => s.startNr)).toEqual(['2', '3', '4'])
    for (let i = 0; i < 30; i++) st = uebungsSchritt(st, null)
    expect(uebungsSicht(st).schlange).toHaveLength(WKR_ANNAHMEN.schlange)
    // Unbekannte Kennung: nichts ändert sich.
    expect(uebungsSchritt(st, { s: 'kaputt' })).toBe(st)
    expect(uebungsSchritt(st, { s: erster })).toBe(st)
  })

  it('Steg je Teil: Ablegen allein lässt den Start stehen, Anlegen schließt ihn', () => {
    let st = uebungsStand('dm-2026', 'steg')
    const k = uebungsSicht(st).schlange[0].key
    st = uebungsSchritt(st, { s: k, teil: 'ab' })
    expect(uebungsSicht(st).schlange[0]).toMatchObject({ key: k, teile: { ab: true, an: false } })
    st = uebungsSchritt(st, { s: k, teil: 'an' })
    expect(uebungsSicht(st).schlange.map((s) => s.key)).not.toContain(k)
  })

  it('Vorsteg: eine Zeile für einen vorab gesehenen Start zeigt ihn; nach Nr. 20 beginnt der 2. Lauf', () => {
    let st = uebungsStand('dm-2026', 'vorsteg')
    const vorab = uebungsSicht(st).schlange.find((s) => s.vorab)!
    st = uebungsSchritt(st, { s: vorab.key })
    const sicht = uebungsSicht(st)
    expect(sicht.schlange.filter((s) => !s.vorab).map((s) => s.startNr)).toEqual(['1', '2'])
    expect(sicht.schlange.filter((s) => s.vorab).map((s) => s.startNr)).toEqual(['4', '5'])
    let t = uebungsStand('dm-2026', 'tor5')
    for (let i = 0; i < 25; i++) t = uebungsSchritt(t, { s: uebungsSicht(t).schlange[0].key })
    const spaet = uebungsSicht(t)
    expect(spaet.punkt?.id).toBe('lauf:2')
    expect(spaet.schlange[0].titel).toBe('2. Lauf')
  })
})

describe('Klasse vorziehen (Nutzer 22.11.2026, R7-45, Y4)', () => {
  const gezeigt = (st: UebungsStand) => uebungsSicht(st).schlange.filter((s) => !s.vorab)
  const erledige = (st: UebungsStand) => uebungsSchritt(st, { s: gezeigt(st)[0].key }, 0)
  /** Klasse der Nummer 1 bzw. 20 im Block der Übung (die Folge der Sicht-Schlüssel ist eine andere). */
  const klasseDer = (typeId: string, nr: number) => uebungsSicht(uebungsStand('dm-2026', typeId, undefined, 20)).schlange[nr - 1].klasse

  it('der nächste gezeigte Start hat die Klasse; danach die normale Folge, ohne Nummer doppelt', () => {
    let st = uebungsStand('dm-2026', 'tor5', undefined, 0)
    expect(Object.keys(uebungsSicht(st).klassen).length).toBeGreaterThan(1)
    const letzte = klasseDer('tor5', 20)
    st = ziehVor(st, letzte)
    st = uebungsSchritt(st, null)
    const vor = gezeigt(st)[0]
    expect(vor.klasse).toBe(letzte)
    expect(Number(vor.startNr)).toBeGreaterThan(1)
    expect(st.vorziehen).toBeUndefined()
    st = uebungsSchritt(st, null)
    expect(gezeigt(st).map((s) => s.startNr)).toEqual([vor.startNr, '1'])
    // Den ganzen Lauf durch: jede Nummer 1–20 genau einmal, der vorgezogene nicht noch einmal.
    const gesehen: string[] = []
    for (let i = 0; i < WKR_ANNAHMEN.uebungStarts; i++) {
      gesehen.push(gezeigt(st)[0].startNr)
      st = erledige(st)
      if (gezeigt(st).length === 0) st = uebungsSchritt(st, null)
    }
    expect([...gesehen].sort((a, b) => Number(a) - Number(b))).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 1)))
    expect(uebungsSicht(st).punkt?.id).toBe('lauf:2')
  })

  it('Vorsteg sieht den vorgezogenen schon vorab; eine Zeile für ihn zeigt ihn', () => {
    let st = uebungsStand('dm-2026', 'vorsteg')
    const letzte = klasseDer('vorsteg', 20)
    st = ziehVor(st, letzte)
    const vorab = uebungsSicht(st).schlange.find((s) => s.vorab)!
    expect(vorab.klasse).toBe(letzte)
    st = uebungsSchritt(st, { s: vorab.key })
    expect(st.vorziehen).toBeUndefined()
    expect(uebungsSicht(st).schlange.map((s) => s.key)).not.toContain(vorab.key)
  })

  it('erschöpfter Block: ein erfundener weiterer Start mit neuer Nummer, der sich abschicken lässt', () => {
    let st = uebungsStand('dm-2026', 'tor5', undefined, 0)
    const erste = klasseDer('tor5', 1)
    // Den Block der ersten Klasse ganz durchlaufen.
    for (let i = 0; i < 10; i++) st = erledige(uebungsSchritt(st, null))
    expect(uebungsSicht(st).danach[0].klasse).not.toBe(erste)
    st = uebungsSchritt(ziehVor(st, erste), null)
    const extra = gezeigt(st)[0]
    expect([extra.startNr, extra.klasse]).toEqual([String(WKR_ANNAHMEN.uebungStarts + 1), erste])
    st = uebungsSchritt(st, { s: extra.key }, 0)
    expect(gezeigt(st)).toEqual([])
    st = uebungsSchritt(st, null)
    expect(gezeigt(st)[0].startNr).toBe('11')
    // Ein zweites Mal: die nächste neue Nummer.
    st = uebungsSchritt(ziehVor(erledige(st), erste), null)
    expect(gezeigt(st)[0].startNr).toBe(String(WKR_ANNAHMEN.uebungStarts + 2))
  })

  it('Klasse ohne die Liste: nichts ändert sich; am Tisch bis zur nächsten Zeile', () => {
    const st = uebungsStand('dm-2026', 'tor5')
    expect(ziehVor(st, 'gibtsnicht' as ClassId)).toBe(st)
    let tisch = uebungsStand('dm-2026', 'knoten')
    const sicht = uebungsSicht(tisch)
    const k = sicht.bestand!.at(-1)!.klasse
    tisch = ziehVor(tisch, k)
    expect(tisch.vorziehen).toBe(k)
    tisch = uebungsSchritt(tisch, { s: sicht.bestand![0].key })
    expect(tisch.vorziehen).toBeUndefined()
  })
})
