import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import WeighingView from './WeighingView.vue'
import ErfassungView from './ErfassungView.vue'
import StartersView from './StartersView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { laufSchluessel } from '../lib/eingaben'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'
import { knotenHaken } from '../testHilfen'

// Die Klasse E heißt unter UIM überall „Dolphin“ (Regel 960, Pkt. 1 „Class Dolphin“) – in
// beiden Oberflächensprachen, weil es der Name der Klasse im Regelwerk ist. Unter DM bleibt
// sie „E“ / „Klasse E“ (ausdrücklich nicht „ME“). Der Name steht im YAML des Regelwerks; die
// Startnummern behalten ihr „E“. Alle Starter sind erfunden.

function starter(klassen: ClassId[]): Starter[] {
  return klassen.flatMap((klasse) =>
    [1, 2].map((i) => ({
      id: `id-${klasse}-${i}`,
      startNr: `${klasse}${String(i).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i}`,
      nachname: `Nach${klasse}${i}`,
      verein: 'Musterclub',
      bundesland: 'Musterland',
      geburtsdatum: '',
      groesse: '',
      klasse,
    })),
  )
}
const global = (store: Store) => ({ global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
async function liste(wrapper: VueWrapper, kind: string, art = '') {
  await wrapper.find(`.list-kinds button[data-kind="${kind}"]`).trigger('click')
  await nextTick()
  if (art) await wrapper.find(`button[data-art="${art}"]`).trigger('click')
  await nextTick()
  await nextTick()
}
/** Die letzte Zelle jeder Zeile der Liste – bei den Starterlisten die Spalte „Klasse“. */
const letzteSpalte = (wrapper: VueWrapper) => wrapper.findAll('.sheet-table tbody tr').map((r) => r.findAll('td').at(-1)!.text())

describe.each([
  ['de', 'Klasse'],
  ['en', 'Class'],
] as const)('Klasse E unter UIM und DM (Oberfläche %s)', (sprache, wortKlasse) => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale(sprache)
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal', laufCount: 1 } })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['E', '1']) })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('UIM: Starterlisten, Gewichtslisten und Ausgleichsgewichte nennen die Klasse „Dolphin“; die Startnummern behalten ihr E', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    const wrapper = mount(ListsView, global(store))
    await liste(wrapper, 'starter', 'klasse')
    expect(letzteSpalte(wrapper)).toEqual(['Dolphin', 'Dolphin', '1', '1'])
    expect(wrapper.findAll('.sheet-table tbody tr').map((r) => r.find('td').text())).toEqual(['E01', 'E02', '101', '102'])
    await liste(wrapper, 'starter', 'herkunft')
    expect(wrapper.findAll('.sheet-table tbody tr').map((r) => r.findAll('td')[3].text())).toEqual(['Dolphin', 'Dolphin', '1', '1'])
    await liste(wrapper, 'gewicht', 'herkunft')
    expect(wrapper.findAll('.sheet-table tbody tr').map((r) => r.find('td').text())).toEqual(['Dolphin', 'Dolphin', '1', '1'])
    await liste(wrapper, 'gewicht', 'steg')
    expect(wrapper.findAll('.sheet-table tbody tr').map((r) => r.findAll('td')[4].text())).toEqual(['Dolphin', 'Dolphin', '1', '1'])
    // Auswahlfelder: der Name aus dem Regelwerk, in jeder Oberflächensprache.
    expect(wrapper.findAll('select[data-feld="steg-klasse"] option').map((o) => o.text()).slice(1)).toEqual(['Dolphin', `${wortKlasse} 1`])
    wrapper.unmount()
  })

  it('UIM: Wertungsliste, Mannschaftswertung und Druckdatei – „Dolphin“ im Kopf und in der Spalte', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 1 } })
    store.dispatch({ type: 'SET_STREICHLAEUFE', streichlaeufe: 0 })
    store.dispatch({ type: 'SET_POKAL_UIM', patch: { mindestens: 1 } })
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: starter(['E', '1']).map((p, i) => ({ lauf: laufSchluessel('manoevrieren', 1), starter: p.id, feld: 'zeit1', wert: String(60 + i) })),
      zeit: 1,
    })
    // Unter Regel 960 gibt es die UIM points des Manövrierens erst mit den Knoten.
    store.dispatch({ type: 'SET_EINGABEN', zellen: knotenHaken(starter(['E', '1']).map((p) => p.id)) })
    const wrapper = mount(ListsView, global(store))
    await liste(wrapper, 'ergebnis')
    expect(wrapper.findAll('.erg-kopf-klasse').map((k) => k.text())).toContain('Dolphin')
    expect(wrapper.findAll('.erg-kopf-klasse').map((k) => k.text()).join(' ')).not.toMatch(/\bE\b/)
    expect(wrapper.findAll('select option').map((o) => o.text())).toContain('Dolphin')
    await liste(wrapper, 'pokal')
    const klassen = wrapper.findAll('.ergebnis-blatt[data-art="pokal-uim"] tr[data-starter] td:nth-child(2)').map((z) => z.text())
    expect(klassen.sort()).toEqual(['1', '1', 'Dolphin', 'Dolphin'])
    await liste(wrapper, 'druckdatei')
    // Die Druckdatei baut sich in Schritten auf.
    for (let i = 0; i < 60 && wrapper.find('.druckdatei').attributes('data-fertig') === undefined; i++) await new Promise((weiter) => setTimeout(weiter, 5))
    await nextTick()
    expect(wrapper.find('.druckdatei-wahl').text()).toContain('Dolphin')
    expect(wrapper.find('.druckdatei [data-teil="starter"]').text()).toContain('Dolphin')
    expect(wrapper.findAll('.druckdatei [data-teil="ergebnis"] .erg-kopf-klasse').map((k) => k.text())).toContain('Dolphin')
    wrapper.unmount()
  })

  it('UIM: Erfassung und Verwiegung – „Dolphin“ in der Auswahl, „D“ in der runden Marke', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    const erfassung = mount(ErfassungView, global(store))
    await nextTick()
    expect(erfassung.findAll('select option').map((o) => o.text())).toContain('Dolphin')
    erfassung.unmount()
    const wiegen = mount(WeighingView, global(store))
    await nextTick()
    expect(wiegen.findAll('.class-badge').map((b) => b.text())).toEqual(['D', 'D', '1', '1'])
    expect(wiegen.text()).toContain('Dolphin')
    wiegen.unmount()
    // Auch die Marke neben der Überschrift der Klasse in „Starter“.
    const starterAnsicht = mount(StartersView, global(store))
    await nextTick()
    expect(starterAnsicht.findAll('.class-header .class-badge').map((b) => b.text())).toContain('D')
    expect(starterAnsicht.findAll('.class-header .class-badge').map((b) => b.text())).not.toContain('E')
    starterAnsicht.unmount()
  })

  it('DM: die Klasse heißt „E“ – in der Spalte „E“, ausgeschrieben „Klasse E“, nirgends „ME“ oder „Dolphin“', async () => {
    const wrapper = mount(ListsView, global(store))
    await liste(wrapper, 'starter', 'klasse')
    expect(letzteSpalte(wrapper)).toEqual(['E', 'E', '1', '1'])
    await liste(wrapper, 'gewicht', 'steg')
    // Die Blätter der DM stehen deutsch, gleich in welcher Sprache die Oberfläche bedient wird.
    expect(wrapper.findAll('.sheet-title-box [data-feld="klasse"]').map((k) => k.text())).toEqual(['Klasse E', 'Klasse 1'])
    expect(wrapper.findAll('select[data-feld="steg-klasse"] option').map((o) => o.text()).slice(1)).toEqual([`${wortKlasse} E`, `${wortKlasse} 1`])
    expect(wrapper.text()).not.toMatch(/\bME\b|Dolphin/)
    const wiegen = mount(WeighingView, global(store))
    await nextTick()
    expect(wiegen.findAll('.class-badge').map((b) => b.text())).toEqual(['E', 'E', '1', '1'])
    wiegen.unmount()
    wrapper.unmount()
  })

  it('„Automatisch vergeben“ schreibt unter UIM E01, E02 – der Buchstabe steht im Regelwerk (startNrPraefix)', () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'ASSIGN_START_NUMBERS' })
    expect(store.state.value.starters.filter((p) => p.klasse === 'E').map((p) => p.startNr)).toEqual(['E01', 'E02'])
  })
})
