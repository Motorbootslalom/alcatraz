import type { AppState, BereichId, ClassId, GezeigterStart, SichtBereich, SichtEinstellungen, SichtStart, SichtStarter, ZuschauerBereich } from '../types'
import { regelwerkOf, STARTABSTAND_RUECKFALL, startabstandOf, startabstandVorgabe } from '../config/catalog'
import { BETRIEB_ANNAHMEN } from './annahmen'
import { bereicheZumStand, betriebVon, liesRef, startfolge, type FolgeEintrag } from './folge'

// Startabstände messen und Wartezeiten vorhersagen (Etappe E3; Vorbild: Tafel-Prototyp lib/timing.ts, auf
// StartRef und die Folge des Betriebs umgestellt). Zwei Teile, mit Absicht getrennt (Kritik K28):
//
// - Messung, auf dem Stand: Aus dem Verlauf der Anzeige (`betrieb.bereiche[].gezeigt`, mit der Zeit des Hosts)
//   werden die Abstände je Klasse gemittelt. Das ist zeitunabhängig – es ändert sich nur mit einem neuen
//   gezeigten Start – und geht als `abstaende` in die Sicht (betrieb/sicht.ts).
// - Wartezeit, auf dem Bildschirm: aus der Sicht und `jetzt + versatz` (lokal 0). Nie im Reducer und nie in der
//   Sicht – sonst änderte sie sich jede Sekunde, und jedes Gerät bekäme eine Flut von Änderungen.
//
// Auslegungen (Grenzen, ab wann die Messung gilt, was keine Messung ist, wer eine Wartezeit bekommt):
// BETRIEB_ANNAHMEN.prognoseMessung, keineMessungOhneLauf, keineMessungUeberPunktgrenze, wartezeitNurFreigegebene,
// vorstegVorDenStegStarts, vorgabeAbGenugMessungen, keineZahlBeiPause.

// --- Messung --------------------------------------------------------------------------------------

/** Ein gemessener Startabstand: Sekunden von der Anzeige eines Starts bis zur nächsten, der Klasse des vorigen zugeschlagen. */
export interface Messung {
  bereich: BereichId
  klasse: ClassId
  sekunden: number
}

/**
 * Die Messungen eines Bereichs aus seinem Verlauf der Anzeige. Ein Abstand gehört dem VORIGEN Start: Die Zeit von
 * seinem Erscheinen bis zum nächsten hat sein Lauf gekostet. Er zählt nicht, wenn er unplausibel kurz oder lang
 * ist (L-4), der vorige Start inzwischen entfällt (X), zwischen beiden in der Folge ein „ohne Anzeige“ erledigter
 * Start steht (Einsteigen – der Abstand umfasste mehrere Läufe), beide Starts zu verschiedenen Punkten gehören
 * (Laufwechsel: „Lauf beginnen“, WKR-Bögen tauschen – BETRIEB_ANNAHMEN.keineMessungUeberPunktgrenze) oder die
 * Klasse unbekannt ist (Starter gelöscht). Starts des Parallelslaloms (ab E4) werden noch nicht gemessen.
 */
export function messungenIn(
  bereich: BereichId,
  gezeigt: readonly GezeigterStart[],
  folge: readonly FolgeEintrag[],
  ohneAnzeige: readonly string[],
  klasseVon: (starter: string) => ClassId | undefined,
): Messung[] {
  const { kuerzester, laengster } = BETRIEB_ANNAHMEN.prognoseMessung
  const pruefen = BETRIEB_ANNAHMEN.keineMessungOhneLauf
  const grenze = BETRIEB_ANNAHMEN.keineMessungUeberPunktgrenze
  const stelle = new Map(folge.map((e, i) => [e.key, i]))
  const ohne = ohneAnzeige.flatMap((k) => stelle.get(k) ?? [])
  const out: Messung[] = []
  for (let i = 1; i < gezeigt.length; i++) {
    const vorig = gezeigt[i - 1]
    const sekunden = (gezeigt[i].zeit - vorig.zeit) / 1000
    if (!(sekunden >= kuerzester && sekunden <= laengster)) continue
    const ref = liesRef(vorig.ref)
    if (!ref || ref.art !== 'm') continue
    const a = stelle.get(vorig.ref)
    const b = stelle.get(gezeigt[i].ref)
    if (pruefen && a !== undefined && folge[a].entfaellt) continue
    if (pruefen && a !== undefined && b !== undefined && ohne.some((o) => o > Math.min(a, b) && o < Math.max(a, b))) continue
    // Über eine Punktgrenze steckt der Laufwechsel im Abstand. Ob dazwischen „Lauf beginnen“ lag, weiß der Stand
    // nicht (begonnen trägt keine Zeit) – also lieber eine Messung verwerfen als eine verzerrte mitteln.
    if (grenze && a !== undefined && b !== undefined && folge[a].punkt !== folge[b].punkt) continue
    const klasse = klasseVon(ref.starter)
    if (klasse) out.push({ bereich, klasse, sekunden })
  }
  return out
}

