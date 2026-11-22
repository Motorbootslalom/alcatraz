import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WkrRuhe from './WkrRuhe.vue'

/** „Neu verbinden“ nach der Karenz (Nutzer 21.11.2026, W3-24, WKR_ANNAHMEN GF6): nur in `warte` und nur auf Wunsch. */
describe('WkrRuhe – warte (W3-24)', () => {
  it('ohne `neuVerbinden` nur der Satz; mit Knopf, der das Ereignis meldet', async () => {
    const ohne = mount(WkrRuhe, { props: { art: 'warte' } })
    expect(ohne.find('[data-action="neu-verbinden"]').exists()).toBe(false)
    const mit = mount(WkrRuhe, { props: { art: 'warte', neuVerbinden: true } })
    expect(mit.find('[data-teil="warte-lange"]').text()).toContain('Neu verbinden')
    await mit.find('[data-action="neu-verbinden"]').trigger('click')
    expect(mit.emitted('neuVerbinden')).toHaveLength(1)
    // Andere Ruhe-Zustände kennen ihn nicht.
    expect(mount(WkrRuhe, { props: { art: 'leer', neuVerbinden: true } }).find('[data-action="neu-verbinden"]').exists()).toBe(false)
  })
})
