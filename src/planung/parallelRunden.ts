import type { BoatType, ClassId, ParallelPlaene, ParallelPlanFest, ParallelRunde, ParallelStartFest, PlanState, Starter } from '../types'
import { boatTypeOf, CLASS_IDS } from '../domain/classes'
import { buildParallelPlan, cmpStartNr, parallelActiveClasses, planAusStarts, verzahne, type ParallelPlan, type ParallelSlot } from './parallel'
import { istRunde, PARALLEL_RUNDEN, rundeHatEingaben, zerlegeAttempt } from '../lib/parallelSchluessel'

export type { ParallelPlaene, ParallelPlanFest, ParallelRunde, ParallelStartFest }

/**
 * Die Runden des Parallelslaloms in ihrer Folge (Regel 960, Pkt. 5.2.2: „Parallel slalom
 * preliminary heat / semi-finals / finals“): Vorlauf, Halbfinale, Kleines Finale, Finale. Eine
 * Wiederholung (Pkt. 5.2.6: „must re-run both attempts“) heißt `rerun-<runde>-<n>`
 * ({@link rerunRunde}). Der Vorlauf wird mit der Verzahnung für alle Klassen festgeschrieben;
 * Halbfinale, Kleines Finale, Finale und Wiederholungen je Klasse, sobald das Ergebnis der Runde
 * davor feststeht (lib/parallelStage.ts). Die Liste steht in lib/parallelSchluessel.ts (kein
 * Importkreis) und wird hier weitergereicht.
 */
export { istRunde, PARALLEL_RUNDEN }

/**
 * Die beiden Finals, seit 21.11.2026 eigene Runden („Kleines und großes Finale ist getrennt, wie
 * Vorlauf und Halbfinale“, Auftrag des Nutzers): `small` um Platz 3 und 4 (Pkt. 4.4: „compete for
 * the 3rd and 4th place“), zuerst gefahren (Entscheidung vom 15.11.2026), dann `final` um Platz 1
 * und 2. Beide stehen nur auf dem Ergebnis des Halbfinales, nicht aufeinander.
 */
export const FINALS = ['small', 'final'] as const satisfies readonly ParallelRunde[]

/** Ist die Runde eines der beiden Finals (Kleines Finale oder Finale)? */
export const istFinale = (runde: ParallelRunde): runde is (typeof FINALS)[number] => runde === 'small' || runde === 'final'

/** Der Vorlauf – „preliminary heat“ (Pkt. 5.2.2). */
export const VORLAUF: ParallelRunde = 'pre'

/**
 * Schlüssel des Textes mit dem Namen der Runde (i18n `parallel.round.*`): englisch nach
 * Pkt. 5.2.2 und 5.2.6 („Preliminary heat“, „Semi-finals“, „Re-run“); seit 21.11.2026
 * „Small final“ und „Final“ als eigene Runden (Entscheidung vom 15.11.2026: „Kleines Finale“).
 */
export function rundenText(runde: ParallelRunde): 'parallel.round.pre' | 'parallel.round.semi' | 'parallel.round.small' | 'parallel.round.final' | 'parallel.round.rerun' {
  return runde === 'pre' || runde === 'semi' || runde === 'small' || runde === 'final' ? `parallel.round.${runde}` : 'parallel.round.rerun'
}

/**
 * Die Runden, zu denen es eine Wiederholung geben kann: Regel 960, Pkt. 5.2.6 verlangt sie nur,
 * wo „a decision is required in order to set up the semi-finals or finals“ – also nach dem
 * Vorlauf (wer ins Halbfinale kommt) und nach dem Halbfinale (wer um Platz 1 und 2 fährt). In
 * den Finals bleibt ein Gleichstand stehen („there will be a dead-heat result“).
 */
export type RerunBasis = 'pre' | 'semi'

/** Die n-te Wiederholung zu einer Runde: `rerun-pre-1`. */
export function rerunRunde(basis: RerunBasis, n: number): ParallelRunde {
  return `rerun-${basis}-${n}`
}

/** Zu welcher Runde eine Wiederholung gehört und die wievielte sie ist; `undefined` für alles andere. */
export function zerlegeRerun(runde: ParallelRunde): { basis: RerunBasis; n: number } | undefined {
  const m = /^rerun-(pre|semi)-([1-9]\d*)$/.exec(runde)
  return m ? { basis: m[1] as RerunBasis, n: Number(m[2]) } : undefined
}

