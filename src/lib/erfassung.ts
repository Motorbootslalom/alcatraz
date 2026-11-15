import type { Eingaben } from '../types'
import { erfasstKennung, laufSchluessel, listenFelder, listenLauf, werteVon, type EingabenKonfig, type Feld } from './eingaben'
import { bojenWert, codeDisqs, disqCodes } from './scoring'
import { parseTime } from './time'
import { NICHT_GESTARTET } from './abmeldung'
import { auftragZeilen, type BogenZeile } from './bogen'

// Was die Erfassungsansicht über einen Bogen wissen muss – rein, ohne DOM: Welche Zeilen
// sind abgetippt, und was daran ist unvollständig oder unplausibel? Die Regeln sind bewusst
// zurückhaltend: Sie weisen hin, sie sperren nichts. Entscheiden muss, wer das Papier vor
// sich hat.

/** Ein Bogen, so weit die Erfassung ihn braucht (lib/wkrListen.ts `WkrBogen` passt). */
export interface ErfassungsBogen {
  typeId: string
  lauf: number
  /** Je Zeile: Starter und Klasse; auf Listen einer Runde des Parallelslaloms auch ihr Attempt. */
  zeilen: ReadonlyArray<{ id?: string; klasse?: string; attempt?: number }>
  /** Die Disziplin der Werte, wenn es nicht die des Aufbaus ist (Parallelslalom: `parallel:pre`). */
  disziplin?: string
  /** „Versuche direkt nacheinander“: Jeder Starter steht je Versuch einmal auf dem Bogen (lib/bogen.ts). */
  versuche?: number
  /** Mit `versuche`: Der Starter steht doch nur einmal da (Vorsteg), seine Zeile gilt für jeden Versuch. */
  einmal?: boolean
  runde?: unknown
}

export interface Fortschritt {
  erfasst: number
  gesamt: number
}

/**
 * Was an einer Zeile auffällt:
 * - `zeitFehlt`: Zeitliste – keine Zeit, obwohl der Lauf auf anderen Listen schon Werte hat
 *   und der Starter nicht disqualifiziert ist.
 * - `zeitEinzeln`: nur eine von mehreren Stoppuhren eingetragen.
 * - `zeitSpanne`: Die Stoppuhren des Laufs liegen mehr als eine Sekunde auseinander.
 * - `zeitBereich`: Zeit unter 20 Sekunden oder über 10 Minuten (Tippfehler?).
 * - `bojePunkte`: Bojen-Punkte, die kein Vielfaches von 5 sind, oder mehr als 30.
 * - `versucheAbweichend`: Die Zeile gilt für jeden Versuch (Vorsteg mit „Versuche direkt
 *   nacheinander“), aber ein späterer Versuch trägt auf dieser Liste etwas anderes als der
 *   erste ({@link versucheAbweichend}).
 */
export type HinweisArt = 'zeitFehlt' | 'zeitEinzeln' | 'zeitSpanne' | 'zeitBereich' | 'bojePunkte' | 'versucheAbweichend'

export interface Hinweis {
  art: HinweisArt
  /** Die betroffene Zelle des Bogens („zeit1“, „t1a#0“); fehlt = die ganze Zeile. */
  zelle?: string
}

/** Mehr als so viele Hundertstel zwischen zwei Stoppuhren gelten als auffällig. */
export const ZEIT_SPANNE_MAX = 100
/** Glaubhafte Laufzeiten in Hundertstel. */
export const ZEIT_MIN = 2000
export const ZEIT_MAX = 60000

type Werte = Readonly<Record<string, string>>

/**
 * Ist die Zeile auf dieser Liste abgetippt? Ja, sobald eines ihrer Felder einen Wert hat –
 * oder der Haken gesetzt ist: Eine fehlerfreie Fahrt lässt die Zeile einer Tor-Liste leer.
 */
export function zeileErfasst(felder: readonly Feld[], werte: Werte, typeId: string): boolean {
  return !!werte[erfasstKennung(typeId)] || felder.some((f) => !!werte[f.kennung])
}

/** Hat die Zeile auf dieser Liste eigene Werte (ohne den Haken)? */
export function zeileHatWerte(felder: readonly Feld[], werte: Werte): boolean {
  return felder.some((f) => !!werte[f.kennung])
}

/**
 * Der Lauf-Schlüssel, unter dem die Werte einer Zeile eines Bogens stehen. Sonst gilt er für den
 * ganzen Bogen (Disziplin des Aufbaus, Lauf des Bogens); auf einer Liste einer Runde des
 * Parallelslaloms hat jede Zeile ihren Attempt (lib/parallelSchluessel.ts) – ebenso auf einem
 * Bogen mit „Versuche direkt nacheinander“ (lib/bogen.ts `BogenAuftrag.versuche`).
 */
