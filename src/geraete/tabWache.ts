import { shallowRef, type Ref } from 'vue'
import { ABLAGE, PRAEFIX_GERAET, type Ablage } from './ablage'
import { neueFensterId } from './fuehrung'

/**
 * Nur EIN Tab je Gerät sendet (Befund 15 des Handy-Tests, Prüfbefund 21.11.2026).
 *
 * Wird der QR-Code noch einmal gescannt oder ein alter Tab wieder wach, laufen zwei Tabs mit derselben Kopplung. Jeder
 * hielt seine eigene Sende-Schlange und seinen eigenen Ausgang im Arbeitsspeicher und legte sie bei jedem Ereignis
 * ab. Folgen: (1) Kommt die höhere Nummer des einen Tabs vor der niedrigeren des anderen beim Host an, verwirft der
 * Host die niedrigere still (`nr ≤ letzteNr`), `bis` der Sicht deckt sie trotzdem – ✓ am Handy, nichts am
 * Bedienrechner („Mann-über-Bord 3 offen“). (2) Der stille Tab überschreibt Schlange und Ausgang des aktiven mit
 * seinen leeren – nach einem Neuladen fehlen die Zeilen ganz. Nummern frisch nachlesen (transport.ts nimmHoechsteNr)
 * hilft nur gegen doppelte Nummern, nicht gegen beides.
 *
 * Deshalb: Der zuletzt geöffnete Tab gewinnt (er ist der, den der WKR gerade in der Hand hat). Er schreibt seine
 * Kennung nach `alcatraz.geraet.tab`. Jeder Tab schreibt die Geräte-Ablage (`alcatraz.geraet.*`) nur über
 * {@link TabWache.ablage}: Steht dort eine fremde Kennung, wird nichts geschrieben und der Tab gilt als verdrängt
 * (`verdraengt`); die Oberfläche stoppt dann Gerät und Erfassung und bietet „Hier weitermachen“ an. Dazu das
 * `storage`-Ereignis des Schlüssels, damit ein ruhender Tab nicht erst beim nächsten Schreiben merkt, dass er
 * verdrängt ist. Bewusst kein Web Lock: Auf dem Handy über http (`npm run dev:host`) gibt es keine, und ein Lock hielte
 * den NEUEN Tab draußen statt des alten.
 *
 * Grenze (hingenommen): Zwischen zwei Renderer-Prozessen gleicht der Browser das localStorage verzögert ab; eine
 * Schreibung des alten Tabs im selben Augenblick kann noch durchgehen. Danach schreibt er nichts mehr.
 */

export interface TabWacheUmgebung {
  /** Vorgabe localStorage; `null` = keine Ablage (dann gibt es auch nichts zu überschreiben). */
  ablage?: Ablage | null
  /** Für das `storage`-Ereignis; Vorgabe `window`. */
  fenster?: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | null
  id?: string
}

export interface TabWache {
  /** Die Ablage für Gerät und Erfassung: schreibt `alcatraz.geraet.*` nur, solange dieser Tab der aktive ist. */
  readonly ablage: Ablage | null
  /** true, sobald ein anderer Tab dieselbe Ablage übernommen hat. */
  readonly verdraengt: Ref<boolean>
  /** Ist dieser Tab gerade der aktive? */
  meins(): boolean
  /** „Hier weitermachen“: Dieser Tab wird wieder der aktive (der andere merkt es am storage-Ereignis bzw. beim Schreiben). */
  uebernimm(): void
  stop(): void
}

function vorgabeAblage(): Ablage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function liesId(ablage: Ablage, wert?: string | null): string | null {
  try {
    const roh = wert === undefined ? ablage.getItem(ABLAGE.geraetTab) : wert
    if (!roh) return null
    const w = JSON.parse(roh) as { id?: unknown } | null
    return typeof w?.id === 'string' ? w.id : null
  } catch {
    return null
  }
}

export function oeffneTabWache(umgebung: TabWacheUmgebung = {}): TabWache {
  const roh = umgebung.ablage === undefined ? vorgabeAblage() : umgebung.ablage
  const fenster = umgebung.fenster === undefined ? (typeof window === 'undefined' ? null : window) : umgebung.fenster
  const id = umgebung.id ?? neueFensterId()
  const verdraengt = shallowRef(false)

  const besetze = () => {
    try {
      roh?.setItem(ABLAGE.geraetTab, JSON.stringify({ id, ts: Date.now() }))
    } catch {
      // Speicher voll oder gesperrt: dann prüft meins() eben gegen nichts und lässt schreiben.
    }
  }
  const meins = (): boolean => {
    if (!roh || verdraengt.value) return !verdraengt.value
    const wer = liesId(roh)
    // Fehlt der Eintrag (gelöscht, Speicher geleert), gehört die Ablage wieder dem, der gerade schreibt.
    if (wer === null) {
      besetze()
      return true
    }
    if (wer !== id) verdraengt.value = true
    return wer === id
  }
  const darf = (schluessel: string) => schluessel === ABLAGE.geraetTab || !schluessel.startsWith(PRAEFIX_GERAET) || meins()

  const ablage: Ablage | null = roh
    ? {
        getItem: (k) => roh.getItem(k),
        setItem: (k, v) => {
          if (darf(k)) roh.setItem(k, v)
        },
        removeItem: (k) => {
          if (darf(k)) roh.removeItem(k)
        },
      }
    : null

  const beiSpeicher = (e: Event) => {
    const s = e as StorageEvent
    if (s.key !== ABLAGE.geraetTab || verdraengt.value) return
    const wer = roh ? liesId(roh, s.newValue) : null
    if (wer !== null && wer !== id) verdraengt.value = true
  }

  besetze()
  fenster?.addEventListener('storage', beiSpeicher)
  let gestoppt = false

  return {
    ablage,
    verdraengt,
    meins,
    uebernimm() {
      verdraengt.value = false
      besetze()
    },
    stop() {
      if (gestoppt) return
      gestoppt = true
      fenster?.removeEventListener('storage', beiSpeicher)
    },
  }
}
