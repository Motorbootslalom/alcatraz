import nacl from 'tweetnacl'
import { toBase64Url, utf8 } from './transport/ntfy/codec'

/**
 * Themen (ntfy-„Topics“) eines Raums und die Vorgabe des Servers.
 *
 * Wer ein Thema kennt, kann dort lesen und schreiben – ntfy prüft nichts. Deshalb steht in einem Link nur
 * das eine öffentliche Thema, das er braucht (Kritik K13 zum Plan vom 16.11.2026):
 *
 * | Thema | Zweck | entsteht |
 * | --- | --- | --- |
 * | oA | öffentliche Sicht, Anzeigetafel-Link | zufällig (16 Byte), nur im Tafel-Link |
 * | oZ | öffentliche Sicht, Zuschauer-Link | zufällig, nur im Zuschauer-Link – erneuerbar, ohne die Tafel zu stören |
 * | g | Geräte → Host | abgeleitet H(geheimnis ‖ 'g'), nur per `willkommen` (box) |
 * | d· | Host → ein Gerät | abgeleitet H(geheimnis ‖ 'd' ‖ id), nur per `willkommen` |
 * | k· | eine nicht öffentliche Gruppe (später je Liste) | abgeleitet H(geheimnis ‖ 'k' ‖ gruppe) |
 * | kp· | Koppeln, solange ein Code gilt (E7) | H(oA ‖ 'koppeln' ‖ code) bzw. zufällig im QR |
 *
 * Abgeleitet wird mit `nacl.hash` (SHA-512) statt HMAC, weil tweetnacl kein HMAC hat: Für Themennamen aus
 * einem geheimen Präfix ohne Daten eines Angreifers genügt das (Plan, „Verworfene Kritikpunkte“ K13).
 */

/**
 * Vorgabe des ntfy-Servers. Entscheidung des Nutzers vom 11.11.2026, bestätigt am 16.11.2026
 * (docs/entscheidungen.md „Betrieb und Offline“): ntfy.adminforge.de, in den Einstellungen änderbar (Lastenheft
 * der Tafel P-9). ntfy.sh scheidet aus – ohne Konto nur 250 Nachrichten je Tag und IP. Die einzige Stelle im
 * Code: Transport und Raum bekommen den Server immer als Parameter (die Einstellung baut E6).
 */
export const NTFY_VORGABE = 'https://ntfy.adminforge.de'

/** Länge eines Themas: 22 Zeichen Base64url = 132 Bit – zu lang zum Raten, kurz genug für Links. */
export const THEMA_LAENGE = 22

/** Themen-Namen, wie ntfy sie annimmt (höchstens 64 Zeichen, nur Base64url-Zeichen). */
const THEMA_MUSTER = /^[A-Za-z0-9_-]{16,64}$/

export function istThema(wert: unknown): wert is string {
  return typeof wert === 'string' && THEMA_MUSTER.test(wert)
}

/** Ein öffentliches Thema: reiner Zufall, ohne Bezug zu Raum oder Geheimnis. */
export function zufallsThema(): string {
  return toBase64Url(nacl.randomBytes(16))
}

/**
 * H(präfix ‖ 0 ‖ teil ‖ 0 ‖ teil …), gekürzt auf {@link THEMA_LAENGE}. Die Null-Bytes trennen die Teile
 * eindeutig: Sonst ergäbe 'd' + 'g1' dasselbe wie 'dg' + '1'.
 */
function abgeleitet(praefix: Uint8Array, teile: readonly string[]): string {
  const stuecke = teile.map((t) => utf8(t))
  const laenge = praefix.length + stuecke.reduce((summe, s) => summe + 1 + s.length, 0)
  const eingabe = new Uint8Array(laenge)
  eingabe.set(praefix, 0)
  let stelle = praefix.length
  for (const s of stuecke) {
    eingabe[stelle] = 0
    eingabe.set(s, stelle + 1)
    stelle += 1 + s.length
  }
  return toBase64Url(nacl.hash(eingabe)).slice(0, THEMA_LAENGE)
}

/** g: Geräte schreiben an den Host. Kennen nur gekoppelte Geräte – steht nie in einem Link. */
export function geraeteThema(geheimnis: Uint8Array): string {
  return abgeleitet(geheimnis, ['g'])
}

/** d·: der Host schreibt an genau ein Gerät. Die Geräte-ID steht so in keiner Adresse. */
export function direktThema(geheimnis: Uint8Array, geraetId: string): string {
  return abgeleitet(geheimnis, ['d', geraetId])
}

/** k·: Thema einer nicht öffentlichen Gruppe (später je Liste, Plan §5 K31). */
export function gruppenThema(geheimnis: Uint8Array, gruppe: string): string {
  return abgeleitet(geheimnis, ['k', gruppe])
}

/**
 * kp·: Thema für das Koppeln per Geräte-Code (E7). Abgeleitet vom Tafel-Thema, weil das Gerät nur den Code
 * und den Tafel-Link kennt; es gilt nur, solange der Code gilt – das drosselt Fluten (S6) von selbst.
 */
export function koppelThema(oA: string, code: string): string {
  return abgeleitet(utf8(oA), ['koppeln', code])
}

/**
 * `https://ntfy.example.org/` → `https://ntfy.example.org`; `null`, wenn es keine http(s)-Adresse ist.
 * Ohne Schema gilt https – so tippt man den Server ein.
 */
export function normalisiereServer(roh: string): string | null {
  const getrimmt = roh.trim().replace(/\/+$/, '')
  if (!getrimmt) return null
  try {
    const url = new URL(getrimmt.includes('://') ? getrimmt : `https://${getrimmt}`)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.search || url.hash || url.username || url.password) return null
    return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}
