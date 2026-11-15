// Handscanner verhalten sich wie eine Tastatur: Sie tippen den Code, nur viel schneller als
// ein Mensch (wenige Millisekunden je Zeichen), und schließen meist mit Enter ab. Erkennt die
// Anwendung den Anfang eines Codes („ALC1.“) in so einem schnellen Schwall, fängt sie die
// restlichen Zeichen ab. Die ersten Zeichen sind dann schon dort gelandet, wo der Cursor
// stand: in einer Zelle der Erfassung, oder als Tippauswahl in einer Auswahlliste (ein „A“
// springt dort zur nächsten Option mit A). Beides wird zurückgenommen – das Feld bekommt
// seinen Wert von vor dem Schwall zurück, und der Stand der Anwendung wird auf den von vor
// dem Schwall gesetzt (`stand`). Nur das Feld zurückzustellen genügt nicht: Hin und zurück
// wären zwei Änderungen, und die Wertungsliste trüge danach eine „Letzte Änderung“, die
// keine war. Vorbild: lib/scanner.ts im Fehlerpunkte-Prototyp.
//
// Manche Scanner stellen dem Code eine Kennung der Code-Art voran („]Q1“); der Anfang des
// Codes wird deshalb im Schwall gesucht, nicht nur an dessen Beginn.
//
// Ein Mensch tippt nie fünf Zeichen in so kurzem Abstand; normale Eingaben bleiben also
// unberührt. Schickt der Scanner kein Enter, gilt der Code nach einer kurzen Pause als
// vollständig.

/** Größter Abstand zwischen zwei Zeichen eines Scans. */
export const MAX_ABSTAND_MS = 60
/** Pause, nach der ein Scan ohne Enter als vollständig gilt. */
export const ENDE_OHNE_ENTER_MS = 250
/**
 * Anfang eines Codes: der eigene (lib/qr.ts) und der des Fehlerpunkte-Prototyps – dessen
 * Blätter sollen eine verständliche Absage bekommen statt als Tastendrücke in einem Feld zu
 * landen. Beide ohne Y und Z, damit eine vertauschte Tastaturbelegung den Anfang nicht verdirbt.
 */
const CODE_ANFANG = /(ALC|FP)\d\.$/i

/**
 * Wann die Taste gedrückt wurde – nicht, wann sie behandelt wird. Die ersten Zeichen eines
 * Scans landen in der Zelle, in der der Cursor steht, und jedes löst dort Rechnen, Speichern
 * und Neuzeichnen aus. Bei einem großen Starterfeld dauert das länger als der Abstand zweier
 * Scanner-Zeichen: Die Tasten stauen sich, und an der Uhr der Behandlung gemessen sähe der
 * Schwall aus wie von Hand getippt – der Code stünde danach in der Zelle. Der Zeitstempel des
 * Ereignisses misst den Scanner selbst. Fehlt er (0 in manchen Umgebungen), gilt die Uhr.
 */
function ereignisZeit(e: KeyboardEvent): number {
  return Number.isFinite(e.timeStamp) && e.timeStamp > 0 ? e.timeStamp : performance.now()
}

type Feld = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement

function eingabefeld(el: Element | null): Feld | null {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ? el : null
}

/** Der Wert eines Felds; bei Ankreuzfeldern zählt der Haken. */
const wertVon = (feld: Feld) => (feld instanceof HTMLInputElement && (feld.type === 'checkbox' || feld.type === 'radio') ? String(feld.checked) : feld.value)

/**
 * Wie der Stand der Anwendung vor einem Schwall gemerkt und danach wiederhergestellt wird.
 * `merke` läuft bei jedem ersten Zeichen nach einer Pause, also bei fast jedem Tastendruck –
 * es darf nichts kosten (der Store gibt nur die Referenz auf seinen unveränderlichen Stand).
 */
export interface ScannerStand<T> {
  merke: () => T
  stelleHer: (stand: T) => void
}

/**
 * Hört auf Scans im ganzen Fenster und meldet jeden Code. `ausnahme` = Element, das Codes
 * selbst annimmt (das Scan-Feld); dort greift der Mitschnitt nicht. `jetzt` ist die Uhr: wann
 * die Taste gedrückt wurde (Tests reichen eine eigene herein). Liefert eine Funktion zum Abmelden.
 */
export function hoereAufScanner<T = undefined>(
  onCode: (code: string) => void,
  ausnahme: (el: Element | null) => boolean = () => false,
  jetzt: (e: KeyboardEvent) => number = ereignisZeit,
  stand?: ScannerStand<T>,
): () => void {
  let puffer = ''
  let letzte = Number.NEGATIVE_INFINITY
  let aktiv = false
  let feld: Feld | null = null
  let vorher = ''
  let gemerkt: T | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  function zuruecksetzen() {
    puffer = ''
    aktiv = false
    feld = null
    gemerkt = undefined
    clearTimeout(timer)
  }

  /** Nimmt zurück, was die ersten Zeichen des Schwalls angerichtet haben. */
  function nimmZurueck() {
    if (feld && wertVon(feld) !== vorher) {
      if (feld instanceof HTMLInputElement && (feld.type === 'checkbox' || feld.type === 'radio')) feld.checked = vorher === 'true'
      else feld.value = vorher
      // Die Ansicht soll es mitbekommen (eigene Zwischenstände der Felder); eine Auswahlliste
      // meldet sich mit `change`.
      feld.dispatchEvent(new Event('input', { bubbles: true }))
      if (!(feld instanceof HTMLTextAreaElement) && (feld instanceof HTMLSelectElement || feld.type === 'checkbox' || feld.type === 'radio')) {
        feld.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }
    // Zuletzt der Stand: Auch das Zurückstellen eben war für ihn eine Änderung.
    if (stand) stand.stelleHer(gemerkt as T)
  }

  function abschliessen() {
    const code = puffer
    zuruecksetzen()
    if (code) onCode(code)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.altKey || e.metaKey) return
    if (!aktiv && ausnahme(document.activeElement)) return
    const zeit = jetzt(e)

    if (e.key === 'Enter' || e.key === 'Tab') {
      if (aktiv) {
        e.preventDefault()
        e.stopPropagation()
        abschliessen()
      } else {
        zuruecksetzen()
      }
      return
    }
    if (e.key.length !== 1) return // Umschalt-Taste & Co.

    // Ein erkannter Scan läuft bis Enter oder zur Pause (Timer); davor beginnt nach jeder
    // Pause ein neuer Schwall.
    if (!aktiv && zeit - letzte > MAX_ABSTAND_MS) {
      puffer = ''
      feld = eingabefeld(document.activeElement)
      vorher = feld ? wertVon(feld) : ''
      gemerkt = stand?.merke()
    }
    letzte = zeit
    puffer += e.key

    const anfang = aktiv ? null : CODE_ANFANG.exec(puffer)
    if (anfang) {
      aktiv = true
      // Was der Scanner vor den Code gestellt hat, gehört nicht dazu.
      puffer = puffer.slice(anfang.index)
      nimmZurueck()
    }
    if (aktiv) {
      e.preventDefault()
      e.stopPropagation()
      clearTimeout(timer)
      timer = setTimeout(abschliessen, ENDE_OHNE_ENTER_MS)
    }
  }

  window.addEventListener('keydown', onKeydown, true)
  return () => {
    window.removeEventListener('keydown', onKeydown, true)
    clearTimeout(timer)
  }
}
