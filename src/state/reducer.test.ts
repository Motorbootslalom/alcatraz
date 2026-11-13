import { describe, expect, it } from 'vitest'
import { emptyState, reducer } from './reducer'
import type { ClassId, Starter } from '../types'

function starter(id: string, klasse: ClassId, startNr: string, nachname: string, extra: Partial<Starter> = {}): Starter {
  return {
    id,
    startNr,
    vorname: 'Test',
    nachname,
    verein: 'Club',
    bundesland: 'Land',
    geburtsdatum: '2015-05-05',
    klasse,
    groesse: '',
    ...extra,
  }
}

describe('reducer', () => {
  it('ist deterministisch: gleiche Action, gleiches Ergebnis', () => {
    const action = { type: 'ADD_PARCOURS', id: 'par_x' } as const
    expect(reducer(emptyState(), action)).toEqual(reducer(emptyState(), action))
  })

  it('Clubmeisterschaft blendet die Herkunft aus, der Wechsel zurück zeigt den Verein', () => {
    const club = reducer(emptyState(), { type: 'SET_EVENT_KIND', eventKind: 'club' })
    expect(club.originMode).toBe('none')
    expect(reducer(club, { type: 'SET_EVENT_KIND', eventKind: 'meisterschaft' }).originMode).toBe('verein')
  })

  it('begrenzt die Zahl der Läufe', () => {
    expect(reducer(emptyState(), { type: 'SET_EVENT', patch: { laufCount: 0 } }).laufCount).toBe(1)
    expect(reducer(emptyState(), { type: 'SET_EVENT', patch: { laufCount: 42 } }).laufCount).toBe(9)
  })

  it('Ersetzen behält die ID wiedererkannter Starter', () => {
    const before = reducer(emptyState(), {
      type: 'ADD_STARTERS',
      starters: [starter('alt_1', '1', '101', 'Meier'), starter('alt_2', '1', '102', 'Schulz')],
    })
    const after = reducer(before, {
      type: 'IMPORT_STARTERS',
      mode: 'replace',
      starters: [starter('neu_1', '1', '101', 'Meyer'), starter('neu_3', '2', '201', 'Neu')],
    })
    expect(after.starters.map((s) => s.id)).toEqual(['alt_1', 'neu_3'])
    expect(after.starters[0].nachname).toBe('Meyer')
  })

  it('Ergänzen übergeht gleiche Namen in derselben Klasse', () => {
    const before = reducer(emptyState(), { type: 'ADD_STARTERS', starters: [starter('a', '1', '101', 'Meier')] })
    const after = reducer(before, {
      type: 'IMPORT_STARTERS',
      mode: 'merge',
      starters: [starter('b', '1', '109', 'meier'), starter('c', '2', '201', 'Meier')],
    })
    expect(after.starters.map((s) => s.id)).toEqual(['a', 'c'])
  })

  it('Verschieben verteilt nur die vorhandenen Nummern neu', () => {
    const before = reducer(emptyState(), {
      type: 'ADD_STARTERS',
      starters: [starter('a', '1', '101', 'A'), starter('b', '1', '105', 'B'), starter('c', '1', '109', 'C')],
    })
    const after = reducer(before, { type: 'MOVE_STARTER', id: 'c', target: 'first' })
    expect(Object.fromEntries(after.starters.map((s) => [s.id, s.startNr]))).toEqual({ c: '101', a: '105', b: '109' })
  })

  it('andere Klassen oder ein anderer Faktor verwerfen die manuelle Anordnung', () => {
    const manual = reducer(emptyState(), {
      type: 'SET_PARCOURS_TRACKS',
      id: 'par_1',
      tracks: [[{ kind: 'class', klasse: 'E' }], [{ kind: 'class', klasse: '1' }]],
    })
    expect(manual.parcoursList[0].tracks).toBeDefined()
    expect(reducer(manual, { type: 'SET_PARCOURS_FACTOR', id: 'par_1', wechselFaktor: 3 }).parcoursList[0].tracks).toBeUndefined()
    expect(reducer(manual, { type: 'SET_PARCOURS_CLASSES', id: 'par_1', classIds: ['E'] }).parcoursList[0].tracks).toBeUndefined()
  })

  it('Zurücksetzen ergibt eine leere Veranstaltung', () => {
    const filled = reducer(emptyState(), { type: 'ADD_STARTERS', starters: [starter('a', '1', '101', 'A')] })
    expect(reducer(filled, { type: 'RESET_ALL' })).toEqual(emptyState())
  })
})

