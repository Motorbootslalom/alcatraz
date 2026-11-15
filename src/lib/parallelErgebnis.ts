import type { AppState, ClassId, ParallelPlanFest, ParallelRunde } from '../types'
import { klassenStarts, klassenTeilnehmer, rerunRunde, VORLAUF, zerlegeRerun, type RerunBasis } from '../planung/parallelRunden'
import { vergleicheNr } from './eingaben'
import { klassenErgebnis, wertungVon, type ErgebnisKonfig, type ErgebnisStand, type GesamtListe, type KlassenErgebnis, type WertungsEinheit } from './ergebnis'
import { parallelListen, type ParallelKonfig } from './parallelBogen'
import { RACECOURSES, rundenDisziplin, type Racecourse } from './parallelSchluessel'

// Das Ergebnis einer Runde des Parallelslaloms – rein, ohne DOM: Vorlauf („preliminary heat“),
// Halbfinale, Finals und Wiederholung („re-run“). Was aus den Runden für die Klasse folgt (wer
// als Nächstes fährt, das Ergebnis der Stage), steht in lib/parallelStage.ts.
//
// Gerechnet wird mit der Wertung des Manövrierens (lib/ergebnis.ts `klassenErgebnis`), nur als
// eigene Wertungseinheit: Die Werte stehen unter `parallel:<runde>`, der Lauf ist der Attempt
// (lib/parallelSchluessel.ts), die Spalten sind die des Aufbaus des Parallelslaloms. Was das
// Regelwerk dazu sagt, steht in regelwerke/uim-2026.yaml (`wertungJeDisziplin.parallel`):
//
//   • Regel 960, Pkt. 4.4: „Each driver shall have two attempts […] Times from both attempts
//     are counted up, adding penalty seconds (if any) and the driver is awarded UIM points for
//     his/her ranking“ – zwei Attempts, keiner gestrichen, es zählt die Summe.
//   • Pkt. 5.2.2: „If a disqualification occurs in parallel slalom, the driver concerned shall
//     be disqualified from the whole stage because he/she does not have the required two valid
//     attempts.“ – ein disqualifizierter Attempt disqualifiziert für die Runde. Das leistet die
//     Gesamtliste von selbst: Ohne Streichlauf lässt sich keine Disqualifikation streichen.
//   • Pkt. 5.2.6: „Parallel slalom - if two or more drivers have the same added times from
//     their two attempts (including penalties), the driver having the better single attempt
//     time (including penalties) from either his/her first or second attempt will be ranked
//     higher.“ – Stichentscheid `besterLauf`.
//   • Pkt. 4.4: „The four drivers having the highest score in each class shall participate in
//     the semi-finals and finals.“ – die besten vier sind „Qualified“.
//   • Pkt. 5.2.6: „If there is still a dead-heat situation and a decision is required in order
//     to set up the semi-finals or finals, the drivers having the same time must re-run both
//     attempts.“ – ein Gleichstand an der Grenze 4/5 wird gemeldet und sperrt das Weiterkommen.
//
// Annahmen (Organisation bzw. Entscheidung des Nutzers, nicht Regel 960):
//   • Gewertet wird, wer im festgeschriebenen Plan der Runde steht. Wer nachgemeldet ist und
//     keinen Platz im Plan hat, hat auch keine Zeile auf einer Liste – er stünde sonst für
//     immer „offen“ auf Platz 1.
//   • Offene stehen wie im Manövrieren ohne Zeit auf Platz 1. Anders als dort zählen beide
//     Attempts von Anfang an: Wer erst einen gefahren ist, ist offen – einen Zwischenstand nach
//     dem 1. Attempt gibt es nicht, weil die Attempts ineinander verschränkt gefahren werden.
//   • Im Vorlauf Disqualifizierte teilen sich den letzten Platz und haben keine Punkte (Pkt.
//     5.1: „Drivers must complete the relevant stage and cross the finishing line in order to
//     be classified for the stage.“; Pkt. 5.2.2 „disqualified from the whole stage“). X „Nicht
//     gestartet“ zählt wie eine Disqualifikation.
//   • „Qualified“ und Punkte stehen erst da, wenn die Klasse vollständig ist: Vorher sind die
//     Plätze vorläufig.
//   • Weniger als fünf Gewertete: Alle Gewerteten sind „Qualified“ – außer es ist nur einer:
//     Er fährt nicht weiter, sein Platz 1 gilt aus dem Vorlauf ({@link PARALLEL_ANNAHMEN}).

/** So viele kommen je Klasse weiter (Regel 960, Pkt. 4.4: „The four drivers having the highest score“). */
export const QUALIFIZIERT = 4

/**
 * So viele fahren aus dem Halbfinale um Platz 1 und 2 (Pkt. 4.4: „Drivers with 1st and 2nd
 * highest scores in the semi-finals compete for the 1st and 2nd place“) – die übrigen um Platz
 * 3 und 4.
 */
export const FINALE_UM_1 = 2

