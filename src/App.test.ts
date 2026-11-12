import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from './App.vue'
import { createStore, storeKey } from './state/store'
import { setLocale } from './i18n'
import { generateStarters } from './domain/generate'
import { VIEWS } from './lib/router'

async function show(view: string) {
  location.hash = `#/${view}`
  window.dispatchEvent(new Event('hashchange'))
  await nextTick()
}

describe('App', () => {
  it('zeigt jede Ansicht mit Startern und wechselt die Sprache im Betrieb', async () => {
    localStorage.clear()
    setLocale('de')
    await nextTick()
    const store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Testpokal' } })
    store.dispatch({
      type: 'ADD_STARTERS',
      starters: [...generateStarters('E', 3, 2026, 'verein', []), ...generateStarters('4', 2, 2026, 'verein', [])],
    })
    const wrapper = mount(App, { global: { provide: { [storeKey as symbol]: store } } })

    for (const view of VIEWS) {
      await show(view)
      expect(wrapper.find('main').text(), view).not.toBe('')
    }

    await show('starter')
    expect(wrapper.text()).toContain('Starter verwalten')
    setLocale('en')
    await nextTick()
    expect(wrapper.text()).toContain('Manage competitors')
    expect(wrapper.text()).not.toContain('Starter verwalten')
    setLocale('de')

    await show('listen')
    // Nach Klasse: eine durchgehende Liste, je Klasse ein zusammenhängender Block.
    expect(wrapper.findAll('.sheet-section')).toHaveLength(1)
    expect(wrapper.findAll('.sheet-table tbody')).toHaveLength(2)
    expect(wrapper.findAll('.sheet-table tr.shade')).toHaveLength(1)

    // Geburtsdatum abschalten und Herkunft als Kürzel: beides wirkt sofort auf die Liste.
    const columns = () => wrapper.findAll('.sheet-cols th').map((th) => th.text())
    expect(columns()).toContain('Geb. Datum')
    const first = store.state.value.starters[0]
    store.dispatch({ type: 'SET_LIST_OPTIONS', patch: { showBirthdate: false, listOrigin: 'kurz' } })
    store.dispatch({ type: 'SET_ORIGIN_SHORT', name: first.verein, short: 'XYZ' })
    await nextTick()
    expect(columns()).not.toContain('Geb. Datum')
    expect(wrapper.find('.sheet-table tbody').text()).toContain('XYZ')
    expect(wrapper.findAll('.sheet-table tbody tr')).toHaveLength(5)
    wrapper.unmount()
  })

  it('druckt Gewichtslisten je Herkunft ohne Startnummern und übernimmt Gewichte', async () => {
    localStorage.clear()
    setLocale('de')
    const store = createStore()
    const mk = (id: string, nachname: string, verein: string) => ({
      ...generateStarters('1', 1, 2026, 'verein', [])[0],
      id,
      nachname,
      verein,
      startNr: '',
    })
    store.dispatch({ type: 'ADD_STARTERS', starters: [mk('a', 'Zeh', 'Club B'), mk('b', 'Abel', 'Club B'), mk('c', 'Lang', 'Club A')] })
    const wrapper = mount(App, { global: { provide: { [storeKey as symbol]: store } } })

    await show('listen')
    // Ohne Startnummern keine Startliste – die Gewichtsliste geht trotzdem.
    expect(wrapper.find('.boat-banner.warn').exists()).toBe(true)
    await wrapper.findAll('.segmented button').find((b) => b.text() === 'Gewichtslisten')!.trigger('click')
    expect(wrapper.findAll('.sheet-section')).toHaveLength(2)
    expect(wrapper.find('.boat-banner.warn').exists()).toBe(false)
    expect(wrapper.findAll('.sheet-title-box .list').map((e) => e.text())).toEqual(['Gewichtsliste\nClub A', 'Gewichtsliste\nClub B'])
    expect(wrapper.findAll('.sheet-section')[1].findAll('tbody tr').map((tr) => tr.findAll('td')[1].text())).toEqual(['Abel', 'Zeh'])
    expect(wrapper.find('.sheet-table tbody').text()).toContain('33 kg')

    await show('verwiegung')
    const input = wrapper.find('.weight-input')
    await input.setValue('30,5')
    await input.trigger('change')
    expect(store.state.value.starters.find((p) => p.id === 'c')?.gewicht).toBe(30.5)
    expect(wrapper.text()).toContain('1 von 3 gewogen')
    expect(wrapper.find('.ballast').text()).toBe('3 kg')
    wrapper.unmount()
  })

  it('sperrt die Verzahnung nach dem Festschreiben', async () => {
    localStorage.clear()
    setLocale('de')
    const store = createStore()
    store.dispatch({ type: 'ADD_STARTERS', starters: [...generateStarters('E', 3, 2026, 'verein', []), ...generateStarters('1', 2, 2026, 'verein', [])] })
    const wrapper = mount(App, { global: { provide: { [storeKey as symbol]: store } } })
    await show('verzahnung')
    expect(wrapper.find('fieldset.lockable').attributes('disabled')).toBeUndefined()
    await wrapper.find('.lock-bar .btn').trigger('click')
    expect(store.state.value.verzahnungLocked).toBe(true)
    expect(store.state.value.parcoursList[0].tracks).toBeDefined()
    expect(wrapper.find('fieldset.lockable').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('zeigt den Parallel-Slalom nur nach den Regeln der UIM, als Unterpunkt der Verzahnung', async () => {
    localStorage.clear()
    setLocale('de')
    const store = createStore()
    store.dispatch({ type: 'ADD_STARTERS', starters: generateStarters('E', 4, 2026, 'verein', []) })
    const wrapper = mount(App, { global: { provide: { [storeKey as symbol]: store } } })
    await show('verzahnung')
    expect(wrapper.find('nav').text()).not.toContain('Parallel')
    expect(wrapper.find('.subnav').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Parallel-Slalom')

    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    expect(wrapper.find('.subnav').exists()).toBe(true)
    await wrapper.findAll('.subnav button')[1].trigger('click')
    expect(wrapper.text()).toContain('Parcours A')
    // E heißt nach UIM „Dolphin“, die Klassen 6 und 7 gibt es nicht.
    await show('starter')
    expect(wrapper.text()).toContain('Dolphin')
    expect(wrapper.findAll('.class-section')).toHaveLength(6)

    // Zurück zur DM: der Unterpunkt verschwindet, auch wenn er gerade gewählt war.
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    await show('verzahnung')
    expect(wrapper.find('.subnav').exists()).toBe(false)
    expect(wrapper.text()).toContain('Verzahnung der Parcours')
    wrapper.unmount()
  })

  it('übernimmt den Stand, den ein anderes Fenster gespeichert hat', async () => {
    localStorage.clear()
    const store = createStore()
    const other = createStore()
    other.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Aus dem anderen Fenster' } })
    window.dispatchEvent(new StorageEvent('storage', { key: 'alcatraz:state:v1' }))
    expect(store.state.value.eventName).toBe('Aus dem anderen Fenster')
  })
})
