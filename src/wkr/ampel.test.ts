import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { configFor } from '../config/konfig'
import { AUFBAUTEN } from '../config/catalog'
import { lage as bereichsLage } from '../betrieb/folge'
import { betriebStarter, betriebsStand, festgeschrieben, uimParallelStand, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import { listenFelder } from '../lib/eingaben'
import { listeMitMaske } from './maske'
import { pruefeZeile } from './zeile'
import type { AppState, WkrModus, WkrStatus } from '../types'
import { erfassungsLage, type GeraetAngabe } from './lage'
import { istParcoursListe, listenKennung, type Liste } from './liste'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { ampelImStand, autoSchritt, laufLage, parcoursAmpel, type AmpelLage, type AutoEingang } from './ampel'

// Parcours-Ampel (Nutzer 21.11.2026, P-03/P-04; Plan docs/plan-antworten-runde3-6.md §3): welche Listen Parcours sind
// (AM1/AM2, an allen Aufbauten), grün/rot/frei, Papier/Pause zählen nicht (AM3), rot durch Knopf oder erste Zeile
// (AM4), Parallelslalom als Paar, Auto-Schritt (AM6). Nur erfundene Starter (testHilfen).

const DM = configFor({ regelwerk: 'dm-2026' })
const UIM = configFor({ regelwerk: 'uim-2026' })
const P1 = 'par_1'
const L1 = 'manoevrieren/1'
const L = (typeId: string, bereich = P1, racecourse: Liste['racecourse'] = null): Liste => ({ bereich, typeId, racecourse })
const K = (typeId: string) => listenKennung(L(typeId))
const setzeListe = (s: AppState, l: Liste, modus?: WkrModus, status?: WkrStatus) => reducer(s, { type: 'WKR_LISTE', liste: listenKennung(l), modus, status, zeit: 100 })
const starterVon = (key: string) => JSON.parse(key)[1] as string
const aktuell = (s: AppState, bereich = P1) => s.betrieb.bereiche[bereich].gezeigt.at(-1)!.ref
const setze = (s: AppState, starter: string, feld: string, wert: string) => reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: L1, starter, feld, wert }] })
const durch = (s: AppState, an = true, bereich = P1) => reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich, ref: aktuell(s, bereich), an, zeit: 2000 })
const ampel = (s: AppState, geraete: GeraetAngabe[] = [], k = DM, bereich = P1): AmpelLage => parcoursAmpel(s, k, bereich, erfassungsLage(s, k, bereich, geraete, 0).listen)

const viele = (n: number) => Array.from({ length: n }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(100 + i + 1)))
/** gate135 und steg digital, ein Start gezeigt. */
function einer(): AppState {
  let s = setzeListe(setzeListe(wkrBetriebsStand(viele(6)), L('gate135'), 'digital'), L('steg'), 'digital')
  return zeigeNaechsten(s, P1, 1000)
}

describe('istParcoursListe (AM1, AM2) – an allen Aufbauten', () => {
  // Plan §3.1: Tor-Listen, Tor 5, MüB, Parcoursüberwachung, moewezeit/bstartziel und parallelparcours sind Parcours;
  // seit 22.11.2026 (R7-01, AM2 umgebaut) auch die reinen Zeit-Listen (zeit, zeit-n; Parallel „Zeit“ A/B). Steg,
  // Vorsteg und Knoten nicht.
  const NIE = new Set(['steg', 'vorsteg', 'knoten'])
  for (const regelwerk of ['dm-2026', 'uim-2026']) {
    it(`${regelwerk}: jede Liste jedes Aufbaus`, () => {
      const k = configFor({ regelwerk })
      const gesehen = new Set<string>()
      for (const a of AUFBAUTEN) {
        for (const kombi of [false, true]) {
          for (const typeId of k.aufbauOrder(a.id, kombi)) {
            gesehen.add(typeId)
            expect(istParcoursListe(k, typeId), `${a.id}: ${typeId}`).toBe(!NIE.has(typeId))
          }
        }
      }
      for (const typeId of ['gate135', 'gate245', 'tor5', 'mueb', 'parcours', 'parcoursms', 'moewezeit', 'bstartziel', 'parallelparcours', 'brechts', 'moewe135', 'zeit', 'zeit-1', 'zeit-2', 'zeit-3']) {
        if (k.getPositions().some((p) => p.typeId === typeId)) expect(istParcoursListe(k, typeId), typeId).toBe(true)
      }
      for (const typeId of NIE) if (k.getPositions().some((p) => p.typeId === typeId)) expect(istParcoursListe(k, typeId), typeId).toBe(false)
      expect(istParcoursListe(k, 'gibt-es-nicht')).toBe(false)
      expect(gesehen.size).toBeGreaterThan(5)
    })
  }
})