/**
 * ANNAHMEN zu Fällen, die Regel 960 nicht oder nicht eindeutig regelt – Organisation bzw.
 * Empfehlung des Bauplans, vom Veranstalter noch nicht bestätigt. Hier an EINER Stelle
 * umstellbar; gelesen werden sie in diesem Modul und in lib/parallelStage.ts.
 */
export const PARALLEL_ANNAHMEN = {
  /**
   * Frage 3 – weniger als vier Gewertete im Vorlauf (Regel 960 nennt nur „the four drivers“):
   * Ab so vielen Gewerteten wird ein Halbfinale gefahren. Bei 3: Halbfinale mit Dummy; der
   * Dritte des Halbfinales hat Platz 3 ohne ein Finale um Platz 3 und 4.
   */
  halbfinaleAb: 3,
  /** Frage 3 – ab so vielen Gewerteten wird ein Finale gefahren (2: direkt das Finale); darunter gilt Platz 1 aus dem Vorlauf. */
  finaleAb: 2,
  /**
   * Frage 5b – Pkt. 5.2.2: „In the case of disqualification in a semi-final or final, the driver
   * will be ranked last in the relevant heat.“ Der Fahrer behält die Punkte dieses Platzes
   * (anders als im Vorlauf, wo die Disqualifikation für die ganze Stage gilt). `false`: 0 Punkte.
   */
  disqImHeatBehaeltPunkte: true,
  /**
   * Disqualifikation in einer Wiederholung zum Vorlauf – von Regel 960 nicht genannt.
   * ENTSCHEIDUNG DES NUTZERS vom 15.11.2026: `heat` – der Re-run entscheidet nur die Reihenfolge
   * der Gleichstehenden; wer darin disqualifiziert wird, steht auf dem hinteren Platz der Gruppe,
   * die wiederholt hat (z. B. Platz 5), mit dessen Punkten. Die Plätze hinter der Gruppe ändern
   * sich dadurch nicht. (`stage` wäre: wie im Vorlauf selbst „disqualified from the whole
   * stage“, letzter Platz ohne Punkte, die Dahinterliegenden rücken auf.)
   */
  disqInWiederholungDesVorlaufs: 'heat' as 'stage' | 'heat',
} as const

/** Was die Wertung einer Runde von der Konfiguration braucht (config/konfig.ts `Konfig`). */
export type RundenKonfig = ErgebnisKonfig & Pick<ParallelKonfig, 'getAufbauten' | 'aufbauOrder' | 'rohRegelwerk'>

export type RundenStand = ErgebnisStand & Pick<AppState, 'parallelPlaene'>

/** Kennung der Disziplin in Regelwerk und Aufbau (config/catalog.ts `PARALLEL`). */
const DISZIPLIN = 'parallel'

/**
 * Die Wertungseinheit einer Runde; `undefined`, wenn nach dem Regelwerk kein Parallelslalom
 * gefahren wird (DM) oder kein Aufbau dafür da ist. Zwei Attempts gibt der Plan vor (Pkt. 4.4);
 * ob einer gestrichen wird, sagt das Regelwerk – ohne Angabe keiner.
 */
export function rundenEinheit(konfig: RundenKonfig, runde: ParallelRunde): WertungsEinheit | undefined {
  const listen = parallelListen(konfig)
  if (listen.length === 0) return undefined
  const je = konfig.getRegelwerk?.().wertungJeDisziplin ?? {}
  const eigen = Object.prototype.hasOwnProperty.call(je, DISZIPLIN) ? je[DISZIPLIN].wertungslaeufe : undefined
  return { disziplin: DISZIPLIN, schluessel: rundenDisziplin(runde), listen, laeufe: eigen?.laeufe ?? 2, streichlaeufe: eigen?.streichlaeufe ?? 0 }
}

/** Was aus den Plätzen einer Runde für das Weiterkommen folgt. */
export interface Qualifikation {
  /** Niemand ist mehr offen: Die Plätze stehen fest. Vorher gibt es weder „Qualified“ noch Punkte. */
  vollstaendig: boolean
  /** Die Starter (IDs), die weiterkommen. */
  qualifiziert: ReadonlySet<string>
  /**
   * Gleichstand an der Grenze zum Weiterkommen, den auch der Stichentscheid nicht trennt: Diese
   * Starter (IDs) teilen sich einen Platz, der die Grenze überdeckt, und müssen beide Attempts
   * wiederholen (Pkt. 5.2.6 „must re-run both attempts“). Leer = kein Gleichstand an der Grenze.
   */
  rerun: readonly string[]
  /** Die Klasse ist vollständig und nichts steht dem Weiterkommen im Weg. */
  entschieden: boolean
}

/**
 * Wer aus einer Runde weiterkommt: die besten `plaetze` unter den Gewerteten – erst, wenn die
 * Klasse vollständig ist. Teilen sich Starter einen Platz so, dass mehr als `plaetze` auf den
 * Plätzen 1 bis `plaetze` stünden (z. B. 1, 2, 3, 4, 4 oder 1, 2, 3, 3, 3), bleibt die GANZE
 * Klasse ohne „Qualified“, bis der Re-run gefahren ist (Entscheidung des Nutzers vom
 * 15.11.2026) – auch wer klar davor steht: Ein Aushang mit drei „Qualified“ und zwei „Re-run“
 * sähe aus wie ein Ergebnis, und die nächste Runde lässt sich ohnehin erst danach setzen.
 */
