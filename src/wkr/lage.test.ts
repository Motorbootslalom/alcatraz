import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { wkrNurStarter } from '../state/reducer/wkr'
import { configFor } from '../config/konfig'
import { lage as bereichsLage } from '../betrieb/folge'
import { betriebStarter, betriebsStand, festgeschrieben, uimParallelStand, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import type { AppState, WkrModus, WkrStatus } from '../types'
import { listenFelder } from '../lib/eingaben'
import { WKR_ANNAHMEN } from './annahmen'
import { ampelVon, durchfahrtVon, erfassungsLage, rueckstandZeile, schlechteste, zeilenMarken, type GeraetAngabe, type ListenLage } from './lage'
import { schlange } from './schlange'
import { werteVon } from '../lib/eingaben'
import { listenKennung, listeVonBogen, teilVonZelle, type Liste } from './liste'
import { pruefeZeile } from './zeile'

// Lage der WKR-Erfassung am Bedienrechner (Plan W2 §3, §9 A2–A5, A13): Zellstände mit Vorrang, Steg ½ je Teil,
// Parallelslalom A/B, Rückstand mit R, kein Rückstand bei Pause/Abmeldung/Papier, Ampel mit fester Uhr, Marken der
// Erfassung. Nur erfundene Starter (testHilfen).

const DM = configFor({ regelwerk: 'dm-2026' })
const P1 = 'par_1'
const L1 = 'manoevrieren/1'
const L = (typeId: string, bereich = P1): Liste => ({ bereich, typeId, racecourse: null })
const K = (typeId: string) => listenKennung(L(typeId))
const setzeListe = (s: AppState, l: Liste, zeit: number, modus?: WkrModus, status?: WkrStatus) => reducer(s, { type: 'WKR_LISTE', liste: listenKennung(l), modus, status, zeit })
const zeige = (s: AppState, n: number, zeit: number, bereich = P1) => Array.from({ length: n }).reduce<AppState>((st, _, i) => zeigeNaechsten(st, bereich, zeit + i * 100), s)
const gezeigt = (s: AppState, bereich = P1) => s.betrieb.bereiche[bereich].gezeigt.map((g) => g.ref)
const starterVon = (key: string) => JSON.parse(key)[1] as string
const setze = (s: AppState, starter: string, feld: string, wert: string) => reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: L1, starter, feld, wert }] })
const nr = (s: AppState, key: string) => s.starters.find((x) => x.id === starterVon(key))!.startNr
const lageVon = (s: AppState, typeId: string, geraete: GeraetAngabe[] = [], jetzt = 0, starts: 'punkt' | 'alle' = 'punkt'): ListenLage =>
  erfassungsLage(s, DM, P1, geraete, jetzt, starts).listen.find((l) => l.liste === K(typeId))!
const zellen = (l: ListenLage, keys: string[]) => keys.map((k) => l.zellen[k]?.zelle)

/** Viele erfundene Starter der Klasse 1 (für die Breite der Matrix). */
const viele = (n: number) => Array.from({ length: n }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(100 + i + 1)))

/**
 * gate135 digital (100), drei Starts gezeigt (1000, 1100, 1200), R = 1. Der dritte ist „durchs Start-Tor“ (P-03, AM5) –
 * sonst zählte er auf der Parcours-Liste noch nicht; `durch: false` lässt ihn grün.
 */
function drei({ durch = true }: { durch?: boolean } = {}): { s: AppState; keys: string[] } {
  let s = setzeListe(wkrBetriebsStand(viele(8)), L('gate135'), 100, 'digital')
  s = reducer(s, { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 1 } })
  s = zeige(s, 3, 1000)
  if (durch) s = reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref: gezeigt(s)[2], an: true, zeit: 1250 })
  return { s, keys: gezeigt(s) }
}

const geraet = (liste: string, zuletzt: number, teil?: 'ab' | 'an', mehr: Partial<GeraetAngabe> = {}): GeraetAngabe => ({
  id: `g-${zuletzt}-${teil ?? ''}`,
  name: 'Handy Nord',
  listen: [{ liste, ...(teil ? { teil } : {}) }],
  zuletzt,
  ...mehr,
})

/** Eine Zeile vom Gerät wie beim Host (pruefeZeile) über WKR_ZEILEN. */
function sende(s: AppState, typeId: string, key: string, c: [string, string, string][], z = 1): AppState {
  const r = pruefeZeile(s, DM, L(typeId), undefined, 'g1', { z, s: key, c })
  if ('fehler' in r) throw new Error(r.fehler)
  return reducer(s, { type: 'WKR_ZEILEN', liste: K(typeId), quelle: { geraet: 'g1', name: 'Handy Nord' }, zeilen: [r], zeit: 5000 })
}

describe('ampelVon (A3, A13)', () => {
  it('Grenzen mit fester Uhr: unter 90 s gehört, bis 5 min still, darüber weg; ohne laufenden Punkt ruht', () => {
    const jetzt = 1_000_000
    expect(ampelVon(jetzt - 89_999, jetzt, true)).toBe('gehoert')
    expect(ampelVon(jetzt - WKR_ANNAHMEN.ampelStillSek * 1000, jetzt, true)).toBe('still')
    expect(ampelVon(jetzt - 299_999, jetzt, true)).toBe('still')
    expect(ampelVon(jetzt - WKR_ANNAHMEN.ampelWegSek * 1000, jetzt, true)).toBe('weg')
    expect(ampelVon(0, jetzt, false)).toBe('ruht')
    expect(schlechteste(['gehoert', 'weg', 'still'])).toBe('weg')
    expect(schlechteste([])).toBeNull()
  })
})

