import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import ErfassungView from './ErfassungView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { reducer } from '../state/reducer'
import { setLocale } from '../i18n'
import { vergissAlles } from '../lib/merken'
import { configFor } from '../config/konfig'
import { listenFelder, werteVon } from '../lib/eingaben'
import { geraeteHostKey, type GeraeteHost, type RaumInfo } from '../geraete/host'
import type { WkrEingang, WkrHerkunft } from '../geraete/wkrEingang'
import { listenKennung, teilVonZelle, type Liste } from '../wkr/liste'
import { pruefeZeile } from '../wkr/zeile'
import { betriebStarter, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import type { AppState } from '../types'

/**
 * Erfassung mit digitaler WKR-Erfassung (W2.3, Plan docs/plan-wkr-w2.md §6.2/§7 Scheibe 3): ◆ an Zellen mit Gerätewert
 * (Titel Liste · Gerät · Uhrzeit, nie mm/dd; weg, sobald der Wert anders ist), X vom Gerät gerahmt (F5), „Papier
 * ansehen“ an Zeile und – am Steg – an den Zellen des fehlenden Teils, Rückfrage mit Verweis auf Betrieb → WKR,
 * Nachfrage vor dem Überschreiben eines Gerätewerts (Vorrang 3, A7: einmal je Fokus), ohne Host nichts davon.
 * Erfundene Starter und Gerätenamen (testHilfen: Vor<id>/Nach<id>, Musterclub).
 */

const DM = configFor({ regelwerk: 'dm-2026' })
const KENNUNG = 'MUSTERW23'
const P1 = 'par_1'
const LAUF = 'manoevrieren/1'
const FELD = 't1a|hin seiteA'
const L = (typeId: string): Liste => ({ bereich: P1, typeId, racecourse: null })
const K = (typeId: string) => listenKennung(L(typeId))
const TOR = K('gate135')
const UM_1042 = new Date(2026, 10, 21, 10, 42).getTime()

let store: Store
const wrappers: VueWrapper[] = []

beforeEach(() => {
  localStorage.clear()
  vergissAlles()
  setLocale('de')
  store = createStore()
})

afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  store.beende()
  vi.restoreAllMocks()
  setLocale('de')
  document.body.innerHTML = ''
})

/** Klasse-1-Starter auf Parcours 1; `typeId` digital ab 100, drei Starts gezeigt. */
function stand(typeId = 'gate135', gezeigt = 3): AppState {
  const starter = Array.from({ length: 6 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))
  let s: AppState = { ...wkrBetriebsStand(starter), kennung: KENNUNG }
  s = reducer(s, { type: 'WKR_LISTE', liste: K(typeId), modus: 'digital', zeit: 100 })
  for (let i = 0; i < gezeigt; i++) s = zeigeNaechsten(s, P1, 1000 + i * 100)
  return s
}
const keysVon = (s: AppState) => s.betrieb.bereiche[P1].gezeigt.map((g) => g.ref)
const starterVon = (key: string) => JSON.parse(key)[1] as string

/** Eine Zeile vom Gerät wie beim Host (pruefeZeile → WKR_ZEILEN). */
function zeile(s: AppState, key: string, c: [string, string, string][]): AppState {
  const r = pruefeZeile(s, DM, L('gate135'), undefined, 'gNord', { z: 1, s: key, c })
  if ('fehler' in r) throw new Error(r.fehler)
  return reducer(s, { type: 'WKR_ZEILEN', liste: TOR, quelle: { geraet: 'gNord', name: 'Handy Nord' }, zeilen: [r], zeit: 5000 })
}

