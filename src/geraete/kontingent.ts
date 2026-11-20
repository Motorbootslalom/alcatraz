import { ABLAGE, type Ablage } from './ablage'

/**
 * Kontingent-Zähler des Bedienrechners (Etappe E8, gebaut 20.11.2026): Wie viele Nachrichten dieser Browser heute an
 * den ntfy-Server geschickt hat, wie viele Anfragen insgesamt, und wann der Server zuletzt „zu viele Anfragen“ (429)
 * gemeldet hat. Gerätelokal (ABLAGE.kontingent, nie im AppState), Tageswechsel nach lokaler Zeit.
 *
 * Öffentliche ntfy-Server begrenzen ohne Konto je IP-Adresse (`visitor-message-daily-limit`). Abgefragt über
 * `/v1/account` (November 2026, Analyse des Tafel-Prototyps, vom Nutzer am 21.11.2026 bestätigt): ntfy.adminforge.de
 * (NTFY_VORGABE) 17 280 Nachrichten am Tag, ntfy.sh 250. Für andere Server ist die Grenze unbekannt – dann wird nur
 * gezählt, gewarnt erst, wenn der Server wirklich bremst (429). {@link tagesGrenze}.
 *
 * Überschlag eines Wettkampftags (20.11.2026, Host = Bedienrechner; Geräte senden von ihrer eigenen IP – außer am
 * gemeinsamen Hotspot, dann zählen sie mit):
 * - Jede Änderung der öffentlichen Sicht geht an BEIDE Gruppen (`ko` Anzeigetafel, `kz` Zuschauer) – je eine Nachricht,
 *   in 1 s zusammengefasst (NTFY_ZEITEN.abstandMs). „Nächster Start“ ändert die Sicht: Bei 120 Startern × 2 Läufen =
 *   240 Starts sind das ≈ 480 Nachrichten; Lauf beginnen, Zurückstellen, Meldungen, Korrekturen ≈ +20 %.
 * - Vollstand stündlich je Gruppe (K15): 10 h × 2 = 20. Koppeln, Quittungen an gekoppelte Handys (je Action eine):
 *   mit Start-Freigabe vom Handy noch einmal ≈ 240.
 * - Herzschläge sendet der Host nicht (ntfy hält das Abo mit eigenen keepalive-Rahmen; die zählen nicht).
 * Summe: ≈ 600 Nachrichten ohne, ≈ 850 mit Start-Freigabe vom Handy – weit unter 17 280 (adminforge, auch wenn sich
 * mehrere Geräte am selben Hotspot eine IP teilen), aber über den 250 von ntfy.sh: Dort reicht ein Tag nicht.
 *
 * Weicht vom Plan (16.11.2026, §8 Nr. 2: 1.000–3.000 Veröffentlichungen, aus dem README des Prototyps, nicht geprüft)
 * ab (Prüfung 21.11.2026): Dort zählen 48 Vollstände (24 h × 2 Themen) und je Patch eine Bestätigung des Geräts mit;
 * hier gehen Vollstände nur stündlich während des Betriebs (≈ 20), Lese-Geräte senden nichts zurück, und Änderungen
 * innerhalb von abstandMs werden zusammengefasst. Der Feldtest misst gegen ≈ 600–850 (docs/feldtest.md).
 */
export const KONTINGENT = {
  /** Bekannte Tagesgrenzen an Nachrichten je IP, nach Hostname (siehe oben). */
  nachrichtenJeTag: { 'ntfy.adminforge.de': 17_280, 'ntfy.sh': 250 } as Readonly<Record<string, number>>,
  /** Ab diesem Anteil warnt Betrieb → Geräte. */
  warnenAb: 0.8,
} as const

