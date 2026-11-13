import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import WkrEinteilung from './WkrEinteilung.vue'
import WkrVorschau from './WkrVorschau.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { wkrName } from '../lib/einteilung'
import { configFor } from '../config/konfig'
import { loadState } from '../persistenz/storage'
import { setLocale } from '../i18n'

// Wie unter „Einstellungen“: die Tabelle und – weiter unten – die Beispielansicht.
const Beide = defineComponent({ render: () => h('div', [h(WkrEinteilung), h(WkrVorschau)]) })

function ansicht(store: Store) {
  return mount(Beide, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
}

describe('WKR-Einteilung: Tabelle', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })
  afterEach(() => setLocale('de'))

  it('zeigt je Parcours der Verzahnung eine Spalte mit ihren Klassen und verweist dorthin', () => {
    const wrapper = ansicht(store)
    const panel = wrapper.find('.wkr-einteilung')
    expect(panel.find('h2').text()).toBe('WKR-Einteilung')
    const kopf = panel.findAll('.wkr-tabelle > thead th').map((th) => th.text())
    expect(kopf[1]).toContain('Parcours 1')
    expect(kopf[1]).toContain('Klasse 3')
    expect(kopf[2]).toContain('Parcours 2')
    expect(kopf[2]).toContain('Klasse 7')
    expect(panel.find('a[href="#/verzahnung"]').text()).toBe('Verzahnung')
    // Die Klassen werden hier nicht noch einmal abgefragt.
    expect(panel.find('.wkr-tabelle').findAll('input[type="checkbox"], select, button')).toEqual([])
    expect(panel.findAll('input[type="checkbox"], button')).toEqual([])
    wrapper.unmount()
  })

  it('speichert Namen je Liste und Parcours; die Felder sind beschriftet', async () => {
    const wrapper = ansicht(store)
    const feld = wrapper.find('input[aria-label="Name für Steg, Parcours 1"]')
    expect(feld.exists()).toBe(true)
    await feld.setValue('Muster')
    await wrapper.find('input[aria-label="Name für Steg, Parcours 2"]').setValue('Beispiel')
    expect(store.state.value.einteilung).toEqual({ par_1: { steg: 'Muster' }, par_2: { steg: 'Beispiel' } })
    // Der Stand liegt im Browser: nach einem Neuladen sind die Namen wieder da.
    await nextTick()
    expect(loadState()?.einteilung).toEqual(store.state.value.einteilung)
    wrapper.unmount()
    const wieder = ansicht(createStore())
    expect((wieder.find('input[aria-label="Name für Steg, Parcours 1"]').element as HTMLInputElement).value).toBe('Muster')
    wieder.unmount()
  })

  it('ein Strich statt Feld, wenn keine Klasse des Parcours die Liste hat', () => {
    const wrapper = ansicht(store)
    // Mann-über-Bord gibt es erst ab Klasse 4: Parcours 1 fährt E bis 3.
    expect(wrapper.find('input[data-feld="par_1|mueb"]').exists()).toBe(false)
    expect(wrapper.find('input[data-feld="par_2|mueb"]').exists()).toBe(true)
    const zeile = wrapper.findAll('.wkr-tabelle > tbody > tr').find((tr) => tr.find('input[data-feld="par_2|mueb"]').exists())!
    expect(zeile.find('.wkr-entfaellt').text()).toContain('–')
    wrapper.unmount()
  })

  it('Enter springt ins nächste Feld desselben Parcours, am Ende zum nächsten Parcours', async () => {
    const wrapper = ansicht(store)
    const felder = wrapper.findAll('input[data-feld^="par_1|"]')
    await felder[0].trigger('keydown', { key: 'Enter' })
    expect(document.activeElement).toBe(felder[1].element)
    await felder.at(-1)!.trigger('keydown', { key: 'Enter' })
    expect((document.activeElement as HTMLElement).dataset.feld).toMatch(/^par_2\|/)
    wrapper.unmount()
  })

  it('folgt der Verzahnung: ein umbenannter und ein dritter Parcours', async () => {
    const wrapper = ansicht(store)
    store.dispatch({ type: 'RENAME_PARCOURS', id: 'par_1', name: 'Hafenbecken' })
    store.dispatch({ type: 'ADD_PARCOURS', id: 'par_x' })
    await nextTick()
    const kopf = wrapper.findAll('.wkr-tabelle > thead th').map((th) => th.text())
    expect(kopf).toHaveLength(4)
    expect(kopf[1]).toContain('Hafenbecken')
    expect(kopf[3]).toContain('keine Klasse')
    expect(wrapper.find('input[aria-label="Name für Steg, Hafenbecken"]').exists()).toBe(true)
    // Ohne Klasse hat der neue Parcours keine Liste.
    expect(wrapper.findAll('input[data-feld^="par_x|"]')).toHaveLength(0)
    wrapper.unmount()
  })

  it('spricht auch Englisch', async () => {
    setLocale('en')
    const wrapper = ansicht(store)
    expect(wrapper.find('.wkr-einteilung h2').text()).toBe('Judges')
    expect(wrapper.find('input[data-feld="par_1|steg"]').attributes('aria-label')).toMatch(/^Name for .+, Parcours 1$/)
    wrapper.unmount()
  })
})

