import type { GeraeteTyp } from './transport/protokoll'
import type { AppState, BereichId, ClassId, Meldung, VerschiebeZiel, WkrStatus, WkrZeile } from '../types'
import type { Konfig } from '../config/konfig'
import type { BetriebAenderung } from '../state/reducer/betrieb'
import type { WkrAenderung } from '../state/reducer/wkr'
import { MELDUNG_MAX } from '../state/reducer/betrieb'
import { CLASS_IDS } from '../domain/classes'
import { bereichBekannt, istPunktId } from '../betrieb/folge'
import { istWkrPunkt, OHNE_PUNKT, punktBegonnen } from '../wkr/abschluss'
import { WKR_ANNAHMEN } from '../wkr/annahmen'
import { istTischListe, liesListe, listenDerVeranstaltung, listenKennung, teileVon, type ListenTeil } from '../wkr/liste'
import { pruefeZeile, type ZeilenFehler } from '../wkr/zeile'

/**
 * Aufgaben gekoppelter Geräte und was sie dürfen (Etappe E7, Plan vom 16.11.2026 §5 „Rollen und Rechte“; Vorbild
 * tafel state/permissions.ts, neu geschrieben).
 *
 * Geprüft wird allein am Host (Führungsfenster, geraete/host.ts), nach dem, was im Register des Hosts steht – nie nach
 * dem, was ein Gerät von sich behauptet. {@link darf} ist rein und arbeitet mit einer **Positivliste**: Was hier nicht
 * steht, darf kein Gerät, auch keine Action, die es erst später gibt (Ladeweg, Einstellungen, Eingaben, Gewichte,
 * „Alles zurücksetzen“).
 *
 * Zwei Aufgaben: die Start-Freigabe (Steg b) je Bereich und – seit W1 (21.11.2026, Plan docs/plan-wkr-w1.md §5) – die
 * Erfassung einer WKR-Liste (`liste`, am Steg wahlweise nur ein Teil, F16; höchstens zwei Listen je Gerät, F15).
 * Anzeigetafel und Zuschauer sind keine Aufgabe, sondern Lese-Links (Entscheidung F3 vom 16.11.2026). Die Listen
 * schicken keine Reducer-Actions, sondern eigene Arten ({@link WKR_ACTIONS}); {@link erlaubteWkr} prüft sie Zeile für
 * Zeile gegen den Stand (wkr/zeile.ts) und übersetzt sie. Später kommt `checkin` dazu (Plan der Tafel §5), Knoten und
 * Zeit-Listen am Gerät mit W5.
 *
 * Entscheidung des Nutzers vom 16.11.2026 (F5): Einen entfernten „Poweruser“ gibt es vorerst nicht; die
 * Start-Freigabe darf das Betriebliche ihrer Bereiche – auch Einsteigen, Aussetzen, Verschieben, Meldung –, nur nicht
 * „Betrieb zurücksetzen“. Einstellungen bleiben am Bedienrechner.
 */

export type Aufgabe =
  /** Start-Freigabe (Steg b): BETRIEB_* außer ZURUECKSETZEN, nur in diesen Bereichen (parcoursId bzw. 'parallel'). */
  | { art: 'startfreigabe'; bereiche: BereichId[] }
  /**
   * WKR-Liste erfassen (W1): Listen-Kennung (wkr/liste.ts), am Steg wahlweise nur Ablegen oder Anlegen (F16; ohne
   * `teil` der ganze Steg). Höchstens {@link LISTEN_JE_GERAET} je Gerät (W3-03: Handy eine, Pad zwei nur empfohlen).
   */
  | {
      art: 'liste'
      liste: string
      teil?: ListenTeil
      /**
       * Maskenvorgabe des Bedienrechners (F14, W3 G4, 21.11.2026, bestätigt 21.11.2026): welche Maske das Gerät zeigt.
       * Fehlt = `knoepfe`; W3 kennt nur sie, der Host schickt das Feld erst, wenn es eine zweite Maske gibt (W5/W6).
       */
      maske?: MaskenArtVorgabe
      /** Die Vorgabe gilt fest – das Gerät bietet keinen Wechsel an (F14). */
      fest?: true
    }

