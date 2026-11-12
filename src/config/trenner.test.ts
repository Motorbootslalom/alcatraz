import { describe, expect, it } from 'vitest'
import { load as yamlLoad } from 'js-yaml'
import { baue } from './konfig'
import { aufloesen } from './kurzform'
import type { RawQuelle } from './schema'

// Unabhängig von der ausgelieferten positionen.yaml: eine kleine Config bauen
// und die Trenner-Regeln prüfen (Folding, Positions-Default, Spalten-Override).
const YAML = `
positionen:
  - id: demo
    titel: Demo
    subTrenner: gepunktet
    spalten:
      - { key: a, label: A, typ: boje, sub: ["x", "y"] }
      - { typ: trenner, design: fett }
      - { key: b, label: B, typ: boje, subTrenner: doppelt, sub: ["x", "y"] }
      - { key: c, label: C, typ: boje }
`

function cols() {
  return baue({}, aufloesen(yamlLoad(YAML) as RawQuelle)).positions[0].columns
}

describe('Spalten-Trenner', () => {
  it('`{ typ: trenner }`-Einträge sind keine Spalten, sondern setzen die Linie der Folgespalte', () => {
    const c = cols()
    expect(c.map((x) => x.key)).toEqual(['a', 'b', 'c']) // trenner-Eintrag ist keine Spalte
    expect(c.find((x) => x.key === 'b')?.trenner).toBe('fett')
    expect(c.find((x) => x.key === 'a')?.trenner).toBeUndefined()
  })

  it('Positions-Default subTrenner gilt für alle Spalten, ist aber je Spalte überschreibbar', () => {
    const c = cols()
    expect(c.find((x) => x.key === 'a')?.subTrenner).toBe('gepunktet') // Positions-Default
    expect(c.find((x) => x.key === 'b')?.subTrenner).toBe('doppelt') // Spalten-Override
  })
})
