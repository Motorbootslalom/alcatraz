import type { LogoBild } from '../types'
import { dateiFehler, hoehenFolge, istSvgDatei, LOGO_BUDGET_BYTES, LOGO_MAX_MEGAPIXEL, logoWert, zielMasse } from './logo'

// Ein gewähltes Bild zum Logo machen – nur im Browser (Canvas, Image, FileReader). Entscheidung des Nutzers
// vom 16.11.2026: Die Logos lädt der Ausrichter selbst; sie stehen im Stand (localStorage, jeder
// Verlaufseintrag, Sicherung, Vorlage) und werden deshalb beim Einlesen verkleinert. Neu kodieren entfernt
// nebenbei die Metadaten (XMP, EXIF mit GPS) – das zählt für die weitergegebene Vorlage.
// verkleinereLogo ist in happy-dom nicht testbar (kein Canvas) und im Browser geprüft; svgMasse und
// svgFuerZiel (das SVG vor dem Rastern) sind testbar.

export type LogoFehlerCode = 'typ' | 'gross' | 'lesbar' | 'speicher'

/** Ein Grund, warum ein Bild kein Logo wird; den Text wählt erst die Oberfläche (listopt.logo.error.<code>). */
export class LogoFehler extends Error {
  constructor(readonly code: LogoFehlerCode) {
    super(`logo:${code}`)
    this.name = 'LogoFehler'
  }
}

/** Längen in SVG-Angaben → Pixel bei 96 dpi (wie der Browser sie zeichnet). */
const EINHEIT_PX: Record<string, number> = { '': 1, px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 }

