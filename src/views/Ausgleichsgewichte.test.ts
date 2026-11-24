import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import WeighingView from './WeighingView.vue'
import SettingsView from './SettingsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { vergissAlles } from '../lib/merken'
import { SEITEN_VORGABE } from '../lib/seiten'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'
import { ohneLogos, seitenKoepfe, setzeTestLogos } from '../testHilfen'

// Reiter „Gewichtslisten“: je Herkunft für die Verwiegung oder „Ausgleichsgewichte“ für den
// Steg (je Klasse ein Blatt). Dazu die Begriffe des Reglements. Alle Starter sind erfunden.

function starter(klassen: ClassId[], n: number): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: i % 2 === 0 ? 'MBC Nord' : 'MBC Süd',
      bundesland: 'Bayern',
      geburtsdatum: '2014-05-01',
      groesse: '',
      klasse,
    })),
  )
}
const mounte = (view: typeof ListsView, store: Store) => mount(view, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
async function steg(wrapper: VueWrapper) {
  await wrapper.find('.list-kinds button[data-kind="gewicht"]').trigger('click')
  await nextTick()
  await wrapper.find('.gewicht-arten button[data-art="steg"]').trigger('click')
  await nextTick()
}
/** Der Kopf jedes Dokuments (erste Seite): die Felder, mit „|“ getrennt. */
const koepfe = (wrapper: VueWrapper) => wrapper.findAll('.listen-seite[data-seite="1"] .sheet-title-box').map((b) => b.findAll('[data-feld]').map((f) => f.text().replace(/\s+/g, ' ')).join(' | '))
const spalten = (wrapper: VueWrapper) => wrapper.find('.sheet-cols').findAll('th').map((th) => th.text())
const zeilen = (wrapper: VueWrapper, liste: string) => wrapper.findAll(`[data-liste="ausgleich:${liste}"] tbody tr`).map((tr) => tr.findAll('td').map((td) => td.text()))

describe('Gewichtslisten: Ausgleichsgewichte für den Steg', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal', eventJahr: 2026 } })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['E', '4'], 3) })
    // Klasse 4 (65 kg): 58,4 → 7 kg; 70 → keines; der Dritte ist nicht gewogen.
    store.dispatch({ type: 'SET_WEIGHT', id: 'id-4-1', gewicht: 58.4 })
    store.dispatch({ type: 'SET_WEIGHT', id: 'id-4-2', gewicht: 70 })
    store.dispatch({ type: 'SET_WEIGHT', id: 'id-E-1', gewicht: 20.5 })
    store.dispatch({ type: 'SET_WEIGHT', id: 'id-E-2', gewicht: 26 })
    store.dispatch({ type: 'SET_WEIGHT', id: 'id-E-3', gewicht: 30 })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
    location.hash = ''
  })

  it('der Reiter bietet zwei Arten; Vorgabe ist die Liste je Herkunft für die Verwiegung', async () => {
    const wrapper = mounte(ListsView, store)
    await wrapper.find('.list-kinds button[data-kind="gewicht"]').trigger('click')
    await nextTick()
    expect(wrapper.findAll('.gewicht-arten button').map((b) => b.text())).toEqual(['je Verein für die Verwiegung', 'für den Steg je Klasse'])
    expect(wrapper.find('.gewicht-arten button.active').attributes('data-art')).toBe('herkunft')
    expect(wrapper.find('.sheet.weights').exists()).toBe(true)
    expect(wrapper.find('select[data-feld="steg-klasse"]').exists()).toBe(false)
    // Begriff des Reglements (C3): „Durchschnittsgewicht“ statt „Standardgewicht“.
    expect(spalten(wrapper)).toContain('Durchschnitts-\ngewicht')
    await steg(wrapper)
    expect(wrapper.find('.sheet.weights').exists()).toBe(false)
    expect(wrapper.find('.sheet.ausgleich').exists()).toBe(true)
    // Ohne Herkunft heißt die erste Art nur „für die Verwiegung“.
    store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'none' })
    await nextTick()
    expect(wrapper.findAll('.gewicht-arten button').map((b) => b.text())).toEqual(['für die Verwiegung', 'für den Steg je Klasse'])
    wrapper.unmount()
  })

  it('je Klasse ein Dokument: Kopf mit eigenen Feldern, Spalten wie auf dem bisherigen Blatt, Kästchen je Lauf', async () => {
    store.dispatch({ type: 'SET_BOOT', klasse: '4', text: 'Boot 1, 15 PS' })
    store.dispatch({ type: 'SET_CO_PILOT', klasse: 'E', text: 'Erika Beispiel' })
    const wrapper = mounte(ListsView, store)
    await steg(wrapper)
    expect(wrapper.findAll('.sheet-section').map((s) => s.attributes('data-liste'))).toEqual(['ausgleich:E', 'ausgleich:4'])
    // Klasse E: Co-Pilot (Reglement C3) – Boot noch leer, das Feld bleibt zum Eintragen. Klasse 4 fährt ohne Co-Pilot.
    expect(koepfe(wrapper)).toEqual(['Ausgleichsgewichte | Klasse E | Boot | Co-Pilot Erika Beispiel | Hafenpokal 2026', 'Ausgleichsgewichte | Klasse 4 | Boot Boot 1, 15 PS | Hafenpokal 2026'])
    expect(spalten(wrapper)).toEqual(['S-Nr.', 'Name', 'Vorname', 'Ausgleichs-\ngewicht', 'Klasse', '1. Lauf', '2. Lauf', '3. Lauf'])
    expect(zeilen(wrapper, '4')).toEqual([
      ['401', 'Nach41', 'Vor41', '7 kg', '4', '', '', ''],
      ['402', 'Nach42', 'Vor42', '', '4', '', '', ''],
      // Nicht gewogen (24.11.2026): klein vermerkt, „kg“ rechts – dazwischen frei zum Nachtragen von Hand.
      ['403', 'Nach43', 'Vor43', 'nicht gewogen kg', '4', '', '', ''],
    ])
    // 26 − 20,5 = 5,5 → 6 kg; genau das Durchschnittsgewicht und mehr: kein Ausgleichsgewicht.
    expect(zeilen(wrapper, 'E').map((z) => z[3])).toEqual(['6 kg', '', ''])
    // So viele Kästchen wie Läufe eingestellt sind.
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 2 } })
    await nextTick()
    expect(spalten(wrapper).slice(5)).toEqual(['1. Lauf', '2. Lauf'])
    expect(zeilen(wrapper, '4')[0]).toHaveLength(7)
    wrapper.unmount()
  })

  it('auf 0 kg gerundet steht leer wie „keines nötig“ – wie das Steg-Gerät („kein AG“, Prüfbefund 24.11.2026)', async () => {
    // Klasse 4 (65 kg): 64,6 → 0,4 kg leichter → 0 kg (gerundet); die Verwiegung nennt das weiter „0 kg“.
    store.dispatch({ type: 'SET_WEIGHT', id: 'id-4-2', gewicht: 64.6 })
    const wrapper = mounte(ListsView, store)
    await steg(wrapper)
    expect(zeilen(wrapper, '4').map((z) => z[3])).toEqual(['7 kg', '', 'nicht gewogen kg'])
    expect(wrapper.find('[data-liste="ausgleich:4"] tbody tr:nth-child(2)').attributes('data-ausgleich')).toBe('0')
    wrapper.unmount()
    // Die Verwiegung zeigt die Rechnung weiter genau: 402 mit „0 kg“.
    const verwiegung = mounte(WeighingView, store)
    const zeile402 = verwiegung.findAll('.weigh-table tbody tr').find((tr) => tr.text().includes('Nach42'))
    expect(zeile402?.findAll('td').at(-1)?.text()).toBe('0 kg')
    verwiegung.unmount()
  })

  it('mit Logos (16.11.2026): auf jeder Seite links und rechts neben dem Kopf, sonst alles wie ohne', async () => {
    // Mehrere Seiten in Klasse 4.
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['4'], 40).map((p) => ({ ...p, id: `${p.id}-x`, startNr: `4${p.startNr}` })) })
    const vorher = mounte(ListsView, store)
    await steg(vorher)
    const ohne = seitenKoepfe(document.body)
    vorher.unmount()
    expect(ohne.length).toBeGreaterThan(2)
    expect(ohne.every((x) => x.logos.length === 0)).toBe(true)
    setzeTestLogos(store)
    const wrapper = mounte(ListsView, store)
    await steg(wrapper)
    const mit = seitenKoepfe(document.body)
    expect(mit.map((x) => x.logos)).toEqual(mit.map(() => ['links', 'rechts']))
    expect(ohneLogos(mit)).toEqual(ohneLogos(ohne))
    wrapper.unmount()
  })

  it('nicht Gewogene: ausdrücklich auf dem Blatt und als Hinweis darüber, mit dem Weg zur Verwiegung', async () => {
    const wrapper = mounte(ListsView, store)
    await steg(wrapper)
    const hinweis = () => wrapper.find('[data-hinweis="steg-ungewogen"]')
    expect(hinweis().text()).toContain('1 Starter ist noch nicht gewogen')
    expect(hinweis().find('a').attributes('href')).toBe('#/verwiegung')
    // Nutzer 24.11.2026: „bei einer Papierliste manuell nachgetragen“ – ein Feld zum Eintragen, der Vermerk nur klein.
    const zelle = wrapper.find('[data-liste="ausgleich:4"] tbody tr[data-ausgleich="ungewogen"] td.ungewogen')
    expect([zelle.find('.ungewogen-vermerk').text(), zelle.find('.ungewogen-kg').text()]).toEqual(['nicht gewogen', 'kg'])
    store.dispatch({ type: 'SET_WEIGHT', id: 'id-4-3', gewicht: 61 })
    await nextTick()
    expect(hinweis().exists()).toBe(false)
    expect(zeilen(wrapper, '4')[2][3]).toBe('4 kg')
    // Boot und Co-Pilot pflegt man in der Besetzung – der Hinweis führt hin.
    expect(wrapper.find('[data-hinweis="gewicht-art"] a').attributes('href')).toBe('#/veranstaltung?besetzung')
    wrapper.unmount()
  })

  it('Klasse wählbar oder alle; die Wahl übersteht den Wechsel des Reiters', async () => {
    const wrapper = mounte(ListsView, store)
    await steg(wrapper)
    const wahl = () => wrapper.find('select[data-feld="steg-klasse"]')
    expect(wahl().findAll('option').map((o) => o.text())).toEqual(['alle', 'Klasse E', 'Klasse 4'])
    expect(wrapper.find('.gewicht-wahl .ergebnis-zahl').text()).toBe('2 Listen')
    await wahl().setValue('4')
    await nextTick()
    expect(wrapper.findAll('.sheet-section').map((s) => s.attributes('data-liste'))).toEqual(['ausgleich:4'])
    expect(wrapper.find('.gewicht-wahl .ergebnis-zahl').text()).toBe('1 Liste')
    await wrapper.find('.list-kinds button[data-kind="starter"]').trigger('click')
    await wrapper.find('.list-kinds button[data-kind="gewicht"]').trigger('click')
    await nextTick()
    expect(wrapper.find('.gewicht-arten button.active').attributes('data-art')).toBe('steg')
    expect((wahl().element as HTMLSelectElement).value).toBe('4')
    wrapper.unmount()
  })

  it('eigenes Dokument je Klasse mit eigener Seitenzählung – nur bei mehr als einer Seite', async () => {
    const viele = SEITEN_VORGABE.ausgleich + 5
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['2'], viele) })
    const wrapper = mounte(ListsView, store)
    await steg(wrapper)
    const seiten = (liste: string) => wrapper.findAll(`[data-liste="ausgleich:${liste}"] .listen-seite`)
    expect(seiten('2')).toHaveLength(2)
    expect(seiten('2').map((s) => s.find('.listen-seitenzahl').text())).toEqual(['Seite 1 / 2', 'Seite 2 / 2'])
    // Der Kopf steht auf jeder Seite; jede fünfte Zeile ist grau, über das Dokument durchgezählt.
    expect(seiten('2')[1].find('[data-feld="klasse"]').text()).toBe('Klasse 2')
    expect(wrapper.findAll('[data-liste="ausgleich:2"] tbody tr.shade')).toHaveLength(Math.floor(viele / 5))
    expect(seiten('4')).toHaveLength(1)
    expect(seiten('4')[0].find('.listen-seitenzahl').exists()).toBe(false)
    wrapper.unmount()
  })

  it('braucht Startnummern (anders als die Liste für die Verwiegung)', async () => {
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-4-1', patch: { startNr: '' } })
    const wrapper = mounte(ListsView, store)
    await wrapper.find('.list-kinds button[data-kind="gewicht"]').trigger('click')
    await nextTick()
    expect(wrapper.find('.sheet.weights').exists()).toBe(true)
    expect(wrapper.find('.boat-banner.warn[role="alert"]').exists()).toBe(false)
    await wrapper.find('.gewicht-arten button[data-art="steg"]').trigger('click')
    await nextTick()
    expect(wrapper.find('.sheet').exists()).toBe(false)
    expect(wrapper.find('.boat-banner.warn[role="alert"]').text()).toContain('1 Starter hat noch keine Startnummer')
    expect((wrapper.find('.btn.primary').element as HTMLButtonElement).disabled).toBe(true)
    wrapper.unmount()
  })

  it('UIM: das Blatt steht englisch, auch bei deutscher Oberfläche – „Extra weights“, „Co-driver“, „Dolphin“', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'SET_CO_PILOT', klasse: 'E', text: 'Erika Beispiel' })
    const wrapper = mounte(ListsView, store)
    await steg(wrapper)
    expect(koepfe(wrapper)).toEqual(['Extra weights | Dolphin | Boat | Co-driver Erika Beispiel | Hafenpokal 2026', 'Extra weights | Class 4 | Boat | Hafenpokal 2026'])
    expect(spalten(wrapper)).toEqual(['No.', 'Surname', 'First name', 'Extra\nweight', 'Class', 'Attempt 1', 'Attempt 2'])
    // UIM 960 Pkt. 3.7: Klasse 4 = 64 kg → 64 − 58,4 = 5,6 → 6 kg.
    expect(zeilen(wrapper, '4').map((z) => z[3])).toEqual(['6 kg', '', 'not weighed kg'])
    // Die Bedienung bleibt deutsch.
    expect(wrapper.find('.gewicht-arten button.active').text()).toBe('für den Steg je Klasse')
    wrapper.unmount()
  })
})

