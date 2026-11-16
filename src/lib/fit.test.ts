import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, withDirectives } from 'vue'
import { mount } from '@vue/test-utils'
import { FIT_ZEILE, fitBlock, fitLine, fitZeilen, vFit, vFitBlock } from './fit'

// Anpassen der Anzeigetafel: happy-dom misst nicht – Breite und Höhe kommen hier aus Gettern, die wie ein
// Browser auf den Maßstab reagieren (`--fit-scale`, `--block-scale`).

const massstab = (el: HTMLElement, name: string) => Number(el.style.getPropertyValue(name) || '1')

/** Eine Zeile: verfügbare Breite fest, benötigte Breite = `breite(Maßstab)`. */
function zeile(verfuegbar: number, breite: (m: number) => number, el: HTMLElement = document.createElement('div')): HTMLElement {
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => verfuegbar })
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => breite(massstab(el, '--fit-scale')) })
  return el
}

/** Ein Block in einem Bereich mit Höhe und Innenabstand; Höhe des Blocks = `hoehe(Maßstab)`. */
function block(bereichHoehe: number, innen: number, hoehe: (m: number) => number): { bereich: HTMLElement; el: HTMLElement } {
  const bereich = document.createElement('section')
  bereich.style.paddingTop = `${innen}px`
  bereich.style.paddingBottom = `${innen}px`
  Object.defineProperty(bereich, 'clientHeight', { configurable: true, get: () => bereichHoehe })
  const el = document.createElement('div')
  Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => hoehe(massstab(el, '--block-scale')) })
  bereich.appendChild(el)
  document.body.appendChild(bereich)
  return { bereich, el }
}

/**
 * Ein umbrechender Hinweis: Breite 100, Text bei Maßstab m `laenge · m` breit, eine Zeile `20 · m` hoch.
 * Ohne Umbruch (white-space: nowrap) eine Zeile; sonst so viele, wie nötig – Wörter füllen eine Zeile nur zu 95 %.
 */
function hinweis(laenge: number, el: HTMLElement = document.createElement('div')): HTMLElement {
  const m = () => massstab(el, '--fit-scale')
  const einzeilig = () => el.style.getPropertyValue('white-space') === 'nowrap'
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 100 })
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => (einzeilig() ? laenge * m() : 100) })
  Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => (einzeilig() ? 1 : Math.max(1, Math.ceil((laenge * m()) / 95))) * 20 * m() })
  return el
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('fitLine: eine Zeile schrumpft, bis sie in ihre Breite passt', () => {
  it('passt sie, bleibt sie, wie sie ist – ein alter Maßstab entfällt', () => {
    const el = zeile(100, (m) => 80 * m)
    el.style.setProperty('--fit-scale', '0.5')
    fitLine(el)
    expect(el.style.getPropertyValue('--fit-scale')).toBe('')
  })

  it('zu breit: verkleinert im Verhältnis der Breiten', () => {
    const el = zeile(100, (m) => 200 * m)
    fitLine(el)
    expect(massstab(el, '--fit-scale')).toBeCloseTo(0.5)
    expect(el.scrollWidth).toBeLessThanOrEqual(el.clientWidth)
  })

  it('wächst die Breite nicht genau mit (Zeichenabstände), fängt ein zweiter Durchgang den Rest ab', () => {
    const el = zeile(100, (m) => 200 * m + 10)
    fitLine(el)
    // Der erste Durchgang allein ließe gut 5 px überstehen; der zweite holt bis auf einen Bruchteil auf.
    expect(massstab(el, '--fit-scale')).toBeLessThan(100 / 210)
    expect(el.scrollWidth - el.clientWidth).toBeLessThan(1)
  })

  it('ohne Breite (verborgen) tut sie nichts', () => {
    const el = zeile(0, () => 50)
    fitLine(el)
    expect(el.style.getPropertyValue('--fit-scale')).toBe('')
  })
})

describe('fitZeilen: ein Hinweis schrumpft selbst, bis er höchstens n Zeilen hat (Prüfung E1)', () => {
  it('kurz genug: bleibt, wie er ist – ein alter Maßstab entfällt', () => {
    const el = hinweis(150)
    el.style.setProperty('--fit-scale', '0.4')
    fitZeilen(el, 2)
    expect(el.style.getPropertyValue('--fit-scale')).toBe('')
    expect(el.style.getPropertyValue('white-space')).toBe('')
  })

  it('zu lang: höchstens zwei Zeilen, kleiner nur so weit wie nötig', () => {
    const el = hinweis(1000)
    fitZeilen(el, 2)
    const m = massstab(el, '--fit-scale')
    expect(el.offsetHeight).toBeLessThanOrEqual(2 * 20 * m + 1)
    // Das reine Verhältnis der Breiten (0,2) mit etwas Luft – nicht viel kleiner.
    expect(m).toBeGreaterThan(0.15)
    expect(m).toBeLessThan(0.2)
    expect(el.style.getPropertyValue('white-space')).toBe('')
  })

  it('ohne Breite (verborgen) tut er nichts', () => {
    const el = hinweis(1000)
    Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 0 })
    fitZeilen(el, 2)
    expect(el.style.getPropertyValue('--fit-scale')).toBe('')
  })
})

