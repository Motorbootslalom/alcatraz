import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ClassSection from './ClassSection.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import type { Starter } from '../types'

// Sobald Ergebnisse erfasst sind, steht das Starterfeld fest: „Klasse leeren“ und das Hinzufügen
// von Hand sind gesperrt; Angaben ändern geht weiter. Das × entfernt dann nicht mehr, sondern
// erklärt, warum, und bietet an, den Starter als nicht gestartet einzutragen. Alle Starter sind erfunden.

const starter = (n: number): Starter => ({ id: `p${n}`, startNr: `40${n}`, vorname: `Vor${n}`, nachname: `Nach${n}`, verein: 'Musterclub', bundesland: '', geburtsdatum: '', klasse: '4', groesse: '' })

describe('Starterfeld mit erfassten Werten', () => {
  let store: Store
  const confirm = vi.fn(() => true)
  const ansicht = () =>
    mount(ClassSection, {
      props: { classId: '4', starters: store.state.value.starters, duplicates: new Set<string>(), open: true, sortTick: 0 },
      global: { provide: { [storeKey as symbol]: store } },
    })

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    confirm.mockReset().mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    store = createStore()
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter(1), starter(2)] })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ohne erfasste Werte: Das × entfernt mit einem Klick, von Hand hinzufügen geht', async () => {
    const wrapper = ansicht()
    expect(wrapper.find('[data-action="starter-neu"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-action="klasse-leeren"]').attributes('disabled')).toBeUndefined()
    await wrapper.findAll('button.del')[1].trigger('click')
    expect(confirm).not.toHaveBeenCalled()
    expect(store.state.value.starters.map((p) => p.id)).toEqual(['p1'])
    wrapper.unmount()
  })

  it('mit erfassten Werten sind „Klasse leeren“ und „von Hand“ gesperrt; das × entfernt nicht, sondern öffnet die Meldung', async () => {
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    const wrapper = ansicht()
    const knoepfe = wrapper.findAll('button.del')
    expect(knoepfe).toHaveLength(2)
    // Auch der Starter ohne eigene Werte bleibt: Die Listen sind gedruckt.
    for (const k of knoepfe) {
      expect(k.attributes('disabled')).toBeUndefined()
      await k.trigger('click')
      expect(wrapper.find('[data-dialog="abmelden"]').exists()).toBe(true)
      await wrapper.find('[data-action="dialog-abbrechen"]').trigger('click')
      expect(wrapper.find('[data-dialog="abmelden"]').exists()).toBe(false)
    }
    expect(store.state.value.abgemeldet).toEqual([])
    const leeren = wrapper.find('[data-action="klasse-leeren"]')
    expect(leeren.attributes('disabled')).toBeDefined()
    await leeren.trigger('click')
    expect(wrapper.find('[data-action="starter-neu"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('form.add-form').exists()).toBe(false)
    expect(confirm).not.toHaveBeenCalled()
    expect(store.state.value.starters).toHaveLength(2)
    expect(store.state.value.eingaben['manoevrieren/1']).toEqual({ p1: { zeit1: '80' } })
    wrapper.unmount()
  })

  it('das Angebot trägt das X in jedem Lauf ohne Werte ein, nennt die Läufe mit Werten und lässt sie stehen', async () => {
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    const vorher = store.state.value.eingaben['manoevrieren/1']
    const wrapper = ansicht()
    await wrapper.findAll('button.del')[0].trigger('click')
    const dialog = wrapper.find('[data-dialog="abmelden"]')
    expect(dialog.text()).toContain('401')
    expect(dialog.text()).toContain('lässt sich nicht mehr entfernen')
    expect(dialog.text()).toContain('Der Wettkampf hat schon angefangen')
    expect(dialog.find('[data-plan="frei"]').text()).toBe('Die Läufe 2, 3 bekommen das X.')
    expect(dialog.find('[data-plan="belegt"]').text()).toContain('Lauf 1 hat schon erfasste Werte und bleibt, wie er ist.')
    await dialog.find('[data-action="abmelden-bestaetigen"]').trigger('click')

    expect(wrapper.find('[data-dialog="abmelden"]').exists()).toBe(false)
    expect(store.state.value.abgemeldet).toEqual(['p1'])
    expect(store.state.value.eingaben['manoevrieren/1']).toBe(vorher)
    expect(store.state.value.eingaben['manoevrieren/2']).toEqual({ p1: { 'disq@steg': 'X' } })
    expect(store.state.value.eingaben['manoevrieren/3']).toEqual({ p1: { 'disq@steg': 'X' } })
    // Die Zeile ist gekennzeichnet, und statt des × steht der Weg zurück.
    const zeile = wrapper.find('tr[data-abgemeldet]')
    expect(zeile.text()).toContain('nicht gestartet')
    expect(zeile.find('[data-action="starter-anmelden"]').exists()).toBe(true)
    expect(wrapper.findAll('tr[data-abgemeldet]')).toHaveLength(1)

    // Zurücknehmen: nach Rückfrage, entfernt das X wieder; Lauf 1 bleibt.
    await zeile.find('[data-action="starter-anmelden"]').trigger('click')
    const zurueck = wrapper.find('[data-dialog="anmelden"]')
    expect(zurueck.text()).toContain('wird in den Läufen 2, 3 entfernt')
    await zurueck.find('[data-action="anmelden-bestaetigen"]').trigger('click')
    expect(store.state.value.abgemeldet).toEqual([])
    expect(store.state.value.eingaben).toEqual({ 'manoevrieren/1': { p1: { zeit1: '80' } } })
    expect(wrapper.find('tr[data-abgemeldet]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('Angaben eines Starters lassen sich weiter ändern', async () => {
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    const wrapper = ansicht()
    await wrapper.findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    const feld = wrapper.find('input.cell-input')
    await feld.setValue('Berichtigt')
    expect(store.state.value.starters[0].nachname).toBe('Berichtigt')
    wrapper.unmount()
  })
})

describe('Jahrgang und Klasse', () => {
  let store: Store
  const ansicht = () =>
    mount(ClassSection, {
      props: { classId: '4', starters: store.state.value.starters, duplicates: new Set<string>(), open: true, sortTick: 0 },
      global: { provide: { [storeKey as symbol]: store } },
    })
  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventJahr: 2026 } })
    store.dispatch({ type: 'ADD_STARTERS', starters: [starter(1)] })
  })

  it('von Hand hinzufügen: Ein Geburtsjahr, das nicht in die Klasse gehört, wird abgewiesen – mit Hinweis', async () => {
    const wrapper = ansicht()
    await wrapper.find('[data-action="starter-neu"]').trigger('click')
    const form = wrapper.find('form.add-form')
    const [vorname, nachname] = form.findAll('input.input')
    await vorname.setValue('Neu')
    await nachname.setValue('Dabei')
    const datum = form.find('input[data-datum]')
    // Klasse 4 im Jahr 2026: zu jung.
    await datum.setValue('05.05.2019')
    expect(form.find('[data-hinweis="jahrgang-falsch"]').text()).toContain('Geburtsjahr 2019 passt nicht zu Klasse 4')
    expect(form.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await form.trigger('submit')
    expect(store.state.value.starters).toHaveLength(1)
    // Ein passender Jahrgang geht.
    const [von] = form.find('label[for="add-bd-4"]').text().match(/\d{4}/)!
    await datum.setValue(`05.05.${von}`)
    expect(form.find('[data-hinweis="jahrgang-falsch"]').exists()).toBe(false)
    await form.trigger('submit')
    expect(store.state.value.starters.map((p) => p.nachname)).toEqual(['Nach1', 'Dabei'])
    expect(store.state.value.starters[1].geburtsdatum).toBe(`${von}-05-05`)
    wrapper.unmount()
  })

  it('von Hand hinzufügen: Passt der Jahrgang zu einer anderen Klasse, legt „In Klasse X anlegen“ den Starter mit allen Angaben dort an', async () => {
    const wrapper = ansicht()
    await wrapper.find('[data-action="starter-neu"]').trigger('click')
    const form = wrapper.find('form.add-form')
    const [vorname, nachname, herkunft] = form.findAll('input.input')
    await vorname.setValue('Vor9')
    await nachname.setValue('Nach9')
    await herkunft.setValue('Musterclub')
    await form.find('select').setValue('M')
    // 2026 − 2019 = 7 Jahre: Klasse E.
    await form.find('input[data-datum]').setValue('05.05.2019')
    const knopf = form.find('[data-action="in-klasse-anlegen"]')
    expect(knopf.text()).toBe('In Klasse E anlegen')
    expect(knopf.attributes('data-klasse')).toBe('E')
    await knopf.trigger('click')
    const neu = store.state.value.starters[1]
    expect(neu).toMatchObject({ vorname: 'Vor9', nachname: 'Nach9', verein: 'Musterclub', geburtsdatum: '2019-05-05', klasse: 'E', groesse: 'M', startNr: 'E01' })
    expect(wrapper.find('form.add-form').exists()).toBe(false)
    expect(wrapper.find('[data-hinweis="in-anderer-klasse"]').text()).toBe('Vor9 Nach9 ist in Klasse E angelegt.')
    expect(wrapper.emitted('oeffne')).toEqual([['E']])
    wrapper.unmount()
  })

  it('passt der Jahrgang in keine Klasse, nennt die Meldung die Jahrgänge, die überhaupt starten – ohne Knopf', async () => {
    const wrapper = ansicht()
    await wrapper.find('[data-action="starter-neu"]').trigger('click')
    const form = wrapper.find('form.add-form')
    // DM 2026: Klasse E bis 7 = 6 bis 27 Jahre.
    await form.find('input[data-datum]').setValue('2023-01-01')
    const hinweis = form.find('[data-hinweis="jahrgang-falsch"]')
    expect(hinweis.text()).toContain('Der Jahrgang passt in keine Klasse: Es starten die Jahrgänge 1999–2020.')
    expect(hinweis.find('button').exists()).toBe(false)
    wrapper.unmount()
  })

  it('das Datumsfeld liest 2012-05-03, 3.5.2012 und 03/05/2012 (Schrägstrich: Tag zuerst) und meldet ein Datum, das es nicht gibt', async () => {
    const wrapper = ansicht()
    await wrapper.find('[data-action="starter-neu"]').trigger('click')
    const form = wrapper.find('form.add-form')
    const [vorname, nachname] = form.findAll('input.input')
    await vorname.setValue('Vor5')
    await nachname.setValue('Nach5')
    const datum = form.find('input[data-datum]')
    expect(datum.attributes('type')).toBe('text')
    expect(datum.attributes('placeholder')).toBe('TT.MM.JJJJ')
    for (const text of ['2012-05-03', '3.5.2012', '03/05/2012', '2012-5-3']) {
      await datum.setValue(text)
      await datum.trigger('change')
      // Bestätigt, steht es im Muster der Oberfläche da.
      expect((datum.element as HTMLInputElement).value).toBe('03.05.2012')
    }
    await datum.setValue('31.02.2012')
    await datum.trigger('change')
    expect(form.find('[data-hinweis="datum-ungueltig"]').text()).toBe('Kein gültiges Datum: Den 31.02.2012 gibt es nicht.')
    expect(datum.attributes('aria-invalid')).toBe('true')
    expect(form.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    await form.trigger('submit')
    expect(store.state.value.starters).toHaveLength(1)
    // Monat/Tag gilt nie – die Meldung sagt, warum.
    await datum.setValue('05/31/2012')
    await datum.trigger('change')
    expect(form.find('[data-hinweis="datum-ungueltig"]').text()).toContain('mit Schrägstrich steht immer der Tag vorn')
    await datum.setValue('31/05/2012')
    expect(form.find('[data-hinweis="datum-ungueltig"]').exists()).toBe(false)
    await form.trigger('submit')
    expect(store.state.value.starters[1].geburtsdatum).toBe('2012-05-31')
    wrapper.unmount()
  })

  it('nirgends die Datumswahl des Browsers – englisch steht das Datum als yyyy-mm-dd da', async () => {
    store.dispatch({ type: 'UPDATE_STARTER', id: 'p1', patch: { geburtsdatum: '2012-05-03' } })
    const wrapper = ansicht()
    await wrapper.find('[data-action="starter-neu"]').trigger('click')
    await wrapper.findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    expect(wrapper.findAll('input[type="date"]')).toHaveLength(0)
    const zelle = wrapper.find('input[data-datum].cell-input')
    expect((zelle.element as HTMLInputElement).value).toBe('03.05.2012')
    setLocale('en')
    await wrapper.vm.$nextTick()
    expect((zelle.element as HTMLInputElement).value).toBe('2012-05-03')
    expect(zelle.attributes('placeholder')).toBe('yyyy-mm-dd')
    // Auch englisch: Schrägstrich heißt Tag zuerst.
    await zelle.setValue('02/05/2012')
    await zelle.trigger('change')
    expect(store.state.value.starters[0].geburtsdatum).toBe('2012-05-02')
    // Wie im Reiter: Die Klasse bekommt den neuen Stand herein, das Feld zeigt ihn.
    await wrapper.setProps({ starters: store.state.value.starters })
    expect((zelle.element as HTMLInputElement).value).toBe('2012-05-02')
    setLocale('de')
    wrapper.unmount()
  })

  it('Bearbeiten: Ein Geburtsdatum mit falschem Jahrgang wird nicht übernommen – „In Klasse X verschieben“ verschiebt mit dem neuen Datum', async () => {
    const wrapper = ansicht()
    await wrapper.findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    const datum = wrapper.find('input[data-datum].cell-input')
    await datum.setValue('05.05.2019')
    await datum.trigger('change')
    await flushPromises()
    expect(store.state.value.starters[0].geburtsdatum).toBe('')
    expect((datum.element as HTMLInputElement).value).toBe('')
    const hinweis = wrapper.find('[data-hinweis="jahrgang-falsch"]')
    expect(hinweis.text()).toContain('Geburtsjahr 2019')
    const knopf = hinweis.find('[data-action="in-klasse-verschieben"]')
    expect(knopf.text()).toBe('In Klasse E verschieben')
    expect(knopf.attributes('title')).toContain('Startnummer wird dort neu vergeben')
    await knopf.trigger('click')
    expect(store.state.value.starters[0]).toMatchObject({ klasse: 'E', geburtsdatum: '2019-05-05', startNr: 'E01' })
    expect(wrapper.find('[data-hinweis="in-anderer-klasse"]').text()).toBe('Vor1 Nach1 steht jetzt in Klasse E, mit der Startnummer E01.')
    expect(wrapper.emitted('oeffne')).toEqual([['E']])
    wrapper.unmount()
  })

  it('Bearbeiten: Ein Datum, das es nicht gibt, wird nicht übernommen – die Meldung nennt den Starter, das Feld zeigt wieder das alte', async () => {
    store.dispatch({ type: 'UPDATE_STARTER', id: 'p1', patch: { geburtsdatum: '2012-05-03' } })
    const wrapper = ansicht()
    await wrapper.findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    const datum = wrapper.find('input[data-datum].cell-input')
    await datum.setValue('31.02.2012')
    await datum.trigger('change')
    await flushPromises()
    expect(store.state.value.starters[0].geburtsdatum).toBe('2012-05-03')
    expect((datum.element as HTMLInputElement).value).toBe('03.05.2012')
    expect(wrapper.find('[data-hinweis="jahrgang-falsch"]').text()).toBe('Nicht übernommen für Vor1 Nach1 – Kein gültiges Datum: Den 31.02.2012 gibt es nicht.')
    wrapper.unmount()
  })

  it('Bearbeiten: Ist die Klasse festgeschrieben oder sind Ergebnisse erfasst, ist Verschieben gesperrt – mit Grund', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const wrapper = ansicht()
    await wrapper.findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    const datum = wrapper.find('input[data-datum].cell-input')
    await datum.setValue('05.05.2019')
    await datum.trigger('change')
    const knopf = wrapper.find('[data-action="in-klasse-verschieben"]')
    expect(knopf.attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-hinweis="verschieben-gesperrt"]').text()).toContain('Die Verzahnung bzw. der Startplan ist festgeschrieben')
    expect(wrapper.find('[data-hinweis="verschieben-gesperrt"] a').attributes('href')).toBe('#/verzahnung')
    // Auch der Reducer lehnt ab.
    const vorher = store.state.value
    store.dispatch({ type: 'MOVE_STARTER_TO_CLASS', id: 'p1', klasse: 'E', geburtsdatum: '2019-05-05' })
    expect(store.state.value).toBe(vorher)
    wrapper.unmount()

    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: false })
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'p1', feld: 'zeit1', wert: '80' }] })
    const danach = ansicht()
    await danach.findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    const feld = danach.find('input[data-datum].cell-input')
    await feld.setValue('05.05.2019')
    await feld.trigger('change')
    expect(danach.find('[data-action="in-klasse-verschieben"]').attributes('disabled')).toBeDefined()
    expect(danach.find('[data-hinweis="verschieben-gesperrt"]').text()).toBe('Verschieben geht nicht mehr: Es sind schon Ergebnisse erfasst.')
    const stand = store.state.value
    store.dispatch({ type: 'MOVE_STARTER_TO_CLASS', id: 'p1', klasse: 'E' })
    expect(store.state.value).toBe(stand)
    danach.unmount()
  })

  it('Verschieben: klassische Startnummern bleiben, klassenbasierte schließen in der neuen Klasse an', () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: [{ ...starter(2), id: 'e1', startNr: 'E03', klasse: 'E' }] })
    store.dispatch({ type: 'MOVE_STARTER_TO_CLASS', id: 'p1', klasse: 'E', geburtsdatum: '2019-05-05' })
    expect(store.state.value.starters.find((p) => p.id === 'p1')!.startNr).toBe('E04')
    store.dispatch({ type: 'SET_START_NR_MODE', mode: 'klassisch' })
    store.dispatch({ type: 'UPDATE_STARTER', id: 'e1', patch: { startNr: '17' } })
    store.dispatch({ type: 'MOVE_STARTER_TO_CLASS', id: 'e1', klasse: '1' })
    expect(store.state.value.starters.find((p) => p.id === 'e1')).toMatchObject({ klasse: '1', startNr: '17' })
  })

  it('die Klasse eines Starters lässt sich nicht mehr ändern, sobald Verzahnung bzw. Startplan festgeschrieben sind (Reducer)', () => {
    store.dispatch({ type: 'UPDATE_STARTER', id: 'p1', patch: { klasse: '5' } })
    expect(store.state.value.starters[0].klasse).toBe('5')
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const vorher = store.state.value
    store.dispatch({ type: 'UPDATE_STARTER', id: 'p1', patch: { klasse: '4' } })
    expect(store.state.value).toBe(vorher)
    // Die übrigen Angaben desselben Patches gelten weiter.
    store.dispatch({ type: 'UPDATE_STARTER', id: 'p1', patch: { klasse: '4', nachname: 'Berichtigt' } })
    expect([store.state.value.starters[0].klasse, store.state.value.starters[0].nachname]).toEqual(['5', 'Berichtigt'])
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: false })
    store.dispatch({ type: 'UPDATE_STARTER', id: 'p1', patch: { klasse: '4' } })
    expect(store.state.value.starters[0].klasse).toBe('4')
  })
})