/**
 * Die Stelle einer Runde in der Folge des Wettkampfs: Vorlauf, seine Wiederholungen, Halbfinale,
 * dessen Wiederholungen, Kleines Finale, Finale – das Kleine Finale vor dem Finale (Entscheidung
 * vom 15.11.2026; eigene Runde seit 21.11.2026).
 */
function rundenRang(runde: ParallelRunde): number {
  const rang = { pre: 0, semi: 1000, small: 2000, final: 3000 } as const
  if (runde === 'pre' || runde === 'semi' || runde === 'small' || runde === 'final') return rang[runde]
  const rerun = zerlegeRerun(runde)
  return rerun ? rang[rerun.basis] + Math.min(999, rerun.n) : 4000
}

/** Runden in der Folge, in der sie gefahren werden. */
export function vergleicheRunden(a: ParallelRunde, b: ParallelRunde): number {
  return rundenRang(a) - rundenRang(b) || a.localeCompare(b)
}

type RundenTextKey = ReturnType<typeof rundenText> | 'parallel.round.rerunOf' | 'parallel.round.rerunOfN'

/**
 * Der Name einer Runde in Worten: „Vorlauf“, „Halbfinale“, „Kleines Finale“, „Finale“ – und für eine Wiederholung
 * die Runde dazu („Vorlauf – Wiederholung“, ab der zweiten mit ihrer Nummer), damit sich die
 * Wiederholung zum Vorlauf von der zum Halbfinale unterscheidet. `t` ist die Übersetzung der
 * Oberfläche oder der Liste.
 */
export function rundenName(runde: ParallelRunde, t: (key: RundenTextKey, params?: Record<string, string | number>) => string): string {
  const rerun = zerlegeRerun(runde)
  if (!rerun) return t(rundenText(runde))
  const round = t(rundenText(rerun.basis))
  return rerun.n === 1 ? t('parallel.round.rerunOf', { round }) : t('parallel.round.rerunOfN', { round, n: rerun.n })
}

/** Was der Plan des Vorlaufs vom Zustand braucht. */
export type PlanQuelle = Pick<PlanState, 'starters' | 'class4Small' | 'parallelOrderByStartNr' | 'parallelStreng' | 'parallelPlaene'>

/**
 * Den Vorlauf aus dem Starterfeld rechnen – ohne Blick auf einen festgeschriebenen Plan.
 * Die einzige Stelle, die aus dem Zustand die Optionen des Plans macht: Anzeige, Festschreiben
 * und klassische Startnummern (planung/running.ts) rechnen so mit demselben Plan.
 */
export function rechneVorlauf(state: PlanQuelle): ParallelPlan {
  return buildParallelPlan(state.starters, {
    class4Small: state.class4Small,
    orderByStartNr: state.parallelOrderByStartNr,
    streng: state.parallelStreng !== false,
  })
}

const idVon = (slot: ParallelSlot): string | null => (slot.kind === 'starter' ? slot.p.id : null)

/**
 * Einen Plan festschreiben: Gehalten werden die Starter-IDs je Racecourse, der Attempt und der
 * Block, in der Reihenfolge der Starts. Der frühere Start eines Paares ist der 1. Attempt.
 */
export function schreibeFest(plan: ParallelPlan, runde: ParallelRunde): ParallelPlanFest {
  return { runde, starts: plan.heats.map((h) => ({ a: idVon(h.a), b: idVon(h.b), attempt: h.run, block: h.block, boot: h.boat })) }
}

/**
 * Einen festgeschriebenen Plan mit den heutigen Angaben der Starter zeigen (Name und
 * Startnummer dürfen sich ändern, die Reihenfolge nicht). Einen Starter, den es nicht mehr
 * gibt, ersetzt ein Dummy – sein Gegner fährt trotzdem; `fehlend` nennt diese IDs.
 */
