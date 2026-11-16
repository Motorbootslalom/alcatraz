import { describe, expect, it } from 'vitest'
import { applyPatch, diff, equal, type Json, type Op } from './patch'
import { reducer, type Action } from '../../../state/reducer'
import { sichtOeffentlich } from '../../../betrieb/sicht'
import { grosserBetrieb } from './testNtfy'
import type { AppState } from '../../../types'

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Differenz bilden und auf einer Kopie nachziehen – muss genau `b` ergeben. */
function roundtrip(a: Json, b: Json): Op[] {
  const ops = diff(a, b)
  const result = applyPatch(clone(a), clone(ops))
  expect(result).toEqual(b)
  return ops
}

describe('diff + applyPatch', () => {
  it('liefert nichts, wenn nichts anders ist', () => {
    expect(diff({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toEqual([])
  })

  it('setzt, ergänzt und entfernt Felder', () => {
    const ops = roundtrip({ a: 1, b: { c: 2, d: 3 } }, { a: 2, b: { c: 2, e: 4 } })
    expect(ops).toEqual([
      { p: ['a'], v: 2 },
      { p: ['b', 'e'], v: 4 },
      { p: ['b', 'd'], d: 1 },
    ])
  })

  it('hängt an eine Liste an, ohne den Rest mitzuschicken', () => {
    const ops = roundtrip({ h: ['a', 'b', 'c'] }, { h: ['a', 'b', 'c', 'd'] })
    expect(ops).toEqual([{ p: ['h'], s: [3, 0, 'd'] }])
  })

  it('fügt ein und entfernt mitten in einer Liste', () => {
    roundtrip([1, 2, 3, 4, 5], [1, 2, 9, 3, 4, 5])
    roundtrip([1, 2, 3, 4, 5], [1, 2, 4, 5])
    roundtrip([1, 2, 3], [])
    roundtrip([], [1, 2])
  })

  it('erkennt ein einzeln verschobenes Element – in beide Richtungen', () => {
    const list = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, lauf: 1 }))
    const back = clone(list)
    back.splice(15, 0, ...back.splice(3, 1))
    expect(roundtrip(list, back)).toEqual([{ p: [], m: [3, 15] }])

    const forward = clone(list)
    forward.splice(2, 0, ...forward.splice(17, 1))
    expect(roundtrip(list, forward)).toEqual([{ p: [], m: [17, 2] }])
  })

  it('ändert in einer gleich langen Liste nur das geänderte Feld', () => {
    const list = Array.from({ length: 50 }, (_, i) => ({ id: `s${i}`, status: 'offen' }))
    const next = clone(list)
    next[30].status = 'erledigt'
    expect(roundtrip(list, next)).toEqual([{ p: [30, 'status'], v: 'erledigt' }])
  })

  it('ersetzt bei einem anderen Typ den Wert, auch an der Wurzel', () => {
    roundtrip({ a: [1] }, { a: { b: 1 } })
    roundtrip({ a: 1 }, [1, 2])
    roundtrip({ a: null }, { a: 0 })
  })

  it('stimmt für zufällige Änderungen', () => {
    // Fester Startwert – ein Fehlschlag soll sich wiederholen lassen.
    let seed = 42
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const pick = <T>(list: T[]): T => list[Math.floor(random() * list.length)]

    function randomValue(depth: number): Json {
      const r = random()
      if (depth > 2 || r < 0.4) return pick([null, true, 1, 2.5, 'a', 'b', ''])
      if (r < 0.7) return Array.from({ length: Math.floor(random() * 5) }, () => randomValue(depth + 1))
      const obj: Record<string, Json> = {}
      for (let i = Math.floor(random() * 4); i > 0; i--) obj[pick(['x', 'y', 'z', 'w'])] = randomValue(depth + 1)
      return obj
    }

    function mutate(value: Json, depth: number): Json {
      if (depth > 3 || random() < 0.2) return randomValue(depth)
      if (Array.isArray(value)) {
        const copy = [...value]
        const r = random()
        if (r < 0.25) copy.splice(Math.floor(random() * (copy.length + 1)), 0, randomValue(depth))
        else if (r < 0.5 && copy.length) copy.splice(Math.floor(random() * copy.length), 1)
        else if (r < 0.7 && copy.length > 1) copy.splice(Math.floor(random() * copy.length), 0, ...copy.splice(Math.floor(random() * copy.length), 1))
        else if (copy.length) {
          const i = Math.floor(random() * copy.length)
          copy[i] = mutate(copy[i], depth + 1)
        }
        return copy
      }
      if (value && typeof value === 'object') {
        const copy = { ...value }
        const key = pick(['x', 'y', 'z', 'w'])
        if (random() < 0.3) delete copy[key]
        else copy[key] = mutate(copy[key] ?? null, depth + 1)
        return copy
      }
      return randomValue(depth)
    }

    for (let round = 0; round < 500; round++) {
      const a = randomValue(0)
      let b = a
      for (let i = 1 + Math.floor(random() * 4); i > 0; i--) b = mutate(b, 0)
      roundtrip(a, b)
    }
  })
})

