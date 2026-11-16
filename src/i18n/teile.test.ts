import { describe, expect, it } from 'vitest'
import de from './de'

// Die Bereichsdateien aus de/ und en/ (CLAUDE.md hier). de.ts setzt sie per Spread zusammen – dabei
// überschriebe derselbe Schlüssel in zwei Teilen den anderen still, das fiele sonst niemandem auf.
const deTeile = import.meta.glob<Record<string, string>>('./de/*.ts', { eager: true, import: 'default' })
const enTeile = import.meta.glob<Record<string, string>>('./en/*.ts', { eager: true, import: 'default' })

describe('Teile der Kataloge', () => {
  it('en/ ist wie de/ geschnitten: dieselben Dateien mit denselben Schlüsseln', () => {
    expect(Object.keys(enTeile).map((p) => p.replace('./en/', '')).sort()).toEqual(
      Object.keys(deTeile).map((p) => p.replace('./de/', '')).sort(),
    )
    for (const [pfad, teil] of Object.entries(deTeile)) {
      expect(Object.keys(enTeile[pfad.replace('./de/', './en/')]).sort(), pfad).toEqual(Object.keys(teil).sort())
    }
  })

  it('jeder Präfix steht in genau einem Teil, und de.ts setzt alle Teile zusammen', () => {
    const ort = new Map<string, string>()
    let anzahl = 0
    for (const [pfad, teil] of Object.entries(deTeile)) {
      for (const key of Object.keys(teil)) {
        const praefix = key.split('.')[0]
        expect(ort.get(praefix) ?? pfad, `${praefix} steht auch in ${pfad}`).toBe(pfad)
        ort.set(praefix, pfad)
        anzahl++
      }
    }
    expect(anzahl).toBe(Object.keys(de).length)
  })
})
