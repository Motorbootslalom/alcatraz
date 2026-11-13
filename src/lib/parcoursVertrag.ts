// Der Vertrag zwischen den Parcours-Zeichnungen (src/assets/parcours) und dem Code: welche
// Dateien es gibt, welche IDs darin stehen müssen und wie eine Zeichnung aus dem
// Parcours-Repository für Alcatraz zurechtgemacht wird.
//
// Bewusst ohne jeden Import und ohne DOM: Dieselbe Datei läuft im Browser, im Test und in
// scripts/parcours-sync.ts (Node ohne Bundler).

/** Die eingecheckten Zeichnungen (Dateiname ohne Endung): Klasse E, 1–7 und die Kursvariante Möwe. */
export const PARCOURS_DATEIEN = [
  'KlasseE',
  'Klasse1',
  'Klasse2',
  'Klasse3',
  'Klasse4',
  'Klasse5',
  'Klasse6',
  'Klasse7',
  'Klasse5_Moewe',
  'Klasse6_Moewe',
  'Klasse7_Moewe',
] as const

const TORE_1_4 = [1, 2, 3, 4]

/** IDs, die jede Zeichnung genau einmal tragen muss: Abblenden und „Zuordnen im Bild“ hängen daran. */
export const PFLICHT_IDS: readonly string[] = [
  'StartZiel',
  'StartZiel_oben',
  'StartZiel_unten',
  'Zeitnahme',
  ...TORE_1_4.flatMap((n) => [`Tor${n}`, `Tor${n}_innen`, `Tor${n}_aussen`]),
  'Tor5',
  'Tor5_oben',
  'Tor5_unten',
  'Schikane',
  ...[1, 2, 3, 4, 5].map((n) => `Nummer_Tor${n}`),
  'Nummer_Schikane',
  'Speedboje_oben',
  'Nummer_Speedboje_oben',
]

/** IDs, die nicht in jedem Klassenbild vorkommen: Die untere Speedboje zeigt der
 *  Master-Export nur dort, wo die Route um sie herumführt. */
export const OPTIONALE_IDS: ReadonlySet<string> = new Set(['Speedboje_unten', 'Nummer_Speedboje_unten'])

/** Der gestrichelte Rahmen der Quelle. Im Master legt er die Exportfläche fest (split.py:
 *  `--export-id Export_Area`), darum steht er in jeder Kopie. Die App zieht ihren eigenen. */
export const RAHMEN_ID = 'rect4816'

/** Marker, die der Master mitschleppt, aber keine Zeichnung benutzt. */
const UNGENUTZTE_MARKER = ['RazorWire', 'Scissors', 'Legs']

/** Ausweichschriften: Ohne Verdana (Android, viele Linux-Rechner) fiele die Ziffer in den Bojen sonst in eine Serifenschrift. */
const AUSWEICH = ",'DejaVu Sans',sans-serif"

/**
 * Die Lizenz der Zeichnungen laut README, LICENSE und Metadaten des Parcours-Repositorys.
 * `parcours:sync` vergleicht damit, was in den Metadaten der Dateien steht, und schreibt sie
 * nach QUELLE.json – von dort nimmt die Oberfläche die Namensnennung.
 */
export const ERWARTETE_LIZENZ = { name: 'CC BY-NC-SA 4.0', url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' } as const

/**
 * Der Vermerk, dass die Zeichnung bearbeitet ist (CC BY-NC-SA 4.0 Abschnitt 3(a)(1)(B)). Er steht
 * in den Metadaten jeder Datei, damit er auch dort mitreist, wo niemand LICENSE.md sieht: in
 * der gebauten App.
 */
export const BEARBEITUNGSVERMERK =
  'Für Alcatraz bearbeitet: viewBox ergänzt, Editor-Angaben, ungenutzte Pfeilspitzen und Rahmen der Exportfläche entfernt, ' +
  `Ausweichschriften ergänzt. Lizenz: ${ERWARTETE_LIZENZ.name}, ${ERWARTETE_LIZENZ.url}`

/** Titel, Urheber und Lizenz-Adresse aus den Metadaten einer Zeichnung; was fehlt, ist leer. */
export function metadaten(svg: string): { titel: string; urheber: string; lizenzUrl: string } {
  const werk = svg.match(/<cc:Work\b[\s\S]*?<\/cc:Work>/)?.[0] ?? ''
  const urheber = werk.match(/<dc:creator>\s*<cc:Agent>\s*<dc:title>([^<]*)<\/dc:title>/)?.[1] ?? ''
  // Der Titel des Werks ist der `dc:title`, der nicht zu einer Person (`cc:Agent`) gehört.
  const titel = werk.replace(/<cc:Agent>[\s\S]*?<\/cc:Agent>/g, '').match(/<dc:title>([^<]*)<\/dc:title>/)?.[1] ?? ''
  const lizenzUrl = werk.match(/<cc:license\s+rdf:resource="([^"]*)"/)?.[1] ?? ''
  return { titel: titel.trim(), urheber: urheber.trim(), lizenzUrl }
}

