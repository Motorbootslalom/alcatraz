import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { STATE_KEY } from './persistenz/storage'
import { packeLesePaket, sehenAdresse } from './geraete/paket'
import { lesePaket, neuerRaum } from './geraete/transport/ntfy/raum'
import { starteOffline } from './lib/offline'

// Der echte Start eines Geräts mit Lese-Link (main.ts, `#/sehen/<paket>`, E6): eigene Wurzel src/GeraetApp.vue ohne
// Store – kein Kopf, kein Stand einer Veranstaltung wird geschrieben, und gesprochen wird nur mit dem Server aus dem
// Link. Der Offline-Speicher startet, übernimmt eine neue Fassung aber nie von selbst (nur gezielt, F7). Eigene Datei,
// weil main.ts beim Import startet (einmal je Datei). Server erfunden (example.org), kein echtes Netz.

vi.mock('./lib/offline', async (original) => ({ ...(await original<typeof import('./lib/offline')>()), starteOffline: vi.fn(async () => {}) }))

describe('main.ts: Gerät mit Lese-Link', () => {
  it('GeraetApp statt App; kein Store, nur der Server aus dem Link', async () => {
    localStorage.clear()
    const link = packeLesePaket(lesePaket(neuerRaum('https://ntfy.example.org'), 'z'))
    location.hash = sehenAdresse(link)
    document.body.innerHTML = '<div id="app"></div>'
    const netz: string[] = []
    vi.stubGlobal('fetch', vi.fn((url: unknown) => {
      netz.push(String(url))
      return Promise.reject(new Error('kein Netz im Test'))
    }))
    vi.stubGlobal('WebSocket', class {
      constructor(url: string) {
        netz.push(url)
        throw new Error('kein Netz im Test')
      }
    })

    await import('./main')
    await flushPromises()
    await new Promise((erfuelle) => setTimeout(erfuelle, 100))

    expect(document.querySelector('.geraet-app')).not.toBeNull()
    expect(document.querySelector('.topbar')).toBeNull()
    expect(localStorage.getItem(STATE_KEY)).toBeNull()
    // Gefragt wird nur beim Server des Links – und überhaupt erst hier, weil der Link es so will.
    expect(netz.length).toBeGreaterThan(0)
    for (const url of netz) expect(url).toMatch(/^(https|wss):\/\/ntfy\.example\.org\//)
    // Offline-Speicher ja, aber ohne „von selbst übernehmen“.
    expect(starteOffline).toHaveBeenCalledOnce()
    expect(vi.mocked(starteOffline).mock.calls[0][0]?.darfVonSelbst).toBeUndefined()
    vi.unstubAllGlobals()
  })
})