export function zeilenSchluessel(konfig: Pick<EingabenKonfig, 'getAufbau' | 'getSheetDef'>, aufbau: string, bogen: Pick<ErfassungsBogen, 'typeId' | 'lauf' | 'disziplin'>, attempt?: number): string {
  if (bogen.disziplin !== undefined) return laufSchluessel(bogen.disziplin, attempt ?? bogen.lauf)
  // „Versuche direkt nacheinander“: Auch auf einem Bogen des Manövrierens hat dann jede Zeile ihren Versuch.
  return laufSchluessel(konfig.getAufbau(aufbau).disziplin, listenLauf(konfig.getSheetDef(bogen.typeId), attempt ?? bogen.lauf))
}

/**
 * Alle Lauf-Schlüssel, unter die eine Eingabe in einer Zeile des Bogens geschrieben wird. Sonst
 * nur {@link zeilenSchluessel}. Auf einem Bogen, auf dem der Starter trotz „Versuche direkt
 * nacheinander“ nur einmal steht (Vorsteg, lib/bogen.ts `BogenAuftrag.einmal`), gilt seine Zeile
 * für jeden Versuch: Sie schreibt unter Versuch 1 bis `versuche` – gelesen wird unter dem ersten.
 * So zählt ein X „Nicht gestartet“ vom Vorsteg in jedem Versuch, und die Wertung bleibt, wie sie
 * ist.
 */
export function zeilenSchluesselAlle(
  konfig: Pick<EingabenKonfig, 'getAufbau' | 'getSheetDef'>,
  aufbau: string,
  bogen: Pick<ErfassungsBogen, 'typeId' | 'lauf' | 'disziplin' | 'versuche' | 'einmal'>,
  attempt?: number,
): string[] {
  const n = Math.floor(bogen.versuche ?? 1)
  if (!bogen.einmal || n <= 1 || bogen.disziplin !== undefined || attempt !== undefined) return [zeilenSchluessel(konfig, aufbau, bogen, attempt)]
  return Array.from({ length: n }, (_, i) => zeilenSchluessel(konfig, aufbau, bogen, i + 1))
}

/**
 * Wie viele Zeilen eines Bogens erfasst sind. Zeilen ohne Starter-ID oder Klasse zählen nicht –
 * also auch nicht die Zeile eines Dummys oder eines entfallenen Starts im Parallelslalom.
 */
export function bogenFortschritt(konfig: EingabenKonfig, eingaben: Eingaben, aufbau: string, bogen: ErfassungsBogen): Fortschritt {
  // Mit „Versuche direkt nacheinander“ zählt jede Zeile des Papiers: je Starter und Versuch eine – außer auf Listen ohne Lauf und am Vorsteg (`einmal`).
  const jeVersuch =
    konfig.getSheetDef(bogen.typeId).showLauf === false
      ? bogen.zeilen
      : auftragZeilen({ zeilen: bogen.zeilen as readonly BogenZeile[], versuche: bogen.versuche, einmal: bogen.einmal, runde: bogen.runde === undefined ? undefined : { runde: '', racecourse: '' } })
  const zeilen = jeVersuch.filter((z) => z.id && z.klasse && konfig.positionAllowsClass(bogen.typeId, z.klasse))
  const erfasst = zeilen.filter((z) =>
    zeileErfasst(listenFelder(konfig, bogen.typeId, z.klasse!), werteVon(eingaben, zeilenSchluessel(konfig, aufbau, bogen, z.attempt), z.id!), bogen.typeId),
  ).length
  return { erfasst, gesamt: zeilen.length }
}

/**
 * Eine Zeile, die für jeden Versuch gilt ({@link zeilenSchluesselAlle}): Trägt ein späterer
 * Versuch auf dieser Liste etwas anderes als der erste? Das kommt nur vor, wenn dort etwas
 * stand, bevor „Versuche direkt nacheinander“ eingeschaltet wurde. Die Zeile zeigt den ersten,
 * die Wertung zählt aber jeden – deshalb ein Hinweis. Die nächste Eingabe in der Zeile gleicht
 * alle Versuche an (components/erfassung/ErfassungTabelle.vue).
 */
export function versucheAbweichend(felder: readonly Feld[], werte: Werte, weitere: readonly Werte[], typeId: string): boolean {
  const kennungen = [...felder.map((f) => f.kennung), erfasstKennung(typeId)]
  return weitere.some((w) => kennungen.some((k) => (w[k] ?? '') !== (werte[k] ?? '')))
}

