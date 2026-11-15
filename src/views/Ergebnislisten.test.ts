import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { emptyState } from '../state/reducer'
import { laufSchluessel } from '../lib/eingaben'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'
import { wechsleRegelwerk } from '../testHilfen'

/** Erfundene Starter: `n` je Klasse, klassenbasierte Startnummern. */
function starter(klassen: ClassId[], n = 3): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: 'Musterclub',
      bundesland: i === 0 ? 'Bayern' : 'Musterland',
      geburtsdatum: '2014-05-0' + (i + 1),
      groesse: '',
      klasse,
    })),
  )
}

const lauf = (n: number) => laufSchluessel('manoevrieren', n)
const zeit = (store: Store, n: number, id: string, wert: string) => store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: lauf(n), starter: id, feld: 'zeit1', wert }] })
const wert = (store: Store, n: number, id: string, feld: string, w: string) => store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: lauf(n), starter: id, feld, wert: w }] })
const ansicht = (store: Store) => mount(ListsView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
async function ergebnisse(wrapper: VueWrapper) {
  await wrapper.find('.list-kinds button[data-kind="ergebnis"]').trigger('click')
  await nextTick()
}
async function waehle(wrapper: VueWrapper, feld: string, w: string) {
  await wrapper.find(`select[data-feld="erg-${feld}"]`).setValue(w)
  await nextTick()
}
// Klasse | Lauf | Veranstaltung – ohne das Feld „Letzte Änderung“ (dazu ErgebnisStand.test.ts).
const koepfe = (wrapper: VueWrapper) => wrapper.findAll('.ergebnis-blatt .erg-kopf').map((k) => k.findAll('span:not(.erg-stand)').map((s) => s.text()).join(' | '))
const zeilen = (wrapper: VueWrapper, blatt = 0) =>
  wrapper.findAll('.ergebnis-blatt')[blatt].findAll('tbody tr').map((r) => r.findAll('td').map((c) => c.text()))
const spalten = (wrapper: VueWrapper, blatt = 0) => wrapper.findAll('.ergebnis-blatt')[blatt].findAll('.erg-spaltenkopf th').map((t) => t.text().replace(/\s+/g, ' '))

describe('Listen: Wertungslisten', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '4']) })
    // Klasse 4: drei Läufe; 401 holt den 2. Lauf noch nach, 402 ist im 2. Lauf nicht gestartet.
    for (const [id, zeiten] of Object.entries({ 'id-4-1': ['70', '', '72'], 'id-4-2': ['80', '', '81'], 'id-4-3': ['75', '76', '90'] })) {
      zeiten.forEach((z, i) => z && zeit(store, i + 1, id, z))
    }
    wert(store, 2, 'id-4-2', 'disq@vorsteg', 'X')
    wert(store, 1, 'id-4-3', 't1a|hin seiteA', '5')
    wert(store, 1, 'id-4-3', 'katalog:stegAnlegen', '9')
    // Klasse 1: nur der 1. Lauf.
    zeit(store, 1, 'id-1-1', '66')
    zeit(store, 1, 'id-1-2', '65')
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('ist eine eigene Listenart; je Klasse jeder Lauf mit Eingaben und die Gesamtliste', async () => {
    const wrapper = ansicht(store)
    expect(wrapper.find('.list-kinds button[data-kind="ergebnis"]').text()).toBe('Wertungslisten')
    await ergebnisse(wrapper)
    expect(koepfe(wrapper)).toEqual([
      'Klasse 1 | 1. Lauf | Hafenpokal 2026',
      'Klasse 1 | Gesamt | Hafenpokal 2026',
      'Klasse 4 | 1. Lauf | Hafenpokal 2026',
      'Klasse 4 | 2. Lauf | Hafenpokal 2026',
      'Klasse 4 | 3. Lauf | Hafenpokal 2026',
      'Klasse 4 | Gesamt | Hafenpokal 2026',
    ])
    expect(wrapper.find('.ergebnis-zahl').text()).toBe('6 Listen')
    expect(wrapper.find('button.primary').attributes('disabled')).toBeUndefined()
    // Die anderen Listen stehen nicht daneben.
    expect(wrapper.find('.sheet').exists()).toBe(false)
    expect(wrapper.find('.bogen').exists()).toBe(false)
    wrapper.unmount()
  })

  it('ohne Eingaben: Hinweis mit dem Weg zur Erfassung, nichts zu drucken', async () => {
    store.dispatch({ type: 'CLEAR_EINGABEN' })
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    expect(wrapper.findAll('.ergebnis-blatt')).toHaveLength(0)
    expect(wrapper.find('.panel.empty').text()).toContain('Noch keine Eingaben')
    expect(wrapper.find('.panel.empty a').attributes('href')).toBe('#/erfassung')
    expect(wrapper.find('button.primary').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('Laufliste: Spalten des Fahrwegs, Punkte an Tor und Boje, Herkunft als Kürzel, nie ein Geburtsdatum', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'lauf', '1')
    expect(koepfe(wrapper)).toEqual(['Klasse 4 | 1. Lauf | Hafenpokal 2026'])
    const kopf = spalten(wrapper)
    // Das Geburtsdatum steht nur – wahlweise – auf der Starterliste, nie auf einer Wertungsliste.
    expect(kopf.slice(0, 7)).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Verein', 'Zeit', 'Punkte'])
    expect(kopf).not.toContain('Geb. Datum')
    expect(kopf.slice(7)).toEqual(['Steg AB', 'Start', '1 H', '2 H', '3 H', '4 H', '5', '4 R', '3 R', '2 R', 'MüB', 'Ziel', 'Steg AN', 'disq.', 'ges. Punkte', 'Fehler-Schlüssel'])
    // Start und Ziel mit L und R wie die Tore (Entscheidung des Nutzers vom 15.11.2026): Die erste
    // Unter-Spalte jeder Gruppe trägt die kräftige Linie, L und R stehen in eigenen Zellen.
    const unter = wrapper.findAll('.ergebnis-blatt')[0].findAll('.erg-unterkopf th')
    expect(unter.slice(0, 4).map((th) => [th.text(), th.classes('erg-gruppe')])).toEqual([['L', true], ['R', false], ['L', true], ['R', false]])
    expect(unter.slice(-2).map((th) => [th.text(), th.classes('erg-gruppe')])).toEqual([['L', true], ['R', false]])
    const z = zeilen(wrapper)
    expect(z.map((r) => r.slice(0, 4).join(' '))).toEqual(['1 401 Nach41 Vor41', '2 402 Nach42 Vor42', '3 403 Nach43 Vor43'])
    expect(z[0].slice(4, 7)).toEqual(['Musterclub', '01:10,00', '70,00'])
    // 403: 75 s + 5 (Boje Tor 1 hin) + 10 (Steg AN, Code 9) = 90,00 – und jede Strafe steht in ihrer Spalte.
    expect(z[2].at(-2)).toBe('90,00')
    expect(z[2].at(-1)).toBe('9')
    expect(z[2].filter((c) => c === '5')).toHaveLength(1)
    expect(z[2].filter((c) => c === '10')).toHaveLength(1)
    // Jede fünfte Zeile wäre grau; hier sind es drei.
    expect(wrapper.findAll('.ergebnis-blatt tbody tr.grau')).toHaveLength(0)

    // Bundesland mit ISO-Kürzel.
    store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'bundesland' })
    await nextTick()
    expect(spalten(wrapper).slice(0, 7)).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Bundesland', 'Zeit', 'Punkte'])
    expect(zeilen(wrapper).map((r) => r[4])).toEqual(['BY', 'Musterland', 'Musterland'])
    // Länder auch unter der DM mit dem Kürzel des IOC (Entscheidung des Nutzers vom 15.11.2026):
    // „Deutschland“ und „DEU“ werden zu GER, die Schweiz zu SUI.
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-4-1', patch: { land: 'Deutschland' } })
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-4-2', patch: { land: 'DEU' } })
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-4-3', patch: { land: 'Schweiz' } })
    store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
    await nextTick()
    expect(zeilen(wrapper).map((r) => r[4])).toEqual(['GER', 'GER', 'SUI'])
    // Clubmeisterschaft: keine Herkunft.
    store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
    await nextTick()
    expect(spalten(wrapper).slice(0, 6)).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Zeit', 'Punkte'])
    wrapper.unmount()
  })

  it('noch nicht gefahren steht ohne Zeit auf Platz 1, nicht gestartet (x) hinten', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'lauf', '2')
    const reihen = wrapper.findAll('.ergebnis-blatt tbody tr')
    expect(reihen.map((r) => `${r.attributes('data-wertung')}:${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()}`)).toEqual(['offen:1 401', 'gewertet:2 403', 'disq:3 402'])
    const z = zeilen(wrapper)
    expect(z[0].slice(6, 8)).toEqual(['', '']) // keine Zeit
    expect(z[0].at(-2)).toBe('')
    expect(z[2].slice(-3)).toEqual(['x', 'disq.', 'X'])
    // Das x steht ausgeschrieben da, wo sonst Zeit und Punkte stünden – nicht nur als Schlüssel „X“.
    expect(reihen[2].find('td.erg-dns').text()).toBe('Nicht gestartet')
    expect(reihen[2].find('td.erg-dns').attributes('colspan')).toBe('2')
    expect(reihen[0].find('td.erg-dns').exists()).toBe(false) // „noch nicht gefahren“ bleibt leer
    expect(reihen[2].find('.erg-disq').exists()).toBe(true)
    wrapper.unmount()
  })

  it('Gesamtliste: Läufe nebeneinander, Gestrichenes durchgestrichen, offen auf Platz 1; Reihenfolge und Abstand wählbar', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'umfang', 'gesamt')
    expect(koepfe(wrapper)).toEqual(['Klasse 4 | Gesamt | Hafenpokal 2026'])
    // Kein Lauf-Wähler bei „nur Gesamtliste“.
    expect(wrapper.find('select[data-feld="erg-lauf"]').exists()).toBe(false)
    const kopf = spalten(wrapper)
    // Die Knoten gehören nach den Regeln zu jedem Aufbau – auch zu Alcatraz, das sie nicht selbst nennt.
    expect(kopf).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Verein', '1. Lauf', '2. Lauf', '3. Lauf', 'Ergebnis', 'Knoten', 'Gesamt'])
    const reihen = () => wrapper.findAll('.ergebnis-blatt tbody tr')
    const kurz = () => reihen().map((r) => `${r.attributes('data-wertung')}:${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()} ${r.findAll('td').at(-1)!.text()}`.trim())
    // 401 holt Lauf 2 nach → Platz 1 ohne Ergebnis. 402: x gestrichen → 80 + 81. 403: 90 + 76, der schlechteste (90, Lauf 1 oder 3) gestrichen.
    expect(kurz()).toEqual(['offen:1 401', 'gewertet:2 402 161,00', 'gewertet:3 403 166,00'])
    const gestrichen = (i: number) => reihen()[i].findAll('td.erg-gestrichen').map((c) => c.text())
    expect(gestrichen(0)).toEqual([])
    // Der nicht gestartete Lauf: ausgeschrieben über Zeit, Strafpunkte und Gesamt, gestrichen wie jede Disqualifikation.
    expect(gestrichen(1)).toEqual(['Nicht gestartet'])
    expect(reihen()[1].find('td.erg-dns').classes()).toContain('erg-disq')
    expect(gestrichen(2)).toEqual(['01:15,00', '15', '90,00'])

    // Die Gesamtliste hat ihre eigene Reihenfolge; die der Läufe steht bei „nur Gesamtliste“ nicht da.
    expect(wrapper.find('select[data-feld="erg-ordnung"]').exists()).toBe(false)
    await waehle(wrapper, 'ordnung-gesamt', 'nummer')
    expect(kurz().map((k) => k.split(' ')[1])).toEqual(['401', '402', '403'])
    await waehle(wrapper, 'abstand', 'erster')
    expect(spalten(wrapper).at(-1)).toBe('Abstandzum 1. Platz') // im Kopf zweizeilig (<br>)
    expect(reihen().map((r) => r.findAll('td').at(-1)!.text())).toEqual(['', '', '+5,00'])
    wrapper.unmount()
  })

  it('Punktgleichheit: Der Stichentscheid des Regelwerks trennt, die Zeile ist gekennzeichnet, der Hinweis nennt die Regel', async () => {
    // Klasse 1, 1. Lauf: 101 = 66 s, 102 = 65 s, 103 = 60 s + 5 Strafpunkte = 65 Punkte.
    zeit(store, 1, 'id-1-3', '60')
    wert(store, 1, 'id-1-3', 't1a|hin seiteA', '5')
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '1')
    await waehle(wrapper, 'lauf', '1')
    const reihen = () => wrapper.findAll('.ergebnis-blatt tbody tr').map((r) => `${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()}${r.attributes('data-stich') !== undefined ? ' *' : ''}`)
    // DM: Der schnellere Lauf steht vorn – die Zeit steht in derselben Zeile. Am Platz steht
    // ein Sternchen (auch im Druck), die Zeile trägt `data-stich`.
    expect(reihen()).toEqual(['1* 103 *', '2* 102 *', '3 101'])
    expect(wrapper.find('[data-hinweis="stich"]').text()).toBe(
      'Bei gleichen Punkten steht vorn, wer den schnelleren gewerteten Lauf hat (gefahrene Zeit ohne Strafpunkte). Trennt auch das nicht, teilen sich die Starter den Platz.',
    )
    // Unter der Tabelle erklärt eine Zeile das Sternchen – mit der Regel in Worten; sie gehört zum Blatt.
    const erklaerung = () => wrapper.findAll('.ergebnis-blatt .erg-fuss .erg-stich-hinweis').map((p) => p.text())
    expect(erklaerung()).toEqual(['* Platz durch Stichentscheid. Bei gleichen Punkten steht vorn, wer den schnelleren gewerteten Lauf hat (gefahrene Zeit ohne Strafpunkte).'])
    expect(wrapper.find('.erg-stich-hinweis').classes()).not.toContain('no-print')
    // Nur auf Listen, auf denen ein solcher Platz vorkommt: Klasse 4 hat im 1. Lauf keinen.
    await waehle(wrapper, 'klasse', '')
    const jeBlatt = wrapper.findAll('.ergebnis-blatt').map((b) => [b.find('.erg-kopf-klasse').text(), b.findAll('.erg-platz .erg-stich-zeichen').length, b.find('.erg-stich-hinweis').exists()])
    expect(jeBlatt).toEqual([
      ['Klasse 1', 2, true],
      ['Klasse 4', 0, false],
    ])
    await waehle(wrapper, 'klasse', '1')
    // UIM: Für den einzelnen Versuch gibt es keinen Stichentscheid – geteilter Platz, kein Zeichen, keine Erklärung.
    wechsleRegelwerk(store, 'uim-2026')
    await nextTick()
    expect(reihen()).toEqual(['1 102', '1 103', '3 101'])
    expect(erklaerung()).toEqual([])
    expect(wrapper.find('[data-hinweis="stich"]').text()).toContain('Summe aller Läufe')
    setLocale('en')
    await nextTick()
    expect(wrapper.find('[data-hinweis="stich"]').text()).toBe(
      'Same time in the best attempt (including knots and driving penalties): the driver with the better added attempt time (including penalties for both attempts) is ranked higher; a driver with only one valid attempt is ranked lower. If that does not define a winner either, there is a dead-heat result: the drivers share the place.',
    )
    wrapper.unmount()
  })

  it('Stichentscheid in der Gesamtliste: Sternchen und Erklärung in der Sprache der Liste (UIM englisch)', async () => {
    // Klasse 1 nach UIM, zwei Läufe, der bessere zählt: 101 und 102 haben beide 65 als besten
    // Lauf; die Summe aller Läufe (101: 65 + 70, 102: 65 + 80) entscheidet.
    const neu = createStore()
    neu.dispatch({ type: 'LOAD_STATE', state: { ...emptyState(), kennung: 'K7Q4', eventName: 'Hafenpokal', regelwerk: 'uim-2026', laufCount: 2, streichlaeufe: 1, starters: starter(['1']) } })
    for (const [id, lauf, sek] of [['id-1-1', 1, '65'], ['id-1-1', 2, '70'], ['id-1-2', 1, '80'], ['id-1-2', 2, '65'], ['id-1-3', 1, '90'], ['id-1-3', 2, '91']] as const) zeit(neu, lauf, id, sek)
    const wrapper = ansicht(neu)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'umfang', 'gesamt')
    const blatt = wrapper.find('.ergebnis-blatt[data-art="gesamt"]')
    expect(blatt.findAll('tbody tr').map((r) => `${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()}`)).toEqual(['1* 101', '2* 102', '3 103'])
    expect(blatt.find('.erg-fuss .erg-stich-hinweis').text()).toBe(
      '* Ranking decided by the dead-heat rule. Same time in the best attempt (including knots and driving penalties): the driver with the better added attempt time (including penalties for both attempts) is ranked higher; a driver with only one valid attempt is ranked lower.',
    )
    wrapper.unmount()
  })

  it('die Streichläufe aus den Einstellungen wirken sofort', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'umfang', 'gesamt')
    expect(wrapper.find('.ergebnis-wahl').text()).toContain('3 Läufe, 1 Streichlauf.')
    store.dispatch({ type: 'SET_STREICHLAEUFE', streichlaeufe: 0 })
    await nextTick()
    expect(wrapper.find('.ergebnis-wahl').text()).toContain('3 Läufe, 0 Streichläufe.')
    // Ohne Streichlauf zählt das x von 402: letzter Platz.
    const letzte = wrapper.findAll('.ergebnis-blatt tbody tr').at(-1)!
    expect(letzte.attributes('data-wertung')).toBe('disq')
    expect(letzte.findAll('td')[1].text()).toBe('402')
    wrapper.unmount()
  })

  it('Drucken: Fenstertitel in der Sprache der Oberfläche, die Liste in der des Regelwerks; im Seitenrand steht nichts', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'lauf', '2')
    await wrapper.find('button.primary').trigger('click')
    expect(print).toHaveBeenCalledOnce()
    expect(document.title).toMatch(/^Wertungslisten - Klasse 4 - 2\. Lauf - Hafenpokal 2026 - \d{4}-\d\d-\d\d_\d{4}$/)
    await waehle(wrapper, 'lauf', '')
    await waehle(wrapper, 'klasse', '')
    await wrapper.find('button.primary').trigger('click')
    expect(document.title).toMatch(/^Wertungslisten - alle Klassen - Lauf 1, 2, 3 - Gesamt - Hafenpokal 2026 - /)
    // Im Seitenrand steht nichts: Die Ansicht erzeugt kein Stylesheet mehr, also auch keine
    // Randbox mit dem Druckzeitpunkt. Eine Seitenzahl schreibt die Liste selbst aufs Blatt,
    // wenn sie mehr als eine Seite hat – hier hat keine eine.
    expect(wrapper.find('style').exists()).toBe(false)
    expect(wrapper.find('.listen-seitenzahl').exists()).toBe(false)
    expect(wrapper.find('.ergebnis-stapel').text()).not.toMatch(/Seite \d/)

    setLocale('en')
    await nextTick()
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'umfang', 'gesamt')
    await wrapper.find('button.primary').trigger('click')
    // Der Fenstertitel ist Bedienung (englisch); die Liste bleibt nach den DM-Regeln deutsch.
    expect(document.title).toMatch(/^Results - Class 4 - Overall - Hafenpokal 2026 - /)
    expect(koepfe(wrapper)).toEqual(['Klasse 4 | Gesamt | Hafenpokal 2026'])
    expect(spalten(wrapper).slice(0, 6)).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Verein', '1. Lauf'])
    expect(zeilen(wrapper)[1].at(-1)).toBe('161,00')
    expect(wrapper.findAll('td.erg-disq').map((c) => c.text())).toEqual(['Nicht gestartet'])
    // Nach den UIM-Regeln ist sie englisch – auch bei deutscher Oberfläche: Dezimalpunkt, „DSQ“.
    setLocale('de')
    wechsleRegelwerk(store, 'uim-2026')
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 3 } })
    store.dispatch({ type: 'SET_STREICHLAEUFE', streichlaeufe: 1 })
    await nextTick()
    expect(koepfe(wrapper)).toEqual(['Class 4 | Overall | Hafenpokal 2026'])
    expect(spalten(wrapper).slice(0, 6)).toEqual(['Rank.', 'No.', 'Surname', 'First name', 'Club', 'Attempt 1'])
    // Unter UIM folgt dem Gesamtergebnis die Spalte „UIM points“ (Regel 960, Pkt. 5.2.1) – leer,
    // solange die Klasse nicht vollständig ist (401 holt den 2. Versuch noch nach).
    expect(spalten(wrapper).at(-1)).toBe('UIM points')
    const z = zeilen(wrapper)
    expect(z[1].slice(-2)).toEqual(['161.00', ''])
    expect(wrapper.findAll('td.erg-disq').map((c) => c.text())).toEqual(['Did not start'])
    // Ohne Streichlauf zählt der nicht gestartete Lauf: insgesamt „DSQ“ – einmal, denn die Spalte
    // „Result“ (bester Versuch ohne Knoten) hat die UIM-Gesamtliste nicht.
    store.dispatch({ type: 'SET_STREICHLAEUFE', streichlaeufe: 0 })
    await nextTick()
    expect(wrapper.findAll('td.erg-disq').map((c) => c.text())).toEqual(['Did not start', 'DSQ'])
    expect(spalten(wrapper)).not.toContain('Result')
    // Auch englisch: nichts im Seitenrand, keine Seitenzahl bei einer Seite.
    expect(wrapper.find('style').exists()).toBe(false)
    expect(wrapper.find('.ergebnis-stapel').text()).not.toMatch(/Page \d/)
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('Klasse 7 mit ausgeschriebenem Vereinsnamen: Die Bojen-Spalten behalten ihre Breite, „20“ steht kleiner statt abgeschnitten', async () => {
    // Mit erfassten Werten steht das Starterfeld fest – die Klasse 7 kommt deshalb mit einem geladenen Stand dazu.
    store.dispatch({ type: 'LOAD_STATE', state: { ...store.state.value, starters: [...store.state.value.starters, ...starter(['7']).map((p) => ({ ...p, verein: 'Beispielverein Süd am See' }))] } })
    zeit(store, 1, 'id-7-1', '80')
    wert(store, 1, 'id-7-1', 't5|hin seiteA', '20')
    store.dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { herkunft: 'lang' } })
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '7')
    await waehle(wrapper, 'lauf', '1')
    await waehle(wrapper, 'abstand', 'davor')
    const blatt = wrapper.find('.ergebnis-blatt[data-art="lauf"]')
    // Die Bojen haben Vorrang: Die Herkunft fällt auf ihre Mindestbreite (und steht dafür kleiner),
    // die Bojen-Spalten sind so breit wie mit Kürzel – 3,7 mm, darin steht „20“ eine Stufe kleiner.
    const herkunftMm = () => parseFloat((wrapper.find('.ergebnis-blatt[data-art="lauf"] col.erg-w-herkunft').element as HTMLElement).style.width)
    const bojeMm = () => Number(wrapper.find('.ergebnis-blatt[data-art="lauf"]').attributes('data-boje-mm'))
    expect(herkunftMm()).toBe(11)
    expect(bojeMm()).toBeGreaterThanOrEqual(3.7)
    const mitName = bojeMm()
    const zwanzig = blatt.find('tbody tr[data-starter="id-7-1"]').findAll('td').filter((c) => c.text() === '20')
    expect(zwanzig).toHaveLength(1)
    expect(zwanzig[0].classes()).toContain('fit-1')
    // Mit Kürzel ist Platz: Die Herkunft ist schmal, die Bojen-Spalten sind breiter.
    store.dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { herkunft: 'kurz' } })
    store.dispatch({ type: 'SET_ORIGIN_SHORT', name: 'Beispielverein Süd am See', short: 'BSS' })
    await nextTick()
    expect(bojeMm()).toBe(mitName)
    // Ohne Abstand-Spalte bleibt mehr: Dann bekommt auch die Herkunft wieder Platz.
    store.dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { herkunft: 'lang' } })
    await waehle(wrapper, 'abstand', '')
    expect(bojeMm()).toBeGreaterThanOrEqual(4)
    expect(herkunftMm()).toBeGreaterThan(11)
    wrapper.unmount()
  })

  it('Werte, die keine Liste mehr zeigt (weniger Läufe), sind gemeldet und lassen sich entfernen', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    expect(wrapper.find('[data-hinweis="verborgene-eingaben"]').exists()).toBe(false)
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 2 } })
    await nextTick()
    const hinweis = wrapper.find('[data-hinweis="verborgene-eingaben"]')
    // Lauf 3 der Klasse 4: drei Zeiten von drei Startern.
    expect(hinweis.text()).toContain('Für 3 Starter stehen 3 erfasste Werte im Stand')
    const confirm = vi.fn(() => true)
    vi.stubGlobal('confirm', confirm)
    await hinweis.find('button[data-action="verborgene-entfernen"]').trigger('click')
    vi.unstubAllGlobals()
    expect(confirm).toHaveBeenCalledOnce()
    expect(Object.keys(store.state.value.eingaben).sort()).toEqual([lauf(1), lauf(2)])
    expect(wrapper.find('[data-hinweis="verborgene-eingaben"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('fehlende Startnummern halten die Wertungslisten nicht auf', async () => {
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-1-3', patch: { startNr: '' } })
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    expect(wrapper.findAll('.ergebnis-blatt').length).toBeGreaterThan(0)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('button.primary').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('Fassungen: Aushang mit gekürztem Nachnamen oder ohne Namen, Herkunft nach Einstellung; Intern immer mit vollem Namen', async () => {
    const wrapper = ansicht(store)
    await ergebnisse(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'lauf', '1')
    // Vorgabe: Aushang mit vollem Namen und Herkunft.
    expect(wrapper.find('button[data-fassung="aushang"]').classes()).toContain('active')
    expect(spalten(wrapper).slice(0, 5)).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Verein'])
    store.dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { namen: 'kurz', herkunft: 'aus' } })
    await nextTick()
    expect(spalten(wrapper).slice(0, 5)).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Zeit'])
    expect(zeilen(wrapper)[0].slice(0, 4)).toEqual(['1', '401', 'N.', 'Vor41'])
    store.dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'aushang', patch: { namen: 'ohne' } })
    await nextTick()
    expect(spalten(wrapper).slice(0, 3)).toEqual(['Platz', 'S-Nr.', 'Zeit'])
    expect(zeilen(wrapper)[0].slice(0, 2)).toEqual(['1', '401'])
    // Intern: voller Name, eigene Einstellung für die Herkunft.
    await wrapper.find('button[data-fassung="intern"]').trigger('click')
    expect(spalten(wrapper).slice(0, 5)).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Verein'])
    expect(zeilen(wrapper)[0].slice(2, 4)).toEqual(['Nach41', 'Vor41'])
    store.dispatch({ type: 'SET_ERGEBNIS_LISTEN', fassung: 'intern', patch: { herkunft: 'aus' } })
    await nextTick()
    expect(spalten(wrapper).slice(0, 5)).toEqual(['Platz', 'S-Nr.', 'Name', 'Vorname', 'Zeit'])
    wrapper.unmount()
  })

})
