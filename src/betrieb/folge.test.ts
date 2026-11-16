import { describe, expect, it } from 'vitest'
import { reducer } from '../state/reducer'
import { planEvent } from '../planung/plan'
import { laufSchluessel } from '../lib/eingaben'
import { BETRIEB_STARTER, betriebsStand, betriebStarter, festgeschrieben, zeigeNaechsten } from '../testHilfen'
import { bereicheZumStand, istPunktId, lage, liesRef, programm, refKey, startfolge } from './folge'
import type { AppState, StartRef } from '../types'

// Die abgeleitete Folge der Starts im Betrieb. Alle Starter sind erfunden (Vor<id>/Nach<id>, Musterclub).

const P1 = 'par_1'
const P2 = 'par_2'
const m = (starter: string, lauf: number) => refKey({ art: 'm', starter, lauf })
/** Die Folge als „starter/lauf“ – lesbar im Vergleich. */
const kurz = (s: AppState, bereich = P1) => startfolge(s, bereich).map((e) => `${e.starter}/${e.lauf}`)
const beginne = (s: AppState, lauf: number, bereich = P1) => reducer(s, { type: 'BETRIEB_BEGINNEN', bereich, punkt: `lauf:${lauf}` })
/** X „nicht gestartet“ in der Disq-Zelle am Steg (lib/abmeldung.ts `abmeldeZiel`), oder wieder leer. */
const x = (s: AppState, starter: string, lauf: number, wert = 'X') =>
  reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', lauf), starter, feld: 'disq@steg', wert }] })
const zeigeAlle = (s: AppState, n: number, bereich = P1) => Array.from({ length: n }).reduce<AppState>((st) => zeigeNaechsten(st, bereich), s)
const start = () => beginne(festgeschrieben(betriebsStand()), 1)

describe('Kennungen', () => {
  it('refKey und liesRef sind umkehrbar; Fremdes ist keine Kennung', () => {
    const refs: StartRef[] = [
      { art: 'm', starter: 'a|1', lauf: 2 },
      { art: 'p', runde: 'pre', attempt: 1, a: 'x', b: null },
      { art: 'p', runde: 'rerun-semi-2', attempt: 2, a: null, b: 'y' },
    ]
    for (const r of refs) expect(liesRef(refKey(r))).toEqual(r)
    for (const kaputt of ['', 'x', '["m","a",0]', '["m","",1]', '["p","viertel",1,"a","b"]', '["p","pre",3,"a","b"]', 7, null]) expect(liesRef(kaputt)).toBeNull()
    expect(['lauf:1', 'lauf:12', 'runde:pre', 'runde:rerun-pre-1'].every(istPunktId)).toBe(true)
    expect(['lauf:0', 'lauf:', 'runde:x', 'lauf:1a', 3].some(istPunktId)).toBe(false)
  })
})

