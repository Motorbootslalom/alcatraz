// Listen und Druck: WKR-Bögen (Leerzeilen, Seiten, Rückseite, Sprache, Namen, Besetzung), Beschriftung, Laufzettel, Herkunft, Zebra,
// Logos.

import type { AppState, ClassId, LaufzettelLayout, LogoBild, LogoSeite, Sprache, WkrGemeinsamFolge } from '../../types'
import { setzeName, setzeSprache, type WkrZelle } from '../../lib/einteilung'
import { setzeBesetzung } from '../../lib/besetzung'
import { beschriftungOf } from '../../config/catalog'
import { LOGO_HOEHE_VORGABE_MM, logoHoeheZahl, logoWert } from '../../lib/logo'

export type ListenAenderung =
  | { type: 'SET_LIST_OPTIONS'; patch: Partial<Pick<AppState, 'showBirthdate' | 'listOrigin'>> }
  /** Eigenes Kürzel zu einem Namen setzen; ein leeres Kürzel entfernt den Eintrag (dann gilt wieder die Vorgabe). */
  | { type: 'SET_ORIGIN_SHORT'; name: string; short: string }
  /**
   * Name des Wettkampfrichters an einer Liste auf einem Parcours; ein leerer Name entfernt
   * den Eintrag. Je Feld eine Action (nicht die ganze Einteilung), damit zwei Geräte, die
   * verschiedene Felder ausfüllen, einander nichts überschreiben.
   */
  | { type: 'SET_WKR_NAME'; parcoursId: string; typeId: string; name: string }
  /** Boot bzw. Co-Pilot einer Klasse (Block „Besetzung“); ein leerer Text entfernt die Angabe. */
  | { type: 'SET_BOOT'; klasse: ClassId; text: string }
  | { type: 'SET_CO_PILOT'; klasse: ClassId; text: string }
  /**
   * Leerzeilen der Wettkampfrichter-Listen: allgemein (`klasse` fehlt) oder für eine Klasse;
   * `null` = wieder die allgemeine Zahl bzw. die Vorgabe. `alleKlassen` verwirft dabei die
   * abweichenden Zahlen einzelner Klassen.
   */
  | { type: 'SET_WKR_LEERZEILEN'; klasse?: ClassId; anzahl: number | null; alleKlassen?: boolean }
  | { type: 'SET_WKR_RUECKSEITE'; rueckseite: boolean }
  | { type: 'SET_WKR_CLUB_GEMEINSAM'; gemeinsam: boolean }
  /** Folge der Klassen auf gemeinsamen Bögen (Clubmeisterschaft, 24.11.2026): Blöcke oder Startfolge der Verzahnung. */
  | { type: 'SET_WKR_GEMEINSAM_FOLGE'; folge: WkrGemeinsamFolge }
  /**
   * Seitenaufteilung der Wettkampfrichter-Listen: Starter je Seite (0 oder unbrauchbar =
   * automatisch) und „Teilen ab“ (0 = immer). Nur was im Patch steht, ändert sich.
   */
  | { type: 'SET_WKR_SEITEN'; patch: { zeilenJeSeite?: number | null; teilenAb?: number | null } }
  /** Bezeichnung der Bojen-Seiten auf den Listen; eine unbekannte Kennung gilt als Vorgabe. */
  | { type: 'SET_BESCHRIFTUNG'; beschriftung: string }
  /**
   * Sprache der Wettkampfrichter-Bögen für die genannten Zellen der Einteilung – je Parcours
   * (bzw. Racecourse) und Liste: eine Zelle oder „alle auf …“; `null` = wieder die Sprache des
   * Regelwerks.
   */
  | { type: 'SET_WKR_SPRACHE'; zellen: readonly WkrZelle[]; sprache: Sprache | null }
  /** Leerzeilen je Seite auf gemeinsamen Bögen (Clubmeisterschaft, Papier sparen); `null` = Vorgabe. */
  | { type: 'SET_WKR_LEERZEILEN_SEITE'; anzahl: number | null }
  | { type: 'SET_LAUFZETTEL_LAYOUT'; layout: LaufzettelLayout }
  | { type: 'SET_PARALLEL_ZEBRA'; zebra: boolean }
  /**
   * Logo links oder rechts im Kopf der gedruckten Listen (Entscheidung des Nutzers vom 16.11.2026); das
   * fertige, verkleinerte Bild samt Pixelmaßen kommt mit der Action (lib/logoBild.ts). `null` = entfernen.
   * Unbrauchbares (lib/logo.ts `logoWert`) ändert nichts – die Oberfläche prüft vorher.
   */
  | { type: 'SET_LOGO'; seite: LogoSeite; logo: LogoBild | null }
  /** Höhe der Logos in mm (8 bis 30); `null` = Vorgabe. */
  | { type: 'SET_LOGO_HOEHE'; mm: number | null }