describe('fitBlock: ein Block schrumpft gemeinsam, bis er in die Höhe seines Bereichs passt', () => {
  it('der Innenabstand des Bereichs zählt nicht als Platz', () => {
    const { el } = block(300, 10, (m) => 560 * m)
    fitBlock(el)
    expect(massstab(el, '--block-scale')).toBeCloseTo(280 / 560)
    expect(el.offsetHeight).toBeCloseTo(280)
  })

  it('bricht der Text beim Verkleinern anders um, wird nachjustiert', () => {
    const { el } = block(200, 0, (m) => 400 * m + 30)
    fitBlock(el)
    // Ohne Nachjustieren stünden 15 px über; nach drei Runden weniger als ein Pixel.
    expect(el.offsetHeight - 200).toBeLessThan(1)
    expect(massstab(el, '--block-scale')).toBeLessThan(200 / 430)
  })

  it('passt er, gibt es keinen Maßstab; danach werden die Zeilen darin neu angepasst', () => {
    const { el } = block(300, 0, () => 100)
    el.style.setProperty('--block-scale', '0.3')
    const innen = zeile(100, (m) => 150 * m)
    innen.className = FIT_ZEILE
    const fremd = zeile(100, (m) => 150 * m)
    el.append(innen, fremd)
    fitBlock(el)
    expect(el.style.getPropertyValue('--block-scale')).toBe('')
    expect(massstab(innen, '--fit-scale')).toBeCloseTo(100 / 150)
    // Nur die Zeilen der Anzeigetafel, nicht jedes Element im Block.
    expect(fremd.style.getPropertyValue('--fit-scale')).toBe('')
  })

  it('ein Hinweis mit `data-fit-zeilen` wird nach seinen Zeilen angepasst, nicht nach der Breite', () => {
    const { el } = block(300, 0, () => 100)
    const h = hinweis(1000)
    h.className = FIT_ZEILE
    h.dataset.fitZeilen = '2'
    el.append(h)
    fitBlock(el)
    expect(massstab(h, '--fit-scale')).toBeGreaterThan(0.15)
    expect(h.offsetHeight).toBeLessThanOrEqual(2 * 20 * massstab(h, '--fit-scale') + 1)
    // Gemessen wird ohne Wachsen; danach darf der Block den Bereich wieder füllen.
    expect(el.style.getPropertyValue('flex-grow')).toBe('')
  })

  it('ohne Bereich tut er nichts', () => {
    const el = document.createElement('div')
    expect(() => fitBlock(el)).not.toThrow()
    expect(el.style.getPropertyValue('--block-scale')).toBe('')
  })
})

describe('v-fit und v-fit-block: beim Einhängen, nach jeder Änderung und bei neuer Fenstergröße', () => {
  it('v-fit passt nach `resize` neu an; nach dem Aushängen nicht mehr', async () => {
    let breite = 80
    const Zeile = defineComponent({ render: () => withDirectives(h('div', { class: FIT_ZEILE }, 'Vor1 Nach1'), [[vFit]]) })
    const w = mount(Zeile, { attachTo: document.body })
    const el = zeile(100, (m) => breite * m, w.element as HTMLElement)
    window.dispatchEvent(new Event('resize'))
    expect(el.style.getPropertyValue('--fit-scale')).toBe('')
    breite = 400
    window.dispatchEvent(new Event('resize'))
    expect(massstab(el, '--fit-scale')).toBeCloseTo(0.25)
    w.unmount()
    el.style.removeProperty('--fit-scale')
    window.dispatchEvent(new Event('resize'))
    expect(el.style.getPropertyValue('--fit-scale')).toBe('')
  })

  it('v-fit-block passt nach jeder Änderung des Inhalts an (`updated`)', async () => {
    const Bereich = defineComponent({
      props: { text: { type: String, required: true } },
      render() {
        return h('section', [withDirectives(h('div', this.text), [[vFitBlock]])])
      },
    })
    const w = mount(Bereich, { props: { text: 'Musterclub' }, attachTo: document.body })
    const bereich = w.element as HTMLElement
    Object.defineProperty(bereich, 'clientHeight', { configurable: true, get: () => 100 })
    const el = bereich.firstElementChild as HTMLElement
    let hoehe = 50
    Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => hoehe * massstab(el, '--block-scale') })
    hoehe = 400
    await w.setProps({ text: 'Musterclub mit sehr langer Meldung' })
    expect(massstab(el, '--block-scale')).toBeCloseTo(0.25)
    w.unmount()
  })
})