describe('erfassungsLage – Zellstände', () => {
  it('offen, überfällig ab mehr als R jüngeren, ✓ mit Haken, X, Liste ohne Eintrag = Papier', () => {
    const { s: s0, keys } = drei()
    let l = lageVon(s0, 'gate135')
    // R = 1, aber „überfällig“ erst bei mehr als max(R, ueberfaelligMin = 2) jüngeren (N8, Feldtest 21.11.2026):
    // zwei jüngere reichen nicht, drei schon.
    expect(zellen(l, keys)).toEqual(['offen', 'offen', 'offen'])
    expect(lageVon(zeige(s0, 1, 1300), 'gate135').zellen[keys[0]].zelle).toBe('ueberfaellig')
    let s = setze(s0, starterVon(keys[1]), 'erfasst@gate135', '1')
    s = setze(s, starterVon(keys[0]), 'disq@steg', 'X')
    l = lageVon(s, 'gate135')
    expect(zellen(l, keys)).toEqual(['x', 'ok', 'offen'])
    // tor5 ohne Eintrag: Papier, ohne Rückstand und ohne Warnung.
    const tor5 = lageVon(s, 'tor5')
    expect(tor5).toMatchObject({ modus: null, status: 'aktiv', rueckstand: null, warnt: false })
    expect(zellen(tor5, keys.slice(1))).toEqual(['papier', 'papier'])
  })

  it('✓ mit Disq.-Marke (W3-17, GF10): Disq. J im Disq.-Feld der Liste, sonst ohne', () => {
    const { s: s0, keys } = drei()
    let s = setze(s0, starterVon(keys[0]), 'erfasst@gate135', '1')
    s = setze(s, starterVon(keys[0]), 'disq@gate135', 'J')
    s = setze(s, starterVon(keys[1]), 'erfasst@gate135', '1')
    const l = lageVon(s, 'gate135')
    expect(l.zellen[keys[0]]).toMatchObject({ zelle: 'ok', disq: 'J' })
    expect(l.zellen[keys[1]].zelle).toBe('ok')
    expect(l.zellen[keys[1]].disq).toBeUndefined()
  })

  it('Klasse ohne Liste: entfällt; vor `seit` Gezeigtes: Papier', () => {
    let s = zeige(wkrBetriebsStand(), 2, 1000)
    s = setzeListe(s, L('mueb'), 1500, 'digital')
    s = setzeListe(s, L('gate135'), 1500, 'digital')
    s = zeige(s, 1, 2000)
    const keys = gezeigt(s)
    const mueb = lageVon(s, 'mueb', [], 0, 'alle')
    const klassen = keys.map((k) => s.starters.find((x) => x.id === starterVon(k))!.klasse)
    keys.forEach((k, i) => {
      if (!DM.positionAllowsClass('mueb', klassen[i])) expect(mueb.zellen[k].zelle).toBe('entfaellt')
    })
    expect(zellen(lageVon(s, 'gate135'), keys)).toEqual(['papier', 'papier', 'offen'])
  })

  it('Vorrang: Rückfrage vor Vorschlag vor Haken', () => {
    const { s: s0, keys } = drei()
    // Rückfrage: anders belegte Zelle.
    let s = setze(s0, starterVon(keys[2]), 't1a|hin seiteA', '10')
    s = sende(s, 'gate135', keys[2], [['t1a|hin seiteA', '5', '']])
    s = setze(s, starterVon(keys[2]), 'erfasst@gate135', '1')
    let l = lageVon(s, 'gate135')
    expect(l.zellen[keys[2]].zelle).toBe('rueckfrage')
    expect(l.rueckfragen).toBe(1)
    // Vorschlag: Zeile zu einem Start auf Papier (A6).
    s = reducer(s, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: keys[1], zeit: 6000 })
    s = sende(s, 'gate135', keys[1], [['t1a|hin seiteA', '5', '']], 2)
    s = setze(s, starterVon(keys[1]), 'erfasst@gate135', '1')
    l = lageVon(s, 'gate135')
    expect(l.zellen[keys[1]].zelle).toBe('vorschlag')
    expect(l.vorschlaege).toBe(1)
  })

  it('Steg: ½ mit Stand je Teil', () => {
    let s = setzeListe(wkrBetriebsStand(), L('steg'), 100, 'digital')
    s = zeige(s, 2, 1000)
    const keys = gezeigt(s)
    s = setze(s, starterVon(keys[0]), 'erfasst.ab@steg', '1')
    const l = lageVon(s, 'steg')
    expect(l.zellen[keys[0]]).toEqual({ zelle: 'halb', teile: { ab: 'ok', an: 'offen' } })
    // Der zweite ist im Boot (T2): Anlegen „kommt noch“, kein Papier.
    expect(l.zellen[keys[1]]).toEqual({ zelle: 'offen', teile: { ab: 'offen', an: 'spaeter' } })
    expect(l.teile).toEqual({ ab: { status: 'aktiv' }, an: { status: 'aktiv' } })
  })

  // Nutzer 21.11.2026 (T1/T2): Ablegen vorab, Anlegen nachlaufend – Spalten, Zellen, Rückstand.
  it('Steg-Zeitversatz: Vorab-Spalten fürs Ablegen, Anlegen des Starts im Boot zählt nicht als offen', () => {
    let s = setzeListe(wkrBetriebsStand(viele(8)), L('steg'), 100, 'digital')
    s = reducer(s, { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 1, wkrWarnung: 'nachfragen' } })
    s = zeige(s, 1, 1000)
    const [erster] = gezeigt(s)
    let lage = erfassungsLage(s, DM, P1, [], 0)
    const vorab = lage.starts.filter((x) => x.vorab)
    expect(vorab).toHaveLength(s.anzeige.amSteg)
    const l0 = lage.listen.find((l) => l.liste === K('steg'))!
    for (const v of vorab) expect(l0.zellen[v.key]).toEqual({ zelle: 'vorab', teile: { ab: 'vorab', an: 'spaeter' } })
    // Ablegen des ersten geschickt: nichts offen – das Anlegen des Starts im Boot fragt nicht.
    s = setze(s, starterVon(erster), 'erfasst.ab@steg', '1')
    lage = erfassungsLage(s, DM, P1, [], 0)
    let l = lage.listen.find((x) => x.liste === K('steg'))!
    expect(l.zellen[erster]).toEqual({ zelle: 'halb', teile: { ab: 'ok', an: 'spaeter' } })
    expect(l.rueckstand).toBeNull()
    expect(rueckstandZeile(lage.listen).warnt).toBe(false)
    // Das Ablegen des nächsten zählt erst ab dem Zeigen; dann ist der erste zurück und sein Anlegen offen.
    s = zeige(s, 1, 2000)
    const zweiter = gezeigt(s)[1]
    l = lageVon(s, 'steg')
    expect(l.zellen[erster]).toEqual({ zelle: 'halb', teile: { ab: 'ok', an: 'offen' } })
    expect(l.zellen[zweiter].teile).toEqual({ ab: 'offen', an: 'spaeter' })
    expect(l.rueckstand).toMatchObject({ zahl: 2 })
    // Mit Teil-Geräten zählt der Teil, der weiter zurück ist – je 1.
    const zwei = [geraet(K('steg'), 0, 'ab'), geraet(K('steg'), 0, 'an')]
    expect(lageVon(s, 'steg', zwei).rueckstand).toEqual({ zahl: 1, von: nr(s, zweiter), bis: nr(s, zweiter) })
  })

  // Prüfbefund 21.11.2026: Am Ende eines Laufs galt der letzte Start als zurück und sein Anlegen als offen – mit R = 1
  // fragte die Start-Freigabe an jeder Laufgrenze vor dem ersten „Nächster Start“.
  it('Ende des Laufs: das Anlegen des Starts auf der Tafel steht in der Schlange, zählt aber nicht im Rückstand', () => {
    let s = setzeListe(wkrBetriebsStand(), L('steg'), 100, 'digital')
    s = reducer(s, { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 1, wkrWarnung: 'nachfragen' } })
    s = zeige(s, bereichsLage(s, P1).frei.filter((e) => e.punkt === 'lauf:1').length, 1000)
    expect(bereichsLage(s, P1).frei.some((e) => e.punkt === 'lauf:1')).toBe(false)
    const lauf1 = gezeigt(s)
    const letzter = lauf1.at(-1)!
    for (const k of lauf1) {
      s = setze(s, starterVon(k), 'erfasst.ab@steg', '1')
      if (k !== letzter) s = setze(s, starterVon(k), 'erfasst.an@steg', '1')
    }
    const l = lageVon(s, 'steg', [geraet(K('steg'), 0, 'ab'), geraet(K('steg'), 0, 'an')])
    expect(l.zellen[letzter].teile?.an).toBe('offen')
    expect(l.rueckstand).toBeNull()
    expect(l.warnt).toBe(false)
    expect(lageVon(s, 'steg').rueckstand).toBeNull()
  })

  it('Vorsteg: die nächsten freien Starts als Spalten `vorab`', () => {
    let s = setzeListe(wkrBetriebsStand(), L('vorsteg'), 100, 'digital')
    s = zeige(s, 1, 1000)
    const lage = erfassungsLage(s, DM, P1, [], 0)
    const vorab = lage.starts.filter((x) => x.vorab)
    expect(vorab.length).toBeGreaterThan(0)
    const vorsteg = lage.listen.find((l) => l.liste === K('vorsteg'))!
    expect(vorab.every((x) => vorsteg.zellen[x.key]?.zelle === 'vorab')).toBe(true)
    // Andere Listen haben in diesen Spalten nichts.
    const gate = lage.listen.find((l) => l.liste === K('gate135'))!
    expect(vorab.some((x) => gate.zellen[x.key] !== undefined)).toBe(false)
  })
})

