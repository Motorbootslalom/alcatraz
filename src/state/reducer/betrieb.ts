// Betrieb am Wettkampftag (Anzeigetafel, Start-Freigabe) und die Einstellungen der Anzeigetafel;
// Normalisierer für migrate(). Plan zur Übernahme der Tafel vom 16.11.2026, §3.
//
// Jede Action ist bedingt bzw. idempotent: Doppelte Zustellung, ein Doppelklick oder ein veraltetes
// Gerät verdrehen nichts. Unverändert = derselbe Stand. Die Zeit kommt mit der Action (der Store
// setzt sie), Kennungen sind Refs (betrieb/folge.ts `refKey`), keine Zufalls-IDs. Der Betrieb schreibt
// nie in `eingaben` und ändert keine Wertungsliste (BETRIEB_ANNAHMEN.keinXVonDerTafel).

import type { AnzeigeEinstellungen, AnzeigeNamen, AnzeigeSprache, AppState, BereichBetrieb, BereichId, Betrieb, ClassId, GezeigterStart, Meldung, MeldungArt, ParallelAnordnung, PunktId, VerschiebeZiel } from '../../types'
import { CLASS_IDS } from '../../domain/classes'
import { STARTABSTAND_MAX, STARTABSTAND_MIN } from '../../config/schema'
import { istOriginStyle } from '../../lib/origin'
import { BETRIEB_ANNAHMEN } from '../../betrieb/annahmen'
import { bereichBekannt, bereicheZumStand, bereichFest, bereichLeer, betriebVon, istParallel, istPunktId, lage, liesRef, PARALLEL_BEREICH, programm, spurenVon, type BereichLage } from '../../betrieb/folge'
import { ansPunktende, beweglich, einsteigen, hinterDenZeiger, klasseVor, paarStarts, planPartner, schnappschuss, verschiebe, webeNeu } from '../../betrieb/schritte'

export type BetriebAenderung =
  /** Einen Punkt (Lauf) beginnen – nur mit festgeschriebener Verzahnung und nur, wenn er im Programm steht. */
  | { type: 'BETRIEB_BEGINNEN'; bereich: BereichId; punkt: PunktId }
  /**
   * Einen Start auf die Anzeigetafel bringen („Nächster Start“). Wirkt nur, wenn gerade `vorher`
   * (Kennung, `null` = noch keiner) steht – ein Doppelklick oder eine doppelte Zustellung schaltet
   * nicht zweimal. `ref`: der Nächste oder – gezielt (B-5, S-4) – jeder andere nicht erledigte, nicht
   * entfallene Start, auch eines nicht begonnenen Punkts; der rückt in der Folge hinter den Zeiger bzw.
   * hinter den Start im Boot – dorthin, wo er gefahren ist.
   */
  | { type: 'BETRIEB_ZEIGEN'; bereich: BereichId; ref: string; vorher: string | null }
  /** Den zuletzt gezeigten Start zurücknehmen – nur, wenn er `ref` ist. */
  | { type: 'BETRIEB_ZURUECK'; bereich: BereichId; ref: string }
  /** Meldung eines Bereichs oder aller (`*`) setzen; `null` (oder ein leerer Text) löscht sie. */
  | { type: 'BETRIEB_MELDUNG'; bereich: BereichId | '*'; meldung: Meldung | null }
  /** Den Betrieb eines Bereichs oder aller leeren („Betrieb zurücksetzen“). */
  | { type: 'BETRIEB_ZURUECKSETZEN'; bereich?: BereichId }
  /** Einstellungen der Anzeigetafel; nur was im Patch steht, ändert sich (geprüft wie beim Laden). */
  | { type: 'SET_ANZEIGE'; patch: Partial<AnzeigeEinstellungen> }
  // --- E2: Steuerung an der Start-Freigabe (betrieb/schritte.ts) ---
  /** Einen Start zurückstellen (B-3): Er fährt nicht, bleibt aber sichtbar. Nur offene, nachzuholende und „Boot fehlt“-Starts. */
  | { type: 'BETRIEB_ZURUECKSTELLEN'; bereich: BereichId; ref: string }
  /**
   * Einen zurückgestellten oder nachzuholenden Start wieder einreihen (B-4): `naechster` direkt hinter den
   * Zeiger, `ende` ans Ende seines Punkts (ist der vorbei, des laufenden).
   */
  | { type: 'BETRIEB_EINREIHEN'; bereich: BereichId; ref: string; wo: 'naechster' | 'ende' }
  /**
   * Eine Klasse aussetzen (`an`, „Boot fehlt“, V-5) bzw. zurückholen. Mit „Andere Klassen vorziehen“ wird
   * beim Aussetzen der Rest der begonnenen Punkte neu verzahnt; beim Zurückholen immer.
   */
  | { type: 'BETRIEB_AUSSETZEN'; bereich: BereichId; klasse: ClassId; an: boolean }
  /** „Andere Klassen vorziehen“ – ausdrücklich an oder aus, nie umschaltend (doppelt zugestellt = einmal). */
  | { type: 'BETRIEB_VORZIEHEN'; bereich: BereichId; an: boolean }
  /** Eine Klasse vor `vor` ziehen (`null` = als Letzte), nur innerhalb ihrer Spur und nur im Arbeitspunkt (B-10). */
  | { type: 'BETRIEB_KLASSE_VOR'; bereich: BereichId; klasse: ClassId; vor: ClassId | null }
  /** Einen Start verschieben (S-4, S-6): vor/hinter einen Start oder an eine Punktgrenze; nie vor den Zeiger. */
  | { type: 'BETRIEB_VERSCHIEBEN'; bereich: BereichId; ref: string; ziel: VerschiebeZiel }
  /**
   * Einsteigen ab einem Start (mitten im Wettkampf, nach Neuanfang): Was davor nicht gezeigt wurde, ist
   * „ohne Anzeige“ erledigt, die Punkte bis zu seinem sind begonnen. Ein früherer Start öffnet wieder.
   */
  | { type: 'BETRIEB_AB'; bereich: BereichId; ref: string }

