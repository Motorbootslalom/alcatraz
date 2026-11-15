import type { AppState, ClassId, ParallelRunde, Starter, WertungsDisziplin } from '../types'
import { VORLAUF } from '../planung/parallelRunden'
import { disziplinGefahren, disziplinZaehlt, nichtGewertet, WERTUNGS_DISZIPLINEN } from './disziplinen'
import { vergleicheNr } from './eingaben'
import { klassenErgebnis } from './ergebnis'
import { rundenEinheit } from './parallelErgebnis'
import { klassenStand, offeneRunde, stageErgebnis, type StageKonfig, type StageStand } from './parallelStage'
import { platzPunkte, pokalKlassen, type PokalKlasse } from './pokal'

// Die Einzelwertung („Individual competition“) – rein, ohne DOM. Sie zählt je Starter die UIM
// points aus dem Manövrieren (lib/ergebnis.ts und lib/pokal.ts) und aus dem Parallelslalom
// (lib/parallelStage.ts `stageErgebnis`) zusammen.
//
// Regel 960:
//   • Pkt. 5.1: „The 2nd and the 3rd stage will be regarded as separate championships. At the
//     end of the 3rd stage, points of the 2nd and the 3rd stage will be added up. An overall
//     title in the individual competition will be awarded to the three drivers of each class
//     who have the highest scores from the sum of the 2nd and the 3rd stages.“
//   • Pkt. 5.2.3: „Individual competition / General: manoeuvring overall UIM points, parallel
//     slalom overall UIM points, UIM combined points ranking.“
//   • Pkt. 5.2.6: „Individual competition - if two or more drivers have the same combined number
//     of points from 2nd and 3rd stage, the driver having the best combined times, i.e. the sum
//     of his/her better manoeuvring attempt (including penalties) and both his/her parallel
//     slalom attempts (including penalties) - will be ranked higher.“ … „If any of the above
//     mentioned solutions would not define a winner, there will be a dead-heat result.“
//   • Pkt. 5.1: „The final results for the team competition are determined by the points gained
//     in the five best results of the team in the overall individual competitions.“ – Pkt. 5.2.4:
//     „Team competition: UIM points secured by the top five team members in the overall
//     individual competitions, sum of the top five points, ranking of the team.“
//
// Welche Disziplin zählt (Entscheidungen des Nutzers vom 15.11.2026, lib/disziplinen.ts): jede,
// zu der ein Wert erfasst ist – in beliebiger Reihenfolge, auch nur eine von beiden; dann sind
// ihre Punkte die der Einzelwertung. Der Schalter „Disziplin nicht werten“ (Entscheidung des
// O.O.D.; Regel 960 regelt den Abbruch einer Disziplin nicht) nimmt eine Disziplin für eine
// Klasse aus der Wertung. Auf Listen steht nie die Nummer einer Stage, nur der Name der Disziplin.
//
// Wer in einer Disziplin disqualifiziert ist, hat dort 0 Punkte (Pkt. 5.1: „Drivers must complete
// the relevant stage and cross the finishing line in order to be classified for the stage.“) und
// steht mit den Punkten der anderen in der Einzelwertung. Wer nicht im festgeschriebenen Plan
// des Parallelslaloms steht, hat dort ebenfalls 0 Punkte.
//
// Die Liste (components/ergebnis/EinzelwertungBlatt.vue) zeigt je Disziplin, die zählt, Zeit,
// Platz und UIM points ihres Gesamtergebnisses, dahinter die Summe und den Platz (Entscheidung des
// Nutzers vom 15.11.2026). Es gibt sie je Klasse erst, wenn jede
// Disziplin, die für die Klasse zählt, fertig ist: Vorher sind die Punkte vorläufig. Die
// Mannschaftswertung rechnet dagegen jederzeit (Zwischenstand, lib/pokal.ts): mit den Punkten,
// die schon feststehen. Die UIM points des Manövrierens stehen erst fest, wenn auch die Knoten
// erfasst sind (lib/pokal.ts `klasseFertig`).

