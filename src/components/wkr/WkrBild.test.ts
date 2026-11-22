import { describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { configFor } from '../../config/konfig'
import { PARCOURS_HERKUNFT, parcoursSvg } from '../../lib/parcoursQuelle'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import { bildTreffer } from '../../wkr/bild'
import { listenKennung } from '../../wkr/liste'
import { leererEntwurf, maskeFuer, tippeBoje, tippeBojenDisq, type Entwurf, type MaskenBoje } from '../../wkr/maske'
import { maskenJeKlasse, type ListenSicht } from '../../wkr/sicht'
import type { ClassId } from '../../types'
import WkrBild from './WkrBild.vue'
import WkrMitte from './WkrMitte.vue'

/**
 * Maske „Bild“ (W5.2, Plan docs/plan-wkr-w5.md §5.2, 22.11.2026): Im Test-DOM gibt es keine Lage der Bojen – WkrBild
 * zeigt dieselben Treffer als Knopfliste (BD6). Geprüft wird die Zuordnung über `data-feld`, nicht Koordinaten:
 * Umschalter Hin/Rück/Rück 2 (BD5), Sprung auf den Rückweg nach Tor 5 (BD4), Stand „✔ 5“, „2×“, „5 G“ (BZ1) und Disq.
 * über „Disq. an Boje …“ + Tipp (BD7).
 */
const DM = configFor({ regelwerk: 'dm-2026' })
const KLASSEN: ClassId[] = ['1', '2', '3', '4', '5', '6', '7', 'E']

function sicht(typeId: string): ListenSicht {
  return { liste: listenKennung({ bereich: 'p1', typeId, racecourse: null }), klassen: maskenJeKlasse(DM, DM, typeId, KLASSEN, false, 'alcatraz') } as ListenSicht
}

/** Mount mit Entwurf, der den Ereignissen folgt (wie WkrMaske). */
function baue(typeId: string, klasse: ClassId) {
  const s = sicht(typeId)
  const aufbau = maskeFuer(s, klasse)!
  const zuordnung = bildTreffer(s, klasse, parcoursSvg)!
  let entwurf: Entwurf = leererEntwurf()
  const w: VueWrapper = mount(WkrBild, {
    props: {
      aufbau,
      entwurf,
      zuordnung,
      klasse: aufbau.titel,
      startNr: '23',
      weg: 'hin',
      onBoje: (b: MaskenBoje) => {
        entwurf = tippeBoje(entwurf, b)
        void w.setProps({ entwurf })
      },
      onBojeDisq: (b: MaskenBoje, c: string | null) => {
        entwurf = tippeBojenDisq(entwurf, b, c)
        void w.setProps({ entwurf })
      },
    },
  })
  return { w, aufbau, zuordnung, entwurf: () => entwurf }
}

const treffer = (w: VueWrapper, id: string) => w.find(`[data-action="bild-boje"][data-bild-id="${id}"]`)

describe('WkrBild (W5.2)', () => {
  it('ohne Lage: Knopfliste mit den eigenen Bojen, fremde fehlen; Tipp = dieselbe Boje wie in den Knöpfen', async () => {
    const { w, entwurf } = baue('gate135', '7')
    expect(w.find('[data-teil="bild"]').attributes('data-art')).toBe('svg')
    expect(w.find('[data-teil="bild-ersatz"]').exists()).toBe(true)
    // Die Zeichnung steht inline, mit eigenem Präfix an jeder ID.
    expect(w.find('.wkr-bild-svg').html()).toMatch(/id="wb[a-z0-9]+-Tor1_innen"/)
    expect(treffer(w, 'Tor2_innen').exists()).toBe(false)
    expect(treffer(w, 'Tor1_innen').attributes('data-feld')).toBe('t1a|hin seiteB')
    await treffer(w, 'Tor1_innen').trigger('click')
    await nextTick()
    expect(entwurf().bojen['t1a|hin seiteB']).toBe(1)
    expect(treffer(w, 'Tor1_innen').find('[data-teil="bild-stand"]').text()).toBe('✔ 5')
    // Namensnennung der bearbeiteten Zeichnung (Prüfbefund 22.11.2026): Urheber, „bearbeitet“, Lizenz mit Link.
    const nachweis = w.find('[data-teil="bild-nachweis"]')
    expect(nachweis.text()).toContain(PARCOURS_HERKUNFT.urheber)
    expect(nachweis.text()).toContain('bearbeitet')
    expect(nachweis.find('a').attributes('href')).toBe(PARCOURS_HERKUNFT.lizenzUrl)
    expect(nachweis.find('a').text()).toContain(PARCOURS_HERKUNFT.lizenz)
  })

  it('Umschalter Hin / Rück / Rück 2 (BD5): Tor 1 ist je Seite eine andere Boje', async () => {
    const { w } = baue('gate135', '7')
    const wege = w.findAll('[data-action="bild-weg"]').map((b) => b.attributes('data-weg'))
    expect(wege).toEqual(['hin', 'rueck', 'rueck2'])
    await w.find('[data-action="bild-weg"][data-weg="rueck"]').trigger('click')
    expect(treffer(w, 'Tor1_innen').attributes('data-feld')).toBe('t1b|rueck seiteB')
    expect(w.emitted('weg')!.at(-1)).toEqual(['rueck'])
    await w.find('[data-action="bild-weg"][data-weg="rueck2"]').trigger('click')
    expect(treffer(w, 'Tor1_innen').attributes('data-feld')).toBe('t1c|rueck seiteB')
    // WkrMaske kennt nur Hin/Rück – Rück 2 meldet „rueck“.
    expect(w.emitted('weg')!.at(-1)).toEqual(['rueck'])
  })

  it('BD4: erster Tipp an Tor 5 auf dem Hinweg springt auf den Rückweg; Zähler „n×“', async () => {
    const { w, entwurf } = baue('gate135', '7')
    await treffer(w, 'Tor5_unten').trigger('click')
    await nextTick()
    expect(entwurf().bojen['t5|hin seiteA']).toBe(1)
    expect(w.find('[data-teil="bild"]').attributes('data-weg')).toBe('rueck')
    expect(treffer(w, 'Tor5_unten').attributes('data-feld')).toBe('t5|rueck seiteA')
    await treffer(w, 'Tor5_unten').trigger('click')
    await treffer(w, 'Tor5_unten').trigger('click')
    await nextTick()
    expect(entwurf().bojen['t5|rueck seiteA']).toBe(2)
    expect(treffer(w, 'Tor5_unten').find('[data-teil="bild-stand"]').text()).toBe('2×')
    // Zahl am Reiter: Hin 1, Rück 2.
    expect(w.find('[data-action="bild-weg"][data-weg="hin"]').attributes('data-anzahl')).toBe('1')
    expect(w.find('[data-action="bild-weg"][data-weg="rueck"]').attributes('data-anzahl')).toBe('2')
  })

  it('BD7: „Disq. an Boje …“, dann Tipp auf die Boje, dann der Buchstabe (zweimal) → „5 G“', async () => {
    const { w, entwurf } = baue('gate135', '3')
    await treffer(w, 'Tor3_innen').trigger('click')
    await w.find('[data-action="bild-disq-modus"]').trigger('click')
    expect(w.find('[data-teil="bild-disq-tippe"]').text()).toContain('23')
    await treffer(w, 'Tor3_innen').trigger('click')
    // Kein Tipp gezählt – die Boje wurde nur gewählt.
    expect(entwurf().bojen['t3a|hin seiteB']).toBe(1)
    const code = w.find('[data-action="disq-code"]').attributes('data-code')!
    await w.find(`[data-action="disq-code"][data-code="${code}"]`).trigger('click')
    await w.find(`[data-action="disq-code"][data-code="${code}"]`).trigger('click')
    await nextTick()
    expect(entwurf().bojenDisq['t3a|hin seiteB']).toBe(code)
    expect(treffer(w, 'Tor3_innen').find('[data-teil="bild-stand"]').text()).toBe(`5 ${code}`)
    expect(WKR_ANNAHMEN.bildDisqUeberKnopf).toBe(true)
  })

  it('Parallelslalom: Schema des Racecourse, B gespiegelt', () => {
    const UIM = configFor({ regelwerk: 'uim-2026' })
    for (const rc of ['A', 'B'] as const) {
      const s = { liste: listenKennung({ bereich: 'parallel', typeId: 'parallelparcours', racecourse: rc }), klassen: maskenJeKlasse(UIM, UIM, 'parallelparcours', KLASSEN, false) } as ListenSicht
      const k = (Object.keys(s.klassen) as ClassId[]).find((x) => maskeFuer(s, x)?.art === 'bojen')!
      const aufbau = maskeFuer(s, k)!
      const w = mount(WkrBild, { props: { aufbau, entwurf: leererEntwurf(), zuordnung: bildTreffer(s, k, parcoursSvg)!, klasse: aufbau.titel, startNr: '5', weg: 'hin' } })
      expect(w.find('[data-teil="bild-schema"]').attributes('data-racecourse')).toBe(rc)
      expect(w.find('figcaption').text()).toBe(`Racecourse ${rc}`)
      expect(treffer(w, 'P_b5').exists()).toBe(true)
      // Das Schema ist eigene Zeichnung – keine fremde Namensnennung.
      expect(w.find('[data-teil="bild-nachweis"]').exists()).toBe(false)
    }
  })

  it('Rück 2 bleibt nach der Disq.-Wahl im Fuß stehen (Prüfbefund 22.11.2026: WkrMitte merkt es je Start)', async () => {
    const s = sicht('gate135')
    const aufbau = maskeFuer(s, '7')!
    const props = {
      art: 'bojen' as const,
      schluessel: 'start-23',
      aufbau,
      entwurf: leererEntwurf(),
      startNr: '23',
      disqOffen: false,
      disqCodes: [],
      gesperrt: false,
      weg: 'hin' as const,
      bojenFolge: 'gedreht' as const,
      sichtbareTeile: [],
      maske: 'bild' as const,
      bild: bildTreffer(s, '7', parcoursSvg)!,
      klasse: aufbau.titel,
      pad: true,
    }
    const w = mount(WkrMitte, { props: { ...props, onWeg: (x: 'hin' | 'rueck') => void w.setProps({ weg: x }) } })
    await w.find('[data-action="bild-weg"][data-weg="rueck2"]').trigger('click')
    await nextTick()
    expect(w.find('[data-teil="bild"]').attributes('data-weg')).toBe('rueck2')
    // DISQ im Fuß: WkrDisqOrt statt des Bilds, danach zurück – das Bild wird neu gebaut.
    await w.setProps({ disqOffen: true })
    expect(w.find('[data-teil="bild"]').exists()).toBe(false)
    await w.setProps({ disqOffen: false })
    expect(w.find('[data-teil="bild"]').attributes('data-weg')).toBe('rueck2')
    expect(treffer(w, 'Tor1_innen').attributes('data-feld')).toBe('t1c|rueck seiteB')
    // Ein anderer Start beginnt nicht auf Rück 2, auch wenn WkrMaske „rueck“ meldet.
    await w.setProps({ schluessel: 'start-24', weg: 'rueck' })
    expect(w.find('[data-teil="bild"]').attributes('data-weg')).toBe('rueck')
    // Zurück auf Hin vergisst Rück 2.
    await w.setProps({ schluessel: 'start-23' })
    await w.find('[data-action="bild-weg"][data-weg="hin"]').trigger('click')
    await w.setProps({ disqOffen: true })
    await w.setProps({ disqOffen: false, weg: 'rueck' })
    expect(w.find('[data-teil="bild"]').attributes('data-weg')).toBe('rueck')
  })

  it('Fläche neu nach „Disq. an Boje …“: der ResizeObserver zieht auf das neue Element um (Prüfbefund 22.11.2026)', async () => {
    const beobachtet: Element[] = []
    const alt = globalThis.ResizeObserver
    class Spion {
      observe(el: Element) {
        beobachtet.push(el)
      }
      unobserve(el: Element) {
        const i = beobachtet.indexOf(el)
        if (i >= 0) beobachtet.splice(i, 1)
      }
      disconnect() {
        beobachtet.length = 0
      }
    }
    globalThis.ResizeObserver = Spion as unknown as typeof ResizeObserver
    try {
      const { w } = baue('gate135', '3')
      await nextTick()
      const erste = w.find('[data-teil="bild-flaeche"]').element
      expect(beobachtet).toEqual([erste])
      await w.find('[data-action="bild-disq-modus"]').trigger('click')
      await treffer(w, 'Tor3_innen').trigger('click')
      expect(w.find('[data-teil="bild-flaeche"]').exists()).toBe(false)
      await w.find('[data-action="bild-disq-zurueck"]').trigger('click')
      await nextTick()
      const zweite = w.find('[data-teil="bild-flaeche"]').element
      expect(zweite).not.toBe(erste)
      expect(beobachtet).toEqual([zweite])
    } finally {
      globalThis.ResizeObserver = alt
    }
  })
})
