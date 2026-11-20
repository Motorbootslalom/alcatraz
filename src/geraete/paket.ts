import nacl from 'tweetnacl'
import { fromBase64Url, fromUtf8, toBase64Url, utf8 } from './transport/ntfy/codec'
import { istThema, normalisiereServer } from './themen'
import { gruppeDesLinks, lesePaket, liesLesePaket, linkDerGruppe, type HostRaum, type LesePaket } from './transport/ntfy/raum'

/**
 * Das Paket eines Lese-Links in der Adresse (`#/sehen/<paket>`, Etappe E6, 16.11.2026): Anzeigetafel oder
 * Zuschauerliste auf einem fremden Gerät, ohne Kopplung (Entscheidung des Nutzers vom 16.11.2026, F3).
 *
 * Gepackt statt als JSON, damit der QR-Code klein bleibt (Handy am Steg, Aushang auf A4): Bytes, Base64url, rund
 * 155 Zeichen mit dem Vorgabe-Server. Mit der Adresse der Seite davor (Pages, um 50 Zeichen) passt das in einen
 * QR-Code der Version 10 (Fehlerkorrektur M, 213 Byte).
 *
 * Der Server steht immer darin, auch die Vorgabe: Ein Gerät lädt immer das neueste Programm (Pages), der Host läuft
 * oft als ältere Datei – änderte sich die Vorgabe (themen.ts NTFY_VORGABE), läse ein Gerät sonst auf einem anderen
 * Server als der Host und wartete still (Entscheidung beim Bau von E6, 16.11.2026).
 *
 * Bytes der Reihe nach:
 * 1. Fassung des Pakets ({@link PAKET_FASSUNG});
 * 2. Merker: Bit 0 Zuschauer-Link (sonst Anzeigetafel), Bit 2 Server ohne `https://`; E7: Bit 1 Koppel-Link, Bit 3 mit
 *    QR-Token (siehe {@link packeKoppelPaket});
 * 3. Epoche des Gruppenschlüssels (LEB128), Raum-ID und Thema (je Länge + Bytes), Gruppenschlüssel (32 Byte),
 *    Signaturschlüssel des Hosts (32 Byte), Server (Länge + UTF-8);
 * 4. Prüfsumme: die ersten 4 Byte von SHA-512 über alles davor.
 *
 * Die Prüfsumme fängt Abschreib- und Kopierfehler ab (ein abgeschnittener Link), nicht Absicht: Wer den Link
 * austauscht, schiebt einen anderen Host unter – dagegen hilft der Fingerabdruck, den Host und Gerät zeigen (Plan §8).
 * Die Gruppe steht nicht darin: Sie folgt aus dem Merker (Anzeigetafel `ko`, Zuschauer `kz`).
 */

export const PAKET_FASSUNG = 1

/** Das Wort der Adresse: `#/sehen/<paket>` – in jeder Sprache dasselbe, ein Link kennt die Sprache des Geräts nicht. */
export const SEHEN = 'sehen'

const PRUEF = 4
const SCHLUESSEL = 32
const BIT_ZUSCHAUER = 1
const BIT_HTTPS = 4

/** Ein gelesenes Paket – oder warum nicht. `fassung`: ein Paket einer anderen Fassung (Plan F7: Update nötig). */
export type LeseLink =
  | { ok: true; paket: LesePaket; welches: 'a' | 'z' }
  | { ok: false; code: 'link-ungueltig' }
  | { ok: false; code: 'fassung'; fassung: number }

function base64Bytes(text: string): Uint8Array {
  const b = fromBase64Url(text)
  // Nur, was genau so zurückkommt: Sonst hätte das gelesene Paket eine andere Raum-ID als der Raum.
  if (!b || toBase64Url(b) !== text) throw new Error('paket-feld')
  return b
}

function pruefsumme(daten: Uint8Array): Uint8Array {
  return nacl.hash(daten).subarray(0, PRUEF)
}