/** Leerzeilen je Klasse auf den Wettkampfrichter-Listen: Vorgabe wie im Prototyp (`emptyRows: 3`). */
export const WKR_LEERZEILEN_VORGABE = 3
/** Bei der Clubmeisterschaft eine: Dort stehen viele Klassen auf einem Blatt. */
export const WKR_LEERZEILEN_CLUB = 1
/**
 * Gemeinsame Bögen (Clubmeisterschaft, Papier sparen): drei je Seite. Die Zeilen teilen sich
 * alle Klassen der Seite – drei reichen für die Nachmeldungen eines Blatts mit rund 20 Zeilen
 * und kosten weniger als bisher eine je Klasse, sobald mehr als drei Klassen darauf stehen.
 */
export const WKR_LEERZEILEN_SEITE_VORGABE = 3
export const WKR_LEERZEILEN_MAX = 30

/** Eine brauchbare Zahl von Leerzeilen (0 bis 30, ganz); sonst `undefined`. */
export function leerzeilenZahl(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(WKR_LEERZEILEN_MAX, Math.round(n))) : undefined
}

/** Fest eingestellt stehen mindestens so viele Starter auf einer Seite (wie im Prototyp). */
export const WKR_ZEILEN_JE_SEITE_MIN = 5
export const WKR_ZEILEN_JE_SEITE_MAX = 100
export const WKR_TEILEN_AB_MAX = 200

/** Starter je Seite: 0 = automatisch, sonst 5 bis 100; Unbrauchbares ist automatisch. */
export function zeilenJeSeiteZahl(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || Math.round(n) <= 0) return 0
  return Math.max(WKR_ZEILEN_JE_SEITE_MIN, Math.min(WKR_ZEILEN_JE_SEITE_MAX, Math.round(n)))
}

/** „Teilen ab“: 0 = immer, sonst bis 200; Unbrauchbares ist 0. */
export function teilenAbZahl(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(WKR_TEILEN_AB_MAX, Math.round(n))) : 0
}

/** Eine gültige Folge der Klassen auf gemeinsamen Bögen; sonst die Vorgabe „getrennt“ (das Verhalten vor dem 24.11.2026). */
export function gemeinsamFolgeWert(x: unknown): WkrGemeinsamFolge {
  return x === 'verzahnung' ? 'verzahnung' : 'getrennt'
}

/** Eine gültige Form der Laufzettel; sonst die Vorgabe „eine Zeile je Seite“. */
export function laufzettelLayoutWert(x: unknown): LaufzettelLayout {
  return x === 'liste' ? 'liste' : 'seite'
}

