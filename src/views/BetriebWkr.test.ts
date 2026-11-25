import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import BetriebView from './BetriebView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { reducer } from '../state/reducer'
import { setLocale } from '../i18n'
import { vergissAlles } from '../lib/merken'
import { configFor } from '../config/konfig'
import { werteVon } from '../lib/eingaben'
import { geraeteHostKey, type GeraeteHost, type RaumInfo } from '../geraete/host'
import type { RegisterEintrag } from '../geraete/register'
import type { WkrEingang, WkrHerkunft } from '../geraete/wkrEingang'
import { listenKennung, type Liste } from '../wkr/liste'
import { pruefeZeile } from '../wkr/zeile'
import { betriebStarter, uimParallelStand, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import { sichtOeffentlich } from '../betrieb/sicht'
import type { AppState } from '../types'

/**
 * Betrieb → WKR (W2.2, Plan docs/plan-wkr-w2.md §6.1/§7 Scheibe 2): Matrix aus einem Beispielstand, Rückfrage
 * entscheiden (Werte + Haken), Vorschlag, Modus/Pause/„Papier ab“ mit Hinweis an ein Host-Doppel, Abschluss lösen hinter
 * der Rückfrage, ohne Raum. Starter, Geräte- und WKR-Namen erfunden (testHilfen: Vor<id>/Nach<id>, Musterclub).
 * Ende zu Ende mit Gerät und nachgebautem ntfy: geraete/wkr.test.ts.
 */

const DM = configFor({ regelwerk: 'dm-2026' })
const KENNUNG = 'MUSTERW22'
const P1 = 'par_1'
const LAUF = 'manoevrieren/1'
const FELD = 't1a|hin seiteA'
const L = (typeId: string): Liste => ({ bereich: P1, typeId, racecourse: null })
const K = (typeId: string) => listenKennung(L(typeId))
const TOR = K('gate135')

let store: Store
const wrappers: VueWrapper[] = []

beforeEach(() => {
  localStorage.clear()
  vergissAlles()
  setLocale('de')
  location.hash = '#/betrieb/wkr'
  store = createStore()
})

afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  store.beende()
  vi.restoreAllMocks()
  setLocale('de')
  location.hash = ''
  document.body.innerHTML = ''
})

/** Klasse-1-Starter (gate135 gilt für sie); gate135 digital ab 100, drei Starts gezeigt. */
function stand(): AppState {
  const starter = Array.from({ length: 6 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))
  let s: AppState = { ...wkrBetriebsStand(starter), kennung: KENNUNG }
  s = reducer(s, { type: 'WKR_LISTE', liste: TOR, modus: 'digital', zeit: 100 })
  for (let i = 0; i < 3; i++) s = zeigeNaechsten(s, P1, 1000 + i * 100)
  // Der dritte ist durchs Start-Tor (Parcours-Ampel rot, P-03): Er zählt im Rückstand mit (AM5).
  return reducer(s, { type: 'BETRIEB_DURCHFAHRT', bereich: P1, ref: s.betrieb.bereiche[P1].gezeigt[2].ref, an: true, zeit: 1300 })
}
const gezeigt = (s: AppState) => s.betrieb.bereiche[P1].gezeigt.map((g) => g.ref)
const starterVon = (key: string) => JSON.parse(key)[1] as string

/** Eine Zeile vom Gerät wie beim Host (pruefeZeile → WKR_ZEILEN). */
function zeile(s: AppState, key: string, c: [string, string, string][], geraet = 'gNord', z = 1): AppState {
  const r = pruefeZeile(s, DM, L('gate135'), undefined, geraet, { z, s: key, c })
  if ('fehler' in r) throw new Error(r.fehler)
  return reducer(s, { type: 'WKR_ZEILEN', liste: TOR, quelle: { geraet, name: 'Handy Nord' }, zeilen: [r], zeit: 5000 })
}

/** Ein Host-Doppel: Register mit einem Gerät für gate135, `hinweis` als Spion. */
function hostDoppel(geraete: RegisterEintrag[] = [{ id: 'gNord', name: 'Handy Nord', aufgaben: [{ art: 'liste', liste: TOR }], seit: 1, zuletzt: Date.now() - 10_000 }]) {
  const raum = shallowRef<RaumInfo | null>({
    server: 'https://ntfy.example.org', anzeige: 'a', zuschauer: 'z', fingerabdruck: 'abcd', koppelLink: 'k', koppeln: { code: null, qr: null }, geraete, entzogen: [],
  })
  const hinweis = vi.fn()
  const merkeEntscheid = vi.fn()
  const host = {
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
    hinweis,
    merkeEntscheid,
    ladeAlleNeu: () => 'gesendet' as const,
    neueFassung: shallowRef(false),
    fassungGesehen: () => {},
    kontingent: shallowRef({ tag: '2026-11-21', gesendet: 0, anfragen: 0, gedrosselt: null }),
    herkunft: shallowRef<WkrHerkunft>({ kennung: KENNUNG, zellen: {} }),
    eingang: shallowRef<WkrEingang>({ kennung: KENNUNG, n: 0, geraete: {} }),
    stop: () => {},
  } satisfies GeraeteHost
  return { host, hinweis, merkeEntscheid }
}

async function betrieb(s: AppState, host: GeraeteHost | null): Promise<VueWrapper> {
  store.dispatch({ type: 'LOAD_STATE', state: s })
  const w = mount(BetriebView, { attachTo: document.body, global: { provide: { [storeKey as symbol]: store, [geraeteHostKey as symbol]: host } } })
  wrappers.push(w)
  await nextTick()
  return w
}

const reihe = (w: VueWrapper, liste: string) => w.find(`tr[data-liste='${liste}']`)
const zellen = (w: VueWrapper, liste: string) => reihe(w, liste).findAll('.wkr-mzelle').map((z) => z.attributes('data-zelle'))

/** Heute um hh:mm – ein Abschluss von einem anderen Tag trägt das Datum („21.11. 14:20“), der Test prüft die Uhrzeit allein. */
function heuteUm(h: number, m: number): number {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime()
}