/** Packt ein Lese-Paket (raum.ts lesePaket) für die Adresse. Wirft, wenn ein Feld sich nicht packen lässt. */
export function packeLesePaket(paket: LesePaket): string {
  const welches = linkDerGruppe(paket.g)
  if (!welches) throw new Error('paket-gruppe')
  return packe(paket, welches === 'z' ? BIT_ZUSCHAUER : 0, [])
}

/** Bytes eines Pakets: Kopf und Lese-Teil wie oben, dann `mehr` (Koppel-Link, E7), dann die Prüfsumme. */
function packe(paket: LesePaket, merker: number, mehr: number[]): string {
  const server = normalisiereServer(paket.u)
  if (!server) throw new Error('paket-server')
  const r = base64Bytes(paket.r)
  const t = base64Bytes(paket.t)
  const k = base64Bytes(paket.k)
  const s = base64Bytes(paket.s)
  if (r.length > 255 || t.length > 255 || k.length !== SCHLUESSEL || s.length !== SCHLUESSEL) throw new Error('paket-feld')
  const https = server.startsWith('https://')
  const serverBytes = utf8(https ? server.slice('https://'.length) : server)
  if (serverBytes.length > 255) throw new Error('paket-server')

  const teile: number[] = [PAKET_FASSUNG, merker | (https ? BIT_HTTPS : 0)]
  for (let e = paket.e; ; ) {
    const unten = e % 128
    e = Math.floor(e / 128)
    teile.push(e > 0 ? unten | 128 : unten)
    if (e === 0) break
  }
  teile.push(r.length, ...r, t.length, ...t, ...k, ...s, serverBytes.length, ...serverBytes, ...mehr)
  const daten = Uint8Array.from(teile)
  const ganz = new Uint8Array(daten.length + PRUEF)
  ganz.set(daten, 0)
  ganz.set(pruefsumme(daten), daten.length)
  return toBase64Url(ganz)
}

/** Gelesene Bytes nach Prüfsumme und Fassung: Merker, Lese-Teil, und ein Leser für den Rest. */
type Roh =
  | { ok: true; merker: number; paket: LesePaket; nimm: (n: number) => Uint8Array; fertig: () => boolean }
  | { ok: false; code: 'link-ungueltig' }
  | { ok: false; code: 'fassung'; fassung: number }

function entpacke(text: unknown, erlaubt: number, gruppe: (merker: number) => string): Roh {
  const kaputt = { ok: false, code: 'link-ungueltig' } as const
  if (typeof text !== 'string' || text.length < 8 || text.length > 1024) return kaputt
  const ganz = fromBase64Url(text.trim())
  if (!ganz || ganz.length < 2 + PRUEF) return kaputt
  const daten = ganz.subarray(0, ganz.length - PRUEF)
  const summe = ganz.subarray(ganz.length - PRUEF)
  if (!pruefsumme(daten).every((b, i) => b === summe[i])) return kaputt
  // Erst nach der Prüfsumme: Eine verstümmelte Adresse soll nicht „Update nötig“ melden.
  if (daten[0] !== PAKET_FASSUNG) return { ok: false, code: 'fassung', fassung: daten[0] }
  try {
    let i = 1
    const nimm = (n: number): Uint8Array => {
      if (i + n > daten.length) throw new Error('kurz')
      const stueck = daten.subarray(i, i + n)
      i += n
      return stueck
    }
    const merker = nimm(1)[0]
    if (merker & ~erlaubt) return kaputt
    let e = 0
    for (let faktor = 1; ; faktor *= 128) {
      const b = nimm(1)[0]
      e += (b & 127) * faktor
      if (!(b & 128)) break
      if (faktor > 2 ** 28) throw new Error('epoche')
    }
    const r = toBase64Url(nimm(nimm(1)[0]))
    const t = toBase64Url(nimm(nimm(1)[0]))
    const k = toBase64Url(nimm(SCHLUESSEL))
    const s = toBase64Url(nimm(SCHLUESSEL))
    const roh = fromUtf8(nimm(nimm(1)[0]))
    const u = merker & BIT_HTTPS ? `https://${roh}` : roh
    const paket = liesLesePaket({ u, r, t, g: gruppe(merker), k, e, s })
    return paket ? { ok: true, merker, paket, nimm, fertig: () => i === daten.length } : kaputt
  } catch {
    return kaputt
  }
}