/** Dieselbe Lizenz, auch wenn die eine Adresse mit http und die andere mit https beginnt? */
export function gleicheLizenz(a: string, b: string): boolean {
  const kern = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return kern(a) === kern(b)
}

const anzahl = (svg: string, id: string) => svg.split(`id="${id}"`).length - 1

/** Was am ID-Vertrag nicht stimmt: fehlende und mehrfach vergebene Pflicht-IDs, mehrfache optionale. */
export function vertragsBefunde(svg: string): string[] {
  const out: string[] = []
  for (const id of PFLICHT_IDS) {
    const n = anzahl(svg, id)
    if (n === 0) out.push(`${id} fehlt`)
    else if (n > 1) out.push(`${id} steht ${n}-mal`)
  }
  for (const id of OPTIONALE_IDS) if (anzahl(svg, id) > 1) out.push(`${id} steht ${anzahl(svg, id)}-mal`)
  return out
}

/**
 * Macht eine Zeichnung aus `Parcours/dist/alcatraz_Parcours` für Alcatraz zurecht. Zweimal
 * angewandt ändert sich nichts mehr; so lässt sich im Test prüfen, dass die eingecheckten
 * Dateien durch diesen Schritt gelaufen sind.
 *
 * 1. `viewBox` aus Breite und Höhe ergänzen: ohne ihn skaliert das Bild eingebettet nicht.
 * 2. Editor-Ballast entfernen (`sodipodi:namedview`, `sodipodi:docname`, ungenutzte Marker).
 *    Der Name der Temp-Datei in `docname` ändert sich bei jedem Export und machte Diffs unruhig.
 * 3. Den Rahmen der Exportfläche entfernen.
 * 4. Ausweichschriften hinter Verdana und Arial Black.
 * 5. Den Vermerk, dass die Zeichnung bearbeitet ist, in die Metadaten ({@link BEARBEITUNGSVERMERK}).
 *
 * `metadata` bleibt sonst, wie es ist: Dort stehen Titel, Urheber und Lizenz der Zeichnung.
 * Die Lizenzangabe darin ändert nur der Urheber, im Parcours-Repository.
 */
export function normalisiere(svg: string): string {
  let out = svg
  // 1. viewBox
  const wurzel = out.match(/<svg\b[^>]*>/)?.[0] ?? ''
  if (wurzel && !/\bviewBox=/.test(wurzel)) {
    const breite = wurzel.match(/\bwidth="([\d.]+)"/)?.[1]
    const hoehe = wurzel.match(/\bheight="([\d.]+)"/)?.[1]
    if (breite && hoehe) out = out.replace(/<svg\b/, `<svg\n   viewBox="0 0 ${breite} ${hoehe}"`)
  }
  // 2. Editor-Ballast
  out = out.replace(/<sodipodi:namedview\b[^>]*?(\/>|>[\s\S]*?<\/sodipodi:namedview>)/, '')
  out = out.replace(/\s+sodipodi:docname="[^"]*"/, '')
  for (const id of UNGENUTZTE_MARKER) {
    if (out.includes(`url(#${id})`)) continue
    out = out.replace(new RegExp(`<marker\\b[^>]*\\bid="${id}"[^>]*>[\\s\\S]*?</marker>`), '')
  }
  // Die Namensräume der Editoren nur streichen, wenn sonst nichts mehr aus ihnen stammt.
  for (const ns of ['sodipodi', 'inkscape']) {
    const ohneDeklaration = out.replace(new RegExp(`\\s+xmlns:${ns}="[^"]*"`), '')
    if (!ohneDeklaration.includes(`${ns}:`)) out = ohneDeklaration
  }
  // 3. Rahmen
  out = out.replace(new RegExp(`<path\\b[^>]*\\bid="${RAHMEN_ID}"[^>]*/>`), '')
  // 4. Schriften (nur wo noch keine Ausweichschrift steht)
  out = out.replace(/font-family:(verdana|'Arial Black')(?=[;"])/gi, (_, schrift: string) => `font-family:${schrift}${AUSWEICH}`)
  // 5. Bearbeitungsvermerk (nur einmal)
  if (!out.includes(BEARBEITUNGSVERMERK)) out = out.replace('</cc:Work>', `<dc:description>${BEARBEITUNGSVERMERK}</dc:description></cc:Work>`)
  return out
}
