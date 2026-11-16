import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { vergissAlles } from '../lib/merken'
import { SEITEN_VORGABE } from '../lib/seiten'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'
import { logoFolge, setzeTestLogos } from '../testHilfen'

// Der Reiter „Starterlisten“: eine Auswahl „Art“ statt zweier Reiter, die Markierung für eine
// Herkunft, die Liste je Herkunft nach Startnummer und der Kopf mit eigenen Feldern.
// Alle Starter und Vereine sind erfunden.

/** `n` Starter je Klasse; der Verein wechselt reihum, `vereinVon` kann ihn je Starter festlegen. */
function starter(klassen: ClassId[], n: number, vereinVon: (klasse: ClassId, i: number) => string = (_k, i) => ['MBC Nord', 'MBC Süd', 'WSV Ost'][i % 3]): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: vereinVon(klasse, i),
      bundesland: i % 2 === 0 ? 'Bayern' : 'Hessen',
      land: 'Deutschland',
      geburtsdatum: '2014-05-01',
      groesse: '',
      klasse,
    })),
  )
}
const ansicht = (store: Store) => mount(ListsView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
async function art(wrapper: VueWrapper, a: 'verzahnt' | 'herkunft' | 'klasse') {
  await wrapper.find(`.starter-arten button[data-art="${a}"]`).trigger('click')
  await nextTick()
}
/** Wählt im Auswahlfeld den Eintrag mit diesem Text. */
async function waehle(wrapper: VueWrapper, feld: 'starter-markierung' | 'starter-herkunft', text: string) {
  const select = wrapper.find(`select[data-feld="${feld}"]`)
  const option = select.findAll('option').find((o) => o.text() === text)
  if (!option) throw new Error(`Kein Eintrag „${text}“ in ${feld}`)
  await select.setValue(option.attributes('value'))
  await nextTick()
}
/** Der Kopf jedes Dokuments (seiner ersten Seite): die Felder, mit „|“ getrennt. */
const koepfe = (wrapper: VueWrapper) => wrapper.findAll('.listen-seite[data-seite="1"] .sheet-title-box').map((b) => b.findAll('[data-feld]').map((f) => f.text()).join(' | '))
const spalten = (wrapper: VueWrapper) => wrapper.find('.sheet-cols').findAll('th').map((th) => th.text())
const nummern = (el: VueWrapper | ReturnType<VueWrapper['find']>) => el.findAll('tbody tr td:first-child').map((z) => z.text())
const markiert = (el: VueWrapper | ReturnType<VueWrapper['find']>) => el.findAll('tbody tr.markiert td:first-child').map((z) => z.text())
const optionen = (wrapper: VueWrapper, feld: string) => wrapper.findAll(`select[data-feld="${feld}"] option`).map((o) => o.text())

describe('Starterlisten', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal', eventJahr: 2026 } })
    // Parcours 1: Klassen 1 und 3, Parcours 2: Klassen 4 und 7 – je drei Starter, je Klasse einer je Verein.
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '3', '4', '7'], 3) })
  })
  afterEach(() => {
    setLocale('de')
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    location.hash = ''
  })

  describe('ein Reiter mit der Auswahl „Art“', () => {
    it('steht vorn; die früheren Reiter „Starter komplett (verzahnt)“ und „Starter nach Klasse“ gibt es nicht mehr', () => {
      const wrapper = ansicht(store)
      const reiter = wrapper.findAll('.list-kinds button').map((b) => b.text())
      expect(reiter[0]).toBe('Starterlisten')
      expect(reiter.join(' | ')).not.toMatch(/verzahnt|nach Klasse|Pokal/)
      expect(reiter).toContain('Gewichtslisten')
      expect(reiter).toContain('Vorsteg-Liste')
      expect(wrapper.findAll('.starter-arten button').map((b) => b.text())).toEqual(['verzahnt', 'je Verein nach Startnummer', 'nach Klasse'])
      expect(wrapper.find('.starter-arten button.active').attributes('data-art')).toBe('verzahnt')
      wrapper.unmount()
    })

    it('verzahnt ohne Markierung ist die Vorgabe: je Parcours eine Liste wie bisher', () => {
      const wrapper = ansicht(store)
      expect(koepfe(wrapper)).toEqual(['Starterliste | Parcours 1 | Hafenpokal 2026', 'Starterliste | Parcours 2 | Hafenpokal 2026'])
      expect(spalten(wrapper)).toEqual(['S-Nr.', 'Name', 'Vorname', 'Verein', 'Geb. Datum', 'Klasse'])
      expect(wrapper.find('select[data-feld="starter-markierung"]').element).toHaveProperty('value', '')
      expect(optionen(wrapper, 'starter-markierung')).toEqual(['ohne Markierung', 'MBC Nord', 'MBC Süd', 'WSV Ost', 'alle'])
      expect(wrapper.find('tr.markiert').exists()).toBe(false)
      expect(wrapper.find('.sheet-table--markierung').exists()).toBe(false)
      expect(wrapper.findAll('.sheet-section')[0].findAll('tbody tr')).toHaveLength(6)
      wrapper.unmount()
    })

    it('nach Klasse: ein Dokument, je Klasse ein Block; das zweite Feld im Kopf sagt es', async () => {
      const wrapper = ansicht(store)
      await art(wrapper, 'klasse')
      expect(koepfe(wrapper)).toEqual(['Starterliste | nach Klasse | Hafenpokal 2026'])
      expect(wrapper.findAll('.sheet-table tbody')).toHaveLength(4)
      expect(nummern(wrapper)).toEqual(['101', '102', '103', '301', '302', '303', '401', '402', '403', '701', '702', '703'])
      // Keine Auswahl der Herkunft: Die gibt es nur für die beiden anderen Arten.
      expect(wrapper.find('select[data-feld="starter-markierung"]').exists()).toBe(false)
      expect(wrapper.find('select[data-feld="starter-herkunft"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('nur ein Parcours: Das Feld „Parcours“ entfällt', async () => {
      store.dispatch({ type: 'REMOVE_PARCOURS', id: 'par_2' })
      const wrapper = ansicht(store)
      expect(koepfe(wrapper)).toEqual(['Starterliste | Hafenpokal 2026'])
      await waehle(wrapper, 'starter-markierung', 'MBC Süd')
      expect(koepfe(wrapper)).toEqual(['Starterliste | MBC Süd | Hafenpokal 2026'])
      wrapper.unmount()
    })
  })

  describe('verzahnt für eine Herkunft', () => {
    it('die vollständige Liste; die Starter der Herkunft sind hervorgehoben, die Herkunft steht in einem eigenen Feld', async () => {
      const wrapper = ansicht(store)
      const ohne = wrapper.findAll('.sheet-section').map((s) => nummern(s))
      const grau = () => wrapper.findAll('.sheet-section').map((s) => s.findAll('tbody tr').flatMap((z, i) => (z.classes('shade') ? [i] : [])))
      const grauOhne = grau()
      await waehle(wrapper, 'starter-markierung', 'MBC Süd')
      expect(koepfe(wrapper)).toEqual(['Starterliste | Parcours 1 | MBC Süd | Hafenpokal 2026', 'Starterliste | Parcours 2 | MBC Süd | Hafenpokal 2026'])
      // Dieselben Zeilen in derselben Folge, dieselben grauen Zeilen.
      expect(wrapper.findAll('.sheet-section').map((s) => nummern(s))).toEqual(ohne)
      expect(grau()).toEqual(grauOhne)
      // Hervorgehoben sind genau die Starter der Herkunft: Klasse (fett, Dreiecke über CSS) und Kennzeichen.
      expect(wrapper.findAll('.sheet-section').map((s) => markiert(s).sort())).toEqual([
        ['102', '302'],
        ['402', '702'],
      ])
      expect(wrapper.findAll('tbody tr[data-markiert]')).toHaveLength(4)
      // Die Tabelle lässt seitlich Platz für die Dreiecke – auf jeder Seite.
      expect(wrapper.findAll('.sheet-table').every((t) => t.classes('sheet-table--markierung'))).toBe(true)
      // Zurück: wieder ohne.
      await waehle(wrapper, 'starter-markierung', 'ohne Markierung')
      expect(wrapper.find('tr.markiert').exists()).toBe(false)
      expect(wrapper.find('.sheet-table--markierung').exists()).toBe(false)
      wrapper.unmount()
    })

    it('ein Parcours, auf dem die Herkunft niemanden am Start hat, entfällt für sie', async () => {
      store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
      // „Nur Eins“ startet nur in Klasse 1 (Parcours 1).
      store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '4'], 3, (k, i) => (k === '1' && i === 0 ? 'Nur Eins' : 'MBC Nord')) })
      const wrapper = ansicht(store)
      await waehle(wrapper, 'starter-markierung', 'Nur Eins')
      expect(koepfe(wrapper)).toEqual(['Starterliste | Parcours 1 | Nur Eins | Hafenpokal 2026'])
      expect(markiert(wrapper)).toEqual(['101'])
      wrapper.unmount()
    })

    it('„alle“: der Satz je Herkunft hintereinander; jedes Dokument (Herkunft × Parcours) zählt seine Seiten selbst', async () => {
      store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
      // Parcours 1 hat 50 Starter (zwei Seiten), Parcours 2 hat 6 (eine).
      expect(50).toBeGreaterThan(SEITEN_VORGABE.starter)
      store.dispatch({ type: 'ADD_STARTERS', starters: [...starter(['1'], 50, (_k, i) => (i % 2 ? 'MBC Süd' : 'MBC Nord')), ...starter(['4'], 6, (_k, i) => (i < 2 ? 'WSV Ost' : 'MBC Nord'))] })
      const wrapper = ansicht(store)
      await waehle(wrapper, 'starter-markierung', 'alle')
      // MBC Nord: beide Parcours; MBC Süd: nur Parcours 1; WSV Ost: nur Parcours 2.
      expect(koepfe(wrapper)).toEqual([
        'Starterliste | Parcours 1 | MBC Nord | Hafenpokal 2026',
        'Starterliste | Parcours 2 | MBC Nord | Hafenpokal 2026',
        'Starterliste | Parcours 1 | MBC Süd | Hafenpokal 2026',
        'Starterliste | Parcours 2 | WSV Ost | Hafenpokal 2026',
      ])
      const seitenzahlen = wrapper.findAll('.sheet-section').map((s) => s.findAll('.listen-seite').map((x) => (x.find('.listen-seitenzahl').exists() ? x.find('.listen-seitenzahl').text() : '-')))
      expect(seitenzahlen).toEqual([['Seite 1 / 2', 'Seite 2 / 2'], ['-'], ['Seite 1 / 2', 'Seite 2 / 2'], ['-']])
      // Jedes Dokument ist die vollständige Liste seines Parcours; hervorgehoben sind die eigenen.
      const dokumente = wrapper.findAll('.sheet-section')
      expect(dokumente.map((d) => nummern(d).length)).toEqual([50, 6, 50, 6])
      expect(dokumente.map((d) => markiert(d).length)).toEqual([25, 4, 25, 2])
      expect(wrapper.find('.starter-wahl [role="status"]').text()).toBe('4 Listen')
      wrapper.unmount()
    })

    it('gleichbedeutende Schreibweisen sind eine Herkunft – mit Flagge im Kopf, wenn die Listen Flaggen zeigen', async () => {
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'bundesland' })
      store.dispatch({ type: 'SET_LIST_OPTIONS', patch: { listOrigin: 'flagge-lang' } })
      store.dispatch({ type: 'UPDATE_STARTER', id: 'id-1-1', patch: { bundesland: 'BY' } })
      const wrapper = ansicht(store)
      expect(optionen(wrapper, 'starter-markierung')).toEqual(['ohne Markierung', 'Bayern', 'Hessen', 'alle'])
      expect(wrapper.find('label[for$="-markierung"]').text()).toBe('für Bundesland')
      await waehle(wrapper, 'starter-markierung', 'Bayern')
      // „BY“ und „Bayern“: beide hervorgehoben (je Klasse der 1. und der 3. Starter).
      expect(markiert(wrapper.findAll('.sheet-section')[0]).sort()).toEqual(['101', '103', '301', '303'])
      const feld = wrapper.find('.sheet-title-box [data-feld="herkunft"]')
      expect(feld.text()).toBe('Bayern')
      expect(feld.find('img.flagge').exists()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('je Herkunft nach Startnummer', () => {
    it('je Herkunft ein Dokument: nur ihre Starter, Klasse E zuerst, ohne Parcours und ohne Spalte der Herkunft', async () => {
      store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
      store.dispatch({ type: 'ADD_STARTERS', starters: starter(['4', '1', 'E'], 3) })
      const wrapper = ansicht(store)
      await art(wrapper, 'herkunft')
      expect(koepfe(wrapper)).toEqual(['Starterliste | MBC Nord | Hafenpokal 2026', 'Starterliste | MBC Süd | Hafenpokal 2026', 'Starterliste | WSV Ost | Hafenpokal 2026'])
      expect(spalten(wrapper)).toEqual(['S-Nr.', 'Name', 'Vorname', 'Klasse', 'Geb. Datum'])
      expect(wrapper.findAll('.sheet-section').map((s) => nummern(s))).toEqual([
        ['E01', '101', '401'],
        ['E02', '102', '402'],
        ['E03', '103', '403'],
      ])
      expect(wrapper.find('.sheet-section tbody tr').findAll('td').map((z) => z.text())).toEqual(['E01', 'NachE1', 'VorE1', 'E', '01.05.2014'])
      expect(wrapper.find('.sheet').attributes('data-art')).toBe('herkunft')
      expect(wrapper.find('tr.markiert').exists()).toBe(false)
      // Das Geburtsdatum nur, wo es für die Veranstaltung eingeschaltet ist.
      store.dispatch({ type: 'SET_LIST_OPTIONS', patch: { showBirthdate: false } })
      await nextTick()
      expect(spalten(wrapper)).toEqual(['S-Nr.', 'Name', 'Vorname', 'Klasse'])
      wrapper.unmount()
    })

    it('eine einzelne Herkunft wählen; jede Liste zählt ihre Seiten selbst', async () => {
      store.dispatch({ type: 'CLEAR_ALL_STARTERS' })
      expect(45).toBeGreaterThan(SEITEN_VORGABE.starterHerkunft)
      store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1'], 50, (_k, i) => (i < 45 ? 'MBC Nord' : 'MBC Süd')) })
      const wrapper = ansicht(store)
      await art(wrapper, 'herkunft')
      expect(optionen(wrapper, 'starter-herkunft')).toEqual(['alle', 'MBC Nord', 'MBC Süd'])
      const zahlen = () => wrapper.findAll('.listen-seite').map((x) => (x.find('.listen-seitenzahl').exists() ? x.find('.listen-seitenzahl').text() : '-'))
      expect(zahlen()).toEqual(['Seite 1 / 2', 'Seite 2 / 2', '-'])
      await waehle(wrapper, 'starter-herkunft', 'MBC Süd')
      expect(koepfe(wrapper)).toEqual(['Starterliste | MBC Süd | Hafenpokal 2026'])
      expect(nummern(wrapper)).toEqual(['146', '147', '148', '149', '150'])
      expect(zahlen()).toEqual(['-'])
      wrapper.unmount()
    })

    it('Starter ohne Herkunft stehen auf keiner dieser Listen – die Ansicht nennt ihre Zahl', async () => {
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
      store.dispatch({ type: 'UPDATE_STARTER', id: 'id-1-1', patch: { land: '' } })
      const wrapper = ansicht(store)
      expect(wrapper.find('[data-hinweis="starter-ohne-herkunft"]').exists()).toBe(false)
      await art(wrapper, 'herkunft')
      expect(wrapper.find('[data-hinweis="starter-ohne-herkunft"]').text()).toContain('1 Starter hat keine Herkunft (Land)')
      expect(nummern(wrapper)).toHaveLength(11)
      wrapper.unmount()
    })
  })

  describe('ohne Herkunft für die Veranstaltung', () => {
    it('verzahnt gibt es nur ohne Markierung, die Liste je Herkunft gar nicht – mit Hinweis', async () => {
      const wrapper = ansicht(store)
      await art(wrapper, 'herkunft')
      await waehle(wrapper, 'starter-herkunft', 'MBC Süd')
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'none' })
      await nextTick()
      // Die Wahl bleibt stehen, gezeigt wird die verzahnte Liste ohne Markierung.
      expect(wrapper.find('.starter-arten button.active').attributes('data-art')).toBe('verzahnt')
      expect(wrapper.find('.starter-arten button[data-art="herkunft"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('select[data-feld="starter-markierung"]').exists()).toBe(false)
      expect(wrapper.find('select[data-feld="starter-herkunft"]').exists()).toBe(false)
      expect(wrapper.find('[data-hinweis="starter-ohne-herkunftsart"]').text()).toContain('keine Herkunft gewählt')
      expect(wrapper.find('[data-hinweis="starter-ohne-herkunftsart"] a').attributes('href')).toBe('#/veranstaltung')
      expect(koepfe(wrapper)).toEqual(['Starterliste | Parcours 1 | Hafenpokal 2026', 'Starterliste | Parcours 2 | Hafenpokal 2026'])
      expect(spalten(wrapper)).toEqual(['S-Nr.', 'Name', 'Vorname', 'Geb. Datum', 'Klasse'])
      // Mit der Herkunft kommt die Wahl zurück.
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'verein' })
      await nextTick()
      expect(koepfe(wrapper)).toEqual(['Starterliste | MBC Süd | Hafenpokal 2026'])
      wrapper.unmount()
    })
  })

  describe('die Auswahl bleibt', () => {
    it('über den Wechsel der Ansicht und über das Neuladen (sessionStorage)', async () => {
      const wrapper = ansicht(store)
      await waehle(wrapper, 'starter-markierung', 'WSV Ost')
      wrapper.unmount()
      // Wechsel der Ansicht: Die Ansicht wird neu aufgebaut.
      const wieder = ansicht(store)
      expect(markiert(wieder).length).toBe(4)
      await art(wieder, 'herkunft')
      wieder.unmount()
      // Neuladen: Das Gedächtnis des Fensters ist leer, der sessionStorage nicht.
      expect(JSON.parse(sessionStorage.getItem('alcatraz.merke.listen.starter')!)).toMatchObject({ art: 'herkunft' })
      const gemerkt = sessionStorage.getItem('alcatraz.merke.listen.starter')!
      vergissAlles()
      sessionStorage.setItem('alcatraz.merke.listen.starter', gemerkt)
      const neu = ansicht(store)
      expect(neu.find('.starter-arten button.active').attributes('data-art')).toBe('herkunft')
      await art(neu, 'verzahnt')
      // (happy-dom kennt `option:checked` nicht – der gewählte Eintrag über `selectedIndex`.)
      const feld = neu.find('select[data-feld="starter-markierung"]').element as HTMLSelectElement
      expect(feld.options[feld.selectedIndex].textContent?.trim()).toBe('WSV Ost')
      neu.unmount()
    })

    it('eine gemerkte Herkunft, die es nicht mehr gibt, zählt wie „ohne Markierung“ bzw. „alle“', async () => {
      const wrapper = ansicht(store)
      await waehle(wrapper, 'starter-markierung', 'WSV Ost')
      for (const p of store.state.value.starters.filter((x) => x.verein === 'WSV Ost')) store.dispatch({ type: 'UPDATE_STARTER', id: p.id, patch: { verein: 'MBC Nord' } })
      await nextTick()
      expect(wrapper.find('tr.markiert').exists()).toBe(false)
      expect(wrapper.find('select[data-feld="starter-markierung"]').element).toHaveProperty('value', '')
      wrapper.unmount()
    })

    it('eine gemerkte Listenart der früheren Reiter gilt als die Vorgabe', () => {
      sessionStorage.setItem('alcatraz.merke.listen.starter', JSON.stringify({ art: 'byClass' }))
      const wrapper = ansicht(store)
      expect(wrapper.find('.list-kinds button.active').attributes('data-kind')).toBe('starter')
      expect(wrapper.find('.starter-arten button.active').attributes('data-art')).toBe('verzahnt')
      wrapper.unmount()
    })
  })

  describe('alte Adressen', () => {
    it.each([
      ['#/listen/verzahnt', 'verzahnt'],
      ['#/lists/interleaved', 'verzahnt'],
      ['#/listen/nach-klasse', 'klasse'],
      ['#/lists/by-class', 'klasse'],
      ['#/listen/byClass', 'klasse'],
    ])('%s führt zum Reiter „Starterlisten“ mit der Art „%s“', async (alt, erwartet) => {
      // Vorher war etwas anderes gewählt – der alte Verweis gilt trotzdem.
      const vorher = ansicht(store)
      await art(vorher, erwartet === 'klasse' ? 'herkunft' : 'klasse')
      await vorher.find('.list-kinds button[data-kind="gewicht"]').trigger('click')
      vorher.unmount()
      location.hash = alt
      const wrapper = ansicht(store)
      expect(wrapper.find('.list-kinds button.active').attributes('data-kind')).toBe('starter')
      expect(wrapper.find('.starter-arten button.active').attributes('data-art')).toBe(erwartet)
      // Die Adresse steht danach im heutigen Wort da.
      expect(location.hash).toBe('#/listen/starterlisten')
      wrapper.unmount()
    })

    it('auch im laufenden Betrieb (Verweis angeklickt); die heutige Adresse lässt die Art, wie sie ist', async () => {
      const wrapper = ansicht(store)
      await art(wrapper, 'herkunft')
      location.hash = '#/listen/nach-klasse'
      window.dispatchEvent(new Event('hashchange'))
      await nextTick()
      expect(wrapper.find('.starter-arten button.active').attributes('data-art')).toBe('klasse')
      location.hash = '#/listen/gewicht'
      window.dispatchEvent(new Event('hashchange'))
      await nextTick()
      location.hash = '#/listen/starterlisten'
      window.dispatchEvent(new Event('hashchange'))
      await nextTick()
      expect(wrapper.find('.starter-arten button.active').attributes('data-art')).toBe('klasse')
      wrapper.unmount()
    })
  })

  describe('Sprache und Fenstertitel', () => {
    it('UIM: Die Blätter sind englisch, die Bedienung folgt der Oberfläche', async () => {
      store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
      const wrapper = ansicht(store)
      expect(wrapper.find('.list-kinds button[data-kind="starter"]').text()).toBe('Starterlisten')
      await art(wrapper, 'herkunft')
      expect(wrapper.find('.starter-arten button.active').text()).toBe('je Land nach Startnummer')
      // Nationen international: auf der englischen Liste der englische Name.
      expect(koepfe(wrapper)).toEqual(['List of drivers | Germany | Hafenpokal 2026'])
      expect(spalten(wrapper)).toEqual(['No.', 'Surname', 'First name', 'Class', 'Date of birth'])
      setLocale('en')
      await nextTick()
      expect(wrapper.find('.list-kinds button[data-kind="starter"]').text()).toBe('Lists of drivers')
      expect(wrapper.find('.starter-arten button.active').text()).toBe('per Country by number')
      wrapper.unmount()
    })

    it('der Fenstertitel beim Drucken nennt Art und Herkunft – er wird zum Dateinamen', async () => {
      const print = vi.fn()
      vi.stubGlobal('print', print)
      const wrapper = ansicht(store)
      const drucke = async () => {
        await wrapper.find('button.primary').trigger('click')
        const titel = document.title
        window.dispatchEvent(new Event('afterprint'))
        return titel
      }
      expect(await drucke()).toMatch(/^Starterlisten - verzahnt - Hafenpokal 2026 - /)
      await waehle(wrapper, 'starter-markierung', 'MBC Süd')
      expect(await drucke()).toMatch(/^Starterlisten - verzahnt, MBC Süd - Hafenpokal 2026 - /)
      await waehle(wrapper, 'starter-markierung', 'alle')
      expect(await drucke()).toMatch(/^Starterlisten - verzahnt, Verein: alle - Hafenpokal 2026 - /)
      await art(wrapper, 'herkunft')
      expect(await drucke()).toMatch(/^Starterlisten - je Verein nach Startnummer - Hafenpokal 2026 - /)
      await art(wrapper, 'klasse')
      expect(await drucke()).toMatch(/^Starterlisten - nach Klasse - Hafenpokal 2026 - /)
      expect(print).toHaveBeenCalledTimes(5)
      wrapper.unmount()
    })
  })

  describe('Kopf mit eigenen Feldern', () => {
    it('Gewichtsliste: Liste | Herkunft | Veranstaltung – nie mehr „GewichtslisteDeutschland“ in einem Feld', async () => {
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
      store.dispatch({ type: 'SET_LIST_OPTIONS', patch: { listOrigin: 'flagge-kurz' } })
      const wrapper = ansicht(store)
      await wrapper.find('.list-kinds button[data-kind="gewicht"]').trigger('click')
      await nextTick()
      const box = wrapper.find('.sheet-title-box')
      expect(box.findAll('[data-feld]').map((f) => [f.attributes('data-feld'), f.text()])).toEqual([
        ['liste', 'Gewichtsliste'],
        ['herkunft', 'Deutschland'],
        ['veranstaltung', 'Hafenpokal 2026'],
      ])
      expect(box.text()).not.toContain('GewichtslisteDeutschland')
      // Im Kopf steht die Herkunft ausgeschrieben, mit Flagge – auch wenn die Spalten das Kürzel zeigen.
      expect(box.find('[data-feld="herkunft"] img.flagge').exists()).toBe(true)
      wrapper.unmount()
    })

    it('ohne Herkunft entfällt deren Feld; die Vorsteg-Liste nennt den Parcours in einem eigenen', async () => {
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'none' })
      const wrapper = ansicht(store)
      await wrapper.find('.list-kinds button[data-kind="gewicht"]').trigger('click')
      await nextTick()
      expect(koepfe(wrapper)).toEqual(['Gewichtsliste | Hafenpokal 2026'])
      await wrapper.find('.list-kinds button[data-kind="vorsteg"]').trigger('click')
      await nextTick()
      expect(koepfe(wrapper)).toEqual(['Vorsteg | Parcours 1 | Hafenpokal 2026', 'Vorsteg | Parcours 2 | Hafenpokal 2026'])
      wrapper.unmount()
    })
  })

  describe('Logos im Kopf (16.11.2026)', () => {
    /** Je Druckseite: die Logos, die Felder des Kopfs und die Spaltenzahl der Kopfzelle. */
    const seiten = (wrapper: VueWrapper) =>
      wrapper.findAll('.listen-seite').map((x) => ({
        logos: logoFolge(x.element),
        kopf: x.findAll('.sheet-title-box [data-feld]').map((f) => f.text()).join(' | '),
        colspan: x.find('.sheet-title th').attributes('colspan'),
      }))
    const ohneLogos = (liste: ReturnType<typeof seiten>) => liste.map(({ logos: _l, ...rest }) => rest)

    it('Starter-, Vorsteg- und Gewichtslisten: auf jeder Seite links und rechts, sonst alles wie ohne', async () => {
      // Mehrere Seiten: 50 Starter auf Parcours 1.
      store.dispatch({ type: 'ADD_STARTERS', starters: starter(['2'], 50).map((p) => ({ ...p, id: `${p.id}-x` })) })
      for (const kind of ['starter', 'vorsteg', 'gewicht']) {
        const vorher = ansicht(store)
        await vorher.find(`.list-kinds button[data-kind="${kind}"]`).trigger('click')
        await nextTick()
        const ohne = seiten(vorher)
        expect(vorher.find('.kopf-logos').exists()).toBe(false)
        vorher.unmount()
        expect(ohne.length, kind).toBeGreaterThan(2)
        expect(ohne.every((x) => x.logos.length === 0), kind).toBe(true)

        setzeTestLogos(store)
        const nachher = ansicht(store)
        await nachher.find(`.list-kinds button[data-kind="${kind}"]`).trigger('click')
        await nextTick()
        const mit = seiten(nachher)
        expect(mit.map((x) => x.logos), kind).toEqual(mit.map(() => ['links', 'rechts']))
        expect(ohneLogos(mit), kind).toEqual(ohneLogos(ohne))
        expect(nachher.findAll('.sheet-title th > .kopf-logos > .kopf-logos-mitte > .sheet-title-box')).toHaveLength(mit.length)
        nachher.unmount()
        store.dispatch({ type: 'SET_LOGO', seite: 'links', logo: null })
        store.dispatch({ type: 'SET_LOGO', seite: 'rechts', logo: null })
      }
    })
  })
})
