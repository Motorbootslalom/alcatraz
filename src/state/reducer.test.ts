import { describe, expect, it } from 'vitest'
import { emptyState, reducer } from './reducer'
import { normalisiereSprachen } from '../lib/einteilung'
import { wkrSpracheFuer } from '../lib/listensprache'
import type { ClassId, Starter } from '../types'
import { testLogo, testSvgLogo } from '../testHilfen'

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
  describe('Beispiel-Starterfeld', () => {
    const a = starter('a', '1', '101', 'A')
    const b = starter('b', '1', '102', 'B')
    const beispiel = () => reducer(emptyState(), { type: 'ADD_STARTERS', starters: [a, b], beispiel: true })

    it('gilt nur für Starter aus den Beispieldaten', () => {
      expect(emptyState().beispielStarter).toBe(false)
      expect(reducer(emptyState(), { type: 'ADD_STARTERS', starters: [a] }).beispielStarter).toBe(false)
      expect(beispiel().beispielStarter).toBe(true)
      // Erfundene Starter ohne Inhalt machen noch kein Starterfeld.
      expect(reducer(emptyState(), { type: 'ADD_STARTERS', starters: [], beispiel: true }).beispielStarter).toBe(false)
    })

    it('bleibt, wenn Starter ergänzt, geändert oder einzeln entfernt werden – und beim Erfassen', () => {
      const c = starter('c', '2', '201', 'C')
      let state = reducer(beispiel(), { type: 'ADD_STARTERS', starters: [c] })
      state = reducer(state, { type: 'IMPORT_STARTERS', starters: [starter('d', '2', '202', 'D')], mode: 'merge' })
      state = reducer(state, { type: 'UPDATE_STARTER', id: 'a', patch: { nachname: 'Anders' } })
      state = reducer(state, { type: 'REMOVE_STARTER', id: 'b' })
      state = reducer(state, { type: 'FILL_BEISPIELWERTE', zeitnahme: 'stoppuhr', saat: 1 })
      expect(state.beispielStarter).toBe(true)
    })

    it('endet, wenn die Starter gelöscht oder als Ganzes ersetzt werden', () => {
      expect(reducer(beispiel(), { type: 'CLEAR_ALL_STARTERS' }).beispielStarter).toBe(false)
      expect(reducer(beispiel(), { type: 'CLEAR_CLASS', klasse: '1' }).beispielStarter).toBe(false)
      expect(reducer(reducer(beispiel(), { type: 'REMOVE_STARTER', id: 'a' }), { type: 'REMOVE_STARTER', id: 'b' }).beispielStarter).toBe(false)
      expect(reducer(beispiel(), { type: 'IMPORT_STARTERS', starters: [starter('x', '3', '301', 'X')], mode: 'replace' }).beispielStarter).toBe(false)
      expect(reducer(beispiel(), { type: 'RESET_ALL' }).beispielStarter).toBe(false)
    })
  })

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

  it('Datum der Veranstaltung (24.11.2026): nur Tage, die es gibt; leer nimmt es weg; Unverändertes bleibt derselbe Stand', () => {
    const mit = reducer(emptyState(), { type: 'SET_EVENT_DATUM', datum: '2026-09-05' })
    expect(mit.eventDatum).toBe('2026-09-05')
    expect(reducer(mit, { type: 'SET_EVENT_DATUM', datum: '2026-09-05' })).toBe(mit)
    expect(reducer(mit, { type: 'SET_EVENT_DATUM', datum: '2026-02-30' })).toBe(mit)
    expect(reducer(mit, { type: 'SET_EVENT_DATUM', datum: '05.09.2026' })).toBe(mit)
    expect(reducer(mit, { type: 'SET_EVENT_DATUM', datum: '' }).eventDatum).toBe('')
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

  it('klassenbasiert: je Klasse ab 01 – mit der DMYV-Vorgabe aus den Bereichen der Westengröße', () => {
    // Ohne Bereiche (bewusst leer): fortlaufend ab 01.
    let ohne = field()
    for (const klasse of ['E', '1', '5'] as const) ohne = reducer(ohne, { type: 'SET_START_NR_BEREICHE', klasse, bereiche: [] })
    expect(reducer(ohne, { type: 'ASSIGN_START_NUMBERS' }).starters.map((s) => s.startNr)).toEqual(['E01', 'E02', '101', '501'])
    // DM-Vorgabe: E01 …; Klasse 5 ist nach Größen aufgeteilt – ohne Größe keine Nummer, von Hand (20.11.2026).
    const after = reducer(field(), { type: 'ASSIGN_START_NUMBERS' })
    expect(after.starters.map((s) => s.startNr)).toEqual(['E01', 'E02', '101', ''])
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

  it('die Wahl des Regelwerks stellt Läufe und Streichläufe so, wie es sie vorsieht (YAML wertungslaeufe)', () => {
    // UIM: zwei Versuche, der bessere zählt.
    const uim = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    expect([uim.laufCount, uim.streichlaeufe]).toEqual([2, 1])
    // Zurück zur DM: drei Läufe, „nach Regel“ (ab drei Läufen einer).
    const dm = reducer(uim, { type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    expect([dm.laufCount, dm.streichlaeufe]).toEqual([3, 'auto'])
    // Von Hand abweichen bleibt möglich; ein Klick auf das schon gewählte Regelwerk verstellt nichts.
    let hand = reducer(uim, { type: 'SET_EVENT', patch: { laufCount: 4 } })
    hand = reducer(hand, { type: 'SET_STREICHLAEUFE', streichlaeufe: 2 })
    hand = reducer(hand, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    expect([hand.laufCount, hand.streichlaeufe]).toEqual([4, 2])
  })

  it('„Versuche direkt nacheinander“ folgt beim Wechsel dem Regelwerk und lässt sich nur dort stellen, wo es den Schalter gibt', () => {
    expect(emptyState().versucheNacheinander).toBe(false)
    const uim = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    // Unter UIM eine Option, nicht vorgewählt (Entscheidung des Nutzers).
    expect(uim.versucheNacheinander).toBe(false)
    // Von Hand an; ein Klick auf das schon gewählte Regelwerk verstellt nichts.
    const an = reducer(uim, { type: 'SET_VERSUCHE_NACHEINANDER', on: true })
    expect(an.versucheNacheinander).toBe(true)
    expect(reducer(an, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' }).versucheNacheinander).toBe(true)
    expect(reducer(an, { type: 'SET_VERSUCHE_NACHEINANDER', on: false }).versucheNacheinander).toBe(false)
    // Die DM kennt den Schalter nicht: Er ist aus und bleibt es.
    const dm = reducer(an, { type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    expect(dm.versucheNacheinander).toBe(false)
    expect(reducer(dm, { type: 'SET_VERSUCHE_NACHEINANDER', on: true })).toBe(dm)
  })

  it('sobald Ergebnisse erfasst sind, lässt sich das Regelwerk nicht mehr wechseln – bis alle Werte gelöscht sind', () => {
    const starter = { id: 'a', startNr: '401', vorname: 'Vor', nachname: 'Nach', verein: '', bundesland: '', geburtsdatum: '', klasse: '4' as const, groesse: '' }
    let state = reducer(emptyState(), { type: 'ADD_STARTERS', starters: [starter] })
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/3', starter: 'a', feld: 'zeit1', wert: '80' }] })
    // Gesperrt: Der Stand bleibt derselbe. Ein Klick auf das schon gewählte Regelwerk ändert ohnehin nichts.
    expect(reducer(state, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })).toBe(state)
    expect(reducer(state, { type: 'SET_REGELWERK', regelwerk: 'dm-2026' })).toEqual(state)
    // Sind alle Werte gelöscht, geht es wieder.
    const leer = reducer(state, { type: 'CLEAR_EINGABEN' })
    const uim = reducer(leer, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    expect([uim.regelwerk, uim.laufCount]).toEqual(['uim-2026', 2])
    // Die Zahl der Läufe von Hand zu senken verliert weiter nichts: Werte des 3. Laufs bleiben im Stand.
    expect(reducer(state, { type: 'SET_EVENT', patch: { laufCount: 2 } }).eingaben).toEqual(state.eingaben)
    expect(reducer(uim, { type: 'SET_REGELWERK', regelwerk: 'dm-2026' }).laufCount).toBe(3)
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

  it('merkt sich nur Durchschnittsgewichte, die vom Regelwerk abweichen', () => {
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
    // Papier sparen ist die Vorgabe; es wirkt nur bei der Clubmeisterschaft.
    expect(emptyState().wkrClubGemeinsam).toBe(true)
    expect(reducer(emptyState(), { type: 'SET_WKR_CLUB_GEMEINSAM', gemeinsam: false }).wkrClubGemeinsam).toBe(false)
    // Clubmeisterschaft: eine Leerzeile je Klasse statt drei – und zurück. Eine selbst gewählte Zahl bleibt.
    const alsClub = reducer(emptyState(), { type: 'SET_EVENT_KIND', eventKind: 'club' })
    expect(alsClub).toMatchObject({ wkrLeerzeilen: 1, wkrClubGemeinsam: true })
    expect(reducer(alsClub, { type: 'SET_EVENT_KIND', eventKind: 'meisterschaft' }).wkrLeerzeilen).toBe(3)
    const eigene = reducer(emptyState(), { type: 'SET_WKR_LEERZEILEN', anzahl: 5 })
    expect(reducer(eigene, { type: 'SET_EVENT_KIND', eventKind: 'club' }).wkrLeerzeilen).toBe(5)
  })

  it('Klassen auf gemeinsamen Bögen: Vorgabe getrennt, wählbar nach der Verzahnung (24.11.2026)', () => {
    expect(emptyState().wkrGemeinsamFolge).toBe('getrennt')
    const s = reducer(emptyState(), { type: 'SET_WKR_GEMEINSAM_FOLGE', folge: 'verzahnung' })
    expect(s.wkrGemeinsamFolge).toBe('verzahnung')
    // Unverändert: derselbe Stand. Unbekanntes ist die Vorgabe.
    expect(reducer(s, { type: 'SET_WKR_GEMEINSAM_FOLGE', folge: 'verzahnung' })).toBe(s)
    expect(reducer(s, { type: 'SET_WKR_GEMEINSAM_FOLGE', folge: 'quer' as never }).wkrGemeinsamFolge).toBe('getrennt')
  })

  it('gemeinsame Bögen bei einer Meisterschaft (R11-03, 26.11.2026): Vorgabe aus, wählbar gleich oder alle', () => {
    expect(emptyState().wkrMeisterschaftGemeinsam).toBe('aus')
    const s = reducer(emptyState(), { type: 'SET_WKR_MEISTERSCHAFT_GEMEINSAM', art: 'gleich' })
    expect(s.wkrMeisterschaftGemeinsam).toBe('gleich')
    expect(reducer(s, { type: 'SET_WKR_MEISTERSCHAFT_GEMEINSAM', art: 'alle' }).wkrMeisterschaftGemeinsam).toBe('alle')
    // Unverändert: derselbe Stand. Unbekanntes ist die Vorgabe.
    expect(reducer(s, { type: 'SET_WKR_MEISTERSCHAFT_GEMEINSAM', art: 'gleich' })).toBe(s)
    expect(reducer(s, { type: 'SET_WKR_MEISTERSCHAFT_GEMEINSAM', art: 'immer' as never }).wkrMeisterschaftGemeinsam).toBe('aus')
    // Der Wechsel zur Clubmeisterschaft und zurück lässt die Angabe stehen.
    const club = reducer(s, { type: 'SET_EVENT_KIND', eventKind: 'club' })
    expect(reducer(club, { type: 'SET_EVENT_KIND', eventKind: 'meisterschaft' }).wkrMeisterschaftGemeinsam).toBe('gleich')
  })
})

describe('Listenoptionen: Seitenaufteilung, Bojen-Seiten, Sprache', () => {
  it('Vorgaben: automatisch geteilt, Rechts/Links, Bögen in der Sprache des Regelwerks, drei Leerzeilen je Seite', () => {
    expect(emptyState()).toMatchObject({ wkrZeilenJeSeite: 0, wkrTeilenAb: 0, beschriftung: 'rl', wkrSprachen: {}, wkrLeerzeilenSeite: 3 })
    expect(emptyState()).not.toHaveProperty('listenSprache')
  })

  it('Starter je Seite: 0 = automatisch, sonst 5 bis 100; „Teilen ab“ 0 bis 200', () => {
    const setze = (patch: { zeilenJeSeite?: number | null; teilenAb?: number | null }, von = emptyState()) => reducer(von, { type: 'SET_WKR_SEITEN', patch })
    expect(setze({ zeilenJeSeite: 15 }).wkrZeilenJeSeite).toBe(15)
    // Wie im Prototyp: Unter fünf Startern je Seite lohnt kein Blatt.
    expect(setze({ zeilenJeSeite: 2 }).wkrZeilenJeSeite).toBe(5)
    expect(setze({ zeilenJeSeite: 500 }).wkrZeilenJeSeite).toBe(100)
    expect(setze({ zeilenJeSeite: -3 }, setze({ zeilenJeSeite: 15 })).wkrZeilenJeSeite).toBe(0)
    expect(setze({ zeilenJeSeite: null }, setze({ zeilenJeSeite: 15 })).wkrZeilenJeSeite).toBe(0)
    expect(setze({ teilenAb: 25 }).wkrTeilenAb).toBe(25)
    expect(setze({ teilenAb: 999 }).wkrTeilenAb).toBe(200)
    expect(setze({ teilenAb: null }, setze({ teilenAb: 25 })).wkrTeilenAb).toBe(0)
    // Nur was im Patch steht, ändert sich; „Teilen ab“ übersteht den Wechsel auf automatisch.
    const beide = setze({ zeilenJeSeite: 15, teilenAb: 25 })
    expect(setze({ zeilenJeSeite: 0 }, beide)).toMatchObject({ wkrZeilenJeSeite: 0, wkrTeilenAb: 25 })
    // Keine Änderung, kein neuer Stand.
    expect(setze({ zeilenJeSeite: 15 }, beide)).toBe(beide)
  })

  it('Bezeichnung der Bojen-Seiten: nur Schemata aus der Konfiguration', () => {
    expect(reducer(emptyState(), { type: 'SET_BESCHRIFTUNG', beschriftung: 'ls' }).beschriftung).toBe('ls')
    expect(reducer({ ...emptyState(), beschriftung: 'kh' }, { type: 'SET_BESCHRIFTUNG', beschriftung: 'gibtsnicht' }).beschriftung).toBe('rl')
  })

  it('Sprache der Bögen je Parcours und Liste: deutsch, englisch oder zweisprachig; `null` = wieder die des Regelwerks', () => {
    type S = 'de' | 'en' | 'de+en' | null
    const zellen = (parcoursId: string, ...typeIds: string[]) => typeIds.map((typeId) => ({ parcoursId, typeId }))
    const setze = (z: { parcoursId: string; typeId: string }[], sprache: S, von = emptyState()) => reducer(von, { type: 'SET_WKR_SPRACHE', zellen: z, sprache })
    for (const sprache of ['de', 'en', 'de+en'] as const) expect(setze(zellen('par_1', 'steg'), sprache).wkrSprachen).toEqual({ par_1: { steg: sprache } })
    // Auf jedem Parcours sitzt eine eigene Gruppe: Die Wahl gilt nur dort.
    const getrennt = setze(zellen('par_2', 'steg'), 'de+en', setze(zellen('par_1', 'steg'), 'de'))
    expect(getrennt.wkrSprachen).toEqual({ par_1: { steg: 'de' }, par_2: { steg: 'de+en' } })
    // „Alle auf …“: mehrere Zellen in einer Action – auch die der Racecourses; die übrigen bleiben.
    const alle = setze([...zellen('par_1', 'steg', 'zeit'), ...zellen('racecourse-a', 'zeit')], 'de+en', setze(zellen('par_2', 'knoten'), 'de'))
    expect(alle.wkrSprachen).toEqual({ par_2: { knoten: 'de' }, par_1: { steg: 'de+en', zeit: 'de+en' }, 'racecourse-a': { zeit: 'de+en' } })
    // Ohne Eintrag bleibt kein leerer Parcours zurück.
    expect(setze(zellen('racecourse-a', 'zeit'), null, alle).wkrSprachen).toEqual({ par_2: { knoten: 'de' }, par_1: { steg: 'de+en', zeit: 'de+en' } })
    // Unbrauchbares entfernt den Eintrag, statt ihn zu speichern; unverändert bleibt der Stand derselbe.
    expect(setze(zellen('par_1', 'zeit'), 'fr' as never, alle).wkrSprachen).toEqual({ par_2: { knoten: 'de' }, par_1: { steg: 'de+en' }, 'racecourse-a': { zeit: 'de+en' } })
    expect(setze(zellen('par_1', 'steg'), 'de+en', alle)).toBe(alle)
    expect(setze(zellen('par_1', 'vorsteg'), null, alle)).toBe(alle)
    // Die Wahl gehört zur Veranstaltung und übersteht den Wechsel des Regelwerks.
    expect(reducer(alle, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' }).wkrSprachen).toEqual(alle.wkrSprachen)
    // Sie gilt je Parcours: UIM, Steg auf Parcours 1 deutsch, auf Parcours 2 und dem Racecourse die Vorgabe.
    const uim = reducer(getrennt, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    expect(wkrSpracheFuer(uim, 'par_1', 'steg')).toBe('de')
    expect(wkrSpracheFuer(uim, 'par_2', 'steg')).toBe('de+en')
    expect(wkrSpracheFuer(uim, 'racecourse-a', 'steg')).toBe('en')
    expect(wkrSpracheFuer(uim, undefined, 'steg')).toBe('en')
  })

  it('Sprache der Bögen folgt den Parcours: Schnellauswahl hängt um, ein entfernter Parcours nimmt seine mit', () => {
    let stand = reducer(emptyState(), { type: 'SET_WKR_SPRACHE', zellen: [{ parcoursId: 'par_1', typeId: 'steg' }, { parcoursId: 'racecourse-b', typeId: 'zeit' }], sprache: 'de+en' })
    // Neue Kennungen an derselben Stelle: Parcours 1 bleibt Parcours 1; die Racecourses bleiben.
    stand = reducer(stand, { type: 'SET_PARCOURS_PRESET', parcours: [{ id: 'neu_1', classIds: ['1'] }, { id: 'neu_2', classIds: ['4'] }] })
    expect(stand.wkrSprachen).toEqual({ neu_1: { steg: 'de+en' }, 'racecourse-b': { zeit: 'de+en' } })
    expect(reducer(stand, { type: 'REMOVE_PARCOURS', id: 'neu_1' }).wkrSprachen).toEqual({ 'racecourse-b': { zeit: 'de+en' } })
  })

  it('normalisiereSprachen: nur gültige Sprachen; die frühere Wahl je Liste gilt für jeden Parcours und beide Racecourses', () => {
    expect(normalisiereSprachen({ par_1: { steg: 'en', zeit: 'fr', knoten: 7 } })).toEqual({ par_1: { steg: 'en' } })
    expect(normalisiereSprachen(['en'])).toEqual({})
    expect(normalisiereSprachen(null)).toEqual({})
    expect(normalisiereSprachen({ par_1: { steg: 'de' }, weg: { steg: 'de' } }, ['par_1'])).toEqual({ par_1: { steg: 'de' } })
    expect(normalisiereSprachen({ steg: 'de', zeit: 'fr' }, ['par_1', 'par_2'])).toEqual({
      par_1: { steg: 'de' },
      par_2: { steg: 'de' },
      'racecourse-a': { steg: 'de' },
      'racecourse-b': { steg: 'de' },
    })
    // Ein Eintrag je Parcours hat Vorrang vor dem früheren je Liste – in jeder Reihenfolge.
    expect(normalisiereSprachen({ par_1: { steg: 'en' }, steg: 'de' }, ['par_1', 'par_2'])).toMatchObject({ par_1: { steg: 'en' }, par_2: { steg: 'de' } })
    expect(normalisiereSprachen({ steg: 'de', par_1: { steg: 'en' } }, ['par_1'])).toMatchObject({ par_1: { steg: 'en' } })
    // „constructor“ als Kennung wird ein eigener Eintrag, kein Griff ins Objekt-Urbild.
    expect(normalisiereSprachen({ constructor: { steg: 'de' } }, ['constructor'])).toEqual({ constructor: { steg: 'de' } })
  })

  it('die Sprache des Bogens zieht mit, wenn Tor 5 die Parcoursüberwachung übernimmt – und beim Trennen zurück, je Parcours', () => {
    const z = (parcoursId: string, ...typeIds: string[]) => typeIds.map((typeId) => ({ parcoursId, typeId }))
    let stand = reducer(reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' }), { type: 'SET_AUFBAU', aufbau: 'alcatraz' })
    stand = reducer(stand, { type: 'SET_WKR_SPRACHE', zellen: z('par_2', 'tor5', 'parcours', 'steg'), sprache: 'de' })
    stand = reducer(stand, { type: 'SET_WKR_SPRACHE', zellen: z('par_1', 'tor5'), sprache: 'de+en' })
    const zusammen = reducer(stand, { type: 'SET_TOR5_MIT_PARCOURS', on: true })
    expect(zusammen.wkrSprachen).toEqual({ par_2: { tor5pue: 'de', parcours: 'de', steg: 'de' }, par_1: { tor5pue: 'de+en' } })
    expect(wkrSpracheFuer(zusammen, 'par_2', 'tor5pue')).toBe('de')
    // Am zusammengelegten Bogen umgestellt und wieder getrennt: Tor 5 nimmt die Wahl mit zurück.
    const zweisprachig = reducer(zusammen, { type: 'SET_WKR_SPRACHE', zellen: z('par_2', 'tor5pue'), sprache: 'de+en' })
    expect(reducer(zweisprachig, { type: 'SET_TOR5_MIT_PARCOURS', on: false }).wkrSprachen).toEqual({ par_2: { tor5: 'de+en', parcours: 'de', steg: 'de' }, par_1: { tor5: 'de+en' } })
    // Eine eigene Wahl am Ziel wird nicht überschrieben; ohne Wahl an der alten Liste bleibt alles.
    const beide = reducer(reducer(stand, { type: 'SET_WKR_SPRACHE', zellen: z('par_2', 'tor5pue'), sprache: 'en' }), { type: 'SET_TOR5_MIT_PARCOURS', on: true })
    expect(beide.wkrSprachen.par_2).toMatchObject({ tor5: 'de', tor5pue: 'en' })
    const ohne = reducer(reducer(stand, { type: 'SET_WKR_SPRACHE', zellen: [...z('par_2', 'tor5'), ...z('par_1', 'tor5')], sprache: null }), { type: 'SET_TOR5_MIT_PARCOURS', on: true })
    expect(ohne.wkrSprachen).toEqual({ par_2: { parcours: 'de', steg: 'de' } })
  })

  it('Leerzeilen je Seite (gemeinsame Bögen): 0 bis 30, Unbrauchbares ist die Vorgabe; unabhängig von der Zahl je Klasse', () => {
    const setze = (anzahl: number | null, von = emptyState()) => reducer(von, { type: 'SET_WKR_LEERZEILEN_SEITE', anzahl })
    expect(setze(5).wkrLeerzeilenSeite).toBe(5)
    expect(setze(0).wkrLeerzeilenSeite).toBe(0)
    expect(setze(99).wkrLeerzeilenSeite).toBe(30)
    expect(setze(null, setze(5)).wkrLeerzeilenSeite).toBe(3)
    expect(setze(5)).toMatchObject({ wkrLeerzeilen: 3, wkrLeerzeilenKlasse: {} })
    // Der Wechsel zur Clubmeisterschaft stellt nur die Zahl je Klasse um.
    expect(reducer(emptyState(), { type: 'SET_EVENT_KIND', eventKind: 'club' })).toMatchObject({ wkrLeerzeilen: 1, wkrLeerzeilenSeite: 3 })
  })
})

describe('Listen der Veranstaltung: zusätzliche Listen, Form der Laufzettel', () => {
  it('Vorgaben: getrennte Listen, die Vorgabe des Regelwerks, Laufzettel mit einer Zeile je Seite', () => {
    expect(emptyState()).toMatchObject({ tor5MitParcours: false, zusatzListen: {}, laufzettelLayout: 'seite' })
  })

  it('zusätzliche Listen: Im Stand steht nur, was von der Vorgabe des Regelwerks abweicht', () => {
    const setze = (liste: string, an: boolean, von = emptyState()) => reducer(von, { type: 'SET_ZUSATZ_LISTE', liste, an })
    // Die Knoten sieht das Regelwerk vor: Abwählen ist die Abweichung, Anwählen keine.
    expect(setze('knoten', false).zusatzListen).toEqual({ knoten: false })
    expect(setze('knoten', true, setze('knoten', false)).zusatzListen).toEqual({})
    expect(setze('vorsteg', true).zusatzListen).toEqual({ vorsteg: true })
    expect(setze('vorsteg', false, setze('vorsteg', true)).zusatzListen).toEqual({})
    // Keine Änderung, kein neuer Stand.
    const s = emptyState()
    expect(setze('knoten', true, s)).toBe(s)
    // Die Wahl übersteht den Wechsel von Regelwerk und Aufbau.
    expect(reducer(setze('knoten', false), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' }).zusatzListen).toEqual({ knoten: false })
  })

  it('Form der Laufzettel: eine Zeile je Seite oder je Liste', () => {
    expect(reducer(emptyState(), { type: 'SET_LAUFZETTEL_LAYOUT', layout: 'liste' }).laufzettelLayout).toBe('liste')
    expect(reducer({ ...emptyState(), laufzettelLayout: 'liste' }, { type: 'SET_LAUFZETTEL_LAYOUT', layout: 'quer' as never }).laufzettelLayout).toBe('seite')
  })
})

describe('Logos', () => {
  it('Vorgabe: keine Logos, 15 mm hoch', () => {
    expect(emptyState().logos).toEqual({ links: null, rechts: null })
    expect(emptyState().logoHoeheMm).toBe(15)
  })

  it('SET_LOGO setzt, entfernt und ändert bei Gleichem oder Unbrauchbarem nichts', () => {
    const leer = emptyState()
    const mit = reducer(leer, { type: 'SET_LOGO', seite: 'links', logo: testLogo() })
    expect(mit.logos).toEqual({ links: testLogo(), rechts: null })
    // Das Bild im Stand ist ein eigenes Objekt (geprüft, ohne Zusatzfelder).
    expect(reducer(leer, { type: 'SET_LOGO', seite: 'links', logo: { ...testLogo(), extra: 1 } as never }).logos.links).toEqual(testLogo())
    expect(reducer(mit, { type: 'SET_LOGO', seite: 'links', logo: testLogo() })).toBe(mit)
    expect(reducer(mit, { type: 'SET_LOGO', seite: 'links', logo: { src: 'https://example.org/a.png', breite: 2, hoehe: 1 } })).toBe(mit)
    expect(reducer(mit, { type: 'SET_LOGO', seite: 'mitte' as never, logo: testLogo() })).toBe(mit)
    // Andere Maße sind ein anderes Logo.
    expect(reducer(mit, { type: 'SET_LOGO', seite: 'links', logo: testLogo(4, 1) }).logos.links).toEqual(testLogo(4, 1))
    const beide = reducer(mit, { type: 'SET_LOGO', seite: 'rechts', logo: testSvgLogo() })
    expect(beide.logos.rechts).toEqual(testSvgLogo())
    expect(reducer(beide, { type: 'SET_LOGO', seite: 'links', logo: null }).logos).toEqual({ links: null, rechts: testSvgLogo() })
    expect(reducer(leer, { type: 'SET_LOGO', seite: 'rechts', logo: null })).toBe(leer)
  })

  it('SET_LOGO_HOEHE klemmt auf 8 bis 30 mm; null ist die Vorgabe', () => {
    const s = emptyState()
    expect(reducer(s, { type: 'SET_LOGO_HOEHE', mm: 3 }).logoHoeheMm).toBe(8)
    expect(reducer(s, { type: 'SET_LOGO_HOEHE', mm: 99 }).logoHoeheMm).toBe(30)
    expect(reducer(reducer(s, { type: 'SET_LOGO_HOEHE', mm: 20 }), { type: 'SET_LOGO_HOEHE', mm: null }).logoHoeheMm).toBe(15)
    expect(reducer(s, { type: 'SET_LOGO_HOEHE', mm: 15 })).toBe(s)
    expect(reducer(s, { type: 'SET_LOGO_HOEHE', mm: null })).toBe(s)
  })

  it('wirkt auch bei festgeschriebener Verzahnung und erfassten Werten (keine Sperre)', () => {
    const tracks = { par_1: [[{ kind: 'class' as const, klasse: '4' as const }]] }
    let state = reducer(emptyState(), { type: 'ADD_STARTERS', starters: [starter('a', '4', '401', 'A')] })
    state = reducer(state, { type: 'SET_VERZAHNUNG_LOCK', locked: true, tracks })
    state = reducer(state, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'a', feld: 'zeit1', wert: '80' }] })
    expect(state.verzahnungLocked).toBe(true)
    expect(Object.keys(state.eingaben)).not.toHaveLength(0)
    const mit = reducer(state, { type: 'SET_LOGO', seite: 'rechts', logo: testLogo() })
    expect(mit.logos.rechts).toEqual(testLogo())
    expect(reducer(mit, { type: 'SET_LOGO_HOEHE', mm: 20 }).logoHoeheMm).toBe(20)
  })
})