describe('applyPatch weist ab, was nicht passt', () => {
  it('einen Pfad, den es nicht gibt', () => {
    expect(() => applyPatch({ a: {} }, [{ p: ['b', 'c'], v: 1 }])).toThrow()
    expect(() => applyPatch({ a: [1] }, [{ p: ['a', 5], v: 1 }])).toThrow()
  })

  it('Verschiebungen und Ersetzungen außerhalb der Liste', () => {
    expect(() => applyPatch([1, 2], [{ p: [], m: [0, 2] }])).toThrow()
    expect(() => applyPatch([1, 2], [{ p: [], s: [3, 0, 9] }])).toThrow()
    expect(() => applyPatch([1, 2], [{ p: [], s: [1, 5] }])).toThrow()
  })

  it('Prototypen-Schlüssel', () => {
    expect(() => applyPatch({}, [{ p: ['__proto__', 'x'], v: 1 }])).toThrow()
    expect(() => applyPatch({}, [{ p: ['__proto__'], v: { x: 1 } }])).toThrow()
    expect(({} as Record<string, unknown>).x).toBeUndefined()
  })

  it('Unsinn statt einer Änderung', () => {
    expect(() => applyPatch({}, [null as unknown as Op])).toThrow()
    expect(() => applyPatch({}, [{ p: ['a'] } as unknown as Op])).toThrow()
  })
})

describe('an der öffentlichen Sicht', () => {
  // Statt des ganzen Zustands wie im Prototyp geht in alcatraz nur die öffentliche Sicht über die Leitung.
  const sicht = (s: AppState) => clone(sichtOeffentlich(s)) as unknown as Json

  function step(state: AppState, action: Action): { next: AppState; bytes: number } {
    const next = reducer(state, action)
    const ops = roundtrip(sicht(state), sicht(next))
    return { next, bytes: JSON.stringify(ops).length }
  }

  it('„Nächster Start“ ist klein', () => {
    let { stand, bereich } = grosserBetrieb()
    expect(JSON.stringify(sichtOeffentlich(stand)).length).toBeGreaterThan(4096)
    for (let i = 0; i < 5; i++) {
      const b = sichtOeffentlich(stand).bereiche.find((x) => x.id === bereich)!
      const { next, bytes } = step(stand, { type: 'BETRIEB_ZEIGEN', bereich, ref: b.offen[0].key, vorher: b.aktuell?.key ?? null, zeit: 1_000_000 + i * 60_000 })
      expect(next).not.toBe(stand)
      expect(bytes).toBeLessThan(1500)
      stand = next
    }
  })

  it('eine Meldung ändert nur sich selbst', () => {
    const { stand, bereich } = grosserBetrieb()
    const { bytes } = step(stand, { type: 'BETRIEB_MELDUNG', bereich, meldung: { text: 'Kurze Pause', art: 'pause' } })
    expect(bytes).toBeLessThan(200)
  })
})

describe('equal', () => {
  it('vergleicht Objekte unabhängig von der Reihenfolge der Schlüssel', () => {
    expect(equal({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    expect(equal({ a: 1 }, { a: 1, b: undefined as unknown as Json })).toBe(false)
    expect(equal([1, 2], [2, 1])).toBe(false)
  })
})
