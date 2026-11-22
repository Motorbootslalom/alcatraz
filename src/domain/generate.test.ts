import { describe, it, expect } from 'vitest'
import { BEISPIEL_KLASSEN_ANTEILE, BEISPIEL_STARTERZAHL, beispielFeldArt, beispielGesamt, beispielHerkuenfte, beispielHerkunft, generateStarter, generateStarters, LAENDER, verteileAufKlassen } from './generate'
import { zufallAus } from '../lib/beispielwerte'
import { birthYearRange } from './classes'
import { CLUBS } from '../data/clubs'
import type { ClassId } from '../types'

const ALL: ClassId[] = ['E', '1', '2', '3', '4', '5', '6', '7']

describe('generateStarters', () => {
  it('erzeugt die gewünschte Anzahl', () => {
    const list = generateStarters('3', 12, 2026, 'verein', [])
    expect(list).toHaveLength(12)
  })

  it('Geburtsjahr liegt immer im Jahrgangsbereich der Klasse', () => {
    for (const klasse of ALL) {
      const [von, bis] = birthYearRange(klasse, 2026)
      const list = generateStarters(klasse, 40, 2026, 'verein', [])
      for (const p of list) {
        const jahr = Number(p.geburtsdatum.slice(0, 4))
        expect(jahr).toBeGreaterThanOrEqual(von)
        expect(jahr).toBeLessThanOrEqual(bis)
      }
    }
  })

  it('erzeugt gültige ISO-Datumswerte (kein 31.02.)', () => {
    const list = generateStarters('5', 60, 2026, 'verein', [])
    for (const p of list) {
      expect(p.geburtsdatum).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const [y, m, d] = p.geburtsdatum.split('-').map(Number)
      const dt = new Date(y, m - 1, d)
      expect(dt.getFullYear()).toBe(y)
      expect(dt.getMonth()).toBe(m - 1)
      expect(dt.getDate()).toBe(d)
    }
  })

  it('Startnummern haben Klassen-Präfix und laufen fortlaufend hoch', () => {
    const list = generateStarters('3', 5, 2026, 'verein', [])
    expect(list.map((p) => p.startNr)).toEqual(['301', '302', '303', '304', '305'])
  })

  it('Klasse E nutzt E-Präfix', () => {
    const list = generateStarters('E', 3, 2026, 'verein', [])
    expect(list.map((p) => p.startNr)).toEqual(['E01', 'E02', 'E03'])
  })

  it('setzt Startnummern auf Basis bereits vorhandener Teilnehmer fort', () => {
    const first = generateStarters('2', 3, 2026, 'verein', [])
    const second = generateStarters('2', 2, 2026, 'verein', first)
    expect(second.map((p) => p.startNr)).toEqual(['204', '205'])
  })

  it('Vereins-Modus: Verein gesetzt und passendes Bundesland', () => {
    const p = generateStarter('4', 2026, 'verein', [])
    expect(p.verein).not.toBe('')
    const club = CLUBS.find((c) => c.name === p.verein)
    expect(club).toBeDefined()
    expect(p.bundesland).toBe(club!.bundesland)
  })

  it('Bundesland-Modus: kein Verein, aber Bundesland', () => {
    const p = generateStarter('4', 2026, 'bundesland', [])
    expect(p.verein).toBe('')
    expect(p.bundesland).not.toBe('')
  })

  it('Land-Modus: nur der Staat; ohne Herkunft: gar keine (Entscheidung des Nutzers vom 15.11.2026)', () => {
    const land = generateStarter('4', 2026, 'land', [])
    expect([land.verein, land.bundesland, LAENDER.includes(land.land ?? '')]).toEqual(['', '', true])
    const ohne = generateStarter('4', 2026, 'none', [])
    expect([ohne.verein, ohne.bundesland, ohne.land]).toEqual(['', '', undefined])
    // Ohne Herkunft gibt es nichts zu verteilen – auch nicht mit begrenzter Zahl.
    expect(beispielHerkuenfte('none', 3)).toEqual([])
    expect(generateStarters('4', 3, 2026, 'none', [], undefined, beispielHerkuenfte('none', 3)).every((p) => p.verein === '' && p.bundesland === '' && p.land === undefined)).toBe(true)
  })

  it('vergibt eindeutige IDs', () => {
    const list = generateStarters('6', 30, 2026, 'verein', [])
    const ids = new Set(list.map((p) => p.id))
    expect(ids.size).toBe(list.length)
  })
})

describe('Klasse Dolphin mit umgestelltem Buchstaben (E oder D)', () => {
  it('zählt nach dem Umstellen bei der höchsten Nummer weiter – E und D gelten beide', () => {
    const e = generateStarters('E', 2, 2026, 'verein', [])
    expect(generateStarters('E', 2, 2026, 'verein', e, { E: 'D' }).map((p) => p.startNr)).toEqual(['D03', 'D04'])
  })
})

