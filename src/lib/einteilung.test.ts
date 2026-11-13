import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { makeFile, parseFile } from '../persistenz/backup'
import { migrate } from '../state/migrate'
import { emptyState, reducer, type Action } from '../state/reducer'
import type { AppState } from '../types'
import { einteilungsListen, haengeUm, listeGilt, normalisiereEinteilung, parcoursVon, setzeName, wkrName } from './einteilung'

// Erfundene Namen – keine echten Personen.
const name = (parcoursId: string, typeId: string, n: string): Action => ({ type: 'SET_WKR_NAME', parcoursId, typeId, name: n })
const mit = (state: AppState, ...actions: Action[]) => actions.reduce(reducer, state)
const konfig = configFor()

/** Steg: Muster auf Parcours 1 (E–3), Beispiel auf Parcours 2 (4–7). */
const zwei = () => mit(emptyState(), name('par_1', 'steg', 'Muster'), name('par_2', 'steg', 'Beispiel'), name('par_2', 'mueb', 'Probe'))

describe('WKR-Einteilung: wkrName', () => {
  it('ein Parcours: ein Name je Liste für alle Klassen', () => {
    const state = mit(
      emptyState(),
      { type: 'SET_PARCOURS_PRESET', parcours: [{ id: 'par_1', classIds: ['E', '1', '2', '3', '4', '5', '6', '7'] }] },
      name('par_1', 'steg', 'Muster'),
    )
    expect(wkrName(state, 'steg', 'E')).toBe('Muster')
    expect(wkrName(state, 'steg', '7')).toBe('Muster')
    expect(wkrName(state, 'zeit', '3')).toBe('')
  })

  it('mehrere Parcours: der Name folgt aus der Klasse', () => {
    const state = zwei()
    expect(wkrName(state, 'steg', '3')).toBe('Muster')
    expect(wkrName(state, 'steg', '4')).toBe('Beispiel')
    // Ein dritter Parcours bekommt Klasse 7 und eigene Namen.
    const drei = mit(
      state,
      { type: 'SET_PARCOURS_CLASSES', id: 'par_2', classIds: ['4', '5', '6'] },
      { type: 'ADD_PARCOURS', id: 'par_x' },
      { type: 'SET_PARCOURS_CLASSES', id: 'par_x', classIds: ['7'] },
      name('par_x', 'steg', 'Dritte'),
    )
    expect(wkrName(drei, 'steg', '6')).toBe('Beispiel')
    expect(wkrName(drei, 'steg', '7')).toBe('Dritte')
    expect(wkrName(drei, 'mueb', '7')).toBe('')
  })

  it('eine Liste, die die Klasse nicht hat, bekommt keinen Namen', () => {
    // Alle Klassen auf einem Parcours: Mann-über-Bord gibt es erst ab Klasse 4.
    const state = mit(
      emptyState(),
      { type: 'SET_PARCOURS_PRESET', parcours: [{ id: 'par_1', classIds: ['E', '1', '2', '3', '4', '5', '6', '7'] }] },
      name('par_1', 'mueb', 'Probe'),
    )
    expect(wkrName(state, 'mueb', '4', konfig)).toBe('Probe')
    expect(wkrName(state, 'mueb', '3', konfig)).toBe('')
    // Ohne Konfiguration entscheidet allein der Parcours.
    expect(wkrName(state, 'mueb', '3')).toBe('Probe')
  })

  it('eine Klasse auf keinem Parcours hat keinen Namen; auf zweien gilt der erste', () => {
    const ohne = mit(zwei(), { type: 'SET_PARCOURS_CLASSES', id: 'par_1', classIds: ['1', '2', '3'] })
    expect(wkrName(ohne, 'steg', 'E')).toBe('')
    const doppelt = mit(zwei(), { type: 'SET_PARCOURS_CLASSES', id: 'par_2', classIds: ['3', '4'] })
    expect(parcoursVon(doppelt.parcoursList, '3')?.id).toBe('par_1')
    expect(wkrName(doppelt, 'steg', '3')).toBe('Muster')
  })

  it('ein gelöschter Parcours nimmt seine Namen mit: nichts bleibt unsichtbar im Stand oder in der Sicherung', () => {
    const state = mit(zwei(), { type: 'REMOVE_PARCOURS', id: 'par_2' })
    expect(state.einteilung).toEqual({ par_1: { steg: 'Muster' } })
    expect(wkrName(state, 'steg', '4')).toBe('')
    const sicherung = JSON.stringify(makeFile('sicherung', state, '2026-11-13T10:00:00.000Z'))
    for (const n of ['Beispiel', 'Probe']) expect(sicherung).not.toContain(n)
    // Zieht die Klasse auf den verbliebenen Parcours, gilt dessen Name.
    const umgezogen = mit(state, { type: 'SET_PARCOURS_CLASSES', id: 'par_1', classIds: ['E', '1', '2', '3', '4'] })
    expect(wkrName(umgezogen, 'steg', '4')).toBe('Muster')
  })

  it('eine Schnellauswahl mit neuen Kennungen: Die Namen ziehen der Stelle nach mit', () => {
    const state = mit(zwei(), {
      type: 'SET_PARCOURS_PRESET',
      parcours: [
        { id: 'par_abc', classIds: ['E', '1', '2', '3'] },
        { id: 'par_def', classIds: ['4', '5', '6', '7'] },
      ],
    })
    expect(wkrName(state, 'steg', '1')).toBe('Muster')
    expect(wkrName(state, 'mueb', '4')).toBe('Probe')
    expect(state.einteilung).toEqual({ par_abc: { steg: 'Muster' }, par_def: { steg: 'Beispiel', mueb: 'Probe' } })
  })

  it('eine Schnellauswahl mit weniger Parcours: Die Namen der überzähligen entfallen', () => {
    const alle: Action = { type: 'SET_PARCOURS_PRESET', parcours: [{ id: 'par_1', classIds: ['E', '1', '2', '3', '4', '5', '6', '7'] }] }
    const state = mit(zwei(), alle)
    expect(state.einteilung).toEqual({ par_1: { steg: 'Muster' } })
    expect(wkrName(state, 'steg', '7')).toBe('Muster')
    expect(JSON.stringify(state)).not.toContain('Beispiel')
  })

  it('haengeUm: wer bleibt, behält seine Namen; ein neuer erbt nur von einem, den es nicht mehr gibt', () => {
    const e = { a: { steg: 'Muster' }, b: { steg: 'Beispiel' } }
    expect(haengeUm(e, ['a', 'b'], ['a', 'b'])).toEqual(e)
    // Vertauscht: Die Namen folgen der Kennung, nicht der Stelle.
    expect(haengeUm(e, ['a', 'b'], ['b', 'a'])).toEqual(e)
    // „a“ gibt es weiter (an zweiter Stelle): Der neue an erster Stelle erbt nichts von ihm.
    expect(haengeUm(e, ['a', 'b'], ['x', 'a'])).toEqual({ a: { steg: 'Muster' } })
    expect(haengeUm(e, ['a', 'b'], ['x', 'y', 'z'])).toEqual({ x: { steg: 'Muster' }, y: { steg: 'Beispiel' } })
    expect(haengeUm(e, ['a', 'b'], [])).toEqual({})
  })

  it('die Namen hängen an der Liste und überleben einen Aufbauwechsel', () => {
    const state = mit(zwei(), name('par_1', 'alcatraz1', 'Nur hier'), { type: 'SET_AUFBAU', aufbau: 'moewe' })
    expect(wkrName(state, 'steg', '3')).toBe('Muster')
    expect(state.einteilung.par_1.alcatraz1).toBe('Nur hier')
    expect(mit(state, { type: 'SET_AUFBAU', aufbau: 'alcatraz' }).einteilung).toEqual(state.einteilung)
  })
})