/** Längste Meldung in Zeichen: Mehr ist auf der Tafel aus der Entfernung nicht zu lesen. */
export const MELDUNG_MAX = 200
/** Längste Kopfzeile in Zeichen. */
export const KOPFZEILE_MAX = 120
export const SKALA_MIN = 0.7
export const SKALA_MAX = 1.3
/** Höchstens so viele Starts „am Steg“ bzw. „vor Steg“. */
export const STEG_MAX = 10
/** Grenzen eines eigenen Startabstands in Sekunden (E3) – dieselben wie für die Vorgaben im YAML (config/schema.ts). */
export const ABSTAND_MIN = STARTABSTAND_MIN
export const ABSTAND_MAX = STARTABSTAND_MAX

const MELDUNG_ARTEN: readonly MeldungArt[] = ['info', 'stoerung', 'pause']
const NAMEN: readonly AnzeigeNamen[] = ['aushang', 'voll', 'kurz', 'ohne']
const SPRACHEN: readonly AnzeigeSprache[] = ['regelwerk', 'de', 'en']
/** Die Lagen von Racecourse A und B auf der Anzeigetafel, in der Folge der Auswahl (SettingsView). */
export const PARALLEL_ANORDNUNGEN: readonly ParallelAnordnung[] = ['a-links', 'b-links', 'a-oben', 'b-oben']

/**
 * Vorgaben der Anzeigetafel. Davor und Parcours-Name an (wie der Tafel-Prototyp), Größe 1;
 * Namen, Herkunft und Sprache nach BETRIEB_ANNAHMEN; 2 am Steg, 2 vor Steg (docs/stand.md: 1 im
 * Boot, 2 am Steg, 2 vor Steg); Verzahnung beim Verschieben halten (V-7); Racecourse A links, B rechts
 * (so stand die Tafel bis zur Einstellung vom 16.11.2026 immer).
 */
