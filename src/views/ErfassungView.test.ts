import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  it('X im Lauf: Die Zeile des Starters ist in JEDER Liste dieses Laufs schraffiert – ohne X nicht, und Eingaben bleiben möglich', async () => {
    const wrapper = ansicht(store)
    const schraffiert = () => zeilen(wrapper).filter((z) => z.attributes('data-nicht-gestartet') !== undefined).map((z) => z.attributes('data-zeile'))
    await waehle(wrapper, 'liste', 'vorsteg')
    expect(schraffiert()).toEqual([])
    // Von Hand gesetzt.
    await tippe(feld(wrapper, 1, 'disq'), 'x')
    await nextTick()
    expect(schraffiert()).toEqual(['id-1-2'])
    expect(zeilen(wrapper)[1].classes()).toContain('erf-zeile--x')
    expect(zeilen(wrapper)[1].find('.erf-x-marke').text()).toContain('Nicht gestartet')
    // Auf jeder anderen Liste desselben Laufs ebenso – dort steht das X gar nicht.
    for (const liste of ['zeit', 'steg', 'gate135', 'parcours']) {
      await waehle(wrapper, 'liste', liste)
      expect(schraffiert(), liste).toEqual(['id-1-2'])
    }
    // Die Felder der Zeile bleiben bedienbar.
    await waehle(wrapper, 'liste', 'gate135')
    expect(feld(wrapper, 1, 't1a#0').attributes('disabled')).toBeUndefined()
    // Ein anderer Lauf hat kein X: keine Schraffur.
    await waehle(wrapper, 'lauf', '2')
    expect(schraffiert()).toEqual([])
    // Das X wieder entfernt (er fährt doch): Die Schraffur ist weg.
    await waehle(wrapper, 'lauf', '1')
    await waehle(wrapper, 'liste', 'vorsteg')
    await tippe(feld(wrapper, 1, 'disq'), '')
    await nextTick()
    expect(schraffiert()).toEqual([])
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
    expect(titel(wrapper)).toBe('Time | Class Dolphin | Attempt 1 | Course 1')
    expect(wrapper.find('.erf-stand-text').text()).toBe('0 of 3 entered')
    expect(wrapper.findAll('select[data-feld="erf-lauf"] option')[0].text()).toBe('Attempt 1')
    // Kein Verweis mehr auf den Prototyp: Der Parallelslalom wird hier erfasst, die Disziplin steht zur Wahl.
    expect(wrapper.find('[data-hinweis="parallel-wertung"]').text()).toContain('parallel slalom')
    expect(wrapper.html()).not.toMatch(/prototyp/i)
    expect(wrapper.findAll('.eingabe-disziplin button').map((b) => b.attributes('data-disziplin'))).toEqual(['manoever', 'parallel'])
    setLocale('de')
    await nextTick()
    expect(wrapper.find('.erf-stand-text').text()).toBe('0 von 3 erfasst')
    // Die Erfassung ist Bedienung: Auch der Name der Liste und die Spaltenköpfe folgen der
    // Oberfläche – nicht dem Regelwerk (UIM: englisch) und nicht der Sprache des Bogens.
    expect(titel(wrapper)).toBe('Zeit | Klasse Dolphin | 1. Lauf | Parcours 1')
    store.dispatch({ type: 'SET_WKR_SPRACHE', typeIds: ['zeit'], sprache: 'de+en' })
    await nextTick()
    expect(titel(wrapper)).toBe('Zeit | Klasse Dolphin | 1. Lauf | Parcours 1')
    wrapper.unmount()
  })
})

