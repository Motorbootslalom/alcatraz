import { FAHRWEG, bildBojeId } from '../config/kurzform'
import { AUSBLENDEN_OPACITY, DIM_OPACITY, ohneRahmen } from '../lib/parcoursbild'
import { PARALLEL_DATEI, PARALLEL_PFLICHT_IDS, parallelBahnPraefix, parallelBojeId, parallelStartId } from '../lib/parcoursVertrag'
import type { Racecourse } from '../lib/parallelSchluessel'
import type { ClassId } from '../types'
import { bojenHalt, PARALLEL_FAHRWEG } from './bojen'
import { liesListe } from './liste'
import { bojenDisqZahl, bojenVon, eintraegeAuf, maskeFuer, maskenZeilen, type Entwurf, type MaskenAufbau, type MaskenBoje, type MaskenHalt } from './maske'
import type { ListenSicht, MaskenBild } from './sicht'

// Maske „Bild“ der WKR-Geräte (W5.2, Plan docs/plan-wkr-w5.md §5, 22.11.2026) – rein, ohne DOM, ohne Store, nichts
// aus geraete/. Hier steht NUR die Zuordnung „Boje der Liste ↔ Stelle in der Zeichnung“ und welcher Knopf ein Tipp ins
// Bild ist; Entwurf und Zellen entstehen wie bei den Knöpfen über wkr/maske.ts (tippeBoje, tippeBojenDisq, zellenAus) –
// gleiche Tipps im Bild und in den Knöpfen geben dieselben Zellen (maske.test.ts). Gezeichnet wird in
// components/wkr/WkrBild.vue; die Klassen-SVGs und Parallel.svg (src/assets/parcours) kommen gebündelt über
// lib/parcoursQuelle.ts.

/** Eine Boje der Klassen-Zeichnung: Tor (bzw. Speedboje) und physische Seite wie in der Feld-Kennung. */
export interface BildBoje {
  /** `StartZiel`, `Tor1` … `Tor5` oder die Speedboje selbst (`Speedboje_oben`). */
  halt: string
  /** `seiteA` = untere, `seiteB` = obere Boje im Bild (config/kurzform.ts SEITE); Speedbojen `null`. */
  seite: 'seiteA' | 'seiteB' | null
}

const TORE = ['StartZiel', 'Tor1', 'Tor2', 'Tor3', 'Tor4', 'Tor5'] as const
const SPEEDBOJEN = ['Speedboje_oben', 'Speedboje_unten'] as const
const SEITEN = ['seiteA', 'seiteB'] as const

/**
 * Alle Bojen der Klassen-Zeichnungen: SVG-ID → Tor und Seite (Tor1_innen/_aussen … Tor4, Tor5_oben/_unten,
 * StartZiel_oben/_unten, Speedboje_oben/_unten). innen/außen ↔ seiteA/B über config/kurzform.ts bildBojeId – dieselbe
 * Regel, aus der die Kurzform die Unterspalten nach dem Blick ordnet und aus der die Sicht `boje.spalte` liest (P7,
 * BD1, 22.11.2026): Bild und Knopfspalten können so nie gegeneinander stehen.
 */
export const BILD_BOJEN: Readonly<Record<string, BildBoje>> = Object.freeze(
  Object.fromEntries([
    ...TORE.flatMap((t) => SEITEN.map((s) => [bildBojeId(t, s), { halt: t, seite: s }] as const)),
    ...SPEEDBOJEN.map((id) => [id, { halt: id, seite: null }] as const),
  ]),
)

/** Die SVG-ID einer Bojen-Kennung (`t1a|hin seiteB` → `Tor1_innen`, `speed2` → `Speedboje_unten`); `null` = keine. */
export function bildIdVon(feld: string): string | null {
  const h = bojenHalt(feld)
  if (!h) return null
  const f = FAHRWEG.find((x) => x.key === h.halt && !x.katalog)
  if (!f) return null
  if (f.speedboje) return f.speedboje
  // Tore des Manövrierparcours tragen die Richtung (`start|hin seiteB`); `start|seiteA` ist der Parallelslalom.
  if (!/\|(?:hin|rueck) /.test(feld)) return null
  return f.tor && h.seite ? bildBojeId(f.tor, h.seite) : null
}

