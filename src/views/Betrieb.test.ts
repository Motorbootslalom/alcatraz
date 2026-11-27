import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import BetriebView from './BetriebView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { reducer } from '../state/reducer'
import { setLocale } from '../i18n'
import { vergissAlles } from '../lib/merken'
import { refKey } from '../betrieb/folge'
import { sichtOeffentlich } from '../betrieb/sicht'
import { betriebsStand, betriebStarter, festgeschrieben, uimParallelStand, zeigeNaechsten } from '../testHilfen'
import type { AppState, ClassId } from '../types'

// Reiter „Betrieb“: Start-Freigabe je Parcours am Bedienrechner. Alle Starter sind erfunden
// (Vor<id>/Nach<id>, Musterclub): Parcours 1 fährt e1, k1, e2, k2 (E und 1), Parcours 2 v1, f1, v2 (4 und 5).

const P1 = 'par_1'
const P2 = 'par_2'
const m = (starter: string, lauf: number) => refKey({ art: 'm', starter, lauf })

/**
 * Nur Parcours 1 mit eigener Spur-Anordnung, festgeschrieben, noch nichts begonnen: `{ E: 2, '1': 6 }` → Starter
 * kE1, kE2, k11 … mit den Nummern E01, E02, 101 … (wie betrieb/schritte.test.ts).
 */
function klassenStand(zahlen: Partial<Record<ClassId, number>>, spuren: ClassId[][], laeufe = 1): AppState {
  const starter = (Object.entries(zahlen) as [ClassId, number][]).flatMap(([klasse, n]) =>
    Array.from({ length: n }, (_, i) => betriebStarter(`k${klasse}${i + 1}`, klasse, `${klasse}${String(i + 1).padStart(2, '0')}`)),
  )
  let s = betriebsStand(starter)
  s = reducer(s, { type: 'SET_PARCOURS_CLASSES', id: P2, classIds: [] })
  s = reducer(s, { type: 'SET_PARCOURS_CLASSES', id: P1, classIds: Object.keys(zahlen) as ClassId[] })
  s = reducer(s, { type: 'SET_EVENT', patch: { laufCount: laeufe } })
  s = reducer(s, { type: 'SET_PARCOURS_FACTOR', id: P1, wechselFaktor: spuren.length as 1 | 2 | 3 | 4 })
  const tracks = spuren.map((spur) => spur.map((klasse) => ({ kind: 'class' as const, klasse })))
  return reducer(s, { type: 'SET_VERZAHNUNG_LOCK', locked: true, tracks: { [P1]: tracks } })
}
/** Das Beispiel aus dem Lastenheft (V-5): Spur 1 fährt E, 1, 3; Spur 2 fährt 2, 6 → E2E21212121216163. */
const v5 = (laeufe = 1) => klassenStand({ E: 2, '1': 6, '2': 6, '3': 1, '6': 2 }, [['E', '1', '3'], ['2', '6']], laeufe)

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
/** Die Folge, wie sie die Start-Freigabe unter den Klassen zeigt (B-9): je Start die Klasse. */
const vorschau = (w: VueWrapper, bereich = P1) =>
  karte(w, bereich)
    .findAll('[data-teil="vorschau"] .class-badge')
    .map((b) => b.text())
    .join('')
/** Die offenen Starts in ihrer Folge, wie die Sicht sie führt. */
const waehlbar = (bereich = P1) => sichtOeffentlich(store.state.value).bereiche.find((b) => b.id === bereich)!.waehlbar.map((x) => x.key)
/** Eine Zeile der Wahl „Anderen Starter wählen“ (Kennungen enthalten Anführungszeichen). */
const zeileVon = (w: VueWrapper, key: string) => karte(w).find(`[data-teil="folge"] li[data-start='${key}']`)
/** Alles außer dem Betrieb: Verzahnung, Starter, Werte, Einstellungen – das ändern Betriebsschritte nie. */
const ohneBetrieb = (s: AppState) => {
  const { betrieb: _betrieb, ...rest } = s
  return rest
}

