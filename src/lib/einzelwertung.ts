import type { AppState, ClassId, ParallelRunde, Starter, WertungsDisziplin } from '../types'
import { VORLAUF } from '../planung/parallelRunden'
import { disziplinGefahren, disziplinZaehlt, nichtGewertet, WERTUNGS_DISZIPLINEN } from './disziplinen'
import { vergleicheNr } from './eingaben'
import { klassenErgebnis } from './ergebnis'
import { rundenEinheit } from './parallelErgebnis'
import { klassenStand, offeneRunde, stageErgebnis, type KlassenStand, type StageKonfig, type StageStand } from './parallelStage'
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
 * Welche Runde des Parallelslaloms der Stichentscheid der Einzelwertung liest
 * ({@link EINZEL_FESTLEGUNGEN}.stichParallelRunde).
 */
export type StichParallelRunde = 'letzteDannVorletzte' | 'vorlauf' | 'platzbestimmend'

/**
 * Festlegungen zum Stichentscheid der Einzelwertung – Entscheidungen des Nutzers zu dem, was
 * Pkt. 5.2.6 offen lässt (Auslegung, nicht Wortlaut der Regel 960). Hier an EINER Stelle
 * umstellbar. Die Texte des Stichentscheids (i18n individual.tie, individual.tie.*,
 * individual.tieDecided, individual.tieShared in de/ und en/wertung.ts) beschreiben die Vorgabe –
 * wer hier umstellt, zieht sie nach.
 */
export const EINZEL_FESTLEGUNGEN = {
  /**
   * Pkt. 5.2.6 nennt „his/her better manoeuvring attempt (including penalties)“, die Knoten nennt
   * er nicht eigens. Festgelegt am 15.11.2026: Die Strafe der Knoten zählt zur Zeit des
   * Manövrierens – wie in dessen Ergebnis.
   * Beleg (24.11.2026, auf die Frage des Nutzers, wohin die Knoten laut UIM gehören): Regel 960,
   * Pkt. 4.3 „Manoeuvring consists of: Tying knots (point 4.3.1); Driving on the manoeuvring
   * racecourse (point 4.3.2)“ – die Knoten sind ein Teil des Manövrierens, nicht des
   * Parallelslaloms; Pkt. 5.2.1 (Manoeuvring) „best times including knots test penalties“ – die
   * Zeit des Manövrierens, nach der gereiht wird, enthält ihre Strafen. Stand: aus Pkt. 4.3 und
   * 5.2.1 abgeleitet, dem Nutzer am 24.11.2026 erklärt (nicht ausdrücklich von ihm bestätigt).
   */
  stichMitKnoten: true,
  /**
   * Pkt. 5.2.6 sagt nur „both his/her parallel slalom attempts“ – nicht, aus welcher Runde.
   * ENTSCHEIDUNG DES NUTZERS vom 24.11.2026 (ersetzt `vorlauf` vom 15.11.2026): „jeweils die letzte
   * gefahrene Runde, wenn das nicht reicht zusätzlich auch die vorletzte Runde“ –
   * `letzteDannVorletzte`: Für jeden Punktgleichen zählt die Summe beider Attempts SEINER zuletzt
   * gefahrenen Runde (Finale, Kleines Finale, Halbfinale oder Vorlauf – je nachdem, wie weit er
   * kam); ist auch die Zeit gleich, entscheidet die Summe seiner vorletzten gefahrenen Runde. Was
   * dabei als „gefahren“ zählt, steht an {@link gefahreneRunden}, wann die zweite Stufe greift, an
   * {@link einzelwertung}.
   * `vorlauf`: die beiden Attempts des Vorlaufs (die einzige Runde, die alle gefahren sind);
   * `platzbestimmend`: die Runde, die den Platz in der Stage bestimmt hat. Beide ohne zweite Stufe.
   * In jeder Fassung gilt nach einer Wiederholung deren Zeit („After running again only the time of
   * the re-run will be taken into account.“).
   */
  stichParallelRunde: 'letzteDannVorletzte' as StichParallelRunde,
} as const

/** Die Runden, die ein Starter gefahren haben kann – in der Folge des Wettkampfs, ohne Wiederholungen (die ersetzen nur Zeiten). */
const STICH_RUNDEN: readonly ParallelRunde[] = [VORLAUF, 'semi', 'small', 'final']

/** Eine Runde des Parallelslaloms, die ein Starter gefahren ist, mit der Summe beider Attempts. */
export interface GefahreneRunde {
  runde: ParallelRunde
  /** Hundertstel, mit Strafsekunden; `null` = in dieser Runde ohne gültige Summe (disqualifiziert, X neben einem gefahrenen Attempt). */
  zeit: number | null
}

