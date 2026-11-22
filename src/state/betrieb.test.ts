import { describe, expect, it } from 'vitest'
import { emptyState, reducer, type Action } from './reducer'
import { refKey, lage } from '../betrieb/folge'
import { laufSchluessel } from '../lib/eingaben'
import { betriebsStand, festgeschrieben, zeigeNaechsten } from '../testHilfen'
import { MELDUNG_MAX, normalisiereAnzeige, normalisiereBetrieb } from './reducer/betrieb'
import type { AppState } from '../types'

// Die Actions des Betriebs (Anzeigetafel, Start-Freigabe): bedingt bzw. idempotent, unverändert = derselbe
// Stand, rein und deterministisch. Alle Starter sind erfunden (Vor<id>/Nach<id>, Musterclub).

const P1 = 'par_1'
const P2 = 'par_2'
const m = (starter: string, lauf: number) => refKey({ art: 'm', starter, lauf })
const fest = () => festgeschrieben(betriebsStand())
const beginne = (s: AppState, lauf = 1, bereich = P1) => reducer(s, { type: 'BETRIEB_BEGINNEN', bereich, punkt: `lauf:${lauf}`, zeit: 500 })

describe('Betrieb: Lauf beginnen und Starts zeigen', () => {
  it('gesperrt ohne festgeschriebene Verzahnung – derselbe Stand', () => {
    const offen = betriebsStand()
    expect(beginne(offen)).toBe(offen)
    const ref = lage(offen, P1).folge[0].key
    expect(reducer(offen, { type: 'BETRIEB_ZEIGEN', bereich: P1, ref, vorher: null })).toBe(offen)
    // Wird die Verzahnung im Betrieb gelöst, geht es nicht weiter – zurück und Meldungen schon.
    let s = zeigeNaechsten(beginne(fest()), P1)
    s = reducer(s, { type: 'SET_VERZAHNUNG_LOCK', locked: false })
    expect(zeigeNaechsten(s, P1)).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_ZURUECK', bereich: P1, ref: m('e1', 1) }).betrieb.bereiche[P1].gezeigt).toEqual([])
  })

  it('beginnen: nur Punkte des Programms, jeder einmal', () => {
    const s = beginne(fest())
    expect(s.betrieb.bereiche[P1].begonnen).toEqual(['lauf:1'])
    expect(beginne(s)).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:4' })).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: 'gibt-es-nicht', punkt: 'lauf:1' })).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'runde:pre' })).toBe(s)
    // Der andere Parcours ist unabhängig.
    expect(beginne(s, 1, P2).betrieb.bereiche[P2].begonnen).toEqual(['lauf:1'])
  })

  it('zeigen: vergleichen, dann setzen – doppelt geschickt ist ein Schritt; die Zeit kommt mit der Action', () => {
    const s = beginne(fest())
    const zeige = { type: 'BETRIEB_ZEIGEN', bereich: P1, ref: m('e1', 1), vorher: null, zeit: 1234 } as const
    const einmal = reducer(s, zeige)
    expect(einmal.betrieb.bereiche[P1].gezeigt).toEqual([{ ref: m('e1', 1), zeit: 1234 }])
    expect(reducer(einmal, zeige)).toBe(einmal)
    // Wer noch den alten Stand sah (vorher = null), schaltet den Nächsten nicht weiter.
    expect(reducer(einmal, { ...zeige, ref: m('k1', 1) })).toBe(einmal)
    const zwei = reducer(einmal, { ...zeige, ref: m('k1', 1), vorher: m('e1', 1), zeit: 2000 })
    expect(zwei.betrieb.bereiche[P1].gezeigt.map((g) => g.ref)).toEqual([m('e1', 1), m('k1', 1)])
    // Nie ein schon erledigter, nie einer, den es nicht gibt. Gezielt (E2, B-5) geht jeder andere offene Start,
    // auch einer aus Lauf 2 – siehe betrieb/schritte.test.ts.
    expect(reducer(zwei, { ...zeige, ref: m('e1', 1), vorher: m('k1', 1) })).toBe(zwei)
    expect(reducer(zwei, { ...zeige, ref: m('x9', 1), vorher: m('k1', 1) })).toBe(zwei)
    const gezielt = reducer(zwei, { ...zeige, ref: m('e1', 2), vorher: m('k1', 1) })
    expect([lage(gezielt, P1).aktuell?.key, lage(gezielt, P1).naechster?.key]).toEqual([m('e1', 2), m('e2', 1)])
    // Ohne Zeit (Tests, alte Wege) steht 0 – der Reducer fragt keine Uhr.
    const ohneZeit = reducer(s, { type: 'BETRIEB_ZEIGEN', bereich: P1, ref: m('e1', 1), vorher: null })
    expect(ohneZeit.betrieb.bereiche[P1].gezeigt[0].zeit).toBe(0)
  })

  it('zurück: nur mit passendem ref, dann ist der vorige wieder im Boot', () => {
    const s = zeigeNaechsten(zeigeNaechsten(beginne(fest()), P1), P1)
    expect(reducer(s, { type: 'BETRIEB_ZURUECK', bereich: P1, ref: m('e1', 1) })).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_ZURUECK', bereich: P2, ref: m('k1', 1) })).toBe(s)
    const zurueck = reducer(s, { type: 'BETRIEB_ZURUECK', bereich: P1, ref: m('k1', 1) })
    expect(lage(zurueck, P1).aktuell?.key).toBe(m('e1', 1))
    expect(lage(zurueck, P1).naechster?.key).toBe(m('k1', 1))
    // Doppelt geschickt: der zweite trifft nicht mehr.
    expect(reducer(zurueck, { type: 'BETRIEB_ZURUECK', bereich: P1, ref: m('k1', 1) })).toBe(zurueck)
  })

  it('Betrieb ändert keine Werte und keine Wertungsliste; „Werte löschen“ lässt ihn stehen, Zurücksetzen nicht', () => {
    let s = reducer(beginne(fest()), { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'e1', feld: 'zeit1', wert: '80' }], zeit: 100 })
    const vorher = s
    s = zeigeNaechsten(s, P1, 2000)
    expect([s.eingaben, s.listenStand, s.starters]).toEqual([vorher.eingaben, vorher.listenStand, vorher.starters])
    expect(s.eingaben).toBe(vorher.eingaben)
    expect(s.listenStand).toBe(vorher.listenStand)
    const geloescht = reducer(s, { type: 'CLEAR_EINGABEN' })
    expect(geloescht.betrieb).toBe(s.betrieb)
    expect(reducer(s, { type: 'RESET_ALL' }).betrieb).toEqual({ bereiche: {} })
  })
})