describe('parcoursAmpel (P-03, AM3, AM4)', () => {
  it('nichts gezeigt oder keine Parcours-Liste digital: aus', () => {
    const ohne = setzeListe(wkrBetriebsStand(viele(3)), L('gate135'), 'digital')
    expect(ampel(ohne).ampel).toBe('aus')
    // Nur der Steg digital: aus – Steg und Vorsteg laufen autark.
    const steg = zeigeNaechsten(setzeListe(wkrBetriebsStand(viele(3)), L('steg'), 'digital'), P1, 1000)
    expect(ampel(steg).ampel).toBe('aus')
  })

  it('gezeigt → grün; „Durchs Start-Tor“ → rot (perKnopf); zurück → grün; Zeile → frei', () => {
    const s = einer()
    expect(ampel(s)).toMatchObject({ ampel: 'gruen', ref: aktuell(s), perKnopf: false, offen: [] })
    const rot = durch(s)
    expect(ampel(rot)).toMatchObject({ ampel: 'rot', perKnopf: true, offen: [DM.getSheetDef('gate135').title] })
    expect(ampel(durch(rot, false)).ampel).toBe('gruen')
    const fertig = setze(rot, starterVon(aktuell(s)), 'erfasst@gate135', '1')
    expect(ampel(fertig).ampel).toBe('frei')
  })

  it('erste Zeile einer Parcours-Liste macht rot (AM4) – Steg-Zeile nicht', () => {
    let s = setzeListe(einer(), L('tor5'), 'digital')
    const nr = starterVon(aktuell(s))
    expect(ampel(setze(s, nr, 'erfasst.ab@steg', '1')).ampel).toBe('gruen')
    s = setze(s, nr, 'erfasst@tor5', '1')
    expect(ampel(s)).toMatchObject({ ampel: 'rot', perKnopf: false, offen: [DM.getSheetDef('gate135').title] })
    // X (nicht gestartet) am Steg: durch, auf niemanden zu warten.
    const x = setze(einer(), starterVon(aktuell(einer())), 'disq@steg', 'X')
    expect(ampel(x).ampel).toBe('frei')
  })

  it('Papier, Pause und Abmeldung halten die Ampel nicht rot (F1)', () => {
    let s = setzeListe(durch(einer()), L('tor5'), 'digital')
    const nr = starterVon(aktuell(s))
    s = setze(s, nr, 'erfasst@gate135', '1')
    expect(ampel(s)).toMatchObject({ ampel: 'rot', offen: [DM.getSheetDef('tor5').title] })
    expect(ampel(setzeListe(s, L('tor5'), undefined, 'pausiert')).ampel).toBe('frei')
    expect(ampel(setzeListe(s, L('tor5'), 'papier')).ampel).toBe('frei')
    expect(ampel(setzeListe(s, L('tor5'), undefined, 'abgemeldet')).ampel).toBe('frei')
  })

  it('ältere offene Starts: rot erst mit der Durchfahrt des gezeigten; grün bleibt grün', () => {
    let s = zeigeNaechsten(durch(einer()), P1, 1100)
    expect(ampel(s).ampel).toBe('gruen')
    s = durch(s)
    expect(ampel(s).ampel).toBe('rot')
  })

  it('Parallelslalom: das Paar ist ein Start, A und B je eine Liste, frei erst mit beiden', () => {
    let s = uimParallelStand()
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const A = L('parallelparcours', 'parallel', 'A')
    const B = L('parallelparcours', 'parallel', 'B')
    s = setzeListe(setzeListe(s, A, 'digital'), B, 'digital')
    // Ein volles Paar suchen (beide Seiten besetzt).
    for (let i = 0; i < 12; i++) {
      s = zeigeNaechsten(s, 'parallel', 1000 + i * 100)
      const p = JSON.parse(aktuell(s, 'parallel'))
      if (p[3] !== null && p[4] !== null) break
    }
    const p = JSON.parse(aktuell(s, 'parallel'))
    expect(p[3]).not.toBeNull()
    expect(p[4]).not.toBeNull()
    const lauf = attemptSchluessel(p[1], p[2])
    expect(ampel(s, [], UIM, 'parallel').ampel).toBe('gruen')
    // Racecourse A schickt: rot (B fehlt).
    const nachA = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf, starter: p[3], feld: 'erfasst@parallelparcours', wert: '1' }] })
    const a = ampel(nachA, [], UIM, 'parallel')
    expect(a).toMatchObject({ ampel: 'rot', offen: [`${UIM.getSheetDef('parallelparcours').title} B`] })
    const beide = reducer(nachA, { type: 'SET_EINGABEN', zellen: [{ lauf, starter: p[4], feld: 'erfasst@parallelparcours', wert: '1' }] })
    expect(ampel(beide, [], UIM, 'parallel').ampel).toBe('frei')
  })

  it('ampelImStand rechnet je Stand einmal und ohne Geräte', () => {
    const s = durch(einer())
    expect(ampelImStand(s, DM, P1)).toBe('rot')
    expect(ampelImStand(s, DM, P1)).toBe('rot')
  })
})

