import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ExcelPanel from './ExcelPanel.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { birthYearRange } from '../domain/classes'
import { setLocale } from '../i18n'
import type { AppState } from '../types'

describe('Einfügen aus Excel: Klasse gegen Geburtsjahr, Sperre nach den ersten Ergebnissen', () => {
  let store: Store
  const ansicht = () => mount(ExcelPanel, { global: { provide: { [storeKey as symbol]: store } } })
  const knoepfe = (w: ReturnType<typeof ansicht>) => w.findAll('.row button').map((b) => b.attributes('disabled') !== undefined)

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventJahr: 2026 } })
  })

  // Erfundene Starter.
  const zeilen = (jahrA: number, jahrB: number) => `Klasse\tNachname\tVorname\tGeburtsdatum\n3\tMuster\tMax\t01.05.${jahrA}\n3\tBeispiel\tEva\t01.05.${jahrB}`

  it('eine falsche Klasse wird genannt und hält den Import auf, bis die Liste stimmt', async () => {
    const [von, bis] = birthYearRange('3', 2026)
    const wrapper = ansicht()
    await wrapper.find('textarea').setValue(zeilen(von, bis + 1))
    const hinweis = wrapper.find('[data-hinweis="klassen-fehler"]')
    expect(hinweis.findAll('li')).toHaveLength(1)
    expect(hinweis.text()).toContain(`Eva Beispiel: Klasse 3, geboren ${bis + 1}`)
    expect(hinweis.text()).toContain(`Jahrgänge ${von}–${bis}`)
    expect(hinweis.text()).toContain('gehört in Klasse 2')
    expect(knoepfe(wrapper)).toEqual([true, true])
    // Nichts wird übernommen, auch nicht die richtigen Zeilen.
    expect(store.state.value.starters).toEqual([])
    // Behoben: Der Hinweis verschwindet, der Import geht.
    await wrapper.find('textarea').setValue(zeilen(von, bis))
    expect(wrapper.find('[data-hinweis="klassen-fehler"]').exists()).toBe(false)
    expect(knoepfe(wrapper)).toEqual([false, false])
    await wrapper.find('.row button.primary').trigger('click')
    expect(store.state.value.starters.map((s) => s.nachname)).toEqual(['Muster', 'Beispiel'])
    wrapper.unmount()
  })

  it('ohne Geburtsdatum geht der Import, mit Hinweis', async () => {
    const wrapper = ansicht()
    await wrapper.find('textarea').setValue('Klasse\tNachname\tVorname\n3\tMuster\tMax')
    expect(wrapper.find('[data-hinweis="ohne-datum"]').text()).toContain('1 Starter ohne Geburtsdatum')
    expect(knoepfe(wrapper)).toEqual([false, false])
    wrapper.unmount()
  })

  it('sind Ergebnisse erfasst, ist der Import gesperrt', async () => {
    const [von] = birthYearRange('3', 2026)
    const wrapper = ansicht()
    await wrapper.find('textarea').setValue(zeilen(von, von))
    await wrapper.find('.row button.primary').trigger('click')
    const id = store.state.value.starters[0].id
    // Irgendein erfasster Wert genügt.
    store.dispatch({ type: 'LOAD_STATE', state: { ...store.state.value, eingaben: { [id]: {} } } as unknown as AppState })
    await wrapper.vm.$nextTick()
    if (Object.keys(store.state.value.eingaben).length === 0) throw new Error('Der Test braucht einen Stand mit Eingaben')
    await wrapper.find('textarea').setValue(zeilen(von, von))
    expect(wrapper.find('[data-hinweis="import-gesperrt"]').text()).toContain('Ergebnisse erfasst')
    expect(knoepfe(wrapper)).toEqual([true, true])
    wrapper.unmount()
  })
})
