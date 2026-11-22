/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { anordnung } from '../wkr/anordnung'

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

  // Seit 21.11.2026 (GF1) ist „Wie Gerät“ Vorgabe – das System liest components/wkr/systemModus.ts in JS und setzt
  // `data-modus`; die CSS bleibt ohne @media, damit die Farben nur an `data-modus` hängen.
  it('Sonne ist die Grundregel: schwarz auf weiß mit 3-px-Rändern, ohne prefers-color-scheme', () => {
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
    expect(regel('.wkr-grau-text').color).toBe('var(--wkr-grau)')
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

/** Kontrast nach WCAG zwischen zwei #rrggbb-Farben. */
function kontrastVon(a: string, b: string): number {
  const l = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const [x, y] = [l(a), l(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
/** Klassen, die in Selektoren eines Stylesheets stehen (Rümpfe und Kommentare weg). */
function klassenIn(text: string): Set<string> {
  const ohne = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{[^}]*\}/g, '{}')
  return new Set([...ohne.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))
}

describe('Feldtest 21.11.2026: Farben in jedem Modus, keine fremden Regeln, kein abgeschnittener Text', () => {
  it('Befund 5/N4: keine Klasse der Maske steht in einem anderen Stylesheet (app.css gewann bei gleichem Namen)', () => {
    const eigene = klassenIn(css)
    const ordnerCss = `${process.cwd()}/src/styles`
    // `.btn` gehört nicht der Maske: Nur die Reiter unter ihr (GeraetFreigabe) schärfen den Knopf der App.
    const erlaubt = new Set(['btn'])
    for (const datei of readdirSync(ordnerCss).filter((d) => d.endsWith('.css') && d !== 'wkr-geraet.css')) {
      const fremd = klassenIn(readFileSync(`${ordnerCss}/${datei}`, 'utf8'))
      const doppelt = [...eigene].filter((k) => fremd.has(k) && !erlaubt.has(k))
      expect(doppelt, datei).toEqual([])
    }
  })

  it('W5.1 (22.11.2026, T10 entfällt): keine mittige 560-px-Spalte mehr; Pad volle Breite mit --wkr-ziel-pad, Spalten minmax(0, 1fr)', () => {
    expect(css).not.toContain('@media (min-width: 700px)')
    expect(css).not.toContain('--wkr-umfeld')
    expect(css).not.toMatch(/padding-inline:/)
    expect(regel('.wkr-geraet')['max-width']).toBe('560px')
    expect(px(regel('.wkr-geraet')['--wkr-ziel-pad'])).toBeGreaterThanOrEqual(64)
    const pad = regel(".wkr-geraet[data-anordnung='padQuer'],\n.wkr-geraet[data-anordnung='padHoch']")
    expect([pad['max-width'], pad['--wkr-ziel']]).toEqual(['none', 'var(--wkr-ziel-pad)'])
    expect(regel(".wkr-geraet[data-anordnung='padQuer'] .wkr-maske--bojen")['--wkr-startnr']).toBe('96px')
    expect(regel('.wkr-spalten')['grid-template-columns']).toBe('repeat(var(--wkr-spalten, 1), minmax(0, 1fr))')
    for (const sel of ['.wkr-spalte', '.wkr-maske-haupt', '.wkr-seite', '.wkr-seite-text']) expect(regel(sel, true)['min-width'], sel).toBe('0')
    expect(regel(".wkr-maske[data-seite='rechts']")['grid-template-columns']).toBe('minmax(0, 7fr) minmax(0, 3fr)')
    // Der klebende Fuß reicht 12 px über den Innenrand hinaus (wie bisher).
    expect(regel('.wkr-unten', true).margin).toBe('0 -12px -12px')
    // Die Hülle der Freigabe gibt die Breite nur für eine Pad-Anordnung frei (über data-teil/data-anordnung, N4).
    const geraet = readFileSync(`${process.cwd()}/src/styles/geraet.css`, 'utf8')
    expect(geraet).not.toContain('@media (min-width: 700px)')
    expect(geraet).toContain(".geraet-freigabe:has(> [data-teil='wkr-geraet']:not([data-anordnung='handy'])) {\n  max-width: none;\n  padding: 0;")
    expect(geraet).toContain(":not([data-anordnung='handy'])) > :not([data-teil='wkr-geraet']) {\n  max-width: 720px;")
  })

  it('W5.1: nie abgeschnitten – bei 768×1024, 1024×768 und 1366×1024 mit 1–4 Listen ist jede Arbeitsfläche mindestens so breit wie die geprüfte Handy-Maske', () => {
    // happy-dom misst nicht: Die Breiten folgen aus der Anordnung (wkr/anordnung.ts) und den Maßen hier – Innenrand der
    // Wurzel 12 px je Seite, Spaltenabstand --wkr-disq-abstand, Seitenspalte 3/10 (PD3). Die Handy-Maske ist bei 360 px
    // (Inhalt 336 px) geprüft (Befunde N3, S4); breiter heißt: jeder Text bricht dort mindestens so gut um.
    const wurzel = regel('.wkr-geraet')
    const innen = 2 * 12
    expect(wurzel.padding).toBe('8px 12px 12px')
    const abstand = px(wurzel['--wkr-disq-abstand'])
    for (const [breite, hoehe] of [
      [768, 1024],
      [1024, 768],
      [1366, 1024],
    ])
      for (const typ of ['pad', 'rechner', undefined] as const)
        for (let n = 1; n <= 4; n++) {
          const a = anordnung({ breite, hoehe, typ, listen: ['a', 'b', 'c', 'd'].slice(0, n), teile: n === 1 ? ['a'] : [] })
          const k = a.spalten.length
          const spalte = (breite - innen - (k - 1) * abstand) / k
          const flaeche = a.seite === 'rechts' ? ((spalte - abstand) * 7) / 10 : spalte
          expect(a.art, `${breite}×${hoehe}`).not.toBe('handy')
          expect(flaeche, `${breite}×${hoehe} ${typ ?? '–'} ${n} Listen → ${k} Spalten`).toBeGreaterThanOrEqual(336)
          // Die Seitenspalte selbst trägt nur umbrechenden Text (Nummern nowrap, kurz).
          if (a.seite === 'rechts') expect(((spalte - abstand) * 3) / 10).toBeGreaterThanOrEqual(200)
        }
  })

  it('Befund 5: jeder Selektor beginnt mit einer Klasse der Maske – kein Element-, Kennungs- oder App-Selektor leckt hinaus', () => {
    // Die Maske hängt unter `.wkr-geraet`; eine Regel wie `button {` oder `.btn {` träfe die ganze App (Matrix, Freigabe).
    // Ausnahme: die Reiter und der Übungs-Verweis von GeraetFreigabe, die eigene `geraet-*`-Klassen tragen.
    const ohne = css.replace(/@media[^{]*\{/g, '')
    const selektoren = [...ohne.matchAll(/([^{}]+)\{/g)].flatMap((m) => m[1].split(',').map((x) => x.trim())).filter(Boolean)
    expect(selektoren.length).toBeGreaterThan(50)
    const erlaubt = /^\.(wkr-[\w-]+|geraet-reiter|geraet-ueben)(?![\w-])/
    expect(selektoren.filter((sel) => !erlaubt.test(sel))).toEqual([])
    // Und die Wurzel-Klasse `.wkr-geraet` gehört allein der Maske (Matrix: `.wkr-mgeraet`, Commit 9ff56c0).
    const app = readFileSync(`${process.cwd()}/src/styles/app.css`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(app).not.toMatch(/\.wkr-geraet(?![\w-])/)
  })

  it('Befund 5: Klassen der Maske (wkr-, ohne die des Bedienrechners) werden nur unter components/wkr/ benutzt', () => {
    const eigene = [...klassenIn(css)].filter((k) => k.startsWith('wkr-'))
    const quellen = `${process.cwd()}/src`
    const fremd: string[] = []
    const lies = (dir: string) => {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        const pfad = `${dir}/${d.name}`
        if (d.isDirectory()) {
          if (!pfad.endsWith('/components/wkr')) lies(pfad)
        } else if (d.name.endsWith('.vue')) {
          // Nur Klassen-Attribute (class="…", :class="…") – data-action="wkr-geraet" ist keine Klasse.
          const klassen = [...readFileSync(pfad, 'utf8').matchAll(/:?class="([^"]*)"/g)].map((m) => m[1]).join(' ')
          for (const k of eigene) if (new RegExp(`(^|[\\s'{])${k}(?![\\w-])`).test(klassen)) fremd.push(`${pfad.slice(quellen.length)}: ${k}`)
        }
      }
    }
    lies(quellen)
    // Einzige Ausnahme: GeraetFreigabe setzt an der Wurzel der Maske, ob unter ihr die Reiter kleben (Fuß darüber).
    expect(fremd).toEqual(['/components/betrieb/GeraetFreigabe.vue: wkr-mit-reiter'])
  })

  it('Befunde 2/11: jede Fläche mit eigenem Grund setzt auch ihre Schrift; color-scheme folgt dem Modus der Maske', () => {
    for (const sel of ['.wkr-knopf', '.wkr-band', '.wkr-starterkarte', '.wkr-zuletzt-leiste', '.wkr-eingabe', '.wkr-uebertragen-kasten']) {
      const r = regel(sel, true)
      expect(r.background, sel).toMatch(/^var\(--wkr-/)
      expect(r.color, sel).toMatch(/^var\(--wkr-/)
    }
    expect(regel('.wkr-geraet')['color-scheme']).toBe('light')
    expect(regel(".wkr-geraet[data-modus='dunkel']")['color-scheme']).toBe('dark')
  })

  it('Befund 2: Kontrast Text/Fläche, Haupt, Warnung, Rot, Übung ≥ 4,5:1 in Sonne, Hell und Dunkel', () => {
    const sonne = regel('.wkr-geraet')
    const modi = {
      sonne,
      hell: { ...sonne, ...regel(".wkr-geraet[data-modus='hell']") },
      dunkel: { ...sonne, ...regel(".wkr-geraet[data-modus='dunkel']") },
    }
    for (const [name, t] of Object.entries(modi)) {
      for (const [vorne, hinten] of [
        ['--wkr-text', '--wkr-flaeche'],
        ['--wkr-text', '--wkr-grund'],
        ['--wkr-haupt-text', '--wkr-haupt'],
        ['--wkr-warn-text', '--wkr-warn'],
        ['--wkr-rot-text', '--wkr-rot'],
        ['--wkr-uebung-text', '--wkr-uebung'],
      ]) {
        expect(kontrastVon(t[vorne], t[hinten]), `${name}: ${vorne} auf ${hinten}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('Befund 1/N3: Umbruch überall, Nummern brechen nie, Code-Text darf schmaler als sein längstes Wort werden', () => {
    const wurzel = regel('.wkr-geraet')
    expect([wurzel['overflow-wrap'], wurzel.hyphens, wurzel['min-width']]).toEqual(['anywhere', 'auto', '0'])
    expect(regel('.wkr-knopf')['white-space']).toBe('normal')
    expect(css).toMatch(/\.wkr-code,\s*\.wkr-disq-knopf \{[^}]*grid-template-columns: 2\.2em minmax\(0, 1fr\) auto;/)
    for (const sel of ['.wkr-code-nr', '.wkr-startnr']) expect(regel(sel)['white-space'], sel).toBe('nowrap')
    expect(regel('.wkr-code-mitte')['flex-wrap']).toBe('wrap')
    expect(regel('.wkr-starterkarte-zeile')['flex-wrap']).toBe('wrap')
    // Abgeschnitten (overflow: hidden) wird nur die Leiste „Zuletzt“ (M5: eine Zeile fester Höhe, nur Nummern).
    const versteckt = [...css.matchAll(/([^{}]+)\{[^}]*overflow:\s*hidden/g)].map((m) => m[1].trim())
    expect(versteckt).toEqual(['.wkr-zuletzt-leiste'])
    // Das Band über dem Kopf („Keine Bestätigung“, „Bestätigung folgt“) wächst mit dem Text (Prüfbefund 21.11.2026).
    expect([regel('.wkr-kopf-ueber').inset, regel('.wkr-kopf-ueber')['min-height']]).toEqual(['0 0 auto', 'calc(100% - 6px)'])
    // „Bitte Nr. prüfen“ kommt ebenso ohne Tipp: über dem Kopf, über „Keine Bestätigung“ (S5, Prüfbefund 21.11.2026).
    const kopf = vorlagen.find((v) => v.datei === 'WkrKopf.vue')!.text
    expect(kopf).toMatch(/class="wkr-band wkr-band--hinweis wkr-kopf-ueber wkr-kopf-hinweis"[^>]*data-teil="hinweis"/)
    expect(Number(regel('.wkr-kopf-hinweis')['z-index'])).toBeGreaterThan(Number(regel('.wkr-kopf-ueber')['z-index']))
  })

  it('N1: Overlay über der ganzen Maske, unter dem Blitz, fängt Tipps', () => {
    const o = regel('.wkr-uebertragen')
    expect([o.position, o.inset, o['pointer-events']]).toEqual(['fixed', '0', 'auto'])
    expect(Number(o['z-index'])).toBeLessThan(Number(regel('.wkr-blitz')['z-index']))
  })
})


describe('W4.2 Bojen-Maske (21.11.2026, Plan docs/plan-wkr-w4.md §5.2)', () => {
  it('Bojen- und Umschalter-Knöpfe sind große Ziele (≥ 64 px über data-ziel="gross"), zwei Spalten mit ≥ 8 px Abstand', () => {
    const bojen = vorlagen.find((v) => v.datei === 'WkrBojen.vue')!.text
    const weg = vorlagen.find((v) => v.datei === 'WkrWegUmschalter.vue')!.text
    expect(bojen).toMatch(/class="wkr-knopf wkr-bojen-knopf"[^<]*data-ziel="gross"/)
    expect(weg).toMatch(/class="wkr-knopf wkr-bojen-weg-knopf"[^<]*data-ziel="gross"/)
    const knoepfe = regel('.wkr-bojen-knoepfe')
    expect(knoepfe['grid-template-columns']).toBe('minmax(0, 1fr) minmax(0, 1fr)')
    expect(knoepfe.gap).toBe('var(--wkr-abstand)')
    expect(regel('.wkr-bojen-weg').gap).toBe('var(--wkr-abstand)')
    // Die Zahl („✔ 5“, „3× = 15“) bricht nie mitten durch; der Stand bricht an Leerzeichen um, „höchstens 9×“ ist eine
    // eigene Zeile – bei 360 px ragt nichts über den Knopfrand (Prüfbefund 21.11.2026, S4); der Titel darf umbrechen (N3).
    expect(regel('.wkr-bojen-zahl')['white-space']).toBe('nowrap')
    expect(regel('.wkr-bojen-stand')['white-space']).toBe('normal')
    expect(regel('.wkr-bojen-stand')['flex-direction']).toBe('column')
    expect(regel('.wkr-bojen-stand')['font-size']).toBe('clamp(14px, 4.5vw, 18px)')
    expect(bojen).toMatch(/class="wkr-bojen-max"/)
    expect(regel('.wkr-bojen-titel')['min-width']).toBe('0')
  })

  it('Gesetzt = Haupt-Farben (Kontrast über die Tokens geprüft), Startnummer 80 px auf Bojen-Listen, Klassenwechsel-Band absolut', () => {
    const gesetzt = regel('.wkr-knopf.wkr-bojen-knopf--gesetzt')
    expect([gesetzt.background, gesetzt.color]).toEqual(['var(--wkr-haupt)', 'var(--wkr-haupt-text)'])
    expect(regel('.wkr-maske--bojen', true)['--wkr-startnr']).toBe('80px')
    const band = regel('.wkr-klassen-wechsel')
    expect([band.position, band.inset]).toEqual(['absolute', '100% 0 auto'])
    expect(regel('.wkr-karten-platz').position).toBe('relative')
  })

  it('Maske „Bild“ (Prüfbefunde 22.11.2026): Kreise nie kleiner als --wkr-ziel, Zeichnung nie höher als der freie Platz', () => {
    expect(regel('.wkr-bild')['--wkr-bild-kreis']).toBe('max(var(--wkr-ziel), var(--wkr-bild-treffer-groesse))')
    const kreis = regel('.wkr-knopf.wkr-bild-treffer')
    for (const k of ['width', 'height', 'min-width', 'min-height']) expect(kreis[k], k).toBe('var(--wkr-bild-kreis)')
    expect(regel('.wkr-bild-flaeche').padding).toBe('calc(var(--wkr-bild-kreis) / 2)')
    // Später als data-ziel='gross' und gleiche Spezifität – darum muss die Kreisregel selbst ≥ --wkr-ziel sein.
    expect(css.indexOf('.wkr-knopf.wkr-bild-treffer {')).toBeGreaterThan(css.indexOf(".wkr-knopf[data-ziel='gross'] {"))
    const hoehe = regel('.wkr-bild-svg > svg,\n.wkr-bild-schema')['max-height']
    expect(hoehe).toBe('max(var(--wkr-bild-min-hoehe), calc(100dvh - var(--wkr-bild-rest)))')
    const t = regel('.wkr-geraet')
    expect(px(t['--wkr-bild-rest'])).toBeGreaterThan(0)
    expect(px(t['--wkr-bild-min-hoehe'])).toBeGreaterThanOrEqual(200)
  })
})
