import type { Flagge } from '../domain/flaggen'

/**
 * Die Flaggenbilder: mitgelieferte Vektorbilder (SVG), beim Bauen als Text in die App
 * eingebettet – nichts wird zur Laufzeit geladen, auch nicht in der Ein-Datei-Fassung.
 * Keine Emoji: Windows zeigt für Flaggen-Emoji nur Buchstaben, und für Bundesländer gibt es keine.
 *
 * - Staaten: Paket „country-flag-icons“ (MIT), Fassung 3:2 – vereinfachte Zeichnungen, die
 *   auch wenige Millimeter groß noch zu erkennen sind (alle zusammen rund 180 kB). Ohne die
 *   Bilder, zu denen es keine Zuordnung gibt (domain/staaten.ts).
 * - Bundesländer: `./bundeslaender/` – je Land die Landesflagge, die jedermann führen darf
 *   (Zivilflagge), nicht die den Behörden vorbehaltene Dienstflagge. Welche das je Land ist
 *   und woher die Zeichnung stammt, steht in `./bundeslaender/LIESMICH.md`.
 */
const staaten = import.meta.glob(
  ['../../node_modules/country-flag-icons/3x2/*.svg', '!**/{AC,TA,IC,XA,XC,XO,ES-CT,BQ-BO,BQ-SA,BQ-SE}.svg'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>
const bundeslaender = import.meta.glob('./bundeslaender/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const nachCode = (dateien: Record<string, string>) => new Map(Object.entries(dateien).map(([pfad, svg]) => [pfad.slice(pfad.lastIndexOf('/') + 1, -4), svg]))
const SVG = { staat: nachCode(staaten), bundesland: nachCode(bundeslaender) }

/** Die Kennungen, für die es ein Bild gibt (für den Abgleich mit der Zuordnung). */
export const FLAGGEN_CODES = { staat: [...SVG.staat.keys()], bundesland: [...SVG.bundesland.keys()] }

/** Das Bild als Text; `undefined`, wenn es keines gibt. */
export function flaggenSvg(flagge: Pick<Flagge, 'art' | 'code'>): string | undefined {
  return SVG[flagge.art].get(flagge.code)
}

export interface FlaggenBild {
  /** Adresse für `<img>`: das Bild selbst als data-URI. */
  src: string
  /** Seitenverhältnis aus der `viewBox` – als `width`/`height` am Bild, damit seine Breite feststeht, bevor es geladen ist. */
  breite: number
  hoehe: number
}

const bilder = new Map<string, FlaggenBild | undefined>()

/**
 * Das Bild zur Flagge für `<img>`. Als Bild und nicht in die Seite gesetzt: Die Zeichnungen
 * bringen eigene Kennungen mit (Verläufe, Ausschnitte), die sich in einer Liste mit vielen
 * Flaggen sonst in die Quere kämen.
 */
export function flaggenBild(flagge: Pick<Flagge, 'art' | 'code'>): FlaggenBild | undefined {
  const key = `${flagge.art}:${flagge.code}`
  if (bilder.has(key)) return bilder.get(key)
  const svg = flaggenSvg(flagge)
  const box = svg?.match(/viewBox="([^"]+)"/)?.[1].split(/[\s,]+/).map(Number)
  const bild = svg && box?.length === 4 && box[2] > 0 && box[3] > 0 ? { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, breite: box[2], hoehe: box[3] } : undefined
  bilder.set(key, bild)
  return bild
}
