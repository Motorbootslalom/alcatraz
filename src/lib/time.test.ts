import { describe, expect, it } from 'vitest'
import {
  formatClock,
  formatMinutenEingabe,
  formatSeconds,
  formatTimeDisplay,
  parseTime,
  sanitizeTimeInput,
} from './time'

describe('parseTime', () => {
  it('deutet Zahl ≥ 20 vor dem Trenner als Sekunden,Hundertstel', () => {
    expect(parseTime('45,67')?.centis).toBe(4567)
    expect(parseTime('45.67')?.centis).toBe(4567) // Punkt = Komma
    expect(parseTime('20,50')?.centis).toBe(2050) // Grenze: 20 sind schon Sekunden
  })

  it('deutet Zahl < 20 vor dem Trenner als Minuten,ssHH', () => {
    expect(parseTime('1,2345')?.centis).toBe(1 * 6000 + 23 * 100 + 45)
    expect(parseTime('2,3456')?.centis).toBe(2 * 6000 + 34 * 100 + 56)
    expect(parseTime('19,30')?.centis).toBe(19 * 6000 + 30 * 100) // Grenze: 19 sind noch Minuten
  })

  it('füllt fehlende Nachkommastellen rechts mit Null auf', () => {
    expect(parseTime('45,6')?.centis).toBe(4560) // ss,c → Hundertstel
    expect(parseTime('1,23')?.centis).toBe(1 * 6000 + 23 * 100) // mm,ss
    expect(parseTime('1,2')?.centis).toBe(1 * 6000 + 20 * 100) // mm,s → ss=20
  })

  it('wendet dieselbe Grenze auf ganze Zahlen ohne Trenner an', () => {
    expect(parseTime('1')?.centis).toBe(6000) // wie "1,"
    expect(parseTime('1')?.centis).toBe(parseTime('1,')?.centis)
    expect(parseTime('19')?.centis).toBe(19 * 6000)
    expect(parseTime('20')?.centis).toBe(2000)
    expect(parseTime('20')?.centis).toBe(parseTime('20,')?.centis)
    expect(parseTime('47')?.centis).toBe(4700)
  })

  it('behandelt führenden Trenner wie eine 0 (",354" = "0,354")', () => {
    expect(parseTime(',354')?.centis).toBe(parseTime('0,354')?.centis)
    expect(parseTime(',354')?.centis).toBe(3540) // 0 min, ss=35, hh=40
    expect(parseTime('.5')?.centis).toBe(5000) // 0 min, ss=50
  })

  it('liest den Doppelpunkt als Trenner zwischen Minuten und Sekunden – so, wie die Uhr die Zeit zeigt', () => {
    // Früher fiel der Doppelpunkt weg: aus 1:23,45 wurden stillschweigend 123,45 Sekunden.
    expect(parseTime('1:23,45')?.centis).toBe(8345)
    expect(parseTime('1:23.45')?.centis).toBe(8345)
    expect(parseTime('01:23,4')?.centis).toBe(8340)
    expect(parseTime('1:23')?.centis).toBe(8300)
    expect(parseTime('0:45,67')?.centis).toBe(4567)
    // Auch über der Minuten-Grenze der Kurzschreibweise eindeutig.
    expect(parseTime('25:00,00')?.centis).toBe(25 * 6000)
    // Unvollständig oder unmöglich gilt nicht als Zeit.
    expect(parseTime('1:')).toBeNull()
    expect(parseTime('1:75,00')).toBeNull()
    expect(parseTime(':30')).toBeNull()
    expect(parseTime('1:2:3')).toBeNull()
  })

  it('lässt beim Tippen einen Doppelpunkt vor dem Dezimalzeichen stehen; das Dezimalzeichen folgt der Sprache', () => {
    expect(sanitizeTimeInput('1:23,45')).toBe('1:23,45')
    expect(sanitizeTimeInput('1:23.45x')).toBe('1:23,45')
    expect(sanitizeTimeInput(':1::2,3:4')).toBe('1:2,34')
    expect(sanitizeTimeInput('83,5', '.')).toBe('83.5')
    expect(sanitizeTimeInput('1:23,45', '.')).toBe('1:23.45')
  })

  it('gibt null für leere/ungültige Eingaben', () => {
    expect(parseTime('')).toBeNull()
    expect(parseTime('   ')).toBeNull()
    expect(parseTime('abc')).toBeNull()
  })
})

describe('Formatierung', () => {
  it('formatClock → mm:ss,cc', () => {
    expect(formatClock(8345)).toBe('01:23,45')
    expect(formatClock(4567)).toBe('00:45,67')
  })

  it('formatSeconds → ss,cc (ohne Minuten-Umbruch)', () => {
    expect(formatSeconds(8345)).toBe('83,45')
    expect(formatSeconds(4567)).toBe('45,67')
  })

  it('formatMinutenEingabe → "m,ssHH", das parseTime wieder genauso liest', () => {
    expect(formatMinutenEingabe(8345)).toBe('1,2345')
    expect(formatMinutenEingabe(6007)).toBe('1,0007')
    expect(formatMinutenEingabe(5832)).toBe('0,5832')
    for (const centis of [5832, 6000, 8345, 12099]) expect(parseTime(formatMinutenEingabe(centis))?.centis).toBe(centis)
  })

  it('formatTimeDisplay → "mm:ss,00 (ss,00)"', () => {
    expect(formatTimeDisplay(8345)).toBe('01:23,45 (83,45)')
  })
})

describe('sanitizeTimeInput', () => {
  it('lässt nur Ziffern und einen Trenner zu', () => {
    expect(sanitizeTimeInput('1,2a3.4')).toBe('1,234')
    expect(sanitizeTimeInput('12.34')).toBe('12,34')
  })
})