export function loeseAuf(fest: ParallelPlanFest, starters: readonly Starter[]): { plan: ParallelPlan; fehlend: string[] } {
  const byId = new Map(starters.map((p) => [p.id, p]))
  const fehlend = new Set<string>()
  const slot = (id: string | null, boat: BoatType): ParallelSlot => {
    const p = id === null ? undefined : byId.get(id)
    if (id !== null && !p) fehlend.add(id)
    return p ? { kind: 'starter', p } : { kind: 'dummy', boat }
  }
  const plan = planAusStarts(fest.starts.map((s) => ({ boat: s.boot, a: slot(s.a, s.boot), b: slot(s.b, s.boot), run: s.attempt, block: s.block })))
  return { plan, fehlend: [...fehlend] }
}

export interface VorlaufPlan {
  plan: ParallelPlan
  /** Der Plan ist festgeschrieben und wird nicht neu gerechnet. */
  fest: boolean
  /** Nur bei festem Plan: IDs im Plan, zu denen es keinen Starter mehr gibt (als Dummy gezeigt). */
  fehlend: string[]
  /** Nur bei festem Plan: Starter der Klassen des Parallelslaloms, die nicht im Plan stehen (nachgemeldet). */
  ohnePlatz: Starter[]
  /**
   * Nur bei festem Plan: Starter, deren Bootstyp nicht mehr der ihres Paares ist – ihre Klasse
   * wurde nach dem Festschreiben geändert.
   */
  falschesBoot: Starter[]
}

/**
 * Der gültige Plan des Vorlaufs: der festgeschriebene, wenn es einen gibt – sonst der aus dem
 * Starterfeld gerechnete.
 */
export function vorlaufPlan(state: PlanQuelle): VorlaufPlan {
  const fest = state.parallelPlaene?.[VORLAUF]
  if (!fest) return { plan: rechneVorlauf(state), fest: false, fehlend: [], ohnePlatz: [], falschesBoot: [] }
  const { plan, fehlend } = loeseAuf(fest, state.starters)
  const imPlan = new Set(fest.starts.flatMap((s) => [s.a, s.b]))
  const aktiv = new Set(parallelActiveClasses())
  const falsch = new Map<string, Starter>()
  for (const h of plan.heats) {
    for (const s of [h.a, h.b]) {
      if (s.kind === 'starter' && (!aktiv.has(s.p.klasse) || boatTypeOf(s.p.klasse, state.class4Small) !== h.boat)) falsch.set(s.p.id, s.p)
    }
  }
  return {
    plan,
    fest: true,
    fehlend,
    ohnePlatz: state.starters.filter((p) => aktiv.has(p.klasse) && !imPlan.has(p.id)),
    falschesBoot: [...falsch.values()],
  }
}

/**
 * Ist der Plan des Vorlaufs an erfasste Werte gebunden? Sobald zum Vorlauf etwas erfasst ist,
 * stehen die Starts auf gedrucktem Papier und in der Erfassung: Der Plan bleibt dann
 * festgeschrieben, auch wenn die Verzahnung freigegeben wird, und die Schalter, nach denen er
 * gerechnet wurde, lassen sich nicht ändern (state/reducer.ts). Ein neu gerechneter Plan könnte
 * Starter auf den anderen Racecourse setzen oder Paare ändern – die Werte hingen dann zwar noch
 * am Starter und seinem Attempt, stünden aber in anderen Zeilen als auf dem Papier. Gelöst wird
 * die Bindung über „Werte löschen“: Ist die Verzahnung dann offen, entfällt der Plan im selben
 * Schritt (state/reducer.ts). Organisation, nicht Regel 960.
 */
export function vorlaufGebunden(state: { parallelPlaene?: ParallelPlaene; eingaben?: Readonly<Record<string, unknown>>; verzahnungLocked?: boolean }): boolean {
  // Ein Plan, der bei freigegebener Verzahnung noch da ist, hing an Werten und bleibt gebunden,
  // auch wenn das letzte Feld des Vorlaufs inzwischen geleert ist: Er entfällt nur über „Werte
  // löschen“ (Entscheidung des Nutzers vom 15.11.2026; state/reducer.ts).
  return state.parallelPlaene?.[VORLAUF] !== undefined && (rundeHatEingaben(state.eingaben ?? {}, VORLAUF) || state.verzahnungLocked === false)
}