beforeEach(() => {
  localStorage.clear()
  // Aufgeklappte Teile der Karte merkt sich das Fenster (lib/merken.ts) – jeder Test beginnt zugeklappt.
  vergissAlles()
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
    expect(text(w.find('[data-hinweis="vor-verzahnung"]'))).toContain('die Folge umstellen')
    expect(karte(w).find('[data-action="zeigen"]').attributes('disabled')).toBeDefined()
    expect(karte(w).find('[data-action="beginnen"]').attributes('disabled')).toBeDefined()
    // Auch die Schritte der Folge (E2) ruhen: zurückstellen, anderen wählen, Klassen, einsteigen.
    for (const a of ['zurueckstellen', 'wahl', 'aussetzen', 'vorziehen', 'einsteigen'])
      for (const el of karte(w).findAll(`[data-action="${a}"]`)) expect(el.attributes('disabled'), a).toBeDefined()
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
    expect(['zurueckstellen', 'wahl'].map((a) => text(karte(w).find(`[data-action="${a}"]`)))).toEqual(['Hold back', 'Choose another driver'])
    expect(karte(w).find('[data-teil="klassen"] summary').text()).toBe('Classes · boat missing')
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

describe('Betrieb: Steuerung an der Start-Freigabe (E2)', () => {
  it('Zurückstellen (B-3): der Nächste fährt vorerst nicht, bleibt sichtbar; „Als Nächster“, „Ans Ende des Laufs“, „Jetzt zeigen“ (B-4)', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    await knopf(w, 'beginnen')
    await knopf(w, 'zurueckstellen')
    expect(betriebVon()?.zurueckgestellt).toEqual([m('e1', 1)])
    const liste = () => karte(w).find('[data-teil="zurueckgestellt"]')
    expect(liste().findAll('li .betrieb-start > *').map((e) => e.text())).toEqual(['E01', 'Vore1 Nache1', 'Klasse E · Lauf 1'])
    expect(text(karte(w).find('[data-teil="naechster"] b'))).toBe('101')

    await liste().find('[data-action="einreihen-naechster"]').trigger('click')
    expect(betriebVon()?.zurueckgestellt).toEqual([])
    expect(liste().exists()).toBe(false)
    expect(text(karte(w).find('[data-teil="naechster"] b'))).toBe('E01')

    // Ans Ende des Laufs: hinter den letzten Start von Lauf 1.
    await knopf(w, 'zurueckstellen')
    await liste().find('[data-action="einreihen-ende"]').trigger('click')
    expect(sichtOeffentlich(store.state.value).bereiche[0].offen.map((o) => o.key)).toEqual([m('k1', 1), m('e2', 1), m('k2', 1), m('e1', 1)])

    // Gezielt zeigen holt einen Zurückgestellten auf die Anzeigetafel; der Nächste bleibt.
    await knopf(w, 'zurueckstellen')
    await liste().find('[data-action="zurueckgestellt-zeigen"]').trigger('click')
    await nextTick()
    expect(imBoot(w)).toBe('101')
    expect(betriebVon()?.zurueckgestellt).toEqual([])
    expect(text(karte(w).find('[data-teil="naechster"] b'))).toBe('E02')
  })

  it('Anderen Starter wählen (B-5, S-4): die nächsten, auch aus nicht begonnenen Läufen (gekennzeichnet); Suche; Zeigen schließt die Wahl', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    await knopf(w, 'beginnen')
    expect(karte(w).find('[data-teil="folge"]').exists()).toBe(false)
    await knopf(w, 'wahl')
    const folge = karte(w).find('[data-teil="folge"]')
    // Alle zwölf offenen Starts der drei Läufe; Lauf 2 und 3 warten auf ihren Beginn.
    expect(folge.findAll('li[data-start]')).toHaveLength(12)
    expect(folge.find('[data-action="folge-ganz"]').exists()).toBe(false)
    expect(zeileVon(w, m('e1', 1)).find('[data-teil="vermerk"]').exists()).toBe(false)
    expect(text(zeileVon(w, m('e1', 2)).find('[data-teil="vermerk"]'))).toBe('wartet, bis Lauf 2 beginnt')
    // Das Suchfeld hat den Fokus: Nummer tippen.
    expect(document.activeElement).toBe(folge.find('[data-feld="suche"]').element)

    await folge.find('[data-feld="suche"]').setValue('102')
    expect(folge.findAll('li[data-start]').map((li) => li.attributes('data-start'))).toEqual([m('k2', 1), m('k2', 2), m('k2', 3)])
    // Drei Treffer desselben Starters: markiert ist sein Start im laufenden Lauf – den zeigte die Eingabetaste.
    expect(folge.findAll('li.enter-ziel').map((li) => li.attributes('data-start'))).toEqual([m('k2', 1)])
    // Mehrere Starter („10“ passt auf 101 und 102, keine Nummer genau): Die Eingabetaste rät nicht.
    await folge.find('[data-feld="suche"]').setValue('10')
    expect(folge.findAll('li.enter-ziel')).toHaveLength(0)
    await folge.find('[data-feld="suche"]').trigger('keydown', { key: 'Enter' })
    expect(betriebVon()?.gezeigt).toEqual([])
    await folge.find('[data-feld="suche"]').setValue('102')

    // Den zweiten Lauf von 102 vorziehen, während Lauf 1 läuft (S-4).
    await zeileVon(w, m('k2', 2)).find('[data-action="folge-zeigen"]').trigger('click')
    await nextTick()
    expect(imBoot(w)).toBe('102')
    expect(text(karte(w).find('[data-teil="imboot"]'))).toContain('Klasse 1 · Lauf 2')
    expect(karte(w).find('[data-teil="folge"]').exists()).toBe(false)
    // Lauf 1 läuft weiter; der Nächste bleibt der, der es vorher war.
    expect(text(karte(w).find('[data-teil="stand"]'))).toBe('Lauf 1 läuft · noch 4 Starts')
    expect(text(karte(w).find('[data-teil="naechster"] b'))).toBe('E01')
    // Die Wahl ist zu, der Fokus steht auf „Nächster Start“ – nicht auf <body>.
    await flushPromises()
    expect(document.activeElement).toBe(karte(w).find('[data-action="zeigen"]').element)
  })

  it('Eingabetaste mit mehreren Läufen: zeigt den Start des laufenden Laufs, nicht den eines wartenden', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    await knopf(w, 'beginnen')
    await knopf(w, 'wahl')
    const suche = () => karte(w).find('[data-teil="folge"] [data-feld="suche"]')
    await suche().setValue('101')
    expect(karte(w).findAll('[data-teil="folge"] li[data-start]')).toHaveLength(3)
    await suche().trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(betriebVon()?.gezeigt.map((g) => g.ref)).toEqual([m('k1', 1)])
    expect(imBoot(w)).toBe('101')
  })

  it('Suche mit einem Treffer: die Eingabetaste zeigt ihn; Escape leert erst die Suche, dann schließt es', async () => {
    const w = betrieb(festgeschrieben(reducer(betriebsStand(), { type: 'SET_EVENT', patch: { laufCount: 1 } })))
    await knopf(w, 'beginnen')
    await knopf(w, 'wahl')
    const suche = () => karte(w).find('[data-teil="folge"] [data-feld="suche"]')
    await suche().setValue('99')
    expect(text(karte(w).find('[data-teil="folge-leer"]'))).toBe('Kein Start passt.')
    await suche().trigger('keydown', { key: 'Escape' })
    expect((suche().element as HTMLInputElement).value).toBe('')
    await suche().setValue('Nachk2')
    await suche().trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(imBoot(w)).toBe('102')
    await knopf(w, 'wahl')
    await suche().trigger('keydown', { key: 'Escape' })
    expect(karte(w).find('[data-teil="folge"]').exists()).toBe(false)
    // Zu mit Escape: Der Fokus kehrt auf „Anderen Starter wählen“ zurück.
    await flushPromises()
    expect(document.activeElement).toBe(karte(w).find('[data-action="wahl"]').element)
  })

  it('Verschieben (S-4, S-6): den dritten Lauf ans Ende von Lauf 2, den zweiten vor Lauf 3; vorziehen', async () => {
    // Ohne „Verzahnung halten“ landet jeder Start genau am Ziel (mit: auf dem nächsten Platz seiner Spur, V-7).
    const w = betrieb(reducer(festgeschrieben(betriebsStand()), { type: 'SET_ANZEIGE', patch: { verzahnungHalten: false } }))
    await knopf(w, 'beginnen')
    await knopf(w, 'wahl')
    const lauf = (n: number) => [m('e1', n), m('k1', n), m('e2', n), m('k2', n)]
    const stelle = (key: string) => waehlbar().indexOf(key)

    // Das Menü bietet die anderen Läufe als Grenze; der eigene heißt „Ans Ende des Laufs“. Es ist ein Knopf, der
    // die Ziele aufklappt – kein Auswahlfeld, dessen Pfeiltasten schon verschieben würden.
    const menueKnopf = (key: string) => zeileVon(w, key).find('[data-action="verschieben"]')
    const ziele = (key: string) => zeileVon(w, key).findAll('[data-teil="verschieben"] button')
    const vorher = JSON.stringify(betriebVon())
    await menueKnopf(m('k2', 3)).trigger('keydown', { key: 'ArrowDown' })
    expect(ziele(m('k2', 3))).toHaveLength(0)
    await menueKnopf(m('k2', 3)).trigger('click')
    expect(menueKnopf(m('k2', 3)).attributes('aria-expanded')).toBe('true')
    expect(ziele(m('k2', 3)).map((o) => o.text())).toEqual(['Vorziehen', 'Ans Ende des Laufs', 'vor Lauf 1', 'nach Lauf 1', 'vor Lauf 2', 'nach Lauf 2'])
    // Aufklappen und Pfeiltasten senden nichts.
    await ziele(m('k2', 3))[0].trigger('keydown', { key: 'ArrowDown' })
    expect(JSON.stringify(betriebVon())).toBe(vorher)
    // Escape klappt zu, ohne etwas zu tun.
    await ziele(m('k2', 3))[0].trigger('keydown', { key: 'Escape' })
    expect(ziele(m('k2', 3))).toHaveLength(0)
    expect(karte(w).find('[data-teil="folge"]').exists()).toBe(true)

    await menueKnopf(m('k2', 3)).trigger('click')
    await zeileVon(w, m('k2', 3)).find('[data-ziel="nach|lauf:2"]').trigger('click')
    expect(stelle(m('k2', 3))).toBeGreaterThan(Math.max(...lauf(2).map(stelle)))
    expect(stelle(m('k2', 3))).toBeLessThan(stelle(m('e1', 3)))
    // Ein Befehl: Das Menü ist danach zu, der Fokus wieder auf seinem Knopf.
    expect(ziele(m('k2', 3))).toHaveLength(0)
    await flushPromises()
    expect(document.activeElement).toBe(menueKnopf(m('k2', 3)).element)

    await menueKnopf(m('e1', 2)).trigger('click')
    await zeileVon(w, m('e1', 2)).find('[data-ziel="vor|lauf:3"]').trigger('click')
    expect(stelle(m('e1', 2))).toBeGreaterThan(Math.max(...[m('k1', 2), m('e2', 2), m('k2', 2)].map(stelle)))
    expect(stelle(m('e1', 2))).toBeLessThan(stelle(m('k2', 3)))

    // Vorziehen: vor den Nächsten.
    await menueKnopf(m('k2', 1)).trigger('click')
    await zeileVon(w, m('k2', 1)).find('[data-ziel="vorne"]').trigger('click')
    expect(text(karte(w).find('[data-teil="naechster"] b'))).toBe('102')
    expect(text(karte(w).find('[data-teil="abweichend"]'))).toContain('Die Wettkampfrichter-Listen bleiben')
    // Zurückstellen aus der Wahl.
    await zeileVon(w, m('k2', 1)).find('[data-action="folge-zurueckstellen"]').trigger('click')
    expect(betriebVon()?.zurueckgestellt).toEqual([m('k2', 1)])
  })

  it('Klasse aussetzen (V-5, B-9): E2E21212121216163 → E6E61111113, Klasse 2 grau am Ende; das Boot kommt zurück – Verzahnung und WKR-Listen unberührt', async () => {
    const w = betrieb(v5())
    await knopf(w, 'beginnen')
    const vorher = ohneBetrieb(store.state.value)
    const klassen = () => karte(w).find('[data-teil="klassen"]')
    // In der Folge ihres nächsten Starts, je mit der Zahl der ausstehenden Starts.
    expect(klassen().findAll('li[data-klasse]').map((li) => [li.attributes('data-klasse'), text(li.find('.note'))])).toEqual([
      ['E', 'noch 2'],
      ['2', 'noch 6'],
      ['1', 'noch 6'],
      ['6', 'noch 2'],
      ['3', 'noch 1'],
    ])
    expect(text(klassen().find('[data-teil="klassen-punkt"]'))).toBe('In Lauf 1:')
    expect(vorschau(w)).toBe('E2E21212121216163')
    expect((klassen().find('[data-action="vorziehen"]').element as HTMLInputElement).checked).toBe(true)

    await klassen().find('li[data-klasse="2"] [data-action="aussetzen"]').trigger('click')
    expect(betriebVon()?.ausgesetzt).toEqual(['2'])
    // „Andere Klassen vorziehen“: Klasse 6 rückt auf; Klasse 2 am Ende des Laufs, grau.
    expect(vorschau(w)).toBe('E6E61111113222222')
    expect(karte(w).findAll('[data-teil="vorschau"] .class-badge.aus')).toHaveLength(6)
    expect(text(karte(w).find('[data-teil="boot-fehlt"]'))).toBe('Boot fehlt: 2')
    expect(klassen().find('li[data-klasse="2"]').classes()).toContain('aus')
    expect(text(klassen().find('li[data-klasse="2"] [data-action="aussetzen"]'))).toBe('Boot ist zurück')
    expect(text(karte(w).find('[data-teil="abweichend"]'))).toContain('weicht von der Verzahnung ab')

    // In der ganzen Folge stehen die Starts der Klasse 2 am Ende des Laufs, gekennzeichnet.
    await knopf(w, 'wahl')
    expect(karte(w).findAll('[data-teil="folge"] li[data-start]')).toHaveLength(11)
    expect(text(karte(w).find('[data-action="folge-ganz"]'))).toBe('Ganze Folge (17)')
    await karte(w).find('[data-action="folge-ganz"]').trigger('click')
    const zeilen = karte(w).findAll('[data-teil="folge"] li[data-start]')
    expect(zeilen.map((z) => z.attributes('data-art'))).toEqual([...Array(11).fill('offen'), ...Array(6).fill('bootFehlt')])
    expect(text(zeilen[16].find('[data-teil="vermerk"]'))).toBe('Boot fehlt')

    for (let i = 0; i < 3; i++) await knopf(w, 'zeigen')
    await klassen().find('li[data-klasse="2"] [data-action="aussetzen"]').trigger('click')
    expect(betriebVon()?.ausgesetzt).toEqual([])
    // Der Rest wird mit Klasse 2 neu verzahnt – sie fährt wieder im Wechsel der Spuren.
    expect(vorschau(w).slice(0, 4)).toBe('2121')
    expect(karte(w).findAll('[data-teil="vorschau"] .class-badge.aus')).toHaveLength(0)
    // Abnahme E2: Außer dem Betrieb hat sich nichts geändert – Verzahnung, Starter, Werte, WKR-Listen.
    expect(ohneBetrieb(store.state.value)).toEqual(vorher)
  })

  it('ohne „Andere Klassen vorziehen“ schließen sich nur die Lücken: EE111116163', async () => {
    const w = betrieb(v5())
    await knopf(w, 'beginnen')
    await karte(w).find('[data-teil="klassen"] [data-action="vorziehen"]').setValue(false)
    expect(betriebVon()?.vorziehen).toBe(false)
    expect(text(karte(w).find('[data-teil="klassen"]'))).toContain('Die Lücken schließen sich nur')
    await karte(w).find('[data-teil="klassen"] li[data-klasse="2"] [data-action="aussetzen"]').trigger('click')
    expect(vorschau(w)).toBe('EE111116163222222')
  })

  it('Klasse vorziehen (B-10): wird die nächste – nur innerhalb der Spuren; wer seine Spur für sich hat, hat keinen Knopf', async () => {
    const w = betrieb(klassenStand({ E: 3, '1': 3, '2': 3 }, [['1'], ['E', '2']]))
    await knopf(w, 'beginnen')
    const klassen = karte(w).find('[data-teil="klassen"]')
    expect(vorschau(w)).toBe('1E1E1E222')
    expect(klassen.findAll('li[data-klasse]').map((li) => [li.attributes('data-klasse'), li.find('[data-action="klasse-vor"]').exists()])).toEqual([
      ['1', false],
      ['E', true],
      ['2', true],
    ])
    await klassen.find('li[data-klasse="2"] [data-action="klasse-vor"]').trigger('click')
    expect(vorschau(w)).toBe('212121EEE')
    expect(text(karte(w).find('[data-teil="naechster"] b'))).toBe('201')
    expect(karte(w).find('[data-teil="klassen"] li[data-klasse]').attributes('data-klasse')).toBe('2')
  })

  it('der Lauf stockt, wenn nur noch Starts fehlender Boote offen sind – er ist nicht zu Ende', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    await knopf(w, 'beginnen')
    for (const k of ['E', '1']) await karte(w).find(`[data-teil="klassen"] li[data-klasse="${k}"] [data-action="aussetzen"]`).trigger('click')
    expect(text(karte(w).find('[data-teil="stockt"]'))).toBe('Kein Start frei – noch 4 Starts warten (zurückgestellt, Wiederholung offen, Boot fehlt oder nachzuholen). Der Lauf ist nicht zu Ende.')
    expect(karte(w).find('[data-action="zeigen"]').attributes('disabled')).toBeDefined()
    // „Lauf 2 beginnen“ drängt sich nicht auf.
    expect(karte(w).find('[data-action="beginnen"]').classes()).not.toContain('primary')
    // Gezielt zeigen geht trotzdem (BETRIEB_ANNAHMEN.zeigenJederOffene); die Klasse setzt weiter aus.
    await knopf(w, 'wahl')
    await karte(w).find('[data-teil="folge"] [data-feld="suche"]').setValue('E02')
    await zeileVon(w, m('e2', 1)).find('[data-action="folge-zeigen"]').trigger('click')
    await nextTick()
    expect(imBoot(w)).toBe('E02')
    expect(betriebVon()?.ausgesetzt).toEqual(['E', '1'])
  })

  it('Meldungsvorlage (B-8): landet im Textfeld, nicht auf der Anzeigetafel – Text in der Sprache der Tafel', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    const vorlage = karte(w).find('[data-meldung-vorlage]')
    const entwurf = () => (karte(w).find('[data-meldung-text]').element as HTMLTextAreaElement).value
    expect(vorlage.findAll('optgroup').map((g) => g.attributes('label'))).toEqual(['Begrüßung', 'Dank', 'Pause', 'Störung'])
    expect(karte(w).find('[data-action="vorlage-uebernehmen"]').attributes('disabled')).toBeDefined()
    // Wählen allein überschreibt keinen getippten Entwurf (eine Pfeiltaste im Feld wählt schon).
    await karte(w).find('[data-meldung-text]').setValue('Eigener Entwurf')
    await vorlage.setValue('gutenMorgen')
    expect(entwurf()).toBe('Eigener Entwurf')
    await knopf(w, 'vorlage-uebernehmen')
    expect(entwurf()).toBe('Guten Morgen und herzlich willkommen\nzum Musterpokal')
    expect(karte(w).find('[data-meldung-art="pause"]').classes()).toContain('active')
    expect((vorlage.element as HTMLSelectElement).value).toBe('gutenMorgen')
    expect(betriebVon()).toBeUndefined()
    await knopf(w, 'meldung-setzen')
    expect(betriebVon()?.meldung).toEqual({ text: 'Guten Morgen und herzlich willkommen\nzum Musterpokal', art: 'pause' })

    // UIM: Die Anzeigetafel spricht englisch, die Bedienung bleibt deutsch.
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    await karte(w).find('[data-meldung-vorlage]').setValue('kurzeStoerung')
    await knopf(w, 'vorlage-uebernehmen')
    expect(karte(w).find('[data-meldung-vorlage] option[value="kurzeStoerung"]').text()).toBe('Kurze Störung')
    expect((karte(w).find('[data-meldung-text]').element as HTMLTextAreaElement).value).toBe('Short interruption – we will continue shortly')
    expect(karte(w).find('[data-meldung-art="stoerung"]').classes()).toContain('active')
  })

  it('Einsteigen ab Lauf bzw. Klasse: nichts in `gezeigt`, die Läufe bis dahin begonnen; ein früherer Einstieg öffnet wieder', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    const ein = () => karte(w).find('[data-teil="einsteigen"]')
    expect(ein().findAll('[data-feld="einstieg-punkt"] option').map((o) => o.text())).toEqual(['Lauf 1', 'Lauf 2', 'Lauf 3'])
    await ein().find('[data-feld="einstieg-punkt"]').setValue('lauf:2')
    expect(text(ein().find('[data-teil="einstieg-start"]'))).toBe('Weiter mit: E01 · Vore1 Nache1 · Klasse E · Lauf 2')
    await ein().find('[data-action="einsteigen"]').trigger('click')
    expect(betriebVon()?.gezeigt).toEqual([])
    expect(betriebVon()?.begonnen).toEqual(['lauf:1', 'lauf:2'])
    expect(betriebVon()?.ohneAnzeige).toHaveLength(4)
    expect(text(karte(w).find('[data-teil="stand"]'))).toBe('Lauf 2 läuft · noch 4 Starts')
    expect(text(karte(w).find('[data-teil="naechster"]'))).toContain('E01 Vore1 Nache1')

    // Lauf 2 ab Klasse 1.
    expect(ein().findAll('[data-feld="einstieg-klasse"] option').map((o) => o.text())).toEqual(['erster Start des Laufs', 'Klasse E', 'Klasse 1'])
    await ein().find('[data-feld="einstieg-klasse"]').setValue('1')
    expect(text(ein().find('[data-teil="einstieg-start"]'))).toBe('Weiter mit: 101 · Vork1 Nachk1 · Klasse 1 · Lauf 2')
    await ein().find('[data-action="einsteigen"]').trigger('click')
    expect(text(karte(w).find('[data-teil="naechster"] b'))).toBe('101')

    // Zu spät eingestiegen: Lauf 1 von vorn – was „ohne Anzeige“ war, ist wieder offen. Ein anderer Lauf beginnt
    // wieder bei seinem ersten Start, nicht bei der eben gewählten Klasse.
    await ein().find('[data-feld="einstieg-punkt"]').setValue('lauf:1')
    expect((ein().find('[data-feld="einstieg-klasse"]').element as HTMLSelectElement).value).toBe('')
    // Auch ein Start, der schon „ohne Anzeige“ erledigt ist, steht mit Nummer und Name da.
    expect(text(ein().find('[data-teil="einstieg-start"]'))).toBe('Weiter mit: E01 · Vore1 Nache1 · Klasse E · Lauf 1')
    await ein().find('[data-action="einsteigen"]').trigger('click')
    expect(betriebVon()?.ohneAnzeige).toEqual([])
    expect(betriebVon()?.begonnen).toEqual(['lauf:1'])
    expect(text(karte(w).find('[data-teil="naechster"]'))).toContain('Klasse E · Lauf 1')
  })

  it('Einsteigen: zu spät, schon einen gezeigt, dann früher – „Weiter mit“ ist danach wirklich der Nächste', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    const ein = () => karte(w).find('[data-teil="einsteigen"]')
    await ein().find('[data-feld="einstieg-punkt"]').setValue('lauf:2')
    await ein().find('[data-action="einsteigen"]').trigger('click')
    await knopf(w, 'zeigen')
    expect(imBoot(w)).toBe('E01')
    await ein().find('[data-feld="einstieg-punkt"]').setValue('lauf:1')
    expect(text(ein().find('[data-teil="einstieg-start"]'))).toBe('Weiter mit: E01 · Vore1 Nache1 · Klasse E · Lauf 1')
    await ein().find('[data-action="einsteigen"]').trigger('click')
    expect(text(karte(w).find('[data-teil="naechster"]'))).toContain('Klasse E · Lauf 1')
    expect(karte(w).find('[data-teil="nachzuholen"]').exists()).toBe(false)
  })

  it('Verweis auf die Einstellung der Startfolge', () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    expect(w.find('[data-verweis="betrieb-einstellungen"]').attributes('href')).toBe('#/einstellungen?startfolge')
  })
})

