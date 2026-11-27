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

/**
 * Fassung dieses Protokolls; steht (signiert) in jeder Nachricht des Hosts, `v`.
 *
 * 2 (W1, 21.11.2026, Antwort F11): digitale WKR-Erfassung. Neu sind `lebenszeichen` und `gesehen`, die Ablehnungen
 * der Zeilen und – bewusst – eine Ausnahme von „keine Werte auf der Leitung“: Werte gehen NUR vom Gerät an den Host
 * (Thema g, an den Box-Schlüssel des Hosts) und als `steht` einer Rückfrage in der Sicht der Liste (deren
 * verschlüsselte Gruppe, wkr/sicht.ts) – lesbar für jedes Gerät DERSELBEN Liste, am Steg auch für das des anderen
 * Teils (WKR_ANNAHMEN.rueckfrageInListe, Prüfbefund 21.11.2026). Die öffentlichen Gruppen `ko`/`kz` bleiben wertfrei.
 * Fassung 1 und 2 verstehen einander nicht (Geräte melden „Fassung“, F7).
 */
export const PROTOKOLL_FASSUNG = 2

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

/**
 * Grobe Art des Geräts, wie es sie beim Koppeln meldet (Nutzer 21.11.2026, W3-25, WKR_ANNAHMEN GF7): für den Hinweis,
 * wie viele Listen passen (W3-03), und die Geräteliste – am Bedienrechner änderbar. Steht hier (nicht in
 * geraeteName.ts), weil Protokoll und Raum sie prüfen.
 */
export const GERAETE_TYPEN = ['handy', 'pad', 'rechner'] as const
export type GeraeteTyp = (typeof GERAETE_TYPEN)[number]
export const istGeraeteTyp = (v: unknown): v is GeraeteTyp => (GERAETE_TYPEN as readonly unknown[]).includes(v)

export type GeraeteNachricht =
  /**
   * Anmeldung (E7): Geräte-Code oder QR-Token, Name des Geräts. Kommt meist über ein Koppel-Thema. `typ` seit
   * 21.11.2026 (W3-25): freiwillig – ein Host ohne das Feld liest die Anmeldung weiter, darum keine neue Fassung.
   */
  | { art: 'hallo'; name: string; code: string; typ?: GeraeteTyp }
  /** Eine Änderung, die der Host prüft und anwendet (W1: auch die WKR-Arten, geraete/aufgaben.ts WKR_ACTIONS). */
  | { art: 'action'; action: GeraeteAction }
  /**
   * W1: Das Gerät lebt, obwohl es nichts schickt (nur nach Stille, wkr/annahmen.ts). `wartend` = Zeilen, die es noch
   * nicht losgeworden ist; `akku` in Prozent, wenn der Browser es verrät. Nur für die Bedieneransicht (W2).
   * `namen` seit 21.11.2026 (Nutzer W3-13, WKR_ANNAHMEN WN2): je eigener Liste (Kennung) der auf dem Gerät geänderte
   * WKR-Name – nur Änderungen gegenüber der Einteilung; fehlt = altes Gerät, `{}` = keine. Freiwillig, darum keine
   * neue Fassung (ein Host ohne das Feld liest das Lebenszeichen weiter).
   */
  | { art: 'lebenszeichen'; wartend: number; akku?: number; namen?: Record<string, string> }
  /** W1: Ein Hinweis des Bedienrechners (Sicht der Liste, `hinweise[].id`) ist gelesen – er verschwindet. */
  | { art: 'gesehen'; hinweis: number }

/** Was ein Gerät verschlüsselt an den Host schickt. */
export interface GeraeteKlartext {
  /** Geräte-ID (vor dem Koppeln die vorgeschlagene). */
  id: string
  /** Fortlaufend je Gerät, ab 1; eine Wiederholung trägt dieselbe Nummer. */
  nr: number
  nachricht: GeraeteNachricht
}

/** Höchstens so viele Listen-Namen in einem Lebenszeichen (ein Gerät hat höchstens vier Listen, GF8). */
export const WKR_NAMEN_MAX = 8
/** Wie WKR_ANNAHMEN.nameMax (der Transport bleibt ohne Fachlogik); Listen-Kennungen sind kurz. */
const WKR_NAME_LAENGE = 60
const LISTEN_KENNUNG_LAENGE = 200

/**
 * WKR-Namen je Liste aus einem Lebenszeichen (WN2): nur Texte, nicht leer, ≤ 60 Zeichen, höchstens
 * {@link WKR_NAMEN_MAX}. `undefined`, wenn das Feld fehlt oder kein Objekt ist.
 */
