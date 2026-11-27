import type { AppState, BereichId, Meldung, PaarSeite, PunktId, StartRef } from '../types'
import type { Konfig } from '../config/konfig'
import { betriebVon, giltAuf, lage as bereichsLage, liesRef, type BereichLage } from '../betrieb/folge'
import { punktVonRef } from './abschluss'
import { durchfahrtVon, erfassungsLage, type ListenLage } from './lage'
import { imBoot } from './schlange'

// Parcours-Ampel der Start-Freigabe (Nutzer 21.11.2026, P-03/P-04; Plan docs/plan-antworten-runde3-6.md §3): „Die
// Freigabe bezieht sich immer auf den Parcours und nie auf den Steg oder Vorsteg. Sobald ein Starter bereit ist, in den
// Parcours zu fahren, wird die Tafel auf diesen umgestellt, alle Parcours-WKR bekommen diesen Starter angezeigt und die
// Ampel wird grün. Wenn der Starter durch das Start/Ziel-Tor fährt, wird die Ampel rot. … Wenn dann alle grün sind, kann
// der nächste Starter.“ Rein und abgeleitet: gespeichert ist nur der menschliche Auslöser („Durchs Start-Tor“,
// BereichBetrieb.durchfahrt), alles andere folgt aus dem Stand und den Lagen der Listen (wkr/lage.ts). Kein DOM, kein
// Store, keine Uhr, nichts aus geraete/. Auslegungen: WKR_ANNAHMEN AM1–AM5, BETRIEB_ANNAHMEN AM6–AM8.

/**
 * `aus`: keine Ampel (kein Start gezeigt oder keine Parcours-Liste digital und aktiv, AM3); `gruen`: gezeigt, noch nicht
 * durchs Start-Tor; `rot`: durch, eine digitale, aktive Parcours-Liste hat noch nicht abgeschickt; `frei`: durch und
 * alle fertig – der Nächste kann.
 */
export type ParcoursAmpel = 'aus' | 'gruen' | 'rot' | 'frei'

export interface AmpelLage {
  ampel: ParcoursAmpel
  /** Der gezeigte Start (`refKey`); `null` ohne. */
  ref: string | null
  /** Durch per Knopf „Durchs Start-Tor“ – nur dann bietet die Start-Freigabe „zurück“ an. */
  perKnopf: boolean
  /** Titel (im Parallelslalom mit Racecourse) der digitalen, aktiven Parcours-Listen mit offenen gezeigten Starts. */
  offen: string[]
  /** Auto-Modus wirksam: eingeschaltet und jede Parcours-Liste des Bereichs digital, aktiv, mit Gerät (AM6). */
  autoMoeglich: boolean
  /** Auto-Modus eingeschaltet, aber nicht wirksam: die Parcours-Listen, an denen es liegt (Titel). */
  autoOhne: string[]
}

const titelVon = (l: Pick<ListenLage, 'titel' | 'racecourse'>) => (l.racecourse ? `${l.titel} ${l.racecourse}` : l.titel)
/** Digital (auch „beides“) und aktiv – nur solche Listen halten die Ampel rot (F1: Papier, Pause, Abmeldung nicht). */
const zaehlt = (l: ListenLage) => l.parcours && l.modus !== null && l.modus !== 'papier' && l.status === 'aktiv'

/**
 * Die Ampel eines Bereichs aus Stand und den Lagen seiner Listen (erfassungsLage(...).listen desselben Stands). Offen
 * heißt: Rückstand der Liste – der gezeigte Start zählt darin erst ab der Durchfahrt (lage.ts, AM5). Ein X des
 * gezeigten Starts gilt als durch (AM4). `wkrAuto` aus den Einstellungen des Stands.
 */
export function parcoursAmpel(stand: AppState, konfig: Konfig, bereich: BereichId, lagen: readonly ListenLage[]): AmpelLage {
  const d = durchfahrtVon(stand, konfig, bereich)
  const parcours = lagen.filter((l) => l.parcours)
  const relevant = parcours.filter(zaehlt)
  const offen = relevant.filter((l) => (l.rueckstand?.zahl ?? 0) > 0).map(titelVon)
  // Auto-Modus (AM6): JEDE Parcours-Liste digital, aktiv, mit Gerät – sonst „Auto aus: … auf Papier“.
  const ohne = parcours.filter((l) => !zaehlt(l) || l.geraete.length === 0).map(titelVon)
  const an = stand.anzeige.wkrAuto
  const autoMoeglich = an && parcours.length > 0 && ohne.length === 0
  const autoOhne = an ? ohne : []
  if (d.ref === null || relevant.length === 0) return { ampel: 'aus', ref: d.ref, perKnopf: d.perKnopf, offen: [], autoMoeglich, autoOhne }
  const ampel: ParcoursAmpel = !d.durch ? 'gruen' : offen.length > 0 ? 'rot' : 'frei'
  return { ampel, ref: d.ref, perKnopf: d.perKnopf, offen, autoMoeglich, autoOhne }
}

/** Was {@link autoSchritt} entscheidet – alles schon gelesen, damit die Entscheidung rein bleibt. */
export interface AutoEingang {
  ampel: AmpelLage
  lage: Pick<BereichLage, 'aktuell' | 'naechster'>
  meldung: Meldung | null
  /** Offene Rückfragen und Vorschläge der Listen des Bereichs (Summe). */
  offeneFragen: number
  /** „Anhalten“ gilt für den gezeigten Start (AM7). */
  angehalten: boolean
  /**
   * Der Host hat die Ampel DIESES Starts schon grün oder rot gesehen. Sonst kein Auto: nach „Zurück“ steht ein schon
   * fertiger Start wieder im Boot, nach dem Neuladen weiß niemand, ob gerade jemand „Nächster“ drücken wollte (AM6).
   */
  sahOffen: boolean
}

