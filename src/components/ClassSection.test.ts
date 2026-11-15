import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ClassSection from './ClassSection.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import type { Starter } from '../types'

// Sobald Ergebnisse erfasst sind, steht das Starterfeld fest: Das ×, „Klasse leeren“ und das
// Hinzufügen von Hand sind gesperrt; Angaben ändern geht weiter. Alle Starter sind erfunden.

const starter = (n: number): Starter => ({ id: `p${n}`, startNr: `40${n}`, vorname: `Vor${n}`, nachname: `Nach${n}`, verein: 'Musterclub', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' })

describe('Starterfeld mit erfassten Werten', () => {
  let store: Store
  const confirm = vi.fn(() => true)
  const ansicht = () =>
    mount(ClassSection, {
      props: { classId: '4', starters: store.state.value.starters, duplicates: new Set<string>(), open: true, sortTick: 0 },
      global: { provide: { [storeKey as symbol]: store } },
    })

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    confirm.mockReset().mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    store = createStore()
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter(1), starter(2)] })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ohne erfasste Werte: Das × entfernt mit einem Klick, von Hand hinzufügen geht', async () => {
    const wrapper = ansicht()
    expect(wrapper.find('[data-action="starter-neu"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-action="klasse-leeren"]').attributes('disabled')).toBeUndefined()
    await wrapper.findAll('button.del')[1].trigger('click')
    expect(confirm).not.toHaveBeenCalled()
    expect(store.state.value.starters.map((p) => p.id)).toEqual(['p1'])
    wrapper.unmount()
  })

  it('mit erfassten Werten sind ×, „Klasse leeren“ und „von Hand“ gesperrt – mit Grund im Tooltip', async () => {
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    const wrapper = ansicht()
    const knoepfe = wrapper.findAll('button.del')
    expect(knoepfe).toHaveLength(2)
    // Auch der Starter ohne eigene Werte bleibt: Die Listen sind gedruckt.
    for (const k of knoepfe) {
      expect(k.attributes('disabled')).toBeDefined()
      expect(k.attributes('title')).toContain('Es sind schon Ergebnisse erfasst')
      await k.trigger('click')
    }
    const leeren = wrapper.find('[data-action="klasse-leeren"]')
    expect(leeren.attributes('disabled')).toBeDefined()
    await leeren.trigger('click')
    expect(wrapper.find('[data-action="starter-neu"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('form.add-form').exists()).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
    expect(store.state.value.starters).toHaveLength(2)
    expect(store.state.value.eingaben['manoevrieren/1']).toEqual({ p1: { zeit1: '80' } })
    wrapper.unmount()
  })

  it('Angaben eines Starters lassen sich weiter ändern', async () => {
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    const wrapper = ansicht()
    await wrapper.findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    const feld = wrapper.find('input.cell-input')
    await feld.setValue('Berichtigt')
    expect(store.state.value.starters[0].nachname).toBe('Berichtigt')
    wrapper.unmount()
  })
})
