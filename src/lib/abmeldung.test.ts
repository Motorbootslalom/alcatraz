import { describe, expect, it } from 'vitest'
import { emptyState, reducer, type Action } from '../state/reducer'
import { migrate } from '../state/migrate'
import { makeFile, parseFile } from '../persistenz/backup'
import { configFor } from '../config/konfig'
import { felderJeKennung, laufSchluessel } from './eingaben'
import { abmeldePlan, abmeldeZiel, normalisiereAbgemeldet } from './abmeldung'
import { nichtGestartet } from './erfassung'
import { beschreibe } from './verlauf'
import { klassenErgebnis } from './ergebnis'
import type { AppState, ClassId, Starter } from '../types'

// Abmelden nach Beginn des Wettkampfs: X „Nicht gestartet“ in jedem Lauf. Alle Starter sind erfunden.

const L = (lauf: number, disziplin = 'manoevrieren') => laufSchluessel(disziplin, lauf)
const starter = (id: string, klasse: ClassId = '4'): Starter => ({ id, startNr: id.toUpperCase(), vorname: 'Test', nachname: id, verein: 'Club', bundesland: 'Land', geburtsdatum: '', klasse, groesse: '' })
const zeit = (id: string, lauf: number, wert = '80'): Action => ({ type: 'SET_EINGABEN', zellen: [{ lauf: L(lauf), starter: id, feld: 'zeit1', wert }] })
const mit = (...actions: Action[]): AppState => actions.reduce(reducer, reducer(emptyState(), { type: 'ADD_STARTERS', starters: [starter('a'), starter('b'), starter('c', '1')] }))
const konfig = (s: AppState) => configFor({ regelwerk: s.regelwerk, eigeneAufbauten: s.eigeneAufbauten })
const X = { 'disq@steg': 'X' }

describe('abmeldeZiel', () => {
  it('ist die Spalte „Disq.“ am Steg – auch wenn der Vorsteg davor steht', () => {
    const s = mit()
    expect(abmeldeZiel(konfig(s), s, '4')).toMatchObject({ liste: 'steg', kennung: 'disq@steg', label: 'Disq.' })
  })
})

describe('abmeldePlan', () => {
  it('trennt freie Läufe, solche mit X und solche mit anderen Werten', () => {
    const s = mit(zeit('b', 1), zeit('a', 1), { type: 'SET_EINGABEN', zellen: [{ lauf: L(2), starter: 'a', feld: 'disq@steg', wert: 'X' }] })
    expect(abmeldePlan(s, konfig(s), s.starters[0])).toMatchObject({ frei: [3], schonX: [2], belegt: [1] })
  })

  it('auch ein bloßer Haken „erfasst“ oder eine Bemerkung gilt als Wert: nichts wird überschrieben', () => {
    const s = mit({ type: 'SET_EINGABEN', zellen: [{ lauf: L(1), starter: 'a', feld: 'erfasst@gate135', wert: '1' }] })
    expect(abmeldePlan(s, konfig(s), s.starters[0])).toMatchObject({ frei: [2, 3], belegt: [1] })
  })
})

