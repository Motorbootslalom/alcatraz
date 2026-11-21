import { describe, expect, it } from 'vitest'
import de from './de'

// Die Bereichsdateien aus de/ und en/ (CLAUDE.md hier). de.ts setzt sie per Spread zusammen – dabei
// überschriebe derselbe Schlüssel in zwei Teilen den anderen still, das fiele sonst niemandem auf.
const deTeile = import.meta.glob<Record<string, string>>('./de/*.ts', { eager: true, import: 'default' })
const enTeile = import.meta.glob<Record<string, string>>('./en/*.ts', { eager: true, import: 'default' })

/**
 * Unterpräfixe mit eigener Datei (CLAUDE.md hier): `wkr.geraet.*` (Handy-Maske, wkrGeraet.ts, W3.3 21.11.2026) liegt
 * neben `wkr.*` (WKR-Einteilung, listenoptionen.ts) – eigener Bereich, weil die Maske in der Sprache der Liste spricht.
 */
const UNTERPRAEFIXE = ['wkr.geraet']
const praefixVon = (key: string) => UNTERPRAEFIXE.find((u) => key.startsWith(`${u}.`)) ?? key.split('.')[0]

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
        const praefix = praefixVon(key)
        expect(ort.get(praefix) ?? pfad, `${praefix} steht auch in ${pfad}`).toBe(pfad)
        ort.set(praefix, pfad)
        anzahl++
      }
    }
    expect(anzahl).toBe(Object.keys(de).length)
  })
})
