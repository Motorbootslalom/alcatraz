import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { normalisiereBetrieb } from '../state/reducer/betrieb'
import { normalisiereWkr } from '../state/reducer/wkr'
import { laufSchluessel } from '../lib/eingaben'
import { beschreibe } from '../lib/verlauf'
import { betriebsStand, fahreRunde, festgeschrieben, parallelStarter, uimParallelStand, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import { abbruecheVon, ausfallGrund, betriebVon, lage, refKey, wartetAufWiederholung, wiederholteZellen } from './folge'
import { configFor } from '../config/konfig'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { rundenErgebnis } from '../lib/parallelErgebnis'
import { messungenIn } from './prognose'
import { sichtOeffentlich, sichtZuschauer } from './sicht'
import type { AppState, PaarSeite, ParallelRunde } from '../types'

// Wiederholung nach Ausfall (Nutzer 26.11.2026, R11-11; BETRIEB_ANNAHMEN WH1–WH10): Die Wettkampfleitung entscheidet für
// einen gezeigten Start eine Wiederholung – die Werte dieses Starters in diesem Lauf werden auf allen Listen verworfen
// (WIEDERHOLUNG_AUSFALL, eine Action der Erfassung), der Start steht unter „Wiederholung offen“ und wird von Hand
// eingereiht. Nur erfundene Starter (testHilfen: e1/k1/e2/k2 auf Parcours 1).

const P1 = 'par_1'
const L1 = laufSchluessel('manoevrieren', 1)
const L2 = laufSchluessel('manoevrieren', 2)
const m = (starter: string, lauf = 1) => refKey({ art: 'm', starter, lauf })
const ausfall = (s: AppState, ref: string, bereich = P1): AppState => reducer(s, { type: 'WIEDERHOLUNG_AUSFALL', bereich, ref, zeit: 9000 })
const einreihen = (s: AppState, ref: string, wo: 'naechster' | 'ende' = 'naechster') => reducer(s, { type: 'BETRIEB_EINREIHEN', bereich: P1, ref, wo })
const tippe = (s: AppState, lauf: string, starter: string, feld: string, wert: string) => reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf, starter, feld, wert }] })
const aufheben = (s: AppState, ref: string): AppState => reducer(s, { type: 'WIEDERHOLUNG_AUFHEBEN', bereich: P1, ref, zeit: 9500 })

/** Lauf 1 auf Parcours 1: e1 (Zeit 1000) und k1 (Zeit 61 000) gezeigt, beide mit Werten; e1 auch in Lauf 2 mit Wert. */
function gefahren(): AppState {
  let s = wkrBetriebsStand()
  s = zeigeNaechsten(zeigeNaechsten(s, P1, 1000), P1, 61_000)
  s = tippe(s, L1, 'e1', 't1a|hin seiteA', '5')
  s = tippe(s, L1, 'e1', 'erfasst@gate135', '1')
  s = tippe(s, L1, 'k1', 't1a|hin seiteA', '10')
  s = tippe(s, L1, 'k1', 'disq@steg', 'A')
  s = tippe(s, L1, 'k1', 'bemerkung@steg', 'Paddel verloren')
  s = tippe(s, L1, 'k1', 'erfasst@steg', '1')
  s = tippe(s, L2, 'k1', 't1a|hin seiteA', '15')
  return s
}