describe('Betrieb: Wiederholung nach Ausfall (R11-11)', () => {
  it('Klick bis zum Stand: Werte verworfen, „Wiederholung offen“; „Doch keine Wiederholung“ holt die Werte zurück (Prüfbefund 27.11.2026)', async () => {
    const w = betrieb(festgeschrieben(betriebsStand()))
    await knopf(w, 'beginnen')
    await knopf(w, 'zeigen')
    await knopf(w, 'zeigen')
    expect(imBoot(w)).toBe('101')
    const L1 = 'manoevrieren/1'
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: L1, starter: 'k1', feld: 't1a|hin seiteA', wert: '5' }] })
    const vorher = store.state.value.eingaben[L1].k1
    // Wahl: der Start im Boot zuerst; Rückfrage mit Nummer und Lauf; erst „Werte verwerfen und wiederholen“ wirkt.
    await knopf(w, 'ausfall')
    const zeilen = karte(w).findAll('[data-teil="ausfall"] li')
    expect(zeilen[0].attributes('data-start')).toBe(m('k1', 1))
    await zeilen[0].find('[data-action="ausfall-waehlen"]').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-dialog="ausfall"]')?.textContent).toContain('Wiederholung nach Ausfall: 101, Lauf 1?')
    ;(document.querySelector('[data-action="ausfall-ja"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(store.state.value.eingaben[L1]?.k1).toBeUndefined()
    expect(betriebVon()?.wiederholung).toEqual([m('k1', 1)])
    expect(store.state.value.wkr.verworfen?.map((v) => v.ref)).toEqual([m('k1', 1)])
    const liste = karte(w).find('[data-teil="wiederholung"]')
    expect(text(liste)).toContain('101')
    expect(text(karte(w).find('[data-teil="abgebrochen"]'))).toBe('Ausfall – wird wiederholt')
    // „Doch keine Wiederholung“: der Versuch gilt wieder, die Werte sind zurück.
    await liste.find('[data-action="wiederholung-aufheben"]').trigger('click')
    await flushPromises()
    expect(store.state.value.eingaben[L1].k1).toEqual(vorher)
    expect(betriebVon()?.wiederholung).toBeUndefined()
    expect(store.state.value.wkr.verworfen).toBeUndefined()
    expect(karte(w).find('[data-teil="wiederholung"]').exists()).toBe(false)
  })
})

