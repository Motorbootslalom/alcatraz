import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import { useFenster } from './systemModus'

/**
 * useFenster und die Bildschirmtastatur (Prüfbefund 22.11.2026, WKR_ANNAHMEN.tastaturAendertNichts): Nur die Höhe
 * ändert sich, während ein Eingabefeld den Fokus hat → die Anordnung bleibt; ohne Fokus oder mit neuer Breite zählt
 * das Fenster wie bisher. Ohne feste Pausen: Größe über happy-dom setViewport + `resize`.
 */
const wrappers: VueWrapper[] = []
afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
})

function fenster(breite: number, hoehe: number): void {
  ;(window as unknown as { happyDOM: { setViewport: (v: { width: number; height: number }) => void } }).happyDOM.setViewport({ width: breite, height: hoehe })
  window.dispatchEvent(new Event('resize'))
}

describe('useFenster (PD1, Bildschirmtastatur)', () => {
  it('nur die Höhe ändert sich mit Fokus in einem Textfeld → alte Größe; ohne Fokus oder beim Drehen die neue', async () => {
    expect(WKR_ANNAHMEN.tastaturAendertNichts).toBe(true)
    fenster(800, 1280)
    let groesse: ReturnType<typeof useFenster> | null = null
    const Teil = defineComponent({
      setup() {
        groesse = useFenster()
        return () => h('input', { type: 'text' })
      },
    })
    const w = mount(Teil, { attachTo: document.body })
    wrappers.push(w)
    expect(groesse!.value).toEqual({ breite: 800, hoehe: 1280 })
    ;(w.element as HTMLInputElement).focus()
    fenster(800, 700)
    await nextTick()
    expect(groesse!.value).toEqual({ breite: 800, hoehe: 1280 })
    // Tastatur zu: wieder dieselbe Höhe – nichts ändert sich.
    fenster(800, 1280)
    expect(groesse!.value).toEqual({ breite: 800, hoehe: 1280 })
    // Drehen ändert die Breite – zählt auch mit Fokus.
    fenster(1280, 800)
    expect(groesse!.value).toEqual({ breite: 1280, hoehe: 800 })
    // Ohne Fokus zählt auch eine reine Höhenänderung.
    ;(w.element as HTMLInputElement).blur()
    fenster(1280, 600)
    expect(groesse!.value).toEqual({ breite: 1280, hoehe: 600 })
  })
})