export function anzeigeVorgabe(): AnzeigeEinstellungen {
  return {
    kopfzeile: null,
    bereiche: [],
    davor: true,
    parcoursName: true,
    herkunft: BETRIEB_ANNAHMEN.herkunftVorgabe,
    namen: BETRIEB_ANNAHMEN.namenVorgabe,
    skala: 1,
    sprache: BETRIEB_ANNAHMEN.spracheVorgabe,
    logos: true,
    parallelAnordnung: 'a-links',
    amSteg: 2,
    vorSteg: 2,
    verzahnungHalten: true,
    abstaende: {},
  }
}

/** Der leere Betrieb: Kein Bereich hat begonnen. */
export function betriebLeer(): Betrieb {
  return { bereiche: {} }
}

const ganz = (n: unknown, min: number, max: number): number | undefined => (typeof n === 'number' && Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : undefined)
const wahrheit = (x: unknown, vorgabe: boolean): boolean => (typeof x === 'boolean' ? x : vorgabe)
const eindeutig = <T>(xs: readonly T[]): T[] => [...new Set(xs)]

/** Eine brauchbare Meldung: Text nicht leer (gekürzt auf MELDUNG_MAX), Art bekannt (sonst „info“); sonst `null`. */
export function meldungWert(raw: unknown): Meldung | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as { text?: unknown; art?: unknown }
  const text = typeof m.text === 'string' ? m.text.trim().slice(0, MELDUNG_MAX) : ''
  if (!text) return null
  return { text, art: MELDUNG_ARTEN.find((a) => a === m.art) ?? 'info' }
}

/**
 * Gelesene Einstellungen der Anzeigetafel (localStorage, Sicherung, Vorlage, SET_ANZEIGE): jedes Feld
 * geprüft, Unbrauchbares wird die Vorgabe. `bereichIds`: die Bereiche, die es gibt – andere entfallen
 * aus der Auswahl. Die Kopfzeile wird nicht getrimmt (sonst ginge beim Tippen das Leerzeichen verloren).
 */
export function normalisiereAnzeige(raw: unknown, bereichIds?: readonly string[]): AnzeigeEinstellungen {
  const v = anzeigeVorgabe()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return v
  const a = raw as Partial<Record<keyof AnzeigeEinstellungen, unknown>>
  const bereiche = Array.isArray(a.bereiche) ? eindeutig(a.bereiche.filter((id): id is string => typeof id === 'string' && id !== '' && (!bereichIds || bereichIds.includes(id)))) : v.bereiche
  const abstaende: AnzeigeEinstellungen['abstaende'] = {}
  if (a.abstaende && typeof a.abstaende === 'object' && !Array.isArray(a.abstaende)) {
    for (const [klasse, s] of Object.entries(a.abstaende)) {
      const sekunden = ganz(s, ABSTAND_MIN, ABSTAND_MAX)
      if (CLASS_IDS.includes(klasse as ClassId) && sekunden !== undefined) abstaende[klasse as ClassId] = sekunden
    }
  }
  const skala = typeof a.skala === 'number' && Number.isFinite(a.skala) ? Math.round(Math.max(SKALA_MIN, Math.min(SKALA_MAX, a.skala)) * 100) / 100 : v.skala
  return {
    kopfzeile: typeof a.kopfzeile === 'string' ? a.kopfzeile.slice(0, KOPFZEILE_MAX) : null,
    bereiche,
    davor: wahrheit(a.davor, v.davor),
    parcoursName: wahrheit(a.parcoursName, v.parcoursName),
    herkunft: a.herkunft === 'aus' || istOriginStyle(a.herkunft) ? a.herkunft : v.herkunft,
    namen: NAMEN.find((n) => n === a.namen) ?? v.namen,
    skala,
    sprache: SPRACHEN.find((s) => s === a.sprache) ?? v.sprache,
    logos: wahrheit(a.logos, v.logos),
    parallelAnordnung: PARALLEL_ANORDNUNGEN.find((x) => x === a.parallelAnordnung) ?? v.parallelAnordnung,
    amSteg: ganz(a.amSteg, 0, STEG_MAX) ?? v.amSteg,
    vorSteg: ganz(a.vorSteg, 0, STEG_MAX) ?? v.vorSteg,
    verzahnungHalten: wahrheit(a.verzahnungHalten, v.verzahnungHalten),
    abstaende,
  }
}