describe('Auto-Modus (AM6)', () => {
  const tor = K('gate135')
  const g: GeraetAngabe = { id: 'g1', name: 'Handy', listen: [{ liste: tor }], zuletzt: 0 }

  /** Alle übrigen Parcours-Listen des Aufbaus auf Papier – dann fehlt der Auto-Modus (jede muss digital sein). */
  function nurTor(s: AppState): AppState {
    for (const l of erfassungsLage(s, DM, P1, [], 0).listen) if (l.parcours && l.typeId !== 'gate135') s = reducer(s, { type: 'WKR_LISTE', liste: l.liste, modus: 'papier', zeit: 100 })
    return s
  }
  /** Jede Parcours-Liste digital, je eine mit Gerät. */
  function alleDigital(s: AppState): { s: AppState; geraete: GeraetAngabe[] } {
    const geraete: GeraetAngabe[] = []
    for (const l of erfassungsLage(s, DM, P1, [], 0).listen) {
      if (!l.parcours) continue
      s = reducer(s, { type: 'WKR_LISTE', liste: l.liste, modus: 'digital', zeit: 100 })
      geraete.push({ id: `g-${geraete.length}`, name: 'Handy', listen: [{ liste: l.liste }], zuletzt: 0 })
    }
    return { s, geraete }
  }

  it('wirksam nur mit Einstellung und wenn jede Parcours-Liste digital, aktiv, mit Gerät ist', () => {
    const s = nurTor(einer())
    expect(ampel(s, [g]).autoMoeglich).toBe(false)
    const an = reducer(s, { type: 'SET_ANZEIGE', patch: { wkrAuto: true } })
    const ohne = ampel(an, [g])
    expect(ohne.autoMoeglich).toBe(false)
    // Die übrigen Parcours-Listen stehen auf Papier – an ihnen liegt es.
    expect(ohne.autoOhne.length).toBeGreaterThan(0)
    expect(ohne.autoOhne).not.toContain(DM.getSheetDef('gate135').title)
    expect(ampel(an, []).autoOhne).toContain(DM.getSheetDef('gate135').title)
  })

  const eingang = (mehr: Partial<AutoEingang> = {}): AutoEingang => ({
    ampel: { ampel: 'frei', ref: 'a', perKnopf: true, offen: [], autoMoeglich: true, autoOhne: [] },
    lage: { aktuell: { key: 'a' } as never, naechster: { key: 'b' } as never },
    meldung: null,
    offeneFragen: 0,
    angehalten: false,
    sahOffen: true,
    ...mehr,
  })

  it('autoSchritt: nur bei frei, wirksam, gesehen, ohne Anhalten, Fragen, Pause/Störung, mit einem Nächsten', () => {
    expect(autoSchritt(eingang())).toEqual({ ref: 'b', vorher: 'a' })
    expect(autoSchritt(eingang({ ampel: { ...eingang().ampel, ampel: 'rot' } }))).toBeNull()
    expect(autoSchritt(eingang({ ampel: { ...eingang().ampel, autoMoeglich: false } }))).toBeNull()
    expect(autoSchritt(eingang({ angehalten: true }))).toBeNull()
    expect(autoSchritt(eingang({ sahOffen: false }))).toBeNull()
    expect(autoSchritt(eingang({ offeneFragen: 1 }))).toBeNull()
    expect(autoSchritt(eingang({ meldung: { text: 'Mittag', art: 'pause' } }))).toBeNull()
    expect(autoSchritt(eingang({ meldung: { text: 'Boot kaputt', art: 'stoerung' } }))).toBeNull()
    expect(autoSchritt(eingang({ meldung: { text: 'Hallo', art: 'info' } }))).toEqual({ ref: 'b', vorher: 'a' })
    // Kein Nächster im begonnenen Punkt (Ende des Laufs): nie ein neuer Punkt.
    expect(autoSchritt(eingang({ lage: { aktuell: { key: 'a' } as never, naechster: null } }))).toBeNull()
    // Die Ampel gilt einem anderen Start als dem gezeigten: nichts.
    expect(autoSchritt(eingang({ lage: { aktuell: { key: 'x' } as never, naechster: { key: 'b' } as never } }))).toBeNull()
  })

  it('Ende zu Ende im Stand: frei mit Gerät → BETRIEB_ZEIGEN des Nächsten', () => {
    const alle = alleDigital(durch(einer()))
    let s = reducer(alle.s, { type: 'SET_ANZEIGE', patch: { wkrAuto: true } })
    // Jede Parcours-Liste hakt den gezeigten Start ab.
    for (const l of erfassungsLage(s, DM, P1, [], 0).listen) if (l.parcours) s = setze(s, starterVon(aktuell(s)), `erfasst@${l.typeId}`, '1')
    const a = ampel(s, alle.geraete)
    expect(a).toMatchObject({ ampel: 'frei', autoMoeglich: true })
    const l = bereichsLage(s, P1)
    const schritt = autoSchritt({ ampel: a, lage: l, meldung: null, offeneFragen: 0, angehalten: false, sahOffen: true })
    expect(schritt).toEqual({ ref: l.naechster!.key, vorher: aktuell(s) })
    const weiter = reducer(s, { type: 'BETRIEB_ZEIGEN', bereich: P1, ...schritt!, zeit: 3000 })
    expect(aktuell(weiter)).toBe(l.naechster!.key)
    expect(ampel(weiter, alle.geraete).ampel).toBe('gruen')
  })
})

