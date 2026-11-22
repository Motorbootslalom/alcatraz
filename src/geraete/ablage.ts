import nacl from 'tweetnacl'
import { fromBase64Url, isBase64Url, toBase64Url } from './transport/ntfy/codec'
import { istGeraetId } from './transport/protokoll'
import { leereHerkunft, leererEingang, liesEingangWert, liesHerkunftWert, type WkrEingang, type WkrHerkunft } from './wkrEingang'
import {
  istGeraetStand,
  istHostRaum,
  neueGeraeteSchluessel,
  neuerRaum,
  type GeraetSpeicher,
  type GeraetStand,
  type HostRaum,
  type HostSpeicher,
} from './transport/ntfy/raum'

/**
 * Gerätelokale Ablage für den Gerätebetrieb (Plan vom 16.11.2026, §3 „Gerätelokal“): Raum, Schlüssel, Register und
 * Verbindung liegen im localStorage DIESES Browsers – nie im AppState, also nie in Sicherung, Vorlage oder
 * IndexedDB-Verlauf (Entscheidung 16.11.2026: kein Ersatzrechner, keine Schlüssel in Dateien). Ein neuer Rechner
 * heißt neuer Raum.
 *
 * Alle Schlüssel stehen hier an EINER Stelle ({@link ABLAGE}): `alcatraz.geraete.*` für den Bedienrechner (Host),
 * `alcatraz.geraet.*` für ein Gerät. Die Präfixe unterscheiden sich von denen des Prototyps tafel (`tafel:*`):
 * Unter einer Pages-Herkunft und unter file:// teilen sich mehrere Apps das localStorage (Befund S8).
 *
 * Die Schlüssel liegen im Klartext (Plan §8 Risiko 5, hingenommen): Wer den Rechner hat, hat ohnehin den Stand.
 * Je Veranstaltung ein neuer Raum – der Raum hängt an `AppState.kennung` ({@link hostAblage}).
 *
 * Jeder Zugriff fängt Fehler ab: Im privaten Fenster, bei vollem oder gesperrtem Speicher gibt es eben keinen
 * Raum – die Anwendung läuft weiter, nur ohne Geräte.
 */

