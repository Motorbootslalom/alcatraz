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

  it('nach IOC (UIM, Regel 209): GER, SUI, NED, LAT – sonst wie ISO; frühere IOC-Kürzel nie', () => {
    expect(defaultKuerzel('Deutschland', 'ioc')).toBe('GER')
    expect(defaultKuerzel('Switzerland', 'ioc')).toBe('SUI')
    expect(defaultKuerzel('Niederlande', 'ioc')).toBe('NED')
    expect(defaultKuerzel('Latvia', 'ioc')).toBe('LAT')
    expect(defaultKuerzel('Österreich', 'ioc')).toBe('AUT')
    expect(defaultKuerzel('Litauen', 'ioc')).toBe('LTU')
    // ROM, SIN, TRI vergibt das IOC nicht mehr: heute ROU, SGP, TTO wie ISO.
    expect(['Rumänien', 'Singapur', 'Trinidad und Tobago'].map((n) => defaultKuerzel(n, 'ioc'))).toEqual(['ROU', 'SGP', 'TTO'])
    // BRN ist beim IOC Bahrain, bei ISO Brunei.
    expect(defaultKuerzel('Bahrain', 'ioc')).toBe('BRN')
    expect(defaultKuerzel('Brunei', 'ioc')).toBe('BRU')
    // Bundesländer bleiben, und ohne Angabe gilt ISO.
    expect(defaultKuerzel('Bayern', 'ioc')).toBe('BY')
    expect(kuerzelOf('Deutschland', {})).toBe('DEU')
    expect(kuerzelOf('Deutschland', { Deutschland: 'D' }, 'ioc')).toBe('D')
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
