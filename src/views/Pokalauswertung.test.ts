import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import SettingsView from './SettingsView.vue'
import StartersView from './StartersView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { laufSchluessel } from '../lib/eingaben'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'
import { knotenHaken, ohneLogos, seitenKoepfe, setzeTestLogos } from '../testHilfen'

// Mannschaftswertung (im Code „pokal“) in der Oberfläche: Listenart, Einstellungen, Auswahl im Starter-Reiter.
// Alle Starter und Vereine sind erfunden.

const VEREINE = ['MBC Nord', 'MBC Süd', 'WSV Ost']
/** Je Klasse drei Starter, einer je Verein; `land` für die UIM-Wertung. */
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
/** Alle Läufe der Klasse fahren: Starter 1 vor 2 vor 3. */
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
async function pokal(store: Store) {
  const wrapper = mount(ListsView, global(store))
  await wrapper.find('.list-kinds button[data-kind="pokal"]').trigger('click')
  await nextTick()
  return wrapper
}
const zeilen = (wrapper: VueWrapper, art: string) =>
  wrapper
    .find(`.ergebnis-blatt[data-art="${art}"]`)
    .findAll('tbody tr')
    // Die Spaltenköpfe über jedem Herkunftsblock der UIM-Liste sind keine Zeilen der Wertung.
    .filter((r) => !r.classes('pokal-gruppe-kopf'))
    .map((r) =>
      r
        .findAll('td')
        .map((c) => c.text())
        .filter(Boolean)
        .join(' '),
    )

