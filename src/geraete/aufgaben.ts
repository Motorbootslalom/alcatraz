import type { AppState, BereichId, ClassId, Meldung, VerschiebeZiel } from '../types'
import type { BetriebAenderung } from '../state/reducer/betrieb'
import { MELDUNG_MAX } from '../state/reducer/betrieb'
import { CLASS_IDS } from '../domain/classes'
import { bereichBekannt, istPunktId } from '../betrieb/folge'

/**
 * Aufgaben gekoppelter Geräte und was sie dürfen (Etappe E7, Plan vom 16.11.2026 §5 „Rollen und Rechte“; Vorbild
 * tafel state/permissions.ts, neu geschrieben).
 *
 * Geprüft wird allein am Host (Führungsfenster, geraete/host.ts), nach dem, was im Register des Hosts steht – nie nach
 * dem, was ein Gerät von sich behauptet. {@link darf} ist rein und arbeitet mit einer **Positivliste**: Was hier nicht
 * steht, darf kein Gerät, auch keine Action, die es erst später gibt (Ladeweg, Einstellungen, Eingaben, Gewichte,
 * „Alles zurücksetzen“).
 *
 * Heute gibt es eine Aufgabe, die Start-Freigabe (Steg b) je Bereich. Anzeigetafel und Zuschauer sind keine Aufgabe,
 * sondern Lese-Links (Entscheidung F3 vom 16.11.2026). Später kommen ohne Umbau `liste` (WKR, Steg a, Vorsteg, Knoten)
 * und `checkin` dazu (Plan §5); dann prüft {@link darf} auch Zellen von SET_EINGABEN gegen den Stand.
 *
 * Entscheidung des Nutzers vom 16.11.2026 (F5): Einen entfernten „Poweruser“ gibt es vorerst nicht; die
 * Start-Freigabe darf das Betriebliche ihrer Bereiche – auch Einsteigen, Aussetzen, Verschieben, Meldung –, nur nicht
 * „Betrieb zurücksetzen“. Einstellungen bleiben am Bedienrechner.
 */

export type Aufgabe =
  /** Start-Freigabe (Steg b): BETRIEB_* außer ZURUECKSETZEN, nur in diesen Bereichen (parcoursId bzw. 'parallel'). */
  { art: 'startfreigabe'; bereiche: BereichId[] }

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
] as const satisfies readonly BetriebAenderung['type'][]

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
  for (const a of wert.slice(0, HOECHSTENS)) {
    if (!istObjekt(a) || a.art !== 'startfreigabe' || !Array.isArray(a.bereiche)) continue
    const bereiche = [...new Set(a.bereiche.filter((b): b is string => istKennung(b, 64)))].slice(0, HOECHSTENS)
    aus.push({ art: 'startfreigabe', bereiche })
  }
  return aus
}

/** Alle Bereiche, in denen diese Aufgaben die Start-Freigabe erlauben. */
export function freigabeBereiche(aufgaben: readonly Aufgabe[]): BereichId[] {
  return [...new Set(aufgaben.filter((a) => a.art === 'startfreigabe').flatMap((a) => a.bereiche))]
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
