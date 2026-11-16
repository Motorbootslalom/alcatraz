import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { STATE_KEY } from './persistenz/storage'
import { betriebsStand, festgeschrieben } from './testHilfen'

// Der echte Start eines Fensters mit `#/spectators` (Zuschauerliste, E3): main.ts wählt die Wurzel VOR jedem Store.
// Wie die Anzeigetafel (main.test.ts) darf das Fenster nichts schreiben – keinen Stand, keine Kennung, keinen
// zweiten Speicher. Eigene Datei, weil main.ts beim Import startet (einmal je Datei). Starter erfunden (testHilfen).

vi.mock('./lib/offline', async (original) => ({ ...(await original<typeof import('./lib/offline')>()), starteOffline: vi.fn() }))

describe('main.ts mit #/spectators', () => {
  it('startet die Zuschauerliste mit Nur-Lese-Store: kein Kopf, kein Schreiben, keine IndexedDB', async () => {
    localStorage.clear()
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...festgeschrieben(betriebsStand()), kennung: '' }))
    const gespeichert = localStorage.getItem(STATE_KEY)
    location.hash = '#/spectators'
    document.body.innerHTML = '<div id="app"></div>'
    const setItem = vi.spyOn(localStorage, 'setItem')
    const removeItem = vi.spyOn(localStorage, 'removeItem')
    const open = vi.fn()
    vi.stubGlobal('indexedDB', { open })

    await import('./main')
    await flushPromises()

    expect(document.querySelector('.zuschauer-app')).not.toBeNull()
    expect(document.querySelector('.anzeige')).toBeNull()
    expect(document.querySelector('.topbar')).toBeNull()
    expect(setItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    expect(localStorage.getItem(STATE_KEY)).toBe(gespeichert)
  })
})