/** Die Klasse eines Starters nach seiner ID (für {@link messungenIn}). */
export function klasseNachStarter(stand: Pick<AppState, 'starters'>): (starter: string) => ClassId | undefined {
  const klassen = new Map(stand.starters.map((s) => [s.id, s.klasse]))
  return (id) => klassen.get(id)
}

/** Alle Messungen der Veranstaltung, über alle Bereiche (die Klasse fährt überall gleich schnell). */
export function messungen(stand: AppState): Messung[] {
  const klasseVon = klasseNachStarter(stand)
  return bereicheZumStand(stand).flatMap((b) => {
    const betrieb = betriebVon(stand, b.id)
    return betrieb.gezeigt.length < 2 ? [] : messungenIn(b.id, betrieb.gezeigt, startfolge(stand, b.id), betrieb.ohneAnzeige, klasseVon)
  })
}

/** Gemessene Startabstände einer Klasse. */
export interface KlassenMessung {
  klasse: ClassId
  /** Mittel in Sekunden (ungerundet). */
  mittel: number
  anzahl: number
  /** Der zuletzt gemessene Abstand – zeigt den aktuellen Rhythmus. */
  zuletzt: number
}

/** Die Messungen je Klasse gemittelt. */
export function klassenMessungen(ms: readonly Messung[]): Partial<Record<ClassId, KlassenMessung>> {
  const summen = new Map<ClassId, { summe: number; anzahl: number; zuletzt: number }>()
  for (const m of ms) {
    const s = summen.get(m.klasse) ?? { summe: 0, anzahl: 0, zuletzt: 0 }
    summen.set(m.klasse, { summe: s.summe + m.sekunden, anzahl: s.anzahl + 1, zuletzt: m.sekunden })
  }
  const out: Partial<Record<ClassId, KlassenMessung>> = {}
  for (const [klasse, s] of summen) out[klasse] = { klasse, mittel: s.summe / s.anzahl, anzahl: s.anzahl, zuletzt: s.zuletzt }
  return out
}

/** Reicht die Messung einer Klasse für die Prognose (BETRIEB_ANNAHMEN.prognoseMessung.ab)? */
export function genugGemessen(m: KlassenMessung | undefined): m is KlassenMessung {
  return m !== undefined && m.anzahl >= BETRIEB_ANNAHMEN.prognoseMessung.ab
}

/**
 * Der Startabstand einer Klasse in ganzen Sekunden, wie die Prognose ihn nimmt: das gemessene Mittel ab genug
 * Messungen, sonst die Vorgabe (config/catalog.ts startabstandOf: eigener Wert, Regelwerk, einstellungen.yaml).
 * `gemessen` lässt sich mitgeben, wenn mehrere Klassen gefragt werden.
 */
export function startabstandImBetrieb(stand: AppState, klasse: ClassId, gemessen: Partial<Record<ClassId, KlassenMessung>> = klassenMessungen(messungen(stand))): number {
  const m = gemessen[klasse]
  return genugGemessen(m) ? Math.round(m.mittel) : startabstandOf(stand, klasse)
}

/** Ein Startabstand für die Einstellungen und die Startliste im Betrieb: woher er kommt und was gilt. */
export interface StartabstandZeile {
  klasse: ClassId
  /** Die Vorgabe ohne eigenen Wert: Regelwerk, sonst einstellungen.yaml. */
  vorgabe: number
  /** Der eigene Wert der Veranstaltung (`anzeige.abstaende`), sonst `null`. */
  eigen: number | null
  /** Was diese Veranstaltung gemessen hat; `null` ohne Messung. */
  gemessen: KlassenMessung | null
  /** Was die Prognose nimmt (ganze Sekunden). */
  wirksam: number
  quelle: 'messung' | 'eigen' | 'vorgabe'
}

/** Die Startabstände je Klasse (Vorgabe: alle Klassen des Regelwerks) – für Einstellungen und Startliste. */
export function startabstandZeilen(stand: AppState, klassen: readonly ClassId[] = regelwerkOf(stand.regelwerk).klassen): StartabstandZeile[] {
  const gemessen = klassenMessungen(messungen(stand))
  return klassen.map((klasse) => {
    const m = gemessen[klasse]
    const eigen = stand.anzeige.abstaende[klasse] ?? null
    return {
      klasse,
      vorgabe: startabstandVorgabe(stand.regelwerk, klasse),
      eigen,
      gemessen: m ?? null,
      wirksam: startabstandImBetrieb(stand, klasse, gemessen),
      quelle: genugGemessen(m) ? 'messung' : eigen !== null ? 'eigen' : 'vorgabe',
    }
  })
}

