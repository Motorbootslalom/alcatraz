import { describe, expect, it } from 'vitest'
import { emptyState, reducer, streichlaeufeWert, type Action } from './reducer'
import { migrate } from './migrate'
import { makeFile, parseFile } from '../persistenz/backup'
import { laufSchluessel } from '../lib/eingaben'
import type { AppState, ClassId, Starter } from '../types'

// Erfasste Werte im Stand: Actions, Laden alter Stände, Dateien. Alle Starter sind erfunden.

const L1 = laufSchluessel('manoevrieren', 1)
const L2 = laufSchluessel('manoevrieren', 2)
const starter = (id: string, klasse: ClassId = '4'): Starter => ({ id, startNr: id.toUpperCase(), vorname: 'Test', nachname: id, verein: 'Club', bundesland: 'Land', geburtsdatum: '', klasse, groesse: '' })
const mit = (...actions: Action[]): AppState => actions.reduce(reducer, reducer(emptyState(), { type: 'ADD_STARTERS', starters: [starter('a'), starter('b'), starter('c', '1')] }))
const zelle = (starterId: string, feld: string, wert: string, lauf = L1) => ({ lauf, starter: starterId, feld, wert })

describe('reducer: Eingaben', () => {
  it('ein frischer Stand hat keine Eingaben und die Streichläufe nach Regel', () => {
    expect(emptyState().eingaben).toEqual({})
    expect(emptyState().streichlaeufe).toBe('auto')
  })

  it('SET_EINGABEN setzt und löscht Zellen; nichts geändert = derselbe Stand', () => {
    const s = mit({ type: 'SET_EINGABEN', zellen: [zelle('a', 'zeit1', '83,45'), zelle('b', 'disq@vorsteg', 'X')] })
    expect(s.eingaben).toEqual({ [L1]: { a: { zeit1: '83,45' }, b: { 'disq@vorsteg': 'X' } } })
    expect(reducer(s, { type: 'SET_EINGABEN', zellen: [zelle('a', 'zeit1', '83,45')] })).toBe(s)
    expect(reducer(s, { type: 'SET_EINGABEN', zellen: [zelle('a', 'zeit1', ''), zelle('b', 'disq@vorsteg', '')] }).eingaben).toEqual({})
  })

  it('ist deterministisch und lässt den alten Stand unberührt', () => {
    const vorher = mit()
    const action: Action = { type: 'SET_EINGABEN', zellen: [zelle('a', 'zeit1', '80')] }
    expect(reducer(vorher, action)).toEqual(reducer(vorher, action))
    expect(vorher.eingaben).toEqual({})
  })

  it('zusammenführbar: Bündel zweier Geräte ergeben in jeder Reihenfolge dasselbe', () => {
    const steg: Action = { type: 'SET_EINGABEN', zellen: [zelle('a', 'katalog:stegAnlegen', '9'), zelle('b', 'erfasst@steg', '1')] }
    const zeit: Action = { type: 'SET_EINGABEN', zellen: [zelle('a', 'zeit1', '80'), zelle('b', 'zeit1', '81')] }
    expect(mit(steg, zeit).eingaben).toEqual(mit(zeit, steg).eingaben)
  })

  it('CLEAR_EINGABEN verwirft alles', () => {
    const s = mit({ type: 'SET_EINGABEN', zellen: [zelle('a', 'zeit1', '80'), zelle('a', 'zeit1', '81', L2)] })
    expect(reducer(s, { type: 'CLEAR_EINGABEN' }).eingaben).toEqual({})
    expect(reducer(mit(), { type: 'CLEAR_EINGABEN' })).toEqual(mit())
  })

  it('SET_EINGABEN nimmt nur Zellen bekannter Starter und brauchbarer Lauf-Schlüssel an – wie migrate beim Laden', () => {
    // Etwa ein Bündel von einem Gerät, das eintrifft, nachdem der Starter gelöscht wurde.
    const vorher = mit()
    const s = reducer(vorher, { type: 'SET_EINGABEN', zellen: [zelle('gibtsnicht', 'zeit1', '80'), zelle('a', 'zeit1', '80', 'quatsch'), zelle('__proto__', 'verseucht', 'ja')] })
    expect(s).toBe(vorher)
    expect(({} as Record<string, unknown>).verseucht).toBeUndefined()
    // Der Stand im Speicher ist derselbe wie nach dem Neuladen.
    const gemischt = reducer(vorher, { type: 'SET_EINGABEN', zellen: [zelle('gibtsnicht', 'zeit1', '80'), zelle('a', 'zeit1', '81')] })
    expect(gemischt.eingaben).toEqual({ [L1]: { a: { zeit1: '81' } } })
    expect(migrate(JSON.parse(JSON.stringify(gemischt)))!.eingaben).toEqual(gemischt.eingaben)
  })

  it('mit einem Starter gehen seine Eingaben – beim Löschen, Leeren der Klasse und Ersetzen der Liste', () => {
    const s = mit({ type: 'SET_EINGABEN', zellen: [zelle('a', 'zeit1', '80'), zelle('b', 'zeit1', '81'), zelle('c', 'zeit1', '82')] })
    expect(Object.keys(reducer(s, { type: 'REMOVE_STARTER', id: 'a' }).eingaben[L1])).toEqual(['b', 'c'])
    expect(Object.keys(reducer(s, { type: 'CLEAR_CLASS', klasse: '4' }).eingaben[L1])).toEqual(['c'])
    expect(reducer(s, { type: 'CLEAR_ALL_STARTERS' }).eingaben).toEqual({})
    // Ersetzen: Wiedererkannte Starter behalten ID und Werte, die übrigen verlieren sie.
    const ersetzt = reducer(s, { type: 'IMPORT_STARTERS', mode: 'replace', starters: [{ ...starter('neu'), nachname: 'a' }] })
    expect(ersetzt.starters.map((p) => p.id)).toEqual(['a'])
    expect(ersetzt.eingaben).toEqual({ [L1]: { a: { zeit1: '80' } } })
  })

  it('Umnummerieren und Klassenwechsel lassen die Eingaben stehen (sie hängen an der ID)', () => {
    const s = mit({ type: 'SET_EINGABEN', zellen: [zelle('a', 'zeit1', '80')] })
    const danach = reducer(reducer(s, { type: 'UPDATE_STARTER', id: 'a', patch: { startNr: '999', klasse: '5' } }), { type: 'ASSIGN_START_NUMBERS' })
    expect(danach.eingaben).toBe(s.eingaben)
  })

  it('SET_STREICHLAEUFE: Regel oder eine ganze Zahl', () => {
    expect(mit({ type: 'SET_STREICHLAEUFE', streichlaeufe: 1 }).streichlaeufe).toBe(1)
    expect(mit({ type: 'SET_STREICHLAEUFE', streichlaeufe: 0 }).streichlaeufe).toBe(0)
    expect(mit({ type: 'SET_STREICHLAEUFE', streichlaeufe: 1 }, { type: 'SET_STREICHLAEUFE', streichlaeufe: 'auto' }).streichlaeufe).toBe('auto')
    expect(streichlaeufeWert(2.4)).toBe(2)
    expect(streichlaeufeWert(-3)).toBe(0)
    expect(streichlaeufeWert('zwei')).toBe('auto')
    expect(streichlaeufeWert(Number.NaN)).toBe('auto')
  })

  it('FILL_BEISPIELWERTE: Der Zufall kommt mit der Action – gleiche Saat, gleicher Stand', () => {
    const action: Action = { type: 'FILL_BEISPIELWERTE', zeitnahme: 'stoppuhr', saat: 12345 }
    const a = mit(action)
    expect(mit(action)).toEqual(a)
    expect(mit({ ...action, saat: 54321 }).eingaben).not.toEqual(a.eingaben)
    expect(Object.keys(a.eingaben).sort()).toEqual([L1, L2, laufSchluessel('manoevrieren', 3)])
    expect(Object.keys(a.eingaben[L1]).sort()).toEqual(['a', 'b', 'c'])
    // Nur die genannten Läufe.
    expect(Object.keys(mit({ ...action, laeufe: [2] }).eingaben)).toEqual([L2])
  })
})

