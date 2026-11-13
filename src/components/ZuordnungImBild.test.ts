import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ZuordnungImBild from './ZuordnungImBild.vue'
import { befund, type Entwurf } from '../lib/assistent'
import { PARCOURS_HERKUNFT, parcoursSvg } from '../lib/parcoursQuelle'
import { setLocale } from '../i18n'

const entwurf = (): Entwurf => ({
  id: 'entwurf',
  name: 'Probe',
  vorsteg: false,
  steg: false,
  knoten: false,
  spalten: [
    { id: 'p1', titel: 'Eins', blick: 'links' },
    { id: 'p2', titel: 'Zwei' },
  ],
  zuordnung: { Tor1_innen: ['p1'], Tor3_innen: ['p1'], Tor2_innen: ['p2'] },
})

function ansicht(e: Entwurf) {
  return mount(ZuordnungImBild, { props: { entwurf: e, befund: befund(e), bild: parcoursSvg('Klasse7')! }, attachTo: document.body })
}

describe('Zuordnen im Bild', () => {
  beforeEach(() => setLocale('de'))
  afterEach(() => vi.unstubAllGlobals())

  it('nennt unter der Zeichnung Urheber, Quelle mit Stand, die Bearbeitung und die Lizenz', () => {
    const wrapper = ansicht(entwurf())
    const zeile = wrapper.find('.parcours-nachweis')
    expect(zeile.text()).toContain(PARCOURS_HERKUNFT.urheber)
    expect(zeile.text()).toContain('bearbeitet')
    expect(zeile.text()).toContain(PARCOURS_HERKUNFT.commit.slice(0, 7))
    expect(zeile.findAll('a').map((a) => [a.text(), a.attributes('href')])).toEqual([
      ['github.com/Motorbootslalom/Parcours', 'https://github.com/Motorbootslalom/Parcours'],
      ['CC BY-NC-SA 4.0', 'https://creativecommons.org/licenses/by-nc-sa/4.0/'],
    ])
    setLocale('en')
    expect(ansicht(entwurf()).find('.parcours-nachweis').text()).toContain('adapted')
    wrapper.unmount()
  })

  it('„Rückgängig“ holt eine entfernte Position samt ihren Bojen zurück', async () => {
    const start = entwurf()
    const wrapper = ansicht(start)
    expect(wrapper.find('.zib-zurueck').attributes('disabled')).toBeDefined()
    await wrapper.find('.zib-einstellungen .btn.danger').trigger('click')
    expect(wrapper.emitted('spalteWeg')).toEqual([['p1']])
    // Was der Assistent daraufhin tut (AufbauAssistent.vue `spalteWeg`).
    const ohne: Entwurf = { ...start, spalten: [start.spalten[1]], zuordnung: { Tor1_innen: [], Tor3_innen: [], Tor2_innen: ['p2'] } }
    await wrapper.setProps({ entwurf: ohne, befund: befund(ohne) })

    await wrapper.find('.zib-zurueck').trigger('click')
    const zurueck = wrapper.emitted('update:entwurf')!.at(-1)![0] as Entwurf
    expect(zurueck.spalten).toEqual(start.spalten)
    expect(zurueck.zuordnung).toEqual(start.zuordnung)
    // Keine Zuordnung zeigt auf eine Position, die es nicht gibt.
    const ids = zurueck.spalten.map((s) => s.id)
    for (const spalten of Object.values(zurueck.zuordnung)) for (const s of spalten) expect(ids).toContain(s)
    // Der Schritt ist verbraucht.
    await wrapper.setProps({ entwurf: zurueck, befund: befund(zurueck) })
    expect(wrapper.find('.zib-zurueck').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('ein zweiter Finger beendet die Linie des ersten nicht und zeichnet nicht mit', async () => {
    // happy-dom kennt weder Bildschirmkoordinaten eines SVG noch DOMPoint: 1 Bildeinheit = 1 px.
    vi.stubGlobal(
      'DOMPoint',
      class {
        x: number
        y: number
        constructor(x = 0, y = 0) {
          this.x = x
          this.y = y
        }
        matrixTransform() {
          return this
        }
      },
    )
    const wrapper = ansicht(entwurf())
    const flaeche = wrapper.find('.zib-ueberlage')
    const el = flaeche.element as unknown as Record<string, unknown>
    el.getScreenCTM = () => ({ inverse: () => ({}) })
    el.setPointerCapture = () => undefined
    const zeiger = (art: string, pointerId: number, clientX: number, clientY: number) =>
      flaeche.trigger(art, { pointerId, button: 0, clientX, clientY })
    const punkte = () => (wrapper.find('polyline.zib-linie').exists() ? wrapper.find('polyline.zib-linie').attributes('points')!.split(' ').length : 0)

    await zeiger('pointerdown', 1, 100, 100)
    await zeiger('pointermove', 1, 100, 140)
    expect(punkte()).toBe(2)
    // Der Handballen tippt ins Bild und hebt wieder ab.
    await zeiger('pointerdown', 2, 400, 300)
    await zeiger('pointermove', 2, 420, 300)
    await zeiger('pointerup', 2, 420, 300)
    expect(punkte()).toBe(2)
    // Der erste Finger zeichnet weiter und beendet die Linie selbst.
    await zeiger('pointermove', 1, 100, 180)
    expect(punkte()).toBe(3)
    await zeiger('pointerup', 1, 100, 180)
    expect(punkte()).toBe(0)
    wrapper.unmount()
  })
})
