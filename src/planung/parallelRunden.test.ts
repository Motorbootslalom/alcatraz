import { describe, expect, it } from 'vitest'
import { loeseAuf, mitVorlaufPlan, normalisierePlaene, plaetzeVon, rechneVorlauf, rundenText, schreibeFest, vorlaufPlan, type PlanQuelle } from './parallelRunden'
import type { ClassId, ParallelPlaene, Starter } from '../types'

// Erfundene Starter – keine echten Personen.
function mk(klasse: ClassId, n: number, ab = 1): Starter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${klasse}-${i + ab}`,
    startNr: klasse + String(i + ab).padStart(2, '0'),
    vorname: 'V',
    nachname: `N${klasse}${i + ab}`,
    verein: 'C',
    bundesland: 'B',
    geburtsdatum: '2015-01-01',
    groesse: '',
    klasse,
  }))
}

type Stand = PlanQuelle & { verzahnungLocked: boolean; parallelPlaene: ParallelPlaene }
const stand = (patch: Partial<Stand> = {}): Stand => ({
  starters: [...mk('E', 3), ...mk('1', 2), ...mk('4', 2)],
  class4Small: false,
  parallelOrderByStartNr: false,
  parallelStreng: true,
  parallelPlaene: {},
  verzahnungLocked: false,
  ...patch,
})

describe('festgeschriebener Plan', () => {
  it('hält Starter-IDs je Racecourse, Attempt, Block und Bootstyp – keine Startnummern und keine Namen', () => {
    const fest = schreibeFest(rechneVorlauf(stand()), 'pre')
    expect(fest.runde).toBe('pre')
    expect(fest.starts).toEqual([
      { a: 'E-1', b: 'E-2', attempt: 1, block: 0, boot: 'klein' },
      { a: '4-1', b: '4-2', attempt: 1, block: 0, boot: 'gross' },
      { a: 'E-2', b: 'E-1', attempt: 2, block: 0, boot: 'klein' },
      { a: '4-2', b: '4-1', attempt: 2, block: 0, boot: 'gross' },
      { a: 'E-3', b: null, attempt: 1, block: 1, boot: 'klein' },
      { a: null, b: 'E-3', attempt: 2, block: 1, boot: 'klein' },
      { a: '1-1', b: '1-2', attempt: 1, block: 2, boot: 'klein' },
      { a: '1-2', b: '1-1', attempt: 2, block: 2, boot: 'klein' },
    ])
    const text = JSON.stringify(fest)
    expect(text).not.toContain('NE1')
    expect(text).not.toContain('E01')
  })

  it('zurückgelesen ergibt er denselben Plan wie frisch gerechnet', () => {
    const s = stand({ starters: [...mk('E', 3), ...mk('2', 1), ...mk('3', 4), ...mk('4', 5), ...mk('5', 2)] })
    const plan = rechneVorlauf(s)
    const { plan: gelesen, fehlend } = loeseAuf(schreibeFest(plan, 'pre'), s.starters)
    expect(gelesen).toEqual(plan)
    expect(fehlend).toEqual([])
  })

  it('der frühere Start ist der 1. Attempt; der Racecourse folgt aus dem Plan und wechselt', () => {
    const fest = schreibeFest(rechneVorlauf(stand()), 'pre')
    expect(plaetzeVon(fest, 'E-1')).toEqual([
      { attempt: 1, racecourse: 'A', start: 1 },
      { attempt: 2, racecourse: 'B', start: 3 },
    ])
    expect(plaetzeVon(fest, 'E-3')).toEqual([
      { attempt: 1, racecourse: 'A', start: 5 },
      { attempt: 2, racecourse: 'B', start: 6 },
    ])
    expect(plaetzeVon(fest, 'fremd')).toEqual([])
  })
})

describe('vorlaufPlan: fest vor gerechnet', () => {
  it('ohne festen Plan folgt er dem Starterfeld und den Optionen', () => {
    const offen = vorlaufPlan(stand())
    expect(offen.fest).toBe(false)
    expect(offen.plan.kleinDummy).toBe(1)
    expect(vorlaufPlan(stand({ parallelStreng: false })).plan.kleinDummy).toBe(1)
    expect(vorlaufPlan(stand({ parallelStreng: false, starters: [...mk('E', 3), ...mk('1', 3)] })).plan.kleinDummy).toBe(0)
    // Fehlt die Angabe (PlanState aus dem Prototyp), gilt streng.
    expect(vorlaufPlan({ ...stand({ starters: [...mk('E', 3), ...mk('1', 3)] }), parallelStreng: undefined }).plan.kleinDummy).toBe(2)
  })

  it('der feste Plan wird nicht neu gerechnet: Optionen und neue Starter ändern die Reihenfolge nicht', () => {
    const fest = mitVorlaufPlan(stand({ verzahnungLocked: true }), true)
    const vorher = vorlaufPlan(fest)
    const spaeter = { ...fest, parallelStreng: false, parallelOrderByStartNr: true, class4Small: true, starters: [...fest.starters, ...mk('E', 1, 4)] }
    const nachher = vorlaufPlan(spaeter)
    expect(nachher.fest).toBe(true)
    expect(nachher.plan.heats).toEqual(vorher.plan.heats)
    // Der Nachgemeldete steht nicht im Plan – das wird gemeldet, nicht stillschweigend eingereiht.
    expect(nachher.ohnePlatz.map((p) => p.id)).toEqual(['E-4'])
  })

  it('geänderte Angaben eines Starters (Nummer, Name) erscheinen im festen Plan', () => {
    const fest = mitVorlaufPlan(stand({ verzahnungLocked: true }), true)
    const umbenannt = { ...fest, starters: fest.starters.map((p) => (p.id === 'E-1' ? { ...p, startNr: '77' } : p)) }
    const erster = vorlaufPlan(umbenannt).plan.heats[0].a
    expect(erster.kind === 'starter' && erster.p.startNr).toBe('77')
  })

  it('ein Starter, den es nicht mehr gibt, wird zum Dummy; sein Gegner behält den Platz', () => {
    const fest = mitVorlaufPlan(stand({ verzahnungLocked: true }), true)
    const ohne = vorlaufPlan({ ...fest, starters: fest.starters.filter((p) => p.id !== 'E-2') })
    expect(ohne.fehlend).toEqual(['E-2'])
    expect(ohne.plan.heats[0].a.kind).toBe('starter')
    expect(ohne.plan.heats[0].b).toEqual({ kind: 'dummy', boat: 'klein' })
    expect(ohne.plan.heats).toHaveLength(8)
  })

  it('wechselt ein Starter nach dem Festschreiben in eine Klasse mit anderem Boot oder ohne Parallelslalom, wird das gemeldet', () => {
    const fest = mitVorlaufPlan(stand({ verzahnungLocked: true }), true)
    const klasse = (id: string, k: ClassId) => ({ ...fest, starters: fest.starters.map((p) => (p.id === id ? { ...p, klasse: k } : p)) })
    expect(vorlaufPlan(fest).falschesBoot).toEqual([])
    expect(vorlaufPlan(klasse('E-1', '5')).falschesBoot.map((p) => p.id)).toEqual(['E-1'])
    expect(vorlaufPlan(klasse('4-1', '7')).falschesBoot.map((p) => p.id)).toEqual(['4-1'])
    // Gleiches Boot (Dolphin → Klasse 2): Das Paar fährt weiter, gemeldet wird nichts.
    expect(vorlaufPlan(klasse('E-1', '2')).falschesBoot).toEqual([])
  })
})

describe('mitVorlaufPlan: der Plan hängt an der Sperre der Verzahnung', () => {
  it('festgeschrieben und mit Parallelslalom: Der Plan entsteht einmal und bleibt derselbe', () => {
    const fest = mitVorlaufPlan(stand({ verzahnungLocked: true }), true)
    expect(fest.parallelPlaene.pre?.starts).toHaveLength(8)
    expect(mitVorlaufPlan({ ...fest, parallelStreng: false }, true)).toEqual({ ...fest, parallelStreng: false })
    expect(mitVorlaufPlan(fest, true)).toBe(fest)
  })

  it('ohne Parallelslalom (DM) entsteht kein Plan', () => {
    const s = stand({ verzahnungLocked: true })
    expect(mitVorlaufPlan(s, false)).toBe(s)
  })

  it('gelöst: Der Plan des Vorlaufs entfällt – und mit ihm die Runden danach, die auf seinem Ergebnis stehen', () => {
    const fest = mitVorlaufPlan(stand({ verzahnungLocked: true }), true)
    const semi = { runde: 'semi' as const, starts: [] }
    const offen = mitVorlaufPlan({ ...fest, verzahnungLocked: false, parallelPlaene: { ...fest.parallelPlaene, semi } }, true)
    expect(offen.parallelPlaene).toEqual({})
    const ohne = stand()
    expect(mitVorlaufPlan(ohne, true)).toBe(ohne)
  })
})

describe('normalisierePlaene', () => {
  const gut = { runde: 'pre', starts: [{ a: 'x', b: null, attempt: 1, block: 0, boot: 'klein' }] }

  it('übernimmt brauchbare Pläne und wirft Fremdes weg', () => {
    expect(normalisierePlaene({ pre: { ...gut, fremd: 1, starts: [{ ...gut.starts[0], name: 'geheim' }] } })).toEqual({ pre: gut })
    expect(normalisierePlaene({ 'rerun-pre-1': { starts: [] } })).toEqual({ 'rerun-pre-1': { runde: 'rerun-pre-1', starts: [] } })
  })

  it('Unbrauchbares entfällt – ein Plan gilt ganz oder gar nicht', () => {
    expect(normalisierePlaene(undefined)).toEqual({})
    expect(normalisierePlaene([gut])).toEqual({})
    expect(normalisierePlaene({ viertel: gut })).toEqual({})
    expect(normalisierePlaene({ pre: { starts: 'nein' } })).toEqual({})
    for (const kaputt of [{ a: 5 }, { a: '' }, { attempt: 3 }, { block: -1 }, { block: 0.5 }, { boot: 'mittel' }]) {
      expect(normalisierePlaene({ pre: { starts: [gut.starts[0], { ...gut.starts[0], ...kaputt }] } })).toEqual({})
    }
  })
})

describe('Namen der Runden', () => {
  it('je Runde ein Text; jede Wiederholung heißt „Re-run“', () => {
    expect(rundenText('pre')).toBe('parallel.round.pre')
    expect(rundenText('semi')).toBe('parallel.round.semi')
    expect(rundenText('final')).toBe('parallel.round.final')
    expect(rundenText('rerun-pre-1')).toBe('parallel.round.rerun')
  })
})