export function qualifikation(gesamt: Pick<GesamtListe, 'nachPlatz'>, plaetze: number = QUALIFIZIERT): Qualifikation {
  const vollstaendig = gesamt.nachPlatz.every((z) => wertungVon(z) !== 'offen')
  if (!vollstaendig) return { vollstaendig, qualifiziert: new Set(), rerun: [], entschieden: false }
  const vorn = gesamt.nachPlatz.filter((z) => wertungVon(z) === 'gewertet' && z.platz <= plaetze)
  if (vorn.length <= plaetze) return { vollstaendig, qualifiziert: new Set(vorn.map((z) => z.starter.id)), rerun: [], entschieden: true }
  // Mehr als `plaetze` auf den vorderen Plätzen: Der hinterste dieser Plätze ist geteilt und reicht über die Grenze.
  const grenze = Math.max(...vorn.map((z) => z.platz))
  return {
    vollstaendig,
    qualifiziert: new Set(),
    rerun: vorn.filter((z) => z.platz === grenze).map((z) => z.starter.id),
    entschieden: false,
  }
}

/** Was in der letzten Spalte der Liste „Result“ einer Runde steht. */
export type RundenVermerk = { art: 'qualified' } | { art: 'rerun' } | { art: 'final' } | { art: 'final34' } | { art: 'punkte'; punkte: number }

/** Das Ergebnis einer Klasse in einer Runde: die Listen der Attempts, die Summe und das Weiterkommen. */
export interface RundenErgebnis extends KlassenErgebnis, Qualifikation {
  runde: ParallelRunde
  /** Je Starter-ID und Attempt der Racecourse – aus dem festgeschriebenen Plan, nicht aus den Werten. */
  racecourse: ReadonlyMap<string, Readonly<Record<number, Racecourse>>>
  /**
   * Die Starter (IDs) in der Folge, nach der die nächste Runde gesetzt wird – erst, wenn die
   * Runde entschieden ist. Vorlauf: die Gewerteten, die weiterkommen (höchstens vier). Halbfinale
   * und Finals: alle Teilnehmer nach Platz.
   */
  folge: readonly string[]
  /**
   * Bei einem Gleichstand an der Grenze (`rerun` nicht leer): die Wiederholung, die ihn
   * entscheidet – und ob sie für die Klasse schon festgeschrieben ist (dann wird sie gefahren).
   */
  rerunRunde?: ParallelRunde
  rerunFest?: boolean
  /** Die Wiederholungen, die in die Plätze dieser Runde eingerechnet sind. */
  wiederholt: readonly ParallelRunde[]
  /**
   * Je Starter-ID die Runde, deren Zeit seinen Platz bestimmt hat: diese Runde – oder, für wen
   * wiederholt hat, die Wiederholung (Pkt. 5.2.6: „After running again only the time of the
   * re-run will be taken into account.“).
   */
  massgeblich: ReadonlyMap<string, { runde: ParallelRunde; gesamt: number | null }>
}

type Zeile = GesamtListe['nachPlatz'][number]

const istGewertet = (z: Zeile) => wertungVon(z) === 'gewertet'
const istOffen = (z: Zeile) => wertungVon(z) === 'offen'

/** Nach Platz: Offene vorn (wie in lib/ergebnis.ts), dann die Plätze, bei gleichem Platz Gewertete vor Disqualifizierten, dann nach Startnummer. */
function nachPlatz(zeilen: readonly Zeile[]): Zeile[] {
  return [...zeilen].sort((a, b) => Number(!istOffen(a)) - Number(!istOffen(b)) || a.platz - b.platz || Number(a.disq) - Number(b.disq) || vergleicheNr(a.starter.startNr, b.starter.startNr))
}

/**
 * Die Plätze innerhalb eines heat (die Vier des Halbfinales, das Paar eines Finales, die Gruppe
 * einer Wiederholung des Halbfinales): Gewertete nach Summe und Stichentscheid ab `versatz + 1`,
 * Disqualifizierte auf dem hinteren Platz des heat.
 *
 * Regel 960, Pkt. 5.2.2: „In the case of disqualification in a semi-final or final, the driver
 * will be ranked last in the relevant heat.“ Annahme ({@link PARALLEL_ANNAHMEN}, Frage 5b):
 * „heat“ ist im Halbfinale die Runde der Teilnehmer der Klasse (Platz 4 der vier), im Finale
 * das Paar (Platz 2 bzw. 4); zwei Disqualifizierte desselben heat teilen sich den hinteren
 * Platz, ohne Reihung nach dem gültigen Attempt.
 */
