import { describe, expect, it } from 'vitest'
import { configFor, ROH_REGELWERKE } from '../config/konfig'
import { FAHRWEG } from '../config/kurzform'
import { CLASS_IDS } from '../domain/classes'
import { listenFelder } from '../lib/eingaben'
import { WKR_ANNAHMEN } from './annahmen'
import { BOJEN_LAGE, bojenHalt, bojenLage, katalogFolge, PARALLEL_FAHRWEG } from './bojen'
import { parcoursDateien, parcoursSvg } from '../lib/parcoursQuelle'

// Bojen auf dem Fahrweg (W4.1, Plan docs/plan-wkr-w4.md §4.1): jede Bojen-Kennung aller Positionen unter DM und UIM
// hat einen Halt, Knoten keinen; Tor 1 R zweimal (t1b, t1c); Tor 5 Zähler; Folge = FAHRWEG bzw. Parallel-Spalten.

const KONFIGS = [configFor({ regelwerk: 'dm-2026' }), configFor({ regelwerk: 'uim-2026' })]

/** Alle `buoy`-Kennungen jeder Position über alle Klassen. */
function bojenKennungen(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const k of KONFIGS)
    for (const p of k.getPositions())
      for (const klasse of CLASS_IDS) {
        if (!k.positionAllowsClass(p.typeId, klasse)) continue
        for (const f of listenFelder(k, p.typeId, klasse)) if (f.kind === 'buoy') out.set(p.typeId, (out.get(p.typeId) ?? new Set()).add(f.kennung))
      }
  return out
}

describe('bojenHalt', () => {
  it('jede Bojen-Kennung aller Positionen (DM, UIM) hat einen Halt – außer den Knoten', () => {
    const alle = bojenKennungen()
    expect(alle.size).toBeGreaterThan(15)
    for (const [typeId, kennungen] of alle)
      for (const kennung of kennungen) expect(bojenHalt(kennung) === null, `${typeId}: ${kennung}`).toBe(typeId === 'knoten')
  })

  it('Tor 1 auf der Rückfahrt: t1b und t1c zwei Halte, t1c zweite Durchfahrt nach Sp. 2', () => {
    const b = bojenHalt('t1b|rueck seiteA')!
    const c = bojenHalt('t1c|rueck seiteB')!
    expect([b.halt, b.weg, b.durchfahrt, b.zaehler]).toEqual(['t1b', 'rueck', undefined, false])
    expect([c.halt, c.weg, c.durchfahrt, c.seite]).toEqual(['t1c', 'rueck', 2, 'seiteB'])
    expect(c.folge).toBeGreaterThan(bojenHalt('speed2')!.folge)
    expect(b.folge).toBeLessThan(bojenHalt('speed1')!.folge)
  })

  it('Tor 5: Zähler, hin und rück getrennt; alle anderen Schalter; Speedbojen ohne Seite auf dem Rückweg', () => {
    const hin = bojenHalt('t5|hin seiteA')!
    const rueck = bojenHalt('t5|rueck seiteB')!
    expect([hin.halt, hin.weg, hin.zaehler, rueck.weg, rueck.zaehler]).toEqual(['t5', 'hin', true, 'rueck', true])
    expect(hin.folge).toBeLessThan(rueck.folge)
    for (const k of ['start|hin seiteA', 't1a|hin seiteB', 't4b|rueck seiteA', 'speed1', 'ziel|rueck seiteB', 'b5', 'start|seiteA']) expect(bojenHalt(k)!.zaehler, k).toBe(false)
    expect(bojenHalt('speed2')).toMatchObject({ seite: null, weg: 'rueck' })
  })

  it('Folge = Index im FAHRWEG; falsche Richtung, Katalog und Unbekanntes → null', () => {
    for (const [i, h] of FAHRWEG.entries()) {
      if (h.katalog) continue
      const kennung = h.speedboje ? h.key! : `${h.key}|${h.richtung} seiteA`
      expect(bojenHalt(kennung)?.folge, kennung).toBe(i)
    }
    for (const k of ['t1a|rueck seiteA', 't1a', 'speed1|hin seiteA', 'katalog:tor5', 'disq@gate135', 'webleinstek', 't1a|hin seiteC', 'b5|seiteA', 'start', 't1a|hin seiteA|x', '']) expect(bojenHalt(k), k).toBeNull()
  })

  it('Parallelslalom: Folge = Spalten von parallelparcours; Start bis Boje 5 Hinweg, Rest Rückweg', () => {
    for (const k of KONFIGS) {
      const keys = k.getSheetDef('parallelparcours').columns.filter((c) => c.kind === 'buoy').map((c) => c.key)
      expect(keys).toEqual([...PARALLEL_FAHRWEG])
    }
    expect(PARALLEL_FAHRWEG.map((key) => bojenHalt(key === 'start' || key === 'ziel' ? `${key}|seiteB` : key)!.weg)).toEqual(['hin', 'hin', 'hin', 'hin', 'hin', 'hin', 'rueck', 'rueck', 'rueck', 'rueck', 'rueck'])
    expect(bojenHalt('b3b')).toEqual({ halt: 'b3b', weg: 'rueck', seite: null, folge: 7, zaehler: false })
  })
})

