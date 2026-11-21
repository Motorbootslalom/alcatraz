/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

// Von der Platte gelesen (Muster blatt.test.ts): Vitest liefert für CSS-Importe leeren Text, und happy-dom misst
// keine Größen – die Mindestgrößen der Handy-Maske (W3.3, Plan docs/plan-wkr-w3.md §5.2) stehen deshalb hier fest.
const css = readFileSync(`${process.cwd()}/src/styles/wkr-geraet.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const ordner = `${process.cwd()}/src/components/wkr`
const vorlagen = readdirSync(ordner)
  .filter((d) => d.endsWith('.vue'))
  .map((d) => ({ datei: d, text: readFileSync(`${ordner}/${d}`, 'utf8') }))

/** Deklarationen eines Selektors (genau so geschrieben), nur Regeln ohne @-Hülle. */
function regel(selektor: string, allein = false): Record<string, string> {
  // `allein`: die letzte Regel, die genau so beginnt (eine eigene nach einer Sammelregel „.a,\n.b {“).
  const i = allein ? css.lastIndexOf(`\n${selektor} {`) + 1 : css.indexOf(`${selektor} {`)
  expect(i, selektor).toBeGreaterThanOrEqual(0)
  const rumpf = css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i))
  return Object.fromEntries(
    rumpf
      .split(';')
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]),
  )
}
const px = (wert: string) => Number(/^(\d+(?:\.\d+)?)px$/.exec(wert)?.[1] ?? NaN)

describe('WKR-Maske: Mindestgrößen und Sonnenmodus (styles/wkr-geraet.css)', () => {
  it('Tokens: Ziele ≥ 64 px, nie < 48 px, Abstand ≥ 8 px, Disq. ≥ 24 px vom Hauptknopf, Schrift ≥ 20 px, Nummer ≥ 96 px', () => {
    const t = regel('.wkr-geraet')
    expect(px(t['--wkr-ziel'])).toBeGreaterThanOrEqual(64)
    expect(px(t['--wkr-ziel-min'])).toBeGreaterThanOrEqual(48)
    expect(px(t['--wkr-abstand'])).toBeGreaterThanOrEqual(8)
    expect(px(t['--wkr-disq-abstand'])).toBeGreaterThanOrEqual(24)
    expect(px(t['--wkr-schrift'])).toBeGreaterThanOrEqual(20)
    expect(px(t['--wkr-startnr'])).toBeGreaterThanOrEqual(96)
    expect(t['touch-action']).toBe('manipulation')
  })

  it('Sonne ist Vorgabe: schwarz auf weiß mit 3-px-Rändern, ohne prefers-color-scheme', () => {
    const t = regel('.wkr-geraet')
    expect([t['--wkr-grund'], t['--wkr-text'], t['--wkr-rand']]).toEqual(['#ffffff', '#000000', '3px'])
    expect(t.background).toBe('var(--wkr-grund)')
    expect(css).not.toContain('prefers-color-scheme')
    // Andere Modi nur ausdrücklich über data-modus.
    expect(css).toContain(".wkr-geraet[data-modus='hell']")
    expect(css).toContain(".wkr-geraet[data-modus='dunkel']")
  })

  it('Zielgrößen hängen an data-ziel; jede feste Mindesthöhe ≥ 48 px', () => {
    expect(regel(".wkr-knopf[data-ziel='gross']")['min-height']).toBe('var(--wkr-ziel)')
    expect(regel(".wkr-knopf[data-ziel='klein']")['min-height']).toBe('var(--wkr-ziel-min)')
    for (const m of css.matchAll(/min-height:\s*(\d+)px/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(48)
    expect(regel('.wkr-fuss').gap).toBe('var(--wkr-disq-abstand)')
    expect(regel('.wkr-fuss--links')['flex-direction']).toBe('row-reverse')
  })

  it('Prüfbefunde W3: Fuß klebt unten, gesetzte Disq. rot über aria-pressed, Grau als Token mit Kontrast je Modus', () => {
    const unten = regel('.wkr-unten', true)
    expect([unten.position, unten.bottom, unten.background]).toEqual(['sticky', '0', 'var(--wkr-grund)'])
    // Spezifität ≥ der von .wkr-knopf[aria-pressed='true'] (0,2,0) und weiter unten: Rot gewinnt.
    const gesetzt = regel('.wkr-knopf.wkr-disq-knopf--gesetzt')
    expect(gesetzt.background).toBe('var(--wkr-rot)')
    expect(css.indexOf('.wkr-knopf.wkr-disq-knopf--gesetzt {')).toBeGreaterThan(css.indexOf(".wkr-knopf[aria-pressed='true']"))
    expect(regel('.wkr-entfaellt').color).toBe('var(--wkr-grau)')
    const kontrast = (a: string, b: string) => {
      const l = (hex: string) => {
        const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
      }
      const [x, y] = [l(a), l(b)].sort((p, q) => q - p)
      return (x + 0.05) / (y + 0.05)
    }
    const sonne = regel('.wkr-geraet')
    const dunkel = regel(".wkr-geraet[data-modus='dunkel']")
    expect(kontrast(sonne['--wkr-grau'], sonne['--wkr-grund'])).toBeGreaterThanOrEqual(4.5)
    expect(kontrast(dunkel['--wkr-grau'], dunkel['--wkr-grund'])).toBeGreaterThanOrEqual(4.5)
    // Keine feste Farbe außerhalb der Token-Blöcke (Rückfall in var(--app-token, #…) außerhalb der Maske ausgenommen).
    const ohneTokens = css.replace(/\.wkr-geraet(\[data-modus='[a-z]+'\])? \{[^}]*\}/g, '').replace(/var\(--[a-z-]+, #[0-9a-fA-F]+\)/g, '')
    expect(ohneTokens).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
  })

  it('keine Animation und kein Übergang (Akku) – der Blitz ist nur eine Fläche', () => {
    expect(css).not.toMatch(/@keyframes/)
    for (const m of css.matchAll(/(?:^|[;{\s])(animation|transition)(?:-[a-z-]+)?\s*:\s*([^;}]+)/g)) expect(m[2].trim(), m[0]).toBe('none')
    expect(regel('.wkr-blitz')['pointer-events']).toBe('none')
  })

  it('jeder Knopf der Maske hat eine Zielgröße (data-ziel gross|klein) und touch-action über .wkr-knopf', () => {
    expect(vorlagen.length).toBeGreaterThan(5)
    for (const { datei, text } of vorlagen) {
      // Auch Verweise sind Tippflächen (Prüfbefund W3: „Zum Koppeln“ war ein nackter Textlink).
      for (const m of text.matchAll(/<(?:button|a)\b(?:[^>"]|"[^"]*")*>/g)) {
        expect(m[0], `${datei}: ${m[0].slice(0, 80)}`).toMatch(/data-ziel="(gross|klein)"/)
        expect(m[0], datei).toMatch(/class="wkr-knopf/)
      }
    }
    expect(regel('.wkr-knopf')['touch-action']).toBe('manipulation')
  })
})