// ---------------------------------------------------------------------------
// Parallelslalom: Zeichnung aus dem Parcours-Repo (BD3 umgebaut 22.11.2026, BD8–BD10), Schema nur als Rückfall
// ---------------------------------------------------------------------------

/**
 * Die Parallel-Zeichnung als „Bild der Klasse“ (BD3 umgebaut 22.11.2026, R8-19): src/assets/parcours/Parallel.svg, beide
 * Bahnen, so wie die Quelle liegt („pontoon_bottom“ = Steg unten wie die Klassen-Zeichnungen, Drehung 0) – gedimmt
 * wird nur die fremde Bahn (BD10, über `blass` der Zuordnung). Die Drehung nach Platz (wirksameDrehung) gilt
 * unverändert; bei 0° ist sie ohne Wirkung.
 */
export const PARALLEL_BILD: Readonly<MaskenBild> = Object.freeze({ datei: PARALLEL_DATEI, dim: [], aus: [], drehung: 0 })

/**
 * Die ID einer Parallel-Kennung in Parallel.svg (BD8): Boje n hin und rück → `P_<rc>_b<n>`, Start und Ziel → dasselbe
 * Tor `P_<rc>_start_seiteA|B`. `null` = keine Parallel-Boje.
 */
export function parallelBildId(feld: string, racecourse: Racecourse): string | null {
  const s = schemaIdVon(feld)
  if (!s) return null
  const start = /^P_StartZiel_(seiteA|seiteB)$/.exec(s)
  if (start) return parallelStartId(racecourse, start[1] as 'seiteA' | 'seiteB')
  const b = /^P_b(\d)$/.exec(s)
  return b ? parallelBojeId(racecourse, Number(b[1])) : null
}

/** Ein Punkt der schematischen Zeichnung (Koordinaten in einem Feld 100 × 140). */
export interface SchemaPunkt {
  id: string
  x: number
  y: number
  /** Beschriftung in der Zeichnung: „1“ … „5“; Start/Ziel ohne (die Maske schreibt es darunter). */
  nr: string
}

export interface ParallelSchema {
  racecourse: Racecourse
  breite: number
  hoehe: number
  punkte: SchemaPunkt[]
  /** Fahrlinie Hinweg (Start → Boje 5) und Rückweg (Boje 5 → Ziel) als Punktfolgen. */
  hin: [number, number][]
  rueck: [number, number][]
}

const SCHEMA_BREITE = 100
const SCHEMA_HOEHE = 140

/**
 * Schematische Zeichnung eines Racecourse (Plan §5.1, BD3, 22.11.2026) – seit dem Umbau 22.11.2026 (R8-19) nur noch
 * RÜCKFALL, wenn Parallel.svg fehlt oder unvollständig ist (Build ohne Asset, Test). Start/Ziel unten als Tor aus zwei Bojen (seiteA links, seiteB rechts), Bojen
 * 1–4 darüber in einer Reihe, Boje 5 oben als Wende – Folge und Hin/Rück aus PARALLEL_FAHRWEG (wkr/bojen.ts): Hinweg
 * links an 1–4 vorbei, Wende um 5, Rückweg rechts. Racecourse B ist gespiegelt (die Bahnen liegen nebeneinander, die
 * Boote fahren spiegelbildlich). Nur Daten – die Komponente zeichnet sie.
 */
