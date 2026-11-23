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
 * 5. Den Vermerk, dass die Zeichnung bearbeitet ist, in die Metadaten ({@link BEARBEITUNGSVERMERK}; die
 *    Parallel-Zeichnung nennt mehr Änderungen: BEARBEITUNGSVERMERK_PARALLEL, machParallel).
 *
 * `metadata` bleibt sonst, wie es ist: Dort stehen Titel, Urheber und Lizenz der Zeichnung.
 * Die Lizenzangabe darin ändert nur der Urheber, im Parcours-Repository.
 */
export function normalisiere(svg: string, vermerk: string = BEARBEITUNGSVERMERK): string {
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
  if (!out.includes(vermerk)) out = out.replace('</cc:Work>', `<dc:description>${vermerk}</dc:description></cc:Work>`)
  return out
}

// ---------------------------------------------------------------------------
// Parallelslalom-Zeichnung (R8-19, 22.11.2026; seit 23.11.2026 eine Bahn mit IDs aus dem Parcours-Repository, R9-05 bis
// R9-07; WKR_ANNAHMEN BD3, BD8–BD10)
// ---------------------------------------------------------------------------

/**
 * Die Parallelslalom-Zeichnung des Parcours-Repositorys: Ordner und Datei der Quelle, Name hier (ohne Endung).
 * Seit 23.11.2026 die Ausgabe „eine Bahn ohne Steg“ (Parcours-Commit a9c4275, split.py `split_alcatraz_bahn`, README.parallel.md):
 * nur Bahn A mit Fahrlinien, ohne Steg, Logos, Titel, Beschreibung und Maße, auf die Bahn zugeschnitten – der Ordner
 * spiegelt `dist/alcatraz_Parcours` der Klassen-Zeichnungen. Warum (Nutzer 23.11.2026, R9-06): „Die Zeichnung ist eine
 * schematische Darstellung und variiert von Standort zu Standort. Also was den Steg angeht und ob sie nebeneinander
 * passen. Daher kommt auf den Listen und auf dem Gerät nur einer der zwei Parcours und ohne Steg.“ Vorher (22.11.2026)
 * `dist/parallel/en/pontoon_bottom` mit beiden Bahnen, Stegen, Logos – verkleinert und mit IDs über die Lage.
 */
export const PARALLEL_QUELLE = { ordner: 'dist/parallel/alcatraz_Parcours', datei: 'ParallelSlalom.svg' } as const
export const PARALLEL_DATEI = 'Parallel'

/**
 * Die Bahn in der Zeichnung. Die IDs vergibt seit 23.11.2026 das Parcours-Repository selbst je Bahn (`A_…`, `B_…`,
 * Nutzer R9-05: „… mit A und B in den IDs benennen“); die Eine-Bahn-Ausgabe enthält nur `A_…`. Diese eine Bahn steht
 * für JEDEN Racecourse – A und B zeigen dasselbe Bild, welche Racecourse gemeint ist, sagt die Liste (BD9, R9-06).
 */
export const PARALLEL_BAHN = 'A'
/** Präfix der anderen Bahn: In der Eine-Bahn-Ausgabe darf nichts davon stehen (parallelBefunde). */
const ANDERE_BAHN = 'B'

/** ID der Boje n (1–5) in Parallel.svg – hin und rück dieselbe Boje (der Umschalter sagt, welche Fahrt). */
export const parallelBojeId = (n: number) => `${PARALLEL_BAHN}_Boje${n}`
/**
 * ID einer Start/Ziel-Boje (Start und Ziel sind dasselbe Tor): seiteA = die untere im Bild, seiteB = die obere –
 * dieselbe Regel wie bei den Klassen-Zeichnungen (config/kurzform.ts SEITE, bildBojeId).
 */
export const parallelStartId = (seite: 'seiteA' | 'seiteB') => `${PARALLEL_BAHN}_StartZiel_${seite === 'seiteA' ? 'unten' : 'oben'}`

/** IDs, die Parallel.svg genau einmal tragen muss: Bojen 1–5 und die beiden Start/Ziel-Bojen (die Trefferkreise). */
export const PARALLEL_PFLICHT_IDS: readonly string[] = [...[1, 2, 3, 4, 5].map(parallelBojeId), parallelStartId('seiteA'), parallelStartId('seiteB')]

/**
 * Was die Eine-Bahn-Ausgabe nicht enthalten darf: den Steg (R9-06 „ohne Steg“; im Parcours-Repository `A_Steg`/`B_Steg`
 * samt Beschriftung) und die Maße. Die zweite Bahn prüft parallelBefunde über das Präfix.
 */
const PARALLEL_NIE = ['A_Steg', 'A_Steg_Beschriftung', 'B_Steg', 'A_Abmessung', 'abmessung', 'Titel', 'Beschreibung'] as const

/**
 * Die Exportfläche der Quelle (Ebene `Export_Area` mit dem unsichtbaren Rechteck `A_Export_Area`, split.py exportiert
 * auf sie zu). Die App zieht ihren eigenen Rahmen – wie RAHMEN_ID bei den Klassen-Zeichnungen fällt sie weg.
 */
