import type { AppState, Eingaben, ParallelRunde } from '../types'
import { felderJeKennung, laufSchluessel, listenFelder, setzeWerte, werteVon, zerlegeLauf, OHNE_LAUF, type EingabeZelle, type EingabenKonfig } from './eingaben'
import { veranstaltungsListen, type ListenWahl } from './listen'
import { festeRunden, parallelListen } from './parallelBogen'
import { attemptSchluessel, attemptsImPlan } from './parallelSchluessel'

// Abmelden nach Beginn des Wettkampfs – rein, ohne DOM und ohne Stand.
//
// Sobald Ergebnisse erfasst sind, lässt sich ein Starter nicht mehr löschen (lib/eingaben.ts
// `starterfeldFest`): Die gedruckten Wettkampfrichter-Listen enthalten seine Zeile; fehlte sie in
// der Erfassung, passten Papier und Bildschirm nicht mehr zusammen. Stattdessen wird er als
// „nicht gestartet“ eingetragen: ein X in „Disq.“ am Steg, in jedem Lauf.
//
// Parallelslalom (Regel 960): Dort bekommt er das X ebenso – in jedem Attempt jeder
// festgeschriebenen Runde, in der er im Plan steht und für den noch nichts erfasst ist
// ({@link mitAbmeldungInRunden}). Im Vorlauf ist er damit für die Stage disqualifiziert (Pkt.
// 5.2.2), in Halbfinale, Kleinem Finale und Finale steht er auf dem hinteren Platz seines heat.
//
// Das X ist ein gewöhnlicher erfasster Wert – die Wertung, die Wertungslisten und der Hinweis
// auf verborgene Werte kennen es schon, und es lässt sich in der Erfassung wie jedes andere
// entfernen (falls er doch fährt). Dazu merkt sich der Stand, WER abgemeldet ist
// (`AppState.abgemeldet`): Nur so bekommt ein Lauf, der später dazukommt (Zahl der Läufe
// erhöht, andere Disziplin), das X ebenfalls, statt den Starter still „offen“ zu führen – und
// nur so lässt sich die Abmeldung als Ganzes zurücknehmen.

/** Der Disq-Buchstabe für „Nicht gestartet“ (Regelwerke: `{ code: "X" }`). */
export const NICHT_GESTARTET = 'X'

/**
 * Die Liste, auf der das X bevorzugt steht, wenn der Aufbau sie hat. Vorgabe des Nutzers („bei
 * jedem Lauf am Steg ein X in Disq.“); ohne sie gilt die erste Liste des Aufbaus mit einer
 * Disq-Spalte (etwa der Vorsteg).
 */
const VORZUG = 'steg'

export interface AbmeldeZiel {
  /** Kennung der Liste, z. B. „steg“. */
  liste: string
  /** Feld-Kennung der Disq-Zelle, z. B. „disq@steg“. */
  kennung: string
  /** Überschrift der Spalte, z. B. „Disq.“. */
  label: string
}

type Wahl = ListenWahl & Pick<AppState, 'laufCount'>

/** Die Zelle, in die das X für eine Klasse gehört; `undefined`, wenn keine Liste des Aufbaus sie hat. */
export function abmeldeZiel(konfig: EingabenKonfig, stand: ListenWahl, klasse: string): AbmeldeZiel | undefined {
  const ziele = veranstaltungsListen(konfig, stand).flatMap((liste): AbmeldeZiel[] => {
    if (konfig.getSheetDef(liste).showLauf === false || !konfig.positionAllowsClass(liste, klasse)) return []
    const feld = listenFelder(konfig, liste, klasse).find((f) => f.kind === 'disq' && f.gueltig(NICHT_GESTARTET) === NICHT_GESTARTET)
    return feld ? [{ liste, kennung: feld.kennung, label: feld.label }] : []
  })
  return ziele.find((z) => z.liste === VORZUG) ?? ziele[0]
}

/** Wie {@link abmeldeZiel}, aber aus den übergebenen Listen. */
function zielAus(konfig: EingabenKonfig, listen: readonly string[], klasse: string): AbmeldeZiel | undefined {
  const ziele = listen.flatMap((liste): AbmeldeZiel[] => {
    if (konfig.getSheetDef(liste).showLauf === false || !konfig.positionAllowsClass(liste, klasse)) return []
    const feld = listenFelder(konfig, liste, klasse).find((f) => f.kind === 'disq' && f.gueltig(NICHT_GESTARTET) === NICHT_GESTARTET)
    return feld ? [{ liste, kennung: feld.kennung, label: feld.label }] : []
  })
  return ziele.find((z) => z.liste === VORZUG) ?? ziele[0]
}

/** Die Zelle, in die das X im Parallelslalom gehört (dessen Listen: Zeit, Steg, Fahrweg); `undefined` ohne Parallelslalom. */
export function abmeldeZielRunde(konfig: EingabenKonfig, klasse: string): AbmeldeZiel | undefined {
  const getAufbauten = konfig.getAufbauten
  const listen = getAufbauten ? parallelListen({ getAufbauten, aufbauOrder: konfig.aufbauOrder, rohRegelwerk: konfig.rohRegelwerk }) : []
  return zielAus(konfig, listen, klasse)
}

