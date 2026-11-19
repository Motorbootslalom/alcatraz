import nacl from 'tweetnacl'
import { fromBase64Url, fromUtf8, toBase64Url, utf8 } from './transport/ntfy/codec'
import { normalisiereServer } from './themen'
import { gruppeDesLinks, liesLesePaket, linkDerGruppe, type LesePaket } from './transport/ntfy/raum'

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
 * 2. Merker: Bit 0 Zuschauer-Link (sonst Anzeigetafel), Bit 2 Server ohne `https://` (Bit 1 frei);
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

  const teile: number[] = [PAKET_FASSUNG, (welches === 'z' ? BIT_ZUSCHAUER : 0) | (https ? BIT_HTTPS : 0)]
  for (let e = paket.e; ; ) {
    const unten = e % 128
    e = Math.floor(e / 128)
    teile.push(e > 0 ? unten | 128 : unten)
    if (e === 0) break
  }
  teile.push(r.length, ...r, t.length, ...t, ...k, ...s, serverBytes.length, ...serverBytes)
  const daten = Uint8Array.from(teile)
  const ganz = new Uint8Array(daten.length + PRUEF)
  ganz.set(daten, 0)
  ganz.set(pruefsumme(daten), daten.length)
  return toBase64Url(ganz)
}

/** Liest das Paket aus der Adresse – geprüft (Prüfsumme, Felder wie raum.ts liesLesePaket). Wirft nie. */
export function liesLeseLink(text: unknown): LeseLink {
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
    if (i !== daten.length || merker & ~(BIT_ZUSCHAUER | BIT_HTTPS)) return kaputt
    const welches = merker & BIT_ZUSCHAUER ? 'z' : 'a'
    const paket = liesLesePaket({ u, r, t, g: gruppeDesLinks(welches), k, e, s })
    return paket ? { ok: true, paket, welches } : kaputt
  } catch {
    return kaputt
  }
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
