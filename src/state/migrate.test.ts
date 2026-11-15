import { describe, expect, it } from 'vitest'
import { fromVerzahnungPrototyp, migrate } from './migrate'
import { emptyState } from './reducer'
import { SCHEMA_VERSION } from '../types'

describe('migrate', () => {
  it('Beispiel-Starterfeld: fehlt in älteren Ständen, gilt nur mit Startern', () => {
    const starters = [{ id: 'a', klasse: '1', nachname: 'A' }]
    expect(migrate({ starters })!.beispielStarter).toBe(false)
    expect(migrate({ starters, beispielStarter: true })!.beispielStarter).toBe(true)
    expect(migrate({ starters, beispielStarter: 'ja' })!.beispielStarter).toBe(false)
    expect(migrate({ starters: [], beispielStarter: true })!.beispielStarter).toBe(false)
  })

  it('lehnt Unbrauchbares ab', () => {
    expect(migrate(null)).toBeNull()
    expect(migrate('x')).toBeNull()
    expect(migrate({ starters: 'nein' })).toBeNull()
  })

  it('lehnt Stände einer neueren Fassung ab, statt sie zu verstümmeln', () => {
    expect(migrate({ ...emptyState(), schemaVersion: SCHEMA_VERSION + 1 })).toBeNull()
  })

  it('füllt fehlende Felder mit Vorgaben auf', () => {
    const state = migrate({ starters: [{ id: 'a', klasse: '1', nachname: 'A' }], eventName: 'Pokal' })
    expect(state).not.toBeNull()
    expect(state!.eventName).toBe('Pokal')
    expect(state!.laufCount).toBe(3)
    expect(state!.starters[0]).toMatchObject({ id: 'a', klasse: '1', nachname: 'A', vorname: '', groesse: '' })
    expect(state!.boats).toEqual({ klein: 2, gross: 2 })
  })

  it('übernimmt einen Stand des Verzahnungs-Prototyps', () => {
    const state = fromVerzahnungPrototyp({
      eventName: 'Möwepokal',
      eventJahr: 2026,
      originMode: 'bundesland',
      initialized: true,
      participants: [{ id: 'p1', startNr: 'E01', vorname: 'A', nachname: 'B', verein: '', bundesland: 'Berlin', geburtsdatum: '2019-01-01', klasse: 'E' }],
      parcoursList: [{ id: 'x', name: 'Parcours 1', classIds: ['E'], wechselFaktor: 1 }],
      boats: { klein: 3, gross: 1 },
    })
    expect(state).not.toBeNull()
    expect(state!.starters).toHaveLength(1)
    expect(state!.starters[0].groesse).toBe('')
    expect(state!.originMode).toBe('bundesland')
    expect(state!.boats).toEqual({ klein: 3, gross: 1 })
    expect(state).not.toHaveProperty('participants')
    expect(state).not.toHaveProperty('initialized')
  })

  it('behält von gespeicherten Durchschnittsgewichten nur, was vom Regelwerk abweicht', () => {
    const state = migrate({ starters: [], regelwerk: 'dm-2026', sollgewicht: { E: 26, '1': 33, '2': 45 } })
    expect(state!.sollgewicht).toEqual({ '2': 45 })
  })

  it('erkennt fremde Daten nicht als Prototyp-Stand', () => {
    expect(fromVerzahnungPrototyp({ starters: [] })).toBeNull()
  })
})

describe('migrate: Einstellungen der Wettkampfrichter-Listen', () => {
  it('fehlen in älteren Ständen und bekommen die Vorgaben', () => {
    expect(migrate({ starters: [] })).toMatchObject({ wkrLeerzeilen: 3, wkrLeerzeilenKlasse: {}, wkrRueckseite: false })
  })

  it('Unbrauchbares entfällt, Brauchbares bleibt', () => {
    const state = migrate({
      starters: [],
      wkrLeerzeilen: 4,
      wkrLeerzeilenKlasse: { '7': 6, '1': 4, X: 2, '2': 'viele', '3': 99 },
      wkrRueckseite: true,
    })
    expect(state).toMatchObject({ wkrLeerzeilen: 4, wkrLeerzeilenKlasse: { '7': 6, '3': 30 }, wkrRueckseite: true })
    expect(migrate({ starters: [], wkrLeerzeilen: 'drei', wkrLeerzeilenKlasse: [1] })).toMatchObject({ wkrLeerzeilen: 3, wkrLeerzeilenKlasse: {} })
  })
})


