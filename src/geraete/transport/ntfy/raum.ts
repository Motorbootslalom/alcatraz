import nacl from 'tweetnacl'
import { fromBase64Url, isBase64Url, toBase64Url } from './codec'
import { direktThema, geraeteThema, gruppenThema, istThema, normalisiereServer, zufallsThema } from '../../themen'
import { DIREKT, istGeraetId, istGruppe, istOeffentlich, OEFFENTLICH, ZUSCHAUER, type GeraeteNachricht, type GruppenSchluessel } from '../protokoll'

/**
 * Raum und Schlüssel für den Betrieb über ntfy (Vorbild tafel transport/ntfy/room.ts, 16.11.2026 neu geschrieben
 * nach Plan §3 „Gerätelokal“ und §5).
 *
 * Der **Host** legt einen Raum einmal an und behält ihn: Raum-ID, ein Geheimnis (Quelle der abgeleiteten
 * Themen), ein Schlüsselpaar zum Verschlüsseln (X25519) und eines zum Signieren (Ed25519), zwei zufällige
 * öffentliche Themen (oA, oZ) und je Gruppe Schlüssel, Epoche und Zähler – von Anfang an die beiden öffentlichen
 * Gruppen `ko` (Anzeigetafel, oA) und `kz` (Zuschauer, oZ). Ein neuer Raum heißt: Lese-Links neu aushängen, Geräte
 * neu koppeln (Entscheidung 16.11.2026: kein Ersatzrechner).
 *
 * Wo das liegt, entscheidet nicht dieses Modul: Es arbeitet über {@link HostSpeicher} bzw. {@link GeraetSpeicher}.
 * geraete/ablage.ts legt beides gerätelokal ab (`alcatraz.geraete.*` / `alcatraz.geraet.*`) – nie im AppState,
 * nie in Sicherung, Vorlage oder Verlauf (Plan §3). Für Tests und Fenster ohne Speicher gibt es die Fassungen
 * im Arbeitsspeicher.
 *
 * Eine Vorgabe für den Server gibt es hier nicht (themen.ts NTFY_VORGABE): Der Server kommt immer von außen.
 */

/** Öffentliche Gruppe und ihre beiden Themen. */
export interface HostGruppe {
  /** secretbox-Schlüssel, 32 Byte. */
  k: string
  /** Zählt mit jedem neuen Schlüssel hoch. */
  e: number
  /** Nummer der zuletzt vergebenen Nachricht dieser Gruppe – steigt auch über einen Neustart des Hosts. */
  n: number
}

/** Ein gekoppeltes Gerät, gebunden an seinen Schlüssel. Name und Aufgaben führt E7 (register.ts) daneben. */
export interface GebundenesGeraet {
  /** Öffentlicher Box-Schlüssel, mit dem es gekoppelt wurde. Eine andere ID bekommt ihn nie (S1). */
  pk: string
  /** Letzte bearbeitete Nummer: Doppelte bekommen nur erneut eine Quittung, auch nach einem Neustart (K18). */
  letzteNr: number
  /** Nicht öffentliche Gruppen, deren Schlüssel es hat – nach einem Entzug bekommen sie neue. */
  gruppen: string[]
  // Register (E7, geraete/register.ts): Beschriftung und Rechte. Freiwillig, damit der Kern ohne sie auskommt.
  /** Name in der Geräteliste (eindeutig gemacht vom Host, geraete/geraeteName.ts). */
  name?: string
  /** Aufgaben (geraete/aufgaben.ts) – maßgeblich für `darf`, nie was das Gerät behauptet. */
  aufgaben?: unknown[]
  /** Wann gekoppelt bzw. zuletzt gehört (Uhr des Hosts, ms). */
  seit?: number
  zuletzt?: number
  /** W1: aus dem letzten Lebenszeichen – Zeilen, die das Gerät noch nicht los ist, und Akku in Prozent. */
  wartend?: number
  akku?: number
}