describe('Betrieb → WKR: Matrix', () => {
  it('Unterreiter mit Hinweis; Zellen je Start, Gerät mit Ampel, Liste ohne Eintrag = Papier', async () => {
    let s = stand()
    const keys = gezeigt(s)
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: starterVon(keys[1]), feld: 'erfasst@gate135', wert: '1' }] })
    const { host } = hostDoppel()
    const w = await betrieb(s, host)
    expect(w.find('[data-reiter="wkr"]').classes()).toContain('active')
    expect(w.find('[data-teil="wkr-matrix"]').exists()).toBe(true)
    expect(w.findAll('th.wkr-start').map((x) => x.text())).toEqual(['101', '102', '103'])
    expect(zellen(w, TOR)).toEqual(['offen', 'ok', 'offen'])
    const g = reihe(w, TOR).find('[data-geraet="gNord"]')
    expect(g.attributes('data-ampel')).toBe('gehoert')
    expect(g.text()).toContain('Handy Nord')
    // tor5 ohne Eintrag: Papier, ohne Gerät.
    expect(reihe(w, K('tor5')).find('[data-teil="papier-liste"]').exists()).toBe(true)
    expect(zellen(w, K('tor5'))).toEqual(['papier', 'papier', 'papier'])
    expect(w.find('[data-hinweis="wkr-ohne-raum"]').exists()).toBe(false)
    // Klick auf das Gerät → Geräteliste.
    await g.trigger('click')
    expect(w.find('[data-reiter="geraete"]').classes()).toContain('active')
  })

  // Nutzer 24.11.2026 (WKR_ANNAHMEN NG4/NG6): „Nicht gestartet · Disq. X“ vom Tor – ✕ wie jedes X; ⊘ gibt es nicht mehr.
  it('„Nicht gestartet“ vom Tor-Gerät: Zelle ✕ „nicht gestartet (X)“, Legende ohne ⊘, nichts offen; Start-Freigabe warnt nicht', async () => {
    let s = stand()
    const keys = gezeigt(s)
    for (const [i, key] of keys.entries()) {
      const r = pruefeZeile(s, DM, L('gate135'), undefined, 'gNord', { z: i + 1, s: key, c: i === 1 ? [['disq@gate135', 'X', '']] : [] })
      if ('fehler' in r) throw new Error(r.fehler)
      s = reducer(s, { type: 'WKR_ZEILEN', liste: TOR, quelle: { geraet: 'gNord', name: 'Handy Nord' }, zeilen: [r], zeit: 5000 + i })
    }
    s = reducer(s, { type: 'WKR_ABSCHLUSS', liste: TOR, punkt: 'lauf:1', name: 'Erika Musterrichterin', pruefsummen: {}, restPapier: false, zeit: 9000 })
    const w = await betrieb(s, hostDoppel().host)
    expect(zellen(w, TOR)).toEqual(['ok', 'x', 'ok'])
    expect(reihe(w, TOR).find('.wkr-mzelle[data-zelle="x"]').attributes('title')).toContain('nicht gestartet (X)')
    expect(w.find('[data-teil="wkr-legende"]').text()).not.toContain('⊘')
    expect(reihe(w, TOR).find('[data-teil="wkr-stand"]').text()).toContain('nichts offen')
    await reihe(w, TOR).find('[data-action="wkr-bedienung"]').trigger('click')
    expect(w.find('[data-teil="abschluss-nicht-vorbei"]').exists()).toBe(false)
    await w.find('[data-reiter="start"]').trigger('click')
    await nextTick()
    expect(w.find('[data-teil="wkr-rueckstand"]').exists()).toBe(false)
  })

  it('W3.2: Liste ohne Gerät mit Verweis „Gerät koppeln“ → Betrieb → Geräte mit vorgewählter Liste', async () => {
    const { host } = hostDoppel()
    const w = await betrieb(stand(), host)
    // gate135 hat ein Gerät: kein Verweis; tor5 ohne Gerät: Verweis mit der Liste in der Adresse.
    expect(reihe(w, TOR).find('[data-action="wkr-koppeln"]').exists()).toBe(false)
    const verweis = reihe(w, K('tor5')).find('a[data-action="wkr-koppeln"]')
    expect(verweis.text()).toBe('Gerät koppeln')
    const href = verweis.attributes('href')!
    expect(href).toBe(`#/betrieb/geraete/${encodeURIComponent(K('tor5'))}`)
    // Dem Verweis folgen (happy-dom navigiert beim Klick nicht): Unterreiter Geräte, Liste vorgewählt.
    location.hash = href
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await nextTick()
    await nextTick()
    expect(w.find('[data-reiter="geraete"]').classes()).toContain('active')
    expect(w.find<HTMLSelectElement>('select[data-feld="koppeln-liste"]').element.value).toBe(K('tor5'))
  })

  it('Klick auf eine Zelle zeigt die Werte der Zeile mit ◆ vom Gerät (Uhrzeit, kein Datum)', async () => {
    let s = stand()
    const keys = gezeigt(s)
    s = zeile(s, keys[0], [[FELD, '5', '']])
    const { host } = hostDoppel()
    host.herkunft.value = { kennung: KENNUNG, zellen: { [`${LAUF}|${starterVon(keys[0])}|${FELD}`]: { g: 'Handy Nord', l: TOR, z: new Date(2026, 10, 21, 10, 42).getTime(), w: '5' } } }
    const w = await betrieb(s, host)
    expect(zellen(w, TOR)[0]).toBe('ok')
    await reihe(w, TOR).find(`.wkr-mzelle[data-start='${keys[0]}']`).trigger('click')
    const karte = w.find('[data-teil="wkr-karte"]')
    expect(karte.text()).toContain('101')
    expect(karte.find(`[data-feld='${FELD}']`).text()).toContain('5')
    expect(karte.find('[data-teil="herkunft"]').attributes('title')).toMatch(/Handy Nord, .*10:42/)
    expect(karte.find('[data-teil="herkunft"]').attributes('title')).not.toMatch(/\d\d\/\d\d/)
  })

  it('ohne Raum: Matrix trotzdem, Hinweis, keine Geräte; ohne Host ebenso', async () => {
    const { host } = hostDoppel()
    host.raum.value = null
    const w = await betrieb(stand(), host)
    expect(w.find('[data-hinweis="wkr-ohne-raum"]').exists()).toBe(true)
    expect(zellen(w, TOR)).toEqual(['offen', 'offen', 'offen'])
    expect(w.find('[data-geraet]').exists()).toBe(false)
    w.unmount()
    wrappers.length = 0
    const w2 = await betrieb(stand(), null)
    expect(w2.find('[data-teil="wkr-matrix"]').exists()).toBe(true)
    expect(w2.find('[data-hinweis="wkr-ohne-raum"]').exists()).toBe(true)
  })

  it('englisch: Unterreiter „Race officials“, Adresse #/operation/officials', async () => {
    setLocale('en')
    location.hash = '#/operation/officials'
    const w = await betrieb(stand(), null)
    expect(w.find('[data-reiter="wkr"]').text()).toBe('Race officials')
    expect(w.find('[data-reiter="wkr"]').classes()).toContain('active')
  })
})

