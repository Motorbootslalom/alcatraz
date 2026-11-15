import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import SettingsView from './SettingsView.vue'
import EventView from './EventView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { emptyState } from '../state/reducer'
import { laufSchluessel } from '../lib/eingaben'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { AppState, ClassId, Starter } from '../types'

// Listenoptionen aus dem Fehlerpunkte-Prototyp: Seitenaufteilung, Bezeichnung der
// Bojen-Seiten, Sprache der Listen, Aushang der Codes, beide Wertungslisten in einem Druck.
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
// Die WKR-Einteilung steht bei der Veranstaltung (Block „Besetzung“).
const veranstaltung = (store: Store) => mount(EventView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
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
  sessionStorage.clear()
  vergissAlles()
  setLocale('de')
  store = createStore()
})
afterEach(() => {
  setLocale('de')
  document.body.innerHTML = ''
})

describe('Listen: Aushang der Codes', () => {
  it('steht zwischen Laufzetteln und Wertungslisten und braucht weder Starter noch Startnummern', async () => {
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

  it('steht in der Sprache des Regelwerks – einsprachig, auch wenn Bögen zweisprachig sind', async () => {
    lade(store, { regelwerk: 'uim-2026' })
    const wrapper = listen(store)
    await art(wrapper, 'codes')
    const titel = () => wrapper.find('.lg-blatt .sheet-title-box .list').text()
    expect(titel()).toBe('Legend: penalties and disqualifications')
    expect(wrapper.find('.lg-quelle').text()).toContain('rule 960 Formula Future')
    store.dispatch({ type: 'SET_WKR_SPRACHE', zellen: ['steg', 'zeit', 'gate135'].map((typeId) => ({ parcoursId: 'par_1', typeId })), sprache: 'de+en' })
    await nextTick()
    expect(titel()).toBe('Legend: penalties and disqualifications')
    // Die Sprache der Oberfläche spielt keine Rolle; unter der DM ist der Aushang deutsch.
    setLocale('en')
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    await nextTick()
    expect(titel()).toBe('Legende: Fehlerpunkte und Disqualifikationen')
    wrapper.unmount()
  })
})

describe('Listen: Sprache nach dem Regelwerk, unabhängig von der Oberfläche', () => {
  // Die Spaltenköpfe der ersten Liste (je Parcours gibt es eine).
  const koepfe = (wrapper: VueWrapper) => wrapper.find('.sheet-cols').findAll('th').map((th) => th.text())

  it('UIM, Oberfläche deutsch: Startliste, Laufzettel, Wertungsliste und – ohne eigene Wahl – die Bögen sind englisch', async () => {
    lade(store, { regelwerk: 'uim-2026', showBirthdate: true })
    zeit(store, 1, 'id-4-1', '70')
    const wrapper = listen(store)
    // Die Bedienung bleibt deutsch.
    expect(wrapper.find('.list-kinds button[data-kind="starter"]').text()).toBe('Starterlisten')
    expect(koepfe(wrapper)).toEqual(['No.', 'Surname', 'First name', 'Club', 'Date of birth', 'Class'])
    // Geburtsdatum wie in Regel 960 Pkt. 3.7: „Date of birth (day/month/year)“.
    expect(wrapper.find('.sheet-table tbody td:nth-child(5)').text()).toMatch(/^0\d\/05\/2014$/)
    await art(wrapper, 'laufzettel')
    expect(wrapper.find('.laufzettel .lz-titel').text()).toBe('Checklist · Hafenpokal 2026')
    expect(wrapper.find('.laufzettel .lz-lauf').text()).toBe('Attempt 1')
    await art(wrapper, 'ergebnis')
    expect(wrapper.find('.ergebnis-blatt .erg-spaltenkopf th').text()).toBe('Rank.')
    expect(wrapper.find('.ergebnis-blatt .erg-kopf-klasse').text()).toBe('Class 4')
    // Die Auswahl darüber ist Bedienung.
    expect(wrapper.find('select[data-feld="erg-klasse"] option:nth-child(2)').text()).toMatch(/^Klasse /)
    await art(wrapper, 'wkr')
    expect(wrapper.find('.bogen .bt-nr').text()).toBe('No.')
    wrapper.unmount()
  })

  it('Bögen je Parcours und Liste: deutsch, englisch oder zweisprachig nebeneinander; die übrigen Listen bleiben bei der Sprache des Regelwerks', async () => {
    // Klasse 1 fährt auf Parcours 1, Klasse 4 auf Parcours 2 – zwei getrennte Gruppen.
    lade(store, { regelwerk: 'uim-2026', laufCount: 1, wkrSprachen: { par_1: { steg: 'de', zeit: 'de+en' }, par_2: { steg: 'de', zeit: 'de' } } })
    const wrapper = listen(store)
    expect(koepfe(wrapper)[0]).toBe('No.')
    // Auch die Sprache der Oberfläche ändert daran nichts.
    setLocale('en')
    await nextTick()
    expect(koepfe(wrapper)[0]).toBe('No.')
    setLocale('de')
    await art(wrapper, 'wkr')
    const nr = (liste: string) => wrapper.findAll(`.wkr-listen .bogen[data-liste="${liste}"] th.bt-nr`).map((x) => x.text())
    // Je Parcours ein Bogen: erst Parcours 1, dann Parcours 2.
    expect(nr('steg')).toEqual(['Nr.', 'Nr.'])
    expect(nr('zeit')).toEqual(['Nr. / No.', 'Nr.'])
    expect(nr('gate135')).toEqual(['No.', 'No.'])
    // Die Auswahl nennt jede Liste so, wie sie auf ihren Bögen heißt – stehen die Parcours in
    // verschiedenen Sprachen, in der des Regelwerks.
    const titel = wrapper.findAll('select[data-feld="wkr-liste"] option').map((o) => o.text())
    expect(titel).toContain('Steg')
    expect(titel).toContain('Time')
    expect(titel).toContain('Gate 1 / 3 / 5')
    // Der Laufzettel nennt die Listen in der Sprache des Regelwerks, nicht „Zeit / Time“.
    await art(wrapper, 'laufzettel')
    const namen = wrapper.findAll('.lz-vorn .lz-je-seite .lz-text').map((x) => x.text())
    expect(namen.length).toBeGreaterThan(0)
    expect(namen[0]).toBe('Time')
    expect(namen.filter((n) => /Zeit|Tor|Steg/.test(n))).toEqual([])
    wrapper.unmount()
  })

  it('DM: alles deutsch – auch bei englischer Oberfläche; eine Wahl für die Bögen wirkt nicht', async () => {
    lade(store, { wkrSprachen: { par_1: { steg: 'en', zeit: 'de+en' }, par_2: { steg: 'en' } } })
    setLocale('en')
    const wrapper = listen(store)
    expect(wrapper.find('.list-kinds button[data-kind="starter"]').text()).not.toMatch(/Starter/)
    expect(koepfe(wrapper)[0]).toBe('S-Nr.')
    await art(wrapper, 'wkr')
    expect(new Set(wrapper.findAll('.wkr-listen .bogen').map((b) => b.find('.bt-nr').text()))).toEqual(new Set(['Nr.']))
    wrapper.unmount()
  })
})

describe('Listen: Bezeichnung der Bojen-Seiten', () => {
  it('die Bögen tragen das gewählte Schema, die Wertungslisten bleiben bei R und L', async () => {
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

describe('Wertungslisten: beide Reihenfolgen in einem Druck', () => {
  it('je Liste erst nach Startnummer, dann nach Platz; die Gesamtliste hat ihre eigene Wahl', async () => {
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
    expect(wrapper.find('select[data-feld="erg-ordnung"] option[value="beide"]').text()).toBe('beide (erst Startnummer, dann Platz)')
    // Die Gesamtliste folgt nicht mehr der Wahl für die Läufe: Vorgabe bleibt „nach Platz“.
    expect(blaetter()).toEqual(['lauf/nummer', 'lauf/platz', 'gesamt/platz'])
    expect(nummern(0)).toEqual(['401', '402', '403'])
    expect(nummern(1)).toEqual(['402', '403', '401'])
    const gesamt = wrapper.find('select[data-feld="erg-ordnung-gesamt"]')
    expect((gesamt.element as HTMLSelectElement).value).toBe('platz')
    expect(gesamt.findAll('option').map((o) => o.attributes('value'))).toEqual(['platz', 'nummer', 'beide'])
    await gesamt.setValue('beide')
    await nextTick()
    expect(blaetter()).toEqual(['lauf/nummer', 'lauf/platz', 'gesamt/nummer', 'gesamt/platz'])
    expect(nummern(2)).toEqual(['401', '402', '403'])
    expect(nummern(3)).toEqual(['402', '403', '401'])
    expect(wrapper.find('.ergebnis-zahl').text()).toBe('4 Listen')
    await wrapper.find('select[data-feld="erg-ordnung"]').setValue('platz')
    await gesamt.setValue('nummer')
    await nextTick()
    expect(blaetter()).toEqual(['lauf/platz', 'gesamt/nummer'])
    // Jedes Feld steht nur da, wenn es etwas zu ordnen gibt.
    await wrapper.find('select[data-feld="erg-umfang"]').setValue('laeufe')
    await nextTick()
    expect(wrapper.find('select[data-feld="erg-ordnung-gesamt"]').exists()).toBe(false)
    expect(wrapper.find('select[data-feld="erg-ordnung"]').exists()).toBe(true)
    await wrapper.find('select[data-feld="erg-umfang"]').setValue('gesamt')
    await nextTick()
    expect(wrapper.find('select[data-feld="erg-ordnung"]').exists()).toBe(false)
    expect(blaetter()).toEqual(['gesamt/nummer'])
    wrapper.unmount()
  })

  it('eine gemerkte Auswahl aus der Zeit vor dem eigenen Feld: Die Gesamtliste steht nach Platz', async () => {
    sessionStorage.setItem('alcatraz.merke.listen.ergebnis', JSON.stringify({ fassung: 'aushang', umfang: 'alles', ordnung: 'beide', abstand: '' }))
    lade(store)
    zeit(store, 1, 'id-4-1', '80')
    const wrapper = listen(store)
    await art(wrapper, 'ergebnis')
    expect((wrapper.find('select[data-feld="erg-ordnung-gesamt"]').element as HTMLSelectElement).value).toBe('platz')
    expect(wrapper.findAll('.ergebnis-blatt').map((b) => `${b.attributes('data-art')}/${b.attributes('data-ordnung')}`)).toEqual(['lauf/nummer', 'lauf/platz', 'gesamt/platz'])
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

  it('Sprache der Listen: keine Einstellung mehr – sie folgt dem Regelwerk und steht nur zur Auskunft da', async () => {
    const wrapper = einstellungen(store)
    const hinweis = () => wrapper.find('[data-hinweis="listen-sprache"]')
    expect(feld(wrapper, 'listen-sprache').exists()).toBe(false)
    expect(hinweis().attributes('data-sprache')).toBe('de')
    expect(hinweis().text()).toContain('DM 2026: Deutsch')
    expect(hinweis().text()).toContain('keine englischen Texte')
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    expect(hinweis().attributes('data-sprache')).toBe('en')
    expect(hinweis().text()).toContain('UIM 2026: English')
    // Für die Bögen führt ein Verweis zur WKR-Einteilung – sie steht bei der Veranstaltung.
    expect(hinweis().find('a').attributes('href')).toBe('#/veranstaltung?wkr')
    expect(hinweis().find('a').text()).toBe('Veranstaltung → WKR-Einteilung')
    wrapper.unmount()
  })

  it('Sprache der Bögen: in der WKR-Einteilung je Liste und Parcours wählbar, neben dem Namen, mit „alle auf …“ – nur wo das Regelwerk Englisch anbietet', async () => {
    lade(store)
    const wrapper = veranstaltung(store)
    const wahl = (parcours: string, liste: string) => wrapper.find(`#wkr-einteilung select[data-feld="wkr-sprache|${parcours}|${liste}"]`)
    const alle = (sprache: string) => wrapper.find(`#wkr-einteilung button[data-alle-sprache="${sprache}"]`)
    // DM: keine Wahl.
    expect(wrapper.findAll('#wkr-einteilung select').length).toBe(0)
    expect(alle('en').exists()).toBe(false)
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    // Keine eigene Spalte mehr: Jede Zelle mit Namensfeld hat ihre Wahl, gleich daneben.
    expect(wrapper.find('#wkr-einteilung thead').text()).not.toContain('Sprache')
    const zellen = wrapper.findAll('#wkr-einteilung .wkr-zelle')
    expect(zellen.length).toBeGreaterThan(10)
    expect(zellen.every((z) => z.find('input.cell-input').exists() && z.find('select.wkr-sprache-wahl').exists())).toBe(true)
    // Vorgabe ist die Sprache des Regelwerks; kurz beschriftet, der volle Name steht im Titel.
    expect((wahl('par_1', 'steg').element as HTMLSelectElement).value).toBe('en')
    expect(wahl('par_1', 'steg').findAll('option').map((o) => o.attributes('value'))).toEqual(['de', 'en', 'de+en'])
    expect(wahl('par_1', 'steg').findAll('option').map((o) => o.text())).toEqual(['DE', 'EN', 'DE+EN'])
    expect(wahl('par_1', 'steg').attributes('title')).toBe('English')
    expect(wahl('par_1', 'steg').attributes('aria-label')).toBe('Sprache des Bogens Pontoon, Parcours 1')
    expect(alle('en').classes()).toContain('active')
    // „Alle auf …“ steht unter BEIDEN Tabellen – es stellt auch die Racecourses um – und sagt das.
    const leiste = wrapper.find('#wkr-einteilung .wkr-sprache-alle').element
    const parallelTabelle = wrapper.find('#wkr-einteilung [data-tabelle="wkr-parallel"]').element
    expect(parallelTabelle.compareDocumentPosition(leiste) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(wrapper.find('#wkr-einteilung [data-hinweis="wkr-sprache"]').text()).toContain('auch für Racecourse A und B')
    const zeile = (parcours: string, liste: string) => wahl(parcours, liste).element.closest('tr')!.querySelector('th[scope="row"]')!.textContent
    expect(zeile('par_1', 'steg')).toBe('Pontoon')
    await wahl('par_1', 'steg').setValue('de+en')
    // Nur dieser Parcours: Auf Parcours 2 sitzt eine andere Gruppe.
    expect(store.state.value.wkrSprachen).toEqual({ par_1: { steg: 'de+en' } })
    expect((wahl('par_2', 'steg').element as HTMLSelectElement).value).toBe('en')
    expect(wahl('par_1', 'steg').attributes('title')).toBe('Deutsch + English')
    // Die Zeile nennt die Liste in der Sprache des Regelwerks – je Parcours kann der Bogen anders heißen.
    expect(zeile('par_1', 'steg')).toBe('Pontoon')
    expect(alle('en').classes()).not.toContain('active')
    // Was der Vorgabe entspricht, steht nicht im Stand – es folgt weiter dem Regelwerk.
    await wahl('par_1', 'steg').setValue('en')
    expect(store.state.value.wkrSprachen).toEqual({})
    await alle('de').trigger('click')
    // „Alle“ sind alle Zellen beider Disziplinen: je Parcours die Listen des Manövrierens, je
    // Racecourse die des Parallelslaloms (dessen Fahrweg nur dort).
    const felder = wrapper.findAll('#wkr-einteilung select.wkr-sprache-wahl').map((x) => x.attributes('data-feld')!.split('|'))
    expect(felder.some(([, p, l]) => p === 'racecourse-a' && l === 'parallelparcours')).toBe(true)
    const eingetragen = Object.entries(store.state.value.wkrSprachen).flatMap(([p, l]) => Object.entries(l).map(([typeId, s]) => [p, typeId, s]))
    expect(eingetragen.length).toBe(felder.length)
    expect(new Set(eingetragen.map(([, , s]) => s))).toEqual(new Set(['de']))
    expect(alle('de').classes()).toContain('active')
    expect((wahl('racecourse-b', 'zeit').element as HTMLSelectElement).value).toBe('de')
    await alle('en').trigger('click')
    expect(store.state.value.wkrSprachen).toEqual({})
    wrapper.unmount()
  })

  it('Leerzeilen: bei gemeinsamen Bögen der Clubmeisterschaft „je Seite“, sonst „je Klasse“', async () => {
    const wrapper = einstellungen(store)
    const label = (name: string) => wrapper.find(`label[for="${name}"]`)
    expect(feld(wrapper, 'wkr-leerzeilen-seite').exists()).toBe(false)
    expect(label('wkr-leerzeilen').text()).toBe('Leerzeilen je Klasse')
    store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
    await nextTick()
    expect(label('wkr-leerzeilen-seite').text()).toBe('Leerzeilen je Seite')
    expect((feld(wrapper, 'wkr-leerzeilen-seite').element as HTMLInputElement).value).toBe('3')
    // Die Zahl je Klasse bleibt für Bögen, auf denen nur eine Klasse steht.
    expect(label('wkr-leerzeilen').text()).toContain('Bögen mit nur einer Klasse')
    await feld(wrapper, 'wkr-leerzeilen-seite').setValue('5')
    expect(store.state.value.wkrLeerzeilenSeite).toBe(5)
    await feld(wrapper, 'wkr-leerzeilen-seite').setValue('')
    expect(store.state.value.wkrLeerzeilenSeite).toBe(3)
    // Ohne „Papier sparen“ gibt es wieder nur die Zahl je Klasse.
    store.dispatch({ type: 'SET_WKR_CLUB_GEMEINSAM', gemeinsam: false })
    await nextTick()
    expect(feld(wrapper, 'wkr-leerzeilen-seite').exists()).toBe(false)
    expect(label('wkr-leerzeilen').text()).toBe('Leerzeilen je Klasse')
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
    // Die WKR-Einteilung (bei der Veranstaltung) führt die gewählte Liste, die abgewählte nicht mehr.
    const besetzung = veranstaltung(store)
    const zeilen = () => besetzung.findAll('#wkr-einteilung tbody th[scope="row"]').map((th) => th.text())
    expect(zeilen()).toContain('Parcours einfach mit Start und Ziel')
    expect(zeilen()).not.toContain('Knoten')
    await haken(wrapper, 'knoten').setValue(true)
    expect(store.state.value.zusatzListen).toEqual({ parcoursms: true })
    expect(zeilen()).toContain('Knoten')
    besetzung.unmount()
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
    const besetzung = veranstaltung(store)
    const zeilen = besetzung.findAll('#wkr-einteilung tbody th[scope="row"]').map((th) => th.text())
    expect(zeilen).toContain('Tor 5 + Parcours')
    expect(zeilen).not.toContain('Parcours')
    besetzung.unmount()
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
