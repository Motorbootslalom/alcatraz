import nacl from 'tweetnacl'
import { fromBase64Url, isBase64Url, MAX_UNPACKED_DEVICE_BYTES, pack, toBase64Url, unpack, utf8 } from './codec'
import {
  DIREKT,
  istGruppe,
  liesDirektNachricht,
  liesGeraeteKlartext,
  liesGruppenInhalt,
  PROTOKOLL_FASSUNG,
  type DirektNachricht,
  type GeraeteKlartext,
  type GruppenInhalt,
  type NachrichtArt,
} from '../protokoll'

/**
 * Was über ntfy geht – als JSON-Text (aus dem Prototyp tafel, transport/ntfy/wire.ts, 16.11.2026 übernommen und
 * nach Plan §5 geändert).
 *
 * | Richtung | Schutz |
 * | --- | --- |
 * | Host → Gruppe | `secretbox` mit dem Gruppenschlüssel, Ed25519-Signatur des Hosts |
 * | Host → ein Gerät | `box` vom Host an den Schlüssel des Geräts, ebenfalls signiert |
 * | Gerät → Host | `box` vom Gerät an den Schlüssel des Hosts |
 *
 * Die Signatur ist der Kern: Den Schlüssel der öffentlichen Gruppe kennt jeder mit einem Lese-Link. Verschlüsselt
 * allein könnte also jeder Zuschauer der Tafel etwas unterschieben. Signieren kann nur der Host.
 *
 * Signiert ist neben Nonce und Chiffrat ein Kopf im Klartext: Kontext, Thema, Fassung `v`, Raum `r`, Gruppe `g`,
 * Epoche `e`, Nummer `n`, Art `a`, Sicht-Fassung `sv` und Sendezeit `hz` des Hosts. So prüft ein Gerät Fassung
 * und Alter, bevor es entschlüsselt oder einen Anhang lädt; eine Nachricht passt auf kein anderes Thema und in
 * keinen anderen Raum, und eine alte, erneut eingestellte Nachricht verliert an `n` und `hz` (Kritik K16, K17).
 *
 * Dazu trägt jede Nachricht des Hosts den **Fassungsbeleg** `fs`: eine zweite Signatur nur über Thema, Raum, `v`, `sv`
 * und `hz`, deren Format sich nie ändert ({@link belegteFassung}). Nur damit zählt eine fremde Fassung (Plan F7).
 *
 * Große Nachrichten (über 4096 Byte) legt ntfy als Anhang ab. Ein Gerät lädt einen Anhang nur, wenn eine
 * **signierte Ankündigung** (`l`: Adresse, Größe, Prüfsumme) ihn nennt – und nimmt ihn nur mit genau dieser
 * Prüfsumme (Lücke S5 des Prototyps: dort lud jedes Gerät bis 8 MB von jedem, der das Thema kannte).
 */

/** Steht vor dem, was signiert wird – damit eine Signatur nirgends sonst passt (auch nicht beim Prototyp). */
export const SIGNATUR_KONTEXT = 'alcatraz-ntfy-1'

/**
 * Kontext des Fassungsbelegs `fs`. Er und das Format des Belegs ändern sich NIE, auch nicht mit einer neuen
 * Protokollfassung: Nur so prüft ein Gerät jeder Fassung, dass ein Host einer anderen Fassung wirklich spricht.
 */
export const FASSUNG_KONTEXT = 'alcatraz-fassung'

/** Ankündigung eines Anhangs: Adresse auf dem eigenen Server, Länge in Byte, {@link textHash} des Inhalts. */
export interface Anhang {
  u: string
  b: number
  h: string
}

/** Kopf einer Host-Nachricht – alles im Klartext und signiert. */
export interface HostKopf {
  v: number
  r: string
  /** Gruppe; {@link DIREKT} für ein einzelnes Gerät. */
  g: string
  /** Epoche des Gruppenschlüssels (direkt: 0). */
  e: number
  /** Nummer: je Gruppe steigend; direkt je Raum steigend. */
  n: number
  a: NachrichtArt
  sv: number
  hz: number
}

export interface HostWire extends HostKopf {
  /** Nonce und Chiffrat – oder statt beider die Ankündigung `l`. */
  x?: string
  c?: string
  l?: Anhang
  s: string
}

/** Von einem Gerät an den Host. Im Klartext nur der öffentliche Schlüssel, ohne den die box nicht aufginge. */
export interface GeraetWire {
  v: number
  pk: string
  x: string
  c: string
}