/** Ein Host-Doppel mit einem Gerät für gate135 und der Herkunft `zellen`. */
function hostDoppel(zellen: WkrHerkunft['zellen'] = {}): GeraeteHost {
  const raum = shallowRef<RaumInfo | null>({
    server: 'https://ntfy.example.org', anzeige: 'a', zuschauer: 'z', fingerabdruck: 'abcd', koppelLink: 'k', koppeln: { code: null, qr: null },
    geraete: [{ id: 'gNord', name: 'Handy Nord', aufgaben: [{ art: 'liste', liste: TOR }], seit: 1, zuletzt: Date.now() - 10_000 }], entzogen: [],
  })
  return {
    raum,
    fuehrt: shallowRef(true),
    verbindung: shallowRef(null),
    oeffne: () => raum.value!,
    erneuereZuschauer: () => {},
    beende: async () => 'gemeldet' as const,
    gibCode: () => {},
    oeffneQr: () => {},
    beendeKoppeln: () => {},
    setzeAufgaben: () => {},
    benenne: () => {},
    setzeTyp: () => {},
    entziehe: () => {},
    hinweis: () => {},
    merkeEntscheid: () => {},
    ladeAlleNeu: () => 'gesendet' as const,
    neueFassung: shallowRef(false),
    fassungGesehen: () => {},
    kontingent: shallowRef({ tag: '2026-11-21', gesendet: 0, anfragen: 0, gedrosselt: null }),
    herkunft: shallowRef<WkrHerkunft>({ kennung: KENNUNG, zellen }),
    eingang: shallowRef<WkrEingang>({ kennung: KENNUNG, n: 0, geraete: {} }),
    stop: () => {},
  } satisfies GeraeteHost
}

const herkunft = (starter: string, feld: string, w: string, l = TOR) => ({ [`${LAUF}|${starter}|${feld}`]: { g: 'Handy Nord', l, z: UM_1042, w } })

async function erfassung(s: AppState, host: GeraeteHost | null, liste = 'gate135'): Promise<VueWrapper> {
  store.dispatch({ type: 'LOAD_STATE', state: s })
  const w = mount(ErfassungView, { attachTo: document.body, global: { provide: { [storeKey as symbol]: store, [geraeteHostKey as symbol]: host } } })
  wrappers.push(w)
  await nextTick()
  await w.find('select[data-feld="erf-liste"]').setValue(liste)
  await nextTick()
  return w
}

const reihe = (w: VueWrapper, starter: string) => w.find(`.erf-tabelle tr[data-zeile="${starter}"]`)
/** Das Eingabefeld der Zelle mit ◆ in dieser Zeile. */
const rautenFeld = (w: VueWrapper, starter: string) => reihe(w, starter).find('td.erf-zelle--geraet input') as DOMWrapper<HTMLInputElement>
const markiert = (w: VueWrapper, marke: string) => w.findAll(`.erf-tabelle tr[data-wkr-marke="${marke}"]`).map((r) => r.attributes('data-zeile'))

describe('Erfassung: ◆ Wert vom Gerät', () => {
  it('◆ an der Zelle mit Titel Liste · Gerät · Uhrzeit (kein mm/dd); weg, sobald der Wert anders ist', async () => {
    let s = stand()
    const st = starterVon(keysVon(s)[0])
    s = zeile(s, keysVon(s)[0], [[FELD, '5', '']])
    const w = await erfassung(s, hostDoppel(herkunft(st, FELD, '5')))
    const rauten = w.findAll('[data-raute]')
    expect(rauten).toHaveLength(1)
    expect(reihe(w, st).find('[data-raute]').exists()).toBe(true)
    const titel = rauten[0].attributes('title')!
    expect(titel).toMatch(/^Wert vom Gerät: .+ · Handy Nord · (\d\d\.\d\d\. )?10:42$/)
    expect(titel).not.toMatch(/\d\d\/\d\d/)
    expect(rautenFeld(w, st).element.value).toBe('5')
    // Der Bediener (oder ein anderes Fenster) ändert den Wert: ◆ gilt nicht mehr.
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: st, feld: FELD, wert: '10' }] })
    await nextTick()
    expect(w.find('[data-raute]').exists()).toBe(false)
    // … und gleich wieder (derselbe Wert wie vom Gerät): ◆ zurück – v-memo hält die Zeile nicht fest.
    store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: st, feld: FELD, wert: '5' }] })
    await nextTick()
    expect(reihe(w, st).find('[data-raute]').exists()).toBe(true)
  })

  it('X vom Gerät am Steg: zusätzlich gerahmt, im Titel genannt (F5)', async () => {
    let s = stand('steg')
    const st = starterVon(keysVon(s)[0])
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: st, feld: 'disq@steg', wert: 'X' }] })
    const w = await erfassung(s, hostDoppel(herkunft(st, 'disq@steg', 'X', K('steg'))), 'steg')
    const zelle = reihe(w, st).find('td.erf-zelle--x-geraet')
    expect(zelle.exists()).toBe(true)
    expect(zelle.find('[data-raute]').attributes('title')).toContain('kam vom Gerät')
  })
})

