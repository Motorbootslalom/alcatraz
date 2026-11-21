import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { AUFBAU, setzeSchrittweise, useSchrittweise, type Aufbau } from './aufbau'

/** Hängt useSchrittweise in eine Komponente, die je Eintrag ein <i> zeichnet. */
function baue(liste: Ref<string[]>) {
  let aufbau!: Aufbau<string>
  const wrapper = mount(
    defineComponent({
      setup() {
        aufbau = useSchrittweise(liste, (x) => x)
        return () => h('div', aufbau.sichtbar.value.map((x) => h('i', { key: x }, x)))
      },
    }),
  )
  return { wrapper, aufbau }
}
const eintraege = (n: number, vor = 'b') => Array.from({ length: n }, (_, i) => `${vor}${i + 1}`)

describe('lib/aufbau useSchrittweise', () => {
  const vorgabe = { ...AUFBAU }
  beforeEach(() => {
    setzeSchrittweise(true)
    vi.useFakeTimers()
  })
  afterEach(() => {
    Object.assign(AUFBAU, vorgabe)
    vi.useRealTimers()
  })

  it('wenige Einträge stehen sofort – keine Anzeige, nichts blitzt', async () => {
    const { wrapper, aufbau } = baue(ref(eintraege(AUFBAU.ersterSchritt)))
    expect(wrapper.findAll('i')).toHaveLength(AUFBAU.ersterSchritt)
    expect(aufbau.fertig.value).toBe(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(aufbau.zeigen.value).toBe(false)
    wrapper.unmount()
  })

  it('ein schneller Aufbau (unter anzeigeAbMs) zeigt keine Anzeige', async () => {
    const { wrapper, aufbau } = baue(ref(eintraege(30)))
    const gezeigt: boolean[] = []
    for (let i = 0; i < 20 && !aufbau.fertig.value; i++) {
      await vi.advanceTimersByTimeAsync(5)
      gezeigt.push(aufbau.zeigen.value)
    }
    expect(aufbau.fertig.value).toBe(true)
    expect(gezeigt).not.toContain(true)
    await vi.advanceTimersByTimeAsync(1000)
    expect(aufbau.zeigen.value).toBe(false)
    wrapper.unmount()
  })

  it('zählt schrittweise hoch, zeigt sich nach anzeigeAbMs und endet mit allen Einträgen, keiner doppelt', async () => {
    AUFBAU.hoechstens = 1
    const alle = eintraege(40)
    const { wrapper, aufbau } = baue(ref(alle))
    const staende: number[] = [aufbau.fertigAnzahl.value]
    expect(staende[0]).toBe(AUFBAU.ersterSchritt)
    expect(aufbau.gesamt.value).toBe(40)
    expect(aufbau.naechster.value).toBe(`b${AUFBAU.ersterSchritt + 1}`)
    let gezeigt = false
    for (let i = 0; i < 200 && !aufbau.fertig.value; i++) {
      await vi.advanceTimersByTimeAsync(20)
      staende.push(aufbau.fertigAnzahl.value)
      gezeigt ||= aufbau.zeigen.value
    }
    expect(aufbau.fertig.value).toBe(true)
    expect(gezeigt).toBe(true)
    // Nie rückwärts, viele Zwischenstände (ein Eintrag je Schritt), am Ende alle.
    for (let i = 1; i < staende.length; i++) expect(staende[i] - staende[i - 1]).toBeGreaterThanOrEqual(0)
    expect(new Set(staende).size).toBeGreaterThan(20)
    expect(staende.at(-1)).toBe(40)
    await nextTick()
    expect(wrapper.findAll('i').map((x) => x.text())).toEqual(alle)
    // Die Anzeige bleibt nach dem Ende höchstens bis zur Mindestdauer stehen (21.11.2026), dann geht sie.
    await vi.advanceTimersByTimeAsync(AUFBAU.mindestensMs)
    expect(aufbau.zeigen.value).toBe(false)
    expect(aufbau.naechster.value).toBeUndefined()
    wrapper.unmount()
  })

  it('beim Wechsel bleibt stehen, was schon steht; Neues kommt dazu, Weggefallenes geht', async () => {
    const liste = ref(eintraege(5))
    const { wrapper, aufbau } = baue(liste)
    await vi.advanceTimersByTimeAsync(500)
    expect(aufbau.fertig.value).toBe(true)
    const erstes = wrapper.find('i').element
    liste.value = ['b1', 'b3', ...eintraege(4, 'n')]
    await nextTick()
    // b1 und b3 standen schon – nur die neuen fehlen noch (im ersten Schritt kommen ersterSchritt davon).
    expect(aufbau.fertig.value).toBe(false)
    expect(aufbau.sichtbar.value.slice(0, 2)).toEqual(['b1', 'b3'])
    await vi.advanceTimersByTimeAsync(500)
    expect(wrapper.findAll('i').map((x) => x.text())).toEqual(['b1', 'b3', 'n1', 'n2', 'n3', 'n4'])
    // Dasselbe Element: nicht neu eingehängt.
    expect(wrapper.find('i').element).toBe(erstes)
    wrapper.unmount()
  })

  it('einmal gezeigt, bleibt die Anzeige mindestens mindestensMs stehen – auch wenn der Aufbau gleich danach endet', async () => {
    AUFBAU.hoechstens = 1
    AUFBAU.anzeigeAbMs = 0
    AUFBAU.mindestensMs = 300
    const { wrapper, aufbau } = baue(ref(eintraege(AUFBAU.ersterSchritt + 2)))
    let endeBei = -1
    for (let t = 0; t < 1000; t += 10) {
      await vi.advanceTimersByTimeAsync(10)
      if (aufbau.fertig.value && endeBei < 0) {
        endeBei = t
        expect(aufbau.zeigen.value).toBe(true)
      }
      if (endeBei >= 0 && !aufbau.zeigen.value) {
        expect(t).toBeGreaterThanOrEqual(AUFBAU.mindestensMs - 20)
        break
      }
    }
    expect(endeBei).toBeGreaterThanOrEqual(0)
    expect(endeBei).toBeLessThan(AUFBAU.mindestensMs)
    expect(aufbau.zeigen.value).toBe(false)
    wrapper.unmount()
  })

  it('ausgeschaltet (Tests) steht alles sofort', () => {
    setzeSchrittweise(false)
    const { wrapper, aufbau } = baue(ref(eintraege(50)))
    expect(wrapper.findAll('i')).toHaveLength(50)
    expect(aufbau.fertig.value).toBe(true)
    wrapper.unmount()
  })

  it('aushängen mitten im Aufbau hält ihn an', async () => {
    AUFBAU.hoechstens = 1
    const { wrapper, aufbau } = baue(ref(eintraege(20)))
    await vi.advanceTimersByTimeAsync(40)
    wrapper.unmount()
    const stand = aufbau.fertigAnzahl.value
    await vi.advanceTimersByTimeAsync(1000)
    expect(aufbau.fertigAnzahl.value).toBe(stand)
    expect(stand).toBeLessThan(20)
  })
})
