import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import WeighingView from './WeighingView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'

// Verwiegung → „Gewichtslisten drucken“ (Entscheidung des Nutzers vom 15.11.2026): ein Verweis zu
// Listen → Gewichtslisten mit der gewählten Herkunft, bei „Alle“ alle. Alle Starter sind erfunden.

const starter = (klasse: ClassId, n: number, verein: string): Starter => ({
  id: `id-${klasse}-${n}`,
  startNr: `${klasse}0${n}`,
  vorname: `Vor${klasse}${n}`,
  nachname: `Nach${klasse}${n}`,
  verein,
  bundesland: '',
  geburtsdatum: '2014-05-01',
  groesse: '',
  klasse,
})
const mounte = (view: typeof ListsView, store: Store) => mount(view, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
/** Die Herkunft im Kopf jeder Gewichtsliste (erste Seite). */
const herkuenfte = (wrapper: VueWrapper) => wrapper.findAll('.listen-seite[data-seite="1"] .sheet-title-box').map((b) => b.text())

describe('Verwiegung: Gewichtslisten drucken', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal', eventJahr: 2026 } })
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter('3', 1, 'MBC Nord'), starter('3', 2, 'MBC Süd'), starter('4', 1, 'mbc  nord')] })
  })
  afterEach(() => {
    location.hash = ''
    setLocale('de')
  })

  it('der Verweis steht neben der Auswahl der Herkunft und nimmt sie mit – bei „Alle“ alle, in der Sprache der Oberfläche', async () => {
    const wiegen = mounte(WeighingView, store)
    const link = () => wiegen.find('a[data-action="gewichtslisten"]')
    expect(link().text()).toContain('Gewichtslisten drucken')
    expect(link().attributes('href')).toBe('#/listen/gewicht/*')
    // Prüfbefund zu Paket F (16.11.2026): kein „für Alle.“ mitten im Satz, kein „e.V..“.
    expect(link().attributes('title')).toBe('Öffnet „Listen“ → alle Gewichtslisten')
    // Steht neben der Auswahl, in derselben Zeile.
    expect(link().element.parentElement).toBe(wiegen.find('#weigh-origin').element.parentElement!.parentElement)
    await wiegen.find('#weigh-origin').setValue('MBC Nord')
    expect(link().attributes('href')).toBe('#/listen/gewicht/MBC%20Nord')
    expect(link().attributes('title')).toBe('Öffnet „Listen“ → Gewichtslisten für MBC Nord')
    setLocale('en')
    await nextTick()
    expect(link().attributes('href')).toBe('#/lists/weights/MBC%20Nord')
    expect(link().text()).toContain('Print weight lists')
    expect(link().attributes('title')).toBe('Opens “Lists” → weight lists for MBC Nord')
    await wiegen.find('#weigh-origin').setValue('')
    expect(link().attributes('title')).toBe('Opens “Lists” → all weight lists')
    wiegen.unmount()
  })

  it('der Verweis wählt in „Listen“ die Gewichtslisten zum Eintragen und die Herkunft – Schreibweisen zusammengefasst', async () => {
    location.hash = '#/listen/gewicht/MBC%20Nord'
    const listen = mounte(ListsView, store)
    await nextTick()
    expect(listen.find('.list-kinds button.active').attributes('data-kind')).toBe('gewicht')
    expect(listen.find('.gewicht-arten button.active').attributes('data-art')).toBe('herkunft')
    const auswahl = listen.find('select[data-feld="gewicht-herkunft"]')
    expect(auswahl.findAll('option').map((o) => o.text())).toEqual(['alle', 'MBC Nord', 'MBC Süd'])
    expect((auswahl.element as HTMLSelectElement).selectedOptions[0].text).toBe('MBC Nord')
    // Nur die eine Liste – mit beiden Schreibweisen ihrer Starter.
    const koepfe = herkuenfte(listen)
    expect(koepfe).toHaveLength(1)
    expect(koepfe[0]).toContain('MBC Nord')
    expect(listen.text()).toContain('Nach41')
    expect(listen.text()).not.toContain('Nach32')
    // Die Herkunft bleibt in der Adresse stehen (Entscheidung 16.11.2026) und folgt der Auswahl.
    expect(location.hash).toBe('#/listen/gewicht/MBC%20Nord')
    await auswahl.setValue(auswahl.findAll('option')[2].element.value)
    expect(location.hash).toBe('#/listen/gewicht/MBC%20S%C3%BCd')
    await auswahl.setValue(auswahl.findAll('option')[0].element.value)
    expect(location.hash).toBe('#/listen/gewicht')
    listen.unmount()

    // „Alle“ druckt alle – auch wenn vorher eine Herkunft gewählt war.
    location.hash = '#/listen/gewicht/*'
    const alle = mounte(ListsView, store)
    await nextTick()
    expect(herkuenfte(alle)).toHaveLength(2)
    alle.unmount()
  })
})
