import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { laufSchluessel } from '../lib/eingaben'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'
import { logoFolge, setzeTestLogos } from '../testHilfen'

// Die Druckdatei: Starterliste, Mannschaftswertungen, Codes und Wertungslisten in einem Druck.
// Alle Starter und Vereine sind erfunden.

const VEREINE = ['MBC Nord', 'MBC Süd', 'WSV Ost']
/** Je Klasse drei Starter, einer je Verein. */
function starter(klassen: ClassId[]): Starter[] {
  return klassen.flatMap((klasse) =>
    VEREINE.map((verein, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein,
      bundesland: 'Musterland',
      land: i === 2 ? 'Österreich' : 'Deutschland',
      geburtsdatum: '2014-05-01',
      groesse: '',
      klasse,
    })),
  )
}
/** Läufe der Klasse fahren: Starter 1 vor 2 vor 3. */
function fahre(store: Store, klasse: ClassId, laeufe = store.state.value.laufCount) {
  for (let n = 1; n <= laeufe; n++) {
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: [1, 2, 3].map((i) => ({ lauf: laufSchluessel('manoevrieren', n), starter: `id-${klasse}-${i}`, feld: 'zeit1', wert: String(60 + i) })),
      zeit: Date.UTC(2026, 8, 26, 12, 0, n),
    })
  }
}
const global = (store: Store) => ({ global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
/** Die Vorschau entsteht in Schritten – warten, bis alle Dokumente da sind. */
async function fertig(wrapper: VueWrapper) {
  // Erst die Änderung ankommen lassen: Eine andere Auswahl beginnt den Aufbau von vorn.
  await nextTick()
  // Großzügig warten: Läuft die ganze Suite, teilen sich viele Dateien den Rechner – die Vorgabe (1 s) reichte dann nicht immer.
  await vi.waitFor(() => expect(wrapper.find('.druckdatei').attributes('data-fertig')).toBeDefined(), { timeout: 10000 })
  // Der Stand (Zahl der Listen) geht an die Ansicht, die danach den Knopf „Drucken“ freigibt.
  await nextTick()
  await nextTick()
}
async function druckdatei(store: Store) {
  const wrapper = mount(ListsView, global(store))
  await wrapper.find('.list-kinds button[data-kind="druckdatei"]').trigger('click')
  await fertig(wrapper)
  return wrapper
}
/** Die Dokumente in der Reihenfolge des Drucks: Teil und Kopf des Blatts. */
const dokumente = (wrapper: VueWrapper) =>
  wrapper.findAll('.druckdatei-teil').flatMap((teil) => {
    const art = teil.attributes('data-teil')
    const koepfe = art === 'starter' || art === 'codes' ? teil.findAll('.sheet-section') : teil.findAll('.ergebnis-blatt[data-seite="1"]')
    return koepfe.map((k) => `${art}: ${(k.find('.sheet-title-box, .erg-kopf, thead tr').text() ?? '').replace(/\s+/g, ' ').trim()}`)
  })
const teile = (wrapper: VueWrapper) => wrapper.findAll('.druckdatei-teil').map((t) => t.attributes('data-teil'))
const starterSpalten = (wrapper: VueWrapper) => wrapper.findAll('.druckdatei-teil[data-teil="starter"] .sheet-cols').at(0)!.findAll('th').map((th) => th.text())
const haken = async (wrapper: VueWrapper, selektor: string, an: boolean) => {
  await wrapper.find(selektor).setValue(an)
  await fertig(wrapper)
}

describe('Druckdatei', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '2']) })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('ist der Reiter direkt hinter der Mannschaftswertung', async () => {
    const wrapper = await druckdatei(store)
    const arten = wrapper.findAll('.list-kinds button').map((b) => b.attributes('data-kind'))
    expect(arten.slice(-2)).toEqual(['pokal', 'druckdatei'])
    expect(wrapper.find('.list-kinds button[data-kind="druckdatei"]').text()).toBe('Druckdatei')
    wrapper.unmount()
  })

  it('die Teile stehen in der Reihenfolge der Vorlage: Starterliste, Mannschaftswertung, Codes, je Klasse Läufe und Gesamt', async () => {
    fahre(store, '1')
    fahre(store, '2')
    const wrapper = await druckdatei(store)
    expect(teile(wrapper)).toEqual(['starter', 'pokal', 'codes', 'ergebnis'])
    const folge = dokumente(wrapper)
    expect(folge[0]).toMatch(/^starter: Starterliste/)
    // Erst die Wertung nach UIM-Punkten, dann die nach Plätzen.
    expect(wrapper.findAll('.druckdatei-teil[data-teil="pokal"] .ergebnis-blatt[data-seite="1"]').map((b) => b.attributes('data-art'))).toEqual(['pokal-uim', 'pokal-plaetze'])
    const ergebnis = folge.filter((d) => d.startsWith('ergebnis:'))
    const laeufe = store.state.value.laufCount
    expect(ergebnis).toHaveLength(2 * (laeufe + 1))
    expect(ergebnis[0]).toContain('Klasse 1')
    expect(ergebnis[0]).toContain('1. Lauf')
    expect(ergebnis[laeufe]).toContain('Klasse 1')
    expect(ergebnis[laeufe]).toContain('Gesamt')
    expect(ergebnis[laeufe + 1]).toContain('Klasse 2')
    // Nach Platz, nie nach Startnummer.
    expect(new Set(wrapper.findAll('.druckdatei-teil[data-teil="ergebnis"] .ergebnis-blatt').map((b) => b.attributes('data-ordnung')))).toEqual(new Set(['platz']))
    expect(wrapper.find('[data-hinweis="druckdatei-unfertig"]').exists()).toBe(false)
    expect(wrapper.find('button.primary').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('mit Logos (16.11.2026): jeder Teil, jede Seite trägt sie – dieselben Dokumente in derselben Folge', async () => {
    fahre(store, '1')
    fahre(store, '2')
    const vorher = await druckdatei(store)
    const ohne = dokumente(vorher)
    const seitenOhne = vorher.findAll('.druckdatei-teil .listen-seite').length
    expect(vorher.find('.druckdatei .kopf-logos').exists()).toBe(false)
    vorher.unmount()
    setzeTestLogos(store)
    const wrapper = await druckdatei(store)
    expect(teile(wrapper)).toEqual(['starter', 'pokal', 'codes', 'ergebnis'])
    for (const teil of wrapper.findAll('.druckdatei-teil')) expect(logoFolge(teil.element).length, teil.attributes('data-teil')).toBeGreaterThan(0)
    const seiten = wrapper.findAll('.druckdatei-teil .listen-seite')
    expect(seiten).toHaveLength(seitenOhne)
    for (const s of seiten) expect(logoFolge(s.element)).toEqual(['links', 'rechts'])
    expect(logoFolge(wrapper.find('.druckdatei-teil[data-teil="codes"] .lg-blatt').element)).toEqual(['links', 'rechts'])
    expect(dokumente(wrapper)).toEqual(ohne)
    wrapper.unmount()
  })

  it('nur die normale verzahnte Starterliste – keine Listen je Herkunft, keine Markierung; die Liste nach Pkt. 3.7 in keiner Fassung', async () => {
    fahre(store, '1')
    fahre(store, '2')
    const wrapper = mount(ListsView, global(store))
    // Unter „Starterlisten“ ist die Liste je Herkunft gewählt, verzahnt mit Markierung – die Druckdatei bleibt bei der normalen.
    await wrapper.find('.starter-arten button[data-art="herkunft"]').trigger('click')
    await wrapper.find('.list-kinds button[data-kind="druckdatei"]').trigger('click')
    await fertig(wrapper)
    const starterListen = () => wrapper.findAll('.druckdatei-teil[data-teil="starter"] .sheet-section').map((s) => s.attributes('data-liste'))
    // Je Parcours mit Startern eine Liste – deren Kennung ist die des Parcours (je Herkunft hieße sie `herkunft:…`).
    expect(starterListen()).toEqual(['par_1'])
    for (const fassung of ['extern', 'intern']) {
      await wrapper.find(`.druckdatei-wahl button[data-fassung="${fassung}"]`).trigger('click')
      await fertig(wrapper)
      expect(starterListen()).toEqual(['par_1'])
      expect(wrapper.find('.druckdatei [data-markiert]').exists()).toBe(false)
      expect(wrapper.find('.druckdatei .team-liste').exists()).toBe(false)
    }
    wrapper.unmount()
  })

  it('unter Regel 960 ebenso: die verzahnte Starterliste, die Liste je Team (Pkt. 3.7) auch intern nicht', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
    fahre(store, '1')
    const wrapper = await druckdatei(store)
    for (const fassung of ['extern', 'intern']) {
      await wrapper.find(`.druckdatei-wahl button[data-fassung="${fassung}"]`).trigger('click')
      await fertig(wrapper)
      expect(wrapper.findAll('.druckdatei-teil[data-teil="starter"] .sheet-section').map((s) => s.attributes('data-liste'))).toEqual(['par_1'])
      expect(wrapper.find('.druckdatei .team-liste').exists()).toBe(false)
      expect(wrapper.find('.druckdatei').text()).not.toContain('Pkt. 3.7')
    }
    wrapper.unmount()
  })

  it('extern: Namen wie für den Aushang eingestellt, nie ein Geburtsdatum – auch auf der Starterliste', async () => {
    fahre(store, '1')
    store.dispatch({ type: 'SET_LIST_OPTIONS', patch: { showBirthdate: true } })
    store.dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { namen: 'kurz' } })
    const wrapper = await druckdatei(store)
    expect(wrapper.find('.druckdatei').attributes('data-fassung')).toBe('extern')
    expect(starterSpalten(wrapper)).not.toContain('Geb.-Datum')
    expect(wrapper.find('.druckdatei').text()).not.toMatch(/Nach\d|2014|01\.05\./)
    expect(wrapper.find('.druckdatei-teil[data-teil="starter"]').text()).toContain('N.')
    expect(wrapper.find('.druckdatei-teil[data-teil="starter"]').text()).toContain('Vor11')

    // Ohne Namen: nur Startnummer, Herkunft und Klasse.
    store.dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { namen: 'ohne' } })
    await nextTick()
    expect(starterSpalten(wrapper)).toHaveLength(3)
    expect(wrapper.find('.druckdatei').text()).not.toMatch(/Vor\d|Nach\d/)
    wrapper.unmount()
  })

  it('intern: volle Namen; das Geburtsdatum steht nur auf der Starterliste und nur, wenn die Veranstaltung es zeigt', async () => {
    fahre(store, '1')
    store.dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { namen: 'kurz' } })
    store.dispatch({ type: 'SET_LIST_OPTIONS', patch: { showBirthdate: false } })
    const wrapper = await druckdatei(store)
    await wrapper.find('.druckdatei-wahl button[data-fassung="intern"]').trigger('click')
    await fertig(wrapper)
    expect(wrapper.find('.druckdatei-teil[data-teil="starter"]').text()).toContain('Nach11')
    expect(wrapper.find('.druckdatei-teil[data-teil="ergebnis"]').text()).toContain('Nach11')
    expect(wrapper.find('.druckdatei').text()).not.toMatch(/01\.05\.2014/)
    store.dispatch({ type: 'SET_LIST_OPTIONS', patch: { showBirthdate: true } })
    await nextTick()
    expect(wrapper.find('.druckdatei-teil[data-teil="starter"]').text()).toMatch(/01\.05\.2014/)
    expect(wrapper.find('.druckdatei-teil[data-teil="ergebnis"]').text()).not.toMatch(/01\.05\.2014/)
    wrapper.unmount()
  })

  it('Teile, Umfang und Klassen lassen sich abwählen', async () => {
    fahre(store, '1')
    fahre(store, '2')
    const wrapper = await druckdatei(store)
    await haken(wrapper, 'input[data-teil="starter"]', false)
    await haken(wrapper, 'input[data-teil="codes"]', false)
    expect(teile(wrapper)).toEqual(['pokal', 'ergebnis'])
    await haken(wrapper, 'input[data-teil="pokal"]', false)
    await wrapper.find('select[data-feld="druckdatei-umfang"]').setValue('gesamt')
    await fertig(wrapper)
    expect(dokumente(wrapper)).toHaveLength(2)
    await haken(wrapper, 'input[data-klasse="1"]', false)
    const rest = dokumente(wrapper)
    expect(rest).toHaveLength(1)
    expect(rest[0]).toContain('Klasse 2')
    await haken(wrapper, 'input[data-teil="ergebnis"]', false)
    expect(wrapper.find('[data-hinweis="druckdatei-leer"]').exists()).toBe(true)
    expect(wrapper.find('button.primary').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('nur die eingeschalteten Mannschaftswertungen; ohne Herkunft keine und kein Kästchen dafür', async () => {
    fahre(store, '1')
    fahre(store, '2')
    store.dispatch({ type: 'SET_POKAL_VARIANTE', variante: 'uim', an: false })
    const wrapper = await druckdatei(store)
    expect(wrapper.findAll('.druckdatei-teil[data-teil="pokal"] .ergebnis-blatt[data-seite="1"]').map((b) => b.attributes('data-art'))).toEqual(['pokal-plaetze'])
    store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'none' })
    await fertig(wrapper)
    expect(teile(wrapper)).toEqual(['starter', 'codes', 'ergebnis'])
    expect(wrapper.find('input[data-teil="pokal"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('unfertiger Stand: Der Hinweis nennt die Klassen und die fehlenden Läufe; drucken bleibt möglich', async () => {
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 3 } })
    fahre(store, '1', 3)
    fahre(store, '2', 1)
    const wrapper = await druckdatei(store)
    const hinweis = wrapper.find('[data-hinweis="druckdatei-unfertig"]').text()
    expect(hinweis).toContain('Klasse 2 (Läufe 2, 3 fehlen)')
    expect(hinweis).not.toContain('Klasse 1')
    expect(wrapper.find('button.primary').attributes('disabled')).toBeUndefined()
    fahre(store, '2', 2)
    await nextTick()
    expect(wrapper.find('[data-hinweis="druckdatei-unfertig"]').text()).toContain('Klasse 2 (Lauf 3 fehlt)')
    wrapper.unmount()
  })

  it('ohne gültige Startnummern fehlt nur die Starterliste – die Ansicht sagt es', async () => {
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-1-1', patch: { startNr: '' } })
    fahre(store, '1')
    const wrapper = await druckdatei(store)
    expect(wrapper.find('[data-hinweis="druckdatei-ohne-starterliste"] a').attributes('href')).toBe('#/starter')
    expect(teile(wrapper)).toEqual(['pokal', 'codes', 'ergebnis'])
    wrapper.unmount()
  })

  it('der Fenstertitel beim Drucken: Veranstaltung, Druckdatei, Fassung, Zeitpunkt – er wird zum Dateinamen', async () => {
    fahre(store, '1')
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const wrapper = await druckdatei(store)
    await wrapper.find('button.primary').trigger('click')
    expect(document.title).toMatch(/^Hafenpokal 2026 - Druckdatei - Extern - \d{4}/)
    window.dispatchEvent(new Event('afterprint'))
    expect(print).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('UIM: Die Blätter sind englisch; der Reiter heißt bei englischer Oberfläche „Results booklet“', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    fahre(store, '1')
    setLocale('en')
    const wrapper = await druckdatei(store)
    expect(wrapper.find('.list-kinds button[data-kind="druckdatei"]').text()).toBe('Results booklet')
    // Unter Regel 960 steht die Starterliste vor den Wertungslisten des Manövrierens, nicht vorn.
    expect(teile(wrapper)).toEqual(['codes', 'starter', 'ergebnis'])
    expect(dokumente(wrapper).find((d) => d.startsWith('starter:'))).toMatch(/^starter: List of drivers/)
    wrapper.unmount()
  })
})