describe('migrate: Eingaben', () => {
  it('ein Stand von vor der Erfassung bekommt leere Eingaben und die Regel', () => {
    const { eingaben: _e, streichlaeufe: _s, ...alt } = mit()
    const neu = migrate(JSON.parse(JSON.stringify(alt)))!
    expect(neu.eingaben).toEqual({})
    expect(neu.streichlaeufe).toBe('auto')
  })

  it('behält brauchbare Eingaben, verwirft Kaputtes und Werte unbekannter Starter', () => {
    const roh = { ...mit(), streichlaeufe: 1, eingaben: { [L1]: { a: { zeit1: '80', zahl: 3 }, fremd: { zeit1: '70' } }, unsinn: 5 } }
    const neu = migrate(JSON.parse(JSON.stringify(roh)))!
    expect(neu.eingaben).toEqual({ [L1]: { a: { zeit1: '80' } } })
    expect(neu.streichlaeufe).toBe(1)
    expect(migrate({ ...mit(), streichlaeufe: 'viele' })!.streichlaeufe).toBe('auto')
  })
})

describe('migrate: präparierte Datei', () => {
  it('ein Schlüssel __proto__ in den Eingaben verändert Object.prototype nicht', () => {
    const roh = JSON.parse(JSON.stringify(mit()))
    roh.eingaben = JSON.parse('{"manoevrieren/1": {"__proto__": {"verseucht": "ja"}, "a": {"zeit1": "80"}}}')
    expect(migrate(roh)!.eingaben).toEqual({ [L1]: { a: { zeit1: '80' } } })
    expect(({} as Record<string, unknown>).verseucht).toBeUndefined()
  })
})