/** Masken, die der Bedienrechner vorgeben kann (F14): Knöpfe (W3), Bild (W5), Text (W6). */
export const MASKEN_VORGABEN = ['knoepfe', 'bild', 'text'] as const
export type MaskenArtVorgabe = (typeof MASKEN_VORGABEN)[number]

export type ListenAufgabe = Extract<Aufgabe, { art: 'liste' }>

/**
 * Obergrenze der Listen je Gerät – mehr nimmt der Host nie an. F15 (21.11.2026) hatte 2 (Handy eine, Pad zwei); seit
 * dem Nutzer am 21.11.2026 (W3-03, WKR_ANNAHMEN GF8, noch zu bestätigen) ist „Handy eine, Pad zwei“ nur eine
 * Empfehlung ({@link LISTEN_EMPFEHLUNG}): mehr Listen gehen, auf dem Pad nebeneinander, darüber als Reiter. Vier
 * begrenzt Sicht-Abos und Schlüssel je Gerät (je Liste eine Gruppe).
 */
export const LISTEN_JE_GERAET = 4
/** Empfohlene Listen je Geräteart (W3-03, GF8) – nur ein Hinweis in der Geräteliste, nie eine Grenze. */
export const LISTEN_EMPFEHLUNG: Readonly<Record<GeraeteTyp, number>> = { handy: 1, pad: 2, rechner: 2 }

/**
 * Was die Start-Freigabe darf – die Positivliste. Nicht darin: BETRIEB_ZURUECKSETZEN (räumt den Betrieb eines
 * ganzen Bereichs ab, bleibt am Bedienrechner, F5) und alles außerhalb des Betriebs.
 */
export const STARTFREIGABE_ACTIONS = [
  'BETRIEB_BEGINNEN',
  'BETRIEB_ZEIGEN',
  'BETRIEB_ZURUECK',
  'BETRIEB_MELDUNG',
  'BETRIEB_ZURUECKSTELLEN',
  'BETRIEB_EINREIHEN',
  'BETRIEB_AUSSETZEN',
  'BETRIEB_VORZIEHEN',
  'BETRIEB_KLASSE_VOR',
  'BETRIEB_VERSCHIEBEN',
  'BETRIEB_AB',
  // Parcours-Ampel (Nutzer 21.11.2026, P-03): „Durchs Start-Tor“ gehört zur Start-Freigabe – auch auf dem Handy.
  'BETRIEB_DURCHFAHRT',
  // Bewusst NICHT (Nutzer 26.11.2026, R11-11, BETRIEB_ANNAHMEN.wiederholungNurBedienrechner): „Doch keine Wiederholung“
  // (WIEDERHOLUNG_AUFHEBEN, seit dem Prüfbefund 27.11.2026 ebenfalls eine Action der Erfassung: die verworfenen Werte
  // kommen zurück) – wie das Auslösen (WIEDERHOLUNG_AUSFALL) nur am
  // Bedienrechner. Einreihen und Zeigen der Wiederholung gehen auch vom Handy (EINREIHEN, ZEIGEN).
] as const satisfies readonly BetriebAenderung['type'][]

/**
 * „Anhalten“ des Auto-Modus vom Freigabe-Handy (Nutzer 21.11.2026, P-03; BETRIEB_ANNAHMEN.autoAnhaltenLokal, AM7):
 * eine Geräte-Nachricht der Art `action` mit {bereich, ref}, aber KEINE Reducer-Action und nicht in der Positivliste –
 * der Host (host.ts nimmAn) fängt sie vorher ab und merkt sie sich nur im Arbeitsspeicher.
 */
export const AUTO_HALT = 'BETRIEB_AUTO_HALT'