describe('erfassungsLage – Spalten (A2)', () => {
  it('die letzten 12 gezeigten Starts des laufenden Punkts, umschaltbar auf alle', () => {
    let s = wkrBetriebsStand(viele(30))
    const n = 14
    s = zeige(s, n, 1000)
    const alle = gezeigt(s)
    expect(alle).toHaveLength(n)
    const punkt = erfassungsLage(s, DM, P1, [], 0)
    expect(punkt.punkt).toBe('lauf:1')
    expect(punkt.starts.map((x) => x.key)).toEqual(alle.slice(-WKR_ANNAHMEN.matrixStarts))
    expect(erfassungsLage(s, DM, P1, [], 0, 'alle').starts.map((x) => x.key)).toEqual(alle)
    expect(punkt.starts[0]).toMatchObject({ nummern: [nr(s, alle[n - 12])], punkt: 'lauf:1', zeit: 1000 + (n - 12) * 100 })
  })
})

describe('erfassungsLage – Rückstand (A4, F1)', () => {
  it('Zahl und Startnummern; warnt ab R offenen (N8, Feldtest 21.11.2026; vorher mehr als R)', () => {
    const { s, keys } = drei()
    expect(lageVon(s, 'gate135')).toMatchObject({ rueckstand: { zahl: 3, von: nr(s, keys[0]), bis: nr(s, keys[2]) }, warnt: true })
    const r3 = reducer(s, { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 3 } })
    expect(lageVon(r3, 'gate135')).toMatchObject({ rueckstand: { zahl: 3 }, warnt: true })
    const r4 = reducer(s, { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 4 } })
    expect(lageVon(r4, 'gate135')).toMatchObject({ rueckstand: { zahl: 3 }, warnt: false })
  })

  it('pausiert, abgemeldet, Papier: kein Rückstand, keine Warnung', () => {
    const { s, keys } = drei()
    for (const status of ['pausiert', 'abgemeldet'] as const) {
      expect(lageVon(setzeListe(s, L('gate135'), 2000, undefined, status), 'gate135')).toMatchObject({ status, rueckstand: null, warnt: false })
    }
    const papier = lageVon(setzeListe(s, L('gate135'), 2000, 'papier'), 'gate135')
    expect(papier).toMatchObject({ modus: 'papier', rueckstand: null, warnt: false })
    expect(zellen(papier, keys)).toEqual(['papier', 'papier', 'papier'])
  })

  it('„Papier ab“: Startnummer in der Lage, ab dort Papier', () => {
    const { s: s0, keys } = drei()
    const s = reducer(s0, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: keys[1], zeit: 2000 })
    const l = lageVon(s, 'gate135')
    expect(l).toMatchObject({ status: 'abgemeldet', papierAb: nr(s, keys[1]), rueckstand: null, warnt: false })
    expect(zellen(l, keys)).toEqual(['papier', 'papier', 'papier'])
  })

  it('Steg mit Teil-Geräten: der Teil, der weiter zurück ist', () => {
    let s = setzeListe(wkrBetriebsStand(viele(8)), L('steg'), 100, 'digital')
    s = zeige(s, 3, 1000)
    const keys = gezeigt(s)
    s = setze(s, starterVon(keys[0]), 'erfasst.ab@steg', '1')
    s = setze(s, starterVon(keys[1]), 'erfasst.ab@steg', '1')
    const zwei = [geraet(K('steg'), 0, 'ab'), geraet(K('steg'), 0, 'an')]
    // Anlegen: die ersten beiden (der dritte ist noch im Boot, T2); Ablegen: der dritte.
    expect(lageVon(s, 'steg', zwei).rueckstand).toEqual({ zahl: 2, von: nr(s, keys[0]), bis: nr(s, keys[1]) })
    // Ablegen pausiert: das Anlegen zählt weiter.
    const p = reducer(s, { type: 'WKR_LISTE', liste: K('steg'), status: 'pausiert', teil: 'an', zeit: 2000 })
    expect(lageVon(p, 'steg', zwei).rueckstand).toMatchObject({ zahl: 1, von: nr(s, keys[2]) })
  })

  it('Parcours-Ampel (P-03, AM5): der gezeigte Start zählt erst ab der Durchfahrt – per Knopf oder erster Zeile', () => {
    const { s, keys } = drei({ durch: false })
    expect(lageVon(s, 'gate135')).toMatchObject({ parcours: true, rueckstand: { zahl: 2, von: nr(s, keys[0]), bis: nr(s, keys[1]) }, warnt: true })
    // Erste Zeile einer anderen Parcours-Liste (tor5, abgetippt) zum gezeigten Start: durchgefahren.
    const getippt = setze(setzeListe(s, L('tor5'), 100, 'digital'), starterVon(keys[2]), 'erfasst@tor5', '1')
    expect(lageVon(getippt, 'gate135').rueckstand?.zahl).toBe(3)
    // Nur die Älteren erledigt, der gezeigte noch grün: nichts offen, keine Warnung.
    let fertig = setze(s, starterVon(keys[0]), 'erfasst@gate135', '1')
    fertig = setze(fertig, starterVon(keys[1]), 'erfasst@gate135', '1')
    expect(lageVon(fertig, 'gate135')).toMatchObject({ rueckstand: null, warnt: false })
  })

  it('Steg und Vorsteg warnen nie (P-03: „laufen autark“, AM5) – Rückstand bleibt sichtbar', () => {
    let s = setzeListe(setzeListe(wkrBetriebsStand(viele(8)), L('steg'), 100, 'digital'), L('vorsteg'), 100, 'digital')
    s = zeige(s, 3, 1000)
    for (const typeId of ['steg', 'vorsteg']) {
      const l = lageVon(s, typeId)
      expect(l.parcours).toBe(false)
      expect(l.rueckstand?.zahl).toBeGreaterThan(0)
      expect(l.warnt).toBe(false)
    }
    expect(rueckstandZeile(erfassungsLage(s, DM, P1, [], 0).listen)).toEqual({ warnt: false, teile: [] })
  })

  it('rueckstandZeile: nur warnende Listen, mit Ampel und wartenden Zeilen', () => {
    const { s } = drei()
    const jetzt = 1_000_000
    const lage = erfassungsLage(s, DM, P1, [geraet(K('gate135'), jetzt - 200_000, undefined, { wartend: 2 })], jetzt)
    const zeile = rueckstandZeile(lage.listen)
    expect(zeile.warnt).toBe(true)
    expect(zeile.teile).toEqual([{ titel: lage.listen.find((l) => l.liste === K('gate135'))!.titel, zahl: 3, von: expect.any(String), bis: expect.any(String), geraet: 'still', wartend: 2 }])
    const ruhig = erfassungsLage(reducer(s, { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 5 } }), DM, P1, [], jetzt)
    expect(rueckstandZeile(ruhig.listen)).toEqual({ warnt: false, teile: [] })
  })
})

