import { describe, expect, it } from 'vitest'
import { buildConfig } from '../config/build'
import { kurzformPosition } from '../config/kurzform'
import { validateRawConfig } from '../config/validate'
import { bildSvg, bildVorgabe, deriveDimSet, DIM_UNIVERSE, ohneRahmen, RAHMEN_ID, ZIFFERN_IDS } from './parcoursbild'

const QUELLE = '<svg width="2"><path id="rect4816" d="M0"/><g id="Tor1"/><g id="Tor2"/><text id="Nummer_Tor1">1</text></svg>'

describe('Parcoursbild aus der Quelle', () => {
  it('entfernt den Rahmen, blendet ab und blendet bei kleinen Bildern die Ziffern aus', () => {
    const { svg, fehlend } = bildSvg(QUELLE, { dim: ['Tor2'], aus: ['Nummer_Tor1'] })
    expect(svg).toBe(
      '<svg width="2"><style>#Tor2{opacity:0.2!important}#Nummer_Tor1{opacity:0!important}</style>' +
        '<g id="Tor1"/><g id="Tor2"/><text id="Nummer_Tor1">1</text></svg>',
    )
    expect(fehlend).toEqual([])
  })

  it('lässt das Bild ohne Vorgabe bis auf den Rahmen, wie es ist', () => {
    expect(bildSvg(QUELLE, { dim: [], aus: [] }).svg).toBe('<svg width="2"><g id="Tor1"/><g id="Tor2"/><text id="Nummer_Tor1">1</text></svg>')
  })

  it('nennt fehlende IDs, nur die optionalen nicht, und lässt nichts Fremdes in die Stilregeln', () => {
    const { svg, fehlend } = bildSvg(QUELLE, { dim: ['Tor9', 'Speedboje_unten', 'Tor1}*{display:none'], aus: ['Nummer_Speedboje_unten'] })
    expect(fehlend).toEqual(['Tor9', 'Tor1}*{display:none'])
    expect(svg).not.toContain('<style>')
  })

  it('eine ID in beiden Listen wird ausgeblendet, das Ergebnis bleibt gültig', () => {
    const { svg } = bildSvg(QUELLE, { dim: ['Tor1'], aus: ['Tor1'] })
    expect(svg).toContain('<style>#Tor1{opacity:0.2!important}#Tor1{opacity:0!important}</style>')
    expect(svg.match(/id="Tor1"/g)).toHaveLength(1)
  })

  it('leitet die Vorgabe aus der Position ab', () => {
    const neben = bildVorgabe({ bildNeben: true, abblenden: ['Tor2', 'Nummer_Tor1'], bildQuelle: 'eigen' })
    expect(neben).toEqual({ quelle: 'eigen', dim: ['Tor2'], aus: [...ZIFFERN_IDS] })
    expect(bildVorgabe({ abblenden: ['Tor3', 'Tor1'] })).toEqual({ quelle: 'alcatraz_Parcours', dim: ['Tor1', 'Tor3'], aus: [] })
  })
})

describe('Bild im Browser (bildImBrowser)', () => {
  const position = kurzformPosition({ id: 'eigen', titel: 'Eigen', blick: 'links', bojen: ['Tor2'], bildImBrowser: true })

  it('braucht keinen Bildordner und nimmt das Quellbild', () => {
    expect(position.bild).toBeUndefined()
    expect(validateRawConfig({ positionen: [position] }).map((i) => i.code)).not.toContain('MISSING_BILD')
    const def = buildConfig({ positionen: [position] }).positions[0]
    expect(def.courseImageDir).toBe('alcatraz_Parcours')
    expect(def.bildErzeugen?.dim).toEqual(bildVorgabe(position).dim)
    expect(def.bildErzeugen?.dim).toContain('Tor1')
  })
})

// Aus scripts/generate-parcours.test.ts des Fehlerpunkte-Prototyps: Dort erzeugt ein Skript
// die Bilder beim Bauen, hier der Browser – abgeleitet wird mit denselben Funktionen.
describe('deriveDimSet', () => {
  it('leitet aus Spalten-`hebt` die Gegenmenge des DIM_UNIVERSE ab', () => {
    // Tore 1/3/5 hervorgehoben → 2/4 abgeblendet; ein Duplikat schadet nicht.
    const pos = { spalten: [{ hebt: 'Tor1' }, { hebt: 'Tor3' }, { hebt: 'Tor5' }, { hebt: 'Tor1' }, {}] }
    expect(deriveDimSet(pos).sort()).toEqual(['Tor2', 'Tor4'])
  })

  it('nutzt `abblenden` als Fallback, wenn keine Spalte `hebt` setzt', () => {
    expect(deriveDimSet({ abblenden: ['Tor1', 'Tor3'], spalten: [{}, {}] }).sort()).toEqual(['Tor1', 'Tor3'])
  })

  it('vereint `abblenden` mit der aus `hebt` abgeleiteten Menge', () => {
    // Tore 2/4/5 hell → 1/3 gedimmt; zusätzlich Speedboje_unten aus `abblenden`.
    const pos = { abblenden: ['Speedboje_unten'], spalten: [{ hebt: 'Tor2' }, { hebt: 'Tor4' }, { hebt: 'Tor5' }] }
    expect(deriveDimSet(pos).sort()).toEqual(['Speedboje_unten', 'Tor1', 'Tor3'])
  })

  it('gibt nichts zurück, wenn weder `hebt` noch `abblenden` gesetzt sind', () => {
    expect(deriveDimSet({ spalten: [{}, {}] })).toEqual([])
  })

  it('blendet bei vollständiger Hervorhebung nichts ab', () => {
    expect(deriveDimSet({ spalten: DIM_UNIVERSE.map((g) => ({ hebt: g })) })).toEqual([])
  })
})

describe('ohneRahmen', () => {
  it('entfernt genau den Rahmen und lässt den Rest unverändert', () => {
    const rest = '<g id="Export_Area"><path id="davor" d="m 0,0" />XX<path id="danach" /></g>'
    const rahmen = `<path\n style="stroke:#000080"\n d="m 1,2 z"\n id="${RAHMEN_ID}" />`
    expect(ohneRahmen(rest.replace('XX', rahmen))).toBe(rest.replace('XX', ''))
  })

  it('ändert nichts, wenn es keinen Rahmen gibt', () => {
    const svg = '<svg><path id="anderer" /></svg>'
    expect(ohneRahmen(svg)).toBe(svg)
  })
})