export const ABLAGE = {
  /** Host: Raum samt Schlüsseln, Themen, Gruppen und Register, gebunden an die Kennung der Veranstaltung. */
  raum: 'alcatraz.geraete.raum',
  /** Host: Lease der Führung, nur wenn Web Locks fehlen (fuehrung.ts). */
  fuehrung: 'alcatraz.geraete.fuehrung',
  /** Host: Rückfall des Fensterbusses, wenn BroadcastChannel fehlt oder nicht trägt (fensterbus.ts). */
  fensterbus: 'alcatraz.geraete.fensterbus',
  /**
   * Gerät: die Verbindung zu einem Raum – eigene Kennung (ID, Box-Schlüssel; nur gekoppelte Geräte, E7) und was es
   * weiß: Gruppenschlüssel, gesehen, Themen, Nummernfolge, Sende-Schlange. Ein Eintrag, damit Kennung und Nummern
   * nur zusammen verloren gehen ({@link ichOderNeu}).
   */
  verbindung: 'alcatraz.geraet.verbindung',
  /** Gerät: zuletzt empfangene Sicht mit Ablauf (K20; gefüllt ab E6, geraete/geraet.ts). */
  sicht: 'alcatraz.geraet.sicht',
  /**
   * Gerät (E7): die Kopplung für die Start-Freigabe – Koppel-Link (ohne QR-Token), Lage, eigene Aufgaben, Name, Koppel-
   * Thema während der Anmeldung. Damit findet das Gerät nach dem Neuladen (`#/geraet`, ohne Paket in der Adresse)
   * zurück. Gehört zum Raum wie Verbindung und Sicht und geht mit ihnen ({@link pruefeRaum}, {@link verlasseRaum}).
   */
  kopplung: 'alcatraz.geraet.kopplung',
  /**
   * Gerät: Wann es zuletzt wegen einer neueren Fassung des Hosts neu geladen hat und für welche (F7, E6) – damit ein
   * Gerät, dessen Programm sich nicht erneuern lässt, nicht immer wieder neu lädt. Ohne Personenbezug.
   */
  aktualisiert: 'alcatraz.geraet.aktualisiert',
  /**
   * Gerät (E8, 20.11.2026): welcher Befehl „Alle Geräte neu laden“ (Raum, Gruppe, Nummer) zuletzt gewirkt hat – damit
   * derselbe Befehl nach dem Neuladen nicht noch einmal lädt. Ohne Personenbezug.
   */
  neuGeladen: 'alcatraz.geraet.neugeladen',
  /** Host (E8): Zähler der an ntfy gesendeten Nachrichten und Anfragen von heute (geraete/kontingent.ts). */
  kontingent: 'alcatraz.geraete.kontingent',
  /**
   * Host (E8): die Fassung des Programms, mit der der Gerätebetrieb zuletzt lief – weicht die laufende ab (nach
   * „Update“), bietet Betrieb → Geräte „Alle Geräte neu laden“ an (host.ts `neueFassung`).
   */
  fassung: 'alcatraz.geraete.fassung',
  /**
   * Host (W1, 21.11.2026): Gesprächsstand mit den WKR-Geräten – abgelehnte Zeilen (Codes) und Hinweise je Gerät
   * (geraete/wkrEingang.ts). An AppState.kennung gebunden, bleibt nach „Raum beenden“.
   */
  wkr: 'alcatraz.geraete.wkr',
  /**
   * Host (W1, F10): Herkunft ◆ je Zelle (Gerätename, Liste, Zeit, Wert) – nicht in der Sicherung, nur hier und im
   * Verlauf. An AppState.kennung gebunden, bleibt nach „Raum beenden“ (die Werte bleiben ja auch).
   */
  herkunft: 'alcatraz.geraete.herkunft',
  /**
   * Gerät (W1, 21.11.2026): Ausgang der WKR-Erfassung – wartende Zeilen und Nachrichten, die letzten Zeilen mit ihren
   * Werten (Korrektur, Abschluss), der Zeilenzähler und die zuletzt empfangene Sicht je Liste (geraete/erfassen.ts).
   * Gehört zum Raum wie Verbindung und Sicht, gilt 36 h nach dem letzten Schreiben ({@link SICHT_GUELTIG_MS}).
   */
  geraetWkr: 'alcatraz.geraet.wkr',
  /**
   * Gerät (W3, 21.11.2026, G1/G12): Ansicht der WKR-Maske – Wie Gerät (Vorgabe, GF1)/Sonne/Hell/Dunkel, Hand, gewählte Sprache, zuletzt
   * eingegebener WKR-Name. Vorliebe des Geräts, nicht des Raums: bleibt nach „Raum verlassen“, nur der Name geht
   * ({@link verlasseRaum}). Nie AppState.
   */
  ansicht: 'alcatraz.geraet.ansicht',
  /**
   * Gerät (W3, G10): für welche Listen dieses Raums die Probe beim Einrichten erledigt ist. Gehört zum Raum (neuer Raum
   * = neue Probe) und geht mit {@link verlasseRaum}/{@link pruefeRaum}.
   */
  probe: 'alcatraz.geraet.probe',
  /**
   * Gerät (Befund 15, 21.11.2026): welcher Tab die Geräte-Ablage gerade schreiben darf – der zuletzt geöffnete
   * (geraete/tabWache.ts). Nur eine zufällige Tab-Kennung, ohne Personenbezug; bleibt nach „Raum verlassen“.
   */
  geraetTab: 'alcatraz.geraet.tab',
} as const

/** Präfixe der Ablage: Host und Gerät. Nichts davon gehört in `alcatraz:state:v1`. */
export const PRAEFIX_HOST = 'alcatraz.geraete.'
export const PRAEFIX_GERAET = 'alcatraz.geraet.'

/**
 * Wie lange eine abgelegte Sicht auf einem Gerät gilt: letzte Nachricht + 36 h (Plan §3, Kritik K20, 16.11.2026).
 * Danach liegen keine Namen Minderjähriger mehr auf fremden Handys herum.
 */
export const SICHT_GUELTIG_MS = 36 * 60 * 60 * 1000

/** Was die Ablage vom localStorage braucht – in Tests ein eigener. */
export type Ablage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function vorgabe(): Ablage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function liesJson(ablage: Ablage | null, schluessel: string): unknown {
  if (!ablage) return null
  try {
    const roh = ablage.getItem(schluessel)
    return roh === null ? null : (JSON.parse(roh) as unknown)
  } catch {
    return null
  }
}