describe('erfassungsLage – Geräte', () => {
  it('Ampel je Gerät der Liste; ohne laufenden Punkt ruht jedes Gerät (A3)', () => {
    const { s } = drei()
    const jetzt = 1_000_000
    const l = lageVon(s, 'gate135', [geraet(K('gate135'), jetzt - 1000, undefined, { akku: 40 }), geraet(K('tor5'), 0)], jetzt)
    expect(l.geraete).toEqual([{ id: `g-${jetzt - 1000}-`, name: 'Handy Nord', ampel: 'gehoert', seitMs: 1000, akku: 40 }])
    const ruhig = setzeListe(festgeschrieben(betriebsStand()), L('gate135'), 100, 'digital')
    expect(lageVon(ruhig, 'gate135', [geraet(K('gate135'), 0)], jetzt).geraete[0].ampel).toBe('ruht')
  })

  it('Abschlüsse mit Startnummern, über abschluss.ts gelesen', () => {
    const { s: s0, keys } = drei()
    const s = reducer(s0, { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: 'Vor1', pruefsummen: {}, restPapier: true, zeit: 9000 })
    expect(lageVon(s, 'gate135').abschluss).toEqual([{ punkt: 'lauf:1', name: 'Vor1', zeit: 9000, abweichend: [], papier: keys.map((k) => nr(s, k)) }])
  })
})

