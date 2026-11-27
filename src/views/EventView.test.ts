import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import EventView from './EventView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import { vergissAlles } from '../lib/merken'
import { nextTick } from 'vue'
import { logoFolge, setzeTestLogos, wechsleRegelwerk } from '../testHilfen'
import { LAENDER } from '../domain/generate'
import { BUNDESLAENDER, CLUBS } from '../data/clubs'
import { regelwerkOf, startNrBereicheVorgabe } from '../config/catalog'
import { nummerDerKlasse } from '../domain/startnrBereiche'
import type { ClassId } from '../types'
import { herkunftAnzeige } from '../lib/origin'

describe('Veranstaltung', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })
  afterEach(() => setLocale('de'))

  it('Datum der Veranstaltung (24.11.2026): Textfeld nach Muster, leer erlaubt, leiser Hinweis bei anderem Jahr', async () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const feld = wrapper.find('input[data-feld="event-datum"]')
    // Nie die Datumswahl des Browsers.
    expect(feld.attributes('type')).toBe('text')
    expect(feld.attributes('placeholder')).toBe('TT.MM.JJJJ')
    await feld.setValue('5.9.2026')
    expect(store.state.value.eventDatum).toBe('2026-09-05')
    expect((feld.element as HTMLInputElement).value).toBe('05.09.2026')
    expect(wrapper.find('[data-hinweis="datum-jahr"]').exists()).toBe(false)
    // Ein Tag, den es nicht gibt: Meldung, der Stand bleibt.
    await feld.setValue('31.02.2026')
    expect(wrapper.find('[data-hinweis="datum-fehler"]').exists()).toBe(true)
    expect(store.state.value.eventDatum).toBe('2026-09-05')
    // Anderes Jahr als die Veranstaltung: nur ein Hinweis, nichts wird angeglichen.
    await feld.setValue('12.06.2027')
    expect(store.state.value.eventDatum).toBe('2027-06-12')
    expect(wrapper.find('[data-hinweis="datum-jahr"]').text()).toContain('2027')
    expect(store.state.value.eventJahr).toBe(2026)
    await feld.setValue('')
    expect(store.state.value.eventDatum).toBe('')
    wrapper.unmount()
  })

  it('Datum der Veranstaltung (Prüfbefund 24.11.2026): Zweck sichtbar unter der Zeile, Grenzen aus dem Regelwerk, unter UIM keine', async () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    // Kein Tooltip mehr – auf Pad und Handy wäre er nie zu sehen.
    expect(wrapper.find('label[for="ev-datum"]').attributes('title')).toBeUndefined()
    const zweck = () => wrapper.find('[data-hinweis="datum-zweck"]').text()
    expect(zweck()).toContain('erster Wettkampftag, freiwillig')
    // DM: die Grenzen aus dm-2026.yaml in der Klassenfolge des Regelwerks (E vor 7).
    expect(zweck()).toContain('(Klasse E ab dem 6. Geburtstag, Klasse 7 nur bis zum 27. Geburtstag)')
    // UIM nennt keine Grenzen: nur, was das Feld ist.
    wechsleRegelwerk(store, 'uim-2026')
    await nextTick()
    expect(zweck()).toBe('Datum: erster Wettkampftag, freiwillig.')
    // Der Zweck bleibt neben einer Fehlermeldung stehen.
    await wrapper.find('input[data-feld="event-datum"]').setValue('31.02.2026')
    expect(wrapper.find('[data-hinweis="datum-fehler"]').exists()).toBe(true)
    expect(wrapper.find('[data-hinweis="datum-zweck"]').exists()).toBe(true)
    setLocale('en')
    wechsleRegelwerk(store, 'dm-2026')
    await nextTick()
    expect(zweck()).toContain('(Class E from age 6, Class 7 only before turning 27)')
    wrapper.unmount()
  })

  it('Besetzung: Boote, Co-Piloten und die WKR-Einteilung stehen in einem Block – zugeklappt, solange nichts eingetragen ist', async () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const block = wrapper.find('details[data-block="besetzung"]')
    expect(block.find('summary').text()).toContain('Besetzung')
    expect(block.find('[data-hinweis="besetzung-stand"]').text()).toBe('noch nichts eingetragen')
    expect((block.element as HTMLDetailsElement).open).toBe(false)
    // Der Block steht nach den Angaben zur Veranstaltung und vor den Beispieldaten.
    const reihenfolge = wrapper.findAll('.panel > h2, details.panel > summary').map((h) => h.text().split('\n')[0].trim())
    expect(reihenfolge.map((x) => x.replace(/\s+noch nichts eingetragen$/, ''))).toEqual(['Veranstaltung', 'Besetzung', 'Beispieldaten'])
    // Die WKR-Einteilung ist ein Unterabschnitt – ohne eigenen Rahmen, Überschrift eine Stufe tiefer.
    const wkr = block.find('#wkr-einteilung')
    expect(wkr.classes()).not.toContain('panel')
    expect(wkr.find('h3').text()).toBe('WKR-Einteilung')
    expect(wkr.find('.wkr-tabelle').exists()).toBe(true)
    // Der frühere Verweis in die Einstellungen ist weg; die Beispielansicht bleibt zugeklappt.
    expect(wrapper.find('[data-hinweis="wkr"]').exists()).toBe(false)
    expect(wrapper.find('.bogen').exists()).toBe(false)
    wrapper.unmount()
  })

  it('Besetzung: je Klasse des Regelwerks ein Feld für Boot und Co-Pilot; die Kopfzeile zählt mit', async () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const feld = (name: string) => wrapper.find(`[data-block="besetzung"] input[data-feld="${name}"]`)
    expect(wrapper.findAll('.besetzung-tabelle tbody tr').map((tr) => tr.attributes('data-klasse'))).toEqual(['E', '1', '2', '3', '4', '5', '6', '7'])
    // Reglement C3: Co-Pilot in den Klassen ME bis M3 – dort ein gewöhnliches Feld, sonst ein zurückgenommenes.
    expect(wrapper.find('.besetzung-tabelle').element.closest('.besetzung-teil')!.textContent).toContain('Einen Co-Piloten sieht das Regelwerk DM 2026 vor in: Klasse E, Klasse 1, Klasse 2, Klasse 3.')
    expect(feld('coPilot|3').classes()).not.toContain('besetzung-ohne')
    expect(feld('coPilot|4').classes()).toContain('besetzung-ohne')
    expect(feld('coPilot|4').attributes('placeholder')).toBe('nicht vorgesehen')
    await feld('boot|4').setValue('Boot 1, 15 PS')
    await feld('coPilot|E').setValue('Erika Beispiel')
    expect(store.state.value.boote).toEqual({ '4': 'Boot 1, 15 PS' })
    expect(store.state.value.coPiloten).toEqual({ E: { haupt: { name: 'Erika Beispiel' } } })
    expect(wrapper.find('[data-hinweis="besetzung-stand"]').text()).toBe('Boote 1 von 8 · Co-Piloten 1 von 4 · Wettkampfrichter 0')
    // Leeren entfernt die Angabe wieder.
    await feld('boot|4').setValue('  ')
    expect(store.state.value.boote).toEqual({})
    // UIM kennt die Klassen 6 und 7 nicht; die Oberfläche nennt den Co-Piloten dort „co-driver“.
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    setLocale('en')
    await nextTick()
    expect(wrapper.findAll('.besetzung-tabelle tbody tr').map((tr) => tr.attributes('data-klasse'))).toEqual(['E', '1', '2', '3', '4', '5'])
    expect(wrapper.findAll('.besetzung-tabelle thead th').map((th) => th.text())).toEqual(['Class', 'Boat', 'Co-driver', 'Weight', 'Substitute co-driver', 'Weight'])
    expect(wrapper.find('[data-block="besetzung"] summary').text()).toContain('Assignments')
    wrapper.unmount()
  })

  it('Beispiel-Boote und -Co-Piloten (19.11.2026) nur unter „Beispieldaten“ – nicht im Block „Besetzung“ (21.11.2026); mit Rückfrage, wenn schon etwas steht', async () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    // Beispielwerte entstehen an EINER Stelle (Wunsch des Nutzers vom 21.11.2026).
    expect(wrapper.find('[data-block="besetzung"] [data-action^="beispiel"]').exists()).toBe(false)
    const block = wrapper.find('[data-block="beispieldaten"]')
    const besetzung = wrapper.find('[data-block="besetzung"]')
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    // Leer: ohne Rückfrage.
    await block.find('[data-action="beispiel-boote"]').trigger('click')
    await block.find('[data-action="beispiel-copiloten"]').trigger('click')
    expect(confirm).not.toHaveBeenCalled()
    expect(Object.keys(store.state.value.boote)).toHaveLength(8)
    expect(Object.keys(store.state.value.coPiloten).sort()).toEqual(['1', '2', '3', 'E'])
    expect((besetzung.find('input[data-feld="boot|E"]').element as HTMLInputElement).value).toBe(store.state.value.boote.E)
    // Schon eingetragen: Rückfrage; Nein lässt alles stehen, Ja ersetzt.
    const boote = store.state.value.boote
    await block.find('[data-action="beispiel-boote"]').trigger('click')
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0].join()).toContain('Für 8 Klassen sind schon Boote eingetragen')
    expect(store.state.value.boote).toBe(boote)
    await block.find('[data-action="beispiel-copiloten"]').trigger('click')
    expect(confirm.mock.calls[1].join()).toContain('Für 4 Klassen sind schon Co-Piloten eingetragen')
    confirm.mockReturnValue(true)
    await block.find('[data-action="beispiel-boote"]').trigger('click')
    expect(confirm).toHaveBeenCalledTimes(3)
    expect(store.state.value.boote).not.toBe(boote)
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('Besetzung: Mit Einträgen ist der Block offen; ein Verweis (`?wkr`, `?besetzung`) öffnet ihn auch leer', async () => {
    store.dispatch({ type: 'SET_BOOT', klasse: '1', text: 'Boot 2' })
    vergissAlles()
    let wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    expect((wrapper.find('details[data-block="besetzung"]').element as HTMLDetailsElement).open).toBe(true)
    wrapper.unmount()
    store.dispatch({ type: 'SET_BOOT', klasse: '1', text: '' })
    vergissAlles()
    location.hash = '#/veranstaltung?wkr'
    wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    expect((wrapper.find('details[data-block="besetzung"]').element as HTMLDetailsElement).open).toBe(true)
    wrapper.unmount()
    location.hash = ''
    vergissAlles()
  })

  it('UIM sieht zwei Versuche vor, der bessere zählt: Weicht die Einstellung ab, steht es beim Regelwerk', async () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const hinweis = () => wrapper.find('[data-hinweis="regel-laeufe"]')
    // Die DM gibt nichts vor.
    expect(hinweis().exists()).toBe(false)
    // Die Wahl „UIM“ stellt gleich zwei Läufe und einen Streichlauf ein: kein Hinweis.
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await wrapper.vm.$nextTick()
    expect([store.state.value.laufCount, store.state.value.streichlaeufe]).toEqual([2, 1])
    expect(hinweis().exists()).toBe(false)
    // Von Hand abweichen geht weiter – dann steht der Hinweis da.
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 3 } })
    store.dispatch({ type: 'SET_STREICHLAEUFE', streichlaeufe: 'auto' })
    await wrapper.vm.$nextTick()
    expect(hinweis().text()).toContain('UIM 2026 sieht 2 Läufe vor, davon 1 gestrichen. Eingestellt sind 3 Läufe, davon 1 gestrichen')
    // Zwei Läufe „nach Regel“ strichen keinen: Es zählte die Summe statt des besseren Versuchs.
    store.dispatch({ type: 'LOAD_STATE', state: { ...store.state.value, laufCount: 2 } })
    await wrapper.vm.$nextTick()
    expect(hinweis().text()).toContain('Eingestellt sind 2 Läufe, davon 0 gestrichen')
    store.dispatch({ type: 'SET_STREICHLAEUFE', streichlaeufe: 1 })
    await wrapper.vm.$nextTick()
    expect(hinweis().exists()).toBe(false)
    wrapper.unmount()
  })

  it('sind Ergebnisse erfasst, lässt sich kein Beispiel-Starterfeld mehr erzeugen – Beispielwerte und „Werte löschen“ gehen weiter', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: [{ id: 'p1', startNr: '401', vorname: 'Vor', nachname: 'Nach', verein: '', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' }] })
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const knopf = (name: string) => wrapper.find(`[data-block="beispieldaten"] [data-action="${name}"]`)
    const hinweis = () => wrapper.find('[data-block="beispieldaten"] [data-hinweis="starter-gesperrt"]')
    expect(knopf('beispielstarter').attributes('disabled')).toBeUndefined()
    expect(hinweis().exists()).toBe(false)
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    await wrapper.vm.$nextTick()
    expect(knopf('beispielstarter').attributes('disabled')).toBeDefined()
    expect(hinweis().text()).toContain('das Starterfeld steht deshalb fest')
    expect(hinweis().text()).toContain('Alle erfassten Werte löschen')
    expect(knopf('beispielwerte').attributes('disabled')).toBeUndefined()
    expect(knopf('werte-loeschen').attributes('disabled')).toBeUndefined()
    // Werte gelöscht: Die Sperre ist weg.
    vi.stubGlobal('confirm', () => true)
    await knopf('werte-loeschen').trigger('click')
    expect(store.state.value.eingaben).toEqual({})
    expect(knopf('beispielstarter').attributes('disabled')).toBeUndefined()
    expect(hinweis().exists()).toBe(false)
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('zugeklappte Beispielansicht beim Aufbau: Sie folgt dem gewählten Aufbau und zeigt die Namen der WKR-Einteilung nur an', async () => {
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const klappe = wrapper.find('details[data-vorschau]')
    expect(klappe.find('summary').text()).toContain('So sehen die Listen dieses Aufbaus aus')
    // Zugeklappt wird nichts gebaut.
    expect(klappe.find('.wkr-vorschau').exists()).toBe(false)
    ;(klappe.element as HTMLDetailsElement).open = true
    await klappe.trigger('toggle')
    const reiter = () => klappe.findAll('.wkr-vorschau-tabs button').map((b) => b.attributes('data-liste'))
    expect(reiter()).toContain('gate135')
    expect(klappe.findAll('.bogen')).toHaveLength(1)
    await wrapper.find('#ev-aufbau').setValue('berlin')
    expect(reiter()).toEqual(['steg', 'bstartziel', 'brechts', 'blinks', 'knoten'])
    // Der Name im Kopf ist kein Eingabefeld; er kommt aus der WKR-Einteilung weiter unten.
    expect(klappe.find('.bogen[data-liste="steg"] input').exists()).toBe(false)
    await wrapper.find('#wkr-einteilung input[data-feld="par_2|steg"]').setValue('A. Muster')
    expect(klappe.find('.bogen[data-liste="steg"] .bk-wkr-text').text()).toBe('A. Muster')
    wrapper.unmount()
  })

  it('Beispielansicht der Clubmeisterschaft: Klassen getrennt oder gemischt in der Startfolge, wie gedruckt (24.11.2026)', async () => {
    store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const klappe = wrapper.find('details[data-vorschau]')
    ;(klappe.element as HTMLDetailsElement).open = true
    await klappe.trigger('toggle')
    await klappe.find('.wkr-vorschau-tabs button[data-liste="steg"]').trigger('click')
    const bogen = () => klappe.find('.bogen[data-liste="steg"]')
    // Getrennt (Vorgabe): je Klasse ein Block mit Überschrift, keine Klassenspalte.
    expect(bogen().findAll('tr.bt-zwischen').length).toBeGreaterThan(1)
    expect(bogen().find('th.bt-klasse').exists()).toBe(false)
    store.dispatch({ type: 'SET_WKR_GEMEINSAM_FOLGE', folge: 'verzahnung' })
    await nextTick()
    // Nach der Verzahnung: keine Überschriften, die Klasse hinter der Nummer – die Muster-Starter so gemischt, wie die
    // Verzahnung des Parcours echte Starter mischte.
    expect(bogen().findAll('tr.bt-zwischen')).toHaveLength(0)
    const klassen = bogen().findAll('tbody tr[data-zeile] td.bt-klasse').map((td) => td.text()).filter(Boolean)
    expect(new Set(klassen).size).toBeGreaterThan(1)
    expect(new Set(klassen.slice(0, 4)).size).toBeGreaterThan(1)
    wrapper.unmount()
  })

  it('Beispielansicht mit Logos (16.11.2026): Sie stehen auch dort in der Titelleiste des Bogens', async () => {
    setzeTestLogos(store)
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const klappe = wrapper.find('details[data-vorschau]')
    ;(klappe.element as HTMLDetailsElement).open = true
    await klappe.trigger('toggle')
    const kopf = klappe.find('.wkr-vorschau .bogen-kopf--logos')
    expect(kopf.exists()).toBe(true)
    expect(logoFolge(kopf.find('.bk-leiste').element)).toEqual(['links', 'rechts'])
    // Entfernt: Der Kopf ist wieder der ohne Logos.
    store.dispatch({ type: 'SET_LOGO', seite: 'links', logo: null })
    store.dispatch({ type: 'SET_LOGO', seite: 'rechts', logo: null })
    await nextTick()
    expect(klappe.find('.wkr-vorschau .bogen-kopf--logos').exists()).toBe(false)
    expect(klappe.find('.wkr-vorschau .bk-leiste > .bk-titel').exists()).toBe(true)
    wrapper.unmount()
  })

  it('Aufbau wechseln mit schon erfassten Werten: erst nach Rückfrage – sie nennt, was sich ändern kann', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: [{ id: 'p1', startNr: '401', vorname: 'Vor', nachname: 'Nach', verein: '', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' }] })
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const vorher = store.state.value.aufbau
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const wahl = wrapper.find('#ev-aufbau')
    await wahl.setValue('berlin')
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0].join()).toContain('Lichtschranke')
    // Abgelehnt: Stand und Auswahlfeld bleiben beim alten Aufbau.
    expect(store.state.value.aufbau).toBe(vorher)
    expect((wahl.element as HTMLSelectElement).value).toBe(vorher)
    confirm.mockReturnValue(true)
    await wahl.setValue('berlin')
    expect(store.state.value.aufbau).toBe('berlin')
    // Ohne erfasste Werte wird nicht gefragt.
    store.dispatch({ type: 'CLEAR_EINGABEN' })
    await wahl.setValue('frontal')
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(store.state.value.aufbau).toBe('frontal')
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('sobald Ergebnisse erfasst sind, ist der Wechsel des Regelwerks gesperrt – mit Hinweis; nach „Werte löschen“ geht er wieder', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: [{ id: 'p1', startNr: '401', vorname: 'Vor', nachname: 'Nach', verein: '', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' }] })
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const knopf = (id: string) => wrapper.find(`button[data-regelwerk="${id}"]`)
    const hinweis = () => wrapper.find('[data-hinweis="regelwerk-gesperrt"]')
    expect(hinweis().exists()).toBe(false)
    expect(knopf('uim-2026').attributes('disabled')).toBeUndefined()
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    await wrapper.vm.$nextTick()
    expect(hinweis().text()).toContain('das Regelwerk lässt sich nicht mehr wechseln')
    expect(knopf('uim-2026').attributes('disabled')).toBeDefined()
    // Das gewählte Regelwerk bleibt bedienbar (ein Klick ändert nichts).
    expect(knopf('dm-2026').attributes('disabled')).toBeUndefined()
    // Auch am Knopf vorbei lehnt der Reducer ab.
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    expect(store.state.value.regelwerk).toBe('dm-2026')
    store.dispatch({ type: 'CLEAR_EINGABEN' })
    await wrapper.vm.$nextTick()
    expect(hinweis().exists()).toBe(false)
    await knopf('uim-2026').trigger('click')
    expect(store.state.value.regelwerk).toBe('uim-2026')
    wrapper.unmount()
  })

  it('zeigt ein Stand unter einem anderen Regelwerk erfasste Werte nicht (3. Lauf, etwa aus einer Sicherung), steht der Hinweis gleich hier', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: [{ id: 'p1', startNr: '401', vorname: 'Vor', nachname: 'Nach', verein: '', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' }] })
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/3', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    const wrapper = mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    const hinweis = () => wrapper.find('[data-hinweis="verborgene-eingaben"]')
    expect(hinweis().exists()).toBe(false)
    wechsleRegelwerk(store, 'uim-2026')
    await wrapper.vm.$nextTick()
    expect(hinweis().exists()).toBe(true)
    // Nichts ist verloren: Zurück auf DM zeigt den 3. Lauf wieder.
    wechsleRegelwerk(store, 'dm-2026')
    await wrapper.vm.$nextTick()
    expect(hinweis().exists()).toBe(false)
    expect(Object.keys(store.state.value.eingaben)).toContain('manoevrieren/3')
    wrapper.unmount()
  })

  describe('Beispieldaten', () => {
    const block = (wrapper: ReturnType<typeof mount>) => wrapper.find('details[data-block="beispieldaten"]')
    const offen = (wrapper: ReturnType<typeof mount>) => (block(wrapper).element as HTMLDetailsElement).open
    const zeige = () => mount(EventView, { global: { provide: { [storeKey as symbol]: store } } })
    // Die Gesamtzahl wird gezogen (21.11.2026): Wer eine feste Zahl braucht, trägt sie ein.
    const setzeGesamt = async (wrapper: ReturnType<typeof mount>, n: number) => {
      const feld = block(wrapper).find('[data-feld="beispiel-gesamt"]')
      await feld.setValue(String(n))
      await feld.trigger('change')
    }
    const zahlen = (wrapper: ReturnType<typeof mount>) => block(wrapper).findAll<HTMLInputElement>('.class-count input[data-feld^="beispiel-klasse|"]').map((z) => Number(z.element.value))

    it('der Block steht am Ende der Ansicht und ist zugeklappt, solange keine Beispieldaten geladen sind', () => {
      const wrapper = zeige()
      expect(block(wrapper).find('summary').text()).toBe('Beispieldaten')
      expect(offen(wrapper)).toBe(false)
      // Der letzte Block der Ansicht.
      expect(wrapper.findAll('.panel').at(-1)!.attributes('data-block')).toBe('beispieldaten')
      wrapper.unmount()
    })

    it('auch mit echten Startern bleibt er zu', () => {
      store.dispatch({ type: 'ADD_STARTERS', starters: [{ id: 'p1', startNr: '401', vorname: 'Vor', nachname: 'Nach', verein: '', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' }] })
      const wrapper = zeige()
      expect(offen(wrapper)).toBe(false)
      wrapper.unmount()
    })

    it('ein Beispiel-Starterfeld erzeugen: Der Block bleibt offen – auch nach dem Wechsel der Ansicht –, Beispielwerte lassen sich gleich ergänzen', async () => {
      const wrapper = zeige()
      expect(block(wrapper).find('[data-action="beispielwerte"]').attributes('disabled')).toBeDefined()
      await setzeGesamt(wrapper, 48)
      // Verteilt nach BEISPIEL_KLASSEN_ANTEILE (E, 1–7), größte Reste.
      expect(zahlen(wrapper)).toEqual([2, 5, 6, 7, 7, 9, 5, 7])
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      expect(store.state.value.starters).toHaveLength(48)
      expect(store.state.value.starters.filter((p) => p.klasse === '5')).toHaveLength(9)
      expect(store.state.value.beispielStarter).toBe(true)
      // Startnummern nach Westengröße (DM-Vorgabe, 19.11.2026): jede aus einem Bereich ihrer Klasse.
      const bereiche = (k: string) => startNrBereicheVorgabe('dm-2026', k as ClassId)
      for (const p of store.state.value.starters) {
        const n = nummerDerKlasse(p.startNr, p.klasse, { E: 'E' })
        expect(n !== null && bereiche(p.klasse).some((b) => n >= nummerDerKlasse(b.von, p.klasse, { E: 'E' })! && n <= nummerDerKlasse(b.bis, p.klasse, { E: 'E' })!), `${p.klasse} ${p.startNr}`).toBe(true)
      }
      expect(offen(wrapper)).toBe(true)
      wrapper.unmount()

      // Die Ansicht wird beim Wechsel neu aufgebaut: Der Block ist wieder offen.
      const wieder = zeige()
      expect(offen(wieder)).toBe(true)
      expect(block(wieder).find('[data-hinweis="werte"]').text()).toBe('0 Werte erfasst.')
      await block(wieder).find('[data-action="beispielwerte"]').trigger('click')
      expect(Object.keys(store.state.value.eingaben).length).toBeGreaterThan(0)
      expect(block(wieder).find('[data-hinweis="werte"]').text()).not.toBe('0 Werte erfasst.')
      wieder.unmount()
    })

    it('Gesamtzahl nach Art der Veranstaltung (21.11.2026): gezogen im Bereich, änderbar, bleibt über das Neuladen stehen, neu bei anderer Art', async () => {
      vergissAlles()
      const gesamt = (wrapper: ReturnType<typeof mount>) => Number((block(wrapper).find('[data-feld="beispiel-gesamt"]').element as HTMLInputElement).value)
      const wrapper = zeige()
      // Vorgabe der Veranstaltung: Meisterschaft mit Vereinen → 45–75.
      expect(gesamt(wrapper)).toBeGreaterThanOrEqual(45)
      expect(gesamt(wrapper)).toBeLessThanOrEqual(75)
      expect(block(wrapper).find('[data-hinweis="beispiel-gesamt"]').text()).toContain('45–75')
      expect(zahlen(wrapper).reduce((a, b) => a + b, 0)).toBe(gesamt(wrapper))
      // „Vorschlag neu“ bleibt im Bereich.
      for (let i = 0; i < 10; i++) {
        await block(wrapper).find('[data-action="beispiel-gesamt-neu"]').trigger('click')
        expect(gesamt(wrapper)).toBeGreaterThanOrEqual(45)
        expect(gesamt(wrapper)).toBeLessThanOrEqual(75)
      }
      // Bundesland/Land → 100–160.
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
      await nextTick()
      expect(gesamt(wrapper)).toBeGreaterThanOrEqual(100)
      expect(gesamt(wrapper)).toBeLessThanOrEqual(160)
      // Clubmeisterschaft → 10–20; kleine Felder dürfen E = 0 haben, die Summe stimmt immer.
      store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
      await nextTick()
      expect(gesamt(wrapper)).toBeGreaterThanOrEqual(10)
      expect(gesamt(wrapper)).toBeLessThanOrEqual(20)
      expect(block(wrapper).find('[data-hinweis="beispiel-gesamt"]').text()).toContain('Clubmeisterschaft')
      await setzeGesamt(wrapper, 12)
      expect(zahlen(wrapper)).toEqual([0, 1, 2, 2, 2, 2, 1, 2])
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      expect(store.state.value.starters).toHaveLength(12)
      wrapper.unmount()
      // Über das Neuladen (sessionStorage) und den Wechsel der Ansicht: dieselbe Zahl.
      expect(JSON.parse(sessionStorage.getItem('alcatraz.merke.beispiel.klassen') ?? 'null')).toEqual({ art: 'club', gesamt: 12, klassen: { E: 0, 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 1, 7: 2 }, hand: [] })
      const wieder = zeige()
      expect(gesamt(wieder)).toBe(12)
      wieder.unmount()
      vergissAlles()
    })

    // R6-02 (Nutzer 21.11.2026): „Es sollte weiterhin möglich sein, eine Anzahl pro Klasse festzulegen“ –
    // die Gesamtzahl ist der Vorschlag; BS2 „Vorschlag neu“ (bestätigt 22.11.2026, R7-50), BS3 neue Gesamtzahl verteilt neu (NICHT bestätigt, R7-51).
    it('Zahl je Klasse festlegbar: eine Klasse auf 0, eine andere höher; Summe daneben; „Vorschlag neu“ und neue Gesamtzahl verteilen nur die übrigen; „Zurücksetzen“', async () => {
      vergissAlles()
      const wrapper = zeige()
      const klasse = (k: string) => block(wrapper).find(`[data-feld="beispiel-klasse|${k}"]`)
      const setzeKlasse = async (k: string, n: string) => {
        await klasse(k).setValue(n)
        await klasse(k).trigger('change')
      }
      const summe = () => block(wrapper).find('[data-hinweis="beispiel-summe"]').text()
      await setzeGesamt(wrapper, 48)
      expect(zahlen(wrapper)).toEqual([2, 5, 6, 7, 7, 9, 5, 7])
      expect(summe()).toBe('zusammen 48 (Vorschlag 48)')
      expect(block(wrapper).find('[data-action="beispiel-gesamt-neu"]').text()).toBe('Vorschlag neu')
      await setzeKlasse('E', '0')
      await setzeKlasse('7', '12')
      expect(zahlen(wrapper)).toEqual([0, 5, 6, 7, 7, 9, 5, 12])
      expect(summe()).toBe('zusammen 51 (Vorschlag 48)')
      // Ungültiges wird zu einer Zahl im Bereich 0–999.
      await setzeKlasse('6', '-3')
      expect(zahlen(wrapper)[6]).toBe(0)
      await setzeKlasse('6', '5')
      // Über den Wechsel der Ansicht bleibt es stehen; erzeugt werden genau diese Zahlen.
      wrapper.unmount()
      let wieder = zeige()
      expect(zahlen(wieder)).toEqual([0, 5, 6, 7, 7, 9, 5, 12])
      await block(wieder).find('[data-action="beispielstarter"]').trigger('click')
      expect(store.state.value.starters).toHaveLength(51)
      expect(store.state.value.starters.filter((p) => p.klasse === 'E')).toHaveLength(0)
      expect(store.state.value.starters.filter((p) => p.klasse === '7')).toHaveLength(12)
      // BS3 umgebaut (Nutzer 22.11.2026, R7-51): Hand-Zahlen (E, 6, 7) bleiben, nur die übrigen werden verteilt.
      const hand = () => block(wieder).findAll('[data-teil="beispiel-hand"]').map((m) => m.element.closest('[data-klasse]')!.getAttribute('data-klasse'))
      expect(hand()).toEqual(['6', '7', 'E'].sort((x, y) => ['E', '1', '2', '3', '4', '5', '6', '7'].indexOf(x) - ['E', '1', '2', '3', '4', '5', '6', '7'].indexOf(y)))
      await setzeGesamt(wieder, 48)
      const z = zahlen(wieder)
      expect([z[0], z[6], z[7]]).toEqual([0, 5, 12])
      expect(z.reduce((a, b) => a + b, 0)).toBe(48)
      expect(block(wieder).find('[data-hinweis="beispiel-summe"]').text()).toBe('zusammen 48 (Vorschlag 48)')
      // Neuladen (Wechsel der Ansicht) behält, welche Klassen von Hand gesetzt sind.
      wieder.unmount()
      wieder = zeige()
      expect(zahlen(wieder)).toEqual(z)
      expect(hand()).toHaveLength(3)
      // BS4: „Zurücksetzen“ vergisst die Hand-Zahlen und verteilt über alle Klassen; danach ist der Knopf weg.
      const zurueck = () => block(wieder).find('[data-action="beispiel-klassen-zuruecksetzen"]')
      expect(zurueck().text()).toBe('Zurücksetzen')
      await zurueck().trigger('click')
      expect(zahlen(wieder)).toEqual([2, 5, 6, 7, 7, 9, 5, 7])
      expect(zurueck().exists()).toBe(false)
      expect(hand()).toEqual([])
      // BS2 + BS3 umgebaut: „Vorschlag neu“ zieht eine neue Gesamtzahl (45–75), die Hand-Zahl von E bleibt.
      await block(wieder).find('[data-feld="beispiel-klasse|E"]').setValue('30')
      await block(wieder).find('[data-feld="beispiel-klasse|E"]').trigger('change')
      await block(wieder).find('[data-action="beispiel-gesamt-neu"]').trigger('click')
      const n = Number((block(wieder).find('[data-feld="beispiel-gesamt"]').element as HTMLInputElement).value)
      expect(n).toBeGreaterThanOrEqual(45)
      expect(n).toBeLessThanOrEqual(75)
      expect(zahlen(wieder)[0]).toBe(30)
      expect(zahlen(wieder).reduce((a, b) => a + b, 0)).toBe(n)
      wieder.unmount()
      vergissAlles()
    })

    // R6-01 (Nutzer 21.11.2026): „Clubmeisterschaft ist eine Meisterschaft ohne Vereine“ – BS1, bestätigt 22.11.2026 (R7-48).
    it('Clubmeisterschaft: Beispielstarter ohne Herkunft, auch wenn die Veranstaltung danach wieder eine bekam', async () => {
      store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
      expect(store.state.value.originMode).toBe('none')
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'verein' })
      const wrapper = zeige()
      await setzeGesamt(wrapper, 15)
      expect(block(wrapper).find('[data-hinweis="beispiel-herkunft"]').text()).toContain('ohne Vereine')
      expect(block(wrapper).find('[data-feld="beispiel-herkuenfte"]').attributes('disabled')).toBeDefined()
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      expect(store.state.value.starters).toHaveLength(15)
      expect(store.state.value.starters.every((p) => p.verein === '' && p.bundesland === '' && p.land === undefined)).toBe(true)
      // Die Einstellung der Veranstaltung bleibt, wie gewählt.
      expect(store.state.value.originMode).toBe('verein')
      wrapper.unmount()
      vergissAlles()
    })

    it('unter UIM dieselben Anteile (Dolphin = E), nur auf die Klassen E–5 verteilt', async () => {
      store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
      const wrapper = zeige()
      await setzeGesamt(wrapper, 60)
      expect(zahlen(wrapper)).toHaveLength(6)
      expect(zahlen(wrapper).reduce((a, b) => a + b, 0)).toBe(60)
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      expect(store.state.value.starters).toHaveLength(60)
      wrapper.unmount()
      vergissAlles()
    })

    // Entscheidung des Nutzers vom 15.11.2026 (spät abends): Die Herkunft der Beispielstarter folgt
    // der Wahl der Veranstaltung, gleich unter welchem Regelwerk – sie wird nicht mehr umgestellt.
    it('die Herkunft folgt der Veranstaltung, auch unter UIM: Verein bleibt Verein', async () => {
      store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'verein' })
      const wrapper = zeige()
      expect(block(wrapper).find('[data-hinweis="beispiel-herkunft"]').text()).toContain('Verein')
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      expect(store.state.value.originMode).toBe('verein')
      const starters = store.state.value.starters
      expect(starters.length).toBeGreaterThan(0)
      const vereine = new Set(CLUBS.map((c) => c.name))
      expect(starters.every((p) => vereine.has(p.verein) && p.land === undefined)).toBe(true)
      wrapper.unmount()
    })

    it('Land: Länder mit englischem Namen und Kürzel nach IOC – auch unter der DM', async () => {
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
      const wrapper = zeige()
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      expect(store.state.value.regelwerk).toBe('dm-2026')
      const starters = store.state.value.starters
      expect(starters.every((p) => p.verein === '' && p.bundesland === '' && LAENDER.includes(p.land ?? ''))).toBe(true)
      // Englische Namen, die als Staat erkannt sind; das Kürzel ist das des IOC (beide Regelwerke).
      for (const id of ['dm-2026', 'uim-2026']) {
        const norm = regelwerkOf(id).laenderKuerzel
        expect(norm).toBe('ioc')
        for (const land of LAENDER) expect(herkunftAnzeige(land, 'land', 'kurz', {}, 'de', false, norm).text, land).toMatch(/^[A-Z]{3}$/)
        expect(['Germany', 'Switzerland', 'Netherlands', 'Lithuania'].map((land) => herkunftAnzeige(land, 'land', 'kurz', {}, 'de', false, norm).text)).toEqual(['GER', 'SUI', 'NED', 'LTU'])
      }
      wrapper.unmount()
    })

    it('Bundesland: nur Bundesländer; „Herkünfte“ zählt dann Bundesländer', async () => {
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'bundesland' })
      const wrapper = zeige()
      await block(wrapper).find('[data-feld="beispiel-herkuenfte"]').setValue('3')
      await block(wrapper).find('[data-feld="beispiel-herkuenfte"]').trigger('change')
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      const starters = store.state.value.starters
      expect(starters.every((p) => p.verein === '' && BUNDESLAENDER.includes(p.bundesland) && p.land === undefined)).toBe(true)
      expect(new Set(starters.map((p) => p.bundesland)).size).toBe(3)
      wrapper.unmount()
      vergissAlles()
    })

    it('ohne Herkunft: Starter ohne Herkunft, das Feld „Herkünfte“ ist gesperrt und leer', async () => {
      const wrapper = zeige()
      await setzeGesamt(wrapper, 48)
      const feld = () => block(wrapper).find<HTMLInputElement>('[data-feld="beispiel-herkuenfte"]')
      await feld().setValue('3')
      await feld().trigger('change')
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'none' })
      await nextTick()
      expect(feld().attributes('disabled')).toBeDefined()
      // Weder die zuvor eingetragene Zahl noch „unbegrenzt“: Ohne Herkunft gilt keine Begrenzung.
      expect(feld().element.value).toBe('')
      expect(feld().attributes('placeholder')).toBeUndefined()
      expect(block(wrapper).find('[data-hinweis="beispiel-herkunft"]').text()).toContain('keine')
      // Die gemerkte Zahl bleibt: Mit einer Herkunft steht sie wieder da.
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'verein' })
      await nextTick()
      expect(feld().element.value).toBe('3')
      expect(feld().attributes('disabled')).toBeUndefined()
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'none' })
      await nextTick()
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      expect(store.state.value.originMode).toBe('none')
      expect(store.state.value.starters.length).toBe(48)
      expect(store.state.value.starters.every((p) => p.verein === '' && p.bundesland === '' && p.land === undefined)).toBe(true)
      wrapper.unmount()
      vergissAlles()
    })

    it('Beispiel-Besetzung: füllt die WKR-Einteilung; stehen dort schon Namen, erst nach Rückfrage', async () => {
      const wrapper = zeige()
      const stand = () => block(wrapper).find('[data-hinweis="beispiel-besetzung"]').text()
      expect(stand()).toMatch(/^0 von \d+ Listen besetzt$/)
      await block(wrapper).find('[data-action="beispielbesetzung"]').trigger('click')
      const gesamt = Number(stand().match(/von (\d+)/)![1])
      expect(stand()).toBe(`${gesamt} von ${gesamt} Listen besetzt`)
      const erste = store.state.value.einteilung
      expect(Object.keys(erste).sort()).toEqual(['par_1', 'par_2'])

      // Jetzt stehen Namen da: Abbrechen lässt sie stehen, Bestätigen ersetzt sie.
      const confirm = vi.fn(() => false)
      vi.stubGlobal('confirm', confirm)
      await block(wrapper).find('[data-action="beispielbesetzung"]').trigger('click')
      expect(confirm).toHaveBeenCalledOnce()
      expect(confirm.mock.calls[0]).toEqual([expect.stringContaining(`An ${gesamt} Listen stehen schon Namen`)])
      expect(store.state.value.einteilung).toBe(erste)
      confirm.mockReturnValue(true)
      await block(wrapper).find('[data-action="beispielbesetzung"]').trigger('click')
      expect(store.state.value.einteilung).not.toEqual(erste)
      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('Beispielgewichte: erst mit Startern; sind schon Gewichte da, erst nach Rückfrage', async () => {
      const wrapper = zeige()
      const knopf = () => block(wrapper).find('[data-action="beispielgewichte"]')
      expect(knopf().attributes('disabled')).toBeDefined()
      await setzeGesamt(wrapper, 48)
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      expect(block(wrapper).find('[data-hinweis="beispiel-gewichte"]').text()).toBe('0 von 48 gewogen')
      await knopf().trigger('click')
      expect(block(wrapper).find('[data-hinweis="beispiel-gewichte"]').text()).toBe('48 von 48 gewogen')
      const vorher = store.state.value.starters

      const confirm = vi.fn(() => false)
      vi.stubGlobal('confirm', confirm)
      await knopf().trigger('click')
      expect(confirm.mock.calls[0]).toEqual([expect.stringContaining('48 Starter sind schon gewogen')])
      expect(store.state.value.starters).toBe(vorher)
      confirm.mockReturnValue(true)
      await knopf().trigger('click')
      expect(store.state.value.starters.map((p) => p.gewicht)).not.toEqual(vorher.map((p) => p.gewicht))
      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('ersetzt vorhandene Starter erst nach Rückfrage', async () => {
      store.dispatch({ type: 'ADD_STARTERS', starters: [{ id: 'p1', startNr: '401', vorname: 'Vor', nachname: 'Nach', verein: '', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' }] })
      const confirm = vi.fn(() => false)
      vi.stubGlobal('confirm', confirm)
      const wrapper = zeige()
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      expect(confirm).toHaveBeenCalledOnce()
      expect(store.state.value.starters.map((p) => p.id)).toEqual(['p1'])
      expect(store.state.value.beispielStarter).toBe(false)
      vi.unstubAllGlobals()
      wrapper.unmount()
    })

    it('sind die Starter gelöscht, ist der Block beim nächsten Öffnen der Ansicht wieder zu', async () => {
      const wrapper = zeige()
      await block(wrapper).find('[data-action="beispielstarter"]').trigger('click')
      store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
      wrapper.unmount()
      const wieder = zeige()
      expect(offen(wieder)).toBe(false)
      wieder.unmount()
    })

    it('nach UIM nur die Klassen des Regelwerks, englisch beschriftet', async () => {
      store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
      setLocale('en')
      const wrapper = zeige()
      expect(block(wrapper).find('summary').text()).toBe('Sample data')
      expect(block(wrapper).findAll('.class-count .name').map((n) => n.text())).toEqual(['Dolphin', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'])
      wrapper.unmount()
    })
  })
})