/**
 * Den Plan des Vorlaufs an die Sperre „Verzahnung festschreiben“ binden: Ist sie gesetzt und
 * wird ein Parallelslalom gefahren (`parallel`), wird der Plan einmal festgeschrieben und bleibt
 * dann, wie er ist. Ist sie gelöst, entfällt er – der Plan folgt wieder dem Starterfeld. Er
 * bleibt aber, solange zum Vorlauf Werte erfasst sind ({@link vorlaufGebunden}).
 */
export function mitVorlaufPlan<T extends PlanQuelle & { verzahnungLocked: boolean; parallelPlaene: ParallelPlaene; eingaben?: Readonly<Record<string, unknown>> }>(state: T, parallel: boolean): T {
  const fest = state.parallelPlaene[VORLAUF]
  if (!state.verzahnungLocked) {
    if (!fest || rundeHatEingaben(state.eingaben ?? {}, VORLAUF)) return state
    // Mit dem Vorlauf entfallen die Runden danach: Sie stehen auf seinem Ergebnis. Und mit ihnen
    // ihre Werte – sie hätten keine Zeile mehr und kämen beim nächsten Festschreiben einer Runde
    // ungefragt zurück, bei anderen Paaren (wie beim Lösen einer Runde, lib/parallelStage.ts
    // `loeseRunde`). Werte des Vorlaufs gibt es hier keine, sonst wäre der Plan gebunden.
    const eingaben = state.eingaben
    const bleibt = eingaben && Object.keys(eingaben).some((k) => zerlegeAttempt(k) !== undefined) ? Object.fromEntries(Object.entries(eingaben).filter(([k]) => zerlegeAttempt(k) === undefined)) : eingaben
    return { ...state, parallelPlaene: {}, ...(bleibt === eingaben ? {} : { eingaben: bleibt }) }
  }
  if (fest || !parallel) return state
  return { ...state, parallelPlaene: { ...state.parallelPlaene, [VORLAUF]: schreibeFest(rechneVorlauf(state), VORLAUF) } }
}

/**
 * Wo ein Starter in einer Runde fährt: je Attempt der Racecourse und die Position des Starts
 * (ab 1). So folgt der Racecourse aus dem Plan und muss nirgends sonst gespeichert werden.
 */
export function plaetzeVon(fest: ParallelPlanFest, starterId: string): { attempt: 1 | 2; racecourse: 'A' | 'B'; start: number }[] {
  return fest.starts.flatMap((s, i) =>
    s.a === starterId || s.b === starterId ? [{ attempt: s.attempt, racecourse: s.a === starterId ? ('A' as const) : ('B' as const), start: i + 1 }] : [],
  )
}

// ---- Runden nach dem Vorlauf: je Klasse festgeschrieben -------------------------------------
//
// Halbfinale, Kleines Finale, Finale und Wiederholungen werden je Klasse festgeschrieben, sobald das Ergebnis
// der Runde davor feststeht (lib/parallelStage.ts sagt, wer fährt). Der Plan einer Runde sammelt
// die Starts aller Klassen – so sind die Listen der race officials wie im Vorlauf
// klassenübergreifend. Seit 19.11.2026 (Wunsch des Nutzers) wird die Runde als Ganzes verzahnt
// wie der Vorlauf ({@link verzahneRunde}): klein und groß im Wechsel. Eine später
// festgeschriebene Klasse ordnet die Runde neu, solange darin nichts erfasst, sie im Betrieb
// nicht begonnen und (20.11.2026) ihre Listen nicht gedruckt sind; danach kommt sie nur ans Ende
// und verschiebt keine Zeile einer früheren (state/reducer/parallel.ts, PARALLEL_ANNAHMEN.rundenVerzahnen).
// Re-run-Runden (`rerun-…`) werden genauso verzahnt (Antwort des Nutzers vom 20.11.2026).

/**
 * Ein Paar einer Runde nach dem Vorlauf: zwei Starter (IDs), `b: null` ist der Dummy. Um welche
 * Plätze ein Finale geht, sagt seit 21.11.2026 die Runde (`small`/`final`), nicht mehr das Paar.
 */
export interface RundenPaar {
  a: string
  b: string | null
}

/**
 * Paare „according to the personal number of the drivers“ (Regel 960, Pkt. 4.4, zum Halbfinale):
 * nach Startnummer aufsteigend, je zwei aufeinanderfolgende bilden ein Paar, die kleinere Nummer
 * beginnt auf Racecourse A. Annahme (Organisation, nicht Regel 960): Die „personal number“ ist
 * die Startnummer (race number); ein Einzelner am Ende fährt gegen einen Dummy.
 */