/** Liest das Paket aus der Adresse – geprüft (Prüfsumme, Felder wie raum.ts liesLesePaket). Wirft nie. */
export function liesLeseLink(text: unknown): LeseLink {
  const kaputt = { ok: false, code: 'link-ungueltig' } as const
  const roh = entpacke(text, BIT_ZUSCHAUER | BIT_HTTPS, (m) => gruppeDesLinks(m & BIT_ZUSCHAUER ? 'z' : 'a'))
  if (!roh.ok) return roh
  if (!roh.fertig()) return kaputt
  return { ok: true, paket: roh.paket, welches: roh.merker & BIT_ZUSCHAUER ? 'z' : 'a' }
}

// ---------------------------------------------------------------------------
// Koppel-Link (E7)
// ---------------------------------------------------------------------------

/**
 * Was ein Gerät zum Koppeln für die Start-Freigabe braucht (E7, 20.11.2026): alles eines Anzeigetafel-Links (die
 * Start-Freigabe liest die öffentliche Sicht auf oA, Plan §5), dazu den Box-Schlüssel des Hosts (`b`) – nur damit
 * kann es dem Host schreiben. Ohne `q` ist es der **Koppel-Link** für den Geräte-Code (wird verteilt, der Code
 * kommt über Funk; Thema H(oA ‖ 'koppeln' ‖ code)); mit `q` der **QR-Code** des Bedienrechners: Token (30 s) und
 * das zufällige Thema der QR-Sitzung (geraete/koppeln.ts). Kein Geheimnis darin außer dem kurzlebigen Token – die
 * Schlüssel sind öffentlich, die Rechte bestimmt allein der Host.
 */
export interface KoppelPaket extends LesePaket {
  b: string
  q?: { token: string; thema: string }
}

export type KoppelLink =
  | { ok: true; paket: KoppelPaket }
  | { ok: false; code: 'link-ungueltig' }
  | { ok: false; code: 'fassung'; fassung: number }

/** Das Wort der Adresse eines Koppel-Links bzw. QR-Codes: `#/koppeln/<paket>` (in jeder Sprache gleich). */
export const KOPPELN = 'koppeln'

const BIT_KOPPELN = 2
const BIT_QR = 8
const TOKEN_HOECHSTENS = 64

/** Packt einen Koppel-Link (bzw. mit `q` den Inhalt des QR-Codes). Wirft, wenn ein Feld sich nicht packen lässt. */
export function packeKoppelPaket(paket: KoppelPaket): string {
  if (paket.g !== gruppeDesLinks('a')) throw new Error('paket-gruppe')
  const b = base64Bytes(paket.b)
  if (b.length !== SCHLUESSEL) throw new Error('paket-feld')
  const mehr = [...b]
  if (paket.q) {
    const token = utf8(paket.q.token)
    const thema = base64Bytes(paket.q.thema)
    if (!token.length || token.length > TOKEN_HOECHSTENS || thema.length > 255) throw new Error('paket-feld')
    mehr.push(token.length, ...token, thema.length, ...thema)
  }
  return packe(paket, BIT_KOPPELN | (paket.q ? BIT_QR : 0), mehr)
}

