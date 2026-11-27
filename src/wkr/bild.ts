import { FAHRWEG, bildBojeId } from '../config/kurzform'
import { AUSBLENDEN_OPACITY, DIM_OPACITY, ohneRahmen } from '../lib/parcoursbild'
import { PARALLEL_DATEI, PARALLEL_PFLICHT_IDS, parallelBojeId, parallelStartId } from '../lib/parcoursVertrag'
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
// Parallelslalom: eine Bahn aus dem Parcours-Repo (BD3 umgebaut 22.11.2026, seit 23.11.2026 BD8–BD10 umgebaut:
// R9-05 bis R9-07), Schema nur als Rückfall
// ---------------------------------------------------------------------------

/**
 * Die Parallel-Zeichnung als „Bild der Klasse“: src/assets/parcours/Parallel.svg – seit 23.11.2026 EINE Bahn ohne Steg
 * (die Eine-Bahn-Ausgabe des Parcours-Repositorys, lib/parcoursVertrag.ts PARALLEL_QUELLE), für Racecourse A und B
 * dieselbe (BD9, Nutzer R9-06: „Daher kommt auf den Listen und auf dem Gerät nur einer der zwei Parcours und ohne
 * Steg.“; BD10, R9-07: „Nur eine Bahn.“). Nichts gedimmt; die Drehung nach Platz (wirksameDrehung) gilt unverändert,
 * bei 0° ist sie ohne Wirkung. Vorher (22.11.2026) beide Bahnen mit Stegen, die fremde gedimmt.
 */
export const PARALLEL_BILD: Readonly<MaskenBild> = Object.freeze({ datei: PARALLEL_DATEI, dim: [], aus: [], drehung: 0 })

/**
 * Die ID einer Parallel-Kennung in Parallel.svg (BD8, seit 23.11.2026 die IDs des Parcours-Repositorys): Boje n hin und
 * rück → `A_Boje<n>`, Start und Ziel → dasselbe Tor `A_StartZiel_unten` (seiteA) bzw. `A_StartZiel_oben` (seiteB). Für
 * jeden Racecourse dieselbe ID – die Zeichnung hat nur die eine Bahn (BD9). `null` = keine Parallel-Boje.
 */
export function parallelBildId(feld: string): string | null {
  const s = schemaIdVon(feld)
  if (!s) return null
  const start = /^P_StartZiel_(seiteA|seiteB)$/.exec(s)
  if (start) return parallelStartId(start[1] as 'seiteA' | 'seiteB')
  const b = /^P_b(\d)$/.exec(s)
  return b ? parallelBojeId(Number(b[1])) : null
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
 * RÜCKFALL, wenn Parallel.svg fehlt oder unvollständig ist (Build ohne Asset, Test). Start/Ziel unten als Tor aus zwei
 * Bojen (seiteA links, seiteB rechts), Bojen 1–4 darüber in einer Reihe, Boje 5 oben als Wende – Folge und Hin/Rück aus
 * PARALLEL_FAHRWEG (wkr/bojen.ts): Hinweg links an 1–4 vorbei, Wende um 5, Rückweg rechts. Seit 23.11.2026 für A und B
 * DIESELBE Zeichnung wie die Datei (BD9/BD10 umgebaut, R9-06: „nur einer der zwei Parcours“) – vorher war B gespiegelt;
 * `racecourse` steht nur noch für die Beschriftung. Nur Daten – die Komponente zeichnet sie.
 */
export function schemaParallel(racecourse: Racecourse): ParallelSchema {
  const punkte: SchemaPunkt[] = [
    { id: 'P_StartZiel_seiteA', x: 30, y: 128, nr: '' },
    { id: 'P_StartZiel_seiteB', x: 70, y: 128, nr: '' },
    ...[1, 2, 3, 4].map((n) => ({ id: `P_b${n}`, x: 50, y: 128 - n * 22, nr: String(n) })),
    { id: 'P_b5', x: 50, y: 12, nr: '5' },
  ]
  const hin: [number, number][] = [[40, 136], [40, 120], ...[1, 2, 3, 4].map((n): [number, number] => [36, 128 - n * 22]), [38, 12], [50, 3]]
  const rueck: [number, number][] = [[50, 3], [62, 12], ...[4, 3, 2, 1].map((n): [number, number] => [64, 128 - n * 22]), [60, 120], [60, 136]]
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
  /** Bojen im Bild, die nicht zu dieser Liste gehören: blass, nicht antippbar (im Parallelslalom seit 23.11.2026 leer). */
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
 * Parallelslalom (BD3 umgebaut 22.11.2026; BD8–BD10 umgebaut 23.11.2026, R9-05 bis R9-07): `svg` ist dort Parallel.svg
 * mit EINER Bahn. Trägt sie jede Pflicht-ID genau einmal (lib/parcoursVertrag.ts PARALLEL_PFLICHT_IDS), treffen die
 * Bojen der Liste diese eine Bahn – für Racecourse A und B dieselben IDs, `racecourse` kommt aus der Liste. Es gibt
 * keine fremde Bahn mehr zu dimmen; `blass` sind nur Pflicht-Bojen, die die Liste nicht abfragt (heute keine). Ohne
 * Datei oder mit unvollständiger das Schema (schemaParallel) – es ist immer vollständig, also keine stille Lücke.
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
      for (const b of bojen) merke(b.feld, parallelBildId(b.feld)!)
      const blass = PARALLEL_PFLICHT_IDS.filter((id) => !ids.includes(id))
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
 * (Parallelslalom: Parallel.svg, die eine Bahn für jeden Racecourse – der Racecourse kommt aus der Liste; ohne Datei
 * das Schema – BD3 umgebaut 22.11.2026, BD9 umgebaut 23.11.2026). `svgVon` liefert den Text der Zeichnung
 * (lib/parcoursQuelle.ts parcoursSvg) – fehlt die Datei einer Klasse, `null` (BD2).
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
      if (d === 90 || d === 270) innen = nurBojenZiffern(innen, p)
    }
    kopf = kopf.replace(/<svg\b/, '<svg preserveAspectRatio="xMidYMid meet"')
    s = kopf + innen + '</svg>'
  }
  return mitDeckkraft(mitDeckkraft(s, o.dim.map((id) => p + id), DIM_OPACITY), o.aus.map((id) => p + id), AUSBLENDEN_OPACITY)
}

