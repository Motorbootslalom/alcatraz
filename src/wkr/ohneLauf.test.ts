import { describe, expect, it } from 'vitest'
import { reducer, type Action } from '../state/reducer'
import { normalisiereWkr } from '../state/reducer/wkr'
import { configFor } from '../config/konfig'
import { refKey } from '../betrieb/folge'
import { sichtOeffentlich, sichtZuschauer } from '../betrieb/sicht'
import { BETRIEB_STARTER, wkrBetriebsStand } from '../testHilfen'
import { listenFelder, werteVon } from '../lib/eingaben'
import type { AppState, WkrZeile } from '../types'
import { WKR_ANNAHMEN } from './annahmen'
import { bestandOhneLauf, istParcoursListe, listenDerVeranstaltung, listenKennung, liesListe, ohneLaufKennung, startAufListe, TISCH_BEREICH, type Liste } from './liste'
import { pruefeZeile, wertGilt, type GeraeteZeile } from './zeile'
import { LISTEN_SICHT_FASSUNG, sichtListe, type ListenSichtExtra } from './sicht'
import { erfassungsLage, tischLage } from './lage'
import { abschlussVon, OHNE_PUNKT, wkrPunktVonRef } from './abschluss'
import { entwurfAus, eintraege, fertig, leererEntwurf, maskeFuer, maskenArt, pruefOffen, punkteVon, tippePruef, zellenAus } from './maske'
import { uebungsSchritt, uebungsSicht, uebungsStand } from './uebung'
import { sichtFreigabe } from './freigabe'

// W5.3 (Plan docs/plan-wkr-w5.md §6, 22.11.2026, WKR_ANNAHMEN KN1–KN8): Listen ohne Lauf (Knoten) im Kern – eine
// Liste am Tisch, Start = Starter, Bestand statt Schlange, nie Rückstand/Ampel, Abschluss der ganzen Liste, Prüfliste.
// Erfundene Starter (testHilfen: e1/e2 Klasse E, k1/k2 Klasse 1, v1/v2 Klasse 4, f1 Klasse 5).

const DM = configFor({ regelwerk: 'dm-2026' })
const TISCH: Liste = { bereich: TISCH_BEREICH, typeId: 'knoten', racecourse: null }
const KT = listenKennung(TISCH)
const P1 = 'par_1'
const EXTRA: ListenSichtExtra = { geraete: { g1: { bis: 0 } } }
const mit = (s: AppState, ...actions: Action[]) => actions.reduce((x, a) => reducer(x, { zeit: 100, ...a } as Action), s)
const digital = () => mit(wkrBetriebsStand(), { type: 'WKR_LISTE', liste: KT, modus: 'digital' } as Action)
const zeile = (s: string, c: GeraeteZeile['c'], mehr: Partial<GeraeteZeile> = {}): GeraeteZeile => ({ z: 1, s, c, ...mehr })
const LAUF0 = 'manoevrieren/0'

/** Eine geprüfte Zeile direkt übernehmen (wie der Host nach erlaubteWkr). */
function schicke(s: AppState, starter: string, c: GeraeteZeile['c'], z = 1): AppState {
  const r = pruefeZeile(s, DM, TISCH, undefined, 'g1', zeile(ohneLaufKennung(starter), c, { z }))
  if ('fehler' in r) throw new Error(r.fehler)
  return mit(s, { type: 'WKR_ZEILEN', liste: KT, quelle: { geraet: 'g1', name: 'Tisch' }, zeilen: [r as WkrZeile] } as Action)
}

describe('Liste am Tisch (KN1/KN2)', () => {
  it('genau eine Knoten-Liste je Veranstaltung, keine Parcours-Liste, Kennung lesbar', () => {
    const listen = listenDerVeranstaltung(wkrBetriebsStand(), DM).filter((l) => l.typeId === 'knoten')
    expect(listen).toEqual([TISCH])
    expect(KT).toBe('["l","tisch","knoten",null]')
    expect(liesListe(KT)).toEqual(TISCH)
    expect(istParcoursListe(DM, 'knoten')).toBe(false)
    expect(WKR_ANNAHMEN.listenOhneLaufErstW5).toBe(false)
  })

  it('Start ohne Lauf = Starter: Lauf-Schlüssel …/0, Punkt `ohne`; nur am Tisch, nicht abgemeldet', () => {
    const s = wkrBetriebsStand()
    const start = startAufListe(s, DM, TISCH, { art: 'o', starter: 'k1' })!
    expect([start.starter.id, start.lauf, start.weitere, start.punkt]).toEqual(['k1', LAUF0, [], 'ohne'])
    // Ein Start des Betriebs gehört nicht an den Tisch, ein Starter ohne Lauf nicht an den Parcours.
    expect(startAufListe(s, DM, TISCH, { art: 'm', starter: 'k1', lauf: 1 })).toBeNull()
    expect(startAufListe(s, DM, { bereich: P1, typeId: 'knoten', racecourse: null }, { art: 'o', starter: 'k1' })).toBeNull()
    expect(startAufListe(s, DM, TISCH, { art: 'o', starter: 'gibtsnicht' })).toBeNull()
    // „Nicht X“ (KN2): Abgemeldete fallen aus dem Bestand.
    const ab: AppState = { ...s, abgemeldet: ['k2'] }
    expect(startAufListe(ab, DM, TISCH, { art: 'o', starter: 'k2' })).toBeNull()
    expect(bestandOhneLauf(ab, DM, TISCH).map((b) => b.start.starter.id)).toEqual(BETRIEB_STARTER.map((p) => p.id).filter((id) => id !== 'k2'))
    expect(wkrPunktVonRef(s, ohneLaufKennung('k1'))).toBe(OHNE_PUNKT)
  })
})

