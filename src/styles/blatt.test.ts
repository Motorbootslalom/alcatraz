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
const pokalCss = lies('pokal.css')
const laufzettelCss = lies('laufzettel.css')
const aushangCss = lies('aushang.css')
const logosCss = lies('logos.css')

/**
 * Zusage an den Nutzer: Am Bildschirm folgen alle Listen dem Farbschema, im Druck sind sie
 * verlässlich schwarz auf weiß. Das hält nur, solange keine Listen-Regel eine Farbe an
 * --blatt-* vorbei setzt – genau das wird hier geprüft, damit es auch für künftige Listen
 * (Wertungslisten) gilt.
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

// Alles, was zu einem Blatt gehört: Listen (.sheet…, ihre Druckseiten .listen-seite…) und Bögen (.bogen…, Kopf bk-,
// Tabelle bt-, Legende bl, Unterschrift bu-). Neue Listenarten hier ergänzen.
// Dazu die Wertungslisten (ergebnis-blatt, erg-), die Eingabetabelle der Erfassung (erf-)
// die Laufzettel (laufzettel, lz-), der Aushang der Codes (lg-), die Pokalauswertung (pokal-) und die Logos im
// Kopf (kopf-logos, listen-logo).
const BLATT = /\.(sheet|listen-seite|bogen|ergebnis-blatt|ergebnis-stapel|laufzettel|lz-|lg-|erg-|pokal-|erf-|bk-|bt-|bl-|bu-|kopf-logos|listen-logo)|\.bl(?![\w-])/
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
    ['pokal.css', pokalCss],
    ['laufzettel.css', laufzettelCss],
    ['aushang.css', aushangCss],
    ['logos.css', logosCss],
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
    for (const css of [appCss, bogenCss, printCss, erfassungCss, ergebnisCss, pokalCss, laufzettelCss, aushangCss, logosCss]) {
      for (const r of regeln(css)) for (const d of r.deklarationen) expect(d.name, r.selektor).not.toMatch(/^--blatt-/)
    }
  })

  it('graue Zeilen: die zusammengefasste Zelle der Results bleibt weiß, die Zelle des Dummys auf der Startliste schraffiert auf Weiß', () => {
    // Auch wenn ihre erste Zeile grau ist (`tr.grau`): Die Regel muss die der grauen Zeile schlagen.
    const block = regeln(ergebnisCss).find((r) => r.selektor.includes('tr.grau td.erg-block'))
    expect(block?.deklarationen).toContainEqual({ name: 'background', wert: 'var(--blatt-bg)' })
    const dummy = regeln(appCss).find((r) => r.selektor === '.parallel-startliste .sheet-table td.psl-dummy')
    expect(dummy?.deklarationen.find((d) => d.name === 'background')?.wert).toMatch(/^repeating-linear-gradient\(135deg, var\(--blatt-bg\) /)
  })

  it('Spalte, die die Klasse der Zeile nicht hat: schraffiert wie die Zeile eines Dummys, in grauen Zeilen auf Grau (24.11.2026)', () => {
    // Nutzer: „Das Ausgrauen hast du bei den Dummy schon sehr gut umgesetzt. So soll das dort dann auch sein.“
    const alle = regeln(bogenCss).filter((r) => r.umgebung.length === 0)
    const hintergrund = (selektor: string) => alle.find((r) => r.selektor === selektor)?.deklarationen.find((d) => d.name === 'background')?.wert
    const streifen = '2.2px, var(--blatt-linie) 2.2px 3.2px)'
    expect(hintergrund('.bogen-tabelle > tbody > tr > td.bt-entfaellt')).toBe(`repeating-linear-gradient(135deg, var(--blatt-bg) 0 ${streifen}`)
    // Die graue Zeile liest sich weiter als graue Zeile; die schraffierte Zelle bleibt von einer bloß grauen verschieden.
    expect(hintergrund('.bogen-tabelle > tbody > tr.grau > td.bt-entfaellt')).toBe(`repeating-linear-gradient(135deg, var(--blatt-grau) 0 ${streifen}`)
    // Keine zweite, abweichende Schraffur mehr (früher eigene für den Dummy, blass für die Spalte).
    const schraffuren = alle.filter((r) => r.selektor.includes('bt-entfaellt') && r.deklarationen.some((d) => d.name === 'background'))
    expect(schraffuren.map((r) => r.selektor)).toEqual(['.bogen-tabelle > tbody > tr > td.bt-entfaellt', '.bogen-tabelle > tbody > tr.grau > td.bt-entfaellt'])
    // Gleiche Spezifität wie der weiße Grund der Dummy-Zeile: Die Schraffur muss danach stehen, sonst bliebe die Zelle weiß.
    const lage = (selektor: string) => alle.findIndex((r) => r.selektor === selektor)
    expect(lage('.bogen-tabelle > tbody > tr.bt-ohne > td')).toBeLessThan(lage('.bogen-tabelle > tbody > tr > td.bt-entfaellt'))
    expect(lage('.bogen-tabelle > tbody > tr.grau > td')).toBeLessThan(lage('.bogen-tabelle > tbody > tr > td.bt-entfaellt'))
  })

  it('jede benutzte --blatt-Variable hat eine Druckfarbe', () => {
    const bekannt = new Set(vorgabe!.deklarationen.map((d) => d.name))
    const benutzt = new Set<string>()
    for (const css of [appCss, bogenCss, printCss, erfassungCss, ergebnisCss, pokalCss, laufzettelCss, aushangCss, logosCss, blattCss]) for (const [, name] of css.matchAll(/var\(\s*(--blatt-[\w-]+)/g)) benutzt.add(name)
    expect([...benutzt].filter((n) => !bekannt.has(n))).toEqual([])
    expect(benutzt.size).toBeGreaterThan(5)
  })
})

describe('Zeichnung neben der Legende (Parallelslalom, 23.11.2026)', () => {
  // Zusage aus lib/parallelBogen.ts: Auf einsprachigen Bögen kostet die Zeichnung der Bahn keine Zeile je Blatt. Das
  // hält, solange sie nichts zur Höhe des Fußes beiträgt (absolut in ihrer Zelle) und die Legende ihre Breite behält
  // (max-content vor dem Rest). Die Bildspalte ist mindestens 100 mm breit (Prüfbefund 23.11.2026: zweisprachig blieb
  // sonst eine Zeichnung von 45 × 11 mm) – dort bricht die Legende um, nicht die Zeichnung schrumpft.
  const regel = (selektor: string) => regeln(bogenCss).find((r) => r.selektor === selektor)?.deklarationen ?? []
  it('das Bild liegt absolut in seiner Zelle, ist 100 mm breit, die Legende nimmt den Rest', () => {
    expect(regel('.bogen--bild-streifen .bogen-bild img')).toContainEqual({ name: 'position', wert: 'absolute' })
    expect(regel('.bogen--bild-streifen .bogen-bild')).toContainEqual({ name: 'position', wert: 'relative' })
    expect(regel('.bogen--bild-streifen .bogen-bild')).toContainEqual({ name: 'max-width', wert: '100mm' })
    expect(regel('.bogen--bild-streifen .bogen-fuss')).toContainEqual({ name: 'grid-template-columns', wert: 'minmax(0, max-content) minmax(100mm, 1fr)' })
  })
})
