import { describe, expect, it } from 'vitest'
import { sanitizeBuoy, sanitizeDisq } from './disq'

// Standard-Set (A-L, X) für die Tests.
const A = new Set('ABCDEFGHIJKLX'.split(''))

describe('sanitizeDisq', () => {
  it('wandelt in Großbuchstaben um', () => {
    expect(sanitizeDisq('g', A)).toBe('G')
  })

  it('lässt nur erlaubte Codes zu (A-L, X)', () => {
    expect(sanitizeDisq('gz', A)).toBe('G') // z ist kein gültiger Code
    expect(sanitizeDisq('m', A)).toBe('') // M gibt es nicht
    expect(sanitizeDisq('9A', A)).toBe('A') // Ziffern raus
  })

  it('respektiert ein eingeschränktes Set (Ausblenden pro Position)', () => {
    const nur = new Set(['A', 'B', 'X'])
    expect(sanitizeDisq('a g x', nur)).toBe('A, X') // G ausgeblendet
  })

  it('normalisiert mehrere Codes einheitlich auf ", "', () => {
    expect(sanitizeDisq('a, x', A)).toBe('A, X')
    expect(sanitizeDisq('A B', A)).toBe('A, B')
  })

  it('trennt auch zusammengeschriebene Codes auf ", "', () => {
    expect(sanitizeDisq('gf', A)).toBe('G, F')
  })
})

describe('sanitizeBuoy', () => {
  it('behält Punkte-Ziffern', () => {
    expect(sanitizeBuoy('10', A)).toBe('10')
    expect(sanitizeBuoy('5', A)).toBe('5')
  })

  it('macht aus einem erlaubten Buchstaben eine Großbuchstaben-Disq-Marke', () => {
    expect(sanitizeBuoy('g', A)).toBe('G')
  })

  it('verwirft unerlaubte Buchstaben', () => {
    expect(sanitizeBuoy('z', A)).toBe('')
  })
})
