import { describe, expect, it } from 'vitest'
import { AUFBAUTEN, DEFAULT_AUFBAU, DEFAULT_REGELWERK, MANOEVER_AUFBAUTEN, REGELWERKE, hasParallel, regelwerkOf, sollgewichtOf } from './catalog'

describe('Regelwerke und Aufbauten', () => {
  it('liest die Regelwerke in Menü-Reihenfolge', () => {
    expect(REGELWERKE.map((r) => r.id)).toEqual(['dm-2026', 'uim-2026'])
    expect(REGELWERKE.map((r) => r.label)).toEqual(['DM 2026', 'UIM 2026'])
    expect(DEFAULT_REGELWERK).toBe('dm-2026')
  })

  it('UIM fährt nur bis Klasse 5 und nennt E „Dolphin“', () => {
    const uim = regelwerkOf('uim-2026')
    expect(uim.klassen).toEqual(['E', '1', '2', '3', '4', '5'])
    expect(uim.klassenNamen.E).toBe('Dolphin')
    expect(regelwerkOf('dm-2026').klassen).toHaveLength(8)
  })

  it('Parallelslalom gibt es nur nach den Regeln der UIM', () => {
    expect(hasParallel('dm-2026')).toBe(false)
    expect(hasParallel('uim-2026')).toBe(true)
  })

  it('zur Wahl stehen nur Aufbauten für das Manövrieren', () => {
    expect(DEFAULT_AUFBAU).toBe('alcatraz')
    expect(MANOEVER_AUFBAUTEN.map((a) => a.id)).toEqual(['alcatraz', 'alcatrazdm26', 'frontal', 'berlin', 'bawue', 'moewe'])
    expect(AUFBAUTEN.find((a) => a.id === 'parallel')?.disziplin).toBe('parallel')
  })

  it('nennt die Standardgewichte des Regelwerks – DM und UIM unterscheiden sich', () => {
    expect(regelwerkOf('dm-2026').gewichte).toEqual({ E: 26, '1': 33, '2': 42, '3': 52, '4': 65, '5': 72, '6': 75, '7': 78 })
    expect(regelwerkOf('uim-2026').gewichte).toEqual({ E: 26, '1': 32, '2': 40, '3': 52, '4': 64, '5': 71 })
    expect(sollgewichtOf('uim-2026', {}, '2')).toBe(40)
    expect(sollgewichtOf('uim-2026', { '2': 41 }, '2')).toBe(41)
    expect(sollgewichtOf('uim-2026', {}, '7')).toBe(0)
  })

  it('unbekannte Kennungen fallen auf die Vorgabe zurück', () => {
    expect(regelwerkOf('gibt-es-nicht').id).toBe('dm-2026')
  })
})
