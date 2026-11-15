import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'

// Die Liste der Fahrer je Team (Regel 960, Pkt. 3.7) im Reiter „Gewichtslisten“ – und die
// Auswahl der Beispielwerte. Alle Starter sind erfunden.

const mk = (id: string, klasse: ClassId, land: string, mehr: Partial<Starter> = {}): Starter => ({ id, startNr: `${klasse === 'E' ? 'E' : klasse}0${id.slice(-1)}`, vorname: `Vor${id}`, nachname: `Nach${id}`, verein: '', bundesland: '', land, geburtsdatum: '2015-03-04', groesse: '', klasse, ...mehr })
const mit = (store: Store) => ({ global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })

describe('Liste der Fahrer je Team im Reiter „Gewichtslisten“', () => {
  let store: Store
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
    store.dispatch({ type: 'ADD_STARTERS', starters: [mk('a1', 'E', 'Estland', { geschlecht: 'F', gewicht: 20 }), mk('a2', '4', 'Estland'), mk('b1', '1', 'Lettland', { geschlecht: 'M' })] })
  })

  const gewicht = async () => {
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find('.list-kinds button[data-kind="gewicht"]').trigger('click')
    return wrapper
  }

  it('nur unter Regel 960; je Team ein Dokument mit Sex, Gewicht, Ballast und Co-Driver – das Geburtsdatum ist abschaltbar', async () => {
    const dm = await gewicht()
    expect(dm.find('.gewicht-arten button[data-art="team"]').exists()).toBe(false)
    dm.unmount()

    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    const wrapper = await gewicht()
    await wrapper.find('.gewicht-arten button[data-art="team"]').trigger('click')
    await nextTick()
    const dokumente = wrapper.findAll('.team-liste .sheet-section')
    // Nationen international: auf der englischen Liste der englische Name, nicht der deutsche.
    expect(dokumente.map((d) => d.find('[data-feld="team"]').text())).toEqual(['Estonia', 'Latvia'])
    // Die Liste folgt der Sprache des Regelwerks (englisch) und den Wörtern von Pkt. 3.7 – in deren Folge („… Verified weight and ballast required; Class“).
    expect(dokumente[0].findAll('.sheet-cols th').map((th) => th.text().replace(/\s+/g, ' '))).toEqual(['No.', 'Surname', 'First name', 'Sex', 'Date of birth', 'Verified weight', 'Ballast required', 'Class', 'Co-driver'])
    const zeile = (id: string) => wrapper.find(`.team-liste tr[data-starter="${id}"]`).findAll('td').map((td) => td.text())
    expect(zeile('a1')).toEqual(['E01', 'Nacha1', 'Vora1', 'F', '04/03/2015', '20 kg', '6 kg', 'Dolphin', ''])
    // Nicht gewogen steht ausdrücklich da; Klasse 4 fährt ohne Co-Driver; kein Geschlecht = leere Zelle.
    expect(zeile('a2')).toEqual(['402', 'Nacha2', 'Vora2', '', '04/03/2015', 'not weighed', '4', '–'])
    expect(wrapper.find('[data-hinweis="team-ohne-geschlecht"]').exists()).toBe(true)
    // Vier Werte (Entscheidung des Nutzers): englisch M, F, D, n/a – „keine Angabe“ ist eine Angabe.
    store.dispatch({ type: 'UPDATE_STARTER', id: 'a2', patch: { geschlecht: 'nA' } })
    await nextTick()
    expect(zeile('a2')[3]).toBe('n/a')
    expect(wrapper.find('[data-hinweis="team-ohne-geschlecht"]').exists()).toBe(false)
    store.dispatch({ type: 'UPDATE_STARTER', id: 'a2', patch: { geschlecht: 'D' } })
    await nextTick()
    expect(zeile('a2')[3]).toBe('D')
    // Ein Team allein.
    await wrapper.find('[data-feld="team-wahl"]').setValue(wrapper.findAll('[data-feld="team-wahl"] option')[2].attributes('value'))
    expect(wrapper.findAll('.team-liste .sheet-section')).toHaveLength(1)
    // Geburtsdatum abschalten (Listen-Option der Veranstaltung): Die Spalte entfällt.
    store.dispatch({ type: 'SET_LIST_OPTIONS', patch: { showBirthdate: false } })
    await nextTick()
    expect(wrapper.find('.team-liste [data-spalte="geburtsdatum"]').exists()).toBe(false)
    expect(wrapper.find('.team-liste [data-spalte="geschlecht"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
