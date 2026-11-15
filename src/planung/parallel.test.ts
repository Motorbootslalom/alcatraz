import { describe, it, expect } from 'vitest'
import {
  buildParallelPlan,
  parallelActiveClasses,
  slotShort,
  type ParallelHeat,
  type ParallelSlot,
} from './parallel'
import type { ClassId, Starter } from '../types'

function make(klasse: ClassId, n: number, startFrom = 1): Starter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${klasse}-${i + startFrom}`,
    startNr: klasse + String(i + startFrom).padStart(2, '0'),
    vorname: 'V',
    nachname: 'N',
    verein: 'C',
    bundesland: 'B',
    geburtsdatum: '2015-01-01',
    groesse: '',
    klasse,
  }))
}

/** Kompakte Heat-Darstellung „A↔B" für Vergleiche. */
const nr = (slot: ParallelSlot) => slotShort(slot)
const row = (h: ParallelHeat) => `${nr(h.a)}|${nr(h.b)}`
const rows = (heats: ParallelHeat[]) => heats.map(row)

const OPTS = { class4Small: false }

describe('parallelActiveClasses', () => {
  it('gefahren wird bis Klasse 5 – die Klassen 6 und 7 gibt es im Parallelslalom nicht', () => {
    expect(parallelActiveClasses()).toEqual(['E', '1', '2', '3', '4', '5'])
  })
})

describe('buildParallelPlan – Grundmuster aus der Aufgabenstellung', () => {
  it('E01/E02 (klein) + 401/402 (groß): ein Block mit Bootstyp-Wechsel und Tausch', () => {
    const ps = [...make('E', 2), ...make('4', 2)]
    const plan = buildParallelPlan(ps, OPTS)
    expect(rows(plan.heats)).toEqual([
      'E01|E02', // klein, Lauf 1
      '401|402', // groß, Lauf 1 (Verzahnungswechsel)
      'E02|E01', // klein, Lauf 2 (getauscht)
      '402|401', // groß, Lauf 2
    ])
    expect(plan.heats.map((h) => h.boat)).toEqual(['klein', 'gross', 'klein', 'gross'])
    expect(plan.heats.map((h) => h.run)).toEqual([1, 1, 2, 2])
    expect(plan.blocks).toBe(1)
  })

  it('4 kleine + 2 große: zweiter Block enthält nur das übrige kleine Paar', () => {
    const ps = [...make('E', 4), ...make('4', 2)]
    const plan = buildParallelPlan(ps, OPTS)
    expect(rows(plan.heats)).toEqual([
      'E01|E02',
      '401|402',
      'E02|E01',
      '402|401',
      // neuer Block:
      'E03|E04',
      'E04|E03',
    ])
    expect(plan.blocks).toBe(2)
    // Blockwechsel wird am 5. Heat markiert (für die Trennlinie).
    expect(plan.heats.find((h) => h.pos === 5)!.blockStart).toBe(true)
    expect(plan.heats.find((h) => h.pos === 2)!.blockStart).toBe(false)
  })

  it('mehrere Restpaare eines Bootstyps laufen als 2er-Blöcke (keine Verzahnung gleicher Boote)', () => {
    // 6 klein (3 Paare) + 2 groß (1 Paar): 1 gemischter 4er-Block, dann die
    // beiden übrigen klein-Paare je als eigener 2er-Block – Paar komplett.
    const ps = [...make('E', 6), ...make('4', 2)]
    const plan = buildParallelPlan(ps, OPTS)
    expect(rows(plan.heats)).toEqual([
      // gemischter Block (klein + groß)
      'E01|E02',
      '401|402',
      'E02|E01',
      '402|401',
      // 2er-Block: Paar E03/E04 komplett
      'E03|E04',
      'E04|E03',
      // 2er-Block: Paar E05/E06 komplett
      'E05|E06',
      'E06|E05',
    ])
    expect(plan.heats.map((h) => h.boat)).toEqual(
      ['klein', 'gross', 'klein', 'gross', 'klein', 'klein', 'klein', 'klein'],
    )
    expect(plan.blocks).toBe(3)
    // jeder 2er-Block beginnt mit einer Trennlinie
    expect(plan.heats.find((h) => h.pos === 5)!.blockStart).toBe(true)
    expect(plan.heats.find((h) => h.pos === 7)!.blockStart).toBe(true)
    expect(plan.heats.find((h) => h.pos === 6)!.blockStart).toBe(false)
  })

  it('nur ein Bootstyp im Feld → ausschließlich 2er-Blöcke', () => {
    const plan = buildParallelPlan(make('E', 4), OPTS)
    expect(rows(plan.heats)).toEqual(['E01|E02', 'E02|E01', 'E03|E04', 'E04|E03'])
    expect(plan.blocks).toBe(2)
    expect(plan.heats.every((h) => h.boat === 'klein')).toBe(true)
  })
})

/** Klassische Nummern setzen: id → Nummer. */
const mitNummern = (ps: Starter[], nummern: Record<string, number>): Starter[] => ps.map((p) => ({ ...p, startNr: String(nummern[p.id] ?? '') }))
/** Die Klassen eines Starts, z. B. „E|E“ oder „1|Dummy“. */
const klassen = (h: ParallelHeat) => [h.a, h.b].map((s) => (s.kind === 'dummy' ? 'Dummy' : s.p.klasse)).join('|')

describe('strenge Klassentrennung (Vorgabe, Regel 960 Pkt. 4.4)', () => {
  it('Paare nur innerhalb einer Klasse: Dolphin fährt nicht gegen Klasse 3, jeder Übrige gegen einen Dummy', () => {
    const plan = buildParallelPlan([...make('E', 1), ...make('3', 1)], OPTS)
    expect(rows(plan.heats)).toEqual(['E01|Dummy', 'Dummy|E01', '301|Dummy', 'Dummy|301'])
    expect(plan.kleinDummy).toBe(2)
    expect(plan.pairs).toBe(2)
  })

  it('ein Dummy je ungerader Klasse – auch mehrere je Bootstyp; gerade Klassen bleiben ohne', () => {
    const ps = [...make('E', 3), ...make('1', 2), ...make('2', 1), ...make('4', 3), ...make('5', 5)]
    const plan = buildParallelPlan(ps, OPTS)
    expect(plan.kleinStarter).toBe(6)
    expect(plan.kleinDummy).toBe(2)
    expect(plan.grossStarter).toBe(8)
    expect(plan.grossDummy).toBe(2)
    // Kein Start mischt zwei Klassen.
    for (const h of plan.heats) {
      if (h.a.kind === 'starter' && h.b.kind === 'starter') expect(h.a.p.klasse).toBe(h.b.p.klasse)
    }
    // Der Dummy steht beim letzten Starter seiner Klasse.
    expect(rows(plan.heats.filter((h) => h.run === 1 && h.boat === 'klein'))).toEqual(['E01|E02', 'E03|Dummy', '101|102', '201|Dummy'])
  })

  it('eine Klasse mit einem einzigen Starter: Er fährt beide Attempts gegen den Dummy, einmal auf A und einmal auf B', () => {
    const plan = buildParallelPlan(make('2', 1), OPTS)
    expect(rows(plan.heats)).toEqual(['201|Dummy', 'Dummy|201'])
    expect(plan.heats.map((h) => h.run)).toEqual([1, 2])
    expect(plan.kleinDummy).toBe(1)
    const dummies = plan.heats.flatMap((h) => [h.a, h.b]).filter((s) => s.kind === 'dummy')
    expect(dummies.every((s) => s.kind === 'dummy' && s.boat === 'klein')).toBe(true)
  })

  it('gerade Anzahl → kein Dummy', () => {
    const plan = buildParallelPlan(make('E', 4), OPTS)
    expect(plan.kleinDummy).toBe(0)
    expect(plan.heats.some((h) => h.a.kind === 'dummy' || h.b.kind === 'dummy')).toBe(false)
  })

  it('kleine und große Klassen bilden getrennte Pools', () => {
    const plan = buildParallelPlan([...make('2', 2), ...make('4', 2)], OPTS)
    expect(plan.heats.map(klassen)).toEqual(['2|2', '4|4', '2|2', '4|4'])
  })
})

describe('nicht streng: der Übrige fährt gegen den ersten der nächsten Klasse im gleichen Boot', () => {
  const NICHT_STRENG = { ...OPTS, streng: false }

  it('ungerade Klassen, gerader Pool: kein Dummy, die Klassen bleiben sonst zusammen', () => {
    const ps = [...make('E', 3), ...make('1', 3)]
    const plan = buildParallelPlan(ps, NICHT_STRENG)
    expect(rows(plan.heats.filter((h) => h.run === 1))).toEqual(['E01|E02', 'E03|101', '102|103'])
    expect(plan.kleinDummy).toBe(0)
  })

  it('Dummy nur bei ungeradem Pool – und nie über die Bootstypen hinweg', () => {
    const ps = [...make('E', 1), ...make('2', 2), ...make('4', 1), ...make('5', 1)]
    const plan = buildParallelPlan(ps, NICHT_STRENG)
    expect(rows(plan.heats.filter((h) => h.run === 1))).toEqual(['E01|201', '401|501', '202|Dummy'])
    expect(plan.kleinDummy).toBe(1)
    expect(plan.grossDummy).toBe(0)
    // Klein gegen groß gibt es nicht.
    expect(plan.heats.every((h) => [h.a, h.b].every((s) => s.kind === 'dummy' || (h.boat === 'gross') === ['4', '5'].includes(s.p.klasse)))).toBe(true)
  })

  it('gerade Klassen: derselbe Plan wie streng', () => {
    const ps = [...make('E', 2), ...make('1', 4), ...make('4', 2)]
    expect(rows(buildParallelPlan(ps, NICHT_STRENG).heats)).toEqual(rows(buildParallelPlan(ps, OPTS).heats))
  })
})

describe('Reihenfolge nach Startnummer: Klassen nach ihrer kleinsten Nummer', () => {
  // Das Manövrieren hat Klasse 3 zuerst gesetzt (1–3), Dolphin danach (4, 5), Klasse 1 zuletzt (6, 7).
  const ps = mitNummern([...make('E', 2), ...make('1', 2), ...make('3', 3)], { '3-1': 2, '3-2': 1, '3-3': 3, 'E-1': 4, 'E-2': 5, '1-1': 7, '1-2': 6 })

  it('ohne die Option gilt die feste Folge der Klassen, innerhalb der Klasse die Nummer', () => {
    const plan = buildParallelPlan(ps, OPTS)
    expect(rows(plan.heats.filter((h) => h.run === 1))).toEqual(['4|5', '6|7', '1|2', '3|Dummy'])
  })

  it('mit der Option steht Klasse 3 vorn; die Klassen bleiben zusammen und werden nicht nach Nummer gemischt', () => {
    const plan = buildParallelPlan(ps, { ...OPTS, orderByStartNr: true })
    expect(rows(plan.heats.filter((h) => h.run === 1))).toEqual(['1|2', '3|Dummy', '4|5', '6|7'])
    expect(plan.heats.filter((h) => h.run === 1).map(klassen)).toEqual(['3|3', '3|Dummy', 'E|E', '1|1'])
  })

  it('nicht streng: der Übrige der Klasse 3 fährt gegen den ersten Dolphin', () => {
    const plan = buildParallelPlan(ps, { ...OPTS, orderByStartNr: true, streng: false })
    expect(rows(plan.heats.filter((h) => h.run === 1))).toEqual(['1|2', '3|4', '5|6', '7|Dummy'])
  })

  it('Starter ohne Nummer stehen in ihrer Klasse hinten, Klassen ohne Nummern am Ende', () => {
    const feld = mitNummern([...make('E', 2), ...make('1', 2)], { '1-2': 1 })
    const plan = buildParallelPlan(feld, { ...OPTS, orderByStartNr: true })
    expect(plan.heats.filter((h) => h.run === 1).map((h) => [h.a, h.b].map((s) => (s.kind === 'starter' ? s.p.id : '–')).join('|'))).toEqual(['1-2|1-1', 'E-1|E-2'])
  })

  it('klassische Nummern zählen als Zahl: 9 vor 10', () => {
    const feld = mitNummern(make('E', 2), { 'E-1': 10, 'E-2': 9 })
    expect(rows(buildParallelPlan(feld, OPTS).heats)[0]).toBe('9|10')
  })
})

describe('Attempts', () => {
  it('der frühere Start eines Paares ist der 1. Attempt; im 2. sind die Racecourses getauscht', () => {
    const plan = buildParallelPlan([...make('E', 3), ...make('1', 2), ...make('4', 2)], OPTS)
    const paar = (h: ParallelHeat) => [nr(h.a), nr(h.b)].sort().join('+')
    const gesehen = new Map<string, ParallelHeat>()
    for (const h of plan.heats) {
      const erster = gesehen.get(paar(h))
      if (!erster) {
        expect(h.run).toBe(1)
        gesehen.set(paar(h), h)
      } else {
        expect(h.run).toBe(2)
        expect(row(h)).toBe(`${nr(erster.b)}|${nr(erster.a)}`)
      }
    }
    expect(gesehen.size).toBe(plan.pairs)
  })
})

describe('Klassen 6 und 7', () => {
  it('fahren keinen Parallelslalom', () => {
    const ps = [...make('E', 2), ...make('6', 2), ...make('7', 2)]
    const plan = buildParallelPlan(ps, OPTS)
    // nur die beiden E-Starter zählen
    expect(plan.kleinStarter).toBe(2)
    expect(plan.grossStarter).toBe(0)
  })
})

describe('Fairness & Vollständigkeit', () => {
  it('jeder Starter fährt genau zweimal – je einmal auf A und auf B', () => {
    const ps = [...make('E', 4), ...make('1', 2), ...make('4', 6)]
    const plan = buildParallelPlan(ps, OPTS)
    const onA = new Map<string, number>()
    const onB = new Map<string, number>()
    for (const h of plan.heats) {
      if (h.a.kind === 'starter') onA.set(h.a.p.id, (onA.get(h.a.p.id) ?? 0) + 1)
      if (h.b.kind === 'starter') onB.set(h.b.p.id, (onB.get(h.b.p.id) ?? 0) + 1)
    }
    for (const p of ps) {
      expect(onA.get(p.id)).toBe(1)
      expect(onB.get(p.id)).toBe(1)
    }
  })

  it('class4Small verschiebt Klasse 4 in den kleinen Pool', () => {
    const ps = [...make('E', 2), ...make('4', 2)]
    const plan = buildParallelPlan(ps, { class4Small: true })
    // alles klein → 2 Paare klein, keine großen
    expect(plan.kleinStarter).toBe(4)
    expect(plan.grossStarter).toBe(0)
    expect(plan.heats.every((h) => h.boat === 'klein')).toBe(true)
  })
})