/** Ziffern an den Bojen: `Nummer_Tor1` … in den Klassen-Zeichnungen, `A_Nummer_Boje1` … in Parallel.svg. */
const BOJEN_ZIFFER = /^(?:[AB]_)?Nummer_/

/**
 * Hochkant nur die Ziffern an den Bojen (BL8, Nutzer 27.11.2026: „Warum hast du den Text hier drin, wenn der Parcours
 * im Hochformat ist?“). Die Zeichnungen sind quer angelegt; Titel („DMYV-Jugend Motorboot-Slalom Klasse E“),
 * Fahrweg-Beschreibung („Ablegen - Startlinie - …“), „Tempo - Runde“ und „Möwe-Parcour“ stehen dort neben dem
 * Parcours. Gedreht um ±90° hält BL4 jeden Text aufrecht – um seine eigene Mitte, die mit der Zeichnung wandert –, und
 * die breiten Blöcke legten sich quer über den nun hochkant stehenden Parcours. Bei 0° und 180° bleibt jeder Block in
 * seinem eigenen Rahmen (eine halbe Drehung um die eigene Mitte deckt dieselbe Fläche), dort bleibt der Text.
 * Ausgeblendet per `display:none` am Element: getBBox der Bojen und die Trefferkreise bleiben unberührt.
 */
function nurBojenZiffern(innen: string, praefix: string): string {
  return innen.replace(/<text\b[^>]*>/g, (tag) => {
    const id = /\bid="([^"]*)"/.exec(tag)?.[1] ?? ''
    if (id.startsWith(praefix) && BOJEN_ZIFFER.test(id.slice(praefix.length))) return tag
    return /\bstyle="/.test(tag)
      ? tag.replace(/\bstyle="([^"]*)"/, (_, st: string) => `style="${st.replace(/;?\s*$/, '')};display:none"`)
      : tag.replace(/\s*(\/?)>$/, ` style="display:none"$1>`)
  })
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

// ---------------------------------------------------------------------------
// Lage der Zeichnung nach Wahl des WKR (Nutzer 24.11.2026, WKR_ANNAHMEN BL1–BL7; Namen nach Start/Ziel seit 26.11.2026)
// ---------------------------------------------------------------------------

/**
 * Wie der WKR die Zeichnung legt (Nutzer 24.11.2026: „Dafür braucht Bild die Auswahl von den 4
 * Parcours-Himmelsrichtungen.“): Drehung im Uhrzeigersinn gegenüber der Datei, wie `rotate()` in SVG.
 */
export type BildLage = 0 | 90 | 180 | 270
export const BILD_LAGEN: readonly BildLage[] = [0, 90, 180, 270]
export type BildSeite = 'unten' | 'links' | 'oben' | 'rechts'

