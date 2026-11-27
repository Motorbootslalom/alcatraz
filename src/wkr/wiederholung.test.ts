import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { configFor } from '../config/konfig'
import { lage as bereichsLage } from '../betrieb/folge'
import { betriebsStand, betriebStarter, festgeschrieben, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import type { AppState } from '../types'
import { listenFelder, werteVon } from '../lib/eingaben'
import { laufLage, parcoursAmpel } from './ampel'
import { durchfahrtVon, erfassungsLage } from './lage'
import { listenKennung, type Liste } from './liste'
import { papierStarts, schlange } from './schlange'
import { sichtListe, type ListenSichtExtra } from './sicht'
import { zeilenPruefsumme } from './uebernahme'
import { giltFuerAlleVersuche, liesVersuch, versuchsKennung } from './versuch'
import { pruefeZeile } from './zeile'

// Wiederholung nach Ausfall in der WKR-Erfassung (Nutzer 26.11.2026, R11-11; BETRIEB_ANNAHMEN WH7–WH9): Der abgebrochene
// Versuch verschwindet aus Schlange, Matrix und Rückstand; die Wiederholung kommt mit ihrem neuen Zeigen wie ein neuer
// Start – auf den Geräten unter eigener Kennung; eine späte Zeile zum abgebrochenen Versuch wird abgelehnt. Nur
// erfundene Starter (testHilfen).

const DM = configFor({ regelwerk: 'dm-2026' })
const P1 = 'par_1'
const L1 = 'manoevrieren/1'
const L = (typeId: string): Liste => ({ bereich: P1, typeId, racecourse: null })
const K = (typeId: string) => listenKennung(L(typeId))
const EXTRA: ListenSichtExtra = { geraete: { g1: { bis: 0 } } }
const viele = (n: number) => Array.from({ length: n }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(100 + i + 1)))
const starterVon = (key: string) => JSON.parse(key)[1] as string

/** gate135 digital (100), drei Starts gezeigt (1000, 1100, 1200), der dritte durchs Start-Tor. */
function drei(): { s: AppState; keys: string[] } {
  let s = reducer(wkrBetriebsStand(viele(8)), { type: 'WKR_LISTE', liste: K('gate135'), modus: 'digital', zeit: 100 })
  s = reducer(s, { type: 'SET_ANZEIGE', patch: { wkrRueckstand: 1 } })
  for (let i = 0; i < 3; i++) s = zeigeNaechsten(s, P1, 1000 + i * 100)
  const keys = s.betrieb.bereiche[P1].gezeigt.map((g) => g.ref)
  s = reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref: keys[2], an: true, zeit: 1250 })
  return { s, keys }
}

/** Eine Zeile vom Gerät wie beim Host (pruefeZeile → WKR_ZEILEN); `null` + Fehler, wenn abgelehnt. */
function sende(s: AppState, typeId: string, kennung: string, c: [string, string, string][], z = 1): { s: AppState; fehler?: string } {
  const r = pruefeZeile(s, DM, L(typeId), undefined, 'g1', { z, s: kennung, c })
  if ('fehler' in r) return { s, fehler: r.fehler }
  return { s: reducer(s, { type: 'WKR_ZEILEN', liste: K(typeId), quelle: { geraet: 'g1', name: 'Handy Tor 1' }, zeilen: [r], zeit: 5000 + z }) }
}
const ausfall = (s: AppState, ref: string) => reducer(s, { type: 'WIEDERHOLUNG_AUSFALL', bereich: P1, ref, zeit: 9000 })
const einreihenUndZeigen = (s: AppState, ref: string, zeit: number) => {
  const n = reducer(s, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref, wo: 'naechster' })
  return zeigeNaechsten(n, P1, zeit)
}