describe('erfassungsLage – Parallelslalom', () => {
  it('je Racecourse eine Liste; Spalte = Paar; leere Seite entfällt', () => {
    let s = uimParallelStand()
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const UIM = configFor({ regelwerk: 'uim-2026' })
    const A: Liste = { bereich: 'parallel', typeId: 'steg', racecourse: 'A' }
    const B: Liste = { bereich: 'parallel', typeId: 'steg', racecourse: 'B' }
    s = setzeListe(setzeListe(s, A, 100, 'digital'), B, 100, 'digital')
    const folge = erfassungsLage(s, UIM, 'parallel', [], 0)
    const steg = folge.listen.filter((l) => l.typeId === 'steg')
    expect(steg.map((l) => l.racecourse)).toEqual(['A', 'B'])
    s = zeige(s, 20, 1000, 'parallel')
    const lage = erfassungsLage(s, UIM, 'parallel', [], 0, 'alle')
    const [la, lb] = lage.listen.filter((l) => l.typeId === 'steg')
    const leer = lage.starts.find((x) => x.nummern.length === 1)!
    expect(leer).toBeDefined()
    // Das zuletzt gezeigte volle Paar ist auf beiden Seiten offen (ältere sind bei so vielen Starts überfällig).
    const voll = lage.starts.filter((x) => x.nummern.length === 2).at(-1)!
    expect(la.zellen[voll.key].zelle).toBe('offen')
    expect(lb.zellen[voll.key].zelle).toBe('offen')
    const seite = JSON.parse(leer.key)
    // Die leere Seite (Dummy) hat nichts zu erfassen.
    expect((seite[4] === null ? lb : la).zellen[leer.key].zelle).toBe('entfaellt')
  })
})

describe('zeilenMarken (A5)', () => {
  it('Papier und überfällig an der Zeile; offen nur, wenn jedes Gerät weg ist; ohne Geräte nie', () => {
    const { s: s0, keys } = drei()
    // Ein vierter Start: Der erste hat drei jüngere hinter sich → überfällig (ueberfaelligMin 2, N8).
    const s = zeige(reducer(s0, { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 1 } }), 1, 1300)
    const jetzt = 1_000_000
    const zeile = (k: string) => `${L1}|${starterVon(k)}`
    let m = zeilenMarken(s, DM, L('gate135'), [L1])
    expect(m.get(zeile(keys[0]))).toEqual({ marke: 'papier-ansehen', zellen: {} })
    expect(m.has(zeile(keys[1]))).toBe(false)
    m = zeilenMarken(s, DM, L('gate135'), [L1], [geraet(K('gate135'), jetzt - 400_000)], jetzt)
    expect([...m.keys()].sort()).toEqual(gezeigt(s).map(zeile).sort())
    m = zeilenMarken(s, DM, L('gate135'), [L1], [geraet(K('gate135'), jetzt - 400_000), geraet(K('gate135'), jetzt - 1000)], jetzt)
    expect(m.has(zeile(keys[1]))).toBe(false)
    // Anderer Lauf im Bogen: keine Marken.
    expect(zeilenMarken(s, DM, L('gate135'), ['manoevrieren/2']).size).toBe(0)
    // Liste ohne Eintrag: keine Marken (der Bogen ist ohnehin die Quelle).
    expect(zeilenMarken(s, DM, L('tor5'), [L1]).size).toBe(0)
  })

  it('Pause: die Starts in P an der Zeile', () => {
    const { s: s0, keys } = drei()
    const s = reducer(s0, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: keys[2], zeit: 2000 })
    const m = zeilenMarken(reducer(s, { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 5 } }), DM, L('gate135'), [L1])
    expect(m.get(`${L1}|${starterVon(keys[2])}`)?.marke).toBe('papier-ansehen')
  })

  it('Steg: nur der fehlende Teil an seinen Zellen; Rückfrage an genau der Zelle', () => {
    let s = setzeListe(wkrBetriebsStand(), L('steg'), 100, 'digital')
    s = zeige(s, 1, 1000)
    const [key] = gezeigt(s)
    const starter = starterVon(key)
    s = setze(s, starter, 'erfasst.an@steg', '1')
    s = reducer(s, { type: 'WKR_LISTE', liste: K('steg'), status: 'abgemeldet', teil: 'ab', zeit: 1500 })
    const klasse = s.starters.find((x) => x.id === starter)!.klasse
    const felderAb = listenFelder(DM, 'steg', klasse).filter((f) => teilVonZelle('steg', f.zelle) === 'ab').map((f) => f.kennung)
    expect(felderAb.length).toBeGreaterThan(0)
    const m = zeilenMarken(s, DM, L('steg'), [L1]).get(`${L1}|${starter}`)!
    expect(m.marke).toBeNull()
    expect(Object.keys(m.zellen).sort()).toEqual([...felderAb].sort())

    const { s: g0, keys } = drei()
    let g = setze(g0, starterVon(keys[2]), 't1a|hin seiteA', '10')
    g = sende(g, 'gate135', keys[2], [['t1a|hin seiteA', '5', '']])
    expect(zeilenMarken(g, DM, L('gate135'), [L1]).get(`${L1}|${starterVon(keys[2])}`)).toEqual({ marke: 'rueckfrage', zellen: { 't1a|hin seiteA': 'rueckfrage' } })
  })
})