describe('WKR-Einteilung: Beispielansicht der Listen', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })
  afterEach(() => setLocale('de'))

  // Je Position ein Reiter; gezeigt wird das Blatt der gewählten.
  const listen = (w: ReturnType<typeof ansicht>) => w.findAll('.wkr-vorschau-tabs button').map((b) => b.attributes('data-liste'))
  const zeige = (w: ReturnType<typeof ansicht>, liste: string) => w.find(`.wkr-vorschau-tabs button[data-liste="${liste}"]`).trigger('click')
  const kopf = (w: ReturnType<typeof ansicht>, liste: string) => w.find(`.wkr-vorschau .bogen[data-liste="${liste}"] .bogen-kopf`)
  const nummern = (w: ReturnType<typeof ansicht>, liste: string) =>
    w.findAll(`.wkr-vorschau .bogen[data-liste="${liste}"] .bogen-tabelle > tbody > tr > td.bt-nr`).map((td) => td.text())
  const waehle = (w: ReturnType<typeof ansicht>, klasse: string) => w.find('select[data-feld="vorschau-klasse"]').setValue(klasse)

  it('zeigt je Position des Aufbaus einen Reiter für die höchste Klasse – mit Muster-Nummern und Kennzeichen', async () => {
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal', eventJahr: 2026 } })
    const wrapper = ansicht(store)
    expect(listen(wrapper)).toEqual(['zeit', 'vorsteg', 'steg', 'gate135', 'gate245', 'tor5', 'mueb', 'parcours'])
    expect((wrapper.find('select[data-feld="vorschau-klasse"]').element as HTMLSelectElement).value).toBe('7')
    // Zuerst die erste Position, und nur ihr Blatt.
    expect(wrapper.findAll('.wkr-vorschau .bogen').map((b) => b.attributes('data-liste'))).toEqual(['zeit'])
    expect(wrapper.find('.wkr-vorschau-tabs button.active').attributes('data-liste')).toBe('zeit')
    await zeige(wrapper, 'steg')
    expect(wrapper.find('.wkr-vorschau-tabs button[aria-selected="true"]').text()).toBe('Steg')
    expect(nummern(wrapper, 'steg')).toEqual(['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', '', '', ''])
    // Jedes Blatt trägt das Kennzeichen und gilt als Muster: So wird es nie gedruckt (bogen.css).
    const blaetter = wrapper.findAll('.wkr-vorschau .bogen')
    expect(blaetter.every((b) => b.find('.bogen-kennzeichen').text() === 'Beispielansicht')).toBe(true)
    expect(blaetter.every((b) => b.attributes('data-muster') !== undefined)).toBe(true)
    expect(wrapper.find('.wkr-vorschau').classes()).toContain('no-print')
    // Jede fünfte Zeile ist grau.
    expect(wrapper.findAll('.wkr-vorschau .bogen[data-liste="steg"] .bogen-tabelle > tbody > tr.grau > td.bt-nr').map((td) => td.text())).toEqual(['M5', 'M10'])
    await zeige(wrapper, 'gate135')
    // Kopf: Veranstaltung, Liste, Klasse, Lauf und – bei zwei Parcours – der Parcours der Klasse.
    const zellen = kopf(wrapper, 'gate135').findAll('.bk-zelle').map((z) => z.text())
    expect(kopf(wrapper, 'gate135').find('.bk-titel').text()).toBe('Hafenpokal 2026')
    expect(zellen).toEqual(['Tor 1 / 3 / 5', 'Klasse 7', '1. Lauf', 'Parcours 2'])
    wrapper.unmount()
  })

  it('die Klasse bestimmt Listen, Spalten und Parcours', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, '2')
    // Klasse 2 fährt kein Mann-über-Bord und laut Verzahnung auf Parcours 1.
    expect(listen(wrapper)).not.toContain('mueb')
    await zeige(wrapper, 'gate135')
    expect(kopf(wrapper, 'gate135').findAll('.bk-zelle').map((z) => z.text())).toEqual(['Tor 1 / 3 / 5', 'Klasse 2', '1. Lauf', 'Parcours 1'])
    const spalten = (liste: string) => wrapper.findAll(`.bogen[data-liste="${liste}"] .bogen-tabelle > tbody > tr:first-child > td[data-spalte]`).map((td) => td.attributes('data-spalte'))
    expect(spalten('gate135')).not.toContain('speed2')
    await waehle(wrapper, '7')
    expect(spalten('gate135')).toContain('speed2')
    wrapper.unmount()
  })

  it('der Name im Bogenkopf schreibt in dieselbe Einteilung wie die Tabelle – beide zeigen denselben Stand', async () => {
    const wrapper = ansicht(store)
    await zeige(wrapper, 'steg')
    const imKopf = () => kopf(wrapper, 'steg').find('input.bk-wkr-input')
    const inTabelle = () => wrapper.find('input[data-feld="par_2|steg"]')
    expect(imKopf().attributes('aria-label')).toBe('Name im Kopf der Liste Steg, Parcours 2')
    // Aus der Vorschau …
    await imKopf().setValue('A. Muster')
    expect(store.state.value.einteilung).toEqual({ par_2: { steg: 'A. Muster' } })
    expect((inTabelle().element as HTMLInputElement).value).toBe('A. Muster')
    expect(wkrName(store.state.value, 'steg', '7', configFor())).toBe('A. Muster')
    // … und aus der Tabelle.
    await inTabelle().setValue('B. Beispiel')
    expect((imKopf().element as HTMLInputElement).value).toBe('B. Beispiel')
    // Ein Leerzeichen beim Tippen bleibt im Feld stehen (sonst ließe sich kein zweites Wort schreiben).
    await imKopf().setValue('B. ')
    expect((imKopf().element as HTMLInputElement).value).toBe('B. ')
    // Parcours 1 hat einen eigenen Namen: Klasse 2 zeigt ihn, nicht den von Parcours 2.
    await waehle(wrapper, '2')
    expect((imKopf().element as HTMLInputElement).value).toBe('')
    await imKopf().setValue('C. Probe')
    expect(store.state.value.einteilung).toEqual({ par_2: { steg: 'B. ' }, par_1: { steg: 'C. Probe' } })
    // Leeren entfernt den Eintrag, auch aus der Vorschau.
    await imKopf().setValue('')
    expect(store.state.value.einteilung).toEqual({ par_2: { steg: 'B. ' } })
    wrapper.unmount()
  })

  it('schmales Fenster: Das Namensfeld steht in normaler Größe über dem verkleinerten Blatt', async () => {
    // Das Test-DOM kennt kein Layout; die Breite des Stapels wird hier vorgegeben (Telefon).
    const breite = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 340 })
    try {
      const wrapper = ansicht(store)
      await nextTick()
      await zeige(wrapper, 'steg')
      // Im Kopf steht der Name nur noch als Text …
      expect(wrapper.find('.wkr-vorschau input.bk-wkr-input').exists()).toBe(false)
      const feld = () => wrapper.find('input[data-feld="vorschau-name|steg"]')
      expect(wrapper.find(`label[for="${feld().attributes('id')}"]`).text()).toBe('Name im Kopf der Liste Steg, Parcours 2')
      // … und das Feld darüber schreibt an dieselbe Stelle wie die Tabelle.
      await feld().setValue('A. Muster ')
      expect(store.state.value.einteilung).toEqual({ par_2: { steg: 'A. Muster ' } })
      expect((wrapper.find('input[data-feld="par_2|steg"]').element as HTMLInputElement).value).toBe('A. Muster ')
      expect((feld().element as HTMLInputElement).value).toBe('A. Muster ')
      expect(kopf(wrapper, 'steg').find('.bk-wkr-text').text()).toBe('A. Muster')
      // Verkleinert wird über die Faktoren am Stapel (bogen.css).
      expect(wrapper.find('.bogen-stapel').attributes('style')).toContain('--bogen-zoom-hoch: 0.428')
      wrapper.unmount()
    } finally {
      if (breite) Object.defineProperty(HTMLElement.prototype, 'clientWidth', breite)
      else delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
    }
  })

  it('folgt Aufbau, Regelwerk und Verzahnung sofort', async () => {
    const wrapper = ansicht(store)
    store.dispatch({ type: 'SET_AUFBAU', aufbau: 'berlin' })
    await nextTick()
    expect(listen(wrapper)).toEqual(['steg', 'bstartziel', 'brechts', 'blinks'])
    store.dispatch({ type: 'RENAME_PARCOURS', id: 'par_2', name: 'Hafenbecken' })
    await nextTick()
    expect(kopf(wrapper, 'steg').find('.bk-parcours').text()).toBe('Hafenbecken')
    // UIM kennt Klasse 7 nicht: Die Auswahl bietet nur dessen Klassen, gewählt ist die höchste.
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    const wahl = wrapper.find('select[data-feld="vorschau-klasse"]')
    expect(wahl.findAll('option').map((o) => o.text())).toEqual(['Dolphin', 'Klasse 1', 'Klasse 2', 'Klasse 3', 'Klasse 4', 'Klasse 5'])
    expect((wahl.element as HTMLSelectElement).value).toBe('5')
    await zeige(wrapper, 'steg')
    expect(kopf(wrapper, 'steg').findAll('.bk-zelle')[1].text()).toBe('Klasse 5')
    wrapper.unmount()
  })

  it('eine Klasse ohne Parcours: Hinweis statt Namensfeld', async () => {
    const wrapper = ansicht(store)
    for (const p of store.state.value.parcoursList) store.dispatch({ type: 'REMOVE_PARCOURS', id: p.id })
    await nextTick()
    expect(wrapper.find('.wkr-vorschau .boat-banner.warn').text()).toContain('Klasse 7 fährt noch auf keinem Parcours')
    expect(wrapper.find('.wkr-vorschau input.bk-wkr-input').exists()).toBe(false)
    expect(listen(wrapper)).toContain('steg')
    wrapper.unmount()
  })

  it('Englisch: Oberfläche, Muster-Präfix und – unter UIM – die Listen selbst', async () => {
    setLocale('en')
    const wrapper = ansicht(store)
    expect(wrapper.find('.wkr-vorschau .bogen-kennzeichen').text()).toBe('Sample')
    await zeige(wrapper, 'steg')
    expect(nummern(wrapper, 'steg').slice(0, 2)).toEqual(['S1', 'S2'])
    // Nach den DM-Regeln bleiben die Listen deutsch.
    expect(kopf(wrapper, 'steg').find('.bk-liste').text()).toBe('Steg')
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    expect(kopf(wrapper, 'steg').find('.bk-liste').text()).toBe('Pontoon')
    expect(kopf(wrapper, 'steg').find('.bk-wkr-label').text()).toBe('Judge:')
    expect(kopf(wrapper, 'steg').findAll('.bk-zelle')[1].text()).toBe('Class 5')
    // Die Tabelle nennt die Listen genauso.
    expect(wrapper.find('input[data-feld="par_2|steg"]').attributes('aria-label')).toBe('Name for Pontoon, Parcours 2')
    setLocale('de')
    await nextTick()
    expect(kopf(wrapper, 'steg').find('.bk-liste').text()).toBe('Steg')
    expect(nummern(wrapper, 'steg')[0]).toBe('M1')
    wrapper.unmount()
  })

  it('Clubmeisterschaft: die Beispielansicht zeigt den gemeinsamen Bogen – eine Leerzeile je Klasse, ohne Bild', async () => {
    store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
    const wrapper = ansicht(store)
    await waehle(wrapper, '2')
    await zeige(wrapper, 'gate135')
    const blatt = wrapper.find('.wkr-vorschau .bogen[data-liste="gate135"]')
    // Klasse 2 fährt mit E, 1 und 3 auf Parcours 1: alle vier stehen auf dem Bogen, jede mit Muster-Nummern.
    const zeilen = blatt.findAll('.bogen-tabelle > tbody > tr')
    const ueber = zeilen.filter((z) => z.classes('bt-zwischen')).map((z) => z.text())
    expect([...ueber].sort()).toEqual(['Klasse 1', 'Klasse 2', 'Klasse 3', 'Klasse E'])
    const nummern = blatt.findAll('td.bt-nr').map((td) => td.text())
    expect(nummern.filter((n) => n.startsWith('M'))).toHaveLength(40)
    // Papier sparen ist die Vorgabe: kein Parcoursbild, eine Leerzeile je Klasse.
    expect(nummern.filter((n) => n === '')).toHaveLength(4)
    expect(blatt.find('.bogen-bild').exists()).toBe(false)
    expect(blatt.find('.bogen-kennzeichen').text()).toBe('Beispielansicht')
    // Ohne Papier sparen bleibt die Liste mit Bild je Klasse.
    store.dispatch({ type: 'SET_WKR_CLUB_GEMEINSAM', gemeinsam: false })
    await nextTick()
    expect(wrapper.findAll('.wkr-vorschau .bogen[data-liste="gate135"] td.bt-nr').map((td) => td.text()).filter((n) => n.startsWith('M'))).toHaveLength(10)
    wrapper.unmount()
  })

})