describe('Kennung je Versuch (wkr/versuch.ts)', () => {
  it('Versuch 0 = Kennung des Betriebs; danach ["w", n, Kennung] – rund und gegen Kaputtes geschützt', () => {
    const key = JSON.stringify(['m', 'k1', 1])
    expect(versuchsKennung(key, 0)).toBe(key)
    expect(liesVersuch(versuchsKennung(key, 2))).toEqual({ key, n: 2 })
    expect(liesVersuch(key)).toEqual({ key, n: 0 })
    for (const kaputt of ['["w",0,"x"]', '["w",1]', '["w",1,""]', '["w",1,["m"]]', '["w"', 7]) expect(liesVersuch(kaputt)).toBeNull()
  })
})

describe('Wiederholung nach Ausfall in der WKR-Erfassung', () => {
  it('Schlange, Matrix, Rückstand: der abgebrochene Versuch ist weg; die Wiederholung kommt mit neuem Zeigen wieder', () => {
    const { s: s0, keys } = drei()
    expect(schlange(s0, L('gate135')).map((x) => x.key)).toEqual(keys)
    const s = ausfall(s0, keys[1])
    expect(schlange(s, L('gate135')).map((x) => x.key)).toEqual([keys[0], keys[2]])
    const lage = erfassungsLage(s, DM, P1, [], 0)
    expect(lage.starts.map((x) => x.key)).toEqual([keys[0], keys[2]])
    expect(lage.listen.find((l) => l.liste === K('gate135'))!.rueckstand?.zahl).toBe(2)
    // Wieder eingereiht und gezeigt: als neuester Start in der Schlange, mit der Zeit des neuen Zeigens.
    const w = einreihenUndZeigen(s, keys[1], 20_000)
    const q = schlange(w, L('gate135'))
    expect(q.map((x) => x.key)).toEqual([keys[0], keys[2], keys[1]])
    expect(q.at(-1)!.zeit).toBe(20_000)
    expect(erfassungsLage(w, DM, P1, [], 0).starts.map((x) => x.key)).toEqual([keys[0], keys[2], keys[1]])
  })

  it('Geräte: die Wiederholung unter eigener Kennung; eine späte Zeile zum abgebrochenen Versuch wird abgelehnt', () => {
    const { s: s0, keys } = drei()
    // Vor dem Ausfall schickt das Gerät für den zweiten Start „5“ – übernommen.
    const vorher = sende(s0, 'gate135', keys[1], [['t1a|hin seiteA', '5', '']], 1).s
    expect(werteVon(vorher.eingaben, L1, starterVon(keys[1]))['t1a|hin seiteA']).toBe('5')
    const s = ausfall(vorher, keys[1])
    expect(werteVon(s.eingaben, L1, starterVon(keys[1]))).toEqual({})
    // Späte Zeile (Funkloch) zum abgebrochenen Versuch: abgelehnt – nie still wieder eingefüllt, keine Rückfrage.
    const spaet = sende(s, 'gate135', keys[1], [['t3a|hin seiteA', '10', '']], 2)
    expect(spaet.fehler).toBe('versuch-abgebrochen')
    expect(spaet.s.wkr.rueckfragen).toEqual([])
    // Die Sicht der Liste: der Start fehlt, bis er wieder gezeigt ist – dann unter neuer Kennung.
    expect(sichtListe(s, DM, L('gate135'), EXTRA).schlange.map((x) => x.key)).toEqual([keys[0], keys[2]])
    const w = einreihenUndZeigen(s, keys[1], 20_000)
    const neu = versuchsKennung(keys[1], 1)
    expect(sichtListe(w, DM, L('gate135'), EXTRA).schlange.map((x) => x.key)).toEqual([keys[0], keys[2], neu])
    // Die Ampel der Sicht nennt die neue Kennung (das Gerät vergleicht mit seiner Schlange).
    expect(sichtListe(w, DM, L('gate135'), EXTRA).ampel?.key).toBe(neu)
    // Die Zeile der Wiederholung (vorher leer, wie ein neuer Start) gilt direkt; mit alter Kennung weiter abgelehnt.
    expect(sende(w, 'gate135', keys[1], [['t1a|hin seiteA', '5', '']], 3).fehler).toBe('versuch-abgebrochen')
    const gut = sende(w, 'gate135', neu, [['t1a|hin seiteA', '10', '']], 4)
    expect(gut.fehler).toBeUndefined()
    expect(werteVon(gut.s.eingaben, L1, starterVon(keys[1]))).toEqual({ 't1a|hin seiteA': '10', 'erfasst@gate135': '1' })
    expect(gut.s.wkr.rueckfragen).toEqual([])
    // Eine erfundene spätere Versuchsnummer: ebenso abgelehnt.
    expect(sende(w, 'gate135', versuchsKennung(keys[1], 2), [], 5).fehler).toBe('versuch-abgebrochen')
  })

  it('Rückfragen, Vorschläge, „keine Zeit“, Papier der Pausen und der Abschlüsse dieses Versuchs fallen weg – anderes bleibt', () => {
    const { s: s0, keys } = drei()
    // Rückfrage für den zweiten Start (Bediener hatte 10 getippt, Gerät schickt 5) und eine für den ersten.
    let s = reducer(s0, { type: 'SET_EINGABEN', zellen: [keys[0], keys[1]].map((k) => ({ lauf: L1, starter: starterVon(k), feld: 't1a|hin seiteA', wert: '10' })) })
    s = sende(s, 'gate135', keys[1], [['t1a|hin seiteA', '5', '']], 1).s
    s = sende(s, 'gate135', keys[0], [['t1a|hin seiteA', '5', '']], 2).s
    expect(s.wkr.rueckfragen.map((r) => r.starter).sort()).toEqual([starterVon(keys[0]), starterVon(keys[1])].sort())
    // Pause mit P = die offenen Starts, dann weiter; Abschluss mit „Rest auf Papier“ nennt alle drei.
    s = reducer(s, { type: 'WKR_LISTE', liste: K('gate135'), status: 'pausiert', zeit: 6000 })
    expect(s.wkr.listen[K('gate135')].pausen[0].papier).toContain(keys[1])
    s = reducer(s, { type: 'WKR_LISTE', liste: K('gate135'), status: 'aktiv', zeit: 6100 })
    s = reducer(s, { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: 'Erika', pruefsummen: {}, restPapier: true, zeit: 6200 })
    expect(s.wkr.abschluss[K('gate135')]['lauf:1'].papier).toContain(keys[1])
    const n = ausfall(s, keys[1])
    expect(n.wkr.rueckfragen.map((r) => r.starter)).toEqual([starterVon(keys[0])])
    expect(n.wkr.listen[K('gate135')].pausen[0].papier).not.toContain(keys[1])
    expect(n.wkr.listen[K('gate135')].pausen[0].papier).toContain(keys[0])
    expect(n.wkr.abschluss[K('gate135')]['lauf:1'].papier).not.toContain(keys[1])
    expect(n.wkr.abschluss[K('gate135')]['lauf:1'].papier).toContain(keys[0])
    // Der Abschluss selbst bleibt (WH8).
    expect(n.wkr.abschluss[K('gate135')]['lauf:1'].name).toBe('Erika')
    expect(papierStarts(n, L('gate135'))).not.toContain(keys[1])
  })

  it('Abschluss: Prüfsummen eines abgebrochenen Versuchs zählen nicht, die der Wiederholung schon', () => {
    const { s: s0, keys } = drei()
    let s = ausfall(sende(s0, 'gate135', keys[1], [['t1a|hin seiteA', '5', '']], 1).s, keys[1])
    s = einreihenUndZeigen(s, keys[1], 20_000)
    const neu = versuchsKennung(keys[1], 1)
    s = sende(s, 'gate135', neu, [['t1a|hin seiteA', '10', '']], 2).s
    for (const k of [keys[0], keys[2]]) s = sende(s, 'gate135', k, [], 3 + keys.indexOf(k)).s
    const felder = listenFelder(DM, 'gate135', '1').map((f) => f.kennung)
    const summe = (k: string) => zeilenPruefsumme(werteVon(s.eingaben, L1, starterVon(k)), felder)
    // Das Gerät schickt Prüfsummen für den alten Versuch („5“) und die Wiederholung („10“).
    const alt = zeilenPruefsumme({ 't1a|hin seiteA': '5' }, felder)
    const fertig = reducer(s, { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: 'Erika', pruefsummen: { [keys[1]]: alt, [neu]: summe(keys[1]), [keys[0]]: summe(keys[0]) }, restPapier: false, zeit: 30_000 })
    expect(fertig.wkr.abschluss[K('gate135')]['lauf:1'].abweichend).toEqual([])
    // Weicht die Wiederholung ab, steht sie mit der Kennung des Betriebs da (Startnummern in der Matrix).
    const ab = reducer(s, { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: 'Erika', pruefsummen: { [neu]: alt }, restPapier: false, zeit: 30_000 })
    expect(ab.wkr.abschluss[K('gate135')]['lauf:1'].abweichend).toEqual([keys[1]])
  })

  it('Ampel und „Lauf läuft“: ein abgebrochener Start im Boot hat keine Ampel; eine offene Wiederholung hält den Lauf offen', () => {
    const { s: s0, keys } = drei()
    expect(durchfahrtVon(s0, DM, P1).ref).toBe(keys[2])
    const s = ausfall(s0, keys[2])
    expect(durchfahrtVon(s, DM, P1)).toEqual({ ref: null, durch: false, perKnopf: false, x: false })
    expect(s.betrieb.bereiche[P1].durchfahrt).toBeUndefined()
    expect(parcoursAmpel(s, DM, P1, erfassungsLage(s, DM, P1, [], 0).listen).ampel).toBe('aus')
    // Alle übrigen Starts des Laufs gezeigt: Ohne die Wiederholung wäre der Lauf zu Ende – mit ihr läuft er noch.
    let alle = s
    while (bereichsLage(alle, P1).naechster) alle = zeigeNaechsten(alle, P1, 50_000 + alle.betrieb.bereiche[P1].gezeigt.length * 100)
    const laeuft = laufLage(alle, DM, P1)
    expect(laeuft?.offen).toBe(1)
    expect(bereichsLage(alle, P1).wiederholung.map((e) => e.key)).toEqual([keys[2]])
  })
})

