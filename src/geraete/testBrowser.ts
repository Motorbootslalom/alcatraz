/**
 * Nur für Tests: ein nachgebauter Browser mit mehreren Fenstern (E6) – gemeinsamer localStorage mit storage-Ereignis
 * in den ANDEREN Fenstern (wie im Browser, später zugestellt), BroadcastChannel und Web Locks (ein Schloss, der Reihe
 * nach vergeben, Abbruch per Signal). Vorbilder: fensterbus.test.ts `browser`, fuehrung.test.ts `nachgebauteSperren`.
 */
import type { Ablage } from './ablage'
import type { BusUmgebung, Kanal } from './fensterbus'
import type { FuehrungsUmgebung, Sperren } from './fuehrung'

/** Web Locks nachgebaut: ein Schloss je Name, der Reihe nach vergeben, Abbruch per Signal – wie navigator.locks. */
export function nachgebauteSperren(): Sperren & { anfragen: number } {
  const gehalten = new Set<string>()
  const wartend = new Map<string, { rueckruf: () => unknown; fertig: (v: unknown) => void; fehler: (e: unknown) => void }[]>()
  const vergib = (name: string) => {
    const liste = wartend.get(name) ?? []
    if (gehalten.has(name)) return
    const naechster = liste.shift()
    if (!naechster) return
    gehalten.add(name)
    // Wie im Browser: Das Schloss kommt in einer späteren Aufgabe, nicht im Aufruf selbst.
    void Promise.resolve()
      .then(() => naechster.rueckruf())
      .then(
        (v) => {
          gehalten.delete(name)
          naechster.fertig(v)
          vergib(name)
        },
        (e: unknown) => {
          gehalten.delete(name)
          naechster.fehler(e)
          vergib(name)
        },
      )
  }
  const sperren = {
    anfragen: 0,
    request(name: string, optionen: { signal?: AbortSignal }, rueckruf: () => Promise<void> | void) {
      sperren.anfragen++
      return new Promise((fertig, fehler) => {
        const eintrag = { rueckruf, fertig, fehler }
        const liste = wartend.get(name) ?? []
        wartend.set(name, liste)
        optionen.signal?.addEventListener('abort', () => {
          const i = liste.indexOf(eintrag)
          if (i < 0) return
          liste.splice(i, 1)
          fehler(new DOMException('abgebrochen', 'AbortError'))
        })
        liste.push(eintrag)
        vergib(name)
      })
    },
  }
  return sperren
}

class NachgebauterKanal implements Kanal {
  onmessage: ((e: MessageEvent) => void) | null = null
  constructor(
    private readonly name: string,
    private readonly alle: Set<NachgebauterKanal>,
  ) {
    alle.add(this)
  }

  postMessage(daten: unknown): void {
    for (const k of this.alle) if (k !== this && k.name === this.name) queueMicrotask(() => k.onmessage?.({ data: daten } as MessageEvent))
  }

  close(): void {
    this.alle.delete(this)
  }
}

export interface TestFenster {
  ablage: Ablage
  fenster: EventTarget
  bus: BusUmgebung
  fuehrung: FuehrungsUmgebung
}

/** Ein Browser: jedes `fenster()` teilt Speicher, Kanal und Schloss mit den anderen. */
export function nachgebauterBrowser() {
  const zentral = new Map<string, string>()
  const fensterListe: EventTarget[] = []
  const kanaele = new Set<NachgebauterKanal>()
  const sperren = nachgebauteSperren()
  const melde = (von: EventTarget, key: string, newValue: string | null) => {
    for (const f of fensterListe) if (f !== von) queueMicrotask(() => f.dispatchEvent(Object.assign(new Event('storage'), { key, newValue })))
  }
  return {
    zentral,
    sperren,
    fenster(): TestFenster {
      const ziel = new EventTarget()
      fensterListe.push(ziel)
      const ablage: Ablage = {
        getItem: (k) => zentral.get(k) ?? null,
        setItem: (k, v) => {
          zentral.set(k, String(v))
          melde(ziel, k, String(v))
        },
        removeItem: (k) => {
          if (!zentral.delete(k)) return
          melde(ziel, k, null)
        },
      }
      return {
        ablage,
        fenster: ziel,
        bus: { kanal: (name) => new NachgebauterKanal(name, kanaele), ablage, fenster: ziel },
        fuehrung: { sperren, ablage, fenster: ziel },
      }
    },
  }
}