export function paareNachNummer(starter: readonly Starter[]): RundenPaar[] {
  const folge = [...starter].sort(cmpStartNr)
  const paare: RundenPaar[] = []
  for (let i = 0; i < folge.length; i += 2) paare.push({ a: folge[i].id, b: folge[i + 1]?.id ?? null })
  return paare
}

/** Die Starts einer Klasse im Plan einer Runde (nach dem Vorlauf), in dessen Reihenfolge. */
export function klassenStarts(plan: ParallelPlanFest | undefined, klasse: ClassId): ParallelStartFest[] {
  return plan?.starts.filter((s) => s.klasse === klasse) ?? []
}

/** Die Starter (IDs) einer Klasse im Plan einer Runde (nach dem Vorlauf), jeder einmal. */
export function klassenTeilnehmer(plan: ParallelPlanFest | undefined, klasse: ClassId): string[] {
  return [...new Set(klassenStarts(plan, klasse).flatMap((s) => [s.a, s.b]))].filter((id): id is string => id !== null)
}

/** Die Paare einer Klasse im Plan einer Runde: je 1. Attempt eines, mit dem Starter auf A zuerst. */
export function klassenPaare(plan: ParallelPlanFest | undefined, klasse: ClassId): RundenPaar[] {
  return klassenStarts(plan, klasse)
    .filter((s) => s.attempt === 1)
    .flatMap((s): RundenPaar[] => {
      const [a, b] = s.a === null ? [s.b, null] : [s.a, s.b]
      return a === null ? [] : [{ a, b }]
    })
}

/** Die Runden nach dem Vorlauf, in denen eine Klasse festgeschrieben ist – in der Folge des Wettkampfs. */
export function rundenDerKlasse(plaene: ParallelPlaene, klasse: ClassId): ParallelRunde[] {
  return (Object.keys(plaene) as ParallelRunde[]).filter((r) => r !== VORLAUF && klassenStarts(plaene[r], klasse).length > 0).sort(vergleicheRunden)
}

/**
 * Eine Klasse in einer Runde festschreiben: Ihre Paare kommen ans Ende des Plans der Runde.
 * Jedes Paar fährt seine beiden Attempts unmittelbar nacheinander, im 2. mit getauschten
 * Racecourses (Pkt. 4.4: „Each semi-final participant shall again have two attempts. The
 * drivers shall change boats and courses for the second attempt.“) und ist ein eigener Block –
 * wie im Vorlauf die Paare eines Bootstyps, die sich mit keinem anderen abwechseln können
 * (Organisation, nicht Regel 960). Stand die Klasse schon im Plan, werden ihre Starts ersetzt.
 */
export function mitKlasse(plaene: ParallelPlaene, runde: ParallelRunde, klasse: ClassId, paare: readonly RundenPaar[], boot: BoatType): ParallelPlaene {
  const bleibt = (plaene[runde]?.starts ?? []).filter((s) => s.klasse !== klasse)
  let block = Math.max(-1, ...bleibt.map((s) => s.block)) + 1
  const neu: ParallelStartFest[] = []
  for (const p of paare) {
    const zusatz = { block, boot, klasse }
    neu.push({ a: p.a, b: p.b, attempt: 1, ...zusatz }, { a: p.b, b: p.a, attempt: 2, ...zusatz })
    block++
  }
  return { ...plaene, [runde]: { runde, starts: [...bleibt, ...neu] } }
}

/**
 * Die Runde als Ganzes verzahnen wie den Vorlauf (Wunsch des Nutzers vom 19.11.2026: „Es fährt
 * immer großes Boot/kleines Boot im Wechsel“): die Paare aller Klassen der Runde, je Bootstyp
 * nach `klassenFolge` (die Folge der Klassen im Vorlauf, sonst ihre feste Folge) und innerhalb
 * der Klasse in ihrer Folge – dann klein und groß im
 * Wechsel ({@link verzahne}, dieselbe Stelle wie im Vorlauf). Jedes Paar behält seine beiden
 * Attempts mit getauschten Racecourses. Ob die Runde neu geordnet werden DARF (noch nichts
 * erfasst, im Betrieb nicht begonnen), entscheidet der Aufrufer (state/reducer/parallel.ts).
 */