// Prüfbefunde 27.11.2026 zur Wiederholung nach Ausfall: „Papier ab“ der Wiederholung, abgeschlossener Lauf, Vorsteg mit
// „Versuche nacheinander“ unter Lauf 1, Vorschläge und „keine Zeit“, Steg-Teil, späte Zeile zwischen zwei Fenstern,
// „Doch keine Wiederholung“ mit den Geräten.
describe('Wiederholung nach Ausfall – Prüfbefunde 27.11.2026', () => {
  it('„Papier ab“ der Wiederholung nimmt nur sie und Späteres – nicht, was zwischen Abbruch und Wiederholung gezeigt wurde', () => {
    let s = reducer(wkrBetriebsStand(viele(6)), { type: 'WKR_LISTE', liste: K('gate135'), modus: 'digital', zeit: 100 })
    s = zeigeNaechsten(zeigeNaechsten(s, P1, 1000), P1, 61_000)
    const k = bereichsLage(s, P1).aktuell!.key
    s = ausfall(s, k)
    s = zeigeNaechsten(zeigeNaechsten(s, P1, 120_000), P1, 180_000)
    const dazwischen = s.betrieb.bereiche[P1].gezeigt.slice(-2).map((g) => g.ref)
    s = einreihenUndZeigen(s, k, 240_000)
    const n = reducer(s, { type: 'WKR_PAPIER_AB', liste: K('gate135'), ref: k, zeit: 250_000 })
    const p = n.wkr.listen[K('gate135')].pausen.at(-1)!
    expect(p.von).toBe(240_000)
    expect(p.papier).toEqual([k])
    expect(papierStarts(n, L('gate135'))).toEqual([k])
    // Eine späte Zeile zu einem Start dazwischen gilt deshalb direkt – vorher wurde sie Vorschlag „papier“.
    const spaet = sende(n, 'gate135', dazwischen[0], [['t1a|hin seiteA', '5', '']], 1).s
    expect(spaet.wkr.vorschlaege).toEqual([])
    expect(werteVon(spaet.eingaben, L1, starterVon(dazwischen[0]))['t1a|hin seiteA']).toBe('5')
  })

  it('abgeschlossener Lauf: die Wiederholung kommt trotzdem auf die Geräte, ihre Zeile wird Vorschlag „abgeschlossen“ (WH8)', () => {
    const { s: s0, keys } = drei()
    let s = s0
    keys.forEach((k, i) => (s = sende(s, 'gate135', k, [['t1a|hin seiteA', '5', '']], i + 1).s))
    // Tor 1 hat Lauf 1 abgeschlossen; danach fällt der letzte Start hinter Tor 1 aus.
    s = reducer(s, { type: 'WKR_ABSCHLUSS', liste: K('gate135'), punkt: 'lauf:1', name: 'Erika', pruefsummen: {}, restPapier: false, zeit: 6000 })
    expect(s.wkr.abschluss[K('gate135')]['lauf:1']).toBeDefined()
    s = ausfall(s, keys[2])
    // Ein gewöhnlicher Start nach dem Abschluss bleibt draußen (Papier), die Wiederholung nicht.
    s = zeigeNaechsten(s, P1, 30_000)
    const spaeter = bereichsLage(s, P1).aktuell!.key
    s = einreihenUndZeigen(s, keys[2], 40_000)
    const neu = versuchsKennung(keys[2], 1)
    expect(schlange(s, L('gate135')).map((x) => x.key)).toEqual([keys[2]])
    expect(sichtListe(s, DM, L('gate135'), EXTRA).schlange.map((x) => x.key)).toEqual([neu])
    expect(sichtListe(s, DM, L('gate135'), EXTRA).abgeschlossen).toEqual(['lauf:1'])
    const zellen = erfassungsLage(s, DM, P1, [], 0).listen.find((l) => l.liste === K('gate135'))!.zellen
    expect(zellen[keys[2]].zelle).not.toBe('papier')
    expect(zellen[spaeter].zelle).toBe('papier')
    const r = sende(s, 'gate135', neu, [['t1a|hin seiteA', '10', '']], 9)
    expect(r.fehler).toBeUndefined()
    expect(r.s.wkr.vorschlaege.map((v) => [v.ref, v.grund])).toEqual([[keys[2], 'abgeschlossen']])
    expect(werteVon(r.s.eingaben, L1, starterVon(keys[2]))).toEqual({})
    // Der Abschluss selbst bleibt.
    expect(r.s.wkr.abschluss[K('gate135')]['lauf:1'].name).toBe('Erika')
  })

  it('Versuche nacheinander: die Vorsteg-Zeile unter Lauf 1 bleibt, ist weiter korrigierbar, ohne ↻; P und Abschluss bleiben (WH6)', () => {
    const UIM = configFor({ regelwerk: 'uim-2026' })
    let s = reducer(betriebsStand(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    s = festgeschrieben(reducer(s, { type: 'SET_VERSUCHE_NACHEINANDER', on: true }))
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:1' })
    s = reducer(s, { type: 'WKR_LISTE', liste: K('vorsteg'), modus: 'digital', zeit: 100 })
    s = zeigeNaechsten(s, P1, 1000)
    const k = bereichsLage(s, P1).aktuell!
    expect(k.eintrag!.lauf).toBe(1)
    const starter = k.eintrag!.starter
    const zeile = (st: AppState, z: number, c: [string, string, string][], korrektur = false) => {
      const r = pruefeZeile(st, UIM, L('vorsteg'), undefined, 'g1', { z, s: k.key, c, ...(korrektur ? { k: true } : {}) })
      return 'fehler' in r ? r : reducer(st, { type: 'WKR_ZEILEN', liste: K('vorsteg'), quelle: { geraet: 'g1', name: 'Vorsteg' }, zeilen: [r], zeit: 2000 + z })
    }
    // Ohne Zeile in eine Pause: P nennt den Start; nach dem Ausfall steht er dort weiter (seine Zeile kommt vom Bogen).
    const pause = reducer(s, { type: 'WKR_LISTE', liste: K('vorsteg'), status: 'pausiert', zeit: 1500 })
    expect(pause.wkr.listen[K('vorsteg')].pausen[0].papier).toContain(k.key)
    expect(ausfall(pause, k.key).wkr.listen[K('vorsteg')].pausen[0].papier).toContain(k.key)
    // Mit Zeile: Sie gilt in allen Versuchen und bleibt beim Ausfall von Versuch 1 stehen.
    const mit = zeile(s, 1, [['bemerkung@vorsteg', 'Weste locker', '']]) as AppState
    expect(werteVon(mit.eingaben, L1, starter)['bemerkung@vorsteg']).toBe('Weste locker')
    const n = ausfall(mit, k.key)
    expect(werteVon(n.eingaben, L1, starter)).toEqual({ 'bemerkung@vorsteg': 'Weste locker', 'erfasst@vorsteg': '1' })
    // Korrektur derselben Kennung: angenommen (vorher abgelehnt mit `versuch-abgebrochen`).
    const korr = zeile(n, 2, [['bemerkung@vorsteg', 'Weste fest', 'Weste locker']], true)
    expect('fehler' in korr ? korr.fehler : null).toBeNull()
    expect(werteVon((korr as AppState).eingaben, L1, starter)['bemerkung@vorsteg']).toBe('Weste fest')
    // Kein ↻ in der Erfassung für diese Liste (ErfassungTabelle fragt giltFuerAlleVersuche), für andere schon.
    expect(giltFuerAlleVersuche(n, UIM, 'vorsteg')).toBe(true)
    expect(giltFuerAlleVersuche(n, UIM, 'gate135')).toBe(false)
  })

  it('Vorschläge, „keine Zeit“ und das Papier eines Steg-Teils dieses Versuchs fallen weg; „Doch keine Wiederholung“ holt Werte und „keine Zeit“ zurück', () => {
    const { s: s0, keys } = drei()
    // Steg auf Papier: die Zeile des Geräts wird Vorschlag. Zeit-Liste digital: „keine Zeit“ für den zweiten Start.
    let s = reducer(s0, { type: 'WKR_LISTE', liste: K('steg'), modus: 'papier', zeit: 200 })
    s = reducer(s, { type: 'WKR_LISTE', liste: K('zeit'), modus: 'digital', zeit: 200 })
    s = sende(s, 'steg', keys[1], [['bemerkung@steg', 'Motor aus', '']], 1).s
    expect(s.wkr.vorschlaege.map((v) => v.starter)).toEqual([starterVon(keys[1])])
    const kz = pruefeZeile(s, DM, L('zeit'), undefined, 'g2', { z: 2, s: keys[1], c: [], kz: [['zeit1', 'anlage']] })
    if ('fehler' in kz) throw new Error(kz.fehler)
    s = reducer(s, { type: 'WKR_ZEILEN', liste: K('zeit'), quelle: { geraet: 'g2', name: 'Pad Zeit' }, zeilen: [kz], zeit: 5100 })
    const zelle = `${L1}|${starterVon(keys[1])}`
    expect(s.wkr.keineZeit[K('zeit')][zelle]).toEqual({ zeit1: 'anlage' })
    const n = ausfall(s, keys[1])
    expect(n.wkr.vorschlaege).toEqual([])
    expect(n.wkr.keineZeit[K('zeit')]?.[zelle]).toBeUndefined()
    expect(werteVon(n.eingaben, L1, starterVon(keys[1]))).toEqual({})
    // Zurückholen: Haken der Zeit-Liste und „keine Zeit“ wieder da; der Vorschlag nicht (WIEDERHOLUNG_AUFHEBEN).
    const auf = reducer(n, { type: 'WIEDERHOLUNG_AUFHEBEN', bereich: P1, ref: keys[1], zeit: 9500 })
    expect(werteVon(auf.eingaben, L1, starterVon(keys[1]))).toEqual({ 'erfasst@zeit': '1' })
    expect(auf.wkr.keineZeit[K('zeit')][zelle]).toEqual({ zeit1: 'anlage' })
    expect(auf.wkr.vorschlaege).toEqual([])

    // Steg-Teil: die Pause nur des Ablegens nennt den Start in P – nach dem Ausfall nicht mehr.
    let t = reducer(s0, { type: 'WKR_LISTE', liste: K('steg'), modus: 'digital', zeit: 200 })
    t = reducer(t, { type: 'WKR_LISTE', liste: K('steg'), teil: 'ab', status: 'pausiert', zeit: 6000 })
    expect(t.wkr.listen[K('steg')].teile?.ab?.pausen[0].papier).toContain(keys[1])
    const tn = ausfall(t, keys[1])
    expect(tn.wkr.listen[K('steg')].teile?.ab?.pausen[0].papier).not.toContain(keys[1])
    expect(tn.wkr.listen[K('steg')].teile?.ab?.pausen[0].papier).toContain(keys[0])
  })

  it('späte Zeile zwischen zwei Fenstern: vor dem Ausfall geprüft, danach angewandt – füllt nichts wieder ein', () => {
    const { s: s0, keys } = drei()
    const r = pruefeZeile(s0, DM, L('gate135'), undefined, 'g1', { z: 1, s: keys[1], c: [['t1a|hin seiteA', '5', '']] })
    if ('fehler' in r) throw new Error(r.fehler)
    expect(r.versuch).toBe(0)
    const n = ausfall(s0, keys[1])
    const spaet = reducer(n, { type: 'WKR_ZEILEN', liste: K('gate135'), quelle: { geraet: 'g1', name: 'Handy Tor 1' }, zeilen: [r], zeit: 9100 })
    expect(spaet).toBe(n)
    // Die Wiederholung (Versuch 1) gilt dagegen.
    const w = einreihenUndZeigen(n, keys[1], 20_000)
    const r1 = pruefeZeile(w, DM, L('gate135'), undefined, 'g1', { z: 2, s: versuchsKennung(keys[1], 1), c: [['t1a|hin seiteA', '10', '']] })
    if ('fehler' in r1) throw new Error(r1.fehler)
    expect(r1.versuch).toBe(1)
    expect(werteVon(reducer(w, { type: 'WKR_ZEILEN', liste: K('gate135'), quelle: { geraet: 'g1', name: 'Handy Tor 1' }, zeilen: [r1], zeit: 21_000 }).eingaben, L1, starterVon(keys[1]))['t1a|hin seiteA']).toBe('10')
  })

  it('„Doch keine Wiederholung“: Werte samt Haken zurück, alte Geräte-Kennung, nichts mehr in Schlange und Rückstand', () => {
    const { s: s0, keys } = drei()
    let s = sende(s0, 'gate135', keys[1], [['t1a|hin seiteA', '5', '']], 1).s
    s = ausfall(s, keys[1])
    expect(erfassungsLage(s, DM, P1, [], 0).listen.find((l) => l.liste === K('gate135'))!.rueckstand?.zahl).toBe(2)
    const auf = reducer(s, { type: 'WIEDERHOLUNG_AUFHEBEN', bereich: P1, ref: keys[1], zeit: 9500 })
    expect(werteVon(auf.eingaben, L1, starterVon(keys[1]))).toEqual({ 't1a|hin seiteA': '5', 'erfasst@gate135': '1' })
    expect(schlange(auf, L('gate135')).map((x) => x.key)).toEqual([keys[0], keys[2]])
    expect(sichtListe(auf, DM, L('gate135'), EXTRA).schlange.map((x) => x.key)).toEqual([keys[0], keys[2]])
    expect(erfassungsLage(auf, DM, P1, [], 0).listen.find((l) => l.liste === K('gate135'))!.rueckstand?.zahl).toBe(2)
    // Eine Korrektur des Geräts unter der alten Kennung gilt wieder (der Versuch ist nicht mehr abgebrochen).
    const korr = sende(auf, 'gate135', keys[1], [['t1a|hin seiteA', '10', '5']], 2)
    expect(korr.fehler).toBeUndefined()
    expect(werteVon(korr.s.eingaben, L1, starterVon(keys[1]))['t1a|hin seiteA']).toBe('10')
  })
})