/**
 * Soll der Host jetzt (nach dem Verzug) automatisch den Nächsten zeigen? `null` = nein. Nur bei `frei`, wirksamem
 * Auto-Modus, ohne Anhalten, nachdem die Ampel dieses Starts offen war, mit einem Nächsten im begonnenen Punkt (lage
 * `naechster` – nie ein neuer Punkt, nie Nachzuholende oder Zurückgestellte), ohne offene Rückfragen/Vorschläge und
 * ohne Meldung „Pause“/„Störung“ (BETRIEB_ANNAHMEN.autoVorgabe, AM6). Das Ergebnis ist ein BETRIEB_ZEIGEN mit `vorher`.
 */
export function autoSchritt(e: AutoEingang): { ref: string; vorher: string } | null {
  const a = e.ampel
  if (a.ampel !== 'frei' || !a.autoMoeglich || e.angehalten || !e.sahOffen) return null
  const aktuell = e.lage.aktuell?.key ?? null
  const naechster = e.lage.naechster?.key ?? null
  if (aktuell === null || aktuell !== a.ref || naechster === null || naechster === aktuell) return null
  if (e.offeneFragen > 0) return null
  if (e.meldung && (e.meldung.art === 'pause' || e.meldung.art === 'stoerung')) return null
  return { ref: naechster, vorher: aktuell }
}

/**
 * Die Ampel eines Bereichs nur aus dem Stand (ohne Geräte – die zählen nur für den Auto-Modus), je Stand einmal
 * gerechnet: Die Sicht jeder Liste fragt danach (AM9), und der Host baut alle Listen-Sichten aus demselben Stand.
 */
const AMPEL_JE_STAND = new WeakMap<AppState, Map<BereichId, ParcoursAmpel>>()
export function ampelImStand(stand: AppState, konfig: Konfig, bereich: BereichId): ParcoursAmpel {
  let m = AMPEL_JE_STAND.get(stand)
  if (!m) AMPEL_JE_STAND.set(stand, (m = new Map()))
  let a = m.get(bereich)
  if (a === undefined) {
    a = parcoursAmpel(stand, konfig, bereich, erfassungsLage(stand, konfig, bereich, [], 0).listen).ampel
    m.set(bereich, a)
  }
  return a
}

/** Läuft der Lauf (Punkt) noch – für die Rückfrage vor „Liste abschließen“ (R6-10)? */
export interface LaufLage {
  punkt: PunktId
  /** Startnummern des Starts, der noch unterwegs ist (im Boot, bzw. die besetzten Seiten eines Paars); leer = keiner. */
  unterwegs: string[]
  /** Freie Starts dieses Punkts, die noch kommen – dazu offene Wiederholungen nach Ausfall (R11-11, 26.11.2026). */
  offen: number
}

/** Startnummern eines Starts; im Parallelslalom nur die Seiten, für die `seite` gilt (Vorgabe: beide). */
const nummernVon = (stand: AppState, ref: StartRef, seite: (x: PaarSeite) => boolean = () => true): string[] => {
  const ids = ref.art === 'm' ? [ref.starter] : (['a', 'b'] as const).flatMap((x) => (ref[x] !== null && seite(x) ? [ref[x]] : []))
  return ids.map((id) => stand.starters.find((s) => s.id === id)?.startNr ?? '').filter(Boolean)
}

/**
 * Der laufende Punkt eines Bereichs, solange er läuft (WKR_ANNAHMEN.abschlussFragtWennLaufLaeuft, R6-10): Es gibt in
 * ihm noch freie Starts, ein Start ist noch im Boot (schlange.ts imBoot), die Ampel des gezeigten Starts ist grün
 * bzw. rot – oder die fragende Liste hat den gezeigten Start noch nicht erledigt (`nochAufListe`). Letzteres trägt den
 * letzten Start eines Laufs (Prüfbefund 21.11.2026): imBoot ist dann null, und die Ampel steht auf `aus` (Tore auf
 * Papier) bzw. schon `frei`, während das Boot noch zum Anlegen fährt. `null` = kein laufender Punkt oder er ist durch.
 */
export function laufLage(stand: AppState, konfig: Konfig, bereich: BereichId, nochAufListe?: (key: string) => boolean): LaufLage | null {
  const l = bereichsLage(stand, bereich)
  const punkt = l.laufend
  if (punkt === null) return null
  // Eine offene Wiederholung (Ausfall, R11-11, 26.11.2026) kommt sicher noch – der Lauf läuft; ein abgebrochener Versuch
  // im Boot fährt dagegen nicht mehr.
  const offen = [...l.frei, ...l.wiederholung].filter((e) => e.punkt === punkt).length
  const aktuell = l.aktuell && !l.aktuell.abgebrochen && punktVonRef(stand, l.aktuell.key) === punkt ? l.aktuell.key : null
  const ampel = aktuell ? ampelImStand(stand, konfig, bereich) : 'aus'
  const faehrt = aktuell !== null && (imBoot(stand, bereich) === aktuell || ampel === 'gruen' || ampel === 'rot' || nochAufListe?.(aktuell) === true)
  if (offen === 0 && !faehrt) return null
  const ref = faehrt && aktuell ? liesRef(aktuell) : null
  // Wiederholt nur ein Boot (R13-02), ist nur dieses unterwegs (betrieb/folge.ts giltAuf, Prüfbefund 27.11.2026).
  const b = betriebVon(stand, bereich)
  return { punkt, unterwegs: ref ? nummernVon(stand, ref, (x) => giltAuf(b, b.gezeigt.length - 1, x)) : [], offen }
}
