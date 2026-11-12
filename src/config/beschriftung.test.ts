import { describe, expect, it } from 'vitest'
import { configFor } from './konfig'

// Die Tests stammen aus dem Prototyp, wo das Schema ein Modulzustand war. Hier wählt
// `applyBeschriftung` nur, mit welcher Auswahl die folgenden Abfragen rechnen.
let konfig = configFor()
const applyBeschriftung = (id: string) => {
  konfig = configFor({ beschriftung: id })
}
const getSheetDef = (id: string) => konfig.getSheetDef(id)
const getBeschriftungen = () => konfig.getBeschriftungen()

/** Alle Unter-Spalten-Beschriftungen einer Position als ein String. */
function subText(id: string): string {
  return getSheetDef(id)
    .columns.flatMap((c) => c.sub ?? [])
    .join(' ')
}

/** Unter-Spalten einer bestimmten Spalte. */
function colSub(posId: string, key: string): string[] | undefined {
  return getSheetDef(posId).columns.find((c) => c.key === key)?.sub
}

describe('Bezeichnungs-Schemata (live umschaltbar)', () => {
  it('Innen/Außen gilt auch in Berlin: Tor 1/3 innen = seiteB, Tor 2/4 innen = seiteA', () => {
    applyBeschriftung('ia')
    expect(colSub('brechts', 't1a')).toEqual(['H A', 'H I'])
    expect(colSub('brechts', 't3b')).toEqual(['R A', 'R I'])
    expect(colSub('blinks', 't2a')).toEqual(['H I', 'H A'])
    expect(colSub('blinks', 't4b')).toEqual(['R I', 'R A'])
    // Tor 5 und Start/Ziel bleiben bei R/L.
    expect(colSub('blinks', 't5a')).toEqual(['H R', 'H L'])
    expect(colSub('blinks', 't5b')).toEqual(['R R', 'R L'])
    expect(colSub('bstartziel', 'start')).toEqual(['H R', 'H L'])
  })

  it('liefert die konfigurierten Schemata', () => {
    expect(getBeschriftungen().map((b) => b.id)).toEqual(['rl', 'ls', 'sl', 'kh', 'pfeile', 'ia'])
  })

  it('Pfeile zeigen in Alcatraz und Frontal dieselbe Bildrichtung (andere Boje)', () => {
    applyBeschriftung('pfeile')
    // Räumliches Schema: Pfeile zeigen die Bildrichtung. Alcatraz (von hinten)
    // wird gespiegelt, damit beide Aufbauten gleich aussehen (← dann →) -
    // auch wenn die linke Spalte je Aufbau eine andere Boje meint.
    expect(colSub('gate135', 't1a')).toEqual(['H ←', 'H →']) // Alcatraz: seiteA=Rechts links im Bild
    expect(colSub('frontal135', 't1a')).toEqual(['H ←', 'H →']) // Frontal: seiteB=Links links im Bild
    // Einzelne Boje (Tor 5 = dieselbe Boje hin+zurück): gleicher Pfeil
    expect(colSub('gate135', 't5')).toEqual(['H ←', 'R ←'])
    expect(colSub('gate135', 'start')).toEqual(['H ←'])
  })

  it('Standard Rechts/Links: Tor-Spalten tragen R und L', () => {
    applyBeschriftung('rl')
    const t = subText('gate135')
    expect(t).toMatch(/\bR\b/)
    expect(t).toMatch(/\bL\b/)
  })

  it('Umschalten auf Land/See beschriftet die Bojen-Seiten neu (L/S)', () => {
    applyBeschriftung('ls')
    // seiteA → L (Land), seiteB → S (See); Fahrtrichtung bleibt H/R
    expect(colSub('gate135', 't1a')).toEqual(['H L', 'H S'])
  })

  it('Umschalten auf Kai/Hafen (K/H) - K erscheint, S verschwindet', () => {
    applyBeschriftung('kh')
    const t = subText('gate135')
    expect(t).toMatch(/\bK\b/)
    expect(t).not.toMatch(/\bS\b/)
  })

  it('Innen/Außen ist tor-relativ und je Blickrichtung gespiegelt', () => {
    applyBeschriftung('ia')
    // Alcatraz (Blick von hinten): Tor 1 = Außen/Innen, Tor 2 = Innen/Außen
    expect(colSub('gate135', 't1a')).toEqual(['H A', 'H I'])
    expect(colSub('gate135', 't3b')).toEqual(['R A', 'R I'])
    expect(colSub('gate245', 't2a')).toEqual(['H I', 'H A'])
    // Frontal (Blick vom Start/Ziel): gespiegelt → Tor 1 = Innen/Außen
    expect(colSub('frontal135', 't1a')).toEqual(['H I', 'H A'])
    expect(colSub('frontal245', 't2a')).toEqual(['H A', 'H I'])
    // Tor 5, Start, Ziel bleiben physisch (Rechts/Links); Rück = R
    expect(colSub('gate135', 't5')).toEqual(['H R', 'R R'])
    expect(colSub('gate135', 'start')).toEqual(['H R'])
  })

  it('Legendenhinweis erklärt I/A nur im Innen/Außen-Schema (ohne Leerzeilen)', () => {
    applyBeschriftung('rl')
    expect(getSheetDef('gate135').legendNote ?? '').not.toContain('Innen')
    applyBeschriftung('ia')
    const note = getSheetDef('gate135').legendNote ?? ''
    expect(note).toContain('I = Innen')
    expect(note).toContain('A = Außen')
    expect(note.split('\n').some((l) => l.trim() === '')).toBe(false) // keine Leerzeilen
  })
})
