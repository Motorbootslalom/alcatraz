import { describe, expect, it } from 'vitest'
import { bojenZelle, sanitizeBuoy, sanitizeDisq } from './disq'

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

  // BZ1 umgebaut, BZ6 (22.11.2026, R7-14): Punkte, dann jeder erlaubte Buchstabe in Katalogfolge, getrennt mit „, “;
  // Dubletten und fremde Buchstaben weg; X allein (BZ2). A ist alphabetisch – Katalogfolge = A…L, X.
  it.each([
    ['5J', '5, J'],
    ['5 j', '5, J'],
    ['j5', '5, J'],
    ['5,J', '5, J'],
    ['5, J', '5, J'],
    ['10g', '10, G'],
    ['5JG', '5, G, J'],
    ['5zJ', '5, J'],
    ['5JD', '5, D, J'],
    ['5 J D', '5, D, J'],
    ['5,J,D', '5, D, J'],
    ['j5d', '5, D, J'],
    ['5, d, j', '5, D, J'],
    ['5;J;D', '5, D, J'],
    ['5JJ', '5, J'],
    ['J', 'J'],
    ['jd', 'D, J'],
    ['5', '5'],
    ['55', '55'],
    ['5 5', '55'],
    ['5x', 'X'],
    ['5, J, X', 'X'],
    ['jx', 'X'],
    ['x', 'X'],
    ['', ''],
  ])('Punkte und Buchstaben: „%s“ → „%s“', (roh, sauber) => {
    expect(sanitizeBuoy(roh, A)).toBe(sauber)
  })

  it('Buchstaben in der Folge des Disq.-Katalogs der Zelle, nicht in Tippfolge (BZ6)', () => {
    const katalog = new Set(['J', 'D', 'G', 'X'])
    expect(sanitizeBuoy('5dj', katalog)).toBe('5, J, D')
    expect(sanitizeBuoy('5jd', katalog)).toBe('5, J, D')
    expect(sanitizeBuoy('g d a', katalog)).toBe('D, G')
  })

  it('Zwischenstände beim Tippen bleiben stehen (Erfassung onInput je Taste)', () => {
    const tippe = (folge: string) => [...folge].reduce((feld, taste) => sanitizeBuoy(feld + taste, A), '')
    expect(tippe('5')).toBe('5')
    expect(tippe('5 ')).toBe('5')
    expect(tippe('5,')).toBe('5')
    expect(tippe('5j')).toBe('5, J')
    expect(tippe('5j d')).toBe('5, D, J')
    expect(tippe('10gj')).toBe('10, G, J')
    // Löschen am Ende: „5, J“ ohne „J“ = „5, “ → „5“.
    expect(sanitizeBuoy('5, ', A)).toBe('5')
  })
})

describe('bojenZelle', () => {
  it('schreibt Punkte und Buchstaben in der einen Form (BZ6)', () => {
    const katalog = new Set(['J', 'D', 'X'])
    expect(bojenZelle(5, ['D', 'J'], katalog)).toBe('5, J, D')
    expect(bojenZelle(0, ['J'], katalog)).toBe('J')
    expect(bojenZelle(10, [], katalog)).toBe('10')
    expect(bojenZelle(0, [], katalog)).toBe('')
    expect(bojenZelle('5', ['J', 'X'], katalog)).toBe('X')
    expect(bojenZelle(5, ['Q'], katalog)).toBe('5')
    // Ohne Katalog: Folge wie gegeben, nur entdoppelt.
    expect(bojenZelle(5, ['d', 'j', 'D'])).toBe('5, D, J')
  })
})