/** Die Disq-Buchstaben eines Laufs, gleich in welcher Zelle sie stehen. */
function disqsImLauf(werte: Werte, alleFelder: ReadonlyMap<string, Feld>): string[] {
  return Object.entries(werte).flatMap(([kennung, wert]) => {
    const feld = alleFelder.get(kennung)
    if (!feld) return []
    if (feld.kind === 'buoy') return bojenWert(wert).disq ?? []
    if (feld.kind === 'code') return codeDisqs(wert)
    return feld.kind === 'disq' ? disqCodes(wert) : []
  })
}

/** Steht im Lauf irgendwo ein Disq-Buchstabe (auch X „Nicht gestartet“)? */
function hatDisq(werte: Werte, alleFelder: ReadonlyMap<string, Feld>): boolean {
  return disqsImLauf(werte, alleFelder).length > 0
}

/**
 * Steht im Lauf das X „Nicht gestartet“ – von Hand eingetragen oder über das Abmelden
 * (lib/abmeldung.ts)? Dann sind die Zeilen des Starters in allen Listen dieses Laufs schraffiert:
 * Beim Abtippen fällt auf, dass hier jemand nicht gefahren ist. Dieselbe Frage stellt die
 * Wertung (lib/ergebnis.ts `nichtGestartet`).
 */
export function nichtGestartet(werte: Werte, alleFelder: ReadonlyMap<string, Feld>): boolean {
  return disqsImLauf(werte, alleFelder).includes(NICHT_GESTARTET)
}

/**
 * Die Hinweise zu einer Zeile eines Bogens. `felder` sind die Felder der Liste für die Klasse
 * der Zeile, `alleFelder` alle Felder der Klasse (lib/eingaben.ts `felderJeKennung`) – die
 * Stoppuhren eines Laufs können auf verschiedenen Listen stehen.
 */
export function zeilenHinweise(felder: readonly Feld[], werte: Werte, alleFelder: ReadonlyMap<string, Feld>, typeId: string): Hinweis[] {
  const hinweise: Hinweis[] = []
  for (const feld of felder) {
    const wert = werte[feld.kennung]
    if (!wert) continue
    if (feld.kind === 'buoy') {
      const { punkte, disq } = bojenWert(wert)
      if (!disq && (punkte % 5 !== 0 || punkte > 30 || punkte === 0)) hinweise.push({ art: 'bojePunkte', zelle: feld.zelle })
    } else if (feld.kind === 'time') {
      const zeit = parseTime(wert)
      if (!zeit || zeit.centis < ZEIT_MIN || zeit.centis > ZEIT_MAX) hinweise.push({ art: 'zeitBereich', zelle: feld.zelle })
    }
  }

  const zeitFelder = felder.filter((f) => f.kind === 'time')
  if (zeitFelder.length === 0) return hinweise

  const stoppuhrenHier = zeitFelder.filter((f) => f.geraet !== 'elektronisch')
  const hier = zeitFelder.filter((f) => parseTime(werte[f.kennung] ?? ''))
  const zeitenImLauf = Object.entries(werte).flatMap(([kennung, wert]) => {
    const feld = alleFelder.get(kennung)
    const zeit = feld?.kind === 'time' ? parseTime(wert) : null
    return zeit ? [{ centis: zeit.centis, elektronisch: feld?.geraet === 'elektronisch' }] : []
  })
  const stoppuhren = zeitenImLauf.filter((z) => !z.elektronisch).map((z) => z.centis)
  if (stoppuhren.length > 1 && Math.max(...stoppuhren) - Math.min(...stoppuhren) > ZEIT_SPANNE_MAX) hinweise.push({ art: 'zeitSpanne' })
  if (hier.length === 1 && stoppuhrenHier.length > 1 && hier[0].geraet !== 'elektronisch' && !zeitenImLauf.some((z) => z.elektronisch)) {
    hinweise.push({ art: 'zeitEinzeln' })
  }
  if (zeitenImLauf.length === 0 && !hatDisq(werte, alleFelder)) {
    const eigene = new Set([...felder.map((f) => f.kennung), erfasstKennung(typeId)])
    // Der Haken einer anderen Liste genügt: Dort ist die Fahrt schon abgetippt.
    if (Object.keys(werte).some((kennung) => !eigene.has(kennung) && (alleFelder.has(kennung) || kennung.startsWith('erfasst@')))) {
      hinweise.push({ art: 'zeitFehlt' })
    }
  }
  return hinweise
}
