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
// Parallelslalom-Zeichnung (R8-19, Plan docs/plan-antworten-runde7-8.md §5, 22.11.2026; WKR_ANNAHMEN BD3, BD8–BD10)
// ---------------------------------------------------------------------------

/**
 * Die Parallelslalom-Zeichnung des Parcours-Repositorys: Ordner und Datei der Quelle, Name hier (ohne Endung). Die
 * Quelle zeigt zwei Bahnen übereinander, die Stege links unter den Bahnen – „pontoon_bottom“ wie die Klassen-SVGs.
 * Mit Fahrlinien statt `Parcours.svg` („empty course“): Sie zeigen Hin- und Rückweg wie die Klassen-Zeichnungen und
 * stören die Trefferkreise nicht (beim Bau 22.11.2026 angesehen).
 */
export const PARALLEL_QUELLE = { ordner: 'dist/parallel/en/pontoon_bottom', datei: 'ParallelSlalom.svg' } as const
export const PARALLEL_DATEI = 'Parallel'

export type ParallelBahn = 'A' | 'B'
export const PARALLEL_BAHNEN: readonly ParallelBahn[] = ['A', 'B']

/** ID einer Boje (1–5) bzw. einer Start/Ziel-Boje einer Bahn in Parallel.svg (BD8). */
export const parallelBojeId = (bahn: ParallelBahn, n: number) => `P_${bahn}_b${n}`
export const parallelStartId = (bahn: ParallelBahn, seite: 'seiteA' | 'seiteB') => `P_${bahn}_start_${seite}`
/** Präfix aller Teile einer Bahn (Bojen, Start/Ziel, Fahrlinien, Ziffern) – zum Dimmen der fremden Bahn (BD10). */
export const parallelBahnPraefix = (bahn: ParallelBahn) => `P_${bahn}_`

/** IDs, die Parallel.svg genau einmal tragen muss: je Bahn Bojen 1–5 und die beiden Start/Ziel-Bojen. */
export const PARALLEL_PFLICHT_IDS: readonly string[] = PARALLEL_BAHNEN.flatMap((b) => [
  ...[1, 2, 3, 4, 5].map((n) => parallelBojeId(b, n)),
  parallelStartId(b, 'seiteA'),
  parallelStartId(b, 'seiteB'),
])

/** Die Bojen 1–5 der unteren Bahn tragen IDs aus dem Manövrierparcours (orange, gleiche Lage wie dort). */
const UNTERE_BOJEN = ['Tor1_aussen', 'Tor2_innen', 'Tor3_aussen', 'Tor4_innen', 'Tor5_unten'] as const

/**
 * Was beim Sync aus der Parallel-Zeichnung fällt (≈ 450 KB von 493 KB): die Gruppe `LogoEN` (zwei eingebettete
 * Rasterbilder), Titel und Beschreibung (`text1016`, `text1026`), die Maße (`abmessung`) samt Satz „the dimensions
 * shown are approximate values“ (`g4772`) – auf dem Gerät zählt nur, wo die Bojen liegen.
 */
const PARALLEL_WEG = ['LogoEN', 'text1016', 'text1026', 'abmessung', 'g4772'] as const

/**
 * Ausschnitt nach dem Entfernen (viewBox, Einheiten der Quelle): beide Bahnen samt Stegen, „Start/Finish“ und
 * Fahrlinien, gemessen mit `inkscape --query-all` am Stand 9b92e69 (22.11.2026: Inhalt x 14,7–931, y 192–590). Ohne ihn
 * bliebe ein Drittel der Seite leer (Titel, Logos), und die Bojen würden auf dem Gerät entsprechend kleiner. Der Sync
 * prüft, dass jede Boje mit Rand darin liegt (parallelBefunde).
 */
export const PARALLEL_AUSSCHNITT = { x: 8, y: 186, breite: 934, hoehe: 410 } as const

