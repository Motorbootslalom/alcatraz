import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { ABLAGE, type Ablage } from './ablage'

/**
 * Welches Fenster des Bedienrechners führt den Gerätebetrieb (Vorbild tafel lib/leader.ts, 16.11.2026 nach Plan §1
 * und §2 neu geschrieben)?
 *
 * Auf dem Bedienrechner sind oft mehrere Fenster offen (Erfassung, Betrieb, Listen). Mit ntfy verbinden, den Raum
 * schreiben (Nummern, Register, Schlüssel) und Geräte-Actions annehmen darf nur EINES: Zwei Führende hielten zwei
 * Kopien des Raums, vergäben Nummern doppelt und könnten nach einem Entzug den Schlüsselwechsel zurückdrehen
 * (Befund S7). Nur dieses Fenster legt den HostTransport an (E6 host.ts) und beendet ihn, sobald `fuehrt` false
 * wird; die Grundlagen der Differenzen liegen nur im Speicher, ein neues Führungsfenster beginnt also mit Vollständen.
 *
 * - **Web Locks** (`navigator.locks`): Das Schloss hält genau ein Fenster; der Browser gibt es frei, wenn das
 *   Fenster schließt oder abstürzt, und vergibt es dann an das nächste wartende. Das ist der eigentliche Schutz.
 *   Nicht aber, wenn das Fenster wegnavigiert und die Seite im Back/Forward-Cache liegt: Dort hielte sie das Schloss
 *   eingefroren, bis Chrome den Eintrag räumt (bis 10 min), und kein Fenster führte (Befund E5-Prüfung 16.11.2026,
 *   im echten Chromium unter https). Deshalb gibt `pagehide` das Schloss selbst frei, und `pageshow` mit
 *   `persisted` fragt es neu an. Der HostTransport folgt `fuehrt` (stop/start; Chrome schließt den WebSocket
 *   beim Eintritt in den Cache ohnehin).
 * - **Lease im localStorage als Rückfall**, wo Web Locks fehlen oder abgewiesen werden (ältere Browser, manche
 *   file://-Herkünfte): Herzschlag wie im Prototyp, aber erst nach einer **Bedenkzeit** führen – schreiben, warten,
 *   nachlesen. Das localStorage kennt kein atomares Prüfen-und-Setzen, und zwischen Prozessen wird eine Schreibung
 *   erst verzögert sichtbar; der Prototyp führte sofort, und zwei gleichzeitig startende Fenster führten bis zum
 *   nächsten Herzschlag beide (S7). Mit der Bedenkzeit gewinnt die zuletzt gelandete Schreibung für alle. Ganz
 *   sicher ist das nicht (gleicht der Speicher langsamer ab als {@link BEDENK_MS}, oder schläft ein Fenster länger
 *   als {@link VERWAIST_MS}); ein Fenster, das einen fremden Eintrag sieht, tritt beim nächsten Herzschlag zurück.
 *
 * Nur Fenster mit vollem Store fragen an (App.vue), nie die Anzeigetafel oder die Zuschauerliste (Nur-Lese-Store):
 * Sie hielten das Schloss, ohne den Raum schreiben oder Actions anwenden zu können (Test in fuehrung.test.ts).
 */

/** Name des Web Locks; je Herkunft eines. */
export const FUEHRUNG_SPERRE = 'alcatraz-fuehrung'
/** Lease: So oft bestätigt das führende Fenster, dass es noch da ist (wie im Prototyp). */
export const HERZSCHLAG_MS = 2000
/** Lease: Danach gilt ein Eintrag als verwaist. Großzügig gegen kurze Aussetzer. */
export const VERWAIST_MS = 6000
/** Lease: so lange zwischen Schreiben und Nachlesen – länger als der Abgleich zwischen Fenstern dauert. */
export const BEDENK_MS = 500

export interface LeaseEintrag {
  id: string
  ts: number
}

/** Was von `navigator.locks` gebraucht wird – in Tests nachgebaut. */
export interface Sperren {
  request(name: string, optionen: { signal?: AbortSignal }, rueckruf: () => Promise<void> | void): Promise<unknown>
}