/** `false`, wenn der Speicher voll oder gesperrt ist. */
function schreibeJson(ablage: Ablage | null, schluessel: string, wert: unknown): boolean {
  if (!ablage) return false
  try {
    ablage.setItem(schluessel, JSON.stringify(wert))
    return true
  } catch {
    return false
  }
}

function entferne(ablage: Ablage | null, schluessel: string): void {
  try {
    ablage?.removeItem(schluessel)
  } catch {
    // Nichts zu tun: Was nicht gelesen werden kann, stört auch nicht.
  }
}

const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

// ---------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------

/** Wie der Raum abgelegt ist: mit der Kennung der Veranstaltung, für die er angelegt wurde. */
interface RaumHuelle {
  kennung: string
  raum: HostRaum
}

function liesHuelle(ablage: Ablage | null): RaumHuelle | null {
  const wert = liesJson(ablage, ABLAGE.raum)
  if (!istObjekt(wert) || typeof wert.kennung !== 'string' || !istHostRaum(wert.raum)) return null
  return { kennung: wert.kennung, raum: wert.raum }
}

/**
 * Raum des Hosts für die Veranstaltung `kennung` (AppState.kennung), als {@link HostSpeicher} für den Transport.
 * Ein Raum einer anderen Veranstaltung gilt als keiner (Plan §3: „Eine andere Veranstaltung beendet den Raum“) –
 * so verteilt ein Rechner nach „Alles zurücksetzen“ oder dem Laden einer anderen Sicherung nie unter dem alten Raum.
 *
 * `aendere` liest frisch, wendet an und schreibt (Plan §3 „mit Neulesen vor jedem Schreiben“): Ändert ein anderes
 * Fenster dazwischen, geht dessen Änderung nicht verloren. Dass nur EIN Fenster schreibt, sorgt fuehrung.ts.
 *
 * Scheitert das Schreiben (Speicher voll – derselbe Ursprung legt auch den Stand samt Logos ab), gilt bis zum nächsten
 * Gelingen der geänderte Raum im Arbeitsspeicher, und `voll()` meldet es (Transport: `ablage-voll`). Früher las das
 * nächste `aendere` wieder den alten Raum, und der Host vergab jede Nummer neu – Geräte verwarfen dann alles
 * (Befund E5-Prüfung 16.11.2026). Über ein Neuladen hinweg stimmen die Nummern so nicht; deshalb die Meldung.
 */
export function hostAblage(kennung: string, ablage: Ablage | null = vorgabe()): HostSpeicher {
  let ungeschrieben: string | null = null
  const lies = (): HostRaum | null => {
    if (ungeschrieben !== null) return JSON.parse(ungeschrieben) as HostRaum
    const h = liesHuelle(ablage)
    return h && h.kennung === kennung ? h.raum : null
  }
  return {
    lies,
    aendere(f) {
      const raum = lies()
      if (!raum) return null
      f(raum)
      if (schreibeJson(ablage, ABLAGE.raum, { kennung, raum } satisfies RaumHuelle)) {
        ungeschrieben = null
        return lies() ?? raum
      }
      ungeschrieben = JSON.stringify(raum)
      return lies()
    },
    voll: () => ungeschrieben !== null,
  }
}

/**
 * Legt für die Veranstaltung `kennung` einen neuen Raum an und ersetzt einen vorhandenen (neue Schlüssel, neue
 * Themen: Lese-Links neu aushängen, Geräte neu koppeln). Wirft bei einer unbrauchbaren Server-Adresse
 * (`server-ungueltig`) und wenn der Speicher nichts nimmt (`ablage-voll`).
 */
export function legeRaumAn(kennung: string, server: string, ablage: Ablage | null = vorgabe()): HostRaum {
  const raum = neuerRaum(server)
  if (!schreibeJson(ablage, ABLAGE.raum, { kennung, raum } satisfies RaumHuelle)) throw new Error('ablage-voll')
  return raum
}

/** Für welche Veranstaltung der abgelegte Raum gilt – `null`, wenn es keinen gibt. */
export function raumKennung(ablage: Ablage | null = vorgabe()): string | null {
  return liesHuelle(ablage)?.kennung ?? null
}

/**
 * W1: Gesprächsstand mit den WKR-Geräten dieser Veranstaltung. Gehört der abgelegte zu einer anderen Kennung, ist er
 * weg (gelöscht) und es gibt einen leeren.
 */