describe('Betrieb: Meldungen und Zurücksetzen', () => {
  it('Meldung je Bereich oder für alle; gleiche Meldung = derselbe Stand; leer löscht', () => {
    const s = fest()
    const stoerung = { text: '  Boot defekt  ', art: 'stoerung' } as const
    const eine = reducer(s, { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: stoerung })
    expect(eine.betrieb.bereiche[P1].meldung).toEqual({ text: 'Boot defekt', art: 'stoerung' })
    expect(eine.betrieb.bereiche[P2]).toBeUndefined()
    expect(reducer(eine, { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: { text: 'Boot defekt', art: 'stoerung' } })).toBe(eine)
    const alle = reducer(eine, { type: 'BETRIEB_MELDUNG', bereich: '*', meldung: { text: 'Mittagspause', art: 'pause' } })
    expect([alle.betrieb.bereiche[P1].meldung?.text, alle.betrieb.bereiche[P2].meldung?.text]).toEqual(['Mittagspause', 'Mittagspause'])
    const weg = reducer(alle, { type: 'BETRIEB_MELDUNG', bereich: '*', meldung: null })
    // Ohne Meldung ist in beiden Bereichen nichts mehr geschehen: Ihre Einträge fallen weg (wie beim Laden).
    expect(weg.betrieb.bereiche).toEqual({})
    expect(reducer(weg, { type: 'BETRIEB_MELDUNG', bereich: '*', meldung: null })).toBe(weg)
    // Leerer Text löscht, zu lang wird gekürzt, unbekannte Art ist ein Hinweis, unbekannter Bereich nichts.
    expect(reducer(eine, { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: { text: '   ', art: 'info' } }).betrieb.bereiche[P1]?.meldung ?? null).toBeNull()
    const lang = reducer(s, { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: { text: 'x'.repeat(500), art: 'laut' as 'info' } })
    expect([lang.betrieb.bereiche[P1].meldung?.text.length, lang.betrieb.bereiche[P1].meldung?.art]).toEqual([MELDUNG_MAX, 'info'])
    expect(reducer(s, { type: 'BETRIEB_MELDUNG', bereich: 'gibt-es-nicht', meldung: stoerung })).toBe(s)
  })

  it('zurücksetzen: einen Bereich oder alle; schon leer = derselbe Stand', () => {
    const s = beginne(beginne(fest()), 1, P2)
    const einer = reducer(s, { type: 'BETRIEB_ZURUECKSETZEN', bereich: P1 })
    expect(Object.keys(einer.betrieb.bereiche)).toEqual([P2])
    expect(reducer(einer, { type: 'BETRIEB_ZURUECKSETZEN', bereich: P1 })).toBe(einer)
    const alle = reducer(s, { type: 'BETRIEB_ZURUECKSETZEN' })
    expect(alle.betrieb).toEqual({ bereiche: {} })
    expect(reducer(alle, { type: 'BETRIEB_ZURUECKSETZEN' })).toBe(alle)
    // „constructor“ ist kein Bereich – auch nicht über das Urbild des Objekts.
    expect(reducer(alle, { type: 'BETRIEB_ZURUECKSETZEN', bereich: 'constructor' })).toBe(alle)
  })
})

