import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import EingabenHinweis from './EingabenHinweis.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'
import { wechsleRegelwerk } from '../testHilfen'

// Der Hinweis auf erfasste Werte, die keine Liste mehr zeigt – zugeklappt kurz, aufgeklappt
// mit jedem Wert einzeln. Alle Starter sind erfunden.

const starter = (id: string, klasse: ClassId, startNr: string, nachname: string): Starter => ({ id, startNr, vorname: 'Vera', nachname, verein: '', bundesland: '', geburtsdatum: '', klasse, groesse: '' })
const zeige = (store: Store) => mount(EingabenHinweis, { global: { provide: { [storeKey as symbol]: store } } })

describe('Hinweis auf verborgene Werte', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    vergissAlles()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter('a', '4', '401', 'Muster'), starter('b', '1', '101', 'Beispiel')] })
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: [
        { lauf: 'manoevrieren/1', starter: 'a', feld: 'zeit1', wert: '1,2345' },
        { lauf: 'manoevrieren/3', starter: 'a', feld: 'zeit1', wert: '80' },
        { lauf: 'manoevrieren/3', starter: 'a', feld: 'erfasst@gate135', wert: '1' },
        { lauf: 'manoevrieren/1', starter: 'b', feld: 'disq@vorsteg', wert: 'X' },
      ],
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vergissAlles()
    setLocale('de')
  })

  const zeilen = (wrapper: ReturnType<typeof zeige>) => wrapper.findAll('.verborgen-tabelle tbody tr').map((tr) => tr.findAll('td').map((td) => td.text()))

  it('ohne verborgene Werte steht nichts da', () => {
    expect(zeige(store).find('[data-hinweis="verborgene-eingaben"]').exists()).toBe(false)
  })

  it('zugeklappt so kurz wie bisher: Zahl, Knopf zum Entfernen, „Einzelheiten“', async () => {
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 2 } })
    const wrapper = zeige(store)
    const hinweis = wrapper.find('[data-hinweis="verborgene-eingaben"]')
    expect(hinweis.text()).toContain('Für 1 Starter stehen 2 erfasste Werte im Stand, die keine Liste mehr zeigt')
    expect(hinweis.find('[data-action="verborgene-entfernen"]').exists()).toBe(true)
    const schalter = hinweis.find('[data-action="verborgene-einzelheiten"]')
    expect(schalter.text()).toContain('Einzelheiten')
    expect(schalter.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('.verborgen-einzeln').exists()).toBe(false)
  })

  it('aufgeklappt: je Starter Startnummer, Name und Klasse, je Wert Lauf, Liste, Feld, Wert, Wertung und Grund', async () => {
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 2 } })
    const wrapper = zeige(store)
    await wrapper.find('[data-action="verborgene-einzelheiten"]').trigger('click')
    expect(wrapper.find('[data-action="verborgene-einzelheiten"]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.findAll('.verborgen-starter summary').map((h) => h.text().replace(/\s+/g, ' '))).toEqual(['401 Muster, Vera Klasse 4 2 Werte'])
    expect((wrapper.find('.verborgen-starter').element as HTMLDetailsElement).open).toBe(true)
    expect(wrapper.findAll('.verborgen-tabelle thead th').map((th) => th.text())).toEqual(['Lauf', 'Liste', 'Feld', 'Gespeicherter Wert', 'Wertung', 'Warum nicht mehr sichtbar'])
    expect(zeilen(wrapper)).toEqual([
      // Die Zeit steht da wie in der Erfassung.
      ['3. Lauf', 'Zeit', expect.stringContaining('Zeit'), '01:20,00 (80,00)', 'nur gespeichert', 'Der Lauf liegt über der eingestellten Zahl der Läufe (2).'],
      ['3. Lauf', 'Tor 1 / 3 / 5', 'Haken „Zeile ist abgetippt“', '✓', 'nur gespeichert', 'Der Lauf liegt über der eingestellten Zahl der Läufe (2).'],
    ])
    expect(wrapper.find('.verborgen-erklaerung').text()).toContain('Keiner dieser Werte zählt in der Wertung mit')
  })

  it('Klasse, die das Regelwerk nicht kennt: eigener Grund; ein unbekanntes Feld heißt so, mit seiner Kennung', async () => {
    // Das Starterfeld steht fest, sobald Werte erfasst sind – die Klasse lässt sich aber ändern.
    store.dispatch({ type: 'UPDATE_STARTER', id: 'a', patch: { klasse: '7' } })
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'b', feld: 'gibt-es-nicht', wert: '5' }] })
    wechsleRegelwerk(store, 'uim-2026')
    const wrapper = zeige(store)
    await wrapper.find('[data-action="verborgene-einzelheiten"]').trigger('click')
    const fremd = wrapper.findAll('.verborgen-tabelle tbody tr[data-grund="klasseFehlt"]')
    expect(fremd.length).toBeGreaterThan(0)
    expect(fremd[0].findAll('td').at(-1)!.text()).toBe('Die Klasse des Starters gibt es im eingestellten Regelwerk nicht.')
    expect(fremd.every((tr) => tr.attributes('data-zaehlt') === 'nein')).toBe(true)
    const unbekannt = wrapper.find('.verborgen-tabelle tbody tr[data-feld="gibt-es-nicht"]')
    expect(unbekannt.findAll('td')[2].text()).toBe('unbekanntes Feld (Kennung „gibt-es-nicht“)')
  })

  it('was weiter mitzählt, ist gekennzeichnet und gezählt', async () => {
    store.dispatch({ type: 'SET_AUFBAU', aufbau: 'frontal' })
    const wrapper = zeige(store)
    await wrapper.find('[data-action="verborgene-einzelheiten"]').trigger('click')
    const vorsteg = wrapper.find('.verborgen-starter[data-starter="b"] tr[data-feld="disq@vorsteg"]')
    expect(vorsteg.attributes('data-zaehlt')).toBe('ja')
    expect(vorsteg.find('.verborgen-marke--zaehlt').text()).toBe('zählt mit')
    expect(wrapper.find('.verborgen-starter[data-starter="b"] summary').text().replace(/\s+/g, ' ')).toBe('101 Beispiel, Vera Klasse 1 1 Wert · 1 zählt mit')
    expect(vorsteg.findAll('td').map((td) => td.text()).slice(0, 4)).toEqual(['1. Lauf', 'Vorsteg', 'Disq.', 'X'])
    expect(wrapper.find('.verborgen-erklaerung').text()).toMatch(/^\d+ dieser Werte? zähl(t|en) in der Wertung weiter mit/)
    // Starter nach Startnummer: 101 vor 401.
    expect(wrapper.findAll('.verborgen-starter').map((s) => s.attributes('data-starter'))[0]).toBe('b')
  })

  it('aufgeklappt bleibt aufgeklappt, wenn die Ansicht wechselt; Entfernen fragt nach und leert genau diese Werte', async () => {
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 2 } })
    const wrapper = zeige(store)
    await wrapper.find('[data-action="verborgene-einzelheiten"]').trigger('click')
    wrapper.unmount()
    const wieder = zeige(store)
    expect(wieder.find('.verborgen-einzeln').exists()).toBe(true)
    const frage = vi.fn(() => false)
    vi.stubGlobal('confirm', frage)
    await wieder.find('[data-action="verborgene-entfernen"]').trigger('click')
    expect(frage).toHaveBeenCalledWith(expect.stringContaining('2 nicht mehr sichtbaren Werte'))
    expect(Object.keys(store.state.value.eingaben)).toContain('manoevrieren/3')
    frage.mockReturnValue(true)
    await wieder.find('[data-action="verborgene-entfernen"]').trigger('click')
    await nextTick()
    expect(Object.keys(store.state.value.eingaben)).toEqual(['manoevrieren/1'])
    expect(wieder.find('[data-hinweis="verborgene-eingaben"]').exists()).toBe(false)
  })

  it('englisch', async () => {
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 2 } })
    setLocale('en')
    const wrapper = zeige(store)
    await wrapper.find('[data-action="verborgene-einzelheiten"]').trigger('click')
    expect(wrapper.find('[data-action="verborgene-einzelheiten"]').text()).toContain('Details')
    expect(zeilen(wrapper)[0].slice(3)).toEqual(['01:20.00 (80.00)', 'stored only', 'The attempt is beyond the number of attempts set (2).'])
  })
})
