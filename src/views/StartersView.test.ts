import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import StartersView from './StartersView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import { adresse } from '../lib/router'
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

describe('Starter: Sortierung ändern (Entscheidung des Nutzers vom 15.11.2026)', () => {
  let store: Store
  const zeige = () => mount(StartersView, { global: { provide: { [storeKey as symbol]: store } } })
  const mk = (id: string, klasse: ClassId, startNr: string, nachname: string, vorname: string): Starter => ({ id, startNr, vorname, nachname, verein: 'Musterclub', bundesland: '', geburtsdatum: '', klasse, groesse: '' })
  /** Je Klasse die Nachnamen in der gezeigten Reihenfolge. */
  const tabelle = (wrapper: ReturnType<typeof zeige>, klasse: number) =>
    wrapper
      .findAll('.class-section')
      [klasse].findAll('tbody tr')
      .map((tr) => `${tr.findAll('td')[0].text()} ${tr.findAll('td')[1].text()} ${tr.findAll('td')[2].text()}`)

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({
      type: 'ADD_STARTERS',
      starters: [mk('a', '3', '301', 'Nach3b', 'Vor1'), mk('b', '3', '302', 'Nach3a', 'Vor2'), mk('c', '3', '303', 'Nach3a', 'Vor1'), mk('d', '4', '401', 'Nach4b', 'Vor1'), mk('e', '4', '402', 'Nach4a', 'Vor1')],
    })
  })

  it('je Klasse: Spaltenköpfe werden Knöpfe, ein zweiter Klick dreht die Richtung um; die Nummern werden nur neu verteilt', async () => {
    const wrapper = zeige()
    const klasse3 = () => wrapper.findAll('.class-section')[3]
    expect(klasse3().find('th button[data-sortier]').exists()).toBe(false)
    await klasse3().find('[data-action="sortierung"]').trigger('click')
    expect(klasse3().findAll('th button[data-sortier]').map((b) => b.attributes('data-sortier'))).toEqual(['nachname', 'vorname', 'herkunft', 'groesse', 'geburtsdatum'])
    // Erst Vorname, dann Name: nach Name und Vorname.
    await klasse3().find('th button[data-sortier="vorname"]').trigger('click')
    await klasse3().find('th button[data-sortier="nachname"]').trigger('click')
    expect(tabelle(wrapper, 3)).toEqual(['301 Nach3a Vor1', '302 Nach3a Vor2', '303 Nach3b Vor1'])
    const kopf = klasse3().find('th[data-spalte="nachname"]')
    expect(kopf.attributes('aria-sort')).toBe('ascending')
    expect(kopf.find('.sortier-pfeil').text()).toBe('▲')
    await kopf.find('button').trigger('click')
    expect(tabelle(wrapper, 3)).toEqual(['301 Nach3b Vor1', '302 Nach3a Vor1', '303 Nach3a Vor2'])
    expect(klasse3().find('th[data-spalte="nachname"] .sortier-pfeil').text()).toBe('▼')
    expect(store.state.value.starters.filter((p) => p.klasse === '4').map((p) => p.startNr)).toEqual(['401', '402'])
    // Zufall: mischt aus der Saat der Action; die Nummern bleiben dieselben.
    expect(klasse3().find('[data-action="zufall"]').exists()).toBe(true)
    await klasse3().find('[data-action="zufall"]').trigger('click')
    expect(tabelle(wrapper, 3).map((z) => z.slice(0, 3))).toEqual(['301', '302', '303'])
    wrapper.unmount()
  })

  it('oben für alle Klassen: jede Klasse in sich, die Reihenfolge der Klassen bleibt', async () => {
    const wrapper = zeige()
    const leiste = () => wrapper.find('[data-bereich="sortierung-alle"]')
    await leiste().find('[data-action="sortierung-alle"]').trigger('click')
    await leiste().find('button[data-sortier="nachname"]').trigger('click')
    expect(tabelle(wrapper, 3)).toEqual(['301 Nach3a Vor2', '302 Nach3a Vor1', '303 Nach3b Vor1'])
    expect(tabelle(wrapper, 4)).toEqual(['401 Nach4a Vor1', '402 Nach4b Vor1'])
    expect(leiste().find('button[data-sortier="nachname"] .sortier-pfeil').text()).toBe('▲')
    await leiste().find('button[data-sortier="nachname"]').trigger('click')
    expect(tabelle(wrapper, 4)).toEqual(['401 Nach4b Vor1', '402 Nach4a Vor1'])
    expect(leiste().find('button[data-sortier="nachname"] .sortier-pfeil').text()).toBe('▼')
    expect(store.state.value.starters.map((p) => p.klasse)).toEqual(['3', '3', '3', '4', '4'])
    wrapper.unmount()
  })

  // Prüfbefund zu Paket F (16.11.2026): klassisch ohne Nummern (die vergibt erst die Verzahnung)
  // blieb die Tabelle stehen und der Kopf zeigte keine Richtung.
  it('klassisch ohne Startnummern: die Tabelle folgt der Sortierung, der Kopf zeigt die Richtung', async () => {
    store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
    store.dispatch({ type: 'SET_START_NR_MODE', mode: 'klassisch' })
    store.dispatch({ type: 'ADD_STARTERS', starters: [mk('a', '3', '', 'Zeder', 'Vor1'), mk('b', '3', '', 'Kiefer', 'Vor1'), mk('c', '3', '', 'Ahorn', 'Vor1')] })
    const wrapper = zeige()
    const klasse3 = () => wrapper.findAll('.class-section')[3]
    const namen = () => tabelle(wrapper, 3).map((z) => z.split(' ')[z.split(' ').length - 2])
    expect(namen()).toEqual(['Zeder', 'Kiefer', 'Ahorn'])
    await klasse3().find('[data-action="sortierung"]').trigger('click')
    await klasse3().find('th button[data-sortier="nachname"]').trigger('click')
    expect(namen()).toEqual(['Ahorn', 'Kiefer', 'Zeder'])
    expect(klasse3().find('th[data-spalte="nachname"] .sortier-pfeil').text()).toBe('▲')
    await klasse3().find('th button[data-sortier="nachname"]').trigger('click')
    expect(namen()).toEqual(['Zeder', 'Kiefer', 'Ahorn'])
    expect(klasse3().find('th[data-spalte="nachname"] .sortier-pfeil').text()).toBe('▼')
    expect(store.state.value.starters.every((p) => p.startNr === '')).toBe(true)
    wrapper.unmount()
  })

  it('gesperrt, sobald die Verzahnung festgeschrieben ist – mit Hinweis und Weg zur Verzahnung', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const wrapper = zeige()
    const leiste = wrapper.find('[data-bereich="sortierung-alle"]')
    expect(leiste.find('[data-action="sortierung-alle"]').attributes('disabled')).toBeDefined()
    expect(leiste.find('[data-hinweis="sortierung-gesperrt"]').text()).toContain('Die Verzahnung ist festgeschrieben')
    expect(leiste.find('[data-hinweis="sortierung-gesperrt"] a').attributes('href')).toBe(adresse('verzahnung'))
    const knopf = wrapper.findAll('.class-section')[3].find('[data-action="sortierung"]')
    expect(knopf.attributes('disabled')).toBeDefined()
    expect(knopf.attributes('title')).toContain('Die Verzahnung ist festgeschrieben')
    expect(wrapper.find('th button[data-sortier]').exists()).toBe(false)
    // Verschieben bleibt nach dem Festschreiben möglich (nicht entschieden) – der Hinweis sagt das
    // auch so (Prüfbefund zu Paket F, 16.11.2026: er nannte vorher das Verschieben mit).
    store.dispatch({ type: 'MOVE_STARTER', id: 'a', target: 'down' })
    expect(store.state.value.starters.find((p) => p.id === 'a')!.startNr).toBe('302')
    const hinweis = wrapper.findAll('p.hint').map((p) => p.text()).find((x) => x.startsWith('Startnummern bleiben'))
    expect(hinweis).toContain('„Sortierung ändern“ und „Zufall“ gehen nur, bis die Verzahnung festgeschrieben ist')
    expect(hinweis).not.toContain('Verschieben, „Sortierung ändern“ und „Zufall“ verteilen nur die vorhandenen Nummern neu – das geht')
    wrapper.unmount()
  })
})
