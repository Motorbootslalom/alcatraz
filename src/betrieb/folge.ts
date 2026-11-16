import type { AppState, BereichBetrieb, BereichId, ClassId, Parcours, PunktId, StartRef, Starter, TrackItem } from '../types'
import { planEvent, type ParcoursPlan } from '../planung/plan'
import { istRunde } from '../planung/parallelRunden'
import { PARALLEL, versucheNacheinander } from '../config/catalog'
import { konfigVon } from '../state/reducer/gemeinsam'
import { felderJeKennung, laufSchluessel, werteVon, type Feld } from '../lib/eingaben'
import { nichtGestartet } from '../lib/erfassung'
import { BETRIEB_ANNAHMEN } from './annahmen'
import { abgleich, zeigerIn } from './schritte'

// Die Folge der Starts im Betrieb – rein, ohne DOM und ohne Store. Sie wird nie gespeichert, sondern
// immer aus dem Stand abgeleitet (BETRIEB_ANNAHMEN.folgeAbgeleitet): je Parcours die Folge der
// Verzahnung (`planEvent(stand).plans[].sequence`, dieselbe wie auf den WKR-Bögen), je Lauf einmal.
// Im Stand (`AppState.betrieb`) steht nur, was gezeigt und begonnen wurde – und ab E2 die Abweichungen:
// ein Schnappschuss der ganzen Folge (`reihenfolge`), der über die abgeleitete gelegt wird (Abgleich,
// betrieb/schritte.ts), zurückgestellte Starts und Klassen, deren Boot fehlt.
//
// Ein Start heißt nach dem, was ihn ausmacht (StartRef), als Text über `refKey`: So bleibt er derselbe,
// wenn Nachmeldungen, Abmeldungen oder eine andere Zahl der Läufe die Stellen verschieben.
//
// Parallelslalom (Bereich `parallel`) kommt mit E4; bis dahin liefert er nichts.

/** Der Bereich des Parallelslaloms (ab E4, nur unter UIM). */
export const PARALLEL_BEREICH: BereichId = PARALLEL

// --- Kennungen ----------------------------------------------------------------------------------

/** Die Kennung eines Starts als Text – eindeutig ohne Annahmen über die Form der Starter-IDs. */
export function refKey(ref: StartRef): string {
  return ref.art === 'm' ? JSON.stringify(['m', ref.starter, ref.lauf]) : JSON.stringify(['p', ref.runde, ref.attempt, ref.a, ref.b])
}

const ganzAb1 = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1
const starterId = (x: unknown): x is string => typeof x === 'string' && x !== ''

/** Der Start zu einer Kennung; `null`, wenn sie nicht von `refKey` stammen kann. */
export function liesRef(key: unknown): StartRef | null {
  if (typeof key !== 'string') return null
  let teile: unknown
  try {
    teile = JSON.parse(key)
  } catch {
    return null
  }
  if (!Array.isArray(teile)) return null
  if (teile[0] === 'm' && teile.length === 3 && starterId(teile[1]) && ganzAb1(teile[2])) return { art: 'm', starter: teile[1], lauf: teile[2] }
  const seite = (x: unknown): x is string | null => x === null || starterId(x)
  if (teile[0] === 'p' && teile.length === 5 && typeof teile[1] === 'string' && istRunde(teile[1]) && (teile[2] === 1 || teile[2] === 2) && seite(teile[3]) && seite(teile[4]))
    return { art: 'p', runde: teile[1], attempt: teile[2], a: teile[3], b: teile[4] }
  return null
}

/** Ist das die Kennung eines Punkts (`lauf:n`, `runde:<runde>`)? */
export function istPunktId(x: unknown): x is PunktId {
  if (typeof x !== 'string') return false
  const lauf = /^lauf:([1-9]\d*)$/.exec(x)
  if (lauf) return true
  return x.startsWith('runde:') && istRunde(x.slice('runde:'.length))
}

/** Der Punkt eines Laufs: `lauf:n`. */
export const laufPunkt = (n: number): PunktId => `lauf:${n}`

/** Die Nummer eines Lauf-Punkts; `undefined` bei einer Runde. */
export function laufVonPunkt(punkt: PunktId): number | undefined {
  const m = /^lauf:([1-9]\d*)$/.exec(punkt)
  return m ? Number(m[1]) : undefined
}

// --- Bereiche -----------------------------------------------------------------------------------