export function wendeListenAn(state: AppState, action: ListenAenderung): AppState {
  switch (action.type) {
    case 'SET_LAUFZETTEL_LAYOUT':
      return { ...state, laufzettelLayout: laufzettelLayoutWert(action.layout) }

    case 'SET_LIST_OPTIONS':
      return { ...state, ...action.patch }

    case 'SET_WKR_LEERZEILEN': {
      if (action.klasse === undefined) {
        const anzahl = leerzeilenZahl(action.anzahl) ?? WKR_LEERZEILEN_VORGABE
        // Was danach nicht mehr abweicht, ist keine eigene Angabe mehr.
        const eigene = action.alleKlassen ? {} : Object.fromEntries(Object.entries(state.wkrLeerzeilenKlasse).filter(([, n]) => n !== anzahl))
        return { ...state, wkrLeerzeilen: anzahl, wkrLeerzeilenKlasse: eigene }
      }
      const { [action.klasse]: _alt, ...rest } = state.wkrLeerzeilenKlasse
      const anzahl = leerzeilenZahl(action.anzahl)
      return {
        ...state,
        wkrLeerzeilenKlasse: anzahl === undefined || anzahl === state.wkrLeerzeilen ? rest : { ...rest, [action.klasse]: anzahl },
      }
    }

    case 'SET_WKR_RUECKSEITE':
      return { ...state, wkrRueckseite: action.rueckseite }

    case 'SET_WKR_CLUB_GEMEINSAM':
      return { ...state, wkrClubGemeinsam: action.gemeinsam }

    case 'SET_WKR_GEMEINSAM_FOLGE': {
      const folge = gemeinsamFolgeWert(action.folge)
      return folge === state.wkrGemeinsamFolge ? state : { ...state, wkrGemeinsamFolge: folge }
    }

    case 'SET_WKR_SEITEN': {
      const { zeilenJeSeite, teilenAb } = action.patch
      const wkrZeilenJeSeite = zeilenJeSeite === undefined ? state.wkrZeilenJeSeite : zeilenJeSeiteZahl(zeilenJeSeite)
      const wkrTeilenAb = teilenAb === undefined ? state.wkrTeilenAb : teilenAbZahl(teilenAb)
      // „Teilen ab“ bleibt stehen, wenn auf automatisch gestellt wird: Es wirkt dann nicht und
      // gilt wieder, sobald eine feste Zahl gewählt ist.
      return wkrZeilenJeSeite === state.wkrZeilenJeSeite && wkrTeilenAb === state.wkrTeilenAb ? state : { ...state, wkrZeilenJeSeite, wkrTeilenAb }
    }

    case 'SET_BESCHRIFTUNG':
      return { ...state, beschriftung: beschriftungOf(action.beschriftung) }

    case 'SET_WKR_SPRACHE': {
      const wkrSprachen = setzeSprache(state.wkrSprachen, action.zellen, action.sprache)
      return wkrSprachen === state.wkrSprachen ? state : { ...state, wkrSprachen }
    }

    case 'SET_WKR_LEERZEILEN_SEITE':
      return { ...state, wkrLeerzeilenSeite: leerzeilenZahl(action.anzahl) ?? WKR_LEERZEILEN_SEITE_VORGABE }

    case 'SET_ORIGIN_SHORT': {
      const { [action.name]: _old, ...rest } = state.originShort
      const short = action.short.trim()
      return { ...state, originShort: short ? { ...rest, [action.name]: short } : rest }
    }

    case 'SET_WKR_NAME':
      return { ...state, einteilung: setzeName(state.einteilung, action.parcoursId, action.typeId, action.name) }

    case 'SET_BOOT':
      return { ...state, boote: setzeBesetzung(state.boote, action.klasse, action.text) }

    case 'SET_CO_PILOT':
      return { ...state, coPiloten: setzeBesetzung(state.coPiloten, action.klasse, action.text) }

    case 'SET_PARALLEL_ZEBRA':
      return action.zebra === state.parallelZebra ? state : { ...state, parallelZebra: action.zebra === true }

    case 'SET_LOGO': {
      if (action.seite !== 'links' && action.seite !== 'rechts') return state
      const alt = state.logos[action.seite]
      if (action.logo === null) return alt === null ? state : { ...state, logos: { ...state.logos, [action.seite]: null } }
      // Zweites Netz hinter der Oberfläche: Nur ein geprüftes Bild kommt in den Stand (und damit in
      // Sicherung, Vorlage und jeden Verlaufseintrag). Dasselbe Bild noch einmal ändert nichts.
      const neu = logoWert(action.logo)
      if (!neu || (alt && alt.src === neu.src && alt.breite === neu.breite && alt.hoehe === neu.hoehe)) return state
      return { ...state, logos: { ...state.logos, [action.seite]: neu } }
    }

    case 'SET_LOGO_HOEHE': {
      const mm = action.mm === null ? LOGO_HOEHE_VORGABE_MM : logoHoeheZahl(action.mm)
      return mm === state.logoHoeheMm ? state : { ...state, logoHoeheMm: mm }
    }
  }
}