describe('Betrieb → WKR: Eingang', () => {
  it('Rückfrage: Kopf mit Gerätename aus dem Register, Grund als Satz; „Gerät übernehmen“ → Wert und Haken; Zähler im Kopf', async () => {
    let s = stand()
    const keys = gezeigt(s)
    const st = starterVon(keys[2])
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: st, feld: FELD, wert: '10' }] })
    s = zeile(s, keys[2], [[FELD, '5', '']])
    expect(s.wkr.rueckfragen).toHaveLength(1)
    const { host, merkeEntscheid } = hostDoppel()
    const w = await betrieb(s, host)
    expect(w.find('[data-teil="wkr-chip"]').text()).toBe('WKR: ! 1')
    expect(zellen(w, TOR)[2]).toBe('rueckfrage')
    const rf = w.find('[data-teil="wkr-rueckfrage-zeile"]')
    expect(rf.text()).toContain('Start 103')
    expect(rf.text()).toContain('Handy Nord')
    expect(rf.text()).toContain('Gerät 5 · steht 10')
    expect(rf.text()).toContain('Die Zelle ist schon anders belegt.')
    await rf.find('[data-action="wkr-geraet"]').trigger('click')
    expect(werteVon(store.state.value.eingaben, LAUF, st)[FELD]).toBe('5')
    expect(werteVon(store.state.value.eingaben, LAUF, st)['erfasst@gate135']).toBeTruthy()
    expect(store.state.value.wkr.rueckfragen).toEqual([])
    // ◆ für den übernommenen Wert (Prüfbefund 21.11.2026): Gerätename aus dem Register.
    expect(merkeEntscheid).toHaveBeenCalledWith(TOR, 'Handy Nord', [{ lauf: LAUF, weitere: [], starter: st, zellen: [{ feld: FELD, wert: '5' }] }])
    await nextTick()
    expect(w.find('[data-teil="wkr-chip"]').exists()).toBe(false)
    expect(w.find('[data-hinweis="wkr-eingang-leer"]').exists()).toBe(true)
  })

  it('„So lassen“ vom Gerät (W3-35, GF5): Vermerk mit Uhrzeit am Kopf, Rückfrage bleibt entscheidbar', async () => {
    let s = stand()
    const keys = gezeigt(s)
    const st = starterVon(keys[2])
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: st, feld: FELD, wert: '10' }] })
    s = zeile(s, keys[2], [[FELD, '5', '']], 'gWeg')
    const rf0 = s.wkr.rueckfragen[0]
    s = reducer(s, { type: 'WKR_SO_LASSEN', liste: rf0.liste, zeile: rf0.zeile, zeit: new Date(2026, 10, 21, 14, 3).getTime() })
    const { host } = hostDoppel()
    const w = await betrieb(s, host)
    const rf = w.find('[data-teil="wkr-rueckfrage-zeile"]')
    expect(rf.find('[data-teil="wkr-so-lassen"]').text()).toMatch(/^WKR: so lassen \(.*14:03\)$/)
    expect(rf.find('[data-action="wkr-behalten"]').exists()).toBe(true)
  })

  it('Rückfrage behalten; ein Gerät, das es im Register nicht mehr gibt, heißt „entkoppeltes Gerät“', async () => {
    let s = stand()
    const keys = gezeigt(s)
    const st = starterVon(keys[2])
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: st, feld: FELD, wert: '10' }] })
    s = zeile(s, keys[2], [[FELD, '5', '']], 'gWeg')
    const { host, merkeEntscheid } = hostDoppel()
    const w = await betrieb(s, host)
    const rf = w.find('[data-teil="wkr-rueckfrage-zeile"]')
    expect(rf.text()).toContain('entkoppeltes Gerät')
    await rf.find('[data-action="wkr-behalten"]').trigger('click')
    expect(werteVon(store.state.value.eingaben, LAUF, st)[FELD]).toBe('10')
    expect(merkeEntscheid).not.toHaveBeenCalled()
    expect(store.state.value.wkr.rueckfragen).toEqual([])
  })

  it('Vorschlag (Start ging aufs Papier): übernehmen setzt die Werte, verwerfen nicht', async () => {
    let s = stand()
    const keys = gezeigt(s)
    s = reducer(s, { type: 'WKR_PAPIER_AB', liste: TOR, ref: keys[1], zeit: 4000 })
    s = zeile(s, keys[1], [[FELD, '5', '']], 'gNord', 1)
    s = zeile(s, keys[2], [[FELD, '7', '']], 'gNord', 2)
    expect(s.wkr.vorschlaege).toHaveLength(2)
    const { host, merkeEntscheid } = hostDoppel()
    const w = await betrieb(s, host)
    const v = w.findAll('[data-teil="wkr-vorschlag"]')
    expect(v[0].text()).toContain('Dieser Start ging aufs Papier.')
    await v[0].find('[data-action="wkr-uebernehmen"]').trigger('click')
    expect(werteVon(store.state.value.eingaben, LAUF, starterVon(keys[1]))[FELD]).toBe('5')
    expect(merkeEntscheid).toHaveBeenCalledWith(TOR, 'Handy Nord', [{ lauf: LAUF, weitere: [], starter: starterVon(keys[1]), zellen: [{ feld: FELD, wert: '5' }] }])
    merkeEntscheid.mockClear()
    await nextTick()
    await w.find('[data-teil="wkr-vorschlag"] [data-action="wkr-verwerfen"]').trigger('click')
    expect(werteVon(store.state.value.eingaben, LAUF, starterVon(keys[2]))[FELD]).toBeUndefined()
    expect(store.state.value.wkr.vorschlaege).toEqual([])
    expect(merkeEntscheid).not.toHaveBeenCalled()
  })
})