describe('Wiederholung nach Ausfall – Betrieb', () => {
  it('Start im Boot fällt aus: Werte dieses Laufs weg, „Wiederholung offen“, nicht erledigt, fährt nie von selbst', () => {
    const vorher = gefahren()
    expect(lage(vorher, P1).naechster?.key).toBe(m('e2'))
    const s = ausfall(vorher, m('k1'))
    // Werte: k1 in Lauf 1 ganz weg (Bojen, Disq., Bemerkung, Haken); Lauf 2 und e1 bleiben.
    expect(s.eingaben[L1]?.k1).toBeUndefined()
    expect(s.eingaben[L1].e1).toEqual({ 't1a|hin seiteA': '5', 'erfasst@gate135': '1' })
    expect(s.eingaben[L2].k1).toEqual({ 't1a|hin seiteA': '15' })
    // Betrieb: der Versuch bleibt im Verlauf (abgebrochen), der Start wartet.
    const b = betriebVon(s, P1)
    expect(b.gezeigt.map((g) => [g.ref, g.abgebrochen ?? false])).toEqual([
      [m('e1'), false],
      [m('k1'), true],
    ])
    expect(b.wiederholung).toEqual([m('k1')])
    const l = lage(s, P1)
    expect(l.erledigt.has(m('k1'))).toBe(false)
    expect(l.wiederholung.map((e) => e.key)).toEqual([m('k1')])
    expect(l.frei.map((e) => e.key)).not.toContain(m('k1'))
    expect(l.offen.map((e) => e.key)).not.toContain(m('k1'))
    expect(l.nachzuholen).toEqual([])
    // Der Nächste bleibt der Nächste; im Boot steht weiter k1 – als abgebrochen.
    expect(l.naechster?.key).toBe(m('e2'))
    expect([l.aktuell?.key, l.aktuell?.abgebrochen]).toEqual([m('k1'), true])
    expect(abbruecheVon(b, m('k1'))).toBe(1)
    expect(wartetAufWiederholung(b, m('k1'))).toBe(true)
    // Nach dem Zeigen der Nächsten fährt k1 weiter nicht von selbst.
    const weiter = zeigeNaechsten(zeigeNaechsten(s, P1, 120_000), P1, 180_000)
    expect(lage(weiter, P1).wiederholung.map((e) => e.key)).toEqual([m('k1')])
    expect(betriebVon(weiter, P1).gezeigt.map((g) => g.ref)).not.toContain(undefined)
    expect(betriebVon(weiter, P1).gezeigt.filter((g) => g.ref === m('k1'))).toHaveLength(1)
  })

  it('„Als Nächster“ einreihen, dann zeigen: wieder erledigt, zweimal gezeigt (einmal abgebrochen), Liste leer', () => {
    let s = ausfall(gefahren(), m('k1'))
    s = einreihen(s, m('k1'))
    let l = lage(s, P1)
    expect(l.wiederholung).toEqual([])
    expect(l.naechster?.key).toBe(m('k1'))
    expect(betriebVon(s, P1).wiederholung).toBeUndefined()
    s = zeigeNaechsten(s, P1, 200_000)
    l = lage(s, P1)
    expect(l.aktuell?.key).toBe(m('k1'))
    expect(l.aktuell?.abgebrochen).toBe(false)
    expect(l.erledigt.has(m('k1'))).toBe(true)
    expect(betriebVon(s, P1).gezeigt.filter((g) => g.ref === m('k1')).map((g) => g.abgebrochen ?? false)).toEqual([true, false])
    expect(l.naechster?.key).toBe(m('e2'))
  })

  it('ein früherer Start im Lauf; „Ans Ende des Laufs“ und „Jetzt zeigen“', () => {
    // e1 fiel aus, k1 ist schon gezeigt: e1 steht vor dem Zeiger – trotzdem nie „nachzuholen“, sondern „Wiederholung offen“.
    let s = ausfall(gefahren(), m('e1'))
    expect(lage(s, P1).wiederholung.map((e) => e.key)).toEqual([m('e1')])
    expect(lage(s, P1).nachzuholen).toEqual([])
    const ende = einreihen(s, m('e1'), 'ende')
    const lauf1 = lage(ende, P1).frei.filter((e) => e.punkt === 'lauf:1').map((e) => e.key)
    expect(lauf1.at(-1)).toBe(m('e1'))
    // Jetzt zeigen (gezielt, aus der Liste): ohne Einreihen gleich im Boot.
    s = reducer(s, { type: 'BETRIEB_ZEIGEN', bereich: P1, ref: m('e1'), vorher: m('k1'), zeit: 100_000 })
    const l = lage(s, P1)
    expect(l.aktuell?.key).toBe(m('e1'))
    expect(l.erledigt.has(m('e1'))).toBe(true)
    expect(l.wiederholung).toEqual([])
    expect(betriebVon(s, P1).wiederholung).toBeUndefined()
  })

  it('„Zurück“ nimmt den abgebrochenen Versuch nicht; „Doch keine Wiederholung“ lässt ihn wieder gelten', () => {
    const s = ausfall(gefahren(), m('k1'))
    expect(reducer(s, { type: 'BETRIEB_ZURUECK', bereich: P1, ref: m('k1') })).toBe(s)
    // Keine Ampel für ihn: Durchfahrt wird nicht gesetzt.
    expect(reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref: m('k1'), an: true, zeit: 9500 })).toBe(s)
    const auf = aufheben(s, m('k1'))
    expect(lage(auf, P1).erledigt.has(m('k1'))).toBe(true)
    expect(betriebVon(auf, P1).wiederholung).toBeUndefined()
    expect(betriebVon(auf, P1).gezeigt.some((g) => g.abgebrochen)).toBe(false)
    // Die verworfenen Werte kommen zurück (Prüfbefund 27.11.2026) – samt Haken; danach ist nichts mehr gemerkt.
    expect(auf.eingaben[L1].k1).toEqual(gefahren().eingaben[L1].k1)
    expect(auf.wkr.verworfen).toBeUndefined()
    // Doppelt: nichts mehr; nach dem Wiederzeigen ebenso nichts.
    expect(aufheben(auf, m('k1'))).toBe(auf)
    const wieder = zeigeNaechsten(einreihen(s, m('k1')), P1, 200_000)
    expect(aufheben(wieder, m('k1'))).toBe(wieder)
  })

  it('„Doch keine Wiederholung“: nur in leere Zellen, „keine Zeit“ zurück, zweiter Ausfall nimmt nur den letzten Versuch zurück', () => {
    const s = ausfall(gefahren(), m('k1'))
    expect(s.wkr.verworfen).toEqual([
      {
        bereich: P1,
        ref: m('k1'),
        lauf: L1,
        starter: 'k1',
        werte: { 't1a|hin seiteA': '10', 'disq@steg': 'A', 'bemerkung@steg': 'Paddel verloren', 'erfasst@steg': '1' },
        keineZeit: {},
      },
    ])
    // Seit dem Ausfall von Hand eingetragen: bleibt; der Rest kommt zurück.
    const getippt = tippe(s, L1, 'k1', 't1a|hin seiteA', '15')
    const auf = aufheben(getippt, m('k1'))
    expect(auf.eingaben[L1].k1).toEqual({ 't1a|hin seiteA': '15', 'disq@steg': 'A', 'bemerkung@steg': 'Paddel verloren', 'erfasst@steg': '1' })
    // „Keine Zeit“ einer Liste kommt mit zurück.
    const kz = { ...gefahren(), wkr: { ...gefahren().wkr, keineZeit: { liste: { [`${L1}|k1`]: { 'zeit@x': 'anlage' as const } } } } }
    const mitKz = ausfall(kz, m('k1'))
    expect(mitKz.wkr.keineZeit).toEqual({})
    expect(aufheben(mitKz, m('k1')).wkr.keineZeit).toEqual({ liste: { [`${L1}|k1`]: { 'zeit@x': 'anlage' } } })
    // Zweiter Ausfall (der Wiederholung): Aufheben lässt nur den zweiten Versuch wieder gelten – mit dessen Werten.
    let zwei = zeigeNaechsten(einreihen(s, m('k1')), P1, 200_000)
    zwei = tippe(zwei, L1, 'k1', 't1a|hin seiteA', '20')
    zwei = ausfall(zwei, m('k1'))
    expect(abbruecheVon(betriebVon(zwei, P1), m('k1'))).toBe(2)
    const zurueck = aufheben(zwei, m('k1'))
    expect(abbruecheVon(betriebVon(zurueck, P1), m('k1'))).toBe(1)
    expect(zurueck.eingaben[L1].k1).toEqual({ 't1a|hin seiteA': '20' })
    expect(lage(zurueck, P1).erledigt.has(m('k1'))).toBe(true)
  })

  it('verworfene Werte: weg mit dem Betrieb, mit dem Starter, mit dem Lauf; Laden prüft sie', () => {
    const s = ausfall(gefahren(), m('k1'))
    expect(s.wkr.verworfen).toHaveLength(1)
    expect(reducer(s, { type: 'BETRIEB_ZURUECKSETZEN' }).wkr.verworfen).toBeUndefined()
    expect(reducer(s, { type: 'CLEAR_EINGABEN_TEIL', laeufe: [1] }).wkr.verworfen).toBeUndefined()
    expect(reducer(s, { type: 'CLEAR_EINGABEN_TEIL', laeufe: [2] }).wkr.verworfen).toHaveLength(1)
    // Laden: wie gespeichert; Kaputtes fällt einzeln, unbekannte Starter ebenso.
    const ids = new Set(s.starters.map((p) => p.id))
    expect(normalisiereWkr(JSON.parse(JSON.stringify(s.wkr)), ids)).toEqual(s.wkr)
    const roh = JSON.parse(JSON.stringify(s.wkr))
    roh.verworfen.push({ ...roh.verworfen[0], starter: 'gibtsnicht' }, { ...roh.verworfen[0], ref: 'kaputt' }, 7)
    expect(normalisiereWkr(roh, ids).verworfen).toEqual(s.wkr.verworfen)
    expect(normalisiereWkr({ ...roh, verworfen: [] }, ids).verworfen).toBeUndefined()
  })

  it('nur gezeigte, geltende Starts des Manövrierens; abgemeldete nicht; doppelt geschickt ändert nichts', () => {
    const s = gefahren()
    // Nicht gezeigt (e2), anderer Bereich, kaputte Kennung.
    expect(ausfall(s, m('e2'))).toBe(s)
    expect(ausfall(s, m('k1'), 'par_2')).toBe(s)
    expect(ausfall(s, 'kaputt')).toBe(s)
    // Abgemeldet (WH10): Das X käme nicht zurück.
    expect(ausfall({ ...s, abgemeldet: ['k1'] }, m('k1'))).toEqual({ ...s, abgemeldet: ['k1'] })
    const einmal = ausfall(s, m('k1'))
    expect(ausfall(einmal, m('k1'))).toBe(einmal)
    // Zweiter Ausfall der Wiederholung: zwei Abbrüche.
    const zweiter = ausfall(zeigeNaechsten(einreihen(einmal, m('k1')), P1, 200_000), m('k1'))
    expect(abbruecheVon(betriebVon(zweiter, P1), m('k1'))).toBe(2)
    expect(lage(zweiter, P1).wiederholung.map((e) => e.key)).toEqual([m('k1')])
  })

  it('Prüfbefund 27.11.2026: an den gesehenen Versuch gebunden (`abbrueche`); mit X kein „Doch keine Wiederholung“', () => {
    const s = gefahren()
    // Falsche Zahl: nichts; richtige: wirkt. Ohne Zahl (ältere Aufrufer, Tests) wie bisher.
    expect(reducer(s, { type: 'WIEDERHOLUNG_AUSFALL', bereich: P1, ref: m('k1'), abbrueche: 1, zeit: 9000 })).toBe(s)
    const einmal = reducer(s, { type: 'WIEDERHOLUNG_AUSFALL', bereich: P1, ref: m('k1'), abbrueche: 0, zeit: 9000 })
    expect(lage(einmal, P1).wiederholung.map((e) => e.key)).toEqual([m('k1')])
    // Eingereiht und wieder gezeigt: Eine verspätete Action mit der alten Zahl trifft die Wiederholung nicht.
    const wieder = zeigeNaechsten(einreihen(einmal, m('k1')), P1, 200_000)
    const getippt = tippe(wieder, L1, 'k1', 't1a|hin seiteA', '20')
    expect(reducer(getippt, { type: 'WIEDERHOLUNG_AUSFALL', bereich: P1, ref: m('k1'), abbrueche: 0, zeit: 9100 })).toBe(getippt)
    // „Doch keine Wiederholung“ für den ersten Ausfall hebt keinen zweiten auf.
    const zweiter = reducer(getippt, { type: 'WIEDERHOLUNG_AUSFALL', bereich: P1, ref: m('k1'), abbrueche: 1, zeit: 9200 })
    expect(abbruecheVon(betriebVon(zweiter, P1), m('k1'))).toBe(2)
    expect(reducer(zweiter, { type: 'WIEDERHOLUNG_AUFHEBEN', bereich: P1, ref: m('k1'), abbrueche: 1, zeit: 9300 })).toBe(zweiter)
    expect(reducer(zweiter, { type: 'WIEDERHOLUNG_AUFHEBEN', bereich: P1, ref: m('k1'), abbrueche: 2, zeit: 9300 })).not.toBe(zweiter)
    // X nach dem Ausfall (etwa durch die Abmeldung): Der Start entfällt, „Doch keine Wiederholung“ schriebe die alte Zeit
    // neben das X – nichts ändert sich.
    const x = tippe(einmal, L1, 'k1', 'disq@steg', 'X')
    expect(lage(x, P1).wiederholung).toEqual([])
    expect(aufheben(x, m('k1'))).toBe(x)
  })

  it('Versuche direkt nacheinander: die Zeile am Vorsteg (gilt für alle Versuche) bleibt, der Rest des Versuchs geht (WH6)', () => {
    // Nur UIM kennt „Versuche direkt nacheinander“ (Regelwerk-YAML `versucheNacheinander`).
    let s = reducer(betriebsStand(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    s = reducer(s, { type: 'SET_VERSUCHE_NACHEINANDER', on: true })
    s = festgeschrieben(s)
    expect(lage(s, P1).programm).toEqual(['lauf:1'])
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:1' })
    s = zeigeNaechsten(zeigeNaechsten(s, P1, 1000), P1, 2000)
    // Der zweite gezeigte Start ist der zweite Versuch desselben Starters.
    const k = lage(s, P1).aktuell!.eintrag!
    expect(k.lauf).toBe(2)
    const lauf = laufSchluessel('manoevrieren', k.lauf)
    s = tippe(s, lauf, k.starter, 'disq@vorsteg', 'W')
    s = tippe(s, lauf, k.starter, 'erfasst@vorsteg', '1')
    s = tippe(s, lauf, k.starter, 't1a|hin seiteA', '5')
    const n = ausfall(s, k.key)
    expect(n.eingaben[lauf][k.starter]).toEqual({ 'disq@vorsteg': 'W', 'erfasst@vorsteg': '1' })
  })

  it('Laden: abgebrochen und „Wiederholung offen“ überstehen normalisiereBetrieb; Unbrauchbares fällt', () => {
    const s = ausfall(gefahren(), m('k1'))
    expect(normalisiereBetrieb(JSON.parse(JSON.stringify(s.betrieb)))).toEqual(s.betrieb)
    const roh = JSON.parse(JSON.stringify(s.betrieb))
    roh.bereiche[P1].wiederholung = [m('k1'), m('e1'), 'kaputt']
    roh.bereiche[P1].gezeigt[0].abgebrochen = 'ja'
    const n = normalisiereBetrieb(roh)
    // e1 hat keinen abgebrochenen Versuch: nicht offen; „ja“ ist kein `true`.
    expect(n.bereiche[P1].wiederholung).toEqual([m('k1')])
    expect(n.bereiche[P1].gezeigt[0].abgebrochen).toBeUndefined()
  })

  it('Startabstand: ein abgebrochener Versuch misst nicht', () => {
    const s = ausfall(gefahren(), m('e1'))
    const l = lage(s, P1)
    const b = betriebVon(s, P1)
    expect(messungenIn(P1, b.gezeigt, l.folge, b.ohneAnzeige, () => 'E')).toEqual([])
    expect(messungenIn(P1, gefahren().betrieb.bereiche[P1].gezeigt, l.folge, [], () => 'E')).toHaveLength(1)
  })

  it('Verlauf: eigener Eintrag mit Klasse und Lauf; Erfassung kennt die Zelle', () => {
    const s = gefahren()
    // Mit Startnummer (Prüfbefund 27.11.2026): mehrere Ausfälle in derselben Klasse und demselben Lauf unterscheidbar.
    const nr = s.starters.find((p) => p.id === 'k1')!.startNr
    expect(nr).not.toBe('')
    expect(beschreibe({ type: 'WIEDERHOLUNG_AUSFALL', bereich: P1, ref: m('k1') }, s)).toEqual({ art: 'wiederholungAusfall', startNr: nr, klasse: '1', lauf: 1 })
    expect(beschreibe({ type: 'WIEDERHOLUNG_AUFHEBEN', bereich: P1, ref: m('k1') }, s)).toEqual({ art: 'wiederholungAufgehoben', startNr: nr, klasse: '1', lauf: 1 })
    const n = ausfall(s, m('k1'))
    expect([...wiederholteZellen(n, (lauf) => laufSchluessel('manoevrieren', lauf))]).toEqual([`${L1}|k1`])
    // Die Liste bekommt einen neuen Zeitpunkt (wie beim Löschen).
    expect(n.listenStand).not.toEqual(s.listenStand)
  })
})