describe('Startnummern vergeben', () => {
  const field = () =>
    reducer(emptyState(), {
      type: 'ADD_STARTERS',
      starters: [
        starter('e1', 'E', '', 'A'),
        starter('e2', 'E', '', 'B'),
        starter('k1', '1', '', 'C'),
        starter('k5', '5', '', 'D'),
      ],
    })

  it('klassenbasiert: je Klasse ab 01', () => {
    const after = reducer(field(), { type: 'ASSIGN_START_NUMBERS' })
    expect(after.starters.map((s) => s.startNr)).toEqual(['E01', 'E02', '101', '501'])
  })

  it('klassisch: fortlaufend in der Reihenfolge der Verzahnung, mit Startwert und Lücken', () => {
    let state = reducer(field(), { type: 'SET_START_NR_MODE', mode: 'klassisch' })
    state = reducer(state, { type: 'SET_RUNNING_NUMBERS', patch: { start: 10, skipText: '11' } })
    state = reducer(state, { type: 'ASSIGN_START_NUMBERS' })
    const numbers = Object.fromEntries(state.starters.map((s) => [s.id, s.startNr]))
    // Parcours 1 (E und 1 verzahnt): E, 1, E – dann Parcours 2.
    expect(numbers).toEqual({ e1: '10', k1: '12', e2: '13', k5: '14' })
    expect(state.runningNumbers.enabled).toBe(false)
  })

  it('der Wechsel der Art lässt die Nummern stehen', () => {
    const numbered = reducer(field(), { type: 'ASSIGN_START_NUMBERS' })
    const switched = reducer(numbered, { type: 'SET_START_NR_MODE', mode: 'klassisch' })
    expect(switched.starters).toEqual(numbered.starters)
  })
})

describe('Regelwerk und Aufbau', () => {
  it('beginnt mit den Vorgaben', () => {
    expect(emptyState()).toMatchObject({ regelwerk: 'dm-2026', aufbau: 'alcatraz' })
  })

  it('übernimmt nur bekannte Kennungen', () => {
    expect(reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' }).regelwerk).toBe('uim-2026')
    expect(reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'quatsch' }).regelwerk).toBe('dm-2026')
    expect(reducer(emptyState(), { type: 'SET_AUFBAU', aufbau: 'moewe' }).aufbau).toBe('moewe')
    // Der Parallelslalom hat einen festen Aufbau und steht nicht zur Wahl.
    expect(reducer(emptyState(), { type: 'SET_AUFBAU', aufbau: 'parallel' }).aufbau).toBe('alcatraz')
  })

  it('ohne Parallelslalom gibt er auch nicht die Nummernfolge vor', () => {
    let state = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    state = reducer(state, { type: 'SET_RUNNING_NUMBERS', patch: { source: 'parallel' } })
    expect(state.runningNumbers.source).toBe('parallel')
    expect(reducer(state, { type: 'SET_REGELWERK', regelwerk: 'dm-2026' }).runningNumbers.source).toBe('manoever')
  })
})

describe('Listen-Einstellungen und Kürzel', () => {
  it('setzt und entfernt eigene Kürzel', () => {
    let state = reducer(emptyState(), { type: 'SET_ORIGIN_SHORT', name: 'MC Neuruppin e.V.', short: ' MCN ' })
    expect(state.originShort).toEqual({ 'MC Neuruppin e.V.': 'MCN' })
    state = reducer(state, { type: 'SET_ORIGIN_SHORT', name: 'MC Neuruppin e.V.', short: '' })
    expect(state.originShort).toEqual({})
  })

  it('zeigt das Geburtsdatum, bis es abgeschaltet wird', () => {
    expect(emptyState().showBirthdate).toBe(true)
    expect(reducer(emptyState(), { type: 'SET_LIST_OPTIONS', patch: { showBirthdate: false } }).showBirthdate).toBe(false)
  })
})

describe('Verwiegung', () => {
  const base = () => reducer(emptyState(), { type: 'ADD_STARTERS', starters: [starter('a', '1', '101', 'A')] })

  it('setzt und löscht das Gewicht eines Starters', () => {
    const weighed = reducer(base(), { type: 'SET_WEIGHT', id: 'a', gewicht: 30.5 })
    expect(weighed.starters[0].gewicht).toBe(30.5)
    const cleared = reducer(weighed, { type: 'SET_WEIGHT', id: 'a', gewicht: null })
    expect(cleared.starters[0]).not.toHaveProperty('gewicht')
  })

  it('behält das Gewicht, wenn die Starterliste neu eingelesen wird', () => {
    const weighed = reducer(base(), { type: 'SET_WEIGHT', id: 'a', gewicht: 31 })
    const after = reducer(weighed, { type: 'IMPORT_STARTERS', mode: 'replace', starters: [starter('neu', '1', '101', 'A')] })
    expect(after.starters[0]).toMatchObject({ id: 'a', gewicht: 31 })
  })

  it('merkt sich nur Standardgewichte, die vom Regelwerk abweichen', () => {
    expect(emptyState().sollgewicht).toEqual({})
    const own = reducer(emptyState(), { type: 'SET_SOLLGEWICHT', klasse: '1', kg: 35 })
    expect(own.sollgewicht).toEqual({ '1': 35 })
    // Der Wert des Regelwerks (DM: 33 kg) ist kein eigener Wert.
    expect(reducer(own, { type: 'SET_SOLLGEWICHT', klasse: '1', kg: 33 }).sollgewicht).toEqual({})
    expect(reducer(own, { type: 'SET_SOLLGEWICHT', klasse: '1', kg: null }).sollgewicht).toEqual({})
    expect(reducer(own, { type: 'RESET_SOLLGEWICHT' }).sollgewicht).toEqual({})
  })
})

