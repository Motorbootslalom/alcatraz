import { OPTIONALE_IDS, RAHMEN_ID } from './parcoursVertrag.ts'

// Abgeblendete Parcoursbilder aus EINER Quelle (src/assets/parcours): Statt je Position ein
// Bild von Hand zu malen, wird abgeleitet, welche Tore hell bleiben; der Rest bekommt eine
// geringere Deckkraft. Fahrweg und Zeitnahme bleiben immer sichtbar.
//
// Nur Text und Daten, ohne DOM. Vorbild: lib/parcoursbild.ts im Fehlerpunkte-Prototyp. Anders
// als dort gibt es keine vorgebauten Bildordner: Jedes Bild entsteht im Browser (bildSvg),
// die Quelle steckt als Text im Programm (lib/parcoursQuelle.ts).

export { OPTIONALE_IDS, RAHMEN_ID }

/** Tore, die je nach Position hervorgehoben ODER abgeblendet werden. Alles
 *  andere (Fahrweg, Zeitnahme, Start/Ziel, Schikane, Speedbojen) bleibt sichtbar,
 *  außer es steht ausdrücklich in `abblenden`. */
export const DIM_UNIVERSE = ['Tor1', 'Tor2', 'Tor3', 'Tor4', 'Tor5'] as const

/** Rest-Deckkraft der abgeblendeten Elemente (0 = unsichtbar, 1 = voll). */
export const DIM_OPACITY = 0.2

/** Die Ziffern im Parcoursbild (Tore, Schikane, Speedbojen). */
export const ZIFFERN_IDS = [
  'Nummer_Tor1',
  'Nummer_Tor2',
  'Nummer_Tor3',
  'Nummer_Tor4',
  'Nummer_Tor5',
  'Nummer_Schikane',
  'Nummer_Speedboje_oben',
  'Nummer_Speedboje_unten',
] as const

/** Deckkraft ausgeblendeter Ziffern. */
export const AUSBLENDEN_OPACITY = 0

/**
 * Name der Quelle, wenn die Position keine nennt. Im Prototyp ist das ein Ordner unter
 * public/parcours; hier gibt es nur diese eine Quelle (die Zeichnungen in src/assets/parcours,
 * die aus `dist/alcatraz_Parcours` des Parcours-Repositorys stammen). Der Name bleibt, damit
 * Konfiguration und Tests beider Programme gleich lauten.
 */
export const STANDARD_QUELLE = 'alcatraz_Parcours'

/** Was eine Position für ihr Bild braucht (Auszug aus der Roh-Position). */
export interface BildPosition {
  id?: string
  bild?: string
  bildGenerator?: boolean
  bildImBrowser?: boolean
  bildQuelle?: string
  abblenden?: string[]
  bildNeben?: boolean
  bildDrehung?: number
  spalten?: Array<{ hebt?: string }>
}

/**
 * Leitet aus einer Position die Menge der abzublendenden Element-IDs ab:
 *   • Setzen Spalten `hebt`, bleiben genau diese Tore hell → der Rest des
 *     DIM_UNIVERSE wird abgeblendet.
 *   • Zusätzlich (oder als Fallback ohne `hebt`) greift `abblenden`.
 */
export function deriveDimSet(pos: BildPosition): string[] {
  const hervorgehoben = new Set((pos.spalten ?? []).map((s) => s?.hebt).filter((x): x is string => !!x))
  const dim = new Set<string>(pos.abblenden ?? [])
  if (hervorgehoben.size > 0) {
    for (const gate of DIM_UNIVERSE) if (!hervorgehoben.has(gate)) dim.add(gate)
  }
  return [...dim]
}

/** Hochkant oder neben der Legende ist ein Bild zu klein für lesbare Ziffern. */
export function kleinesBild(pos: Pick<BildPosition, 'bildNeben' | 'bildDrehung'>): boolean {
  return !!pos.bildNeben || Math.abs(pos.bildDrehung ?? 0) === 90
}

/**
 * Entfernt den Rahmen der Quelle: Die App zieht selbst einen um das Bild. Die eingecheckten
 * Zeichnungen haben ihn schon nicht mehr (normalisiere); das hier fängt eine Quelle ab, die
 * nicht durch `npm run parcours:sync` gelaufen ist.
 */
export function ohneRahmen(svg: string): string {
  return svg.replace(new RegExp(`<path\\b[^>]*\\bid="${RAHMEN_ID}"[^>]*/>`), '')
}

/** Woraus ein Bild entsteht: Quelle, abgeblendete und ausgeblendete IDs. */
export interface BildVorgabe {
  quelle: string
  /** Abgeblendet, sortiert; ohne das, was ohnehin ausgeblendet wird. */
  dim: string[]
  /** Ausgeblendet: die Ziffern bei kleinen Bildern. */
  aus: string[]
}

/** Die Vorgabe des Bildes einer Position. */
export function bildVorgabe(pos: BildPosition): BildVorgabe {
  const aus: string[] = kleinesBild(pos) ? [...ZIFFERN_IDS] : []
  // Ausgeblendetes nicht zusätzlich abblenden: Es wäre doppelt gesagt.
  const dim = deriveDimSet(pos)
    .filter((id) => !aus.includes(id))
    .sort()
  return { quelle: pos.bildQuelle ?? STANDARD_QUELLE, dim, aus }
}

/** Nur solche IDs kommen in die Stilregeln: Was aus einer YAML-Datei stammt, darf kein CSS einschleusen. */
const ID_MUSTER = /^[A-Za-z][\w-]*$/

/**
 * Das fertige Bild aus dem Quellbild: ohne Rahmen, abgeblendet, Ziffern je nach Größe.
 * `fehlend` nennt verlangte IDs, die es im Bild nicht gibt (außer den optionalen).
 *
 * Abweichung vom Prototyp: Dort bekommt jedes Element ein Attribut `opacity`. Hier steht
 * ein `<style>`-Block mit `!important` direkt hinter dem öffnenden `<svg>`. Das gilt auch
 * für Elemente, die ihre Deckkraft im `style` tragen (dort verliert ein Attribut), eine ID
 * darf in beiden Listen stehen (Ausblenden gewinnt), und zweimal anwenden ergibt kein
 * ungültiges SVG.
 *
 * Gedacht für die Anzeige als Bild (`<img>` mit Blob-URL, siehe parcoursQuelle.ts): Dort
 * bleiben die Regeln im Bild. Direkt in die Seite eingebettet gälten sie für die ganze Seite.
 */
export function bildSvg(quelle: string, vorgabe: Pick<BildVorgabe, 'dim' | 'aus'>): { svg: string; fehlend: string[] } {
  const ohne = ohneRahmen(quelle)
  const vorhanden = (id: string) => ID_MUSTER.test(id) && ohne.includes(`id="${id}"`)
  const regel = (ids: string[], deckkraft: number) =>
    ids.length > 0 ? `${ids.map((id) => `#${id}`).join(',')}{opacity:${deckkraft}!important}` : ''
  const regeln = regel(vorgabe.dim.filter(vorhanden), DIM_OPACITY) + regel(vorgabe.aus.filter(vorhanden), AUSBLENDEN_OPACITY)
  return {
    svg: regeln ? ohne.replace(/<svg\b[^>]*>/, (wurzel) => `${wurzel}<style>${regeln}</style>`) : ohne,
    fehlend: [...vorgabe.dim, ...vorgabe.aus].filter((id) => !vorhanden(id) && !OPTIONALE_IDS.has(id)),
  }
}