describe('Wiederholung nach Ausfall – öffentliche Sicht (sv 7, `gefahren` seit sv 8)', () => {
  it('„Wiederholung offen“ in der Sicht; der abgebrochene Versuch im Boot ohne „Wiederholung“, die Wiederholung mit', () => {
    const s = ausfall(gefahren(), m('k1'))
    const sicht = sichtOeffentlich(s)
    expect(sicht.sv).toBe(9)
    const b = sicht.bereiche[0]
    expect(b.wiederholung.map((x) => [x.key, x.titel, x.wiederholung])).toEqual([[m('k1'), '1. Lauf · Wiederholung', true]])
    expect(b.aktuell).toMatchObject({ key: m('k1'), titel: '1. Lauf', abgebrochen: true })
    expect(b.aktuell?.wiederholung).toBeUndefined()
    // Die Wahl der Gefahrenen steht seit sv 8 in jeder Sicht (R13-01: auch das Freigabe-Handy löst aus) – ohne den
    // abgebrochenen Versuch.
    expect(b.gefahren.map((x) => x.key)).toEqual([m('e1')])
    // Eingereiht und gezeigt: Im Boot die Wiederholung, auf der Tafel mit „Wiederholung“ im Titel.
    const wieder = zeigeNaechsten(einreihen(s, m('k1')), P1, 200_000)
    const a = sichtOeffentlich(wieder).bereiche[0]
    expect(a.aktuell).toMatchObject({ key: m('k1'), titel: '1. Lauf · Wiederholung', wiederholung: true })
    expect(a.aktuell?.abgebrochen).toBeUndefined()
    expect(a.vorig?.key).toBe(m('k1'))
    expect(a.vorig?.abgebrochen).toBe(true)
    // Englische Tafel: „Repeat“ – nicht „Re-run“, das ist unter UIM die Runde des Parallelslaloms (Prüfbefund 27.11.2026).
    const en = sichtOeffentlich(reducer(wieder, { type: 'SET_ANZEIGE', patch: { sprache: 'en' } })).bereiche[0]
    expect(en.aktuell?.titel).toMatch(/· Repeat$/)
  })

  it('Zuschauersicht: kein neues Feld – nur der Titel sagt „Wiederholung“, nie ein Grund; keine Werte', () => {
    const s = einreihen(ausfall(gefahren(), m('k1')), m('k1'))
    const z = sichtZuschauer(sichtOeffentlich(s))
    const text = JSON.stringify(z)
    for (const wort of ['abgebrochen', '"wiederholung"', 'Ausfall', 'Paddel', 'gefahren']) expect(text).not.toContain(wort)
    expect(z.bereiche[0].frei[0]).toEqual({ key: m('k1'), starter: 'k1', lauf: 1, punkt: 'lauf:1', titel: '1. Lauf · Wiederholung' })
  })

  it('`gefahren` = gezeigte, geltende Starts, der jüngste zuerst, ohne abgebrochene (seit sv 8 in jeder Sicht)', () => {
    const s = gefahren()
    expect(sichtOeffentlich(s).bereiche[0].gefahren.map((x) => x.key)).toEqual([m('k1'), m('e1')])
    const n = ausfall(s, m('k1'))
    expect(sichtOeffentlich(n).bereiche[0].gefahren.map((x) => x.key)).toEqual([m('e1')])
    // Parcours 2 hat nichts gezeigt.
    expect(sichtOeffentlich(n).bereiche[1].gefahren).toEqual([])
  })
})