const istZahl = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const istRaumId = (v: unknown): v is string => isBase64Url(v) && (v as string).length >= 8 && (v as string).length <= 32
const ARTEN: readonly unknown[] = ['v', 'p', 'm', 'd']

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Was der Fassungsbeleg bezeugt. Diese Felder stehen in jeder Fassung oben in der Nachricht: v, r, sv, hz, fs. */
export interface Fassung {
  v: number
  r: string
  sv: number
  hz: number
}

function fassungsText(thema: string, f: Fassung): Uint8Array {
  return utf8(JSON.stringify([FASSUNG_KONTEXT, thema, f.r, f.v, f.sv, f.hz]))
}

/**
 * Die Fassung einer Nachricht – auch wenn sonst nichts passt –, aber nur mit gültigem Beleg `fs` des Hosts. So
 * erfährt ein Gerät, dass der Host eine andere Fassung spricht (Plan F7: „Update nötig“), statt still nichts zu
 * empfangen. Früher ungeprüft: Dann brachte eine einzige Zeile `{"v":99}` auf dem Zuschauer-Thema alle Zuschauer
 * in „Update nötig“, und ein Selbst-Update ließe sich von außen auslösen (Befund E5-Prüfung 16.11.2026).
 */
export function belegteFassung(text: string, thema: string, signPublic: Uint8Array): Fassung | null {
  const w = parseJson(text)
  if (!w || !istZahl(w.v) || !istRaumId(w.r) || !istZahl(w.sv) || !istZahl(w.hz)) return null
  const fs = isBase64Url(w.fs, nacl.sign.signatureLength) ? fromBase64Url(w.fs) : null
  if (!fs) return null
  const fassung: Fassung = { v: w.v, r: w.r, sv: w.sv, hz: w.hz }
  return nacl.sign.detached.verify(fassungsText(thema, fassung), fs, signPublic) ? fassung : null
}

export function parseHostWire(text: string): HostWire | null {
  const w = parseJson(text)
  if (!w || w.v !== PROTOKOLL_FASSUNG) return null
  if (!istRaumId(w.r) || (w.g !== DIREKT && !istGruppe(w.g))) return null
  if (!istZahl(w.e) || !istZahl(w.n) || !ARTEN.includes(w.a) || !istZahl(w.sv) || !istZahl(w.hz)) return null
  if ((w.g === DIREKT) !== (w.a === 'd')) return null
  if (!isBase64Url(w.s, nacl.sign.signatureLength)) return null
  const kopf: HostKopf = { v: PROTOKOLL_FASSUNG, r: w.r, g: w.g, e: w.e, n: w.n, a: w.a as NachrichtArt, sv: w.sv, hz: w.hz }
  if (w.l !== undefined) {
    const l = w.l as Partial<Anhang> | null
    if (w.x !== undefined || w.c !== undefined || !l || typeof l !== 'object') return null
    if (typeof l.u !== 'string' || l.u.length > 512 || !istZahl(l.b) || !isBase64Url(l.h, 32)) return null
    return { ...kopf, l: { u: l.u, b: l.b, h: l.h }, s: w.s }
  }
  if (!isBase64Url(w.x, nacl.secretbox.nonceLength) || !isBase64Url(w.c)) return null
  return { ...kopf, x: w.x, c: w.c, s: w.s }
}

export function parseGeraetWire(text: string): GeraetWire | null {
  const w = parseJson(text)
  if (!w || w.v !== PROTOKOLL_FASSUNG) return null
  if (!isBase64Url(w.pk, nacl.box.publicKeyLength)) return null
  if (!isBase64Url(w.x, nacl.box.nonceLength) || !isBase64Url(w.c)) return null
  return { v: PROTOKOLL_FASSUNG, pk: w.pk, x: w.x, c: w.c }
}

// ---------------------------------------------------------------------------
// Signatur
// ---------------------------------------------------------------------------

/** Das Signierte als JSON-Liste: Jedes Feld hat seinen Platz, nichts lässt sich zwischen Feldern verschieben. */
function signierterText(thema: string, w: HostKopf & { x?: string; c?: string; l?: Anhang }): Uint8Array {
  return utf8(JSON.stringify([
    SIGNATUR_KONTEXT, thema, w.v, w.r, w.g, w.e, w.n, w.a, w.sv, w.hz,
    w.x ?? null, w.c ?? null, w.l ? [w.l.u, w.l.b, w.l.h] : null,
  ]))
}

/** Signiert die Nachricht und legt den Fassungsbeleg `fs` bei (gleich für alle Fassungen, {@link belegteFassung}). */
function signiere(thema: string, ohne: Omit<HostWire, 's'>, signSecret: Uint8Array): string {
  const s = toBase64Url(nacl.sign.detached(signierterText(thema, ohne), signSecret))
  const fs = toBase64Url(nacl.sign.detached(fassungsText(thema, ohne), signSecret))
  return JSON.stringify({ ...ohne, s, fs })
}

