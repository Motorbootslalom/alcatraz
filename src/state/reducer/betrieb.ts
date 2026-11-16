// Betrieb am Wettkampftag (Anzeigetafel, Start-Freigabe) und die Einstellungen der Anzeigetafel;
// Normalisierer für migrate(). Plan zur Übernahme der Tafel vom 16.11.2026, §3.
//
// Jede Action ist bedingt bzw. idempotent: Doppelte Zustellung, ein Doppelklick oder ein veraltetes
// Gerät verdrehen nichts. Unverändert = derselbe Stand. Die Zeit kommt mit der Action (der Store
// setzt sie), Kennungen sind Refs (betrieb/folge.ts `refKey`), keine Zufalls-IDs. Der Betrieb schreibt
// nie in `eingaben` und ändert keine Wertungsliste (BETRIEB_ANNAHMEN.keinXVonDerTafel).

import type { AnzeigeEinstellungen, AnzeigeNamen, AnzeigeSprache, AppState, BereichBetrieb, BereichId, Betrieb, ClassId, GezeigterStart, Meldung, MeldungArt, PunktId } from '../../types'
import { CLASS_IDS } from '../../domain/classes'
import { istOriginStyle } from '../../lib/origin'
import { BETRIEB_ANNAHMEN } from '../../betrieb/annahmen'
import { bereichBekannt, bereicheZumStand, bereichFest, bereichLeer, betriebVon, istPunktId, lage, liesRef, PARALLEL_BEREICH, programm } from '../../betrieb/folge'

export type BetriebAenderung =
  /** Einen Punkt (Lauf) beginnen – nur mit festgeschriebener Verzahnung und nur, wenn er im Programm steht. */
  | { type: 'BETRIEB_BEGINNEN'; bereich: BereichId; punkt: PunktId }
  /**
   * Einen Start auf die Anzeigetafel bringen („Nächster Start“). Wirkt nur, wenn gerade `vorher`
   * (Kennung, `null` = noch keiner) steht – ein Doppelklick oder eine doppelte Zustellung schaltet
   * nicht zweimal. E1: `ref` ist der Nächste oder ein nachzuholender Start.
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

/** Längste Meldung in Zeichen: Mehr ist auf der Tafel aus der Entfernung nicht zu lesen. */
export const MELDUNG_MAX = 200
/** Längste Kopfzeile in Zeichen. */
export const KOPFZEILE_MAX = 120
export const SKALA_MIN = 0.7
export const SKALA_MAX = 1.3
/** Höchstens so viele Starts „am Steg“ bzw. „vor Steg“. */
export const STEG_MAX = 10
/** Grenzen eines eigenen Startabstands in Sekunden (E3; wie die Prüfung der Vorgaben im YAML). */
export const ABSTAND_MIN = 30
export const ABSTAND_MAX = 600

const MELDUNG_ARTEN: readonly MeldungArt[] = ['info', 'stoerung', 'pause']
const NAMEN: readonly AnzeigeNamen[] = ['aushang', 'voll', 'kurz', 'ohne']
const SPRACHEN: readonly AnzeigeSprache[] = ['regelwerk', 'de', 'en']

/**
 * Vorgaben der Anzeigetafel. Davor und Parcours-Name an (wie der Tafel-Prototyp), Größe 1;
 * Namen, Herkunft und Sprache nach BETRIEB_ANNAHMEN; 2 am Steg, 2 vor Steg (docs/stand.md: 1 im
 * Boot, 2 am Steg, 2 vor Steg); Verzahnung beim Verschieben halten (V-7).
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
    reihenfolge: Array.isArray(b.reihenfolge) ? refListe(b.reihenfolge) : null,
    ausgesetzt: Array.isArray(b.ausgesetzt) ? eindeutig(b.ausgesetzt.filter((k): k is ClassId => CLASS_IDS.includes(k as ClassId))) : [],
    vorziehen: b.vorziehen === true,
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

/** Die Bereiche, die ein Stand kennen kann: seine Parcours und der Parallelslalom (ab E4). */
export function bereichKennungen(stand: Pick<AppState, 'parcoursList'>): string[] {
  return [...stand.parcoursList.map((p) => p.id), PARALLEL_BEREICH]
}

function mitBereich(state: AppState, bereich: BereichId, b: BereichBetrieb): AppState {
  return { ...state, betrieb: { bereiche: { ...state.betrieb.bereiche, [bereich]: b } } }
}

const gleich = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function wendeBetriebAn(state: AppState, action: BetriebAenderung & { zeit?: number }): AppState {
  switch (action.type) {
    case 'BETRIEB_BEGINNEN': {
      if (!bereichFest(state, action.bereich) || !programm(state, action.bereich).includes(action.punkt)) return state
      const b = betriebVon(state, action.bereich)
      if (b.begonnen.includes(action.punkt)) return state
      return mitBereich(state, action.bereich, { ...b, begonnen: [...b.begonnen, action.punkt] })
    }

    case 'BETRIEB_ZEIGEN': {
      const l = lage(state, action.bereich)
      if (!l.fest || (l.aktuell?.key ?? null) !== action.vorher) return state
      // E1: der Nächste oder ein nachzuholender Start – nie ein schon erledigter, nie einer ohne Freigabe.
      if (l.naechster?.key !== action.ref && !l.nachzuholen.some((e) => e.key === action.ref)) return state
      const b = betriebVon(state, action.bereich)
      return mitBereich(state, action.bereich, { ...b, gezeigt: [...b.gezeigt, { ref: action.ref, zeit: action.zeit ?? 0 }] })
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
