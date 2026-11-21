import { describe, expect, it } from 'vitest'
import { ABLAGE } from './ablage'
import { oeffneTabWache } from './tabWache'

/** Befund 15 (21.11.2026): nur der zuletzt geöffnete Tab schreibt die Geräte-Ablage. */
function speicher() {
  const daten = new Map<string, string>()
  return { daten, getItem: (k: string) => daten.get(k) ?? null, setItem: (k: string, v: string) => void daten.set(k, v), removeItem: (k: string) => void daten.delete(k) }
}

describe('tabWache', () => {
  it('der neue Tab gewinnt; der alte schreibt nichts mehr unter alcatraz.geraet.* und gilt als verdrängt', () => {
    const s = speicher()
    const alt = oeffneTabWache({ ablage: s, fenster: null, id: 'alt' })
    alt.ablage!.setItem(ABLAGE.verbindung, 'a')
    const neu = oeffneTabWache({ ablage: s, fenster: null, id: 'neu' })
    neu.ablage!.setItem(ABLAGE.verbindung, 'n')
    alt.ablage!.setItem(ABLAGE.verbindung, 'alt-leer')
    alt.ablage!.removeItem(ABLAGE.geraetWkr)
    expect(s.daten.get(ABLAGE.verbindung)).toBe('n')
    expect(alt.verdraengt.value).toBe(true)
    expect(neu.verdraengt.value).toBe(false)
    // Fremde Schlüssel (nicht die Geräte-Ablage) bleiben unberührt von der Wache.
    alt.ablage!.setItem('anderes', 'x')
    expect(s.daten.get('anderes')).toBe('x')
  })

  it('„Hier weitermachen“ dreht es um; das storage-Ereignis meldet die Verdrängung ohne eigenes Schreiben', () => {
    const s = speicher()
    const fenster = new EventTarget()
    const alt = oeffneTabWache({ ablage: s, fenster, id: 'alt' })
    const neu = oeffneTabWache({ ablage: s, fenster: null, id: 'neu' })
    const ereignis = Object.assign(new Event('storage'), { key: ABLAGE.geraetTab, newValue: s.daten.get(ABLAGE.geraetTab) })
    fenster.dispatchEvent(ereignis)
    expect(alt.verdraengt.value).toBe(true)
    alt.uebernimm()
    expect(alt.meins()).toBe(true)
    expect(neu.meins()).toBe(false)
    expect(neu.verdraengt.value).toBe(true)
    alt.stop()
  })
})