export type GeraeteBetriebAction = Extract<BetriebAenderung, { type: (typeof STARTFREIGABE_ACTIONS)[number] }>

/** Höchstens so viele Aufgaben und Bereiche je Gerät – mehr kommt nur aus einem kaputten Speicher. */
const HOECHSTENS = 32

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
/** Kennungen (Bereich, Ref): Text in vernünftiger Länge. Refs sind JSON von Starter-IDs und Lauf. */
const istKennung = (v: unknown, max = 512): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const istKlasse = (v: unknown): v is ClassId => typeof v === 'string' && (CLASS_IDS as string[]).includes(v)

/**
 * Aufgaben aus Speicher oder Leitung lesen; Unbekanntes fällt weg (ein Gerät mit neuerer Fassung kennt vielleicht
 * mehr Arten – es bekommt dann eben nur, was dieser Host vergibt). Bereiche doppelt → einmal.
 */
export function liesAufgaben(wert: unknown): Aufgabe[] {
  if (!Array.isArray(wert)) return []
  const aus: Aufgabe[] = []
  const listen = new Set<string>()
  for (const a of wert.slice(0, HOECHSTENS)) {
    if (!istObjekt(a)) continue
    if (a.art === 'startfreigabe' && Array.isArray(a.bereiche)) {
      const bereiche = [...new Set(a.bereiche.filter((b): b is string => istKennung(b, 64)))].slice(0, HOECHSTENS)
      aus.push({ art: 'startfreigabe', bereiche })
    } else if (a.art === 'liste') {
      // Nur lesbare Kennungen, jede Liste einmal, höchstens zwei (F15); ein Teil nur bei geteilten Listen (Steg).
      const liste = liesListe(a.liste)
      if (!liste || listen.has(a.liste as string) || listen.size >= LISTEN_JE_GERAET) continue
      if (a.teil !== undefined && (!teileVon(liste.typeId) || (a.teil !== 'ab' && a.teil !== 'an'))) continue
      const kennung = listenKennung(liste)
      listen.add(kennung)
      const aufgabe: ListenAufgabe = { art: 'liste', liste: kennung }
      if (a.teil !== undefined) aufgabe.teil = a.teil
      // Maskenvorgabe (F14): nur bekannte Werte; `fest` nur als `true` – Fremdes fällt still weg (neuere Fassung).
      if ((MASKEN_VORGABEN as readonly unknown[]).includes(a.maske)) aufgabe.maske = a.maske as MaskenArtVorgabe
      if (a.fest === true) aufgabe.fest = true
      aus.push(aufgabe)
    }
  }
  return aus
}

/** Die Listen-Aufgaben (W1), in ihrer Folge. */
export function listenAufgaben(aufgaben: readonly Aufgabe[]): ListenAufgabe[] {
  return aufgaben.filter((a): a is ListenAufgabe => a.art === 'liste')
}

/** Alle Bereiche, in denen diese Aufgaben die Start-Freigabe erlauben. */
export function freigabeBereiche(aufgaben: readonly Aufgabe[]): BereichId[] {
  return [...new Set(aufgaben.flatMap((a) => (a.art === 'startfreigabe' ? a.bereiche : [])))]
}

function liesMeldung(v: unknown): Meldung | null | undefined {
  if (v === null) return null
  if (!istObjekt(v) || typeof v.text !== 'string' || v.text.length > MELDUNG_MAX) return undefined
  if (v.art !== 'info' && v.art !== 'stoerung' && v.art !== 'pause') return undefined
  return { text: v.text, art: v.art }
}

function liesZiel(v: unknown): VerschiebeZiel | null {
  if (!istObjekt(v)) return null
  const schluessel = Object.keys(v)
  if (schluessel.length !== 1) return null
  if (istKennung(v.vor)) return { vor: v.vor }
  if (istKennung(v.nach)) return { nach: v.nach }
  if (istPunktId(v.vorPunkt)) return { vorPunkt: v.vorPunkt }
  if (istPunktId(v.nachPunkt)) return { nachPunkt: v.nachPunkt }
  return null
}