/**
 * „Messwerte als Vorgabe übernehmen“ (L-6): die eigenen Startabstände, wie sie danach sein sollen – für
 * `SET_ANZEIGE { abstaende }`. Klassen mit genug Messungen bekommen ihr gerundetes Mittel, die übrigen behalten
 * ihren eigenen Wert; was der Vorgabe gleicht, ist kein eigener Wert (BETRIEB_ANNAHMEN.vorgabeAbGenugMessungen).
 * Nichts gemessen ⇒ dieselben eigenen Werte (ohne die, die der Vorgabe gleichen).
 */
export function messwerteAlsVorgabe(stand: AppState): Partial<Record<ClassId, number>> {
  const gemessen = klassenMessungen(messungen(stand))
  const neu: Partial<Record<ClassId, number>> = { ...stand.anzeige.abstaende }
  for (const m of Object.values(gemessen)) if (m && (BETRIEB_ANNAHMEN.vorgabeAbGenugMessungen ? genugGemessen(m) : m.anzahl > 0)) neu[m.klasse] = Math.round(m.mittel)
  for (const [klasse, sekunden] of Object.entries(neu) as [ClassId, number][]) if (sekunden === startabstandVorgabe(stand.regelwerk, klasse)) delete neu[klasse]
  return neu
}

// --- Wartezeit (auf dem Bildschirm) ------------------------------------------------------------------

/** Was die Wartezeit von einer Sicht braucht – die öffentliche wie die Zuschauersicht haben es. */
export interface PrognoseSicht {
  starter: Record<string, SichtStarter>
  abstaende: Partial<Record<ClassId, number>>
  einst: Pick<SichtEinstellungen, 'amSteg' | 'vorSteg'>
}

/** Wo ein freigegebener Start jetzt stehen soll: am Steg (die nächsten `amSteg`), vor Steg (die `vorSteg` danach). */
export type StegStelle = 'amSteg' | 'vorSteg' | null

/** Die Wartezeit eines Starts. */
export type Wartezeit =
  /**
   * Freigegeben: Stelle in der offenen Folge (0 = der Nächste), Sekunden ab `jetzt` bis zum Start und bis er am
   * Vorsteg sein muss (0 = schon jetzt), und wo er gerade stehen soll.
   */
  | { art: 'zeit'; stelle: number; bisStart: number; bisVorsteg: number; steg: StegStelle }
  /**
   * Freigegeben, aber der Bereich steht: Die Anzeigetafel zeigt eine Pause oder Störung (BETRIEB_ANNAHMEN.
   * keineZahlBeiPause). Stelle und Steg bleiben (wer am Steg wartet, wartet dort weiter), die Zahl fehlt.
   */
  | { art: 'angehalten'; stelle: number; steg: StegStelle }
  /** Seine Klasse setzt aus („Boot fehlt“, L-7): keine Zahl. */
  | { art: 'bootFehlt' }
  /** Sein Punkt ist nicht begonnen: Der Beginn steht nicht fest (L-2), keine Zahl. */
  | { art: 'spaeter' }
  /** Zurückgestellt oder nachzuholen: kommt nicht von selbst, keine Zahl. */
  | { art: 'ohne' }

/**
 * Die offene Folge der begonnenen Punkte eines Bereichs, der erste ist der Nächste – in der Zuschauersicht steht
 * sie als `frei`, in der öffentlichen ist sie der Teil von `waehlbar` (alle offenen Starts in ihrer Folge), dessen
 * Punkt begonnen ist (betrieb/folge.ts `lage().frei`).
 */
export function freieFolge(bereich: SichtBereich | ZuschauerBereich): readonly SichtStart[] {
  if ('frei' in bereich) return bereich.frei
  const begonnen = new Set(bereich.begonnen)
  return bereich.waehlbar.filter((s) => begonnen.has(s.punkt))
}

/**
 * Steht der Bereich? Ja, solange die Anzeigetafel eine Pause oder Störung zeigt – dieselbe Grenze wie dort
 * (components/anzeige/AnzeigeBereich.vue `ersetzt`: jede Meldung außer „Hinweis“ verdrängt den Starter). Auch eine
 * Begrüßung steht als Pause: Vor dem ersten Start wäre jede Zahl erfunden. BETRIEB_ANNAHMEN.keineZahlBeiPause.
 */
