import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import { AUFBAU, setzeSchrittweise } from '../lib/aufbau'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { vergissAlles } from '../lib/merken'
import type { ClassId, Starter } from '../types'

/**
 * Schrittweiser Aufbau der WKR-Listen mit Ladebalken (lib/aufbau.ts, Wunsch des Nutzers vom
 * 21.11.2026): Fortschritt zählt hoch und endet, gedruckt wird erst, wenn alles steht, und am Ende
 * stehen dieselben Bögen da wie ohne Schritte – keiner doppelt, keiner fehlt.
 */
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

const ansicht = (store: Store) => mount(ListsView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
const boegen = (w: VueWrapper) => w.findAll('.wkr-listen .bogen').map((b) => b.find('[data-qr]').attributes('data-qr'))
const drucken = (w: VueWrapper) => w.find('button.primary')
const stapel = (w: VueWrapper) => w.find('.wkr-listen')

describe('Listen: WKR-Bögen entstehen schrittweise', () => {
  let store: Store
  const vorgabe = { ...AUFBAU }

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '3']) })
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
  })
  afterEach(() => {
    Object.assign(AUFBAU, vorgabe)
    setzeSchrittweise(false)
  })

  it('Balken zählt hoch und endet; Druck erst danach; dieselben Bögen wie ohne Schritte', async () => {
    // Zum Vergleich: alles auf einmal (wie bisher).
    const ohne = ansicht(store)
    await ohne.find('[data-kind="wkr"]').trigger('click')
    await nextTick()
    const erwartet = boegen(ohne)
    ohne.unmount()
    expect(erwartet.length).toBeGreaterThan(20)
    expect(new Set(erwartet).size).toBe(erwartet.length)

    setzeSchrittweise(true)
    // Ein Bogen je Schritt und sofort sichtbar: So lässt sich jeder Zwischenstand prüfen.
    AUFBAU.ersterSchritt = 1
    AUFBAU.hoechstens = 1
    AUFBAU.anzeigeAbMs = 0
    // Ohne Mindestdauer: Der Balken geht mit dem letzten Bogen (die Mindestdauer prüft lib/aufbau.test.ts).
    AUFBAU.mindestensMs = 0
    const w = ansicht(store)
    await w.find('[data-kind="wkr"]').trigger('click')
    await nextTick()
    expect(boegen(w).length).toBe(1)
    // Solange er entsteht: Knopf gesperrt, Stapel nicht gedruckt, Hinweis nur fürs Papier.
    expect(drucken(w).attributes('disabled')).toBeDefined()
    expect(stapel(w).classes()).toContain('no-print')
    expect(stapel(w).attributes('data-aufbau')).toBe('laeuft')
    expect(w.find('[data-hinweis="aufbau-druck"]').exists()).toBe(true)

    const staende: string[] = []
    await vi.waitFor(
      () => {
        const balken = w.find('[data-teil="aufbau"]')
        if (balken.exists()) staende.push(`${balken.attributes('aria-valuenow')}/${balken.attributes('aria-valuemax')}|${w.find('[data-teil="aufbau-zeile"]').text()}`)
        expect(stapel(w).attributes('data-aufbau')).toBeUndefined()
      },
      { timeout: 20_000, interval: 5 },
    )
    // Echter Stand: zählt hoch bis kurz vor alle; die Zeile nennt, was entsteht – in der Oberflächensprache.
    const zahlen = staende.map((s) => Number(s.split('/')[0]))
    expect(new Set(zahlen).size).toBeGreaterThan(3)
    zahlen.forEach((z, i) => i > 0 && expect(z).toBeGreaterThanOrEqual(zahlen[i - 1]))
    expect(staende.every((s) => s.includes(`/${erwartet.length}|`))).toBe(true)
    expect(staende.some((s) => /Klasse \d · \d\. Lauf$/.test(s))).toBe(true)
    expect(w.find('[data-teil="aufbau-stand"]').exists()).toBe(false)

    // Fertig: alle Bögen in derselben Folge, keiner doppelt; Druck frei, Stapel druckt.
    expect(boegen(w)).toEqual(erwartet)
    expect(drucken(w).attributes('disabled')).toBeUndefined()
    expect(stapel(w).classes()).not.toContain('no-print')
    expect(w.find('[data-hinweis="aufbau-druck"]').exists()).toBe(false)
    w.unmount()
  }, 30_000)

  it('wenige Bögen: sofort fertig, kein Balken blitzt', async () => {
    setzeSchrittweise(true)
    sessionStorage.clear()
    const w = ansicht(store)
    await w.find('[data-kind="wkr"]').trigger('click')
    await nextTick()
    // Auf einen Bogen eingrenzen: Klasse, Lauf und Liste.
    await w.find('select[data-feld="wkr-klasse"]').setValue('3')
    await w.find('select[data-feld="wkr-lauf"]').setValue('2')
    await w.find('select[data-feld="wkr-liste"]').setValue('zeit')
    await nextTick()
    // Neu einhängen: Die gemerkte Auswahl gilt von Anfang an.
    w.unmount()
    const neu = ansicht(store)
    await nextTick()
    expect(boegen(neu)).toHaveLength(1)
    expect(stapel(neu).attributes('data-aufbau')).toBeUndefined()
    expect(drucken(neu).attributes('disabled')).toBeUndefined()
    await new Promise((r) => setTimeout(r, AUFBAU.anzeigeAbMs + 100))
    expect(neu.find('[data-teil="aufbau"]').exists()).toBe(false)
    expect(neu.find('[data-hinweis="aufbau-druck"]').exists()).toBe(false)
    neu.unmount()
  })
})