describe('Betrieb: Startliste (E3)', () => {
  /** Wann e1 ins Boot kam (Zeit des Hosts, ms). */
  const T0 = 2_000_000
  /** Lauf 1 auf Parcours 1 begonnen, e1 seit T0 im Boot; am Steg 1, vor Steg 1 (so reicht die Folge für „Zum Vorsteg“). */
  const imBetrieb = (halten = true) => {
    let s = reducer(festgeschrieben(betriebsStand()), { type: 'SET_ANZEIGE', patch: { amSteg: 1, vorSteg: 1, verzahnungHalten: halten } })
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:1', zeit: T0 - 5000 })
    return zeigeNaechsten(s, P1, T0)
  }
  const liste = (w: VueWrapper, bereich = P1) => w.find(`.betrieb-startliste[data-bereich="${bereich}"]`)
  const zeile = (w: VueWrapper, key: string, bereich = P1) => liste(w, bereich).find(`tr[data-start='${key}']`)
  const zelle = (w: VueWrapper, key: string, teil: 'ca' | 'vorsteg') => text(zeile(w, key).find(`[data-teil="${teil}"]`))
  const startliste = async (stand: AppState, jetzt = T0 + 60_000) => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
    vi.setSystemTime(jetzt)
    location.hash = '#/betrieb/startliste'
    const w = betrieb(stand)
    await nextTick()
    return w
  }
  afterEach(() => vi.useRealTimers())

  it('Unterreiter in der Adresse; je Parcours die Folge nach Lauf, „ca. in“ und „Zum Vorsteg“ – gerechnet mit der Uhr des Bildschirms', async () => {
    const w = await startliste(imBetrieb())
    expect(location.hash).toBe('#/betrieb/startliste')
    expect(w.find('[data-reiter="startliste"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('.betrieb-karte').exists()).toBe(false)
    expect(w.findAll('.betrieb-startliste').map((l) => l.attributes('data-bereich'))).toEqual([P1, P2])

    expect(liste(w).find('[data-teil="imboot"] b').text()).toBe('E01')
    expect(text(liste(w).find('[data-teil="imboot"]'))).toContain('Vore1 Nache1')
    expect(text(liste(w).find('[data-teil="seit"]'))).toBe('seit 1:00')
    expect(liste(w).findAll('[data-teil="punkt"]').map(text)).toEqual(['Lauf 1', 'Lauf 2 – noch nicht begonnen', 'Lauf 3 – noch nicht begonnen'])
    // e1 seit 60 s im Boot (E: 120 s) → k1 in 60 s; dann je Start der Abstand seiner Klasse (1: 110 s, E: 120 s).
    expect([m('k1', 1), m('e2', 1), m('k2', 1)].map((k) => zelle(w, k, 'ca'))).toEqual(['1 min', '3 min', '5 min'])
    // Zum Vorsteg: der erste ist am Steg, der zweite vor Steg; der dritte muss hin, wenn k1 ins Boot geht.
    expect([m('k1', 1), m('e2', 1), m('k2', 1)].map((k) => zelle(w, k, 'vorsteg'))).toEqual(['am Steg', 'vor Steg', '1 min'])
    // Ein Lauf, der nicht begonnen hat, bekommt keine Zahl (L-2).
    expect([zelle(w, m('e1', 2), 'ca'), zelle(w, m('e1', 2), 'vorsteg')]).toEqual(['–', '–'])
    expect(text(liste(w, P2).find('[data-teil="punkt"]'))).toBe('Lauf 1 – noch nicht begonnen')

    // Die Uhr tickt im Bildschirm, nicht im Stand: nichts wird gespeichert.
    const vorher = store.state.value
    vi.advanceTimersByTime(30_000)
    await nextTick()
    expect(text(liste(w).find('[data-teil="seit"]'))).toBe('seit 1:30')
    expect(zelle(w, m('k1', 1), 'ca')).toBe('gleich')
    expect(store.state.value).toBe(vorher)
    // Steht der Start schon über eine Stunde (etwa vom Vorabend), keine riesige Minutenzahl.
    vi.advanceTimersByTime(2 * 3600_000)
    await nextTick()
    expect(text(liste(w).find('[data-teil="seit"]'))).toBe('seit über 1 h')

    // Zurück zur Start-Freigabe: ein Schritt in der Adresse.
    await w.find('[data-reiter="start"]').trigger('click')
    expect(location.hash).toBe('#/betrieb/start')
    expect(w.find('.betrieb-startliste').exists()).toBe(false)
    expect(w.findAll('.betrieb-karte')).toHaveLength(2)
  })

  it('„Boot fehlt“ ohne Zahl am Ende des Laufs; zurückgestellte stehen darunter zum Einreihen', async () => {
    let s = reducer(imBetrieb(), { type: 'BETRIEB_AUSSETZEN', bereich: P1, klasse: '1', an: true })
    s = reducer(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('e2', 1) })
    const w = await startliste(s)
    expect(zeile(w, m('k1', 1)).attributes('data-art')).toBe('bootFehlt')
    expect([zelle(w, m('k1', 1), 'ca'), zelle(w, m('k1', 1), 'vorsteg')]).toEqual(['Boot fehlt', ''])
    expect(zeile(w, m('k1', 1)).attributes('draggable')).toBe('false')
    await liste(w).find('[data-teil="zurueckgestellt"] [data-action="einreihen-naechster"]').trigger('click')
    expect(betriebVon()?.zurueckgestellt).toEqual([])
    expect(zelle(w, m('e2', 1), 'ca')).toBe('1 min')
  })

  it('Pause oder Störung auf der Anzeigetafel: keine Wartezeiten, Steg bleibt, ein Satz sagt warum', async () => {
    const s = reducer(imBetrieb(), { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: { text: 'Kurze Störung', art: 'stoerung' } })
    const w = await startliste(s, T0 + 20 * 60_000)
    expect(text(liste(w).find('[data-teil="angehalten"]'))).toContain('keine Wartezeiten')
    expect([m('k1', 1), m('e2', 1), m('k2', 1)].map((k) => [zelle(w, k, 'ca'), zelle(w, k, 'vorsteg')])).toEqual([
      ['–', 'am Steg'],
      ['–', 'vor Steg'],
      ['–', '–'],
    ])
    // Parcours 2 hat keine Meldung: kein Satz dort.
    expect(liste(w, P2).find('[data-teil="angehalten"]').exists()).toBe(false)
  })

  it('Ziehen = BETRIEB_VERSCHIEBEN { vor | nach } – genau dieselben Regeln wie „Verschieben …“ (V-7: die Spur rutscht im Lauf mit)', async () => {
    const stand = imBetrieb()
    const w = await startliste(stand)
    const vorher = ohneBetrieb(store.state.value)
    const zieheAuf = async (von: string, auf: string) => {
      await zeile(w, von).trigger('dragstart')
      await zeile(w, auf).trigger('dragover')
      await zeile(w, auf).trigger('drop')
      await zeile(w, von).trigger('dragend')
    }
    // Nach oben gezogen: vor das Ziel.
    await zieheAuf(m('k2', 1), m('k1', 1))
    const erwartet = reducer(stand, { type: 'BETRIEB_VERSCHIEBEN', bereich: P1, ref: m('k2', 1), ziel: { vor: m('k1', 1) } })
    expect(betriebVon()).toEqual(erwartet.betrieb.bereiche[P1])
    expect(waehlbar().slice(0, 3)).toEqual([m('k2', 1), m('e2', 1), m('k1', 1)])
    // Nach unten gezogen: dahinter – auch in einen Lauf, der noch nicht begonnen hat.
    await zieheAuf(m('e2', 1), m('e1', 2))
    const danach = reducer(erwartet, { type: 'BETRIEB_VERSCHIEBEN', bereich: P1, ref: m('e2', 1), ziel: { nach: m('e1', 2) } })
    expect(betriebVon()).toEqual(danach.betrieb.bereiche[P1])
    // Auf sich selbst oder ohne Ziehen: nichts.
    const jetzt = JSON.stringify(betriebVon())
    await zeile(w, m('k1', 1)).trigger('drop')
    await zieheAuf(m('k1', 1), m('k1', 1))
    expect(JSON.stringify(betriebVon())).toBe(jetzt)
    // Verzahnung, Starter, Werte, Einstellungen bleiben (Abnahme wie E2).
    expect(ohneBetrieb(store.state.value)).toEqual(vorher)
  })

  it('Menü „Verschieben …“ wie an der Start-Freigabe; ohne festgeschriebene Verzahnung ruhen Ziehen und Menü', async () => {
    const stand = imBetrieb(false)
    const w = await startliste(stand)
    await zeile(w, m('k2', 3)).find('[data-action="verschieben"]').trigger('click')
    const ziele = liste(w).findAll('[data-teil="verschieben"] button')
    expect(ziele.map((z) => z.text())).toEqual(['Vorziehen', 'Ans Ende des Laufs', 'vor Lauf 1', 'nach Lauf 1', 'vor Lauf 2', 'nach Lauf 2'])
    await liste(w).find('[data-teil="verschieben"] [data-ziel="nach|lauf:1"]').trigger('click')
    expect(betriebVon()).toEqual(reducer(stand, { type: 'BETRIEB_VERSCHIEBEN', bereich: P1, ref: m('k2', 3), ziel: { nachPunkt: 'lauf:1' } }).betrieb.bereiche[P1])
    expect(liste(w).find('[data-teil="verschieben"]').exists()).toBe(false)

    // Verzahnung gelöst: Die Liste bleibt zu sehen, aber nichts lässt sich umstellen.
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: false })
    await nextTick()
    expect(w.find('[data-hinweis="vor-verzahnung"]').exists()).toBe(true)
    expect(zeile(w, m('k1', 1)).attributes('draggable')).toBe('false')
    expect(zeile(w, m('k1', 1)).find('[data-action="verschieben"]').attributes('disabled')).toBeDefined()
    const gesperrt = JSON.stringify(betriebVon())
    await zeile(w, m('k1', 1)).trigger('dragstart')
    await zeile(w, m('e2', 1)).trigger('drop')
    expect(JSON.stringify(betriebVon())).toBe(gesperrt)
  })

  it('Startabstände je Klasse mit Verweis auf die Einstellungen; „Zuschauerliste öffnen“ öffnet #/zuschauer', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const w = await startliste(imBetrieb())
    const abstaende = w.find('[data-teil="abstaende"]')
    expect(abstaende.find('a').attributes('href')).toBe('#/einstellungen?startfolge')
    expect(abstaende.findAll('[data-klasse]').map(text)).toEqual(['E 2:00', '1 1:50', '4 2:00', '5 2:15'])
    await w.find('[data-action="zuschauer-oeffnen"]').trigger('click')
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/#\/zuschauer$/), 'alcatraz-zuschauer')
    setLocale('en')
    await nextTick()
    await w.find('[data-action="zuschauer-oeffnen"]').trigger('click')
    expect(open).toHaveBeenLastCalledWith(expect.stringMatching(/#\/spectators$/), 'alcatraz-zuschauer')
    expect(text(liste(w).findAll('thead th')[6])).toBe('To pontoon entry')
  })
})

