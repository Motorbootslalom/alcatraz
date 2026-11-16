import { afterEach, describe, expect, it, vi } from 'vitest'
import { oeffneFensterbus, WEITERREICHEN_MS, type BusUmgebung, type Fensterbus, type Kanal } from './fensterbus'
import { ABLAGE, type Ablage } from './ablage'
import type { GeraeteAction } from './transport/protokoll'

/**
 * Fensterbus zwischen den Fenstern des Bedienrechners (Kritik K27): Das Führungsfenster reicht eine geprüfte
 * Geräte-Action an das zuletzt bediente Fenster; nur dort wird sie angewandt. Der Browser ist nachgebaut – mehrere
 * „Fenster“ mit BroadcastChannel und storage-Ereignis, Zustellung wie im Browser erst nach dem Senden.
 */

const offen: Fensterbus[] = []

afterEach(() => {
  for (const b of offen.splice(0)) b.schliesse()
  vi.useRealTimers()
})

class NachgebauterKanal implements Kanal {
  onmessage: ((e: MessageEvent) => void) | null = null
  constructor(
    private readonly name: string,
    private readonly alle: Set<NachgebauterKanal>,
    private readonly stumm: boolean,
  ) {
    alle.add(this)
  }

  postMessage(daten: unknown): void {
    if (this.stumm) return
    for (const k of this.alle) if (k !== this && k.name === this.name) queueMicrotask(() => k.onmessage?.({ data: daten } as MessageEvent))
  }

  close(): void {
    this.alle.delete(this)
  }
}

/** Ein Browser mit gemeinsamem localStorage; jedes Fenster bekommt die storage-Ereignisse der anderen. */
function browser() {
  const kanaele = new Set<NachgebauterKanal>()
  const fenster: EventTarget[] = []
  const zentral = new Map<string, string>()
  let gesendet = 0
  return {
    gesendet: () => gesendet,
    zentral,
    /** Eine Nachricht, wie ein unbekanntes anderes Fenster sie über den Rückfall schriebe. */
    einspeisen(text: string) {
      for (const f of fenster) f.dispatchEvent(Object.assign(new Event('storage'), { key: ABLAGE.fensterbus, newValue: text }))
    },
    oeffne(id: string, art: { kanal?: 'ja' | 'nein' | 'stumm'; speicher?: boolean; mehr?: Partial<BusUmgebung> } = {}): Fensterbus {
      const ziel = new EventTarget()
      fenster.push(ziel)
      const ablage: Ablage = {
        getItem: (k) => zentral.get(k) ?? null,
        setItem: (k, v) => {
          zentral.set(k, v)
          gesendet++
          // Wie im Browser: nicht im schreibenden Fenster, in den anderen später.
          for (const f of fenster) if (f !== ziel) queueMicrotask(() => f.dispatchEvent(Object.assign(new Event('storage'), { key: k, newValue: v })))
        },
        removeItem: (k) => void zentral.delete(k),
      }
      const kanal = art.kanal === 'nein' ? null : (name: string) => new NachgebauterKanal(name, kanaele, art.kanal === 'stumm')
      const bus = oeffneFensterbus(id, { kanal, ablage: art.speicher === false ? null : ablage, fenster: ziel, ...art.mehr })
      offen.push(bus)
      return bus
    },
  }
}

