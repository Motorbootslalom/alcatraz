import type { BoatType, ClassId, Starter } from '../types'
import { boatTypeOf, CLASS_IDS } from '../domain/classes'
import { vergleicheStartNr } from '../domain/startnumbers'

/**
 * Klassen ohne Parallelslalom: Ihn gibt es nur nach Regel 960, und die kennt Klassen bis 5
 * (Pkt. 1: „Class Dolphin ages 6 – 7 years … Class 5 ages 16 - 18 years“). Einen nationalen
 * Parallelslalom bis Klasse 7 gibt es nicht mehr.
 */
export const PARALLEL_EXCLUDED: ClassId[] = ['6', '7']

/**
 * Ein Startplatz: entweder ein Starter oder ein Dummy (eine Person außerhalb der Wertung, die
 * im gleichen Bootstyp mitfährt, um bei ungerader Anzahl das Paar zu vervollständigen). Den
 * Dummy kennt Regel 960 nicht – er ist Organisation.
 */
export type ParallelSlot =
  | { kind: 'starter'; p: Starter }
  | { kind: 'dummy'; boat: BoatType }

/** Ein Paar, das zweimal (mit Tausch der Racecourses) gegeneinander fährt. */
export interface ParallelPair {
  boat: BoatType
  a: ParallelSlot
  b: ParallelSlot
}

/** Ein einzelner Lauf (beide Parcours gleichzeitig belegt). */
export interface ParallelHeat {
  /** globale Startposition, 1-basiert */
  pos: number
  /** 0-basierter Block-Index (ein voller Block = 4 Starter = 2 Paare) */
  block: number
  /** true beim ersten Heat eines Blocks – dort wird die Trennlinie gezogen */
  blockStart: boolean
  /** 1. oder 2. Lauf des Paares (im 2. Lauf sind die Parcours getauscht) */
  run: 1 | 2
  boat: BoatType
  /** Starter auf Parcours A */
  a: ParallelSlot
  /** Starter auf Parcours B */
  b: ParallelSlot
}

export interface ParallelPlan {
  heats: ParallelHeat[]
  /** reale Starter je Bootstyp (ohne Dummy) */
  kleinStarter: number
  grossStarter: number
  /**
   * Zahl der Dummys je Bootstyp. Eine Anzahl und kein Ja/Nein: Bei strenger Klassentrennung
   * (Regel 960, Pkt. 4.4) gibt es je ungerader Klasse einen.
   */
  kleinDummy: number
  grossDummy: number
  /** Anzahl Paare gesamt (inkl. der mit Dummy) */
  pairs: number
  /** Anzahl Blöcke (voll = 2 Paare, letzter evtl. mit nur 1 Paar) */
  blocks: number
}

export interface ParallelOptions {
  /** Klasse 4 fährt ausnahmsweise mit kleinem Boot (beeinflusst den Bootstyp-Pool). */
  class4Small: boolean
  /**
   * Reihenfolge der Klassen nach **Startnummer** statt in ihrer festen Folge: Die Klassen
   * eines Bootstyps stehen dann nach ihrer kleinsten Startnummer. Sinnvoll bei klassischen
   * Nummern, wenn das Manövrieren z. B. mit Klasse 3 beginnt. Standard: false.
   */
  orderByStartNr?: boolean
  /**
   * Strenge Klassentrennung (Standard: true): Paare nur innerhalb einer Klasse, ein Dummy je
   * ungerader Klasse. false: Der Übrige fährt gegen den ersten der nächsten Klasse im gleichen
   * Boot; einen Dummy gibt es dann nur bei ungeradem Bootstyp-Pool.
   */
  streng?: boolean
}

/** Klassen des Parallelslaloms: Dolphin (E) bis Klasse 5 (Regel 960, Pkt. 1). */
export function parallelActiveClasses(): ClassId[] {
  const excluded = new Set(PARALLEL_EXCLUDED)
  return CLASS_IDS.filter((c) => !excluded.has(c))
}

/**
 * Vergleich nach Startnummer, numerisch (E01, 301 – oder klassisch 9 vor 10). Wer keine Nummer
 * hat, steht hinten.
 */
export function cmpStartNr(a: Starter, b: Starter): number {
  const na = a.startNr.trim()
  const nb = b.startNr.trim()
  if (!na || !nb) return na ? -1 : nb ? 1 : 0
  return vergleicheStartNr(na, nb)
}

/**
 * Die Starter eines Bootstyps, nach Klassen gruppiert und in Startreihenfolge: innerhalb der
 * Klasse nach Startnummer, die Klassen in ihrer festen Folge – oder (`byStartNr`) nach ihrer
 * kleinsten Startnummer. Die Klassen bleiben in beiden Fällen zusammen.
 */
