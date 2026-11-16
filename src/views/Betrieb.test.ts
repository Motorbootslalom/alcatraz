import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import BetriebView from './BetriebView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { reducer } from '../state/reducer'
import { setLocale } from '../i18n'
import { betriebsStand, betriebStarter, festgeschrieben } from '../testHilfen'
import type { AppState } from '../types'

// Reiter „Betrieb“: Start-Freigabe je Parcours am Bedienrechner. Alle Starter sind erfunden
// (Vor<id>/Nach<id>, Musterclub): Parcours 1 fährt e1, k1, e2, k2 (E und 1), Parcours 2 v1, f1, v2 (4 und 5).

const P1 = 'par_1'
const P2 = 'par_2'

let store: Store
let wrapper: VueWrapper | undefined

function betrieb(stand: AppState): VueWrapper {
  store.dispatch({ type: 'LOAD_STATE', state: stand })
  wrapper = mount(BetriebView, { attachTo: document.body, global: { provide: { [storeKey as symbol]: store } } })
  return wrapper
}

const karte = (w: VueWrapper, bereich = P1) => w.find(`.betrieb-karte[data-bereich="${bereich}"]`)
const knopf = async (w: VueWrapper, action: string, bereich = P1) => {
  await karte(w, bereich).find(`[data-action="${action}"]`).trigger('click')
  await nextTick()
}
const imBoot = (w: VueWrapper, bereich = P1) => karte(w, bereich).find('.betrieb-nr').text()
const text = (el: { text: () => string }) => el.text().replace(/\s+/g, ' ').trim()
const betriebVon = (bereich = P1) => store.state.value.betrieb.bereiche[bereich]

beforeEach(() => {
  localStorage.clear()
  setLocale('de')
  location.hash = '#/betrieb'
  store = createStore()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  store.beende()
  vi.restoreAllMocks()
  setLocale('de')
  location.hash = ''
})