const durch = async (ms = 0) => {
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(ms)
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

const meldung: GeraeteAction = { type: 'BETRIEB_MELDUNG', bereich: 'par_1', meldung: null }

describe('Geräte-Actions an das Schreibfenster (K27)', () => {
  it('das Führungsfenster reicht weiter, das zuletzt bediente Fenster wendet an – genau einmal', async () => {
    const b = browser()
    const fuehrung = b.oeffne('fenster-f')
    const erfassung = b.oeffne('fenster-e')
    const angewandt: GeraeteAction[] = []
    erfassung.beimAnwenden((a) => {
      angewandt.push(a)
      return 'angewandt'
    })
    erfassung.bedient()
    await durch()
    expect(fuehrung.schreibfenster.value).toBe('fenster-e')

    const selbst = vi.fn(() => 'angewandt' as const)
    const ergebnis = await fuehrung.reicheWeiter(meldung, selbst)
    expect(ergebnis).toBe('angewandt')
    // BroadcastChannel UND storage-Schlüssel tragen – angewandt wird trotzdem nur einmal.
    expect(angewandt).toEqual([meldung])
    expect(selbst).not.toHaveBeenCalled()
  })

  it('meldet „unverändert“ zurück, wenn die Action nichts bewirkt hat (bedingt, doppelt)', async () => {
    const b = browser()
    const fuehrung = b.oeffne('fenster-f')
    const erfassung = b.oeffne('fenster-e')
    erfassung.beimAnwenden(() => 'unveraendert')
    erfassung.bedient()
    await durch()
    expect(await fuehrung.reicheWeiter(meldung, () => 'angewandt')).toBe('unveraendert')
  })

  it('ohne BroadcastChannel trägt der storage-Schlüssel', async () => {
    const b = browser()
    const fuehrung = b.oeffne('fenster-f', { kanal: 'nein' })
    const erfassung = b.oeffne('fenster-e', { kanal: 'nein' })
    const anwenden = vi.fn(() => 'angewandt' as const)
    erfassung.beimAnwenden(anwenden)
    erfassung.bedient()
    await durch()
    expect(await fuehrung.reicheWeiter(meldung, () => 'unveraendert')).toBe('angewandt')
    expect(anwenden).toHaveBeenCalledOnce()
  })

  it('BroadcastChannel da, aber stumm (manche Browser unter file://): der storage-Schlüssel trägt trotzdem', async () => {
    const b = browser()
    const fuehrung = b.oeffne('fenster-f', { kanal: 'stumm' })
    const erfassung = b.oeffne('fenster-e', { kanal: 'stumm' })
    erfassung.beimAnwenden(() => 'angewandt')
    erfassung.bedient()
    await durch()
    expect(fuehrung.schreibfenster.value).toBe('fenster-e')
    expect(await fuehrung.reicheWeiter(meldung, () => 'unveraendert')).toBe('angewandt')
  })

  it('ohne storage-Schlüssel trägt BroadcastChannel allein', async () => {
    const b = browser()
    const fuehrung = b.oeffne('fenster-f', { speicher: false })
    const erfassung = b.oeffne('fenster-e', { speicher: false })
    erfassung.beimAnwenden(() => 'angewandt')
    erfassung.bedient()
    await durch()
    expect(await fuehrung.reicheWeiter(meldung, () => 'unveraendert')).toBe('angewandt')
    expect(b.zentral.has(ABLAGE.fensterbus)).toBe(false)
  })

  it('antwortet das Schreibfenster nicht binnen 1 s, wendet das Führungsfenster selbst an', async () => {
    vi.useFakeTimers()
    const b = browser()
    const fuehrung = b.oeffne('fenster-f')
    const eingefroren = b.oeffne('fenster-e')
    // Bedient, aber ohne Store (oder eingefroren): Es wendet nichts an und antwortet nicht.
    eingefroren.bedient()
    await durch()
    const selbst = vi.fn(() => 'angewandt' as const)
    const ergebnis = fuehrung.reicheWeiter(meldung, selbst)
    await durch(WEITERREICHEN_MS - 1)
    expect(selbst).not.toHaveBeenCalled()
    await durch(1)
    expect(await ergebnis).toBe('angewandt')
    expect(selbst).toHaveBeenCalledOnce()
    // Bis wieder ein Fenster bedient wird, wendet das Führungsfenster gleich selbst an.
    expect(fuehrung.schreibfenster.value).toBeNull()
  })

  it('ist das Führungsfenster selbst zuletzt bedient (oder keines), wendet es gleich an', async () => {
    const b = browser()
    const fuehrung = b.oeffne('fenster-f')
    const selbst = vi.fn(() => 'angewandt' as const)
    expect(await fuehrung.reicheWeiter(meldung, selbst)).toBe('angewandt')
    fuehrung.bedient()
    expect(await fuehrung.reicheWeiter(meldung, selbst)).toBe('angewandt')
    expect(selbst).toHaveBeenCalledTimes(2)
  })

  it('wendet nur an, was an dieses Fenster geht', async () => {
    const b = browser()
    const fuehrung = b.oeffne('fenster-f')
    const erfassung = b.oeffne('fenster-e')
    const listen = b.oeffne('fenster-l')
    const inListen = vi.fn(() => 'angewandt' as const)
    listen.beimAnwenden(inListen)
    erfassung.beimAnwenden(() => 'angewandt')
    erfassung.bedient()
    await durch()
    await fuehrung.reicheWeiter(meldung, () => 'unveraendert')
    expect(inListen).not.toHaveBeenCalled()
  })
})

describe('wer zuletzt bedient wurde', () => {
  it('kreuzen sich zwei Meldungen, gilt für alle die spätere', async () => {
    const b = browser()
    let jetzt = 1000
    const uhr = () => jetzt
    const a = b.oeffne('fenster-a', { mehr: { uhr } })
    const c = b.oeffne('fenster-c', { mehr: { uhr } })
    const f = b.oeffne('fenster-f', { mehr: { uhr } })
    await durch()
    a.bedient()
    jetzt = 1001
    c.bedient()
    await durch()
    expect([a, c, f].map((x) => x.schreibfenster.value)).toEqual(['fenster-c', 'fenster-c', 'fenster-c'])
  })

  it('nicht bei jedem Tastendruck eine Nachricht', async () => {
    vi.useFakeTimers()
    const b = browser()
    const a = b.oeffne('fenster-a')
    b.oeffne('fenster-f')
    await durch()
    const vorher = b.gesendet()
    for (let i = 0; i < 50; i++) {
      a.bedient()
      await durch(10)
    }
    expect(b.gesendet() - vorher).toBeLessThanOrEqual(1)
  })

  it('ein neues Fenster erfährt Schreibfenster und Verbindungsstand', async () => {
    const b = browser()
    const fuehrung = b.oeffne('fenster-f')
    const erfassung = b.oeffne('fenster-e')
    erfassung.bedient()
    fuehrung.meldeVerbindung({ status: 'verbunden', fehler: null })
    await durch()
    const neu = b.oeffne('fenster-n')
    await durch()
    expect(neu.schreibfenster.value).toBe('fenster-e')
    expect(neu.verbindung.value).toEqual({ status: 'verbunden', fehler: null })
  })

  it('der Verbindungsstand des Führungsfensters erreicht die anderen, auch Fehlercodes', async () => {
    const b = browser()
    const fuehrung = b.oeffne('fenster-f')
    const andere = b.oeffne('fenster-e')
    await durch()
    fuehrung.meldeVerbindung({ status: 'neu-verbinden', fehler: { code: 'zu-viele-anfragen' } })
    await durch()
    expect(andere.verbindung.value).toEqual({ status: 'neu-verbinden', fehler: { code: 'zu-viele-anfragen' } })
    fuehrung.meldeVerbindung(null)
    await durch()
    expect(andere.verbindung.value).toBeNull()
  })

  it('schließt ein Fenster, gilt es nicht mehr als Schreibfenster; schließt das Führungsfenster, ist sein Stand weg', async () => {
    const b = browser()
    const fuehrung = b.oeffne('fenster-f')
    const erfassung = b.oeffne('fenster-e')
    const dritte = b.oeffne('fenster-d')
    erfassung.bedient()
    fuehrung.meldeVerbindung({ status: 'verbunden', fehler: null })
    await durch()
    erfassung.schliesse()
    fuehrung.schliesse()
    await durch()
    expect(dritte.schreibfenster.value).toBeNull()
    expect(dritte.verbindung.value).toBeNull()
  })
})

describe('verwirft Fremdes und Kaputtes', () => {
  it('kaputter Text, falsche Form, unbekannte Art – nichts passiert', async () => {
    const b = browser()
    const bus = b.oeffne('fenster-e', { kanal: 'nein' })
    const anwenden = vi.fn(() => 'angewandt' as const)
    bus.beimAnwenden(anwenden)
    const roh = [
      'kein json',
      JSON.stringify(['k', 'fenster-f']),
      JSON.stringify({ k: 'x1', von: 'fenster-f', n: { art: 'loesche-alles' } }),
      JSON.stringify({ k: 'x2', von: 'fenster-f', n: { art: 'anwenden', an: 'fenster-e', auftrag: 'a1', action: 'BETRIEB_MELDUNG' } }),
      JSON.stringify({ k: 'x3', von: 'fenster-f', n: { art: 'anwenden', an: 'fenster-e', auftrag: 'a2', action: { type: 42 } } }),
      JSON.stringify({ k: 'x4', von: 'fenster-f', n: { art: 'bedient', um: 'gestern' } }),
      JSON.stringify({ k: 'x5', von: 'fenster-f', n: { art: 'verbindung', meldung: { status: 'irgendwas', fehler: null } } }),
      JSON.stringify({ k: 'x6', von: 'fenster-f', n: { art: 'verbindung', meldung: { status: 'fehler', fehler: { code: 'Text statt Code' } } } }),
      JSON.stringify({ von: 'fenster-f', n: { art: 'bedient', um: 5 } }),
    ]
    for (const text of roh) b.einspeisen(text)
    await durch()
    expect(anwenden).not.toHaveBeenCalled()
    expect(bus.schreibfenster.value).toBeNull()
    expect(bus.verbindung.value).toBeNull()
  })

  it('eine schon bekannte Nachricht (über beide Wege gekommen) wirkt nur einmal', async () => {
    const b = browser()
    const bus = b.oeffne('fenster-e', { kanal: 'nein' })
    const anwenden = vi.fn(() => 'angewandt' as const)
    bus.beimAnwenden(anwenden)
    const text = JSON.stringify({ k: 'y1', von: 'fenster-f', n: { art: 'anwenden', an: 'fenster-e', auftrag: 'a1', action: meldung } })
    b.einspeisen(text)
    b.einspeisen(text)
    await durch()
    expect(anwenden).toHaveBeenCalledOnce()
  })

  it('eine weitergereichte Action kommt ohne `zeit` an – die stempelt das Schreibfenster', async () => {
    const b = browser()
    const fuehrung = b.oeffne('fenster-f')
    const erfassung = b.oeffne('fenster-e')
    const angewandt: GeraeteAction[] = []
    erfassung.beimAnwenden((a) => {
      angewandt.push(a)
      return 'angewandt'
    })
    erfassung.bedient()
    await durch()
    await fuehrung.reicheWeiter({ ...meldung, zeit: 1 }, () => 'unveraendert')
    expect(angewandt[0]).not.toHaveProperty('zeit')
  })
})