describe('Reine Zeit-Liste (22.11.2026, R7-01, AM2 umgebaut): hält die Ampel wie jede Parcours-Liste', () => {
  /** Eine Zeile der Zeit-Liste wie vom Gerät: nur die erste Zeit (ZT5). */
  function zeitZeile(s: AppState): AppState {
    const r = pruefeZeile(s, DM, L('zeit'), undefined, 'g1', { z: 1, s: aktuell(s), c: [['zeit1', '75,12', '']] })
    if ('fehler' in r) throw new Error(r.fehler)
    return reducer(s, { type: 'WKR_ZEILEN', liste: K('zeit'), quelle: { geraet: 'g1', name: 'Pad' }, zeilen: [r], zeit: 3000 })
  }

  it('nur Zeit digital: grün → Durchfahrt rot (offen: Zeit) → Zeile mit der ersten Zeit → frei; ihre erste Zeile macht rot', () => {
    const s = zeigeNaechsten(setzeListe(wkrBetriebsStand(viele(4)), L('zeit'), 'digital'), P1, 1000)
    expect(ampel(s).ampel).toBe('gruen')
    const rot = durch(s)
    expect(ampel(rot)).toMatchObject({ ampel: 'rot', offen: [DM.getSheetDef('zeit').title] })
    expect(ampel(zeitZeile(rot)).ampel).toBe('frei')
    // Neben gate135: Die Zeile der Zeit-Liste allein (AM4) macht rot, gate135 fehlt noch.
    const beide = setzeListe(s, L('gate135'), 'digital')
    expect(ampel(zeitZeile(beide))).toMatchObject({ ampel: 'rot', offen: [DM.getSheetDef('gate135').title] })
    // Auto-Modus (AM6): Die Zeit-Liste auf Papier nimmt ihn weg.
    const auto = reducer(setzeListe(beide, L('zeit'), 'papier'), { type: 'SET_ANZEIGE', patch: { wkrAuto: true } })
    const a = ampel(auto, [{ id: 'g1', name: 'Pad', listen: [{ liste: K('gate135') }], zuletzt: 0 }])
    expect(a.autoMoeglich).toBe(false)
    expect(a.autoOhne).toContain(DM.getSheetDef('zeit').title)
  })

  it('UIM Parallelslalom: Zeit A/B sind Parcours-Listen je Racecourse', () => {
    expect(istParcoursListe(UIM, 'zeit')).toBe(true)
    expect(istParcoursListe(UIM, 'parallelparcours')).toBe(true)
    expect(istParcoursListe(UIM, 'steg')).toBe(false)
  })
})