describe('reducer: ABMELDEN_STARTER / ANMELDEN_STARTER', () => {
  it('vor dem ersten Ergebnis ändert das Abmelden nichts – dann wird einfach entfernt', () => {
    const s = mit()
    expect(reducer(s, { type: 'ABMELDEN_STARTER', id: 'a' })).toBe(s)
  })

  it('trägt das X in JEDEM Lauf ein, auch in den noch kommenden; der Starter bleibt im Feld', () => {
    const s = mit(zeit('b', 1), { type: 'ABMELDEN_STARTER', id: 'a' })
    expect(s.abgemeldet).toEqual(['a'])
    expect(s.starters.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(s.eingaben).toEqual({ [L(1)]: { b: { zeit1: '80' }, a: X }, [L(2)]: { a: X }, [L(3)]: { a: X } })
    // Ein zweites Mal ändert nichts.
    expect(reducer(s, { type: 'ABMELDEN_STARTER', id: 'a' })).toBe(s)
    expect(reducer(s, { type: 'ABMELDEN_STARTER', id: 'gibt-es-nicht' })).toBe(s)
  })

  it('überschreibt und löscht nichts: Ein gefahrener Lauf bleibt, wie er ist', () => {
    const vorher = mit(zeit('a', 1, '83,45'))
    const s = reducer(vorher, { type: 'ABMELDEN_STARTER', id: 'a' })
    expect(s.eingaben[L(1)]).toBe(vorher.eingaben[L(1)])
    expect(s.eingaben[L(2)]).toEqual({ a: X })
    expect(s.eingaben[L(3)]).toEqual({ a: X })
  })

  it('wird die Zahl der Läufe erhöht, bekommt der Abgemeldete das X auch dort – niemand sonst', () => {
    const s = mit({ type: 'SET_EVENT', patch: { laufCount: 2 } }, zeit('b', 1), { type: 'ABMELDEN_STARTER', id: 'a' })
    expect(Object.keys(s.eingaben).sort()).toEqual([L(1), L(2)])
    const mehr = reducer(s, { type: 'SET_EVENT', patch: { laufCount: 4 } })
    expect(mehr.eingaben[L(3)]).toEqual({ a: X })
    expect(mehr.eingaben[L(4)]).toEqual({ a: X })
  })

  it('ein von Hand entferntes X (er fährt doch) kommt bei späteren Einstellungen nicht zurück', () => {
    let s = mit({ type: 'SET_EVENT', patch: { laufCount: 2 } }, zeit('b', 1), { type: 'ABMELDEN_STARTER', id: 'a' })
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: L(2), starter: 'a', feld: 'disq@steg', wert: '' }] })
    expect(s.eingaben[L(2)]).toBeUndefined()
    s = reducer(s, { type: 'SET_EVENT', patch: { laufCount: 3 } })
    expect(s.eingaben[L(2)]).toBeUndefined()
    expect(s.eingaben[L(3)]).toEqual({ a: X })
    // Weniger Läufe und andere Einstellungen ändern an den Werten nichts.
    const weniger = reducer(s, { type: 'SET_EVENT', patch: { laufCount: 1 } })
    expect(weniger.eingaben).toBe(s.eingaben)
    expect(reducer(s, { type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } }).eingaben).toBe(s.eingaben)
  })

  it('Zurücknehmen entfernt das X überall, wo sonst nichts steht – und nur dort', () => {
    let s = mit(zeit('a', 1), { type: 'ABMELDEN_STARTER', id: 'a' })
    // In Lauf 3 kam eine Bemerkung dazu: Der Lauf bleibt, wie er ist.
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: L(3), starter: 'a', feld: 'bemerkung@steg', wert: 'krank' }] })
    const zurueck = reducer(s, { type: 'ANMELDEN_STARTER', id: 'a' })
    expect(zurueck.abgemeldet).toEqual([])
    expect(zurueck.eingaben).toEqual({ [L(1)]: { a: { zeit1: '80' } }, [L(3)]: { a: { 'disq@steg': 'X', 'bemerkung@steg': 'krank' } } })
    expect(reducer(zurueck, { type: 'ANMELDEN_STARTER', id: 'a' })).toBe(zurueck)
    // Danach bekommt ein neuer Lauf kein X mehr.
    expect(reducer(zurueck, { type: 'SET_EVENT', patch: { laufCount: 4 } }).eingaben[L(4)]).toBeUndefined()
  })

  it('Zurücknehmen entfernt auch das X eines Laufs, den gerade keine Ansicht zeigt', () => {
    let s = mit(zeit('b', 1), { type: 'ABMELDEN_STARTER', id: 'a' }, { type: 'SET_EVENT', patch: { laufCount: 1 } })
    expect(s.eingaben[L(3)]).toEqual({ a: X })
    s = reducer(s, { type: 'ANMELDEN_STARTER', id: 'a' })
    expect(s.eingaben).toEqual({ [L(1)]: { b: { zeit1: '80' } } })
  })

  it('„Alle erfassten Werte löschen“ nimmt die Abmeldungen mit; danach lässt sich der Starter entfernen', () => {
    let s = mit(zeit('b', 1), { type: 'ABMELDEN_STARTER', id: 'a' })
    s = reducer(s, { type: 'CLEAR_EINGABEN' })
    expect(s).toMatchObject({ eingaben: {}, abgemeldet: [] })
    expect(reducer(s, { type: 'REMOVE_STARTER', id: 'a' }).starters.map((p) => p.id)).toEqual(['b', 'c'])
  })

  it('setzt den Zeitpunkt der Listen der Klasse wie eine Eingabe', () => {
    const vorher = reducer(mit(), { ...zeit('b', 1), zeit: 1000 })
    const s = reducer(vorher, { type: 'ABMELDEN_STARTER', id: 'a', zeit: 5000 })
    expect(JSON.stringify(s.listenStand)).toContain('5000')
    expect(JSON.stringify(vorher.listenStand)).not.toContain('5000')
  })

  it('heißt im Verlauf, was es ist', () => {
    const s = mit()
    expect(beschreibe({ type: 'ABMELDEN_STARTER', id: 'a' }, s)).toEqual({ art: 'starterAbgemeldet' })
    expect(beschreibe({ type: 'ANMELDEN_STARTER', id: 'a' }, s)).toEqual({ art: 'starterAngemeldet' })
  })
})

