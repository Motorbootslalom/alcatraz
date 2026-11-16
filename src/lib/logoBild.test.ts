import { describe, expect, it } from 'vitest'
import { LogoFehler, svgFuerZiel, svgMasse } from './logoBild'

// Maße eines SVG-Logos und das SVG vor dem Rastern (16.11.2026). verkleinereLogo braucht Canvas und ist nur
// im Browser geprüft.

const svg = (attribute: string) => `<svg xmlns="http://www.w3.org/2000/svg" ${attribute}><rect width="10" height="10"/></svg>`

/** Die Wurzel des vorbereiteten SVG neu gelesen: width, height, viewBox – und die gemeldeten Zielmaße. */
function wurzel(v: { svg: string; breite: number; hoehe: number }) {
  const el = new DOMParser().parseFromString(v.svg, 'image/svg+xml').documentElement
  const attrs = { width: el.getAttribute('width') ?? '', height: el.getAttribute('height') ?? '', viewBox: el.getAttribute('viewBox') ?? '' }
  expect(el.querySelector('rect')).not.toBeNull()
  return { attrs, ziel: { breite: v.breite, hoehe: v.hoehe } }
}

describe('svgMasse', () => {
  it('width und height in px oder ohne Einheit', () => {
    expect(svgMasse(svg('width="40" height="20"'))).toEqual({ breite: 40, hoehe: 20 })
    expect(svgMasse(svg('width="40px" height="20px" viewBox="0 0 4 1"'))).toEqual({ breite: 40, hoehe: 20 })
  })

  it('andere Einheiten bei 96 dpi', () => {
    const m = svgMasse(svg('width="25.4mm" height="1in"'))
    expect(m?.breite).toBeCloseTo(96)
    expect(m?.hoehe).toBeCloseTo(96)
    expect(svgMasse(svg('width="72pt" height="2.54cm"'))).toEqual({ breite: 96, hoehe: expect.closeTo(96) })
  })

  it('% oder fehlende Angaben: die viewBox; fehlt nur eins, gilt ihr Seitenverhältnis', () => {
    expect(svgMasse(svg('width="100%" height="100%" viewBox="0 0 900 600"'))).toEqual({ breite: 900, hoehe: 600 })
    expect(svgMasse(svg('viewBox="0,0,30,10"'))).toEqual({ breite: 30, hoehe: 10 })
    expect(svgMasse(svg('width="60" viewBox="0 0 30 10"'))).toEqual({ breite: 60, hoehe: 20 })
    expect(svgMasse(svg('height="5" viewBox="0 0 30 10"'))).toEqual({ breite: 15, hoehe: 5 })
  })

  it('ohne brauchbare Maße, kein SVG oder kaputt: null', () => {
    expect(svgMasse(svg(''))).toBeNull()
    expect(svgMasse(svg('width="100%" height="50%"'))).toBeNull()
    expect(svgMasse(svg('viewBox="0 0 0 10"'))).toBeNull()
    expect(svgMasse('<html><body>kein Bild</body></html>')).toBeNull()
    expect(svgMasse('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="2"><rect>')).toBeNull()
  })

  it('svgFuerZiel: ohne viewBox kommt eine aus den bisherigen Maßen dazu, sonst skaliert der Inhalt nicht mit', () => {
    // 1200 × 600 ohne viewBox (Form einer Flagge): gerastert auf 720 × 360, der Inhalt in 0 0 1200 600.
    const gross = wurzel(svgFuerZiel(svg('width="1200" height="600"'))!)
    expect(gross.attrs).toEqual({ width: '720', height: '360', viewBox: '0 0 1200 600' })
    expect(gross.ziel).toEqual({ breite: 720, hoehe: 360 })
    // Klein ohne viewBox: hochgerechnet, der Inhalt wächst mit.
    expect(wurzel(svgFuerZiel(svg('width="40" height="20"'))!).attrs).toEqual({ width: '720', height: '360', viewBox: '0 0 40 20' })
    // In mm: Eine Nutzereinheit ist ohne viewBox ein CSS-Pixel (96 dpi).
    const mm = wurzel(svgFuerZiel(svg('width="50.8mm" height="25.4mm"'))!).attrs.viewBox.split(' ').map(Number)
    expect(mm.slice(0, 2)).toEqual([0, 0])
    expect(mm[2]).toBeCloseTo(192)
    expect(mm[3]).toBeCloseTo(96)
  })

  it('svgFuerZiel: eine brauchbare viewBox bleibt; eine kaputte wird ersetzt; ohne Maße null', () => {
    expect(wurzel(svgFuerZiel(svg('width="90" height="30" viewBox="10 5 3 1"'))!).attrs).toEqual({ width: '1080', height: '360', viewBox: '10 5 3 1' })
    expect(wurzel(svgFuerZiel(svg('viewBox="0 0 30 10"'))!).attrs).toEqual({ width: '1080', height: '360', viewBox: '0 0 30 10' })
    expect(wurzel(svgFuerZiel(svg('width="40" height="20" viewBox="0 0 0 10"'))!).attrs.viewBox).toBe('0 0 40 20')
    expect(svgFuerZiel(svg(''))).toBeNull()
    expect(svgFuerZiel('<html><body>kein Bild</body></html>')).toBeNull()
  })

  it('LogoFehler trägt seinen Code', () => {
    const f = new LogoFehler('lesbar')
    expect(f).toBeInstanceOf(Error)
    expect(f.code).toBe('lesbar')
  })
})