describe('Bojen + Zeit (moewezeit, W5.4, 22.11.2026, ZT1/AM2): Parcours-Liste mit Maske – Ampel und Auto gelten', () => {
  /** Aufbau Möwe, Lauf begonnen, ein Start gezeigt; Liste moewezeit digital. */
  function moewe(): AppState {
    let s = festgeschrieben(reducer(betriebsStand(viele(4)), { type: 'SET_AUFBAU', aufbau: 'moewe' }))
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:1', zeit: 500 })
    s = setzeListe(s, L('moewezeit'), 'digital')
    return zeigeNaechsten(s, P1, 1000)
  }
  /** Eine Zeile des Geräts mit Zeit (Zelle wie getippt, ZT2). */
  function zeitZeile(s: AppState, starter: string, kz: [string, 'anlage'][] = []): AppState {
    const r = pruefeZeile(s, DM, L('moewezeit'), undefined, 'g1', { z: 1, s: aktuell(s), c: kz.length ? [] : [[zeitFeld(s, starter), '75,12', '']], kz })
    if ('fehler' in r) throw new Error(r.fehler)
    return reducer(s, { type: 'WKR_ZEILEN', liste: K('moewezeit'), quelle: { geraet: 'g1', name: 'Pad' }, zeilen: [r], zeit: 3000 })
  }
  const zeitFeld = (s: AppState, starter: string) => {
    const klasse = s.starters.find((x) => x.id === starter)!.klasse
    return listenFelder(DM, 'moewezeit', klasse).find((f) => f.kind === 'time')!.kennung
  }

  it('Parcours-Liste (Start/Ziel-Bojen sind Bewertung), seit R7-01 auch die reine Zeit-Liste – auch mit Maske', () => {
    expect(istParcoursListe(DM, 'moewezeit')).toBe(true)
    expect(istParcoursListe(DM, 'bstartziel')).toBe(true)
    expect(istParcoursListe(DM, 'zeit')).toBe(true)
    expect(listeMitMaske(DM, 'moewezeit', ['1'])).toBe(true)
  })

  it('grün → Durchfahrt rot (offen: moewezeit) → Zeile mit Zeit bzw. „keine Zeit“ → frei; Auto möglich mit Gerät', () => {
    const s = moewe()
    const starter = starterVon(aktuell(s))
    // Nur moewezeit digital: die übrigen Parcours-Listen auf Papier, damit sie nicht mitzählen.
    let t = s
    for (const l of erfassungsLage(t, DM, P1, [], 0).listen) if (l.parcours && l.typeId !== 'moewezeit') t = setzeListe(t, L(l.typeId), 'papier')
    expect(ampel(t).ampel).toBe('gruen')
    const rot = durch(t)
    expect(ampel(rot)).toMatchObject({ ampel: 'rot', offen: [DM.getSheetDef('moewezeit').title] })
    expect(ampel(zeitZeile(rot, starter)).ampel).toBe('frei')
    expect(ampel(zeitZeile(rot, starter, [[zeitFeld(rot, starter), 'anlage']])).ampel).toBe('frei')
    // Auto-Modus (AM6): jede Parcours-Liste digital mit Gerät – moewezeit zählt dazu; ohne ihr Gerät fehlt sie.
    let alle = reducer(s, { type: 'SET_ANZEIGE', patch: { wkrAuto: true } })
    const geraete: GeraetAngabe[] = []
    for (const l of erfassungsLage(alle, DM, P1, [], 0).listen) {
      if (!l.parcours) continue
      alle = setzeListe(alle, L(l.typeId), 'digital')
      geraete.push({ id: `g-${l.typeId}`, name: 'Pad', listen: [{ liste: l.liste }], zuletzt: 0 })
    }
    expect(ampel(alle, geraete).autoMoeglich).toBe(true)
    expect(ampel(alle, geraete.filter((g) => g.listen[0].liste !== K('moewezeit'))).autoOhne).toEqual([DM.getSheetDef('moewezeit').title])
  })
})

describe('laufLage (R6-10)', () => {
  it('läuft, solange Starts frei sind oder der gezeigte fährt; nennt die Startnummer unterwegs', () => {
    const s = einer()
    const nr = s.starters.find((x) => x.id === starterVon(aktuell(s)))!.startNr
    expect(laufLage(s, DM, P1)).toMatchObject({ punkt: 'lauf:1', unterwegs: [nr] })
    expect(laufLage(s, DM, P1)!.offen).toBeGreaterThan(0)
    // Ohne laufenden Punkt: null.
    expect(laufLage(setzeListe(wkrBetriebsStand(viele(2)), L('gate135'), 'digital'), DM, 'gibt-es-nicht')).toBeNull()
  })
})
