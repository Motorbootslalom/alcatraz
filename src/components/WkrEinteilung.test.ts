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
    expect(wrapper.find('.wkr-einteilung h2').text()).toBe('Race officials')
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
    // Die Knoten nennt der Aufbau nicht selbst; das Regelwerk sieht ihre Liste vor.
    expect(listen(wrapper)).toEqual(['zeit', 'vorsteg', 'steg', 'gate135', 'gate245', 'tor5', 'mueb', 'parcours', 'knoten'])
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

  it('der Name im Bogenkopf wird nur angezeigt: der aus der WKR-Einteilung für Liste und Parcours der Klasse', async () => {
    const wrapper = ansicht(store)
    await zeige(wrapper, 'steg')
    const imKopf = () => kopf(wrapper, 'steg').find('.bk-wkr-text')
    // Kein Eingabefeld in der Beispielansicht – weder im Kopf noch darüber (Entscheidung des Nutzers vom 15.11.2026).
    expect(wrapper.findAll('.wkr-vorschau input').map((i) => i.attributes('data-feld') ?? i.attributes('type'))).toEqual(['number'])
    // Niemand eingeteilt: die leere Linie mit der Bezeichnung darunter, wie auf dem Papier.
    expect(imKopf().text()).toBe('')
    expect(kopf(wrapper, 'steg').find('.bk-wkr-unter').text()).toBe('Name Wettkampfrichter*in')
    // Aus der Tabelle: Parcours 2 (Klasse 7) zeigt den Namen, ohne Leerraum am Rand.
    await wrapper.find('input[data-feld="par_2|steg"]').setValue('A. Muster ')
    expect(imKopf().text()).toBe('A. Muster')
    expect(wkrName(store.state.value, 'steg', '7', configFor())).toBe('A. Muster')
    // Parcours 1 hat einen eigenen Namen: Klasse 2 zeigt ihn, nicht den von Parcours 2.
    await waehle(wrapper, '2')
    expect(imKopf().text()).toBe('')
    await wrapper.find('input[data-feld="par_1|steg"]').setValue('C. Probe')
    expect(imKopf().text()).toBe('C. Probe')
    // Der Hinweis führt zur Einteilung – dort allein wird gepflegt.
    expect(wrapper.find('.wkr-vorschau [data-hinweis="vorschau-namen"] a').attributes('href')).toBe('#/veranstaltung?wkr')
    wrapper.unmount()
  })

  it('schmales Fenster: Das Blatt wird verkleinert, ein Namensfeld gibt es auch dort nicht', async () => {
    // Das Test-DOM kennt kein Layout; die Breite des Stapels wird hier vorgegeben (Telefon).
    const breite = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 340 })
    try {
      store.dispatch({ type: 'SET_WKR_NAME', parcoursId: 'par_2', typeId: 'steg', name: 'A. Muster' })
      const wrapper = ansicht(store)
      await nextTick()
      await zeige(wrapper, 'steg')
      expect(wrapper.find('.wkr-vorschau input.bk-wkr-input').exists()).toBe(false)
      expect(wrapper.find('input[data-feld="vorschau-name|steg"]').exists()).toBe(false)
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
    expect(listen(wrapper)).toEqual(['steg', 'bstartziel', 'brechts', 'blinks', 'knoten'])
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
    // Der Bogen steht in der Sprache des Regelwerks (UIM: englisch), solange für die Liste nichts gewählt ist.
    expect(kopf(wrapper, 'steg').findAll('.bk-zelle')[1].text()).toBe('Class 5')
    // Die Sprache gilt je Parcours: Klasse 5 fährt auf Parcours 2 – eine Wahl für Parcours 1 wirkt hier nicht.
    store.dispatch({ type: 'SET_WKR_SPRACHE', zellen: [{ parcoursId: 'par_1', typeId: 'steg' }], sprache: 'de' })
    await nextTick()
    expect(kopf(wrapper, 'steg').findAll('.bk-zelle')[1].text()).toBe('Class 5')
    store.dispatch({ type: 'SET_WKR_SPRACHE', zellen: [{ parcoursId: 'par_2', typeId: 'steg' }], sprache: 'de' })
    await nextTick()
    expect(kopf(wrapper, 'steg').findAll('.bk-zelle')[1].text()).toBe('Klasse 5')
    store.dispatch({ type: 'SET_WKR_SPRACHE', zellen: [{ parcoursId: 'par_2', typeId: 'steg' }], sprache: 'de+en' })
    await nextTick()
    expect(kopf(wrapper, 'steg').findAll('.bk-zelle')[1].text()).toBe('Klasse / Class 5')
    // Klasse 3 fährt auf Parcours 1: dort deutsch.
    await waehle(wrapper, '3')
    expect(kopf(wrapper, 'steg').findAll('.bk-zelle')[1].text()).toBe('Klasse 3')
    wrapper.unmount()
  })

  it('eine Klasse ohne Parcours: Hinweis, im Kopf die leere Linie', async () => {
    const wrapper = ansicht(store)
    for (const p of store.state.value.parcoursList) store.dispatch({ type: 'REMOVE_PARCOURS', id: p.id })
    await nextTick()
    expect(wrapper.find('.wkr-vorschau .boat-banner.warn').text()).toContain('Klasse 7 fährt noch auf keinem Parcours – deshalb steht im Kopf kein Name')
    expect(listen(wrapper)).toContain('steg')
    expect(kopf(wrapper, 'zeit').find('.bk-wkr-text').text()).toBe('')
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
    expect(kopf(wrapper, 'steg').find('.bk-wkr-label').text()).toBe('Race official:')
    expect(kopf(wrapper, 'steg').findAll('.bk-zelle')[1].text()).toBe('Class 5')
    // Die Tabelle nennt die Listen genauso.
    expect(wrapper.find('input[data-feld="par_2|steg"]').attributes('aria-label')).toBe('Name for Pontoon, Parcours 2')
    // Die Sprache der Oberfläche ändert den Bogen nicht – nur das, was Bedienung ist.
    setLocale('de')
    await nextTick()
    expect(kopf(wrapper, 'steg').find('.bk-liste').text()).toBe('Pontoon')
    expect(nummern(wrapper, 'steg')[0]).toBe('M1')
    wrapper.unmount()
  })

  it('Clubmeisterschaft: die Beispielansicht zeigt den gemeinsamen Bogen – Leerzeilen je Seite statt je Klasse, ohne Bild', async () => {
    store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
    const wrapper = ansicht(store)
    await waehle(wrapper, '2')
    await zeige(wrapper, 'gate135')
    const blatt = wrapper.find('.wkr-vorschau .bogen[data-liste="gate135"]')
    // Klasse 2 fährt mit E, 1 und 3 auf Parcours 1: alle vier stehen auf dem Bogen, jede mit Muster-Nummern.
    const zeilen = blatt.findAll('.bogen-tabelle > tbody > tr')
    const ueber = zeilen.filter((z) => z.classes('bt-zwischen')).map((z) => z.text())
    // Die Leerzeilen teilen sich die Klassen der Seite: einmal am Ende, unter eigener Überschrift.
    expect(ueber.at(-1)).toBe('Nachmeldungen')
    expect([...ueber.slice(0, -1)].sort()).toEqual(['Klasse 1', 'Klasse 2', 'Klasse 3', 'Klasse E'])
    const nummern = () => wrapper.findAll('.wkr-vorschau .bogen[data-liste="gate135"] td.bt-nr').map((td) => td.text())
    expect(nummern().filter((n) => n.startsWith('M'))).toHaveLength(40)
    // Papier sparen ist die Vorgabe: kein Parcoursbild, drei Leerzeilen je Seite (nicht je Klasse) – alle am Ende.
    expect(nummern().filter((n) => n === '')).toHaveLength(3)
    expect(nummern().slice(-3)).toEqual(['', '', ''])
    // Die Zahl aus den Einstellungen wirkt sofort; ohne Leerzeilen entfällt auch die Überschrift.
    store.dispatch({ type: 'SET_WKR_LEERZEILEN_SEITE', anzahl: 5 })
    await nextTick()
    expect(nummern().filter((n) => n === '')).toHaveLength(5)
    store.dispatch({ type: 'SET_WKR_LEERZEILEN_SEITE', anzahl: 0 })
    await nextTick()
    expect(nummern().filter((n) => n === '')).toHaveLength(0)
    expect(wrapper.find('.wkr-vorschau .bogen[data-liste="gate135"]').text()).not.toContain('Nachmeldungen')
    store.dispatch({ type: 'SET_WKR_LEERZEILEN_SEITE', anzahl: null })
    await nextTick()
    expect(blatt.find('.bogen-bild').exists()).toBe(false)
    expect(blatt.find('.bogen-kennzeichen').text()).toBe('Beispielansicht')
    // Ohne Papier sparen bleibt die Liste mit Bild je Klasse.
    store.dispatch({ type: 'SET_WKR_CLUB_GEMEINSAM', gemeinsam: false })
    await nextTick()
    expect(wrapper.findAll('.wkr-vorschau .bogen[data-liste="gate135"] td.bt-nr').map((td) => td.text()).filter((n) => n.startsWith('M'))).toHaveLength(10)
    wrapper.unmount()
  })


  it('Parallelslalom (UIM): je Racecourse A und B Zeit, Steg und Fahrweg – Muster-Nummern in Blöcken, Dummy-Zeile, Muster-QR', async () => {
    const wrapper = ansicht(store)
    // Unter der DM gibt es ihn nicht – auch nicht in der Beispielansicht.
    expect(wrapper.find('.wkr-vorschau-parallel').exists()).toBe(false)
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    const reiter = () => wrapper.findAll('.wkr-vorschau-parallel-tabs button')
    expect(reiter().map((b) => b.attributes('data-liste'))).toEqual([
      'parallel|pre|A|zeit',
      'parallel|pre|A|steg',
      'parallel|pre|A|parallelparcours',
      'parallel|pre|B|zeit',
      'parallel|pre|B|steg',
      'parallel|pre|B|parallelparcours',
    ])
    expect(reiter().map((b) => b.text()).slice(0, 3)).toEqual(['Time', 'Pontoon', 'Parallel slalom'])
    expect(wrapper.findAll('.wkr-vorschau-racecourse-name').map((x) => x.text())).toEqual(['Parcours A', 'Parcours B'])
    // Die Listen des Manövrierens bleiben daneben.
    expect(listen(wrapper)).toContain('steg')
    await wrapper.find('.wkr-vorschau-parallel-tabs button[data-liste="parallel|pre|B|steg"]').trigger('click')
    const blatt = () => wrapper.find('.wkr-vorschau .bogen[data-liste="steg"]')
    expect(wrapper.findAll('.wkr-vorschau .bogen')).toHaveLength(1)
    expect(blatt().findAll('.bk-zelle').map((z) => z.text())).toEqual(['Pontoon', 'Preliminary heat', 'Racecourse B'])
    expect(blatt().attributes('data-muster')).toBeDefined()
    expect(blatt().find('.bogen-kennzeichen').text()).toBe('Beispielansicht')
    expect(blatt().find('svg.qr-code').attributes('data-qr')).toBe('ALC2.MUSTER.UIM2026.PARALLEL.PRE.B.STEG.S1')
    // 10 Muster-Zeilen = 10 Starts: Blöcke 4, 4, 2 wie gedruckt, eine Dummy-Zeile.
    const zeilen = () => blatt().findAll('.bogen-tabelle > tbody > tr[data-zeile]')
    expect(zeilen()).toHaveLength(10)
    expect(blatt().findAll('.bogen-tabelle > tbody > tr.bt-blockende').map((r) => r.attributes('data-zeile'))).toEqual(['s4', 's8', 's10'])
    expect(blatt().findAll('tr[data-ohne="dummy"]')).toHaveLength(1)
    // Auf B: die Muster-Nummern in der Reihenfolge des Plans, der Dummy im 1. Attempt des letzten Paares.
    expect(blatt().findAll('tr[data-zeile] td.bt-nr:not(.bt-start)').map((td) => td.text())).toEqual(['M2', 'M7', 'M1', 'M6', 'M4', 'M9', 'M3', 'M8', 'Dummy', 'M5'])
    expect(wrapper.find('[data-hinweis="vorschau-parallel"]').text()).toContain('ein Vorlauf mit 10 Starts')
    // „Muster-Zeilen“ wirkt: 6 Starts = 3 Paare, Blöcke 4 und 2; ungerade Zahl → auf ganze Paare aufgerundet.
    const zahl = wrapper.find('.wkr-vorschau input[type="number"]')
    await zahl.setValue('6')
    await zahl.trigger('change')
    expect(zeilen()).toHaveLength(6)
    expect(blatt().findAll('.bogen-tabelle > tbody > tr.bt-blockende').map((r) => r.attributes('data-zeile'))).toEqual(['s4', 's6'])
    // 0 Muster-Zeilen: leere Listen wie im Manövrieren – der Hinweis verspricht dann keine Dummy-Zeile.
    await zahl.setValue('0')
    await zahl.trigger('change')
    expect(zeilen()).toHaveLength(0)
    expect(blatt().findAll('tr[data-ohne="dummy"]')).toHaveLength(0)
    expect(reiter()).toHaveLength(6)
    const leer = wrapper.find('[data-hinweis="vorschau-parallel"]').text()
    expect(leer).toContain('ohne Muster-Zeilen')
    expect(leer).not.toContain('0 Starts')
    expect(leer).not.toContain('zur Anschauung')
    await zahl.setValue('5')
    await zahl.trigger('change')
    expect(zeilen()).toHaveLength(6)
    // Name und Sprache je Racecourse aus der Einteilung – B ist eine eigene Gruppe.
    expect(blatt().find('.bk-wkr-text').text()).toBe('')
    await wrapper.find('input[data-feld="racecourse-b|steg"]').setValue('Tom Test')
    expect(blatt().find('.bk-wkr-text').text()).toBe('Tom Test')
    await wrapper.find('select[data-feld="wkr-sprache|racecourse-b|steg"]').setValue('de')
    expect(blatt().findAll('.bk-zelle').map((z) => z.text())).toEqual(['Steg', 'Vorlauf', 'Parcours B'])
    await wrapper.find('.wkr-vorschau-parallel-tabs button[data-liste="parallel|pre|A|steg"]').trigger('click')
    expect(blatt().findAll('.bk-zelle').map((z) => z.text())).toEqual(['Pontoon', 'Preliminary heat', 'Racecourse A'])
    expect(blatt().find('.bk-wkr-text').text()).toBe('')
    // Englisch mit dem Wort des Rulebooks: „preliminary heat“, nicht „round“.
    setLocale('en')
    await nextTick()
    expect(wrapper.find('[data-hinweis="vorschau-parallel"]').text()).toContain('one preliminary heat with 6 starts')
    expect(wrapper.find('[data-hinweis="vorschau-parallel"]').text()).not.toMatch(/\bround\b/)
    wrapper.unmount()
  })
})
