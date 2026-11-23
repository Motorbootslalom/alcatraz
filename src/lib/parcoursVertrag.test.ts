import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PARCOURS_HERKUNFT, parcoursDateien, parcoursSvg } from './parcoursQuelle'
import {
  BEARBEITUNGSVERMERK_PARALLEL,
  ERWARTETE_LIZENZ,
  machParallel,
  metadaten,
  normalisiere,
  PARALLEL_BAHN,
  PARALLEL_DATEI,
  PARALLEL_PFLICHT_IDS,
  PARALLEL_QUELLE,
  parallelBefunde,
  parallelBojeId,
  parallelStartId,
} from './parcoursVertrag'

// Parallelslalom-Zeichnung (R8-19, 22.11.2026; seit 23.11.2026 nach R9-05 bis R9-07 eine Bahn ohne Steg, IDs aus dem
// Parcours-Repository; WKR_ANNAHMEN BD8–BD10): Der Sync übernimmt die Eine-Bahn-Ausgabe und prüft nur noch – keine
// Zuordnung nach Lage mehr. Am Original nur, wenn das Parcours-Repository als Nachbarordner liegt (wie beim Sync); am
// Asset immer.

const QUELLE = join(process.cwd(), '..', 'Parcours', PARALLEL_QUELLE.ordner, PARALLEL_QUELLE.datei)
const mitQuelle = existsSync(QUELLE)

