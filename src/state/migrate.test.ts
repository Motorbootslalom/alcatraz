import { describe, expect, it } from 'vitest'
import { fromVerzahnungPrototyp, migrate } from './migrate'
import { emptyState } from './reducer'
import { SCHEMA_VERSION } from '../types'
import { testLogo, testSvgLogo } from '../testHilfen'

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

  it('alte Stände tragen noch `parallelInternational` (nationaler Parallelslalom): Das Feld entfällt, der Stand lädt', () => {
    const alt = { ...emptyState(), eventName: 'Pokal', parallelInternational: false }
    const state = migrate(alt)
    expect(state).not.toBeNull()
    expect(state!.eventName).toBe('Pokal')
    expect('parallelInternational' in state!).toBe(false)
    // Auch der Stand des Verzahnungs-Prototyps hatte das Feld.
    expect('parallelInternational' in migrate({ starters: [], parallelInternational: true, parallelOrderByStartNr: true })!).toBe(false)
    expect(migrate({ starters: [], parallelInternational: true, parallelOrderByStartNr: true })!.parallelOrderByStartNr).toBe(true)
  })

  it('„Versuche direkt nacheinander“ fehlt in älteren Ständen: Dann gilt die Vorgabe des Regelwerks', () => {
    expect(migrate({ starters: [] })!.versucheNacheinander).toBe(false)
    // Unter UIM eine Option, die nicht vorgewählt ist.
    expect(migrate({ starters: [], regelwerk: 'uim-2026' })!.versucheNacheinander).toBe(false)
    expect(migrate({ starters: [], regelwerk: 'uim-2026', versucheNacheinander: true })!.versucheNacheinander).toBe(true)
    expect(migrate({ starters: [], regelwerk: 'uim-2026', versucheNacheinander: false })!.versucheNacheinander).toBe(false)
    expect(migrate({ starters: [], regelwerk: 'uim-2026', versucheNacheinander: 'ja' })!.versucheNacheinander).toBe(false)
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

  it('die alte „Sprache der Listen“ entfällt; eine feste Wahl bleibt den Bögen je Liste und Parcours erhalten', () => {
    /** Alle eingetragenen Sprachen, über Parcours und Listen. */
    const sprachen = (w: Record<string, Record<string, string>>) => new Set(Object.values(w).flatMap((l) => Object.values(l)))
    // „Wie die Oberfläche“ gibt es nicht mehr: Es gilt die Sprache des Regelwerks.
    const ui = migrate({ starters: [], regelwerk: 'uim-2026', listenSprache: 'ui' })!
    expect(ui.wkrSprachen).toEqual({})
    expect(ui).not.toHaveProperty('listenSprache')
    // Eine feste Wahl galt für alle Bögen – sie steht jetzt bei jeder Liste des Regelwerks, auf
    // jedem Parcours (hier die beiden der Vorgabe) und beiden Racecourses.
    const fest = migrate({ starters: [], regelwerk: 'uim-2026', listenSprache: 'de+en' })!
    expect(fest).not.toHaveProperty('listenSprache')
    expect(Object.keys(fest.wkrSprachen).sort()).toEqual(['par_1', 'par_2', 'racecourse-a', 'racecourse-b'])
    expect(Object.keys(fest.wkrSprachen.par_1).length).toBeGreaterThan(3)
    expect(sprachen(fest.wkrSprachen)).toEqual(new Set(['de+en']))
    expect(fest.wkrSprachen.par_2).toMatchObject({ steg: 'de+en', knoten: 'de+en' })
    expect(fest.wkrSprachen['racecourse-a']).toMatchObject({ zeit: 'de+en', parallelparcours: 'de+en' })
    // Kennt der Aufrufer die Sprache der Oberfläche, bleibt „wie die Oberfläche“ erhalten: Wer
    // unter UIM deutsch bediente, druckte deutsche Bögen – auch, wenn das Feld noch ganz fehlte.
    for (const alt of [{ listenSprache: 'ui' }, {}]) {
      const deutsch = migrate({ starters: [], regelwerk: 'uim-2026', ...alt }, { oberflaeche: 'de' })!
      expect(deutsch.wkrSprachen.par_1).toMatchObject({ steg: 'de', knoten: 'de' })
      expect(sprachen(deutsch.wkrSprachen)).toEqual(new Set(['de']))
      // Englisch ist unter UIM ohnehin die Vorgabe: nichts einzutragen.
      expect(migrate({ starters: [], regelwerk: 'uim-2026', ...alt }, { oberflaeche: 'en' })!.wkrSprachen).toEqual({})
      expect(migrate({ starters: [], regelwerk: 'dm-2026', ...alt }, { oberflaeche: 'en' })!.wkrSprachen).toEqual({})
    }
    // Eine feste Wahl und ein neuer Stand gehen der Oberfläche vor.
    expect(migrate({ starters: [], regelwerk: 'uim-2026', listenSprache: 'en' }, { oberflaeche: 'de' })!.wkrSprachen.par_1).toMatchObject({ steg: 'en' })
    expect(migrate({ starters: [], regelwerk: 'uim-2026', wkrSprachen: {} }, { oberflaeche: 'de' })!.wkrSprachen).toEqual({})
    // Unter der DM wirkte die Wahl nie: Sie wird nicht übernommen.
    expect(migrate({ starters: [], regelwerk: 'dm-2026', listenSprache: 'en' })!.wkrSprachen).toEqual({})
    expect(migrate({ starters: [], regelwerk: 'uim-2026', listenSprache: 'fr' })!.wkrSprachen).toEqual({})
    // Ein Stand, der schon wählt, gilt – eine liegengebliebene alte Angabe nicht.
    expect(migrate({ starters: [], regelwerk: 'uim-2026', listenSprache: 'de', wkrSprachen: { par_1: { steg: 'en', zeit: 'fr' } } })!.wkrSprachen).toEqual({ par_1: { steg: 'en' } })
  })

  it('Sprache je Liste (bis 15.11.2026) wird Sprache je Parcours und Liste: Der bisherige Wert gilt für jeden Parcours', () => {
    const parcoursList = [
      { id: 'p_a', name: 'Parcours 1', classIds: ['1'], wechselFaktor: 2 },
      { id: 'p_b', name: 'Parcours 2', classIds: ['4'], wechselFaktor: 2 },
    ]
    const stand = migrate({ starters: [], regelwerk: 'uim-2026', parcoursList, wkrSprachen: { steg: 'de', zeit: 'de+en', tor135: 'fr' } })!
    expect(stand.wkrSprachen).toEqual({
      p_a: { steg: 'de', zeit: 'de+en' },
      p_b: { steg: 'de', zeit: 'de+en' },
      // Zeit und Steg galten auch für die Bögen des Parallelslaloms.
      'racecourse-a': { steg: 'de', zeit: 'de+en' },
      'racecourse-b': { steg: 'de', zeit: 'de+en' },
    })
    // Sprachen zu Parcours, die es nicht (mehr) gibt, entfallen wie deren Namen; die der Racecourses bleiben.
    const neu = migrate({ starters: [], parcoursList, wkrSprachen: { p_a: { steg: 'de' }, weg: { steg: 'de' }, 'racecourse-b': { zeit: 'en' } } })!
    expect(neu.wkrSprachen).toEqual({ p_a: { steg: 'de' }, 'racecourse-b': { zeit: 'en' } })
  })

  it('Leerzeilen je Seite: Brauchbares bleibt, Unbrauchbares ist die Vorgabe', () => {
    expect(migrate({ starters: [], wkrLeerzeilenSeite: 5 })!.wkrLeerzeilenSeite).toBe(5)
    expect(migrate({ starters: [], wkrLeerzeilenSeite: 0 })!.wkrLeerzeilenSeite).toBe(0)
    expect(migrate({ starters: [], wkrLeerzeilenSeite: 'drei' })!.wkrLeerzeilenSeite).toBe(3)
  })

  it('Brauchbares bleibt, Unbrauchbares fällt auf die Vorgabe', () => {
    expect(migrate({ starters: [], wkrZeilenJeSeite: 15, wkrTeilenAb: 25, beschriftung: 'pfeile', wkrSprachen: { par_1: { steg: 'de+en' } } })).toMatchObject({
      wkrZeilenJeSeite: 15,
      wkrTeilenAb: 25,
      beschriftung: 'pfeile',
      wkrSprachen: { par_1: { steg: 'de+en' } },
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

describe('migrate: Logos (16.11.2026)', () => {
  it('fehlen in älteren Ständen: keine Logos, Vorgabehöhe', () => {
    expect(migrate({ starters: [] })).toMatchObject({ logos: { links: null, rechts: null }, logoHoeheMm: 15 })
  })

  it('gültige Logos und Höhe bleiben', () => {
    const stand = migrate({ starters: [], logos: { links: testLogo(), rechts: testSvgLogo() }, logoHoeheMm: 20 })
    expect(stand).toMatchObject({ logos: { links: testLogo(), rechts: testSvgLogo() }, logoHoeheMm: 20 })
  })

  it('Unsinn entfällt: fremde Adressen, keine Objekte, Höhe als Text', () => {
    const stand = migrate({ starters: [], logos: { links: { src: 'https://x/y.png', breite: 2, hoehe: 1 }, rechts: 'a' }, logoHoeheMm: '20' })
    expect(stand).toMatchObject({ logos: { links: null, rechts: null }, logoHoeheMm: 15 })
    expect(migrate({ starters: [], logos: 'kaputt', logoHoeheMm: 99 })).toMatchObject({ logos: { links: null, rechts: null }, logoHoeheMm: 30 })
    expect(migrate({ starters: [], logos: { links: { ...testLogo(), breite: 0 } } })?.logos.links).toBeNull()
  })

  it('ein leerer Stand bleibt beim Migrieren gleich', () => {
    expect(migrate(emptyState())).toEqual(emptyState())
  })
})

describe('migrate: Betrieb und Anzeigetafel (16.11.2026)', () => {
  const ref = '["m","a",1]'
  it('fehlen in älteren Ständen: nichts begonnen, Vorgaben der Anzeigetafel', () => {
    const stand = migrate({ starters: [] })!
    expect(stand.betrieb).toEqual({ bereiche: {} })
    expect(stand.anzeige).toEqual(emptyState().anzeige)
    expect(stand.anzeige).toMatchObject({ kopfzeile: null, namen: 'aushang', sprache: 'regelwerk', davor: true })
  })

  it('Gültiges bleibt; Bereiche, die es nicht gibt, und Unbrauchbares entfallen', () => {
    const betrieb = {
      bereiche: {
        par_1: { begonnen: ['lauf:1'], gezeigt: [{ ref, zeit: 1000 }], ohneAnzeige: [], zurueckgestellt: [], reihenfolge: null, ausgesetzt: [], vorziehen: false, meldung: { text: 'Pause', art: 'pause' } },
        par_7: { begonnen: ['lauf:1'] },
        par_2: 'kaputt',
      },
    }
    const anzeige = { ...emptyState().anzeige, kopfzeile: 'Musterregatta', bereiche: ['par_2', 'par_7'], skala: 1.2, namen: 'kurz', abstaende: { E: 50 }, parallelAnordnung: 'b-oben' }
    const stand = migrate({ starters: [], betrieb, anzeige })!
    expect(stand.betrieb).toEqual({ bereiche: { par_1: betrieb.bereiche.par_1 } })
    expect(stand.anzeige).toEqual({ ...anzeige, bereiche: ['par_2'] })
    // Ganz kaputt: die Vorgaben.
    expect(migrate({ starters: [], betrieb: 'x', anzeige: [1] })).toMatchObject({ betrieb: { bereiche: {} }, anzeige: emptyState().anzeige })
    // Unbekannte Lage von A und B (16.11.2026): die Vorgabe, A links; die übrigen Felder bleiben.
    expect(migrate({ starters: [], anzeige: { ...anzeige, parallelAnordnung: 'quer' } })!.anzeige).toMatchObject({ parallelAnordnung: 'a-links', namen: 'kurz', skala: 1.2 })
  })
})

describe('migrate: Server des Gerätebetriebs (E6, 16.11.2026)', () => {
  it('fehlt → Vorgabe des Programms; Adresse vereinheitlicht; Unbrauchbares → Vorgabe', () => {
    expect(migrate({ starters: [] })!.geraeteServer).toBe('')
    expect(migrate({ starters: [], geraeteServer: 'ntfy.example.org/' })!.geraeteServer).toBe('https://ntfy.example.org')
    expect(migrate({ starters: [], geraeteServer: 'http://192.168.1.20:8080' })!.geraeteServer).toBe('http://192.168.1.20:8080')
    for (const kaputt of ['javascript:alert(1)', 'https://nutzer:geheim@ntfy.example.org', 42, null, { u: 'x' }])
      expect(migrate({ starters: [], geraeteServer: kaputt })!.geraeteServer, String(kaputt)).toBe('')
  })
})
