import { getCurrentScope, onScopeDispose, readonly, ref, watch, type Ref, type WatchSource } from 'vue'

/**
 * Bildschirm wach halten (Etappe E8, Plan vom 16.11.2026; gebaut 20.11.2026): Eine Anzeigetafel am Steg, ein Handy mit
 * der Zuschauerliste oder der Start-Freigabe soll nicht nach einer Minute dunkel werden – Screen Wake Lock API
 * (`navigator.wakeLock.request('screen')`).
 *
 * - Browser geben die Sperre frei, sobald die Seite versteckt ist (anderer Tab, Bildschirm aus, App gewechselt). Darum
 *   wird sie bei `visibilitychange` → sichtbar neu angefordert.
 * - Fehlt die API (iPhone vor iOS 16.4, Firefox vor 126, kein sicherer Kontext: http://, file://) oder weist der
 *   Browser ab (Energiesparen, keine Berechtigung), geschieht still nichts – nur {@link WachLage} sagt es, damit die
 *   Oberfläche einen leisen Hinweis zeigen kann („Bildschirm kann ausgehen“).
 * - Freigegeben wird beim Ende des Bereichs (Unmount) und wenn `aktiv` falsch wird.
 */

/** `wach` = Sperre gehalten; `nicht-moeglich` = API fehlt oder abgewiesen; `aus` = nicht verlangt (oder versteckt). */
export type WachLage = 'aus' | 'wach' | 'nicht-moeglich'

/** Was von der Sperre gebraucht wird (WakeLockSentinel). */
interface Sperre {
  release(): Promise<void>
  addEventListener?(art: 'release', fn: () => void): void
}

export interface WachUmgebung {
  /** Vorgabe `navigator.wakeLock`; `null` = gibt es nicht. */
  wakeLock?: { request(art: 'screen'): Promise<Sperre> } | null
  /** Vorgabe `document`. */
  dokument?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> | null
}

export interface WachHalter {
  readonly lage: Readonly<Ref<WachLage>>
  /** Wach halten verlangen bzw. nicht mehr verlangen. */
  setze(an: boolean): void
  stop(): void
}

function vorgabeWakeLock(): WachUmgebung['wakeLock'] {
  try {
    const n = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { wakeLock?: WachUmgebung['wakeLock'] })
    return n?.wakeLock && typeof n.wakeLock.request === 'function' ? n.wakeLock : null
  } catch {
    return null
  }
}

/** Den Bildschirm wach halten, solange {@link WachHalter.setze} `true` gilt und die Seite sichtbar ist. */
export function halteWach(umgebung: WachUmgebung = {}): WachHalter {
  const api = umgebung.wakeLock === undefined ? vorgabeWakeLock() : umgebung.wakeLock
  const dok = umgebung.dokument === undefined ? (typeof document === 'undefined' ? null : document) : umgebung.dokument
  const lage = ref<WachLage>('aus')
  let verlangt = false
  let gestoppt = false
  let sperre: Sperre | null = null
  /** Läuft eine Anforderung? Dann keine zweite (visibilitychange kann schnell hintereinander kommen). */
  let fordert = false
  /** Die Seite wurde während einer laufenden Anforderung wieder sichtbar: Bei Abweisung noch einmal fordern. */
  let nochmal = false

  const sichtbar = () => !dok || dok.visibilityState !== 'hidden'

  async function fordere(): Promise<void> {
    if (gestoppt || !verlangt || sperre || fordert || !sichtbar()) return
    if (!api) {
      lage.value = 'nicht-moeglich'
      return
    }
    fordert = true
    nochmal = false
    try {
      const s = await api.request('screen')
      fordert = false
      // Inzwischen nicht mehr verlangt oder versteckt (der Browser nimmt sie dann ohnehin): gleich wieder abgeben – beim
      // nächsten Sichtbarwerden kommt eine neue Anforderung.
      if (gestoppt || !verlangt || !sichtbar()) {
        void s.release().catch(() => {})
        return
      }
      sperre = s
      lage.value = 'wach'
      s.addEventListener?.('release', () => {
        if (sperre !== s) return
        sperre = null
        // Der Browser hat sie genommen (versteckt, Energiesparen) – beim nächsten Sichtbarwerden neu.
        if (!gestoppt && verlangt) lage.value = sichtbar() ? 'nicht-moeglich' : 'aus'
      })
    } catch {
      fordert = false
      // Abgewiesen (NotAllowedError: Energiesparen, Berechtigung, nicht sichtbar) – still, nur die Lage sagt es.
      if (gestoppt || !verlangt) return
      lage.value = 'nicht-moeglich'
      // Wurde die Seite während der Anforderung kurz versteckt und wieder sichtbar, galt die Abweisung dem Verstecken;
      // `beiSicht` kam wegen `fordert` nicht durch – einmal nachholen (Prüfung E8, 21.11.2026).
      if (nochmal && sichtbar()) {
        nochmal = false
        void fordere()
      }
    }
  }

  function gibFrei(): void {
    const s = sperre
    sperre = null
    if (s) void s.release().catch(() => {})
  }

  const beiSicht = () => {
    if (sichtbar() && fordert) nochmal = true
    else if (sichtbar()) void fordere()
    else if (lage.value === 'wach' || (api && !sperre && lage.value === 'nicht-moeglich')) {
      // Der Browser gibt die Sperre selbst frei; hier nur den Stand nachziehen. Auch wenn sein `release` VOR dem
      // Verstecken kam (Lage stand schon auf „nicht möglich“): Versteckt heißt „aus“, sonst blitzte der Hinweis
      // „Bildschirm kann ausgehen“ nach jedem Einschalten kurz auf (Feldtest 21.11.2026, Befund 14c). Ohne API bleibt
      // es bei „nicht möglich“ – das gilt dann auch nach dem Sichtbarwerden.
      sperre = null
      lage.value = 'aus'
    }
  }
  dok?.addEventListener('visibilitychange', beiSicht)

  return {
    lage: readonly(lage),
    setze(an) {
      if (gestoppt || an === verlangt) return
      verlangt = an
      if (an) void fordere()
      else {
        gibFrei()
        lage.value = 'aus'
      }
    },
    stop() {
      if (gestoppt) return
      gestoppt = true
      verlangt = false
      dok?.removeEventListener('visibilitychange', beiSicht)
      gibFrei()
      lage.value = 'aus'
    },
  }
}

/**
 * In einer Komponente: wach halten, solange `aktiv` gilt (Vorgabe: immer), freigeben beim Unmount. Liefert die Lage
 * für einen Hinweis.
 */
export function useWachBleiben(aktiv: WatchSource<boolean> = () => true, umgebung: WachUmgebung = {}): Readonly<Ref<WachLage>> {
  const halter = halteWach(umgebung)
  watch(aktiv, (an) => halter.setze(an), { immediate: true })
  if (getCurrentScope()) onScopeDispose(() => halter.stop())
  return halter.lage
}