export const BEARBEITUNGSVERMERK_PARALLEL =
  'Für Alcatraz bearbeitet: Logos, Titel, Beschreibung und Maße entfernt, Ausschnitt verkleinert, IDs der Bojen, ' +
  'Start/Ziel-Bojen, Fahrlinien und Ziffern je Bahn gesetzt (P_A_…, P_B_…), Editor-Angaben und ungenutzte ' +
  `Pfeilspitzen entfernt, Ausweichschriften ergänzt. Lizenz: ${ERWARTETE_LIZENZ.name}, ${ERWARTETE_LIZENZ.url}`

/** Höchstgröße von Parallel.svg nach dem Sync (Ziel < 60 KB; darüber bricht der Sync ab). */
export const PARALLEL_MAX_BYTES = 100 * 1024

interface Punkt {
  x: number
  y: number
}

/** Ein Element der Quelle mit seiner Lage (erster Punkt des Pfads bzw. x/y des Texts, samt Verschiebungen der Eltern). */
interface Element {
  tag: string
  id: string
  /** Lage in Koordinaten der Wurzel; `null`, wenn ein Elternteil anders als verschoben ist (Drehung). */
  lage: Punkt | null
  /** Die IDs der umgebenden Gruppen, innen zuletzt. */
  gruppen: string[]
  /** Kreis-Pfad (geschlossen, mit Kurven) wie die Bojen. */
  kreis: boolean
  /** Erster Pfad bzw. Text direkt in einer Gruppe mit eigener Verschiebung (Start/Ziel-Kreise). */
  inGruppe: string | null
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
 * Alle Elemente mit ID samt Lage – ein kleiner Gang durch die Tags ohne DOM (dieselbe Datei läuft im Sync unter Node).
 * Die Lage eines Pfads ist sein erster Punkt (`m x,y`), die eines Texts x/y; Kreise der Quelle beginnen rechts außen
 * (Mitte = x − r). Für die Zuordnung reicht das: Verglichen werden nur gleichartige Kreise untereinander.
 */
function elemente(svg: string): Element[] {
  const out: Element[] = []
  const stapel: { tag: string; id: string; v: Punkt | null }[] = []
  const summe = (): Punkt | null => {
    let x = 0
    let y = 0
    for (const s of stapel) {
      if (!s.v) return null
      x += s.v.x
      y += s.v.y
    }
    return { x, y }
  }
  for (const m of svg.matchAll(/<(\/?)([A-Za-z][\w:.-]*)\b([^>]*?)(\/?)>/g)) {
    const [ganz, zu, tag, , selbst] = m
    if (zu) {
      for (let i = stapel.length - 1; i >= 0; i--) if (stapel[i].tag === tag) {
        stapel.length = i
        break
      }
      continue
    }
    const id = /\bid="([^"]*)"/.exec(ganz)?.[1] ?? ''
    const v = verschiebung(ganz)
    if (id && (tag === 'path' || tag === 'text')) {
      const basis = summe()
      const eigen = v
      let p: Punkt | null = null
      if (tag === 'path') {
        const d = /\bd="\s*[mM]\s*([-\d.e]+)[\s,]+([-\d.e]+)/.exec(ganz)
        if (d) p = { x: zahl(d[1]), y: zahl(d[2]) }
      } else {
        p = { x: zahl(/\bx="([-\d.e]+)"/.exec(ganz)?.[1]), y: zahl(/\by="([-\d.e]+)"/.exec(ganz)?.[1]) }
      }
      const lage = basis && eigen && p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: basis.x + eigen.x + p.x, y: basis.y + eigen.y + p.y } : null
      const d = /\bd="([^"]*)"/.exec(ganz)?.[1] ?? ''
      const oben = stapel.at(-1)
      out.push({
        tag,
        id,
        lage,
        gruppen: stapel.map((s) => s.id),
        kreis: tag === 'path' && /c/i.test(d) && /z\s*$/i.test(d),
        inGruppe: oben && oben.tag === 'g' && oben.v && (oben.v.x !== 0 || oben.v.y !== 0) ? oben.id : null,
      })
    }
    if (!selbst) stapel.push({ tag, id, v })
  }
  return out
}

/** Ergebnis der Zuordnung: alte ID → neue ID, und welche Bahn der Quelle (oben/unten) Racecourse A ist. */
export interface ParallelZuordnung {
  ids: Record<string, string>
  /** Racecourse A in der Quelle: die obere oder die untere Bahn (BD9). */
  bahnA: 'oben' | 'unten'
}