describe('pruefeZeile am Tisch (KN2)', () => {
  const felder = listenFelder(DM, 'knoten', '1')

  it('nimmt Starts `["o", id]` an: gezeigt, Lauf …/0, Haken der Liste', () => {
    const s = digital()
    const r = pruefeZeile(s, DM, TISCH, undefined, 'g1', zeile(ohneLaufKennung('k1'), [[felder[0].kennung, '5', '']], { z: 3 }))
    expect(r).toMatchObject({ id: 'g1.3', liste: KT, ref: ohneLaufKennung('k1'), lauf: LAUF0, starter: 'k1', gezeigt: true, haken: ['erfasst@knoten'] })
  })

  it('lehnt ab: Kennung des Betriebs am Tisch, Starter ohne Lauf am Parcours, „nicht vorbeigekommen“, Unbekannte', () => {
    const s = digital()
    const fehler = (l: Liste, z: GeraeteZeile) => {
      const r = pruefeZeile(s, DM, l, undefined, 'g1', z)
      return 'fehler' in r ? r.fehler : null
    }
    expect(fehler(TISCH, zeile(refKey({ art: 'm', starter: 'k1', lauf: 1 }), []))).toBe('start-unbekannt')
    expect(fehler({ bereich: P1, typeId: 'gate135', racecourse: null }, zeile(ohneLaufKennung('k1'), []))).toBe('start-unbekannt')
    expect(fehler(TISCH, zeile(ohneLaufKennung('k1'), [], { n: true }))).toBe('nv-nicht-erlaubt')
    expect(fehler(TISCH, zeile(ohneLaufKennung('niemand'), []))).toBe('start-unbekannt')
    expect(fehler(TISCH, zeile(ohneLaufKennung('k1'), [['t1a|hin seiteA', '5', '']]))).toBe('feld-fremd')
  })

  it('WKR_ZEILEN übernimmt direkt (kein „nicht gezeigt“), Haken gesetzt; Papier → Vorschlag', () => {
    const s = schicke(digital(), 'k1', [[felder[0].kennung, '5', '']])
    expect(werteVon(s.eingaben, LAUF0, 'k1')).toMatchObject({ [felder[0].kennung]: '5', 'erfasst@knoten': '1' })
    expect(s.wkr.rueckfragen).toEqual([])
    const papier = schicke(wkrBetriebsStand(), 'k1', [[felder[0].kennung, '5', '']])
    expect(papier.wkr.vorschlaege.map((v) => v.grund)).toEqual(['papier'])
  })
})

