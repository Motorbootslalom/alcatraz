import type { ParallelPlanFest, ParallelRunde } from '../types'

// Wie die Werte des Parallelslaloms im Stand heißen – rein, ohne DOM und ohne Stand.
//
// Jede Runde ist eine eigene Wertungseinheit mit eigener Disziplin-Kennung: `parallel:pre`,
// `parallel:semi`, `parallel:small` (Kleines Finale, seit 21.11.2026 eigene Runde), `parallel:final`,
// `parallel:rerun-<runde>-<n>`. Der Lauf ist der Attempt
// (1 oder 2), der Lauf-Schlüssel also `parallel:pre/1`. So bleiben `laufSchluessel` und
// `zerlegeLauf` (lib/eingaben.ts), die Zeile je Starter-ID und die Wertung nach Läufen in
// ihrer Form.
//
// Der Racecourse A/B steht NICHT im Schlüssel: Er folgt aus dem festgeschriebenen Plan –
// Starter und Attempt ergeben den Racecourse (planung/parallelRunden.ts `plaetzeVon`). Der
// frühere Start eines Starters im Plan ist sein 1. Attempt (Regel 960, Pkt. 4.4: „Each driver
// shall have two attempts - the drivers shall change boats and courses for the second attempt“).

/**
 * Die Runden des Parallelslaloms in ihrer Folge (Regel 960, Pkt. 5.2.2: „Parallel slalom
 * preliminary heat / semi-finals / finals“). Seit 21.11.2026 sind Kleines Finale (`small`) und
 * Finale (`final`) getrennte Runden – „4 in sich geschlossene Listen/Auswertungen“ (Auftrag des
 * Nutzers); das Kleine Finale wird zuerst gefahren (Entscheidung vom 15.11.2026). Hier, weil dieses
 * Modul nur von Typen abhängt (kein Importkreis); planung/parallelRunden.ts reicht es weiter.
 */
export const PARALLEL_RUNDEN = ['pre', 'semi', 'small', 'final'] as const satisfies readonly ParallelRunde[]

/** Ist der Text die Kennung einer Runde? Auch für die Punkte des Betriebs (betrieb/folge.ts `istPunktId`). */
export const istRunde = (wert: string): wert is ParallelRunde => (PARALLEL_RUNDEN as readonly string[]).includes(wert) || /^rerun-.+/.test(wert)

/** Die beiden Racecourses (Regel 960, Pkt. 4.4: „each running on a separate racecourse“). */
export const RACECOURSES = ['A', 'B'] as const
export type Racecourse = (typeof RACECOURSES)[number]

/**
 * Unter dieser Kennung stehen die race officials eines Racecourse in der WKR-Einteilung
 * (lib/einteilung.ts) – dort, wo sonst die Kennung eines Parcours der Verzahnung steht.
 * Annahme (Organisation, nicht Regel 960): Je Racecourse sitzen eigene race officials an Zeit,
 * Steg (pontoon) und Fahrweg. Die Kennungen der Parcours beginnen mit „par“ (`uid('par')`),
 * verwechseln lassen sie sich nicht.
 */
export const RACECOURSE_PARCOURS: Readonly<Record<Racecourse, string>> = { A: 'racecourse-a', B: 'racecourse-b' }

/** Ist das die Kennung eines Racecourse in der Einteilung? */
export function istRacecourseParcours(id: string): boolean {
  return RACECOURSES.some((rc) => RACECOURSE_PARCOURS[rc] === id)
}

/** Die Kennung der Disziplin in Regelwerk und Aufbau ist `parallel` (config/catalog.ts `PARALLEL`). */
const VORSATZ = 'parallel:'

/** Die Disziplin, unter der die Werte einer Runde stehen: `parallel:pre`. */
export function rundenDisziplin(runde: ParallelRunde): string {
  return `${VORSATZ}${runde}`
}

/** Die Runde einer Disziplin-Kennung; `undefined`, wenn es keine Runde des Parallelslaloms ist. */
export function rundeVon(disziplin: string): ParallelRunde | undefined {
  if (!disziplin.startsWith(VORSATZ)) return undefined
  const runde = disziplin.slice(VORSATZ.length)
  return istRunde(runde) ? runde : undefined
}

/** Der Lauf-Schlüssel eines Attempts in einer Runde: `parallel:pre/1`. */
export function attemptSchluessel(runde: ParallelRunde, attempt: number): string {
  // Gebaut wie `laufSchluessel` (lib/eingaben.ts) – hier ausgeschrieben, weil lib/eingaben.ts
  // dieses Modul liest (kein Kreis); der Test hält beide gleich.
  return `${rundenDisziplin(runde)}/${attempt}`
}

/** Runde und Attempt eines Lauf-Schlüssels; `undefined` für alles, was kein Attempt einer Runde ist. */
export function zerlegeAttempt(schluessel: string): { runde: ParallelRunde; attempt: number } | undefined {
  const i = schluessel.lastIndexOf('/')
  const lauf = Number(schluessel.slice(i + 1))
  const runde = i < 0 ? undefined : rundeVon(schluessel.slice(0, i))
  return runde === undefined || !Number.isInteger(lauf) ? undefined : { runde, attempt: lauf }
}

/** Gibt es erfasste Werte zu dieser Runde? */
export function rundeHatEingaben(eingaben: Readonly<Record<string, unknown>>, runde: ParallelRunde): boolean {
  return Object.keys(eingaben).some((schluessel) => zerlegeAttempt(schluessel)?.runde === runde)
}

/**
 * Die Attempts je Starter, die der Plan einer Runde vorsieht: Nur zu ihnen gibt es eine Zeile
 * auf einer Liste. Ein Attempt, der im Plan nicht steht (Starter nicht im Plan), hat keine.
 */
export function attemptsImPlan(plan: ParallelPlanFest): Map<string, Set<number>> {
  const je = new Map<string, Set<number>>()
  for (const s of plan.starts) {
    for (const id of [s.a, s.b]) {
      if (id === null) continue
      let menge = je.get(id)
      if (!menge) je.set(id, (menge = new Set()))
      menge.add(s.attempt)
    }
  }
  return je
}