export function liesWkrEingang(kennung: string, ablage: Ablage | null = vorgabe()): WkrEingang {
  const roh = liesJson(ablage, ABLAGE.wkr)
  const e = liesEingangWert(roh)
  if (e && e.kennung === kennung) return e
  if (roh !== null) entferne(ablage, ABLAGE.wkr)
  return leererEingang(kennung)
}

/** `false`, wenn der Speicher voll ist (dann bleibt der Gesprächsstand nur bis zum Neuladen). */
export function schreibeWkrEingang(eingang: WkrEingang, ablage: Ablage | null = vorgabe()): boolean {
  return schreibeJson(ablage, ABLAGE.wkr, eingang)
}

/** W1 (F10): Herkunft ◆ dieser Veranstaltung; eine andere Kennung → gelöscht, leer. */
export function liesHerkunft(kennung: string, ablage: Ablage | null = vorgabe()): WkrHerkunft {
  const roh = liesJson(ablage, ABLAGE.herkunft)
  const h = liesHerkunftWert(roh)
  if (h && h.kennung === kennung) return h
  if (roh !== null) entferne(ablage, ABLAGE.herkunft)
  return leereHerkunft(kennung)
}

export function schreibeHerkunft(herkunft: WkrHerkunft, ablage: Ablage | null = vorgabe()): boolean {
  return schreibeJson(ablage, ABLAGE.herkunft, herkunft)
}

/** Raum löschen („Raum beenden“): Schlüssel weg, Lese-Links und Kopplungen enden. */
export function beendeRaum(ablage: Ablage | null = vorgabe()): void {
  entferne(ablage, ABLAGE.raum)
}

// ---------------------------------------------------------------------------
// Gerät
// ---------------------------------------------------------------------------

/** Eigene Kennung eines gekoppelten Geräts: ID und Box-Schlüsselpaar (X25519), wie GeraetTransport sie braucht. */
export interface GeraetIch {
  id: string
  schluessel: nacl.BoxKeyPair
}

/**
 * Wozu Abgelegtes auf einem Gerät gehört: Server, Raum-ID und Signaturschlüssel des Hosts – genau das, was Link
 * oder QR-Code tragen. Erst alle drei zusammen sind derselbe Raum: Ein neuer Raum desselben Rechners hat eine neue
 * ID, ein untergeschobener fremder Host einen anderen Schlüssel.
 */
export interface RaumBezug {
  u: string
  r: string
  s: string
}

const gleicherRaum = (a: unknown, b: RaumBezug) => istObjekt(a) && a.u === b.u && a.r === b.r && a.s === b.s
const nurBezug = (b: RaumBezug): RaumBezug => ({ u: b.u, r: b.r, s: b.s })

/**
 * Die Verbindung eines Geräts zu einem Raum, in EINEM Eintrag (`alcatraz.geraet.verbindung`): die eigene Kennung
 * (nur gekoppelte Geräte, E7) und der Stand mit der fortlaufenden Nummer `naechsteNr`, die der Host zu diesem
 * Schlüssel kennt (`letzteNr`). Beide gehen nur zusammen verloren. Früher lag die Kennung für sich und blieb beim
 * Löschen der Verbindung: Dann fing ein Gerät mit bekanntem Schlüssel wieder bei Nummer 1 an, der Host verwarf seine
 * Anmeldung still, und ein altes willkommen aus dem ntfy-Speicher öffnete ihm den Raum mit Nummern, die nie wirkten
 * (Befund E5-Prüfung 16.11.2026; Plan §3 nannte `alcatraz.geraet.ich` noch getrennt).
 */
interface VerbindungEintrag extends RaumBezug {
  ich?: { id: string; sk: string }
  /** `null`: Kennung neu angelegt, noch nichts gesendet oder empfangen. */
  stand: unknown
}

function liesVerbindung(ablage: Ablage | null, bezug: RaumBezug): VerbindungEintrag | null {
  const wert = liesJson(ablage, ABLAGE.verbindung)
  if (!istObjekt(wert) || !gleicherRaum(wert, bezug)) return null
  return wert as unknown as VerbindungEintrag
}

function ichAus(wert: unknown): GeraetIch | null {
  if (!istObjekt(wert) || !istGeraetId(wert.id) || !isBase64Url(wert.sk, nacl.box.secretKeyLength)) return null
  const sk = fromBase64Url(wert.sk)
  return sk ? { id: wert.id, schluessel: nacl.box.keyPair.fromSecretKey(sk) } : null
}

