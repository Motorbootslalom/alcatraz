import type { OriginMode } from '../types'
import { BUNDESLAENDER } from './kuerzel'
import { IOC_STAATEN, ISO_STAATEN, STAAT_NAMEN, STAAT_NAMEN_FEST } from './staaten'

/**
 * Welche Flagge zu einer Herkunftsangabe gehört.
 *
 * Die Herkunft ist freier Text am Starter („Bayern“, „BY“, „GER“, „Netherlands“ …). Für die
 * Herkunft „Bundesland“ und „Land“ lässt sich daraus eine Flagge ableiten – über Kürzel und
 * Namen, unabhängig von Groß-/Kleinschreibung, Leerzeichen, Bindestrichen und Umlauten. Was
 * sich nicht zuordnen lässt, hat keine Flagge und steht als Text da.
 *
 * Rein und ohne die Bilder: Die liegen in flaggen/bilder.ts, damit Rechnen und Prüfen sie
 * nicht laden müssen.
 */
export interface Flagge {
  art: 'bundesland' | 'staat'
  /** Kennung des Bildes: Bundesland nach ISO 3166-2:DE ohne „DE-“ (BY), Staat nach ISO 3166-1 zweistellig (DE; Landesteile „GB-SCT“). */
  code: string
  /** Das Kürzel, das neben der Flagge steht, wenn der Veranstalter kein eigenes hinterlegt hat: BY, DEU. */
  kuerzel: string
}

/**
 * Text vergleichbar machen: klein, ohne Akzente und Umlautpunkte (ö → o), ß → ss, nur
 * Buchstaben und Ziffern. „Baden-Württemberg“, „baden wuerttemberg“ und „BADENWÜRTTEMBERG“
 * sollen dasselbe sein – die Schreibweise mit „ue“ deckt `varianten` ab.
 *
 * Bindewörter zwischen anderen Wörtern zählen nicht, und „Saint“/„Sankt“ gilt wie „St.“:
 * „Bosnia and Herzegovina“, „Bosnia & Herzegovina“ und „Bosnien-Herzegowina“ (bis auf das w)
 * sind dieselbe Angabe, ebenso „Saint Lucia“ und „St. Lucia“. Ein einzelnes Wort bleibt, wie
 * es ist – „AND“ ist das Kürzel von Andorra.
 */
export function flaggenSchluessel(text: string): string {
  const woerter = text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
  if (woerter.length < 2) return woerter.join('')
  return woerter
    .filter((wort, i) => i === 0 || i === woerter.length - 1 || !BINDEWOERTER.has(wort))
    .map((wort) => (wort === 'saint' || wort === 'sankt' ? 'st' : wort))
    .join('')
}

const BINDEWOERTER = new Set(['and', 'und'])

/** Beide Schlüssel eines Namens: Umlaut ohne Punkte (o) und umschrieben (oe). */
function varianten(name: string): string[] {
  const klein = name.toLowerCase()
  const umschrieben = klein.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  return [...new Set([flaggenSchluessel(klein), flaggenSchluessel(umschrieben)])]
}

/** Gängige Schreibweisen der Bundesländer neben dem amtlichen Namen und dem Kürzel. */
const BUNDESLAND_NAMEN: Readonly<Record<string, string[]>> = {
  // „Baden“ und „Württemberg“ allein fehlen mit Absicht: Das sind Landesteile mit eigener Flagge
  // und im Motorsport oft eigene Verbände – sie sollen nicht still zu einer Mannschaft werden.
  BW: ['BaWü', 'Baden Württemberg'],
  BY: ['Freistaat Bayern', 'Bavaria', 'Bay'],
  BE: ['Land Berlin', 'BLN'],
  BB: ['Land Brandenburg', 'BBG', 'BRB'],
  HB: ['Freie Hansestadt Bremen', 'Hansestadt Bremen'],
  HH: ['Freie und Hansestadt Hamburg', 'Hansestadt Hamburg'],
  HE: ['Hesse', 'Hessia'],
  MV: ['Mecklenburg', 'MeckPomm', 'Mecklenburg-Western Pomerania', 'MVP'],
  NI: ['Lower Saxony', 'NDS'],
  NW: ['NRW', 'North Rhine-Westphalia', 'Nordrhein Westfalen'],
  RP: ['RLP', 'Rhineland-Palatinate', 'RhPf'],
  SL: ['Saar'],
  SN: ['Freistaat Sachsen', 'Saxony'],
  ST: ['Saxony-Anhalt', 'LSA'],
  SH: ['Schleswig Holstein'],
  TH: ['Freistaat Thüringen', 'Thuringia', 'Thür'],
}