/**
 * Die Action eines Geräts in sauberer Form – genau die Felder, die der Reducer liest, geprüft nach Typ; alles andere
 * (auch `zeit`, die stempelt das Schreibfenster) fällt weg. `null`: keine Action der Positivliste oder kaputt.
 * Der Reducer prüft Refs und Punkte gegen den Stand ohnehin (bedingt/idempotent, K30) – hier geht es darum, dass kein
 * fremdes Feld und kein falscher Typ bis in den Reducer reicht.
 */
export function bereinige(action: unknown): GeraeteBetriebAction | null {
  if (!istObjekt(action) || typeof action.type !== 'string') return null
  const bereich = action.bereich
  if (!istKennung(bereich, 64)) return null
  switch (action.type) {
    case 'BETRIEB_BEGINNEN':
      return istPunktId(action.punkt) ? { type: action.type, bereich, punkt: action.punkt } : null
    case 'BETRIEB_ZEIGEN':
      if (!istKennung(action.ref) || (action.vorher !== null && !istKennung(action.vorher))) return null
      return { type: action.type, bereich, ref: action.ref, vorher: action.vorher as string | null }
    case 'BETRIEB_ZURUECK':
    case 'BETRIEB_ZURUECKSTELLEN':
    case 'BETRIEB_AB':
      return istKennung(action.ref) ? { type: action.type, bereich, ref: action.ref } : null
    case 'BETRIEB_MELDUNG': {
      // Nie für alle Bereiche ('*'): Die Start-Freigabe eines Bereichs schreibt nicht auf die Tafel der anderen.
      if (bereich === '*') return null
      const meldung = liesMeldung(action.meldung)
      return meldung === undefined ? null : { type: action.type, bereich, meldung }
    }
    case 'BETRIEB_EINREIHEN':
      if (!istKennung(action.ref) || (action.wo !== 'naechster' && action.wo !== 'ende')) return null
      return { type: action.type, bereich, ref: action.ref, wo: action.wo }
    case 'BETRIEB_AUSSETZEN':
      if (!istKlasse(action.klasse) || typeof action.an !== 'boolean') return null
      return { type: action.type, bereich, klasse: action.klasse, an: action.an }
    case 'BETRIEB_VORZIEHEN':
      return typeof action.an === 'boolean' ? { type: action.type, bereich, an: action.an } : null
    case 'BETRIEB_DURCHFAHRT':
      return istKennung(action.ref) && typeof action.an === 'boolean' ? { type: action.type, bereich, ref: action.ref, an: action.an } : null
    case 'BETRIEB_KLASSE_VOR':
      if (!istKlasse(action.klasse) || (action.vor !== null && !istKlasse(action.vor))) return null
      return { type: action.type, bereich, klasse: action.klasse, vor: action.vor as ClassId | null }
    case 'BETRIEB_VERSCHIEBEN': {
      const ziel = liesZiel(action.ziel)
      return istKennung(action.ref) && ziel ? { type: action.type, bereich, ref: action.ref, ziel } : null
    }
    default:
      return null
  }
}

/** Was der Stand für die Prüfung hergibt: welche Bereiche es gibt. */
export type AufgabenStand = Pick<AppState, 'parcoursList' | 'regelwerk'>

/**
 * Prüft die Action eines Geräts gegen seine Aufgaben (aus dem Register des Hosts) und den Stand. Liefert die
 * bereinigte Action ({@link bereinige}) oder `null` = nicht erlaubt. Rein.
 */