/** Ein entzogenes Gerät, für die Geräteliste (E7): ohne Gruppenschlüssel – es kann nichts mehr. */
export interface EntzogenesGeraet {
  id: string
  name: string
  um: number
  /**
   * Sein öffentlicher Schlüssel – nur, um ihm `entzogen` noch einmal zu schicken, wenn es sich nach langer Pause auf g
   * meldet (transport.ts erinnereEntzogenes, Befund der E7-Prüfung 20.11.2026). Öffentlich, gibt also nichts preis.
   */
  pk?: string
}

/**
 * Eine Verwaltungsnachricht, die noch hinaus muss: neue Gruppenschlüssel an ein Gerät oder `entzogen`. Steht im Raum,
 * zusammen mit dem Schlüsselwechsel geschrieben, und fällt erst weg, wenn ntfy sie angenommen hat – schließt das
 * Führungsfenster vorher, schickt der nächste Start sie (Befund E5-Prüfung 16.11.2026: Die Sende-Schlange liegt nur im
 * Arbeitsspeicher, und ein verpasster Schlüssel kommt sonst nie nach). Der Inhalt von `schluessel` entsteht erst beim
 * Senden aus dem Raum – so trägt er immer die neuesten Schlüssel.
 */
export interface Ausstehend {
  id: string
  /** Schlüssel des Geräts – nach einem Entzug steht er nicht mehr im Register. */
  pk: string
  art: 'schluessel' | 'entzogen'
}

export interface HostRaum {
  fassung: 1
  /** Server, mit dem der Raum angelegt wurde; ein anderer Server heißt neuer Raum. */
  server: string
  /** Raum-ID, nicht geheim: steht in Links und jeder Nachricht. */
  r: string
  /** Quelle der abgeleiteten Themen (g, d·, k·) – verlässt den Host nie. */
  geheimnis: string
  box: { pk: string; sk: string }
  sign: { pk: string; sk: string }
  /** Öffentliche Themen: a = Anzeigetafel-Link (oA), z = Zuschauer-Link (oZ). */
  oeffentlich: { a: string; z: string }
  /** Immer mit `ko` und `kz`. */
  gruppen: Record<string, HostGruppe>
  /** Nummer der zuletzt vergebenen direkten Nachricht. */
  uhr: number
  /** ntfy-ID der zuletzt verarbeiteten Nachricht aus g – Wiedereinstieg mit `since` (S3). */
  seit: string | null
  geraete: Record<string, GebundenesGeraet>
  /** Verwaltungsnachrichten, die noch nicht bei ntfy angekommen sind. */
  ausstehend: Ausstehend[]
  /** E7: laufender Geräte-Code und QR-Sitzung (geraete/koppeln.ts KoppelStand; gelesen mit liesKoppelStand). */
  koppeln?: unknown
  /** E7: zuletzt entzogene Geräte (höchstens {@link ENTZOGEN_HOECHSTENS}), nur zur Anzeige. */
  entzogen?: EntzogenesGeraet[]
}

/** So viele entzogene Geräte merkt sich der Raum für die Geräteliste. */
export const ENTZOGEN_HOECHSTENS = 50

/** Vermerkt eine Verwaltungsnachricht (einmal je Gerät und Art). */
export function vermerke(raum: HostRaum, eintrag: Ausstehend): void {
  if (!raum.ausstehend.some((a) => a.id === eintrag.id && a.art === eintrag.art && a.pk === eintrag.pk)) raum.ausstehend.push(eintrag)
}

const neuerSchluessel = () => toBase64Url(nacl.randomBytes(nacl.secretbox.keyLength))