// Nutzer 24.11.2026 (WKR_ANNAHMEN NG6): Ein X vom Tor-Gerät geht durch den Eingang wie jedes X vom Gerät (F5-Markierung).
describe('Betrieb → WKR: Eingang „Nicht gestartet“ vom Tor (24.11.2026)', () => {
  it('Vorschlag und Rückfrage heben das X hervor (kein ⊘ mehr); „Übernehmen“ trägt es ein, die Matrix zeigt ✕', async () => {
    let s = stand()
    const keys = gezeigt(s)
    // Vorschlag: Start ging aufs Papier.
    s = reducer(s, { type: 'WKR_PAPIER_AB', liste: TOR, ref: keys[1], zeit: 4000 })
    const r = pruefeZeile(s, DM, L('gate135'), undefined, 'gNord', { z: 1, s: keys[1], c: [['disq@gate135', 'X', '']] })
    if ('fehler' in r) throw new Error(r.fehler)
    s = reducer(s, { type: 'WKR_ZEILEN', liste: TOR, quelle: { geraet: 'gNord', name: 'Handy Nord' }, zeilen: [r], zeit: 5000 })
    // Rückfrage: ein Start, der noch nicht gezeigt wurde.
    const offen = sichtOeffentlich(s).bereiche.find((b) => b.id === P1)!.offen[0].key
    const r2 = pruefeZeile(s, DM, L('gate135'), undefined, 'gNord', { z: 2, s: offen, c: [['disq@gate135', 'X', '']] })
    if ('fehler' in r2) throw new Error(r2.fehler)
    s = reducer(s, { type: 'WKR_ZEILEN', liste: TOR, quelle: { geraet: 'gNord', name: 'Handy Nord' }, zeilen: [r2], zeit: 5100 })
    expect(s.wkr.vorschlaege).toHaveLength(1)
    expect(s.wkr.rueckfragen.length).toBeGreaterThan(0)
    const w = await betrieb(s, hostDoppel().host)
    expect(w.find('[data-teil="wkr-nv"]').exists()).toBe(false)
    expect(w.find('[data-teil="wkr-vorschlag"] [data-x]').text()).toContain('nicht gestartet')
    expect(w.find('[data-teil="wkr-rueckfrage-zeile"] [data-teil="wkr-x"]').text()).toContain('nicht gestartet')
    await w.find('[data-teil="wkr-vorschlag"] [data-action="wkr-uebernehmen"]').trigger('click')
    expect(werteVon(store.state.value.eingaben, LAUF, starterVon(keys[1]))['disq@gate135']).toBe('X')
    await nextTick()
    expect(reihe(w, TOR).find(`.wkr-mzelle[data-zelle="x"][data-start='${keys[1]}']`).exists()).toBe(true)
  })
})

describe('Betrieb → WKR: „Keine Zeit“ (W5.4, 22.11.2026, ZT4)', () => {
  const ZEIT = K('zeit')
  function zeitZeile(s: AppState, key: string, c: [string, string, string][], kz: [string, 'anlage' | 'nichtImZiel'][], z = 1): AppState {
    const r = pruefeZeile(s, DM, L('zeit'), undefined, 'gNord', { z, s: key, c, kz })
    if ('fehler' in r) throw new Error(r.fehler)
    return reducer(s, { type: 'WKR_ZEILEN', liste: ZEIT, quelle: { geraet: 'gNord', name: 'Pad Zeit' }, zeilen: [r], zeit: 5000 + z })
  }

  it('Matrix: ✓ mit „keine Zeit“, Grund im Titel und in der Karte; Eingang nennt Feld und Grund an Rückfrage und Vorschlag', async () => {
    let s = reducer(stand(), { type: 'WKR_LISTE', liste: ZEIT, modus: 'digital', zeit: 100 })
    const keys = gezeigt(s)
    s = zeitZeile(s, keys[0], [['zeit1', '83,45', ''], ['zeit2', '83,40', '']], [['zeit3', 'anlage']])
    // Rückfrage: zeit1 steht anders – die Zeile trägt „keine Zeit“ für zeit2 mit.
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: starterVon(keys[1]), feld: 'zeit1', wert: '80,00' }] })
    s = zeitZeile(s, keys[1], [['zeit1', '83,45', ''], ['zeit3', '83,44', '']], [['zeit2', 'nichtImZiel']], 2)
    const w = await betrieb(s, hostDoppel().host)
    const zelle = reihe(w, ZEIT).find(`.wkr-mzelle[data-start='${keys[0]}']`)
    expect(zelle.attributes('data-zelle')).toBe('ok')
    expect(zelle.find('[data-teil="mzelle-keine-zeit"]').text()).toBe('keine Zeit')
    expect(zelle.attributes('title')).toContain('keine Zeit: Zeitanlage ausgefallen')
    await zelle.trigger('click')
    expect(w.find('[data-teil="wkr-karte"] [data-feld="zeit3"]').text()).toContain('keine Zeit (Zeitanlage ausgefallen)')
    expect(w.find('[data-teil="wkr-rueckfrage-zeile"] [data-teil="wkr-keine-zeit"]').text()).toBe('Zeit 2: keine Zeit (nicht im Ziel)')
    // Nie auf der Tafel: die Start-Freigabe zeigt keinen Grund.
    await w.find('[data-reiter="start"]').trigger('click')
    await nextTick()
    expect(w.text()).not.toContain('Zeitanlage ausgefallen')
  })
})

