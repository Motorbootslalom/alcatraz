import { describe, expect, it } from 'vitest'
import {
  auszusondern,
  beschreibe,
  eintragFuer,
  entscheideStart,
  setztFort,
  sortiert,
  vergleiche,
  VERLAUF_DAUER,
  VERLAUF_GRENZEN,
  VERLAUF_PAUSE,
  type Beschreibung,
  type VerlaufEintrag,
} from './verlauf'
import { laufSchluessel } from './eingaben'
import type { ClassId, Starter } from '../types'

// Reine Logik des zweiten Speichers und des Verlaufs. Alle Starter sind erfunden.

const starter = (id: string, klasse: ClassId): Starter => ({ id, startNr: id.toUpperCase(), vorname: 'Test', nachname: id, verein: 'Club', bundesland: 'Land', geburtsdatum: '', klasse, groesse: '' })
const STAND = { starters: [starter('a', '4'), starter('b', '4'), starter('c', '1')] }
const zelle = (id: string, n = 1, feld = 'zeit1') => ({ lauf: laufSchluessel('manoevrieren', n), starter: id, feld, wert: '80' })
let nr = 0
const neueId = () => `e${++nr}`
const eintrag = (teil: Partial<VerlaufEintrag> = {}): VerlaufEintrag => ({ id: neueId(), von: 0, zeit: 0, was: { art: 'einstellung' }, anzahl: 1, groesse: 100, folge: 1, ...teil })

describe('welcher Stand ist neuer', () => {
  it('die höhere Folge-Nummer gewinnt – auch gegen eine spätere Uhrzeit (verstellte Uhr)', () => {
    expect(vergleiche({ folge: 8, zeit: 1000 }, { folge: 7, zeit: 9000 })).toBeGreaterThan(0)
    expect(vergleiche({ folge: 7, zeit: 9000 }, { folge: 8, zeit: 1000 })).toBeLessThan(0)
  })

  it('bei gleicher Folge entscheidet die Zeit; gleich ist gleich; eine fehlende Marke ist älter', () => {
    expect(vergleiche({ folge: 7, zeit: 2 }, { folge: 7, zeit: 1 })).toBeGreaterThan(0)
    expect(vergleiche({ folge: 7, zeit: 1 }, { folge: 7, zeit: 1 })).toBe(0)
    expect(vergleiche({ folge: 1, zeit: 1 }, null)).toBeGreaterThan(0)
    expect(vergleiche(null, { folge: 1, zeit: 1 })).toBeLessThan(0)
    expect(vergleiche(null, null)).toBe(0)
  })

  it('beim Start gilt der neuere Speicher', () => {
    const m = (folge: number) => ({ folge, zeit: folge * 10 })
    expect(entscheideStart({ vorhanden: true, marke: m(5) }, m(7))).toBe('zweit')
    expect(entscheideStart({ vorhanden: true, marke: m(7) }, m(5))).toBe('erster')
    expect(entscheideStart({ vorhanden: true, marke: m(7) }, m(7))).toBe('gleich')
    expect(entscheideStart({ vorhanden: true, marke: m(7) }, null)).toBe('erster')
  })

  it('ein leerer localStorage: Der zweite Speicher gilt, wenn er etwas hat', () => {
    expect(entscheideStart({ vorhanden: false, marke: null }, { folge: 3, zeit: 1 })).toBe('zweit')
    expect(entscheideStart({ vorhanden: false, marke: null }, null)).toBe('gleich')
  })

  it('ein Stand ohne Marke (vor dem zweiten Speicher, ältere Fassung) wird nie stillschweigend ersetzt', () => {
    expect(entscheideStart({ vorhanden: true, marke: null }, { folge: 99, zeit: 1 })).toBe('ohneMarke')
    expect(entscheideStart({ vorhanden: true, marke: null }, null)).toBe('ohneMarke')
  })
})