describe('Begriffe des Reglements: Durchschnittsgewicht und Ausgleichsgewicht', () => {
  let store: Store
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['4'], 1) })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('Verwiegung und Einstellungen nennen sie wie DM C3 und UIM 960 Pkt. 3.7', async () => {
    const wiegen = mounte(WeighingView, store)
    expect(wiegen.findAll('.weigh-table thead th').map((th) => th.text())).toEqual(['Klasse', 'Name', 'Vorname', 'Durchschnittsgewicht', 'Gewicht (kg)', 'Ausgleichsgewicht'])
    const einstellungen = mounte(SettingsView, store)
    const titel = () => einstellungen.findAll('.panel > h2').map((h) => h.text())
    expect(titel()).toContain('Durchschnittsgewichte')
    for (const text of [wiegen.text(), einstellungen.text()]) {
      expect(text).not.toContain('Standardgewicht')
      expect(text).not.toContain('Zusatzgewicht')
    }
    setLocale('en')
    await nextTick()
    expect(wiegen.findAll('.weigh-table thead th').map((th) => th.text())).toEqual(['Class', 'Surname', 'First name', 'Average weight', 'Weight (kg)', 'Extra weight'])
    expect(titel()).toContain('Average weights')
    expect(wiegen.text() + einstellungen.text()).not.toContain('Standard weight')
    wiegen.unmount()
    einstellungen.unmount()
  })
})