describe('neue Läufe: Das X kommt je Starter in jeden Lauf nur einmal', () => {
  const laeufe = (n: number): Action => ({ type: 'SET_EVENT', patch: { laufCount: n } })
  const ohneX = (lauf: number): Action => ({ type: 'SET_EINGABEN', zellen: [{ lauf: L(lauf), starter: 'a', feld: 'disq@steg', wert: '' }] })

  it('ein von Hand entferntes X kommt nicht zurück, wenn die Zahl der Läufe gesenkt und wieder erhöht wird', () => {
    let s = mit(zeit('b', 1), { type: 'ABMELDEN_STARTER', id: 'a' }, ohneX(2))
    expect(s.abgemeldetBis).toEqual({ a: 3 })
    s = [laeufe(1), laeufe(2), laeufe(3)].reduce(reducer, s)
    expect(s.eingaben[L(2)]).toBeUndefined()
    expect(s.eingaben[L(3)]).toEqual({ a: X })
    // Ein wirklich neuer Lauf bekommt das X.
    s = reducer(s, laeufe(4))
    expect(s.eingaben[L(4)]).toEqual({ a: X })
    expect(s.abgemeldetBis).toEqual({ a: 4 })
  })

  it('wer bei gesenkter Zahl abgemeldet wird, bekommt das X in den Läufen darüber, sobald es sie wieder gibt', () => {
    let s = mit(zeit('b', 1), laeufe(1), { type: 'ABMELDEN_STARTER', id: 'a' })
    expect(s.abgemeldetBis).toEqual({ a: 1 })
    s = reducer(s, laeufe(3))
    expect([1, 2, 3].map((l) => s.eingaben[L(l)]?.a)).toEqual([X, X, X])
  })

  it('eine Vorlage mit mehr Läufen: Der Abgemeldete bekommt das X auch im neuen Lauf', () => {
    const s = mit(zeit('b', 1), { type: 'ABMELDEN_STARTER', id: 'a' })
    const vorlage = parseFile(JSON.stringify(makeFile('vorlage', { ...s, laufCount: 4 }, 'x')))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const neu = reducer(s, { type: 'LOAD_STATE', state: vorlage.apply(s) })
    expect(neu.laufCount).toBe(4)
    expect(neu.eingaben[L(4)]).toEqual({ a: X })
    expect(neu.abgemeldetBis).toEqual({ a: 4 })
  })

  it('Zurücknehmen und „Alle erfassten Werte löschen“ nehmen die Angabe mit; migrate verträgt Fehlendes und Müll', () => {
    const s = mit(zeit('b', 1), { type: 'ABMELDEN_STARTER', id: 'a' })
    expect(reducer(s, { type: 'ANMELDEN_STARTER', id: 'a' }).abgemeldetBis).toEqual({})
    const { abgemeldetBis: _weg, ...alt } = s
    expect(migrate(alt)!.abgemeldetBis).toEqual({})
    expect(migrate({ ...s, abgemeldetBis: { a: 2, b: 3, weg: 1 } })!.abgemeldetBis).toEqual({ a: 2 })
    expect(migrate({ ...s, abgemeldetBis: { a: 'x' } })!.abgemeldetBis).toEqual({})
    expect(JSON.stringify(makeFile('vorlage', s, 'x'))).not.toContain('abgemeldetBis')
  })
})