/** Legt einen Raum an. Wirft bei einer unbrauchbaren Server-Adresse. */
export function neuerRaum(server: string): HostRaum {
  const normal = normalisiereServer(server)
  if (!normal) throw new Error('server-ungueltig')
  const box = nacl.box.keyPair()
  const sign = nacl.sign.keyPair()
  return {
    fassung: 1,
    server: normal,
    r: toBase64Url(nacl.randomBytes(8)),
    geheimnis: toBase64Url(nacl.randomBytes(32)),
    box: { pk: toBase64Url(box.publicKey), sk: toBase64Url(box.secretKey) },
    sign: { pk: toBase64Url(sign.publicKey), sk: toBase64Url(sign.secretKey) },
    oeffentlich: { a: zufallsThema(), z: zufallsThema() },
    gruppen: { [OEFFENTLICH]: { k: neuerSchluessel(), e: 1, n: 0 }, [ZUSCHAUER]: { k: neuerSchluessel(), e: 1, n: 0 } },
    uhr: 0,
    seit: null,
    geraete: {},
    ausstehend: [],
  }
}

const istZahl = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Prüft einen gelesenen Raum (für ablage.ts); Kaputtes heißt: kein Raum. */
export function istHostRaum(wert: unknown): wert is HostRaum {
  if (!istObjekt(wert) || wert.fassung !== 1) return false
  const { box, sign, oeffentlich, gruppen, geraete } = wert
  if (typeof wert.server !== 'string' || !isBase64Url(wert.r) || !isBase64Url(wert.geheimnis, 32)) return false
  if (!istObjekt(box) || !isBase64Url(box.pk, 32) || !isBase64Url(box.sk, 32)) return false
  if (!istObjekt(sign) || !isBase64Url(sign.pk, 32) || !isBase64Url(sign.sk, 64)) return false
  if (!istObjekt(oeffentlich) || !istThema(oeffentlich.a) || !istThema(oeffentlich.z)) return false
  if (!istObjekt(gruppen) || !istObjekt(gruppen[OEFFENTLICH]) || !istObjekt(gruppen[ZUSCHAUER])) return false
  for (const [g, gruppe] of Object.entries(gruppen)) {
    if (!istGruppe(g) || !istObjekt(gruppe) || !isBase64Url(gruppe.k, 32) || !istZahl(gruppe.e) || !istZahl(gruppe.n)) return false
  }
  if (!istZahl(wert.uhr) || (wert.seit !== null && typeof wert.seit !== 'string') || !istObjekt(geraete)) return false
  for (const [id, g] of Object.entries(geraete)) {
    if (!istGeraetId(id) || !istObjekt(g) || !isBase64Url(g.pk, 32) || !istZahl(g.letzteNr)) return false
    if (!Array.isArray(g.gruppen) || !g.gruppen.every(istGruppe)) return false
    if (g.name !== undefined && (typeof g.name !== 'string' || g.name.length > 60)) return false
    if (g.aufgaben !== undefined && !Array.isArray(g.aufgaben)) return false
    if ((g.seit !== undefined && !istZahl(g.seit)) || (g.zuletzt !== undefined && !istZahl(g.zuletzt))) return false
    if ((g.wartend !== undefined && !istZahl(g.wartend)) || (g.akku !== undefined && !istZahl(g.akku))) return false
  }
  if (wert.koppeln !== undefined && wert.koppeln !== null && !istObjekt(wert.koppeln)) return false
  if (wert.entzogen !== undefined) {
    if (!Array.isArray(wert.entzogen)) return false
    for (const e of wert.entzogen as unknown[]) if (!istObjekt(e) || !istGeraetId(e.id) || typeof e.name !== 'string' || !istZahl(e.um) || (e.pk !== undefined && !isBase64Url(e.pk, 32))) return false
  }
  if (!Array.isArray(wert.ausstehend)) return false
  for (const a of wert.ausstehend as unknown[]) {
    if (!istObjekt(a) || !istGeraetId(a.id) || !isBase64Url(a.pk, 32) || (a.art !== 'schluessel' && a.art !== 'entzogen')) return false
  }
  return true
}

const bytes = (text: string) => fromBase64Url(text) ?? new Uint8Array(0)