const mittel = (ps: Punkt[]): Punkt => ({ x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length })

/**
 * Ordnet die Teile der Parallel-Zeichnung ihren Bahnen zu (BD8, 22.11.2026, noch zu bestätigen – ohne Änderung am
 * Parcours-Repository):
 * - untere Bahn: Bojen 1–5 über die vorhandenen IDs Tor1_aussen, Tor2_innen, Tor3_aussen, Tor4_innen, Tor5_unten;
 * - obere Bahn: je Boje die Kopie (Kreis in `layer6`) mit gleichem x (± 1) – alle mit demselben Versatz in y (± 1);
 * - Start/Ziel: die Kreise in eigenen verschobenen Gruppen in `layer6` (g13156/g13172, g17522/g17526), je Bahn die
 *   beiden nächstgelegenen; seiteA = die untere im Bild, seiteB = die obere (config/kurzform.ts SEITE);
 * - Fahrlinien (Pfade in `ParallelSlalom` und Linien in `layer6`) und Ziffern (`ParcoursLabel`) nach der nächsten Bahn.
 * Racecourse A ist die Bahn, die vom Steg aus in Fahrtrichtung (Start → Boje 5) LINKS liegt (BD9, wie die Vorgabe der
 * Tafel „A links, B rechts“) – gerechnet aus den Lagen, nicht geraten. Fehler als Sätze; dann `null`.
 */