describe('Wertung und Erfassung', () => {
  it('der Abgemeldete ist in jedem Lauf „nicht gestartet“ und steht in der Gesamtliste hinten – nicht bei den Offenen', () => {
    let s = mit(zeit('b', 1), { type: 'ABMELDEN_STARTER', id: 'a' })
    // Das X allein beginnt keine Lauf-Liste: Die kommenden Läufe haben noch keine Wertungsliste.
    expect(klassenErgebnis(s, konfig(s), '4')!.laeufe.map((l) => l.lauf)).toEqual([1])
    s = reducer(reducer(s, zeit('b', 2)), zeit('b', 3))
    const klasse = klassenErgebnis(s, konfig(s), '4')!
    expect(klasse.laeufe.map((l) => l.nachNummer.find((z) => z.starter.id === 'a')!.nichtGestartet)).toEqual([true, true, true])
    const zeile = klasse.gesamt.nachNummer.find((z) => z.starter.id === 'a')!
    expect(zeile).toMatchObject({ disq: true, offen: false })
    expect(klasse.gesamt.nachPlatz.at(-1)!.starter.id).toBe('a')
  })

  it('schraffiert wird, wo im Lauf ein X steht – gleich in welcher Zelle und von wem', () => {
    const s = mit()
    const felder = felderJeKennung(konfig(s), '4')
    expect(nichtGestartet({}, felder)).toBe(false)
    expect(nichtGestartet({ zeit1: '80' }, felder)).toBe(false)
    expect(nichtGestartet({ 'disq@steg': 'A' }, felder)).toBe(false)
    expect(nichtGestartet({ 'disq@steg': 'X' }, felder)).toBe(true)
    expect(nichtGestartet({ 'disq@vorsteg': 'x' }, felder)).toBe(true)
    expect(nichtGestartet({ 'disq@steg': 'A, X' }, felder)).toBe(true)
  })
})

describe('Laden und Dateien', () => {
  it('Stände vor dem Abmelden haben keine Abmeldungen; unbekannte und doppelte IDs entfallen', () => {
    const s = mit()
    const { abgemeldet: _weg, ...alt } = s
    expect(migrate(alt)!.abgemeldet).toEqual([])
    expect(migrate({ ...s, abgemeldet: ['a', 'weg', 'a', 7] })!.abgemeldet).toEqual(['a'])
    expect(normalisiereAbgemeldet('a', new Set(['a']))).toEqual([])
  })

  it('die Sicherung enthält die Abmeldungen, Vorlage und Teilnehmerdaten nicht', () => {
    const s = mit(zeit('b', 1), { type: 'ABMELDEN_STARTER', id: 'a' })
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', s, 'x')))
    expect(sicherung.ok && sicherung.kind === 'sicherung' && sicherung.state.abgemeldet).toEqual(['a'])
    expect(JSON.stringify(makeFile('vorlage', s, 'x'))).not.toContain('abgemeldet')
    expect(JSON.stringify(makeFile('starter', s, 'x'))).not.toContain('abgemeldet')
    // Eine Vorlage lässt die hiesigen Abmeldungen stehen – sie gehören zu den erfassten Werten.
    const vorlage = parseFile(JSON.stringify(makeFile('vorlage', mit(), 'x')))
    expect(vorlage.ok && vorlage.kind === 'vorlage' && vorlage.apply(s).abgemeldet).toEqual(['a'])
  })

  it('mit dem Starter geht seine Abmeldung (geladener Stand ohne ihn)', () => {
    const s = mit(zeit('b', 1), { type: 'ABMELDEN_STARTER', id: 'a' })
    expect(migrate({ ...s, starters: s.starters.filter((p) => p.id !== 'a') })!.abgemeldet).toEqual([])
  })
})
