import { afterEach, describe, expect, it, vi } from 'vitest'
import { BEDENK_MS, darfUebernehmen, HERZSCHLAG_MS, liesEintrag, VERWAIST_MS, waehleFuehrung, type Fuehrung, type FuehrungsUmgebung, type Sperren } from './fuehrung'
import { ABLAGE, type Ablage } from './ablage'
import anzeigeApp from '../AnzeigeApp.vue?raw'
import zuschauerApp from '../ZuschauerApp.vue?raw'
import leseStore from '../state/leseStore.ts?raw'

/**
 * Auf dem Bedienrechner sind mehrere Fenster offen. Mit ntfy verbinden, den Raum schreiben und Geräte bedienen darf
 * nur EINES (Befund S7: sonst zwei Kopien des Raums, kollidierende Nummern, im schlimmsten Fall ein zurückgedrehter
 * Schlüsselwechsel). Fenster-IDs sind erfunden.
 */

const laufend: Fuehrung[] = []

function fenster(id: string, umgebung: FuehrungsUmgebung): Fuehrung {
  const f = waehleFuehrung(id, umgebung)
  laufend.push(f)
  return f
}

afterEach(() => {
  for (const f of laufend.splice(0)) f.stop()
  vi.useRealTimers()
  localStorage.clear()
})

/** Web Locks nachgebaut: ein Schloss, der Reihe nach vergeben, Abbruch per Signal – wie navigator.locks. */
function nachgebauteSperren() {
  let gehalten = false
  const wartend: { rueckruf: () => unknown; fertig: (v: unknown) => void; fehler: (e: unknown) => void }[] = []
  const vergib = () => {
    if (gehalten) return
    const naechster = wartend.shift()
    if (!naechster) return
    gehalten = true
    // Wie im Browser: Das Schloss kommt in einer späteren Aufgabe, nicht im Aufruf selbst.
    void Promise.resolve()
      .then(() => naechster.rueckruf())
      .then(
        (v) => {
          gehalten = false
          naechster.fertig(v)
          vergib()
        },
        (e: unknown) => {
          gehalten = false
          naechster.fehler(e)
          vergib()
        },
      )
  }
  const sperren: Sperren & { gehalten(): boolean; wartend(): number } = {
    request(_name, optionen, rueckruf) {
      return new Promise((fertig, fehler) => {
        const eintrag = { rueckruf, fertig, fehler }
        optionen.signal?.addEventListener('abort', () => {
          const i = wartend.indexOf(eintrag)
          if (i < 0) return
          wartend.splice(i, 1)
          fehler(new DOMException('abgebrochen', 'AbortError'))
        })
        wartend.push(eintrag)
        vergib()
      })
    },
    gehalten: () => gehalten,
    wartend: () => wartend.length,
  }
  return sperren
}

/** Wartet, bis Versprechen und Zeitgeber durch sind (auch mit falscher Uhr). */
const durch = async (ms = 0) => {
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(ms)
  else for (let i = 0; i < 5; i++) await Promise.resolve()
}

/** Ein localStorage, in dem die Schreibung eines Fensters erst nach `ms` sichtbar wird – wie zwischen Prozessen. */
function verzoegerterSpeicher(ms: number): Ablage & { roh(k: string): string | null } {
  const zentral = new Map<string, string>()
  return {
    getItem: (k) => zentral.get(k) ?? null,
    setItem: (k, v) => void setTimeout(() => zentral.set(k, v), ms),
    removeItem: (k) => void setTimeout(() => zentral.delete(k), ms),
    roh: (k) => zentral.get(k) ?? null,
  }
}

describe('darfUebernehmen (Lease)', () => {
  const jetzt = 1_000_000

  it('übernimmt, wenn niemand führt', () => {
    expect(darfUebernehmen(null, 'fenster-a', jetzt)).toBe(true)
  })

  it('behält die eigene Führung', () => {
    expect(darfUebernehmen({ id: 'fenster-a', ts: jetzt - 100 }, 'fenster-a', jetzt)).toBe(true)
  })

  it('lässt ein anderes, lebendes Fenster in Ruhe', () => {
    expect(darfUebernehmen({ id: 'fenster-b', ts: jetzt - 500 }, 'fenster-a', jetzt)).toBe(false)
  })

  it('übernimmt von einem Fenster, das sich nicht mehr meldet', () => {
    expect(darfUebernehmen({ id: 'fenster-b', ts: jetzt - VERWAIST_MS - 1 }, 'fenster-a', jetzt)).toBe(true)
  })

  it('wartet bis zum Ablauf, nicht länger', () => {
    expect(darfUebernehmen({ id: 'fenster-b', ts: jetzt - VERWAIST_MS + 1 }, 'fenster-a', jetzt)).toBe(false)
  })
})

