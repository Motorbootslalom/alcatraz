import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { normalisiereBetrieb } from '../state/reducer/betrieb'
import { normalisiereWkr } from '../state/reducer/wkr'
import { laufSchluessel } from '../lib/eingaben'
import { beschreibe } from '../lib/verlauf'
import { betriebsStand, festgeschrieben, uimParallelStand, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import { abbruecheVon, betriebVon, lage, refKey, wartetAufWiederholung, wiederholteZellen } from './folge'
import { messungenIn } from './prognose'
import { sichtOeffentlich, sichtZuschauer } from './sicht'
import type { AppState } from '../types'

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

  it('Parallelslalom: keine Wiederholung über diesen Weg (dort gilt der Re-run)', () => {
    let s = uimParallelStand()
    const runde = lage(s, 'parallel').programm[0]
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: runde })
    s = zeigeNaechsten(s, 'parallel', 1000)
    const key = lage(s, 'parallel').aktuell!.key
    expect(ausfall(s, key, 'parallel')).toBe(s)
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

describe('Wiederholung nach Ausfall – öffentliche Sicht (sv 7)', () => {
  it('„Wiederholung offen“ in der Sicht; der abgebrochene Versuch im Boot ohne „Wiederholung“, die Wiederholung mit', () => {
    const s = ausfall(gefahren(), m('k1'))
    const sicht = sichtOeffentlich(s)
    expect(sicht.sv).toBe(7)
    const b = sicht.bereiche[0]
    expect(b.wiederholung.map((x) => [x.key, x.titel, x.wiederholung])).toEqual([[m('k1'), '1. Lauf · Wiederholung', true]])
    expect(b.aktuell).toMatchObject({ key: m('k1'), titel: '1. Lauf', abgebrochen: true })
    expect(b.aktuell?.wiederholung).toBeUndefined()
    // Ohne Option keine Wahl der Gefahrenen (nie auf der Leitung).
    expect(b.gefahren).toBeUndefined()
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

  it('Bedienrechner: `gefahren` = gezeigte, geltende Starts, der jüngste zuerst, ohne abgebrochene', () => {
    const s = gefahren()
    expect(sichtOeffentlich(s, { gefahren: true }).bereiche[0].gefahren?.map((x) => x.key)).toEqual([m('k1'), m('e1')])
    const n = ausfall(s, m('k1'))
    expect(sichtOeffentlich(n, { gefahren: true }).bereiche[0].gefahren?.map((x) => x.key)).toEqual([m('e1')])
    // Parcours 2 hat nichts gezeigt.
    expect(sichtOeffentlich(n, { gefahren: true }).bereiche[1].gefahren).toEqual([])
  })
})