let bundeslaender: Map<string, string> | null = null
function bundeslandMap(): Map<string, string> {
  if (bundeslaender) return bundeslaender
  const map = new Map<string, string>()
  for (const { code, name } of BUNDESLAENDER) {
    // Erst die Namen, zuletzt das Kürzel: Ein amtliches Kürzel gilt immer für sein Land.
    for (const text of [...(BUNDESLAND_NAMEN[code] ?? []), name]) for (const key of varianten(text)) if (!map.has(key)) map.set(key, code)
  }
  for (const { code } of BUNDESLAENDER) map.set(code.toLowerCase(), code)
  bundeslaender = map
  return map
}

/** Das Bundesland zu einem Text als amtliches Kürzel (BY); `''`, wenn keines passt. „DE-BY“ gilt wie „BY“. */
export function bundeslandVon(text: string): string {
  const key = flaggenSchluessel(text)
  const map = bundeslandMap()
  return map.get(key) ?? (key.length === 4 && key.startsWith('de') ? (map.get(key.slice(2)) ?? '') : '')
}

/** Zweistelliger → dreistelliger Code. Die Landesteile des Vereinigten Königreichs und die Europaflagge haben keinen ISO-Code eines Staates und tragen ihr eigenes Kürzel. */
const ALPHA3 = new Map<string, string>([
  ...ISO_STAATEN.split(' ').map((paar) => paar.split(':') as [string, string]),
  ['GB-ENG', 'ENG'],
  ['GB-SCT', 'SCO'],
  ['GB-WLS', 'WAL'],
  ['GB-NIR', 'NIR'],
  ['EU', 'EU'],
])

/** Alle Kennungen, zu denen `staatVon` führen kann – für jede braucht es ein Bild. */
export const STAAT_CODES: readonly string[] = [...ALPHA3.keys()]

let staaten: Map<string, string> | null = null
function staatMap(): Map<string, string> {
  if (staaten) return staaten
  const map = new Map<string, string>()
  const setze = (key: string, code: string) => {
    if (key && !map.has(key)) map.set(key, code)
  }
  // Reihenfolge = Vorrang: ISO-Codes vor IOC-Kürzeln vor Namen.
  for (const [alpha2, alpha3] of ALPHA3) {
    setze(flaggenSchluessel(alpha2), alpha2)
    setze(alpha3.toLowerCase(), alpha2)
  }
  for (const paar of IOC_STAATEN.split(' ')) {
    const [ioc, alpha2] = paar.split(':')
    setze(ioc.toLowerCase(), alpha2)
  }
  for (const [name, code] of Object.entries(STAAT_NAMEN)) for (const key of varianten(name)) setze(key, code)
  for (const [code, namen] of Object.entries(STAAT_NAMEN_FEST)) for (const name of namen) for (const key of varianten(name)) setze(key, code)
  for (const sprache of ['de', 'en']) {
    try {
      const namen = new Intl.DisplayNames([sprache], { type: 'region' })
      for (const alpha2 of ALPHA3.keys()) {
        if (alpha2.length !== 2) continue
        const name = namen.of(alpha2)
        if (name && name !== alpha2) for (const key of varianten(name)) setze(key, alpha2)
      }
    } catch {
      // Der Browser kennt die Sprache nicht – dann gelten Codes und die eigenen Namen.
    }
  }
  staaten = map
  return map
}

/** Der Staat zu einem Text als zweistelliger ISO-Code (DE; Landesteile „GB-SCT“); `''`, wenn keiner passt. */
export function staatVon(text: string): string {
  return staatMap().get(flaggenSchluessel(text)) ?? ''
}