export function liesWkrNamen(wert: unknown): Record<string, string> | undefined {
  if (!istObjekt(wert)) return undefined
  const out: Record<string, string> = {}
  for (const [liste, name] of Object.entries(wert).slice(0, WKR_NAMEN_MAX)) {
    if (liste === '__proto__' || liste.length > LISTEN_KENNUNG_LAENGE || typeof name !== 'string') continue
    const sauber = name.trim()
    if (sauber !== '' && sauber.length <= WKR_NAME_LAENGE) out[liste] = sauber
  }
  return out
}

/** Prüft und bereinigt eine Nachricht eines Geräts. `null`, wenn sie nicht ins Protokoll passt. */
export function liesGeraeteNachricht(wert: unknown): GeraeteNachricht | null {
  if (!istObjekt(wert)) return null
  if (wert.art === 'hallo') {
    if (!istText(wert.name, 60) || !istText(wert.code, 200)) return null
    // Eine unbekannte Art fällt weg (Feld für Feld) – die Anmeldung selbst gilt weiter.
    return { art: 'hallo', name: wert.name, code: wert.code, ...(istGeraeteTyp(wert.typ) ? { typ: wert.typ } : {}) }
  }
  if (wert.art === 'action') {
    const action = wert.action
    if (!istObjekt(action) || typeof action.type !== 'string' || action.type.length > 64) return null
    const ohneZeit: GeraeteAction = { ...action, type: action.type }
    delete ohneZeit.zeit
    return { art: 'action', action: ohneZeit }
  }
  if (wert.art === 'lebenszeichen') {
    if (!istZahl(wert.wartend) || wert.wartend > 10_000) return null
    if (wert.akku !== undefined && (!istZahl(wert.akku) || wert.akku > 100)) return null
    // Namen Feld für Feld: Unbrauchbares fällt weg, das Lebenszeichen gilt weiter (wie `hallo.typ`).
    const namen = liesWkrNamen(wert.namen)
    return { art: 'lebenszeichen', wartend: wert.wartend, ...(wert.akku !== undefined ? { akku: wert.akku } : {}), ...(namen ? { namen } : {}) }
  }
  if (wert.art === 'gesehen') {
    if (!istZahl(wert.hinweis) || !Number.isSafeInteger(wert.hinweis)) return null
    return { art: 'gesehen', hinweis: wert.hinweis }
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

/**
 * Gründe einer Ablehnung – Codes, die das Gerät übersetzt (nie Text auf der Leitung). Ab W1 (21.11.2026) auch die der
 * WKR-Zeilen (wkr/zeile.ts ZeilenFehler) und `offen` (die Liste hat noch offene Starts – Abschluss nur mit „Rest auf
 * Papier“).
 */
export const ABLEHNUNGEN = [
  'code-ungueltig', 'code-abgelaufen', 'id-belegt', 'fassung', 'nicht-erlaubt', 'konflikt',
  'wert-ungueltig', 'start-unbekannt', 'feld-fremd', 'x-nicht-erlaubt', 'teil-fremd', 'seite-anders', 'offen',
  // `nv-nicht-erlaubt` („nicht vorbeigekommen“ am Vorsteg/Steg-Ablegen, W4.3) entfiel am 24.11.2026: Es heißt jetzt
  // „Nicht gestartet · Disq. X“ und gilt überall (WKR_ANNAHMEN NG2, NG6).
  // R11-11 (26.11.2026): Zeile zu einem Versuch, der nach einem Ausfall abgebrochen wurde (wkr/versuch.ts,
  // BETRIEB_ANNAHMEN.wiederholungSpaeteZeileAblehnen) – PROTOKOLL_FASSUNG bleibt 2: Ein älteres Gerät kennt den Code
  // nicht und liest die Ablehnung als `wert-ungueltig` (erfassen.ts) – abgelehnt bleibt sie so oder so.
  'versuch-abgebrochen',
] as const
export type Ablehnung = (typeof ABLEHNUNGEN)[number]

export function istAblehnung(wert: unknown): wert is Ablehnung {
  return (ABLEHNUNGEN as readonly unknown[]).includes(wert)
}

/**
 * Hinweise des Bedienrechners an die Geräte einer Liste (W1, Rückkanal, nur Codes und Startnummer): prüfen, Papier
 * übernimmt, Verbindung unterbrochen, wieder digital. Dieselben wie wkr/sicht.ts WKR_HINWEISE (Test) – hier doppelt,
 * damit das Protokoll nichts aus der Fachlogik (und ihrer Konfiguration) lädt.
 */
export const HINWEISE = ['pruefen', 'papier', 'unterbrochen', 'weiter-digital'] as const
export type Hinweis = (typeof HINWEISE)[number]

export function istHinweis(wert: unknown): wert is Hinweis {
  return (HINWEISE as readonly unknown[]).includes(wert)
}

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