export function erlaubteAction(action: unknown, aufgaben: readonly Aufgabe[], stand: AufgabenStand): GeraeteBetriebAction | null {
  // WKR-Arten gehen nie als Reducer-Action durch: Sie brauchen Konfiguration und Gerät und werden übersetzt
  // ({@link erlaubteWkr}). Hier bleibt die Start-Freigabe, wie sie war.
  if (istWkrArt(action)) return null
  const sauber = bereinige(action)
  if (!sauber) return null
  if (!freigabeBereiche(aufgaben).includes(sauber.bereich)) return null
  // Ein Bereich, den es in diesem Stand nicht (mehr) gibt – etwa ein entfernter Parcours –, gilt nicht.
  if (!bereichBekannt(stand, sauber.bereich)) return null
  return sauber
}

/** Darf ein Gerät mit diesen Aufgaben die Action? (Plan §5 `darf`.) */
export function darf(action: unknown, aufgaben: readonly Aufgabe[], stand: AufgabenStand): boolean {
  return erlaubteAction(action, aufgaben, stand) !== null
}

// --- WKR-Listen (W1) ------------------------------------------------------------------------------

/**
 * Was ein WKR-Gerät schicken darf – die Positivliste (Geräte-Arten, keine Reducer-Actions): Zeilen, Status der Liste
 * (pausieren, abmelden, weiter, F1), Abschluss eines Punkts (F7, F8), „So lassen“ an einer Rückfrage (Nutzer
 * 21.11.2026, W3-35: nur der Vermerk, nie die Entscheidung). Modus, Rückfragen, Vorschläge und das Lösen eines
 * Abschlusses bleiben am Bedienrechner.
 */
export const WKR_ACTIONS = ['WKR_ZEILEN', 'WKR_STATUS', 'WKR_ABSCHLUSS', 'WKR_SO_LASSEN'] as const
export type WkrArt = (typeof WKR_ACTIONS)[number]

function istWkrArt(action: unknown): boolean {
  return istObjekt(action) && (WKR_ACTIONS as readonly unknown[]).includes(action.type)
}

/** Eine abgelehnte Zeile: Nummer der Zeile auf dem Gerät (0, wenn unlesbar) und Code. */
export interface WkrAblehnung {
  z: number
  grund: ZeilenFehler
}

/** Ergebnis von {@link erlaubteWkr}: die Reducer-Action (`null`, wenn keine Zeile durchkam) und die Ablehnungen. */
export interface WkrErlaubt {
  action: Extract<WkrAenderung, { type: 'WKR_ZEILEN' | 'WKR_LISTE' | 'WKR_ABSCHLUSS' | 'WKR_SO_LASSEN' }> | null
  abgelehnt: WkrAblehnung[]
}

const STATI: readonly WkrStatus[] = ['aktiv', 'pausiert', 'abgemeldet']
/** Höchstens so viele Prüfsummen in einem Abschluss – mehr Starts hat kein Punkt einer Liste. */
const PRUEFSUMMEN_MAX = 1000

/**
 * Prüft die WKR-Nachricht eines Geräts gegen seine Aufgaben (aus dem Register des Hosts) und den Stand und übersetzt
 * sie in die Reducer-Action. `null` = nicht erlaubt (keine Art der Positivliste, Liste nicht in den Aufgaben, Liste
 * gibt es in dieser Veranstaltung nicht, kaputte Form). Zeilen werden einzeln geprüft (wkr/zeile.ts `pruefeZeile`,
 * mit dem Teil der Aufgabe): Gute gehen weiter, schlechte kommen mit Code in `abgelehnt`. `quelle` kommt aus dem
 * Register (Geräte-ID, Name ≤ WKR_ANNAHMEN.nameMax) – nie aus der Nachricht. Rein.
 */