describe('WKR-Einteilung: Zustand', () => {
  it('beginnt leer; ein leerer Name entfernt den Eintrag', () => {
    expect(emptyState().einteilung).toEqual({})
    const state = mit(emptyState(), name('par_1', 'steg', 'Muster'), name('par_1', 'zeit', 'Probe'))
    expect(state.einteilung).toEqual({ par_1: { steg: 'Muster', zeit: 'Probe' } })
    expect(mit(state, name('par_1', 'steg', '  ')).einteilung).toEqual({ par_1: { zeit: 'Probe' } })
    expect(mit(state, name('par_1', 'steg', ''), name('par_1', 'zeit', '')).einteilung).toEqual({})
    expect(setzeName({}, 'par_1', 'steg', '')).toEqual({})
  })

  it('beim Tippen bleibt die Eingabe, wie sie ist; gelesen wird ohne Leerzeichen am Rand', () => {
    const state = mit(emptyState(), name('par_1', 'steg', 'Muster '))
    expect(state.einteilung.par_1.steg).toBe('Muster ')
    expect(wkrName(state, 'steg', '1')).toBe('Muster')
  })

  it('ist deterministisch und ändert den alten Stand nicht', () => {
    const vorher = zwei()
    const kopie = JSON.parse(JSON.stringify(vorher))
    const action = name('par_1', 'steg', 'Neu')
    expect(reducer(vorher, action)).toEqual(reducer(vorher, action))
    expect(vorher).toEqual(kopie)
  })

  it('gilt auch bei festgeschriebener Verzahnung', () => {
    const fest = mit(emptyState(), { type: 'SET_VERZAHNUNG_LOCK', locked: true })
    expect(mit(fest, name('par_1', 'steg', 'Muster')).einteilung).toEqual({ par_1: { steg: 'Muster' } })
  })

  it('„Alles zurücksetzen“ löscht sie', () => {
    expect(mit(zwei(), { type: 'RESET_ALL' }).einteilung).toEqual({})
  })

  it('Migration: ältere Stände bekommen eine leere Einteilung, Unbrauchbares entfällt', () => {
    const { einteilung: _ohne, ...alt } = emptyState()
    expect(migrate(alt)?.einteilung).toEqual({})
    expect(migrate({ ...emptyState(), einteilung: 'nein' })?.einteilung).toEqual({})
    expect(normalisiereEinteilung({ par_1: { steg: 'Muster', zeit: 7, mueb: ' ' }, par_2: 'x', par_3: {}, par_4: ['a'] })).toEqual({
      par_1: { steg: 'Muster' },
    })
    expect(migrate(zwei())?.einteilung).toEqual(zwei().einteilung)
  })

  it('Migration: Namen zu Parcours, die es nicht gibt, entfallen', () => {
    const verwaist = { ...zwei(), einteilung: { par_1: { steg: 'Muster' }, par_weg: { steg: 'Verwaist' } } }
    expect(migrate(verwaist)?.einteilung).toEqual({ par_1: { steg: 'Muster' } })
  })

  it('Migration: ein Schlüssel „__proto__“ aus einer Datei wird kein geerbter Eintrag', () => {
    // JSON.parse legt „__proto__“ als gewöhnlichen Eintrag an – so kommt er aus einer Sicherung.
    const roh = JSON.parse('{"__proto__":{"steg":"Muster"},"par_1":{"__proto__":"Muster","zeit":"Probe"}}')
    for (const e of [normalisiereEinteilung(roh), migrate({ ...emptyState(), einteilung: roh })!.einteilung]) {
      expect(e).toEqual({ par_1: { zeit: 'Probe' } })
      expect(Object.getPrototypeOf(e)).toBe(Object.prototype)
      expect((e as Record<string, unknown>).steg).toBeUndefined()
      expect(Object.getPrototypeOf(e.par_1)).toBe(Object.prototype)
    }
  })
})