describe('Erfassung: alle Listen untereinander', () => {
  let store: Store
  /** Die Abschnitte des Stapels, von oben nach unten. */
  const abschnitte = (wrapper: VueWrapper) => wrapper.findAll('.eingabe-stapel [data-abschnitt]')
  const namen = (wrapper: VueWrapper) => wrapper.findAll('.erf-titel').map((k) => k.find('span').text())
  /** Ein Feld in einer bestimmten Liste des Stapels. */
  const feldIn = (wrapper: VueWrapper, liste: string, zeile: number, spalte: string) =>
    wrapper.findAll(`.eingabe-stapel [data-bogen$="|${liste}"] tbody tr[data-zeile]`)[zeile].find(`td[data-spalte="${spalte}"] input`) as DOMWrapper<HTMLInputElement>

  beforeEach(() => {
    localStorage.clear()
    vergissAlles()
    setLocale('de')
    // Das Test-DOM kennt den Beobachter, meldet aber nie Sichtbarkeit: Ohne ihn baut die Ansicht alle Listen sofort auf.
    vi.stubGlobal('IntersectionObserver', undefined)
    store = createStore()
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '4', '7']) })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vergissAlles()
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('über das Abmelden gesetzt: schraffiert in jedem Lauf, auch im Blattstapel; die Knoten-Liste (ohne Lauf), wenn er in keinem Lauf startet', async () => {
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: L1, starter: 'id-1-1', feld: 'zeit1', wert: '80' }] })
    store.dispatch({ type: 'ABMELDEN_STARTER', id: 'id-1-3' })
    const wrapper = ansicht(store)
    const jeListe = () =>
      wrapper.findAll('.erf-bogen').map((b) => b.findAll('tbody tr[data-nicht-gestartet]').map((z) => z.attributes('data-zeile')).join(','))
    await waehle(wrapper, 'liste', '*')
    for (const lauf of ['1', '2', '3']) {
      await waehle(wrapper, 'lauf', lauf)
      const listen = jeListe()
      expect(listen.length, lauf).toBeGreaterThanOrEqual(7)
      expect(new Set(listen), lauf).toEqual(new Set(['id-1-3']))
    }
    // Im letzten Lauf liegt die Knoten-Liste im Stapel: auch dort schraffiert.
    expect(wrapper.find('.erf-bogen[data-bogen*="knoten"] tr[data-nicht-gestartet]').attributes('data-zeile')).toBe('id-1-3')
    // Fährt er einen Lauf doch (X entfernt), ist die Knoten-Zeile nicht mehr schraffiert.
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 2), starter: 'id-1-3', feld: 'disq@steg', wert: '' }] })
    await nextTick()
    expect(wrapper.find('.erf-bogen[data-bogen*="knoten"] tr[data-nicht-gestartet]').exists()).toBe(false)
    expect(new Set(jeListe().filter(Boolean))).toEqual(new Set(['id-1-3']))
    wrapper.unmount()
  })

  it('von Hand: „alle untereinander“ in der Auswahl der Liste zeigt den Blattstapel in der Reihenfolge der Listen', async () => {
    const wrapper = ansicht(store)
    expect(wrapper.findAll('select[data-feld="erf-liste"] option').at(-1)!.text()).toBe('alle untereinander')
    expect(namen(wrapper)).toEqual(['Zeit'])
    await waehle(wrapper, 'liste', '*')
    // Klasse 1 fährt kein „Mann über Bord“; die Knoten liegen im Stapel des letzten Laufs.
    expect(namen(wrapper)).toEqual(['Zeit', 'Vorsteg', 'Steg', 'Tor 1 / 3 / 5', 'Tor 2 / 4 / 5', 'Tor 5', 'Parcours'])
    expect(abschnitte(wrapper)).toHaveLength(7)
    // Statt des Umschalters steht die Sprungleiste über den Listen.
    expect(wrapper.find('.eingabe-listen').exists()).toBe(false)
    expect(wrapper.findAll('.eingabe-sprung [data-sprung]')).toHaveLength(7)
    expect(wrapper.find('.eingabe-summe').text()).toBe('Dieser Blattstapel: 0 von 21 Zeilen auf 7 Listen erfasst.')
    await waehle(wrapper, 'lauf', '3')
    expect(namen(wrapper).at(-1)).toBe('Knoten')
    // Zurück zu einer einzelnen Liste.
    await waehle(wrapper, 'liste', 'steg')
    expect(namen(wrapper)).toEqual(['Steg'])
    expect(wrapper.find('.eingabe-stapel').exists()).toBe(false)
    wrapper.unmount()
  })

  it('jede Liste nimmt Eingaben an: Werte, Haken und „leere Zeilen bestätigen“ gelten je Liste', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', '*')
    await tippe(feldIn(wrapper, 'zeit', 0, 'zeit1'), '80')
    await tippe(feldIn(wrapper, 'steg', 1, 'fehlerAB'), '3')
    await tippe(feldIn(wrapper, 'vorsteg', 2, 'disq'), 'x')
    await nextTick()
    expect(store.state.value.eingaben[L1]).toEqual({ 'id-1-1': { zeit1: '80' }, 'id-1-2': { 'katalog:stegAblegen': '3' }, 'id-1-3': { 'disq@vorsteg': 'X' } })
    const chip = (liste: string) => wrapper.find(`.eingabe-sprung [data-liste="${liste}"]`)
    expect(chip('zeit').text()).toContain('1/3')
    expect(chip('steg').text()).toContain('1/3')
    expect(chip('gate135').text()).toContain('0/3')
    // Der Haken der Tor-Liste gilt nur für sie.
    const tor = wrapper.find('.eingabe-stapel [data-bogen$="|gate135"]')
    await tor.findAll('.erf-haken input[type="checkbox"]')[0].setValue(true)
    expect(store.state.value.eingaben[L1]['id-1-1']).toEqual({ zeit1: '80', 'erfasst@gate135': '1' })
    await tor.find('[data-action="alle-bestaetigen"]').trigger('click')
    expect(chip('gate135').classes()).toContain('fertig')
    expect(chip('gate245').text()).toContain('0/3')
    expect(tor.find('.erf-stand-text').text()).toBe('3 von 3 erfasst')
    expect(wrapper.find('.eingabe-stapel [data-bogen$="|steg"] .erf-stand-text').text()).toBe('1 von 3 erfasst')
    wrapper.unmount()
  })

  it('Pfeiltasten und Enter bleiben in ihrer Liste: Die Spalten der nächsten sind andere', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', '*')
    const letzte = feldIn(wrapper, 'vorsteg', 2, 'disq')
    letzte.element.focus()
    await taste(letzte, 'ArrowDown')
    expect(document.activeElement).toBe(letzte.element)
    await taste(letzte, 'Enter')
    expect(document.activeElement).toBe(letzte.element)
    // Am rechten Rand der letzten Zelle geht es nicht in die Liste darunter, am linken der ersten nicht in die darüber.
    const felder = wrapper.findAll('.eingabe-stapel [data-bogen$="|vorsteg"] tbody input:not([type=checkbox])')
    const ende = felder.at(-1)! as DOMWrapper<HTMLInputElement>
    ende.element.focus()
    await taste(ende, 'ArrowRight')
    expect(document.activeElement).toBe(ende.element)
    const anfang = felder[0] as DOMWrapper<HTMLInputElement>
    anfang.element.focus()
    await taste(anfang, 'ArrowLeft')
    expect(document.activeElement).toBe(anfang.element)
    // Innerhalb der Liste wie gewohnt.
    const oben = feldIn(wrapper, 'vorsteg', 0, 'disq')
    oben.element.focus()
    await taste(oben, 'ArrowDown')
    expect(fokus()).toBe('id-1-2|disq')
    expect(document.activeElement?.closest('[data-bogen]')?.getAttribute('data-bogen')).toMatch(/\|vorsteg$/)
    wrapper.unmount()
  })

  it('die Sprungleiste stellt den Cursor in die erste Zelle ihrer Liste; „Nächste offene Liste“ in die erste unfertige', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', '*')
    await wrapper.find('.eingabe-sprung [data-liste="steg"]').trigger('click')
    await nextTick()
    expect(fokus()).toBe('id-1-1|fehlerAB')
    expect(document.activeElement?.closest('[data-bogen]')?.getAttribute('data-bogen')).toMatch(/\|steg$/)
    // Die Zeitliste ist fertig, der Vorsteg nicht.
    for (const i of [0, 1, 2]) await tippe(feldIn(wrapper, 'zeit', i, 'zeit1'), '80')
    await wrapper.find('[data-action="weiter"]').trigger('click')
    await nextTick()
    expect(document.activeElement?.closest('[data-bogen]')?.getAttribute('data-bogen')).toMatch(/\|vorsteg$/)
    wrapper.unmount()
  })

  it('die Wahl übersteht Ansichtswechsel und Neuladen', async () => {
    const wrapper = ansicht(store)
    await waehle(wrapper, 'parcours', 'par_2')
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'liste', '*')
    const vorher = namen(wrapper)
    expect(vorher).toContain('Mann-über-Bord')
    wrapper.unmount()
    // Ansichtswechsel: Die Ansicht wird neu aufgebaut.
    const wieder = ansicht(store)
    expect(namen(wieder)).toEqual(vorher)
    wieder.unmount()
    // Neuladen: Der Arbeitsspeicher ist leer, der sessionStorage des Fensters bleibt.
    const gemerkt = sessionStorage.getItem('alcatraz.merke.erfassung.wahl')
    expect(JSON.parse(gemerkt!)).toMatchObject({ parcours: 'par_2', klasse: '4', liste: '*' })
    vergissAlles()
    sessionStorage.setItem('alcatraz.merke.erfassung.wahl', gemerkt!)
    const neu = ansicht(createStore())
    await nextTick()
    expect(namen(neu)).toEqual(vorher)
    expect((neu.find('select[data-feld="erf-liste"]').element as HTMLSelectElement).value).toBe('*')
    neu.unmount()
  })

  it('aufgebaut wird eine Liste erst in der Nähe des Fensters; bis dahin hält ein Platzhalter ihren Platz', async () => {
    let melde: (eintraege: unknown[]) => void = () => {}
    const beobachtet: Element[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(rueckruf: (eintraege: unknown[]) => void) {
          melde = rueckruf
        }
        observe(el: Element) {
          beobachtet.push(el)
        }
        unobserve() {}
        disconnect() {}
      },
    )
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', '*')
    // Die erste Liste steht sofort da (dort beginnt das Abtippen), die übrigen sind Platzhalter.
    expect(namen(wrapper)).toEqual(['Zeit'])
    expect(wrapper.findAll('.erf-platz')).toHaveLength(6)
    expect(wrapper.findAll('.eingabe-sprung [data-sprung]')).toHaveLength(7)
    const steg = abschnitte(wrapper).find((a) => a.attributes('data-abschnitt')!.endsWith('|steg'))!
    expect(beobachtet).toContain(steg.element)
    melde([{ isIntersecting: true, target: steg.element }])
    await nextTick()
    expect(namen(wrapper)).toEqual(['Zeit', 'Steg'])
    // Wer eine Liste anspringt, bekommt sie sofort.
    await wrapper.find('.eingabe-sprung [data-liste="parcours"]').trigger('click')
    await nextTick()
    expect(namen(wrapper)).toEqual(['Zeit', 'Steg', 'Parcours'])
    wrapper.unmount()
  })
})

