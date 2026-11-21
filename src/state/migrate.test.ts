import { describe, expect, it } from 'vitest'
import { fromVerzahnungPrototyp, migrate, teileAlteFinals } from './migrate'
import { emptyState, reducer } from './reducer'
import { SCHEMA_VERSION, type AppState, type ParallelRunde } from '../types'
import { fahreRunde, parallelStarter, testLogo, testSvgLogo, uimParallelStand } from '../testHilfen'
import { configFor } from '../config/konfig'
import { klassenStand } from '../lib/parallelStage'

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

  it('WKR-Rückstand (W2, 21.11.2026): Vorgabe 2/warnen, begrenzt auf 1–20, Unbekanntes wird die Vorgabe', () => {
    expect(migrate({ starters: [] })!.anzeige).toMatchObject({ wkrRueckstand: 2, wkrWarnung: 'warnen' })
    expect(migrate({ starters: [], anzeige: { wkrRueckstand: 5, wkrWarnung: 'nachfragen' } })!.anzeige).toMatchObject({ wkrRueckstand: 5, wkrWarnung: 'nachfragen' })
    expect(migrate({ starters: [], anzeige: { wkrRueckstand: 99, wkrWarnung: 'sperren' } })!.anzeige).toMatchObject({ wkrRueckstand: 20, wkrWarnung: 'warnen' })
    expect(migrate({ starters: [], anzeige: { wkrRueckstand: 0 } })!.anzeige.wkrRueckstand).toBe(1)
    expect(migrate({ starters: [], anzeige: { wkrRueckstand: 'drei' } })!.anzeige.wkrRueckstand).toBe(2)
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

describe('migrate: Kleines Finale und Finale getrennt (21.11.2026)', () => {
  // Erfundene Starter (testHilfen.parallelStarter). Ein Stand nach dem Halbfinale mit beiden Finals, wie ihn die App
  // heute schreibt – und daraus der Stand bis 21.11.2026: EINE Runde `final`, das Kleine Finale mit `finale: 3` vorn.
  const VORLAUF6 = { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43], '1-5': [50, 50], '1-6': [55, 55] }
  const fest = (s: AppState, runde: ParallelRunde) => reducer(s, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde })
  function neu(): AppState {
    let s = fahreRunde(uimParallelStand(parallelStarter('1', 6)), 'pre', VORLAUF6)
    s = fahreRunde(fest(s, 'semi'), 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    s = fest(fest(s, 'small'), 'final')
    s = fahreRunde(s, 'small', { '1-3': [30, 30], '1-4': [44, 45] })
    return fahreRunde(s, 'final', { '1-1': [41] })
  }
  const kennung = (runde: string, attempt: number, a: string, b: string) => JSON.stringify(['p', runde, attempt, a, b])
  /** Der alte Stand zu `n`: Kleines Finale und Finale in EINEM Plan, Werte unter `parallel:final/…`. */
  function alt(n: AppState): Record<string, unknown> {
    const { small, final, ...plaene } = n.parallelPlaene
    const versatz = Math.max(...small!.starts.map((s) => s.block)) + 1
    const { 'parallel:small/1': k1, 'parallel:small/2': k2, 'parallel:final/1': f1, 'parallel:final/2': f2, ...eingaben } = n.eingaben
    return {
      ...JSON.parse(JSON.stringify(n)),
      parallelPlaene: {
        ...plaene,
        final: { runde: 'final', starts: [...small!.starts.map((s) => ({ ...s, finale: 3 })), ...final!.starts.map((s) => ({ ...s, block: s.block + versatz, finale: 1 }))] },
      },
      eingaben: { ...eingaben, 'parallel:final/1': { ...k1, ...f1 }, 'parallel:final/2': { ...k2, ...f2 } },
      parallelGedruckt: { final: 1234 },
      betrieb: {
        bereiche: {
          parallel: {
            begonnen: ['runde:pre', 'runde:semi', 'runde:final'],
            gezeigt: [{ ref: kennung('final', 1, '1-3', '1-4'), zeit: 5000 }],
            ohneAnzeige: [kennung('semi', 1, '1-1', '1-2')],
            zurueckgestellt: [kennung('final', 1, '1-1', '1-2')],
            reihenfolge: [kennung('final', 2, '1-4', '1-3'), kennung('final', 1, '1-1', '1-2')],
            ausgesetzt: [],
            vorziehen: false,
            meldung: null,
          },
        },
      },
      listenStand: { 'parallel:final/1/gesamt': { inhalt: 7, zeit: 99 }, 'parallel:semi/1/gesamt': { inhalt: 8, zeit: 98 } },
    }
  }

  it('teilt den alten Plan sauber auf: Werte, Druckvermerk, „begonnen“ und Kennungen ziehen mit', () => {
    const n = neu()
    const m = migrate(alt(n))!
    expect(m.parallelPlaene).toEqual(n.parallelPlaene)
    for (const k of ['parallel:small/1', 'parallel:small/2', 'parallel:final/1']) expect(m.eingaben[k], k).toEqual(n.eingaben[k])
    expect(m.eingaben['parallel:final/2']).toBeUndefined()
    expect(m.parallelGedruckt).toEqual({ small: 1234, final: 1234 })
    const b = m.betrieb.bereiche.parallel
    // Gezeigt war nur ein Start des Kleinen Finales: begonnen ist nur das Kleine Finale (21.11.2026).
    expect(b.begonnen).toEqual(['runde:pre', 'runde:semi', 'runde:small'])
    expect(b.gezeigt.map((g) => g.ref)).toEqual([kennung('small', 1, '1-3', '1-4')])
    expect(b.ohneAnzeige).toEqual([kennung('semi', 1, '1-1', '1-2')])
    expect(b.zurueckgestellt).toEqual([kennung('final', 1, '1-1', '1-2')])
    // Eine händische Reihenfolge mit Starts des Kleinen Finales entfällt.
    expect(b.reihenfolge).toBeNull()
    expect(Object.keys(m.listenStand)).toEqual(['parallel:semi/1/gesamt'])
    // Der Stand rechnet weiter: Kleines Finale fertig, Finale läuft.
    const konfig = configFor({ regelwerk: 'uim-2026' })
    expect(klassenStand(m, konfig, '1')!.runden.map((r) => [r.runde, r.zustand, r.veraltet])).toEqual([
      ['pre', 'fertig', false],
      ['semi', 'fertig', false],
      ['small', 'fertig', false],
      ['final', 'laeuft', false],
    ])
  })

  it('„begonnen“: das Finale nur, wenn schon einer seiner Starts gezeigt oder ohne Anzeige erledigt ist', () => {
    const begonnen = (mit: (b: Record<string, unknown[]>) => void) => {
      const roh = alt(neu())
      mit((roh.betrieb as { bereiche: { parallel: Record<string, unknown[]> } }).bereiche.parallel)
      return migrate(roh)!.betrieb.bereiche.parallel.begonnen
    }
    expect(begonnen((b) => b.gezeigt.push({ ref: kennung('final', 1, '1-1', '1-2'), zeit: 6000 }))).toEqual(['runde:pre', 'runde:semi', 'runde:small', 'runde:final'])
    expect(begonnen((b) => b.ohneAnzeige.push(kennung('final', 1, '1-1', '1-2')))).toEqual(['runde:pre', 'runde:semi', 'runde:small', 'runde:final'])
    // Schon `runde:small` darin (zweimal angewandt o. Ä.): nicht doppelt.
    expect(begonnen((b) => b.begonnen.push('runde:small'))).toEqual(['runde:pre', 'runde:semi', 'runde:small'])
  })

  it('ein Start ohne `finale` ist nicht sauber: die alte Runde `final` entfällt samt Werten, ohne Absturz', () => {
    const roh = alt(neu())
    const plaene = roh.parallelPlaene as { final: { starts: Record<string, unknown>[] } }
    delete plaene.final.starts[0].finale
    const m = migrate(roh)!
    expect(Object.keys(m.parallelPlaene).sort()).toEqual(['pre', 'semi'])
    expect(Object.keys(m.eingaben).filter((k) => k.startsWith('parallel:final') || k.startsWith('parallel:small'))).toEqual([])
    expect(m.parallelGedruckt).toEqual({})
    const b = m.betrieb.bereiche.parallel
    expect(b.begonnen).not.toContain('runde:final')
    expect([b.gezeigt, b.zurueckgestellt, b.reihenfolge]).toEqual([[], [], null])
    expect(m.listenStand['parallel:final/1/gesamt']).toBeUndefined()
    // Aus dem Halbfinale stehen beide Finals neu an.
    expect(klassenStand(m, configFor({ regelwerk: 'uim-2026' }), '1')!.schritte.map((s) => s.runde)).toEqual(['small', 'final'])
  })

  it('Müll stürzt nicht ab: kaputte Starts, unbekanntes `finale`, doppelte Paare oder Starter in beiden Finals', () => {
    const basis = alt(neu())
    const mit = (final: unknown) => migrate({ ...basis, parallelPlaene: { ...(basis.parallelPlaene as object), final } })
    for (const final of [{ starts: 'x' }, { starts: [null, 3] }, { starts: [{ a: '1-1', b: '1-2', attempt: 1, block: 0, boot: 'klein', klasse: '1', finale: 7 }] }, 'kaputt', null]) {
      const m = mit(final)
      expect(m, JSON.stringify(final)).not.toBeNull()
      expect(m!.parallelPlaene.final, JSON.stringify(final)).toBeUndefined()
      expect(m!.parallelPlaene.small).toBeUndefined()
    }
    // Derselbe Starter in beiden Finals: nicht aufteilbar.
    const doppelt = [
      { a: '1-1', b: '1-2', attempt: 1, block: 0, boot: 'klein', klasse: '1', finale: 3 },
      { a: '1-1', b: '1-3', attempt: 1, block: 1, boot: 'klein', klasse: '1', finale: 1 },
    ]
    expect(mit({ runde: 'final', starts: doppelt })!.parallelPlaene).not.toHaveProperty('final')
    // Zwei Paare einer Klasse im selben Finale: nicht aufteilbar.
    const zweiPaare = [
      { a: '1-1', b: '1-2', attempt: 1, block: 0, boot: 'klein', klasse: '1', finale: 1 },
      { a: '1-3', b: '1-4', attempt: 1, block: 1, boot: 'klein', klasse: '1', finale: 1 },
    ]
    expect(mit({ runde: 'final', starts: zweiPaare })!.parallelPlaene).not.toHaveProperty('final')
    // Gibt es schon ein Kleines Finale, wird nicht aufgeteilt (verworfen wird nur das alte `final`).
    const schon = migrate({ ...basis, parallelPlaene: { ...(basis.parallelPlaene as object), small: { runde: 'small', starts: [] } } })!
    expect(schon.parallelPlaene.final).toBeUndefined()
    // Kein Absturz bei Unsinn außen herum.
    expect(teileAlteFinals({ parallelPlaene: { final: { starts: [{ finale: 3, klasse: '1', a: 'x', b: null, attempt: 1 }] } }, eingaben: 5, betrieb: 'x', listenStand: [] })).toBeTruthy()
  })

  it('nur das Finale (zwei Gewertete, kein Kleines Finale): bleibt `final`, ohne `finale`', () => {
    const roh = {
      starters: parallelStarter('1', 2),
      parallelPlaene: {
        final: {
          runde: 'final',
          starts: [
            { a: '1-1', b: '1-2', attempt: 1, block: 3, boot: 'klein', klasse: '1', finale: 1 },
            { a: '1-2', b: '1-1', attempt: 2, block: 3, boot: 'klein', klasse: '1', finale: 1 },
          ],
        },
      },
      eingaben: { 'parallel:final/1': { '1-1': { zeit1: '40,00' } } },
    }
    const m = migrate(roh)!
    expect(m.parallelPlaene).toEqual({
      final: {
        runde: 'final',
        starts: [
          { a: '1-1', b: '1-2', attempt: 1, block: 0, boot: 'klein', klasse: '1' },
          { a: '1-2', b: '1-1', attempt: 2, block: 0, boot: 'klein', klasse: '1' },
        ],
      },
    })
    expect(m.eingaben['parallel:final/1']).toEqual({ '1-1': { zeit1: '40,00' } })
  })

  it('zweimal angewandt ändert nichts; ein neuer Stand bleibt dieselbe Referenz', () => {
    const einmal = teileAlteFinals(alt(neu()))
    expect(teileAlteFinals(einmal)).toBe(einmal)
    const n = JSON.parse(JSON.stringify(neu()))
    expect(teileAlteFinals(n)).toBe(n)
    const m = migrate(alt(neu()))!
    expect(migrate(JSON.parse(JSON.stringify(m)))).toEqual(m)
  })
})

describe('migrate: digitale WKR-Erfassung (W1, 21.11.2026)', () => {
  const liste = JSON.stringify(['l', 'par_1', 'gate135', null])
  const rf = (starter: string, mehr: object = {}) => ({
    id: `g1.1|manoevrieren/1|${starter}|t1a|hin seiteA`,
    zeile: 'g1.1',
    liste,
    ref: JSON.stringify(['m', starter, 1]),
    lauf: 'manoevrieren/1',
    weitere: [],
    starter,
    feld: 't1a|hin seiteA',
    wert: '5',
    steht: '10',
    grund: 'zelle',
    haken: ['erfasst@gate135'],
    zeit: 5000,
    ...mehr,
  })
  const starters = [{ id: 'a', klasse: '1', nachname: 'Nach1' }]

  it('fehlt oder kaputt → leer', () => {
    const leer = { listen: {}, rueckfragen: [], vorschlaege: [], abschluss: {} }
    expect(migrate({ starters })!.wkr).toEqual(leer)
    for (const kaputt of ['x', 7, null, [], { listen: 'x', rueckfragen: {}, vorschlaege: 3, abschluss: [] }]) expect(migrate({ starters, wkr: kaputt })!.wkr).toEqual(leer)
  })

  it('Gültiges bleibt; Unbrauchbares entfällt einzeln; fremde Starter fallen weg', () => {
    const wkr = {
      listen: {
        [liste]: { modus: 'digital', status: 'pausiert', seit: 100, pausen: [{ von: 200, bis: null, papier: ['k'] }, { von: 'x' }] },
        kaputt: { modus: 'digital', status: 'aktiv', seit: 0, pausen: [] },
        [JSON.stringify(['l', 'par_1', 'tor5', null])]: { modus: 'analog', status: 'aktiv', seit: 0, pausen: [] },
      },
      rueckfragen: [rf('a'), rf('weg'), rf('a', { grund: 'anders' }), rf('a', { haken: ['kein-haken'] }), rf('a')],
      vorschlaege: [
        { id: 'g1.2', liste, ref: 'r', lauf: 'manoevrieren/1', weitere: [], starter: 'a', zellen: [{ feld: 'f', wert: '5' }], haken: [], grund: 'papier', zeit: 1 },
        { id: 'g1.3', liste, ref: 'r', lauf: 'manoevrieren/1', weitere: [], starter: 'weg', zellen: [], haken: [], grund: 'papier', zeit: 1 },
        { id: 'g1.4', liste, ref: 'r', lauf: 'kaputt', weitere: [], starter: 'a', zellen: [], haken: [], grund: 'papier', zeit: 1 },
      ],
      abschluss: { [liste]: { 'lauf:1': { name: 'Vor1', zeit: 9, abweichend: [], papier: ['k'] }, 'lauf:x': { name: 'Vor1', zeit: 9, abweichend: [], papier: [] } }, kaputt: {} },
    }
    expect(migrate({ starters, wkr })!.wkr).toEqual({
      listen: { [liste]: { modus: 'digital', status: 'pausiert', seit: 100, pausen: [{ von: 200, bis: null, papier: ['k'] }] } },
      rueckfragen: [rf('a')],
      vorschlaege: [wkr.vorschlaege[0]],
      abschluss: { [liste]: { 'lauf:1': { name: 'Vor1', zeit: 9, abweichend: [], papier: ['k'] } } },
    })
  })

  it('Steg (F16): Status je Teil, Abschluss je Teil (Punkt|Teil), Rückfrage `start` mit Vereinigung – Teile nur bei geteilten Listen', () => {
    const steg = JSON.stringify(['l', 'par_1', 'steg', null])
    const wkr = {
      listen: {
        [steg]: { modus: 'digital', status: 'aktiv', seit: 1, pausen: [], teile: { ab: { status: 'abgemeldet', pausen: [{ von: 2, bis: null, papier: ['k'] }] }, an: { status: 'weg', pausen: [] }, mitte: { status: 'aktiv', pausen: [] } } },
        [liste]: { modus: 'digital', status: 'aktiv', seit: 1, pausen: [], teile: { ab: { status: 'pausiert', pausen: [] } } },
      },
      rueckfragen: [rf('a', { id: 'x1', grund: 'start', vereinige: { vorher: '' } }), rf('a', { id: 'x2', vereinige: { vorher: '' } }), rf('a', { id: 'x3', grund: 'start', vereinige: { vorher: 5 } })],
      abschluss: {
        [steg]: { 'lauf:1|ab': { name: 'Vor1', zeit: 9, abweichend: [], papier: [] }, 'lauf:1|mitte': { name: 'Vor1', zeit: 9, abweichend: [], papier: [] } },
        [liste]: { 'lauf:1|ab': { name: 'Vor1', zeit: 9, abweichend: [], papier: [] }, 'lauf:1': { name: 'Vor2', zeit: 9, abweichend: [], papier: [] } },
      },
    }
    const m = migrate({ starters, wkr })!.wkr
    expect(m.listen[steg]).toEqual({ modus: 'digital', status: 'aktiv', seit: 1, pausen: [], teile: { ab: { status: 'abgemeldet', pausen: [{ von: 2, bis: null, papier: ['k'] }] } } })
    expect(m.listen[liste]).toEqual({ modus: 'digital', status: 'aktiv', seit: 1, pausen: [] })
    expect(m.rueckfragen.map((r) => [r.id, r.vereinige])).toEqual([
      ['x1', { vorher: '' }],
      ['x2', undefined],
      ['x3', undefined],
    ])
    expect(m.abschluss).toEqual({ [steg]: { 'lauf:1|ab': { name: 'Vor1', zeit: 9, abweichend: [], papier: [] } }, [liste]: { 'lauf:1': { name: 'Vor2', zeit: 9, abweichend: [], papier: [] } } })
  })

  it('ein Stand aus dem Reducer übersteht Speichern und Laden', () => {
    const s = reducer(emptyState(), { type: 'WKR_LISTE', liste, modus: 'beides', zeit: 100 })
    expect(migrate(JSON.parse(JSON.stringify(s)))!.wkr).toEqual(s.wkr)
  })
})

describe('migrate: „Papier ab“ der WKR-Erfassung (W2, 21.11.2026)', () => {
  it('`ab` bleibt nur als gültige Start-Kennung; sonst fällt nur `ab` weg, die Pause bleibt', () => {
    const liste = JSON.stringify(['l', 'par_1', 'gate135', null])
    const ab = JSON.stringify(['m', 'a', 1])
    const wkr = {
      listen: {
        [liste]: {
          modus: 'digital',
          status: 'abgemeldet',
          seit: 100,
          pausen: [
            { von: 200, bis: 300, papier: [], ab: 'kaputt' },
            { von: 400, bis: null, papier: [ab], ab },
          ],
        },
      },
    }
    expect(migrate({ starters: [{ id: 'a', klasse: '1', nachname: 'Nach1' }], wkr })!.wkr.listen[liste].pausen).toEqual([
      { von: 200, bis: 300, papier: [] },
      { von: 400, bis: null, papier: [ab], ab },
    ])
  })
})