/**
 * Festlegungen zum Stichentscheid der Einzelwertung – Entscheidungen des Nutzers vom 15.11.2026
 * zu dem, was Pkt. 5.2.6 offen lässt (Auslegung, nicht Wortlaut der Regel 960). Hier an EINER
 * Stelle umstellbar.
 */
export const EINZEL_FESTLEGUNGEN = {
  /**
   * Pkt. 5.2.6 nennt „his/her better manoeuvring attempt (including penalties)“, die Knoten nennt
   * er nicht eigens. Entschieden: Die Strafe der Knoten zählt zur Zeit des Manövrierens – wie in
   * dessen Ergebnis (Pkt. 5.2.1 „best times including knots test penalties“).
   */
  stichMitKnoten: true,
  /**
   * Pkt. 5.2.6 sagt nur „both his/her parallel slalom attempts“. Entschieden: die beiden Attempts
   * des Vorlaufs, der einzigen Runde, die alle gefahren sind – nach einer Wiederholung zum
   * Vorlauf deren Zeiten („After running again only the time of the re-run will be taken into
   * account.“). `platzbestimmend` wäre die Runde, die den Platz bestimmt hat.
   */
  stichParallelRunde: 'vorlauf' as 'vorlauf' | 'platzbestimmend',
} as const

export type EinzelStand = StageStand & Partial<Pick<AppState, 'nichtWerten' | 'abgemeldet'>>
export type EinzelKonfig = StageKonfig

/**
 * Was eine Disziplin auf der Liste der Einzelwertung zeigt (Entscheidung des Nutzers vom
 * 15.11.2026): die Zeit und den Platz ihres Gesamtergebnisses – neben den UIM points.
 */
export interface DisziplinErgebnis {
  /**
   * Hundertstel; `null` = disqualifiziert. Manövrieren: die gewertete Zeit der Gesamtliste – der
   * bessere Versuch mit seinen Strafen und den Strafen der Knoten. Parallelslalom: die Summe beider
   * Attempts in der Runde, die den Platz bestimmt hat (Finalisten im Finale, ab Platz 5 im Vorlauf).
   */
  zeit: number | null
  /** Der Platz im Gesamtergebnis der Disziplin. */
  platz: number
  disq: boolean
}

/** Eine Zeile der Einzelwertung. */
export interface EinzelZeile {
  starter: Starter
  /** UIM points aus dem Manövrieren; `null` = dort noch ohne Ergebnis, oder die Disziplin zählt für die Klasse nicht. */
  manoever: number | null
  /** UIM points aus dem Parallelslalom; `null` = die Klasse ist dort noch nicht fertig, oder die Disziplin zählt nicht. */
  parallel: number | null
  /** Zeit und Platz im Gesamtergebnis des Manövrierens; `null` wie bei {@link manoever}. */
  manoeverErgebnis: DisziplinErgebnis | null
  /** Zeit und Platz im Gesamtergebnis des Parallelslaloms; `null` auch für den, der nicht in dessen Plan stand. */
  parallelErgebnis: DisziplinErgebnis | null
  /** Die Summe der Disziplinen, die zählen („UIM combined points“); was noch fehlt, zählt 0. */
  summe: number
  /** In keiner Disziplin ein Ergebnis: ohne Platz. */
  offen: boolean
  /** In einer Disziplin, die zählt, disqualifiziert (dort 0 Punkte). */
  disq: boolean
  /** Platz in der Einzelwertung; 0 für Offene. */
  platz: number
  /** Punktgleich mit einem anderen – den Platz hat der Stichentscheid (Pkt. 5.2.6) bestimmt. */
  stich: boolean
  /** Punktgleich mit einem anderen Starter der Klasse: Die Zeit des Stichentscheids steht auf der Liste. */
  punktgleich: boolean
  /**
   * Die „combined times“ des Stichentscheids (Hundertstel): der bessere Versuch des Manövrierens
   * mit den Strafen der Knoten und beide Attempts des Parallelslaloms – jeweils nur die
   * Disziplinen, die zählen; `null`, wenn eine davon fehlt (disqualifiziert, nicht gefahren).
   * Wer keine hat, steht hinter den Punktgleichen mit Zeit.
   */
  zeit: number | null
}

