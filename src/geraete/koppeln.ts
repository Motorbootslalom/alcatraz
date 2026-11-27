import nacl from 'tweetnacl'
import { liesAufgaben, type Aufgabe } from './aufgaben'
import { istThema, koppelThema, zufallsThema } from './themen'

/**
 * Koppeln von Geräten für die Start-Freigabe (Etappe E7, Plan vom 16.11.2026 §5; aus tafel lib/pairing.ts, Lastenheft
 * der Tafel P-3/P-4). Rein bis auf den Zufall; der Stand liegt im Raum des Hosts (raum.koppeln, gerätelokal,
 * geraete/ablage.ts), geschrieben nur vom Führungsfenster.
 *
 * Zwei Wege mit bewusst verschiedener Lebensdauer:
 * - **QR-Code**: Der Token darin wechselt alle {@link QR_TOKEN_GUELTIG_MS}; wer den Bildschirm nicht sieht, kann mit
 *   einem abfotografierten Code bald nichts mehr anfangen. Der vorige bleibt {@link QR_GNADE_MS} gültig, damit ein
 *   Scan im Augenblick des Wechsels nicht ins Leere läuft. Das Koppel-Thema der QR-Sitzung ist zufällig und steht im
 *   QR-Paket (Plan §5 „QR-Weg zufällig im Paket“); es gilt, solange die Sitzung offen ist (höchstens
 *   {@link QR_SITZUNG_MS}).
 * - **Geräte-Code**: {@link CODE_LAENGE} Zeichen, {@link CODE_GUELTIG_MS} gültig und nur für EIN Gerät – zum
 *   Vorlesen über Funk, wenn niemand am Bedienrechner steht. Das Gerät braucht dazu den Koppel-Link (Raum, Server,
 *   Schlüssel des Hosts, geraete/paket.ts) und tippt den Code; sein Thema ist H(oA ‖ 'koppeln' ‖ code)
 *   (themen.ts koppelThema). Hört jemand mit und ist schneller, scheitert das richtige Handy sofort, und das fremde
 *   steht in der Geräteliste – statt dass beide unbemerkt hineinkommen.
 *
 * Gegenüber dem Prototyp: kein Dauercode (Entscheidung F3 vom 16.11.2026: Anzeigetafel und Zuschauer über Lese-Links),
 * kein Rückfall auf Math.random (tweetnacl hat immer einen sicheren Zufall), Zeichen ohne Modulo-Schieflage, ein Code
 * gilt nur auf seinem Thema, Gründe als Codes. Die Rechte bestimmt der Bedienrechner beim Ausgeben – das Gerät kennt
 * nur den Code.
 */

/**
 * Alphabet ohne verwechselbare Zeichen: Aus jedem Paar bleibt die Ziffer (0, 1, 2, 5, 8), O, I, L, Z, S, B fehlen –
 * so ist die Nachsicht beim Tippen eindeutig (wer „O“ tippt, meinte die 0). U fehlt, damit keine unglücklichen Wörter
 * entstehen. 29 Zeichen; 6 davon ≈ 29 Bit – genug für 5 Minuten und ein Gerät, nicht für mehr.
 */
export const CODE_ALPHABET = '0123456789ACDEFGHJKMNPQRTVWXY'

/** Was Leute stattdessen tippen, wenn sie den Code ablesen. */
const VERWECHSLUNGEN: Record<string, string> = { I: '1', L: '1', O: '0', B: '8', S: '5', Z: '2', U: 'V' }