export function schemaParallel(racecourse: Racecourse): ParallelSchema {
  const spiegel = (x: number) => (racecourse === 'B' ? SCHEMA_BREITE - x : x)
  const punkte: SchemaPunkt[] = [
    { id: 'P_StartZiel_seiteA', x: spiegel(30), y: 128, nr: '' },
    { id: 'P_StartZiel_seiteB', x: spiegel(70), y: 128, nr: '' },
    ...[1, 2, 3, 4].map((n) => ({ id: `P_b${n}`, x: spiegel(50), y: 128 - n * 22, nr: String(n) })),
    { id: 'P_b5', x: spiegel(50), y: 12, nr: '5' },
  ]
  const hin: [number, number][] = [[spiegel(40), 136], [spiegel(40), 120], ...[1, 2, 3, 4].map((n): [number, number] => [spiegel(36), 128 - n * 22]), [spiegel(38), 12], [spiegel(50), 3]]
  const rueck: [number, number][] = [[spiegel(50), 3], [spiegel(62), 12], ...[4, 3, 2, 1].map((n): [number, number] => [spiegel(64), 128 - n * 22]), [spiegel(60), 120], [spiegel(60), 136]]
  return { racecourse, breite: SCHEMA_BREITE, hoehe: SCHEMA_HOEHE, punkte, hin, rueck }
}

/** Die Schema-ID einer Parallel-Kennung (`start|seiteA`, `ziel|seiteA` → dasselbe Tor; `b2a`/`b2b` → dieselbe Boje). */
export function schemaIdVon(feld: string): string | null {
  // Start/Ziel des Manövrierparcours (`start|hin seiteB`) heißen wie die des Parallelslaloms – sie haben ihr Bild.
  if (bildIdVon(feld) !== null) return null
  const h = bojenHalt(feld)
  if (!h || !(PARALLEL_FAHRWEG as readonly string[]).includes(h.halt)) return null
  if (h.halt === 'start' || h.halt === 'ziel') return h.seite ? `P_StartZiel_${h.seite}` : null
  const m = /^b(\d)[ab]?$/.exec(h.halt)
  return m ? `P_b${m[1]}` : null
}

// ---------------------------------------------------------------------------
// Zuordnung einer Klasse
// ---------------------------------------------------------------------------

export interface BildZuordnung {
  art: 'svg' | 'schema'
  /** Zeichnung der Klasse bzw. PARALLEL_BILD (`svg`); `null` beim Schema. */
  bild: MaskenBild | null
  /** Parallelslalom: der Racecourse der Liste (Titel „Racecourse A“); fehlt bei den Klassen-Zeichnungen. */
  racecourse?: Racecourse
  schema: ParallelSchema | null
  /** Je Bojen-Feld der Liste die ID im Bild. */
  treffer: Record<string, string>
  /** Die IDs der eigenen Bojen in Fahrtfolge (je ID einmal). */
  ids: string[]
  /** Bojen im Bild, die nicht zu dieser Liste gehören: blass, nicht antippbar. */
  blass: string[]
}

/** Wie oft eine ID im SVG-Text steht. */
function vorkommen(svg: string, id: string): number {
  let n = 0
  for (let i = svg.indexOf(`id="${id}"`); i >= 0; i = svg.indexOf(`id="${id}"`, i + 1)) n++
  return n
}

/**
 * Die Zuordnung einer Bojen-Maske zum Bild. `null` (BD2, 22.11.2026): keine Bojen-Maske, keine Zeichnung, eine Boje
 * ohne ID oder eine ID, die nicht GENAU einmal im SVG steht – dann zeigt die Klasse die Knöpfe (WkrMitte), nie ein
 * Bild mit stiller Lücke. `svg` fehlt nur in reinen Tests ohne Zeichnung (dann wird nur die Tabelle geprüft).
 *
 * Parallelslalom (BD3 umgebaut, BD10, 22.11.2026): `svg` ist dort Parallel.svg. Trägt sie jede ID des Racecourse genau
 * einmal (und alle Pflicht-IDs beider Bahnen), zeigt das Bild die ganze Zeichnung; die Teile der FREMDEN Bahn (alle IDs
 * mit ihrem Präfix: Bojen, Start/Ziel, Fahrlinien, Ziffern) sind `blass` – gedimmt und ohne Trefferkreis. Ohne Datei
 * oder mit unvollständiger das Schema (schemaParallel) – es ist immer vollständig, also keine stille Lücke.
 */
