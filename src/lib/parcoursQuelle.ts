import { bildSvg, type BildVorgabe } from './parcoursbild'
import quelle from '../assets/parcours/QUELLE.json'
import { PARALLEL_DATEI } from './parcoursVertrag'

/** Woher die Zeichnungen stammen und unter welcher Lizenz sie stehen (schreibt `npm run parcours:sync`). */
export const PARCOURS_HERKUNFT: Readonly<{
  repo: string
  commit: string
  ordner: string
  titel: string
  urheber: string
  lizenz: string
  lizenzUrl: string
  dateien: readonly string[]
  /** Die Parallelslalom-Zeichnung (R8-19, 22.11.2026): derselbe Commit, anderer Ordner, dieselbe Namensnennung. */
  parallel?: { ordner: string; quelle: string; titel: string; urheber: string; dateien: readonly string[] }
}> = quelle

// Die Parcours-Zeichnungen als Text im Programm: Vite bindet sie beim Bauen ein (`?raw`).
// Nichts wird nachgeladen – so sind sie auch in der einzelnen HTML-Datei von file:// da.
// „Parcours.svg“ (leerer Parcours für die Blick-Erklärung) gehört nicht dazu.
const dateien = import.meta.glob('../assets/parcours/Klasse*.svg', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

const NACH_NAME = new Map(Object.entries(dateien).map(([pfad, text]) => [pfad.slice(pfad.lastIndexOf('/') + 1, -'.svg'.length), text]))

// Die Parallelslalom-Zeichnung (R8-19, 22.11.2026, WKR_ANNAHMEN BD3/BD8) auf demselben Weg (gebündelt, ohne Netz –
// die Geräte laufen auch aus der einen HTML-Datei), aber getrennt von den Klassen-Zeichnungen: parcoursDateien() bleibt
// deren Liste (Bogen, Assistent). Über glob statt festem Import, damit ein Stand ohne die Datei baut – dann zeigt die
// Maske „Bild“ im Parallelslalom das Schema (wkr/bild.ts schemaParallel).
const parallel = Object.values(
  import.meta.glob('../assets/parcours/Parallel.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
)[0]

/** Die Namen der eingebundenen Zeichnungen, z. B. `Klasse4`, `Klasse5_Moewe`. */
export function parcoursDateien(): string[] {
  return [...NACH_NAME.keys()].sort()
}

/** Die Zeichnung als SVG-Text; `datei` ohne Endung, wie sie `bildDatei` der Konfiguration liefert. */
export function parcoursSvg(datei: string): string | undefined {
  return NACH_NAME.get(datei) ?? (datei === PARALLEL_DATEI ? parallel : undefined)
}

// Abgeblendete Bilder entstehen im Browser und nur einmal je (Datei, Vorgabe); die Blob-URLs
// gelten für die Sitzung. Als `<img :src>` gedacht: Das kapselt IDs und Stilregeln des Bildes.
const erzeugt = new Map<string, string>()

/** Das abgeblendete Bild als Blob-URL; `undefined`, wenn es die Zeichnung nicht gibt. */
export function parcoursBildUrl(datei: string, vorgabe: Pick<BildVorgabe, 'dim' | 'aus'>): string | undefined {
  const schluessel = `${datei}|${vorgabe.dim.join(',')}|${vorgabe.aus.join(',')}`
  const bekannt = erzeugt.get(schluessel)
  if (bekannt) return bekannt
  const quelle = parcoursSvg(datei)
  if (!quelle) return undefined
  const url = URL.createObjectURL(new Blob([bildSvg(quelle, vorgabe).svg], { type: 'image/svg+xml' }))
  erzeugt.set(schluessel, url)
  return url
}
