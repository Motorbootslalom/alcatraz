import { IOC_FRUEHER, IOC_NUR_AUSGABE, IOC_STAATEN, ISO_STAATEN } from './staaten'

/**
 * Kürzel für die Herkunft (Verein, Bundesland, Land, Gruppe).
 *
 * Für deutsche Bundesländer und für Länder gibt es Vorgaben: Bundesländer mit dem Code aus
 * ISO 3166-2:DE ohne das „DE-“ (BY, NW …), Länder nach der Norm des Regelwerks
 * ({@link KuerzelNorm}). Vereine und Gruppen pflegt der Veranstalter selbst; eigene Einträge
 * gehen immer vor.
 */

/**
 * Welche dreistelligen Kürzel Länder bekommen – eine Angabe des Regelwerks (`laenderKuerzel`):
 *
 * - `ioc`: das Kürzel des IOC (GER, SUI, NED), sonst wie ISO. Das UIM-Rulebook verlangt es für
 *   die Wertungslisten, Regel 209 „POSTING OF THE RESULTS“: „The nationality of all drivers –
 *   either by using a three letter abbreviation for the countries worldwide as listed by the
 *   IOC or as full names of the nations in English language.“ Im Zweifel gilt das Regelbuch.
 *   Auch die DM nimmt es (Entscheidung des Nutzers vom 15.11.2026: Der Verband gehört zum
 *   Olympischen Sportbund) – beide Regelwerke nennen `ioc` in ihrem YAML.
 * - `iso`: der Code aus ISO 3166-1 alpha-3 (DEU, CHE, NLD); bis zum 15.11.2026 die Norm der DM
 *   (Festlegung vom 12.11.2026). Bleibt die Vorgabe eines Regelwerks ohne Angabe.
 */
export type KuerzelNorm = 'iso' | 'ioc'

export function istKuerzelNorm(wert: unknown): wert is KuerzelNorm {
  return wert === 'iso' || wert === 'ioc'
}

let iocAusgabe: Map<string, string> | null = null

/**
 * Das Kürzel des IOC zu einem zweistelligen ISO-Code, wo es vom dreistelligen ISO-Code abweicht
 * (DE → GER); sonst `undefined` – dann gilt der ISO-Code (AUT, ITA, POL).
 */
export function iocKuerzel(alpha2: string): string | undefined {
  if (!iocAusgabe) {
    const frueher = new Set(IOC_FRUEHER.split(' '))
    const map = new Map<string, string>()
    for (const paar of [...IOC_STAATEN.split(' '), ...IOC_NUR_AUSGABE.split(' ')]) {
      const [ioc, code] = paar.split(':')
      if (!frueher.has(ioc)) map.set(code, ioc)
    }
    iocAusgabe = map
  }
  return iocAusgabe.get(alpha2)
}
export const BUNDESLAENDER: readonly { code: string; name: string }[] = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
]

/** Namen vergleichbar machen: Groß-/Kleinschreibung, Leerzeichen und Bindestriche zählen nicht. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s\-_.]+/g, ' ').trim()
}

const defaults = new Map<KuerzelNorm, Map<string, string>>()

function defaultMap(norm: KuerzelNorm): Map<string, string> {
  const bekannt = defaults.get(norm)
  if (bekannt) return bekannt
  const map = new Map<string, string>()
  // Länder zuerst, damit ein gleichnamiges Bundesland sie überschreibt (es gibt keins, aber so herum ist es richtig).
  for (const pair of ISO_STAATEN.split(' ')) {
    const [alpha2, alpha3] = pair.split(':')
    const kuerzel = (norm === 'ioc' ? iocKuerzel(alpha2) : undefined) ?? alpha3
    for (const language of ['de', 'en']) {
      try {
        const name = new Intl.DisplayNames([language], { type: 'region' }).of(alpha2)
        if (name && name !== alpha2) map.set(normalizeName(name), kuerzel)
      } catch {
        // Der Browser kennt die Sprache oder das Land nicht – dann eben ohne Vorgabe.
      }
    }
  }
  for (const land of BUNDESLAENDER) map.set(normalizeName(land.name), land.code)
  map.set('nrw', 'NW')
  defaults.set(norm, map)
  return map
}

/** Das vorgegebene Kürzel für ein Bundesland oder Land (Länder nach `norm`); `''`, wenn es keine Vorgabe gibt. */
export function defaultKuerzel(name: string, norm: KuerzelNorm = 'iso'): string {
  return defaultMap(norm).get(normalizeName(name)) ?? ''
}

/** Der eigene Eintrag des Veranstalters zu einem Namen; `''`, wenn es keinen gibt. */
export function eigenesKuerzel(name: string, own: Record<string, string>): string {
  const key = normalizeName(name)
  for (const [entry, short] of Object.entries(own)) {
    if (short.trim() && normalizeName(entry) === key) return short.trim()
  }
  return ''
}

/**
 * Das Kürzel zu einem Namen: der eigene Eintrag, sonst die Vorgabe (Länder nach `norm`), sonst
 * `''`. `own` ist die Tabelle des Veranstalters (Name → Kürzel).
 */
export function kuerzelOf(name: string, own: Record<string, string>, norm: KuerzelNorm = 'iso'): string {
  return eigenesKuerzel(name, own) || defaultKuerzel(name, norm)
}
