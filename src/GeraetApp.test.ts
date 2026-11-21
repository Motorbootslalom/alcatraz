import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import nacl from 'tweetnacl'
import GeraetApp from './GeraetApp.vue'
import { starteGeraeteHost, type GeraeteHost } from './geraete/host'
import { ABLAGE, type Ablage } from './geraete/ablage'
import { liesLeseLink, packeLesePaket, PAKET_FASSUNG, sehenAdresse } from './geraete/paket'
import { nachgebauterBrowser } from './geraete/testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, SERVER, type NachgebautesNtfy } from './geraete/transport/ntfy/testNtfy'
import { fromBase64Url, toBase64Url } from './geraete/transport/ntfy/codec'
import { fingerabdruck, hostSpeicherImSpeicher, lesePaket, neuerRaum } from './geraete/transport/ntfy/raum'
import { HostTransport } from './geraete/transport/ntfy/transport'
import { OEFFENTLICH } from './geraete/transport/protokoll'
import type { NtfyZeiten } from './geraete/transport/ntfy/leitung'
import type { LeseUmgebung } from './geraete/geraet'
import { reducer, type Action } from './state/reducer'
import { SICHT_FASSUNG, sichtOeffentlich } from './betrieb/sicht'
import { fingerabdruckText } from './components/betrieb/texte'
import { setLocale } from './i18n'
import { vergissAlles } from './lib/merken'
import { betriebsStand, festgeschrieben, testLogo, zeigeNaechsten } from './testHilfen'
import type { AppState } from './types'

/**
 * Das Gerät mit Lese-Link (src/GeraetApp.vue, E6): Bedienrechner (geraete/host.ts im nachgebauten Browser) → nachgebauter
 * ntfy (kein Netz) → diese Wurzel mit eigenem Speicher wie ein Handy. Dieselben Komponenten wie am Bedienrechner
 * (AnzeigeTafel, ZuschauerListe), dazu Meldungen, Leiste, „Raum verlassen“. Starter erfunden (testHilfen).
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }

let ntfy: NachgebautesNtfy
let abrufe: ReturnType<typeof vi.fn>
const hosts: GeraeteHost[] = []
const wrappers: VueWrapper[] = []

beforeEach(() => {
  vergissAlles()
  setLocale('de')
  ntfy = neuesNtfy()
  abrufe = vi.fn(nachgebautesFetch)
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', abrufe)
})

afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  for (const h of hosts.splice(0)) h.stop()
  vi.unstubAllGlobals()
  setLocale('de')
  location.hash = ''
  document.title = ''
})

/** Der Speicher eines Handys – eigener Browser, eigener localStorage. */
function handy(): Ablage & { daten: Map<string, string> } {
  const daten = new Map<string, string>()
  return { daten, getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => void daten.set(k, String(v)), removeItem: (k) => void daten.delete(k) }
}

/** Ein Bedienrechner mit offenem, verbundenem Raum; ein Start gezeigt, ein Logo an der Anzeigetafel (darf nicht hinaus). */
async function bedienrechner() {
  let stand = festgeschrieben(betriebsStand())
  const bereich = sichtOeffentlich(stand).bereiche[0].id
  stand = reducer(stand, { type: 'BETRIEB_BEGINNEN', bereich, punkt: 'lauf:1', zeit: 500 })
  stand = zeigeNaechsten(stand, bereich, 1000)
  stand = reducer(stand, { type: 'SET_LOGO', seite: 'links', logo: testLogo() })
  const state = shallowRef<AppState>({ ...stand, kennung: 'MUSTERK1', geraeteServer: SERVER })
  let uhr = 10_000
  const dispatch = (action: Action) => {
    uhr += 1000
    state.value = reducer(state.value, { ...action, zeit: action.zeit ?? uhr } as Action)
  }
  const f = nachgebauterBrowser().fenster()
  const h = starteGeraeteHost({ state }, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, endeWartenMs: 2000 })
  hosts.push(h)
  const info = h.oeffne()
  await bis(() => h.verbindung.value?.status === 'verbunden')
  return { state, dispatch, h, info, bereich }
}

function geraet(hash: string, umgebung: LeseUmgebung = {}): VueWrapper {
  location.hash = hash
  const w = mount(GeraetApp, { attachTo: document.body, props: { umgebung: { ablage: handy(), zeiten: SCHNELL, ablaufTaktMs: 20, ...umgebung } } })
  wrappers.push(w)
  return w
}

// Grenze wie bis() (10 s, Prüfung unter Last 21.11.2026): Vorher 3 s – auf zwei Kernen mit voller Suite lief z. B.
// GeraetWkr „Probe … einmal je Raum“ hinein. Ein grüner Test wartet nicht länger.
async function zeigt(bedingung: () => boolean): Promise<void> {
  await bis(bedingung)
  await nextTick()
}

