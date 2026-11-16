import type { LogoBild } from '../types'

// Logos auf den gedruckten Listen (Entscheidung des Nutzers vom 16.11.2026): zwei frei belegbare Plätze
// „Logo links“ und „Logo rechts“, unter DM und UIM gleich, anfangs leer – ohne Logo sieht jede Liste aus
// wie vorher. Hier stehen die Grenzen und die reinen Prüfungen; der Reducer (state/reducer/listen.ts) und
// migrate() rufen sie, deshalb ohne DOM. Verkleinern im Browser: lib/logoBild.ts; Anzeige:
// lib/listenLogos.ts und components/KopfLogos.vue; Einstellung: components/LogosPanel.vue.

/**
 * Höhe der Logos auf den Listen in mm. Vom Nutzer nach Beispielen in 10/15/20 mm bestätigt (16.11.2026).
 */
export const LOGO_HOEHE_VORGABE_MM = 15
/**
 * Auf den WKR-Bögen höchstens 12 mm, gleich wie hoch eingestellt (Entscheidung des Nutzers vom 16.11.2026,
 * nach den Beispielen: „WKR-Listen können kleiner sein“) – dort kostet jeder Millimeter im Kopf Zeilen.
 * Laufzettel und übrige Listen folgen der Einstellung.
 */
export const LOGO_HOEHE_BOGEN_MAX_MM = 12
export const LOGO_HOEHE_MIN_MM = 8
/** Darüber kostet ein Logo auf Bögen und Laufzetteln zu viele Zeilen. */
export const LOGO_HOEHE_MAX_MM = 30
/** Breite höchstens 60 mm, damit ein sehr breites Logo den Titel nicht verdrängt (CSS deckelt zusätzlich auf 25 %). */
export const LOGO_BREITE_MAX_MM = 60

/** Zeichen je Logo höchstens – zweites Netz in Reducer und migrate(); das Verkleinern bleibt weit darunter. */
export const LOGO_MAX_ZEICHEN = 300_000
/** Pixelmaße höchstens: schützt die Rechnung vor Unsinn aus einer von Hand geänderten Datei. */
export const LOGO_MASS_MAX = 10_000

/** Zielhöhe beim Verkleinern: 30 mm (die größte Höhe) bei gut 300 dpi. */
export const LOGO_ZIEL_PX = 360
/** Breite höchstens das Vierfache der Zielhöhe – breiter wird ein Logo auf dem Blatt ohnehin nicht. */
export const LOGO_BREITE_MAX_PX = 1440
/** Kleiner wird ein Logo nicht, um unter das Budget zu kommen (eher JPEG). */
export const LOGO_MIN_PX = 200
/** Je Logo höchstens so viele Bytes: Es steht in jedem Verlaufseintrag und im localStorage. */
export const LOGO_BUDGET_BYTES = 100 * 1024
/** Größere Dateien werden gar nicht erst gelesen. */
export const LOGO_DATEI_MAX_BYTES = 20 * 1024 * 1024
/** Größere Bilder lassen manche Browser (Safari, Telefone) beim Dekodieren scheitern. */
export const LOGO_MAX_MEGAPIXEL = 40
/** Darunter weist die Einstellung darauf hin, dass das Logo im Druck unscharf werden kann. */
export const LOGO_DPI_WARNUNG = 200

const PRAEFIX = /^data:image\/(png|jpeg|webp|svg\+xml)(;charset=[\w-]+)?(;base64)?,/i
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

export type LogoFormat = 'png' | 'jpeg' | 'webp' | 'svg+xml'

/**
 * Die Teile einer Logo-data-URL: Format (klein geschrieben), ob base64, die Daten dahinter – oder `null`.
 * Eine Regel für Prüfung (logoWert), Auskunft (logoInfo) und Anzeige (lib/listenLogos.ts logoUrl): Der
 * Kopf darf beliebig geschrieben sein (`;BASE64` aus einer von Hand geänderten Vorlage), und keine der
 * drei darf ihn anders lesen als die anderen (Befund der Prüfung, 16.11.2026).
 */
export function logoTeile(src: string): { format: LogoFormat; base64: boolean; daten: string } | null {
  const kopf = PRAEFIX.exec(src)
  if (!kopf) return null
  return { format: kopf[1].toLowerCase() as LogoFormat, base64: kopf[3] !== undefined, daten: src.slice(kopf[0].length) }
}

/**
 * Ein brauchbares Logo – oder `null`. Nur data-URLs der Formate PNG, JPEG, WebP und SVG (nie eine
 * Adresse im Netz: Die App läuft ohne Server, und ein gedrucktes Logo darf nicht vom Netz abhängen);
 * base64 muss sauber sein, ohne base64 nur prozentkodiertes SVG. SVG wird angenommen (Vorlage von
 * Hand): Als `<img>` laufen darin keine Skripte, und nichts wird nachgeladen. Ein SVG bleibt deshalb
 * auch auf den Listen eine data-URL, nie eine Blob-Adresse mit dem Ursprung der App (logoUrl). Das
 * Hochladen erzeugt nie SVG. Rückgabe ist ein neues Objekt nur mit `src`, `breite`, `hoehe`.
 */