function klassenGruppen(list: Starter[], byStartNr: boolean): Starter[][] {
  const gruppen = CLASS_IDS.map((k) => list.filter((p) => p.klasse === k).sort(cmpStartNr)).filter((g) => g.length > 0)
  // Array.sort ist stabil: Klassen ohne Nummern oder mit gleicher kleinster Nummer behalten ihre feste Folge.
  return byStartNr ? gruppen.sort((a, b) => cmpStartNr(a[0], b[0])) : gruppen
}

/** Je zwei aufeinanderfolgende Starter bilden ein Paar; ein Einzelner am Ende fährt gegen einen Dummy. */
function paare(list: Starter[], boat: BoatType): ParallelPair[] {
  const pairs: ParallelPair[] = []
  for (let i = 0; i < list.length; i += 2) {
    const b = list[i + 1]
    pairs.push({ boat, a: { kind: 'starter', p: list[i] }, b: b ? { kind: 'starter', p: b } : { kind: 'dummy', boat } })
  }
  return pairs
}

/**
 * Die Paare eines Bootstyps.
 *
 * Regel 960, Pkt. 4.4: „Two drivers from the same class shall start at the same time, each
 * running on a separate racecourse.“ Streng gepaart wird deshalb nur innerhalb einer Klasse.
 * Die ungerade Klasse regelt Pkt. 4.4 nicht – der Dummy ist Organisation, nicht Regel 960:
 * - streng: Der Letzte einer ungeraden Klasse fährt gegen einen Dummy.
 * - nicht streng: Er fährt gegen den ersten der nächsten Klasse im gleichen Boot; ein Dummy
 *   bleibt nur, wenn der ganze Bootstyp eine ungerade Zahl von Startern hat.
 */
function toPairs(gruppen: Starter[][], boat: BoatType, streng: boolean): ParallelPair[] {
  return streng ? gruppen.flatMap((g) => paare(g, boat)) : paare(gruppen.flat(), boat)
}

/** Ein Start der Reihenfolge, noch ohne Position: Paar, Attempt und Block. */
export interface ParallelStart {
  boat: BoatType
  a: ParallelSlot
  b: ParallelSlot
  run: 1 | 2
  block: number
}

/**
 * Ein Start ohne Starter: Das gibt es nur im festgeschriebenen Plan, wenn beide Starter eines
 * Paares entfernt wurden (planung/parallelRunden.ts `loeseAuf`). Der Start entfällt, behält aber
 * seine Position – die übrigen Starts verschieben sich nicht.
 */
export function startEntfaellt(start: Pick<ParallelStart, 'a' | 'b'>): boolean {
  return start.a.kind === 'dummy' && start.b.kind === 'dummy'
}

/**
 * Aus den Starts in ihrer Reihenfolge wird der Plan: Position, Trennlinie am Blockanfang und
 * die Zahlen je Bootstyp. So zählt ein frisch gerechneter Plan genau wie ein festgeschriebener
 * (planung/parallelRunden.ts), der aus dem Zustand zurückgelesen wird.
 */
export function planAusStarts(starts: readonly ParallelStart[]): ParallelPlan {
  const heats: ParallelHeat[] = starts.map((s, i) => ({ ...s, pos: i + 1, blockStart: i === 0 || starts[i - 1].block !== s.block }))
  const starter = (boat: BoatType) =>
    new Set(heats.filter((h) => h.boat === boat).flatMap((h) => [h.a, h.b].flatMap((slot) => (slot.kind === 'starter' ? slot.p.id : [])))).size
  // Jedes Paar hat genau einen 1. Attempt; ein Dummy steht dort auf A oder B. Ein Start ohne
  // Starter (fester Plan, beide entfernt) entfällt und braucht keinen Dummy.
  const erste = heats.filter((h) => h.run === 1)
  const dummy = (boat: BoatType) => erste.filter((h) => h.boat === boat && !startEntfaellt(h) && (h.a.kind === 'dummy' || h.b.kind === 'dummy')).length
  return {
    heats,
    kleinStarter: starter('klein'),
    grossStarter: starter('gross'),
    kleinDummy: dummy('klein'),
    grossDummy: dummy('gross'),
    pairs: erste.length,
    blocks: new Set(heats.map((h) => h.block)).size,
  }
}