describe('Betrieb → WKR: Bedienung je Liste', () => {
  it('Modus als Knöpfe; Pausieren/Weiter (Hinweis „weiter-digital“); Papier ab Start mit Hinweis und Nummer; Nr. prüfen', async () => {
    const s = stand()
    const keys = gezeigt(s)
    const { host, hinweis } = hostDoppel()
    const w = await betrieb(s, host)
    // tor5 auf digital stellen.
    await reihe(w, K('tor5')).find('[data-action="wkr-bedienung"]').trigger('click')
    let b = w.find(`[data-teil="wkr-bedienung"][data-liste='${K('tor5')}']`)
    await b.find('[data-modus="digital"]').trigger('click')
    expect(store.state.value.wkr.listen[K('tor5')].modus).toBe('digital')

    await reihe(w, TOR).find('[data-action="wkr-bedienung"]').trigger('click')
    b = w.find(`[data-teil="wkr-bedienung"][data-liste='${TOR}']`)
    await b.find('[data-action="wkr-pausieren"]').trigger('click')
    expect(store.state.value.wkr.listen[TOR].status).toBe('pausiert')
    await nextTick()
    await b.find('[data-action="wkr-weiter"]').trigger('click')
    expect(store.state.value.wkr.listen[TOR].status).toBe('aktiv')
    expect(hinweis).toHaveBeenLastCalledWith(TOR, 'weiter-digital', undefined, undefined)

    await b.find('[data-feld="wkr-papier-ab"]').setValue(keys[1])
    await b.find('[data-action="wkr-papier-ab"]').trigger('click')
    const e = store.state.value.wkr.listen[TOR]
    expect(e.status).toBe('abgemeldet')
    expect(e.pausen.at(-1)).toMatchObject({ ab: keys[1], bis: null })
    expect(hinweis).toHaveBeenLastCalledWith(TOR, 'papier', '102', undefined)
    await nextTick()
    expect(reihe(w, TOR).find('[data-teil="wkr-stand"]').text()).toContain('Papier ab 102')

    await b.find('[data-feld="wkr-pruefen-nr"]').setValue('103')
    await b.find('[data-action="wkr-pruefen"]').trigger('click')
    expect(hinweis).toHaveBeenLastCalledWith(TOR, 'pruefen', '103')
    expect(b.find('[data-teil="wkr-gesendet"]').exists()).toBe(true)
  })

  // Prüfbefunde W2 (21.11.2026)
  it('Steg: „Weiter“ und „Papier ab“ je Teil geben den Teil an den Host weiter (nur dessen Geräte, F16)', async () => {
    const STEG = K('steg')
    let s = stand()
    s = reducer(s, { type: 'WKR_LISTE', liste: STEG, modus: 'digital', zeit: 150 })
    s = reducer(s, { type: 'WKR_LISTE', liste: STEG, status: 'pausiert', teil: 'ab', zeit: 1500 })
    const keys = gezeigt(s)
    const { host, hinweis } = hostDoppel()
    const w = await betrieb(s, host)
    await reihe(w, STEG).find('[data-action="wkr-bedienung"]').trigger('click')
    const b = w.find(`[data-teil="wkr-bedienung"][data-liste='${STEG}']`)
    await b.find('[data-teil-status="ab"] [data-action="wkr-weiter"]').trigger('click')
    expect(hinweis).toHaveBeenLastCalledWith(STEG, 'weiter-digital', undefined, 'ab')
    await b.find('[data-feld="wkr-papier-ab"]').setValue(keys[1])
    await b.find('[data-feld="wkr-papier-teil"]').setValue('an')
    await b.find('[data-action="wkr-papier-ab"]').trigger('click')
    expect(hinweis).toHaveBeenLastCalledWith(STEG, 'papier', '102', 'an')
    expect(store.state.value.wkr.listen[STEG].teile?.an?.status).toBe('abgemeldet')
    expect(store.state.value.wkr.listen[STEG].status).toBe('aktiv')
  })

  it('„Papier ab“ bleibt beim gewählten Start, auch wenn er aus den letzten 12 Spalten fällt', async () => {
    const starter = Array.from({ length: 16 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))
    let s: AppState = { ...wkrBetriebsStand(starter), kennung: KENNUNG }
    s = reducer(s, { type: 'WKR_LISTE', liste: TOR, modus: 'digital', zeit: 100 })
    for (let i = 0; i < 12; i++) s = zeigeNaechsten(s, P1, 1000 + i * 100)
    const keys = gezeigt(s)
    const { host, hinweis } = hostDoppel()
    const w = await betrieb(s, host)
    await reihe(w, TOR).find('[data-action="wkr-bedienung"]').trigger('click')
    const b = () => w.find(`[data-teil="wkr-bedienung"][data-liste='${TOR}']`)
    expect((b().find('[data-feld="wkr-papier-ab"]').element as HTMLSelectElement).value).toBe(keys[11])
    await b().find('[data-feld="wkr-papier-ab"]').setValue(keys[0])
    // Ein weiterer Start wird gezeigt: Die älteste Spalte fällt aus der Matrix, die Wahl bleibt.
    store.dispatch({ type: 'LOAD_STATE', state: zeigeNaechsten(store.state.value, P1, 3000) })
    await nextTick()
    await nextTick()
    expect(w.findAll('th.wkr-start').map((x) => x.text())).not.toContain('101')
    expect((b().find('[data-feld="wkr-papier-ab"]').element as HTMLSelectElement).value).toBe(keys[0])
    await b().find('[data-action="wkr-papier-ab"]').trigger('click')
    expect(store.state.value.wkr.listen[TOR].pausen.at(-1)).toMatchObject({ ab: keys[0] })
    expect(hinweis).toHaveBeenLastCalledWith(TOR, 'papier', '101', undefined)
  })

  it('Parallelslalom: Liste von Racecourse B bekommt bei „Papier ab“ die Startnummer der Seite B', async () => {
    let s: AppState = { ...uimParallelStand(), kennung: KENNUNG }
    s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const B = listenKennung({ bereich: 'parallel', typeId: 'steg', racecourse: 'B' })
    s = reducer(s, { type: 'WKR_LISTE', liste: B, modus: 'digital', zeit: 100 })
    for (let i = 0; i < 6; i++) s = zeigeNaechsten(s, 'parallel', 1000 + i * 100)
    // Ein Paar mit zwei besetzten Seiten.
    const paar = s.betrieb.bereiche.parallel.gezeigt.map((g) => JSON.parse(g.ref) as unknown[]).find((r) => r[3] !== null && r[4] !== null)!
    const key = JSON.stringify(paar)
    const nrB = s.starters.find((x) => x.id === paar[4])!.startNr
    const nrA = s.starters.find((x) => x.id === paar[3])!.startNr
    expect(nrA).not.toBe(nrB)
    const { host, hinweis } = hostDoppel()
    const w = await betrieb(s, host)
    const knopf = w.find('[data-teil="wkr-matrix"] button[data-bereich="parallel"]')
    if (knopf.exists()) await knopf.trigger('click')
    await reihe(w, B).find('[data-action="wkr-bedienung"]').trigger('click')
    const b = w.find(`[data-teil="wkr-bedienung"][data-liste='${B}']`)
    await b.find('[data-feld="wkr-papier-ab"]').setValue(key)
    await b.find('[data-action="wkr-papier-ab"]').trigger('click')
    expect(hinweis).toHaveBeenLastCalledWith(B, 'papier', nrB, undefined)
    await nextTick()
    expect(reihe(w, B).find('[data-teil="wkr-stand"]').text()).toContain(`Papier ab ${nrB}`)
  })

  it('Abschluss mit Name, Zeit und Abweichung; „Abschluss lösen“ erst nach der Rückfrage', async () => {
    let s = stand()
    const keys = gezeigt(s)
    s = { ...s, wkr: { ...s.wkr, abschluss: { [TOR]: { 'lauf:1': { name: 'Erika Musterrichterin', zeit: heuteUm(14, 20), abweichend: [keys[0]], papier: [] } } } } }
    const w = await betrieb(s, hostDoppel().host)
    await reihe(w, TOR).find('[data-action="wkr-bedienung"]').trigger('click')
    const a = w.find('[data-teil="wkr-abschluesse"]')
    expect(a.text()).toContain('abgeschlossen von Erika Musterrichterin, 14:20')
    expect(a.text()).toContain('abweichend: 101')
    await a.find('[data-action="wkr-abschluss-loesen"]').trigger('click')
    expect(store.state.value.wkr.abschluss[TOR]).toBeDefined()
    const d = w.find('[data-dialog="wkr-abschluss-loesen"]')
    expect(d.exists()).toBe(true)
    await d.find('[data-action="wkr-loesen-ja"]').trigger('click')
    expect(store.state.value.wkr.abschluss[TOR]).toBeUndefined()
  })
})

// --- W2.4: Start-Freigabe mit Geräteleiste, Rückstand und Nachfrage (Plan W2 §6.3, A8, F4) -----------------------