/** Liest einen Koppel-Link – ein Lese-Link ist keiner (und umgekehrt). Wirft nie. */
export function liesKoppelLink(text: unknown): KoppelLink {
  const kaputt = { ok: false, code: 'link-ungueltig' } as const
  const roh = entpacke(text, BIT_KOPPELN | BIT_QR | BIT_HTTPS, () => gruppeDesLinks('a'))
  if (!roh.ok) return roh
  if (!(roh.merker & BIT_KOPPELN)) return kaputt
  try {
    const paket: KoppelPaket = { ...roh.paket, b: toBase64Url(roh.nimm(SCHLUESSEL)) }
    if (roh.merker & BIT_QR) {
      const tokenLaenge = roh.nimm(1)[0]
      if (!tokenLaenge || tokenLaenge > TOKEN_HOECHSTENS) return kaputt
      const token = fromUtf8(roh.nimm(tokenLaenge))
      const thema = toBase64Url(roh.nimm(roh.nimm(1)[0]))
      if (!istThema(thema)) return kaputt
      paket.q = { token, thema }
    }
    return roh.fertig() ? { ok: true, paket } : kaputt
  } catch {
    return kaputt
  }
}

/** Der Anker eines Koppel-Links: `#/koppeln/<paket>`. */
export function koppelnAdresse(text: string): string {
  return `#/${KOPPELN}/${text}`
}

/** Der Anker eines Lese-Links: `#/sehen/<paket>`. Davor gehört die Adresse der Seite (unter file:// die von Pages). */
export function sehenAdresse(text: string): string {
  return `#/${SEHEN}/${text}`
}

/** Wo die Seite des Bedienrechners liegt – `location` oder ein Teil davon (Tests). */
export interface SeitenOrt {
  protocol: string
  origin: string
  pathname: string
}

/**
 * Der ganze Lese-Link für QR-Code und Kopieren: die Seite des Bedienrechners ohne Anfrage und Anker, dahinter
 * {@link sehenAdresse}. Läuft der Bedienrechner nicht über http(s) – die Ein-Datei-Fassung von `file://` –, zeigt der
 * Link auf die App auf Pages (`pages`, lib/build.ts PAGES_URL): Eine Datei auf dem Stick erreicht kein Handy, und
 * das Paket trägt alles, was das Gerät braucht (Server, Thema, Schlüssel). Dort läuft oft eine neuere Fassung –
 * dann meldet das Gerät „Bedienrechner aktualisieren“ (F7).
 */
export function leseLinkUrl(paket: string, seite: SeitenOrt, pages: string): string {
  const basis = seite.protocol === 'https:' || seite.protocol === 'http:' ? `${seite.origin}${seite.pathname}` : pages
  return `${basis}${sehenAdresse(paket)}`
}

/**
 * Der ganze Koppel-Link (E7) für QR-Code und Kopieren – wie {@link leseLinkUrl}, mit `#/koppeln/<paket>`. Mit einem
 * QR-Token im Paket ist es der Inhalt des wechselnden QR-Codes der QR-Sitzung.
 */
export function koppelLinkUrl(paket: string, seite: SeitenOrt, pages: string): string {
  const basis = seite.protocol === 'https:' || seite.protocol === 'http:' ? `${seite.origin}${seite.pathname}` : pages
  return `${basis}${koppelnAdresse(paket)}`
}

/**
 * Adresse eines gekoppelten Geräts ohne Paket (E7): Nach dem Lesen des Koppel-Links ersetzt GeraetApp die Adresse
 * hierdurch – der QR-Token soll nicht in Verlauf und Lesezeichen stehen; die Kopplung liegt gerätelokal (ablage.ts).
 */
export const GERAET = 'geraet'

/** Der Koppel-Link eines Raums – mit `q` der Inhalt des QR-Codes einer laufenden QR-Sitzung (E7). */
export function koppelPaketAus(raum: HostRaum, q?: { token: string; thema: string }): KoppelPaket {
  return { ...lesePaket(raum, 'a'), b: raum.box.pk, ...(q ? { q } : {}) }
}