export const CODE_LAENGE = 6
export const CODE_GUELTIG_MS = 5 * 60_000
/** QR-Token: länger, weil er nicht getippt wird (16 Zeichen ≈ 77 Bit). */
export const TOKEN_LAENGE = 16
export const QR_TOKEN_GUELTIG_MS = 30_000
/**
 * Gnade des vorigen Tokens: so lang wie seine Gültigkeit (Prüfung E7, 20.11.2026, vorher 10 s; bestätigt
 * 27.11.2026, R13-07: „ein Foto davon gilt höchstens eine Minute“). Geprüft wird erst beim Eingang am Host, gesendet erst nach Einstieg und Abo: Ein Handy, das die App zum
 * ersten Mal ohne Cache über Mobilfunk lädt, braucht dafür leicht mehr als 10 s. Ein abfotografierter Code gilt so
 * höchstens eine Minute.
 */
export const QR_GNADE_MS = 30_000
/**
 * So lange bleibt eine QR-Sitzung offen, wenn niemand sie schließt (Fenster zu, Bedienrechner verlassen): Danach
 * wechselt kein Token mehr, und das Koppel-Thema wird nicht mehr gelesen. Auslegung beim Bau von E7, 20.11.2026, bestätigt
 * 27.11.2026 (R13-15 (8); BETRIEB_ANNAHMEN.koppelnZeiten).
 */
export const QR_SITZUNG_MS = 10 * 60_000
/**
 * So lange liest der Host ein Koppel-Thema nach dem Ablauf noch mit: Kam das `willkommen` eines eben gekoppelten
 * Geräts nicht an, meldet es sich dort noch einmal – und wird erneut begrüßt (transport.ts, gebunden über ein
 * Koppel-Thema). Annahmen ohne gültigen Code gibt es in der Zeit nicht. Auslegung 20.11.2026, bestätigt 26.11.2026
 * (R11-21): danach liest niemand mehr mit, das Handy zeigt nach 15 s „Keine Antwort“.
 */
export const KOPPEL_NACHLAUF_MS = 2 * 60_000

/** Der laufende Geräte-Code. */
export interface CodeTicket {
  wert: string
  /** Koppel-Thema des Codes: H(oA ‖ 'koppeln' ‖ wert). */
  thema: string
  bis: number
  aufgaben: Aufgabe[]
  /** Wann ein Gerät ihn benutzt hat; danach gilt er für kein weiteres. */
  benutzt: number | null
}

/** Eine offene QR-Sitzung: festes Thema, wechselnder Token. */
export interface QrSitzung {
  thema: string
  endet: number
  aufgaben: Aufgabe[]
  token: string
  tokenBis: number
  /** Der abgelöste Token, noch bis `vorherBis` gültig. */
  vorher: string | null
  vorherBis: number
}

export interface KoppelStand {
  code: CodeTicket | null
  qr: QrSitzung | null
}

export const leererKoppelStand = (): KoppelStand => ({ code: null, qr: null })

/** Zufällige Zeichen aus dem Alphabet – per Verwerfen ohne Schieflage (256 ist kein Vielfaches von 29). */
export function zufallsZeichen(laenge: number, alphabet = CODE_ALPHABET, zufall: (n: number) => Uint8Array = nacl.randomBytes): string {
  const grenze = 256 - (256 % alphabet.length)
  let aus = ''
  while (aus.length < laenge) {
    for (const b of zufall(laenge * 2)) {
      if (b >= grenze) continue
      aus += alphabet[b % alphabet.length]
      if (aus.length === laenge) break
    }
  }
  return aus
}

/**
 * Eingabe → kanonischer Code: Groß/klein egal, Leerzeichen und Bindestriche raus, typische Verwechslungen
 * korrigiert. `null`, wenn danach kein Code dieser Länge aus dem Alphabet übrig bleibt.
 */
export function normalisiereCode(roh: string, laenge = CODE_LAENGE): string | null {
  const sauber = roh
    .toUpperCase()
    .replace(/[\s\-_.]/g, '')
    .split('')
    .map((c) => VERWECHSLUNGEN[c] ?? c)
    .join('')
  if (sauber.length !== laenge) return null
  for (const c of sauber) if (!CODE_ALPHABET.includes(c)) return null
  return sauber
}