function imHeat(zeilen: readonly Zeile[], ids: ReadonlySet<string>, versatz = 0): Zeile[] {
  const heat = zeilen.filter((z) => ids.has(z.starter.id))
  const offene = heat.filter(istOffen).length
  const gewertet = heat.filter(istGewertet)
  return zeilen.map((z) => {
    if (!ids.has(z.starter.id)) return z
    const platz = istOffen(z) ? versatz + 1 : z.disq ? versatz + heat.length : versatz + offene + 1 + gewertet.filter((g) => g.platz < z.platz).length
    return platz === z.platz ? z : { ...z, platz }
  })
}

/**
 * Eine gefahrene Wiederholung in die Plätze ihrer Runde einrechnen: Die Starter des geteilten
 * Platzes `ids` stehen danach in der Folge der Wiederholung auf den Plätzen ab dem geteilten
 * (Pkt. 5.2.6: „the drivers having the same time must re-run both attempts. After running again
 * only the time of the re-run will be taken into account.“). Teilen sie sich auch dort einen
 * Platz, bleibt er geteilt.
 *
 * Wer in der Wiederholung disqualifiziert wird ({@link PARALLEL_ANNAHMEN}):
 *   • zum Vorlauf: nach Entscheidung des Nutzers vom 15.11.2026 (`heat`) wie zum Halbfinale – der
 *     Re-run entscheidet nur die Reihenfolge der Gleichstehenden. Umstellbar auf `stage`: Er ist
 *     wie im Vorlauf selbst für die Stage disqualifiziert (Pkt. 5.2.2: „disqualified from the
 *     whole stage because he/she does not have the required two valid attempts“) – letzter Platz
 *     ohne Punkte; wer hinter dem geteilten Platz stand, rückt auf.
 *   • zum Halbfinale (`heat`): Er steht auf dem hinteren Platz der Gruppe (Pkt. 5.2.2 „ranked
 *     last in the relevant heat“).
 */
function mitWiederholung(zeilen: readonly Zeile[], ids: readonly string[], wiederholung: readonly Zeile[], disq: 'stage' | 'heat'): Zeile[] {
  const gruppe = new Set(ids)
  const geteilt = Math.min(...zeilen.filter((z) => gruppe.has(z.starter.id)).map((z) => z.platz))
  const reVon = new Map(wiederholung.map((z) => [z.starter.id, z]))
  let raus = 0
  const neu = zeilen.map((z): Zeile => {
    const re = gruppe.has(z.starter.id) ? reVon.get(z.starter.id) : undefined
    if (!re) return z
    if (istGewertet(re)) return { ...z, platz: geteilt + re.platz - 1 }
    // Hinterer Platz der Gruppe – die Zeile bleibt, was sie in ihrer Runde war: Dort ist er gültig gefahren.
    if (disq === 'heat') return { ...z, platz: geteilt + ids.length - 1 }
    raus++
    return { ...z, disq: true, ergebnis: null, gesamt: null }
  })
  if (raus === 0) return neu
  const letzter = neu.filter((z) => !z.disq).length + 1
  return neu.map((z) => (z.disq ? { ...z, platz: letzter } : !gruppe.has(z.starter.id) && z.platz > geteilt ? { ...z, platz: z.platz - raus } : z))
}

/** Was {@link rohErgebnis} liefert: die Wertung der Runde für sich, ohne Wiederholungen und ohne die Plätze im heat. */
type RohErgebnis = KlassenErgebnis & { runde: ParallelRunde; racecourse: Map<string, Record<number, Racecourse>> }

function rohErgebnis(stand: RundenStand, konfig: RundenKonfig, klasse: ClassId, runde: ParallelRunde): RohErgebnis | null {
  const fest = stand.parallelPlaene?.[runde]
  const einheit = fest && rundenEinheit(konfig, runde)
  if (!fest || !einheit) return null
  // Nach dem Vorlauf tragen die Starts ihre Klasse: Sie werden je Klasse festgeschrieben.
  const starts = runde === VORLAUF ? fest.starts : fest.starts.filter((s) => s.klasse === klasse)
  const racecourse = new Map<string, Record<number, Racecourse>>()
  for (const s of starts) {
    for (const [id, rc] of [[s.a, 'A'], [s.b, 'B']] as const) {
      if (id === null) continue
      let je = racecourse.get(id)
      if (!je) racecourse.set(id, (je = {}))
      je[s.attempt] = rc
    }
  }
  // Nur wer im Plan steht, hat Zeilen auf den Listen der Runde – und nur der wird gewertet.
  const ergebnis = klassenErgebnis({ ...stand, starters: stand.starters.filter((p) => racecourse.has(p.id)) }, konfig, klasse, einheit)
  return ergebnis ? { ...ergebnis, runde, racecourse } : null
}