describe('Geschlecht der Beispielstarter', () => {
  it('nur unter einem Regelwerk mit der Liste nach Regel 960, Pkt. 3.7 – unter der DM ohne', () => {
    expect(generateStarters('3', 4, 2026, 'verein', []).every((p) => p.geschlecht === 'M' || p.geschlecht === 'F')).toBe(true)
    expect(generateStarters('3', 4, 2026, 'verein', [], undefined, undefined, false).some((p) => 'geschlecht' in p)).toBe(false)
  })
})

// Wunsch des Nutzers vom 21.11.2026: Gesamtzahl nach Art der Veranstaltung, Verteilung wie in echten Feldern.
describe('Beispiel-Starterfeld: Gesamtzahl und Verteilung', () => {
  it('die Anteile summieren sich zu 100 %; E wenig, 5 am meisten, 6 weniger als 4, 5 und 7', () => {
    const a = BEISPIEL_KLASSEN_ANTEILE
    expect(Object.values(a).reduce((x, y) => x + y, 0)).toBe(100)
    expect(Math.min(...Object.values(a))).toBe(a.E)
    expect(Math.max(...Object.values(a))).toBe(a['5'])
    expect(a['6']).toBeLessThan(Math.min(a['4'], a['5'], a['7']))
  })

  it('Art: Clubmeisterschaft geht vor, Bundesland und Land zusammen, sonst Vereine', () => {
    expect(beispielFeldArt('club', 'verein')).toBe('club')
    expect(beispielFeldArt('club', 'land')).toBe('club')
    expect(beispielFeldArt('meisterschaft', 'verein')).toBe('verein')
    expect(beispielFeldArt('meisterschaft', 'none')).toBe('verein')
    expect(beispielFeldArt('meisterschaft', 'bundesland')).toBe('land')
    expect(beispielFeldArt('meisterschaft', 'land')).toBe('land')
  })

  // R6-01 (Nutzer 21.11.2026): „Clubmeisterschaft ist eine Meisterschaft ohne Vereine“ – BS1, noch zu bestätigen.
  it('Herkunft der Beispielstarter: bei der Clubmeisterschaft keine, sonst die der Veranstaltung', () => {
    expect(beispielHerkunft('club', 'verein')).toBe('none')
    expect(beispielHerkunft('club', 'land')).toBe('none')
    expect(beispielHerkunft('meisterschaft', 'verein')).toBe('verein')
    expect(beispielHerkunft('meisterschaft', 'bundesland')).toBe('bundesland')
    expect(beispielHerkunft('meisterschaft', 'none')).toBe('none')
  })

  it('die gezogene Zahl liegt im Bereich und hängt nur an der Saat', () => {
    for (const art of ['club', 'verein', 'land'] as const) {
      const [von, bis] = BEISPIEL_STARTERZAHL[art]
      const gesehen = new Set<number>()
      for (let saat = 0; saat < 400; saat++) {
        const n = beispielGesamt(art, zufallAus(saat))
        expect(n).toBeGreaterThanOrEqual(von)
        expect(n).toBeLessThanOrEqual(bis)
        gesehen.add(n)
      }
      expect(gesehen.has(von) && gesehen.has(bis)).toBe(true)
      expect(beispielGesamt(art, zufallAus(7))).toBe(beispielGesamt(art, zufallAus(7)))
    }
    expect(beispielGesamt('club', () => 0.9999999)).toBe(20)
  })

  it('größte Reste: die Summe stimmt immer, kleine Felder dürfen E = 0 haben', () => {
    for (let n = 0; n <= 200; n++) {
      const v = verteileAufKlassen(n, ALL)
      expect(Object.values(v).reduce((a, b) => a + b, 0)).toBe(n)
    }
    expect(verteileAufKlassen(12, ALL)).toEqual({ E: 0, 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 2 })
    expect(verteileAufKlassen(100, ALL)).toEqual({ E: 4, 1: 9, 2: 13, 3: 15, 4: 15, 5: 18, 6: 11, 7: 15 })
    // UIM (E–5): neu gewichtet, Summe stimmt.
    const uim = verteileAufKlassen(60, ['E', '1', '2', '3', '4', '5'])
    expect(Object.keys(uim)).toHaveLength(6)
    expect(Object.values(uim).reduce((a, b) => a + b, 0)).toBe(60)
    expect(uim['5']).toBe(Math.max(...Object.values(uim)))
    expect(verteileAufKlassen(10, [])).toEqual({})
  })
})