/** Code in zwei gut ablesbare Blöcke: „A3F-K7M“. */
export function formatiereCode(code: string): string {
  const haelfte = Math.ceil(code.length / 2)
  return `${code.slice(0, haelfte)}-${code.slice(haelfte)}`
}

/** Einen neuen Geräte-Code ausgeben – ein bisheriger gilt sofort nicht mehr. `oA` = Thema der Anzeigetafel. */
export function gibCode(stand: KoppelStand, oA: string, aufgaben: Aufgabe[], jetzt: number): KoppelStand {
  let wert = zufallsZeichen(CODE_LAENGE)
  while (wert === stand.code?.wert) wert = zufallsZeichen(CODE_LAENGE)
  return { ...stand, code: { wert, thema: koppelThema(oA, wert), bis: jetzt + CODE_GUELTIG_MS, aufgaben, benutzt: null } }
}

/** Eine QR-Sitzung öffnen (oder neu öffnen: neues Thema, neue Rechte). */
export function oeffneQr(stand: KoppelStand, aufgaben: Aufgabe[], jetzt: number): KoppelStand {
  return {
    ...stand,
    qr: { thema: zufallsThema(), endet: jetzt + QR_SITZUNG_MS, aufgaben, token: zufallsZeichen(TOKEN_LAENGE), tokenBis: jetzt + QR_TOKEN_GUELTIG_MS, vorher: null, vorherBis: 0 },
  }
}

/** Muss der QR-Token wechseln? `vorlaufMs`: so früh vor dem Ablauf (der Takt des Hosts), damit keine Lücke entsteht. */
export function qrFaellig(stand: KoppelStand, jetzt: number, vorlaufMs = 0): boolean {
  return !!stand.qr && jetzt < stand.qr.endet && jetzt >= stand.qr.tokenBis - vorlaufMs
}

/** Neuer QR-Token; der bisherige bleibt im Gnadenfenster gültig. Ohne offene Sitzung unverändert. */
export function dreheQr(stand: KoppelStand, jetzt: number): KoppelStand {
  const qr = stand.qr
  if (!qr || jetzt >= qr.endet) return stand
  return { ...stand, qr: { ...qr, vorher: qr.token, vorherBis: Math.min(jetzt, qr.tokenBis) + QR_GNADE_MS, token: zufallsZeichen(TOKEN_LAENGE), tokenBis: jetzt + QR_TOKEN_GUELTIG_MS } }
}

/** Koppeln beenden: Code, QR-Sitzung oder beides. */
export function schliesseKoppeln(stand: KoppelStand, was: 'code' | 'qr' | 'alle' = 'alle'): KoppelStand {
  return { code: was === 'qr' ? stand.code : null, qr: was === 'code' ? stand.qr : null }
}

/** Ein Gerät hat sich mit dem Code gekoppelt – für ein weiteres gilt er nicht. */
export function markiereBenutzt(stand: KoppelStand, jetzt: number): KoppelStand {
  if (!stand.code || stand.code.benutzt !== null) return stand
  return { ...stand, code: { ...stand.code, benutzt: jetzt } }
}

/** Abgelaufenes samt Nachlauf weg – so wächst der Raum nicht und die Themen enden. */
export function raeumeAuf(stand: KoppelStand, jetzt: number): KoppelStand {
  const code = stand.code && jetzt < stand.code.bis + KOPPEL_NACHLAUF_MS ? stand.code : null
  const qr = stand.qr && jetzt < stand.qr.endet + KOPPEL_NACHLAUF_MS ? stand.qr : null
  return code === stand.code && qr === stand.qr ? stand : { code, qr }
}

/**
 * Koppel-Themen, die der Host lesen muss: solange Code bzw. Sitzung gelten, und {@link KOPPEL_NACHLAUF_MS} danach
 * (erneute Anmeldung eines eben gekoppelten Geräts, dessen willkommen verloren ging). Danach nicht mehr – das drosselt
 * Fluten (S6) von selbst.
 */