describe('Einstellungen der Anzeigetafel (SET_ANZEIGE)', () => {
  it('nur was im Patch steht; geprüft wie beim Laden; unverändert = derselbe Stand', () => {
    const s = fest()
    expect(reducer(s, { type: 'SET_ANZEIGE', patch: { davor: true } })).toBe(s)
    const n = reducer(s, { type: 'SET_ANZEIGE', patch: { skala: 2, namen: 'kurz', amSteg: 3.6, kopfzeile: 'Musterregatta ' } })
    expect(n.anzeige).toMatchObject({ skala: 1.3, namen: 'kurz', amSteg: 4, kopfzeile: 'Musterregatta ', davor: true })
    // Unbrauchbares bleibt beim bisherigen bzw. der Vorgabe.
    const kaputt = reducer(n, { type: 'SET_ANZEIGE', patch: { namen: 'alle' as 'voll', sprache: 'fr' as 'de', herkunft: 'bunt' as 'kurz' } })
    expect([kaputt.anzeige.namen, kaputt.anzeige.sprache, kaputt.anzeige.herkunft]).toEqual(['aushang', 'regelwerk', 'lang'])
    expect(reducer(n, { type: 'SET_ANZEIGE', patch: { abstaende: { E: 45, X: 50, '1': 5 } as never } }).anzeige.abstaende).toEqual({ E: 45, '1': 30 })
  })

  it('Lage von Racecourse A und B (16.11.2026): vier Werte, Vorgabe A links; Unbekanntes wird die Vorgabe', () => {
    const s = fest()
    expect(s.anzeige.parallelAnordnung).toBe('a-links')
    expect(reducer(s, { type: 'SET_ANZEIGE', patch: { parallelAnordnung: 'a-links' } })).toBe(s)
    for (const lage of ['b-links', 'a-oben', 'b-oben'] as const) {
      const n = reducer(s, { type: 'SET_ANZEIGE', patch: { parallelAnordnung: lage } })
      expect(n.anzeige).toEqual({ ...s.anzeige, parallelAnordnung: lage })
      // Doppelt zugestellt: derselbe Stand.
      expect(reducer(n, { type: 'SET_ANZEIGE', patch: { parallelAnordnung: lage } })).toBe(n)
      expect(reducer(n, { type: 'SET_ANZEIGE', patch: { parallelAnordnung: 'rechts' as 'a-links' } }).anzeige.parallelAnordnung).toBe('a-links')
    }
    expect(normalisiereAnzeige({ parallelAnordnung: 'b-oben' }).parallelAnordnung).toBe('b-oben')
    for (const kaputt of ['oben', 'A-LINKS', 3, null, ['a-oben']]) expect(normalisiereAnzeige({ parallelAnordnung: kaputt }).parallelAnordnung, String(kaputt)).toBe('a-links')
  })

  it('Normalisierer: Fremdes und Kaputtes wird die Vorgabe; unbekannte Bereiche entfallen', () => {
    expect(normalisiereAnzeige(null)).toEqual(emptyState().anzeige)
    expect(normalisiereAnzeige({ bereiche: ['par_1', 'par_9', 'par_1', 3], kopfzeile: 7, skala: 'groß' }, ['par_1'])).toMatchObject({ bereiche: ['par_1'], kopfzeile: null, skala: 1 })
    expect(normalisiereBetrieb({ bereiche: [] })).toEqual({ bereiche: {} })
    const roh = {
      bereiche: {
        par_1: { begonnen: ['lauf:1', 'lauf:0', 'lauf:1'], gezeigt: [{ ref: m('e1', 1), zeit: 5 }, { ref: 'kaputt', zeit: 1 }, { ref: m('k1', 1), zeit: -1 }], meldung: { text: '' }, ausgesetzt: ['E', 'Q'], vorziehen: 'ja' },
        par_9: { begonnen: ['lauf:1'] },
        leer: { begonnen: [], vorziehen: true },
      },
    }
    expect(normalisiereBetrieb(roh, ['par_1', 'leer'])).toEqual({
      bereiche: {
        par_1: {
          begonnen: ['lauf:1'],
          gezeigt: [{ ref: m('e1', 1), zeit: 5 }, { ref: m('k1', 1), zeit: 0 }],
          ohneAnzeige: [],
          zurueckgestellt: [],
          reihenfolge: null,
          ausgesetzt: ['E'],
          // Kein Wahrheitswert: die Vorgabe (BETRIEB_ANNAHMEN.vorziehenVorgabe, an).
          vorziehen: true,
          meldung: null,
        },
      },
    })
    // Ausdrücklich aus bleibt aus; Kennungen der Folge und Zurückgestelltes werden geprüft wie gezeigte.
    const aus = normalisiereBetrieb({ bereiche: { par_1: { vorziehen: false, reihenfolge: [m('e1', 1), 'kaputt', m('e1', 1)], zurueckgestellt: [7, m('k1', 1)] } } })
    expect(aus.bereiche.par_1).toMatchObject({ vorziehen: false, reihenfolge: [m('e1', 1)], zurueckgestellt: [m('k1', 1)] })
  })
})