/** Liest die eigene Kennung für diesen Raum; abgelegt ist nur der geheime Schlüssel, der öffentliche folgt daraus. */
export function liesIch(bezug: RaumBezug, ablage: Ablage | null = vorgabe()): GeraetIch | null {
  return ichAus(liesVerbindung(ablage, bezug)?.ich)
}

/**
 * Die eigene Kennung für diesen Raum, beim ersten Mal neu angelegt. Die ID ist Zufall (12 Byte) und steht nie im
 * Klartext auf der Leitung, nur verschlüsselt an den Host (S1: Gebunden wird sie dort an den Schlüssel).
 *
 * Wiederverwendet nur mit ihrem Stand (oder solange noch keiner geschrieben ist). Ist der Stand kaputt, beginnen
 * Kennung UND Stand neu: Ein Schlüssel ohne seine Nummernfolge wäre beim Host stumm (siehe oben).
 */
export function ichOderNeu(bezug: RaumBezug, ablage: Ablage | null = vorgabe()): GeraetIch {
  const eintrag = liesVerbindung(ablage, bezug)
  const vorhanden = ichAus(eintrag?.ich)
  if (vorhanden && (eintrag!.stand === null || istGeraetStand(eintrag!.stand))) return vorhanden
  const ich: GeraetIch = { id: toBase64Url(nacl.randomBytes(12)), schluessel: neueGeraeteSchluessel() }
  const neu: VerbindungEintrag = { ...nurBezug(bezug), ich: { id: ich.id, sk: toBase64Url(ich.schluessel.secretKey) }, stand: null }
  schreibeJson(ablage, ABLAGE.verbindung, neu)
  return ich
}

/**
 * Was das Gerät über die Verbindung zum Raum `bezug` weiß, als {@link GeraetSpeicher} für den Transport. Gehört das
 * Abgelegte zu einem anderen Raum, gilt es als nichts: Sonst verwürfe das Gerät die Nachrichten des neuen Raums,
 * weil es deren Nummern schon „gesehen“ hätte. Schreiben behält die Kennung im selben Eintrag.
 */
export function geraetAblage(bezug: RaumBezug, ablage: Ablage | null = vorgabe()): GeraetSpeicher {
  const raum = nurBezug(bezug)
  return {
    lies(): GeraetStand | null {
      const stand = liesVerbindung(ablage, raum)?.stand
      return istGeraetStand(stand) ? stand : null
    },
    schreibe(stand) {
      const ich = liesVerbindung(ablage, raum)?.ich
      const eintrag: VerbindungEintrag = { ...raum, ...(ich ? { ich } : {}), stand }
      return schreibeJson(ablage, ABLAGE.verbindung, eintrag)
    },
  }
}

/**
 * Die zuletzt empfangene Sicht, abgelegt mit Ablauf (K20): Nach dem Neuladen steht die Anzeige sofort, ohne auf
 * die nächste Nachricht zu warten. Sie gilt bis {@link SICHT_GUELTIG_MS} nach dem letzten Schreiben und nur für
 * ihren Raum; danach (oder für einen anderen Raum) wird sie beim Lesen gelöscht. Was darin steht, entscheidet E6.
 */
export function sichtAblage(bezug: RaumBezug, ablage: Ablage | null = vorgabe(), uhr: () => number = Date.now) {
  const raum = { u: bezug.u, r: bezug.r, s: bezug.s }
  return {
    lies(): unknown {
      const wert = liesJson(ablage, ABLAGE.sicht)
      if (wert === null) return null
      if (!istObjekt(wert) || !gleicherRaum(wert, raum) || typeof wert.bis !== 'number' || wert.bis <= uhr() || !('sicht' in wert)) {
        entferne(ablage, ABLAGE.sicht)
        return null
      }
      return wert.sicht
    },
    schreibe(sicht: unknown): void {
      schreibeJson(ablage, ABLAGE.sicht, { ...raum, bis: uhr() + SICHT_GUELTIG_MS, sicht })
    },
    vergiss(): void {
      entferne(ablage, ABLAGE.sicht)
    },
  }
}

/**
 * Gehört Abgelegtes (Verbindung samt Kennung, Sicht) zu einem anderen Raum als `bezug`, wird es gelöscht – vor dem
 * Einstieg über einen neuen Link (Plan §3: „gelöscht … bei anderer Raum-ID“).
 */