type RundenStand = Pick<AppState, 'eingaben'> & Partial<Pick<AppState, 'parallelPlaene'>>

/**
 * Die Attempts des Parallelslaloms, die das Abmelden eines Starters mit dem X füllt: in jeder
 * festgeschriebenen Runde (oder nur in `runden`) die Attempts, die der Plan für ihn vorsieht und
 * zu denen noch nichts erfasst ist. Wie im Manövrieren wird nichts überschrieben.
 */
export function abmeldeAttempts(stand: RundenStand, konfig: EingabenKonfig, starter: { id: string; klasse: string }, runden?: readonly ParallelRunde[]): { runde: ParallelRunde; attempt: number }[] {
  const plaene = stand.parallelPlaene ?? {}
  if (!abmeldeZielRunde(konfig, starter.klasse)) return []
  return (runden ?? festeRunden(plaene)).flatMap((runde) => {
    const plan = plaene[runde]
    const attempts = plan ? [...(attemptsImPlan(plan).get(starter.id) ?? [])].sort((a, b) => a - b) : []
    return attempts.filter((attempt) => Object.keys(werteVon(stand.eingaben, attemptSchluessel(runde, attempt), starter.id)).length === 0).map((attempt) => ({ runde, attempt }))
  })
}

/** Die Eingaben, nachdem das X in den freien Attempts des Parallelslaloms steht ({@link abmeldeAttempts}). */
export function mitAbmeldungInRunden(stand: RundenStand, konfig: EingabenKonfig, starter: { id: string; klasse: string }, runden?: readonly ParallelRunde[]): Eingaben {
  const ziel = abmeldeZielRunde(konfig, starter.klasse)
  if (!ziel) return stand.eingaben
  return setzeWerte(
    stand.eingaben,
    abmeldeAttempts(stand, konfig, starter, runden).map(({ runde, attempt }): EingabeZelle => ({ lauf: attemptSchluessel(runde, attempt), starter: starter.id, feld: ziel.kennung, wert: NICHT_GESTARTET })),
  )
}

/**
 * Alle Abgemeldeten bekommen das X in den genannten Runden – wenn eine Runde festgeschrieben
 * wird, nachdem sie abgemeldet wurden. Nur dann: Ein X, das jemand später von Hand entfernt
 * (er fährt doch), kommt nicht von selbst zurück – deshalb mit `klasse` nur für die Klasse, die
 * gerade festgeschrieben wird: Dieselbe Runde wird je Klasse einzeln festgeschrieben, und das
 * Festschreiben der einen darf der anderen ihr entferntes X nicht wiederbringen.
 */
export function mitAbmeldungenInRunden<T extends RundenStand & Pick<AppState, 'abgemeldet' | 'starters'>>(stand: T, konfig: EingabenKonfig, runden: readonly ParallelRunde[], klasse?: string): T {
  const ab = new Set(stand.abgemeldet)
  let eingaben = stand.eingaben
  for (const s of stand.starters) if (ab.has(s.id) && (klasse === undefined || s.klasse === klasse)) eingaben = mitAbmeldungInRunden({ ...stand, eingaben }, konfig, s, runden)
  return eingaben === stand.eingaben ? stand : { ...stand, eingaben }
}

export interface AbmeldePlan {
  ziel: AbmeldeZiel | undefined
  /** Läufe ohne jeden erfassten Wert: Sie bekommen das X. */
  frei: number[]
  /** Läufe, in denen das X schon steht. */
  schonX: number[]
  /** Läufe mit anderen Werten: Sie bleiben, wie sie sind – nichts wird überschrieben. */
  belegt: number[]
}

/**
 * Was das Abmelden eines Starters täte: Jeder Lauf von 1 bis zur eingestellten Zahl bekommt
 * das X – außer dort, wo für den Starter schon irgendetwas erfasst ist (er ist gefahren, oder
 * jemand hat etwas vermerkt). Dort wird nichts überschrieben und nichts gelöscht; der Dialog
 * nennt diese Läufe.
 */
export function abmeldePlan(stand: Wahl & Pick<AppState, 'eingaben'>, konfig: EingabenKonfig, starter: { id: string; klasse: string }, laeufe?: readonly number[]): AbmeldePlan {
  const ziel = abmeldeZiel(konfig, stand, starter.klasse)
  const disziplin = konfig.getAufbau(stand.aufbau).disziplin
  const plan: AbmeldePlan = { ziel, frei: [], schonX: [], belegt: [] }
  const alle = laeufe ?? Array.from({ length: Math.max(1, stand.laufCount) }, (_, i) => i + 1)
  for (const lauf of alle) {
    const werte = werteVon(stand.eingaben, laufSchluessel(disziplin, lauf), starter.id)
    if (Object.keys(werte).length === 0) plan.frei.push(lauf)
    else if (ziel && nurX(werte, ziel.kennung)) plan.schonX.push(lauf)
    else plan.belegt.push(lauf)
  }
  return plan
}

