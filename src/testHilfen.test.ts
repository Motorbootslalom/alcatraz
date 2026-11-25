import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { wackelTestsAuslassen } from './testHilfen'

// Die Wackel-Regel (Nutzer 24.11.2026) hängt an zwei Stellen: .github/workflows/ci.yml schreibt die Variable, die Hilfe
// liest sie. Lokal fehlt `CI`, ein Fehler im Zusammenspiel fiele also erst auf GitHub auf – darum hier ohne Netz geprüft.
describe('wackelTestsAuslassen', () => {
  it('lässt nur aus, wenn CI gesetzt ist und ALCATRAZ_WACKELTESTS nicht', () => {
    expect(wackelTestsAuslassen({ CI: 'true' })).toBe(true)
    expect(wackelTestsAuslassen({ CI: 'true', ALCATRAZ_WACKELTESTS: '1' })).toBe(false)
    // „nicht gesetzt“ sind auch leer, 0 und false – die Eingabe des Workflows schreibt bei Push 0
    for (const aus of ['', '0', 'false', ' FALSE ']) {
      expect(wackelTestsAuslassen({ CI: 'true', ALCATRAZ_WACKELTESTS: aus })).toBe(true)
    }
  })

  it('lokal (ohne CI, auch CI=false) laufen sie immer, egal was in ALCATRAZ_WACKELTESTS steht', () => {
    expect(wackelTestsAuslassen({})).toBe(false)
    expect(wackelTestsAuslassen({ ALCATRAZ_WACKELTESTS: '0' })).toBe(false)
    expect(wackelTestsAuslassen({ CI: 'false' })).toBe(false)
    expect(wackelTestsAuslassen({ CI: '0' })).toBe(false)
  })

  it('passt zu ci.yml: ohne Haken aus, mit Haken an; deploy.yml setzt die Variable nie', () => {
    const ci = readFileSync(`${process.cwd()}/.github/workflows/ci.yml`, 'utf8')
    // Genau eine Zuweisung, Form `inputs.wackeltests && '<an>' || '<aus>'` – ändert sich die Form, soll dieser Test
    // auf die Hilfe zeigen, statt dass die Tests bei jedem Push still wieder mitlaufen.
    const zuweisungen = [...ci.matchAll(/ALCATRAZ_WACKELTESTS:\s*\$\{\{\s*inputs\.wackeltests\s*&&\s*'([^']*)'\s*\|\|\s*'([^']*)'\s*\}\}/g)]
    expect(zuweisungen).toHaveLength(1)
    const [, an, aus] = zuweisungen[0]!
    expect(wackelTestsAuslassen({ CI: 'true', ALCATRAZ_WACKELTESTS: an })).toBe(false)
    expect(wackelTestsAuslassen({ CI: 'true', ALCATRAZ_WACKELTESTS: aus })).toBe(true)
    expect(ci.match(/ALCATRAZ_WACKELTESTS:/g)).toHaveLength(1)

    const deploy = readFileSync(`${process.cwd()}/.github/workflows/deploy.yml`, 'utf8')
    expect(deploy).not.toMatch(/ALCATRAZ_WACKELTESTS\s*[:=]/)
  })
})