export function pruefeRaum(bezug: RaumBezug, ablage: Ablage | null = vorgabe()): void {
  for (const schluessel of [ABLAGE.verbindung, ABLAGE.sicht, ABLAGE.kopplung, ABLAGE.geraetWkr, ABLAGE.probe]) {
    const wert = liesJson(ablage, schluessel)
    if (wert !== null && !gleicherRaum(wert, bezug)) entferne(ablage, schluessel)
  }
}

/**
 * „Raum verlassen“, Entzug (`entzogen`) oder signiertes Ende des Raums (K20): Verbindung samt Kennung und Sicht weg,
 * ebenso Kopplung und Ausgang der WKR-Erfassung (W1) samt Entwürfen, W3 auch die Probe und der zuletzt eingegebene
 * WKR-Name (G12) – die übrige Ansicht (Sonne, Hand, Sprache) ist eine Vorliebe des Geräts und bleibt.
 * Ein erneutes Koppeln (mit gültigem Code) beginnt mit neuem Schlüssel und Nummer 1 – ein altes willkommen aus dem
 * ntfy-Speicher geht mit dem neuen Schlüssel nicht mehr auf.
 */
export function verlasseRaum(ablage: Ablage | null = vorgabe()): void {
  entferne(ablage, ABLAGE.verbindung)
  entferne(ablage, ABLAGE.sicht)
  entferne(ablage, ABLAGE.kopplung)
  entferne(ablage, ABLAGE.geraetWkr)
  entferne(ablage, ABLAGE.probe)
  const ansicht = liesAnsicht(ablage)
  if (ansicht.name !== undefined) {
    const { name: _name, ...rest } = ansicht
    schreibeJson(ablage, ABLAGE.ansicht, ansichtFuerSpeicher(rest))
  }
}

/** Wie weit ein gekoppeltes Gerät ist (E7). */
export type KoppelLage = 'ungekoppelt' | 'koppelt' | 'gekoppelt' | 'abgelehnt' | 'entzogen'

/** Die abgelegte Kopplung eines Geräts (E7) – für genau einen Raum. */
export interface Kopplung extends RaumBezug {
  /** Koppel-Link (geraete/paket.ts, ohne QR-Token). */
  paket: string
  lage: KoppelLage
  name: string
  /** Eigene Aufgaben, wie der Host sie zuletzt schickte – nur für die Oberfläche; geprüft wird am Host. */
  aufgaben: unknown[]
  /** Koppel-Thema, solange die Anmeldung läuft (Wiederholung nach dem Neuladen). */
  thema: string | null
}

const KOPPEL_LAGEN: readonly KoppelLage[] = ['ungekoppelt', 'koppelt', 'gekoppelt', 'abgelehnt', 'entzogen']

function istKopplung(wert: unknown): wert is Kopplung {
  if (!istObjekt(wert) || typeof wert.u !== 'string' || typeof wert.r !== 'string' || typeof wert.s !== 'string') return false
  if (typeof wert.paket !== 'string' || !KOPPEL_LAGEN.includes(wert.lage as KoppelLage) || typeof wert.name !== 'string') return false
  return Array.isArray(wert.aufgaben) && (wert.thema === null || typeof wert.thema === 'string')
}

/** Die abgelegte Kopplung, gleich welcher Raum – für `#/geraet` nach dem Neuladen. `null`: keine oder kaputt. */
export function liesKopplung(ablage: Ablage | null = vorgabe()): Kopplung | null {
  const wert = liesJson(ablage, ABLAGE.kopplung)
  return istKopplung(wert) ? wert : null
}

/** Kopplung ablegen; `false`, wenn der Speicher sie nicht nimmt. */
export function schreibeKopplung(kopplung: Kopplung, ablage: Ablage | null = vorgabe()): boolean {
  return schreibeJson(ablage, ABLAGE.kopplung, kopplung)
}

/**
 * Ausgang der WKR-Erfassung eines Geräts (W1, geraete/erfassen.ts) – für genau einen Raum, gültig bis `bis`
 * (36 h nach dem letzten Schreiben, wie die Sicht: danach liegen keine Werte mehr auf dem Handy). Was darin steht,
 * prüft erfassen.ts beim Lesen; hier nur Raum und Ablauf.
 */
