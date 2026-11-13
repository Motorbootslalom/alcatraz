import type { Eingaben } from '../types'
import { erfasstKennung, laufSchluessel, listenFelder, listenLauf, werteVon, type EingabenKonfig, type Feld } from './eingaben'
import { bojenWert, codeDisqs, disqCodes } from './scoring'
import { parseTime } from './time'

// Was die Erfassungsansicht über einen Bogen wissen muss – rein, ohne DOM: Welche Zeilen
// sind abgetippt, und was daran ist unvollständig oder unplausibel? Die Regeln sind bewusst
// zurückhaltend: Sie weisen hin, sie sperren nichts. Entscheiden muss, wer das Papier vor
// sich hat.

/** Ein Bogen, so weit die Erfassung ihn braucht (lib/wkrListen.ts `WkrBogen` passt). */
export interface ErfassungsBogen {
  typeId: string
  lauf: number
  zeilen: ReadonlyArray<{ id?: string; klasse?: string }>
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
 */
export type HinweisArt = 'zeitFehlt' | 'zeitEinzeln' | 'zeitSpanne' | 'zeitBereich' | 'bojePunkte'

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

/** Wie viele Zeilen eines Bogens erfasst sind. Zeilen ohne Starter-ID oder Klasse zählen nicht. */
export function bogenFortschritt(konfig: EingabenKonfig, eingaben: Eingaben, aufbau: string, bogen: ErfassungsBogen): Fortschritt {
  const schluessel = laufSchluessel(konfig.getAufbau(aufbau).disziplin, listenLauf(konfig.getSheetDef(bogen.typeId), bogen.lauf))
  const zeilen = bogen.zeilen.filter((z) => z.id && z.klasse && konfig.positionAllowsClass(bogen.typeId, z.klasse))
  const erfasst = zeilen.filter((z) => zeileErfasst(listenFelder(konfig, bogen.typeId, z.klasse!), werteVon(eingaben, schluessel, z.id!), bogen.typeId)).length
  return { erfasst, gesamt: zeilen.length }
}

/** Steht im Lauf irgendwo ein Disq-Buchstabe (auch X „Nicht gestartet“)? */
function hatDisq(werte: Werte, alleFelder: ReadonlyMap<string, Feld>): boolean {
  return Object.entries(werte).some(([kennung, wert]) => {
    const feld = alleFelder.get(kennung)
    if (!feld) return false
    if (feld.kind === 'buoy') return !!bojenWert(wert).disq
    if (feld.kind === 'code') return codeDisqs(wert).length > 0
    return feld.kind === 'disq' && disqCodes(wert).length > 0
  })
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