export function parallelZuordnung(svg: string): { zuordnung: ParallelZuordnung | null; fehler: string[] } {
  const fehler: string[] = []
  const alle = elemente(svg)
  const imLayer = alle.filter((e) => e.gruppen.includes('layer6'))
  const nachId = new Map(alle.map((e) => [e.id, e]))
  const unten: Element[] = []
  for (const id of UNTERE_BOJEN) {
    const e = nachId.get(id)
    if (!e || !e.lage || !e.kreis) fehler.push(`${id}: keine Boje (Kreis mit Lage) gefunden`)
    else unten.push(e)
  }
  if (fehler.length) return { zuordnung: null, fehler }
  const kopien = imLayer.filter((e) => e.kreis && !e.inGruppe && e.lage && !UNTERE_BOJEN.includes(e.id as (typeof UNTERE_BOJEN)[number]))
  const oben: Element[] = []
  for (const b of unten) {
    const treffer = kopien.filter((k) => Math.abs(k.lage!.x - b.lage!.x) <= 1 && Math.abs(k.lage!.y - b.lage!.y) > 1)
    if (treffer.length !== 1) fehler.push(`${b.id}: ${treffer.length} Kopien mit gleichem x statt genau einer`)
    else oben.push(treffer[0])
  }
  if (fehler.length) return { zuordnung: null, fehler }
  const versatz = oben.map((o, i) => o.lage!.y - unten[i].lage!.y)
  if (versatz.some((v) => Math.abs(v - versatz[0]) > 1)) fehler.push(`Bojen der zweiten Bahn mit ungleichem Versatz: ${versatz.map((v) => v.toFixed(1)).join(', ')}`)
  if (kopien.length !== 5) fehler.push(`${kopien.length} Bojen-Kopien in layer6 statt 5`)
  // „unten“ heißt hier: die Bahn mit den Tor-IDs. Liegt sie im Bild doch oben, tauschen.
  let [bahnU, bahnO] = [unten, oben]
  if (versatz[0] > 0) [bahnU, bahnO] = [oben, unten]
  const mitteU = mittel(bahnU.map((e) => e.lage!))
  const mitteO = mittel(bahnO.map((e) => e.lage!))
  const naechste = (p: Punkt): 'unten' | 'oben' => (Math.hypot(p.x - mitteU.x, p.y - mitteU.y) <= Math.hypot(p.x - mitteO.x, p.y - mitteO.y) ? 'unten' : 'oben')
  const kreise = imLayer.filter((e) => e.kreis && e.inGruppe && e.lage)
  const start = { unten: kreise.filter((k) => naechste(k.lage!) === 'unten'), oben: kreise.filter((k) => naechste(k.lage!) === 'oben') }
  for (const b of ['unten', 'oben'] as const) if (start[b].length !== 2) fehler.push(`Bahn ${b}: ${start[b].length} Start/Ziel-Kreise statt 2`)
  if (fehler.length) return { zuordnung: null, fehler }

  // BD9: Fahrtrichtung d = Boje 5 − Mitte des Starttors; „links“ davon ist im SVG (y nach unten) die Richtung (dy, −dx).
  const startMitte = mittel(start.unten.map((k) => k.lage!))
  const d = { x: bahnU[4].lage!.x - startMitte.x, y: bahnU[4].lage!.y - startMitte.y }
  const c = { x: mitteO.x - mitteU.x, y: mitteO.y - mitteU.y }
  const links = c.x * d.y - c.y * d.x
  if (Math.abs(links) < 1) return { zuordnung: null, fehler: ['Bahnen liegen in Fahrtrichtung hintereinander, nicht nebeneinander'] }
  const bahnA: 'oben' | 'unten' = links > 0 ? 'oben' : 'unten'
  const bahnVon = (b: 'oben' | 'unten'): ParallelBahn => (b === bahnA ? 'A' : 'B')

  const ids: Record<string, string> = {}
  bahnU.forEach((e, i) => (ids[e.id] = parallelBojeId(bahnVon('unten'), i + 1)))
  bahnO.forEach((e, i) => (ids[e.id] = parallelBojeId(bahnVon('oben'), i + 1)))
  for (const b of ['unten', 'oben'] as const) {
    // Start/Ziel: die Gruppe bekommt die ID (Lage samt Verschiebung). seiteA = größeres y = untere im Bild.
    const [a, bb] = [...start[b]].sort((p, q) => q.lage!.y - p.lage!.y)
    ids[a.inGruppe!] = parallelStartId(bahnVon(b), 'seiteA')
    ids[bb.inGruppe!] = parallelStartId(bahnVon(b), 'seiteB')
  }
  const zaehler: Record<string, number> = {}
  const neu = (bahn: ParallelBahn, art: string) => `P_${bahn}_${art}${(zaehler[`${bahn}${art}`] = (zaehler[`${bahn}${art}`] ?? 0) + 1)}`
  for (const e of alle) {
    if (ids[e.id] || !e.lage) continue
    const linie = (e.tag === 'path' && !e.kreis && (e.gruppen.includes('ParallelSlalom') || (e.gruppen.includes('layer6') && !e.inGruppe)))
    if (linie) ids[e.id] = neu(bahnVon(naechste(e.lage)), 'linie')
  }
  // Ziffern: Text in ParcoursLabel nahe einer Boje (≤ 15 Einheiten von ihrer Mitte).
  const bojen = [...bahnU.map((e, i) => ({ e, n: i + 1, b: 'unten' as const })), ...bahnO.map((e, i) => ({ e, n: i + 1, b: 'oben' as const }))]
  for (const t of alle.filter((e) => e.tag === 'text' && e.gruppen.includes('ParcoursLabel') && e.lage)) {
    const nah = bojen.filter(({ e }) => Math.hypot(e.lage!.x - 7 - t.lage!.x, e.lage!.y - t.lage!.y) <= 15)
    if (nah.length === 1) ids[t.id] = `P_${bahnVon(nah[0].b)}_nr${nah[0].n}`
  }
  return { zuordnung: { ids, bahnA }, fehler: [] }
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
 * Macht die Parallel-Zeichnung aus `Parcours/dist/parallel/en/pontoon_bottom/ParallelSlalom.svg` für Alcatraz zurecht
 * (Sync, BD8): verkleinern (PARALLEL_WEG, ungenutzte Marker/Verläufe, Inkscape-Schriftangaben), IDs je Bahn
 * (parallelZuordnung), Ausschnitt (PARALLEL_AUSSCHNITT), Namensraum `ns2:` der Metadaten als `cc:` (sonst fände
 * metadaten() Titel, Urheber und Lizenz nicht), dann wie die Klassen-Zeichnungen (normalisiere, eigener Vermerk).
 * `metadata` bleibt: Titel, Urheber und Lizenz reisen mit der Datei (CC BY-NC-SA 4.0 Abschnitt 3(a)(1)). Zweimal
 * angewandt ändert sich nichts (die Zuordnung findet die gesetzten IDs dann über P_… nicht mehr – darum Fehler, wenn
 * die Tor-IDs fehlen; der Sync läuft immer auf der Quelle).
 */
export function machParallel(roh: string): { text: string; zuordnung: ParallelZuordnung | null; fehler: string[] } {
  let s = roh
  for (const id of PARALLEL_WEG) s = entferne(s, id)
  // Ungenutzte Marker und Verläufe (die Quelle schleppt sie aus dem Master mit).
  for (const m of [...s.matchAll(/<(marker|linearGradient|radialGradient)\b[^>]*\bid="([^"]+)"/g)]) {
    const id = m[2]
    if (!s.includes(`url(#${id})`) && !s.includes(`href="#${id}"`)) s = entferne(s, id)
  }
  s = s.replace(/-inkscape-font-specification:[^;"]*;?/g, '')
  s = s.replace(/xmlns:ns2=/, 'xmlns:cc=').replace(/<(\/?)ns2:/g, '<$1cc:').replace(/\bns2:/g, 'cc:')
  const { zuordnung, fehler } = parallelZuordnung(s)
  if (!zuordnung) return { text: s, zuordnung: null, fehler }
  for (const [alt, neu] of Object.entries(zuordnung.ids)) {
    if (s.split(`id="${alt}"`).length !== 2) return { text: s, zuordnung: null, fehler: [`${alt} steht nicht genau einmal`] }
    if (s.includes(`#${alt})`) || s.includes(`#${alt}"`)) return { text: s, zuordnung: null, fehler: [`${alt} wird verwiesen – Umbenennen bräche den Verweis`] }
    s = s.replace(`id="${alt}"`, `id="${neu}"`)
  }
  const a = PARALLEL_AUSSCHNITT
  s = s.replace(/<svg\b[^>]*>/, (w) =>
    w
      .replace(/\s(?:width|height|viewBox)="[^"]*"/g, '')
      .replace(/<svg\b/, `<svg viewBox="${a.x} ${a.y} ${a.breite} ${a.hoehe}" width="${a.breite}" height="${a.hoehe}"`),
  )
  return { text: normalisiere(s, BEARBEITUNGSVERMERK_PARALLEL), zuordnung, fehler: [] }
}

/** Was an der fertigen Parallel.svg nicht stimmt: Pflicht-IDs nicht genau einmal, Rasterbild, Größe, Bojen außerhalb. */
export function parallelBefunde(svg: string): string[] {
  const out: string[] = []
  for (const id of PARALLEL_PFLICHT_IDS) {
    const n = anzahl(svg, id)
    if (n !== 1) out.push(n === 0 ? `${id} fehlt` : `${id} steht ${n}-mal`)
  }
  if (/<image\b/.test(svg)) out.push('enthält ein Rasterbild (<image)')
  const bytes = new TextEncoder().encode(svg).length
  if (bytes > PARALLEL_MAX_BYTES) out.push(`${Math.round(bytes / 1024)} KB, mehr als ${PARALLEL_MAX_BYTES / 1024} KB`)
  const vb = /<svg\b[^>]*\bviewBox="([^"]+)"/.exec(svg)?.[1].split(/[\s,]+/).map(Number)
  if (!vb || vb.length !== 4) out.push('kein viewBox')
  else {
    const lagen = new Map(elemente(svg).map((e) => [e.id, e.lage]))
    const rand = 20
    for (const id of PARALLEL_PFLICHT_IDS.filter((i) => !i.includes('_start_'))) {
      const p = lagen.get(id)
      if (p && (p.x - 7 < vb[0] + rand || p.x > vb[0] + vb[2] - rand || p.y < vb[1] + rand || p.y > vb[1] + vb[3] - rand)) out.push(`${id} liegt außerhalb des Ausschnitts`)
    }
  }
  return out
}