/** Die Wiederholungen zu einer Runde einrechnen, soweit sie festgeschrieben und gefahren sind. */
function mitWiederholungen(
  stand: RundenStand,
  konfig: RundenKonfig,
  klasse: ClassId,
  basis: RerunBasis,
  start: readonly Zeile[],
  plaetze: number,
): { zeilen: Zeile[]; quali: Qualifikation; rerunRunde?: ParallelRunde; rerunFest?: boolean; wiederholt: ParallelRunde[]; massgeblich: Map<string, { runde: ParallelRunde; gesamt: number | null }> } {
  let zeilen = [...start]
  const wiederholt: ParallelRunde[] = []
  const massgeblich = new Map(zeilen.map((z) => [z.starter.id, { runde: basis as ParallelRunde, gesamt: z.gesamt }]))
  for (let n = 1; ; n++) {
    const quali = qualifikation({ nachPlatz: zeilen }, plaetze)
    if (quali.rerun.length === 0) return { zeilen, quali, wiederholt, massgeblich }
    const runde = rerunRunde(basis, n)
    const teilnehmer = klassenTeilnehmer(stand.parallelPlaene?.[runde], klasse)
    if (teilnehmer.length === 0) return { zeilen, quali, rerunRunde: runde, rerunFest: false, wiederholt, massgeblich }
    const re = rohErgebnis(stand, konfig, klasse, runde)
    // Die Wiederholung gilt erst, wenn sie zu diesem Gleichstand gehört und jeder gefahren ist.
    const passt = teilnehmer.length === quali.rerun.length && quali.rerun.every((id) => teilnehmer.includes(id))
    if (!passt || !re || re.gesamt.nachPlatz.some(istOffen)) return { zeilen, quali, rerunRunde: runde, rerunFest: true, wiederholt, massgeblich }
    const disq = basis === 'pre' ? PARALLEL_ANNAHMEN.disqInWiederholungDesVorlaufs : 'heat'
    zeilen = mitWiederholung(zeilen, quali.rerun, re.gesamt.nachPlatz, disq)
    for (const z of re.gesamt.nachPlatz) massgeblich.set(z.starter.id, { runde, gesamt: z.gesamt })
    wiederholt.push(runde)
  }
}

/** Die Starter (IDs) eines Finales der Klasse: um Platz 1 und 2 (1) oder um Platz 3 und 4 (3). */
function finalisten(plan: ParallelPlanFest | undefined, klasse: ClassId, finale: 1 | 3): Set<string> {
  return new Set(klassenStarts(plan, klasse).flatMap((s) => (s.finale === finale ? [s.a, s.b] : [])).filter((id): id is string => id !== null))
}

/**
 * Das Ergebnis einer Klasse in einer Runde; null, solange der Plan der Runde nicht
 * festgeschrieben ist, die Klasse nicht darin vorkommt oder zur Klasse noch nichts erfasst ist.
 *
 * Je Runde (Regel 960, Pkt. 4.4):
 *   • Vorlauf: „The four drivers having the highest score in each class shall participate in
 *     the semi-finals and finals.“ – Grenze nach Platz 4; Wiederholungen eingerechnet.
 *   • Halbfinale: „The semi-final results are determined as mentioned above“ – alle Teilnehmer
 *     der Klasse gemeinsam nach der Summe beider Attempts, unabhängig vom Paar; Grenze nach
 *     Platz 2 („Drivers with 1st and 2nd highest scores in the semi-finals compete for the 1st
 *     and 2nd place“); Wiederholungen eingerechnet.
 *   • Finals: je Paar – Plätze 1 und 2 bzw. 3 und 4. Ein Gleichstand bleibt stehen (Pkt. 5.2.6:
 *     „there will be a dead-heat result“): Eine Wiederholung gibt es nur, wo eine Entscheidung
 *     nötig ist „in order to set up the semi-finals or finals“.
 *   • Wiederholung: die Gruppe für sich; ihre Plätze gehen in die Runde ein, zu der sie gehört.
 */