describe('Betrieb: Start-Freigabe', () => {
  it('ohne festgeschriebene Verzahnung: nur der Weg dorthin, keine Bedienung', () => {
    const w = betrieb(betriebsStand())
    const hinweis = w.find('[data-hinweis="vor-verzahnung"]')
    expect(hinweis.exists()).toBe(true)
    expect(hinweis.find('a').attributes('href')).toBe('#/verzahnung')
    expect(w.find('.betrieb-karte').exists()).toBe(false)
    // Die Anzeigetafel lässt sich trotzdem schon aufstellen; die Einstellungen sind verlinkt.
    expect(w.find('[data-action="anzeige-oeffnen"]').exists()).toBe(true)
    expect(w.find('[data-verweis="anzeige-einstellungen"]').attributes('href')).toBe('#/einstellungen?anzeigetafel')
    // Der Unterreiter steht in der Adresse.
    expect(location.hash).toBe('#/betrieb/start')
  })

  it('ohne Starter: ein Hinweis', () => {
    const w = betrieb(festgeschrieben(betriebsStand([])))
    expect(w.find('.panel.empty').exists()).toBe(true)
    expect(w.find('.betrieb-karte').exists()).toBe(false)
  })

  it('Lauf beginnen, Nächster Start, Zurück – je Parcours eine Karte', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    expect(w.findAll('.betrieb-karte').map((k) => k.attributes('data-bereich'))).toEqual([P1, P2])
    expect(text(karte(w).find('[data-teil="stand"]'))).toBe('Noch kein Lauf begonnen.')
    expect(karte(w).find('[data-action="zeigen"]').attributes('disabled')).toBeDefined()
    expect(karte(w).find('[data-action="zurueck"]').attributes('disabled')).toBeDefined()

    expect(text(karte(w).find('[data-action="beginnen"]'))).toBe('Lauf 1 beginnen')
    await knopf(w, 'beginnen')
    expect(betriebVon()?.begonnen).toEqual(['lauf:1'])
    expect(text(karte(w).find('[data-teil="stand"]'))).toBe('Lauf 1 läuft · noch 4 Starts')
    expect(text(karte(w).find('[data-teil="naechster"]'))).toContain('E01 Vore1 Nache1')
    expect(text(karte(w).find('[data-teil="naechster"]'))).toContain('Klasse E · Lauf 1 · Musterclub')
    // Parcours 2 bleibt unberührt.
    expect(betriebVon(P2)).toBeUndefined()

    await knopf(w, 'zeigen')
    expect(imBoot(w)).toBe('E01')
    await knopf(w, 'zeigen')
    expect(imBoot(w)).toBe('101')
    expect(text(karte(w).find('[data-teil="vorig"]'))).toBe('davor: E01 · Klasse E · Lauf 1 · Vore1 Nache1')
    expect(text(karte(w).find('[data-teil="stand"]'))).toBe('Lauf 1 läuft · noch 2 Starts')

    await knopf(w, 'zurueck')
    expect(imBoot(w)).toBe('E01')
    expect(betriebVon()?.gezeigt.map((g) => g.ref)).toHaveLength(1)
  })

  it('Doppelklick auf „Nächster Start“ schaltet nur einmal (vorher = der Start im Boot)', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    await knopf(w, 'beginnen')
    const zeigen = karte(w).find('[data-action="zeigen"]')
    // Beide Klicks, bevor die Ansicht neu gezeichnet ist: Der zweite trägt denselben `vorher` und wirkt nicht.
    void zeigen.trigger('click')
    void zeigen.trigger('click')
    await flushPromises()
    expect(betriebVon()?.gezeigt).toHaveLength(1)
    expect(imBoot(w)).toBe('E01')
  })

  it('Ende eines Laufs: die Tafel bleibt stehen; „Lauf 2 beginnen“ fragt, solange Starts offen sind', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    await knopf(w, 'beginnen')
    await knopf(w, 'zeigen')
    // Noch 3 Starts offen: Rückfrage im Dialog; Abbrechen ändert nichts.
    expect(text(karte(w).find('[data-action="beginnen"]'))).toBe('Lauf 2 beginnen')
    await knopf(w, 'beginnen')
    expect(w.find('[data-dialog="beginnen"]').text()).toContain('noch 3 Starts offen')
    await w.find('[data-action="beginnen-nein"]').trigger('click')
    expect(w.find('[data-dialog="beginnen"]').exists()).toBe(false)
    expect(betriebVon()?.begonnen).toEqual(['lauf:1'])

    for (let i = 0; i < 3; i++) await knopf(w, 'zeigen')
    expect(imBoot(w)).toBe('102')
    expect(karte(w).find('[data-action="zeigen"]').attributes('disabled')).toBeDefined()
    expect(text(karte(w).find('[data-teil="naechster"]'))).toContain('Lauf 1 ist zu Ende – die Anzeigetafel bleibt auf dem letzten Start stehen.')
    // Nichts mehr offen: ohne Rückfrage.
    await knopf(w, 'beginnen')
    expect(w.find('[data-dialog="beginnen"]').exists()).toBe(false)
    expect(betriebVon()?.begonnen).toEqual(['lauf:1', 'lauf:2'])
    expect(imBoot(w)).toBe('102')
    expect(text(karte(w).find('[data-teil="naechster"]'))).toContain('E01')
  })

  it('mit Rückfrage: offene Starts bleiben freigegeben und kommen vor dem neuen Lauf', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    await knopf(w, 'beginnen')
    await knopf(w, 'beginnen')
    await w.find('[data-action="beginnen-ja"]').trigger('click')
    await nextTick()
    expect(betriebVon()?.begonnen).toEqual(['lauf:1', 'lauf:2'])
    expect(text(karte(w).find('[data-teil="stand"]'))).toBe('Lauf 2 läuft · noch 8 Starts')
    expect(text(karte(w).find('[data-teil="naechster"]'))).toContain('E01')
    expect(text(karte(w).find('[data-teil="naechster"]'))).toContain('Lauf 1')
  })

  it('Nachzuholen: eine Nachmeldung vor dem zuletzt gezeigten Start lässt sich gezielt zeigen', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    await knopf(w, 'beginnen')
    await knopf(w, 'zeigen')
    await knopf(w, 'zeigen')
    expect(karte(w).find('[data-teil="nachzuholen"]').exists()).toBe(false)
    store.dispatch({ type: 'ADD_STARTERS', starters: [betriebStarter('e0', 'E', 'E00')] })
    await nextTick()
    const liste = karte(w).find('[data-teil="nachzuholen"]')
    expect(liste.findAll('li .betrieb-start > *').map((e) => e.text())).toEqual(['E00', 'Vore0 Nache0', 'Klasse E · Lauf 1'])
    // Nie von selbst der Nächste.
    expect(text(karte(w).find('[data-teil="naechster"]'))).not.toContain('E00')
    await liste.find('[data-action="nachzuholen-zeigen"]').trigger('click')
    await nextTick()
    expect(imBoot(w)).toBe('E00')
    expect(karte(w).find('[data-teil="nachzuholen"]').exists()).toBe(false)
  })

  it('Starter im Boot gelöscht: „Nächster Start“ und „Zurück“ gehen weiter (Prüfung E1)', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    await knopf(w, 'beginnen')
    await knopf(w, 'zeigen')
    expect(imBoot(w)).toBe('E01')
    // Vor dem ersten Wert ist Löschen erlaubt – der übliche Weg für einen, der nicht erscheint.
    store.dispatch({ type: 'REMOVE_STARTER', id: 'e1' })
    await nextTick()
    expect(karte(w).find('[data-teil="geloescht"]').exists()).toBe(true)
    expect(karte(w).find('[data-action="zurueck"]').attributes('disabled')).toBeUndefined()
    const naechster = text(karte(w).find('[data-teil="naechster"] b'))
    await knopf(w, 'zeigen')
    expect(betriebVon()?.gezeigt).toHaveLength(2)
    expect(imBoot(w)).toBe(naechster)
    await knopf(w, 'zurueck')
    await knopf(w, 'zurueck')
    expect(betriebVon()?.gezeigt).toHaveLength(0)
  })

  it('Verzahnung mitten im Betrieb gelöst: Karten bleiben, nur „Nächster Start“ und „beginnen“ ruhen', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    await knopf(w, 'beginnen')
    await knopf(w, 'zeigen')
    await knopf(w, 'zeigen')
    await karte(w).find('[data-meldung-text]').setValue('Pause')
    await karte(w).find('[data-meldung-art="pause"]').trigger('click')
    await knopf(w, 'meldung-setzen')
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: false })
    await nextTick()
    expect(text(w.find('[data-hinweis="vor-verzahnung"]'))).toContain('nicht mehr festgeschrieben')
    expect(karte(w).find('[data-action="zeigen"]').attributes('disabled')).toBeDefined()
    expect(karte(w).find('[data-action="beginnen"]').attributes('disabled')).toBeDefined()
    // Meldung löschen und Zurück gehen weiter.
    await knopf(w, 'meldung-loeschen')
    expect(betriebVon()?.meldung ?? null).toBeNull()
    await knopf(w, 'zurueck')
    expect(imBoot(w)).toBe('E01')
    // Parcours 2 hatte nichts – auch seine Karte steht da, aber ohne Bedienung.
    expect(karte(w, P2).find('[data-action="zeigen"]').attributes('disabled')).toBeDefined()
  })

  it('Meldung: setzen (Art wählbar), auf allen Parcours, löschen', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    const k = karte(w)
    await k.find('[data-meldung-text]').setValue('Kurze Störung – gleich geht es weiter')
    await k.find('[data-meldung-art="stoerung"]').trigger('click')
    await knopf(w, 'meldung-setzen')
    expect(betriebVon()?.meldung).toEqual({ text: 'Kurze Störung – gleich geht es weiter', art: 'stoerung' })
    expect(betriebVon(P2)).toBeUndefined()
    expect(text(karte(w).find('[data-teil="meldung-aktiv"]'))).toBe('Auf der Anzeigetafel (Störung): „Kurze Störung – gleich geht es weiter“')

    await karte(w).find('[data-meldung-art="pause"]').trigger('click')
    await karte(w).find('[data-meldung-text]').setValue('Mittagspause')
    await knopf(w, 'meldung-alle')
    expect([betriebVon()?.meldung, betriebVon(P2)?.meldung]).toEqual([
      { text: 'Mittagspause', art: 'pause' },
      { text: 'Mittagspause', art: 'pause' },
    ])
    // Der Entwurf auf Parcours 2 folgt, solange dort nichts getippt ist.
    expect((karte(w, P2).find('[data-meldung-text]').element as HTMLTextAreaElement).value).toBe('Mittagspause')

    await knopf(w, 'meldung-loeschen')
    expect(betriebVon()?.meldung ?? null).toBeNull()
    expect(betriebVon(P2)?.meldung).toEqual({ text: 'Mittagspause', art: 'pause' })
  })

  it('„Anzeigetafel öffnen“: eigenes Fenster mit #/anzeige – gemeinsam oder je Parcours', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const w = betrieb(festgeschrieben(betriebsStand()))
    await w.find('[data-action="anzeige-oeffnen"]').trigger('click')
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/#\/anzeige$/), 'alcatraz-anzeige')
    await knopf(w, 'anzeige-oeffnen-bereich', P2)
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/#\/anzeige\/par_2$/), 'alcatraz-anzeige-par_2')
    // Englische Oberfläche: englische Adresse.
    setLocale('en')
    await nextTick()
    await w.find('[data-action="anzeige-oeffnen"]').trigger('click')
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/#\/display$/), 'alcatraz-anzeige')
  })

  it('„Betrieb zurücksetzen“ nach Rückfrage – Starter, Verzahnung und Werte bleiben', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    expect(w.find('[data-action="betrieb-zuruecksetzen"]').exists()).toBe(false)
    await knopf(w, 'beginnen')
    await knopf(w, 'zeigen')
    await w.find('[data-action="betrieb-zuruecksetzen"]').trigger('click')
    await w.find('[data-action="zuruecksetzen-nein"]').trigger('click')
    expect(betriebVon()?.gezeigt).toHaveLength(1)
    await w.find('[data-action="betrieb-zuruecksetzen"]').trigger('click')
    await w.find('[data-action="zuruecksetzen-ja"]').trigger('click')
    await nextTick()
    expect(store.state.value.betrieb).toEqual({ bereiche: {} })
    expect(store.state.value.verzahnungLocked).toBe(true)
    expect(store.state.value.starters).toHaveLength(7)
    expect(text(karte(w).find('[data-teil="imboot"]'))).toContain('Noch kein Start gezeigt.')
  })

  it('englische Oberfläche; UIM mit „Versuche direkt nacheinander“: ein Punkt für alle Versuche', async () => {
    setLocale('en')
    const w = betrieb(festgeschrieben(reducer(betriebsStand(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })))
    expect(text(karte(w).find('[data-action="beginnen"]'))).toBe('Begin attempt 1')
    expect(text(karte(w).find('[data-action="zeigen"]'))).toBe('Next start')
    // Der Name des Parcours steht in der Sprache der Tafel (UIM: englisch).
    expect(karte(w).find('h3').text()).toBe('Course 1')
    store.dispatch({ type: 'SET_VERSUCHE_NACHEINANDER', on: true })
    await nextTick()
    expect(text(karte(w).find('[data-action="beginnen"]'))).toBe('Begin attempts 1–2')
    await knopf(w, 'beginnen')
    expect(text(karte(w).find('[data-teil="stand"]'))).toBe('Attempts 1–2 in progress · 8 starts to go')
    await knopf(w, 'zeigen')
    await knopf(w, 'zeigen')
    // Starterweise: derselbe Starter im zweiten Versuch direkt danach.
    expect(imBoot(w)).toBe('E01')
    expect(text(karte(w).find('[data-teil="imboot"]'))).toContain('Class Dolphin · Attempt 2')
  })
})