/**
 * Baut den Startplan des Vorlaufs.
 *
 * - Zwei Racecourses (A und B); je Start fahren zwei Starter derselben Klasse gegeneinander
 *   (Regel 960, Pkt. 4.4), siehe {@link toPairs} zur ungeraden Klasse und zur Option „nicht streng“.
 * - Jedes Paar fährt zweimal, im 2. Attempt mit getauschten Racecourses (Pkt. 4.4: „Each driver
 *   shall have two attempts - the drivers shall change boats and courses for the second
 *   attempt“). Der frühere Start ist der 1. Attempt.
 * - Bootstypen und Blöcke sind Organisation, nicht Regel 960: Die Paare eines Bootstyps
 *   (klein: Dolphin bis 3; groß: 4 und 5; Klasse 4 auf Wunsch klein) stehen in Startreihenfolge.
 *   **Die Bootstypen wechseln sich ab**: Ein voller Block sind ein kleines und ein großes Paar
 *   (4 Starter) – klein 1. Attempt, groß 1. Attempt, klein 2. Attempt, groß 2. Attempt. So hat
 *   jeder Starter zwischen seinen beiden Attempts eine Pause zum Bootstausch.
 * - Ist ein Bootstyp aufgebraucht, laufen die übrigen Paare als **2er-Blöcke** (1. Attempt,
 *   2. Attempt) – zwei gleichartige Paare werden nicht miteinander verzahnt.
 */
export function buildParallelPlan(starters: Starter[], opts: ParallelOptions): ParallelPlan {
  const active = new Set(parallelActiveClasses())
  const inField = starters.filter((p) => active.has(p.klasse))
  const byStartNr = opts.orderByStartNr ?? false
  const streng = opts.streng ?? true
  const pool = (boat: BoatType) =>
    toPairs(klassenGruppen(inField.filter((p) => boatTypeOf(p.klasse, opts.class4Small) === boat), byStartNr), boat, streng)
  const klein = pool('klein')
  const gross = pool('gross')

  const starts: ParallelStart[] = []
  let block = 0
  const emit = (pair: ParallelPair, run: 1 | 2) =>
    starts.push({ boat: pair.boat, a: run === 1 ? pair.a : pair.b, b: run === 1 ? pair.b : pair.a, run, block })

  // Solange beide Bootstypen ein Paar liefern: 4er-Block mit Bootstyp-Wechsel.
  const mixed = Math.min(klein.length, gross.length)
  for (let i = 0; i < mixed; i++) {
    emit(klein[i], 1)
    emit(gross[i], 1)
    emit(klein[i], 2)
    emit(gross[i], 2)
    block++
  }
  // Überzählige Paare des längeren Bootstyps (nur einer kann übrig sein): je Paar ein 2er-Block.
  for (const pair of klein.slice(mixed).concat(gross.slice(mixed))) {
    emit(pair, 1)
    emit(pair, 2)
    block++
  }
  return planAusStarts(starts)
}

/** Kurzbeschreibung eines Startplatzes (Startnummer bzw. „Dummy") für Text-Export. */
export function slotShort(slot: ParallelSlot): string {
  return slot.kind === 'dummy' ? 'Dummy' : slot.p.startNr
}

/** Menschlich lesbarer Text-Export des Startplans (zum Kopieren/Teilen). */
export function formatParallelExport(
  plan: ParallelPlan,
  eventName: string,
  eventJahr: number,
  running?: Map<string, number> | null,
): string {
  const dummyNote = (label: string, n: number) => (n > 0 ? ` (inkl. ${n} Dummy ${label})` : '')
  // Startplatz inkl. optionaler klassischer Nummer, z. B. "3:E01".
  const slotText = (slot: ParallelSlot) => {
    const base = slotShort(slot)
    if (!running || slot.kind !== 'starter') return base
    const n = running.get(slot.p.id)
    return n === undefined ? base : `${n}:${base}`
  }
  const lines: string[] = [
    `# Parallel-Slalom · ${eventName} · ${eventJahr}`,
    `Kleine Boote: ${plan.kleinStarter} Starter${dummyNote('klein', plan.kleinDummy)} · ` +
      `Große Boote: ${plan.grossStarter} Starter${dummyNote('groß', plan.grossDummy)}`,
    `${plan.heats.length} Starts · ${plan.pairs} Paare · ${plan.blocks} Blöcke`,
  ]
  if (running) lines.push('Klassische Startnummer als „Nr:S-Nr" (z. B. 3:E01).')
  lines.push('', '#  | Boot  | Parcours A → B')
  for (const h of plan.heats) {
    if (h.blockStart && h.pos > 1) lines.push('   ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈')
    const kl = h.boat === 'klein' ? 'klein' : 'groß '
    lines.push(
      `${String(h.pos).padStart(2, ' ')} | ${kl} | ` +
        (startEntfaellt(h) ? 'entfällt' : `${slotText(h.a)}  ↔  ${slotText(h.b)}` + (h.run === 2 ? '  (Tausch)' : '')),
    )
  }
  return lines.join('\n') + '\n'
}