describe('Dateien: Eingaben', () => {
  const voll = () => mit({ type: 'SET_EINGABEN', zellen: [zelle('a', 'zeit1', '80'), zelle('b', 'disq@steg', 'X')] }, { type: 'SET_STREICHLAEUFE', streichlaeufe: 1 })
  const hinUndHer = (kind: 'sicherung' | 'vorlage' | 'starter', s: AppState) => parseFile(JSON.stringify(makeFile(kind, s, '2026-11-13T08:00:00.000Z')))

  it('Sicherung: Eingaben und Streichläufe kommen zurück', () => {
    const r = hinUndHer('sicherung', voll())
    if (!r.ok || r.kind !== 'sicherung') throw new Error('keine Sicherung')
    expect(r.state.eingaben).toEqual(voll().eingaben)
    expect(r.state.streichlaeufe).toBe(1)
  })

  it('Vorlage: enthält keine Eingaben; die Streichläufe sind eine Einstellung und reisen mit', () => {
    const datei = makeFile('vorlage', voll(), '2026-11-13T08:00:00.000Z')
    expect(JSON.stringify(datei)).not.toContain('eingaben')
    expect(JSON.stringify(datei)).not.toContain('disq@steg')
    const r = hinUndHer('vorlage', voll())
    if (!r.ok || r.kind !== 'vorlage') throw new Error('keine Vorlage')
    // Auf eine laufende Veranstaltung angewandt: Deren Eingaben bleiben.
    const ziel = mit({ type: 'SET_EINGABEN', zellen: [zelle('c', 'zeit1', '77')] })
    const danach = r.apply(ziel)
    expect(danach.eingaben).toEqual(ziel.eingaben)
    expect(danach.streichlaeufe).toBe(1)
  })

  it('Teilnehmerdaten: nur die Starter', () => {
    expect(JSON.stringify(makeFile('starter', voll(), '2026-11-13T08:00:00.000Z'))).not.toContain('zeit1')
  })
})
