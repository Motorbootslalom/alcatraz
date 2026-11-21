import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ZuschauerApp from './ZuschauerApp.vue'
import { createLeseStore, leseStoreKey, type LeseStore } from './state/leseStore'
import { STATE_KEY } from './persistenz/storage'
import { reducer } from './state/reducer'
import { refKey } from './betrieb/folge'
import { betriebsStand, betriebStarter, festgeschrieben, uimParallelStand, zeigeNaechsten } from './testHilfen'
import { setLocale } from './i18n'
import { vergissAlles } from './lib/merken'
import type { AppState } from './types'

// Die Zuschauerliste (`#/zuschauer`, Etappe E3): eigene Wurzel mit Nur-Lese-Store, liest nur die Zuschauersicht.
// Alle Starter sind erfunden (Vor<id>/Nach<id>, Musterclub). Parcours 1 fährt e1, k1, e2, k2, e3, k3, e4, k4
// (E und 1 verzahnt), Parcours 2 nur v1 (Klasse 4, nicht begonnen); Startabstände nach einstellungen.yaml:
// E 120 s, Klasse 1 110 s; am Steg 2, vor Steg 2.

const P1 = 'par_1'
const m = (starter: string, lauf = 1) => refKey({ art: 'm', starter, lauf })
/** Wann e1 ins Boot kam (Zeit des Hosts, ms). */
const T0 = 1_000_000

const STARTER = [
  ...[1, 2, 3, 4].flatMap((i) => [
    betriebStarter(`e${i}`, 'E', `E0${i}`, { geburtsdatum: '2014-05-17', gewicht: 31.5, geschlecht: 'F' }),
    betriebStarter(`k${i}`, '1', `10${i}`, { geburtsdatum: '2012-02-03', gewicht: 47.25, geschlecht: 'M' }),
  ]),
  betriebStarter('v1', '4', '401'),
]

/** Lauf 1 auf Parcours 1 begonnen, e1 seit T0 im Boot. */
function imBetrieb(): AppState {
  let s = festgeschrieben(betriebsStand(STARTER))
  s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:1', zeit: T0 - 5000 })
  return zeigeNaechsten(s, P1, T0)
}

let wrapper: VueWrapper | undefined
let lese: LeseStore | undefined

/** Den Stand ablegen, wie ihn das Bedienfenster gespeichert hätte, und das Fenster der Zuschauerliste öffnen. */
async function zuschauer(stand: AppState, jetzt = T0 + 60_000): Promise<VueWrapper> {
  vi.setSystemTime(jetzt)
  localStorage.setItem(STATE_KEY, JSON.stringify(stand))
  lese = createLeseStore()
  wrapper = mount(ZuschauerApp, { attachTo: document.body, global: { provide: { [leseStoreKey as symbol]: lese } } })
  await nextTick()
  return wrapper
}
/** Ein anderes Fenster speichert: neuer Stand, storage-Ereignis. */
async function speichert(stand: AppState) {
  localStorage.setItem(STATE_KEY, JSON.stringify(stand))
  window.dispatchEvent(new StorageEvent('storage', { key: STATE_KEY }))
  await nextTick()
}

const gruppe = (w: VueWrapper, art: string) => w.findAll(`[data-gruppe="${art}"] [data-start]`).map((z) => z.attributes('data-start'))
const zeile = (w: VueWrapper, key: string) => w.find(`[data-start='${key}']`)
const text = (el: { text: () => string }) => el.text().replace(/\s+/g, ' ').trim()

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setLocale('de')
  location.hash = '#/zuschauer'
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  lese?.beende()
  lese = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  location.hash = ''
})

