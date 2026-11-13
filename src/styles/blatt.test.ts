/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// Von der Platte gelesen: Vitest liefert für CSS-Importe (auch „?raw“) leeren Text.
const lies = (datei: string) => readFileSync(`${process.cwd()}/src/styles/${datei}`, 'utf8')
const appCss = lies('app.css')
const blattCss = lies('blatt.css')
const bogenCss = lies('bogen.css')
const printCss = lies('print.css')
const erfassungCss = lies('erfassung.css')
const ergebnisCss = lies('ergebnis.css')

/**
 * Zusage an den Nutzer: Am Bildschirm folgen alle Listen dem Farbschema, im Druck sind sie
 * verlässlich schwarz auf weiß. Das hält nur, solange keine Listen-Regel eine Farbe an
 * --blatt-* vorbei setzt – genau das wird hier geprüft, damit es auch für künftige Listen
 * (Ergebnislisten) gilt.
 */

interface Regel {
  selektor: string
  /** Umgebende @-Regeln, außen zuerst (z. B. „@media screen“). */
  umgebung: string[]
  deklarationen: { name: string; wert: string }[]
}

/** Kleiner Zerleger für unser eigenes, schlichtes CSS (keine Zeichenketten mit Klammern). */
function regeln(css: string): Regel[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const liste: Regel[] = []
  const block = (von: number, umgebung: string[]): number => {
    let i = von
    while (i < text.length) {
      const auf = text.indexOf('{', i)
      const zu = text.indexOf('}', i)
      if (zu !== -1 && (auf === -1 || zu < auf)) return zu + 1
      if (auf === -1) return text.length
      const kopf = text.slice(i, auf).trim()
      if (/^@(media|supports)/.test(kopf)) {
        i = block(auf + 1, [...umgebung, kopf])
        continue
      }
      const ende = text.indexOf('}', auf)
      const deklarationen = text
        .slice(auf + 1, ende)
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
        .map((d) => ({ name: d.slice(0, d.indexOf(':')).trim(), wert: d.slice(d.indexOf(':') + 1).trim() }))
      liste.push({ selektor: kopf.replace(/\s+/g, ' '), umgebung, deklarationen })
      i = ende + 1
    }
    return i
  }
  block(0, [])
  return liste
}

// Alles, was zu einem Blatt gehört: Listen (.sheet…) und Bögen (.bogen…, Kopf bk-,
// Tabelle bt-, Legende bl, Unterschrift bu-). Neue Listenarten hier ergänzen.
// Dazu die Ergebnislisten (ergebnis-blatt, erg-) und die Eingabetabelle der Erfassung (erf-).
const BLATT = /\.(sheet|bogen|ergebnis-blatt|ergebnis-stapel|erg-|erf-|bk-|bt-|bl-|bu-)|\.bl(?![\w-])/
const FESTE_FARBE = /#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(|\b(white|black|red|gr[ae]y|silver|blue|green|yellow|orange|navy|teal)\b/i
// Variablen ohne Farbe, die Blatt-Regeln benutzen dürfen (Maße, Schatten, Rundung).
const ERLAUBT = /^--(blatt-[\w-]+|bogen-[\w-]+|bild-breite|radius|shadow)$/

function verstoesse(css: string): string[] {
  const funde: string[] = []
  for (const r of regeln(css)) {
    if (!BLATT.test(r.selektor)) continue
    for (const d of r.deklarationen) {
      // Schriftnamen stehen in Anführungszeichen und sind keine Farben.
      const wert = d.wert.replace(/'[^']*'|"[^"]*"/g, '')
      if (FESTE_FARBE.test(wert)) funde.push(`${r.selektor} { ${d.name}: ${d.wert} }`)
      for (const [, name] of wert.matchAll(/var\(\s*(--[\w-]+)/g)) {
        if (!ERLAUBT.test(name)) funde.push(`${r.selektor} { ${d.name}: ${d.wert} }`)
      }
    }
  }
  return funde
}

describe('Farben der Listen und Bögen', () => {
  it('der Zerleger findet die Regeln, auch in @media', () => {
    const r = regeln('.a { color: red; } @media print { .b, .c { top: 0; margin: 1px 2px } }')
    expect(r).toEqual([
      { selektor: '.a', umgebung: [], deklarationen: [{ name: 'color', wert: 'red' }] },
      { selektor: '.b, .c', umgebung: ['@media print'], deklarationen: [{ name: 'top', wert: '0' }, { name: 'margin', wert: '1px 2px' }] },
    ])
  })

  it('die Prüfung schlägt bei festen Farben und Schema-Variablen an', () => {
    expect(verstoesse('.sheet-table td { border: 1px solid #000 }')).toHaveLength(1)
    expect(verstoesse('.bogen { background: white }')).toHaveLength(1)
    expect(verstoesse('.bl-code { color: var(--accent) }')).toHaveLength(1)
    expect(verstoesse('.bk-zelle { color: rgb(0 0 0 / 0.5) }')).toHaveLength(1)
    expect(verstoesse(".sheet { font-family: 'Liberation Sans'; white-space: nowrap; color: var(--blatt-text) }")).toEqual([])
    expect(verstoesse('.panel { color: #123 }')).toEqual([])
  })

  it.each([
    ['app.css', appCss],
    ['bogen.css', bogenCss],
    ['print.css', printCss],
    ['erfassung.css', erfassungCss],
    ['ergebnis.css', ergebnisCss],
  ])('%s: Listen-Regeln setzen Farben nur über --blatt-*', (_name, css) => {
    expect(regeln(css).some((r) => BLATT.test(r.selektor))).toBe(true)
    expect(verstoesse(css)).toEqual([])
  })

  const blatt = regeln(blattCss)
  const vorgabe = blatt.find((r) => r.selektor === ':root' && r.umgebung.length === 0)

  it('die Vorgabe (und damit der Druck) sind feste Farben ohne Bezug zum Schema', () => {
    expect(vorgabe).toBeDefined()
    for (const d of vorgabe!.deklarationen) expect(d.wert, d.name).not.toMatch(/var\(|color-mix/)
    const wert = (name: string) => vorgabe!.deklarationen.find((d) => d.name === name)?.wert
    expect(wert('--blatt-bg')).toBe('#fff')
    expect(wert('--blatt-text')).toBe('#000')
    expect(wert('--blatt-linie')).toBe('#000')
    // Die graue Fünfer-Zeile der bisherigen Ausdrucke.
    expect(wert('--blatt-grau')).toBe('#d9d9d9')
  })

  it('aus dem Schema abgeleitet wird nur am Bildschirm', () => {
    for (const r of blatt) {
      if (r === vorgabe) continue
      expect(r.umgebung, r.selektor).toEqual(['@media screen'])
    }
    // Sonst blieben im Druck die Bildschirmwerte stehen.
    for (const css of [appCss, bogenCss, printCss, erfassungCss, ergebnisCss]) {
      for (const r of regeln(css)) for (const d of r.deklarationen) expect(d.name, r.selektor).not.toMatch(/^--blatt-/)
    }
  })

  it('jede benutzte --blatt-Variable hat eine Druckfarbe', () => {
    const bekannt = new Set(vorgabe!.deklarationen.map((d) => d.name))
    const benutzt = new Set<string>()
    for (const css of [appCss, bogenCss, printCss, erfassungCss, ergebnisCss, blattCss]) for (const [, name] of css.matchAll(/var\(\s*(--blatt-[\w-]+)/g)) benutzt.add(name)
    expect([...benutzt].filter((n) => !bekannt.has(n))).toEqual([])
    expect(benutzt.size).toBeGreaterThan(5)
  })
})