const refListe = (raw: unknown): string[] => (Array.isArray(raw) ? eindeutig(raw.filter((k): k is string => liesRef(k) !== null)) : [])

function normalisiereBereich(raw: unknown): BereichBetrieb | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const b = raw as Partial<Record<keyof BereichBetrieb, unknown>>
  const gezeigt: GezeigterStart[] = Array.isArray(b.gezeigt)
    ? b.gezeigt.flatMap((g: unknown) => {
        const e = g as { ref?: unknown; zeit?: unknown } | null
        if (!e || liesRef(e.ref) === null) return []
        return [{ ref: e.ref as string, zeit: typeof e.zeit === 'number' && Number.isFinite(e.zeit) && e.zeit > 0 ? e.zeit : 0 }]
      })
    : []
  const bereich: BereichBetrieb = {
    begonnen: Array.isArray(b.begonnen) ? eindeutig(b.begonnen.filter(istPunktId)) : [],
    gezeigt,
    ohneAnzeige: refListe(b.ohneAnzeige),
    zurueckgestellt: refListe(b.zurueckgestellt),
    // Ein leerer Schnappschuss ist keiner (es gibt keine Folge ohne Starts, von der abzuweichen wäre).
    reihenfolge: Array.isArray(b.reihenfolge) && refListe(b.reihenfolge).length > 0 ? refListe(b.reihenfolge) : null,
    ausgesetzt: Array.isArray(b.ausgesetzt) ? eindeutig(b.ausgesetzt.filter((k): k is ClassId => CLASS_IDS.includes(k as ClassId))) : [],
    vorziehen: typeof b.vorziehen === 'boolean' ? b.vorziehen : BETRIEB_ANNAHMEN.vorziehenVorgabe,
    meldung: meldungWert(b.meldung),
  }
  return bereichLeer(bereich) ? null : bereich
}

/**
 * Gelesener Betrieb (localStorage, Sicherung): Unbrauchbares entfällt, ebenso leere Bereiche und –
 * mit `bereichIds` – Bereiche, die es nicht (mehr) gibt.
 */
export function normalisiereBetrieb(raw: unknown, bereichIds?: readonly string[]): Betrieb {
  const bereiche = (raw as { bereiche?: unknown } | null)?.bereiche
  if (!bereiche || typeof bereiche !== 'object' || Array.isArray(bereiche)) return betriebLeer()
  const paare = Object.entries(bereiche).flatMap(([id, b]): [string, BereichBetrieb][] => {
    if (bereichIds && !bereichIds.includes(id)) return []
    const n = normalisiereBereich(b)
    return n ? [[id, n]] : []
  })
  // Object.fromEntries legt jede Kennung als eigenes Feld an – auch eine wie „__proto__“.
  return { bereiche: Object.fromEntries(paare) }
}

/**
 * Die Bereiche, die ein Stand kennen kann: seine Parcours und der Parallelslalom (E4) – Letzteren immer, auch unter
 * DM: Beim Laden steht das Regelwerk nicht sicher fest, und ein Eintrag stört dort nicht (unter DM gibt es keinen
 * solchen Bereich, also auch keine Schritte darin – schrittErlaubt, bereichBekannt).
 */
export function bereichKennungen(stand: Pick<AppState, 'parcoursList'>): string[] {
  return [...stand.parcoursList.map((p) => p.id), PARALLEL_BEREICH]
}

/**
 * Den Bereich setzen. Ist danach nichts mehr in ihm geschehen (etwa „Vorziehen“ aus und wieder an), fällt sein
 * Eintrag weg – wie beim Laden (normalisiereBetrieb); sonst hielte ein leerer Eintrag „Betrieb zurücksetzen“
 * sichtbar, bis neu geladen wird.
 */