describe('Server des Gerätebetriebs (SET_GERAETE_SERVER, E6)', () => {
  it('leer = Vorgabe des Programms; geprüft und vereinheitlicht; Unbrauchbares ändert nichts; gleich = derselbe Stand', () => {
    const s = fest()
    expect(s.geraeteServer).toBe('')
    expect(reducer(s, { type: 'SET_GERAETE_SERVER', server: '' })).toBe(s)
    const n = reducer(s, { type: 'SET_GERAETE_SERVER', server: ' ntfy.example.org/ ' })
    expect(n.geraeteServer).toBe('https://ntfy.example.org')
    expect(reducer(n, { type: 'SET_GERAETE_SERVER', server: 'https://ntfy.example.org/' })).toBe(n)
    // Kein http(s), Zugangsdaten oder Anfrage in der Adresse: bleibt beim bisherigen (die Einstellung sagt es).
    for (const kaputt of ['ftp://ntfy.example.org', 'https://nutzer:geheim@ntfy.example.org', 'https://ntfy.example.org/?x=1', 'javascript:alert(1)'])
      expect(reducer(n, { type: 'SET_GERAETE_SERVER', server: kaputt }), kaputt).toBe(n)
    expect(reducer(n, { type: 'SET_GERAETE_SERVER', server: '   ' }).geraeteServer).toBe('')
    // Eine Einstellung: Betrieb und Anzeigetafel bleiben unberührt.
    expect(n.betrieb).toBe(s.betrieb)
    expect(n.anzeige).toBe(s.anzeige)
  })
})

