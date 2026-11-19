import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ManualAddForm from './ManualAddForm.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import type { Starter } from '../types'

// Von Hand anlegen mit Startnummern-Bereichen (19.11.2026): Die Nummer folgt der gewählten Größe.
// Alle Starter sind erfunden.

describe('Von Hand anlegen: Startnummer nach Westengröße', () => {
  let store: Store
  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })

  async function lege(groesse: string): Promise<Starter> {
    const wrapper = mount(ManualAddForm, { props: { classId: '5' }, global: { provide: { [storeKey as symbol]: store } } })
    await wrapper.find('#add-fn-5').setValue('Vor1')
    await wrapper.find('#add-ln-5').setValue('Nach1')
    await wrapper.find('#add-sz-5').setValue(groesse)
    await wrapper.find('form').trigger('submit')
    const neu = wrapper.emitted('add')![0][0] as Starter
    wrapper.unmount()
    return neu
  }

  it('XXL in Klasse 5 bekommt unter der DM-Vorgabe die 529, S die 501', async () => {
    expect((await lege('XXL')).startNr).toBe('529')
    expect((await lege('S')).startNr).toBe('501')
  })

  it('eine fehlende Weste wird übersprungen', async () => {
    store.dispatch({ type: 'SET_FEHLENDE_START_NR', nummern: ['529'] })
    expect((await lege('XXL')).startNr).toBe('530')
  })
})
