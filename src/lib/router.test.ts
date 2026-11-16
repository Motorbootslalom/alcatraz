import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { adresse, navigate, sprungziel, useReiter, useRoute } from './router'
import { setLocale } from '../i18n'

const REITER = ['wkr', 'codes', 'ergebnis'] as const

function baue(anfang: (typeof REITER)[number] = 'wkr') {
  const wahl = ref<(typeof REITER)[number]>(anfang)
  const view = ref('')
  const wrapper = mount(
    defineComponent({
      setup() {
        const v = useRoute()
        useReiter('listen', wahl, REITER)
        return () => h('div', (view.value = v.value))
      },
    }),
  )
  return { wahl, view, wrapper }
}

const wechsel = async (hash: string) => {
  location.hash = hash
  window.dispatchEvent(new Event('hashchange'))
  await nextTick()
}

describe('Reiter in der Adresse', () => {
  beforeEach(() => setLocale('de'))
  afterEach(() => {
    vi.restoreAllMocks()
    location.hash = ''
    setLocale('de')
  })

  it('liest den Reiter aus der Adresse – so übersteht er das Neuladen', () => {
    location.hash = '#/listen/codes'
    const { wahl, view, wrapper } = baue()
    expect(wahl.value).toBe('codes')
    expect(view.value).toBe('listen')
    wrapper.unmount()
  })

  it('trägt den gemerkten Reiter nach, wenn die Adresse keinen oder einen unbekannten nennt', () => {
    location.hash = '#/listen'
    const a = baue('ergebnis')
    expect(location.hash).toBe('#/listen/wertungslisten')
    a.wrapper.unmount()
    location.hash = '#/listen/gibt-es-nicht'
    const b = baue('codes')
    expect(b.wahl.value).toBe('codes')
    expect(location.hash).toBe('#/listen/codes')
    b.wrapper.unmount()
  })

  it('schreibt eine neue Wahl in die Adresse und folgt „Zurück“', async () => {
    location.hash = '#/listen/wkr'
    const { wahl, wrapper } = baue()
    wahl.value = 'ergebnis'
    await nextTick()
    expect(location.hash).toBe('#/listen/wertungslisten')
    await wechsel('#/listen/wkr')
    expect(wahl.value).toBe('wkr')
    wrapper.unmount()
  })

  it('lässt fremde Ansichten und Verweise mit Sprungziel in Ruhe', async () => {
    location.hash = '#/einstellungen?wertung'
    const { wahl, view, wrapper } = baue('codes')
    expect(location.hash).toBe('#/einstellungen?wertung')
    expect(view.value).toBe('einstellungen')
    wahl.value = 'ergebnis'
    await nextTick()
    expect(location.hash).toBe('#/einstellungen?wertung')
    wrapper.unmount()
  })

  it('die WKR-Einteilung ist zur Veranstaltung umgezogen: Der alte Verweis in die Einstellungen landet dort', async () => {
    location.hash = '#/einstellungen?wkr'
    const { view, wrapper } = baue()
    expect(view.value).toBe('veranstaltung')
    expect(sprungziel()).toBe('wkr')
    // Die Adresse steht danach so da, wie sie heute geschrieben wird.
    expect(location.hash).toBe('#/veranstaltung?wkr')
    await wechsel('#/settings?judges')
    expect(view.value).toBe('veranstaltung')
    expect(location.hash).toBe('#/veranstaltung?wkr')
    wrapper.unmount()
  })

  it('schreibt die Adresse in der Sprache der Oberfläche', () => {
    expect(adresse('veranstaltung', { ziel: 'wkr' })).toBe('#/veranstaltung?wkr')
    expect(adresse('veranstaltung', { ziel: 'besetzung' })).toBe('#/veranstaltung?besetzung')
    expect(adresse('listen', { reiter: 'wkr' })).toBe('#/listen/wkr')
    setLocale('en')
    expect(adresse('veranstaltung', { ziel: 'wkr' })).toBe('#/event?race-officials')
    expect(adresse('veranstaltung', { ziel: 'besetzung' })).toBe('#/event?assignments')
    expect(adresse('listen', { reiter: 'wkr' })).toBe('#/lists/race-officials')
    navigate('erfassung')
    expect(location.hash).toBe('#/entry')
  })

  it('ein deutscher Verweis geht bei englischer Oberfläche auf und wird umgeschrieben – ohne Schritt im Verlauf', () => {
    setLocale('en')
    location.hash = '#/listen/codes'
    // Umgeschrieben wird mit `location.replace` – das ersetzt den Eintrag im Verlauf.
    const ersetzt = vi.spyOn(location, 'replace')
    const setzt = vi.spyOn(location, 'hash', 'set')
    const { wahl, view, wrapper } = baue()
    expect(view.value).toBe('listen')
    expect(wahl.value).toBe('codes')
    expect(location.hash).toBe('#/lists/codes')
    expect(ersetzt).toHaveBeenCalledWith('#/lists/codes')
    expect(setzt).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('ein englischer Verweis geht bei deutscher Oberfläche auf – auch mit Sprungziel', async () => {
    location.hash = '#/settings?scoring'
    const { view, wrapper } = baue()
    expect(view.value).toBe('einstellungen')
    expect(sprungziel()).toBe('wertung')
    expect(location.hash).toBe('#/einstellungen?wertung')
    await wechsel('#/lists/results')
    expect(view.value).toBe('listen')
    expect(location.hash).toBe('#/listen/wertungslisten')
    wrapper.unmount()
  })

  it('beim Sprachwechsel folgt die Adresse sofort – ohne Schritt im Verlauf', async () => {
    location.hash = '#/listen/ergebnis'
    const { wahl, view, wrapper } = baue()
    const ersetzt = vi.spyOn(location, 'replace')
    const setzt = vi.spyOn(location, 'hash', 'set')
    setLocale('en')
    expect(location.hash).toBe('#/lists/results')
    expect(ersetzt).toHaveBeenCalledWith('#/lists/results')
    expect(setzt).not.toHaveBeenCalled()
    setzt.mockRestore()
    await nextTick()
    expect(view.value).toBe('listen')
    expect(wahl.value).toBe('ergebnis')
    // Eine neue Wahl steht danach englisch da.
    wahl.value = 'wkr'
    await nextTick()
    expect(location.hash).toBe('#/lists/race-officials')
    setLocale('de')
    expect(location.hash).toBe('#/listen/wkr')
    wrapper.unmount()
  })

  it('eine Auswahl im Verweis geht an die Ansicht; danach steht nur der Reiter in der Adresse – auch nach dem Umschreiben in die Sprache der Oberfläche', () => {
    const erhalten: [string, string][] = []
    const wahl = ref<'gewicht' | 'wkr'>('wkr')
    const baueMitWahl = () =>
      mount(
        defineComponent({
          setup() {
            useRoute()
            useReiter('listen', wahl, ['gewicht', 'wkr'] as const, undefined, (reiter, w) => erhalten.push([reiter, w]))
            return () => h('div')
          },
        }),
      )
    location.hash = '#/lists/weights/Musterclub%20Nord'
    const a = baueMitWahl()
    expect(wahl.value).toBe('gewicht')
    expect(erhalten).toEqual([['gewicht', 'Musterclub Nord']])
    expect(location.hash).toBe('#/listen/gewicht')
    a.unmount()
    expect(adresse('listen', { reiter: 'gewicht', wahl: '*' })).toBe('#/listen/gewicht/*')
    setLocale('en')
    expect(adresse('listen', { reiter: 'gewicht', wahl: 'Musterclub' })).toBe('#/lists/weights/Musterclub')
  })

  it('eine leere oder unbekannte Adresse bleibt, wie sie ist', () => {
    location.hash = '#/quatsch'
    const { view, wrapper } = baue()
    expect(view.value).toBe('veranstaltung')
    expect(location.hash).toBe('#/quatsch')
    wrapper.unmount()
  })
})