describe('Mannschaftswertung', () => {
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
    setLocale('de')
    document.body.innerHTML = ''
  })

  describe('Listen', () => {
    it('ist eine eigene Listenart; ohne Ergebnisse sagt sie das und verweist zur Erfassung', async () => {
      const wrapper = await pokal(store)
      expect(wrapper.find('.list-kinds button[data-kind="pokal"]').text()).toBe('Mannschaftswertung')
      expect(wrapper.find('[data-hinweis="pokal-leer"] a').attributes('href')).toBe('#/erfassung')
      expect(wrapper.findAll('.ergebnis-blatt')).toHaveLength(0)
      expect(wrapper.find('button.primary').attributes('disabled')).toBeDefined()
      wrapper.unmount()
    })

    it('Stichentscheid nach Regelbuch (DM C6): Sternchen am Platz und die Regel im Fuß – neben dem Hinweis zum Zwischenstand', async () => {
      store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 1 } })
      const zeit = (klasse: ClassId, i: number, s: number) => ({ lauf: laufSchluessel('manoevrieren', 1), starter: `id-${klasse}-${i}`, feld: 'zeit1', wert: String(s) })
      // Klasse 1: Nord, Süd, Ost; Klasse 2: Ost, Süd, Nord – jede Mannschaft hat 10 Punkte (6 + 4, 5 + 5, 4 + 6).
      store.dispatch({ type: 'SET_EINGABEN', zellen: [zeit('1', 1, 61), zeit('1', 2, 62), zeit('1', 3, 63), zeit('2', 3, 61), zeit('2', 2, 62), zeit('2', 1, 63)], zeit: 1 })
      const wrapper = await pokal(store)
      // Nord und Ost haben je einen 1. und einen 3. Platz, Süd keinen 1.: Süd steht dahinter, die beiden teilen sich Platz 1.
      expect(zeilen(wrapper, 'pokal-plaetze').map((z) => z.split(' ').slice(0, 3).join(' '))).toEqual(['1* MBC Nord', '1* WSV Ost', '3* MBC Süd'])
      const fuss = wrapper.find('.ergebnis-blatt[data-art="pokal-plaetze"] .erg-fuss')
      expect(fuss.find('[data-hinweis="stich"]').text()).toBe('* Platz durch Stichentscheid. Bei gleicher Punktzahl entscheidet die Anzahl der 1. Plätze, dann der 2. und 3. Plätze.')
      expect(fuss.find('[data-hinweis="fuss"]').exists()).toBe(false)
      expect(wrapper.find('.ergebnis-blatt[data-art="pokal-plaetze"] .erg-kopf').text()).not.toContain('Zwischenstand')
      wrapper.unmount()
    })

    it('ohne Punktgleichheit steht kein Zeichen und keine Regel im Fuß', async () => {
      fahre(store, '1')
      fahre(store, '2')
      const wrapper = await pokal(store)
      expect(wrapper.findAll('[data-stich]')).toHaveLength(0)
      expect(wrapper.find('[data-hinweis="stich"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('ohne Herkunft gibt es keine Mannschaftswertung – die Ansicht sagt es', async () => {
      fahre(store, '1')
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'none' })
      const wrapper = await pokal(store)
      expect(wrapper.find('[data-hinweis="pokal-ohne-herkunft"]').text()).toContain('keine Herkunft')
      expect(wrapper.findAll('.ergebnis-blatt')).toHaveLength(0)
      wrapper.unmount()
    })

    it('ohne eingeschaltete Variante: Hinweis mit Verweis in die Einstellungen', async () => {
      fahre(store, '1')
      store.dispatch({ type: 'SET_POKAL_VARIANTE', variante: 'plaetze6', an: false })
      store.dispatch({ type: 'SET_POKAL_VARIANTE', variante: 'uim', an: false })
      const wrapper = await pokal(store)
      expect(wrapper.find('[data-hinweis="pokal-aus"] a').attributes('href')).toBe('#/einstellungen?mannschaftswertung')
      expect(wrapper.findAll('.ergebnis-blatt')).toHaveLength(0)
      wrapper.unmount()
    })

    it('DM: Plätze 1–6 und UIM je als eigenes Dokument; Zwischenstand, solange eine Klasse offen ist', async () => {
      fahre(store, '1')
      const wrapper = await pokal(store)
      expect(wrapper.findAll('.ergebnis-blatt').map((b) => b.attributes('data-art'))).toEqual(['pokal-plaetze', 'pokal-uim'])
      expect(wrapper.find('.ergebnis-zahl').text()).toBe('2 Listen')
      // Klasse 2 ist noch nicht gefahren: am Bildschirm, im Kopf und im Fuß des Blatts.
      expect(wrapper.find('[data-hinweis="pokal-zwischenstand"]').text()).toContain('Klasse 2')
      const kopf = wrapper.find('.ergebnis-blatt[data-art="pokal-plaetze"] .erg-kopf').text()
      expect(kopf).toContain('Mannschaftswertung – Zwischenstand')
      expect(kopf).toContain('Plätze 1–6 je Klasse: 6 · 5 · 4 · 3 · 2 · 1 Punkte')
      expect(kopf).toContain('Hafenpokal 2026')
      expect(wrapper.find('.ergebnis-blatt[data-art="pokal-plaetze"] [data-hinweis="fuss"]').text()).toBe('Zwischenstand – noch ohne Endergebnis (Klasse: Läufe · gefahren): 2: 0/3')
      // Spalten wie im Blatt „Mannschaftswertung_Ausgabe“: Platz, Verein, Gesamt, je Klasse „1.“ bis „6.“.
      const koepfe = wrapper.find('.ergebnis-blatt[data-art="pokal-plaetze"]').findAll('thead th').map((t) => t.text())
      expect(koepfe.slice(1, 6)).toEqual(['Platz', 'Verein', 'Gesamt', 'Klasse 1', 'Klasse 2'])
      expect(koepfe.slice(6)).toEqual(['1.', '2.', '3.', '4.', '5.', '6.', '1.', '2.', '3.', '4.', '5.', '6.'])
      expect(zeilen(wrapper, 'pokal-plaetze')).toEqual(['1 MBC Nord 6 6', '2 MBC Süd 5 5', '3 WSV Ost 4 4'])
      // Der Zeitpunkt der letzten Änderung steht auf dem Blatt.
      expect(wrapper.find('.ergebnis-blatt[data-art="pokal-plaetze"] .erg-stand').text()).toMatch(/^Letzte Änderung: 26\.09\.2026, \d\d:00:0\d$/)

      // Mit der zweiten Klasse ist es das Endergebnis.
      fahre(store, '2')
      await nextTick()
      expect(wrapper.find('[data-hinweis="pokal-zwischenstand"]').exists()).toBe(false)
      expect(wrapper.find('.ergebnis-blatt[data-art="pokal-plaetze"] .erg-kopf').text()).not.toContain('Zwischenstand')
      expect(zeilen(wrapper, 'pokal-plaetze')).toEqual(['1 MBC Nord 12 6 6', '2 MBC Süd 10 5 5', '3 WSV Ost 8 4 4'])
      wrapper.unmount()
    })

    it('die Variante lässt sich wählen; geänderte Punkte und Variante 1 gelten sofort', async () => {
      fahre(store, '1')
      fahre(store, '2')
      store.dispatch({ type: 'SET_POKAL_VARIANTE', variante: 'plaetze3', an: true })
      store.dispatch({ type: 'SET_POKAL_PUNKTE', variante: 'plaetze3', punkte: [20, 7, 5] })
      const wrapper = await pokal(store)
      expect(wrapper.findAll('.ergebnis-blatt')).toHaveLength(3)
      await wrapper.find('.cup-wahl button[data-variante="plaetze3"]').trigger('click')
      expect(wrapper.findAll('.ergebnis-blatt')).toHaveLength(1)
      expect(wrapper.find('.erg-kopf').text()).toContain('Plätze 1–3 je Klasse: 20 · 7 · 5 Punkte')
      expect(zeilen(wrapper, 'pokal-plaetze')).toEqual(['1 MBC Nord 40 20 20', '2 MBC Süd 14 7 7', '3 WSV Ost 10 5 5'])
      wrapper.unmount()
    })

    it('UIM-Liste: je Herkunft ein Block mit Startern, Kennzeichen der Besten, Summen und Platz; kleine Herkünfte ohne Platz', async () => {
      fahre(store, '1')
      fahre(store, '2')
      store.dispatch({ type: 'SET_POKAL_UIM', patch: { mindestens: 2, beste: 1 } })
      const wrapper = await pokal(store)
      await wrapper.find('.cup-wahl button[data-variante="uim"]').trigger('click')
      const blatt = wrapper.find('.ergebnis-blatt[data-art="pokal-uim"]')
      // Die Spaltenköpfe stehen bei jeder Tabelle: über jedem der drei Herkunftsblöcke, direkt
      // unter dessen Titel – und nicht mehr einmal oben auf der Seite.
      const koepfe = blatt.findAll('tbody tr.pokal-gruppe-kopf')
      expect(koepfe).toHaveLength(3)
      for (const k of koepfe) expect(k.findAll('th').map((t) => t.text())).toEqual(['Platz', 'Klasse', 'S-Nr.', 'Name', 'Vorname', 'Punkte', 'Top 1', 'Gesamt Platz'])
      expect(blatt.findAll('tbody').map((b) => b.findAll('tr').map((r) => r.classes().find((c) => c.startsWith('pokal-gruppe')) ?? 'starter').slice(0, 3))).toEqual(Array(3).fill(['pokal-gruppe-titel', 'pokal-gruppe-kopf', 'starter']))
      expect(blatt.find('thead .erg-spaltenkopf').exists()).toBe(false)
      expect(blatt.find('thead tr.pokal-gruppe-kopf').exists()).toBe(false)
      // Im Feld der Zeit steht nur der Zeitstempel.
      expect([...blatt.find('.erg-stand').element.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim()).toMatch(/^26\.09\.2026, \d\d:00:0\d$/)
      expect(zeilen(wrapper, 'pokal-uim').slice(0, 4)).toEqual(['MBC Nord', '1 1 101 Nach11 Vor11 400 X', '1 2 201 Nach21 Vor21 400', 'Summe 800 400 1'])
      // Fassung „Aushang“ ohne Namen: Es bleibt die Startnummer.
      store.dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { namen: 'ohne' } })
      await nextTick()
      expect(zeilen(wrapper, 'pokal-uim')[1]).toBe('1 1 101 400 X')
      await wrapper.find('.cup-wahl button[data-fassung="intern"]').trigger('click')
      expect(zeilen(wrapper, 'pokal-uim')[1]).toBe('1 1 101 Nach11 Vor11 400 X')
      // Mit der Mindestzahl des Regelwerks (5) ist keine der drei Herkünfte gewertet.
      store.dispatch({ type: 'SET_POKAL_UIM', patch: { mindestens: null, beste: null } })
      await nextTick()
      expect(blatt.findAll('[data-hinweis="nicht-gewertet"]').map((x) => x.text())).toEqual(Array(3).fill('nicht gewertet: weniger als 5 Starter'))
      expect(zeilen(wrapper, 'pokal-uim')[3]).toBe('Summe 800 –')
      expect(wrapper.find('[data-hinweis="pokal-nicht-gewertet"]').text()).toContain('3 Herkünfte')
      // Nirgends ein Geburtsdatum.
      expect(blatt.text()).not.toMatch(/2014|01\.05\./)
      wrapper.unmount()
    })

    it('UIM-Regelwerk: englisch, Herkunft Land, nur die UIM-Variante', async () => {
      store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
      store.dispatch({ type: 'SET_POKAL_UIM', patch: { mindestens: 1 } })
      fahre(store, '1')
      fahre(store, '2')
      // Unter Regel 960 gibt es die UIM points des Manövrierens erst mit den Knoten.
      store.dispatch({ type: 'SET_EINGABEN', zellen: knotenHaken(['1', '2'].flatMap((k) => [1, 2, 3].map((i) => `id-${k}-${i}`))) })
      const wrapper = await pokal(store)
      expect(wrapper.findAll('.ergebnis-blatt').map((b) => b.attributes('data-art'))).toEqual(['pokal-uim'])
      const blatt = wrapper.find('.ergebnis-blatt')
      expect(blatt.find('.erg-kopf').text()).toContain('Team competition')
      expect(blatt.find('.erg-kopf').text()).toContain('UIM points · best 5 per Country')
      expect(blatt.findAll('tbody tr.pokal-gruppe-kopf').map((k) => k.findAll('th').map((t) => t.text()))).toEqual(Array(2).fill(['Rank.', 'Class', 'No.', 'Surname', 'First name', 'Points', 'Top 5', 'Team ranking']))
      // Deutschland: 400 + 400 + 300 + 300 = 1400; Österreich: 225 + 225. Auf der englischen Liste mit
      // englischem Namen – Nationen sind international (Entscheidung des Nutzers vom 15.11.2026).
      expect(zeilen(wrapper, 'pokal-uim').filter((z) => /^(Germany|Austria|Sum)/.test(z))).toEqual(['Germany', 'Sum 1400 1400 1', 'Austria', 'Sum 450 450 2'])
      wrapper.unmount()
    })

    it('Starter ohne Herkunft zählen für keine Mannschaft – die Ansicht nennt ihre Zahl', async () => {
      store.dispatch({ type: 'UPDATE_STARTER', id: 'id-1-1', patch: { verein: '', bundesland: '' } })
      fahre(store, '1')
      fahre(store, '2')
      const wrapper = await pokal(store)
      expect(wrapper.find('[data-hinweis="pokal-starter-ohne-herkunft"]').text()).toContain('1 Starter hat keine Herkunft')
      // Der Sieger der Klasse 1 hat keine Herkunft: Platz 1 bleibt unvergeben, niemand rückt auf.
      expect(zeilen(wrapper, 'pokal-plaetze')).toEqual(['1 MBC Süd 10 5 5', '2 WSV Ost 8 4 4', '3 MBC Nord 6 6'])
      wrapper.unmount()
    })

    it('viele Herkünfte: Die Liste teilt sich in Seiten und zählt nur die eigenen', async () => {
      const viele = Array.from({ length: 70 }, (_, i): Starter => ({ ...starter(['3'])[0], id: `v-${i}`, startNr: String(300 + i), verein: `Verein Nummer ${i + 1}` }))
      store.dispatch({ type: 'ADD_STARTERS', starters: viele })
      for (let n = 1; n <= 3; n++) store.dispatch({ type: 'SET_EINGABEN', zellen: viele.map((p, i) => ({ lauf: laufSchluessel('manoevrieren', n), starter: p.id, feld: 'zeit1', wert: String(50 + i) })) })
      const wrapper = await pokal(store)
      const seiten = wrapper.findAll('.ergebnis-blatt[data-art="pokal-plaetze"]')
      expect(seiten.length).toBeGreaterThan(1)
      expect(seiten[0].find('.listen-seitenzahl').text()).toBe(`Seite 1 / ${seiten.length}`)
      // Jede Herkunft steht genau einmal da (70 neue; die drei anderen haben in Klasse 1 und 2 noch kein Ergebnis, zählen aber).
      expect(wrapper.findAll('.ergebnis-blatt[data-art="pokal-plaetze"] tbody tr')).toHaveLength(73)
      // UIM: 73 Blöcke, keiner geteilt – keine Fortsetzung.
      expect(wrapper.findAll('.ergebnis-blatt[data-art="pokal-uim"] .pokal-gruppe-titel')).toHaveLength(73)
      expect(wrapper.find('[data-hinweis="fortsetzung"]').exists()).toBe(false)
      wrapper.unmount()
    })

    it('mit Logos (16.11.2026): Plätze und UIM auf jeder Seite links und rechts; die Fortsetzung bleibt in der Kopfzelle', async () => {
      // Ein Block über zwei Seiten der UIM-Liste: 60 Starter eines Vereins.
      const viele = Array.from({ length: 60 }, (_, i): Starter => ({ ...starter(['3'])[0], id: `v-${i}`, startNr: String(300 + i) }))
      store.dispatch({ type: 'ADD_STARTERS', starters: viele })
      for (let n = 1; n <= 3; n++) store.dispatch({ type: 'SET_EINGABEN', zellen: viele.map((p, i) => ({ lauf: laufSchluessel('manoevrieren', n), starter: p.id, feld: 'zeit1', wert: String(50 + i) })) })
      const KOPF = ['.erg-kopf span:not(.erg-stand)', 'th.erg-kopfzelle'] as const
      const vorher = await pokal(store)
      const ohne = seitenKoepfe(document.body, ...KOPF)
      vorher.unmount()
      expect(ohne.length).toBeGreaterThan(2)
      expect(ohne.every((x) => x.logos.length === 0)).toBe(true)
      setzeTestLogos(store)
      const wrapper = await pokal(store)
      const mit = seitenKoepfe(document.body, ...KOPF)
      expect(mit.map((x) => x.logos)).toEqual(mit.map(() => ['links', 'rechts']))
      expect(ohneLogos(mit)).toEqual(ohneLogos(ohne))
      for (const art of ['pokal-plaetze', 'pokal-uim']) {
        expect(wrapper.find(`.ergebnis-blatt[data-art="${art}"] th.erg-kopfzelle > .kopf-logos > .kopf-logos-mitte > .erg-kopf.pokal-kopf`).exists(), art).toBe(true)
      }
      // Die Fortsetzung sitzt weiter direkt in der Kopfzelle (absolut, unter dem Kopf), nicht zwischen den Logos.
      const fortsetzung = wrapper.find('[data-hinweis="fortsetzung"]')
      expect(fortsetzung.exists()).toBe(true)
      expect(fortsetzung.element.parentElement?.matches('th.erg-kopfzelle.pokal-kopfzelle')).toBe(true)
      wrapper.unmount()
    })
  })

  describe('Einstellungen', () => {
    const feld = (wrapper: VueWrapper, name: string) => wrapper.find(`[data-feld="${name}"]`)
    const an = (wrapper: VueWrapper, v: string) => (feld(wrapper, `pokal-variante|${v}`).element as HTMLInputElement).checked

    it('eigener Block: Varianten nach Regelwerk, Punkte je Platz mit „zurück auf Vorgabe“', async () => {
      const wrapper = mount(SettingsView, global(store))
      expect(wrapper.find('#pokal h2').text()).toBe('Mannschaftswertung')
      expect(['plaetze3', 'plaetze6', 'uim'].map((v) => an(wrapper, v))).toEqual([false, true, true])
      const punkte = (v: string) => wrapper.findAll(`[data-feld^="pokal-punkte|${v}|"]`).map((i) => (i.element as HTMLInputElement).value)
      expect(punkte('plaetze3')).toEqual(['10', '7', '5'])
      expect(punkte('plaetze6')).toEqual(['6', '5', '4', '3', '2', '1'])
      expect(wrapper.find('[data-hinweis="pokal-uim-tabelle"]').text()).toContain('400, 300, 225')

      await feld(wrapper, 'pokal-variante|plaetze3').setValue(true)
      await feld(wrapper, 'pokal-punkte|plaetze3|1').setValue('12')
      expect(store.state.value.pokal).toMatchObject({ varianten: { plaetze3: true }, punkte: { plaetze3: [12, 7, 5] } })
      const zurueck = wrapper.find('[data-action="pokal-punkte-vorgabe|plaetze3"]')
      expect(zurueck.text()).toBe('Zurück auf Vorgabe (10, 7, 5)')
      await zurueck.trigger('click')
      expect(store.state.value.pokal.punkte).toEqual({})
      expect(punkte('plaetze3')).toEqual(['10', '7', '5'])
      // Ein leeres Feld zählt 0 und zeigt das auch.
      await feld(wrapper, 'pokal-punkte|plaetze6|6').setValue('')
      expect(store.state.value.pokal.punkte.plaetze6).toEqual([6, 5, 4, 3, 2, 0])
      expect(punkte('plaetze6')[5]).toBe('0')
      wrapper.unmount()
    })

    it('UIM: Zahl der Besten und Mindestzahl mit dem Regelwerk als Vorgabe; Schalter „nur ausgewählte Starter zählen“', async () => {
      const wrapper = mount(SettingsView, global(store))
      expect((feld(wrapper, 'pokal-beste').element as HTMLInputElement).value).toBe('5')
      expect((feld(wrapper, 'pokal-mindestens').element as HTMLInputElement).value).toBe('5')
      await feld(wrapper, 'pokal-beste').setValue('3')
      expect(store.state.value.pokal.beste).toBe(3)
      await wrapper.find('[data-action="pokal-uim-vorgabe"]').trigger('click')
      expect(store.state.value.pokal.beste).toBeUndefined()
      await feld(wrapper, 'pokal-nur-auswahl').setValue(true)
      expect(store.state.value.pokal.nurAuswahl).toBe(true)
      wrapper.unmount()
    })

    it('unter UIM ist nur die UIM-Variante die Vorgabe; ohne Herkunft steht ein Hinweis da', async () => {
      store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
      store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'none' })
      const wrapper = mount(SettingsView, global(store))
      expect(['plaetze3', 'plaetze6', 'uim'].map((v) => an(wrapper, v))).toEqual([false, false, true])
      expect(wrapper.find('#pokal [data-hinweis="pokal-ohne-herkunft"]').exists()).toBe(true)
      wrapper.unmount()
    })
  })

  describe('Starter: Auswahl', () => {
    const haken = (wrapper: VueWrapper) => wrapper.findAll('input[data-feld="pokal-zaehlt"]').map((i) => (i.element as HTMLInputElement).checked)

    it('die Spalte gibt es nur, wenn „nur ausgewählte Starter zählen“ an ist', async () => {
      const wrapper = mount(StartersView, global(store))
      expect(wrapper.find('[data-bereich="pokal-auswahl"]').exists()).toBe(false)
      expect(wrapper.find('input[data-feld="pokal-zaehlt"]').exists()).toBe(false)
      store.dispatch({ type: 'SET_POKAL_NUR_AUSWAHL', an: true })
      await nextTick()
      expect(wrapper.find('[data-bereich="pokal-auswahl"] strong').text()).toBe('Mannschaftswertung: 6 von 6 Startern zählen.')
      expect(haken(wrapper)).toEqual(Array(6).fill(true))
      wrapper.unmount()
    })

    it('einzeln, je Klasse (alle/keine, umkehren) und für alle – auch wenn das Starterfeld schon feststeht', async () => {
      store.dispatch({ type: 'SET_POKAL_NUR_AUSWAHL', an: true })
      fahre(store, '1')
      const wrapper = mount(StartersView, global(store))
      // Das Starterfeld ist fest (Ergebnisse erfasst) – die Auswahl bleibt frei.
      expect(wrapper.find('[data-hinweis="starter-gesperrt"]').exists()).toBe(true)
      await wrapper.findAll('input[data-feld="pokal-zaehlt"]')[1].setValue(false)
      expect(haken(wrapper)).toEqual([true, false, true, true, true, true])
      expect(store.state.value.starters.filter((p) => p.pokal === false).map((p) => p.id)).toEqual(['id-1-2'])
      // Kästchen im Spaltenkopf: halb gesetzt; ein Klick setzt alle der Klasse, der nächste keine.
      const kopf = () => wrapper.findAll('input[data-feld="pokal-klasse"]')[0]
      expect((kopf().element as HTMLInputElement).indeterminate).toBe(true)
      await kopf().setValue(true)
      expect(haken(wrapper).slice(0, 3)).toEqual([true, true, true])
      await kopf().setValue(false)
      expect(haken(wrapper)).toEqual([false, false, false, true, true, true])
      // „umkehren“ in der Klasse 2 (Knöpfe: E, 1, 2 …) und dann für alle.
      await wrapper.findAll('[data-action="pokal-umkehren-klasse"]')[2].trigger('click')
      expect(haken(wrapper)).toEqual(Array(6).fill(false))
      expect(wrapper.find('[data-action="pokal-keine"]').attributes('aria-pressed')).toBe('true')
      await wrapper.findAll('input[data-feld="pokal-zaehlt"]')[0].setValue(true)
      await wrapper.find('[data-action="pokal-umkehren"]').trigger('click')
      expect(haken(wrapper)).toEqual([false, true, true, true, true, true])
      await wrapper.find('[data-action="pokal-alle"]').trigger('click')
      expect(haken(wrapper)).toEqual(Array(6).fill(true))
      await wrapper.find('[data-action="pokal-keine"]').trigger('click')
      expect(store.state.value.starters.every((p) => p.pokal === false)).toBe(true)
      wrapper.unmount()
    })

    it('wirkt auf die Auswertung: Wer nicht gewählt ist, behält seinen Platz und bekommt keine Punkte', async () => {
      fahre(store, '1')
      fahre(store, '2')
      store.dispatch({ type: 'SET_POKAL_NUR_AUSWAHL', an: true })
      store.dispatch({ type: 'SET_POKAL_ZAEHLT', ids: ['id-1-1'], zaehlt: false })
      const wrapper = await pokal(store)
      expect(zeilen(wrapper, 'pokal-plaetze')).toEqual(['1 MBC Süd 10 5 5', '2 WSV Ost 8 4 4', '3 MBC Nord 6 6'])
      expect(wrapper.find('[data-hinweis="pokal-auswahl"]').text()).toContain('1 Starter ist abgewählt')
      // Ausgeschaltet zählen wieder alle; die Auswahl bleibt im Stand.
      store.dispatch({ type: 'SET_POKAL_NUR_AUSWAHL', an: false })
      await nextTick()
      expect(zeilen(wrapper, 'pokal-plaetze')[0]).toBe('1 MBC Nord 12 6 6')
      expect(store.state.value.starters.find((p) => p.id === 'id-1-1')?.pokal).toBe(false)
      wrapper.unmount()
    })
  })
})