/** Gibt es für diese Art der Herkunft überhaupt Flaggen? Für Vereine nicht. */
export function hatFlaggen(mode: OriginMode): boolean {
  return mode === 'bundesland' || mode === 'land'
}

/** Die Flagge zu einer Herkunftsangabe; `undefined` für Vereine, Leeres und nicht Erkanntes. */
export function flaggeVon(name: string, mode: OriginMode): Flagge | undefined {
  if (mode === 'bundesland') {
    const code = bundeslandVon(name)
    return code ? { art: 'bundesland', code, kuerzel: code } : undefined
  }
  if (mode === 'land') {
    const code = staatVon(name)
    return code ? { art: 'staat', code, kuerzel: ALPHA3.get(code) ?? code } : undefined
  }
  return undefined
}

/** Der ausgeschriebene Name zur Flagge – ihre Textalternative. Staaten in der gewünschten Sprache. */
export function flaggenName(flagge: Flagge, sprache: string = 'de'): string {
  if (flagge.art === 'bundesland') return BUNDESLAENDER.find((l) => l.code === flagge.code)?.name ?? flagge.code
  const eigene: Record<string, readonly [string, string]> = {
    'GB-ENG': ['England', 'England'],
    'GB-SCT': ['Schottland', 'Scotland'],
    'GB-WLS': ['Wales', 'Wales'],
    'GB-NIR': ['Nordirland', 'Northern Ireland'],
    EU: ['Europa', 'Europe'],
  }
  const fest = eigene[flagge.code] ?? STAAT_NAMEN_FEST[flagge.code]
  // Die festen Namen gehen vor: derselbe Name in jedem Browser. Andere Sprachen und Staaten liefert Intl.
  if (fest && (sprache === 'de' || sprache === 'en')) return fest[sprache === 'en' ? 1 : 0]
  try {
    return new Intl.DisplayNames([sprache], { type: 'region' }).of(flagge.code) ?? flagge.code
  } catch {
    return flagge.code
  }
}

/**
 * Herkunftsangaben, die dasselbe Land in verschiedenen Schreibweisen nennen („NRW“ neben
 * „Nordrhein-Westfalen“, „GER“ neben „Germany“): je Land die Schreibweisen, die häufigste
 * zuerst. Groß-/Kleinschreibung und Leerzeichen allein machen keine eigene Schreibweise.
 * Auf den Listen sehen sie gleich aus und in der Pokalauswertung sind sie eine Mannschaft –
 * der Starter-Reiter zeigt sie, damit der Veranstalter es weiß und vereinheitlichen kann.
 */
export function mehrfachGeschrieben(namen: readonly string[], mode: OriginMode): string[][] {
  if (!hatFlaggen(mode)) return []
  const jeLand = new Map<string, Map<string, { text: string; zahl: number }>>()
  for (const name of namen) {
    const text = name.replace(/\s+/g, ' ').trim()
    const flagge = text ? flaggeVon(text, mode) : undefined
    if (!flagge) continue
    const weisen = jeLand.get(flagge.code) ?? new Map<string, { text: string; zahl: number }>()
    jeLand.set(flagge.code, weisen)
    const eintrag = weisen.get(text.toLowerCase()) ?? { text, zahl: 0 }
    eintrag.zahl++
    weisen.set(text.toLowerCase(), eintrag)
  }
  return [...jeLand.values()]
    .filter((weisen) => weisen.size > 1)
    .map((weisen) => [...weisen.values()].sort((a, b) => b.zahl - a.zahl).map((e) => e.text))
    .sort((a, b) => a[0].localeCompare(b[0]))
}

/** Die Herkunftsangaben, zu denen es keine Flagge gibt – je Schreibweise einmal, Leeres zählt nicht. */
export function ohneFlagge(namen: readonly string[], mode: OriginMode): string[] {
  if (!hatFlaggen(mode)) return []
  const fehlend = new Map<string, string>()
  for (const name of namen) {
    const text = name.trim()
    if (text && !flaggeVon(text, mode) && !fehlend.has(text.toLowerCase())) fehlend.set(text.toLowerCase(), text)
  }
  return [...fehlend.values()].sort((a, b) => a.localeCompare(b))
}