describe('Betrieb → Start-Freigabe: WKR-Erfassung (W2.4)', () => {
  const TITEL = DM.getSheetDef('gate135').title
  const karte = (w: VueWrapper) => w.find(`[data-bereich="${P1}"].betrieb-karte`)
  const zurStartFreigabe = async (w: VueWrapper) => {
    await w.find('[data-reiter="start"]').trigger('click')
    await nextTick()
  }

  it('ohne Eintrag in irgendeiner Liste: keine Leiste, keine Warnung', async () => {
    let s: AppState = { ...wkrBetriebsStand(Array.from({ length: 4 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))), kennung: KENNUNG }
    for (let i = 0; i < 3; i++) s = zeigeNaechsten(s, P1, 1000 + i * 100)
    const w = await betrieb(s, null)
    await zurStartFreigabe(w)
    expect(karte(w).find('[data-teil="wkr-leiste"]').exists()).toBe(false)
    expect(karte(w).find('[data-teil="wkr-rueckstand"]').exists()).toBe(false)
  })

  it('Leiste je Liste (Papier als ▭), Rückstand ≥ R: Zeile + gelber Rand; „warnen“ zeigt ohne Frage', async () => {
    const { host } = hostDoppel()
    const s = stand()
    const w = await betrieb({ ...s, anzeige: { ...s.anzeige, wkrWarnung: 'warnen' } }, host)
    await zurStartFreigabe(w)
    const k = karte(w)
    const feld = k.find(`[data-teil="wkr-leiste"] [data-liste="${TITEL}"]`)
    expect(feld.exists()).toBe(true)
    expect(feld.attributes('data-stand')).toBe('aktiv')
    expect(feld.attributes('data-ampel')).toBe('gehoert')
    // N9 (Feldtest 21.11.2026): großes Zeichen = Erfassungsstand, Verbindung klein dahinter.
    expect(feld.attributes('data-erf')).toBe('wartet')
    expect(feld.find('.wkr-leiste-erf').text()).toBe('⧗')
    expect(feld.text()).toContain('wartet 3')
    expect(feld.find('[data-teil="leiste-verbindung"]').text()).toBe('●')
    expect(feld.attributes('data-rot')).toBeUndefined()
    // Listen ohne Eintrag erscheinen als Papier.
    const papier = k.findAll('[data-teil="wkr-leiste"] [data-stand="papier"]')
    expect(papier.length).toBeGreaterThan(0)
    expect(papier[0].find('.wkr-leiste-erf').text()).toBe('▭')
    expect(papier[0].find('[data-teil="leiste-verbindung"]').exists()).toBe(false)
    // Legende als Titel der Leiste.
    expect(k.find('[data-teil="wkr-leiste"]').attributes('title')).toContain('✓ fertig')
    expect(k.find('[data-teil="wkr-rueckstand"]').text()).toContain(`${TITEL} 3 offen (101–103)`)
    expect(k.find('[data-teil="naechster"]').classes()).toContain('betrieb-naechster--rueckstand')
    // Weder Werte noch Gerätenamen in der Leiste.
    expect(k.find('[data-teil="wkr-leiste"]').text()).not.toContain('Handy Nord')
    // „warnen“ (Vorgabe): Zeigen geht sofort, nie gesperrt.
    expect(k.find('[data-action="zeigen"]').attributes('disabled')).toBeUndefined()
    await k.find('[data-action="zeigen"]').trigger('click')
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).toBeNull()
    expect(gezeigt(store.state.value)).toHaveLength(4)
  })

  it('R höher als der Rückstand: keine Warnung, keine Nachfrage', async () => {
    const s = stand()
    const w = await betrieb({ ...s, anzeige: { ...s.anzeige, wkrRueckstand: 5, wkrWarnung: 'nachfragen' } }, null)
    await zurStartFreigabe(w)
    expect(karte(w).find('[data-teil="wkr-rueckstand"]').exists()).toBe(false)
    await karte(w).find('[data-action="zeigen"]').trigger('click')
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).toBeNull()
    expect(gezeigt(store.state.value)).toHaveLength(4)
  })

  it('„nachfragen“ (Vorgabe seit N8): vor jedem Zeigen „Trotzdem weiter?“ – auch aus „Anderen Starter wählen“; Abbrechen zeigt nichts', async () => {
    const w = await betrieb(stand(), null)
    await zurStartFreigabe(w)
    const k = karte(w)
    await k.find('[data-action="zeigen"]').trigger('click')
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).not.toBeNull()
    expect(document.querySelector('[data-teil="frage-liste"]')!.textContent).toContain(`${TITEL} hat 101–103 noch nicht abgeschickt (3 Starts).`)
    expect(gezeigt(store.state.value)).toHaveLength(3)
    ;(document.querySelector('[data-action="trotzdem-nein"]') as HTMLButtonElement).click()
    await nextTick()
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).toBeNull()
    expect(gezeigt(store.state.value)).toHaveLength(3)
    // Nächster Start mit „Trotzdem freigeben“.
    await k.find('[data-action="zeigen"]').trigger('click')
    ;(document.querySelector('[data-action="trotzdem-freigeben"]') as HTMLButtonElement).click()
    await nextTick()
    expect(gezeigt(store.state.value)).toHaveLength(4)
    // Anderen Starter wählen → Zeigen: dieselbe Frage (A8).
    await k.find('[data-action="wahl"]').trigger('click')
    await nextTick()
    await k.find('[data-action="folge-zeigen"]').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).not.toBeNull()
    expect(gezeigt(store.state.value)).toHaveLength(4)
    ;(document.querySelector('[data-action="trotzdem-freigeben"]') as HTMLButtonElement).click()
    await nextTick()
    expect(gezeigt(store.state.value)).toHaveLength(5)
  })

  it('Pausiert: zählt nicht als Rückstand (F1), keine Frage', async () => {
    let s = stand()
    s = reducer(s, { type: 'WKR_LISTE', liste: TOR, status: 'pausiert', zeit: 2000 })
    const w = await betrieb({ ...s, anzeige: { ...s.anzeige, wkrWarnung: 'nachfragen' } }, null)
    await zurStartFreigabe(w)
    const feld = karte(w).find(`[data-liste="${TITEL}"]`)
    expect(feld.attributes('data-stand')).toBe('pausiert')
    expect(feld.text()).toContain('pausiert')
    expect(karte(w).find('[data-teil="wkr-rueckstand"]').exists()).toBe(false)
    await karte(w).find('[data-action="zeigen"]').trigger('click')
    expect(gezeigt(store.state.value)).toHaveLength(4)
  })

  it('Gerät geht auf ✕: Feld einmal hervorgehoben und rot; Klick auf die Leiste → WKR mit diesem Bereich', async () => {
    const { host } = hostDoppel()
    const w = await betrieb(stand(), host)
    await zurStartFreigabe(w)
    const feld = () => karte(w).find(`[data-liste="${TITEL}"]`)
    expect(feld().attributes('data-rot')).toBeUndefined()
    host.raum.value = { ...host.raum.value!, geraete: [{ id: 'gNord', name: 'Handy Nord', aufgaben: [{ art: 'liste', liste: TOR }], seit: 1, zuletzt: Date.now() - 10 * 60_000 }] }
    await nextTick()
    await nextTick()
    expect(feld().attributes('data-ampel')).toBe('weg')
    expect(feld().attributes('data-erf')).toBe('weg')
    expect(feld().find('.wkr-leiste-erf').text()).toBe('✕')
    expect(feld().text()).toContain('Gerät weg · wartet 3')
    expect(feld().attributes('data-rot')).toBe('')
    expect(feld().attributes('data-neu')).toBe('')
  })

  it('N8 (Feldtest 21.11.2026): Vorgabe R = 1 – schon EIN offener Start fragt, mit Liste und Nummer; fertig = ✓ ohne Frage', async () => {
    let s = stand()
    expect([s.anzeige.wkrRueckstand, s.anzeige.wkrWarnung]).toEqual([1, 'nachfragen'])
    const keys = gezeigt(s)
    const abgeschickt = (st: AppState, key: string) => reducer(st, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: starterVon(key), feld: 'erfasst@gate135', wert: '1' }] })
    s = abgeschickt(abgeschickt(s, keys[0]), keys[1])
    const { host } = hostDoppel()
    const w = await betrieb(s, host)
    await zurStartFreigabe(w)
    const k = karte(w)
    const feld = () => k.find(`[data-liste="${TITEL}"]`)
    expect(feld().attributes('data-erf')).toBe('wartet')
    expect(feld().text()).toContain('wartet 1')
    expect(k.find('[data-teil="wkr-rueckstand"]').text()).toContain(`${TITEL} 1 offen (103)`)
    await k.find('[data-action="zeigen"]').trigger('click')
    expect(document.querySelector('[data-teil="frage-liste"]')!.textContent!.trim()).toBe(`${TITEL} hat 103 noch nicht abgeschickt.`)
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"] h2, [data-dialog="trotzdem-freigeben"]')!.textContent).toContain('Trotzdem weiter?')
    ;(document.querySelector('[data-action="trotzdem-nein"]') as HTMLButtonElement).click()
    await nextTick()
    expect(gezeigt(store.state.value)).toHaveLength(3)
    // Der WKR schickt 103 ab: ✓ fertig (grün), kein Rückstand, Zeigen ohne Frage.
    store.dispatch({ type: 'LOAD_STATE', state: abgeschickt(store.state.value, keys[2]) })
    await nextTick()
    await nextTick()
    expect(feld().attributes('data-erf')).toBe('fertig')
    expect(feld().find('.wkr-leiste-erf').text()).toBe('✓')
    expect(feld().text()).toContain('fertig')
    expect(k.find('[data-teil="wkr-rueckstand"]').exists()).toBe(false)
    await k.find('[data-action="zeigen"]').trigger('click')
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).toBeNull()
    expect(gezeigt(store.state.value)).toHaveLength(4)
  })

  it('Klick auf die Leiste → Unterreiter WKR mit dem Bereich dieser Karte', async () => {
    // Klasse 4 fährt auf dem zweiten Parcours: zwei Karten.
    const starter = [...Array.from({ length: 3 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i))), betriebStarter('v1', '4', '401'), betriebStarter('v2', '4', '402')]
    let s: AppState = { ...wkrBetriebsStand(starter), kennung: KENNUNG }
    s = reducer(s, { type: 'WKR_LISTE', liste: listenKennung({ bereich: 'par_2', typeId: 'gate135', racecourse: null }), modus: 'papier', zeit: 100 })
    const w = await betrieb(s, null)
    await zurStartFreigabe(w)
    const zweite = w.find('[data-bereich="par_2"].betrieb-karte')
    expect(zweite.find(`[data-liste="${TITEL}"]`).attributes('data-stand')).toBe('papier')
    // Für die Tastatur ein eigener Knopf in der Leiste.
    expect(zweite.find('[data-action="zur-erfassung"]').exists()).toBe(true)
    await zweite.find('[data-action="zur-erfassung"]').trigger('click')
    await nextTick()
    expect(w.find('[data-reiter="wkr"]').classes()).toContain('active')
    expect(w.find('[data-teil="wkr-matrix"] button[data-bereich="par_2"]').classes()).toContain('active')
  })

  // Nutzer 21.11.2026 (T1/T2): Anlegen nachlaufend – das Boot des gezeigten Starts fährt noch. Seit der Parcours-Ampel
  // (P-03, AM5) fragt der Steg nie: Er steht mit ⧗ in der Leiste, „Nächster Start“ geht ohne Frage.
  it('Steg: „Nächster Start“ fragt nie – auch nicht wegen des zurückgekehrten (P-03: Steg läuft autark)', async () => {
    const STEG = K('steg')
    const STEG_TITEL = DM.getSheetDef('steg').title
    const starter = Array.from({ length: 6 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))
    let s: AppState = { ...wkrBetriebsStand(starter), kennung: KENNUNG }
    s = reducer(s, { type: 'WKR_LISTE', liste: STEG, modus: 'digital', zeit: 100 })
    s = zeigeNaechsten(s, P1, 1000)
    const [erster] = gezeigt(s)
    // Ablegen des ersten abgeschickt (vorab oder gleich) – nur sein Anlegen fehlt, und das Boot ist noch im Parcours.
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: starterVon(erster), feld: 'erfasst.ab@steg', wert: '1' }] })
    const { host } = hostDoppel([{ id: 'gSteg', name: 'Handy Steg', aufgaben: [{ art: 'liste', liste: STEG }], seit: 1, zuletzt: Date.now() - 10_000 }])
    const w = await betrieb(s, host)
    await zurStartFreigabe(w)
    const k = karte(w)
    expect(k.find('[data-teil="wkr-rueckstand"]').exists()).toBe(false)
    expect(k.find(`[data-liste="${STEG_TITEL}"]`).attributes('data-erf')).toBe('fertig')
    await k.find('[data-action="zeigen"]').trigger('click')
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).toBeNull()
    expect(gezeigt(store.state.value)).toHaveLength(2)
    await nextTick()
    await nextTick()
    // Jetzt ist der erste zurück (Anlegen offen) und das Ablegen des zweiten offen: ⧗ in der Leiste, aber keine Frage.
    expect(k.find(`[data-liste="${STEG_TITEL}"]`).attributes('data-erf')).toBe('wartet')
    expect(k.find('[data-teil="wkr-rueckstand"]').exists()).toBe(false)
    await k.find('[data-action="zeigen"]').trigger('click')
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).toBeNull()
    expect(gezeigt(store.state.value)).toHaveLength(3)
  })

  // Parcours-Ampel (Nutzer 21.11.2026, P-03/P-04; AM4/AM5).
  it('Ampel: grün mit „Durchs Start-Tor“ → rot (offene Liste genannt, „Doch nicht durch“) → frei; bei grün keine Frage wegen des gezeigten', async () => {
    const starter = Array.from({ length: 6 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))
    let s: AppState = { ...wkrBetriebsStand(starter), kennung: KENNUNG }
    s = reducer(s, { type: 'WKR_LISTE', liste: TOR, modus: 'digital', zeit: 100 })
    s = zeigeNaechsten(s, P1, 1000)
    const [erster] = gezeigt(s)
    const w = await betrieb(s, hostDoppel().host)
    await zurStartFreigabe(w)
    const k = karte(w)
    const ampel = () => k.find('[data-teil="ampel"]')
    expect(ampel().attributes('data-ampel')).toBe('gruen')
    expect(ampel().text()).toContain('Start frei')
    // Grün: Der Starter fuhr nicht los – R = 1, „nachfragen“, trotzdem keine Frage (P-04).
    expect(k.find('[data-teil="wkr-rueckstand"]').exists()).toBe(false)
    await k.find('[data-action="durchfahrt"]').trigger('click')
    await nextTick()
    await nextTick()
    expect(store.state.value.betrieb.bereiche[P1].durchfahrt?.ref).toBe(erster)
    expect(ampel().attributes('data-ampel')).toBe('rot')
    expect(ampel().text()).toContain(TITEL)
    // Rot: Nächster Start fragt nach.
    await k.find('[data-action="zeigen"]').trigger('click')
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).not.toBeNull()
    ;(document.querySelector('[data-action="trotzdem-nein"]') as HTMLButtonElement).click()
    await nextTick()
    // Versehentlich getippt: zurück auf grün.
    await k.find('[data-action="durchfahrt-zurueck"]').trigger('click')
    await nextTick()
    await nextTick()
    expect(ampel().attributes('data-ampel')).toBe('gruen')
    // Die Zeile des Tor-WKR macht durch UND fertig: frei, Zeigen ohne Frage.
    store.dispatch({ type: 'LOAD_STATE', state: reducer(store.state.value, { type: 'SET_EINGABEN', zellen: [{ lauf: LAUF, starter: starterVon(erster), feld: 'erfasst@gate135', wert: '1' }] }) })
    await nextTick()
    await nextTick()
    expect(ampel().attributes('data-ampel')).toBe('frei')
    await k.find('[data-action="zeigen"]').trigger('click')
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).toBeNull()
    expect(gezeigt(store.state.value)).toHaveLength(2)
  })

  it('Auto-Modus an, aber Parcours-Listen ohne Gerät: „Auto aus: …“; aus: kein Hinweis', async () => {
    let s = stand()
    s = reducer(s, { type: 'SET_ANZEIGE', patch: { wkrAuto: true } })
    const w = await betrieb(s, hostDoppel().host)
    await zurStartFreigabe(w)
    expect(karte(w).find('[data-teil="auto-aus"]').text()).toContain('Auto aus')
    expect(karte(w).find('[data-teil="auto"]').exists()).toBe(false)
    const ohne = await betrieb(stand(), hostDoppel().host)
    await zurStartFreigabe(ohne)
    expect(karte(ohne).find('[data-teil="auto-aus"]').exists()).toBe(false)
  })

  // Nutzer 21.11.2026 (T5): Abmelden am Gerät = Liste abgemeldet und vom Gerät genommen (Host: geraete/wkr.test.ts).
  it('Abmelden vom Gerät: Leiste ▭ „abgemeldet“, Matrix ohne Gerät, „Nächster Start“ ohne Frage', async () => {
    let s = stand()
    expect(s.anzeige.wkrWarnung).toBe('nachfragen')
    s = reducer(s, { type: 'WKR_LISTE', liste: TOR, status: 'abgemeldet', zeit: 2000 })
    // Das Gerät hat die Liste nicht mehr (Aufgaben leer).
    const { host } = hostDoppel([{ id: 'gNord', name: 'Handy Nord', aufgaben: [], seit: 1, zuletzt: Date.now() - 10_000 }])
    const w = await betrieb(s, host)
    expect(zellen(w, TOR).every((z) => z === 'papier')).toBe(true)
    expect(reihe(w, TOR).find('[data-geraet="gNord"]').exists()).toBe(false)
    await zurStartFreigabe(w)
    const feld = karte(w).find(`[data-liste="${TITEL}"]`)
    expect(feld.attributes('data-stand')).toBe('abgemeldet')
    expect(feld.attributes('data-erf')).toBe('papier')
    expect(feld.find('.wkr-leiste-erf').text()).toBe('▭')
    expect(karte(w).find('[data-teil="wkr-rueckstand"]').exists()).toBe(false)
    await karte(w).find('[data-action="zeigen"]').trigger('click')
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).toBeNull()
    expect(gezeigt(store.state.value)).toHaveLength(4)
  })
})

