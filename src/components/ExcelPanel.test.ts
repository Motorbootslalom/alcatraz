import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ExcelPanel from './ExcelPanel.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { birthYearRange } from '../domain/classes'
import { setLocale } from '../i18n'
import type { AppState } from '../types'

describe('Einfügen aus Excel: Klasse gegen Geburtsjahr, Sperre nach den ersten Ergebnissen', () => {
  let store: Store
  const ansicht = () => mount(ExcelPanel, { global: { provide: { [storeKey as symbol]: store } } })
  const knoepfe = (w: ReturnType<typeof ansicht>) => w.findAll('.row button').map((b) => b.attributes('disabled') !== undefined)

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventJahr: 2026 } })
  })

  // Erfundene Starter.
  const zeilen = (jahrA: number, jahrB: number) => `Klasse\tNachname\tVorname\tGeburtsdatum\n3\tMuster\tMax\t01.05.${jahrA}\n3\tBeispiel\tEva\t01.05.${jahrB}`

  it('eine falsche Klasse wird genannt und hält den Import auf, bis die Liste stimmt', async () => {
    const [von, bis] = birthYearRange('3', 2026)
    const wrapper = ansicht()
    await wrapper.find('textarea').setValue(zeilen(von, bis + 1))
    const hinweis = wrapper.find('[data-hinweis="klassen-fehler"]')
    expect(hinweis.findAll('li')).toHaveLength(1)
    expect(hinweis.text()).toContain(`Eva Beispiel: Klasse 3, geboren ${bis + 1}`)
    expect(hinweis.text()).toContain(`Jahrgänge ${von}–${bis}`)
    expect(hinweis.text()).toContain('gehört in Klasse 2')
    expect(knoepfe(wrapper)).toEqual([true, true])
    // Nichts wird übernommen, auch nicht die richtigen Zeilen.
    expect(store.state.value.starters).toEqual([])
    // Behoben: Der Hinweis verschwindet, der Import geht.
    await wrapper.find('textarea').setValue(zeilen(von, bis))
    expect(wrapper.find('[data-hinweis="klassen-fehler"]').exists()).toBe(false)
    expect(knoepfe(wrapper)).toEqual([false, false])
    await wrapper.find('.row button.primary').trigger('click')
    expect(store.state.value.starters.map((s) => s.nachname)).toEqual(['Muster', 'Beispiel'])
    wrapper.unmount()
  })

  it('gehört der Jahrgang in eine andere Klasse, lässt sich der Starter je Zeile dort übernehmen – und zurück', async () => {
    const [, bis] = birthYearRange('3', 2026)
    const wrapper = ansicht()
    await wrapper.find('textarea').setValue(zeilen(bis, bis + 1))
    const knopf = wrapper.find('[data-hinweis="klassen-fehler"] [data-action="in-klasse-uebernehmen"]')
    expect(knopf.text()).toBe('In Klasse 2 übernehmen')
    expect(knopf.attributes('title')).toContain('statt in Klasse 3')
    await knopf.trigger('click')
    // Der Fehler ist weg, der Import geht; die Vorschau sagt, wer anders übernommen wird.
    expect(wrapper.find('[data-hinweis="klassen-fehler"]').exists()).toBe(false)
    expect(wrapper.find('[data-hinweis="umgeklasst"]').text()).toContain('Eva Beispiel: Klasse 3 → Klasse 2')
    expect(knoepfe(wrapper)).toEqual([false, false])
    // Zurück: Die Zeile hält den Import wieder auf.
    await wrapper.find('[data-action="umklassen-zurueck"]').trigger('click')
    expect(wrapper.find('[data-hinweis="klassen-fehler"]').exists()).toBe(true)
    expect(knoepfe(wrapper)).toEqual([true, true])
    await wrapper.find('[data-action="in-klasse-uebernehmen"]').trigger('click')
    await wrapper.find('.row button.primary').trigger('click')
    expect(store.state.value.starters.map((s) => `${s.nachname}:${s.klasse}:${s.startNr}`)).toEqual(['Muster:3:301', 'Beispiel:2:201'])
    wrapper.unmount()
  })

  it('passt ein Jahrgang in keine Klasse, nennt die Meldung die Jahrgänge, die überhaupt starten – ohne Knopf', async () => {
    const wrapper = ansicht()
    await wrapper.find('textarea').setValue(zeilen(2013, 2024))
    const hinweis = wrapper.find('[data-hinweis="klassen-fehler"]')
    expect(hinweis.text()).toContain('gehört in keine Klasse des Regelwerks – es starten die Jahrgänge 1999–2020')
    expect(hinweis.find('[data-action="in-klasse-uebernehmen"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('nicht lesbare Geburtsdaten werden genannt; Schrägstrich heißt Tag zuerst', async () => {
    const wrapper = ansicht()
    await wrapper.find('textarea').setValue('Klasse\tNachname\tVorname\tGeburtsdatum\n3\tMuster\tMax\t31.02.2013\n3\tBeispiel\tEva\t12/01/2013')
    expect(wrapper.find('[data-hinweis="datum-unlesbar"]').text()).toContain('1 Geburtsdatum nicht erkannt (31.02.2013)')
    await wrapper.find('.row button.primary').trigger('click')
    expect(store.state.value.starters.map((s) => s.geburtsdatum)).toEqual(['', '2013-01-12'])
    // Prüfbefund zu Paket F (16.11.2026): Die Vorschau ist danach weg – die Meldung nennt es weiter.
    const meldung = wrapper.find('[role="status"].boat-banner')
    expect(meldung.text()).toContain('✓ 2 Starter übernommen')
    expect(meldung.find('[data-hinweis="datum-unlesbar"]').text()).toContain('1 Geburtsdatum nicht erkannt (31.02.2013)')
    wrapper.unmount()
  })

  // Prüfbefund zu Paket F (16.11.2026): Nach „In Klasse X übernehmen“ hieß es „keine Startnummern
  // erkannt“, obwohl die Nummer erkannt und nur wegen der anderen Klasse verworfen wurde.
  it('in einer anderen Klasse übernommen: die weggefallene Nummer wird genannt, nicht „keine Startnummern erkannt“', async () => {
    const [, bis] = birthYearRange('3', 2026)
    const wrapper = ansicht()
    await wrapper.find('textarea').setValue(`Klasse\tStartnummer\tNachname\tVorname\tGeburtsdatum\n3\t301\tMuster\tMax\t01.05.${bis}\n3\t302\tBeispiel\tEva\t01.05.${bis + 1}`)
    await wrapper.find('[data-action="in-klasse-uebernehmen"]').trigger('click')
    const erwartet = 'Startnummern unverändert übernommen, außer 1 Nummer der gelisteten Klasse (302) – in einer anderen Klasse übernommen und dort neu vergeben'
    expect(wrapper.text()).toContain(erwartet)
    await wrapper.find('.row button.primary').trigger('click')
    expect(store.state.value.starters.map((s) => `${s.nachname}:${s.klasse}:${s.startNr}`)).toEqual(['Muster:3:301', 'Beispiel:2:201'])
    const meldung = wrapper.find('[role="status"].boat-banner').text()
    expect(meldung).toContain(erwartet)
    expect(meldung).not.toContain('keine Startnummern erkannt')
    wrapper.unmount()
  })

  it('ohne Geburtsdatum geht der Import, mit Hinweis', async () => {
    const wrapper = ansicht()
    await wrapper.find('textarea').setValue('Klasse\tNachname\tVorname\n3\tMuster\tMax')
    expect(wrapper.find('[data-hinweis="ohne-datum"]').text()).toContain('1 Starter ohne Geburtsdatum')
    expect(knoepfe(wrapper)).toEqual([false, false])
    wrapper.unmount()
  })

  it('„Ergänzen“ ohne Startnummern vergibt die nächsten freien Nummern der Klasse, keine doppelten', async () => {
    // Erfunden: Klasse 1 hat schon 101–106.
    store.dispatch({
      type: 'IMPORT_STARTERS',
      mode: 'replace',
      starters: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `alt${n}`, startNr: `10${n}`, klasse: '1' as const, nachname: `Alt${n}`, vorname: 'X', verein: '', bundesland: '', geburtsdatum: '', groesse: '' })),
    })
    const wrapper = ansicht()
    // Mit Startern steht das Panel zugeklappt.
    await wrapper.find('.export-head button[aria-expanded]').trigger('click')
    await wrapper.find('textarea').setValue('Klasse\tNachname\tVorname\n1\tNach1\tY\n1\tNach2\tY\n1\tAlt3\tX')
    await wrapper.findAll('.row button').find((b) => b.text() === 'Ergänzen')!.trigger('click')
    const nummern = store.state.value.starters.map((s) => `${s.nachname}:${s.startNr}`)
    expect(nummern).toEqual(['Alt1:101', 'Alt2:102', 'Alt3:103', 'Alt4:104', 'Alt5:105', 'Alt6:106', 'Nach1:107', 'Nach2:108'])
    wrapper.unmount()
  })

  it('sind Ergebnisse erfasst, ist der Import gesperrt', async () => {
    const [von] = birthYearRange('3', 2026)
    const wrapper = ansicht()
    await wrapper.find('textarea').setValue(zeilen(von, von))
    await wrapper.find('.row button.primary').trigger('click')
    const id = store.state.value.starters[0].id
    // Irgendein erfasster Wert genügt.
    store.dispatch({ type: 'LOAD_STATE', state: { ...store.state.value, eingaben: { [id]: {} } } as unknown as AppState })
    await wrapper.vm.$nextTick()
    if (Object.keys(store.state.value.eingaben).length === 0) throw new Error('Der Test braucht einen Stand mit Eingaben')
    await wrapper.find('textarea').setValue(zeilen(von, von))
    expect(wrapper.find('[data-hinweis="import-gesperrt"]').text()).toContain('Ergebnisse erfasst')
    expect(knoepfe(wrapper)).toEqual([true, true])
    // Der Hinweis nennt beide Wege, die Sperre zu lösen – als Verweise in der Sprache der Oberfläche.
    const verweise = () => wrapper.findAll('[data-hinweis="import-gesperrt"] a').map((a) => a.attributes('href'))
    expect(verweise()).toEqual(['#/veranstaltung?werte', '#/einstellungen?dateien'])
    setLocale('en')
    await wrapper.vm.$nextTick()
    expect(verweise()).toEqual(['#/event?values', '#/settings?files'])
    setLocale('de')
    wrapper.unmount()
  })
})
