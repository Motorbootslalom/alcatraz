/**
 * Kürzel für die Herkunft (Verein, Bundesland, Land, Gruppe).
 *
 * Für deutsche Bundesländer und für Länder gibt es Vorgaben nach ISO 3166:
 * Bundesländer mit dem Code aus ISO 3166-2:DE ohne das „DE-“ (BY, NW …),
 * Länder mit dem dreistelligen Code aus ISO 3166-1 (DEU, AUT …). Vereine und
 * Gruppen pflegt der Veranstalter selbst; eigene Einträge gehen immer vor.
 */
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

/** ISO 3166-1: zweistelliger → dreistelliger Ländercode. Die Namen liefert der Browser (Intl). */
const COUNTRIES =
  'AD:AND AE:ARE AL:ALB AM:ARM AR:ARG AT:AUT AU:AUS AZ:AZE BA:BIH BE:BEL BG:BGR BH:BHR BR:BRA BY:BLR CA:CAN ' +
  'CH:CHE CL:CHL CN:CHN CO:COL CY:CYP CZ:CZE DE:DEU DK:DNK DZ:DZA EE:EST EG:EGY ES:ESP FI:FIN FR:FRA GB:GBR ' +
  'GE:GEO GR:GRC HR:HRV HU:HUN ID:IDN IE:IRL IL:ISR IN:IND IS:ISL IT:ITA JP:JPN KR:KOR KW:KWT KZ:KAZ LI:LIE ' +
  'LT:LTU LU:LUX LV:LVA MA:MAR MC:MCO MD:MDA ME:MNE MK:MKD MT:MLT MX:MEX MY:MYS NL:NLD NO:NOR NZ:NZL OM:OMN ' +
  'PL:POL PT:PRT QA:QAT RO:ROU RS:SRB RU:RUS SA:SAU SE:SWE SG:SGP SI:SVN SK:SVK SM:SMR TH:THA TN:TUN TR:TUR ' +
  'UA:UKR US:USA UZ:UZB VN:VNM XK:XKX ZA:ZAF'

/** Namen vergleichbar machen: Groß-/Kleinschreibung, Leerzeichen und Bindestriche zählen nicht. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[\s\-_.]+/g, ' ').trim()
}

let defaults: Map<string, string> | null = null

function defaultMap(): Map<string, string> {
  if (defaults) return defaults
  const map = new Map<string, string>()
  // Länder zuerst, damit ein gleichnamiges Bundesland sie überschreibt (es gibt keins, aber so herum ist es richtig).
  for (const pair of COUNTRIES.split(' ')) {
    const [alpha2, alpha3] = pair.split(':')
    for (const language of ['de', 'en']) {
      try {
        const name = new Intl.DisplayNames([language], { type: 'region' }).of(alpha2)
        if (name && name !== alpha2) map.set(normalizeName(name), alpha3)
      } catch {
        // Der Browser kennt die Sprache oder das Land nicht – dann eben ohne Vorgabe.
      }
    }
  }
  for (const land of BUNDESLAENDER) map.set(normalizeName(land.name), land.code)
  map.set('nrw', 'NW')
  defaults = map
  return map
}

/** Kürzel nach ISO für ein Bundesland oder Land; `''`, wenn es keine Vorgabe gibt. */
export function defaultKuerzel(name: string): string {
  return defaultMap().get(normalizeName(name)) ?? ''
}

/**
 * Das Kürzel zu einem Namen: der eigene Eintrag, sonst die ISO-Vorgabe, sonst
 * `''`. `own` ist die Tabelle des Veranstalters (Name → Kürzel).
 */
export function kuerzelOf(name: string, own: Record<string, string>): string {
  const key = normalizeName(name)
  for (const [entry, short] of Object.entries(own)) {
    if (short.trim() && normalizeName(entry) === key) return short.trim()
  }
  return defaultKuerzel(name)
}