describe('Betrieb: Parallelslalom (E4)', () => {
  const P = 'parallel'
  const p = (attempt: 1 | 2, a: string | null, b: string | null) => refKey({ art: 'p', runde: 'pre', attempt, a, b })
  const seiten = (w: VueWrapper, teil: 'imboot' | 'naechster') => karte(w, P).findAll(`[data-teil="${teil}"] .betrieb-seite`).map(text)

  it('Karte: Runde beginnen, das Paar mit Parcours A und B, Zurückstellen nimmt das Paar; Klassen aussetzen und Verschieben gibt es nicht', async () => {
    const w = betrieb(uimParallelStand())
    // Unter UIM hinter dem Parcours; der Name in der Sprache der Tafel (englisch), die Bedienung deutsch.
    expect(w.findAll('.betrieb-karte').map((k) => k.attributes('data-bereich'))).toEqual([P1, P])
    expect(text(karte(w, P).find('h3'))).toBe('Parallel slalom')
    expect(text(karte(w, P).find('[data-teil="stand"]'))).toBe('Noch keine Runde begonnen.')
    expect(text(karte(w, P).find('[data-action="beginnen"]'))).toBe('Vorlauf beginnen')
    expect(karte(w, P).find('[data-teil="klassen"]').exists()).toBe(false)
    expect(text(karte(w, P).find('[data-hinweis="parallel"]'))).toContain('Klassen aussetzen oder vorziehen und Starts verschieben gibt es hier deshalb nicht')
    // „Einsteigen ab …“ spricht von Runden, nicht von Läufen.
    const einstieg = text(karte(w, P).find('[data-teil="einstieg-hinweis"]'))
    expect(einstieg).toContain('die Runden bis dahin gelten als begonnen')
    expect(einstieg).not.toContain('Läufe')
    await knopf(w, 'beginnen', P)
    expect(text(karte(w, P).find('[data-teil="stand"]'))).toBe('Vorlauf läuft · noch 10 Starts')
    expect(seiten(w, 'naechster')).toEqual(['Parcours A: E01 VorE1 NachE1', 'Parcours B: E02 VorE2 NachE2'])
    await knopf(w, 'zeigen', P)
    expect(seiten(w, 'imboot')).toEqual(['Parcours A: E01 VorE1 NachE1', 'Parcours B: E02 VorE2 NachE2'])
    expect(text(karte(w, P).find('[data-teil="imboot"]'))).toContain('Klasse Dolphin · Vorlauf · Versuch 1')
    // Als Nächstes der 2. Attempt mit getauschten Seiten (Pkt. 4.4).
    expect(seiten(w, 'naechster')).toEqual(['Parcours A: E02 VorE2 NachE2', 'Parcours B: E01 VorE1 NachE1'])
    await knopf(w, 'zeigen', P)
    // Dolphin 3 gegen den Dummy: die Seite ist leer. Zurückstellen nimmt beide Attempts des Paares.
    expect(seiten(w, 'naechster')).toEqual(['Parcours A: E03 VorE3 NachE3', 'Parcours B: leer'])
    await knopf(w, 'zurueckstellen', P)
    expect(betriebVon(P).zurueckgestellt).toEqual([p(1, 'E-3', null), p(2, null, 'E-3')])
    const liste = karte(w, P).find('[data-teil="zurueckgestellt"]')
    expect(liste.findAll('li').map((li) => li.findAll('.betrieb-start > *').map(text))).toEqual([
      ['E03 / –', 'VorE3 NachE3 / –', 'Klasse Dolphin · Vorlauf · Versuch 1'],
      ['– / E03', '– / VorE3 NachE3', 'Klasse Dolphin · Vorlauf · Versuch 2'],
    ])
    expect(text(liste.find('[data-action="einreihen-ende"]'))).toBe('Ans Ende der Runde')
    // „Anderen Starter wählen“: ohne „Verschieben …“.
    await knopf(w, 'wahl', P)
    expect(karte(w, P).findAll('[data-teil="folge"] li').length).toBeGreaterThan(0)
    expect(karte(w, P).findAll('[data-teil="folge"] [data-action="verschieben"]')).toHaveLength(0)
    // Die Pläne ändert der Betrieb nie.
    expect(store.state.value.parallelPlaene).toEqual(uimParallelStand().parallelPlaene)
  })

  it('Startliste: Paare in ihrer Folge, Spalte „Versuch“, ohne Wartezeit und ohne Ziehen – Steg bleibt', async () => {
    location.hash = '#/betrieb/startliste'
    let s = reducer(uimParallelStand(), { type: 'SET_ANZEIGE', patch: { amSteg: 1, vorSteg: 1 } })
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P, punkt: 'runde:pre' })
    const w = betrieb(s)
    await nextTick()
    const liste = w.find(`.betrieb-startliste[data-bereich="${P}"]`)
    expect(text(liste.findAll('thead th')[4])).toBe('Versuch')
    expect(liste.find('[data-hinweis="parallel"]').exists()).toBe(true)
    const zeilen = liste.findAll('tbody tr[data-start]')
    expect(zeilen.slice(0, 3).map((z) => [text(z.findAll('td')[1]), text(z.find('[data-teil="ca"]')), text(z.find('[data-teil="vorsteg"]'))])).toEqual([
      ['E01 / E02', '–', 'am Steg'],
      ['E02 / E01', '–', 'vor Steg'],
      ['E03 / –', '–', '–'],
    ])
    expect(zeilen.every((z) => z.attributes('draggable') !== 'true')).toBe(true)
    expect(liste.findAll('[data-action="verschieben"]')).toHaveLength(0)
  })
})
