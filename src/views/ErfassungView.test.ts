import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ErfassungView from './ErfassungView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { configFor } from '../config/konfig'
import { laufSchluessel } from '../lib/eingaben'
import { wkrBoegenZumStand } from '../lib/wkrListen'
import { setLocale } from '../i18n'
import { STATE_KEY } from '../persistenz/storage'
import { vergissAlles } from '../lib/merken'
import type { ClassId, Starter } from '../types'

/** Erfundene Starter: `n` je Klasse, klassenbasierte Startnummern. */
function starter(klassen: ClassId[], n = 3): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: 'Musterclub',
      bundesland: 'Musterland',
      geburtsdatum: '',
      groesse: '',
      klasse,
    })),
  )
}

const L1 = laufSchluessel('manoevrieren', 1)
const ansicht = (store: Store) => mount(ErfassungView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
async function waehle(wrapper: VueWrapper, feld: string, wert: string) {
  await wrapper.find(`select[data-feld="erf-${feld}"]`).setValue(wert)
  await nextTick()
}
const zeilen = (wrapper: VueWrapper) => wrapper.findAll('.erf-tabelle tbody tr[data-zeile]')
const feld = (wrapper: VueWrapper, zeile: number, spalte: string) => zeilen(wrapper)[zeile].find(`td[data-spalte="${spalte}"] input`) as DOMWrapper<HTMLInputElement>
/** Wo der Fokus steht: „Zeile|Spalte“. */
function fokus(): string {
  const a = document.activeElement as HTMLElement | null
  return `${a?.closest('tr')?.getAttribute('data-zeile') ?? ''}|${a?.closest('td')?.getAttribute('data-spalte') ?? ''}`
}
/** Tippt in ein Feld wie ein Mensch: Fokus, Wert, `input`-Ereignis. */
async function tippe(el: DOMWrapper<HTMLInputElement>, text: string) {
  el.element.focus()
  await el.trigger('focus')
  await el.setValue(text)
  // Der Cursor steht nach dem Tippen am Ende.
  el.element.setSelectionRange(el.element.value.length, el.element.value.length)
}
const taste = (el: DOMWrapper<HTMLInputElement>, key: string) => el.trigger('keydown', { key })
const titel = (wrapper: VueWrapper) => wrapper.findAll('.erf-titel span').map((s) => s.text()).join(' | ')

describe('Erfassung', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '4', '7']) })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('ohne Starter gibt es nichts zu erfassen', () => {
    const wrapper = ansicht(createStoreLeer())
    expect(wrapper.find('.empty').text()).toContain('Noch keine Starter')
    expect(wrapper.find('.erf-tabelle').exists()).toBe(false)
    wrapper.unmount()
  })

  it('zeigt genau einen Bogen: erster Parcours, erste Klasse, 1. Lauf, erste Liste – wie bei den WKR-Listen gewählt', async () => {
    const wrapper = ansicht(store)
    expect(titel(wrapper)).toBe('Zeit | Klasse 1 | 1. Lauf | Parcours 1')
    expect(wrapper.findAll('.erf-bogen')).toHaveLength(1)
    // Parcours 2 hat die Klassen 4 und 7; Mann-über-Bord gibt es erst dort.
    expect(wrapper.findAll('.eingabe-chip').map((c) => c.attributes('data-liste'))).not.toContain('mueb')
    await waehle(wrapper, 'parcours', 'par_2')
    expect(wrapper.findAll('select[data-feld="erf-klasse"] option').map((o) => o.attributes('value'))).toEqual(['4', '7'])
    await waehle(wrapper, 'klasse', '7')
    await waehle(wrapper, 'lauf', '2')
    await waehle(wrapper, 'liste', 'mueb')
    expect(titel(wrapper)).toBe('Mann-über-Bord | Klasse 7 | 2. Lauf | Parcours 2')
    wrapper.unmount()
  })

  it('dieselben Zeilen in derselben Reihenfolge wie auf dem gedruckten Bogen, ohne Leerzeilen', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, 'parcours', 'par_2')
    await waehle(wrapper, 'klasse', '4')
    const papier = wkrBoegenZumStand(store.state.value, configFor()).boegen.find((b) => b.parcoursId === 'par_2' && b.klassen.includes('4') && b.lauf === 1 && b.typeId === 'zeit')!
    expect(zeilen(wrapper).map((z) => z.attributes('data-zeile'))).toEqual(papier.auftrag.zeilen.map((z) => z.id))
    expect(zeilen(wrapper).map((z) => z.find('.erf-nr').text())).toEqual(['401', '402', '403'])
    // Dieselben Spalten wie auf dem Papier, dazu der Haken.
    expect(wrapper.findAll('.erf-tabelle thead th').map((t) => t.text())).toEqual(['Nr.', 'Zeit 1', 'Zeit 2', 'Zeit 3', '✓'])
    wrapper.unmount()
  })

  it('Zeit: tolerantes Format, Enter springt in derselben Spalte nach unten, am Ende in die nächste Spalte', async () => {
    const wrapper = ansicht(store)
    const z1 = feld(wrapper, 0, 'zeit1')
    await tippe(z1, '1.2345')
    // Der Punkt wird zum Komma; unerlaubte Zeichen verschwinden beim Tippen.
    expect(z1.element.value).toBe('1,2345')
    await taste(z1, 'Enter')
    expect(fokus()).toBe('id-1-2|zeit1')
    expect(store.state.value.eingaben[L1]['id-1-1']).toEqual({ zeit1: '1,2345' })
    await nextTick()
    // Nach dem Verlassen steht die Zeit ausgeschrieben da; gespeichert bleibt die Roh-Eingabe.
    expect(feld(wrapper, 0, 'zeit1').element.value).toBe('01:23,45 (83,45)')

    const z2 = feld(wrapper, 1, 'zeit1')
    await tippe(z2, '83,5x')
    expect(z2.element.value).toBe('83,5')
    await taste(z2, 'Enter')
    expect(fokus()).toBe('id-1-3|zeit1')
    const z3 = feld(wrapper, 2, 'zeit1')
    await tippe(z3, '84')
    await taste(z3, 'Enter')
    // Letzte Zeile: weiter oben in der nächsten Spalte.
    expect(fokus()).toBe('id-1-1|zeit2')
    expect(store.state.value.eingaben[L1]).toEqual({ 'id-1-1': { zeit1: '1,2345' }, 'id-1-2': { zeit1: '83,5' }, 'id-1-3': { zeit1: '84' } })
    wrapper.unmount()
  })

  it('Zeit mit Doppelpunkt, wie die Uhr sie zeigt: 1:23,45 sind 83,45 Sekunden, nicht 123,45', async () => {
    const wrapper = ansicht(store)
    const z1 = feld(wrapper, 0, 'zeit1')
    await tippe(z1, '1:23,45')
    expect(z1.element.value).toBe('1:23,45')
    await taste(z1, 'Enter')
    await nextTick()
    expect(store.state.value.eingaben[L1]['id-1-1']).toEqual({ zeit1: '1:23,45' })
    expect(feld(wrapper, 0, 'zeit1').element.value).toBe('01:23,45 (83,45)')
    wrapper.unmount()
  })

  it('Zeit: jeder Tastendruck ist gespeichert, nicht erst das Verlassen des Feldes', async () => {
    const wrapper = ansicht(store)
    const z1 = feld(wrapper, 0, 'zeit1')
    await tippe(z1, '88,8')
    // Kein Enter, kein Verlassen: Ein Neuladen jetzt verlöre nichts.
    expect(store.state.value.eingaben[L1]['id-1-1']).toEqual({ zeit1: '88,8' })
    expect(JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}').eingaben?.[L1]?.['id-1-1']).toEqual({ zeit1: '88,8' })
    // Beim Tippen bleibt die Roh-Eingabe stehen, die Zelle springt nicht in die Anzeige.
    expect(z1.element.value).toBe('88,8')
    await tippe(z1, '')
    expect(store.state.value.eingaben[L1]).toBeUndefined()
    wrapper.unmount()
  })

  it('englische Oberfläche: Zeiten erscheinen und entstehen mit Dezimalpunkt; im Stand steht das Komma', async () => {
    setLocale('en')
    const wrapper = ansicht(store)
    await nextTick()
    const z1 = feld(wrapper, 0, 'zeit1')
    await tippe(z1, '83,5')
    expect(z1.element.value).toBe('83.5')
    await taste(z1, 'Enter')
    await nextTick()
    expect(store.state.value.eingaben[L1]['id-1-1']).toEqual({ zeit1: '83,5' })
    expect(feld(wrapper, 0, 'zeit1').element.value).toBe('01:23.50 (83.50)')
    setLocale('de')
    await nextTick()
    expect(feld(wrapper, 0, 'zeit1').element.value).toBe('01:23,50 (83,50)')
    wrapper.unmount()
  })

  it('Werte, die keine Liste mehr zeigt (Klassenwechsel), sind gemeldet', async () => {
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: L1, starter: 'id-4-1', feld: 'katalog:mueb', wert: '17' }] })
    const wrapper = ansicht(store)
    await nextTick()
    expect(wrapper.find('[data-hinweis="verborgene-eingaben"]').exists()).toBe(false)
    // Klasse 1 fährt kein „Mann über Bord“.
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-4-1', patch: { klasse: '1' } })
    await nextTick()
    expect(wrapper.find('[data-hinweis="verborgene-eingaben"]').text()).toContain('Für 1 Starter steht 1 erfasster Wert im Stand')
    wrapper.unmount()
  })

  it('die Auswahl übersteht ein Neuladen: Wer weitertippt, schreibt in denselben Lauf derselben Klasse', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, 'parcours', 'par_2')
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'lauf', '2')
    await waehle(wrapper, 'liste', 'steg')
    const vorher = titel(wrapper)
    expect(vorher).toContain('2. Lauf')
    wrapper.unmount()
    // Neuladen: Der Arbeitsspeicher ist leer, der sessionStorage des Fensters bleibt.
    const gemerkt = sessionStorage.getItem('alcatraz.merke.erfassung.wahl')
    expect(JSON.parse(gemerkt!)).toEqual({ parcours: 'par_2', klasse: '4', lauf: 2, liste: 'steg' })
    vergissAlles()
    sessionStorage.setItem('alcatraz.merke.erfassung.wahl', gemerkt!)
    // Der Stand der Veranstaltung kommt aus dem localStorage zurück.
    const neu = ansicht(createStore())
    await nextTick()
    expect(titel(neu)).toBe(vorher)
    neu.unmount()
  })

  it('Pfeiltasten: hoch und runter in der Spalte, links und rechts am Rand des Feldes', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', 'gate135')
    const spalten = zeilen(wrapper)[0].findAll('td[data-spalte]').filter((td) => td.find('input').exists()).map((td) => td.attributes('data-spalte')!)
    const erste = feld(wrapper, 0, spalten[0])
    await tippe(erste, '5')
    await taste(erste, 'ArrowDown')
    expect(fokus()).toBe(`id-1-2|${spalten[0]}`)
    await taste(feld(wrapper, 1, spalten[0]), 'ArrowUp')
    expect(fokus()).toBe(`id-1-1|${spalten[0]}`)
    await taste(feld(wrapper, 0, spalten[0]), 'ArrowRight')
    expect(fokus()).toBe(`id-1-1|${spalten[1]}`)
    await taste(feld(wrapper, 0, spalten[1]), 'ArrowLeft')
    expect(fokus()).toBe(`id-1-1|${spalten[0]}`)
    // Enter wie Pfeil runter; in der letzten Zeile bleibt der Fokus stehen.
    await taste(feld(wrapper, 0, spalten[0]), 'Enter')
    expect(fokus()).toBe(`id-1-2|${spalten[0]}`)
    await taste(feld(wrapper, 2, spalten[0]), 'ArrowDown')
    // Steht der Cursor mitten im Text, bewegt der Pfeil nur den Cursor.
    const mitText = feld(wrapper, 0, spalten[0])
    mitText.element.focus()
    mitText.element.setSelectionRange(0, 0)
    await taste(mitText, 'ArrowRight')
    expect(fokus()).toBe(`id-1-1|${spalten[0]}`)
    wrapper.unmount()
  })

  it('Bojen: Punkte oder ein erlaubter Disq-Buchstabe; die Zelle sagt, an welcher Boje', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', 'gate135')
    const a = feld(wrapper, 0, 't1a#0')
    await tippe(a, '5')
    const b = feld(wrapper, 0, 't1a#1')
    await tippe(b, 'g')
    expect(b.element.value).toBe('G')
    // Ein Buchstabe, den es als Disqualifikation nicht gibt, wird nicht angenommen.
    const c = feld(wrapper, 1, 't1a#0')
    await tippe(c, 'z')
    expect(c.element.value).toBe('')
    const werte = store.state.value.eingaben[L1]['id-1-1']
    expect(Object.keys(werte).sort()).toEqual(['t1a|hin seiteA', 't1a|hin seiteB'])
    expect(Object.values(werte).sort()).toEqual(['5', 'G'])
    expect(store.state.value.eingaben[L1]['id-1-2']).toBeUndefined()
    await nextTick()
    // Σ rechnet mit; der Buchstabe aus der Boje steht blass in der Disq-Zelle.
    expect(zeilen(wrapper)[0].find('td[data-spalte="sum"]').text()).toBe('5')
    expect(feld(wrapper, 0, 'disq').attributes('placeholder')).toBe('G')
    wrapper.unmount()
  })

  it('Fehlercodes: beim Verlassen sortiert und zusammengefasst; Unbekanntes wird gemeldet, nicht still verworfen', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', 'steg')
    const ab = feld(wrapper, 0, 'fehlerAB')
    await tippe(ab, '3 3 12 k')
    await ab.trigger('blur')
    expect(store.state.value.eingaben[L1]['id-1-1']).toEqual({ 'katalog:stegAblegen': '2x3, K' })
    await nextTick()
    expect(feld(wrapper, 0, 'fehlerAB').element.value).toBe('2x3, K')
    expect(wrapper.find('.erf-bogen [role="alert"]').text()).toContain('„12“')
    expect(zeilen(wrapper)[0].find('td[data-spalte="fpab"]').text()).toBe('2x5')
    wrapper.unmount()
  })

  it('Nicht gestartet: ein x in „Disq.“ am Vorsteg', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', 'vorsteg')
    const disq = feld(wrapper, 1, 'disq')
    await tippe(disq, 'x')
    expect(disq.element.value).toBe('X')
    expect(store.state.value.eingaben[L1]['id-1-2']).toEqual({ 'disq@vorsteg': 'X' })
    wrapper.unmount()
  })

  it('Fortschritt je Bogen: Zeilen mit Wert und bestätigte leere Zeilen', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', 'gate135')
    const stand = () => wrapper.find('.erf-stand-text').text()
    const chip = () => wrapper.find('.eingabe-chip[data-liste="gate135"]')
    expect(stand()).toBe('0 von 3 erfasst')
    await tippe(feld(wrapper, 0, 't1a#0'), '5')
    await nextTick()
    expect(stand()).toBe('1 von 3 erfasst')
    expect(chip().text()).toContain('1/3')
    // Mit Werten ist die Zeile ohnehin erfasst: Der Haken ist gesetzt und gesperrt.
    const haken = (i: number) => zeilen(wrapper)[i].find('.erf-haken input')
    expect((haken(0).element as HTMLInputElement).checked).toBe(true)
    expect(haken(0).attributes('disabled')).toBeDefined()
    // Eine fehlerfreie Fahrt: von Hand abhaken.
    await haken(1).setValue(true)
    expect(stand()).toBe('2 von 3 erfasst')
    expect(store.state.value.eingaben[L1]['id-1-2']).toEqual({ 'erfasst@gate135': '1' })
    // Der Rest auf einen Schlag.
    await wrapper.find('[data-action="alle-bestaetigen"]').trigger('click')
    expect(stand()).toBe('3 von 3 erfasst')
    expect(chip().classes()).toContain('fertig')
    expect(wrapper.find('[data-action="alle-bestaetigen"]').attributes('disabled')).toBeDefined()
    // Haken wieder weg: Die Zeile ist offen.
    await haken(2).setValue(false)
    expect(stand()).toBe('2 von 3 erfasst')
    wrapper.unmount()
  })

  it('kennzeichnet Unplausibles: Zeile, Zelle und Hinweis in Worten', async () => {
    const wrapper = ansicht(store)
    const z1 = feld(wrapper, 0, 'zeit1')
    await tippe(z1, '83,00')
    await z1.trigger('blur')
    const z2 = feld(wrapper, 0, 'zeit2')
    await tippe(z2, '86,00')
    await z2.trigger('blur')
    await nextTick()
    expect(zeilen(wrapper)[0].classes()).toContain('erf-zeile--hinweis')
    expect(wrapper.find('.erf-hinweise').text()).toContain('mehr als eine Sekunde')
    expect(wrapper.find('.erf-stand-warn').text()).toBe('1 Zeile prüfen')
    await waehle(wrapper, 'liste', 'gate135')
    await tippe(feld(wrapper, 1, 't1a#0'), '7')
    await nextTick()
    expect(feld(wrapper, 1, 't1a#0').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('.erf-hinweise').text()).toContain('Vielfaches von 5')
    wrapper.unmount()
  })

  it('jeder Lauf hat eigene Werte; „Nächste Liste“ geht zur nächsten unfertigen', async () => {
    const wrapper = ansicht(store)
    await tippe(feld(wrapper, 0, 'zeit1'), '80')
    await feld(wrapper, 0, 'zeit1').trigger('blur')
    await waehle(wrapper, 'lauf', '2')
    expect(feld(wrapper, 0, 'zeit1').element.value).toBe('')
    await waehle(wrapper, 'lauf', '1')
    expect(feld(wrapper, 0, 'zeit1').element.value).toBe('01:20,00 (80,00)')
    await wrapper.find('[data-action="weiter"]').trigger('click')
    expect(titel(wrapper)).toContain('Vorsteg')
    wrapper.unmount()
  })

  it('Clubmeisterschaft: mehrere Klassen auf einem Bogen, mit Zwischenüberschrift; die Tastatur überspringt sie', async () => {
    store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
    const wrapper = ansicht(store)
    await waehle(wrapper, 'parcours', 'par_2')
    await waehle(wrapper, 'liste', 'steg')
    expect(titel(wrapper)).toContain('Klassen 4, 7')
    expect(wrapper.findAll('.erf-zwischen').map((z) => z.text())).toEqual(['Klasse 4', 'Klasse 7'])
    expect(zeilen(wrapper)).toHaveLength(6)
    // Von der letzten Zeile der Klasse 4 nach unten: in die erste der Klasse 7.
    const letzte = feld(wrapper, 2, 'fehlerAB')
    letzte.element.focus()
    await taste(letzte, 'ArrowDown')
    expect(fokus()).toBe('id-7-1|fehlerAB')
    await tippe(feld(wrapper, 3, 'fehlerAN'), '9')
    expect(store.state.value.eingaben[L1]['id-7-1']).toEqual({ 'katalog:stegAnlegen': '9' })
    wrapper.unmount()
  })

  it('englische Oberfläche und UIM: englische Texte, Klassenname aus dem Regelwerk, Verweis für den Parallel-Slalom', async () => {
    store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['E', '2']) })
    setLocale('en')
    const wrapper = ansicht(store)
    await nextTick()
    expect(wrapper.find('h2').text()).toBe('Data entry')
    expect(titel(wrapper)).toBe('Time | Class Dolphin | Attempt 1 | Parcours 1')
    expect(wrapper.find('.erf-stand-text').text()).toBe('0 of 3 entered')
    expect(wrapper.findAll('select[data-feld="erf-lauf"] option')[0].text()).toBe('Attempt 1')
    expect(wrapper.find('.boat-banner.ok').text()).toContain('parallel slalom')
    setLocale('de')
    await nextTick()
    expect(wrapper.find('.erf-stand-text').text()).toBe('0 von 3 erfasst')
    wrapper.unmount()
  })
})

/** Ein Store ganz ohne Starter. */
function createStoreLeer(): Store {
  localStorage.clear()
  return createStore()
}