const nurX = (werte: Readonly<Record<string, string>>, kennung: string) => Object.keys(werte).length === 1 && werte[kennung]?.trim().toUpperCase() === NICHT_GESTARTET

/** Die Eingaben, nachdem das X in den freien Läufen des Plans steht. */
export function mitAbmeldung(stand: Wahl & Pick<AppState, 'eingaben'>, konfig: EingabenKonfig, starter: { id: string; klasse: string }, laeufe?: readonly number[]): Eingaben {
  const plan = abmeldePlan(stand, konfig, starter, laeufe)
  if (!plan.ziel) return stand.eingaben
  const disziplin = konfig.getAufbau(stand.aufbau).disziplin
  const kennung = plan.ziel.kennung
  return setzeWerte(
    stand.eingaben,
    plan.frei.map((lauf): EingabeZelle => ({ lauf: laufSchluessel(disziplin, lauf), starter: starter.id, feld: kennung, wert: NICHT_GESTARTET })),
  )
}

/**
 * Die X-Zellen eines Starters, die das Zurücknehmen der Abmeldung entfernt: in jedem Lauf (auch
 * einem, den gerade keine Ansicht zeigt), in dem für ihn NUR das X in einer Disq-Zelle steht.
 * Läufe mit weiteren Werten bleiben, wie sie sind.
 */
export function abmeldeZellen(eingaben: Eingaben, konfig: EingabenKonfig, starter: { id: string; klasse: string }): EingabeZelle[] {
  const felder = felderJeKennung(konfig, starter.klasse)
  const out: EingabeZelle[] = []
  for (const [lauf, zeilen] of Object.entries(eingaben)) {
    if (zerlegeLauf(lauf).lauf === OHNE_LAUF) continue
    const werte = zeilen[starter.id]
    if (!werte) continue
    const [kennung, ...mehr] = Object.keys(werte)
    if (mehr.length === 0 && felder.get(kennung)?.kind === 'disq' && nurX(werte, kennung)) out.push({ lauf, starter: starter.id, feld: kennung, wert: '' })
  }
  return out
}

/**
 * Nach einer Änderung der Einstellungen (auch durch eine Vorlage): Abgemeldete bekommen das X
 * auch in Läufen, die neu dazugekommen sind – nach einer höheren Zahl der Läufe in den neuen,
 * nach dem Wechsel in eine andere Disziplin in allen (heute fahren alle wählbaren Aufbauten
 * dieselbe Disziplin; der Fall ist für den Tag vorgesehen, an dem das nicht mehr gilt).
 * Bewusst NUR dort: Ein X, das jemand in einem bestehenden Lauf von Hand entfernt hat (er fährt
 * doch), kommt nicht bei der nächsten Einstellung zurück – auch nicht, wenn die Zahl der Läufe
 * zwischendurch gesenkt war. Deshalb gilt je Starter als „neu“ nur, was über dem höchsten Lauf
 * liegt, der das X schon einmal bekam (`abgemeldetBis`).
 */
export function ergaenzeAbmeldungen<T extends Wahl & Pick<AppState, 'eingaben' | 'abgemeldet' | 'abgemeldetBis' | 'starters'>>(alt: Wahl, next: T, konfigAlt: EingabenKonfig, konfig: EingabenKonfig): T {
  if (next.abgemeldet.length === 0) return next
  const andereDisziplin = konfigAlt.getAufbau(alt.aufbau).disziplin !== konfig.getAufbau(next.aufbau).disziplin
  const ziel = Math.max(1, next.laufCount)
  const ab = new Set(next.abgemeldet)
  let eingaben = next.eingaben
  let bis = next.abgemeldetBis
  for (const s of next.starters) {
    if (!ab.has(s.id)) continue
    // Stände ohne die Angabe (vor ihrer Einführung): Das X stand bis zur bisherigen Zahl der Läufe.
    const schon = andereDisziplin ? 0 : (bis[s.id] ?? Math.max(1, alt.laufCount))
    if (ziel <= schon) continue
    const laeufe = Array.from({ length: ziel - schon }, (_, i) => schon + 1 + i)
    eingaben = mitAbmeldung({ ...next, eingaben }, konfig, s, laeufe)
    bis = { ...bis, [s.id]: ziel }
  }
  return eingaben === next.eingaben && bis === next.abgemeldetBis ? next : { ...next, eingaben, abgemeldetBis: bis }
}

/** Gelesene Angabe „X eingetragen bis Lauf …“: nur für Abgemeldete, nur ganze Zahlen ab 1. */
export function normalisiereAbgemeldetBis(raw: unknown, abgemeldet: readonly string[]): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, number> = {}
  for (const id of abgemeldet) {
    const n = (raw as Record<string, unknown>)[id]
    if (typeof n === 'number' && Number.isInteger(n) && n >= 1) out[id] = n
  }
  return out
}

/** Gelesene Abmeldungen (localStorage, Sicherung): nur IDs bekannter Starter, jede einmal. */
export function normalisiereAbgemeldet(raw: unknown, starter: ReadonlySet<string>): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && starter.has(id)))]
}