export function geraetWkrAblage(bezug: RaumBezug, ablage: Ablage | null = vorgabe(), uhr: () => number = Date.now) {
  const raum = nurBezug(bezug)
  return {
    lies(): Record<string, unknown> | null {
      const wert = liesJson(ablage, ABLAGE.geraetWkr)
      if (wert === null) return null
      if (!istObjekt(wert) || !gleicherRaum(wert, raum) || typeof wert.bis !== 'number' || wert.bis <= uhr() || !istObjekt(wert.inhalt)) {
        entferne(ablage, ABLAGE.geraetWkr)
        return null
      }
      return wert.inhalt
    },
    /** `false`, wenn der Speicher voll ist (dann gilt der Ausgang nur bis zum Neuladen). */
    schreibe(inhalt: unknown): boolean {
      return schreibeJson(ablage, ABLAGE.geraetWkr, { ...raum, bis: uhr() + SICHT_GUELTIG_MS, inhalt })
    },
  }
}

// ---------------------------------------------------------------------------
// Ansicht und Probe der WKR-Maske (W3)
// ---------------------------------------------------------------------------

/** Sonnenmodus (schwarz auf weiß, hoher Kontrast), App-Farben hell oder dunkel – was die Maske zeigt. */
export type AnsichtModus = 'sonne' | 'hell' | 'dunkel'
/**
 * Gewählte Ansicht: ein Modus oder „Wie Gerät“ (`geraet`, Vorgabe seit 21.11.2026 – Nutzer P-18/W3-01, WKR_ANNAHMEN
 * GF1: Hell/Dunkel des Geräts ist Vorgabe, der WKR darf jederzeit wechseln; vorher Sonne, G1).
 */
export type AnsichtWahl = 'geraet' | AnsichtModus

/** Ansicht der WKR-Maske auf diesem Gerät (W3). */
export interface GeraetAnsicht {
  modus: AnsichtWahl
  /** Bedienhand: links spiegelt den Fuß der Maske (Hauptknopf links). */
  hand: 'rechts' | 'links'
  /** Gewählte Sprache (F13); fehlt = Sprache der Liste. */
  sprache?: 'de' | 'en'
  /** Zuletzt beim Abschluss eingegebener WKR-Name (G12), vorbelegt beim nächsten Abschluss. */
  name?: string
  /** Erklärung der Übung zugeklappt (Nutzer 21.11.2026, W3-15, GF4) – fehlt = offen. */
  uebungErklaerungZu?: true
  /**
   * Bojen-Maske je Liste (Nutzer 21.11.2026, WKR_ANNAHMEN.bojenNachLage/bojenSpiegeln): Reihenfolge und Spiegeln –
   * eine Vorliebe am Standort des WKR, also je Liste (Kennung). Fehlt = Fahrtfolge, Start oben, nicht getauscht.
   */
  bojen?: Record<string, BojenAnsicht>
}

/** Ansicht der Bojen-Maske einer Liste: Fahrtfolge oder wie der Parcours liegt, Start oben/unten, Spalten getauscht. */
export interface BojenAnsicht {
  folge: 'fahrt' | 'lage'
  startOben: boolean
  tauschen: boolean
}

export const BOJEN_ANSICHT_VORGABE: Readonly<BojenAnsicht> = { folge: 'fahrt', startOben: true, tauschen: false }
/**
 * Höchstens so viele Listen merken – ein Gerät hat höchstens zwei zugleich (F15), alte fallen vorn heraus. „Alt“ =
 * am längsten nicht geändert: WkrMaske setzt eine geänderte Liste ans Ende (Prüfbefund 21.11.2026).
 */
const BOJEN_ANSICHT_MAX = 8

function bojenAnsichtAus(wert: unknown): BojenAnsicht | null {
  if (!istObjekt(wert)) return null
  if (wert.folge !== 'fahrt' && wert.folge !== 'lage') return null
  if (typeof wert.startOben !== 'boolean' || typeof wert.tauschen !== 'boolean') return null
  return { folge: wert.folge, startOben: wert.startOben, tauschen: wert.tauschen }
}

const ANSICHT_VORGABE: GeraetAnsicht = { modus: 'geraet', hand: 'rechts' }
/** Wie WKR_ANNAHMEN.nameMax – hier ohne Import aus src/wkr, die Ablage bleibt ohne Fachlogik. */
const NAME_MAX = 60