describe('Erfassung: „Papier ansehen“ und Rückfrage', () => {
  it('gerade gezeigt: keine Marke; „Papier ab“ (meldet die Liste ab, A10): ▭ an jeder offenen Zeile, Kopfzeile mit Zahl', async () => {
    let s = stand()
    const keys = keysVon(s)
    let w = await erfassung(s, hostDoppel())
    expect(w.find('[data-marke]').exists()).toBe(false)
    w.unmount()
    wrappers.length = 0
    // Abgemeldet: Auch der Start vor „Papier ab“ kommt nicht mehr vom Gerät (wkr/lage.ts: nicht in der Schlange = Papier).
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: starterVon(keys[0]), feld: 'erfasst@gate135', wert: '1' }] })
    s = reducer(s, { type: 'WKR_PAPIER_AB', liste: TOR, ref: keys[1], zeit: 4000 })
    w = await erfassung(s, hostDoppel())
    expect(markiert(w, 'papier-ansehen')).toEqual([starterVon(keys[1]), starterVon(keys[2])])
    const r = reihe(w, starterVon(keys[1])).find('[data-marke="papier-ansehen"]')
    expect(r.text()).toContain('▭')
    expect(r.attributes('title')).toContain('Papier ansehen')
    expect(w.find('[data-wkr="papier-ansehen"]').text()).toContain('2 Zeilen: Papier ansehen')
    expect(w.find('[data-wkr="rueckfragen"]').exists()).toBe(false)
  })

  it('Liste ohne Eintrag (Papier): keine Marken, keine Kopfzeile', async () => {
    const s = stand()
    const w = await erfassung(s, hostDoppel(), 'tor5')
    expect(w.find('[data-marke]').exists()).toBe(false)
    expect(w.find('[data-teil="wkr-erfassung"]').exists()).toBe(false)
  })

  it('Steg: Ablegen abgemeldet, Anlegen da – nur die Zellen des Ablegens gestrichelt, keine Marke an der Zeile', async () => {
    let s = stand('steg', 1)
    const st = starterVon(keysVon(s)[0])
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: st, feld: 'erfasst.an@steg', wert: '1' }] })
    s = reducer(s, { type: 'WKR_LISTE', liste: K('steg'), status: 'abgemeldet', teil: 'ab', zeit: 1500 })
    const w = await erfassung(s, hostDoppel(), 'steg')
    const r = reihe(w, st)
    expect(r.attributes('data-wkr-marke')).toBeUndefined()
    const gestrichelt = r.findAll('td.erf-zelle--papier')
    expect(gestrichelt.length).toBeGreaterThan(0)
    const klasse = s.starters.find((x) => x.id === st)!.klasse
    const spaltenAb = new Set(listenFelder(DM, 'steg', klasse).filter((f) => teilVonZelle('steg', f.zelle) === 'ab').map((f) => f.zelle))
    expect(gestrichelt.every((td) => spaltenAb.has(td.attributes('data-spalte')!))).toBe(true)
    expect(gestrichelt[0].attributes('title')).toContain('Papier ansehen')
    expect(w.find('[data-wkr="papier-ansehen"]').text()).toContain('1 Zeile: Papier ansehen')
  })

  it('Rückfrage: ! an der Zeile, die Zelle markiert, Verweis auf Betrieb → WKR mit dem Parcours', async () => {
    let s = stand()
    const keys = keysVon(s)
    const st = starterVon(keys[2])
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: st, feld: FELD, wert: '10' }] })
    s = zeile(s, keys[2], [[FELD, '5', '']])
    expect(s.wkr.rueckfragen).toHaveLength(1)
    const w = await erfassung(s, hostDoppel())
    expect(markiert(w, 'rueckfrage')).toEqual([st])
    expect(reihe(w, st).find('[data-marke="rueckfrage"]').text()).toContain('!')
    expect(reihe(w, st).findAll('td[data-wkr-zelle="rueckfrage"]')).toHaveLength(1)
    const verweis = w.find('[data-wkr="rueckfragen"]')
    expect(verweis.text()).toContain('1 Rückfrage vom Gerät offen')
    expect(verweis.find('a').text()).toBe('Betrieb → WKR')
    expect(verweis.find('a').attributes('href')).toBe('#/betrieb/wkr/par_1')
  })
})

