import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import StartersView from './StartersView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import { adresse } from '../lib/router'
import { vergissAlles } from '../lib/merken'
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
    vergissAlles()
    setLocale('de')
    store = createStore()
    store.dispatch({
      type: 'ADD_STARTERS',
      starters: [mk('a', '3', '301', 'Nach3b', 'Vor1'), mk('b', '3', '302', 'Nach3a', 'Vor2'), mk('c', '3', '303', 'Nach3a', 'Vor1'), mk('d', '4', '401', 'Nach4b', 'Vor1'), mk('e', '4', '402', 'Nach4a', 'Vor1')],
    })
  })

  // Drei Stufen je Spaltenkopf (Wunsch des Nutzers vom 21.11.2026, Befund 16; Folge bestätigt 21.11.2026 S-01):
  // ↑ aufsteigend A→Z, ↓ absteigend Z→A, dann Markierung weg ohne Action – die Reihenfolge bleibt.
  const kopfStand = (th: ReturnType<ReturnType<typeof zeige>['find']>) => ({
    pfeil: th.find('.sortier-pfeil').text(),
    markiert: th.classes().includes('sortier-aktiv'),
    gedrueckt: th.find('button').attributes('aria-pressed'),
    ariaSort: th.attributes('aria-sort'),
  })

  it('je Klasse: Klick 1 aufsteigend ↑, Klick 2 absteigend ↓, Klick 3 Markierung weg, Reihenfolge bleibt; Nummern werden nur neu verteilt', async () => {
    const wrapper = zeige()
    const klasse3 = () => wrapper.findAll('.class-section')[3]
    expect(klasse3().find('th button[data-sortier]').exists()).toBe(false)
    await klasse3().find('[data-action="sortierung"]').trigger('click')
    expect(klasse3().findAll('th button[data-sortier]').map((b) => b.attributes('data-sortier'))).toEqual(['nachname', 'vorname', 'herkunft', 'groesse', 'geburtsdatum'])
    const kopf = () => klasse3().find('th[data-spalte="nachname"]')
    expect(kopfStand(kopf())).toEqual({ pfeil: '↕', markiert: false, gedrueckt: 'false', ariaSort: undefined })
    // Erst Vorname, dann Name (beide aufsteigend): nach Name und Vorname, A→Z.
    await klasse3().find('th button[data-sortier="vorname"]').trigger('click')
    expect(kopfStand(klasse3().find('th[data-spalte="vorname"]'))).toEqual({ pfeil: '↑', markiert: true, gedrueckt: 'true', ariaSort: 'ascending' })
    await kopf().find('button').trigger('click')
    expect(tabelle(wrapper, 3)).toEqual(['301 Nach3a Vor1', '302 Nach3a Vor2', '303 Nach3b Vor1'])
    expect(kopfStand(kopf())).toEqual({ pfeil: '↑', markiert: true, gedrueckt: 'true', ariaSort: 'ascending' })
    // Die andere Spalte ist nicht mehr markiert.
    expect(kopfStand(klasse3().find('th[data-spalte="vorname"]')).markiert).toBe(false)
    // Klick 2: absteigend Z→A (gleiche Namen behalten ihre Folge).
    await kopf().find('button').trigger('click')
    expect(tabelle(wrapper, 3)).toEqual(['301 Nach3b Vor1', '302 Nach3a Vor1', '303 Nach3a Vor2'])
    expect(kopfStand(kopf())).toEqual({ pfeil: '↓', markiert: true, gedrueckt: 'true', ariaSort: 'descending' })
    // Klick 3: keine Action, nur die Markierung ist weg.
    const vorher = store.state.value
    await kopf().find('button').trigger('click')
    expect(store.state.value).toBe(vorher)
    expect(tabelle(wrapper, 3)).toEqual(['301 Nach3b Vor1', '302 Nach3a Vor1', '303 Nach3a Vor2'])
    expect(kopfStand(kopf())).toEqual({ pfeil: '↕', markiert: false, gedrueckt: 'false', ariaSort: undefined })
    // Danach beginnt es wieder bei Stufe 1.
    await kopf().find('button').trigger('click')
    expect(tabelle(wrapper, 3)).toEqual(['301 Nach3a Vor1', '302 Nach3a Vor2', '303 Nach3b Vor1'])
    expect(kopfStand(kopf()).pfeil).toBe('↑')
    expect(store.state.value.starters.filter((p) => p.klasse === '4').map((p) => p.startNr)).toEqual(['401', '402'])
    // Zufall: mischt aus der Saat der Action; die Nummern bleiben dieselben, die Markierung geht.
    expect(klasse3().find('[data-action="zufall"]').exists()).toBe(true)
    await klasse3().find('[data-action="zufall"]').trigger('click')
    expect(tabelle(wrapper, 3).map((z) => z.slice(0, 3))).toEqual(['301', '302', '303'])
    expect(klasse3().find('th.sortier-aktiv').exists()).toBe(false)
    wrapper.unmount()
  })

  it('je Klasse: eine andere Spalte beginnt bei Stufe 1, auch wenn die vorige auf ↓ stand', async () => {
    const wrapper = zeige()
    const klasse3 = () => wrapper.findAll('.class-section')[3]
    await klasse3().find('[data-action="sortierung"]').trigger('click')
    await klasse3().find('th button[data-sortier="nachname"]').trigger('click')
    await klasse3().find('th button[data-sortier="nachname"]').trigger('click')
    expect(kopfStand(klasse3().find('th[data-spalte="nachname"]')).pfeil).toBe('↓')
    await klasse3().find('th button[data-sortier="vorname"]').trigger('click')
    expect(kopfStand(klasse3().find('th[data-spalte="vorname"]'))).toEqual({ pfeil: '↑', markiert: true, gedrueckt: 'true', ariaSort: 'ascending' })
    expect(kopfStand(klasse3().find('th[data-spalte="nachname"]'))).toEqual({ pfeil: '↕', markiert: false, gedrueckt: 'false', ariaSort: undefined })
    expect(tabelle(wrapper, 3)[2]).toContain('Vor2')
    wrapper.unmount()
  })

  // Ursache von Befund 16 (21.11.2026): Mit Startnummern-Bereichen (DM, Westengrößen) sortiert der Reducer
  // nur je Größengruppe. Früher hing die Markierung an istGeordnet (ganze Klasse nach der Spalte) – sie
  // verschwand sofort, und der zweite Klick sortierte wieder in der ersten Richtung.
  it('mit Startnummern-Bereichen (Klasse 4: S-M und L-XL): Markierung bleibt, Klick 2 schaltet um', async () => {
    store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
    const mit = (id: string, startNr: string, nachname: string, groesse: string, verein: string): Starter => ({ ...mk(id, '4', startNr, nachname, 'Vor1'), groesse, verein })
    store.dispatch({
      type: 'ADD_STARTERS',
      starters: [mit('a', '401', 'Nach4a', 'S', 'Club A'), mit('b', '402', 'Nach4b', 'M', 'Club C'), mit('c', '421', 'Nach4c', 'L', 'Club D'), mit('d', '422', 'Nach4d', 'XL', 'Club B')],
    })
    const wrapper = zeige()
    const klasse4 = () => wrapper.findAll('.class-section')[4]
    const kopf = () => klasse4().find('th[data-spalte="herkunft"]')
    await klasse4().find('[data-action="sortierung"]').trigger('click')
    await kopf().find('button').trigger('click')
    // Aufsteigend je Gruppe: S-M (Club A vor C), L-XL (Club B vor D) – die Nummern bleiben in ihrem Bereich.
    expect(tabelle(wrapper, 4)).toEqual(['401 Nach4a Vor1', '402 Nach4b Vor1', '421 Nach4d Vor1', '422 Nach4c Vor1'])
    expect(kopfStand(kopf())).toEqual({ pfeil: '↑', markiert: true, gedrueckt: 'true', ariaSort: 'ascending' })
    await kopf().find('button').trigger('click')
    expect(tabelle(wrapper, 4)).toEqual(['401 Nach4b Vor1', '402 Nach4a Vor1', '421 Nach4c Vor1', '422 Nach4d Vor1'])
    expect(kopfStand(kopf())).toEqual({ pfeil: '↓', markiert: true, gedrueckt: 'true', ariaSort: 'descending' })
    await kopf().find('button').trigger('click')
    expect(tabelle(wrapper, 4)).toEqual(['401 Nach4b Vor1', '402 Nach4a Vor1', '421 Nach4c Vor1', '422 Nach4d Vor1'])
    expect(kopfStand(kopf()).markiert).toBe(false)
    wrapper.unmount()
  })

  it('je Klasse: Verschieben von Hand hebt die Markierung auf; die Stufe übersteht den Wechsel des Reiters', async () => {
    let wrapper = zeige()
    const klasse3 = () => wrapper.findAll('.class-section')[3]
    await klasse3().find('[data-action="sortierung"]').trigger('click')
    await klasse3().find('th button[data-sortier="nachname"]').trigger('click')
    wrapper.unmount()
    wrapper = zeige()
    await klasse3().find('[data-action="sortierung"]').trigger('click')
    expect(kopfStand(klasse3().find('th[data-spalte="nachname"]')).pfeil).toBe('↑')
    const ids = store.state.value.starters.filter((p) => p.klasse === '3').map((p) => p.id)
    store.dispatch({ type: 'MOVE_STARTER', id: ids[2], target: 'first' })
    await nextTick()
    expect(kopfStand(klasse3().find('th[data-spalte="nachname"]'))).toEqual({ pfeil: '↕', markiert: false, gedrueckt: 'false', ariaSort: undefined })
    wrapper.unmount()
  })

  it('oben für alle Klassen: drei Stufen, jede Klasse in sich, die Reihenfolge der Klassen bleibt', async () => {
    const wrapper = zeige()
    const leiste = () => wrapper.find('[data-bereich="sortierung-alle"]')
    const knopf = () => leiste().find('button[data-sortier="nachname"]')
    await leiste().find('[data-action="sortierung-alle"]').trigger('click')
    expect(knopf().classes()).not.toContain('active')
    await knopf().trigger('click')
    expect(tabelle(wrapper, 3)).toEqual(['301 Nach3a Vor2', '302 Nach3a Vor1', '303 Nach3b Vor1'])
    expect(tabelle(wrapper, 4)).toEqual(['401 Nach4a Vor1', '402 Nach4b Vor1'])
    expect(knopf().find('.sortier-pfeil').text()).toBe('↑')
    expect(knopf().classes()).toContain('active')
    expect(knopf().attributes('aria-pressed')).toBe('true')
    // Die Klassen zeigen dieselbe Wahl am Spaltenkopf.
    await wrapper.findAll('.class-section')[3].find('[data-action="sortierung"]').trigger('click')
    expect(kopfStand(wrapper.findAll('.class-section')[3].find('th[data-spalte="nachname"]')).pfeil).toBe('↑')
    await knopf().trigger('click')
    expect(tabelle(wrapper, 4)).toEqual(['401 Nach4b Vor1', '402 Nach4a Vor1'])
    expect(knopf().find('.sortier-pfeil').text()).toBe('↓')
    expect(kopfStand(wrapper.findAll('.class-section')[3].find('th[data-spalte="nachname"]')).pfeil).toBe('↓')
    const vorher = store.state.value
    await knopf().trigger('click')
    expect(store.state.value).toBe(vorher)
    expect(tabelle(wrapper, 4)).toEqual(['401 Nach4b Vor1', '402 Nach4a Vor1'])
    expect(knopf().find('.sortier-pfeil').text()).toBe('↕')
    expect(knopf().classes()).not.toContain('active')
    expect(kopfStand(wrapper.findAll('.class-section')[3].find('th[data-spalte="nachname"]')).markiert).toBe(false)
    // Andere Spalte: wieder Stufe 1.
    await leiste().find('button[data-sortier="vorname"]').trigger('click')
    expect(leiste().find('button[data-sortier="vorname"] .sortier-pfeil').text()).toBe('↑')
    expect(store.state.value.starters.map((p) => p.klasse)).toEqual(['3', '3', '3', '4', '4'])
    wrapper.unmount()
  })

  // Prüfbefund zu Paket F (16.11.2026): klassisch ohne Nummern (die vergibt erst die Verzahnung)
  // blieb die Tabelle stehen und der Kopf zeigte keine Richtung.
  it('klassisch ohne Startnummern: die Tabelle folgt der Sortierung, der Kopf zeigt die Richtung', async () => {
    store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
    store.dispatch({ type: 'SET_START_NR_MODE', mode: 'klassisch' })
    store.dispatch({ type: 'ADD_STARTERS', starters: [mk('a', '3', '', 'Kiefer', 'Vor1'), mk('b', '3', '', 'Ahorn', 'Vor1'), mk('c', '3', '', 'Zeder', 'Vor1')] })
    const wrapper = zeige()
    const klasse3 = () => wrapper.findAll('.class-section')[3]
    const namen = () => tabelle(wrapper, 3).map((z) => z.split(' ')[z.split(' ').length - 2])
    expect(namen()).toEqual(['Kiefer', 'Ahorn', 'Zeder'])
    await klasse3().find('[data-action="sortierung"]').trigger('click')
    await klasse3().find('th button[data-sortier="nachname"]').trigger('click')
    expect(namen()).toEqual(['Ahorn', 'Kiefer', 'Zeder'])
    expect(klasse3().find('th[data-spalte="nachname"] .sortier-pfeil').text()).toBe('↑')
    await klasse3().find('th button[data-sortier="nachname"]').trigger('click')
    expect(namen()).toEqual(['Zeder', 'Kiefer', 'Ahorn'])
    expect(klasse3().find('th[data-spalte="nachname"] .sortier-pfeil').text()).toBe('↓')
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
    // Auch ▲▼ ist nach dem Festschreiben gesperrt (Entscheidung 16.11.2026) – Knopf und Reducer.
    // ▲▼ stehen unter „Bearbeiten“.
    await wrapper.findAll('.class-section')[3].findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    const pfeile = wrapper.findAll('.class-section')[3].findAll('button.mv')
    expect(pfeile.length).toBeGreaterThan(0)
    expect(pfeile.every((b) => b.attributes('disabled') !== undefined)).toBe(true)
    expect(pfeile[0].attributes('title')).toContain('Die Verzahnung ist festgeschrieben')
    const vorher = store.state.value
    store.dispatch({ type: 'MOVE_STARTER', id: 'a', target: 'down' })
    expect(store.state.value).toBe(vorher)
    const hinweis = wrapper.findAll('p.hint').map((p) => p.text()).find((x) => x.startsWith('Startnummern bleiben'))
    expect(hinweis).toContain('Verschieben, „Sortierung ändern“ und „Zufall“ ordnen die Starter neu')
    expect(hinweis).toContain('alle drei gehen nur, bis die Verzahnung festgeschrieben ist')
    wrapper.unmount()
  })
})

