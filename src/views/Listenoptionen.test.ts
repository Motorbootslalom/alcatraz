import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import SettingsView from './SettingsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { emptyState } from '../state/reducer'
import { laufSchluessel } from '../lib/eingaben'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { AppState, ClassId, Starter } from '../types'

// Listenoptionen aus dem Fehlerpunkte-Prototyp: Seitenaufteilung, Bezeichnung der
// Bojen-Seiten, Sprache der Listen, Aushang der Codes, beide Ergebnislisten in einem Druck.
// Alle Starter sind erfunden.

function starter(klassen: ClassId[], n = 3): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: 'Musterclub',
      bundesland: 'Musterland',
      geburtsdatum: '2014-05-0' + (i + 1),
      groesse: '',
      klasse,
    })),
  )
}

const listen = (store: Store) => mount(ListsView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
const einstellungen = (store: Store) => mount(SettingsView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
async function art(wrapper: VueWrapper, kind: string) {
  await wrapper.find(`.list-kinds button[data-kind="${kind}"]`).trigger('click')
  await nextTick()
  await nextTick()
}
const lade = (store: Store, mehr: Partial<AppState> = {}) =>
  store.dispatch({ type: 'LOAD_STATE', state: { ...emptyState(), kennung: 'K7Q4', eventName: 'Hafenpokal', starters: starter(['1', '4']), ...mehr } })
const zeit = (store: Store, lauf: number, id: string, wert: string) =>
  store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', lauf), starter: id, feld: 'zeit1', wert }] })

let store: Store
beforeEach(() => {
  localStorage.clear()
  vergissAlles()
  setLocale('de')
  store = createStore()
})
afterEach(() => {
  setLocale('de')
  document.body.innerHTML = ''
})

describe('Listen: Aushang der Codes', () => {
  it('steht zwischen Laufzetteln und Ergebnislisten und braucht weder Starter noch Startnummern', async () => {
    const wrapper = listen(store)
    await art(wrapper, 'codes')
    expect(wrapper.find('.list-kinds button[data-kind="codes"]').text()).toBe('Aushang der Codes')
    // Ohne Starter: kein „noch keine Starter“, das Blatt ist da und lässt sich drucken.
    expect(wrapper.find('.panel.empty').exists()).toBe(false)
    expect(wrapper.find('.lg-blatt').exists()).toBe(true)
    expect(wrapper.find('button.btn.primary').attributes('disabled')).toBeUndefined()
    // Fehlende Startnummern sperren die anderen Listen, diese nicht.
    lade(store, { starters: starter(['4']).map((p) => ({ ...p, startNr: '' })) })
    await nextTick()
    expect(wrapper.find('.boat-banner.warn').exists()).toBe(false)
    expect(wrapper.find('button.btn.primary').attributes('disabled')).toBeUndefined()
    await art(wrapper, 'wkr')
    expect(wrapper.find('.boat-banner.warn').exists()).toBe(true)
    wrapper.unmount()
  })

  it('nennt Veranstaltung und Quelle des Regelwerks und führt alle Codes auf', async () => {
    lade(store)
    const wrapper = listen(store)
    await art(wrapper, 'codes')
    const blatt = wrapper.find('.lg-blatt')
    expect(blatt.attributes('data-regelwerk')).toBe('dm-2026')
    expect(blatt.find('.sheet-title-box .list').text()).toBe('Legende: Fehlerpunkte und Disqualifikationen')
    expect(blatt.find('.sheet-title-box .event').text()).toBe('Hafenpokal 2026')
    expect(blatt.find('.lg-quelle').text()).toContain('Reglement zur Deutschen Jugendmeisterschaft 2026')
    // Fehlercodes mit Punkten, je Katalog eine Tabelle; darunter alle Disqualifikationen.
    expect(blatt.findAll('.lg-raster .lg-tabelle').length).toBeGreaterThan(1)
    expect(blatt.findAll('.lg-raster .lg-punkte').every((p) => /^\d+$/.test(p.text()))).toBe(true)
    const disq = blatt.findAll('[data-tabelle="disq"] .lg-code').map((c) => c.text())
    expect(disq.length).toBeGreaterThan(5)
    expect(disq).toContain('X')
    wrapper.unmount()
  })

  it('folgt der Listensprache – auch zweisprachig', async () => {
    lade(store, { regelwerk: 'uim-2026', listenSprache: 'en' })
    const wrapper = listen(store)
    await art(wrapper, 'codes')
    const titel = () => wrapper.find('.lg-blatt .sheet-title-box .list').text()
    expect(titel()).toBe('Legend: penalties and disqualifications')
    expect(wrapper.find('.lg-quelle').text()).toContain('rule 960 Formula Future')
    store.dispatch({ type: 'SET_LISTEN_SPRACHE', sprache: 'de+en' })
    await nextTick()
    expect(titel()).toBe('Legende: Fehlerpunkte und Disqualifikationen / Legend: penalties and disqualifications')
    wrapper.unmount()
  })
})

describe('Listen: Sprache unabhängig von der Oberfläche', () => {
  // Die Spaltenköpfe der ersten Liste (je Parcours gibt es eine).
  const koepfe = (wrapper: VueWrapper) => wrapper.find('.sheet-cols').findAll('th').map((th) => th.text())

  it('UIM, Listen englisch, Oberfläche deutsch: Startliste, Laufzettel und Ergebnisliste sind englisch', async () => {
    lade(store, { regelwerk: 'uim-2026', listenSprache: 'en', showBirthdate: true })
    zeit(store, 1, 'id-4-1', '70')
    const wrapper = listen(store)
    // Die Bedienung bleibt deutsch.
    expect(wrapper.find('.list-kinds button[data-kind="interleaved"]').text()).toBe('Starter komplett (verzahnt)')
    expect(koepfe(wrapper)).toEqual(['No.', 'Surname', 'First name', 'Club', 'Date of birth', 'Class'])
    // Datum in englischer Schreibweise.
    expect(wrapper.find('.sheet-table tbody td:nth-child(5)').text()).toMatch(/^2014-05-0\d$/)
    await art(wrapper, 'laufzettel')
    expect(wrapper.find('.laufzettel .lz-titel').text()).toBe('Checklist · Hafenpokal 2026')
    expect(wrapper.find('.laufzettel .lz-lauf').text()).toBe('Attempt 1')
    await art(wrapper, 'ergebnis')
    expect(wrapper.find('.ergebnis-blatt .erg-spaltenkopf th').text()).toBe('Rank')
    expect(wrapper.find('.ergebnis-blatt .erg-kopf-klasse').text()).toBe('Class 4')
    // Die Auswahl darüber ist Bedienung.
    expect(wrapper.find('select[data-feld="erg-klasse"] option:nth-child(2)').text()).toMatch(/^Klasse /)
    await art(wrapper, 'wkr')
    expect(wrapper.find('.bogen .bt-nr').text()).toBe('No.')
    wrapper.unmount()
  })

  it('zweisprachig: die Bögen in beiden Sprachen, die übrigen Listen in der Sprache der Oberfläche', async () => {
    lade(store, { regelwerk: 'uim-2026', listenSprache: 'de+en' })
    const wrapper = listen(store)
    expect(koepfe(wrapper)[0]).toBe('S-Nr.')
    setLocale('en')
    await nextTick()
    expect(koepfe(wrapper)[0]).toBe('No.')
    await art(wrapper, 'wkr')
    expect(wrapper.find('.bogen .bt-nr').text()).toBe('Nr. / No.')
    // Der Laufzettel nennt die Listen in der einen Sprache der übrigen Listen, nicht „Zeit / Time“.
    await art(wrapper, 'laufzettel')
    const namen = wrapper.findAll('.lz-vorn .lz-je-seite .lz-text').map((x) => x.text())
    expect(namen.length).toBeGreaterThan(0)
    expect(namen[0]).toBe('Time')
    expect(namen.filter((n) => /Zeit|Tor|Steg/.test(n))).toEqual([])
    wrapper.unmount()
  })

  it('DM: Das Regelwerk gibt es nur auf Deutsch – die Wahl wirkt nicht', async () => {
    lade(store, { listenSprache: 'en' })
    const wrapper = listen(store)
    expect(koepfe(wrapper)[0]).toBe('S-Nr.')
    await art(wrapper, 'wkr')
    expect(wrapper.find('.bogen .bt-nr').text()).toBe('Nr.')
    wrapper.unmount()
  })
})

describe('Listen: Bezeichnung der Bojen-Seiten', () => {
  it('die Bögen tragen das gewählte Schema, die Ergebnislisten bleiben bei R und L', async () => {
    lade(store, { beschriftung: 'ls' })
    zeit(store, 1, 'id-4-1', '70')
    const wrapper = listen(store)
    await art(wrapper, 'wkr')
    await wrapper.find('select[data-feld="wkr-liste"]').setValue('gate135')
    await nextTick()
    const sub = wrapper.findAll('.bogen .bt-sub').map((th) => th.text())
    expect(sub.length).toBeGreaterThan(0)
    expect(sub.every((s) => /[LS]$/.test(s))).toBe(true)
    await art(wrapper, 'ergebnis')
    const unter = wrapper.findAll('.ergebnis-blatt .erg-unterkopf th').map((th) => th.text())
    expect(unter).toContain('R')
    expect(unter).not.toContain('S')
    wrapper.unmount()
  })
})

describe('Ergebnislisten: beide Reihenfolgen in einem Druck', () => {
  it('je Liste erst nach Platz, dann nach Startnummer', async () => {
    lade(store)
    // Der spätere Starter ist schneller: Platz und Startnummer ergeben verschiedene Reihenfolgen.
    zeit(store, 1, 'id-4-1', '80')
    zeit(store, 1, 'id-4-2', '70')
    zeit(store, 1, 'id-4-3', '75')
    const wrapper = listen(store)
    await art(wrapper, 'ergebnis')
    await wrapper.find('select[data-feld="erg-klasse"]').setValue('4')
    const blaetter = () => wrapper.findAll('.ergebnis-blatt').map((b) => `${b.attributes('data-art')}/${b.attributes('data-ordnung')}`)
    const nummern = (i: number) => wrapper.findAll('.ergebnis-blatt')[i].findAll('tbody tr').map((r) => r.findAll('td')[1].text())
    expect(blaetter()).toEqual(['lauf/platz', 'gesamt/platz'])
    await wrapper.find('select[data-feld="erg-ordnung"]').setValue('beide')
    await nextTick()
    expect(wrapper.find('select[data-feld="erg-ordnung"] option[value="beide"]').text()).toBe('beide (erst Platz, dann Startnummer)')
    expect(blaetter()).toEqual(['lauf/platz', 'lauf/nummer', 'gesamt/platz', 'gesamt/nummer'])
    expect(nummern(0)).toEqual(['402', '403', '401'])
    expect(nummern(1)).toEqual(['401', '402', '403'])
    expect(wrapper.find('.ergebnis-zahl').text()).toBe('4 Listen')
    wrapper.unmount()
  })
})

describe('Einstellungen: Listenoptionen', () => {
  const feld = (wrapper: VueWrapper, name: string) => wrapper.find(`[data-feld="${name}"]`)

  it('Starter je Seite und „Teilen ab“ stehen bei den Wettkampfrichter-Listen', async () => {
    const wrapper = einstellungen(store)
    expect(wrapper.find('#wkr-listen').find('[data-feld="wkr-zeilen-je-seite"]').exists()).toBe(true)
    // „Teilen ab“ wirkt nur mit fester Zahl.
    expect(feld(wrapper, 'wkr-teilen-ab').attributes('disabled')).toBeDefined()
    await feld(wrapper, 'wkr-zeilen-je-seite').setValue('3')
    expect(store.state.value.wkrZeilenJeSeite).toBe(5)
    // Das Feld zeigt, was gilt.
    expect((feld(wrapper, 'wkr-zeilen-je-seite').element as HTMLInputElement).value).toBe('5')
    expect(feld(wrapper, 'wkr-teilen-ab').attributes('disabled')).toBeUndefined()
    await feld(wrapper, 'wkr-teilen-ab').setValue('25')
    expect(store.state.value.wkrTeilenAb).toBe(25)
    await feld(wrapper, 'wkr-zeilen-je-seite').setValue('')
    expect(store.state.value.wkrZeilenJeSeite).toBe(0)
    // Was für gemeinsame Bögen gilt, steht nur bei der Clubmeisterschaft da.
    expect(wrapper.find('[data-hinweis="wkr-seiten-club"]').exists()).toBe(false)
    store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
    await nextTick()
    expect(wrapper.find('[data-hinweis="wkr-seiten-club"]').text()).toContain('immer automatisch geteilt')
    wrapper.unmount()
  })

  it('Bezeichnung der Bojen-Seiten: die Namen kommen aus der Konfiguration', async () => {
    const wrapper = einstellungen(store)
    const wahl = feld(wrapper, 'wkr-beschriftung')
    expect(wahl.findAll('option').map((o) => o.text())).toEqual([
      'Rechts / Links (R/L)',
      'Land / See (L/S)',
      'See / Land (S/L)',
      'Kai / Hafen (K/H)',
      'Pfeile (→ / ←)',
      'Innen / Außen (I/A)',
    ])
    expect((wahl.element as HTMLSelectElement).value).toBe('rl')
    await wahl.setValue('kh')
    expect(store.state.value.beschriftung).toBe('kh')
    wrapper.unmount()
  })

  it('Sprache der Listen: nur wählbar, wenn das Regelwerk Englisch anbietet', async () => {
    const wrapper = einstellungen(store)
    const wahl = () => feld(wrapper, 'listen-sprache')
    expect(wahl().attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-hinweis="listen-sprache"]').text()).toContain('nur auf Deutsch')
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    expect(wahl().attributes('disabled')).toBeUndefined()
    expect(wahl().findAll('option').map((o) => o.attributes('value'))).toEqual(['ui', 'de', 'en', 'de+en'])
    // Beim Feld steht, was „zweisprachig“ für die Listen ohne Platz dafür bedeutet.
    expect(wrapper.find('[data-hinweis="listen-sprache"]').text()).toContain('Sprache der Oberfläche')
    await wahl().setValue('de+en')
    expect(store.state.value.listenSprache).toBe('de+en')
    wrapper.unmount()
  })
})

describe('Einstellungen: Listen der Veranstaltung und Form der Laufzettel', () => {
  const feld = (wrapper: VueWrapper, name: string) => wrapper.find(`[data-feld="${name}"]`)
  const zusatz = (wrapper: VueWrapper) => wrapper.findAll('[data-feld="wkr-zusatzlisten"] input[data-liste]')
  const haken = (wrapper: VueWrapper, liste: string) => wrapper.find(`[data-feld="wkr-zusatzlisten"] input[data-liste="${liste}"]`)

  it('zusätzliche Listen: die des Aufbaus zur Wahl, die Knoten als Vorgabe des Regelwerks vorgewählt und abwählbar', async () => {
    lade(store)
    const wrapper = einstellungen(store)
    expect(wrapper.find('[data-feld="wkr-zusatzlisten"] legend').text()).toBe('Zusätzliche Listen')
    // Alcatraz hat den Vorsteg selbst; zur Wahl steht, was der Aufbau nicht nennt.
    expect(zusatz(wrapper).map((i) => i.attributes('data-liste')).sort()).toEqual(['gate135os', 'gate245os', 'knoten', 'parcoursms'])
    expect((haken(wrapper, 'knoten').element as HTMLInputElement).checked).toBe(true)
    expect(haken(wrapper, 'knoten').element.parentElement!.textContent).toContain('(Vorgabe DM 2026)')
    expect((haken(wrapper, 'parcoursms').element as HTMLInputElement).checked).toBe(false)
    await haken(wrapper, 'knoten').setValue(false)
    await haken(wrapper, 'parcoursms').setValue(true)
    expect(store.state.value.zusatzListen).toEqual({ knoten: false, parcoursms: true })
    // Die WKR-Einteilung darunter führt die gewählte Liste, die abgewählte nicht mehr.
    const zeilen = () => wrapper.findAll('#wkr-einteilung tbody th[scope="row"]').map((th) => th.text())
    expect(zeilen()).toContain('Parcours einfach mit Start und Ziel')
    expect(zeilen()).not.toContain('Knoten')
    await haken(wrapper, 'knoten').setValue(true)
    expect(store.state.value.zusatzListen).toEqual({ parcoursms: true })
    expect(zeilen()).toContain('Knoten')
    wrapper.unmount()
  })

  it('nennt der Aufbau die Knoten selbst, stehen sie nicht zur Wahl', async () => {
    lade(store, { aufbau: 'bawue' })
    const wrapper = einstellungen(store)
    expect(zusatz(wrapper).map((i) => i.attributes('data-liste'))).not.toContain('knoten')
    expect(zusatz(wrapper).map((i) => i.attributes('data-liste'))).toContain('vorsteg')
    wrapper.unmount()
  })

  it('„Tor 5 übernimmt die Parcoursüberwachung“ nur, wenn der Aufbau beide Listen hat', async () => {
    lade(store, { aufbau: 'bawue' })
    const wrapper = einstellungen(store)
    expect(feld(wrapper, 'wkr-tor5-mit-parcours').exists()).toBe(false)
    store.dispatch({ type: 'SET_AUFBAU', aufbau: 'alcatraz' })
    await nextTick()
    await feld(wrapper, 'wkr-tor5-mit-parcours').setValue(true)
    expect(store.state.value.tor5MitParcours).toBe(true)
    const zeilen = wrapper.findAll('#wkr-einteilung tbody th[scope="row"]').map((th) => th.text())
    expect(zeilen).toContain('Tor 5 + Parcours')
    expect(zeilen).not.toContain('Parcours')
    wrapper.unmount()
  })

  it('zusammengelegt: gedruckt wird „Tor 5 + Parcours“, die Parcoursliste entfällt', async () => {
    lade(store, { tor5MitParcours: true, laufCount: 1 })
    const wrapper = listen(store)
    await art(wrapper, 'wkr')
    const typen = [...new Set(wrapper.findAll('.wkr-listen .bogen').map((b) => b.attributes('data-liste')))]
    expect(typen).toContain('tor5pue')
    expect(typen).toContain('knoten')
    expect(typen).not.toContain('tor5')
    expect(typen).not.toContain('parcours')
    wrapper.unmount()
  })

  it('Form der Laufzettel: Vorgabe „eine Zeile je Seite“, wählbar „eine Zeile je Liste“', async () => {
    const wrapper = einstellungen(store)
    const wahl = feld(wrapper, 'laufzettel-layout')
    expect((wahl.element as HTMLSelectElement).value).toBe('seite')
    expect(wahl.findAll('option').map((o) => o.text())).toEqual(['eine Zeile je Seite (Kästchen vorn)', 'eine Zeile je Liste (Kästchen nebeneinander)'])
    await wahl.setValue('liste')
    expect(store.state.value.laufzettelLayout).toBe('liste')
    wrapper.unmount()
  })
})