const startNr = (w: VueWrapper) => w.find('.anzeige-bereich [data-startnr]')
const meldung = (w: VueWrapper) => w.find('.geraet-meldung').attributes('data-meldung')

describe('Gerät mit Lese-Link: dieselben Komponenten wie am Bedienrechner', () => {
  it('noch nichts vom Bedienrechner: „warte“, mit Leiste (Verbindung, Fingerabdruck)', async () => {
    const raum = neuerRaum(SERVER)
    const w = geraet(sehenAdresse(packeLesePaket(lesePaket(raum, 'a'))))
    await zeigt(() => w.find('[data-teil="leiste"] [data-teil="verbindung"][data-lage="verbunden"]').exists())
    expect(meldung(w)).toBe('warte')
    expect(document.documentElement.classList.contains('anzeige-fenster')).toBe(true)
    expect(w.find('[data-teil="fingerabdruck"]').text()).toBe(`Fingerabdruck ${fingerabdruckText(fingerabdruck(raum.sign.pk))}`)
    // Ohne Tafel schwebt die Leiste nicht – sie steht unter der Meldung.
    expect(w.find('[data-teil="leiste"]').classes()).not.toContain('schwebend')
  })

  it('Anzeigetafel-Link: die Tafel folgt dem Bedienrechner – ohne Logos, mit Fingerabdruck', async () => {
    const { state, dispatch, info, bereich } = await bedienrechner()
    const w = geraet(sehenAdresse(info.anzeige))
    await nextTick()
    expect(document.documentElement.classList.contains('anzeige-fenster')).toBe(true)
    expect(w.find('[data-teil="fingerabdruck"]').text()).toBe(`Fingerabdruck ${fingerabdruckText(info.fingerabdruck)}`)

    const imBoot = () => sichtOeffentlich(state.value).bereiche[0].aktuell
    await zeigt(() => startNr(w).exists() && startNr(w).text() === state.value.starters.find((s) => s.id === imBoot()?.starter)?.startNr)
    expect(w.find('.anzeige-app .anzeige').exists()).toBe(true)
    expect(w.find('.anzeige-logo, .kopf-logo, img').exists()).toBe(false)
    expect(document.title).toContain('Anzeigetafel')
    // Über der Tafel schwebt die Leiste, verborgen, solange alles stimmt und der Zeiger ruht.
    const leiste = w.find('[data-teil="leiste"]')
    expect(leiste.classes()).toContain('schwebend')
    expect(w.find('[data-teil="leiste"] [data-teil="verbindung"]').attributes('data-lage')).toBe('verbunden')
    expect(w.find('[data-action="vollbild"]').exists()).toBe(true)

    // Der nächste Start am Bedienrechner steht gleich auf dem Gerät.
    const vorher = startNr(w).text()
    state.value = zeigeNaechsten(state.value, bereich, 99_000)
    await zeigt(() => startNr(w).text() !== vorher)
    dispatch({ type: 'BETRIEB_MELDUNG', bereich: '*', meldung: { text: 'Kurze Pause', art: 'pause' } })
    await zeigt(() => w.text().includes('Kurze Pause'))
  })

  it('Zuschauer-Link: die Zuschauerliste mit Leiste darunter (immer sichtbar)', async () => {
    const { info } = await bedienrechner()
    const w = geraet(sehenAdresse(info.zuschauer))
    await zeigt(() => w.find('.zuschauer-app .zuschauer-liste').exists())
    expect(document.documentElement.classList.contains('zuschauer-fenster')).toBe(true)
    expect(document.documentElement.classList.contains('anzeige-fenster')).toBe(false)
    expect(w.find('.zuschauer-kopf').text()).toBe('Musterpokal 2026')
    expect(w.find('[data-teil="imboot"]').exists()).toBe(true)
    const leiste = w.find('[data-teil="leiste"]')
    expect(leiste.classes()).not.toContain('schwebend')
    expect(leiste.classes()).not.toContain('verborgen')
    expect(w.find('[data-action="vollbild"]').exists()).toBe(false)
    expect(document.title).toBe('Startfolge – Musterpokal 2026')
  })

  it('Zuschauer-Link: Team-Filter auch auf dem Gerät, gemerkt im Browser des Geräts (21.11.2026)', async () => {
    const { state, info } = await bedienrechner()
    // Zwei erfundene Vereine, damit der Filter erscheint.
    state.value = { ...state.value, starters: state.value.starters.map((p) => (p.id === 'k2' ? { ...p, verein: 'Testverein Nord' } : p)) }
    const w = geraet(sehenAdresse(info.zuschauer))
    await zeigt(() => w.find('[data-teil="team-filter"]').exists())
    await w.find('[data-team="Testverein Nord"]').trigger('click')
    expect(w.findAll('[data-gruppe] [data-start]').length).toBe(1)
    // Im localStorage dieses Browsers – nicht in der Ablage des Geräts (Raum, Schlüssel), nicht auf der Leitung: Ein
    // ZuschauerListe rechnet nur aus der empfangenen Sicht und kennt keinen Transport.
    expect(JSON.parse(localStorage.getItem('alcatraz.merke.zuschauer.teams')!)).toEqual(['Testverein Nord'])
    vergissAlles()
  })

  it('ein anderer Link in der Adresse wechselt das Gerät; der gleiche bleibt', async () => {
    const { info } = await bedienrechner()
    const w = geraet(sehenAdresse(info.anzeige))
    await zeigt(() => startNr(w).exists())
    location.hash = sehenAdresse(info.zuschauer)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    await zeigt(() => w.find('.zuschauer-liste').exists())
    expect(startNr(w).exists()).toBe(false)
  })
})