/** Stammt die Nachricht vom Host und gehört sie auf dieses Thema? Kostet kein Entschlüsseln. */
export function verifyHostWire(wire: HostWire, thema: string, signPublic: Uint8Array): boolean {
  const signatur = fromBase64Url(wire.s)
  if (!signatur) return false
  return nacl.sign.detached.verify(signierterText(thema, wire), signatur, signPublic)
}

// ---------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------

/** An eine Gruppe: mit dem Gruppenschlüssel verschlüsselt und signiert. */
export async function sealGruppe(
  inhalt: GruppenInhalt,
  kopf: HostKopf,
  thema: string,
  schluessel: Uint8Array,
  signSecret: Uint8Array,
): Promise<string> {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength)
  const c = toBase64Url(nacl.secretbox(await pack(inhalt), nonce, schluessel))
  return signiere(thema, { ...kopf, x: toBase64Url(nonce), c }, signSecret)
}

/** An ein Gerät: nur dessen Schlüssel öffnet es; signiert wie alles vom Host. */
export async function sealDirekt(
  nachricht: DirektNachricht,
  kopf: HostKopf,
  thema: string,
  geraetPublic: Uint8Array,
  hostBoxSecret: Uint8Array,
  signSecret: Uint8Array,
): Promise<string> {
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const c = toBase64Url(nacl.box(await pack(nachricht), nonce, geraetPublic, hostBoxSecret))
  return signiere(thema, { ...kopf, x: toBase64Url(nonce), c }, signSecret)
}

/** Kündigt einen Anhang an: derselbe Kopf wie die große Nachricht selbst, statt des Inhalts dessen Prüfsumme. */
export function sealAnkuendigung(kopf: HostKopf, thema: string, anhang: Anhang, signSecret: Uint8Array): string {
  return signiere(thema, { ...kopf, l: anhang }, signSecret)
}

/** Öffnet eine Gruppennachricht; der Inhalt muss zur signierten Art passen. */
export async function openGruppe(wire: HostWire, schluessel: Uint8Array): Promise<GruppenInhalt | null> {
  if (!wire.x || !wire.c || wire.g === DIREKT) return null
  const nonce = fromBase64Url(wire.x)
  const cipher = fromBase64Url(wire.c)
  if (!nonce || !cipher) return null
  const opened = nacl.secretbox.open(cipher, nonce, schluessel)
  if (!opened) return null
  return liesGruppenInhalt(await unpack(opened), wire.a)
}

export async function openDirekt(
  wire: HostWire,
  hostBoxPublic: Uint8Array,
  geraetSecret: Uint8Array,
): Promise<DirektNachricht | null> {
  if (!wire.x || !wire.c || wire.g !== DIREKT) return null
  const nonce = fromBase64Url(wire.x)
  const cipher = fromBase64Url(wire.c)
  if (!nonce || !cipher) return null
  const opened = nacl.box.open(cipher, nonce, hostBoxPublic, geraetSecret)
  if (!opened) return null
  return liesDirektNachricht(await unpack(opened))
}

// ---------------------------------------------------------------------------
// Gerät
// ---------------------------------------------------------------------------

export async function sealVomGeraet(
  klartext: GeraeteKlartext,
  geraet: { publicKey: Uint8Array; secretKey: Uint8Array },
  hostBoxPublic: Uint8Array,
): Promise<string> {
  const nonce = nacl.randomBytes(nacl.box.nonceLength)
  const c = nacl.box(await pack(klartext), nonce, hostBoxPublic, geraet.secretKey)
  const wire: GeraetWire = { v: PROTOKOLL_FASSUNG, pk: toBase64Url(geraet.publicKey), x: toBase64Url(nonce), c: toBase64Url(c) }
  return JSON.stringify(wire)
}

/**
 * Öffnet eine Nachricht eines Geräts. Geht sie auf, stammt sie nachweislich vom Inhaber des genannten Schlüssels
 * `pk` – ob der Host diesen Schlüssel kennt und an welche ID er gebunden ist, entscheidet der Aufrufer. Entpackt
 * wird höchstens {@link MAX_UNPACKED_DEVICE_BYTES}.
 */
export async function openVomGeraet(wire: GeraetWire, hostBoxSecret: Uint8Array): Promise<GeraeteKlartext | null> {
  const nonce = fromBase64Url(wire.x)
  const cipher = fromBase64Url(wire.c)
  const pk = fromBase64Url(wire.pk)
  if (!nonce || !cipher || !pk) return null
  const opened = nacl.box.open(cipher, nonce, pk, hostBoxSecret)
  if (!opened) return null
  return liesGeraeteKlartext(await unpack(opened, MAX_UNPACKED_DEVICE_BYTES))
}