/** Die Tagesgrenze des Servers (Adresse mit oder ohne https://); `null` = unbekannt, nur 429 zählt. */
export function tagesGrenze(server: string): number | null {
  const host = server.replace(/^https?:\/\//, '').replace(/[/:].*$/, '').toLowerCase()
  return KONTINGENT.nachrichtenJeTag[host] ?? null
}

export interface KontingentStand {
  /** Lokales Datum JJJJ-MM-TT, für das die Zahlen gelten. */
  tag: string
  /** Von ntfy angenommene Nachrichten (POST mit 2xx). */
  gesendet: number
  /** Alle Anfragen an den Server: POST, Abfragen, Anhänge, WebSocket-Abos. */
  anfragen: number
  /** Wann der Server heute zuletzt 429 gemeldet hat (ms), sonst `null`. */
  gedrosselt: number | null
}

/** Was gezählt wird: eine angenommene Nachricht, eine Anfrage, ein „zu viele Anfragen“. */
export type Zaehlart = 'nachricht' | 'anfrage' | 'gedrosselt'

export type KontingentLage = 'ok' | 'warnung' | 'erschoepft'

/** Lokales Datum (nicht UTC: der Wettkampftag endet um Mitternacht vor Ort). */
export function tagVon(ms: number): string {
  const d = new Date(ms)
  const zwei = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`
}

const leer = (tag: string): KontingentStand => ({ tag, gesendet: 0, anfragen: 0, gedrosselt: null })

const istZahl = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

function lies(ablage: Ablage | null, tag: string): KontingentStand | null {
  try {
    const roh = ablage?.getItem(ABLAGE.kontingent)
    if (!roh) return null
    const w = JSON.parse(roh) as Record<string, unknown>
    if (!w || w.tag !== tag || !istZahl(w.gesendet) || !istZahl(w.anfragen)) return null
    return { tag, gesendet: w.gesendet, anfragen: w.anfragen, gedrosselt: istZahl(w.gedrosselt) ? w.gedrosselt : null }
  } catch {
    return null
  }
}

/** Lage gegenüber der Grenze des Servers ({@link tagesGrenze}); heute gedrosselt zählt immer als erschöpft. */
export function kontingentLage(stand: KontingentStand, grenze: number | null): KontingentLage {
  if (stand.gedrosselt !== null || (grenze !== null && stand.gesendet >= grenze)) return 'erschoepft'
  return grenze !== null && stand.gesendet >= grenze * KONTINGENT.warnenAb ? 'warnung' : 'ok'
}

export interface KontingentZaehler {
  zaehle(art: Zaehlart): KontingentStand
  /** Stand von heute (ein Eintrag von gestern zählt als 0). */
  lies(): KontingentStand
}

/**
 * Zähler über die Ablage. Liest vor jedem Schreiben frisch: Mehrere Fenster (Wechsel der Führung) zählen in denselben
 * Eintrag. Ohne Speicher weiter im Arbeitsspeicher.
 */
export function kontingentZaehler(ablage: Ablage | null, uhr: () => number = Date.now): KontingentZaehler {
  let imSpeicher: KontingentStand | null = null
  const heute = (): KontingentStand => {
    const tag = tagVon(uhr())
    const gelesen = lies(ablage, tag)
    const eigen = imSpeicher && imSpeicher.tag === tag ? imSpeicher : null
    if (!gelesen) return eigen ? { ...eigen } : leer(tag)
    if (!eigen) return gelesen
    // Beide zählen nur hoch: je Feld das Größere. Schlägt das Schreiben fehl (Speicher voll), bliebe der Eintrag sonst
    // stehen und die Warnung aus (Prüfung E8, 21.11.2026); ein anderes Fenster, das weiter schreiben kann, zählt mit.
    const gedrosselt = Math.max(gelesen.gedrosselt ?? -1, eigen.gedrosselt ?? -1)
    return {
      tag,
      gesendet: Math.max(gelesen.gesendet, eigen.gesendet),
      anfragen: Math.max(gelesen.anfragen, eigen.anfragen),
      gedrosselt: gedrosselt < 0 ? null : gedrosselt,
    }
  }
  return {
    zaehle(art) {
      const s = heute()
      if (art === 'nachricht') s.gesendet += 1
      else if (art === 'anfrage') s.anfragen += 1
      else s.gedrosselt = uhr()
      imSpeicher = s
      try {
        ablage?.setItem(ABLAGE.kontingent, JSON.stringify(s))
      } catch {
        // Speicher voll: weiter im Arbeitsspeicher.
      }
      return { ...s }
    },
    lies: heute,
  }
}