describe('Programm und Folge', () => {
  it('zwei Parcours, drei Läufe: je Lauf die Folge der Verzahnung, hintereinander', () => {
    const s = festgeschrieben(betriebsStand())
    expect(bereicheZumStand(s).map((b) => [b.id, b.name, b.art])).toEqual([
      [P1, 'Parcours 1', 'manoevrieren'],
      [P2, 'Parcours 2', 'manoevrieren'],
    ])
    expect(programm(s, P1)).toEqual(['lauf:1', 'lauf:2', 'lauf:3'])
    const verzahnung = planEvent(s).plans[0].sequence.map((p) => p.id)
    expect(verzahnung).toEqual(['e1', 'k1', 'e2', 'k2'])
    expect(kurz(s)).toEqual([1, 2, 3].flatMap((lauf) => verzahnung.map((id) => `${id}/${lauf}`)))
    expect(startfolge(s, P1).map((e) => e.punkt)).toEqual(['lauf:1', 'lauf:1', 'lauf:1', 'lauf:1', 'lauf:2', 'lauf:2', 'lauf:2', 'lauf:2', 'lauf:3', 'lauf:3', 'lauf:3', 'lauf:3'])
    expect(kurz(s, P2).slice(0, 3)).toEqual(['v1/1', 'f1/1', 'v2/1'])
    // Ein Bereich ohne Parcours hat kein Programm; ein Parcours ohne Starter ist kein Bereich.
    expect(programm(s, 'parallel')).toEqual([])
    expect(bereicheZumStand(betriebsStand(BETRIEB_STARTER.filter((p) => p.klasse === 'E'))).map((b) => b.id)).toEqual([P1])
  })

  it('„Versuche direkt nacheinander“ (UIM): ein Punkt lauf:1, je Starter Versuch 1 und 2 hintereinander', () => {
    let s = reducer(betriebsStand(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    s = festgeschrieben(reducer(s, { type: 'SET_VERSUCHE_NACHEINANDER', on: true }))
    expect(programm(s, P1)).toEqual(['lauf:1'])
    expect(kurz(s)).toEqual(['e1/1', 'e1/2', 'k1/1', 'k1/2', 'e2/1', 'e2/2', 'k2/1', 'k2/2'])
    expect(new Set(startfolge(s, P1).map((e) => e.punkt))).toEqual(new Set(['lauf:1']))
    // Ohne den Schalter zwei Läufe als zwei Punkte.
    expect(programm(reducer(s, { type: 'SET_VERSUCHE_NACHEINANDER', on: false }), P1)).toEqual(['lauf:1', 'lauf:2'])
  })

  it('die Anzeigetafel kann Bereiche auswählen und ordnen; Unbekanntes zählt nicht', () => {
    const s = reducer(festgeschrieben(betriebsStand()), { type: 'SET_ANZEIGE', patch: { bereiche: [P2, P1] } })
    expect(bereicheZumStand(s, { anzeige: true }).map((b) => b.id)).toEqual([P2, P1])
    expect(bereicheZumStand(s).map((b) => b.id)).toEqual([P1, P2])
    const nurZwei = reducer(s, { type: 'SET_ANZEIGE', patch: { bereiche: [P2, 'gibt-es-nicht'] } })
    expect(nurZwei.anzeige.bereiche).toEqual([P2])
    expect(bereicheZumStand(nurZwei, { anzeige: true }).map((b) => b.id)).toEqual([P2])
  })
})

describe('Lage eines Bereichs', () => {
  it('vor dem ersten Lauf: nichts frei, Lauf 1 ist der nächste Punkt', () => {
    const l = lage(festgeschrieben(betriebsStand()), P1)
    expect([l.fest, l.laufend, l.naechsterPunkt, l.naechster, l.aktuell, l.zeiger]).toEqual([true, null, 'lauf:1', null, null, -1])
    expect(l.offen).toHaveLength(12)
    expect(l.frei).toEqual([])
  })

  it('Lauf beginnen gibt seine Starts frei; der Nächste ist der erste offene', () => {
    let s = start()
    expect(lage(s, P1).naechster?.key).toBe(m('e1', 1))
    s = zeigeAlle(s, 2)
    const l = lage(s, P1)
    expect([l.aktuell?.key, l.vorig?.key, l.naechster?.key, l.zeiger, l.laufend, l.naechsterPunkt]).toEqual([m('k1', 1), m('e1', 1), m('e2', 1), 1, 'lauf:1', 'lauf:2'])
    expect(l.frei.map((e) => e.key)).toEqual([m('e2', 1), m('k2', 1)])
    // Der andere Parcours bleibt, wo er ist.
    expect(lage(s, P2).naechster).toBeNull()
  })

  it('Lauf zu Ende: kein Nächster, die Tafel bleibt auf dem letzten Starter stehen', () => {
    const s = zeigeAlle(start(), 4)
    const l = lage(s, P1)
    expect([l.naechster, l.aktuell?.key, l.naechsterPunkt]).toEqual([null, m('k2', 1), 'lauf:2'])
    expect(zeigeNaechsten(s, P1)).toBe(s)
    const weiter = zeigeNaechsten(beginne(s, 2), P1)
    expect(lage(weiter, P1).aktuell?.key).toBe(m('e1', 2))
  })

  it('X in der Disq-Zelle: Der Start entfällt; X von Hand entfernt – wieder da', () => {
    let s = x(start(), 'k1', 1)
    expect(startfolge(s, P1).find((e) => e.key === m('k1', 1))?.entfaellt).toBe(true)
    expect(startfolge(s, P1).find((e) => e.key === m('k1', 2))?.entfaellt).toBe(false)
    s = zeigeNaechsten(s, P1)
    expect(lage(s, P1).naechster?.key).toBe(m('e2', 1))
    // Auch ein kleines x zählt, wie in der Erfassung.
    expect(lage(x(start(), 'e1', 1, 'x'), P1).naechster?.key).toBe(m('k1', 1))
    // Wieder entfernt, bevor der Zeiger vorbei ist: gewöhnlich offen, gleich der Nächste.
    expect(lage(x(s, 'k1', 1, ''), P1).naechster?.key).toBe(m('k1', 1))
  })

  it('X am Vorsteg oder neben anderen Codes: entfällt wie in Wertung und Erfassung (Entscheidung 13.11.2026)', () => {
    const zelle = (s: AppState, starter: string, feld: string, wert: string) =>
      reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter, feld, wert }] })
    const vorsteg = zelle(start(), 'e1', 'disq@vorsteg', 'X')
    expect(vorsteg.eingaben[laufSchluessel('manoevrieren', 1)]?.e1).toEqual({ 'disq@vorsteg': 'X' })
    expect(startfolge(vorsteg, P1).find((e) => e.key === m('e1', 1))?.entfaellt).toBe(true)
    expect(lage(vorsteg, P1).naechster?.key).toBe(m('k1', 1))
    // „X, B“ am Steg: auch ein X.
    const mehr = zelle(start(), 'e1', 'disq@steg', 'X, B')
    expect(lage(mehr, P1).naechster?.key).toBe(m('k1', 1))
    // Eine andere Disqualifikation allein nimmt den Start nicht heraus – er ist gefahren.
    expect(lage(zelle(start(), 'e1', 'disq@steg', 'B'), P1).naechster?.key).toBe(m('e1', 1))
  })

  it('X entfernt, nachdem der Zeiger vorbei ist: nachzuholen, nie von selbst der Nächste', () => {
    let s = zeigeAlle(x(start(), 'k1', 1), 2)
    expect(lage(s, P1).aktuell?.key).toBe(m('e2', 1))
    s = x(s, 'k1', 1, '')
    const l = lage(s, P1)
    expect(l.nachzuholen.map((e) => e.key)).toEqual([m('k1', 1)])
    expect(l.naechster?.key).toBe(m('k2', 1))
  })

  it('`abgemeldet` allein filtert nicht – nur das X zählt', () => {
    const s = { ...start(), abgemeldet: ['k1'] }
    expect(startfolge(s, P1).some((e) => e.entfaellt)).toBe(false)
    expect(lage(zeigeNaechsten(s, P1), P1).naechster?.key).toBe(m('k1', 1))
  })

  it('Nachmeldung hinter dem Zeiger: offen; vor dem Zeiger: nachzuholen, im nächsten Lauf offen', () => {
    const s = zeigeAlle(start(), 2)
    // E03 kommt in der Klasse ans Ende: hinter den Zeiger, also offen und bald dran.
    const hinten = reducer(s, { type: 'ADD_STARTERS', starters: [betriebStarter('e3', 'E', 'E03')] })
    expect(kurz(hinten).slice(0, 5)).toEqual(['e1/1', 'k1/1', 'e2/1', 'k2/1', 'e3/1'])
    expect(lage(hinten, P1).frei.map((e) => e.key)).toEqual([m('e2', 1), m('k2', 1), m('e3', 1)])
    // E00 kommt in der Klasse nach vorn: vor den Zeiger – nachzuholen; sein Lauf 2 ist gewöhnlich offen.
    const vorn = reducer(s, { type: 'ADD_STARTERS', starters: [betriebStarter('e0', 'E', 'E00')] })
    const l = lage(vorn, P1)
    expect(l.nachzuholen.map((e) => e.key)).toEqual([m('e0', 1)])
    expect(l.naechster?.key).not.toBe(m('e0', 1))
    expect(l.offen.some((e) => e.key === m('e0', 2))).toBe(true)
    // Gezeigtes bleibt gezeigt, auch wenn die Stellen sich verschoben haben.
    expect(l.aktuell?.key).toBe(m('k1', 1))
  })

  it('Lauf 1 verpasst (X, später entfernt): nach „Lauf 2 beginnen“ in nachzuholen erreichbar', () => {
    let s = zeigeAlle(x(start(), 'e2', 1), 3)
    expect(lage(s, P1).naechster).toBeNull()
    s = zeigeNaechsten(beginne(s, 2), P1)
    s = x(s, 'e2', 1, '')
    const l = lage(s, P1)
    expect(l.aktuell?.key).toBe(m('e1', 2))
    expect(l.nachzuholen.map((e) => e.key)).toEqual([m('e2', 1)])
    expect(l.naechster?.key).toBe(m('k1', 2))
    // Gezielt gezeigt, ist er erledigt; danach geht es mit Lauf 2 weiter.
    const gezeigt = reducer(s, { type: 'BETRIEB_ZEIGEN', bereich: P1, ref: m('e2', 1), vorher: m('e1', 2), zeit: 5000 })
    expect(lage(gezeigt, P1).aktuell?.key).toBe(m('e2', 1))
    expect(lage(gezeigt, P1).nachzuholen).toEqual([])
    expect(lage(gezeigt, P1).naechster?.key).toBe(m('k1', 2))
  })

  it('die Knoten kommen nie vor – auch ein X auf ihrer Liste nimmt keinen Start heraus', () => {
    const s = reducer(start(), { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 0), starter: 'e1', feld: 'disq@knoten', wert: 'X' }] })
    expect(programm(s, P1).some((p) => p === 'lauf:0')).toBe(false)
    expect(startfolge(s, P1).some((e) => e.lauf === 0 || e.entfaellt)).toBe(false)
  })

  it('„nacheinander“ umschalten und die Zahl der Läufe ändern mitten im Betrieb: Gezeigtes bleibt, nichts stürzt', () => {
    let s = reducer(betriebsStand(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    s = beginne(festgeschrieben(s), 1)
    s = zeigeAlle(beginne(zeigeAlle(s, 4), 2), 1)
    const gezeigt = s.betrieb.bereiche[P1].gezeigt
    expect(gezeigt.map((g) => g.ref)).toEqual([m('e1', 1), m('k1', 1), m('e2', 1), m('k2', 1), m('e1', 2)])

    const nacheinander = reducer(s, { type: 'SET_VERSUCHE_NACHEINANDER', on: true })
    expect(nacheinander.betrieb).toBe(s.betrieb)
    const l = lage(nacheinander, P1)
    expect(l.programm).toEqual(['lauf:1'])
    expect(l.aktuell?.key).toBe(m('e1', 2))
    // Alles, was nicht gezeigt ist, steht hinter oder vor dem Zeiger – nichts geht verloren.
    expect(l.offen.length + l.nachzuholen.length).toBe(3)

    const weniger = reducer(s, { type: 'SET_EVENT', patch: { laufCount: 1 } })
    const w = lage(weniger, P1)
    expect(w.programm).toEqual(['lauf:1'])
    // Der gezeigte Start von Lauf 2 steht nicht mehr in der Folge, bleibt aber „im Boot“.
    expect([w.aktuell?.key, w.aktuell?.eintrag, w.naechster]).toEqual([m('e1', 2), null, null])
    const mehr = reducer(weniger, { type: 'SET_EVENT', patch: { laufCount: 3 } })
    expect(lage(mehr, P1).naechster?.key).toBe(m('k1', 2))
  })

  it('„nacheinander“ mitten in Lauf 1 ausschalten: Lauf 1 geht weiter, der gefahrene zweite Versuch bleibt erledigt', () => {
    let s = reducer(betriebsStand(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    s = beginne(festgeschrieben(reducer(s, { type: 'SET_VERSUCHE_NACHEINANDER', on: true })), 1)
    s = zeigeAlle(s, 3)
    expect(s.betrieb.bereiche[P1].gezeigt.map((g) => g.ref)).toEqual([m('e1', 1), m('e1', 2), m('k1', 1)])

    const aus = reducer(s, { type: 'SET_VERSUCHE_NACHEINANDER', on: false })
    let l = lage(aus, P1)
    expect(l.programm).toEqual(['lauf:1', 'lauf:2'])
    // e1/2 steht jetzt im Block von Lauf 2 (nicht begonnen) und schiebt den Zeiger nicht: Lauf 1 geht weiter.
    expect(l.nachzuholen).toEqual([])
    expect(l.frei.map((e) => e.key)).toEqual([m('e2', 1), m('k2', 1)])
    expect([l.aktuell?.key, l.naechster?.key]).toEqual([m('k1', 1), m('e2', 1)])

    // Lauf 1 zu Ende gefahren, Lauf 2 begonnen: e1/2 ist erledigt, es geht mit k1 weiter.
    let weiter = zeigeAlle(aus, 2)
    expect(lage(weiter, P1).naechster).toBeNull()
    weiter = beginne(weiter, 2)
    l = lage(weiter, P1)
    expect([l.naechster?.key, l.nachzuholen]).toEqual([m('k1', 2), []])
  })
})