export interface BereichInfo {
  id: BereichId
  /** Name wie im Stand (der Parcours); die Anzeigetafel übersetzt ihn (betrieb/sicht.ts). */
  name: string
  art: 'manoevrieren' | 'parallel'
}

/**
 * Die Bereiche des Betriebs: jeder Parcours, auf dem Starter fahren, in der Folge der Verzahnung
 * (ab E4 dahinter der Parallelslalom). Mit `anzeige` nur die der gemeinsamen Anzeigetafel
 * (`anzeige.bereiche`, in deren Reihenfolge; leer oder ohne gültigen Eintrag = alle).
 */
export function bereicheZumStand(stand: AppState, optionen: { anzeige?: boolean } = {}): BereichInfo[] {
  const klassen = new Set(stand.starters.map((s) => s.klasse))
  const alle: BereichInfo[] = stand.parcoursList.filter((p) => p.classIds.some((k) => klassen.has(k))).map((p) => ({ id: p.id, name: p.name, art: 'manoevrieren' }))
  if (!optionen.anzeige) return alle
  const wahl = [...new Set(stand.anzeige.bereiche)].flatMap((id) => alle.filter((b) => b.id === id))
  return wahl.length > 0 ? wahl : alle
}

/** Gibt es diesen Bereich (einen Parcours der Verzahnung)? Auch ohne Starter – dort gibt es nur nichts zu zeigen. */
export function bereichBekannt(stand: Pick<AppState, 'parcoursList'>, bereich: BereichId): boolean {
  return stand.parcoursList.some((p) => p.id === bereich)
}

const LEER: BereichBetrieb = Object.freeze({
  begonnen: [],
  gezeigt: [],
  ohneAnzeige: [],
  zurueckgestellt: [],
  reihenfolge: null,
  ausgesetzt: [],
  vorziehen: BETRIEB_ANNAHMEN.vorziehenVorgabe,
  meldung: null,
}) as BereichBetrieb

/** Ein Bereich, in dem noch nichts geschehen ist. Nicht verändern – neue Stände entstehen per Spread. */
export const BEREICH_LEER: Readonly<BereichBetrieb> = LEER

/** Der Betrieb eines Bereichs; ohne Eintrag der leere. */
export function betriebVon(stand: Pick<AppState, 'betrieb'>, bereich: BereichId): BereichBetrieb {
  return Object.hasOwn(stand.betrieb.bereiche, bereich) ? stand.betrieb.bereiche[bereich] : LEER
}

/** Ist im Bereich nichts geschehen (dann braucht er keinen Eintrag)? */
export function bereichLeer(b: BereichBetrieb): boolean {
  return (
    b.begonnen.length === 0 &&
    b.gezeigt.length === 0 &&
    b.ohneAnzeige.length === 0 &&
    b.zurueckgestellt.length === 0 &&
    b.reihenfolge === null &&
    b.ausgesetzt.length === 0 &&
    b.vorziehen === BETRIEB_ANNAHMEN.vorziehenVorgabe &&
    b.meldung === null
  )
}

/**
 * Ist im Bereich Betrieb möglich – „Lauf beginnen“ und „Start zeigen“? Manövrieren: nur mit
 * festgeschriebener Verzahnung (BETRIEB_ANNAHMEN.nurFestgeschrieben); erst dann stehen Nummern und Folge fest.
 */
export function bereichFest(stand: Pick<AppState, 'verzahnungLocked'>, _bereich: BereichId): boolean {
  return !BETRIEB_ANNAHMEN.nurFestgeschrieben || stand.verzahnungLocked
}

// --- Programm und Folge -------------------------------------------------------------------------

/** Werden die Versuche eines Starters direkt nacheinander gefahren (ein Punkt `lauf:1`)? Wie die WKR-Bögen: nur mit mehr als einem Lauf. */
function nacheinander(stand: AppState): boolean {
  return Math.max(1, stand.laufCount) > 1 && versucheNacheinander({ regelwerk: stand.regelwerk, versucheNacheinander: stand.versucheNacheinander })
}

/** Der Punkt, zu dem ein Lauf gehört: `lauf:n`, mit „Versuche nacheinander“ immer `lauf:1`. */
export function punktVonLauf(stand: AppState, lauf: number): PunktId {
  return nacheinander(stand) ? laufPunkt(1) : laufPunkt(lauf)
}