describe('listeVonBogen', () => {
  it('Manövrieren: Parcours und Position; Parallelslalom: Racecourse; Knoten: die Liste am Tisch (W5.3)', () => {
    expect(listeVonBogen({ parcoursId: P1, typeId: 'gate135' }, DM)).toEqual(L('gate135'))
    // Seit W5.3 (22.11.2026, KN1): jeder Knoten-Bogen gehört zu der EINEN Liste am Tisch.
    expect(listeVonBogen({ parcoursId: P1, typeId: 'knoten' }, DM)).toEqual({ bereich: 'tisch', typeId: 'knoten', racecourse: null })
    expect(listeVonBogen({ parcoursId: 'par_2', typeId: 'knoten' }, DM)).toEqual({ bereich: 'tisch', typeId: 'knoten', racecourse: null })
    expect(listeVonBogen({ parcoursId: P1, typeId: 'gibtsnicht' }, DM)).toBeNull()
    const UIM = configFor({ regelwerk: 'uim-2026' })
    expect(listeVonBogen({ parcoursId: 'racecourse-b', typeId: 'steg', runde: { runde: 'pre', racecourse: 'B' } }, UIM)).toEqual({ bereich: 'parallel', typeId: 'steg', racecourse: 'B' })
    expect(listeVonBogen({ parcoursId: 'racecourse-a', typeId: 'steg' }, UIM)).toEqual({ bereich: 'parallel', typeId: 'steg', racecourse: 'A' })
  })
})

// Prüfbefunde W2 (21.11.2026): Abgetipptes zählt wie der Haken; Rückfragen zu nicht gezeigten Starts in der Erfassung.
describe('Prüfbefunde W2', () => {
  it('abgetippt (Werte ohne Haken) → ✓, keine Marke „Papier ansehen“, kein Rückstand', () => {
    const { s: s0, keys } = drei()
    let s = reducer(s0, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: keys[0], zeit: 4000 })
    const zeile = (k: string) => `${L1}|${starterVon(k)}`
    expect(zeilenMarken(s, DM, L('gate135'), [L1]).get(zeile(keys[0]))?.marke).toBe('papier-ansehen')
    s = setze(s, starterVon(keys[0]), 't1a|hin seiteA', '5')
    expect(lageVon(s, 'gate135').zellen[keys[0]].zelle).toBe('ok')
    expect(zeilenMarken(s, DM, L('gate135'), [L1]).has(zeile(keys[0]))).toBe(false)
    // „beides“: abgetippte Starts zählen nicht als Rückstand (R = 2, drei offen → warnt; zwei abgetippt → nicht mehr).
    let b = reducer(setzeListe(drei().s, L('gate135'), 2000, 'beides'), { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 2 } })
    expect(lageVon(b, 'gate135').warnt).toBe(true)
    b = setze(setze(b, starterVon(keys[0]), 't1a|hin seiteA', '5'), starterVon(keys[1]), 't1a|hin seiteA', '0')
    const l = lageVon(b, 'gate135')
    expect(l.rueckstand).toEqual({ zahl: 1, von: nr(b, keys[2]), bis: nr(b, keys[2]) })
    expect(l.warnt).toBe(false)
  })

  it('Steg: abgetippt zählt je Teil – nur Felder des Teils, nicht die gemeinsamen', () => {
    let s = setzeListe(wkrBetriebsStand(viele(4)), L('steg'), 100, 'digital')
    s = zeige(s, 1, 1000)
    const key = gezeigt(s)[0]
    const klasse = s.starters.find((x) => x.id === starterVon(key))!.klasse
    const felder = listenFelder(DM, 'steg', klasse)
    const ab = felder.find((f) => teilVonZelle('steg', f.zelle) === 'ab')!
    const gemeinsam = felder.find((f) => teilVonZelle('steg', f.zelle) === 'gemeinsam')
    if (gemeinsam) {
      const g = setze(s, starterVon(key), gemeinsam.kennung, 'J')
      expect(lageVon(g, 'steg').zellen[key].teile).toEqual({ ab: 'offen', an: 'spaeter' })
    }
    s = setze(s, starterVon(key), ab.kennung, ab.kind === 'disq' ? 'J' : '1')
    // Der Start ist noch im Boot: Anlegen „kommt noch“ (T2).
    expect(lageVon(s, 'steg').zellen[key]).toEqual({ zelle: 'halb', teile: { ab: 'ok', an: 'spaeter' } })
  })

  it('Rückfrage zu einem nicht gezeigten Start (Grund `start`): „!“ an Zeile und Zelle', () => {
    const { s: s0 } = drei()
    // Der vierte Starter ist noch nicht gezeigt.
    const st = s0.starters.find((x) => !gezeigt(s0).some((k) => starterVon(k) === x.id))!.id
    const key = JSON.stringify(['m', st, 1])
    const s = sende(s0, 'gate135', key, [['t1a|hin seiteA', '5', '']])
    expect(s.wkr.rueckfragen.length).toBeGreaterThan(0)
    expect(s.wkr.rueckfragen.every((r) => r.grund === 'start')).toBe(true)
    const m = zeilenMarken(s, DM, L('gate135'), [L1]).get(`${L1}|${st}`)
    expect(m?.marke).toBe('rueckfrage')
    expect(m?.zellen['t1a|hin seiteA']).toBe('rueckfrage')
  })
})