describe('Erfassung: Nachfrage vor dem Überschreiben eines Gerätewerts (Vorrang 3)', () => {
  it('behalten stellt zurück; ersetzen schreibt; die Antwort gilt, solange die Zelle den Fokus hat', async () => {
    let s = stand()
    const st = starterVon(keysVon(s)[0])
    s = zeile(s, keysVon(s)[0], [[FELD, '5', '']])
    const w = await erfassung(s, hostDoppel(herkunft(st, FELD, '5')))
    const wert = () => werteVon(store.state.value.eingaben, LAUF, st)[FELD]
    let feld = rautenFeld(w, st)
    feld.element.focus()
    await feld.setValue('10')
    let dialog = w.find('[data-dialog="geraet-ersetzen"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.text()).toContain('Handy Nord')
    expect(dialog.text()).toMatch(/10:42: 5\)/)
    await dialog.find('[data-action="geraet-behalten"]').trigger('click')
    expect(w.find('[data-dialog="geraet-ersetzen"]').exists()).toBe(false)
    expect(feld.element.value).toBe('5')
    expect(wert()).toBe('5')

    await feld.setValue('10')
    await w.find('[data-action="geraet-ersetzen"]').trigger('click')
    await nextTick()
    expect(wert()).toBe('10')
    expect(w.find('[data-raute]').exists()).toBe(false)
    // Wieder der Gerätewert (◆ gilt wieder) und gleich weiter: im selben Fokus keine zweite Frage.
    const td = feld.element.closest('td')!
    await feld.setValue('5')
    expect(wert()).toBe('5')
    await nextTick()
    feld = rautenFeld(w, st)
    expect(feld.exists()).toBe(true)
    await feld.setValue('15')
    expect(w.find('[data-dialog="geraet-ersetzen"]').exists()).toBe(false)
    expect(wert()).toBe('15')
    // Nach dem Verlassen der Zelle fragt sie wieder.
    await feld.setValue('5')
    td.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    await nextTick()
    await rautenFeld(w, st).setValue('20')
    expect(w.find('[data-dialog="geraet-ersetzen"]').exists()).toBe(true)
    expect(wert()).toBe('5')
  })
})

