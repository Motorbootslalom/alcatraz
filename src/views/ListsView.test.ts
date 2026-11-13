import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
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

function ansicht(store: Store) {
  return mount(ListsView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
}
async function wkr(wrapper: VueWrapper) {
  await wrapper.findAll('.list-kinds button').at(-1)!.trigger('click')
  await nextTick()
}
async function waehle(wrapper: VueWrapper, feld: string, wert: string) {
  await wrapper.find(`select[data-feld="wkr-${feld}"]`).setValue(wert)
  await nextTick()
}
const koepfe = (wrapper: VueWrapper) => wrapper.findAll('.wkr-listen .bogen').map((b) => b.findAll('.bk-links .bk-zelle').map((z) => z.text()).join(' | '))
const drucken = (wrapper: VueWrapper) => wrapper.find('button.primary')

describe('Listen: Wettkampfrichter-Listen', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '3', '4', '7']) })
    store.dispatch({ type: 'SET_WKR_NAME', parcoursId: 'par_2', typeId: 'steg', name: 'B. Beispiel' })
  })
  afterEach(() => setLocale('de'))

  it('ist eine eigene Listenart; je Parcours, Klasse, Lauf und Liste ein Bogen', async () => {
    const wrapper = ansicht(store)
    expect(wrapper.findAll('.list-kinds button').map((b) => b.text())).toContain('Wettkampfrichter-Listen')
    expect(wrapper.find('.wkr-listen').exists()).toBe(false)
    await wkr(wrapper)
    // Alcatraz: 8 Listen, Mann-über-Bord erst ab Klasse 4 → (7 + 7 + 8 + 8) × 3 Läufe.
    expect(wrapper.findAll('.wkr-listen .bogen')).toHaveLength(90)
    expect(wrapper.find('.wkr-listen-stand').text()).toBe('90 Bögen')
    expect(koepfe(wrapper)[0]).toBe('Zeit | Klasse 1 | 1. Lauf | Parcours 1')
    expect(drucken(wrapper).attributes('disabled')).toBeUndefined()
    // Die alten Listen stehen nicht daneben.
    expect(wrapper.find('.sheet').exists()).toBe(false)
    wrapper.unmount()
  })

  it('die Auswahl grenzt ein, was gezeigt und gedruckt wird', async () => {
    const wrapper = ansicht(store)
    await wkr(wrapper)
    await waehle(wrapper, 'klasse', '7')
    await waehle(wrapper, 'lauf', '2')
    expect(wrapper.findAll('.wkr-listen .bogen')).toHaveLength(8)
    await waehle(wrapper, 'liste', 'steg')
    expect(koepfe(wrapper)).toEqual(['Steg | Klasse 7 | 2. Lauf | Parcours 2'])
    const bogen = wrapper.find('.wkr-listen .bogen')
    // Der Name aus der WKR-Einteilung steht als Text im Kopf, nicht als Eingabefeld.
    expect(bogen.find('.bk-wkr-text').text()).toBe('B. Beispiel')
    expect(bogen.find('input').exists()).toBe(false)
    // Startnummern in Startreihenfolge, danach drei Leerzeilen; keine Namen der Starter.
    expect(bogen.findAll('tbody > tr > td.bt-nr').map((z) => z.text())).toEqual(['701', '702', '703', '', '', ''])
    expect(bogen.findAll('tbody > tr[data-zeile]').slice(0, 3).map((z) => z.attributes('data-zeile'))).toEqual(['id-7-1', 'id-7-2', 'id-7-3'])
    expect(wrapper.find('.wkr-listen').text()).not.toContain('Nach7')
    // Kein Kennzeichen „Beispielansicht“: Diese Bögen werden gedruckt.
    expect(bogen.attributes('data-muster')).toBeUndefined()
    await waehle(wrapper, 'parcours', 'par_1')
    expect(wrapper.findAll('.wkr-listen .bogen')).toHaveLength(0)
    expect(wrapper.text()).toContain('Für diese Auswahl gibt es keinen Bogen.')
    expect(drucken(wrapper).attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('Fenstertitel beim Drucken: Listenart, Auswahl und Veranstaltung in der Sprache der Oberfläche', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    setLocale('en')
    const wrapper = ansicht(store)
    await wkr(wrapper)
    await waehle(wrapper, 'klasse', '7')
    await waehle(wrapper, 'lauf', '1')
    await drucken(wrapper).trigger('click')
    expect(print).toHaveBeenCalledOnce()
    expect(document.title).toMatch(/^Judges' sheets - Class 7 - Attempt 1 - Hafenpokal 2026 - \d{4}-\d{2}-\d{2}/)
    window.dispatchEvent(new Event('afterprint'))
    // Der Titel wird zum Dateinamen: keine Schrägstriche („Tor 1 / 3 / 5“; der Name der Liste folgt dem Regelwerk).
    await waehle(wrapper, 'liste', 'gate135')
    await drucken(wrapper).trigger('click')
    expect(document.title).toMatch(/^Judges' sheets - Class 7 - Attempt 1 - Tor 1-3-5 - Hafenpokal 2026 - /)
    expect(document.title).not.toMatch(/[/\\:]/)
    // Seitenzähler und Zeitpunkt stehen im Rand der Bogen-Seiten (Hoch- und Querformat).
    const css = wrapper.find('style').text()
    expect(css).toContain('@page bogen-hoch')
    expect(css).toContain('@page bogen-quer')
    expect(css).toContain('counter(page)')
    window.dispatchEvent(new Event('afterprint'))
    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('Parcoursbild mit Namensnennung der Zeichnung auf dem Bogen', async () => {
    const wrapper = ansicht(store)
    await wkr(wrapper)
    await waehle(wrapper, 'klasse', '7')
    await waehle(wrapper, 'lauf', '1')
    await waehle(wrapper, 'liste', 'gate135')
    const bogen = wrapper.find('.wkr-listen .bogen')
    expect(bogen.find('.bogen-bild').exists()).toBe(true)
    expect(bogen.find('.bogen-nachweis').text()).toContain('CC BY-NC-SA 4.0')
    // Eine Liste ohne Bild trägt keine Namensnennung.
    await waehle(wrapper, 'liste', 'steg')
    expect(wrapper.find('.wkr-listen .bogen .bogen-nachweis').exists()).toBe(false)
    wrapper.unmount()
  })

  it('gesperrt, solange Startnummern fehlen oder doppelt sind: Hinweis, kein Bogen, kein Druck', async () => {
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-1-1', patch: { startNr: '' } })
    const wrapper = ansicht(store)
    await wkr(wrapper)
    expect(wrapper.find('[role="alert"]').text()).toContain('1 Starter hat noch keine Startnummer.')
    expect(wrapper.findAll('.bogen')).toHaveLength(0)
    expect(wrapper.find('.wkr-listen-wahl').exists()).toBe(false)
    expect(drucken(wrapper).attributes('disabled')).toBeDefined()
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-1-1', patch: { startNr: '102' } })
    await nextTick()
    expect(wrapper.find('[role="alert"]').text()).toContain('teilen sich eine Startnummer')
    expect(wrapper.findAll('.bogen')).toHaveLength(0)
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-1-1', patch: { startNr: '101' } })
    await nextTick()
    await nextTick()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.findAll('.bogen').length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('Clubmeisterschaft: Klassen mit gleichem Aufbau stehen mit Zwischenüberschrift auf einem Bogen', async () => {
    store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
    const wrapper = ansicht(store)
    await wkr(wrapper)
    expect(wrapper.find('.wkr-listen-wahl').text()).toContain('Clubmeisterschaft')
    await waehle(wrapper, 'lauf', '1')
    await waehle(wrapper, 'liste', 'steg')
    expect(koepfe(wrapper)).toEqual(['Steg | Klassen 1, 3 | 1. Lauf | Parcours 1', 'Steg | Klassen 4, 7 | 1. Lauf | Parcours 2'])
    const bogen = wrapper.findAll('.wkr-listen .bogen')[1]
    expect(bogen.findAll('tr.bt-zwischen').map((z) => z.text())).toEqual(['Klasse 4', 'Klasse 7'])
    expect(bogen.find('th.bt-klasse').exists()).toBe(false)
    // Die Auswahl einer Klasse zeigt den gemeinsamen Bogen, auf dem sie steht.
    await waehle(wrapper, 'klasse', '7')
    expect(koepfe(wrapper)).toEqual(['Steg | Klassen 4, 7 | 1. Lauf | Parcours 2'])
    wrapper.unmount()
  })

  it('Beschreibung auf der Rückseite: je Vorderseite eine Rückseite, mit Hinweis zum doppelseitigen Druck', async () => {
    store.dispatch({ type: 'SET_WKR_RUECKSEITE', rueckseite: true })
    const wrapper = ansicht(store)
    await wkr(wrapper)
    await waehle(wrapper, 'klasse', '7')
    await waehle(wrapper, 'lauf', '1')
    await waehle(wrapper, 'liste', 'gate135')
    expect(wrapper.findAll('.wkr-listen .bogen')).toHaveLength(2)
    expect(wrapper.findAll('.wkr-listen .bogen--rueck')).toHaveLength(1)
    expect(wrapper.find('.wkr-listen-wahl').text()).toContain('doppelseitig')
    wrapper.unmount()
  })

  it('meldet Klassen, für die es keinen Bogen gibt', async () => {
    store.dispatch({ type: 'SET_PARCOURS_CLASSES', id: 'par_2', classIds: ['4'] })
    const wrapper = ansicht(store)
    await wkr(wrapper)
    expect(wrapper.find('.wkr-listen-wahl .boat-banner.warn').text()).toContain('Kein Bogen für Klasse 7')
    wrapper.unmount()
  })

  it('ohne Starter: der übliche Hinweis', async () => {
    store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
    const wrapper = ansicht(store)
    await wkr(wrapper)
    expect(wrapper.find('.panel.empty').text()).toContain('Noch keine Starter')
    wrapper.unmount()
  })
})