export function bildZuordnung(aufbau: MaskenAufbau, o: { bild?: MaskenBild | null; racecourse?: Racecourse | null; svg?: string }): BildZuordnung | null {
  if (aufbau.art !== 'bojen') return null
  const bojen = bojenVon(aufbau)
  if (bojen.length === 0) return null
  const treffer: Record<string, string> = {}
  const ids: string[] = []
  const merke = (feld: string, id: string) => {
    treffer[feld] = id
    if (!ids.includes(id)) ids.push(id)
  }
  if (bojen.every((b) => schemaIdVon(b.feld) !== null)) {
    const rc = o.racecourse ?? 'A'
    if (o.svg !== undefined && PARALLEL_PFLICHT_IDS.every((id) => vorkommen(o.svg!, id) === 1)) {
      for (const b of bojen) merke(b.feld, parallelBildId(b.feld, rc)!)
      const fremd = parallelBahnPraefix(rc === 'A' ? 'B' : 'A')
      const blass = [...o.svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]).filter((id) => id.startsWith(fremd))
      return { art: 'svg', bild: PARALLEL_BILD, schema: null, treffer, ids, blass, racecourse: rc }
    }
    const schema = schemaParallel(rc)
    for (const b of bojen) merke(b.feld, schemaIdVon(b.feld)!)
    if (!ids.every((id) => schema.punkte.some((p) => p.id === id))) return null
    return { art: 'schema', bild: null, schema, treffer, ids, blass: schema.punkte.map((p) => p.id).filter((id) => !ids.includes(id)), racecourse: rc }
  }
  if (!o.bild) return null
  for (const b of bojen) {
    const id = bildIdVon(b.feld)
    if (!id) return null
    merke(b.feld, id)
  }
  if (o.svg !== undefined && !ids.every((id) => vorkommen(o.svg!, id) === 1)) return null
  const blass = Object.keys(BILD_BOJEN).filter((id) => !ids.includes(id) && (o.svg === undefined || vorkommen(o.svg, id) > 0))
  return { art: 'svg', bild: o.bild, schema: null, treffer, ids, blass }
}

/**
 * Je MaskenBoje der Klasse die ID im Bild (Plan §5.1): Maske der Klasse aus der Sicht, Zeichnung aus `bild` der Klasse
 * (Parallelslalom: Parallel.svg mit der Bahn des Racecourse der Liste, ohne Datei das Schema – BD3 umgebaut
 * 22.11.2026). `svgVon` liefert den Text der Zeichnung (lib/parcoursQuelle.ts parcoursSvg) – fehlt die Datei einer
 * Klasse, `null` (BD2).
 */
export function bildTreffer(
  sicht: ListenSicht,
  klasse: ClassId,
  svgVon?: (datei: string) => string | undefined,
  sprache: 'liste' | 'andere' = 'liste',
): BildZuordnung | null {
  const aufbau = maskeFuer(sicht, klasse, sprache)
  if (!aufbau) return null
  const bild = sicht.klassen[klasse]?.bild ?? null
  // Ohne Bild der Klasse kann es nur der Parallelslalom sein (parallel.yaml hat kein `bildErzeugen`): dessen Zeichnung.
  const svg = svgVon ? svgVon(bild ? bild.datei : PARALLEL_DATEI) : undefined
  // Zeichnung genannt, aber nicht gebündelt: kein Bild (BD2) – nie eines mit stiller Lücke.
  if (bild && svgVon && svg === undefined) return null
  return bildZuordnung(aufbau, { bild, racecourse: liesListe(sicht.liste)?.racecourse ?? null, ...(svg !== undefined ? { svg } : {}) })
}

/**
 * Klasse für die Probe der Maske „Bild“ (MW3): wie probeMaske die mit den meisten Zeilen, aber nur unter denen mit
 * vollständigem Bild. `null` = keine Klasse hat eines (dann gibt es nur die Probe der Knöpfe).
 */
