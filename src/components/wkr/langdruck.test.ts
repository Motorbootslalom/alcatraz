import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, toHandlers } from 'vue'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import { useLangdruck } from './langdruck'

/**
 * Langes Drücken (R7-21/R8-23, 22.11.2026, WKR_ANNAHMEN LD1–LD4): Fake-Uhr statt echter Pausen – kurz zählt beim
 * Loslassen, lang nie zusätzlich als Tipp, Bewegung über 10 px und pointercancel brechen ab.
 */
function baue(opt: { langMoeglich?: boolean; gesperrt?: boolean } = {}) {
  const kurz: string[] = []
  const lang: string[] = []
  const K = defineComponent({
    setup() {
      const d = useLangdruck<string>({
        kurz: (x) => kurz.push(x),
        lang: (x) => lang.push(x),
        langMoeglich: () => opt.langMoeglich ?? true,
        gesperrt: () => !!opt.gesperrt,
      })
      // toHandlers wie v-on="…" in den Vorlagen (Ereignisnamen ohne on).
      return () => h('button', { type: 'button', 'data-langdruck': d.fuellt.value ? 'fuellt' : undefined, ...toHandlers(d.an('b1')) })
    },
  })
  const w = mount(K)
  const knopf = w.find('button')
  const p = (typ: string, x = 0, y = 0) => knopf.trigger(typ, { pointerId: 1, button: 0, clientX: x, clientY: y })
  return { w, knopf, p, kurz, lang }
}

describe('useLangdruck (LD1–LD4)', () => {
  beforeEach(() => void vi.useFakeTimers())
  afterEach(() => void vi.useRealTimers())

  it('kurz: zählt beim Loslassen, der nachlaufende click zählt nicht noch einmal', async () => {
    const { p, knopf, kurz, lang } = baue()
    await p('pointerdown')
    expect(kurz).toEqual([])
    vi.advanceTimersByTime(200)
    await p('pointerup')
    await knopf.trigger('click')
    expect(kurz).toEqual(['b1'])
    expect(lang).toEqual([])
  })

  it(`lang ab ${WKR_ANNAHMEN.langdruckMs} ms: Ring ab ${WKR_ANNAHMEN.langdruckRingMs} ms, lang einmal, kein kurz (LD2)`, async () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    const { p, knopf, kurz, lang } = baue()
    await p('pointerdown')
    vi.advanceTimersByTime(WKR_ANNAHMEN.langdruckRingMs)
    await nextTick()
    expect(knopf.attributes('data-langdruck')).toBe('fuellt')
    vi.advanceTimersByTime(WKR_ANNAHMEN.langdruckMs - WKR_ANNAHMEN.langdruckRingMs)
    await nextTick()
    expect(lang).toEqual(['b1'])
    expect(vibrate).toHaveBeenCalledWith(30)
    expect(knopf.attributes('data-langdruck')).toBeUndefined()
    await p('pointerup')
    await knopf.trigger('click')
    expect(kurz).toEqual([])
    expect(lang).toEqual(['b1'])
  })

  it('Loslassen außerhalb des Knopfs (Knopf nach dem Langdruck aus dem DOM): der Lauf endet, der nächste Druck wirkt (Prüfbefund 22.11.2026)', async () => {
    const { p, knopf, kurz, lang } = baue()
    await p('pointerdown')
    vi.advanceTimersByTime(WKR_ANNAHMEN.langdruckMs)
    expect(lang).toEqual(['b1'])
    // Das pointerup erreicht nur das Fenster (wie nach dem Aushängen des gedrückten Knopfs).
    window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1, clientX: 0, clientY: 0 }))
    expect(kurz).toEqual([])
    vi.advanceTimersByTime(2000)
    // Zweiter Langdruck löst wieder aus, ein kurzer Tipp danach zählt genau einmal.
    await p('pointerdown')
    vi.advanceTimersByTime(WKR_ANNAHMEN.langdruckMs)
    expect(lang).toEqual(['b1', 'b1'])
    window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1, clientX: 0, clientY: 0 }))
    vi.advanceTimersByTime(2000)
    await p('pointerdown')
    await p('pointerup')
    await knopf.trigger('click')
    expect(kurz).toEqual(['b1'])
  })

  it('Bewegung 12 px → weder kurz noch lang (LD3)', async () => {
    const { p, knopf, kurz, lang } = baue()
    await p('pointerdown', 0, 0)
    await p('pointermove', 12, 0)
    vi.advanceTimersByTime(WKR_ANNAHMEN.langdruckMs + 100)
    await p('pointerup', 12, 0)
    await knopf.trigger('click')
    expect(kurz).toEqual([])
    expect(lang).toEqual([])
  })

  it('Bewegung bis 10 px bleibt ein Tipp', async () => {
    const { p, kurz } = baue()
    await p('pointerdown', 0, 0)
    await p('pointermove', 6, 8)
    await p('pointerup', 6, 8)
    expect(kurz).toEqual(['b1'])
  })

  it('pointercancel → weder kurz noch lang (LD3)', async () => {
    const { p, knopf, kurz, lang } = baue()
    await p('pointerdown')
    await p('pointercancel')
    vi.advanceTimersByTime(WKR_ANNAHMEN.langdruckMs + 100)
    await knopf.trigger('click')
    expect(kurz).toEqual([])
    expect(lang).toEqual([])
  })

  it('Tastatur/click ohne Berührung = kurzer Tipp; Kontextmenü unterdrückt', async () => {
    const { w, knopf, kurz } = baue()
    await knopf.trigger('click')
    expect(kurz).toEqual(['b1'])
    const ev = new Event('contextmenu', { cancelable: true })
    w.find('button').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('ohne Langdruck-Möglichkeit (Boje ohne Buchstaben) zählt auch ein langer Druck als Tipp', async () => {
    const { p, kurz, lang } = baue({ langMoeglich: false })
    await p('pointerdown')
    vi.advanceTimersByTime(WKR_ANNAHMEN.langdruckMs * 2)
    await p('pointerup')
    expect(kurz).toEqual(['b1'])
    expect(lang).toEqual([])
  })

  it('gesperrt (LD4): weder kurz noch lang', async () => {
    const { p, knopf, kurz, lang } = baue({ gesperrt: true })
    await p('pointerdown')
    vi.advanceTimersByTime(WKR_ANNAHMEN.langdruckMs + 100)
    await p('pointerup')
    await knopf.trigger('click')
    expect(kurz).toEqual([])
    expect(lang).toEqual([])
  })
})