/** Die Läufe eines Punkts: [n], mit „Versuche nacheinander“ alle. */
export function laeufeVonPunkt(stand: AppState, punkt: PunktId): number[] {
  const n = laufVonPunkt(punkt)
  if (n === undefined) return []
  return nacheinander(stand) ? Array.from({ length: Math.max(1, stand.laufCount) }, (_, i) => i + 1) : [n]
}

/**
 * Das Programm eines Bereichs: seine Punkte in ihrer Folge. Manövrieren: `lauf:1` bis zur Zahl der
 * Läufe, mit „Versuche nacheinander“ nur `lauf:1` (BETRIEB_ANNAHMEN.versucheNacheinanderEinPunkt).
 * Die Knoten haben keinen Lauf und kommen nicht vor. Ein unbekannter Bereich hat keines.
 */
export function programm(stand: AppState, bereich: BereichId): PunktId[] {
  if (!bereichBekannt(stand, bereich)) return []
  if (nacheinander(stand)) return [laufPunkt(1)]
  return Array.from({ length: Math.max(1, stand.laufCount) }, (_, i) => laufPunkt(i + 1))
}

/** Ein Start in der abgeleiteten Folge eines Bereichs. */
export interface FolgeEintrag {
  /** Kennung (`refKey`). */
  key: string
  ref: StartRef
  punkt: PunktId
  starter: string
  lauf: number
  klasse: ClassId
  /** X „nicht gestartet“ in einer Disq-Zelle dieses Laufs (Steg oder Vorsteg): Der Start entfällt – nie offen, nie der Nächste. */
  entfaellt: boolean
}

/**
 * Die Pläne der Verzahnung je Parcours, je Planungsstand einmal gerechnet: Wer die Lage aller Bereiche
 * braucht (Sicht, Reducer), rechnet die Verzahnung so nur einmal – auch über die Schritte des Betriebs
 * hinweg, die einen neuen Stand mit denselben Startern und Parcours anlegen. planEvent hängt nur an
 * Parcours, Startern, Booten und `class4Small` (planung/plan.ts); Stände sind unveränderlich, die
 * Zuordnung nach Referenz also sicher.
 */
interface PlanEintrag {
  boats: AppState['boats']
  class4Small: boolean
  jeParcours: ReadonlyMap<string, ParcoursPlan>
}
const plaene = new WeakMap<readonly Parcours[], WeakMap<readonly Starter[], PlanEintrag>>()
function planVon(stand: AppState, parcoursId: string): ParcoursPlan | undefined {
  let jeStarter = plaene.get(stand.parcoursList)
  if (!jeStarter) plaene.set(stand.parcoursList, (jeStarter = new WeakMap()))
  let eintrag = jeStarter.get(stand.starters)
  if (!eintrag || eintrag.boats !== stand.boats || eintrag.class4Small !== stand.class4Small) {
    eintrag = { boats: stand.boats, class4Small: stand.class4Small, jeParcours: new Map(planEvent(stand).plans.map((p) => [p.parcoursId, p])) }
    jeStarter.set(stand.starters, eintrag)
  }
  return eintrag.jeParcours.get(parcoursId)
}

/** Die Spur-Anordnung eines Bereichs (Klassen und Pausen je Spur) – dieselbe wie Verzahnung und WKR-Bögen. */
export function spurenVon(stand: AppState, bereich: BereichId): TrackItem[][] {
  return bereichBekannt(stand, bereich) ? (planVon(stand, bereich)?.tracks ?? []) : []
}

/**
 * Die abgeleitete Folge ALLER Punkte eines Bereichs hintereinander: je Lauf die Folge der Verzahnung;
 * mit „Versuche nacheinander“ je Starter Versuch 1 … n direkt hintereinander, alle im Punkt `lauf:1`.
 * Entfallene Starts (X) bleiben mit `entfaellt` an ihrer Stelle, damit die Stellen der übrigen nicht
 * springen, wenn ein X gesetzt oder entfernt wird. Ohne den Schnappschuss des Betriebs – das ist
 * {@link startfolge}.
 */