export function rundenErgebnis(stand: RundenStand, konfig: RundenKonfig, klasse: ClassId, runde: ParallelRunde): RundenErgebnis | null {
  const roh = rohErgebnis(stand, konfig, klasse, runde)
  if (!roh) return null
  const fertig = (zeilen: Zeile[], rest: Pick<RundenErgebnis, 'vollstaendig' | 'qualifiziert' | 'rerun' | 'entschieden' | 'folge'> & Partial<Pick<RundenErgebnis, 'rerunRunde' | 'rerunFest' | 'wiederholt' | 'massgeblich'>>): RundenErgebnis => {
    const von = new Map(zeilen.map((z) => [z.starter.id, z]))
    return {
      ...roh,
      gesamt: { ...roh.gesamt, nachPlatz: nachPlatz(zeilen), nachNummer: roh.gesamt.nachNummer.map((z) => von.get(z.starter.id) ?? z) },
      wiederholt: [],
      massgeblich: new Map(zeilen.map((z) => [z.starter.id, { runde, gesamt: z.gesamt }])),
      ...rest,
    }
  }
  const alle = new Set(roh.gesamt.nachPlatz.map((z) => z.starter.id))

  if (runde === VORLAUF || runde === 'semi') {
    const semi = runde === 'semi'
    const re = mitWiederholungen(stand, konfig, klasse, semi ? 'semi' : 'pre', semi ? imHeat(roh.gesamt.nachPlatz, alle) : roh.gesamt.nachPlatz, semi ? FINALE_UM_1 : QUALIFIZIERT)
    const { quali } = re
    let folge: string[] = []
    let qualifiziert = quali.qualifiziert
    if (quali.entschieden) {
      // Vorlauf: Nur Gewertete kommen weiter. Halbfinale: Alle fahren ein Finale – stehen mehr
      // als zwei Disqualifizierte auf dem hinteren Platz, ordnet sie die Startnummer (Annahme,
      // Organisation: Regel 960 regelt den Fall nicht).
      folge = nachPlatz(re.zeilen)
        .filter((z) => semi || (istGewertet(z) && quali.qualifiziert.has(z.starter.id)))
        .map((z) => z.starter.id)
      // Wer allein gewertet ist, fährt nicht weiter: Sein Platz gilt aus dem Vorlauf (Annahme, Frage 3).
      qualifiziert = new Set(semi ? folge.slice(0, FINALE_UM_1) : folge.length >= PARALLEL_ANNAHMEN.finaleAb ? folge : [])
      if (!semi && qualifiziert.size === 0) folge = []
    }
    return fertig(re.zeilen, { ...quali, qualifiziert, folge, rerunRunde: re.rerunRunde, rerunFest: re.rerunFest, wiederholt: re.wiederholt, massgeblich: re.massgeblich })
  }

  let zeilen = roh.gesamt.nachPlatz
  if (runde === 'final') {
    const plan = stand.parallelPlaene?.[runde]
    for (const finale of [1, 3] as const) zeilen = imHeat(zeilen, finalisten(plan, klasse, finale), finale - 1)
  } else if (zerlegeRerun(runde)?.basis === 'semi') {
    zeilen = imHeat(zeilen, alle)
  }
  const vollstaendig = !zeilen.some(istOffen)
  return fertig(zeilen, { vollstaendig, qualifiziert: new Set(), rerun: [], entschieden: vollstaendig, folge: vollstaendig ? nachPlatz(zeilen).map((z) => z.starter.id) : [] })
}

/**
 * Die Klassen einer Runde in der Reihenfolge, in der sie laut festgeschriebenem Plan zuerst
 * starten – so liegen die Wertungslisten, wie die Klassen fertig werden. Leer ohne Plan.
 */
export function klassenDerRunde(stand: Pick<AppState, 'starters' | 'parallelPlaene'>, runde: ParallelRunde): ClassId[] {
  const klasseVon = new Map(stand.starters.map((p) => [p.id, p.klasse]))
  const folge: ClassId[] = []
  for (const s of stand.parallelPlaene?.[runde]?.starts ?? []) {
    for (const id of [s.a, s.b]) {
      const klasse = s.klasse ?? (id === null ? undefined : klasseVon.get(id))
      if (klasse !== undefined && !folge.includes(klasse)) folge.push(klasse)
    }
  }
  return folge
}

/** Die Ergebnisse aller Klassen einer Runde, in der Reihenfolge von `klassen`. */
export function rundenErgebnisse(stand: RundenStand, konfig: RundenKonfig, klassen: readonly ClassId[], runde: ParallelRunde): RundenErgebnis[] {
  return klassen.flatMap((klasse) => rundenErgebnis(stand, konfig, klasse, runde) ?? [])
}

/** Die Punkte eines Platzes nach der Tabelle des Regelwerks (Pkt. 5.1); hinter ihrem Ende 0. */
const punkteVon = (punkte: readonly number[], platz: number) => (Number.isInteger(platz) && platz >= 1 ? (punkte[platz - 1] ?? 0) : 0)

/**
 * Was je Starter in der Spalte „UIM points“ der Liste „Result“ einer Runde steht; `null`,
 * solange die Klasse nicht vollständig ist – dann bleibt die Spalte leer.
 *
 * Regel 960, Pkt. 4.4: „the driver is awarded UIM points for his/her ranking (point 317.01 )“,
 * Pkt. 5.2.2: „… 1st and 2nd attempts combined times including penalties, ranking, UIM points“.
 *
 *   • Vorlauf: Wer weiterkommt, bekommt seine Punkte erst in den Finals – bei ihm steht
 *     „Qualified“. Ab Platz 5 gelten die Punkte des Platzes im Vorlauf; ein geteilter Platz
 *     gibt beiden die vollen Punkte, der nächste entfällt (wie auf der Gesamtliste des
 *     Manövrierens, lib/pokal.ts `gesamtPunkte`). Wer an der Grenze im Gleichstand steht, hat
 *     noch weder das eine noch das andere: „Re-run“ – und bis der Re-run gefahren ist, steht in
 *     der ganzen Klasse kein „Qualified“: Wer klar vor dem Gleichstand steht, hat so lange
 *     keinen Vermerk (Entscheidung des Nutzers). Wer dahinter steht, hat seine Punkte schon: Die
 *     Re-run-Fahrer bleiben auf den Plätzen, um die sie gleichauf lagen, auch wer im Re-run
 *     disqualifiziert wird (hinterer Platz der Gruppe, Entscheidung des Nutzers vom 15.11.2026,
 *     `PARALLEL_ANNAHMEN.disqInWiederholungDesVorlaufs`) – die Plätze dahinter ändern sich nicht
 *     mehr. Nur mit der Annahme `stage` rückten sie auf; dann bleiben sie bis zum Re-run leer.
 *     Disqualifizierte haben 0 Punkte (Pkt. 5.1).
 *   • Halbfinale: wer um Platz 1 und 2 fährt, wer um Platz 3 und 4 (Pkt. 4.4) – oder „Re-run“;
 *     solange ein Re-run aussteht, steht bei den übrigen nichts.
 *     Bei drei Teilnehmern (Halbfinale mit Dummy) steht beim Dritten schon seine Punktzahl: Er
 *     hat Platz 3 ohne ein Finale um Platz 3 und 4 (Annahme, Frage 3).
 *   • Finals: die Punkte des Platzes. Wer disqualifiziert ist, steht auf dem hinteren Platz
 *     seines Finales und behält dessen Punkte (Pkt. 5.2.2 „ranked last in the relevant heat“;
 *     Annahme, Frage 5b).
 *   • Wiederholung: nichts – sie entscheidet nur die Reihenfolge in ihrer Runde.
 */
