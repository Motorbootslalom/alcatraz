import { describe, expect, it } from 'vitest'
import {
  dateiFehler,
  hoehenFolge,
  LOGO_MAX_ZEICHEN,
  logoDpi,
  logoHoeheZahl,
  logoInfo,
  logoMasseMm,
  logoTeile,
  logoWert,
  zielMasse,
} from './logo'
import { TEST_PNG_2X1, testLogo, testSvgLogo } from '../testHilfen'

// Grenzen und Prüfungen der Logos (16.11.2026). Nur selbst erzeugte Testbilder – das Repo ist öffentlich.

describe('logoWert', () => {
  it('nimmt PNG, JPEG, WebP (base64) und SVG (base64 und prozentkodiert) an', () => {
    const daten = TEST_PNG_2X1.slice(TEST_PNG_2X1.indexOf(',') + 1)
    for (const typ of ['png', 'jpeg', 'webp', 'svg+xml', 'PNG']) {
      expect(logoWert({ src: `data:image/${typ};base64,${daten}`, breite: 2, hoehe: 1 })).not.toBeNull()
    }
    expect(logoWert(testSvgLogo())).toEqual(testSvgLogo())
    expect(logoWert({ ...testSvgLogo(), src: testSvgLogo().src.replace('data:image/svg+xml,', 'data:image/svg+xml;charset=utf-8,') })).not.toBeNull()
  })

  it('lehnt Adressen, fremde Typen, zu Langes, kaputtes base64 und unbrauchbare Maße ab', () => {
    const gut = testLogo()
    const daten = TEST_PNG_2X1.slice(TEST_PNG_2X1.indexOf(',') + 1)
    for (const src of [
      'https://example.org/logo.png',
      `data:image/gif;base64,${daten}`,
      `data:text/html;base64,${daten}`,
      'data:image/png,%89PNG',
      'data:image/png;base64,ab$c',
      'data:image/png;base64,',
      'data:image/svg+xml,',
      `data:image/png;base64,${'A'.repeat(LOGO_MAX_ZEICHEN)}`,
    ]) {
      expect(logoWert({ ...gut, src })).toBeNull()
    }
    for (const mass of [0, -1, NaN, Infinity, 10_001, '2']) {
      expect(logoWert({ ...gut, breite: mass })).toBeNull()
      expect(logoWert({ ...gut, hoehe: mass })).toBeNull()
    }
    expect(logoWert(null)).toBeNull()
    expect(logoWert('a')).toBeNull()
    expect(logoWert({ breite: 2, hoehe: 1 })).toBeNull()
  })

  it('gibt ein neues Objekt ohne Zusatzfelder zurück', () => {
    const roh = { ...testLogo(), extra: 'x' }
    const wert = logoWert(roh)
    expect(wert).toEqual(testLogo())
    expect(wert).not.toBe(roh)
    expect(Object.keys(wert ?? {})).toEqual(['src', 'breite', 'hoehe'])
  })
})

describe('Maße', () => {
  it('logoHoeheZahl: Unbrauchbares ist die Vorgabe, sonst ganz und auf 8 bis 30 geklemmt', () => {
    expect(logoHoeheZahl(undefined)).toBe(15)
    expect(logoHoeheZahl('x')).toBe(15)
    expect(logoHoeheZahl(NaN)).toBe(15)
    expect(logoHoeheZahl(3)).toBe(8)
    expect(logoHoeheZahl(99)).toBe(30)
    expect(logoHoeheZahl(12.4)).toBe(12)
  })

  it('zielMasse: Raster nie größer, höchstens 360 px hoch und 1440 px breit; Vektor genau auf das Ziel', () => {
    expect(zielMasse(1059, 1045, { vektor: false })).toEqual({ breite: 365, hoehe: 360 })
    expect(zielMasse(420, 208, { vektor: false })).toEqual({ breite: 420, hoehe: 208 })
    expect(zielMasse(4000, 100, { vektor: false })).toEqual({ breite: 1440, hoehe: 36 })
    expect(zielMasse(40, 10, { vektor: true })).toEqual({ breite: 1440, hoehe: 360 })
    expect(zielMasse(1200, 600, { vektor: true })).toEqual({ breite: 720, hoehe: 360 })
  })

  it('hoehenFolge: in Schritten von 80 %, nicht unter 200 px', () => {
    expect(hoehenFolge(360)).toEqual([360, 288, 230, 200])
    expect(hoehenFolge(150)).toEqual([150])
    expect(hoehenFolge(250)).toEqual([250, 200])
  })

  it('logoMasseMm: Breite nach dem Seitenverhältnis, höchstens 60 mm', () => {
    expect(logoMasseMm(testLogo(2, 1), 15)).toEqual({ breiteMm: 30, hoeheMm: 15 })
    expect(logoMasseMm(testLogo(10, 1), 15)).toEqual({ breiteMm: 60, hoeheMm: 15 })
    expect(logoMasseMm(testLogo(365, 360), 10)).toEqual({ breiteMm: 10.1, hoeheMm: 10 })
  })

  it('logoDpi: 360 px bei 30 mm sind gut 300 dpi', () => {
    expect(logoDpi(testLogo(720, 360), 30)).toBe(305)
  })
})

describe('Dateien', () => {
  it('dateiFehler: Typ nach type oder Endung, höchstens 20 MB', () => {
    expect(dateiFehler({ name: 'x.heic', type: 'image/heic', size: 1000 })).toBe('typ')
    expect(dateiFehler({ name: 'x.txt', type: 'text/plain', size: 10 })).toBe('typ')
    expect(dateiFehler({ name: 'x.svg', type: '', size: 1000 })).toBeNull()
    expect(dateiFehler({ name: 'logo', type: 'image/png', size: 1000 })).toBeNull()
    expect(dateiFehler({ name: 'x.JPG', type: '', size: 1000 })).toBeNull()
    expect(dateiFehler({ name: 'x.png', type: 'image/png', size: 21 * 1024 * 1024 })).toBe('gross')
  })

  it('logoInfo: Format und Größe in kB', () => {
    expect(logoInfo(TEST_PNG_2X1)).toEqual({ format: 'PNG', kb: 1 })
    const gross = `data:image/webp;base64,${'A'.repeat(4 * 1024 * 10)}`
    expect(logoInfo(gross)).toEqual({ format: 'WebP', kb: 30 })
    expect(logoInfo(testSvgLogo().src).format).toBe('SVG')
  })

  it('logoTeile: eine Regel für Prüfung und Anzeige, auch bei großgeschriebenem Kopf', () => {
    const daten = TEST_PNG_2X1.slice(TEST_PNG_2X1.indexOf(',') + 1)
    expect(logoTeile(TEST_PNG_2X1)).toEqual({ format: 'png', base64: true, daten })
    // Was logoWert annimmt, liest logoTeile genauso (Befund der Prüfung, 16.11.2026).
    const gross = `DATA:IMAGE/PNG;BASE64,${daten}`
    expect(logoWert({ src: gross, breite: 2, hoehe: 1 })).not.toBeNull()
    expect(logoTeile(gross)).toEqual({ format: 'png', base64: true, daten })
    expect(logoTeile(testSvgLogo().src)).toMatchObject({ format: 'svg+xml', base64: false })
    expect(logoTeile('data:image/svg+xml;charset=UTF-8,%3Csvg%3E')).toEqual({ format: 'svg+xml', base64: false, daten: '%3Csvg%3E' })
    expect(logoTeile('https://example.org/logo.png')).toBeNull()
  })
})
