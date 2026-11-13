import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EventView from './EventView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'

describe('Veranstaltung', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })
  afterEach(() => setLocale('de'))

  it('die WKR-Einteilung steht nicht mehr hier; beim Aufbau bleibt nur der Weg zu den Einstellungen', () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    expect(wrapper.find('.wkr-einteilung').exists()).toBe(false)
    expect(wrapper.find('.wkr-tabelle').exists()).toBe(false)
    expect(wrapper.find('.bogen').exists()).toBe(false)
    const hinweis = wrapper.find('[data-hinweis="wkr"]')
    expect(hinweis.text()).toContain('Wer an welcher Liste sitzt')
    expect(hinweis.find('a').attributes('href')).toBe('#/einstellungen?wkr')
    expect(hinweis.find('a').text()).toBe('Einstellungen → WKR-Einteilung')
    wrapper.unmount()
  })

  it('der Verweis spricht auch Englisch', () => {
    setLocale('en')
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    expect(wrapper.find('[data-hinweis="wkr"] a').text()).toBe('Settings → Judges')
    wrapper.unmount()
  })

  it('UIM sieht zwei Versuche vor, der bessere zählt: Weicht die Einstellung ab, steht es beim Regelwerk', async () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const hinweis = () => wrapper.find('[data-hinweis="regel-laeufe"]')
    // Die DM gibt nichts vor.
    expect(hinweis().exists()).toBe(false)
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await wrapper.vm.$nextTick()
    expect(hinweis().text()).toContain('UIM 2026 sieht 2 Läufe vor, davon 1 gestrichen. Eingestellt sind 3 Läufe, davon 1 gestrichen')
    // Zwei Läufe „nach Regel“ strichen keinen: Es zählte die Summe statt des besseren Versuchs.
    store.dispatch({ type: 'LOAD_STATE', state: { ...store.state.value, laufCount: 2 } })
    await wrapper.vm.$nextTick()
    expect(hinweis().text()).toContain('Eingestellt sind 2 Läufe, davon 0 gestrichen')
    store.dispatch({ type: 'SET_STREICHLAEUFE', streichlaeufe: 1 })
    await wrapper.vm.$nextTick()
    expect(hinweis().exists()).toBe(false)
    wrapper.unmount()
  })

  it('zugeklappte Beispielansicht beim Aufbau: Sie folgt dem gewählten Aufbau und nimmt Namen an', async () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const klappe = wrapper.find('details[data-vorschau]')
    expect(klappe.find('summary').text()).toContain('So sehen die Listen dieses Aufbaus aus')
    // Zugeklappt wird nichts gebaut.
    expect(klappe.find('.wkr-vorschau').exists()).toBe(false)
    ;(klappe.element as HTMLDetailsElement).open = true
    await klappe.trigger('toggle')
    const reiter = () => klappe.findAll('.wkr-vorschau-tabs button').map((b) => b.attributes('data-liste'))
    expect(reiter()).toContain('gate135')
    expect(klappe.findAll('.bogen')).toHaveLength(1)
    await wrapper.find('#ev-aufbau').setValue('berlin')
    expect(reiter()).toEqual(['steg', 'bstartziel', 'brechts', 'blinks', 'knoten'])
    await klappe.find('.bogen[data-liste="steg"] input.bk-wkr-input').setValue('A. Muster')
    expect(store.state.value.einteilung).toEqual({ par_2: { steg: 'A. Muster' } })
    wrapper.unmount()
  })

  it('Aufbau wechseln mit schon erfassten Werten: erst nach Rückfrage – sie nennt, was sich ändern kann', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: [{ id: 'p1', startNr: '401', vorname: 'Vor', nachname: 'Nach', verein: '', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' }] })
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const vorher = store.state.value.aufbau
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const wahl = wrapper.find('#ev-aufbau')
    await wahl.setValue('berlin')
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0].join()).toContain('Lichtschranke')
    // Abgelehnt: Stand und Auswahlfeld bleiben beim alten Aufbau.
    expect(store.state.value.aufbau).toBe(vorher)
    expect((wahl.element as HTMLSelectElement).value).toBe(vorher)
    confirm.mockReturnValue(true)
    await wahl.setValue('berlin')
    expect(store.state.value.aufbau).toBe('berlin')
    // Ohne erfasste Werte wird nicht gefragt.
    store.dispatch({ type: 'CLEAR_EINGABEN' })
    await wahl.setValue('frontal')
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(store.state.value.aufbau).toBe('frontal')
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  describe('Beispieldaten', () => {
    const block = (wrapper: ReturnType<typeof mount>) => wrapper.find('details[data-block="beispieldaten"]')
    const offen = (wrapper: ReturnType<typeof mount>) => (block(wrapper).element as HTMLDetailsElement).open
    const zeige = () => mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })

    it('der Block steht am Ende der Ansicht und ist zugeklappt, solange keine Beispieldaten geladen sind', () => {
      const wrapper = zeige()
      expect(block(wrapper).find('summary').text()).toBe('Beispieldaten')
      expect(offen(wrapper)).toBe(false)
      // Der letzte Block der Ansicht.
      expect(wrapper.findAll('.panel').at(-1)!.attributes('data-block')).toBe('beispieldaten')
      wrapper.unmount()
    })

    it('auch mit echten Startern bleibt er zu', () => {
      store.dispatch({ type: 'ADD_STARTERS', starters: [{ id: 'p1', startNr: '401', vorname: 'Vor', nachname: 'Nach', verein: '', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' }] })
      const wrapper = zeige()
      expect(offen(wrapper)).toBe(false)
      wrapper.unmount()
    })

    it('ein Beispiel-Starterfeld erzeugen: Der Block bleibt offen – auch nach dem Wechsel der Ansicht –, Beispielwerte lassen sich gleich ergänzen', async () => {
      const wrapper = zeige()
      expect(block(wrapper).find('[data-action="beispielwerte"]').attributes('disabled')).toBeDefined()
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      // Sechs je Klasse der DM (E, 1–7).
      expect(store.state.value.starters).toHaveLength(48)
      expect(store.state.value.beispielStarter).toBe(true)
      expect(offen(wrapper)).toBe(true)
      wrapper.unmount()

      // Die Ansicht wird beim Wechsel neu aufgebaut: Der Block ist wieder offen.
      const wieder = zeige()
      expect(offen(wieder)).toBe(true)
      expect(block(wieder).find('[data-hinweis="werte"]').text()).toBe('0 Werte erfasst.')
      await block(wieder).find('[data-action="beispielwerte"]').trigger('click')
      expect(Object.keys(store.state.value.eingaben).length).toBeGreaterThan(0)
      expect(block(wieder).find('[data-hinweis="werte"]').text()).not.toBe('0 Werte erfasst.')
      wieder.unmount()
    })

    it('ersetzt vorhandene Starter erst nach Rückfrage', async () => {
      store.dispatch({ type: 'ADD_STARTERS', starters: [{ id: 'p1', startNr: '401', vorname: 'Vor', nachname: 'Nach', verein: '', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' }] })
      const confirm = vi.fn(() => false)
      vi.stubGlobal('confirm', confirm)
      const wrapper = zeige()
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      expect(confirm).toHaveBeenCalledOnce()
      expect(store.state.value.starters.map((p) => p.id)).toEqual(['p1'])
      expect(store.state.value.beispielStarter).toBe(false)
      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('sind die Starter gelöscht, ist der Block beim nächsten Öffnen der Ansicht wieder zu', async () => {
      const wrapper = zeige()
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
      wrapper.unmount()
      const wieder = zeige()
      expect(offen(wieder)).toBe(false)
      wieder.unmount()
    })

    it('nach UIM nur die Klassen des Regelwerks, englisch beschriftet', async () => {
      store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
      setLocale('en')
      const wrapper = zeige()
      expect(block(wrapper).find('summary').text()).toBe('Sample data')
      expect(block(wrapper).findAll('.class-count .name').map((n) => n.text())).toEqual(['Dolphin', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'])
      wrapper.unmount()
    })
  })
})