function laenge(wert: string | null): number | null {
  const m = wert?.trim().match(/^(\d*\.?\d+(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in)?$/i)
  if (!m) return null
  const px = parseFloat(m[1]) * EINHEIT_PX[(m[2] ?? '').toLowerCase()]
  return Number.isFinite(px) && px > 0 ? px : null
}

/**
 * Maße eines SVG in Pixeln: `width`/`height` (mit Einheit, bei 96 dpi), sonst die der viewBox; fehlt nur eins
 * von beiden, gilt das Seitenverhältnis der viewBox. `%` zählt nicht (es gibt kein umgebendes Maß). Kein SVG,
 * ein Fehler beim Lesen oder keine brauchbaren Maße → `null`.
 */
export function svgMasse(text: string): { breite: number; hoehe: number } | null {
  return liesSvg(text)?.masse ?? null
}

/** Das gelesene SVG: Wurzel, Maße (wie {@link svgMasse}) und ob es eine brauchbare viewBox hat. */
function liesSvg(text: string): { doc: Document; wurzel: Element; masse: { breite: number; hoehe: number }; mitViewBox: boolean } | null {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const wurzel = doc.documentElement
  if (!wurzel || wurzel.localName !== 'svg' || doc.getElementsByTagName('parsererror').length > 0) return null
  const box = (wurzel.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  const vb = box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0 ? { breite: box[2], hoehe: box[3] } : null
  const b = laenge(wurzel.getAttribute('width'))
  const h = laenge(wurzel.getAttribute('height'))
  const mit = (masse: { breite: number; hoehe: number }) => ({ doc, wurzel, masse, mitViewBox: vb !== null })
  if (b && h) return mit({ breite: b, hoehe: h })
  if (!vb) return null
  if (b) return mit({ breite: b, hoehe: (b * vb.hoehe) / vb.breite })
  if (h) return mit({ breite: (h * vb.breite) / vb.hoehe, hoehe: h })
  return mit(vb)
}

/**
 * Das SVG zum Rastern: die Zielpixel (lib/logo.ts zielMasse) als width/height der Wurzel – ohne feste Maße
 * liefert Firefox naturalWidth 0 und rastert unscharf. Fehlt eine brauchbare viewBox, kommt eine aus den
 * bisherigen Maßen dazu: Ohne sie skaliert ein SVG seinen Inhalt nicht mit, ein größeres würde rechts und
 * unten abgeschnitten, ein kleineres stünde winzig oben links (Befund der Prüfung, 16.11.2026; etwa eine
 * Flagge mit width/height ohne viewBox). Ohne viewBox ist eine Nutzereinheit ein CSS-Pixel – die Maße aus
 * svgMasse (px bei 96 dpi) sind also genau ihre Koordinaten. `null` wie bei svgMasse.
 */
export function svgFuerZiel(text: string): { svg: string; breite: number; hoehe: number } | null {
  const gelesen = liesSvg(text)
  if (!gelesen) return null
  const { doc, wurzel, masse, mitViewBox } = gelesen
  const ziel = zielMasse(masse.breite, masse.hoehe, { vektor: true })
  if (!mitViewBox) wurzel.setAttribute('viewBox', `0 0 ${masse.breite} ${masse.hoehe}`)
  wurzel.setAttribute('width', String(ziel.breite))
  wurzel.setAttribute('height', String(ziel.hoehe))
  return { svg: new XMLSerializer().serializeToString(doc), ...ziel }
}

/**
 * Das gewählte Bild als Logo: verkleinert auf höchstens 360 px Höhe (lib/logo.ts zielMasse), als PNG, sonst
 * WebP, notfalls JPEG – je Logo höchstens rund 100 kB. SVG wird gerastert (das Hochladen erzeugt nie SVG).
 * GIF, APNG und animiertes WebP: Es zählt das erste Bild. Wirft {@link LogoFehler}.
 */
export async function verkleinereLogo(file: File): Promise<LogoBild> {
  const vorab = dateiFehler(file)
  if (vorab) throw new LogoFehler(vorab)
  const urls: string[] = []
  try {
    let quelle: Blob = file
    let ziel: { breite: number; hoehe: number } | null = null
    if (istSvgDatei(file)) {
      const vorbereitet = svgFuerZiel(await file.text())
      if (!vorbereitet) throw new LogoFehler('lesbar')
      ziel = { breite: vorbereitet.breite, hoehe: vorbereitet.hoehe }
      quelle = new Blob([vorbereitet.svg], { type: 'image/svg+xml' })
    }
    const url = URL.createObjectURL(quelle)
    urls.push(url)
    const img = new Image()
    img.src = url
    try {
      // decode() beachtet auch die EXIF-Drehung (image-orientation: from-image ist Vorgabe).
      await img.decode()
    } catch {
      throw new LogoFehler('lesbar')
    }
    const nw = img.naturalWidth
    const nh = img.naturalHeight
    if (!nw || !nh) throw new LogoFehler('lesbar')
    if (nw * nh > LOGO_MAX_MEGAPIXEL * 1_000_000) throw new LogoFehler('gross')
    ziel ??= zielMasse(nw, nh, { vektor: false })

    const folge = hoehenFolge(ziel.hoehe)
    let blob: Blob | null = null
    let canvas: HTMLCanvasElement | null = null
    for (const hoehe of folge) {
      const breite = Math.max(1, Math.round((ziel.breite * hoehe) / ziel.hoehe))
      canvas = zeichne(img, nw, nh, breite, hoehe, false)
      const png = await alsBlob(canvas, 'image/png')
      if (png.size <= LOGO_BUDGET_BYTES) {
        blob = png
        break
      }
      // Safari kann kein WebP schreiben und liefert dann PNG – das zählt nicht als WebP.
      const webp = await alsBlob(canvas, 'image/webp', 0.9)
      if (webp.type === 'image/webp' && webp.size <= LOGO_BUDGET_BYTES) {
        blob = webp
        break
      }
    }
    if (!blob) {
      // Notfalls JPEG in der kleinsten Höhe, auf Weiß (Papier ist weiß; JPEG kennt keine Durchsicht).
      const hoehe = folge[folge.length - 1]
      const breite = Math.max(1, Math.round((ziel.breite * hoehe) / ziel.hoehe))
      canvas = zeichne(img, nw, nh, breite, hoehe, true)
      blob = await alsBlob(canvas, 'image/jpeg', 0.85)
    }
    const src = await alsDataUrl(blob)
    const logo = logoWert({ src, breite: canvas!.width, hoehe: canvas!.height })
    if (!logo) throw new LogoFehler('gross')
    return logo
  } finally {
    for (const u of urls) URL.revokeObjectURL(u)
  }
}

/**
 * Auf die Zielmaße zeichnen: bei großen Rasterbildern in Halbierungsschritten (ein Schritt von 4000 auf 360 px
 * flimmert und verliert feine Linien), bis die nächste Hälfte unter das Ziel fiele; dann genau aufs Ziel.
 */
function zeichne(img: HTMLImageElement, nw: number, nh: number, breite: number, hoehe: number, weiss: boolean): HTMLCanvasElement {
  let quelle: CanvasImageSource = img
  let qb = nw
  let qh = nh
  while (qb / 2 >= breite && qh / 2 >= hoehe) {
    const zwischen = leinwand(Math.round(qb / 2), Math.round(qh / 2))
    kontext(zwischen).drawImage(quelle, 0, 0, qb, qh, 0, 0, zwischen.width, zwischen.height)
    quelle = zwischen
    qb = zwischen.width
    qh = zwischen.height
  }
  const canvas = leinwand(breite, hoehe)
  const ctx = kontext(canvas)
  if (weiss) {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, breite, hoehe)
  }
  ctx.drawImage(quelle, 0, 0, qb, qh, 0, 0, breite, hoehe)
  return canvas
}

function leinwand(breite: number, hoehe: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = breite
  c.height = hoehe
  return c
}

function kontext(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d')
  if (!ctx) throw new LogoFehler('lesbar')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

function alsBlob(c: HTMLCanvasElement, typ: string, qualitaet?: number): Promise<Blob> {
  return new Promise((fertig, fehler) => c.toBlob((b) => (b ? fertig(b) : fehler(new LogoFehler('lesbar'))), typ, qualitaet))
}

function alsDataUrl(blob: Blob): Promise<string> {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader()
    leser.onload = () => (typeof leser.result === 'string' ? fertig(leser.result) : fehler(new LogoFehler('lesbar')))
    leser.onerror = () => fehler(new LogoFehler('lesbar'))
    leser.readAsDataURL(blob)
  })
}