export function abgeleiteteFolge(stand: AppState, bereich: BereichId): FolgeEintrag[] {
  const punkte = programm(stand, bereich)
  if (punkte.length === 0) return []
  const folge = planVon(stand, bereich)?.sequence ?? []
  const konfig = konfigVon(stand)
  const disziplin = konfig.getAufbau(stand.aufbau).disziplin
  // Die Felder hängen an der Klasse – je Klasse einmal holen.
  const felder = new Map<ClassId, ReadonlyMap<string, Feld>>()
  const felderVon = (klasse: ClassId) => {
    let f = felder.get(klasse)
    if (!f) felder.set(klasse, (f = felderJeKennung(konfig, klasse)))
    return f
  }
  const abgemeldet = BETRIEB_ANNAHMEN.abgemeldetNurDurchX ? undefined : new Set(stand.abgemeldet)
  // Dieselbe Frage wie Wertung und Erfassung (lib/erfassung.ts `nichtGestartet`): ein X in irgendeiner
  // Disq-Zelle des Laufs, am Steg ODER am Vorsteg, auch neben anderen Codes (BETRIEB_ANNAHMEN.abgemeldetNurDurchX).
  const entfaellt = (s: Starter, lauf: number) => {
    if (abgemeldet?.has(s.id)) return true
    return nichtGestartet(werteVon(stand.eingaben, laufSchluessel(disziplin, lauf), s.id), felderVon(s.klasse))
  }
  const eintrag = (s: Starter, lauf: number, punkt: PunktId): FolgeEintrag => {
    const ref: StartRef = { art: 'm', starter: s.id, lauf }
    return { key: refKey(ref), ref, punkt, starter: s.id, lauf, klasse: s.klasse, entfaellt: entfaellt(s, lauf) }
  }
  if (nacheinander(stand)) {
    const laeufe = laeufeVonPunkt(stand, laufPunkt(1))
    return folge.flatMap((s) => laeufe.map((lauf) => eintrag(s, lauf, laufPunkt(1))))
  }
  return punkte.flatMap((punkt) => {
    const lauf = laufVonPunkt(punkt)!
    return folge.map((s) => eintrag(s, lauf, punkt))
  })
}

/**
 * Die Folge des Betriebs: die abgeleitete, darüber der Schnappschuss, wenn die Bedienung abgewichen ist
 * (Abgleich, betrieb/schritte.ts). Das ist die Folge, nach der Anzeigetafel und Start-Freigabe gehen.
 */
export function startfolge(stand: AppState, bereich: BereichId): FolgeEintrag[] {
  return abgleich(abgeleiteteFolge(stand, bereich), betriebVon(stand, bereich).reihenfolge)
}

// --- Lage ---------------------------------------------------------------------------------------

/** Ein Start aus dem Verlauf der Anzeige; `eintrag` fehlt, wenn er in der Folge nicht mehr vorkommt (Starter gelöscht, Lauf entfallen). */
export interface GezeigtEintrag {
  key: string
  ref: StartRef | null
  zeit: number
  eintrag: FolgeEintrag | null
}