describe('Gerät mit Lese-Link: Meldungen statt einer Sicht', () => {
  it('kaputter Link: Meldung, keine Verbindung', async () => {
    const heil = packeLesePaket(lesePaket(neuerRaum(SERVER), 'a'))
    const kaputt = heil.slice(0, -3) + (heil.endsWith('AAA') ? 'BBB' : 'AAA')
    const w = geraet(sehenAdresse(kaputt))
    await nextTick()
    expect(meldung(w)).toBe('ungueltig')
    expect(w.text()).toContain('Der Link ist unvollständig oder beschädigt')
    expect(w.find('[data-teil="leiste"]').exists()).toBe(false)
    await new Promise((r) => setTimeout(r, 50))
    expect(ntfy.abos).toEqual([])
    expect(abrufe).not.toHaveBeenCalled()
  })

  it('ohne Paket (#/sehen): Hinweis, wie man zu einem Link kommt', async () => {
    const w = geraet('#/sehen')
    await nextTick()
    expect(meldung(w)).toBe('ohne')
    expect(w.text()).toContain('Kein Lese-Link geöffnet')
    expect(document.title).toBe('Lese-Link')
  })

  it('Link einer neueren Paket-Fassung: gezielt aktualisieren (einmal), Meldung mit „Neu laden“', async () => {
    const bytes = fromBase64Url(packeLesePaket(lesePaket(neuerRaum(SERVER), 'a')))!
    const daten = bytes.slice(0, -4)
    daten[0] = PAKET_FASSUNG + 1
    const neu = new Uint8Array(daten.length + 4)
    neu.set(daten, 0)
    neu.set(nacl.hash(daten).subarray(0, 4), daten.length)
    const aktualisiere = vi.fn()
    const w = geraet(sehenAdresse(toBase64Url(neu)), { aktualisiere })
    await nextTick()
    expect(meldung(w)).toBe('fassung')
    expect(w.text()).toContain('neueren Fassung')
    expect(aktualisiere).toHaveBeenCalledOnce()
    await w.find('[data-action="neu-laden"]').trigger('click')
    expect(aktualisiere).toHaveBeenCalledTimes(2)
  })

  it('Bedienrechner älter (F7): „Bedienrechner aktualisieren“ in der Leiste, kein Neuladen', async () => {
    const raum = neuerRaum(SERVER)
    const t = new HostTransport({ server: SERVER, speicher: hostSpeicherImSpeicher(raum), sichtFassung: SICHT_FASSUNG - 1, zeiten: SCHNELL })
    await t.start()
    await bis(() => t.status.value === 'verbunden')
    t.verteile(OEFFENTLICH, { stand: 1 })
    await bis(() => ntfy.bodies(raum.oeffentlich.a).length > 0)
    const aktualisiere = vi.fn()
    const w = geraet(sehenAdresse(packeLesePaket(lesePaket(raum, 'a'))), { aktualisiere })
    await zeigt(() => w.find('[data-teil="fassung"]').exists())
    expect(w.find('[data-teil="fassung"]').attributes('data-fassung')).toBe('host-aelter')
    expect(w.find('[data-teil="fassung"]').text()).toContain('Bedienrechner aktualisieren')
    expect(w.find('[data-teil="fassung"] [data-action="neu-laden"]').exists()).toBe(false)
    expect(aktualisiere).not.toHaveBeenCalled()
    t.stop()
  })

  it('„Raum verlassen“ fragt erst; danach nichts mehr auf dem Gerät, Adresse ohne Paket', async () => {
    const { info } = await bedienrechner()
    const speicher = handy()
    const w = geraet(sehenAdresse(info.zuschauer), { ablage: speicher })
    await zeigt(() => w.find('.zuschauer-liste').exists())
    expect([...speicher.daten.keys()].some((k) => k.startsWith('alcatraz.geraet.'))).toBe(true)

    await w.find('[data-action="raum-verlassen"]').trigger('click')
    expect(w.find('[data-dialog="raum-verlassen"]').exists()).toBe(true)
    await w.find('[data-action="verlassen-nein"]').trigger('click')
    expect(w.find('.zuschauer-liste').exists()).toBe(true)

    await w.find('[data-action="raum-verlassen"]').trigger('click')
    await w.find('[data-action="verlassen-ja"]').trigger('click')
    await flushPromises()
    expect(location.hash).toBe('#/sehen')
    expect(meldung(w)).toBe('verlassen')
    expect(w.find('.zuschauer-liste').exists()).toBe(false)
    expect([...speicher.daten.keys()].filter((k) => k.startsWith('alcatraz.geraet.') && k !== ABLAGE.aktualisiert)).toEqual([])
  })

  it('„Raum beenden“ am Bedienrechner: das Gerät sagt es und zeigt nichts mehr', async () => {
    const { h, info } = await bedienrechner()
    const speicher = handy()
    const w = geraet(sehenAdresse(info.anzeige), { ablage: speicher })
    await zeigt(() => startNr(w).exists())
    expect(await h.beende()).toBe('gemeldet')
    await zeigt(() => w.find('.geraet-meldung').exists() && meldung(w) === 'beendet')
    expect(w.text()).toContain('hat den Raum beendet')
    expect(startNr(w).exists()).toBe(false)
    expect(w.find('[data-teil="leiste"]').exists()).toBe(false)
    expect(speicher.getItem(ABLAGE.sicht)).toBeNull()
  })

  it('Neuladen des Geräts: die abgelegte Sicht steht sofort da (vor jeder Verbindung)', async () => {
    const { info } = await bedienrechner()
    const speicher = handy()
    const w = geraet(sehenAdresse(info.anzeige), { ablage: speicher })
    await zeigt(() => startNr(w).exists())
    const nr = startNr(w).text()
    w.unmount()
    wrappers.splice(wrappers.indexOf(w), 1)
    // Neu laden – ohne Netz: Die Tafel steht trotzdem gleich da, mit der Leiste „keine Verbindung“ bzw. „verbindet“.
    vi.stubGlobal('WebSocket', class {
      constructor() {
        throw new Error('kein Netz')
      }
    })
    abrufe.mockImplementation(async () => {
      throw new Error('kein Netz')
    })
    const w2 = geraet(sehenAdresse(info.anzeige), { ablage: speicher })
    await nextTick()
    expect(startNr(w2).text()).toBe(nr)
    expect(liesLeseLink(info.anzeige).ok).toBe(true)
  })

  it('englische Oberfläche des Geräts: Meldungen englisch', async () => {
    setLocale('en')
    const w = geraet('#/sehen/kaputt-kaputt')
    await nextTick()
    expect(w.text()).toContain('The link is incomplete or damaged')
  })
})

