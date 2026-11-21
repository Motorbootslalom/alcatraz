import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { STATE_KEY } from './persistenz/storage'

// Der echte Start der Übung der WKR-Maske (main.ts, `#/uebung`, W3.4, G13): Wurzel src/GeraetApp.vue OHNE Store –
// kein Kopf, kein Stand einer Veranstaltung wird geschrieben – und OHNE Netz: kein WebSocket, kein fetch, kein
// XMLHttpRequest, keine EventSource, auch nicht beim Üben selbst (Muster main.geraete.test.ts). Gemerkt wird nur die
// Ansicht. Eigene Datei, weil main.ts beim Import startet (einmal je Datei).

vi.mock('./lib/offline', async (original) => ({ ...(await original<typeof import('./lib/offline')>()), starteOffline: vi.fn(async () => {}) }))

describe('main.ts: Übung der WKR-Maske', () => {
  it('GeraetApp ohne Store; Wahl Regelwerk × Liste, dann die echte Maske – ohne jede Verbindung', async () => {
    localStorage.clear()
    location.hash = '#/uebung'
    document.body.innerHTML = '<div id="app"></div>'
    const netz: string[] = []
    vi.stubGlobal('fetch', vi.fn((url: unknown) => {
      netz.push(`fetch ${String(url)}`)
      return Promise.reject(new Error('kein Netz im Test'))
    }))
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
    expect(document.querySelector('[data-teil="uebung-wahl"]')).not.toBeNull()
    expect(document.querySelector('.topbar')).toBeNull()
    expect(document.querySelector('[data-teil="uebung"]')?.textContent).toMatch(/^(ÜBUNG|PRACTICE)$/)

    const klick = async (selektor: string) => {
      document.querySelector<HTMLElement>(selektor)!.click()
      await flushPromises()
    }
    await klick('[data-action="uebung-regelwerk"][data-regelwerk="uim-2026"]')
    await klick('[data-action="uebung-liste"][data-liste="steg-ab"]')
    await klick('[data-action="uebung-start"]')
    expect(document.querySelector('[data-teil="maske"]')).not.toBeNull()
    expect(document.querySelector('[data-teil="wkr-kopf"] [data-teil="uebung"]')).not.toBeNull()
    expect(document.querySelectorAll('[data-action="steg-teil"]')).toHaveLength(1)
    await klick('[data-action="haupt"]')
    await new Promise((erfuelle) => setTimeout(erfuelle, 400))
    await flushPromises()
    expect(document.querySelector('[data-teil="leiste-zeile"]')?.getAttribute('data-stufe')).toBe('uebernommen')
    // Übung verlassen → wieder die Wahl.
    await klick('[data-action="mehr"]')
    await klick('[data-action="uebung-ende"]')
    expect(document.querySelector('[data-teil="uebung-wahl"]')).not.toBeNull()

    expect(netz).toEqual([])
    expect(localStorage.getItem(STATE_KEY)).toBeNull()
    // Nichts außer (höchstens) der Ansicht im Speicher – kein Ausgang, keine Kopplung, keine Probe.
    const schluessel = Object.keys(localStorage).filter((k) => k.startsWith('alcatraz.'))
    for (const k of schluessel) expect(['alcatraz.geraet.ansicht', 'alcatraz.locale', 'alcatraz.theme']).toContain(k)
    vi.unstubAllGlobals()
  })
})
