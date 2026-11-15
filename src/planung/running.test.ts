import { describe, it, expect } from 'vitest'
import {
  assignRunningNumbers,
  canonicalRunningNumbers,
  makeNumberSequence,
  parseSkipList,
  runningNumbersFrom,
} from './running'
import type { PlanState, ClassId, Starter } from '../types'
import { schreibeFest, vorlaufPlan } from './parallelRunden'

function mk(klasse: ClassId, n: number): Starter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${klasse}-${i + 1}`,
    startNr: klasse + String(i + 1).padStart(2, '0'),
    vorname: 'V',
    nachname: 'N',
    verein: 'C',
    bundesland: 'B',
    geburtsdatum: '2015-01-01',
    groesse: '',
    klasse,
  }))
}

function stateWith(runningPatch: Partial<PlanState['runningNumbers']>): PlanState {
  return {
    eventName: 'T',
    eventJahr: 2026,
    originMode: 'verein',
    starters: [...mk('E', 2), ...mk('7', 3)],
    parcoursList: [{ id: 'p', name: 'P', classIds: ['E', '7'], wechselFaktor: 1 }],
    boats: { klein: 9, gross: 9 },
    class4Small: false,
    parallelOrderByStartNr: false,
    runningNumbers: { enabled: true, source: 'manoever', start: 1, skipText: '', ...runningPatch },
  }
}

describe('parseSkipList', () => {
  it('trennt an beliebigen Nicht-Ziffern und entfernt Duplikate', () => {
    expect(parseSkipList('7, 13; 20  7')).toEqual([7, 13, 20])
  })
  it('leerer/ungültiger Text → leere Liste', () => {
    expect(parseSkipList('')).toEqual([])
    expect(parseSkipList('abc')).toEqual([])
  })
})

describe('makeNumberSequence', () => {
  it('liefert fortlaufende Nummern ab Startwert', () => {
    const next = makeNumberSequence(1, [])
    expect([next(), next(), next()]).toEqual([1, 2, 3])
  })
  it('überspringt fehlende Nummern', () => {
    const next = makeNumberSequence(1, [3, 4])
    expect([next(), next(), next(), next()]).toEqual([1, 2, 5, 6])
  })
  it('respektiert den Startwert und Skips davor/danach', () => {
    const next = makeNumberSequence(10, [11])
    expect([next(), next(), next()]).toEqual([10, 12, 13])
  })
})

describe('assignRunningNumbers', () => {
  it('nummeriert in Reihenfolge, jede ID beim ersten Auftreten', () => {
    const map = assignRunningNumbers(['a', 'b', 'c'], { start: 1, skip: [] })
    expect([...map.entries()]).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
  })

  it('Doppel-Auftreten (Parallel-Slalom) behält dieselbe Nummer', () => {
    // Emit-Reihenfolge eines Blocks: a,b (Lauf1) … b,a (Lauf2)
    const map = assignRunningNumbers(['a', 'b', 'b', 'a'], { start: 1, skip: [] })
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(2)
    expect(map.size).toBe(2)
  })

  it('lässt übersprungene Nummern aus und ignoriert leere IDs (Dummy)', () => {
    const map = assignRunningNumbers(['a', null, 'b', undefined, 'c'], { start: 1, skip: [2] })
    expect(map.get('a')).toBe(1)
    expect(map.get('b')).toBe(3)
    expect(map.get('c')).toBe(4)
  })
})

describe('runningNumbersFrom', () => {
  it('nutzt Startwert und skipText aus der Konfiguration', () => {
    const map = runningNumbersFrom(['a', 'b', 'c'], {
      enabled: true,
      source: 'manoever',
      start: 5,
      skipText: '6',
    })
    expect(map.get('a')).toBe(5)
    expect(map.get('b')).toBe(7)
    expect(map.get('c')).toBe(8)
  })
})

describe('canonicalRunningNumbers (einheitliche Quelle: Manövrier-Verzahnung)', () => {
  it('deaktiviert → null', () => {
    expect(canonicalRunningNumbers(stateWith({ enabled: false }))).toBeNull()
  })

  it('nummeriert in Manövrier-Reihenfolge (Faktor 1: E-Block, dann 7-Block)', () => {
    const map = canonicalRunningNumbers(stateWith({}))!
    expect(map.get('E-1')).toBe(1)
    expect(map.get('E-2')).toBe(2)
    expect(map.get('7-1')).toBe(3)
    expect(map.get('7-2')).toBe(4)
    expect(map.get('7-3')).toBe(5)
  })

  it('berücksichtigt Startwert und übersprungene Nummern', () => {
    const map = canonicalRunningNumbers(stateWith({ start: 10, skipText: '11' }))!
    expect(map.get('E-1')).toBe(10)
    expect(map.get('E-2')).toBe(12)
    expect(map.get('7-1')).toBe(13)
  })

  it('umschaltbar: source "parallel" nummeriert in Parallel-Reihenfolge', () => {
    // Klasse 7 fährt keinen Parallelslalom und bleibt ohne Nummer.
    const map = canonicalRunningNumbers(stateWith({ source: 'parallel' }))!
    expect(map.get('E-1')).toBe(1)
    expect(map.get('E-2')).toBe(2)
    expect(map.get('7-1')).toBeUndefined()
  })
})

describe('klassische Nummern und der Plan des Parallelslaloms', () => {
  const feld = (): Starter[] => [...mk('E', 3), ...mk('1', 2), ...mk('3', 3), ...mk('4', 3), ...mk('5', 2)]
  const basis = (patch: Partial<PlanState> = {}): PlanState => ({ ...stateWith({ source: 'parallel' }), starters: feld(), ...patch })
  /** Die Nummern so vergeben, wie es die Anwendung tut (state/reducer.ts `assignStartNumbers`, klassisch). */
  const vergeben = (state: PlanState): PlanState => {
    const map = canonicalRunningNumbers(state)!
    return { ...state, starters: state.starters.map((p) => ({ ...p, startNr: String(map.get(p.id) ?? '') })) }
  }
  const folge = (state: PlanState) => vorlaufPlan(state).plan.heats.map((h) => [h.a, h.b].map((s) => (s.kind === 'starter' ? s.p.id : '–')).join('|'))

  it('die Nummern laufen in der Reihenfolge der Starts des Plans durch (A vor B, der Dummy zählt nicht)', () => {
    const state = basis()
    const map = canonicalRunningNumbers(state)!
    const ids = vorlaufPlan(state).plan.heats.flatMap((h) => [h.a, h.b].flatMap((s) => (s.kind === 'starter' ? s.p.id : [])))
    const erste = [...new Set(ids)]
    expect(erste.map((id) => map.get(id))).toEqual(erste.map((_, i) => i + 1))
    // Block 1: Dolphin-Paar, dann das Paar der Klasse 4.
    expect([map.get('E-1'), map.get('E-2'), map.get('4-1'), map.get('4-2'), map.get('E-3')]).toEqual([1, 2, 3, 4, 5])
  })

  for (const [name, patch] of [
    ['streng', {}],
    ['nicht streng', { parallelStreng: false }],
    ['streng, nach Startnummer', { parallelOrderByStartNr: true }],
    ['nicht streng, nach Startnummer', { parallelStreng: false, parallelOrderByStartNr: true }],
  ] as const) {
    it(`${name}: Mit den vergebenen Nummern bleibt die Reihenfolge – erneutes Vergeben ändert keine Nummer`, () => {
      const vorher = basis(patch)
      const einmal = vergeben(vorher)
      expect(folge(einmal)).toEqual(folge(vorher))
      expect(vergeben(einmal).starters).toEqual(einmal.starters)
    })
  }

  it('festgeschrieben: Die Nummern folgen dem festen Plan, auch wenn Starter dazukommen oder die Optionen anders stünden', () => {
    const offen = basis()
    const fest: PlanState = { ...offen, parallelPlaene: { pre: schreibeFest(vorlaufPlan(offen).plan, 'pre') } }
    const vorher = canonicalRunningNumbers(fest)!
    const spaeter: PlanState = { ...fest, parallelStreng: false, parallelOrderByStartNr: true, starters: [...mk('E', 4).slice(3), ...fest.starters] }
    const nachher = canonicalRunningNumbers(spaeter)!
    for (const p of fest.starters) expect(nachher.get(p.id)).toBe(vorher.get(p.id))
    // Der Nachgemeldete steht nicht im Plan: Er bekommt die nächste Nummer hinter allen anderen.
    expect(nachher.get('E-4')).toBe(Math.max(...vorher.values()) + 1)
    // Ein Starter aus dem Plan entfällt: Seine Nummer bleibt als Lücke, niemand rückt auf.
    const ohne = canonicalRunningNumbers({ ...spaeter, starters: spaeter.starters.filter((p) => p.id !== fest.starters[1].id) })!
    for (const p of fest.starters) expect(ohne.get(p.id)).toBe(vorher.get(p.id))
    expect(ohne.get('E-4')).toBe(nachher.get('E-4'))
  })
})