export function rundenVermerke(
  ergebnis: Pick<RundenErgebnis, 'gesamt' | 'vollstaendig' | 'qualifiziert' | 'rerun'> & Partial<Pick<RundenErgebnis, 'runde'>>,
  punkte: readonly number[],
): Map<string, RundenVermerk> | null {
  if (!ergebnis.vollstaendig) return null
  const runde = ergebnis.runde ?? VORLAUF
  if (zerlegeRerun(runde)) return new Map()
  const zeilen = ergebnis.gesamt.nachPlatz
  // Steht ein Re-run aus, bleibt ohne Vermerk, wessen Weiterkommen oder Punkte daran hängen: im
  // Vorlauf, wer gewertet vor dem geteilten Platz steht – wer dahinter steht, nur, wenn eine
  // Disqualifikation im Re-run ihn aufrücken ließe (Annahme `stage`); im Halbfinale alle übrigen.
  const rerunPlatz = ergebnis.rerun.length > 0 ? Math.min(...zeilen.filter((z) => ergebnis.rerun.includes(z.starter.id)).map((z) => z.platz)) : undefined
  const dahinterOffen = PARALLEL_ANNAHMEN.disqInWiederholungDesVorlaufs === 'stage'
  return new Map(
    zeilen.flatMap((z): [string, RundenVermerk][] => {
      const id = z.starter.id
      if (runde === 'final') return [[id, { art: 'punkte', punkte: z.disq && !PARALLEL_ANNAHMEN.disqImHeatBehaeltPunkte ? 0 : punkteVon(punkte, z.platz) }]]
      if (ergebnis.rerun.includes(id)) return [[id, { art: 'rerun' }]]
      if (rerunPlatz !== undefined && (runde === 'semi' || dahinterOffen || (istGewertet(z) && z.platz < rerunPlatz))) return []
      return [vermerk(z)]
    }),
  )
  function vermerk(z: Zeile): [string, RundenVermerk] {
      const id = z.starter.id
      if (runde === 'semi') {
        if (ergebnis.qualifiziert.has(id)) return [id, { art: 'final' }]
        // Der Dritte von dreien fährt kein Finale: Platz 3 steht fest.
        const dritter = zeilen.length < 2 * FINALE_UM_1
        return [id, dritter ? { art: 'punkte', punkte: z.disq && !PARALLEL_ANNAHMEN.disqImHeatBehaeltPunkte ? 0 : punkteVon(punkte, FINALE_UM_1 + 1) } : { art: 'final34' }]
      }
      if (ergebnis.qualifiziert.has(id)) return [id, { art: 'qualified' }]
      return [id, { art: 'punkte', punkte: istGewertet(z) ? punkteVon(punkte, z.platz) : 0 }]
  }
}

/** Der frühere Name von {@link rundenVermerke} (als es nur den Vorlauf gab). */
export const vorlaufVermerke = rundenVermerke

// ---- Welche Listen eine Auswahl zeigt ------------------------------------------------------

/**
 * Wie die Liste der Attempts geteilt ist: zwei Tabellen „1st attempt“ und „2nd attempt“ mit der
 * Spalte Racecourse – oder zwei Tabellen „Racecourse A“ und „Racecourse B“ mit der Spalte
 * Attempt. Nur eine Ansicht: Werte, Plätze und Zeitstempel sind in beiden dieselben.
 */
export const RUNDEN_ANSICHTEN = ['attempt', 'racecourse'] as const
export type RundenAnsicht = (typeof RUNDEN_ANSICHTEN)[number]

export const RUNDEN_UMFANG = ['alles', 'attempts', 'result'] as const
export type RundenUmfang = (typeof RUNDEN_UMFANG)[number]
export const RUNDEN_ORDNUNG = ['platz', 'nummer', 'beide'] as const
export type RundenOrdnung = (typeof RUNDEN_ORDNUNG)[number]

/** Eine Liste in einer Reihenfolge: ein Dokument mit eigener Seitenzählung. */
export interface RundenBlatt {
  key: string
  ergebnis: RundenErgebnis
  /** „attempts“ = die Liste der Attempts (zwei Tabellen), „result“ = das Ergebnis der Runde. */
  art: 'attempts' | 'result'
  ordnung: 'platz' | 'nummer'
}