describe('Erfassung unter UIM mit „Versuche direkt nacheinander“', () => {
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('ein Bogen je Liste: jeder Starter mit 1. und 2. Versuch direkt nacheinander – jede Zeile schreibt unter ihren Versuch', async () => {
    localStorage.clear()
    vergissAlles()
    const store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'SET_VERSUCHE_NACHEINANDER', on: true })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1'], 2) })
    const wrapper = ansicht(store)
    // Kein Lauf im Titel und keine Lauf-Auswahl: Der eine Bogen trägt beide Versuche.
    expect(titel(wrapper)).not.toMatch(/Lauf|Attempt \d/)
    expect(wrapper.find('select[data-feld="erf-lauf"]').exists()).toBe(false)
    expect(zeilen(wrapper).map((z) => [z.find('.erf-nr').text(), z.attributes('data-starter'), z.attributes('data-attempt'), z.find('.erf-attempt').text()])).toEqual([
      ['101', 'id-1-1', '1', '1'],
      ['101', 'id-1-1', '2', '2'],
      ['102', 'id-1-2', '1', '1'],
      ['102', 'id-1-2', '2', '2'],
    ])
    // Zeile 2 ist der 2. Versuch von 101, Zeile 3 der 1. Versuch von 102.
    const spalte = zeilen(wrapper)[0].find('td[data-spalte] input').element.closest('td')!.getAttribute('data-spalte')!
    await tippe(feld(wrapper, 0, spalte), '60,00')
    await tippe(feld(wrapper, 1, spalte), '61,00')
    await tippe(feld(wrapper, 2, spalte), '70,00')
    const kennung = Object.keys(store.state.value.eingaben['manoevrieren/1']['id-1-1'])[0]
    expect(store.state.value.eingaben).toEqual({
      'manoevrieren/1': { 'id-1-1': { [kennung]: '60,00' }, 'id-1-2': { [kennung]: '70,00' } },
      'manoevrieren/2': { 'id-1-1': { [kennung]: '61,00' } },
    })
    // Der Fortschritt zählt die Zeilen des Papiers: drei von vier.
    expect(wrapper.find('.erf-stand-text').text()).toMatch(/3.*4/)
    wrapper.unmount()
  })

  it('Vorsteg: eine Zeile je Starter – was dort steht, gilt für jeden Versuch', async () => {
    localStorage.clear()
    vergissAlles()
    const store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'SET_VERSUCHE_NACHEINANDER', on: true })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1'], 2) })
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', 'vorsteg')
    expect(titel(wrapper)).not.toMatch(/Lauf|Attempt \d|Versuch/)
    expect(wrapper.findAll('.erf-tabelle thead th').map((th) => th.text())).not.toContain('Versuch')
    expect(zeilen(wrapper).map((z) => [z.find('.erf-nr').text(), z.attributes('data-zeile'), z.find('.erf-attempt').exists()])).toEqual([
      ['101', 'id-1-1', false],
      ['102', 'id-1-2', false],
    ])
    // Ein X „Nicht gestartet“ am Vorsteg steht unter beiden Versuchen: Er startet in keinem.
    await tippe(feld(wrapper, 0, 'disq'), 'x')
    const B = 'bemerkung@vorsteg'
    expect(store.state.value.eingaben).toEqual({
      'manoevrieren/1': { 'id-1-1': { 'disq@vorsteg': 'X' } },
      'manoevrieren/2': { 'id-1-1': { 'disq@vorsteg': 'X' } },
    })
    expect(zeilen(wrapper)[0].attributes('data-nicht-gestartet')).toBe('')
    // Der Haken „erfasst“ ebenso.
    await zeilen(wrapper)[1].find('td.erf-haken input').setValue(true)
    expect(store.state.value.eingaben['manoevrieren/2']['id-1-2']).toEqual({ 'erfasst@vorsteg': '1' })
    expect(wrapper.find('.erf-stand-text').text()).toMatch(/2.*2/)
    // Stand im 2. Versuch etwas anderes (aus der Zeit vor der Option), fällt es auf – die nächste Eingabe gleicht an.
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/2', starter: 'id-1-2', feld: B, wert: 'alt' }] })
    await nextTick()
    expect(zeilen(wrapper)[1].classes()).toContain('erf-zeile--hinweis')
    expect(wrapper.find('.erf-hinweise').text()).toContain('gilt für jeden Versuch')
    await tippe(feld(wrapper, 1, 'bemerkung'), 'Helm')
    expect(store.state.value.eingaben['manoevrieren/1']['id-1-2']).toEqual({ 'erfasst@vorsteg': '1', [B]: 'Helm' })
    expect(store.state.value.eingaben['manoevrieren/2']['id-1-2']).toEqual({ 'erfasst@vorsteg': '1', [B]: 'Helm' })
    expect(zeilen(wrapper)[1].classes()).not.toContain('erf-zeile--hinweis')
    // Ein X nur im 1. Versuch (etwa am Steg) schraffiert die Vorsteg-Zeile nicht: Er startet im 2.
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: 'id-1-2', feld: 'disq@steg', wert: 'X' }] })
    await nextTick()
    expect(zeilen(wrapper)[1].attributes('data-nicht-gestartet')).toBeUndefined()
    wrapper.unmount()
  })

  it('Vorsteg: „leere Zeilen bestätigen“ lässt eine Zeile aus, deren späterer Versuch etwas anderes trägt – das X bleibt', async () => {
    localStorage.clear()
    vergissAlles()
    const store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1'], 2) })
    // Vor der Option: X im 2. Versuch für 101.
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/2', starter: 'id-1-1', feld: 'disq@vorsteg', wert: 'X' }] })
    store.dispatch({ type: 'SET_VERSUCHE_NACHEINANDER', on: true })
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', 'vorsteg')
    expect(zeilen(wrapper)[0].classes()).toContain('erf-zeile--hinweis')
    const knopf = wrapper.find('[data-action="alle-bestaetigen"]')
    expect(knopf.text()).toMatch(/\b1\b/)
    await knopf.trigger('click')
    expect(store.state.value.eingaben['manoevrieren/2']['id-1-1']).toEqual({ 'disq@vorsteg': 'X' })
    expect(store.state.value.eingaben['manoevrieren/1']['id-1-1']).toBeUndefined()
    expect(store.state.value.eingaben['manoevrieren/1']['id-1-2']).toEqual({ 'erfasst@vorsteg': '1' })
    expect(store.state.value.eingaben['manoevrieren/2']['id-1-2']).toEqual({ 'erfasst@vorsteg': '1' })
    wrapper.unmount()
  })
})