describe('Starter: Buchstabe der Klasse E (24.11.2026)', () => {
  let store: Store
  const zeige = () => mount(StartersView, { global: { provide: { [storeKey as symbol]: store } } })

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    vergissAlles()
    store = createStore()
  })

  it('unter DM „Buchstabe der Klasse E“, unter UIM „Dolphin“; Vorgabe E, mit D vergibt „Automatisch vergeben“ D01 aus E01–E30', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    store.dispatch({ type: 'ADD_STARTERS', starters: [{ ...starter('e1', 'E'), groesse: 'M' }] })
    const wrapper = zeige()
    const feld = wrapper.find('[data-feld="dolphin-praefix"]')
    expect(feld.find('label').text()).toBe('Buchstabe der Klasse E')
    expect(feld.find('[data-praefix="E"]').attributes('aria-pressed')).toBe('true')
    await feld.find('[data-praefix="D"]').trigger('click')
    expect(store.state.value.dolphinPraefix).toBe('D')
    store.dispatch({ type: 'ASSIGN_START_NUMBERS' })
    expect(store.state.value.starters[0].startNr).toBe('D01')
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    expect(wrapper.find('[data-feld="dolphin-praefix"] label').text()).toBe('Buchstabe der Dolphin-Nummern')
    // Klassische Nummern kennen keinen Buchstaben.
    store.dispatch({ type: 'SET_START_NR_MODE', mode: 'klassisch' })
    await nextTick()
    expect(wrapper.find('[data-feld="dolphin-praefix"]').exists()).toBe(false)
    wrapper.unmount()
  })
})