describe('Geschlecht im Starter-Reiter', () => {
  let store: Store
  const ansicht = () =>
    mount(ClassSection, {
      props: { classId: '4', starters: store.state.value.starters, duplicates: new Set<string>(), open: true, sortTick: 0 },
      global: { provide: { [storeKey as symbol]: store } },
    })
  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'ADD_STARTERS', starters: [{ ...starter(1), geschlecht: 'F' }, { ...starter(2), geschlecht: 'nA' }] })
  })
  afterEach(() => setLocale('de'))

  it('die Kürzel folgen der Sprache der Oberfläche – gespeichert bleibt M, F, D, nA (Entscheidung des Nutzers vom 15.11.2026)', async () => {
    const zellen = (w: ReturnType<typeof ansicht>) => w.findAll('td[data-spalte="geschlecht"]').map((td) => td.text())
    const deutsch = ansicht()
    expect(zellen(deutsch)).toEqual(['W', 'k. A.'])
    await deutsch.findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    const auswahl = deutsch.find('select[data-feld="geschlecht"]')
    expect(auswahl.findAll('option').map((o) => [o.attributes('value'), o.text()])).toEqual([['', '–'], ['M', 'M'], ['F', 'W'], ['D', 'D'], ['nA', 'k. A.']])
    await auswahl.setValue('D')
    expect(store.state.value.starters[0].geschlecht).toBe('D')
    deutsch.unmount()

    setLocale('en')
    const englisch = ansicht()
    expect(zellen(englisch)).toEqual(['D', 'n/a'])
    await englisch.findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    expect(englisch.find('select[data-feld="geschlecht"]').findAll('option').map((o) => o.text())).toEqual(['–', 'M', 'F', 'D', 'n/a'])
    englisch.unmount()
  })

  it('der Hinweis am Feld nennt die deutschen Kürzel als die der Oberfläche – eine deutsche Liste mit Geschlecht gibt es nicht', async () => {
    // Geschlecht steht nur auf der Liste nach Pkt. 3.7, und die gibt es nur unter UIM, also englisch.
    setLocale('en')
    const englisch = ansicht()
    await englisch.findAll('button').find((b) => b.text().includes('✎'))!.trigger('click')
    const hinweis = englisch.find('select[data-feld="geschlecht"]').attributes('title') ?? ''
    expect(hinweis).toContain('In the German interface M, W, D, k. A.')
    expect(hinweis).not.toMatch(/German lists?/i)
    englisch.unmount()
  })
})