describe('mit Web Locks', () => {
  it('S7: nur ein Fenster führt; endet es, übernimmt das nächste', async () => {
    const sperren = nachgebauteSperren()
    const a = fenster('fenster-a', { sperren, ablage: null, fenster: null })
    const b = fenster('fenster-b', { sperren, ablage: null, fenster: null })
    await durch()
    expect(a.fuehrt.value).toBe(true)
    expect(b.fuehrt.value).toBe(false)
    expect(a.art.value).toBe('sperre')

    a.stop()
    expect(a.fuehrt.value).toBe(false)
    await durch()
    expect(b.fuehrt.value).toBe(true)
    expect(sperren.gehalten()).toBe(true)
  })

  it('ein Fenster, das endet, bevor es an der Reihe war, führt nie und hinterlässt nichts', async () => {
    const sperren = nachgebauteSperren()
    const a = fenster('fenster-a', { sperren, ablage: null, fenster: null })
    const b = fenster('fenster-b', { sperren, ablage: null, fenster: null })
    await durch()
    b.stop()
    await durch()
    expect(sperren.wartend()).toBe(0)
    a.stop()
    await durch()
    expect(b.fuehrt.value).toBe(false)
    expect(sperren.gehalten()).toBe(false)
  })

  it('schreibt keinen Lease-Eintrag', async () => {
    const setItem = vi.spyOn(localStorage, 'setItem')
    fenster('fenster-a', { sperren: nachgebauteSperren(), fenster: null })
    await durch()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('Back/Forward-Cache: pagehide gibt das Schloss frei, pageshow fragt neu an (Befund E5-Prüfung 16.11.2026)', async () => {
    // Im echten Chromium (https) behielt eine Seite im Cache das Schloss, und bis zu 10 min führte niemand.
    const sperren = nachgebauteSperren()
    const seiteA = new EventTarget()
    const seiteB = new EventTarget()
    const a = fenster('fenster-a', { sperren, ablage: null, fenster: seiteA })
    const b = fenster('fenster-b', { sperren, ablage: null, fenster: seiteB })
    await durch()
    expect(a.fuehrt.value).toBe(true)
    const uebergang = (art: 'pagehide' | 'pageshow') => Object.assign(new Event(art), { persisted: true })

    // A navigiert weg, die Seite kommt in den Cache: B übernimmt.
    seiteA.dispatchEvent(uebergang('pagehide'))
    expect(a.fuehrt.value).toBe(false)
    await durch()
    expect(b.fuehrt.value).toBe(true)

    // A kommt zurück und wartet wieder; B geht in den Cache, während A wartet – A führt, B wartet nicht doppelt.
    seiteA.dispatchEvent(uebergang('pageshow'))
    await durch()
    expect(a.fuehrt.value).toBe(false)
    expect(sperren.wartend()).toBe(1)
    seiteB.dispatchEvent(uebergang('pagehide'))
    await durch()
    expect(a.fuehrt.value).toBe(true)
    expect(a.art.value).toBe('sperre')
    // Ein wartendes Fenster, das in den Cache geht, hört auf zu warten (kein Rückfall auf die Lease).
    seiteB.dispatchEvent(uebergang('pageshow'))
    await durch()
    expect(sperren.wartend()).toBe(1)
    seiteB.dispatchEvent(uebergang('pagehide'))
    await durch()
    expect(sperren.wartend()).toBe(0)
    expect(b.art.value).toBe('sperre')
    expect(liesEintrag()).toBeNull()
  })

  it('abgewiesen (etwa undurchsichtige Herkunft unter file://): Rückfall auf die Lease', async () => {
    vi.useFakeTimers()
    const sperren: Sperren = { request: () => Promise.reject(new DOMException('nein', 'SecurityError')) }
    const a = fenster('fenster-a', { sperren, fenster: null })
    await durch(BEDENK_MS)
    expect(a.art.value).toBe('lease')
    expect(a.fuehrt.value).toBe(true)
    expect(liesEintrag()?.id).toBe('fenster-a')
  })

  it('wirft request gleich (ältere Browser): Rückfall auf die Lease', async () => {
    vi.useFakeTimers()
    const sperren: Sperren = {
      request: () => {
        throw new TypeError('nicht unterstützt')
      },
    }
    const a = fenster('fenster-a', { sperren, fenster: null })
    await durch(BEDENK_MS)
    expect(a.art.value).toBe('lease')
    expect(a.fuehrt.value).toBe(true)
  })
})

describe('ohne Web Locks: Lease im localStorage', () => {
  it('das erste Fenster führt nach der Bedenkzeit, ein zweites nicht', async () => {
    vi.useFakeTimers()
    const a = fenster('fenster-a', { sperren: null, fenster: null })
    await durch(BEDENK_MS)
    const b = fenster('fenster-b', { sperren: null, fenster: null })
    await durch(BEDENK_MS + HERZSCHLAG_MS)
    expect(a.fuehrt.value).toBe(true)
    expect(a.art.value).toBe('lease')
    expect(b.fuehrt.value).toBe(false)
    expect(liesEintrag()?.id).toBe('fenster-a')
  })

  it('gibt die Führung beim Beenden frei; das nächste Fenster übernimmt ohne Ablauf abzuwarten', async () => {
    vi.useFakeTimers()
    const a = fenster('fenster-a', { sperren: null, fenster: null })
    await durch(BEDENK_MS)
    const b = fenster('fenster-b', { sperren: null, fenster: null })
    await durch(BEDENK_MS)
    a.stop()
    expect(liesEintrag()).toBeNull()
    await durch(HERZSCHLAG_MS + BEDENK_MS)
    expect(b.fuehrt.value).toBe(true)
  })

  it('übernimmt von einem Fenster, das sich nicht mehr meldet (abgestürzt, Rechner schlief)', async () => {
    vi.useFakeTimers()
    localStorage.setItem(ABLAGE.fuehrung, JSON.stringify({ id: 'fenster-x', ts: Date.now() }))
    const a = fenster('fenster-a', { sperren: null, fenster: null })
    await durch(VERWAIST_MS - HERZSCHLAG_MS)
    expect(a.fuehrt.value).toBe(false)
    await durch(HERZSCHLAG_MS * 2 + BEDENK_MS)
    expect(a.fuehrt.value).toBe(true)
  })

  it('räumt beim Beenden nur den eigenen Eintrag weg', async () => {
    vi.useFakeTimers()
    fenster('fenster-a', { sperren: null, fenster: null })
    await durch(BEDENK_MS)
    const b = fenster('fenster-b', { sperren: null, fenster: null })
    await durch(BEDENK_MS)
    b.stop()
    expect(liesEintrag()?.id).toBe('fenster-a')
  })

  it('verträgt einen kaputten Eintrag', async () => {
    vi.useFakeTimers()
    localStorage.setItem(ABLAGE.fuehrung, 'kein json')
    const a = fenster('fenster-a', { sperren: null, fenster: null })
    await durch(BEDENK_MS)
    expect(a.fuehrt.value).toBe(true)
  })

  it('pagehide gibt die Führung frei', async () => {
    vi.useFakeTimers()
    const a = fenster('fenster-a', { sperren: null })
    await durch(BEDENK_MS)
    window.dispatchEvent(new Event('pagehide'))
    expect(liesEintrag()).toBeNull()
    expect(a.fuehrt.value).toBe(false)
  })

  it('ohne Speicher (privates Fenster, gesperrt) führt niemand – kein Gerätebetrieb statt doppelter Führung', async () => {
    vi.useFakeTimers()
    const a = fenster('fenster-a', { sperren: null, ablage: null, fenster: null })
    await durch(BEDENK_MS + HERZSCHLAG_MS)
    expect(a.fuehrt.value).toBe(false)
  })

  it('S7: zwei Fenster starten gleichzeitig, der Speicher gleicht verzögert ab – nie führen beide', async () => {
    vi.useFakeTimers()
    const ablage = verzoegerterSpeicher(50)
    const a = fenster('fenster-a', { sperren: null, ablage, fenster: null })
    const b = fenster('fenster-b', { sperren: null, ablage, fenster: null })
    let beide = 0
    let wechsel = 0
    let vorher: string | null = null
    for (let t = 0; t <= 20_000; t += 25) {
      if (a.fuehrt.value && b.fuehrt.value) beide++
      const jetzt = a.fuehrt.value ? 'a' : b.fuehrt.value ? 'b' : null
      if (vorher && jetzt && jetzt !== vorher) wechsel++
      if (jetzt) vorher = jetzt
      await durch(25)
    }
    expect(beide).toBe(0)
    expect([a, b].filter((f) => f.fuehrt.value)).toHaveLength(1)
    // Und es pendelt nicht hin und her.
    expect(wechsel).toBe(0)
  })

  it('S7: übernimmt ein anderes Fenster (eigener Herzschlag blieb aus), tritt dieses beim nächsten Schlag zurück', async () => {
    vi.useFakeTimers()
    const a = fenster('fenster-a', { sperren: null, fenster: null })
    await durch(BEDENK_MS)
    expect(a.fuehrt.value).toBe(true)
    // Ein zweites Fenster hat übernommen, während dieses gedrosselt war.
    localStorage.setItem(ABLAGE.fuehrung, JSON.stringify({ id: 'fenster-b', ts: Date.now() }))
    await durch(HERZSCHLAG_MS)
    expect(a.fuehrt.value).toBe(false)
    expect(liesEintrag()?.id).toBe('fenster-b')
  })
})

describe('nur Fenster mit vollem Store führen', () => {
  it('Anzeigetafel, Zuschauerliste und Nur-Lese-Store laden nichts aus geraete/', () => {
    // Plan §1/§5: Die Anzeigetafel (Nur-Lese) führt nie und schreibt nie – sie dürfte die Führung nicht einmal
    // anfragen, sonst hielte sie das Schloss, ohne einen Raum schreiben zu können.
    for (const quelle of [anzeigeApp, zuschauerApp, leseStore]) expect(quelle).not.toMatch(/geraete\//)
  })
})