// Prüfbefunde W2 (21.11.2026)
describe('Erfassung: Prüfbefunde W2', () => {
  it('„Papier ansehen“ verschwindet, sobald die Zeile vom Bogen abgetippt ist (ohne Haken)', async () => {
    let s = stand()
    const keys = keysVon(s)
    s = reducer(s, { type: 'WKR_PAPIER_AB', liste: TOR, ref: keys[1], zeit: 4000 })
    const w = await erfassung(s, hostDoppel())
    const st = starterVon(keys[1])
    expect(markiert(w, 'papier-ansehen')).toContain(st)
    await (reihe(w, st).find(`td input.erf-feld--buoy`) as DOMWrapper<HTMLInputElement>).setValue('5')
    await nextTick()
    expect(werteVon(store.state.value.eingaben, LAUF, st)['erfasst@gate135']).toBeUndefined()
    expect(markiert(w, 'papier-ansehen')).not.toContain(st)
    expect(reihe(w, st).find('[data-marke]').exists()).toBe(false)
  })

  it('Rückfrage zu einem nicht gezeigten Start: „!“ an der Zeile und Zahl in der Kopfzeile', async () => {
    const s0 = stand()
    const st = s0.starters.find((x) => !keysVon(s0).some((k) => starterVon(k) === x.id))!.id
    const s = zeile(s0, JSON.stringify(['m', st, 1]), [[FELD, '5', '']])
    expect(s.wkr.rueckfragen.every((r) => r.grund === 'start')).toBe(true)
    const w = await erfassung(s, hostDoppel())
    expect(markiert(w, 'rueckfrage')).toEqual([st])
    expect(reihe(w, st).findAll('td[data-wkr-zelle="rueckfrage"]').length).toBeGreaterThan(0)
    expect(w.find('[data-wkr="rueckfragen"]').text()).toContain('1 Rückfrage vom Gerät offen')
  })

  it('Zeitfeld: „Ersetzen“ speichert nicht den ersten Tastendruck, gibt das Feld frei, die ganze Zeit wird neu getippt', async () => {
    let s = stand('zeit')
    const st = starterVon(keysVon(s)[0])
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: st, feld: 'zeit1', wert: '83,45' }] })
    const w = await erfassung(s, hostDoppel(herkunft(st, 'zeit1', '83,45', K('zeit'))), 'zeit')
    const wert = () => werteVon(store.state.value.eingaben, LAUF, st)['zeit1']
    const feld = reihe(w, st).find('td.erf-zelle--geraet input.erf-feld--zeit') as DOMWrapper<HTMLInputElement>
    expect(feld.exists()).toBe(true)
    feld.element.focus()
    await feld.trigger('focus')
    await feld.setValue('1')
    expect(w.find('[data-dialog="geraet-ersetzen"]').exists()).toBe(true)
    await w.find('[data-action="geraet-ersetzen"]').trigger('click')
    await nextTick()
    await nextTick()
    // Nichts Halbes gespeichert, ◆ noch da, das Feld hat den Fokus wieder.
    expect(wert()).toBe('83,45')
    expect(reihe(w, st).find('[data-raute]').exists()).toBe(true)
    expect(document.activeElement).toBe(feld.element)
    await feld.setValue('90,12')
    expect(w.find('[data-dialog="geraet-ersetzen"]').exists()).toBe(false)
    expect(wert()).toBe('90,12')
  })
})

describe('Erfassung ohne Host', () => {
  it('keine Zeichen, keine Kopfzeile, kein Fehler – Eingaben wie immer', async () => {
    let s = stand()
    const keys = keysVon(s)
    const st = starterVon(keys[0])
    s = zeile(s, keys[0], [[FELD, '5', '']])
    s = reducer(s, { type: 'WKR_PAPIER_AB', liste: TOR, ref: keys[1], zeit: 4000 })
    const fehler = vi.spyOn(console, 'error')
    const warnung = vi.spyOn(console, 'warn')
    const w = await erfassung(s, null)
    expect(w.find('.erf-tabelle').exists()).toBe(true)
    expect(w.find('[data-marke]').exists()).toBe(false)
    expect(w.find('[data-raute]').exists()).toBe(false)
    expect(w.find('[data-teil="wkr-erfassung"]').exists()).toBe(false)
    await (reihe(w, st).find(`td input`) as DOMWrapper<HTMLInputElement>).setValue('10')
    expect(w.find('[data-dialog="geraet-ersetzen"]').exists()).toBe(false)
    expect(fehler).not.toHaveBeenCalled()
    expect(warnung).not.toHaveBeenCalled()
  })
})
