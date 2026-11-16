import { describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { STATE_KEY } from './persistenz/storage'
import { betriebsStand, festgeschrieben } from './testHilfen'

// Der echte Start eines Fensters mit `#/anzeige`: main.ts mit allem, was es lädt (Farbschema, Texte, Adressen,
// AnzeigeApp). Das Fenster der Anzeigetafel darf beim Start nichts schreiben – keinen Stand, keine Kennung,
// keinen zweiten Speicher. Eigene Datei, weil main.ts beim Import startet (einmal je Datei).
// Alle Starter sind erfunden (Vor<id>/Nach<id>, Musterclub).

vi.mock('./lib/offline', async (original) => ({ ...(await original<typeof import('./lib/offline')>()), starteOffline: vi.fn() }))

describe('main.ts mit #/anzeige', () => {
  it('startet die Anzeigetafel mit Nur-Lese-Store: kein Schreiben, keine IndexedDB, keine Kennung', async () => {
    // Ein Stand ohne Kennung: Der volle Store vergäbe eine und speicherte sie (SET_KENNUNG).
    localStorage.clear()
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...festgeschrieben(betriebsStand()), kennung: '' }))
    const gespeichert = localStorage.getItem(STATE_KEY)
    location.hash = '#/anzeige'
    document.body.innerHTML = '<div id="app"></div>'
    // An der Instanz spionieren: localStorage ist in den Tests eine eigene Klasse (test-setup.ts), kein Storage.
    const setItem = vi.spyOn(localStorage, 'setItem')
    const removeItem = vi.spyOn(localStorage, 'removeItem')
    const open = vi.fn()
    vi.stubGlobal('indexedDB', { open })

    await import('./main')
    await flushPromises()

    expect(document.querySelector('.anzeige')).not.toBeNull()
    expect(document.querySelector('.topbar')).toBeNull()
    expect(setItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
    expect(localStorage.getItem(STATE_KEY)).toBe(gespeichert)
  })
})