/** Wo ein Bereich steht – alles, was Anzeigetafel, Start-Freigabe und die Schritte des Betriebs brauchen. */
export interface BereichLage {
  bereich: BereichId
  /** Betrieb möglich (Verzahnung festgeschrieben). */
  fest: boolean
  programm: PunktId[]
  /** Die begonnenen Punkte des Programms, in dessen Folge. */
  begonnen: PunktId[]
  /** Der laufende Punkt: der letzte begonnene im Programm. */
  laufend: PunktId | null
  /** Der erste Punkt des Programms, der nicht begonnen ist. */
  naechsterPunkt: PunktId | null
  /**
   * Der Punkt, um den es an der Start-Freigabe gerade geht (Klassen aussetzen und vorziehen, B-9/B-10): der
   * laufende, solange dort noch Starts frei sind oder ihr Boot fehlt; sonst der des Nächsten; sonst ein
   * begonnener, in dem nur noch Starts ausgesetzter Klassen offen sind; sonst der nächste Punkt, der beginnen
   * kann. `null`, wenn alles vorbei ist.
   */
  arbeitsPunkt: PunktId | null
  /** Die ganze Folge des Betriebs (abgeleitet, mit Schnappschuss), auch Entfallene. */
  folge: FolgeEintrag[]
  /** Die abgeleitete Folge ohne Schnappschuss – zum Vergleich: Gleicht ihr die neue Folge, braucht es keinen. */
  abgeleitet: FolgeEintrag[]
  /** Die Bedienung ist von der Folge der Verzahnung abgewichen (es gibt einen Schnappschuss). */
  abweichend: boolean
  /** „Im Boot“: der zuletzt gezeigte Start (bleibt am Ende eines Punkts stehen). */
  aktuell: GezeigtEintrag | null
  vorig: GezeigtEintrag | null
  /** Kennungen der gezeigten Starts. */
  gezeigtKeys: ReadonlySet<string>
  /** Kennungen der erledigten Starts: gezeigt oder „ohne Anzeige“ (Einsteigen). */
  erledigt: ReadonlySet<string>
  /** Höchste Stelle eines erledigten Starts (gezeigt oder ohne Anzeige) eines begonnenen Punkts in der Folge; −1 = keiner. */
  zeiger: number
  /**
   * Nicht erledigt, nicht zurückgestellt, Klasse nicht ausgesetzt und nicht nachzuholen – über alle Punkte,
   * in der Folge. Starts nicht begonnener Punkte zählen dazu, auch vor dem Zeiger: Sie warten auf ihren Punkt.
   */
  offen: FolgeEintrag[]
  /** Die offenen Starts begonnener Punkte; der erste ist der Nächste. */
  frei: FolgeEintrag[]
  /** Nicht erledigt, begonnener Punkt, vor dem Zeiger: Nachmeldung, entferntes X, verpasster Lauf. Nie von selbst der Nächste. */
  nachzuholen: FolgeEintrag[]
  /** Zurückgestellte Starts (B-3, bleiben sichtbar), in der Folge. */
  zurueckgestellt: FolgeEintrag[]
  /** Nicht erledigte Starts ausgesetzter Klassen („Boot fehlt“, V-5/L-7), in der Folge – sie fahren nicht. */
  bootFehlt: FolgeEintrag[]
  /** Die ausgesetzten Klassen („Boot fehlt“), wie im Betrieb vermerkt. */
  ausgesetzt: ClassId[]
  /** „Andere Klassen vorziehen“, solange eine Klasse aussetzt. */
  vorziehen: boolean
  /** Der erste offene Start, dessen Punkt begonnen ist (BETRIEB_ANNAHMEN.freigabeNachPunkt); `null` am Ende eines Punkts. */
  naechster: FolgeEintrag | null
}

/**
 * Die Lage eines Bereichs aus Stand und Folge. Maßgeblich für „der Nächste“ ist der Punkt, nicht die
 * Stelle (S-9): Ein Start von Lauf 1 im Block von Lauf 2 bleibt freigegeben; ein Start eines nicht
 * begonnenen Punkts wartet, bis der Punkt beginnt – auch wenn er vor dem Zeiger steht (ein dritter Lauf
 * mitten in Lauf 2). Am Ende eines Punkts bleibt der letzte gezeigte Start stehen
 * (BETRIEB_ANNAHMEN.endeBleibtStehen), `naechster` ist dann `null`.
 *
 * Einteilung eines nicht erledigten, nicht entfallenen Starts, in dieser Rangfolge: zurückgestellt (B-3);
 * „Boot fehlt“ (Klasse ausgesetzt, gleich wo er steht – vom Zeiger überholt ist er kein Nachzügler);
 * nachzuholen (vor dem Zeiger, Punkt begonnen); sonst offen.
 */