/**
 * Die Runden des Parallelslaloms, die ein Starter gefahren ist, in der Folge des Wettkampfs
 * (Vorlauf, Halbfinale, Kleines Finale bzw. Finale) – für den Stichentscheid der Einzelwertung
 * (`letzteDannVorletzte`, Entscheidung des Nutzers vom 24.11.2026). Auslegungen beim Bau,
 * 24.11.2026, bestätigt 26.11.2026 (R11-26):
 *   • Gefahren ist eine Runde, in deren festgeschriebenem Plan er steht und in der er mindestens
 *     einen Attempt gestartet ist: In mindestens einem Attempt steht eine Zeit oder eine
 *     Disqualifikation, die kein X „Nicht gestartet“ ist. Wer in keinem Attempt gestartet ist (X
 *     in beiden; oder X im einen und der andere leer – die Runde ist mit dem X schon entschieden,
 *     Prüfbefund 24.11.2026), ist sie nicht gefahren – dann zählt die Runde davor. Ein X in einem
 *     Attempt neben einem gefahrenen ist wie eine Disqualifikation: Die Runde ist gefahren, ohne Zeit.
 *     Folge (so bestätigt 26.11.2026, R11-26): Wer zur letzten Runde nicht antritt, behält die
 *     Zeit der Runde davor und steht so vor einem Punktgleichen, der in seiner letzten Runde
 *     disqualifiziert wurde.
 *   • Disqualifiziert in einer Runde (Pkt. 5.2.2): Die Runde ist gefahren, hat aber keine Zeit –
 *     er steht damit hinter den Punktgleichen mit Zeit (wie bisher jeder ohne Zeit); es wird nicht
 *     auf die Runde davor ausgewichen.
 *   • Ein Dummy als Gegner ändert nichts: Wer gegen einen Dummy fährt (Halbfinale mit Dummy,
 *     Einzelner in einer Wiederholung), fährt seine beiden Attempts wie jeder andere.
 *   • Eine Wiederholung (Re-run) ist keine eigene Runde: Sie ersetzt die Zeit der wiederholten
 *     Runde (Pkt. 5.2.6 „After running again only the time of the re-run will be taken into
 *     account.“) – auch, wenn er im Re-run disqualifiziert wird (dann ohne Zeit).
 */