describe('Parcours-Ampel: BETRIEB_DURCHFAHRT (P-03, 21.11.2026)', () => {
  it('nur der gezeigte Start; rein, Zeit vom Store, doppelt = derselbe Stand; zurück nimmt sie; Zeigen/Zurück räumen', () => {
    const s = zeigeNaechsten(beginne(fest()), P1, 1000)
    const ref = s.betrieb.bereiche[P1].gezeigt.at(-1)!.ref
    // Ein anderer als der gezeigte Start, ein unbekannter Bereich: unverändert.
    expect(reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref: m('k1', 1), an: true, zeit: 1 })).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P2, ref, an: true, zeit: 1 })).toBe(s)
    expect(reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref, an: false, zeit: 1 })).toBe(s)
    const d = reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref, an: true, zeit: 1500 })
    expect(d.betrieb.bereiche[P1].durchfahrt).toEqual({ ref, zeit: 1500 })
    expect(reducer(d, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref, an: true, zeit: 1600 })).toBe(d)
    // Gleiche Eingabe, gleicher Stand (deterministisch).
    expect(reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref, an: true, zeit: 1500 })).toEqual(d)
    expect(reducer(d, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref, an: false, zeit: 1700 }).betrieb.bereiche[P1]).toEqual(s.betrieb.bereiche[P1])
    // Der Nächste: die Durchfahrt fällt weg. Zurück: ebenso.
    expect(zeigeNaechsten(d, P1, 2000).betrieb.bereiche[P1].durchfahrt).toBeUndefined()
    expect(reducer(d, { type: 'BETRIEB_ZURUECK', bereich: P1, ref, zeit: 2000 }).betrieb.bereiche[P1]?.durchfahrt).toBeUndefined()
    // Ändert sonst nichts (keine Eingaben, keine Folge).
    expect(d.eingaben).toBe(s.eingaben)
    expect(d.betrieb.bereiche[P1].gezeigt).toEqual(s.betrieb.bereiche[P1].gezeigt)
  })

  it('migrate/normalisiereBetrieb: nur für den gezeigten Start, sonst weg', () => {
    const s = zeigeNaechsten(beginne(fest()), P1, 1000)
    const ref = s.betrieb.bereiche[P1].gezeigt.at(-1)!.ref
    const roh = (durchfahrt: unknown) => ({ bereiche: { [P1]: { ...s.betrieb.bereiche[P1], durchfahrt } } })
    expect(normalisiereBetrieb(roh({ ref, zeit: 7 })).bereiche[P1].durchfahrt).toEqual({ ref, zeit: 7 })
    expect(normalisiereBetrieb(roh({ ref, zeit: 'x' })).bereiche[P1].durchfahrt).toEqual({ ref, zeit: 0 })
    expect(normalisiereBetrieb(roh({ ref: m('k1', 1), zeit: 7 })).bereiche[P1].durchfahrt).toBeUndefined()
    expect(normalisiereBetrieb(roh('kaputt')).bereiche[P1].durchfahrt).toBeUndefined()
    expect(normalisiereBetrieb(roh(null)).bereiche[P1]).not.toHaveProperty('durchfahrt')
  })

  it('SET_ANZEIGE wkrAuto: Vorgabe aus, nur Wahrheitswerte', () => {
    expect(normalisiereAnzeige({}).wkrAuto).toBe(false)
    expect(normalisiereAnzeige({ wkrAuto: 'ja' }).wkrAuto).toBe(false)
    const s = reducer(fest(), { type: 'SET_ANZEIGE', patch: { wkrAuto: true } })
    expect(s.anzeige.wkrAuto).toBe(true)
    expect(reducer(s, { type: 'SET_ANZEIGE', patch: { wkrAuto: true } })).toBe(s)
  })
})