export function lage(stand: AppState, bereich: BereichId): BereichLage {
  const b = betriebVon(stand, bereich)
  const punkte = programm(stand, bereich)
  const begonnenMenge = new Set(b.begonnen)
  const begonnen = punkte.filter((p) => begonnenMenge.has(p))
  const abgeleitet = abgeleiteteFolge(stand, bereich)
  const gezeigtKeys = new Set(b.gezeigt.map((g) => g.ref))
  // Erledigt: gezeigt oder „ohne Anzeige“ (Einsteigen).
  const erledigt = new Set([...gezeigtKeys, ...b.ohneAnzeige])
  const folge = abgleich(abgeleitet, b.reihenfolge)
  const stelle = new Map(folge.map((e, i) => [e.key, i]))

  const gezeigtEintrag = (g: { ref: string; zeit: number } | undefined): GezeigtEintrag | null => {
    if (!g) return null
    const i = stelle.get(g.ref)
    return { key: g.ref, ref: liesRef(g.ref), zeit: g.zeit, eintrag: i === undefined ? null : folge[i] }
  }

  // Nur Erledigtes begonnener Punkte schiebt den Zeiger (BETRIEB_ANNAHMEN.zeigerNurBegonnene): Wird
  // „Versuche nacheinander“ mitten im Lauf ausgeschaltet, steht ein schon gefahrener zweiter Versuch im
  // Block von Lauf 2 – der Zeiger dort machte alle, die in Lauf 1 noch nicht dran waren, zu Nachzüglern.
  // Ebenso ein gezielt gezeigter Start eines späteren Laufs (B-5).
  const zeiger = zeigerIn(folge, erledigt, begonnenMenge, BETRIEB_ANNAHMEN.zeigerNurBegonnene)
  const zurueck = new Set(b.zurueckgestellt)
  const ausgesetzt = new Set(b.ausgesetzt)
  // Überholt (BETRIEB_ANNAHMEN.nichtBegonneneWarten): Punkt begonnen, und hinter dem Start ist schon ein
  // Start SEINES oder eines späteren begonnenen Punkts erledigt. Ohne Umstellungen ist das dasselbe wie „vor
  // dem Zeiger“; ein dritter Lauf aber, der mitten in Lauf 2 gesetzt und dort übergangen wurde, ist nicht
  // überholt – er wartet auf Lauf 3 und ist dann der Erste (S-9).
  const rang = new Map(punkte.map((p, i) => [p, i]))
  const ueberholt: boolean[] = new Array(folge.length).fill(false)
  let spaetesterRang = -1
  for (let i = folge.length - 1; i >= 0; i--) {
    const e = folge[i]
    const r = rang.get(e.punkt) ?? -1
    ueberholt[i] = begonnenMenge.has(e.punkt) && spaetesterRang >= r
    if (erledigt.has(e.key) && begonnenMenge.has(e.punkt)) spaetesterRang = Math.max(spaetesterRang, r)
  }

  const offen: FolgeEintrag[] = []
  const nachzuholen: FolgeEintrag[] = []
  const zurueckgestellt: FolgeEintrag[] = []
  const bootFehlt: FolgeEintrag[] = []
  folge.forEach((e, i) => {
    if (e.entfaellt || erledigt.has(e.key)) return
    const nachzuegler = BETRIEB_ANNAHMEN.nachzueglerNachzuholen && (BETRIEB_ANNAHMEN.nichtBegonneneWarten ? ueberholt[i] : i < zeiger)
    if (zurueck.has(e.key)) zurueckgestellt.push(e)
    else if (ausgesetzt.has(e.klasse) && (BETRIEB_ANNAHMEN.bootFehltVorNachzuholen || !nachzuegler)) bootFehlt.push(e)
    else if (nachzuegler) nachzuholen.push(e)
    else offen.push(e)
  })
  const frei = offen.filter((e) => begonnenMenge.has(e.punkt))
  const naechster = frei[0] ?? null
  const naechsterPunkt = punkte.find((p) => !begonnenMenge.has(p)) ?? null
  const laufend = begonnen.at(-1) ?? null
  // Der Arbeitspunkt (BETRIEB_ANNAHMEN.klassenImLaufendenPunkt): der laufende, solange dort noch Starts frei sind
  // oder auf ihr Boot warten – ein Nachzügler eines früheren Laufs, der gerade als Nächster eingereiht ist, nimmt
  // den Klassen des laufenden nicht ihr „Boot fehlt“ und „Vorziehen“ (B-9, B-10).
  const imLaufenden = laufend !== null && [...frei, ...bootFehlt].some((e) => e.punkt === laufend)

  return {
    bereich,
    fest: bereichFest(stand, bereich),
    programm: punkte,
    begonnen,
    laufend,
    naechsterPunkt,
    arbeitsPunkt: imLaufenden ? laufend : (naechster?.punkt ?? [...begonnen].reverse().find((p) => bootFehlt.some((e) => e.punkt === p)) ?? naechsterPunkt),
    folge,
    abgeleitet,
    abweichend: b.reihenfolge !== null,
    aktuell: gezeigtEintrag(b.gezeigt.at(-1)),
    vorig: gezeigtEintrag(b.gezeigt.at(-2)),
    gezeigtKeys,
    erledigt,
    zeiger,
    offen,
    frei,
    nachzuholen,
    zurueckgestellt,
    bootFehlt,
    ausgesetzt: b.ausgesetzt,
    vorziehen: b.vorziehen,
    naechster,
  }
}