export function bereichAngehalten(bereich: Pick<SichtBereich, 'meldung'>): boolean {
  return BETRIEB_ANNAHMEN.keineZahlBeiPause && bereich.meldung !== null && bereich.meldung.art !== 'info'
}

/** Wie lange `aktuell` schon im Boot steht, in Sekunden (nie unter 0 – die Uhr des Geräts kann nachgehen); `null` ohne Start. */
export function seitSekunden(bereich: Pick<SichtBereich, 'aktuell' | 'seit'>, jetzt: number): number | null {
  return bereich.aktuell && bereich.seit !== null ? Math.max(0, (jetzt - bereich.seit) / 1000) : null
}

/**
 * Die Wartezeiten der Starts eines Bereichs zu `jetzt` (Zeit des Hosts: eigene Uhr plus Versatz). Freigegebene
 * Starts der Reihe nach: erst der Rest des Starts im Boot (Abstand seiner Klasse minus die Zeit seither, nie unter
 * 0), dann je Start der Abstand seiner Klasse. Bis zum Vorsteg: die Wartezeit des Starts `amSteg + vorSteg` Stellen
 * davor (BETRIEB_ANNAHMEN.vorstegVorDenStegStarts). Starts ohne Zahl stehen mit ihrer Art darin; die öffentliche
 * Sicht bringt dazu alle übrigen offenen (spätere Punkte), zurückgestellten und nachzuholenden. Steht der Bereich
 * (Pause oder Störung auf der Anzeigetafel), tragen die freigegebenen nur Stelle und Steg (`angehalten`).
 */
export function wartezeiten(sicht: PrognoseSicht, bereich: SichtBereich | ZuschauerBereich, jetzt: number): Map<string, Wartezeit> {
  const klasse = (s: SichtStart) => sicht.starter[s.starter]?.klasse
  // Die Sicht nennt den Abstand jeder ihrer Klassen; der Rückfall greift nur bei einer unvollständigen Sicht.
  const abstand = (s: SichtStart) => {
    const k = klasse(s)
    return (k ? sicht.abstaende[k] : undefined) ?? STARTABSTAND_RUECKFALL
  }
  // Rest des Starts im Boot. Ohne Starter (gelöscht) ist seine Klasse unbekannt – dann nichts.
  const seit = seitSekunden(bereich, jetzt)
  let summe = bereich.aktuell && seit !== null && klasse(bereich.aktuell) ? Math.max(0, abstand(bereich.aktuell) - seit) : 0
  const amSteg = sicht.einst.amSteg
  const vorne = sicht.einst.amSteg + sicht.einst.vorSteg
  const out = new Map<string, Wartezeit>()
  const bisStart: number[] = []
  const angehalten = bereichAngehalten(bereich)
  freieFolge(bereich).forEach((s, stelle) => {
    const steg: StegStelle = stelle < amSteg ? 'amSteg' : stelle < vorne ? 'vorSteg' : null
    bisStart.push(summe)
    out.set(s.key, angehalten ? { art: 'angehalten', stelle, steg } : { art: 'zeit', stelle, bisStart: summe, bisVorsteg: stelle < vorne ? 0 : bisStart[stelle - vorne], steg })
    summe += abstand(s)
  })
  const setze = (starts: readonly SichtStart[], w: Wartezeit) => {
    for (const s of starts) if (!out.has(s.key)) out.set(s.key, w)
  }
  setze(bereich.bootFehlt, { art: 'bootFehlt' })
  if ('waehlbar' in bereich) {
    setze(bereich.waehlbar, { art: 'spaeter' })
    setze([...bereich.zurueckgestellt, ...bereich.nachzuholen], { art: 'ohne' })
  }
  return out
}

/** Eine Wartezeit zum Anzeigen: unter einer Minute „gleich“, sonst gerundete Minuten, ab einer Stunde h:mm. */
export type WartezeitAnzeige = { art: 'gleich' } | { art: 'min'; min: number } | { art: 'h'; h: number; min: number }

/** Sekunden als {@link WartezeitAnzeige} (der Text kommt aus i18n, in der Sprache der Liste). */
export function wartezeitAnzeige(sekunden: number): WartezeitAnzeige {
  if (sekunden < 60) return { art: 'gleich' }
  const min = Math.round(sekunden / 60)
  return min < 60 ? { art: 'min', min } : { art: 'h', h: Math.floor(min / 60), min: min % 60 }
}

/** Sekunden als m:ss („1:05“) – für „seit m:ss“ und gemessene Abstände; sprachunabhängig. */
export function mmss(sekunden: number): string {
  const s = Math.max(0, Math.round(sekunden))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