export function probeBild(
  sicht: ListenSicht,
  svgVon?: (datei: string) => string | undefined,
  sprache: 'liste' | 'andere' = 'liste',
): { klasse: ClassId; aufbau: MaskenAufbau; zuordnung: BildZuordnung } | null {
  let beste: { klasse: ClassId; aufbau: MaskenAufbau; zuordnung: BildZuordnung } | null = null
  for (const k of Object.keys(sicht.klassen) as ClassId[]) {
    const aufbau = maskeFuer(sicht, k, sprache)
    const zuordnung = aufbau ? bildTreffer(sicht, k, svgVon, sprache) : null
    if (!aufbau || !zuordnung) continue
    if (!beste || maskenZeilen(aufbau) > maskenZeilen(beste.aufbau)) beste = { klasse: k, aufbau, zuordnung }
  }
  return beste
}

// ---------------------------------------------------------------------------
// Umschalter Hinweg / Rückweg / Rück 2 und welcher Knopf ein Tipp ist
// ---------------------------------------------------------------------------

/**
 * Seite des Umschalters im Bild: Das Bild zeigt jedes Tor nur einmal – ob ein Tipp auf Tor 1 die Hin- oder die
 * Rückfahrt meint, sagt der Umschalter. `rueck2` (BD5, 22.11.2026): Tor 1 der Speedrunde (`t1c`, zweite Durchfahrt in
 * derselben Richtung) – ohne eigenen Zustand wäre sie im Bild nicht antippbar.
 */
export type BildWeg = 'hin' | 'rueck' | 'rueck2'

export interface BildBojeMitHalt {
  boje: MaskenBoje
  halt: MaskenHalt
}

/** Alle Bojen mit ihrem Halt (Weg, Durchfahrt). */
export function bojenMitHalt(aufbau: MaskenAufbau): BildBojeMitHalt[] {
  return aufbau.abschnitte.flatMap((a) => (a.art === 'halt' ? a.halt.bojen.map((boje) => ({ boje, halt: a.halt })) : []))
}

const passt = (h: MaskenHalt, weg: BildWeg) => (weg === 'hin' ? h.weg === 'hin' : weg === 'rueck2' ? h.weg === 'rueck' && h.durchfahrt === 2 : h.weg === 'rueck' && !h.durchfahrt)

/** Die Seiten des Umschalters, die diese Maske braucht (eine = kein Umschalter). */
export function bildWege(aufbau: MaskenAufbau): BildWeg[] {
  const halte = bojenMitHalt(aufbau).map((x) => x.halt)
  const katalogRueck = aufbau.abschnitte.some((a) => a.art === 'katalog' && a.weg === 'rueck')
  const katalogHin = aufbau.abschnitte.some((a) => a.art === 'katalog' && a.weg === 'hin')
  return (['hin', 'rueck', 'rueck2'] as const).filter(
    (w) => halte.some((h) => passt(h, w)) || (w === 'hin' && katalogHin) || (w === 'rueck' && katalogRueck),
  )
}

/**
 * Welcher Knopf ein Tipp auf die ID ist (Plan §5.1): Liegt dort nur EINE Boje der Liste, diese – gleich, welche Seite
 * offen ist (Speedboje, Tor 1 bei Klasse 4); sonst die des gewählten Wegs, in `rueck2` die zweite Durchfahrt. Findet
 * sich auf dem gewählten Weg keine, die erste dort (in Fahrtfolge). `null` = keine Boje der Liste.
 */
export function bildZiel(aufbau: MaskenAufbau, z: BildZuordnung, id: string, weg: BildWeg): BildBojeMitHalt | null {
  const kandidaten = bojenMitHalt(aufbau).filter((x) => z.treffer[x.boje.feld] === id)
  if (kandidaten.length <= 1) return kandidaten[0] ?? null
  return kandidaten.find((x) => passt(x.halt, weg)) ?? (weg === 'rueck2' ? kandidaten.find((x) => passt(x.halt, 'rueck')) : undefined) ?? kandidaten[0]
}