describe('WKR-Einteilung: Sicherung und Vorlage', () => {
  const AT = '2026-11-13T10:00:00.000Z'

  it('die Sicherung enthält die Namen', () => {
    const result = parseFile(JSON.stringify(makeFile('sicherung', zwei(), AT)))
    if (!result.ok || result.kind !== 'sicherung') throw new Error('keine Sicherung')
    expect(result.state.einteilung).toEqual(zwei().einteilung)
  })

  it('die Vorlage enthält keine Namen von Wettkampfrichtern', () => {
    const file = makeFile('vorlage', zwei(), AT)
    const text = JSON.stringify(file)
    for (const n of ['Muster', 'Beispiel', 'Probe', 'einteilung']) expect(text).not.toContain(n)
    // Die Parcours selbst sind eine Einstellung und reisen mit.
    expect(text).toContain('par_2')
  })

  it('eine eingespielte Vorlage lässt die hiesigen Namen stehen – auch wenn jemand Namen hineingeschrieben hat', () => {
    const hier = mit(emptyState(), name('par_1', 'steg', 'Hiesig'))
    const sauber = parseFile(JSON.stringify(makeFile('vorlage', zwei(), AT)))
    if (!sauber.ok || sauber.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(sauber.apply(hier).einteilung).toEqual({ par_1: { steg: 'Hiesig' } })

    const file = makeFile('vorlage', zwei(), AT) as unknown as { settings: Record<string, unknown> }
    file.settings.einteilung = { par_1: { steg: 'Fremd' } }
    const ergaenzt = parseFile(JSON.stringify(file))
    if (!ergaenzt.ok || ergaenzt.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(ergaenzt.apply(hier).einteilung).toEqual({ par_1: { steg: 'Hiesig' } })
  })

  it('eine Vorlage mit fremden Parcours-Kennungen: Die hiesigen Namen ziehen der Stelle nach um', () => {
    const fremd = mit(emptyState(), {
      type: 'SET_PARCOURS_PRESET',
      parcours: [
        { id: 'par_abc', classIds: ['E', '1', '2', '3'] },
        { id: 'par_def', classIds: ['4', '5', '6', '7'] },
      ],
    })
    const vorlage = parseFile(JSON.stringify(makeFile('vorlage', fremd, AT)))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const danach = vorlage.apply(zwei())
    expect(danach.parcoursList.map((p) => p.id)).toEqual(['par_abc', 'par_def'])
    expect(wkrName(danach, 'steg', '1')).toBe('Muster')
    expect(wkrName(danach, 'steg', '4')).toBe('Beispiel')
    // Nichts hängt mehr an einer Kennung, die es nicht gibt.
    expect(Object.keys(danach.einteilung)).toEqual(['par_abc', 'par_def'])

    // Hat die Vorlage nur einen Parcours, entfallen die Namen des zweiten.
    const einer = mit(emptyState(), { type: 'SET_PARCOURS_PRESET', parcours: [{ id: 'par_x', classIds: ['E', '1'] }] })
    const klein = parseFile(JSON.stringify(makeFile('vorlage', einer, AT)))
    if (!klein.ok || klein.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(klein.apply(zwei()).einteilung).toEqual({ par_x: { steg: 'Muster' } })
  })

  it('die Teilnehmerdaten enthalten sie nicht', () => {
    expect(JSON.stringify(makeFile('starter', zwei(), AT))).not.toContain('Muster')
  })
})

describe('WKR-Einteilung: Zeilen', () => {
  it('die Listen des Aufbaus in seiner Reihenfolge, darunter die weiteren', () => {
    const { aufbau, weitere } = einteilungsListen(konfig, 'alcatraz')
    expect(aufbau.map((l) => l.id)).toEqual(konfig.getAufbau('alcatraz').order)
    expect(aufbau.map((l) => l.titel)).toContain('Steg')
    const alle = [...aufbau, ...weitere]
    // Jede Liste einmal, und keine zwei Zeilen heißen gleich.
    expect(new Set(alle.map((l) => l.id)).size).toBe(alle.length)
    expect(new Set(alle.map((l) => l.titel)).size).toBe(alle.length)
    for (const id of konfig.getAufbau('alcatraz').zusatz) expect(weitere.map((l) => l.id)).toContain(id)
  })

  it('ein Strich, wenn keine Klasse des Parcours die Liste hat', () => {
    expect(listeGilt(konfig, 'mueb', ['E', '1', '2', '3'])).toBe(false)
    expect(listeGilt(konfig, 'mueb', ['3', '4'])).toBe(true)
    expect(listeGilt(konfig, 'steg', [])).toBe(false)
  })
})