// Wiederholung nach Ausfall im Parallelslalom (Nutzer 27.11.2026, R13-02: „Auch hier kann es zu technischen Ausfällen
// kommen.“; BETRIEB_ANNAHMEN WHP1–WHP6): Ein Paar-Start wird wiederholt – nur ein Boot oder beide, gefragt jedes Mal.
// Erfundene Starter (testHilfen parallelStarter: `<klasse>-<n>`).
describe('Wiederholung nach Ausfall – Parallelslalom (R13-02)', () => {
  const PA = 'parallel'
  const UIM = configFor({ regelwerk: 'uim-2026' })
  const p = (runde: ParallelRunde, attempt: 1 | 2, a: string | null, b: string | null) => refKey({ art: 'p', runde, attempt, a, b })
  const pausfall = (s: AppState, ref: string, nur?: PaarSeite): AppState => reducer(s, { type: 'WIEDERHOLUNG_AUSFALL', bereich: PA, ref, ...(nur ? { nur } : {}), zeit: 9000 })
  const paufheben = (s: AppState, ref: string): AppState => reducer(s, { type: 'WIEDERHOLUNG_AUFHEBEN', bereich: PA, ref, zeit: 9500 })
  const peinreihen = (s: AppState, ref: string, wo: 'naechster' | 'ende' = 'naechster') => reducer(s, { type: 'BETRIEB_EINREIHEN', bereich: PA, ref, wo })
  const VORLAUF6 = { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43], '1-5': [50, 50], '1-6': [55, 55] }
  const SEMI = p('semi', 1, '1-1', '1-2')
  const SEMI2 = p('semi', 2, '1-2', '1-1')
  const S1 = attemptSchluessel('semi', 1)
  const BOJE = 'b1a'

  /** Klasse 1: Vorlauf gefahren, Halbfinale festgeschrieben und begonnen, das erste Paar (1-1 auf A, 1-2 auf B) gezeigt, Werte beider. */
  function imBoot(): AppState {
    let s = fahreRunde(uimParallelStand(parallelStarter('1', 6)), 'pre', VORLAUF6)
    s = reducer(s, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: PA, punkt: 'runde:semi', zeit: 500 })
    s = zeigeNaechsten(s, PA, 1000)
    expect(lage(s, PA).aktuell?.key).toBe(SEMI)
    s = fahreRunde(s, 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: S1, starter: '1-1', feld: BOJE, wert: '5' }, { lauf: S1, starter: '1-2', feld: BOJE, wert: '5' }] })
    return s
  }

  it('nur A: dessen Werte in diesem Attempt weg, B behält seine; „Wiederholung offen“ als Paar mit B „–“', () => {
    const vorher = imBoot()
    const s = pausfall(vorher, SEMI, 'a')
    expect(s.eingaben[S1]['1-1']).toBeUndefined()
    expect(s.eingaben[S1]['1-2']).toEqual(vorher.eingaben[S1]['1-2'])
    // Der 2. Attempt desselben Paares bleibt.
    expect(s.eingaben[attemptSchluessel('semi', 2)]['1-1']).toEqual(vorher.eingaben[attemptSchluessel('semi', 2)]['1-1'])
    const b = betriebVon(s, PA)
    expect(b.gezeigt.at(-1)).toEqual({ ref: SEMI, zeit: 1000, abgebrochen: true, nur: 'a' })
    expect(b.wiederholung).toEqual([SEMI])
    expect([abbruecheVon(b, SEMI), abbruecheVon(b, SEMI, 'a'), abbruecheVon(b, SEMI, 'b')]).toEqual([1, 1, 0])
    expect(s.wkr.verworfen?.map((v) => [v.starter, v.lauf])).toEqual([['1-1', S1]])
    const l = lage(s, PA)
    expect(l.wiederholung.map((e) => e.key)).toEqual([SEMI])
    expect(l.erledigt.has(SEMI)).toBe(false)
    // Tafel und Start-Freigabe (englisch, UIM): die Wiederholung nur mit A; der abgebrochene Versuch im Boot mit beiden.
    const sb = sichtOeffentlich(s).bereiche.find((x) => x.id === PA)!
    expect(sb.wiederholung.map((x) => [x.key, x.paar, x.titel, x.wiederholung])).toEqual([[SEMI, { attempt: 1, a: '1-1', b: null }, 'Semi-finals · Attempt 1 · Repeat', true]])
    expect(sb.aktuell).toMatchObject({ key: SEMI, abgebrochen: true, paar: { attempt: 1, a: '1-1', b: '1-2' }, titel: 'Semi-finals · Attempt 1' })
    expect(sb.aktuell?.wiederholung).toBeUndefined()
    // Erfassung: ↻ nur beim Boot, das wiederholt.
    expect([...wiederholteZellen(s, (lauf) => laufSchluessel('manoevrieren', lauf))]).toEqual([`${S1}|1-1`])
    // Eingereiht und gezeigt: im Boot die Wiederholung mit A allein; die Zuschauerliste nur über den Titel.
    const w = zeigeNaechsten(peinreihen(s, SEMI), PA, 20_000)
    const wb = sichtOeffentlich(w).bereiche.find((x) => x.id === PA)!
    expect(wb.aktuell).toMatchObject({ key: SEMI, paar: { attempt: 1, a: '1-1', b: null }, wiederholung: true, titel: 'Semi-finals · Attempt 1 · Repeat' })
    expect(wb.vorig).toMatchObject({ key: SEMI, abgebrochen: true, paar: { attempt: 1, a: '1-1', b: '1-2' } })
    // Ein weiterer Ausfall bietet nur noch A an (`gefahren`) – B zu wiederholen ändert nichts.
    expect(wb.gefahren?.find((x) => x.key === SEMI)?.paar).toEqual({ attempt: 1, a: '1-1', b: null })
    expect(pausfall(w, SEMI, 'b')).toBe(w)
    const zweiter = pausfall(w, SEMI)
    expect(betriebVon(zweiter, PA).gezeigt.at(-1)).toMatchObject({ abgebrochen: true, nur: 'a' })
    const z = sichtZuschauer(sichtOeffentlich(w)).bereiche.find((x) => x.id === PA)!
    expect(z.aktuell?.titel).toBe('Semi-finals · Attempt 1 · Repeat')
    expect(JSON.stringify(z)).not.toContain('"wiederholung"')
  })

  it('„Doch keine Wiederholung“ holt die Werte des Boots zurück; ohne `nur`: beide Boote, je Boot gemerkt', () => {
    const vorher = imBoot()
    const auf = paufheben(pausfall(vorher, SEMI, 'a'), SEMI)
    expect(auf.eingaben).toEqual(vorher.eingaben)
    expect(auf.wkr.verworfen).toBeUndefined()
    expect(betriebVon(auf, PA).gezeigt.at(-1)).toEqual({ ref: SEMI, zeit: 1000 })
    expect(lage(auf, PA).erledigt.has(SEMI)).toBe(true)
    // Beide: beider Werte weg, zwei Einträge; zurück kommen beide (nur in leere Zellen).
    const beide = pausfall(vorher, SEMI)
    expect([beide.eingaben[S1]['1-1'], beide.eingaben[S1]['1-2']]).toEqual([undefined, undefined])
    expect(beide.wkr.verworfen?.map((v) => v.starter)).toEqual(['1-1', '1-2'])
    expect(betriebVon(beide, PA).gezeigt.at(-1)).toEqual({ ref: SEMI, zeit: 1000, abgebrochen: true })
    expect(sichtOeffentlich(beide).bereiche.find((x) => x.id === PA)!.wiederholung[0].paar).toEqual({ attempt: 1, a: '1-1', b: '1-2' })
    const getippt = reducer(beide, { type: 'SET_EINGABEN', zellen: [{ lauf: S1, starter: '1-2', feld: 'zeit1', wert: '39,00' }] })
    const zurueck = paufheben(getippt, SEMI)
    expect(zurueck.eingaben[S1]['1-1']).toEqual(vorher.eingaben[S1]['1-1'])
    expect(zurueck.eingaben[S1]['1-2']).toEqual({ ...vorher.eingaben[S1]['1-2'], zeit1: '39,00' })
    // Laden: `nur` und je Boot ein verworfener Eintrag überstehen die Normalisierer; `nur` an einem Lauf fällt weg.
    const a = pausfall(vorher, SEMI, 'a')
    expect(normalisiereBetrieb(JSON.parse(JSON.stringify(a.betrieb)))).toEqual(a.betrieb)
    const ids = new Set(beide.starters.map((x) => x.id))
    expect(normalisiereWkr(JSON.parse(JSON.stringify(beide.wkr)), ids)).toEqual(beide.wkr)
    const roh = JSON.parse(JSON.stringify(ausfall(gefahren(), m('k1')).betrieb))
    roh.bereiche[P1].gezeigt[1].nur = 'a'
    expect(normalisiereBetrieb(roh).bereiche[P1].gezeigt[1]).toEqual({ ref: m('k1'), zeit: 61_000, abgebrochen: true })
  })

  it('nur Gezeigtes, nur Boote, die fuhren, keine Abgemeldeten; Kennung muss zum Bereich passen', () => {
    const s = imBoot()
    // Nicht gezeigt, fremder Bereich, eine Kennung des Manövrierens im Parallelslalom.
    expect(pausfall(s, p('semi', 1, '1-3', '1-4'))).toBe(s)
    expect(reducer(s, { type: 'WIEDERHOLUNG_AUSFALL', bereich: 'par_1', ref: SEMI, zeit: 9000 })).toBe(s)
    expect(pausfall(s, m('1-1'))).toBe(s)
    // Abgemeldet (WH10, je Boot): A gesperrt, B geht.
    const ab = { ...s, abgemeldet: ['1-1'] }
    expect(pausfall(ab, SEMI, 'a')).toBe(ab)
    expect(pausfall(ab, SEMI)).toBe(ab)
    expect(pausfall(ab, SEMI, 'b').eingaben[S1]['1-1']).toEqual(s.eingaben[S1]['1-1'])
    // Leere Seite (X auf B): nur A fuhr – „ohne nur“ wiederholt A und merkt es als `nur`.
    const x = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: S1, starter: '1-2', feld: 'disq@steg', wert: 'X' }] })
    expect(lage(x, PA).folge.find((e) => e.key === SEMI)?.paar?.bFaehrt).toBe(false)
    expect(pausfall(x, SEMI, 'b')).toBe(x)
    expect(betriebVon(pausfall(x, SEMI), PA).gezeigt.at(-1)).toMatchObject({ abgebrochen: true, nur: 'a' })
  })

  it('Prüfbefund 27.11.2026: nur A wiederholt, danach fährt A nicht mehr (X, Abmeldung) – das Paar entfällt wie im Manövrieren', () => {
    const s = pausfall(imBoot(), SEMI, 'a')
    const b = s.eingaben[S1]['1-2']
    for (const [wie, x] of [
      ['X von Hand', reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: S1, starter: '1-1', feld: 'disq@steg', wert: 'X' }] })],
      ['abgemeldet', reducer(s, { type: 'ABMELDEN_STARTER', id: '1-1' })],
    ] as const) {
      expect(lage(x, PA).folge.find((e) => e.key === SEMI)?.paar?.aFaehrt, wie).toBe(false)
      const l = lage(x, PA)
      // Nicht unter „Wiederholung offen“, nicht offen/frei, nicht in der Wahl – kein leeres Paar auf der Tafel.
      expect(l.wiederholung, wie).toEqual([])
      expect([...l.offen, ...l.frei, ...l.zurueckgestellt, ...l.nachzuholen].map((e) => e.key), wie).not.toContain(SEMI)
      const sb = sichtOeffentlich(x).bereiche.find((y) => y.id === PA)!
      expect(sb.wiederholung, wie).toEqual([])
      expect(sb.gefahren.map((y) => y.key), wie).not.toContain(SEMI)
      expect(JSON.stringify(sichtZuschauer(sichtOeffentlich(x))), wie).not.toContain('null,null')
      // „Doch keine Wiederholung“ und Einreihen ändern nichts; B behält seine Werte.
      expect(paufheben(x, SEMI), wie).toBe(x)
      expect(peinreihen(x, SEMI), wie).toBe(x)
      expect(x.eingaben[S1]['1-2'], wie).toEqual(b)
      expect(ausfallGrund(x, PA, SEMI), wie).toBe('nicht-gezeigt')
    }
    // Die Abmeldung zurückgenommen: Die Wiederholung wartet wieder.
    const zurueck = reducer(reducer(s, { type: 'ABMELDEN_STARTER', id: '1-1' }), { type: 'ANMELDEN_STARTER', id: '1-1' })
    expect(lage(zurueck, PA).wiederholung.map((e) => e.key)).toEqual([SEMI])
    // Die Wiederholung gezeigt, dann X für A: kein leeres Paar in der Wahl (`gefahren`), nichts mehr auszulösen.
    const w = zeigeNaechsten(peinreihen(s, SEMI), PA, 20_000)
    const wx = reducer(w, { type: 'SET_EINGABEN', zellen: [{ lauf: S1, starter: '1-1', feld: 'disq@steg', wert: 'X' }] })
    const wb = sichtOeffentlich(wx).bereiche.find((y) => y.id === PA)!
    expect(wb.gefahren.map((y) => y.key)).not.toContain(SEMI)
    expect(wb.gefahren.every((y) => !y.paar || y.paar.a !== null || y.paar.b !== null)).toBe(true)
    expect(ausfallGrund(wx, PA, SEMI)).toBe('nicht-gezeigt')
    expect(pausfall(wx, SEMI)).toBe(wx)
    // Beide wiederholt, dann A abgemeldet (X): „Doch keine Wiederholung“ holt nur B zurück – nie die alte Zeit neben das X.
    const beide = reducer(pausfall(imBoot(), SEMI), { type: 'ABMELDEN_STARTER', id: '1-1' })
    expect(lage(beide, PA).wiederholung.map((e) => e.key)).toEqual([SEMI])
    const auf = paufheben(beide, SEMI)
    expect(auf.eingaben[S1]['1-2']).toEqual(imBoot().eingaben[S1]['1-2'])
    expect(auf.eingaben[S1]['1-1']).toEqual(beide.eingaben[S1]['1-1'])
    expect(Object.values(auf.eingaben[S1]['1-1'])).toContain('X')
  })

  it('Einreihen als Paar (R13-13): „Ans Ende der Runde“ nimmt den 2. Attempt mit; „Nächster Start“ vorher zeigt ihn', () => {
    const s = pausfall(imBoot(), SEMI, 'a')
    expect(lage(s, PA).frei.map((e) => e.key)).toEqual([SEMI2, p('semi', 1, '1-3', '1-4'), p('semi', 2, '1-4', '1-3')])
    const ende = peinreihen(s, SEMI, 'ende')
    expect(lage(ende, PA).frei.map((e) => e.key)).toEqual([p('semi', 1, '1-3', '1-4'), p('semi', 2, '1-4', '1-3'), SEMI, SEMI2])
    const naechster = peinreihen(s, SEMI)
    expect(lage(naechster, PA).frei.map((e) => e.key).slice(0, 2)).toEqual([SEMI, SEMI2])
    // Zurückstellen des 2. Attempts lässt die Wiederholung, wo sie ist.
    const zurueck = reducer(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: PA, ref: SEMI2 })
    expect(betriebVon(zurueck, PA).zurueckgestellt).toEqual([SEMI2])
    expect(lage(zurueck, PA).wiederholung.map((e) => e.key)).toEqual([SEMI])
    // Einreihen der Wiederholung holt den zurückgestellten Attempt mit (wie bisher).
    expect(lage(peinreihen(zurueck, SEMI), PA).frei.map((e) => e.key).slice(0, 2)).toEqual([SEMI, SEMI2])
    // Ohne Einreihen ist der Nächste der 2. Attempt (WHP5: er wartet nicht von selbst).
    expect(lage(zeigeNaechsten(s, PA, 2000), PA).aktuell?.key).toBe(SEMI2)
  })

  it('Wertung: der wiederholte Attempt zählt wie jeder andere; kein Re-run dadurch; Pläne und Druckvermerk bleiben', () => {
    let s = reducer(imBoot(), { type: 'PARALLEL_RUNDEN_GEDRUCKT', runden: ['semi'], zeit: 800 })
    const gedruckt = s.parallelGedruckt
    expect(Object.keys(gedruckt)).toContain('semi')
    const vorher = rundenErgebnis(s, UIM, '1', 'semi')!
    const sek = (e: typeof vorher, id: string) => e.gesamt.nachNummer.find((z) => z.starter.id === id)!.gesamt
    // Je 5 s für die berührte Boje im 1. Attempt.
    expect([sek(vorher, '1-1'), sek(vorher, '1-2')]).toEqual([8500, 8700])
    const plaene = s.parallelPlaene
    s = pausfall(s, SEMI, 'a')
    expect(s.parallelPlaene).toBe(plaene)
    expect(s.parallelGedruckt).toBe(gedruckt)
    expect(sek(rundenErgebnis(s, UIM, '1', 'semi')!, '1-1')).toBeNull()
    s = zeigeNaechsten(peinreihen(s, SEMI), PA, 20_000)
    // Die Wiederholung: 43 s ohne Boje – sie gilt statt des abgebrochenen Attempts.
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: S1, starter: '1-1', feld: 'zeit1', wert: '43,00' }] })
    const nachher = rundenErgebnis(s, UIM, '1', 'semi')!
    expect([sek(nachher, '1-1'), sek(nachher, '1-2')]).toEqual([8300, 8700])
    expect(nachher.rerun).toEqual([])
    expect(nachher.gesamt.nachPlatz.map((z) => z.starter.id)).toEqual(['1-1', '1-3', '1-4', '1-2'])
  })

  it('Verlauf: Startnummer des wiederholenden Boots, Runde und Attempt', () => {
    const s = imBoot()
    const nr = (id: string) => s.starters.find((x) => x.id === id)!.startNr
    expect(beschreibe({ type: 'WIEDERHOLUNG_AUSFALL', bereich: PA, ref: SEMI, nur: 'b' }, s)).toEqual({ art: 'wiederholungAusfall', startNr: nr('1-2'), klasse: '1', runde: 'semi', lauf: 1 })
    expect(beschreibe({ type: 'WIEDERHOLUNG_AUSFALL', bereich: PA, ref: SEMI }, s)).toEqual({ art: 'wiederholungAusfall', startNr: `${nr('1-1')} / ${nr('1-2')}`, klasse: '1', runde: 'semi', lauf: 1 })
    // Prüfbefund 27.11.2026: aus dem Ergebnis (verworfene Werte je Boot) – fuhr nur A (X auf B), nennt der Verlauf nur A,
    // auch ohne `nur`; das Aufheben nennt die Boote aus dem Stand davor, nicht beide laut Plan.
    const x = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: S1, starter: '1-2', feld: 'disq@steg', wert: 'X' }] })
    const aus = { type: 'WIEDERHOLUNG_AUSFALL', bereich: PA, ref: SEMI } as const
    const nachAusfall = reducer(x, aus)
    expect(beschreibe(aus, nachAusfall)?.startNr).toBe(nr('1-1'))
    const nurA = pausfall(s, SEMI, 'a')
    const auf = { type: 'WIEDERHOLUNG_AUFHEBEN', bereich: PA, ref: SEMI } as const
    expect(beschreibe(auf, reducer(nurA, auf), nurA)?.startNr).toBe(nr('1-1'))
  })
})