export interface FuehrungsUmgebung {
  /** Vorgabe `navigator.locks`; `null` = gibt es nicht (Lease). */
  sperren?: Sperren | null
  /** Für die Lease; Vorgabe localStorage. Ohne Speicher führt in der Lease niemand. */
  ablage?: Ablage | null
  /** Für `pagehide` und `pageshow`; Vorgabe `window`. */
  fenster?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null
  uhr?: () => number
}

export interface Fuehrung {
  /** true, solange dieses Fenster den Gerätebetrieb führt. */
  readonly fuehrt: Ref<boolean>
  /** Wie geführt wird – `null`, solange noch nichts angefragt ist. */
  readonly art: Ref<'sperre' | 'lease' | null>
  /** Gibt die Führung frei bzw. hört auf zu warten. Danach nie wieder führend. */
  stop(): void
}

/** Lease: Darf ich übernehmen? Ja, wenn niemand führt, es ohnehin ich bin oder der Eintrag verwaist ist. */
export function darfUebernehmen(eintrag: LeaseEintrag | null, ich: string, jetzt: number, verwaistMs = VERWAIST_MS): boolean {
  if (!eintrag) return true
  if (eintrag.id === ich) return true
  return jetzt - eintrag.ts > verwaistMs
}

function vorgabeAblage(): Ablage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function vorgabeSperren(): Sperren | null {
  try {
    return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null
  } catch {
    return null
  }
}

export function liesEintrag(ablage: Ablage | null = vorgabeAblage()): LeaseEintrag | null {
  try {
    const roh = ablage?.getItem(ABLAGE.fuehrung)
    if (!roh) return null
    const wert = JSON.parse(roh) as Partial<LeaseEintrag> | null
    if (typeof wert?.id !== 'string' || typeof wert.ts !== 'number') return null
    return { id: wert.id, ts: wert.ts }
  } catch {
    return null
  }
}