/**
 * Wo Start/Ziel und die Wende (Tor 5, im Parallelslalom Boje 5) bei dieser Drehung liegen – danach heißen die Lagen
 * (BL7, Nutzer 26.11.2026, R11-13). In jeder Datei liegt Start/Ziel links und Tor 5 bzw. Boje 5 rechts (geprüft
 * 26.11.2026 an allen Klassen-Zeichnungen und Parallel.svg, Test bild.test.ts „BL7“); gedreht im Uhrzeigersinn wandert
 * die linke Kante nach oben, dann nach rechts, dann nach unten: 0° = „Start/Ziel links“ (die Datei, wie bisher auf dem
 * Handy), 90° = „oben“, 180° = „rechts“, 270° = „unten“; die Wende liegt jeweils gegenüber.
 * Vorher (BL2, 24.11.2026) hießen die Lagen der Klassen nach dem Steg („Steg unten“ = Datei, wie die Variante
 * „Steg unten“ des Parcours-Repositorys) – Nutzer 26.11.2026: „Nein, Steg ist hier irreführend. Der steht immer anders.“
 */
export const BILD_LAGE_SEITE: Readonly<Record<BildLage, { start: BildSeite; wende: BildSeite }>> = Object.freeze({
  0: { start: 'links', wende: 'rechts' },
  90: { start: 'oben', wende: 'unten' },
  180: { start: 'rechts', wende: 'links' },
  270: { start: 'unten', wende: 'oben' },
})

/** Ist der Wert eine der vier Lagen? (Ablage, Props – alles andere gilt als „nicht gewählt“.) */
export function istBildLage(x: unknown): x is BildLage {
  return (BILD_LAGEN as readonly unknown[]).includes(x)
}

/** Die Lage einer (wirksamen) Drehung: −90° = 270°; was kein Vielfaches von 90° ist, zählt als 0°. */
export function lageVonDrehung(drehung: number): BildLage {
  const d = ((Math.round(drehung) % 360) + 360) % 360
  return istBildLage(d) ? d : 0
}

/**
 * Text einer gedrehten Zeichnung aufrecht halten (BL4, 24.11.2026): Die Ziffern an den Bojen (Nummer_Tor1 …,
 * A_Nummer_Boje1 …) stünden bei 180° auf dem Kopf – „6“ (Schikane) liest sich dann wie „9“. Jedes `<text>` bekommt
 * hinten an seinen `transform` eine Gegendrehung um die Mitte seines eigenen Rahmens (getBBox, im eigenen
 * Koordinatensystem): Die Lage im Bild bleibt, die Schrift steht wie in der Datei (auch eine leicht schräge bleibt
 * schräg). Gilt, weil zwischen Wurzel und Text nur Verschiebungen und Drehungen stehen – nie Spiegelungen (geprüft
 * 24.11.2026 an allen Dateien in src/assets/parcours). `null` = nichts zu tun (0° oder leerer Rahmen).
 */
export function aufrechtTransform(vorhanden: string | null, rahmen: { x: number; y: number; width: number; height: number }, drehung: number): string | null {
  const d = lageVonDrehung(drehung)
  if (d === 0 || (!rahmen.width && !rahmen.height)) return null
  const runde = (n: number) => Math.round(n * 1000) / 1000
  const gegen = `rotate(${-d} ${runde(rahmen.x + rahmen.width / 2)} ${runde(rahmen.y + rahmen.height / 2)})`
  return vorhanden && vorhanden.trim() ? `${vorhanden.trim()} ${gegen}` : gegen
}

/**
 * Drehung, mit der das Bild wirklich gezeigt wird (Prüfbefund 22.11.2026, WKR_ANNAHMEN.bildDrehungNachPlatz,
 * bestätigt 22.11.2026, R8-24): 0° und 180° immer; ±90° nur auf dem Pad und nur, wenn die gedrehte Zeichnung im freien Platz (Breite
 * der Fläche × höchste Höhe der Zeichnung) mindestens so groß erscheint wie die ungedrehte – sonst 0° wie auf dem
 * Handy. Vorher drehte das Pad immer ±90°, und eine Zeichnung mit `blick: hinten` (gate135, gate245, moewe …) wurde
 * hochkant doppelt so hoch wie der Bildschirm. Ohne bekannten Platz (vor dem ersten Messen, Test-DOM) 0°.
 *
 * Seit 24.11.2026 (Nutzer, WKR_ANNAHMEN BL3): Hat der WKR unter „Mehr → Ansicht“ eine Lage gewählt (`wahl`), gilt
 * GENAU sie – auf jedem Gerät und unabhängig vom Platz (die Zeichnung wird dann notfalls kleiner, CSS max-height).
 * Ohne Wahl bleibt alles wie oben: die Drehung des Bogens (Blick) nach Gerät und Platz.
 */
export function wirksameDrehung(
  drehung: number,
  o: { pad: boolean; seiten: { breite: number; hoehe: number } | null; platz: { breite: number; hoehe: number } | null; wahl?: BildLage | null },
): number {
  if (o.wahl !== undefined && o.wahl !== null && istBildLage(o.wahl)) return o.wahl
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