export function erlaubteWkr(action: unknown, aufgaben: readonly Aufgabe[], stand: AppState, konfig: Konfig, geraet: { id: string; name: string }): WkrErlaubt | null {
  if (!istObjekt(action) || !istWkrArt(action) || typeof action.liste !== 'string') return null
  const aufgabe = listenAufgaben(aufgaben).find((a) => a.liste === action.liste)
  const liste = liesListe(action.liste)
  if (!aufgabe || !liste) return null
  const kennung = listenKennung(liste)
  // Die Liste am Tisch (W5.3) hat keinen Bereich des Betriebs – sie gilt, solange die Veranstaltung sie hat.
  if ((!istTischListe(liste) && !bereichBekannt(stand, liste.bereich)) || !listenDerVeranstaltung(stand, konfig).some((l) => listenKennung(l) === kennung)) return null

  switch (action.type as WkrArt) {
    case 'WKR_ZEILEN': {
      const zeilen = action.zeilen
      if (!Array.isArray(zeilen) || zeilen.length === 0 || zeilen.length > WKR_ANNAHMEN.buendel) return null
      const gut: WkrZeile[] = []
      const abgelehnt: WkrAblehnung[] = []
      for (const z of zeilen) {
        const ergebnis = pruefeZeile(stand, konfig, liste, aufgabe.teil, geraet.id, z)
        if ('fehler' in ergebnis) {
          const nr = istObjekt(z) && typeof z.z === 'number' && Number.isSafeInteger(z.z) && z.z > 0 ? z.z : 0
          abgelehnt.push({ z: nr, grund: ergebnis.fehler })
        } else gut.push(ergebnis)
      }
      const name = geraet.name.trim().slice(0, WKR_ANNAHMEN.nameMax)
      return { action: gut.length > 0 ? { type: 'WKR_ZEILEN', liste: kennung, quelle: { geraet: geraet.id, name }, zeilen: gut } : null, abgelehnt }
    }
    case 'WKR_STATUS': {
      if (!STATI.includes(action.status as WkrStatus)) return null
      // Ein Teil-Gerät am Steg (F16) pausiert bzw. meldet nur seinen Teil ab – das andere erfasst weiter (F1).
      return { action: { type: 'WKR_LISTE', liste: kennung, status: action.status as WkrStatus, ...(aufgabe.teil ? { teil: aufgabe.teil } : {}) }, abgelehnt: [] }
    }
    case 'WKR_ABSCHLUSS': {
      const name = typeof action.name === 'string' ? action.name.trim() : ''
      if (!istWkrPunkt(action.punkt) || name === '' || name.length > WKR_ANNAHMEN.nameMax || typeof action.restPapier !== 'boolean') return null
      // Nur ein Punkt, der im Bereich begonnen hat: Ein künftiger Lauf hätte keine offenen Starts und gälte sonst als
      // abgeschlossen (Prüfbefund 21.11.2026; der Reducer prüft dasselbe). Am Tisch (W5.3, KN5) nur `ohne`.
      if (istTischListe(liste) !== (action.punkt === OHNE_PUNKT)) return null
      if (action.punkt !== OHNE_PUNKT && !punktBegonnen(stand, liste.bereich, action.punkt)) return null
      if (!istObjekt(action.pruefsummen)) return null
      const eintraege = Object.entries(action.pruefsummen)
      if (eintraege.length > PRUEFSUMMEN_MAX || !eintraege.every(([k, v]) => istKennung(k) && typeof v === 'string' && v.length <= 64)) return null
      const pruefsummen: Record<string, string> = {}
      for (const [k, v] of eintraege) pruefsummen[k] = v as string
      return {
        action: { type: 'WKR_ABSCHLUSS', liste: kennung, punkt: action.punkt, name, pruefsummen, restPapier: action.restPapier, ...(aufgabe.teil ? { teil: aufgabe.teil } : {}) },
        abgelehnt: [],
      }
    }
    case 'WKR_SO_LASSEN': {
      // Nur die Nummer der eigenen Zeile – die Geräte-ID kommt aus dem Register, so trifft es nie fremde Rückfragen.
      const z = action.z
      if (typeof z !== 'number' || !Number.isSafeInteger(z) || z < 1) return null
      return { action: { type: 'WKR_SO_LASSEN', liste: kennung, zeile: `${geraet.id}.${z}` }, abgelehnt: [] }
    }
    default:
      return null
  }
}