// Nutzer 24.11.2026 (WKR_ANNAHMEN NG4): „Nicht gestartet · Disq. X“ von einem Tor-Gerät wirkt wie ein X vom Steg –
// ersetzt „nicht vorbeigekommen“ (W4.3, Zelle ⊘), das es nicht mehr gibt.
describe('„Nicht gestartet · Disq. X“ (24.11.2026, NG4)', () => {
  it('vom Tor: ✕ auf allen Listen, aus jeder Schlange, kein Rückstand, kein „Papier ansehen“; der Start entfällt', () => {
    const { s: s0, keys } = drei()
    const vorher = setzeListe(s0, L('steg'), 100, 'digital')
    expect(schlange(vorher, L('steg')).map((x) => x.key)).toContain(keys[0])
    const s = sende(vorher, 'gate135', keys[0], [['disq@gate135', 'X', '']])
    const starter = starterVon(keys[0])
    expect(werteVon(s.eingaben, L1, starter)).toEqual({ 'disq@gate135': 'X', 'erfasst@gate135': '1' })
    expect(lageVon(s, 'gate135').zellen[keys[0]]).toEqual({ zelle: 'x' })
    expect(lageVon(s, 'steg').zellen[keys[0]]).toEqual({ zelle: 'x' })
    expect(schlange(s, L('steg')).map((x) => x.key)).not.toContain(keys[0])
    expect(schlange(s, L('gate135')).map((x) => x.key)).not.toContain(keys[0])
    expect(zeilenMarken(s, DM, L('gate135'), [L1]).has(`${L1}|${starter}`)).toBe(false)
    expect(zeilenMarken(s, DM, L('steg'), [L1]).has(`${L1}|${starter}`)).toBe(false)
    // Wie ein X vom Steg: Der Start entfällt in der Folge – aber keine Abmeldung (nur dieser Lauf).
    expect(bereichsLage(s, P1).folge.find((e) => e.key === keys[0])?.entfaellt).toBe(true)
    expect(s.abgemeldet).toEqual([])
  })

  it('am gezeigten Start: Die Parcours-Ampel gilt als durch (AM4)', () => {
    const { s: s0, keys } = drei({ durch: false })
    expect(durchfahrtVon(s0, DM, P1)).toMatchObject({ durch: false, x: false })
    const s = sende(s0, 'gate135', keys[2], [['disq@gate135', 'X', '']])
    expect(durchfahrtVon(s, DM, P1)).toMatchObject({ ref: keys[2], durch: true, x: true })
    // Offen bleiben nur die beiden früheren Starts ohne Zeile; der mit X zählt nicht.
    expect(lageVon(s, 'gate135').rueckstand).toEqual({ zahl: 2, von: nr(s, keys[0]), bis: nr(s, keys[1]) })
  })

  it('Steg, Gerät nur für „Anlegen“: X ins gemeinsame Disq.-Feld, Haken des Anlegens, Zelle ✕ (NG4)', () => {
    let s = setzeListe(wkrBetriebsStand(), L('steg'), 100, 'digital')
    s = zeige(s, 1, 1000)
    const [key] = gezeigt(s)
    const r = pruefeZeile(s, DM, L('steg'), 'an', 'g1', { z: 1, s: key, c: [['disq@steg', 'X', '']] })
    if ('fehler' in r) throw new Error(r.fehler)
    s = reducer(s, { type: 'WKR_ZEILEN', liste: K('steg'), quelle: { geraet: 'g1', name: 'Handy Anlegen' }, zeilen: [r], zeit: 5000 })
    expect(werteVon(s.eingaben, L1, starterVon(key))).toMatchObject({ 'disq@steg': 'X', 'erfasst.an@steg': '1' })
    expect(lageVon(s, 'steg').zellen[key]).toEqual({ zelle: 'x' })
  })

  it('Abschluss trägt keine eigene Liste mehr (früher „n nicht vorbeigekommen“)', () => {
    const { s: s0, keys } = drei()
    let s = sende(s0, 'gate135', keys[1], [['disq@gate135', 'X', '']])
    s = sende(s, 'gate135', keys[0], [], 2)
    s = sende(s, 'gate135', keys[2], [], 3)
    s = reducer(s, { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: 'Vor1', pruefsummen: {}, restPapier: false, zeit: 9000 })
    expect(lageVon(s, 'gate135').abschluss).toEqual([{ punkt: 'lauf:1', name: 'Vor1', zeit: 9000, abweichend: [], papier: [] }])
  })
})

