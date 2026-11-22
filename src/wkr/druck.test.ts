import { describe, expect, it } from 'vitest'
import { reducer, type Action } from '../state/reducer'
import { configFor } from '../config/konfig'
import { wkrBetriebsStand } from '../testHilfen'
import { wkrBoegenZumStand } from '../lib/wkrListen'
import { parallelBoegen } from '../lib/parallelBogen'
import { listenKennung, type Liste } from './liste'
import { nurDigital, teileNachDruck } from './druck'
import { abgedeckteTeile } from '../geraete/register'
import type { AppState } from '../types'

// Druck nach Modus (Nutzer 21.11.2026, WKR_ANNAHMEN Z1–Z7): Welche Bögen nicht gedruckt werden. Erfundene Starter
// (testHilfen).

const DM = configFor({ regelwerk: 'dm-2026' })
const K = (typeId: string, bereich = 'par_1') => listenKennung({ bereich, typeId, racecourse: null } satisfies Liste)
const mit = (s: AppState, ...actions: Action[]) => actions.reduce((x, a) => reducer(x, { zeit: 100, ...a } as Action), s)
const boegen = (s: AppState) => wkrBoegenZumStand(s, DM).boegen
const ids = (bs: readonly { typeId: string; parcoursId: string }[]) => [...new Set(bs.map((b) => `${b.parcoursId}/${b.typeId}`))].sort()