describe('Listen: Parallel-WKR-Bögen (UIM) entstehen schrittweise', () => {
  const vorgabe = { ...AUFBAU }
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1'], 6) })
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    // Vorlauf gefahren, Halbfinale festgeschrieben: eine Runde nach dem Vorlauf, die beim Drucken gebunden würde.
    const zeiten: Record<string, number> = { 'id-1-1': 40, 'id-1-2': 41, 'id-1-3': 42, 'id-1-4': 43, 'id-1-5': 50, 'id-1-6': 55 }
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: Object.entries(zeiten).flatMap(([id, sek]) => [1, 2].map((a) => ({ lauf: attemptSchluessel('pre', a), starter: id, feld: 'zeit1', wert: `${sek},00` }))),
      zeit: 1000,
    })
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
  })
  afterEach(() => {
    Object.assign(AUFBAU, vorgabe)
    setzeSchrittweise(false)
  })

  const parallelBoegen = async (w: VueWrapper) => {
    await w.find('[data-kind="wkr"]').trigger('click')
    await w.find('.disziplin-wahl button[data-disziplin="parallel"]').trigger('click')
    await nextTick()
  }

  it('Druck gesperrt, Strg+P bindet keine Runde; am Ende dieselben Bögen und die Runde wird gebunden', async () => {
    const ohne = ansicht(store)
    await parallelBoegen(ohne)
    const erwartet = boegen(ohne)
    ohne.unmount()
    expect(erwartet.length).toBeGreaterThan(3)

    setzeSchrittweise(true)
    AUFBAU.ersterSchritt = 1
    AUFBAU.hoechstens = 1
    AUFBAU.anzeigeAbMs = 0
    AUFBAU.mindestensMs = 0
    const w = ansicht(store)
    await parallelBoegen(w)
    expect(boegen(w).length).toBeLessThan(erwartet.length)
    expect(drucken(w).attributes('disabled')).toBeDefined()
    expect(stapel(w).classes()).toContain('no-print')
    expect(stapel(w).attributes('data-aufbau')).toBe('laeuft')
    expect(stapel(w).attributes('aria-busy')).toBe('true')
    expect(w.find('[data-hinweis="aufbau-druck"]').exists()).toBe(true)
    // Strg+P mitten im Aufbau: Auf dem Papier steht nur der Hinweis – die Runde bleibt ungebunden.
    window.dispatchEvent(new Event('beforeprint'))
    await nextTick()
    expect(store.state.value.parallelGedruckt).toEqual({})

    await vi.waitFor(() => expect(stapel(w).attributes('data-aufbau')).toBeUndefined(), { timeout: 20_000, interval: 5 })
    expect(boegen(w)).toEqual(erwartet)
    expect(drucken(w).attributes('disabled')).toBeUndefined()
    expect(stapel(w).classes()).not.toContain('no-print')
    window.dispatchEvent(new Event('beforeprint'))
    await nextTick()
    expect(Object.keys(store.state.value.parallelGedruckt)).toEqual(['semi'])
    w.unmount()
  }, 30_000)
})