describe('Parallel.svg (eingecheckt)', () => {
  const svg = parcoursSvg(PARALLEL_DATEI)!

  it('ist gebündelt, aber keine Klassen-Zeichnung', () => {
    expect(svg).toBeDefined()
    expect(parcoursDateien()).not.toContain(PARALLEL_DATEI)
  })

  it('trägt die IDs des Parcours-Repositorys: Bojen 1–5 und Start/Ziel oben/unten, je genau einmal', () => {
    expect(parallelBefunde(svg)).toEqual([])
    expect(PARALLEL_BAHN).toBe('A')
    expect(PARALLEL_PFLICHT_IDS).toEqual(['A_Boje1', 'A_Boje2', 'A_Boje3', 'A_Boje4', 'A_Boje5', 'A_StartZiel_unten', 'A_StartZiel_oben'])
    for (const id of PARALLEL_PFLICHT_IDS) expect(svg.split(`id="${id}"`).length - 1, id).toBe(1)
    // seiteA = die untere Boje im Bild, wie bei den Klassen-Zeichnungen (config/kurzform.ts SEITE).
    expect(parallelStartId('seiteA')).toBe('A_StartZiel_unten')
    expect(parallelStartId('seiteB')).toBe('A_StartZiel_oben')
    expect(parallelBojeId(3)).toBe('A_Boje3')
  })

  it('zeigt nur eine Bahn: keine zweite Bahn, kein Steg, keine Maße, kein Titel (R9-06, R9-07)', () => {
    expect(svg).not.toMatch(/id="B_/)
    expect(svg).not.toMatch(/Steg|abmessung|Abmessung|id="Titel"|id="Beschreibung"/)
    // Auch keine IDs aus der Zeit der Zuordnung nach Lage und keine Tor-IDs des Manövrierparcours (bild.ts sähe Klassen-Bojen).
    expect(svg).not.toMatch(/id="P_|id="Tor\d/)
    expect(svg).not.toMatch(/<image|<script|<foreignObject|LogoEN|sodipodi:|inkscape:|Export_Area/)
    expect(new TextEncoder().encode(svg).length).toBeLessThan(20 * 1024)
    // Zugeschnitten auf die Bahn: breit und flach (Parcours: A_Export_Area 765 × 182).
    expect(svg).toMatch(/<svg\b[^>]*\bviewBox="0 0 765 182"/)
  })

  it('ist durch den Sync gelaufen: Vermerk genau einmal, Namensnennung in den Metadaten', () => {
    expect(normalisiere(svg, BEARBEITUNGSVERMERK_PARALLEL)).toBe(svg)
    expect(machParallel(svg)).toEqual({ text: svg, fehler: [] })
    expect(svg.split(`<dc:description>${BEARBEITUNGSVERMERK_PARALLEL}</dc:description>`).length - 1).toBe(1)
    expect(metadaten(svg)).toMatchObject({ urheber: PARCOURS_HERKUNFT.urheber })
    expect(metadaten(svg).lizenzUrl.replace(/^https?:\/\//, '')).toBe(ERWARTETE_LIZENZ.url.replace(/^https?:\/\//, ''))
    expect(BEARBEITUNGSVERMERK_PARALLEL).toContain('bearbeitet')
    expect(BEARBEITUNGSVERMERK_PARALLEL).toContain(ERWARTETE_LIZENZ.name)
  })

  it('QUELLE.json nennt die Parallel-Quelle (derselbe Commit, Ordner der Eine-Bahn-Ausgabe)', () => {
    expect(PARALLEL_QUELLE.ordner).toBe('dist/parallel/alcatraz_Parcours')
    expect(PARCOURS_HERKUNFT.parallel).toMatchObject({
      ordner: PARALLEL_QUELLE.ordner,
      quelle: PARALLEL_QUELLE.datei,
      urheber: PARCOURS_HERKUNFT.urheber,
      dateien: [`${PARALLEL_DATEI}.svg`],
    })
  })
})

describe.skipIf(!mitQuelle)('Parallel-Zeichnung am Original (../Parcours)', () => {
  const roh = mitQuelle ? readFileSync(QUELLE, 'utf8') : ''

  it('das eingecheckte Asset ist genau das, was der Sync heute daraus macht', () => {
    const r = machParallel(roh)
    expect(r.fehler).toEqual([])
    expect(r.text).toBe(parcoursSvg(PARALLEL_DATEI))
    // Die Pflicht-IDs stehen schon in der Quelle – der Sync benennt nichts um (R9-05).
    for (const id of PARALLEL_PFLICHT_IDS) expect(roh.split(`id="${id}"`).length - 1, id).toBe(1)
  })

  it('bricht mit klarer Meldung ab, wenn eine Pflicht-ID fehlt oder doppelt ist', () => {
    const ohne = machParallel(roh.replace('id="A_Boje3"', 'id="weg"'))
    expect(ohne.fehler).toContain('A_Boje3 fehlt')
    // … und sagt, woher die IDs kommen müssen.
    expect(ohne.fehler.at(-1)).toMatch(/Pflicht-IDs der Eine-Bahn-Ausgabe: A_Boje1, .*A_StartZiel_oben – sie vergibt das Parcours-Repository/)
    const doppelt = machParallel(roh.replace('</svg>', '<path id="A_StartZiel_unten" d="m 10,10 z"/></svg>'))
    expect(doppelt.fehler).toContain('A_StartZiel_unten steht 2-mal')
  })
})

describe('Parallel-Befunde', () => {
  const svg = parcoursSvg(PARALLEL_DATEI)!

  it('meldet Rasterbild, fehlende und doppelte IDs', () => {
    expect(parallelBefunde(svg.replace('</svg>', '<image href="data:x"/></svg>'))).toContain('enthält ein Rasterbild (<image)')
    expect(parallelBefunde(svg.replace('id="A_Boje2"', 'id="x"'))).toContain('A_Boje2 fehlt')
    expect(parallelBefunde(svg.replace('</svg>', '<path id="A_Boje1"/></svg>'))).toContain('A_Boje1 steht 2-mal')
  })

  it('meldet die zweite Bahn und den Steg (R9-06: „nur einer der zwei Parcours und ohne Steg“)', () => {
    const zwei = parallelBefunde(svg.replace('</svg>', '<path id="B_Boje1" d="m 10,10 z"/><path id="B_Boje2" d="m 10,10 z"/></svg>'))
    expect(zwei).toContain('enthält die zweite Bahn (B_Boje1, B_Boje2) – erwartet ist nur eine')
    expect(parallelBefunde(svg.replace('</svg>', '<g id="A_Steg"/></svg>'))).toContain('enthält A_Steg – erwartet ist eine Bahn ohne Steg und Maße')
  })

  it('meldet eine Boje außerhalb des Bilds', () => {
    const weit = svg.replace(/(d="\s*m\s*)([-\d.]+)([^"]*"\s*id="A_Boje5")/, (_, a: string, x: string, b: string) => `${a}${Number(x) + 900}${b}`)
    expect(weit).not.toBe(svg)
    expect(parallelBefunde(weit)).toEqual(['A_Boje5 liegt außerhalb des Ausschnitts'])
    // Der Sync meldet die Lage, aber nicht, die IDs müssten im Parcours-Repository vergeben werden – die stimmen ja
    // (Prüfbefund 23.11.2026: der Hinweis hing an jedem Befund, der mit einer Pflicht-ID beginnt).
    expect(machParallel(weit).fehler).toEqual(['A_Boje5 liegt außerhalb des Ausschnitts'])
  })

  it('machParallel nennt die Herkunft der IDs nur, wenn eine fehlt oder doppelt ist (auch ohne ../Parcours geprüft)', () => {
    const hinweis = /^Pflicht-IDs der Eine-Bahn-Ausgabe: /
    const ohne = machParallel(svg.replace('id="A_Boje4"', 'id="x"')).fehler
    expect(ohne).toContain('A_Boje4 fehlt')
    expect(ohne.filter((f) => hinweis.test(f))).toHaveLength(1)
    expect(machParallel(svg.replace('</svg>', '<path id="A_Boje1"/></svg>')).fehler.some((f) => hinweis.test(f))).toBe(true)
    // Andere Befunde, auch solche mit „A_…“ vorn, bleiben ohne den Hinweis.
    expect(machParallel(svg.replace('</svg>', '<g id="A_Steg"/></svg>')).fehler).toEqual(['enthält A_Steg – erwartet ist eine Bahn ohne Steg und Maße'])
  })
})