const PARALLEL_EXPORTFLAECHE = 'Export_Area'

export const BEARBEITUNGSVERMERK_PARALLEL =
  'Für Alcatraz bearbeitet: viewBox ergänzt, Exportfläche, Editor-Angaben, ungenutzte Pfeilspitzen und Verläufe ' +
  `entfernt, Ausweichschriften ergänzt. Lizenz: ${ERWARTETE_LIZENZ.name}, ${ERWARTETE_LIZENZ.url}`

/** Befunde von parallelBefunde, die eine Pflicht-ID selbst betreffen (fehlt, steht mehrfach) – nicht ihre Lage. */
const PFLICHT_ID_BEFUND = /^(\S+) (?:fehlt|steht \d+-mal)$/

/** Höchstgröße von Parallel.svg nach dem Sync (heute rund 13 KB; darüber bricht der Sync ab – etwa bei Rasterbildern). */
export const PARALLEL_MAX_BYTES = 60 * 1024

interface Punkt {
  x: number
  y: number
}

const zahl = (s: string | undefined) => (s === undefined ? NaN : Number(s))

/** Nur `translate(x[,y])`; alles andere (rotate, matrix) → `null`. Ohne Transform (0, 0). */
function verschiebung(tag: string): Punkt | null {
  const t = /\btransform="([^"]*)"/.exec(tag)?.[1]
  if (!t) return { x: 0, y: 0 }
  const m = /^\s*translate\(\s*([-\d.e]+)(?:[\s,]+([-\d.e]+))?\s*\)\s*$/.exec(t)
  return m ? { x: zahl(m[1]), y: m[2] === undefined ? 0 : zahl(m[2]) } : null
}

/**
 * Die Lage jedes Pfads bzw. Texts mit ID in Koordinaten der Wurzel – ein kleiner Gang durch die Tags ohne DOM (dieselbe
 * Datei läuft im Sync unter Node). Lage eines Pfads = sein erster Punkt (`m x,y`; die Bojen-Kreise der Quelle beginnen
 * rechts außen), eines Texts x/y, jeweils samt Verschiebungen der Eltern; `null`, wo ein Elternteil anders transformiert
 * ist. Für parallelBefunde reicht das: Geprüft wird nur, ob die Bojen im Ausschnitt liegen.
 */
function lagen(svg: string): Map<string, Punkt | null> {
  const out = new Map<string, Punkt | null>()
  const stapel: { tag: string; v: Punkt | null }[] = []
  for (const m of svg.matchAll(/<(\/?)([A-Za-z][\w:.-]*)\b([^>]*?)(\/?)>/g)) {
    const [ganz, zu, tag, , selbst] = m
    if (zu) {
      for (let i = stapel.length - 1; i >= 0; i--)
        if (stapel[i].tag === tag) {
          stapel.length = i
          break
        }
      continue
    }
    const v = verschiebung(ganz)
    const id = /\bid="([^"]*)"/.exec(ganz)?.[1]
    if (id && (tag === 'path' || tag === 'text')) {
      const d = /\bd="\s*[mM]\s*([-\d.e]+)[\s,]+([-\d.e]+)/.exec(ganz)
      const p = tag === 'path' ? (d ? { x: zahl(d[1]), y: zahl(d[2]) } : null) : { x: zahl(/\bx="([-\d.e]+)"/.exec(ganz)?.[1]), y: zahl(/\by="([-\d.e]+)"/.exec(ganz)?.[1]) }
      let lage: Punkt | null = p && Number.isFinite(p.x) && Number.isFinite(p.y) && v ? { x: p.x + v.x, y: p.y + v.y } : null
      for (const s of stapel) lage = lage && s.v ? { x: lage.x + s.v.x, y: lage.y + s.v.y } : null
      out.set(id, lage)
    }
    if (!selbst) stapel.push({ tag, v })
  }
  return out
}