describe('was sich geändert hat', () => {
  it('eine Eingabe nennt Klasse und Lauf', () => {
    expect(beschreibe({ type: 'SET_EINGABEN', zellen: [zelle('a', 2)] }, STAND)).toEqual({ art: 'eingabe', klasse: '4', lauf: 2 })
  })

  it('ein Bündel über mehrere Klassen oder Läufe nennt nur, was eindeutig ist', () => {
    expect(beschreibe({ type: 'SET_EINGABEN', zellen: [zelle('a', 1), zelle('c', 1)] }, STAND)).toEqual({ art: 'eingabe', lauf: 1 })
    expect(beschreibe({ type: 'SET_EINGABEN', zellen: [zelle('a', 1), zelle('b', 2)] }, STAND)).toEqual({ art: 'eingabe', klasse: '4' })
  })

  it('Listen ohne Lauf (Knoten) nennen keinen', () => {
    expect(beschreibe({ type: 'SET_EINGABEN', zellen: [zelle('a', 0)] }, STAND)).toEqual({ art: 'eingabe', klasse: '4' })
  })

  it('Import und Hinzufügen nennen die Zahl der Starter', () => {
    expect(beschreibe({ type: 'IMPORT_STARTERS', starters: STAND.starters, mode: 'replace' }, STAND)).toEqual({ art: 'import', n: 3 })
    expect(beschreibe({ type: 'ADD_STARTERS', starters: STAND.starters.slice(0, 1) }, STAND)).toEqual({ art: 'starterNeu', n: 1 })
    expect(beschreibe({ type: 'ADD_STARTERS', starters: STAND.starters, beispiel: true }, STAND)).toEqual({ art: 'beispielStarter', n: 3 })
  })

  it('Aufbau, Regelwerk, Zurücksetzen haben ihren Namen; Unbekanntes ist eine Einstellung; die Kennung bekommt keinen Eintrag', () => {
    expect(beschreibe({ type: 'SET_AUFBAU', aufbau: 'x' }, STAND)?.art).toBe('aufbau')
    expect(beschreibe({ type: 'SET_REGELWERK', regelwerk: 'x' }, STAND)?.art).toBe('regelwerk')
    expect(beschreibe({ type: 'RESET_ALL' }, STAND)?.art).toBe('zurueckgesetzt')
    expect(beschreibe({ type: 'SET_WKR_RUECKSEITE', rueckseite: true }, STAND)?.art).toBe('einstellung')
    expect(beschreibe({ type: 'SET_KENNUNG', kennung: 'abc' }, STAND)).toBeNull()
  })
})