describe('Determinismus', () => {
  // Muster: Tafel-Prototyp, state/determinismus.test.ts – ein Ablauf wie am Wettkampftag. Würfelte der
  // Reducer (IDs, Uhr), liefen zwei Fenster auseinander, die dieselben Actions anwenden.
  function ablauf(): Action[] {
    return [
      { type: 'SET_EVENT', patch: { eventName: 'Musterpokal', laufCount: 2 }, zeit: 1 },
      { type: 'SET_ANZEIGE', patch: { kopfzeile: '1. Musterpokal', amSteg: 1 }, zeit: 2 },
      { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:1', zeit: 3 },
      { type: 'BETRIEB_ZEIGEN', bereich: P1, ref: m('e1', 1), vorher: null, zeit: 1_000 },
      { type: 'BETRIEB_ZEIGEN', bereich: P1, ref: m('k1', 1), vorher: m('e1', 1), zeit: 61_000 },
      { type: 'BETRIEB_MELDUNG', bereich: '*', meldung: { text: 'Kurze Pause', art: 'pause' }, zeit: 70_000 },
      { type: 'BETRIEB_ZURUECK', bereich: P1, ref: m('k1', 1), zeit: 80_000 },
      { type: 'BETRIEB_ZEIGEN', bereich: P1, ref: m('k1', 1), vorher: m('e1', 1), zeit: 90_000 },
      { type: 'BETRIEB_BEGINNEN', bereich: P2, punkt: 'lauf:1', zeit: 91_000 },
      { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: null, zeit: 92_000 },
    ]
  }
  const anwenden = (aktionen: Action[]) => aktionen.reduce(reducer, fest())

  it('führt denselben Ablauf in zwei Fenstern zum selben Stand', () => {
    expect(anwenden(ablauf())).toEqual(anwenden(ablauf()))
  })

  it('bleibt gleich, wenn ein Fenster die Änderungen später Schritt für Schritt nachzieht', () => {
    const sofort = anwenden(ablauf())
    let nachgezogen = fest()
    for (const a of ablauf()) nachgezogen = reducer(nachgezogen, a)
    expect(nachgezogen).toEqual(sofort)
    expect(sofort.betrieb.bereiche[P1].gezeigt).toEqual([
      { ref: m('e1', 1), zeit: 1_000 },
      { ref: m('k1', 1), zeit: 90_000 },
    ])
    expect(sofort.betrieb.bereiche[P2].meldung).toEqual({ text: 'Kurze Pause', art: 'pause' })
  })

  it('doppelt zugestellt ändert nichts: jede Action ein zweites Mal ist derselbe Stand', () => {
    let s = fest()
    for (const a of ablauf()) {
      s = reducer(s, a)
      // SET_EVENT ersetzt immer (bestehendes Verhalten); alle Actions des Betriebs sind idempotent.
      if (a.type.startsWith('BETRIEB_') || a.type === 'SET_ANZEIGE') expect(reducer(s, a)).toBe(s)
    }
  })
})