/** Ein Element samt Inhalt entfernen (geschachtelte gleichnamige Tags mitgezählt). */
function entferne(svg: string, id: string): string {
  const start = new RegExp(`<([A-Za-z][\\w:.-]*)\\b[^>]*\\bid="${id}"[^>]*?(/?)>`).exec(svg)
  if (!start) return svg
  const [kopf, tag, selbst] = start
  if (selbst) return svg.slice(0, start.index) + svg.slice(start.index + kopf.length)
  const muster = new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`, 'g')
  muster.lastIndex = start.index + kopf.length
  let tiefe = 1
  for (let m = muster.exec(svg); m; m = muster.exec(svg)) {
    if (m[1]) tiefe--
    else if (!m[2]) tiefe++
    if (tiefe === 0) return svg.slice(0, start.index) + svg.slice(m.index + m[0].length)
  }
  return svg
}

/**
 * Macht die Eine-Bahn-Zeichnung aus `Parcours/dist/parallel/alcatraz_Parcours/ParallelSlalom.svg` für Alcatraz zurecht
 * (Sync). Seit 23.11.2026 ohne Umbenennen und ohne Zuschnitt – beides macht das Parcours-Repository (R9-05): die
 * Exportfläche weg, ungenutzte Marker/Verläufe und Inkscape-Schriftangaben weg, ein Namensraum `ns2:` der Metadaten als
 * `cc:` (ältere Inkscape-Ausgaben; sonst fände metadaten() Titel, Urheber und Lizenz nicht), dann wie die
 * Klassen-Zeichnungen (normalisiere mit eigenem Vermerk: viewBox aus Breite × Höhe). `metadata` bleibt: Titel, Urheber
 * und Lizenz reisen mit der Datei (CC BY-NC-SA 4.0 Abschnitt 3(a)(1)). Zweimal angewandt ändert sich nichts.
 * `fehler` = parallelBefunde des Ergebnisses (Pflicht-IDs, zweite Bahn, Steg, Rasterbild, Größe, Lage) – der Sync
 * schreibt dann nichts.
 */
export function machParallel(roh: string): { text: string; fehler: string[] } {
  let s = entferne(roh, PARALLEL_EXPORTFLAECHE)
  // Ungenutzte Marker und Verläufe (die Quelle schleppt sie aus dem Master mit).
  for (const m of [...s.matchAll(/<(marker|linearGradient|radialGradient)\b[^>]*\bid="([^"]+)"/g)]) {
    const id = m[2]
    if (!s.includes(`url(#${id})`) && !s.includes(`href="#${id}"`)) s = entferne(s, id)
  }
  s = s.replace(/-inkscape-font-specification:[^;"]*;?/g, '')
  s = s.replace(/xmlns:ns2=/, 'xmlns:cc=').replace(/<(\/?)ns2:/g, '<$1cc:').replace(/\bns2:/g, 'cc:')
  const text = normalisiere(s, BEARBEITUNGSVERMERK_PARALLEL)
  const fehler = parallelBefunde(text)
  if (!text.includes('<metadata')) fehler.push('Metadaten (Urheber, Lizenz) fehlen')
  // Klar sagen, woher die IDs kommen müssen: Die App setzt keine mehr selbst (R9-05, 23.11.2026). Nur wenn eine fehlt
  // oder doppelt steht – nicht beim Lagebefund „… liegt außerhalb des Ausschnitts“: Da stimmen die IDs, nur der Rahmen
  // A_Export_Area (bzw. die Boje) im Parcours-Repository nicht; der Hinweis schickte die Suche in die falsche Richtung
  // (Prüfbefund 23.11.2026).
  if (fehler.some((f) => PARALLEL_PFLICHT_IDS.includes(PFLICHT_ID_BEFUND.exec(f)?.[1] ?? '')))
    fehler.push(
      `Pflicht-IDs der Eine-Bahn-Ausgabe: ${PARALLEL_PFLICHT_IDS.join(', ')} – sie vergibt das Parcours-Repository (parallel.svg, README.parallel.md), die App setzt keine selbst`,
    )
  return { text, fehler }
}

/**
 * Was an der fertigen Parallel.svg nicht stimmt: Pflicht-IDs nicht genau einmal, Teile der zweiten Bahn (`B_…`), Steg
 * oder Maße (R9-06 „nur einer der zwei Parcours und ohne Steg“), Rasterbild, Größe, kein viewBox, Bojen außerhalb.
 */
export function parallelBefunde(svg: string): string[] {
  const out: string[] = []
  for (const id of PARALLEL_PFLICHT_IDS) {
    const n = anzahl(svg, id)
    if (n !== 1) out.push(n === 0 ? `${id} fehlt` : `${id} steht ${n}-mal`)
  }
  const fremd = [...svg.matchAll(new RegExp(`\\bid="(${ANDERE_BAHN}_[^"]*)"`, 'g'))].map((m) => m[1])
  if (fremd.length > 0) out.push(`enthält die zweite Bahn (${fremd.slice(0, 3).join(', ')}${fremd.length > 3 ? ' …' : ''}) – erwartet ist nur eine`)
  for (const id of PARALLEL_NIE) if (anzahl(svg, id) > 0) out.push(`enthält ${id} – erwartet ist eine Bahn ohne Steg und Maße`)
  if (/<image\b/.test(svg)) out.push('enthält ein Rasterbild (<image)')
  const bytes = new TextEncoder().encode(svg).length
  if (bytes > PARALLEL_MAX_BYTES) out.push(`${Math.round(bytes / 1024)} KB, mehr als ${PARALLEL_MAX_BYTES / 1024} KB`)
  const vb = /<svg\b[^>]*\bviewBox="([^"]+)"/.exec(svg)?.[1].split(/[\s,]+/).map(Number)
  if (!vb || vb.length !== 4 || !vb.every(Number.isFinite)) out.push('kein viewBox')
  else {
    // Mitte einer Boje ≈ erster Punkt − Radius (die Kreise beginnen rechts außen, r ≈ 7); sie muss im Bild liegen.
    const lage = lagen(svg)
    for (const id of PARALLEL_PFLICHT_IDS) {
      const p = lage.get(id)
      if (p && (p.x - 7 < vb[0] || p.x - 7 > vb[0] + vb[2] || p.y < vb[1] || p.y > vb[1] + vb[3])) out.push(`${id} liegt außerhalb des Ausschnitts`)
    }
  }
  return out
}
