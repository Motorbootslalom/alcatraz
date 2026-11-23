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
  PARALLEL_AUSSCHNITT,
  PARALLEL_DATEI,
  PARALLEL_PFLICHT_IDS,
  PARALLEL_QUELLE,
  parallelBefunde,
  parallelZuordnung,
} from './parcoursVertrag'

// Parallelslalom-Zeichnung (R8-19, Plan docs/plan-antworten-runde7-8.md §5, 22.11.2026; WKR_ANNAHMEN BD8, BD9): Der Sync
// holt sie aus dem Parcours-Repository, verkleinert sie und setzt IDs je Bahn über die Lage – ohne Änderung dort.
// Am Original nur, wenn das Parcours-Repository als Nachbarordner liegt (wie beim Sync); am Asset immer.

const QUELLE = join(process.cwd(), '..', 'Parcours', PARALLEL_QUELLE.ordner, PARALLEL_QUELLE.datei)
const mitQuelle = existsSync(QUELLE)

describe('Parallel.svg (eingecheckt)', () => {
  const svg = parcoursSvg(PARALLEL_DATEI)!

  it('ist gebündelt, aber keine Klassen-Zeichnung', () => {
    expect(svg).toBeDefined()
    expect(parcoursDateien()).not.toContain(PARALLEL_DATEI)
  })

  it('trägt je Bahn genau die IDs b1–b5 und Start/Ziel A/B, ohne Rasterbild, klein', () => {
    expect(parallelBefunde(svg)).toEqual([])
    expect(PARALLEL_PFLICHT_IDS).toHaveLength(14)
    for (const id of PARALLEL_PFLICHT_IDS) expect(svg.split(`id="${id}"`).length - 1, id).toBe(1)
    // Die Tor-IDs des Manövrierparcours sind umbenannt – sonst sähe bild.ts dort Klassen-Bojen.
    expect(svg).not.toMatch(/id="Tor\d_(innen|aussen|oben|unten)"/)
    expect(svg).not.toMatch(/<image|<script|<foreignObject|LogoEN|sodipodi:|inkscape:/)
    expect(new TextEncoder().encode(svg).length).toBeLessThan(60 * 1024)
    expect(svg).toContain(`viewBox="${PARALLEL_AUSSCHNITT.x} ${PARALLEL_AUSSCHNITT.y} ${PARALLEL_AUSSCHNITT.breite} ${PARALLEL_AUSSCHNITT.hoehe}"`)
  })

  it('ist durch den Sync gelaufen: Vermerk genau einmal, Namensnennung in den Metadaten', () => {
    expect(normalisiere(svg, BEARBEITUNGSVERMERK_PARALLEL)).toBe(svg)
    expect(svg.split(`<dc:description>${BEARBEITUNGSVERMERK_PARALLEL}</dc:description>`).length - 1).toBe(1)
    expect(metadaten(svg)).toMatchObject({ urheber: PARCOURS_HERKUNFT.urheber })
    expect(metadaten(svg).lizenzUrl.replace(/^https?:\/\//, '')).toBe(ERWARTETE_LIZENZ.url.replace(/^https?:\/\//, ''))
    expect(BEARBEITUNGSVERMERK_PARALLEL).toContain('bearbeitet')
    expect(BEARBEITUNGSVERMERK_PARALLEL).toContain(ERWARTETE_LIZENZ.name)
  })

  it('QUELLE.json nennt die Parallel-Quelle (derselbe Commit, anderer Ordner)', () => {
    expect(PARCOURS_HERKUNFT.parallel).toMatchObject({
      ordner: PARALLEL_QUELLE.ordner,
      quelle: PARALLEL_QUELLE.datei,
      urheber: PARCOURS_HERKUNFT.urheber,
      dateien: [`${PARALLEL_DATEI}.svg`],
    })
  })
})

describe.skipIf(!mitQuelle)('Parallel-Zuordnung am Original (../Parcours)', () => {
  const roh = mitQuelle ? readFileSync(QUELLE, 'utf8') : ''

  it('untere Bahn über die Tor-IDs, obere über gleiches x; Start/Ziel-Kreise über die Gruppen; A = obere Bahn (BD9)', () => {
    const { zuordnung, fehler } = parallelZuordnung(roh)
    expect(fehler).toEqual([])
    // Vom Steg aus in Fahrtrichtung (Start → Boje 5, nach rechts) liegt die obere Bahn links.
    expect(zuordnung!.bahnA).toBe('oben')
    expect(zuordnung!.ids).toMatchObject({
      Tor1_aussen: 'P_B_b1',
      Tor2_innen: 'P_B_b2',
      Tor3_aussen: 'P_B_b3',
      Tor4_innen: 'P_B_b4',
      Tor5_unten: 'P_B_b5',
      path17530: 'P_A_b1',
      path17538: 'P_A_b5',
      // seiteA = die untere Boje im Bild (config/kurzform.ts SEITE).
      g13172: 'P_B_start_seiteA',
      g13156: 'P_B_start_seiteB',
      g17526: 'P_A_start_seiteA',
      g17522: 'P_A_start_seiteB',
    })
  })

  it('das eingecheckte Asset ist genau das, was der Sync heute daraus macht', () => {
    const r = machParallel(roh)
    expect(r.fehler).toEqual([])
    expect(new TextEncoder().encode(roh).length).toBeGreaterThan(400 * 1024)
    expect(r.text).toBe(parcoursSvg(PARALLEL_DATEI))
  })

  it('bricht ab, wenn eine Boje fehlt oder doppelt ist', () => {
    expect(machParallel(roh.replace('id="Tor3_aussen"', 'id="weg"')).fehler.join()).toContain('Tor3_aussen')
    const doppelt = roh.replace('id="path17534"', 'id="path17534"/><path d="m 687.39644,600 c 1,1 1,1 1,1 z" id="extra"')
    expect(machParallel(doppelt).zuordnung).toBeNull()
  })
})

describe('Parallel-Befunde', () => {
  it('meldet Rasterbild, fehlende und doppelte IDs', () => {
    const svg = parcoursSvg(PARALLEL_DATEI)!
    expect(parallelBefunde(svg.replace('</svg>', '<image href="data:x"/></svg>'))).toContain('enthält ein Rasterbild (<image)')
    expect(parallelBefunde(svg.replace('id="P_A_b2"', 'id="x"'))).toContain('P_A_b2 fehlt')
    expect(parallelBefunde(svg.replace('</svg>', '<path id="P_B_b1"/></svg>'))).toContain('P_B_b1 steht 2-mal')
  })
})
