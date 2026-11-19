import { isBase64Url } from './ntfy/codec'
import type { Json, Op } from './ntfy/patch'

/**
 * Was zwischen Bedienrechner (Host) und Geräten hin- und hergeht (Plan vom 16.11.2026, §1 und §5; Vorbild
 * tafel transport/protocol.ts, neu geschrieben).
 *
 * Der Host ist die einzige Wahrheit. Geräte bekommen nie den AppState, sondern eine **Sicht** je Gruppe
 * (betrieb/sicht.ts), und schicken nur Nachrichten an den Host – Actions prüft und wendet allein er an.
 *
 * Drei Wege:
 * - **Host → Gruppe** (Thema der Gruppe; `ko` = Anzeigetafel auf oA, `kz` = Zuschauer auf oZ): Vollstand,
 *   Differenz oder Meldung, mit dem Gruppenschlüssel verschlüsselt (secretbox) und vom Host signiert.
 * - **Host → ein Gerät** (d-Thema, beim Koppeln das Koppel-Thema): an den Schlüssel des Geräts (box), signiert.
 * - **Gerät → Host** (g-Thema, beim Koppeln das Koppel-Thema): an den Schlüssel des Hosts (box) – mit
 *   fortlaufender Nummer `nr` je Gerät. Der Host merkt sich die letzte dauerhaft; Doppelte bekommen nur erneut
 *   eine Quittung (Kritik K18, Lücke S2 des Prototyps).
 *
 * Regel „bedingt“ (ab E5 festgeschrieben, Kritik K30): Jede Action eines Geräts ist idempotent oder bedingt
 * (`vorher`, `an` – siehe state/reducer/betrieb.ts). Doppelte Zustellung, die die Nummer nicht abfängt (etwa nach
 * dem Ablauf einer Bearbeitung), ändert so nichts zweimal.
 */

/** Fassung dieses Protokolls; steht (signiert) in jeder Nachricht des Hosts, `v`. */
export const PROTOKOLL_FASSUNG = 1

/**
 * Gruppe der öffentlichen Sicht für die Anzeigetafel (Thema oA; betrieb/sicht.ts sichtOeffentlich ohne Logos). Auch die
 * Start-Freigabe liest sie (E7). Sie wird nie neu verschlüsselt (K14): Ausgehängte Links blieben sonst tot.
 */
export const OEFFENTLICH = 'ko'

/**
 * Gruppe der Zuschauersicht (Thema oZ; sichtZuschauer, schmaler als die öffentliche) – eigener Schlüssel, eigene
 * Nummern, eigene Grundlage der Differenzen (E6, 16.11.2026). So trägt der Zuschauer-Link nur, was die Zuschauerliste
 * zeigt (BETRIEB_ANNAHMEN.zuschauerSchmal), und sein Schlüssel öffnet die Nachrichten der Anzeigetafel nicht. Wie `ko`
 * nie neu verschlüsselt; „Zuschauer-Link erneuern“ wechselt nur das Thema.
 */
export const ZUSCHAUER = 'kz'

/** Die Gruppen der Lese-Links: öffentlich, ohne Kopplung, nie neu verschlüsselt, an kein Gerät gebunden. */
export const OEFFENTLICHE_GRUPPEN: readonly string[] = [OEFFENTLICH, ZUSCHAUER]

export function istOeffentlich(gruppe: string): boolean {
  return OEFFENTLICHE_GRUPPEN.includes(gruppe)
}

/** Steht statt einer Gruppe in Nachrichten an ein einzelnes Gerät. Keine Gruppe kann so heißen. */
export const DIREKT = '-'

/** Gruppen-Kennungen: kurz und ohne Sonderzeichen, damit sie gefahrlos in Signatur und Thema stehen. */
export function istGruppe(wert: unknown): wert is string {
  return typeof wert === 'string' && /^[a-z][a-z0-9]{0,15}$/.test(wert)
}

/** Geräte-IDs: frei vergeben (E7 geraeteName), aber begrenzt. */
export function istGeraetId(wert: unknown): wert is string {
  return typeof wert === 'string' && wert.length > 0 && wert.length <= 64
}