describe('Vorsteg mit „Versuche direkt nacheinander“: Rückfrage vor dem Löschen eines X', () => {
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('löschte eine Eingabe das X eines späteren Versuchs, das die Zeile nicht zeigt, fragt die Erfassung vorher (Entscheidung des Nutzers vom 15.11.2026)', async () => {
    localStorage.clear()
    vergissAlles()
    const store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1'], 2) })
    // Vor der Option: X im 2. Versuch für 101, für 102 nur eine abweichende Bemerkung.
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: [
        { lauf: 'manoevrieren/2', starter: 'id-1-1', feld: 'disq@vorsteg', wert: 'X' },
        { lauf: 'manoevrieren/2', starter: 'id-1-2', feld: 'bemerkung@vorsteg', wert: 'alt' },
      ],
    })
    store.dispatch({ type: 'SET_VERSUCHE_NACHEINANDER', on: true })
    const wrapper = ansicht(store)
    await waehle(wrapper, 'liste', 'vorsteg')
    const vorher = store.state.value.eingaben
    const dialog = () => wrapper.find('[data-dialog="x-ueberschreiben"]')

    // Abbrechen („X behalten“): nichts geschrieben, das Feld zeigt wieder den gespeicherten Wert.
    await tippe(feld(wrapper, 0, 'bemerkung'), 'Helm')
    expect(dialog().exists()).toBe(true)
    expect(dialog().text()).toContain('101')
    expect(dialog().text()).toContain('Nicht gestartet')
    expect(store.state.value.eingaben).toBe(vorher)
    await dialog().find('[data-action="x-behalten"]').trigger('click')
    expect(dialog().exists()).toBe(false)
    expect(store.state.value.eingaben).toBe(vorher)
    expect(feld(wrapper, 0, 'bemerkung').element.value).toBe('')
    // Der Haken „erfasst“ ebenso: Er bleibt aus.
    const haken = zeilen(wrapper)[0].find('td.erf-haken input')
    await haken.setValue(true)
    expect(dialog().exists()).toBe(true)
    await dialog().find('[data-action="x-behalten"]').trigger('click')
    expect((haken.element as HTMLInputElement).checked).toBe(false)
    expect(store.state.value.eingaben).toBe(vorher)

    // Bestätigen: Die Eingabe gilt für jeden Versuch, das X ist gelöscht.
    await tippe(feld(wrapper, 0, 'bemerkung'), 'Helm')
    await dialog().find('[data-action="x-ueberschreiben"]').trigger('click')
    expect(dialog().exists()).toBe(false)
    expect(store.state.value.eingaben['manoevrieren/1']['id-1-1']).toEqual({ 'bemerkung@vorsteg': 'Helm' })
    expect(store.state.value.eingaben['manoevrieren/2']['id-1-1']).toEqual({ 'bemerkung@vorsteg': 'Helm' })

    // Ohne X bleibt alles wie bisher: Die Eingabe gleicht still an.
    await tippe(feld(wrapper, 1, 'bemerkung'), 'Weste')
    expect(dialog().exists()).toBe(false)
    expect(store.state.value.eingaben['manoevrieren/2']['id-1-2']).toEqual({ 'bemerkung@vorsteg': 'Weste' })
    wrapper.unmount()
  })
})

/** Ein Store ganz ohne Starter. */
function createStoreLeer(): Store {
  localStorage.clear()
  return createStore()
}