describe('katalogFolge', () => {
  it('Einfahrt Tor 5 zwischen Tor 5 hin und rück (Hinweg), MüB nach Tor 1 R (Rückweg); sonst null', () => {
    const tor5 = katalogFolge('katalog:tor5')!
    expect(tor5.weg).toBe('hin')
    expect(tor5.folge).toBeGreaterThan(bojenHalt('t5|hin seiteA')!.folge)
    expect(tor5.folge).toBeLessThan(bojenHalt('t5|rueck seiteA')!.folge)
    const mueb = katalogFolge('katalog:mueb')!
    expect(mueb.weg).toBe('rueck')
    expect(mueb.folge).toBeGreaterThan(bojenHalt('t1b|rueck seiteA')!.folge)
    expect(mueb.folge).toBeLessThan(bojenHalt('t1c|rueck seiteA')!.folge)
    for (const k of ['katalog:stegAblegen', 'katalog:gibtsnicht', 't5|hin seiteA']) expect(katalogFolge(k), k).toBeNull()
  })
})

describe('Punkte je Berührung (P4)', () => {
  it('bojenPunkte = `direktpunkte` „Bojen“ (und DM „Tor 5“) beider Regelwerke', () => {
    for (const r of ROH_REGELWERKE) {
      const bojen = (r.direktpunkte ?? []).filter((d) => d.titel === 'Bojen' || d.titel === 'Tor 5')
      expect(bojen.length, r.id).toBeGreaterThan(0)
      for (const d of bojen) expect(d.punkte, `${r.id}: ${d.titel}`).toBe(WKR_ANNAHMEN.bojenPunkte)
    }
  })
})

/**
 * x-Koordinate eines Elements im Parcours-Bild: Summe der `translate` seiner Vorfahren plus der erste Punkt seines
 * Pfads (bzw. Kreises) – die Bilder tragen nur Verschiebungen um die Bojen (Drehungen nur an Texten).
 */
function xVon(svg: Document, id: string): number | null {
  const el = svg.getElementById(id)
  if (!el) return null
  const form = el.getAttribute('d') || el.getAttribute('cx') ? el : el.querySelector('path[d], ellipse[cx], circle[cx]')
  if (!form) return null
  let x = form.getAttribute('cx') ? Number(form.getAttribute('cx')) : Number(/m\s*([-\d.]+)/i.exec(form.getAttribute('d') ?? '')?.[1])
  for (let n: Element | null = form; n; n = n.parentElement) {
    const t = /translate\(\s*([-\d.]+)/.exec(n.getAttribute('transform') ?? '')
    if (t) x += Number(t[1])
  }
  return x
}

describe('bojenLage (Nutzer 21.11.2026, V1: wie der Parcours liegt)', () => {
  it('jeder Halt des Fahrwegs und des Parallelslaloms hat einen Platz; hin und rück am selben Platz', () => {
    for (const h of FAHRWEG) expect(bojenLage(h.katalog ? `katalog:${h.katalog}` : h.key!), h.name).not.toBeNull()
    for (const k of PARALLEL_FAHRWEG) expect(bojenLage(k), k).not.toBeNull()
    expect(bojenLage('t1a')).toBe(bojenLage('t1c'))
    expect(bojenLage('b3a')).toBe(bojenLage('b3b'))
    expect(bojenLage('webleinstek')).toBeNull()
    expect(bojenLage('toString')).toBeNull()
  })

  it('Folge der Plätze = Lage im Parcours-Bild (x-Koordinaten, alle Bilder): Start/Ziel, Schikane, Tor 1 … Tor 5, Speedbojen', () => {
    const ORTE: [string, string][] = [
      ['StartZiel_oben', 'start'],
      ['Schikane', 'katalog:mueb'],
      ['Tor1_innen', 't1a'],
      ['Tor2_innen', 't2a'],
      ['Tor3_innen', 't3a'],
      ['Tor4_innen', 't4a'],
      ['Tor5_oben', 't5'],
      ['Speedboje_oben', 'speed1'],
      ['Speedboje_unten', 'speed2'],
    ]
    const dateien = parcoursDateien()
    expect(dateien.length).toBeGreaterThan(5)
    for (const datei of dateien) {
      const svg = new DOMParser().parseFromString(parcoursSvg(datei)!, 'image/svg+xml')
      const gemessen = ORTE.map(([id, halt]) => ({ halt, x: xVon(svg, id) })).filter((o): o is { halt: string; x: number } => o.x !== null && !Number.isNaN(o.x))
      expect(gemessen.length, datei).toBeGreaterThanOrEqual(8)
      for (const a of gemessen)
        for (const b of gemessen) {
          // Gleicher Platz ⇔ fast gleiche x (die Speedbojen liegen über und unter der Strecke, ±5).
          if (BOJEN_LAGE[a.halt] === BOJEN_LAGE[b.halt]) expect(Math.abs(a.x - b.x), `${datei}: ${a.halt}/${b.halt}`).toBeLessThan(5)
          else expect(Math.sign(a.x - b.x), `${datei}: ${a.halt}/${b.halt}`).toBe(Math.sign(BOJEN_LAGE[a.halt] - BOJEN_LAGE[b.halt]))
        }
    }
  })
})
