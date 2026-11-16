import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import KopfLogos from './KopfLogos.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { testLogo } from '../testHilfen'

// Logos links und rechts im Kopf der gedruckten Listen (16.11.2026). Ohne Logo bleibt das DOM genau wie
// vorher – darauf beruhen Seitenteilung und alle Tests der Listen. Nur selbst erzeugte Testbilder.

/** Ein Kopf wie auf den Listen: KopfLogos um einen umrandeten Kasten. */
const Kopf = defineComponent({
  props: { art: { type: String, default: undefined } },
  setup: (props) => () => h('div', { class: 'eltern' }, [h(KopfLogos, { art: props.art as never }, () => h('div', { class: 'sheet-title-box' }, 'Titel'))]),
})

function mitStore(store: Store | null, art?: string) {
  return mount(Kopf, { props: { art }, global: store ? { provide: { [storeKey as symbol]: store } } : {} })
}

describe('KopfLogos', () => {
  let store: Store
  beforeEach(() => {
    localStorage.clear()
    store = createStore({ idb: null })
  })

  it('ohne Store und ohne Logos: nur der Kopf, kein Wrapper, kein Bild', () => {
    for (const w of [mitStore(null), mitStore(store)]) {
      expect(w.find('.kopf-logos').exists()).toBe(false)
      expect(w.findAll('img')).toHaveLength(0)
      expect(w.find('.eltern > .sheet-title-box').text()).toBe('Titel')
    }
  })

  it('nur links: ein Bild mit Höhe und Breite in mm, alt leer', () => {
    store.dispatch({ type: 'SET_LOGO', seite: 'links', logo: testLogo() })
    const w = mitStore(store)
    const bilder = w.findAll('img')
    expect(bilder).toHaveLength(1)
    const img = w.find('img[data-logo="links"]')
    expect(img.attributes('style')).toContain('height: 15mm')
    expect(img.attributes('style')).toContain('width: 30mm')
    expect(img.attributes('alt')).toBe('')
    expect(img.attributes('src')).toBeTruthy()
    expect(w.find('.eltern > .kopf-logos.kopf-logos--rahmen > .kopf-logos-mitte > .sheet-title-box').exists()).toBe(true)
  })

  it('beide Logos, links vor rechts; die Form steht als Klasse am Wrapper', async () => {
    store.dispatch({ type: 'SET_LOGO', seite: 'links', logo: testLogo() })
    store.dispatch({ type: 'SET_LOGO', seite: 'rechts', logo: testLogo(1, 1) })
    for (const art of ['rahmen', 'leiste', 'streifen']) {
      const w = mitStore(store, art)
      expect(w.find('.kopf-logos').classes()).toEqual(['kopf-logos', `kopf-logos--${art}`])
      expect(w.findAll('.kopf-logos > *').map((e) => e.attributes('data-logo') ?? e.classes()[0])).toEqual(['links', 'kopf-logos-mitte', 'rechts'])
      // Quadratisch: Breite = Höhe – auf den WKR-Bögen (`leiste`) höchstens 12 mm.
      expect(w.find('img[data-logo="rechts"]').attributes('style')).toContain(art === 'leiste' ? 'width: 12mm' : 'width: 15mm')
    }
  })

  it('WKR-Bögen (leiste): höchstens 12 mm, darunter gilt die Einstellung; die übrigen Formen folgen ihr ganz', async () => {
    store.dispatch({ type: 'SET_LOGO', seite: 'links', logo: testLogo() })
    store.dispatch({ type: 'SET_LOGO_HOEHE', mm: 20 })
    const hoehe = (art: string) => mitStore(store, art).find('img[data-logo="links"]').attributes('style')
    expect(hoehe('leiste')).toContain('height: 12mm')
    expect(hoehe('leiste')).toContain('width: 24mm')
    expect(hoehe('rahmen')).toContain('height: 20mm')
    expect(hoehe('streifen')).toContain('height: 20mm')
    store.dispatch({ type: 'SET_LOGO_HOEHE', mm: 10 })
    expect(hoehe('leiste')).toContain('height: 10mm')
  })

  it('die eingestellte Höhe gilt für beide; entfernen stellt das DOM von „ohne“ wieder her', async () => {
    const ohne = mitStore(store).html()
    store.dispatch({ type: 'SET_LOGO', seite: 'links', logo: testLogo() })
    store.dispatch({ type: 'SET_LOGO', seite: 'rechts', logo: testLogo() })
    const w = mitStore(store)
    store.dispatch({ type: 'SET_LOGO_HOEHE', mm: 20 })
    await w.vm.$nextTick()
    for (const seite of ['links', 'rechts']) {
      const stil = w.find(`img[data-logo="${seite}"]`).attributes('style')
      expect(stil).toContain('height: 20mm')
      expect(stil).toContain('width: 40mm')
    }
    store.dispatch({ type: 'SET_LOGO', seite: 'links', logo: null })
    store.dispatch({ type: 'SET_LOGO', seite: 'rechts', logo: null })
    await w.vm.$nextTick()
    expect(w.html()).toBe(ohne)
  })
})