// W5.3 (22.11.2026, WKR_ANNAHMEN KN4/KN5): Knoten am Tisch – eigener Block unter der Matrix, nie Spalten oder Rückstand.
describe('Betrieb → WKR: Knoten am Tisch (W5.3)', () => {
  const KNOTEN = listenKennung({ bereich: 'tisch', typeId: 'knoten', racecourse: null })

  it('Block „Am Tisch“: offen n / m, Gerät, Bedienung ohne „Papier ab“; nicht in der Matrix, keine Warnung', async () => {
    let s = reducer(stand(), { type: 'WKR_LISTE', liste: KNOTEN, modus: 'digital', zeit: 100 })
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/0', starter: 'm1', feld: 'erfasst@knoten', wert: '1' }] })
    const { host } = hostDoppel([{ id: 'gTisch', name: 'Pad Tisch', aufgaben: [{ art: 'liste', liste: KNOTEN }], seit: 1, zuletzt: Date.now() - 10_000 }])
    const w = await betrieb(s, host)
    const block = w.find('[data-teil="wkr-tisch"]')
    expect(block.exists()).toBe(true)
    expect(w.find('.wkr-matrix-rahmen').find(`tr[data-liste='${KNOTEN}']`).exists()).toBe(false)
    expect(block.find('[data-teil="wkr-tisch-offen"]').text()).toBe('Knoten: 5 / 6 offen')
    expect(block.find('[data-geraet="gTisch"]').text()).toContain('Pad Tisch')
    await block.find('[data-action="wkr-bedienung"]').trigger('click')
    expect(block.find('[data-feld="wkr-papier-ab"]').exists()).toBe(false)
    expect(block.find('[data-action="wkr-pausieren"]').exists()).toBe(true)
  })
})