/** Die Ansicht lesen – Unbekanntes fällt auf die Vorgabe („Wie Gerät“, rechts) zurück, Feld für Feld. */
export function liesAnsicht(ablage: Ablage | null = vorgabe()): GeraetAnsicht {
  return ansichtAus(liesJson(ablage, ABLAGE.ansicht))
}

/**
 * Ein Modus außer „Wie Gerät“ gilt nur mit `modusGewaehlt: true` im Speicher (Prüfbefund 21.11.2026): Vor GF1 war
 * die Vorgabe `sonne`, und schreibeAnsicht schrieb sie bei jeder anderen Änderung (Hand, Sprache, Name, Bojen) mit –
 * ein so benutztes Gerät bliebe sonst auf der Sonne, obwohl der WKR sie nie gewählt hat (P-18: Gerätemodus ist heilig).
 */
function ansichtAus(wert: unknown): GeraetAnsicht {
  const out: GeraetAnsicht = { ...ANSICHT_VORGABE }
  if (!istObjekt(wert)) return out
  if ((wert.modus === 'sonne' || wert.modus === 'hell' || wert.modus === 'dunkel') && wert.modusGewaehlt === true) out.modus = wert.modus
  if (wert.hand === 'links' || wert.hand === 'rechts') out.hand = wert.hand
  if (wert.sprache === 'de' || wert.sprache === 'en') out.sprache = wert.sprache
  if (wert.uebungErklaerungZu === true) out.uebungErklaerungZu = true
  if (typeof wert.name === 'string' && wert.name.trim() !== '' && wert.name.length <= NAME_MAX) out.name = wert.name
  if (istObjekt(wert.bojen)) {
    const bojen: Record<string, BojenAnsicht> = {}
    for (const [liste, b] of Object.entries(wert.bojen).slice(-BOJEN_ANSICHT_MAX)) {
      const gut = liste.length <= 200 ? bojenAnsichtAus(b) : null
      if (gut) bojen[liste] = gut
    }
    if (Object.keys(bojen).length > 0) out.bojen = bojen
  }
  return out
}

/** Ansicht ändern (nur die genannten Felder; `undefined` löscht Sprache bzw. Name). `false`: Speicher nimmt sie nicht. */
export function schreibeAnsicht(aenderung: Partial<GeraetAnsicht>, ablage: Ablage | null = vorgabe()): boolean {
  const neu: Record<string, unknown> = { ...liesAnsicht(ablage) }
  for (const [k, v] of Object.entries(aenderung)) {
    if (v === undefined) delete neu[k]
    else neu[k] = v
  }
  // `neu.modus` ist hier immer eine Wahl: liesAnsicht liefert Ungewähltes schon als 'geraet'.
  return schreibeJson(ablage, ABLAGE.ansicht, ansichtFuerSpeicher(ansichtAus({ ...neu, modusGewaehlt: true })))
}

/** Speicherform: `modusGewaehlt` nur neben einem gewählten Modus (siehe ansichtAus). */
function ansichtFuerSpeicher(a: Partial<GeraetAnsicht>): Record<string, unknown> {
  return a.modus !== undefined && a.modus !== 'geraet' ? { ...a, modusGewaehlt: true } : { ...a }
}

/** Ist die Probe (G10) für diese Liste in diesem Raum erledigt? */
export function probeErledigt(bezug: RaumBezug, liste: string, ablage: Ablage | null = vorgabe()): boolean {
  const wert = liesJson(ablage, ABLAGE.probe)
  return istObjekt(wert) && gleicherRaum(wert, bezug) && Array.isArray(wert.listen) && wert.listen.includes(liste)
}

/** Probe für diese Liste als erledigt vermerken (übersprungen zählt auch). Ein anderer Raum ersetzt den Eintrag. */
export function merkeProbe(bezug: RaumBezug, liste: string, ablage: Ablage | null = vorgabe()): boolean {
  const wert = liesJson(ablage, ABLAGE.probe)
  const bisher = istObjekt(wert) && gleicherRaum(wert, bezug) && Array.isArray(wert.listen) ? wert.listen.filter((l): l is string => typeof l === 'string') : []
  if (bisher.includes(liste)) return true
  // Höchstens ein paar Listen – ein Gerät hat höchstens zwei (F15); alte fallen vorn heraus.
  return schreibeJson(ablage, ABLAGE.probe, { ...nurBezug(bezug), listen: [...bisher, liste].slice(-8) })
}