describe('Druck nach Modus', () => {
  it('nur „Gerät“ (digital) fällt weg; Papier, beides und ohne Eintrag werden gedruckt', () => {
    const s = mit(
      wkrBetriebsStand(),
      { type: 'WKR_LISTE', liste: K('gate135'), modus: 'digital' } as Action,
      { type: 'WKR_LISTE', liste: K('zeit'), modus: 'beides' } as Action,
      { type: 'WKR_LISTE', liste: K('vorsteg'), modus: 'papier' } as Action,
    )
    const { gedruckt, digital } = teileNachDruck(boegen(s), s.wkr, DM)
    expect(ids(digital)).toEqual(['par_1/gate135'])
    expect(gedruckt.length + digital.length).toBe(boegen(s).length)
    // Je Lauf und Klasse ein Bogen der Liste – alle fallen weg, auf dem anderen Parcours keiner.
    expect(digital.length).toBe(boegen(s).filter((b) => b.parcoursId === 'par_1' && b.typeId === 'gate135').length)
    expect(gedruckt.some((b) => b.typeId === 'gate135' && b.parcoursId === 'par_2')).toBe(true)
    // Die Folge der gedruckten bleibt die der Bögen (Seitenzahlen zählt jeder Bogen selbst).
    const folge = boegen(s).map((b) => b.id)
    expect(gedruckt.map((b) => b.id)).toEqual(folge.filter((id) => gedruckt.some((b) => b.id === id)))
    // Ohne WKR-Stand (Tests, ältere Aufrufer): alles gedruckt.
    expect(teileNachDruck(boegen(s), undefined, DM).digital).toEqual([])
  })

  it('pausiert oder abgemeldet → Papier übernimmt → gedruckt (Z2)', () => {
    const s = mit(wkrBetriebsStand(), { type: 'WKR_LISTE', liste: K('gate135'), modus: 'digital' } as Action)
    const b = boegen(s).find((x) => x.typeId === 'gate135' && x.parcoursId === 'par_1')!
    expect(nurDigital(b, s.wkr, DM)).toBe(true)
    expect(nurDigital(b, mit(s, { type: 'WKR_LISTE', liste: K('gate135'), status: 'pausiert' } as Action).wkr, DM)).toBe(false)
    expect(nurDigital(b, mit(s, { type: 'WKR_LISTE', liste: K('gate135'), status: 'abgemeldet' } as Action).wkr, DM)).toBe(false)
  })

  it('Steg: nur Ablegen auf dem Gerät → Bogen gedruckt (Anlegen auf Papier); beide Teile oder ganz → nicht (Z3)', () => {
    const s = mit(wkrBetriebsStand(), { type: 'WKR_LISTE', liste: K('steg'), modus: 'digital' } as Action)
    const b = boegen(s).find((x) => x.typeId === 'steg' && x.parcoursId === 'par_1')!
    const geraet = (teil?: 'ab' | 'an') => ({ id: `g-${teil ?? 'ganz'}`, name: '', seit: 0, zuletzt: 0, aufgaben: [{ art: 'liste' as const, liste: K('steg'), ...(teil ? { teil } : {}) }] })
    const nach = (...g: ReturnType<typeof geraet>[]) => (k: string) => abgedeckteTeile(g, k)
    // Ohne Gerät zählt der Modus.
    expect(nurDigital(b, s.wkr, DM, nach())).toBe(true)
    expect(nurDigital(b, s.wkr, DM, nach(geraet('ab')))).toBe(false)
    expect(nurDigital(b, s.wkr, DM, nach(geraet('ab'), geraet('an')))).toBe(true)
    expect(nurDigital(b, s.wkr, DM, nach(geraet()))).toBe(true)
    // Ein Teil abgemeldet: gedruckt.
    const ohneAn = mit(s, { type: 'WKR_LISTE', liste: K('steg'), status: 'abgemeldet', teil: 'an' } as Action)
    expect(nurDigital(b, ohneAn.wkr, DM, nach(geraet()))).toBe(false)
  })

  it('Knoten: seit W5.3 die Liste am Tisch – nur digital möglich (KN6, Z6 angepasst); eine Liste am Parcours zählt nicht', () => {
    // Ein Eintrag unter der Kennung eines Parcours (vor W5.3 gab es keine Knoten-Liste) wirkt nicht – nur die am Tisch.
    const alt = mit(wkrBetriebsStand(), { type: 'WKR_LISTE', liste: K('knoten'), modus: 'digital' } as Action)
    const knoten = boegen(alt).filter((b) => b.typeId === 'knoten')
    expect(knoten.length).toBeGreaterThan(0)
    expect(knoten.every((b) => !nurDigital(b, alt.wkr, DM))).toBe(true)
    // Die Liste am Tisch digital: jeder Knoten-Bogen fällt weg, gleich von welchem Parcours; pausiert → gedruckt (Z2).
    const s = mit(wkrBetriebsStand(), { type: 'WKR_LISTE', liste: K('knoten', 'tisch'), modus: 'digital' } as Action)
    expect(boegen(s).filter((b) => b.typeId === 'knoten').every((b) => nurDigital(b, s.wkr, DM))).toBe(true)
    expect(teileNachDruck(boegen(s), s.wkr, DM).digital.every((b) => b.typeId === 'knoten')).toBe(true)
    const pause = mit(s, { type: 'WKR_LISTE', liste: K('knoten', 'tisch'), status: 'pausiert' } as Action)
    expect(boegen(pause).filter((b) => b.typeId === 'knoten').some((b) => nurDigital(b, pause.wkr, DM))).toBe(false)
  })

  it('Parallelslalom: je Liste und Racecourse (Z7)', () => {
    let s = reducer(wkrBetriebsStand(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    s = reducer(s, { type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const uim = configFor({ regelwerk: 'uim-2026' })
    const p = parallelBoegen(s, uim).boegen
    expect(p.length).toBeGreaterThan(0)
    const kennung = listenKennung({ bereich: 'parallel', typeId: 'zeit', racecourse: 'A' })
    const s2 = mit(s, { type: 'WKR_LISTE', liste: kennung, modus: 'digital' } as Action)
    const { digital } = teileNachDruck(p, s2.wkr, uim)
    expect(digital.length).toBeGreaterThan(0)
    expect(digital.every((b) => b.typeId === 'zeit' && b.runde?.racecourse === 'A')).toBe(true)
  })
})