/** Kennung eines Fensters: nur zum Unterscheiden, nicht geheim. */
export function neueFensterId(): string {
  const bytes = new Uint8Array(8)
  try {
    crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Fragt die Führung an. Läuft, bis {@link Fuehrung.stop} gerufen wird oder der umgebende Vue-Bereich endet.
 * Mit Web Locks wartet ein zweites Fenster, bis das erste endet; mit der Lease übernimmt es beim Herzschlag.
 */
export function waehleFuehrung(id: string = neueFensterId(), umgebung: FuehrungsUmgebung = {}): Fuehrung {
  const sperren = umgebung.sperren === undefined ? vorgabeSperren() : umgebung.sperren
  const ablage = umgebung.ablage === undefined ? vorgabeAblage() : umgebung.ablage
  const fenster = umgebung.fenster === undefined ? (typeof window === 'undefined' ? null : window) : umgebung.fenster
  const uhr = umgebung.uhr ?? (() => Date.now())

  const fuehrt = ref(false)
  const art = ref<'sperre' | 'lease' | null>(null)
  let gestoppt = false

  // --- Web Locks ---
  /** Abbruch der laufenden Anfrage – je Anfrage ein neuer (nach dem Back/Forward-Cache wird neu angefragt). */
  let abbruch: AbortController | null = null
  let freigeben: (() => void) | null = null

  // --- Lease ---
  let herzschlag: ReturnType<typeof setInterval> | null = null
  let bedenkzeit: ReturnType<typeof setTimeout> | null = null
  let anwaerter = false

  const schreibe = (ts: number): boolean => {
    try {
      ablage?.setItem(ABLAGE.fuehrung, JSON.stringify({ id, ts } satisfies LeaseEintrag))
      return !!ablage
    } catch {
      return false
    }
  }

  const gibFrei = () => {
    try {
      if (liesEintrag(ablage)?.id === id) ablage?.removeItem(ABLAGE.fuehrung)
    } catch {
      // Nicht lesbar heißt: auch nichts freizugeben.
    }
  }

  /** Nach der Bedenkzeit: Steht noch mein Eintrag da, hat meine Schreibung als letzte gewonnen. */
  const nachgelesen = () => {
    bedenkzeit = null
    if (gestoppt || !anwaerter) return
    anwaerter = false
    if (liesEintrag(ablage)?.id !== id) return
    fuehrt.value = true
    schreibe(uhr())
  }

  const schlag = () => {
    if (gestoppt || !ablage) return
    const jetzt = uhr()
    const eintrag = liesEintrag(ablage)
    if (fuehrt.value) {
      // Ein anderes Fenster hat übernommen, während dieses schlief oder gedrosselt war: sofort zurücktreten.
      if (eintrag && !darfUebernehmen(eintrag, id, jetzt)) fuehrt.value = false
      else schreibe(jetzt)
      return
    }
    if (anwaerter || !darfUebernehmen(eintrag, id, jetzt) || !schreibe(jetzt)) return
    anwaerter = true
    bedenkzeit = setTimeout(nachgelesen, BEDENK_MS)
  }

  const starteLease = () => {
    if (gestoppt || herzschlag) return
    art.value = 'lease'
    schlag()
    herzschlag = setInterval(schlag, HERZSCHLAG_MS)
  }

  /** Fragt das Schloss an; gehalten, bis `freigeben` gerufen wird – oder der Browser das Fenster schließt. */
  const fordereSperre = (s: Sperren) => {
    const steuerung = new AbortController()
    abbruch = steuerung
    try {
      s.request(FUEHRUNG_SPERRE, { signal: steuerung.signal }, () => {
        if (gestoppt || steuerung.signal.aborted) return
        fuehrt.value = true
        return new Promise<void>((erfuelle) => {
          freigeben = erfuelle
        })
      }).catch(() => {
        // Abgebrochen (stop oder pagehide während des Wartens) – oder abgewiesen, etwa bei undurchsichtiger Herkunft:
        // dann Lease.
        if (!gestoppt && !steuerung.signal.aborted) starteLease()
      })
    } catch {
      starteLease()
    }
  }

  /** Lässt das Schloss los bzw. hört auf zu warten. */
  const lasseSperre = () => {
    abbruch?.abort()
    abbruch = null
    freigeben?.()
    freigeben = null
  }

  /**
   * Verborgen zum Verlassen (Schließen, Wegnavigieren, Back/Forward-Cache): Lease-Eintrag weg bzw. Schloss frei, damit
   * das nächste Fenster sofort übernimmt – statt nach dem Ablauf bzw. erst, wenn der Browser den Cache räumt.
   */
  const beimVerbergen = () => {
    if (gestoppt) return
    if (art.value === 'lease') {
      gibFrei()
      anwaerter = false
    } else if (art.value === 'sperre') {
      lasseSperre()
    }
    fuehrt.value = false
  }

  /** Aus dem Back/Forward-Cache zurück: wieder anfragen (die Lease übernimmt beim nächsten Herzschlag von selbst). */
  const beimZeigen = (ereignis: Event) => {
    if (gestoppt || !sperren || art.value !== 'sperre' || abbruch) return
    if (!(ereignis as Event & { persisted?: boolean }).persisted) return
    fordereSperre(sperren)
  }

  const stop = () => {
    if (gestoppt) return
    gestoppt = true
    lasseSperre()
    if (herzschlag) clearInterval(herzschlag)
    if (bedenkzeit) clearTimeout(bedenkzeit)
    fenster?.removeEventListener('pagehide', beimVerbergen)
    fenster?.removeEventListener('pageshow', beimZeigen)
    if (art.value === 'lease') gibFrei()
    fuehrt.value = false
  }

  fenster?.addEventListener('pagehide', beimVerbergen)
  fenster?.addEventListener('pageshow', beimZeigen)
  if (sperren) {
    art.value = 'sperre'
    fordereSperre(sperren)
  } else {
    starteLease()
  }

  // In einer Komponente: mit ihr endet die Führung. Außerhalb (Tests, main.ts) räumt stop() von Hand auf.
  if (getCurrentScope()) onScopeDispose(stop)

  return { fuehrt, art, stop }
}