function mitBereich(state: AppState, bereich: BereichId, b: BereichBetrieb): AppState {
  if (bereichLeer(b)) {
    if (!Object.hasOwn(state.betrieb.bereiche, bereich)) return state
    const { [bereich]: _weg, ...rest } = state.betrieb.bereiche
    return { ...state, betrieb: { bereiche: rest } }
  }
  return { ...state, betrieb: { bereiche: { ...state.betrieb.bereiche, [bereich]: b } } }
}

const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Den Bereich ersetzen – nur wenn sich etwas ändert; sonst derselbe Stand (unverändert = dieselbe Referenz). */
function wennAnders(state: AppState, bereich: BereichId, alt: BereichBetrieb, neu: BereichBetrieb): AppState {
  return gleich(alt, neu) ? state : mitBereich(state, bereich, neu)
}

/** Die neue Folge als Schnappschuss – `null`, wenn sie der abgeleiteten gleicht. */
const folgeAls = (l: Pick<BereichLage, 'abgeleitet'>, keys: readonly string[]) => schnappschuss(keys, l.abgeleitet)

/**
 * Die Schritte der Etappe E2 legen eine Folge fest – nur mit festgeschriebener Verzahnung
 * (BETRIEB_ANNAHMEN.schritteNurFestgeschrieben, wie Beginnen und Zeigen) und nur in einem Bereich, den es gibt
 * (ein Programm hat): Ein veraltetes Gerät legt sonst Einträge für Bereiche an, die es nicht gibt – unter DM
 * auch für den Parallelslalom, den migrate() als Kennung immer durchlässt.
 */
const schrittErlaubt = (l: Pick<BereichLage, 'fest' | 'programm'>) => l.programm.length > 0 && (l.fest || !BETRIEB_ANNAHMEN.schritteNurFestgeschrieben)

/**
 * Schritte, die sich an den Spuren der Verzahnung ausrichten (Klasse aussetzen, vorziehen, Klasse vor, verschieben),
 * gibt es im Parallelslalom nicht: Dort gibt der festgeschriebene Plan die Folge vor (BETRIEB_ANNAHMEN.parallelOhneUmstellen).
 */
const umstellenErlaubt = (l: Pick<BereichLage, 'fest' | 'programm' | 'bereich'>) => schrittErlaubt(l) && !(istParallel(l.bereich) && BETRIEB_ANNAHMEN.parallelOhneUmstellen)

/**
 * Den Rest der Punkte neu verzahnen (Klasse aussetzen, zurückholen, vorziehen): die begonnenen und der
 * Arbeitspunkt – spätere Punkte bleiben auf der Verzahnung (V-5).
 */
function neuVerzahnt(state: AppState, bereich: BereichId, l: BereichLage, ausgesetzt: readonly ClassId[], zurueck?: ClassId): string[] {
  const punkte = [...l.begonnen, ...(l.arbeitsPunkt !== null ? [l.arbeitsPunkt] : [])]
  return webeNeu(l, spurenVon(state, bereich), new Set(ausgesetzt), { punkte, ...(zurueck ? { zurueck: new Set([zurueck]) } : {}) })
}

