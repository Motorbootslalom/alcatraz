import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WkrKnoepfe from './WkrKnoepfe.vue'
import { configFor } from '../../config/konfig'
import { leererEntwurf, maskeFuer, tippe, tippeDisq, zurueck, type MaskenTeil } from '../../wkr/maske'
import { maskenJeKlasse, type ListenSicht } from '../../wkr/sicht'

/**
 * Codes, die laut Regelwerk in der Klasse nicht gelten (Nutzer 21.11.2026, W3-07, WKR_ANNAHMEN GF2): ausgegraut, aber
 * drückbar, ohne Rückfrage – der Tipp geht wie jeder andere hinaus.
 */
describe('WkrKnoepfe – ausgegraute Codes (W3-07)', () => {
  const teil: MaskenTeil = {
    teil: 'ab',
    feld: 'katalog:stegAblegen',
    titel: 'Ablegen (AB)',
    buchstaben: [],
    codes: [
      { code: '3', text: 'erneute Stegberührung', punkte: 5, max: 3 },
      { code: '5', text: 'Durchreißen der Schaltung / erst ab Klasse 4', punkte: 5, aus: true, max: 3 },
    ],
  }

  it('graut aus, bleibt drückbar und meldet den Tipp ohne Rückfrage', async () => {
    const w = mount(WkrKnoepfe, { props: { teile: [teil], entwurf: leererEntwurf() } })
    const aus = w.find('[data-action="code"][data-code="5"]')
    expect(aus.classes()).toContain('wkr-code--aus')
    expect(aus.attributes('data-aus')).toBe('true')
    expect(aus.attributes('disabled')).toBeUndefined()
    expect(aus.find('[data-teil="code-aus"]').text()).toBe('gilt laut Regelwerk nicht in dieser Klasse')
    expect(w.find('[data-code="3"]').classes()).not.toContain('wkr-code--aus')
    await aus.trigger('click')
    expect(w.emitted('tippe')).toEqual([['katalog:stegAblegen', '5']])
    expect(document.querySelector('dialog')).toBeNull()
  })
})

/**
 * Höchstzahl je Code (Nutzer 24.11.2026, WKR_ANNAHMEN CM3/CM4): „höchstens 1×“ dauerhaft im Knopf am Höchstwert;
 * „2. und 3. Versuch“ zeigt bei 2 „nächster = Disq. D“, nach dem dritten Tipp „Disq. D gesetzt“ (Zähler bleibt ×2).
 */
describe('WkrKnoepfe – Höchstzahl und Disq. danach (CM3/CM4)', () => {
  const DM = configFor({ regelwerk: 'dm-2026' })
  const sicht = { klassen: maskenJeKlasse(DM, DM, 'tor5', ['5'], false) } as ListenSicht
  const aufbau = maskeFuer(sicht, '5')!
  const T5 = 'katalog:tor5'
  const knopf = (w: ReturnType<typeof mount>, c: string) => w.find(`[data-action="code"][data-code="${c}"]`)

  it('Code 1: nach einem Tipp „höchstens 1×“, nimmt nichts mehr an', () => {
    const e = tippe(leererEntwurf(), aufbau, T5, '1')
    const w = mount(WkrKnoepfe, { props: { teile: aufbau.teile, entwurf: e } })
    expect(knopf(w, '1').attributes()).toMatchObject({ 'data-anzahl': '1', 'data-max': '1', 'data-naechster': 'nichts' })
    expect(knopf(w, '1').find('[data-teil="code-grenze"]').text()).toBe('höchstens 1×')
    expect(knopf(w, '1').find('[data-teil="zaehler"]').text()).toBe('×1')
    expect(knopf(w, '1').attributes('disabled')).toBeUndefined()
    expect(tippe(e, aufbau, T5, '1')).toBe(e)
    // Ohne Tipp keine Zeile (nichts, was ohne Tipp kommt, M5).
    expect(knopf(w, '20').find('[data-teil="code-grenze"]').exists()).toBe(false)
  })

  it('Code 20: „×2 · nächster = Disq. D“, dann „Disq. D gesetzt“; Rückgängig zurück auf „nächster = Disq. D“', async () => {
    let e = tippe(tippe(leererEntwurf(), aufbau, T5, '20'), aufbau, T5, '20')
    const w = mount(WkrKnoepfe, { props: { teile: aufbau.teile, entwurf: e } })
    expect(knopf(w, '20').attributes()).toMatchObject({ 'data-anzahl': '2', 'data-max': '2', 'data-naechster': 'danach', 'data-danach': 'D' })
    expect(knopf(w, '20').find('[data-teil="zaehler"]').text()).toBe('×2')
    expect(knopf(w, '20').find('[data-teil="code-grenze"]').text()).toBe('nächster = Disq. D')
    e = tippe(e, aufbau, T5, '20')
    expect(e.disq).toEqual(['D'])
    await w.setProps({ entwurf: e })
    expect(knopf(w, '20').find('[data-teil="zaehler"]').text()).toBe('×2')
    expect(knopf(w, '20').find('[data-teil="code-grenze"]').text()).toBe('Disq. D gesetzt')
    expect(knopf(w, '20').attributes('data-naechster')).toBe('nichts')
    await w.setProps({ entwurf: zurueck(e) })
    expect(knopf(w, '20').find('[data-teil="code-grenze"]').text()).toBe('nächster = Disq. D')
    // Über DISQ gesetztes D zählt genauso.
    await w.setProps({ entwurf: tippeDisq(zurueck(e), 'D') })
    expect(knopf(w, '20').find('[data-teil="code-grenze"]').text()).toBe('Disq. D gesetzt')
  })
})