export function logoWert(x: unknown): LogoBild | null {
  if (!x || typeof x !== 'object') return null
  const { src, breite, hoehe } = x as Partial<Record<keyof LogoBild, unknown>>
  if (typeof src !== 'string' || src.length > LOGO_MAX_ZEICHEN) return null
  const teile = logoTeile(src)
  if (!teile) return null
  if (teile.base64) {
    if (!BASE64.test(teile.daten)) return null
  } else if (teile.format !== 'svg+xml' || !teile.daten) return null
  if (!massOk(breite) || !massOk(hoehe)) return null
  return { src, breite, hoehe }
}

function massOk(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= LOGO_MASS_MAX
}

/** Eine brauchbare Höhe in mm (ganz, 8 bis 30); Unbrauchbares ist die Vorgabe. */
export function logoHoeheZahl(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return LOGO_HOEHE_VORGABE_MM
  return Math.max(LOGO_HOEHE_MIN_MM, Math.min(LOGO_HOEHE_MAX_MM, Math.round(n)))
}

/** Maße auf dem Blatt: Höhe wie eingestellt, Breite nach dem Seitenverhältnis, höchstens 60 mm (auf 0,1 mm). */
export function logoMasseMm(b: LogoBild, hoeheMm: number): { breiteMm: number; hoeheMm: number } {
  const breiteMm = Math.min((hoeheMm * b.breite) / b.hoehe, LOGO_BREITE_MAX_MM)
  return { breiteMm: Math.round(breiteMm * 10) / 10, hoeheMm }
}

/**
 * Pixelmaße nach dem Verkleinern: höchstens 360 px hoch und 1440 px breit. Rasterbilder werden nie
 * vergrößert (das brächte nur Bytes, keine Schärfe), Vektorbilder auf genau dieses Maß gerastert. Die
 * Ziele hängen nicht von der eingestellten Höhe ab: Ein Logo bleibt gut, wenn sie später steigt.
 */
export function zielMasse(b: number, h: number, { vektor }: { vektor: boolean }): { breite: number; hoehe: number } {
  const s = vektor ? Math.min(LOGO_ZIEL_PX / h, LOGO_BREITE_MAX_PX / b) : Math.min(1, LOGO_ZIEL_PX / h, LOGO_BREITE_MAX_PX / b)
  return { breite: Math.max(1, Math.round(b * s)), hoehe: Math.max(1, Math.round(h * s)) }
}

/**
 * Höhen, die das Verkleinern der Reihe nach versucht, bis das Bild ins Budget passt: in Schritten
 * von 80 %, nicht unter 200 px (sonst lieber JPEG). 360 → [360, 288, 230, 200]; 150 → [150].
 */
export function hoehenFolge(start: number): number[] {
  const folge = [start]
  for (let h = Math.round(start * 0.8); h >= LOGO_MIN_PX; h = Math.round(h * 0.8)) folge.push(h)
  if (start > LOGO_MIN_PX && folge[folge.length - 1] !== LOGO_MIN_PX) folge.push(LOGO_MIN_PX)
  return folge
}

const TYPEN = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
const ENDUNGEN = /\.(png|jpe?g|webp|gif|svg)$/i

/** Ist die Datei ein SVG (nach Typ oder Endung)? Manche Systeme geben SVG ohne Typ weiter. */
export function istSvgDatei(f: { name: string; type: string }): boolean {
  return f.type === 'image/svg+xml' || /\.svg$/i.test(f.name)
}

/**
 * Was gegen eine gewählte Datei spricht, bevor sie gelesen wird: ein Format, das nicht jeder Browser
 * kann (HEIC u. a.: `typ`), oder mehr als 20 MB (`gross`). Der Typ zählt nach `type` ODER Endung.
 */
export function dateiFehler(f: { name: string; type: string; size: number }): 'typ' | 'gross' | null {
  if (!TYPEN.has(f.type.toLowerCase()) && !ENDUNGEN.test(f.name)) return 'typ'
  if (f.size > LOGO_DATEI_MAX_BYTES) return 'gross'
  return null
}

/** Auflösung im Druck bei der eingestellten Höhe. */
export function logoDpi(b: LogoBild, mm: number): number {
  return Math.round(b.hoehe / (mm / 25.4))
}

const FORMATE: Record<LogoFormat, 'PNG' | 'JPEG' | 'WebP' | 'SVG'> = { png: 'PNG', jpeg: 'JPEG', webp: 'WebP', 'svg+xml': 'SVG' }

/** Format und Größe (kB, mindestens 1) eines Logos für die Auskunft in den Einstellungen. */
export function logoInfo(src: string): { format: 'PNG' | 'JPEG' | 'WebP' | 'SVG'; kb: number } {
  const teile = logoTeile(src)
  const format = teile ? FORMATE[teile.format] : 'PNG'
  const rest = teile?.daten ?? src
  const fuellung = teile?.base64 ? (rest.endsWith('==') ? 2 : rest.endsWith('=') ? 1 : 0) : 0
  const bytes = teile?.base64 ? (rest.length * 3) / 4 - fuellung : rest.length
  return { format, kb: Math.max(1, Math.round(bytes / 1024)) }
}