/** g: Geräte schreiben an den Host. */
export function geraeteThemaVon(raum: HostRaum): string {
  return geraeteThema(bytes(raum.geheimnis))
}

/** d·: der Host schreibt an ein Gerät. */
export function direktThemaVon(raum: HostRaum, id: string): string {
  return direktThema(bytes(raum.geheimnis), id)
}

/** Welcher Lese-Link zu einer öffentlichen Gruppe gehört: `ko` → Anzeigetafel (a), `kz` → Zuschauer (z). */
export function linkDerGruppe(gruppe: string): 'a' | 'z' | null {
  return gruppe === OEFFENTLICH ? 'a' : gruppe === ZUSCHAUER ? 'z' : null
}

/** Die öffentliche Gruppe eines Lese-Links. */
export function gruppeDesLinks(welches: 'a' | 'z'): string {
  return welches === 'a' ? OEFFENTLICH : ZUSCHAUER
}

/** Themen, auf denen eine Gruppe sendet: `ko` auf oA, `kz` auf oZ, sonst ihr abgeleitetes k·. */
export function themenDerGruppe(raum: HostRaum, gruppe: string): string[] {
  const link = linkDerGruppe(gruppe)
  if (link) return [raum.oeffentlich[link]]
  return [gruppenThema(bytes(raum.geheimnis), gruppe)]
}

/** Schlüssel einer Gruppe, wie ein gekoppeltes Gerät ihn bekommt (`ko`: die Start-Freigabe liest oA, Plan §5). */
export function gruppenSchluessel(raum: HostRaum, gruppe: string): GruppenSchluessel | null {
  const g = raum.gruppen[gruppe]
  if (!g) return null
  return { g: gruppe, k: g.k, e: g.e, t: themenDerGruppe(raum, gruppe) }
}

/** Neue Gruppe (später je Liste, K31) mit eigenem Schlüssel, eigener Epoche, eigenem Zähler. */
export function mitGruppe(raum: HostRaum, gruppe: string): boolean {
  if (!istGruppe(gruppe) || raum.gruppen[gruppe]) return false
  raum.gruppen[gruppe] = { k: neuerSchluessel(), e: 1, n: 0 }
  return true
}

/**
 * Neuer Schlüssel für eine nicht öffentliche Gruppe, Epoche + 1. Die öffentlichen Gruppen (`ko`, `kz`) nie (K14):
 * Ausgehängte Lese-Links blieben sonst tot, und ihr Inhalt ist ohnehin öffentlich.
 */
export function mitNeuemSchluessel(raum: HostRaum, gruppe: string): boolean {
  const g = raum.gruppen[gruppe]
  if (!g || istOeffentlich(gruppe)) return false
  raum.gruppen[gruppe] = { ...g, k: neuerSchluessel(), e: g.e + 1 }
  return true
}

// ---------------------------------------------------------------------------
// Lese-Link (E6) und Kopplung (E7)
// ---------------------------------------------------------------------------

/**
 * Was ein Lese-Link trägt (Entscheidung 16.11.2026, F3): Server, Raum, das EINE öffentliche Thema, die Gruppe dazu
 * (`ko` Anzeigetafel, `kz` Zuschauer) mit ihrem Schlüssel und den Signaturschlüssel des Hosts. Nie g, nie das
 * Geheimnis, nie das andere öffentliche Thema und nie den Schlüssel der anderen Gruppe (K13) – wer den Zuschauer-Link
 * missbraucht, stört die Tafel nicht und liest ihre Nachrichten nicht. Im Link steht es gepackt (geraete/paket.ts).
 */
export interface LesePaket {
  u: string
  r: string
  t: string
  g: string
  k: string
  e: number
  s: string
}

export function lesePaket(raum: HostRaum, welches: 'a' | 'z'): LesePaket {
  const g = gruppeDesLinks(welches)
  const gruppe = raum.gruppen[g]
  return { u: raum.server, r: raum.r, t: raum.oeffentlich[welches], g, k: gruppe.k, e: gruppe.e, s: raum.sign.pk }
}

