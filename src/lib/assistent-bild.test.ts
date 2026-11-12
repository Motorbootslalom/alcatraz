import { describe, expect, it } from 'vitest'
import {
  AUFGABEN_FELDER,
  BILD_BOJEN,
  bojenAufLinie,
  feldName,
  feldUmschalten,
  leererEntwurf,
  spaltenFarbe,
  SPALTEN_FARBEN,
  trifft,
  zuordnen,
  type Entwurf,
  type Punkt,
} from './assistent'

// Zuordnen im Parcoursbild mit einer Freihandlinie (KONZEPT-NAMEN-FREIHAND.md §2).

const quadrat: Punkt[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]

function mitSpalten(): Entwurf {
  return { ...leererEntwurf('e', 'E'), spalten: [{ id: 'a', titel: 'A' }, { id: 'b', titel: 'B' }] }
}

describe('Freihandlinie', () => {
  it('kennt die 14 Bojen aus dem Bild und die drei Aufgaben ohne Boje', () => {
    expect(BILD_BOJEN).toHaveLength(14)
    expect(BILD_BOJEN).toContain('Tor1_innen')
    expect(BILD_BOJEN).toContain('Speedboje_unten')
    expect(AUFGABEN_FELDER.map((a) => a.id)).toEqual(['tor5', 'mueb', 'parcours'])
  })

  it('trifft, was die Linie umkreist, auch wenn sie nicht ganz geschlossen ist', () => {
    expect(trifft({ x: 50, y: 50 }, quadrat, 5)).toBe(true)
    expect(trifft({ x: 150, y: 50 }, quadrat, 5)).toBe(false)
  })

  it('trifft, was die Linie überstreicht, mit Toleranz', () => {
    const strich: Punkt[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    expect(trifft({ x: 50, y: 4 }, strich, 5)).toBe(true)
    expect(trifft({ x: 50, y: 6 }, strich, 5)).toBe(false)
    expect(trifft({ x: 104, y: 0 }, strich, 5)).toBe(true)
    expect(trifft({ x: 3, y: 3 }, [{ x: 0, y: 0 }], 5)).toBe(true)
    expect(trifft({ x: 3, y: 3 }, [], 5)).toBe(false)
  })

  it('liefert die getroffenen Bojen; fehlt eine im Bild, zählt sie nicht', () => {
    const mitten = { Tor1_innen: { x: 10, y: 10 }, Tor1_aussen: { x: 10, y: 90 }, Tor2_innen: { x: 300, y: 10 } }
    expect(bojenAufLinie(mitten, quadrat, 5)).toEqual(['Tor1_aussen', 'Tor1_innen'])
  })

  it('hängt Bojen zur gewählten Position um, statt sie doppelt zu führen', () => {
    let e = zuordnen(mitSpalten(), ['Tor1_innen', 'Tor1_aussen'], 'a')
    e = zuordnen(e, ['Tor1_aussen', 'Tor2_innen'], 'b')
    expect(e.zuordnung.Tor1_innen).toEqual(['a'])
    expect(e.zuordnung.Tor1_aussen).toEqual(['b'])
    expect(e.zuordnung.Tor2_innen).toEqual(['b'])
    expect(zuordnen(e, [], 'a')).toBe(e)
  })

  it('schaltet einzelne Bojen und Aufgaben an und aus, ohne andere Spalten anzufassen', () => {
    let e = zuordnen(mitSpalten(), ['Tor1_innen'], 'a')
    e = feldUmschalten(e, 'Tor1_innen', 'b')
    expect(e.zuordnung.Tor1_innen).toEqual(['a', 'b'])
    e = feldUmschalten(e, 'Tor1_innen', 'a')
    expect(e.zuordnung.Tor1_innen).toEqual(['b'])
    e = feldUmschalten(feldUmschalten(e, 'mueb', 'a'), 'Speedboje_oben', 'a')
    expect(e.zuordnung.mueb).toEqual(['a'])
    expect(e.zuordnung.Speedboje_oben).toEqual(['a'])
    expect(feldUmschalten(e, 'gibtsnicht', 'a')).toBe(e)
  })

  it('benennt Felder und färbt Spalten der Reihe nach', () => {
    expect(feldName('Tor1_aussen')).toBe('Tor 1 rechts · außen')
    expect(feldName('Speedboje_unten')).toBe('Speed 2 (Tonne 8)')
    const e = mitSpalten()
    expect(spaltenFarbe(e, 'a')).toBe(SPALTEN_FARBEN[0])
    expect(spaltenFarbe(e, 'b')).toBe(SPALTEN_FARBEN[1])
  })
})