export function koppelThemen(stand: KoppelStand, jetzt: number): string[] {
  const themen: string[] = []
  if (stand.code && jetzt < stand.code.bis + KOPPEL_NACHLAUF_MS) themen.push(stand.code.thema)
  if (stand.qr && jetzt < stand.qr.endet + KOPPEL_NACHLAUF_MS) themen.push(stand.qr.thema)
  return themen
}

export type KoppelPruefung =
  | { ok: true; aufgaben: Aufgabe[]; weg: 'code' | 'qr' }
  | { ok: false; grund: 'code-ungueltig' | 'code-abgelaufen' }

/**
 * Prüft den Code einer Anmeldung. Er gilt nur auf seinem eigenen Koppel-Thema (`thema`, über das die Anmeldung kam):
 * Ein QR-Token auf dem Thema eines Geräte-Codes zählt nicht und umgekehrt. `code-abgelaufen`: Es war der richtige,
 * aber er ist abgelaufen oder (Geräte-Code) schon benutzt – die Oberfläche bittet um einen neuen.
 */
export function pruefeKoppeln(stand: KoppelStand, roh: string, thema: string, jetzt: number): KoppelPruefung {
  const wert = roh.trim()
  const qr = stand.qr
  if (qr && thema === qr.thema && wert) {
    if (wert === qr.token) return jetzt < qr.tokenBis && jetzt < qr.endet ? { ok: true, aufgaben: qr.aufgaben, weg: 'qr' } : { ok: false, grund: 'code-abgelaufen' }
    if (wert === qr.vorher) return jetzt < qr.vorherBis && jetzt < qr.endet ? { ok: true, aufgaben: qr.aufgaben, weg: 'qr' } : { ok: false, grund: 'code-abgelaufen' }
  }
  const code = stand.code
  const normal = normalisiereCode(wert)
  if (code && normal === code.wert && thema === code.thema) {
    return jetzt < code.bis && code.benutzt === null ? { ok: true, aufgaben: code.aufgaben, weg: 'code' } : { ok: false, grund: 'code-abgelaufen' }
  }
  return { ok: false, grund: 'code-ungueltig' }
}

const istZeit = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
const istObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const istWert = (v: unknown, laenge: number): v is string => typeof v === 'string' && v.length === laenge && [...v].every((c) => CODE_ALPHABET.includes(c))

/** Den Koppel-Stand aus dem Raum lesen; Kaputtes gilt als nicht ausgegeben. */
export function liesKoppelStand(wert: unknown): KoppelStand {
  if (!istObjekt(wert)) return leererKoppelStand()
  const c = wert.code
  const q = wert.qr
  const code: CodeTicket | null =
    istObjekt(c) && istWert(c.wert, CODE_LAENGE) && istThema(c.thema) && istZeit(c.bis) && (c.benutzt === null || istZeit(c.benutzt))
      ? { wert: c.wert, thema: c.thema, bis: c.bis, aufgaben: liesAufgaben(c.aufgaben), benutzt: c.benutzt as number | null }
      : null
  const qr: QrSitzung | null =
    istObjekt(q) && istThema(q.thema) && istZeit(q.endet) && istWert(q.token, TOKEN_LAENGE) && istZeit(q.tokenBis) &&
    (q.vorher === null || istWert(q.vorher, TOKEN_LAENGE)) && istZeit(q.vorherBis)
      ? { thema: q.thema, endet: q.endet, aufgaben: liesAufgaben(q.aufgaben), token: q.token, tokenBis: q.tokenBis, vorher: q.vorher as string | null, vorherBis: q.vorherBis }
      : null
  return { code, qr }
}

/** Verbleibende Sekunden (0, wenn abgelaufen) – für die Anzeige am Bedienrechner. */
export function restSekunden(bis: number, jetzt: number): number {
  return Math.max(0, Math.ceil((bis - jetzt) / 1000))
}