export interface EinzelErgebnis {
  klasse: ClassId
  /** Die Disziplinen, die für die Klasse zählen (lib/disziplinen.ts) – in fester Folge, ohne Rang. */
  disziplinen: WertungsDisziplin[]
  /** Gefahrene Disziplinen, die für die Klasse per Schalter nicht gewertet werden (Entscheidung des O.O.D.). */
  gestrichen: WertungsDisziplin[]
  /** Das Gesamtergebnis des Manövrierens der Klasse steht fest (mit den Knoten) – oder es zählt nicht. */
  manoeverFertig: boolean
  /** Die Klasse hat alle Runden des Parallelslaloms gefahren – oder er zählt nicht. */
  parallelFertig: boolean
  /** Mindestens eine Disziplin zählt, und jede davon ist fertig: Die Einzelwertung ist endgültig. */
  fertig: boolean
  /** Die Runde des Parallelslaloms, an der es noch hängt; fehlt, wenn er fertig ist, nicht zählt oder die Klasse nicht in seinem Plan steht. */
  offeneRunde?: ParallelRunde
  /** Der Plan dieser Runde passt nicht mehr zum Ergebnis davor – lösen und neu festschreiben (lib/parallelStage.ts). */
  planVeraltet?: boolean
  /** Nach Platz, bei gleichem Platz nach Zeit und Startnummer; Offene am Ende. */
  nachPlatz: EinzelZeile[]
  /** Das Manövrieren der Klasse, wie es die Mannschaftswertung liest (lib/pokal.ts) – für deren Zwischenstand. */
  manoever: PokalKlasse
}

/** Kennt das Regelwerk den Parallelslalom – und damit die Einzelwertung aus zwei Disziplinen? Unter der DM nicht. */
export function kenntEinzelwertung(konfig: EinzelKonfig): boolean {
  return rundenEinheit(konfig, VORLAUF) !== undefined
}

/**
 * Wird der Parallelslalom gewertet? Sobald zu ihm der erste Wert erfasst ist (Entscheidung des
 * Nutzers, lib/disziplinen.ts) – unter einem Regelwerk ohne Parallelslalom (DM) nie.
 */
export function parallelGewertet(stand: EinzelStand, konfig: EinzelKonfig): boolean {
  return kenntEinzelwertung(konfig) && disziplinGefahren(stand, 'parallel')
}

/**
 * Die Einzelwertung einer Klasse; `null` für eine Klasse ohne Starter. Sie lässt sich jederzeit
 * rechnen – endgültig ist sie erst mit `fertig`.
 *
 * Manövrieren: die Punkte des Platzes der Gesamtliste, im Zwischenstand des Platzes unter den
 * Gefahrenen (lib/pokal.ts `pokalKlassen`, mit den Knoten); Disqualifizierte 0. Parallelslalom:
 * die Punkte seines Ergebnisses (lib/parallelStage.ts `stageErgebnis`), erst wenn die Klasse alle
 * ihre Runden gefahren ist. Eine Disziplin, die für die Klasse nicht zählt, trägt nichts bei.
 *
 * Plätze: nach der Summe der Punkte. Punktgleiche trennt die Zeit nach Pkt. 5.2.6
 * ({@link EINZEL_FESTLEGUNGEN}). Wem für den Stichentscheid eine Zeit fehlt, weil er in einer
 * Disziplin disqualifiziert ist (oder dort gar nicht gefahren ist), steht HINTER den
 * Punktgleichen mit Zeit – Entscheidung des Nutzers vom 15.11.2026: Eine Disqualifikation ist
 * eine Wertung, damit letzter Platz unter den Punktgleichen. Mehrere ohne Zeit teilen sich
 * diesen hinteren Platz; gleiche Zeiten teilen den Platz ebenfalls (Pkt. 5.2.6 „dead-heat
 * result“). Ein geteilter Platz lässt den nächsten entfallen (1, 1, 3).
 */