const istZahl = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const istText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Schlüssel einer Gruppe, wie ein gekoppeltes Gerät ihn bekommt – mit den Themen, auf denen sie sendet. */
export interface GruppenSchluessel {
  g: string
  /** secretbox-Schlüssel, 32 Byte Base64url. */
  k: string
  /** Epoche: zählt mit jedem neuen Schlüssel hoch. */
  e: number
  /** Themen, auf denen die Gruppe sendet (öffentlich: oA bzw. oZ). */
  t: string[]
}

export function istGruppenSchluessel(wert: unknown): wert is GruppenSchluessel {
  if (!istObjekt(wert)) return false
  return istGruppe(wert.g) && isBase64Url(wert.k, 32) && istZahl(wert.e) && Array.isArray(wert.t) &&
    wert.t.every((t) => typeof t === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(t))
}

// ---------------------------------------------------------------------------
// Gerät → Host
// ---------------------------------------------------------------------------

/**
 * Eine Action vom Gerät. Welche erlaubt ist, entscheidet am Host `darf()` (E7, geraete/aufgaben.ts, Positivliste);
 * das Protokoll prüft nur die Form. `zeit` fällt hier weg: Die Zeit stempelt das Schreibfenster des Hosts, denn sie
 * geht in den listenStand ein (Plan §5).
 */
export interface GeraeteAction {
  type: string
  [feld: string]: unknown
}

export type GeraeteNachricht =
  /** Anmeldung (E7): Geräte-Code oder QR-Token, Name des Geräts. Kommt meist über ein Koppel-Thema. */
  | { art: 'hallo'; name: string; code: string }
  /** Eine Änderung, die der Host prüft und anwendet. */
  | { art: 'action'; action: GeraeteAction }

/** Was ein Gerät verschlüsselt an den Host schickt. */
export interface GeraeteKlartext {
  /** Geräte-ID (vor dem Koppeln die vorgeschlagene). */
  id: string
  /** Fortlaufend je Gerät, ab 1; eine Wiederholung trägt dieselbe Nummer. */
  nr: number
  nachricht: GeraeteNachricht
}

/** Prüft und bereinigt eine Nachricht eines Geräts. `null`, wenn sie nicht ins Protokoll passt. */
export function liesGeraeteNachricht(wert: unknown): GeraeteNachricht | null {
  if (!istObjekt(wert)) return null
  if (wert.art === 'hallo') {
    if (!istText(wert.name, 60) || !istText(wert.code, 200)) return null
    return { art: 'hallo', name: wert.name, code: wert.code }
  }
  if (wert.art === 'action') {
    const action = wert.action
    if (!istObjekt(action) || typeof action.type !== 'string' || action.type.length > 64) return null
    const ohneZeit: GeraeteAction = { ...action, type: action.type }
    delete ohneZeit.zeit
    return { art: 'action', action: ohneZeit }
  }
  return null
}

export function liesGeraeteKlartext(wert: unknown): GeraeteKlartext | null {
  if (!istObjekt(wert) || !istGeraetId(wert.id) || !istZahl(wert.nr) || wert.nr < 1) return null
  const nachricht = liesGeraeteNachricht(wert.nachricht)
  return nachricht ? { id: wert.id, nr: wert.nr, nachricht } : null
}

// ---------------------------------------------------------------------------
// Host → ein Gerät
// ---------------------------------------------------------------------------

/** Gründe einer Ablehnung – Codes, die das Gerät übersetzt (nie Text auf der Leitung). */
export const ABLEHNUNGEN = ['code-ungueltig', 'code-abgelaufen', 'id-belegt', 'fassung', 'nicht-erlaubt', 'konflikt'] as const
export type Ablehnung = (typeof ABLEHNUNGEN)[number]

/** Ausgang einer Geräte-Action am Host: angewandt, ohne Wirkung (bedingt), abgelehnt, oder schon einmal da. */
export const ERGEBNISSE = ['angewandt', 'unveraendert', 'abgelehnt', 'doppelt'] as const
export type Ergebnis = (typeof ERGEBNISSE)[number]