describe('migrate: Listenoptionen (Seitenaufteilung, Bojen-Seiten, Sprache)', () => {
  it('fehlen in älteren Ständen und bekommen die Vorgaben', () => {
    expect(migrate({ starters: [] })).toMatchObject({ wkrZeilenJeSeite: 0, wkrTeilenAb: 0, beschriftung: 'rl', wkrSprachen: {}, wkrLeerzeilenSeite: 3 })
  })

  it('die alte „Sprache der Listen“ entfällt; eine feste Wahl bleibt den Bögen je Liste erhalten', () => {
    // „Wie die Oberfläche“ gibt es nicht mehr: Es gilt die Sprache des Regelwerks.
    const ui = migrate({ starters: [], regelwerk: 'uim-2026', listenSprache: 'ui' })!
    expect(ui.wkrSprachen).toEqual({})
    expect(ui).not.toHaveProperty('listenSprache')
    // Eine feste Wahl galt für alle Bögen – sie steht jetzt bei jeder Liste des Regelwerks.
    const fest = migrate({ starters: [], regelwerk: 'uim-2026', listenSprache: 'de+en' })!
    expect(fest).not.toHaveProperty('listenSprache')
    expect(Object.keys(fest.wkrSprachen).length).toBeGreaterThan(3)
    expect(new Set(Object.values(fest.wkrSprachen))).toEqual(new Set(['de+en']))
    expect(fest.wkrSprachen).toMatchObject({ steg: 'de+en', knoten: 'de+en' })
    // Kennt der Aufrufer die Sprache der Oberfläche, bleibt „wie die Oberfläche“ erhalten: Wer
    // unter UIM deutsch bediente, druckte deutsche Bögen – auch, wenn das Feld noch ganz fehlte.
    for (const alt of [{ listenSprache: 'ui' }, {}]) {
      const deutsch = migrate({ starters: [], regelwerk: 'uim-2026', ...alt }, { oberflaeche: 'de' })!
      expect(deutsch.wkrSprachen).toMatchObject({ steg: 'de', knoten: 'de' })
      expect(new Set(Object.values(deutsch.wkrSprachen))).toEqual(new Set(['de']))
      // Englisch ist unter UIM ohnehin die Vorgabe: nichts einzutragen.
      expect(migrate({ starters: [], regelwerk: 'uim-2026', ...alt }, { oberflaeche: 'en' })!.wkrSprachen).toEqual({})
      expect(migrate({ starters: [], regelwerk: 'dm-2026', ...alt }, { oberflaeche: 'en' })!.wkrSprachen).toEqual({})
    }
    // Eine feste Wahl und ein neuer Stand gehen der Oberfläche vor.
    expect(migrate({ starters: [], regelwerk: 'uim-2026', listenSprache: 'en' }, { oberflaeche: 'de' })!.wkrSprachen).toMatchObject({ steg: 'en' })
    expect(migrate({ starters: [], regelwerk: 'uim-2026', wkrSprachen: {} }, { oberflaeche: 'de' })!.wkrSprachen).toEqual({})
    // Unter der DM wirkte die Wahl nie: Sie wird nicht übernommen.
    expect(migrate({ starters: [], regelwerk: 'dm-2026', listenSprache: 'en' })!.wkrSprachen).toEqual({})
    expect(migrate({ starters: [], regelwerk: 'uim-2026', listenSprache: 'fr' })!.wkrSprachen).toEqual({})
    // Ein Stand, der schon je Liste wählt, gilt – eine liegengebliebene alte Angabe nicht.
    expect(migrate({ starters: [], regelwerk: 'uim-2026', listenSprache: 'de', wkrSprachen: { steg: 'en', zeit: 'fr' } })!.wkrSprachen).toEqual({ steg: 'en' })
  })

  it('Leerzeilen je Seite: Brauchbares bleibt, Unbrauchbares ist die Vorgabe', () => {
    expect(migrate({ starters: [], wkrLeerzeilenSeite: 5 })!.wkrLeerzeilenSeite).toBe(5)
    expect(migrate({ starters: [], wkrLeerzeilenSeite: 0 })!.wkrLeerzeilenSeite).toBe(0)
    expect(migrate({ starters: [], wkrLeerzeilenSeite: 'drei' })!.wkrLeerzeilenSeite).toBe(3)
  })

  it('Brauchbares bleibt, Unbrauchbares fällt auf die Vorgabe', () => {
    expect(migrate({ starters: [], wkrZeilenJeSeite: 15, wkrTeilenAb: 25, beschriftung: 'pfeile', wkrSprachen: { steg: 'de+en' } })).toMatchObject({
      wkrZeilenJeSeite: 15,
      wkrTeilenAb: 25,
      beschriftung: 'pfeile',
      wkrSprachen: { steg: 'de+en' },
    })
    expect(migrate({ starters: [], wkrZeilenJeSeite: 3, wkrTeilenAb: -1, beschriftung: 7, wkrSprachen: 'fr' })).toMatchObject({
      wkrZeilenJeSeite: 5,
      wkrTeilenAb: 0,
      beschriftung: 'rl',
      wkrSprachen: {},
    })
    expect(migrate({ starters: [], wkrZeilenJeSeite: 'viele', wkrTeilenAb: null, beschriftung: 'xx' })).toMatchObject({ wkrZeilenJeSeite: 0, wkrTeilenAb: 0, beschriftung: 'rl' })
  })
})

describe('migrate: Listen der Veranstaltung und Form der Laufzettel', () => {
  it('fehlen in älteren Ständen und bekommen die Vorgaben – damit die Knoten-Liste des Regelwerks', () => {
    expect(migrate({ starters: [] })).toMatchObject({ tor5MitParcours: false, zusatzListen: {}, laufzettelLayout: 'seite' })
  })

  it('Brauchbares bleibt, Unbrauchbares fällt auf die Vorgabe', () => {
    expect(migrate({ starters: [], tor5MitParcours: true, zusatzListen: { knoten: false, vorsteg: true }, laufzettelLayout: 'liste' })).toMatchObject({
      tor5MitParcours: true,
      zusatzListen: { knoten: false, vorsteg: true },
      laufzettelLayout: 'liste',
    })
    expect(migrate({ starters: [], tor5MitParcours: 'ja', zusatzListen: ['knoten'], laufzettelLayout: 3 })).toMatchObject({ tor5MitParcours: false, zusatzListen: {}, laufzettelLayout: 'seite' })
    expect(migrate({ starters: [], zusatzListen: { knoten: 'nein', vorsteg: true } })?.zusatzListen).toEqual({ vorsteg: true })
  })
})