describe('Zuschauerliste', () => {
  it('Im Boot, Am Steg, Vor Steg, Danach – mit „ca. in“ und „zum Vorsteg in“, gerechnet mit der Uhr des Bildschirms', async () => {
    const w = await zuschauer(imBetrieb())
    expect(document.title).toBe('Startfolge – Musterpokal 2026')
    expect(text(w.find('[data-teil="stand"]'))).toBe('1. Lauf läuft')
    const imBoot = w.find('[data-teil="imboot"]')
    expect([imBoot.find('.zuschauer-nr').text(), imBoot.find('.zuschauer-name').text()]).toEqual(['E01', 'Vore1 Nache1'])

    expect(gruppe(w, 'amSteg')).toEqual([m('k1'), m('e2')])
    expect(gruppe(w, 'vorSteg')).toEqual([m('k2'), m('e3')])
    expect(gruppe(w, 'danach')).toEqual([m('k3'), m('e4'), m('k4')])

    // Seit 60 s im Boot: Rest von e1 = 120 − 60 = 60 s; dann je Start der Abstand seiner Klasse.
    const ca = (key: string) => text(zeile(w, key).find('[data-teil="ca"]'))
    expect([m('k1'), m('e2'), m('k2'), m('e3'), m('k3'), m('e4'), m('k4')].map(ca)).toEqual([
      'ca. in 1 min',
      'ca. in 3 min',
      'ca. in 5 min',
      'ca. in 7 min',
      'ca. in 9 min',
      'ca. in 11 min',
      'ca. in 13 min',
    ])
    // Zeit bis zum Vorsteg (amSteg + vorSteg = 4 Stellen davor): nur, wer noch nicht am Steg oder vor Steg ist.
    expect(zeile(w, m('k1')).find('[data-teil="vorsteg"]').exists()).toBe(false)
    expect(zeile(w, m('e3')).find('[data-teil="vorsteg"]').exists()).toBe(false)
    expect(text(zeile(w, m('k3')).find('[data-teil="vorsteg"]'))).toBe('zum Vorsteg in 1 min')
    expect(text(zeile(w, m('k4')).find('[data-teil="vorsteg"]'))).toBe('zum Vorsteg in 5 min')

    // Die Uhr tickt im Bildschirm (alle 5 s), nicht im Stand: Eine Minute später ist k1 gleich dran.
    const vorher = localStorage.getItem(STATE_KEY)
    vi.advanceTimersByTime(60_000)
    await nextTick()
    expect(ca(m('k1'))).toBe('gleich')
    expect(ca(m('e2'))).toBe('ca. in 2 min')
    expect(localStorage.getItem(STATE_KEY)).toBe(vorher)
  })

  it('zeigt nur Startnummer, Name, Herkunft, Klasse, Lauf – nie Geburtsdatum, Gewicht, Geschlecht; Zurückgestellte nicht', async () => {
    let s = imBetrieb()
    s = reducer(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('k1') })
    const w = await zuschauer(s)
    const html = w.html()
    for (const verboten of ['2014', '2012', '17.05.', '31,5', '31.5', '47,25', '47.25']) expect(html, verboten).not.toContain(verboten)
    expect(text(zeile(w, m('e2')))).toContain('Musterclub')
    // Zurückgestellt geht Zuschauer nichts an (BETRIEB_ANNAHMEN.zuschauerSchmal): Er steht nirgends.
    expect(w.find(`[data-start='${m('k1')}']`).exists()).toBe(false)
    expect(html).not.toContain('Vork1')
  })

  it('„Boot fehlt“ ohne Zahl am Ende; Starts eines Laufs, der nicht begonnen hat, gar nicht', async () => {
    let s = imBetrieb()
    s = reducer(s, { type: 'BETRIEB_AUSSETZEN', bereich: P1, klasse: '1', an: true })
    const w = await zuschauer(s)
    expect(gruppe(w, 'bootFehlt')).toEqual([m('k1'), m('k2'), m('k3'), m('k4')])
    expect(zeile(w, m('k1')).find('[data-teil="ca"]').exists()).toBe(false)
    expect(text(w.find('[data-gruppe="bootFehlt"] h3'))).toBe('Boot fehlt')
    // Die übrigen rücken auf: e2 ist der Nächste, ohne den Abstand der fehlenden Klasse.
    expect(gruppe(w, 'amSteg')).toEqual([m('e2'), m('e3')])
    expect(text(zeile(w, m('e3')).find('[data-teil="ca"]'))).toBe('ca. in 3 min')
    // Lauf 2 hat nicht begonnen: Keiner seiner Starts steht auf der Liste.
    expect(w.find(`[data-start='${m('e2', 2)}']`).exists()).toBe(false)
  })

  it('Klassenfilter: blendet aus, die Wartezeiten bleiben; überlebt das Neuladen (sessionStorage)', async () => {
    const w = await zuschauer(imBetrieb())
    expect(w.findAll('[data-teil="filter"] button').map((b) => b.attributes('data-klasse'))).toEqual(['', 'E', '1'])
    await w.find('[data-teil="filter"] [data-klasse="1"]').trigger('click')
    expect([...gruppe(w, 'amSteg'), ...gruppe(w, 'vorSteg'), ...gruppe(w, 'danach')]).toEqual([m('k1'), m('k2'), m('k3'), m('k4')])
    // Die Stelle in der Folge zählt weiter alle Klassen: k2 steht vor Steg und kommt in 5 min.
    expect(gruppe(w, 'vorSteg')).toEqual([m('k2')])
    expect(text(zeile(w, m('k2')).find('[data-teil="ca"]'))).toBe('ca. in 5 min')
    expect(w.find('[data-teil="filter"] [data-klasse="1"]').attributes('aria-pressed')).toBe('true')
    // Bedienauswahl, kein Stand: im Speicher des Fensters, nicht im localStorage.
    expect(sessionStorage.getItem('alcatraz.merke.zuschauer.klasse')).toBe('"1"')
    expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).not.toHaveProperty('zuschauer')

    await w.find('[data-teil="filter"] [data-klasse=""]').trigger('click')
    expect(gruppe(w, 'danach')).toEqual([m('k3'), m('e4'), m('k4')])
  })

  it('Team-Filter (Feldtest 21.11.2026): Herkunft, Mehrfachwahl + „Alle“, mit Klassenfilter UND; dauerhaft gemerkt, nichts im Stand', async () => {
    vergissAlles()
    const s0 = imBetrieb()
    // Zwei erfundene Vereine: k1 und k2 fahren für den „Testverein Nord“, alle übrigen für den Musterclub.
    const s = { ...s0, starters: s0.starters.map((p) => (p.id === 'k1' || p.id === 'k2' ? { ...p, verein: 'Testverein Nord' } : p)) }
    const w = await zuschauer(s)
    const teil = w.find<HTMLDetailsElement>('[data-teil="team-filter"]')
    expect(teil.element.open).toBe(false)
    expect(text(teil.find('[data-teil="team-wahl"]'))).toBe('Alle')
    expect(teil.findAll('button').map((b) => b.attributes('data-team'))).toEqual(['', 'Musterclub', 'Testverein Nord'])
    const offen = () => [...gruppe(w, 'amSteg'), ...gruppe(w, 'vorSteg'), ...gruppe(w, 'danach')]
    const alle = offen()

    await teil.find('[data-team="Testverein Nord"]').trigger('click')
    expect(offen()).toEqual([m('k1'), m('k2')])
    expect(text(w.find('[data-teil="team-wahl"]'))).toBe('1 gewählt')
    // Die Stelle in der Folge zählt weiter alle: k2 kommt wie ohne Filter in 5 min.
    expect(text(zeile(w, m('k2')).find('[data-teil="ca"]'))).toBe('ca. in 5 min')
    // Mehrfachwahl: beide Teams = alle Starts.
    await teil.find('[data-team="Musterclub"]').trigger('click')
    expect(offen()).toEqual(alle)
    expect(text(w.find('[data-teil="team-wahl"]'))).toBe('2 gewählt')
    await teil.find('[data-team="Musterclub"]').trigger('click')
    // Mit dem Klassenfilter E: kein Start des Testvereins übrig – Hinweis statt leerer Liste.
    await w.find('[data-teil="filter"] [data-klasse="E"]').trigger('click')
    expect(offen()).toEqual([])
    expect(w.find('[data-teil="leer"]').text()).toBe('Keine Starts für diese Auswahl.')
    await w.find('[data-teil="filter"] [data-klasse=""]').trigger('click')

    // Gemerkt je Bildschirm im localStorage (übersteht das Schließen des Tabs), nie im Stand der Veranstaltung.
    expect(JSON.parse(localStorage.getItem('alcatraz.merke.zuschauer.teams')!)).toEqual(['Testverein Nord'])
    expect(JSON.parse(localStorage.getItem(STATE_KEY)!)).not.toHaveProperty('zuschauer')
    expect(localStorage.getItem(STATE_KEY)).not.toContain('teams')
    // Neu geöffnet: Wahl steht noch, der Filter ist aufgeklappt.
    wrapper!.unmount()
    lese!.beende()
    const gemerkt = localStorage.getItem('alcatraz.merke.zuschauer.teams')
    vergissAlles()
    localStorage.setItem('alcatraz.merke.zuschauer.teams', gemerkt!)
    const w2 = await zuschauer(s)
    expect(w2.find<HTMLDetailsElement>('[data-teil="team-filter"]').element.open).toBe(true)
    expect([...gruppe(w2, 'amSteg'), ...gruppe(w2, 'vorSteg'), ...gruppe(w2, 'danach')]).toEqual([m('k1'), m('k2')])
    await w2.find('[data-team=""]').trigger('click')
    expect(gruppe(w2, 'danach')).toEqual([m('k3'), m('e4'), m('k4')])
    vergissAlles()
  })

  it('Team-Filter (Prüfbefund 21.11.2026): ein gewähltes Team ohne Starts bleibt gewählt – „Keine Starts“ statt „Alle“, Umschalten kürzt die Wahl nicht', async () => {
    vergissAlles()
    localStorage.setItem('alcatraz.merke.zuschauer.teams', JSON.stringify(['Altverein']))
    const s0 = imBetrieb()
    const s = { ...s0, starters: s0.starters.map((p) => (p.id === 'k1' || p.id === 'k2' ? { ...p, verein: 'Testverein Nord' } : p)) }
    const w = await zuschauer(s)
    const offen = () => [...gruppe(w, 'amSteg'), ...gruppe(w, 'vorSteg'), ...gruppe(w, 'danach')]
    expect(offen()).toEqual([])
    expect(w.find('[data-teil="leer"]').text()).toBe('Keine Starts für diese Auswahl.')
    expect(text(w.find('[data-teil="team-wahl"]'))).toBe('1 gewählt')
    expect(w.find('[data-team="Altverein"] [data-teil="team-ohne-start"]').exists()).toBe(true)
    await w.find('[data-team="Testverein Nord"]').trigger('click')
    expect(offen()).toEqual([m('k1'), m('k2')])
    expect(JSON.parse(localStorage.getItem('alcatraz.merke.zuschauer.teams')!)).toEqual(['Altverein', 'Testverein Nord'])
    await w.find('[data-team="Altverein"]').trigger('click')
    expect(JSON.parse(localStorage.getItem('alcatraz.merke.zuschauer.teams')!)).toEqual(['Testverein Nord'])
    vergissAlles()
  })

  it('Team-Filter: nur eine Herkunft – kein Filter', async () => {
    vergissAlles()
    const w = await zuschauer(imBetrieb())
    expect(w.find('[data-teil="team-filter"]').exists()).toBe(false)
  })

  it('Klassenfilter je Parcours: #/zuschauer/<bereich> bietet nur dessen Klassen an', async () => {
    // Parcours 2 begonnen: v1 (Klasse 4) wartet dort.
    const s = reducer(imBetrieb(), { type: 'BETRIEB_BEGINNEN', bereich: 'par_2', punkt: 'lauf:1' })
    const alle = await zuschauer(s)
    const knoepfe = (w: VueWrapper) => w.findAll('[data-teil="filter"] button').map((b) => b.attributes('data-klasse'))
    expect(knoepfe(alle)).toEqual(['', 'E', '1', '4'])
    // Klasse 4 gewählt, dann nur Parcours 1: Dort fährt sie nicht – kein Knopf, und die Wahl gilt als „alle“.
    await alle.find('[data-teil="filter"] [data-klasse="4"]').trigger('click')
    alle.unmount()
    wrapper = undefined
    lese?.beende()
    location.hash = `#/zuschauer/${P1}`
    const nur = await zuschauer(s)
    expect(knoepfe(nur)).toEqual(['', 'E', '1'])
    expect(nur.find('[data-teil="filter"] [data-klasse=""]').attributes('aria-pressed')).toBe('true')
    expect(nur.find('[data-teil="leer"]').exists()).toBe(false)
    expect(gruppe(nur, 'amSteg')).toEqual([m('k1'), m('e2')])
  })

  it('Pause oder Störung auf der Tafel: Meldung darüber, Gruppen bleiben, aber keine Zahlen (BETRIEB_ANNAHMEN.keineZahlBeiPause)', async () => {
    const s = reducer(imBetrieb(), { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: { text: 'Mittagspause bis 13:30', art: 'pause' } })
    // 20 Minuten später: weitergezählt stünde überall „gleich“.
    const w = await zuschauer(s, T0 + 20 * 60_000)
    expect(text(w.find('[data-teil="meldung"]'))).toBe('Mittagspause bis 13:30')
    expect(gruppe(w, 'amSteg')).toEqual([m('k1'), m('e2')])
    expect(gruppe(w, 'vorSteg')).toEqual([m('k2'), m('e3')])
    expect(gruppe(w, 'danach')).toEqual([m('k3'), m('e4'), m('k4')])
    expect(w.findAll('[data-teil="ca"], [data-teil="vorsteg"]')).toHaveLength(0)
    // Ein Hinweis hält nichts an; ist die Pause weg, rechnet die Liste weiter.
    await speichert(reducer(s, { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: { text: 'Bitte Schwimmweste schließen', art: 'info' } }))
    expect(text(zeile(w, m('k1')).find('[data-teil="ca"]'))).toBe('gleich')
    expect(text(zeile(w, m('k3')).find('[data-teil="vorsteg"]'))).toBe('gleich zum Vorsteg')
  })

  it('folgt dem Bedienfenster (storage-Ereignis) und schreibt nie', async () => {
    const s = imBetrieb()
    const w = await zuschauer(s)
    const setItem = vi.spyOn(localStorage, 'setItem')
    await speichert(zeigeNaechsten(s, P1, T0 + 60_000))
    setItem.mockClear()
    expect(w.find('[data-teil="imboot"] .zuschauer-nr').text()).toBe('101')
    expect(gruppe(w, 'amSteg')).toEqual([m('e2'), m('k2')])
    vi.advanceTimersByTime(30_000)
    await nextTick()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('in der Sprache der Anzeigetafel: unter UIM englisch', async () => {
    const s = reducer(imBetrieb(), { type: 'SET_ANZEIGE', patch: { sprache: 'en' } })
    const w = await zuschauer(s)
    expect(document.title).toBe('Starting order – Musterpokal 2026')
    expect(text(w.find('[data-gruppe="amSteg"] h3'))).toBe('At the pontoon')
    expect(text(w.find('[data-gruppe="vorSteg"] h3'))).toBe('At pontoon entry')
    expect(text(zeile(w, m('k1')).find('[data-teil="ca"]'))).toBe('in about 1 min')
    expect(text(zeile(w, m('k3')).find('[data-teil="vorsteg"]'))).toBe('to pontoon entry in 1 min')
    expect(text(w.find('[data-teil="stand"]'))).toBe('Attempt 1 in progress')
  })

  it('je Parcours ein Abschnitt; #/zuschauer/<bereich> zeigt nur diesen', async () => {
    const w = await zuschauer(imBetrieb())
    expect(w.findAll('.zuschauer-bereich').map((b) => b.attributes('data-bereich'))).toEqual([P1, 'par_2'])
    // Parcours 2 hat noch nicht begonnen: kein Start darauf, nur was als Nächstes kommt.
    expect(text(w.find('[data-bereich="par_2"] [data-teil="stand"]'))).toBe('Als Nächstes: 1. Lauf')
    expect(w.find('[data-bereich="par_2"] [data-start]').exists()).toBe(false)
    w.unmount()
    wrapper = undefined
    lese?.beende()
    location.hash = `#/zuschauer/${P1}`
    const nur = await zuschauer(imBetrieb())
    expect(nur.findAll('.zuschauer-bereich').map((b) => b.attributes('data-bereich'))).toEqual([P1])
  })

  it('Parallelslalom (E4, UIM): je Karte ein Paar mit Racecourse A und B, eine leere Seite „–“; ohne Wartezeit, mit Steg', async () => {
    let s = reducer(uimParallelStand(), { type: 'SET_ANZEIGE', patch: { amSteg: 1, vorSteg: 1 } })
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre' })
    s = reducer(s, { type: 'BETRIEB_ZEIGEN', bereich: 'parallel', ref: refKey({ art: 'p', runde: 'pre', attempt: 1, a: 'E-1', b: 'E-2' }), vorher: null, zeit: T0 })
    location.hash = '#/zuschauer/parallel'
    const w = await zuschauer(s)
    const b = w.find('[data-bereich="parallel"]')
    expect(text(b.find('h2'))).toBe('Parallel slalom')
    expect(text(b.find('[data-teil="stand"]'))).toBe('Preliminary heat in progress')
    expect(text(b.find('[data-teil="ohne-zeit"]'))).toBe('No waiting times in the parallel slalom.')
    const seiten = (el: ReturnType<VueWrapper['find']>) => el.findAll('.zuschauer-seite').map((x) => [x.attributes('data-racecourse'), text(x.find('.zuschauer-rc')), text(x.find('.zuschauer-nr'))])
    expect(seiten(b.find('[data-teil="imboot"]'))).toEqual([
      ['A', 'Racecourse A', 'E01'],
      ['B', 'Racecourse B', 'E02'],
    ])
    // Im Boot mit der Klassenplakette wie die Karten darunter; die Karte hat zwei Teile (Paar, Wartezeit) und eigene
    // Spalten (styles/zuschauer.css `.zuschauer-start.zuschauer-paar`).
    expect(text(b.find('[data-teil="imboot"] .zuschauer-was'))).toBe('Dolphin Preliminary heat · Attempt 1')
    expect(b.find('[data-teil="imboot"] .zuschauer-start').classes()).toContain('zuschauer-paar')
    // Der Hinweis auf die Schätzung der Wartezeiten fehlt, wenn nur der Parallelslalom gezeigt wird – er hat keine.
    expect(w.find('[data-teil="hinweis"]').exists()).toBe(false)
    const amSteg = b.find('[data-gruppe="amSteg"] [data-start]')
    expect(seiten(amSteg)).toEqual([
      ['A', 'Racecourse A', 'E02'],
      ['B', 'Racecourse B', 'E01'],
    ])
    expect(text(amSteg.find('.zuschauer-was'))).toBe('Dolphin Preliminary heat · Attempt 2')
    // Dolphin 3 gegen den Dummy: vor Steg, die leere Seite „–“ ohne Namen; nirgends eine Wartezeit.
    const vorSteg = b.find('[data-gruppe="vorSteg"] [data-start]')
    expect(seiten(vorSteg)).toEqual([
      ['A', 'Racecourse A', 'E03'],
      ['B', 'Racecourse B', '–'],
    ])
    expect(b.findAll('[data-teil="ca"], [data-teil="vorsteg"]')).toHaveLength(0)
    // Klassenfilter: ein Paar zählt für die Klasse seiner Seiten.
    await w.find('[data-teil="filter"] [data-klasse="1"]').trigger('click')
    const gefiltert = w.find('[data-bereich="parallel"]').findAll('[data-gruppe] [data-start]')
    expect(gefiltert.length).toBeGreaterThan(0)
    expect(gefiltert.map((z) => z.find('.class-badge').text())).toEqual(gefiltert.map(() => '1'))
    // Mit den Parcours zusammen steht der Hinweis auf die Wartezeiten wieder da.
    wrapper?.unmount()
    lese?.beende()
    location.hash = '#/zuschauer'
    const alle = await zuschauer(s)
    expect(alle.find('[data-teil="hinweis"]').exists()).toBe(true)
  })
})
