import { describe, expect, it } from 'vitest'
import { BUNDESLAENDER, defaultKuerzel, kuerzelOf } from './kuerzel'

describe('Kürzel der Herkunft', () => {
  it('kennt alle 16 Bundesländer mit ihrem ISO-Code', () => {
    expect(BUNDESLAENDER).toHaveLength(16)
    expect(new Set(BUNDESLAENDER.map((l) => l.code)).size).toBe(16)
    expect(defaultKuerzel('Nordrhein-Westfalen')).toBe('NW')
    expect(defaultKuerzel('  sachsen anhalt ')).toBe('ST')
    expect(defaultKuerzel('Sachsen')).toBe('SN')
    expect(defaultKuerzel('NRW')).toBe('NW')
  })

  it('kennt Länder deutsch und englisch mit dem dreistelligen ISO-Code', () => {
    expect(defaultKuerzel('Deutschland')).toBe('DEU')
    expect(defaultKuerzel('Germany')).toBe('DEU')
    expect(defaultKuerzel('Österreich')).toBe('AUT')
    expect(defaultKuerzel('Polen')).toBe('POL')
    expect(defaultKuerzel('Latvia')).toBe('LVA')
  })

  it('hat für Vereine keine Vorgabe', () => {
    expect(defaultKuerzel('MC Neuruppin e.V.')).toBe('')
  })

  it('eigene Einträge gehen vor, leere zählen nicht', () => {
    expect(kuerzelOf('MC Neuruppin e.V.', { 'MC Neuruppin e.V.': 'MCN' })).toBe('MCN')
    expect(kuerzelOf('Bayern', { bayern: 'BAY' })).toBe('BAY')
    expect(kuerzelOf('Bayern', { Bayern: '  ' })).toBe('BY')
    expect(kuerzelOf('Unbekannt', {})).toBe('')
  })
})
