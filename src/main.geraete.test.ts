import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { STATE_KEY } from './persistenz/storage'
import { legeRaumAn } from './geraete/ablage'
import { betriebsStand, festgeschrieben } from './testHilfen'

// Der echte Start des Bedienfensters (main.ts mit App, Store, Gerätebetrieb; E6): Bis jemand unter Betrieb → Geräte
// einen Raum öffnet, verlässt nichts den Browser – auch nicht, wenn der Unterreiter „Geräte“ offen ist – kein WebSocket, kein fetch, kein XMLHttpRequest, keine EventSource,
// auch nicht, wenn im Speicher noch der Raum einer ANDEREN Veranstaltung liegt. Eigene Datei, weil main.ts beim Import
// startet (einmal je Datei). Starter erfunden (testHilfen).

vi.mock('./lib/offline', async (original) => ({ ...(await original<typeof import('./lib/offline')>()), starteOffline: vi.fn() }))

describe('main.ts: Bedienfenster ohne geöffneten Raum', () => {
  it('baut keine Verbindung zu einem Server auf – auch nicht bei Bedienung des Betriebs', async () => {
    localStorage.clear()
    // Mit WKR-Einteilung (W3-13, 21.11.2026): Ein Name, der an die Geräte gehen könnte, öffnet trotzdem keinen Weg ins Netz.
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...festgeschrieben(betriebsStand()), kennung: 'MUSTERK1', einteilung: { par_1: { tor5: 'Erika Einteilung' } } }))
    legeRaumAn('ANDERE01', 'https://ntfy.example.org')
    location.hash = '#/betrieb'
    document.body.innerHTML = '<div id="app"></div>'
    const netz: string[] = []
    const fetch = vi.fn((url: unknown) => {
      netz.push(`fetch ${String(url)}`)
      return Promise.reject(new Error('kein Netz im Test'))
    })
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('WebSocket', class {
      constructor(url: string) {
        netz.push(`ws ${url}`)
      }
    })
    vi.stubGlobal('EventSource', class {
      constructor(url: string) {
        netz.push(`es ${url}`)
      }
    })
    vi.stubGlobal('XMLHttpRequest', class {
      open(_art: string, url: string) {
        netz.push(`xhr ${url}`)
      }
      send() {}
    })

    await import('./main')
    await flushPromises()
    // Bedienen wie am Wettkampftag: Lauf beginnen, Start zeigen (die Knöpfe der Start-Freigabe).
    const geklickt: string[] = []
    for (const knopf of ['[data-action="beginnen"]', '[data-action="zeigen"]', '[data-action="zeigen"]']) {
      const el = document.querySelector<HTMLButtonElement>(knopf)
      if (el && !el.disabled) {
        el.click()
        geklickt.push(knopf)
      }
      await flushPromises()
    }
    // Auch Betrieb → WKR (Name der Einteilung je Liste) verbindet nicht.
    location.hash = '#/betrieb/wkr'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await flushPromises()
    // Auch der Unterreiter „Geräte“ verbindet nicht von selbst – erst sein Knopf „Gerätebetrieb einschalten“.
    location.hash = '#/betrieb/geraete'
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await flushPromises()
    expect(document.querySelector('[data-action="geraete-einschalten"]')).not.toBeNull()
    expect(document.querySelector('.lese-link')).toBeNull()
    await new Promise((erfuelle) => setTimeout(erfuelle, 200))

    expect(document.querySelector('.topbar')).not.toBeNull()
    // Der Betrieb lief wirklich (sonst bewiese der Test wenig): beginnen und zweimal zeigen.
    expect(geklickt).toHaveLength(3)
    expect(JSON.parse(localStorage.getItem(STATE_KEY)!).betrieb.bereiche.par_1.gezeigt).toHaveLength(2)
    expect(netz).toEqual([])
    vi.unstubAllGlobals()
  })
})
