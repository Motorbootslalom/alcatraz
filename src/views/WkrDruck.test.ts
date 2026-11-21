import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import { vergissAlles } from '../lib/merken'
import { listenKennung } from '../wkr/liste'
import type { Action } from '../state/reducer'
import type { ClassId, Starter } from '../types'

/**
 * Druck nach Modus (Nutzer 21.11.2026: „Warum werden Listen gedruckt, wenn ich beim Betrieb nur Gerät ausgewählt habe
 * und nicht beides?“, WKR_ANNAHMEN Z1–Z5): Listen → WKR-Bögen und Laufzettel lassen nur digitale Listen weg, mit
 * Hinweis und Schalter „Trotzdem drucken“. Erfundene Starter.
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
const qr = (w: VueWrapper) => w.findAll('.wkr-listen .bogen').map((b) => b.find('[data-qr]').attributes('data-qr') ?? '')
const hinweis = (w: VueWrapper) => w.find('[data-hinweis="nur-digital"]')
const K = (typeId: string) => listenKennung({ bereich: 'par_1', typeId, racecourse: null })

describe('Listen: WKR-Bögen nach Modus', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    vergissAlles()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '3']) })
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('„Gerät“ wird nicht gezeigt und nicht gedruckt; beides/Papier wie bisher; „Trotzdem drucken“ bringt sie zurück', async () => {
    const w = ansicht(store)
    await w.find('[data-kind="wkr"]').trigger('click')
    await nextTick()
    const alle = qr(w)
    expect(alle.some((c) => /\.PAR1\..*\.ZEIT(\.|$)/.test(c))).toBe(true)
    expect(hinweis(w).exists()).toBe(false)

    store.dispatch({ type: 'WKR_LISTE', liste: K('zeit'), modus: 'digital' } as Action)
    store.dispatch({ type: 'WKR_LISTE', liste: K('steg'), modus: 'beides' } as Action)
    await nextTick()
    await nextTick()
    const ohne = qr(w)
    expect(ohne.filter((c) => /\.PAR1\..*\.ZEIT(\.|$)/.test(c))).toEqual([])
    expect(ohne).toEqual(alle.filter((c) => !(/\.PAR1\..*\.ZEIT(\.|$)/.test(c))))
    expect(ohne.some((c) => /\.PAR1\..*\.STEG(\.|$)/.test(c))).toBe(true)
    expect(hinweis(w).exists()).toBe(true)
    expect(hinweis(w).classes()).toContain('no-print')
    expect(hinweis(w).text()).toContain(`${alle.length - ohne.length} Bögen werden nur digital erfasst`)
    expect(hinweis(w).text()).toContain('Zeit')
    expect(w.find('.wkr-listen-stand').text()).toContain(`${ohne.length} Bögen`)

    await w.find('input[data-feld="digital-drucken"]').setValue(true)
    await nextTick()
    expect(qr(w)).toEqual(alle)
    expect(hinweis(w).text()).toContain('trotzdem gedruckt')
    w.unmount()
  })

  it('Laufzettel: kein Kästchen für einen Bogen, der nicht gedruckt wird', async () => {
    const w = ansicht(store)
    await w.find('.list-kinds button[data-kind="laufzettel"]').trigger('click')
    await nextTick()
    await nextTick()
    const zeilenVorher = w.findAll('.laufzettel-stapel .laufzettel').map((z) => z.text())
    expect(zeilenVorher.some((t) => t.includes('Zeit'))).toBe(true)
    store.dispatch({ type: 'WKR_LISTE', liste: K('zeit'), modus: 'digital' } as Action)
    await nextTick()
    await nextTick()
    const par1 = w.findAll('.laufzettel-stapel .laufzettel').filter((z) => z.attributes('data-zettel')?.startsWith('par_1|'))
    expect(par1.length).toBeGreaterThan(0)
    for (const z of par1) expect(z.findAll('.lz-oben li').map((li) => li.text()).some((t) => t.startsWith('Zeit'))).toBe(false)
    expect(hinweis(w).exists()).toBe(true)
    w.unmount()
  })
})