export function wendeBetriebAn(state: AppState, action: BetriebAenderung & { zeit?: number }): AppState {
  switch (action.type) {
    case 'BETRIEB_BEGINNEN': {
      if (!bereichFest(state, action.bereich) || !programm(state, action.bereich).includes(action.punkt)) return state
      const b = betriebVon(state, action.bereich)
      if (b.begonnen.includes(action.punkt)) return state
      const begonnen = { ...b, begonnen: [...b.begonnen, action.punkt] }
      // Fehlt ein Boot noch und rücken die anderen Klassen vor, gilt das auch im neuen Punkt (V-5).
      if (!b.vorziehen || b.ausgesetzt.length === 0) return mitBereich(state, action.bereich, begonnen)
      const l = lage(mitBereich(state, action.bereich, begonnen), action.bereich)
      const keys = webeNeu(l, spurenVon(state, action.bereich), new Set(b.ausgesetzt), { punkte: [action.punkt] })
      return mitBereich(state, action.bereich, { ...begonnen, reihenfolge: folgeAls(l, keys) })
    }

    case 'BETRIEB_ZEIGEN': {
      const l = lage(state, action.bereich)
      if (!l.fest || (l.aktuell?.key ?? null) !== action.vorher) return state
      const b = betriebVon(state, action.bereich)
      const gezeigt = [...b.gezeigt, { ref: action.ref, zeit: action.zeit ?? 0 }]
      if (l.naechster?.key === action.ref) return mitBereich(state, action.bereich, { ...b, gezeigt })
      // Ein nachzuholender Start (E1) – oder jeder andere nicht erledigte, nicht entfallene (B-5, S-4;
      // BETRIEB_ANNAHMEN.zeigenJederOffene). Er rückt hinter den Zeiger bzw. den Start im Boot: dorthin, wo er gefahren ist.
      const erlaubt = BETRIEB_ANNAHMEN.zeigenJederOffene ? beweglich(l, action.ref) !== null : l.nachzuholen.some((e) => e.key === action.ref)
      if (!erlaubt) return state
      // Ein zurückgestellter Attempt eines Paares (Parallelslalom) holt die späteren zurückgestellten desselben Paares
      // mit – direkt hinter sich: Das Paar ist wieder da. Ebenso jeden Attempt den, der im Plan direkt dahinter steht
      // (Runden nach dem Vorlauf, planPartner): Sonst käme nach einem gezielt gezeigten 1. Attempt erst ein anderes
      // Paar, das in der Folge davor stand (BETRIEB_ANNAHMEN.parallelPaarAlsEinheit). Im Vorlauf bleibt der Plan.
      const ref = l.folge.find((e) => e.key === action.ref)
      const zurueck = b.zurueckgestellt.includes(action.ref)
      const partner = planPartner(l.abgeleitet, action.ref)
      const mit = ref
        ? paarStarts(l, action.ref).filter((e) => e.key !== action.ref && e.lauf > ref.lauf && beweglich(l, e.key) !== null && ((zurueck && b.zurueckgestellt.includes(e.key)) || e.key === partner))
        : []
      const weg = new Set([action.ref, ...mit.map((e) => e.key)])
      return mitBereich(state, action.bereich, {
        ...b,
        gezeigt,
        zurueckgestellt: b.zurueckgestellt.filter((k) => !weg.has(k)),
        reihenfolge: folgeAls(l, hinterDenZeiger(l, [action.ref, ...mit.map((e) => e.key)])),
      })
    }

    case 'BETRIEB_ZURUECKSTELLEN': {
      const l = lage(state, action.bereich)
      const b = betriebVon(state, action.bereich)
      if (!schrittErlaubt(l) || !beweglich(l, action.ref) || b.zurueckgestellt.includes(action.ref)) return state
      // Im Parallelslalom das ganze Paar: auch seine übrigen offenen Attempts dieser Runde (BETRIEB_ANNAHMEN.parallelPaarAlsEinheit).
      const mit = paarStarts(l, action.ref)
        .map((e) => e.key)
        .filter((k) => k === action.ref || (beweglich(l, k) !== null && !b.zurueckgestellt.includes(k)))
      return mitBereich(state, action.bereich, { ...b, zurueckgestellt: [...b.zurueckgestellt, ...mit] })
    }

    case 'BETRIEB_EINREIHEN': {
      const l = lage(state, action.bereich)
      if (!schrittErlaubt(l)) return state
      // Nur was zurückgestellt oder nachzuholen ist – ein zweites Mal geschickt, ist er schon wieder offen.
      if (!l.zurueckgestellt.some((e) => e.key === action.ref) && !l.nachzuholen.some((e) => e.key === action.ref)) return state
      const b = betriebVon(state, action.bereich)
      // Im Parallelslalom kommt das Paar mit: seine zurückgestellten und nachzuholenden Attempts dieser Runde, in
      // der Folge der Attempts (BETRIEB_ANNAHMEN.parallelPaarAlsEinheit). Im Manövrieren nur der Start selbst.
      const wartend = new Set([...l.zurueckgestellt, ...l.nachzuholen].map((e) => e.key))
      const mit = paarStarts(l, action.ref)
        .filter((e) => e.key === action.ref || wartend.has(e.key))
        .sort((x, y) => x.lauf - y.lauf)
        .map((e) => e.key)
      const weg = new Set(mit)
      const keys = action.wo === 'ende' ? ansPunktende(l, mit) : hinterDenZeiger(l, mit)
      return wennAnders(state, action.bereich, b, { ...b, zurueckgestellt: b.zurueckgestellt.filter((k) => !weg.has(k)), reihenfolge: folgeAls(l, keys) })
    }

    case 'BETRIEB_AUSSETZEN': {
      const l = lage(state, action.bereich)
      const b = betriebVon(state, action.bereich)
      if (!umstellenErlaubt(l) || b.ausgesetzt.includes(action.klasse) === action.an) return state
      if (action.an) {
        // Nur eine Klasse, die hier fährt.
        if (!l.folge.some((e) => e.klasse === action.klasse)) return state
        const ausgesetzt = [...b.ausgesetzt, action.klasse]
        const reihenfolge = b.vorziehen ? folgeAls(l, neuVerzahnt(state, action.bereich, l, ausgesetzt)) : b.reihenfolge
        return mitBereich(state, action.bereich, { ...b, ausgesetzt, reihenfolge })
      }
      // Das Boot ist zurück: Der Rest wird mit der Klasse neu verzahnt (V-5), gleich ob vorgezogen wurde.
      const ausgesetzt = b.ausgesetzt.filter((k) => k !== action.klasse)
      const zurueck = lage(mitBereich(state, action.bereich, { ...b, ausgesetzt }), action.bereich)
      return mitBereich(state, action.bereich, { ...b, ausgesetzt, reihenfolge: folgeAls(l, neuVerzahnt(state, action.bereich, zurueck, ausgesetzt, action.klasse)) })
    }

    case 'BETRIEB_VORZIEHEN': {
      const l = lage(state, action.bereich)
      const b = betriebVon(state, action.bereich)
      if (!umstellenErlaubt(l) || b.vorziehen === action.an) return state
      // Einschalten wirkt sofort auf den Rest; Ausschalten lässt die Folge stehen – sonst spränge sie am
      // Steg unter den Händen weg (wie im Prototyp).
      const reihenfolge = action.an && b.ausgesetzt.length > 0 ? folgeAls(l, neuVerzahnt(state, action.bereich, l, b.ausgesetzt)) : b.reihenfolge
      return mitBereich(state, action.bereich, { ...b, vorziehen: action.an, reihenfolge })
    }

    case 'BETRIEB_KLASSE_VOR': {
      const l = lage(state, action.bereich)
      if (!umstellenErlaubt(l)) return state
      const b = betriebVon(state, action.bereich)
      const keys = klasseVor(l, spurenVon(state, action.bereich), new Set(b.ausgesetzt), action.klasse, action.vor)
      return keys ? wennAnders(state, action.bereich, b, { ...b, reihenfolge: folgeAls(l, keys) }) : state
    }

    case 'BETRIEB_VERSCHIEBEN': {
      const l = lage(state, action.bereich)
      if (!umstellenErlaubt(l) || !beweglich(l, action.ref)) return state
      const b = betriebVon(state, action.bereich)
      const keys = verschiebe(l, action.ref, action.ziel, state.anzeige.verzahnungHalten ? spurenVon(state, action.bereich) : null)
      return keys ? wennAnders(state, action.bereich, b, { ...b, reihenfolge: folgeAls(l, keys) }) : state
    }

    case 'BETRIEB_AB': {
      const l = lage(state, action.bereich)
      if (!l.fest) return state
      const e = l.folge.find((x) => x.key === action.ref)
      const ohneAnzeige = einsteigen(l, betriebVon(state, action.bereich).ohneAnzeige, action.ref)
      if (!e || !ohneAnzeige) return state
      const b = betriebVon(state, action.bereich)
      const erledigt = new Set(ohneAnzeige)
      // Die Punkte bis zu seinem sind begonnen; spätere, in denen noch nichts gezeigt wurde, nicht mehr –
      // ein zu später Einstieg gäbe sonst einen Lauf frei, der nicht begonnen hat (S-8).
      const rang = l.programm.indexOf(e.punkt)
      const gezeigtIn = new Set(l.folge.filter((x) => l.gezeigtKeys.has(x.key)).map((x) => x.punkt))
      const begonnen = [...b.begonnen.filter((p) => l.programm.indexOf(p) <= rang || gezeigtIn.has(p)), ...l.programm.slice(0, rang + 1).filter((p) => !b.begonnen.includes(p))]
      const neu = { ...b, ohneAnzeige, begonnen, zurueckgestellt: b.zurueckgestellt.filter((k) => !erledigt.has(k)) }
      // „Weiter mit“ heißt: Der gewählte Start ist der Nächste. Wurde nach einem zu späten Einstieg schon gezeigt,
      // stünde das Gezeigte hinter ihm und überholte ihn (nachzuholen). Dann rücken er und alles, was mit ihm
      // wieder offen ist, in ihrer Folge hinter den Zeiger bzw. den Start im Boot – wie gezielt gezeigt (B-7).
      const n = lage(mitBereich(state, action.bereich, neu), action.bereich)
      const i = n.folge.findIndex((x) => x.key === action.ref)
      const grenze = Math.max(n.zeiger, n.aktuell ? n.folge.findIndex((x) => x.key === n.aktuell!.key) : -1)
      const wieder = i >= 0 && i < grenze ? n.folge.slice(i, grenze).filter((x) => !x.entfaellt && !n.erledigt.has(x.key)).map((x) => x.key) : []
      const reihenfolge = wieder.length > 0 ? folgeAls(n, hinterDenZeiger(n, wieder)) : b.reihenfolge
      return wennAnders(state, action.bereich, b, { ...neu, reihenfolge })
    }

    case 'BETRIEB_ZURUECK': {
      const b = betriebVon(state, action.bereich)
      if (b.gezeigt.at(-1)?.ref !== action.ref) return state
      return mitBereich(state, action.bereich, { ...b, gezeigt: b.gezeigt.slice(0, -1) })
    }

    case 'BETRIEB_MELDUNG': {
      const meldung = meldungWert(action.meldung)
      // „Alle“ setzt in jedem Bereich mit Startern; Löschen trifft jeden, der eine hat.
      const ziele =
        action.bereich === '*'
          ? meldung
            ? bereicheZumStand(state).map((b) => b.id)
            : Object.keys(state.betrieb.bereiche)
          : bereichBekannt(state, action.bereich)
            ? [action.bereich]
            : []
      let next = state
      for (const id of ziele) {
        const b = betriebVon(next, id)
        if (gleich(b.meldung, meldung)) continue
        next = mitBereich(next, id, { ...b, meldung })
      }
      return next
    }

    case 'BETRIEB_ZURUECKSETZEN': {
      if (action.bereich === undefined) return Object.keys(state.betrieb.bereiche).length === 0 ? state : { ...state, betrieb: betriebLeer() }
      if (!Object.hasOwn(state.betrieb.bereiche, action.bereich)) return state
      const { [action.bereich]: _weg, ...rest } = state.betrieb.bereiche
      return { ...state, betrieb: { bereiche: rest } }
    }

    case 'SET_ANZEIGE': {
      const anzeige = normalisiereAnzeige({ ...state.anzeige, ...action.patch }, bereichKennungen(state))
      return gleich(anzeige, state.anzeige) ? state : { ...state, anzeige }
    }
  }
}