export function einzelwertung(stand: EinzelStand, konfig: EinzelKonfig, klasse: ClassId, punkte: readonly number[]): EinzelErgebnis | null {
  const manoever = pokalKlassen(stand, konfig, [klasse], { knoten: true })[0]
  if (!manoever) return null
  const zaehltM = disziplinZaehlt(stand, 'manoever', klasse)
  const zaehltP = disziplinZaehlt(stand, 'parallel', klasse)
  const gesamt = zaehltM ? klassenErgebnis(stand, konfig, klasse)?.gesamt : undefined
  const gesamtVon = new Map((gesamt?.nachPlatz ?? []).map((z) => [z.starter.id, z]))
  const ks = zaehltP ? klassenStand(stand, konfig, klasse) : null
  const stage = zaehltP ? stageErgebnis(stand, konfig, klasse, punkte) : null
  const stageVon = new Map((stage?.nachPlatz ?? []).map((z) => [z.starter.id, z]))
  const vorlauf = ks?.runden.find((r) => r.runde === VORLAUF)?.ergebnis ?? null

  /** Der bessere Versuch des Manövrierens mit seinen Strafen (Hundertstel); `null` ohne gültigen Versuch. */
  const manoeverZeit = (id: string): number | null => {
    const z = gesamtVon.get(id)
    const gueltig = (z?.laeufe ?? []).flatMap((l) => (!l.disq && l.gesamt !== null ? [l.gesamt] : []))
    if (!z || z.disq || gueltig.length === 0) return null
    // Die Knoten sind Strafsekunden: je Strafpunkt eine Sekunde, wie in der Gesamtliste.
    return Math.min(...gueltig) + (EINZEL_FESTLEGUNGEN.stichMitKnoten ? z.knoten * 100 : 0)
  }
  /** Die Summe beider Attempts des Parallelslaloms in der Runde, die für den Stichentscheid zählt. */
  const parallelZeit = (id: string): number | null => {
    if (!stage) return null
    if (EINZEL_FESTLEGUNGEN.stichParallelRunde === 'platzbestimmend') return stageVon.get(id)?.gesamt ?? null
    // Wer im Vorlauf oder in einer Wiederholung dazu disqualifiziert wurde, hat dort keine Zeit.
    return vorlauf?.massgeblich.get(id)?.gesamt ?? null
  }

  const roh = manoever.zeilen.map((m) => {
    const id = m.starter.id
    const mPunkte = !zaehltM || m.offen ? null : m.platz >= 1 && !m.disq ? platzPunkte(punkte, m.platz) : 0
    const s = stageVon.get(id)
    const pPunkte = stage ? (s?.punkte ?? 0) : null
    const mZeit = zaehltM ? manoeverZeit(id) : 0
    const pZeit = zaehltP ? parallelZeit(id) : 0
    // Zeit und Platz, wie sie im Gesamtergebnis der Disziplin stehen.
    const g = mPunkte === null ? undefined : gesamtVon.get(id)
    return {
      starter: m.starter,
      manoever: mPunkte,
      parallel: pPunkte,
      manoeverErgebnis: g ? { zeit: g.disq ? null : g.gesamt, platz: g.platz, disq: g.disq } : null,
      parallelErgebnis: pPunkte !== null && s ? { zeit: s.disq ? null : s.gesamt, platz: s.platz, disq: s.disq } : null,
      summe: (mPunkte ?? 0) + (pPunkte ?? 0),
      offen: mPunkte === null && pPunkte === null,
      disq: (zaehltM && m.disq) || s?.disq === true,
      zeit: mZeit !== null && pZeit !== null ? mZeit + pZeit : null,
    }
  })
  type Roh = (typeof roh)[number]
  /** Steht `a` unter Punktgleichen vor `b`? Mit der besseren Zeit – oder mit Zeit vor dem ohne. */
  const stichVor = (a: Roh, b: Roh): boolean => a.zeit !== null && (b.zeit === null || a.zeit < b.zeit)
  const vor = (a: Roh, b: Roh): boolean => a.summe > b.summe || (a.summe === b.summe && stichVor(a, b))
  const gewertet = roh.filter((z) => !z.offen)
  const zeilen = roh.map((z): EinzelZeile => {
    const gleiche = z.offen ? [] : gewertet.filter((y) => y !== z && y.summe === z.summe)
    return {
      ...z,
      platz: z.offen ? 0 : 1 + gewertet.filter((y) => vor(y, z)).length,
      stich: gleiche.some((y) => stichVor(y, z) || stichVor(z, y)),
      punktgleich: gleiche.length > 0,
    }
  })
  const disziplinen = WERTUNGS_DISZIPLINEN.filter((d) => (d === 'manoever' ? zaehltM : zaehltP))
  const gestrichen = WERTUNGS_DISZIPLINEN.filter((d) => disziplinGefahren(stand, d) && nichtGewertet(stand.nichtWerten, d, klasse))
  const manoeverFertig = !zaehltM || manoever.fertig
  const parallelFertig = !zaehltP || stage !== null
  const haengt = parallelFertig || !ks ? undefined : offeneRunde(ks)
  return {
    klasse,
    disziplinen,
    gestrichen,
    manoeverFertig,
    parallelFertig,
    fertig: disziplinen.length > 0 && manoeverFertig && parallelFertig,
    offeneRunde: haengt?.runde,
    planVeraltet: haengt?.veraltet === true ? true : undefined,
    nachPlatz: zeilen.sort(
      (a, b) => Number(a.offen) - Number(b.offen) || a.platz - b.platz || (a.zeit ?? Infinity) - (b.zeit ?? Infinity) || vergleicheNr(a.starter.startNr, b.starter.startNr),
    ),
    manoever,
  }
}