describe('Sicht am Tisch (KN3, LISTEN_SICHT_FASSUNG 9)', () => {
  it('Bestand statt Schlange, offen n / m, Punkt `ohne`, Bereich „Am Tisch“ – genaue Schlüssel, nie Namen', () => {
    const s = schicke(digital(), 'k1', [])
    const sicht = sichtListe(s, DM, TISCH, EXTRA)
    expect(sicht.lv).toBe(LISTEN_SICHT_FASSUNG)
    expect(LISTEN_SICHT_FASSUNG).toBe(9)
    expect([sicht.schlange, sicht.danach, sicht.punkt, sicht.bereich]).toEqual([[], [], { id: 'ohne', titel: 'Alle Starter' }, 'Am Tisch'])
    expect(sicht.offen).toEqual({ n: BETRIEB_STARTER.length - 1, m: BETRIEB_STARTER.length })
    expect(sicht.bestand!.map((b) => [b.startNr, b.erledigt])).toEqual(BETRIEB_STARTER.map((p) => [p.startNr, p.id === 'k1']))
    // Positivliste je Eintrag (F6): genau diese Schlüssel.
    for (const b of sicht.bestand!) expect(Object.keys(b).sort()).toEqual(['erledigt', 'key', 'klasse', 'startNr'])
    expect(sicht.ampel).toBeUndefined()
    expect(sicht.laeuft).toBeUndefined()
    const text = JSON.stringify(sicht)
    for (const p of BETRIEB_STARTER) {
      expect(text).not.toContain(p.vorname)
      expect(text).not.toContain(p.nachname)
    }
    // Andere Listen tragen weder Bestand noch `offen`.
    const gate = sichtListe(s, DM, { bereich: P1, typeId: 'gate135', racecourse: null }, EXTRA)
    expect('bestand' in gate || 'offen' in gate).toBe(false)
  })

  it('nie auf Anzeigetafel, Zuschauerliste oder Start-Freigabe (F17)', () => {
    const vorher = digital()
    const nachher = schicke(vorher, 'k1', [[listenFelder(DM, 'knoten', '1')[0].kennung, '5', '']])
    expect(sichtOeffentlich(nachher, { logos: false })).toEqual(sichtOeffentlich(vorher, { logos: false }))
    expect(sichtZuschauer(sichtOeffentlich(nachher, { logos: false }))).toEqual(sichtZuschauer(sichtOeffentlich(vorher, { logos: false })))
    const lagen = erfassungsLage(nachher, DM, P1, [], 0).listen
    expect(lagen.some((l) => l.typeId === 'knoten')).toBe(false)
    expect(JSON.stringify(sichtFreigabe(P1, lagen, 'nachfragen'))).not.toContain('knoten')
  })
})

describe('Lage am Tisch (KN4)', () => {
  it('„Knoten: n / m offen“, nie Rückstand, nie warnt; erledigt = Haken oder eigene Werte', () => {
    let s = schicke(digital(), 'k1', [])
    // Am Bedienrechner abgetippt (ohne Haken) zählt in der Lage als erledigt (wie die Matrix, E1).
    s = mit(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF0, starter: 'k2', feld: listenFelder(DM, 'knoten', '1')[0].kennung, wert: '5' }] } as Action)
    const [l] = tischLage(s, DM, [{ id: 'g1', name: 'Tisch', zuletzt: 0, listen: [{ liste: KT }] }], 1000)
    expect(l.knoten).toEqual({ offen: BETRIEB_STARTER.length - 2, gesamt: BETRIEB_STARTER.length, nummern: ['E01', 'E02', '401', '402', '501'] })
    expect([l.rueckstand, l.warnt, l.parcours, l.modus]).toEqual([null, false, false, 'digital'])
    expect(l.geraete.map((g) => [g.id, g.ampel])).toEqual([['g1', 'gehoert']])
    // Die Sicht (für das Gerät) nimmt nur den Haken: k2 bleibt dort offen – das Gerät darf noch schicken (KN3).
    expect(sichtListe(s, DM, TISCH, EXTRA).offen!.n).toBe(BETRIEB_STARTER.length - 1)
  })
})

describe('Abschluss der ganzen Liste (KN5)', () => {
  const abschluss = (s: AppState, mehr: Partial<{ punkt: string; restPapier: boolean; liste: string }> = {}) =>
    mit(s, { type: 'WKR_ABSCHLUSS', liste: KT, punkt: OHNE_PUNKT, name: 'Vor1 Nach1', pruefsummen: {}, restPapier: false, ...mehr } as Action)

  it('offene Starter nur mit „Rest auf Papier“; nur Punkt `ohne`; nur am Tisch', () => {
    const s = schicke(digital(), 'k1', [])
    expect(abschluss(s)).toBe(s)
    expect(abschluss(s, { punkt: 'lauf:1' })).toBe(s)
    const gate = listenKennung({ bereich: P1, typeId: 'gate135', racecourse: null })
    const g = mit(s, { type: 'WKR_LISTE', liste: gate, modus: 'digital' } as Action)
    expect(abschluss(g, { liste: gate })).toBe(g)
    const zu = abschluss(s, { restPapier: true })
    const a = abschlussVon(zu.wkr, KT, OHNE_PUNKT)!
    expect(a.papier).toEqual(BETRIEB_STARTER.filter((p) => p.id !== 'k1').map((p) => ohneLaufKennung(p.id)))
    expect(sichtListe(zu, DM, TISCH, EXTRA).abgeschlossen).toEqual(['ohne'])
    // Danach werden Zeilen Vorschläge; lösen geht wie sonst.
    const spaet = schicke(zu, 'k2', [], 2)
    expect(spaet.wkr.vorschlaege.map((v) => v.grund)).toEqual(['abgeschlossen'])
    expect(abschlussVon(mit(zu, { type: 'WKR_ABSCHLUSS_LOESEN', liste: KT, punkt: OHNE_PUNKT } as Action).wkr, KT, OHNE_PUNKT)).toBeUndefined()
  })

  it('alle erledigt → ohne „Rest auf Papier“; „Alle Werte löschen“ für Lauf 1 nimmt den Abschluss mit', () => {
    let s = digital()
    BETRIEB_STARTER.forEach((p, i) => (s = schicke(s, p.id, [], i + 1)))
    const zu = abschluss(s)
    expect(abschlussVon(zu.wkr, KT, OHNE_PUNKT)?.papier).toEqual([])
    const leer = mit(zu, { type: 'CLEAR_EINGABEN_TEIL', laeufe: [1] } as Action)
    expect(abschlussVon(leer.wkr, KT, OHNE_PUNKT)).toBeUndefined()
  })

  it('migrate/normalisiereWkr: `ohne` nur an der Liste am Tisch, Punkte des Betriebs nur an den anderen', () => {
    const a = { name: 'Vor1 Nach1', zeit: 1, abweichend: [], papier: [] }
    const gate = listenKennung({ bereich: P1, typeId: 'gate135', racecourse: null })
    const w = normalisiereWkr({ listen: {}, abschluss: { [KT]: { ohne: a, 'lauf:1': a }, [gate]: { ohne: a, 'lauf:1': a } } }, new Set())
    expect(w.abschluss).toEqual({ [KT]: { ohne: a }, [gate]: { 'lauf:1': a } })
  })
})

