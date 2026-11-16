import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TEST_PNG_2X1, testSvgLogo } from '../testHilfen'

// Adressen der Logos auf den Listen (lib/listenLogos.ts logoUrl, 16.11.2026). Der Speicher der Blob-Adressen
// lebt im Modul: Jeder Test lädt es frisch. Nur selbst erzeugte Testbilder – das Repo ist öffentlich.

const DATEN = TEST_PNG_2X1.slice(TEST_PNG_2X1.indexOf(',') + 1)
/** Ein eigenes „Bild“ je Name: Für logoUrl zählt nur, dass base64 sauber ist. */
const bild = (name: string) => `data:image/png;base64,${btoa(`bild-${name}`)}`

let logoUrl: (src: string) => string
let blobs: Blob[]
let erzeugt: ReturnType<typeof vi.spyOn>
let freigegeben: ReturnType<typeof vi.spyOn>

beforeEach(async () => {
  vi.resetModules()
  ;({ logoUrl } = await import('./listenLogos'))
  blobs = []
  let n = 0
  erzeugt = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
    blobs.push(b as Blob)
    return `blob:test/${++n}`
  })
  freigegeben = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('logoUrl', () => {
  it('je Bild eine Blob-Adresse, beim zweiten Mal dieselbe', () => {
    const url = logoUrl(TEST_PNG_2X1)
    expect(url).toBe('blob:test/1')
    expect(logoUrl(TEST_PNG_2X1)).toBe(url)
    expect(erzeugt).toHaveBeenCalledTimes(1)
    expect(blobs[0].type).toBe('image/png')
  })

  it('gibt nie die Adresse eines gerade genutzten Logos frei (links bleibt, rechts wird dreimal ersetzt)', () => {
    // Befund der Prüfung (16.11.2026): Ohne LRU fiel das linke Logo als ältester Eintrag heraus, sobald das
    // rechte eine neue Adresse brauchte – der erste Kopf zeigte einen leeren Kasten.
    const links = logoUrl(bild('L'))
    const rechts = [logoUrl(bild('R1'))]
    for (const r of ['R2', 'R3', 'R4']) {
      // Wie useListenLogos: erst links, dann rechts.
      expect(logoUrl(bild('L'))).toBe(links)
      rechts.push(logoUrl(bild(r)))
    }
    expect(freigegeben).toHaveBeenCalledTimes(1)
    expect(freigegeben).toHaveBeenCalledWith(rechts[0])
    expect(freigegeben).not.toHaveBeenCalledWith(links)
    expect(logoUrl(bild('L'))).toBe(links)
    expect(logoUrl(bild('R4'))).toBe(rechts[3])
  })

  it('liest base64 auch bei großgeschriebenem Kopf (wie logoWert): im Blob stehen die Bytes des PNG', async () => {
    logoUrl(`data:image/PNG;BASE64,${DATEN}`)
    expect(blobs[0].type).toBe('image/png')
    const bytes = new Uint8Array(await blobs[0].arrayBuffer())
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('SVG bleibt data-URL: keine Blob-Adresse mit dem Ursprung der App', () => {
    const svg = testSvgLogo().src
    expect(logoUrl(svg)).toBe(svg)
    const base64 = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="1"/>')}`
    expect(logoUrl(base64)).toBe(base64)
    expect(erzeugt).not.toHaveBeenCalled()
  })

  it('ohne URL.createObjectURL die data-URL selbst', () => {
    erzeugt.mockImplementation(() => {
      throw new Error('nicht da')
    })
    expect(logoUrl(TEST_PNG_2X1)).toBe(TEST_PNG_2X1)
  })
})