describe('Bildschirm wach halten (E8)', () => {
  afterEach(() => {
    delete (navigator as { wakeLock?: unknown }).wakeLock
  })

  it('mit Wake Lock: angefordert, solange der Link läuft, und nach „Raum verlassen“ abgegeben; kein Hinweis', async () => {
    const frei = vi.fn(async () => {})
    const request = vi.fn(async () => ({ release: frei, addEventListener: () => {} }))
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } })
    const raum = neuerRaum(SERVER)
    const w = geraet(sehenAdresse(packeLesePaket(lesePaket(raum, 'a'))))
    await zeigt(() => request.mock.calls.length === 1)
    expect(request).toHaveBeenCalledWith('screen')
    expect(w.find('[data-teil="wach"]').exists()).toBe(false)
    await w.find('[data-action="raum-verlassen"]').trigger('click')
    await w.find('[data-action="verlassen-ja"]').trigger('click')
    await zeigt(() => frei.mock.calls.length === 1)
  })

  it('ohne Wake Lock (altes iPhone, http): leiser Hinweis in der Leiste, sonst läuft alles', async () => {
    const raum = neuerRaum(SERVER)
    const w = geraet(sehenAdresse(packeLesePaket(lesePaket(raum, 'z'))))
    await zeigt(() => w.find('[data-teil="leiste"] [data-teil="wach"]').exists())
    expect(w.find('[data-teil="wach"]').text()).toContain('Bildschirm kann ausgehen')
  })
})