export function verzahneRunde(plaene: ParallelPlaene, runde: ParallelRunde, klassenFolge: readonly ClassId[]): ParallelPlaene {
  const plan = plaene[runde]
  if (!plan || runde === VORLAUF) return plaene
  const rang = (k: ClassId | undefined) => {
    const i = k === undefined ? -1 : klassenFolge.indexOf(k)
    return i >= 0 ? i : klassenFolge.length + (k === undefined ? CLASS_IDS.length : CLASS_IDS.indexOf(k))
  }
  // Die Paare: je 1. Attempt eines, mit seinem 2. Attempt (sonst die getauschten Racecourses).
  const erste = plan.starts.filter((s) => s.attempt === 1)
  const paare = erste
    .map((s, i) => ({ s, i, zweiter: plan.starts.find((z) => z.attempt === 2 && z.block === s.block && z.klasse === s.klasse && z.a === s.b && z.b === s.a) }))
    .sort((x, y) => rang(x.s.klasse) - rang(y.s.klasse) || x.i - y.i)
  const starts = verzahne(
    paare.filter((p) => p.s.boot === 'klein'),
    paare.filter((p) => p.s.boot === 'gross'),
  ).map(({ paar, run, block }): ParallelStartFest => (run === 1 ? { ...paar.s, block } : { ...(paar.zweiter ?? { ...paar.s, a: paar.s.b, b: paar.s.a, attempt: 2 }), block }))
  // Hat sich nichts geändert, bleibt der Plan derselbe (Reducer: unverändert → dieselbe Referenz).
  const gleich = starts.length === plan.starts.length && starts.every((s, i) => JSON.stringify(s) === JSON.stringify(plan.starts[i]))
  return gleich ? plaene : { ...plaene, [runde]: { runde, starts } }
}

/** Eine Klasse aus einer Runde lösen; ein Plan ohne Starts entfällt. Die Starts der anderen Klassen bleiben in ihrer Folge. */
export function ohneKlasse(plaene: ParallelPlaene, runde: ParallelRunde, klasse: ClassId): ParallelPlaene {
  const plan = plaene[runde]
  if (!plan || !plan.starts.some((s) => s.klasse === klasse)) return plaene
  const starts = plan.starts.filter((s) => s.klasse !== klasse)
  const { [runde]: _alt, ...rest } = plaene
  return starts.length === 0 ? rest : { ...rest, [runde]: { runde, starts } }
}

/**
 * Gelesene Pläne (localStorage, Sicherung) auf ihre Form prüfen; Unbrauchbares entfällt. Das
 * frühere Feld `finale` (Kleines Finale im Plan der Finals, bis 21.11.2026) wird nicht übernommen:
 * state/migrate.ts `teileAlteFinals` teilt solche Pläne VORHER in zwei Runden auf.
 */
export function normalisierePlaene(roh: unknown): ParallelPlaene {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {}
  const plaene: ParallelPlaene = {}
  const id = (wert: unknown): wert is string | null => wert === null || (typeof wert === 'string' && wert !== '')
  for (const [runde, plan] of Object.entries(roh as Record<string, unknown>)) {
    const starts = (plan as { starts?: unknown } | null)?.starts
    if (!istRunde(runde) || !Array.isArray(starts)) continue
    const gut = starts.every((s: Partial<ParallelStartFest> | null) => {
      if (!s || !id(s.a) || !id(s.b)) return false
      return (s.attempt === 1 || s.attempt === 2) && Number.isInteger(s.block) && s.block! >= 0 && (s.boot === 'klein' || s.boot === 'gross')
    })
    // Ein Plan gilt ganz oder gar nicht: Ein halber verschöbe die Zuordnung von Start und Starter.
    if (!gut) continue
    plaene[runde] = {
      runde,
      starts: (starts as ParallelStartFest[]).map((s) => ({
        a: s.a,
        b: s.b,
        attempt: s.attempt,
        block: s.block,
        boot: s.boot,
        ...((CLASS_IDS as readonly unknown[]).includes(s.klasse) ? { klasse: s.klasse } : {}),
      })),
    }
  }
  return plaene
}
