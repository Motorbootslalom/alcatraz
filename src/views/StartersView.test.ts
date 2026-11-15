import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StartersView from './StartersView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'

// Erfundene Starter – keine echten Personen.
const starter = (id: string, klasse: ClassId): Starter => ({ id, startNr: '', vorname: 'Vor', nachname: `Nach ${id}`, verein: '', bundesland: '', geburtsdatum: '', klasse, groesse: '' })

describe('Starter: auf- und zugeklappte Klassen', () => {
  let store: Store
  const zeige = () => mount(StartersView, { global: { provide: { [storeKey as symbol]: store } } })
  const offen = (wrapper: ReturnType<typeof zeige>) => wrapper.findAll('.class-toggle-btn').map((b) => b.attributes('aria-expanded') === 'true')

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })

  it('Klassen mit Startern sind offen – auch die, die erst später Starter bekommen; von Hand Gestelltes bleibt', async () => {
    let wrapper = zeige()
    expect(offen(wrapper).every((o) => !o)).toBe(true)
    // Im leeren Feld eine Klasse aufgeklappt – das hielt früher fest, dass NUR sie offen ist.
    await wrapper.findAll('.class-toggle-btn')[4].trigger('click')
    expect(offen(wrapper).filter(Boolean)).toHaveLength(1)
    wrapper.unmount()

    store.dispatch({ type: 'ADD_STARTERS', starters: [starter('a', 'E'), starter('b', '2'), starter('c', '6')] })
    wrapper = zeige()
    const stand = offen(wrapper)
    expect(stand.filter(Boolean)).toHaveLength(4)
    expect(stand[4]).toBe(true)
    // Eine Klasse mit Startern zugeklappt: bleibt zu, die übrigen offen.
    await wrapper.findAll('.class-toggle-btn')[0].trigger('click')
    wrapper.unmount()
    wrapper = zeige()
    expect(offen(wrapper)[0]).toBe(false)
    expect(offen(wrapper).filter(Boolean)).toHaveLength(3)
    wrapper.unmount()
  })

  it('ein gemerkter Wert in falscher Form oder für eine unbekannte Klasse stört nicht', () => {
    sessionStorage.setItem('alcatraz.merke.starter.geklappt', JSON.stringify({ quatsch: true, '9': false }))
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter('a', '1')] })
    const wrapper = zeige()
    expect(offen(wrapper).filter(Boolean)).toHaveLength(1)
    wrapper.unmount()
  })
})