describe('festgeschriebene Verzahnung', () => {
  const tracks = { par_1: [[{ kind: 'class' as const, klasse: 'E' as const }], [{ kind: 'class' as const, klasse: '1' as const }]] }
  const locked = () => reducer(emptyState(), { type: 'SET_VERZAHNUNG_LOCK', locked: true, tracks })

  it('übernimmt beim Festschreiben die gezeigten Spuren als feste Anordnung', () => {
    expect(locked().verzahnungLocked).toBe(true)
    expect(locked().parcoursList[0].tracks).toEqual(tracks.par_1)
    expect(locked().parcoursList[1].tracks).toBeUndefined()
  })

  it('weist alles ab, was die Verzahnung verändern würde', () => {
    const state = locked()
    expect(reducer(state, { type: 'SET_PARCOURS_FACTOR', id: 'par_1', wechselFaktor: 3 })).toBe(state)
    expect(reducer(state, { type: 'SET_BOATS', boats: { klein: 9, gross: 9 } })).toBe(state)
    expect(reducer(state, { type: 'REMOVE_PARCOURS', id: 'par_1' })).toBe(state)
    expect(reducer(state, { type: 'RESET_TRACKS', id: 'par_1' })).toBe(state)
  })

  it('lässt Starter, Nummern und Namen der Parcours weiter zu', () => {
    const state = locked()
    expect(reducer(state, { type: 'ADD_STARTERS', starters: [starter('a', 'E', '', 'A')] }).starters).toHaveLength(1)
    expect(reducer(state, { type: 'RENAME_PARCOURS', id: 'par_1', name: 'Steg Nord' }).parcoursList[0].name).toBe('Steg Nord')
  })

  it('gibt nach dem Freigeben wieder alles frei, die Spuren bleiben', () => {
    const open = reducer(locked(), { type: 'SET_VERZAHNUNG_LOCK', locked: false })
    expect(open.parcoursList[0].tracks).toEqual(tracks.par_1)
    expect(reducer(open, { type: 'SET_BOATS', boats: { klein: 9, gross: 9 } }).boats.klein).toBe(9)
  })
})

describe('Leerzeilen der Wettkampfrichter-Listen', () => {
  it('Vorgabe 3; die allgemeine Zahl wird auf 0 bis 30 begrenzt', () => {
    expect(emptyState().wkrLeerzeilen).toBe(3)
    expect(reducer(emptyState(), { type: 'SET_WKR_LEERZEILEN', anzahl: 5 }).wkrLeerzeilen).toBe(5)
    expect(reducer(emptyState(), { type: 'SET_WKR_LEERZEILEN', anzahl: 99 }).wkrLeerzeilen).toBe(30)
    expect(reducer(emptyState(), { type: 'SET_WKR_LEERZEILEN', anzahl: -2 }).wkrLeerzeilen).toBe(0)
    expect(reducer({ ...emptyState(), wkrLeerzeilen: 7 }, { type: 'SET_WKR_LEERZEILEN', anzahl: null }).wkrLeerzeilen).toBe(3)
  })

  it('je Klasse steht nur, was von der allgemeinen Zahl abweicht', () => {
    let s = reducer(emptyState(), { type: 'SET_WKR_LEERZEILEN', klasse: '7', anzahl: 5 })
    s = reducer(s, { type: 'SET_WKR_LEERZEILEN', klasse: '1', anzahl: 3 })
    expect(s.wkrLeerzeilenKlasse).toEqual({ '7': 5 })
    // Zieht die allgemeine Zahl nach, ist es keine Abweichung mehr.
    expect(reducer(s, { type: 'SET_WKR_LEERZEILEN', anzahl: 5 }).wkrLeerzeilenKlasse).toEqual({})
    expect(reducer(s, { type: 'SET_WKR_LEERZEILEN', klasse: '7', anzahl: null }).wkrLeerzeilenKlasse).toEqual({})
    s = reducer(s, { type: 'SET_WKR_LEERZEILEN', klasse: '2', anzahl: 0 })
    expect(reducer(s, { type: 'SET_WKR_LEERZEILEN', anzahl: s.wkrLeerzeilen, alleKlassen: true }).wkrLeerzeilenKlasse).toEqual({})
  })

  it('Rückseite ein- und ausschalten', () => {
    expect(emptyState().wkrRueckseite).toBe(false)
    expect(reducer(emptyState(), { type: 'SET_WKR_RUECKSEITE', rueckseite: true }).wkrRueckseite).toBe(true)
    expect(emptyState().wkrClubGemeinsam).toBe(false)
    expect(reducer(emptyState(), { type: 'SET_WKR_CLUB_GEMEINSAM', gemeinsam: true }).wkrClubGemeinsam).toBe(true)
  })
})