export type DirektNachricht =
  /**
   * Das Gerät ist gekoppelt: seine (ggf. neu vergebene) ID, seine Themen g und d, die Schlüssel seiner Gruppen und
   * seine Aufgaben (E7, geraete/aufgaben.ts). `auf` = Nummer der Anmeldung.
   */
  | { art: 'willkommen'; auf: number; id: string; themen: { g: string; d: string }; gruppen: GruppenSchluessel[]; aufgaben: unknown[] }
  | { art: 'abgelehnt'; auf: number; grund: Ablehnung }
  /** Bestätigt die Nachricht `auf`; erst dann schickt das Gerät die nächste. */
  | { art: 'quittung'; auf: number; ergebnis: Ergebnis; grund?: Ablehnung }
  /** Neue Schlüssel nach einem Wechsel (Entzug eines anderen Geräts) – nie für `ko` und `kz`. */
  | { art: 'schluessel'; gruppen: GruppenSchluessel[] }
  /** Geänderte Rechte, wirken sofort (Lastenheft der Tafel P-6). */
  | { art: 'aufgaben'; aufgaben: unknown[] }
  /** Das Gerät ist entzogen: Es liest Öffentliches weiter, bewirkt aber nichts mehr (K14). */
  | { art: 'entzogen' }

export function liesDirektNachricht(wert: unknown): DirektNachricht | null {
  if (!istObjekt(wert)) return null
  switch (wert.art) {
    case 'willkommen': {
      const themen = wert.themen
      if (!istZahl(wert.auf) || !istGeraetId(wert.id) || !istObjekt(themen)) return null
      if (typeof themen.g !== 'string' || typeof themen.d !== 'string') return null
      if (!Array.isArray(wert.gruppen) || !wert.gruppen.every(istGruppenSchluessel) || !Array.isArray(wert.aufgaben)) return null
      return { art: 'willkommen', auf: wert.auf, id: wert.id, themen: { g: themen.g, d: themen.d }, gruppen: wert.gruppen, aufgaben: wert.aufgaben }
    }
    case 'abgelehnt':
      if (!istZahl(wert.auf) || !(ABLEHNUNGEN as readonly unknown[]).includes(wert.grund)) return null
      return { art: 'abgelehnt', auf: wert.auf, grund: wert.grund as Ablehnung }
    case 'quittung': {
      if (!istZahl(wert.auf) || !(ERGEBNISSE as readonly unknown[]).includes(wert.ergebnis)) return null
      if (wert.grund !== undefined && !(ABLEHNUNGEN as readonly unknown[]).includes(wert.grund)) return null
      const q: DirektNachricht = { art: 'quittung', auf: wert.auf, ergebnis: wert.ergebnis as Ergebnis }
      if (wert.grund !== undefined) q.grund = wert.grund as Ablehnung
      return q
    }
    case 'schluessel':
      if (!Array.isArray(wert.gruppen) || !wert.gruppen.every(istGruppenSchluessel)) return null
      return { art: 'schluessel', gruppen: wert.gruppen }
    case 'aufgaben':
      return Array.isArray(wert.aufgaben) ? { art: 'aufgaben', aufgaben: wert.aufgaben } : null
    case 'entzogen':
      return { art: 'entzogen' }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Host → Gruppe
// ---------------------------------------------------------------------------

/** Meldungen an eine ganze Gruppe: Raum beendet (Gerät löscht seine Sicht, K20) oder neu laden (E8). */
export type GruppenMeldung = { art: 'ende' } | { art: 'neu-laden' }

/** Eine Differenz gegenüber dem Stand mit Nummer `base`; `h` = Fingerabdruck des Ergebnisses. */
export interface SichtPatch {
  base: number
  ops: Op[]
  h: string
}

export type GruppenInhalt = { voll: Json } | { patch: SichtPatch } | { meldung: GruppenMeldung }

/** Art einer Nachricht des Hosts, steht signiert im Klartext: Vollstand, Differenz, Meldung, direkt. */
export type NachrichtArt = 'v' | 'p' | 'm' | 'd'

export function liesGruppenInhalt(wert: unknown, art: NachrichtArt): GruppenInhalt | null {
  if (!istObjekt(wert)) return null
  if (art === 'v') return 'voll' in wert && wert.voll !== undefined ? { voll: wert.voll as Json } : null
  if (art === 'p') {
    const p = wert.patch
    if (!istObjekt(p) || !istZahl(p.base) || !Array.isArray(p.ops) || typeof p.h !== 'string') return null
    return { patch: { base: p.base, ops: p.ops as Op[], h: p.h } }
  }
  if (art === 'm') {
    const m = wert.meldung
    if (!istObjekt(m) || (m.art !== 'ende' && m.art !== 'neu-laden')) return null
    return { meldung: { art: m.art } }
  }
  return null
}