describe('Maske „Prüfliste“ (KN7)', () => {
  const sicht = () => sichtListe(digital(), DM, TISCH, EXTRA)

  it('Knoten auf einer Liste ohne Lauf → pruefliste; dieselben Felder mit Lauf bleiben „später“', () => {
    const a = maskeFuer(sicht(), '1')!
    expect(a.art).toBe('pruefliste')
    expect(a.pruef.map((p) => p.titel)).toEqual(['Webleinstek', 'Schotstek', 'Palstek', 'Kreuzknoten', 'Klampe'])
    expect(a.pruef.every((p) => p.punkte === WKR_ANNAHMEN.knotenPunkte)).toBe(true)
    expect(maskenArt(sicht().klassen['1']!.felder!)).toBe('spaeter')
  })

  it('✓ = leer, ✗ = „5“; fertig erst, wenn alle gesetzt; jede Zelle gilt unverändert (wertGilt), rund über entwurfAus', () => {
    const a = maskeFuer(sicht(), '1')!
    const felder = new Map(listenFelder(DM, 'knoten', '1').map((f) => [f.kennung, f]))
    let e = leererEntwurf()
    expect([fertig(e, a), pruefOffen(e, a)]).toEqual([false, 5])
    a.pruef.forEach((p, i) => (e = tippePruef(e, a, p.feld, i === 2 ? 'fehler' : 'ok')))
    expect([fertig(e, a), pruefOffen(e, a), punkteVon(e, a), eintraege(e)]).toEqual([true, 0, 5, 1])
    const zellen = zellenAus(e, a)
    expect(Object.values(zellen).filter((w) => w !== '')).toEqual(['5'])
    for (const [f, w] of Object.entries(zellen)) expect(wertGilt(felder.get(f)!, w), `${f}=${w}`).toBe(true)
    expect(zellenAus(entwurfAus(zellen, a), a)).toEqual(zellen)
    // Derselbe Tipp noch einmal nimmt die Wahl heraus; ein fremdes Feld ändert nichts.
    const raus = tippePruef(e, a, a.pruef[0].feld, 'ok')
    expect(pruefOffen(raus, a)).toBe(1)
    expect(tippePruef(e, a, 'gibtsnicht', 'ok')).toBe(e)
    // Andere Masken sind immer „fertig“ (dort heißt nichts getippt fehlerfrei).
    expect(fertig(leererEntwurf(), { art: 'katalog', pruef: [] })).toBe(true)
  })
})

describe('Übung mit Knoten (KN8)', () => {
  it('20 erfundene Starter im Bestand, ohne Takt; eine Zeile hakt ihre Nummer ab', () => {
    const st = uebungsStand('dm-2026', 'knoten')
    const sicht = uebungsSicht(st)
    expect(sicht.bestand!.length).toBe(WKR_ANNAHMEN.uebungStarts)
    expect([sicht.schlange, sicht.punkt?.id, liesListe(sicht.liste)?.bereich]).toEqual([[], 'ohne', TISCH_BEREICH])
    expect(uebungsSchritt(st, null)).toBe(st)
    const weiter = uebungsSchritt(st, { s: sicht.bestand![6].key })
    expect(uebungsSicht(weiter).offen).toEqual({ n: WKR_ANNAHMEN.uebungStarts - 1, m: WKR_ANNAHMEN.uebungStarts })
    expect(uebungsSchritt(weiter, { s: sicht.bestand![6].key })).toBe(weiter)
    expect(maskeFuer(sicht, sicht.bestand![0].klasse)?.art).toBe('pruefliste')
  })
})
