import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WkrKnoepfe from './WkrKnoepfe.vue'
import { leererEntwurf, type MaskenTeil } from '../../wkr/maske'

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
      { code: '3', text: 'erneute Stegberührung', punkte: 5 },
      { code: '5', text: 'Durchreißen der Schaltung / erst ab Klasse 4', punkte: 5, aus: true },
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