describe('„Keine Zeit“ (W5.4, 22.11.2026, ZT4)', () => {
  /** Eine Zeile der Zeit-Liste wie vom Gerät, mit `kz`. */
  function zeitZeile(s: AppState, key: string, c: [string, string, string][], kz: [string, 'anlage' | 'nichtImZiel' | 'anderes'][] | undefined, z = 1, geraetId = 'g1'): AppState {
    const r = pruefeZeile(s, DM, L('zeit'), undefined, geraetId, { z, s: key, c, ...(kz ? { kz } : {}) })
    if ('fehler' in r) throw new Error(r.fehler)
    return reducer(s, { type: 'WKR_ZEILEN', liste: K('zeit'), quelle: { geraet: geraetId, name: 'Pad' }, zeilen: [r], zeit: 5000 + z })
  }
  const zeitStand = () => {
    let s = setzeListe(wkrBetriebsStand(viele(4)), L('zeit'), 100, 'digital')
    s = zeige(s, 2, 1000)
    return { s, keys: gezeigt(s) }
  }

  it('direkt übernommen: ✓ mit Gründen, „Papier ansehen“ genau an den Feldern ohne Zeit; eine Zeit hebt das Feld auf', () => {
    const { s: s0, keys } = zeitStand()
    let s = zeitZeile(s0, keys[0], [['zeit1', '83,45', '']], [['zeit2', 'anlage'], ['zeit3', 'nichtImZiel']])
    const zelle = `${L1}|${starterVon(keys[0])}`
    expect(s.wkr.keineZeit[K('zeit')]).toEqual({ [zelle]: { zeit2: 'anlage', zeit3: 'nichtImZiel' } })
    expect(lageVon(s, 'zeit').zellen[keys[0]]).toEqual({ zelle: 'ok', keineZeit: { zeit2: 'anlage', zeit3: 'nichtImZiel' } })
    expect(zeilenMarken(s, DM, L('zeit'), [L1]).get(zelle)).toEqual({ marke: null, zellen: { zeit2: 'papier-ansehen', zeit3: 'papier-ansehen' } })
    // Seit 22.11.2026 (R7-01, AM2 umgebaut) ist die reine Zeit-Liste eine Parcours-Liste der Ampel.
    expect(lageVon(s, 'zeit').parcours).toBe(true)
    // Abgetippt (die Stoppuhrzeit vom Bogen): nur dieses Feld fällt.
    s = setze(s, starterVon(keys[0]), 'zeit2', '83,50')
    expect(s.wkr.keineZeit[K('zeit')]).toEqual({ [zelle]: { zeit3: 'nichtImZiel' } })
    expect(zeilenMarken(s, DM, L('zeit'), [L1]).get(zelle)).toEqual({ marke: null, zellen: { zeit3: 'papier-ansehen' } })
    // Eine spätere Zeile mit leerem `kz` ersetzt das Kennzeichen (alle Zeiten da); eine ohne `kz` lässt es stehen.
    const ohne = zeitZeile(s, keys[0], [], undefined, 2)
    expect(ohne.wkr.keineZeit).toBe(s.wkr.keineZeit)
    s = zeitZeile(s, keys[0], [['zeit3', '83,47', '']], [], 3)
    expect(s.wkr.keineZeit).toEqual({})
    expect(lageVon(s, 'zeit').zellen[keys[0]]).toEqual({ zelle: 'ok' })
  })

  it('Rückfrage und Vorschlag tragen es mit und wirken erst mit der Entscheidung für das Gerät', () => {
    const { s: s0, keys } = zeitStand()
    const zelle = `${L1}|${starterVon(keys[0])}`
    // Rückfrage: zeit1 steht anders.
    let s = setze(s0, starterVon(keys[0]), 'zeit1', '80,00')
    s = zeitZeile(s, keys[0], [['zeit1', '83,45', '']], [['zeit2', 'anderes']])
    expect(s.wkr.keineZeit).toEqual({})
    expect(s.wkr.rueckfragen[0].keineZeit).toEqual({ zeit2: 'anderes' })
    const behalten = reducer(s, { type: 'WKR_RUECKFRAGE', id: s.wkr.rueckfragen[0].id, wahl: 'behalten', zeit: 7000 })
    expect(behalten.wkr.keineZeit).toEqual({})
    const geraet = reducer(s, { type: 'WKR_RUECKFRAGE', id: s.wkr.rueckfragen[0].id, wahl: 'geraet', zeit: 7000 })
    expect(geraet.wkr.keineZeit).toEqual({ [K('zeit')]: { [zelle]: { zeit2: 'anderes' } } })
    // Vorschlag: Liste auf Papier.
    let p = setzeListe(s0, L('zeit'), 200, 'papier')
    p = zeitZeile(p, keys[1], [], [['zeit1', 'anlage']], 4)
    expect([p.wkr.vorschlaege[0].keineZeit, p.wkr.keineZeit]).toEqual([{ zeit1: 'anlage' }, {}])
    const ueber = reducer(p, { type: 'WKR_VORSCHLAG', id: p.wkr.vorschlaege[0].id, wahl: 'uebernehmen', zeit: 8000 })
    expect(ueber.wkr.keineZeit[K('zeit')]).toEqual({ [`${L1}|${starterVon(keys[1])}`]: { zeit1: 'anlage' } })
  })

  it('„Werte löschen“ und ein gelöschter Starter nehmen es mit', () => {
    const { s: s0, keys } = zeitStand()
    const s = zeitZeile(s0, keys[0], [], [['zeit1', 'anlage'], ['zeit2', 'anlage'], ['zeit3', 'anlage']])
    expect(Object.keys(s.wkr.keineZeit)).toHaveLength(1)
    expect(reducer(s, { type: 'CLEAR_EINGABEN' }).wkr.keineZeit).toEqual({})
    // Starter entfernen ist mit erfassten Werten gesperrt – die Aufräumhilfe selbst (wie bei REMOVE_STARTER ohne Werte).
    expect(wkrNurStarter(s.wkr, new Set([starterVon(keys[1])])).keineZeit).toEqual({})
    expect(wkrNurStarter(s.wkr, new Set([starterVon(keys[0])]))).toBe(s.wkr)
  })
})