/** Die Einzelwertungen der Klassen mit Startern, in der Reihenfolge von `klassen`. */
export function einzelwertungen(stand: EinzelStand, konfig: EinzelKonfig, klassen: readonly ClassId[], punkte: readonly number[]): EinzelErgebnis[] {
  return klassen.flatMap((klasse) => einzelwertung(stand, konfig, klasse, punkte) ?? [])
}

/** Die Einzelwertung als Blatt: ein Dokument mit eigener Seitenzählung. */
export interface EinzelBlatt {
  key: string
  einzel: EinzelErgebnis
}

/**
 * Die Listen „Individual competition“: je Klasse eine, sobald jede Disziplin fertig ist, die für
 * die Klasse zählt – auch wenn nur eine gefahren ist (dann stehen deren Punkte da). Nur unter
 * einem Regelwerk mit Parallelslalom (Regel 960); unter der DM gibt es keine.
 */
export function einzelBlaetter(stand: EinzelStand, konfig: EinzelKonfig, klassen: readonly ClassId[], punkte: readonly number[]): EinzelBlatt[] {
  if (!kenntEinzelwertung(konfig)) return []
  return einzelwertungen(stand, konfig, klassen, punkte)
    .filter((e) => e.fertig)
    .map((einzel) => ({ key: `einzel/${einzel.klasse}`, einzel }))
}

/**
 * Die Einzelwertung als Grundlage der Mannschaftswertung UIM (lib/pokal.ts `uimWertung`): je
 * Starter die addierten Punkte der Disziplinen, die zählen, statt der Punkte eines Platzes, und
 * als Platz der der Einzelwertung – nach ihm fragt der Stichentscheid der Mannschaften (Pkt.
 * 5.2.6 „the sum of points of 1st places are added … the same procedure must been followed for
 * the 2nd place“). Fertig ist eine Klasse, wenn jede Disziplin fertig ist, die für sie zählt;
 * bis dahin ist die Mannschaftswertung ein Zwischenstand. Eine Klasse, für die alle gefahrenen
 * Disziplinen per Schalter gestrichen sind, trägt nichts bei und hält nichts auf.
 */
export function einzelPokalKlassen(einzel: readonly EinzelErgebnis[]): PokalKlasse[] {
  return einzel.map((e) => ({
    ...e.manoever,
    fertig: e.disziplinen.length === 0 ? e.gestrichen.length > 0 : e.fertig,
    zeilen: e.nachPlatz.map((z) => ({ starter: z.starter, platz: z.platz, disq: false, offen: z.offen, punkte: z.summe })),
  }))
}
