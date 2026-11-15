import type { AppState, ClassId, ParallelRunde, Starter } from '../types'
import { startEntfaellt } from '../planung/parallel'
import { loeseAuf } from '../planung/parallelRunden'

// Die Startliste einer Runde des Parallelslaloms als druckbares Dokument – rein, ohne DOM
// (components/ParallelStartlisten.vue zeichnet sie). Sie steht in der Druckdatei vor den
// Wertungslisten ihrer Runde (Entscheidung des Nutzers vom 15.11.2026): wer in welchem Start auf
// Racecourse A und B gefahren ist, in den Blöcken des FESTGESCHRIEBENEN Plans
// (planung/parallelRunden.ts) – so, wie er auch auf den Listen der race officials steht.
//
// Regel 960 schreibt die Liste nicht vor; sie verlangt, was sie zeigt (Pkt. 4.4: „Two drivers
// from the same class shall start at the same time, each running on a separate racecourse.
// Each driver shall have two attempts - the drivers shall change boats and courses for the
// second attempt.“).

/** Wer in einem Start auf einem Racecourse fährt: ein Starter, der Dummy (`null`). */
export type StartlistenPlatz = Starter | null

export interface StartlistenZeile {
  /** Position des Starts im Plan, ab 1. */
  start: number
  attempt: 1 | 2
  /** Die Klasse des Paares (die des Starters auf A, sonst B); fehlt, wenn der Start entfällt. */
  klasse?: ClassId
  /** Nur in den Finals: um welche Plätze es geht (1 = Finale, 3 = kleines Finale). */
  finale?: 1 | 3
  a: StartlistenPlatz
  b: StartlistenPlatz
  /** Beide Starter des Starts gibt es nicht mehr: Die Zeile bleibt, damit die Positionen stimmen. */
  entfaellt: boolean
}

export interface RundenStartliste {
  runde: ParallelRunde
  /** Die Starts in den Blöcken der Startreihenfolge – ein Block bleibt auf einer Seite. */
  bloecke: StartlistenZeile[][]
}

/** Die Startliste einer Runde; `undefined` ohne festgeschriebenen Plan. */
export function rundenStartliste(stand: Pick<AppState, 'starters' | 'parallelPlaene'>, runde: ParallelRunde): RundenStartliste | undefined {
  const fest = stand.parallelPlaene[runde]
  if (!fest) return undefined
  const bloecke: StartlistenZeile[][] = []
  let block: number | undefined
  loeseAuf(fest, stand.starters).plan.heats.forEach((h, i) => {
    const a = h.a.kind === 'dummy' ? null : h.a.p
    const b = h.b.kind === 'dummy' ? null : h.b.p
    const entfaellt = startEntfaellt(h)
    if (block !== h.block) bloecke.push([])
    block = h.block
    bloecke[bloecke.length - 1].push({
      start: h.pos,
      attempt: h.run,
      ...(entfaellt ? {} : { klasse: fest.starts[i]?.klasse ?? a?.klasse ?? b?.klasse }),
      ...(fest.starts[i]?.finale ? { finale: fest.starts[i].finale } : {}),
      a,
      b,
      entfaellt,
    })
  })
  return { runde, bloecke }
}