describe('Zusammenfassen der Einträge', () => {
  const E: Beschreibung = { art: 'eingabe', klasse: '4', lauf: 2 }
  const stand = { groesse: 500, folge: 9 }

  it('gleichartige Änderungen kurz nacheinander sind EIN Eintrag mit dem jüngsten Stand', () => {
    const erster = eintragFuer(null, [E], { groesse: 400, folge: 8 }, 1000, neueId)!
    const zweiter = eintragFuer(erster, [E], stand, 5000, neueId)!
    expect(zweiter).toEqual({ ...erster, zeit: 5000, anzahl: 2, groesse: 500, folge: 9 })
    expect(zweiter.von).toBe(1000)
  })

  it('eine andere Klasse, ein anderer Lauf oder eine andere Art beginnt einen neuen Eintrag', () => {
    const erster = eintragFuer(null, [E], stand, 1000, neueId)!
    for (const was of [{ ...E, klasse: '1' }, { ...E, lauf: 1 }, { art: 'gewicht' } as Beschreibung]) {
      const naechster = eintragFuer(erster, [was], stand, 2000, neueId)!
      expect(naechster.id).not.toBe(erster.id)
      expect(naechster.anzahl).toBe(1)
    }
  })

  it('nach einer Pause oder nach zehn Minuten endet der Eintrag', () => {
    const erster = eintrag({ was: E, von: 0, zeit: 0 })
    expect(setztFort(erster, E, VERLAUF_PAUSE - 1)).toBe(true)
    expect(setztFort(erster, E, VERLAUF_PAUSE)).toBe(false)
    const lang = eintrag({ was: E, von: 0, zeit: VERLAUF_DAUER - 1000 })
    expect(setztFort(lang, E, VERLAUF_DAUER - 1)).toBe(true)
    expect(setztFort(lang, E, VERLAUF_DAUER)).toBe(false)
  })

  it('Importe, geladene Stände und gemerkte Stände stehen immer für sich', () => {
    const imp: Beschreibung = { art: 'import', n: 12 }
    expect(setztFort(eintrag({ was: imp }), imp, 1)).toBe(false)
    expect(setztFort(eintrag({ was: E, name: 'vor dem Test' }), E, 1)).toBe(false)
  })

  it('mehrere Änderungen in einem Schreibvorgang: gleichartige zählen zusammen, sonst gilt die letzte', () => {
    const erster = eintrag({ was: E, anzahl: 3 })
    expect(eintragFuer(erster, [E, E, null], stand, 10, neueId)).toMatchObject({ id: erster.id, anzahl: 5 })
    const gemischt = eintragFuer(erster, [E, { art: 'gewicht' }, { art: 'gewicht' }], stand, 10, neueId)!
    expect(gemischt.id).not.toBe(erster.id)
    expect(gemischt).toMatchObject({ was: { art: 'gewicht' }, anzahl: 2 })
  })

  it('ohne Beschreibung (Kennung, verworfener Scan) bekommt der letzte Eintrag nur den neuen Stand', () => {
    const erster = eintrag({ was: E, anzahl: 3, zeit: 7 })
    expect(eintragFuer(erster, [null], stand, 99, neueId)).toEqual({ ...erster, ...stand })
    expect(eintragFuer(null, [null], stand, 99, neueId)).toBeNull()
    // Ein gemerkter Stand wird nie fortgeschrieben.
    expect(eintragFuer(eintrag({ name: 'x' }), [null], stand, 99, neueId)).toBeNull()
  })
})

describe('Grenzen des Verlaufs', () => {
  const G = { anzahl: 5, alter: 1000, groesse: 10_000, mindestens: 2 }
  const reihe = (n: number, teil: (i: number) => Partial<VerlaufEintrag> = () => ({})) =>
    Array.from({ length: n }, (_, i) => eintrag({ id: `r${i}`, zeit: 10_000 - i, groesse: 100, ...teil(i) }))

  it('über der Anzahl weichen die ältesten', () => {
    expect(auszusondern(reihe(8), 10_000, G)).toEqual(['r5', 'r6', 'r7'])
  })

  it('benannte Stände zählen nicht mit und bleiben', () => {
    const alle = reihe(8, (i) => (i === 1 || i === 7 ? { name: 'gemerkt' } : {}))
    expect(auszusondern(alle, 10_000, G)).toEqual(['r6'])
  })

  it('zu alte weichen – die jüngsten bleiben trotzdem', () => {
    const alle = reihe(4, (i) => ({ zeit: 100 - i }))
    expect(auszusondern(alle, 100_000, G)).toEqual(['r2', 'r3'])
  })

  it('über der Gesamtgröße weichen die ältesten – die jüngsten bleiben trotzdem', () => {
    const alle = reihe(4, () => ({ groesse: 4000 }))
    expect(auszusondern(alle, 10_000, G)).toEqual(['r2', 'r3'])
    expect(auszusondern(reihe(3, () => ({ groesse: 50_000 })), 10_000, G)).toEqual(['r2'])
  })

  it('die Vorgabe lässt einen gewöhnlichen Verlauf in Ruhe', () => {
    expect(auszusondern(reihe(VERLAUF_GRENZEN.anzahl, () => ({ groesse: 400_000 })), 10_000)).toEqual([])
  })

  it('jüngste zuerst', () => {
    expect(sortiert([eintrag({ id: 'alt', zeit: 1 }), eintrag({ id: 'neu', zeit: 5 }), eintrag({ id: 'mitte', zeit: 3 })]).map((e) => e.id)).toEqual(['neu', 'mitte', 'alt'])
  })
})