/** Einträge je Seite des Umschalters (Zahl am Reiter): wie eintraegeAuf, Rück 2 getrennt vom Rückweg. */
export function bildZahlen(e: Entwurf, aufbau: MaskenAufbau): Record<BildWeg, number> {
  let rueck2 = 0
  for (const x of bojenMitHalt(aufbau)) if (passt(x.halt, 'rueck2')) rueck2 += (e.bojen[x.boje.feld] ?? 0) + bojenDisqZahl(e, x.boje.feld)
  return { hin: eintraegeAuf(e, aufbau, 'hin'), rueck: eintraegeAuf(e, aufbau, 'rueck') - rueck2, rueck2 }
}

// ---------------------------------------------------------------------------
// Zeichnung inline: IDs mit Präfix, Drehung, Dimmen (für WkrBild)
// ---------------------------------------------------------------------------

/**
 * Das Klassen-SVG für die Seite (inline, nicht als `<img>`: die Trefferkreise brauchen die Lage der Bojen). Alle IDs
 * bekommen `praefix` (sonst gälten die Stilregeln des Dimmens und die `url(#…)`-Verweise für die ganze Seite und
 * stießen bei zwei Bildern nebeneinander zusammen), die Drehung (`bild.drehung`, 0/180/±90) geht in viewBox + `<g>`
 * – so bleibt die Fläche so groß wie das gedrehte Bild. Gedimmt wird wie auf dem Bogen (lib/parcoursbild.ts bildSvg)
 * plus die fremden Bojen (`blass`).
 */
export function inlineSvg(quelle: string, o: { praefix: string; drehung: number; dim: readonly string[]; aus: readonly string[] }): string {
  const p = o.praefix
  let s = ohneRahmen(quelle).replace(/<\?xml[^>]*\?>\s*/, '')
  s = s
    .replace(/\bid="([^"]+)"/g, (_, id: string) => `id="${p}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id: string) => `url(#${p}${id})`)
    .replace(/((?:xlink:)?href)="#([^"]+)"/g, (_, attr: string, id: string) => `${attr}="#${p}${id}"`)
  const wurzel = /<svg\b[^>]*>/.exec(s)
  if (wurzel) {
    const vb = /\bviewBox="([^"]+)"/.exec(wurzel[0])?.[1].trim().split(/[\s,]+/).map(Number)
    const d = ((o.drehung % 360) + 360) % 360
    let kopf = wurzel[0].replace(/\s(?:width|height)="[^"]*"/g, '')
    let innen = s.slice(wurzel.index + wurzel[0].length, s.lastIndexOf('</svg>'))
    if (vb && vb.length === 4 && vb.every(Number.isFinite) && d !== 0) {
      const [x, y, w, h] = vb
      const neu = d === 180 ? [-(x + w), -(y + h), w, h] : d === 90 ? [-(y + h), x, h, w] : d === 270 ? [y, -(x + w), h, w] : vb
      kopf = kopf.replace(/\bviewBox="[^"]+"/, `viewBox="${neu.join(' ')}"`)
      innen = `<g transform="rotate(${d === 270 ? -90 : d})">${innen}</g>`
    }
    kopf = kopf.replace(/<svg\b/, '<svg preserveAspectRatio="xMidYMid meet"')
    s = kopf + innen + '</svg>'
  }
  return mitDeckkraft(mitDeckkraft(s, o.dim.map((id) => p + id), DIM_OPACITY), o.aus.map((id) => p + id), AUSBLENDEN_OPACITY)
}

/** Nur solche IDs werden angefasst (wie lib/parcoursbild.ts): Was aus YAML stammt, darf kein Markup einschleusen. */
const ID_MUSTER = /^[A-Za-z][\w-]*$/

/**
 * Deckkraft als `style` am Element selbst statt als `<style>`-Block wie auf dem Bogen (lib/parcoursbild.ts bildSvg):
 * inline gälte ein Block für die ganze Seite, und das Test-DOM verschluckt ihn samt Rest der Zeichnung (22.11.2026).
 * Hinten an den vorhandenen `style` gehängt, damit es eine eigene Deckkraft des Elements überstimmt.
 */
