import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { anzeigeFensterName, anzeigeUrl, oeffneAnzeige, verbindeAnzeigen } from './anzeigeFenster'
import { setLocale } from '../i18n'

// Bedienfenster und Anzeigetafel: Rückfall per postMessage, wo das storage-Ereignis nicht trägt (file://).

/** Ein Fenster, wie window.open es liefert – nur, was hier gebraucht wird. */
const fremdesFenster = () => ({ closed: false, postMessage: vi.fn() })

let ende: (() => void) | undefined
beforeEach(() => setLocale('de'))
afterEach(() => {
  ende?.()
  ende = undefined
  vi.restoreAllMocks()
  setLocale('de')
})

describe('Fenster der Anzeigetafel', () => {
  it('Adresse und Name: gemeinsam oder je Bereich, in der Sprache der Oberfläche', () => {
    expect(anzeigeUrl()).toMatch(/^[^#]*#\/anzeige$/)
    expect(anzeigeUrl('par_2')).toMatch(/#\/anzeige\/par_2$/)
    setLocale('en')
    expect(anzeigeUrl()).toMatch(/#\/display$/)
    expect([anzeigeFensterName(), anzeigeFensterName('par_2')]).toEqual(['alcatraz-anzeige', 'alcatraz-anzeige-par_2'])
  })

  it('stößt geöffnete und gemeldete Anzeigetafeln nach jeder Änderung an; geschlossene nicht mehr', async () => {
    const stand = ref(0)
    ende = verbindeAnzeigen(() => stand.value)
    const geoeffnet = fremdesFenster()
    vi.spyOn(window, 'open').mockReturnValue(geoeffnet as unknown as Window)
    oeffneAnzeige()
    // Eine Tafel, die das Bedienfenster nicht (mehr) kennt – etwa nach dessen Neuladen –, meldet sich selbst.
    const gemeldet = fremdesFenster()
    window.dispatchEvent(new MessageEvent('message', { data: { alcatraz: 'alcatraz-anzeige-da' }, source: gemeldet as unknown as Window }))

    stand.value++
    await nextTick()
    expect(geoeffnet.postMessage).toHaveBeenCalledWith({ alcatraz: 'alcatraz-stand' }, '*')
    expect(gemeldet.postMessage).toHaveBeenCalledTimes(1)

    geoeffnet.closed = true
    stand.value++
    await nextTick()
    expect(geoeffnet.postMessage).toHaveBeenCalledTimes(1)
    expect(gemeldet.postMessage).toHaveBeenCalledTimes(2)
    // Fremde Nachrichten registrieren nichts.
    const fremd = fremdesFenster()
    window.dispatchEvent(new MessageEvent('message', { data: 'hallo', source: fremd as unknown as Window }))
    stand.value++
    await nextTick()
    expect(fremd.postMessage).not.toHaveBeenCalled()
  })
})
