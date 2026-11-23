import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { configFor } from '../../config/konfig'
import { listenKennung } from '../../wkr/liste'
import { bojenVon, leererEntwurf, maskeFuer, tippeBoje, tippeBojenDisq, zellenAus, type Entwurf, type MaskenBoje } from '../../wkr/maske'
import { maskenJeKlasse, type ListenSicht } from '../../wkr/sicht'
import type { ClassId } from '../../types'
import WkrDisqOrt from './WkrDisqOrt.vue'

/**
 * Disq. an einer Boje als Mehrfachwahl (R7-14, 22.11.2026, WKR_ANNAHMEN BZ7, noch zu bestätigen): Jeder Buchstabe
 * schaltet sich an bzw. aus (zweiter Tipp setzt, H1), die Wahl bleibt offen, „Fertig“ schließt; die Zelle trägt die
 * Buchstaben in Katalogfolge („5, J, D“, BZ6).
 */
const DM = configFor({ regelwerk: 'dm-2026' })
const KLASSEN: ClassId[] = ['1', '2', '3', '4', '5', '6', '7', 'E']

function baue() {
  const s = { liste: listenKennung({ bereich: 'p1', typeId: 'gate135', racecourse: null }), klassen: maskenJeKlasse(DM, DM, 'gate135', KLASSEN, false, 'alcatraz') } as ListenSicht
  const aufbau = maskeFuer(s, '7')!
  const boje = bojenVon(aufbau).find((b) => b.feld === 't3a|hin seiteB')!
  let entwurf: Entwurf = tippeBoje(leererEntwurf(), boje)
  let fertig = 0
  const w: VueWrapper = mount(WkrDisqOrt, {
    props: {
      aufbau,
      entwurf,
      codes: [],
      startNr: '23',
      onBojeDisq: (b: MaskenBoje, c: string | null) => {
        entwurf = tippeBojenDisq(entwurf, b, c)
        void w.setProps({ entwurf })
      },
      onFertig: () => (fertig += 1),
    },
  })
  return { w, aufbau, boje, entwurf: () => entwurf, fertig: () => fertig }
}

const code = (w: VueWrapper, c: string) => w.find(`[data-action="disq-code"][data-code="${c}"]`)

describe('WkrDisqOrt – mehrere Disq. an einer Boje (BZ7)', () => {
  it('zwei Buchstaben nacheinander, die Wahl bleibt offen; „Fertig“ schließt; Zelle und Knopf in Katalogfolge', async () => {
    const { w, aufbau, boje, entwurf, fertig } = baue()
    const [x, y] = boje.disq.map((d) => d.code)
    await w.find(`[data-action="disq-ort"][data-feld="${boje.feld}"]`).trigger('click')
    expect(w.find('[data-teil="disq-ort"]').attributes('data-schritt')).toBe('boje')
    expect(w.find('[data-action="disq-ort-fertig"]').text()).toBe('Fertig')
    // In umgekehrter Katalogfolge getippt, jeweils zweimal (H1).
    for (const c of [y, x]) {
      await code(w, c).trigger('click')
      await code(w, c).trigger('click')
      await nextTick()
    }
    expect(entwurf().bojenDisq[boje.feld]).toEqual([y, x])
    expect(w.find('[data-teil="disq-ort"]').attributes('data-schritt')).toBe('boje')
    expect(code(w, x).attributes('data-stand')).toBe('gesetzt')
    expect(code(w, y).attributes('data-stand')).toBe('gesetzt')
    expect(w.find('[data-action="disq-ort-fertig"]').text()).toBe(`Fertig · ${x}, ${y}`)
    expect(fertig()).toBe(0)
    // Ein Tipp auf einen gesetzten nimmt nur ihn heraus.
    await code(w, y).trigger('click')
    await nextTick()
    expect(entwurf().bojenDisq[boje.feld]).toEqual([x])
    await code(w, y).trigger('click')
    await code(w, y).trigger('click')
    await nextTick()
    await w.find('[data-action="disq-ort-fertig"]').trigger('click')
    expect(fertig()).toBe(1)
    expect(w.find('[data-teil="disq-ort"]').attributes('data-schritt')).toBe('wo')
    const knopf = w.find(`[data-action="disq-ort"][data-feld="${boje.feld}"]`)
    expect(knopf.attributes('data-disq')).toBe(`${x}, ${y}`)
    expect(knopf.find('.wkr-bojen-disq-stand').text()).toBe(`Disq. ${x}, ${y}`)
    expect(zellenAus(entwurf(), aufbau)[boje.feld]).toBe(`5, ${x}, ${y}`)
  })
})