export function gefahreneRunden(ks: Pick<KlassenStand, 'runden'>, id: string): GefahreneRunde[] {
  return STICH_RUNDEN.flatMap((runde): GefahreneRunde[] => {
    const e = ks.runden.find((r) => r.runde === runde)?.ergebnis
    const z = e?.gesamt.nachPlatz.find((x) => x.starter.id === id)
    // Gestartet: ein Attempt mit Zeit oder Disqualifikation ohne X – ein leerer Attempt (offen) zählt nicht.
    if (!e || !z || !z.laeufe.some((l) => !l.nichtGestartet && !l.offen)) return []
    const m = e.massgeblich.get(id)
    return [{ runde, zeit: m ? m.gesamt : z.disq ? null : z.gesamt }]
  })
}

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
   * mit den Strafen der Knoten und beide Attempts der zuletzt gefahrenen Runde des
   * Parallelslaloms ({@link EINZEL_FESTLEGUNGEN}) – jeweils nur die Disziplinen, die zählen;
   * `null`, wenn eine davon fehlt (disqualifiziert, nicht gefahren). Wer keine hat, steht hinter
   * den Punktgleichen mit Zeit.
   */
  zeit: number | null
  /**
   * Die zweite Stufe des Stichentscheids (`letzteDannVorletzte`, Entscheidung des Nutzers vom
   * 24.11.2026): die Summe beider Attempts der vorletzten gefahrenen Runde des Parallelslaloms
   * (Hundertstel); `null` = dort ohne gültige Summe (disqualifiziert). Nur da, wo sie gebraucht
   * wird: bei gleichen Punkten UND gleicher {@link zeit} – und nur, wenn jeder dieser Gleichen eine
   * vorletzte Runde hat. Sonst fehlt das Feld.
   */
  zeit2?: number | null
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
 * ({@link EINZEL_FESTLEGUNGEN}): der bessere Versuch des Manövrierens plus beide Attempts der
 * zuletzt gefahrenen Runde des Parallelslaloms. Wem dafür eine Zeit fehlt, weil er
 * disqualifiziert ist (oder gar nicht gefahren ist), steht HINTER den Punktgleichen mit Zeit –
 * Entscheidung des Nutzers vom 15.11.2026: Eine Disqualifikation ist eine Wertung, damit letzter
 * Platz unter den Punktgleichen. Mehrere ohne Zeit teilen sich diesen hinteren Platz.
 *
 * Zweite Stufe (Entscheidung des Nutzers vom 24.11.2026: „wenn das nicht reicht zusätzlich auch
 * die vorletzte Runde“): Haben Punktgleiche auch dieselbe Zeit, kommt die Summe ihrer vorletzten
 * gefahrenen Runde dazu. Weil die Zeit der ersten Stufe in dieser Gruppe gleich ist, reiht die
 * Summe aller drei Teile genau so wie die vorletzte Runde allein – verglichen wird deshalb nur
 * sie (`zeit2`; mit Zeit vor ohne Zeit). Auslegungen beim Bau, 24.11.2026, bestätigt 26.11.2026
 * (R11-27):
 *   • Die zweite Stufe gilt für die ganze Gruppe der Punkt- und Zeitgleichen – oder für keinen:
 *     Hat einer von ihnen keine vorletzte Runde (nur den Vorlauf gefahren), entscheidet sie nicht
 *     („bei dem entscheidet die zweite Stufe nicht“), die Gruppe teilt sich den Platz. Paarweise
 *     entschieden könnten drei Gleiche sonst Plätze wie 1, 1, 2 bekommen.
 *   • Punktgleiche ohne Zeit (erste Stufe) bekommen keine zweite Stufe: Ihre Summe aus allen
 *     drei Teilen fehlte ebenso – sie teilen sich weiter den hinteren Platz (15.11.2026).
 * Was dann noch gleich ist, teilt sich den Platz (Pkt. 5.2.6 „If any of the above mentioned
 * solutions would not define a winner, there will be a dead-heat result.“). Ein geteilter Platz
 * lässt den nächsten entfallen (1, 1, 3).
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
  /**
   * Die Summen beider Attempts des Parallelslaloms, die für den Stichentscheid zählen: `erste`
   * für die Zeit, `zweite` für die zweite Stufe – `undefined`, wo es keine gibt (keine vorletzte
   * Runde, oder die Festlegung kennt keine zweite Stufe).
   */
  type ParallelZeiten = { erste: number | null; zweite?: number | null }
  const parallelZeiten = (id: string): ParallelZeiten => {
    if (!stage || !ks) return { erste: null }
    switch (EINZEL_FESTLEGUNGEN.stichParallelRunde) {
      case 'platzbestimmend':
        return { erste: stageVon.get(id)?.gesamt ?? null }
      case 'vorlauf':
        // Wer im Vorlauf oder in einer Wiederholung dazu disqualifiziert wurde, hat dort keine Zeit.
        return { erste: vorlauf?.massgeblich.get(id)?.gesamt ?? null }
      case 'letzteDannVorletzte': {
        const gefahren = gefahreneRunden(ks, id)
        const vorletzte = gefahren.at(-2)
        return { erste: gefahren.at(-1)?.zeit ?? null, ...(vorletzte ? { zweite: vorletzte.zeit } : {}) }
      }
    }
  }

  const roh = manoever.zeilen.map((m) => {
    const id = m.starter.id
    const mPunkte = !zaehltM || m.offen ? null : m.platz >= 1 && !m.disq ? platzPunkte(punkte, m.platz) : 0
    const s = stageVon.get(id)
    const pPunkte = stage ? (s?.punkte ?? 0) : null
    const mZeit = zaehltM ? manoeverZeit(id) : 0
    const pZeiten: ParallelZeiten = zaehltP ? parallelZeiten(id) : { erste: 0 }
    const pZeit = pZeiten.erste
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
      /** Die vorletzte gefahrene Runde; `undefined` = keine (oder ohne Parallelslalom, der zählt). */
      vorletzte: pZeiten.zweite,
    }
  })
  type Roh = (typeof roh)[number]
  const gewertet = roh.filter((z) => !z.offen)
  /** Punkt- und zeitgleich mit Zeit: die Gruppe, in der die zweite Stufe gefragt ist. */
  const zeitGleiche = (z: Roh) => (z.offen || z.zeit === null ? [] : gewertet.filter((y) => y.summe === z.summe && y.zeit === z.zeit))
  /** Die zweite Stufe gilt für die ganze Gruppe – nur, wenn jeder darin eine vorletzte Runde hat (siehe oben). */
  const zweiteStufe = new Map(
    roh.map((z) => {
      const gruppe = zeitGleiche(z)
      return [z, gruppe.length > 1 && gruppe.every((y) => y.vorletzte !== undefined)]
    }),
  )
  /**
   * Zwei Punktgleiche im Stichentscheid: < 0 = `a` vorn, > 0 = `b` vorn, 0 = er trennt sie nicht.
   * Erste Stufe: mit Zeit vor ohne, dann die bessere Zeit. Zweite Stufe: ebenso mit der vorletzten Runde.
   */
  const stichVergleich = (a: Roh, b: Roh): number => {
    if (a.zeit !== b.zeit) return a.zeit === null ? 1 : b.zeit === null ? -1 : a.zeit - b.zeit
    if (a.zeit === null || !zweiteStufe.get(a) || a.vorletzte === b.vorletzte) return 0
    return a.vorletzte == null ? 1 : b.vorletzte == null ? -1 : a.vorletzte - b.vorletzte
  }
  const vor = (a: Roh, b: Roh): boolean => a.summe > b.summe || (a.summe === b.summe && stichVergleich(a, b) < 0)
  const zeilen = roh.map((r): EinzelZeile => {
    const { vorletzte, ...z } = r
    const gleiche = r.offen ? [] : gewertet.filter((y) => y !== r && y.summe === r.summe)
    return {
      ...z,
      // Die Zeit der vorletzten Runde steht nur da, wo sie gefragt war – die Liste zeigt sie dann.
      ...(zweiteStufe.get(r) ? { zeit2: vorletzte ?? null } : {}),
      platz: r.offen ? 0 : 1 + gewertet.filter((y) => vor(y, r)).length,
      stich: gleiche.some((y) => stichVergleich(y, r) !== 0),
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
