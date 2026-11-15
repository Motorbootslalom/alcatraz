import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ClassSection from './ClassSection.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import type { Starter } from '../types'

// Sobald Ergebnisse erfasst sind, steht das Starterfeld fest: „Klasse leeren“ und das Hinzufügen
// von Hand sind gesperrt; Angaben ändern geht weiter. Das × entfernt dann nicht mehr, sondern
// erklärt, warum, und bietet an, den Starter als nicht gestartet einzutragen. Alle Starter sind erfunden.

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

  it('mit erfassten Werten sind „Klasse leeren“ und „von Hand“ gesperrt; das × entfernt nicht, sondern öffnet die Meldung', async () => {
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    const wrapper = ansicht()
    const knoepfe = wrapper.findAll('button.del')
    expect(knoepfe).toHaveLength(2)
    // Auch der Starter ohne eigene Werte bleibt: Die Listen sind gedruckt.
    for (const k of knoepfe) {
      expect(k.attributes('disabled')).toBeUndefined()
      await k.trigger('click')
      expect(wrapper.find('[data-dialog="abmelden"]').exists()).toBe(true)
      await wrapper.find('[data-action="dialog-abbrechen"]').trigger('click')
      expect(wrapper.find('[data-dialog="abmelden"]').exists()).toBe(false)
    }
    expect(store.state.value.abgemeldet).toEqual([])
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

  it('das Angebot trägt das X in jedem Lauf ohne Werte ein, nennt die Läufe mit Werten und lässt sie stehen', async () => {
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    const vorher = store.state.value.eingaben['manoevrieren/1']
    const wrapper = ansicht()
    await wrapper.findAll('button.del')[0].trigger('click')
    const dialog = wrapper.find('[data-dialog="abmelden"]')
    expect(dialog.text()).toContain('401')
    expect(dialog.text()).toContain('lässt sich nicht mehr entfernen')
    expect(dialog.text()).toContain('Der Wettkampf hat schon angefangen')
    expect(dialog.find('[data-plan="frei"]').text()).toBe('Die Läufe 2, 3 bekommen das X.')
    expect(dialog.find('[data-plan="belegt"]').text()).toContain('Lauf 1 hat schon erfasste Werte und bleibt, wie er ist.')
    await dialog.find('[data-action="abmelden-bestaetigen"]').trigger('click')

    expect(wrapper.find('[data-dialog="abmelden"]').exists()).toBe(false)
    expect(store.state.value.abgemeldet).toEqual(['p1'])
    expect(store.state.value.eingaben['manoevrieren/1']).toBe(vorher)
    expect(store.state.value.eingaben['manoevrieren/2']).toEqual({ p1: { 'disq@steg': 'X' } })
    expect(store.state.value.eingaben['manoevrieren/3']).toEqual({ p1: { 'disq@steg': 'X' } })
    // Die Zeile ist gekennzeichnet, und statt des × steht der Weg zurück.
    const zeile = wrapper.find('tr[data-abgemeldet]')
    expect(zeile.text()).toContain('nicht gestartet')
    expect(zeile.find('[data-action="starter-anmelden"]').exists()).toBe(true)
    expect(wrapper.findAll('tr[data-abgemeldet]')).toHaveLength(1)

    // Zurücknehmen: nach Rückfrage, entfernt das X wieder; Lauf 1 bleibt.
    await zeile.find('[data-action="starter-anmelden"]').trigger('click')
    const zurueck = wrapper.find('[data-dialog="anmelden"]')
    expect(zurueck.text()).toContain('wird in den Läufen 2, 3 entfernt')
    await zurueck.find('[data-action="anmelden-bestaetigen"]').trigger('click')
    expect(store.state.value.abgemeldet).toEqual([])
    expect(store.state.value.eingaben).toEqual({ 'manoevrieren/1': { p1: { zeit1: '80' } } })
    expect(wrapper.find('tr[data-abgemeldet]').exists()).toBe(false)
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

describe('Jahrgang und Klasse', () => {
  let store: Store
  const ansicht = () =>
    mount(ClassSection, {
      props: { classId: '4', starters: store.state.value.starters, duplicates: new Set<string>(), open: true, sortTick: 0 },
      global: { provide: { [storeKey as symbol]: store } },
    })
  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventJahr: 2026 } })
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter(1)] })
  })

  it('von Hand hinzufügen: Ein Geburtsjahr, das nicht in die Klasse gehört, wird abgewiesen – mit Hinweis', async () => {
    const wrapper = ansicht()
    await wrapper.find('[data-action="starter-neu"]').trigger('click')
    const form = wrapper.find('form.add-form')
    const [vorname, nachname] = form.findAll('input.input')
    await vorname.setValue('Neu')
    await nachname.setValue('Dabei')
    const datum = form.find('input[type="date"]')
    // Klasse 4 im Jahr 2026: zu jung.
    await datum.setValue('2019-05-05')
    expect(form.find('[data-hinweis="jahrgang-falsch"]').text()).toContain('Geburtsjahr 2019 passt nicht zu Klasse 4')
    expect(form.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await form.trigger('submit')
    expect(store.state.value.starters).toHaveLength(1)
    // Ein passender Jahrgang geht.
    const [von] = form.find('label[for="add-bd-4"]').text().match(/\d{4}/)!
    await datum.setValue(`${von}-05-05`)
    expect(form.find('[data-hinweis="jahrgang-falsch"]').exists()).toBe(false)
    await form.trigger('submit')
    expect(store.state.value.starters.map((p) => p.nachname)).toEqual(['Nach1', 'Dabei'])
    wrapper.unmount()
  })

  it('Bearbeiten: Ein Geburtsdatum mit falschem Jahrgang wird nicht übernommen', async () => {
    const wrapper = ansicht()
    await wrapper.findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    const datum = wrapper.find('input[type="date"].cell-input')
    await datum.setValue('2019-05-05')
    expect(store.state.value.starters[0].geburtsdatum).toBe('')
    expect((datum.element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('[data-hinweis="jahrgang-falsch"]').text()).toContain('Geburtsjahr 2019')
    wrapper.unmount()
  })

  it('die Klasse eines Starters lässt sich nicht mehr ändern, sobald Verzahnung bzw. Startplan festgeschrieben sind (Reducer)', () => {
    store.dispatch({ type: 'UPDATE_STARTER', id: 'p1', patch: { klasse: '5' } })
    expect(store.state.value.starters[0].klasse).toBe('5')
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const vorher = store.state.value
    store.dispatch({ type: 'UPDATE_STARTER', id: 'p1', patch: { klasse: '4' } })
    expect(store.state.value).toBe(vorher)
    // Die übrigen Angaben desselben Patches gelten weiter.
    store.dispatch({ type: 'UPDATE_STARTER', id: 'p1', patch: { klasse: '4', nachname: 'Berichtigt' } })
    expect([store.state.value.starters[0].klasse, store.state.value.starters[0].nachname]).toEqual(['5', 'Berichtigt'])
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: false })
    store.dispatch({ type: 'UPDATE_STARTER', id: 'p1', patch: { klasse: '4' } })
    expect(store.state.value.starters[0].klasse).toBe('4')
  })
})