function mitDeckkraft(svg: string, ids: readonly string[], deckkraft: number): string {
  let out = svg
  for (const id of ids) {
    if (!ID_MUSTER.test(id)) continue
    out = out.replace(new RegExp(`<[^<>]*\\bid="${id}"[^<>]*>`), (tag) =>
      /\bstyle="/.test(tag)
        ? tag.replace(/\bstyle="([^"]*)"/, (_, st: string) => `style="${st.replace(/;?\s*$/, '')};opacity:${deckkraft}"`)
        : tag.replace(/\s*(\/?)>$/, ` style="opacity:${deckkraft}"$1>`),
    )
  }
  return out
}

/** Breite × Höhe aus dem viewBox der Zeichnung (ungedreht); `null` ohne lesbaren viewBox. */
export function svgSeiten(quelle: string): { breite: number; hoehe: number } | null {
  const wurzel = /<svg\b[^>]*>/.exec(quelle)?.[0] ?? ''
  const vb = /\bviewBox="([^"]+)"/.exec(wurzel)?.[1].trim().split(/[\s,]+/).map(Number)
  if (!vb || vb.length !== 4 || !vb.every(Number.isFinite) || vb[2] <= 0 || vb[3] <= 0) return null
  return { breite: vb[2], hoehe: vb[3] }
}

/**
 * Drehung, mit der das Bild wirklich gezeigt wird (Prüfbefund 22.11.2026, WKR_ANNAHMEN.bildDrehungNachPlatz, noch zu
 * bestätigen): 0° und 180° immer; ±90° nur auf dem Pad und nur, wenn die gedrehte Zeichnung im freien Platz (Breite
 * der Fläche × höchste Höhe der Zeichnung) mindestens so groß erscheint wie die ungedrehte – sonst 0° wie auf dem
 * Handy. Vorher drehte das Pad immer ±90°, und eine Zeichnung mit `blick: hinten` (gate135, gate245, moewe …) wurde
 * hochkant doppelt so hoch wie der Bildschirm. Ohne bekannten Platz (vor dem ersten Messen, Test-DOM) 0°.
 */
export function wirksameDrehung(
  drehung: number,
  o: { pad: boolean; seiten: { breite: number; hoehe: number } | null; platz: { breite: number; hoehe: number } | null },
): number {
  const d = ((drehung % 360) + 360) % 360
  if (d === 0 || d === 180) return d
  if (!o.pad || !o.seiten || !o.platz || o.platz.breite <= 0 || o.platz.hoehe <= 0) return 0
  const { breite: w, hoehe: h } = o.seiten
  const gerade = Math.min(o.platz.breite / w, o.platz.hoehe / h)
  const gedreht = Math.min(o.platz.breite / h, o.platz.hoehe / w)
  return gedreht >= gerade ? drehung : 0
}

// ---------------------------------------------------------------------------
// Trefferflächen auseinanderschieben (BD6)
// ---------------------------------------------------------------------------

export interface TrefferPunkt {
  id: string
  x: number
  y: number
}

/**
 * Trefferkreise, die näher als `abstand` liegen, auseinanderschieben (BD6, 22.11.2026): je Paar um die Hälfte der
 * Lücke entlang der Verbindungslinie, ein paar Runden lang; deckungsgleiche nach ihrer Folge seitlich. Die echte Lage
 * bleibt in der Zeichnung, die Komponente zieht eine Linie dorthin. Reihenfolge und IDs bleiben.
 */
export function schiebeAuseinander(punkte: readonly TrefferPunkt[], abstand: number, runden = 24): TrefferPunkt[] {
  const out = punkte.map((p) => ({ ...p }))
  for (let r = 0; r < runden; r++) {
    let bewegt = false
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]
        const b = out[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = Math.hypot(dx, dy)
        if (d >= abstand - 1e-6) continue
        if (d < 1e-6) {
          dx = 1
          dy = 0
          d = 1
          a.x -= 0.5
          b.x += 0.5
        }
        const schub = (abstand - Math.hypot(b.x - a.x, b.y - a.y)) / 2
        a.x -= (dx / d) * schub
        a.y -= (dy / d) * schub
        b.x += (dx / d) * schub
        b.y += (dy / d) * schub
        bewegt = true
      }
    if (!bewegt) break
  }
  return out
}