export function liesLesePaket(wert: unknown): LesePaket | null {
  if (!istObjekt(wert)) return null
  const u = typeof wert.u === 'string' ? normalisiereServer(wert.u) : null
  if (!u || !isBase64Url(wert.r) || !istThema(wert.t) || !isBase64Url(wert.k, 32) || !istZahl(wert.e)) return null
  if (typeof wert.g !== 'string' || !istOeffentlich(wert.g) || !isBase64Url(wert.s, 32)) return null
  return { u, r: wert.r, t: wert.t, g: wert.g, k: wert.k, e: wert.e, s: wert.s }
}

/** Die öffentlichen Schlüssel des Hosts in einem Stück (Box + Signatur, 64 Byte) – für QR-Code und Kopplung. */
export function hostOeffentlich(raum: Pick<HostRaum, 'box' | 'sign'>): string {
  const beide = new Uint8Array(64)
  beide.set(bytes(raum.box.pk), 0)
  beide.set(bytes(raum.sign.pk), 32)
  return toBase64Url(beide)
}

export interface HostSchluessel {
  box: Uint8Array
  sign: Uint8Array
}

export function liesHostOeffentlich(text: unknown): HostSchluessel | null {
  if (!isBase64Url(text, 64)) return null
  const b = fromBase64Url(text)
  if (!b || b.length !== 64) return null
  return { box: b.slice(0, 32), sign: b.slice(32) }
}

/** Kurz-Fingerabdruck des Hosts zum Vergleich auf Host und Gerät (Plan §8, Vertrauen beim ersten Mal). */
export function fingerabdruck(signPublic: string): string {
  return toBase64Url(nacl.hash(bytes(signPublic)).subarray(0, 6))
}

// ---------------------------------------------------------------------------
// Speicher des Hosts
// ---------------------------------------------------------------------------

/**
 * Wo der Raum des Hosts liegt. `aendere` liest frisch, wendet an und schreibt – so verliert kein Fenster die
 * Änderung eines anderen (S7; die Führung per Web Lock, geraete/fuehrung.ts, sorgt dafür, dass nur eines schreibt).
 */
export interface HostSpeicher {
  lies(): HostRaum | null
  /**
   * `null`, wenn es keinen Raum gibt; sonst der geänderte Raum – auch wenn er sich nicht ablegen ließ (dann
   * {@link voll}): Der Arbeitsspeicher geht dem veralteten Speicher vor, sonst vergäbe der Host Nummern doppelt.
   */
  aendere(f: (raum: HostRaum) => void): HostRaum | null
  /** Ließ sich die letzte Änderung nicht ablegen (Speicher voll)? Der Transport meldet dann `ablage-voll`. */
  voll?(): boolean
}

/** Raum nur im Arbeitsspeicher – als Text, damit niemand eine Referenz auf den gespeicherten Stand hält. */
export function hostSpeicherImSpeicher(raum: HostRaum | null = null): HostSpeicher & { roh(): string | null } {
  let text = raum ? JSON.stringify(raum) : null
  const lies = (): HostRaum | null => {
    if (text === null) return null
    const wert: unknown = JSON.parse(text)
    return istHostRaum(wert) ? wert : null
  }
  return {
    lies,
    aendere(f) {
      const r = lies()
      if (!r) return null
      f(r)
      text = JSON.stringify(r)
      return lies()
    },
    roh: () => text,
  }
}

// ---------------------------------------------------------------------------
// Gerät
// ---------------------------------------------------------------------------

/** Ein Schlüsselpaar für ein Gerät (X25519). Erzeugt je Kopplung, abgelegt von ablage.ts mit der Verbindung. */
export function neueGeraeteSchluessel(): nacl.BoxKeyPair {
  return nacl.box.keyPair()
}

