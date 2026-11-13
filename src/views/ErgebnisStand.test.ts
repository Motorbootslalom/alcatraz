import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { emptyState } from '../state/reducer'
import { migrate } from '../state/migrate'
import { laufSchluessel } from '../lib/eingaben'
import { klassenInStartfolge } from '../lib/wkrListen'
import { planEvent } from '../planung/plan'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'

/** Erfundene Starter: `n` je Klasse, klassenbasierte Startnummern. */
function starter(klassen: ClassId[], n = 3): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: 'Musterclub',
      bundesland: 'Musterland',
      geburtsdatum: '',
      groesse: '',
      klasse,
    })),
  )
}

const ALLE: ClassId[] = ['E', '1', '2', '3', '4', '5', '6', '7']
const zeit = (store: Store, n: number, id: string, wert: string, wann: number) =>
  store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', n), starter: id, feld: 'zeit1', wert }], zeit: wann })
const ansicht = (store: Store) => mount(ListsView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
async function ergebnisse(wrapper: VueWrapper) {
  await wrapper.find('.list-kinds button[data-kind="ergebnis"]').trigger('click')
  await nextTick()
}
const blaetter = (wrapper: VueWrapper) =>
  wrapper.findAll('.ergebnis-blatt').map((b) => [b.findAll('.erg-kopf span').slice(0, 2).map((s) => s.text()).join(' '), b.find('.erg-stand').exists() ? b.find('.erg-stand').text() : null])
// Ortszeit, damit der Test in jeder Zeitzone dasselbe erwartet.
const T1 = new Date(2026, 5, 20, 14, 5, 9).getTime()
const T2 = new Date(2026, 5, 20, 15, 30, 0).getTime()

describe('Ergebnislisten: Zeitpunkt der letzten Änderung', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'LOAD_STATE', state: { ...emptyState(), kennung: 'K7Q4', eventName: 'Hafenpokal', starters: starter(['1', '4']) } })
    zeit(store, 1, 'id-4-1', '70', T1)
    zeit(store, 1, 'id-1-1', '66', T1)
    zeit(store, 2, 'id-4-1', '71', T2)
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('steht im Kopf jeder Liste: je Lauf der seiner letzten Eingabe, auf der Gesamtliste der jüngste der Klasse', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    expect(blaetter(wrapper)).toEqual([
      ['Klasse 1 1. Lauf', 'Letzte Änderung: 20.06.2026, 14:05:09'],
      ['Klasse 1 Gesamt', 'Letzte Änderung: 20.06.2026, 14:05:09'],
      ['Klasse 4 1. Lauf', 'Letzte Änderung: 20.06.2026, 14:05:09'],
      ['Klasse 4 2. Lauf', 'Letzte Änderung: 20.06.2026, 15:30:00'],
      ['Klasse 4 Gesamt', 'Letzte Änderung: 20.06.2026, 15:30:00'],
    ])
    // Er gehört zum Blatt (wird mitgedruckt) und ist nicht der Druckzeitpunkt im Seitenrand.
    expect(wrapper.find('.ergebnis-blatt .erg-kopf .erg-stand').classes()).not.toContain('no-print')
    expect(wrapper.find('style').text()).toContain('@bottom-right')
    expect(wrapper.find('style').text()).not.toContain('14:05:09')
    wrapper.unmount()
  })

  it('ist in beiden Fassungen und beiden Reihenfolgen derselbe; englisch als yyyy-mm-dd', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    const vorher = blaetter(wrapper)
    await wrapper.find('button[data-fassung="intern"]').trigger('click')
    await wrapper.find('select[data-feld="erg-ordnung"]').setValue('nummer')
    await nextTick()
    expect(blaetter(wrapper)).toEqual(vorher)
    setLocale('en')
    await nextTick()
    expect(blaetter(wrapper)[3]).toEqual(['Class 4 Attempt 2', 'Last change: 2026-06-20 15:30:00'])
    wrapper.unmount()
  })

  it('überlebt Neuladen: Er steht im gespeicherten Stand', async () => {
    const wieder = createStore()
    const wrapper = ansicht(wieder)
    await ergebnisse(wrapper)
    expect(blaetter(wrapper)[4]).toEqual(['Klasse 4 Gesamt', 'Letzte Änderung: 20.06.2026, 15:30:00'])
    wrapper.unmount()
  })

  it('alter Stand ohne Zeitpunkte: Die Listen zeigen nichts statt eines erfundenen Zeitpunkts', async () => {
    const { listenStand: _stand, ...alt } = store.state.value
    store.dispatch({ type: 'LOAD_STATE', state: migrate(JSON.parse(JSON.stringify(alt)))! })
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    expect(blaetter(wrapper).map((b) => b[1])).toEqual([null, null, null, null, null])
    expect(wrapper.find('.erg-stand').exists()).toBe(false)
    // Die nächste Eingabe setzt ihn – nur für die Listen, die sie betrifft.
    zeit(store, 1, 'id-1-2', '65', T2)
    await nextTick()
    expect(blaetter(wrapper).map((b) => b[1])).toEqual(['Letzte Änderung: 20.06.2026, 15:30:00', 'Letzte Änderung: 20.06.2026, 15:30:00', null, null, null])
    wrapper.unmount()
  })
})

describe('Ergebnislisten: Druckreihenfolge', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('erst Parcours, dann die Klassen in der Reihenfolge, in der sie laut Verzahnung zuerst starten – nicht E, 1, 2 …', async () => {
    localStorage.clear()
    setLocale('de')
    const store = createStore()
    // Klasse 2 fährt nirgends, hat aber Ergebnisse: Sie steht am Ende.
    const parcoursList = [
      { id: 'par_1', name: 'Parcours 1', classIds: ['4', '5', '6', '7'] as ClassId[], wechselFaktor: 2 as const },
      { id: 'par_2', name: 'Parcours 2', classIds: ['E', '1', '3'] as ClassId[], wechselFaktor: 2 as const },
    ]
    store.dispatch({ type: 'LOAD_STATE', state: { ...emptyState(), starters: starter(ALLE), parcoursList } })
    for (const k of ALLE) zeit(store, 1, `id-${k}-1`, '70', T1)
    const plan = planEvent(store.state.value).plans
    const startfolge = plan.flatMap((p) => [...new Set(p.sequence.map((s) => s.klasse))])
    expect(klassenInStartfolge(store.state.value)).toEqual([...startfolge, '2'])
    // Der erste Parcours zuerst – obwohl dort die höheren Klassen fahren.
    expect(startfolge.slice(0, 4).sort()).toEqual(['4', '5', '6', '7'])
    expect(startfolge.join('')).not.toBe('4567E13')

    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    const klassen = wrapper.findAll('.ergebnis-blatt[data-art="lauf"] .erg-kopf-klasse').map((k) => k.text().replace('Klasse ', ''))
    expect(klassen).toEqual([...startfolge, '2'])
    // Die Auswahl der Klasse steht in derselben Reihenfolge.
    expect(wrapper.findAll('select[data-feld="erg-klasse"] option').map((o) => o.attributes('value')).slice(1)).toEqual([...startfolge, '2'])
    wrapper.unmount()
  })
})