export interface RundenWahl {
  /** Nur diese Klassen; fehlt = alle. */
  klassen?: readonly ClassId[]
  umfang: RundenUmfang
  ordnung: RundenOrdnung
}

/** Die Blätter in Druckreihenfolge: Klasse (in der Reihenfolge von `alle`), erst die Attempts, dann das Result. */
export function rundenBlaetter(alle: readonly RundenErgebnis[], wahl: RundenWahl): RundenBlatt[] {
  // „beide“ wie bei den Wertungslisten des Manövrierens: erst nach Startnummer (zum Prüfen), dann nach Platz (Aushang).
  const ordnungen: RundenBlatt['ordnung'][] = wahl.ordnung === 'beide' ? ['nummer', 'platz'] : [wahl.ordnung]
  const arten: RundenBlatt['art'][] = wahl.umfang === 'alles' ? ['attempts', 'result'] : [wahl.umfang]
  return alle
    .filter((e) => wahl.klassen === undefined || wahl.klassen.includes(e.klasse))
    .flatMap((ergebnis) => arten.flatMap((art) => ordnungen.map((ordnung): RundenBlatt => ({ key: `${rundenDisziplin(ergebnis.runde)}/${ergebnis.klasse}/${art}/${ordnung}`, ergebnis, art, ordnung }))))
}

/** Eine Zeile einer Tabelle der Liste der Attempts: der Starter mit seinem Attempt und dem Racecourse. */
export interface AttemptZeile {
  zeile: RundenErgebnis['laeufe'][number]['nachNummer'][number]
  attempt: number
  /** Aus dem Plan; fehlt, wenn der Starter diesen Attempt im Plan nicht hat. */
  racecourse?: Racecourse
}

/** Eine der beiden Tabellen der Liste der Attempts. */
export interface AttemptTabelle {
  /** Wonach die Tabelle heißt: ein Attempt (1, 2) oder ein Racecourse (A, B). */
  titel: { art: 'attempt'; attempt: number } | { art: 'racecourse'; racecourse: Racecourse }
  zeilen: AttemptZeile[]
}

/**
 * Die Tabellen der Liste der Attempts einer Klasse in der gewählten Ansicht und Reihenfolge.
 *
 * „attempt“: je Attempt eine Tabelle; „racecourse“: je Racecourse eine Tabelle mit den Fahrten
 * beider Attempts auf ihm (jeder Starter fährt auf jedem Racecourse einmal). Die Ansicht teilt
 * nur anders auf, sie rechnet nichts.
 *
 * Die Liste hat keine Spalte „Platz“ (Entscheidung des Nutzers vom 15.11.2026): Ein Platz im
 * einzelnen Attempt entscheidet nichts – es zählt die Summe beider (Pkt. 4.4). „Nach Platz“
 * heißt deshalb in beiden Ansichten: die beste Zeit (mit Strafen) zuerst, Disqualifizierte am
 * Ende, dahinter, wer noch nicht gefahren ist; bei gleicher Zeit nach Startnummer, dann Attempt.
 */
export function attemptTabellen(ergebnis: RundenErgebnis, ansicht: RundenAnsicht, ordnung: 'platz' | 'nummer'): AttemptTabelle[] {
  const nummer = new Map(ergebnis.gesamt.nachNummer.map((z, i) => [z.starter.id, i]))
  const nachNummer = (a: AttemptZeile, b: AttemptZeile) => (nummer.get(a.zeile.starter.id) ?? 0) - (nummer.get(b.zeile.starter.id) ?? 0) || a.attempt - b.attempt
  /** Gewertete nach ihrer Zeit mit Strafen, dann Disqualifizierte, dann Offene. */
  const stufe = (z: AttemptZeile) => (z.zeile.disq ? 1 : z.zeile.gesamt === null ? 2 : 0)
  const nachZeit = (a: AttemptZeile, b: AttemptZeile) => stufe(a) - stufe(b) || (a.zeile.gesamt ?? 0) - (b.zeile.gesamt ?? 0) || nachNummer(a, b)
  const sortiert = (zeilen: AttemptZeile[]) => zeilen.sort(ordnung === 'platz' ? nachZeit : nachNummer)
  const jeAttempt = ergebnis.laeufe.map((l) => ({
    attempt: l.lauf,
    zeilen: l.nachNummer.map((zeile): AttemptZeile => ({ zeile, attempt: l.lauf, racecourse: ergebnis.racecourse.get(zeile.starter.id)?.[l.lauf] })),
  }))
  if (ansicht === 'attempt') return jeAttempt.map((a) => ({ titel: { art: 'attempt', attempt: a.attempt }, zeilen: sortiert([...a.zeilen]) }))
  return RACECOURSES.map((racecourse): AttemptTabelle => ({ titel: { art: 'racecourse', racecourse }, zeilen: sortiert(jeAttempt.flatMap((a) => a.zeilen.filter((z) => z.racecourse === racecourse))) }))
}