/** Eine Nachricht in der Sende-Schlange des Geräts, noch ohne Quittung. */
export interface Unbestaetigt {
  nr: number
  nachricht: GeraeteNachricht
}

/** Was ein Gerät über die Verbindung weiß – gerätelokal, nie im AppState (`alcatraz.geraet.verbindung`). */
export interface GeraetStand {
  /** Gruppenschlüssel: `ko` bzw. `kz` aus dem Lese-Link, weitere per willkommen/schluessel. */
  gruppen: Record<string, { k: string; e: number; t: string[] }>
  /** Höchste angenommene Nummer je Gruppe; {@link DIREKT} für Nachrichten an dieses Gerät. */
  seen: Record<string, number>
  /**
   * Die zuletzt angenommenen Nummern auf d (aufsteigend, höchstens {@link DIREKT_MERKEN}): Direktes darf auch NACH
   * einer höheren Nummer kommen (ntfy schickt beim Abo Live-Nachrichten womöglich vor dem Zwischengespeicherten) –
   * angenommen wird, was in diesem Fenster noch fehlt (Prüfung unter Last 21.11.2026). Fehlt es (älterer Stand),
   * gilt allein `seen[DIREKT]`.
   */
  direkt?: number[]
  /** ntfy-ID der zuletzt verarbeiteten Nachricht: Wiederverbinden mit `since` (S3). */
  seit: string | null
  /** Nach willkommen: eigene ID, g und d. */
  id: string | null
  themen: { g: string; d: string } | null
  /** Nächste eigene Nummer. */
  naechsteNr: number
  /** Unbestätigte Nachrichten, der Reihe nach (eine zur Zeit). */
  schlange: Unbestaetigt[]
}

/** So viele Nummern auf d merkt sich ein Gerät (GeraetStand.direkt) – weit mehr, als in einem Abo-Wechsel eintreffen. */
export const DIREKT_MERKEN = 64

export function leererGeraetStand(): GeraetStand {
  return { gruppen: {}, seen: {}, seit: null, id: null, themen: null, naechsteNr: 1, schlange: [] }
}

export function istGeraetStand(wert: unknown): wert is GeraetStand {
  if (!istObjekt(wert) || !istObjekt(wert.gruppen) || !istObjekt(wert.seen)) return false
  for (const [g, s] of Object.entries(wert.gruppen)) {
    if (!istGruppe(g) || !istObjekt(s) || !isBase64Url(s.k, 32) || !istZahl(s.e) || !Array.isArray(s.t)) return false
  }
  for (const [g, n] of Object.entries(wert.seen)) if ((g !== DIREKT && !istGruppe(g)) || !istZahl(n)) return false
  if (wert.direkt !== undefined && (!Array.isArray(wert.direkt) || wert.direkt.length > DIREKT_MERKEN || !wert.direkt.every(istZahl))) return false
  if (wert.seit !== null && typeof wert.seit !== 'string') return false
  if (wert.id !== null && !istGeraetId(wert.id)) return false
  const th = wert.themen
  if (th !== null && (!istObjekt(th) || !istThema(th.g) || !istThema(th.d))) return false
  return istZahl(wert.naechsteNr) && wert.naechsteNr >= 1 && Array.isArray(wert.schlange)
}

export interface GeraetSpeicher {
  lies(): GeraetStand | null
  /** `false`, wenn er sich nicht ablegen ließ (Speicher voll) – der Transport meldet dann `ablage-voll`. */
  schreibe(stand: GeraetStand): boolean | void
}

export function geraetSpeicherImSpeicher(stand: GeraetStand | null = null): GeraetSpeicher & { roh(): string | null } {
  let text = stand ? JSON.stringify(stand) : null
  return {
    lies() {
      if (text === null) return null
      const wert: unknown = JSON.parse(text)
      return istGeraetStand(wert) ? wert : null
    },
    schreibe(s) {
      text = JSON.stringify(s)
    },
    roh: () => text,
  }
}
