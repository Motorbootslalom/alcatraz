import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import BetriebView from './BetriebView.vue'
import SettingsView from './SettingsView.vue'
import GeraeteRaum from '../components/betrieb/GeraeteRaum.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import { vergissAlles } from '../lib/merken'
import { geraeteHostKey, starteGeraeteHost, type GeraeteHost } from '../geraete/host'
import { ABLAGE } from '../geraete/ablage'
import { liesLeseLink } from '../geraete/paket'
import { nachgebauterBrowser, type TestFenster } from '../geraete/testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, SERVER, type NachgebautesNtfy } from '../geraete/transport/ntfy/testNtfy'
import type { NtfyZeiten } from '../geraete/transport/ntfy/leitung'
import { fingerabdruckText } from '../components/betrieb/texte'
import { betriebsStand, festgeschrieben } from '../testHilfen'
import type { AppState } from '../types'

/**
 * Betrieb → Geräte (E6): Gerätebetrieb einschalten, zwei Lese-Links mit QR-Code, Kopieren, Fingerabdruck,
 * „Zuschauer-Link erneuern“, „Raum beenden“, Verbindung – am echten Host (geraete/host.ts) gegen den nachgebauten ntfy
 * (testNtfy.ts) in einem nachgebauten Browser (testBrowser.ts); kein Netz. Starter erfunden (testHilfen: Vor<id>/
 * Nach<id>, Musterclub). Dass ohne Einschalten nichts den Browser verlässt, prüft dazu der echte Start
 * (src/main.geraete.test.ts).
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }
const KENNUNG = 'MUSTERK1'

let ntfy: NachgebautesNtfy
let abrufe: ReturnType<typeof vi.fn>
let store: Store
const hosts: GeraeteHost[] = []
const wrappers: VueWrapper[] = []

beforeEach(() => {
  localStorage.clear()
  vergissAlles()
  setLocale('de')
  location.hash = '#/betrieb'
  ntfy = neuesNtfy()
  abrufe = vi.fn(nachgebautesFetch)
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', abrufe)
  store = createStore()
  store.dispatch({ type: 'LOAD_STATE', state: stand() })
})

afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  for (const h of hosts.splice(0)) h.stop()
  store.beende()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setLocale('de')
  location.hash = ''
  document.body.innerHTML = ''
})

function stand(): AppState {
  return { ...festgeschrieben(betriebsStand()), kennung: KENNUNG, geraeteServer: SERVER }
}

function hostIn(f: TestFenster, s: { state: Store['state'] } = store): GeraeteHost {
  const h = starteGeraeteHost(s, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, endeWartenMs: 2000 })
  hosts.push(h)
  return h
}

function betrieb(host: GeraeteHost | null): VueWrapper {
  const w = mount(BetriebView, { attachTo: document.body, global: { provide: { [storeKey as symbol]: store, [geraeteHostKey as symbol]: host } } })
  wrappers.push(w)
  return w
}

async function zuGeraeten(w: VueWrapper): Promise<void> {
  await w.find('[data-reiter="geraete"]').trigger('click')
  await nextTick()
}

/** Wartet, bis die Oberfläche es zeigt (Vue zeichnet in Mikroaufgaben, `bis` wartet in Zeitgebern). */
async function zeigt(bedingung: () => boolean, ms = 3000): Promise<void> {
  await bis(bedingung, ms)
  await nextTick()
}

const lage = (w: VueWrapper) => w.find('[data-teil="verbindung"]').attributes('data-lage')
const link = (w: VueWrapper, art: 'anzeige' | 'zuschauer') => w.find(`.lese-link[data-link="${art}"]`)
const url = (w: VueWrapper, art: 'anzeige' | 'zuschauer') => link(w, art).find<HTMLInputElement>('.lese-link-text').element.value

describe('Betrieb → Geräte: einschalten, Links, Fingerabdruck', () => {
  it('aus: nichts verbindet, der Text sagt, was über welchen Server ginge; „einschalten“ öffnet den Raum mit zwei Links und QR-Codes', async () => {
    const f = nachgebauterBrowser().fenster()
    const host = hostIn(f)
    const w = betrieb(host)
    await zuGeraeten(w)
    expect(location.hash).toBe('#/betrieb/geraete')

    const aus = w.find('[data-teil="geraete"]')
    expect(aus.find('[data-teil="geraete-aus"]').text()).toContain('verlässt nichts diesen Browser')
    const daten = aus.find('[data-hinweis="geraete-daten"]').text()
    for (const wort of ['ntfy.test', 'Startnummer', 'Name', 'Herkunft', 'Klasse', 'verschlüsselt', 'Geburtsdatum', 'Gewicht', 'Geschlecht']) expect(daten).toContain(wort)
    expect(aus.find('a[data-verweis="geraete-server"]').attributes('href')).toBe('#/einstellungen?geraete')
    // Auf dem Unterreiter selbst: weder die Knöpfe der Start-Freigabe noch die Karten.
    expect(w.find('[data-action="anzeige-oeffnen"]').exists()).toBe(false)
    expect(w.find('.betrieb-karte').exists()).toBe(false)
    await new Promise((r) => setTimeout(r, 50))
    expect(ntfy.abos).toEqual([])
    expect(abrufe).not.toHaveBeenCalled()
    expect(f.ablage.getItem(ABLAGE.raum)).toBeNull()

    await w.find('[data-action="geraete-einschalten"]').trigger('click')
    await zeigt(() => w.find('[data-teil="verbindung"]').exists() && lage(w) === 'verbunden')
    expect(w.find('[data-teil="verbindung"]').text()).toContain('verbunden')
    expect(w.find('[data-teil="verbindung"]').text()).toContain('ntfy.test')
    // Dieses Fenster führt – kein Hinweis auf ein anderes.
    expect(w.find('[data-hinweis="anderes-fenster"]').exists()).toBe(false)

    const raum = host.raum.value!
    expect(w.find('[data-teil="fingerabdruck"]').text()).toBe(fingerabdruckText(raum.fingerabdruck))
    for (const [art, paket, welches] of [['anzeige', raum.anzeige, 'a'], ['zuschauer', raum.zuschauer, 'z']] as const) {
      const adresse = url(w, art)
      // Die Seite dieses Fensters (http), dahinter #/sehen/<paket>.
      expect(adresse).toBe(`${location.origin}${location.pathname}#/sehen/${paket}`)
      expect(link(w, art).find('svg.qr-code').attributes('data-qr')).toBe(adresse)
      expect(link(w, art).find('a[data-action="link-oeffnen"]').attributes('href')).toBe(adresse)
      const gelesen = liesLeseLink(adresse.split('#/sehen/')[1])
      expect(gelesen.ok && gelesen.welches).toBe(welches)
    }
    // Nur der Zuschauer-Link lässt sich erneuern.
    expect(link(w, 'anzeige').find('[data-action="zuschauer-erneuern"]').exists()).toBe(false)
    expect(link(w, 'zuschauer').find('[data-action="zuschauer-erneuern"]').exists()).toBe(true)
  })

  it('„Link kopieren“: in die Zwischenablage, mit Rückmeldung – auch, wenn der Browser es verweigert', async () => {
    const writeText = vi.fn(async (_text: string) => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const host = hostIn(nachgebauterBrowser().fenster())
    host.oeffne()
    location.hash = '#/betrieb/geraete'
    const w = betrieb(host)
    await zeigt(() => w.find('.lese-link').exists())
    await link(w, 'zuschauer').find('[data-action="link-kopieren"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(url(w, 'zuschauer'))
    expect(link(w, 'zuschauer').find('[data-teil="kopiert"]').text()).toBe('Kopiert.')
    writeText.mockRejectedValueOnce(new Error('verweigert'))
    await link(w, 'anzeige').find('[data-action="link-kopieren"]').trigger('click')
    await flushPromises()
    expect(link(w, 'anzeige').find('[data-teil="kopiert"]').text()).toContain('von Hand kopieren')
  })

  it('Fehler beim Einschalten stehen als Satz da (Fehlercode → geraete.fehler.<code>)', async () => {
    const ohneRaum = shallowRef(null)
    const host = {
      raum: ohneRaum,
      fuehrt: shallowRef(false),
      verbindung: shallowRef(null),
      oeffne: () => {
        throw new Error('ablage-voll')
      },
      erneuereZuschauer: () => {},
      beende: async () => 'ohne-meldung' as const,
      gibCode: () => {},
      oeffneQr: () => {},
      beendeKoppeln: () => {},
      setzeAufgaben: () => {},
      benenne: () => {},
      entziehe: () => {},
      ladeAlleNeu: () => 'gesendet' as const,
      neueFassung: shallowRef(false),
      fassungGesehen: () => {},
      kontingent: shallowRef({ tag: '2026-11-20', gesendet: 0, anfragen: 0, gedrosselt: null }),
      stop: () => {},
    } satisfies GeraeteHost
    location.hash = '#/betrieb/geraete'
    const w = betrieb(host)
    await nextTick()
    await w.find('[data-action="geraete-einschalten"]').trigger('click')
    const fehler = w.find('[data-teil="geraete-fehler"]')
    expect(fehler.attributes('data-fehler')).toBe('ablage-voll')
    expect(fehler.text()).toContain('Speicher dieses Browsers ist voll')
  })

  it('ohne Host (Fenster ohne Gerätebetrieb): nur ein Hinweis, kein Knopf', async () => {
    location.hash = '#/betrieb/geraete'
    const w = betrieb(null)
    await nextTick()
    expect(w.find('[data-hinweis="geraete-nicht-verfuegbar"]').exists()).toBe(true)
    expect(w.find('[data-action="geraete-einschalten"]').exists()).toBe(false)
    // Auch der Kopf der anderen Unterreiter zeigt dann keine Verbindung.
    await w.find('[data-reiter="start"]').trigger('click')
    expect(w.find('[data-teil="geraete-lage"]').exists()).toBe(false)
  })

  it('englisch: Unterreiter „Devices“, Adresse #/operation/devices', async () => {
    setLocale('en')
    const host = hostIn(nachgebauterBrowser().fenster())
    const w = betrieb(host)
    await zuGeraeten(w)
    expect(w.find('[data-reiter="geraete"]').text()).toBe('Devices')
    expect(location.hash).toBe('#/operation/devices')
    expect(w.find('[data-action="geraete-einschalten"]').text()).toBe('Switch on device operation')
    expect(w.text()).not.toMatch(/Gerät|Anzeigetafel|Zuschauer/)
  })
})

describe('Betrieb → Geräte: erneuern, beenden, Verbindung im Kopf', () => {
  it('„Zuschauer-Link erneuern“ fragt erst; danach neuer Zuschauer-Link, der Anzeigetafel-Link bleibt', async () => {
    const host = hostIn(nachgebauterBrowser().fenster())
    host.oeffne()
    location.hash = '#/betrieb/geraete'
    const w = betrieb(host)
    await zeigt(() => host.verbindung.value?.status === 'verbunden')
    const vorher = { anzeige: url(w, 'anzeige'), zuschauer: url(w, 'zuschauer') }

    await w.find('[data-action="zuschauer-erneuern"]').trigger('click')
    expect(w.find('[data-dialog="zuschauer-erneuern"]').text()).toContain('Die Anzeigetafel bleibt verbunden')
    await w.find('[data-action="erneuern-nein"]').trigger('click')
    expect(w.find('[data-dialog="zuschauer-erneuern"]').exists()).toBe(false)
    expect(url(w, 'zuschauer')).toBe(vorher.zuschauer)

    await w.find('[data-action="zuschauer-erneuern"]').trigger('click')
    await w.find('[data-action="erneuern-ja"]').trigger('click')
    await zeigt(() => url(w, 'zuschauer') !== vorher.zuschauer)
    expect(url(w, 'anzeige')).toBe(vorher.anzeige)
    expect(w.find('[data-teil="zuschauer-erneuert"]').exists()).toBe(true)
    // Der neue Link ist ein Zuschauer-Link derselben Gruppe – nur das Thema ist neu.
    const alt = liesLeseLink(vorher.zuschauer.split('#/sehen/')[1])
    const neu = liesLeseLink(url(w, 'zuschauer').split('#/sehen/')[1])
    expect(alt.ok && neu.ok && neu.welches === 'z' && neu.paket.t !== alt.paket.t && neu.paket.k === alt.paket.k).toBe(true)
  })

  it('„Raum beenden“ fragt erst; danach aus, mit Meldung an die Geräte, Raum und Verbindung weg', async () => {
    const f = nachgebauterBrowser().fenster()
    const host = hostIn(f)
    host.oeffne()
    location.hash = '#/betrieb/geraete'
    const w = betrieb(host)
    await zeigt(() => host.verbindung.value?.status === 'verbunden')

    await w.find('[data-action="raum-beenden"]').trigger('click')
    expect(w.find('[data-dialog="raum-beenden"]').exists()).toBe(true)
    await w.find('[data-action="beenden-nein"]').trigger('click')
    expect(host.raum.value).not.toBeNull()

    await w.find('[data-action="raum-beenden"]').trigger('click')
    await w.find('[data-action="beenden-ja"]').trigger('click')
    await zeigt(() => w.find('[data-teil="geraete-ende"]').exists())
    expect(w.find('[data-teil="geraete-ende"]').attributes('data-ende')).toBe('gemeldet')
    expect(w.find('[data-teil="geraete-aus"]').exists()).toBe(true)
    expect(w.find('.lese-link').exists()).toBe(false)
    expect(f.ablage.getItem(ABLAGE.raum)).toBeNull()
    await bis(() => ntfy.sockets.size === 0)
    // Wieder einschalten: ein neuer Raum mit neuen Links.
    await w.find('[data-action="geraete-einschalten"]').trigger('click')
    await zeigt(() => w.find('.lese-link').exists())
    expect(w.find('[data-teil="geraete-ende"]').exists()).toBe(false)
  })

  it('E8: „Alle Geräte neu laden“ fragt erst und schickt dann die Meldung an beide Links; Kontingent heute', async () => {
    const host = hostIn(nachgebauterBrowser().fenster())
    const info = host.oeffne()
    location.hash = '#/betrieb/geraete'
    const w = betrieb(host)
    await zeigt(() => host.verbindung.value?.status === 'verbunden')
    await zeigt(() => host.kontingent.value.gesendet >= 2)
    const kontingent = w.find('[data-teil="kontingent"]')
    expect(kontingent.text()).toContain(`${host.kontingent.value.gesendet} Nachrichten`)
    expect(kontingent.attributes('data-lage')).toBe('ok')
    expect(w.find('[data-teil="kontingent-warnung"]').exists()).toBe(false)
    expect(w.find('[data-teil="neue-fassung"]').exists()).toBe(false)

    const themen = [liesLeseLink(info.anzeige), liesLeseLink(info.zuschauer)].map((r) => (r.ok ? r.paket.t : ''))
    const zahl = () => themen.map((th) => ntfy.gespeichert.filter((g) => g.topic === th).length)
    const vorher = zahl()
    await w.find('[data-action="alle-neu-laden"]').trigger('click')
    expect(w.find('[data-dialog="alle-neu-laden"]').text()).toContain('gekoppelte Handys bleiben gekoppelt')
    await w.find('[data-action="neu-laden-nein"]').trigger('click')
    expect(w.find('[data-dialog="alle-neu-laden"]').exists()).toBe(false)
    await w.find('[data-action="alle-neu-laden"]').trigger('click')
    await w.find('[data-action="neu-laden-ja"]').trigger('click')
    expect(w.find('[data-teil="neu-geladen"]').exists()).toBe(true)
    await bis(() => zahl().every((n, i) => n > vorher[i]))

    // Ohne Verbindung (Prüfung 21.11.2026): nichts gesendet, statt „gesendet“ ein Hinweis.
    vi.stubGlobal('WebSocket', class extends NachgebauterSocket {
      constructor(url: string) {
        super(url)
        this.close()
      }
    })
    for (const sock of [...ntfy.sockets]) sock.close()
    await zeigt(() => host.verbindung.value?.status !== 'verbunden')
    const danach = zahl()
    await w.find('[data-action="alle-neu-laden"]').trigger('click')
    await w.find('[data-action="neu-laden-ja"]').trigger('click')
    expect(w.find('[data-teil="neu-geladen"]').exists()).toBe(false)
    expect(w.find('[data-teil="neu-laden-nicht-verbunden"]').text()).toContain('nichts gesendet')
    expect(zahl()).toEqual(danach)
  })

  it('E8: nach einem Update bietet der Bedienrechner „Alle Geräte neu laden“ an; „Nicht nötig“ blendet es aus', async () => {
    const f = nachgebauterBrowser().fenster()
    f.ablage.setItem(ABLAGE.fassung, 'abc1234 alt')
    const host = starteGeraeteHost(store, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, fassung: 'def5678 neu' })
    hosts.push(host)
    // Ein Raum aus der Zeit vor dem Update (hier: gleich angelegt und die alte Fassung zurückgeschrieben).
    host.oeffne()
    f.ablage.setItem(ABLAGE.fassung, 'abc1234 alt')
    host.stop()
    const neu = starteGeraeteHost(store, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, fassung: 'def5678 neu' })
    hosts.push(neu)
    location.hash = '#/betrieb/geraete'
    const w = betrieb(neu)
    await nextTick()
    const hinweis = w.find('[data-teil="neue-fassung"]')
    expect(hinweis.text()).toContain('neuen Fassung')
    await hinweis.find('[data-action="neue-fassung-laden"]').trigger('click')
    expect(w.find('[data-dialog="alle-neu-laden"]').exists()).toBe(true)
    await w.find('[data-action="neu-laden-nein"]').trigger('click')
    await w.find('[data-action="neue-fassung-spaeter"]').trigger('click')
    expect(w.find('[data-teil="neue-fassung"]').exists()).toBe(false)
    expect(f.ablage.getItem(ABLAGE.fassung)).toBe('def5678 neu')
  })

  it('auf den anderen Unterreitern steht die Verbindung im Kopf – ein Klick führt zu den Geräten', async () => {
    const host = hostIn(nachgebauterBrowser().fenster())
    const w = betrieb(host)
    await nextTick()
    expect(w.find('[data-teil="geraete-lage"]').exists()).toBe(false)
    host.oeffne()
    const chip = () => w.find('[data-teil="geraete-lage"]')
    await zeigt(() => chip().exists() && chip().attributes('data-lage') === 'verbunden')
    expect(w.find('[data-teil="geraete-lage"]').text()).toBe('Geräte: verbunden')
    await w.find('[data-reiter="startliste"]').trigger('click')
    expect(w.find('[data-teil="geraete-lage"]').exists()).toBe(true)
    await w.find('[data-teil="geraete-lage"]').trigger('click')
    await nextTick()
    expect(location.hash).toBe('#/betrieb/geraete')
    expect(w.find('.lese-link').exists()).toBe(true)
  })

  it('zweites Fenster: dieselben Links, die Verbindung über den Fensterbus, „erneuern“ wirkt über das Führungsfenster', async () => {
    const b = nachgebauterBrowser()
    const f1 = b.fenster()
    const f2 = b.fenster()
    const h1 = hostIn(f1)
    h1.oeffne()
    await bis(() => h1.verbindung.value?.status === 'verbunden')
    // Das zweite Fenster derselben Veranstaltung mit eigenem Stand (wie ein zweiter Tab).
    const zweit = { state: shallowRef(stand()) }
    const h2 = hostIn(f2, zweit)
    const w = mount(GeraeteRaum, { global: { provide: { [storeKey as symbol]: zweit, [geraeteHostKey as symbol]: h2 } } })
    wrappers.push(w)
    await zeigt(() => h2.verbindung.value?.status === 'verbunden')
    expect(h2.fuehrt.value).toBe(false)
    expect(lage(w)).toBe('verbunden')
    expect(w.find('[data-hinweis="anderes-fenster"]').exists()).toBe(true)
    expect(url(w, 'anzeige')).toContain(h1.raum.value!.anzeige)
    expect(w.find('[data-teil="fingerabdruck"]').text()).toBe(fingerabdruckText(h1.raum.value!.fingerabdruck))

    const vorher = h1.raum.value!.zuschauer
    await w.find('[data-action="zuschauer-erneuern"]').trigger('click')
    await w.find('[data-action="erneuern-ja"]').trigger('click')
    await zeigt(() => h1.raum.value!.zuschauer !== vorher && url(w, 'zuschauer').includes(h1.raum.value!.zuschauer))
    expect(url(w, 'anzeige')).toContain(h1.raum.value!.anzeige)
  })

  it('Einstellungen: ein anderer Server als der des offenen Raums – Hinweis, dass er erst für einen neuen Raum gilt', async () => {
    const host = hostIn(nachgebauterBrowser().fenster())
    host.oeffne()
    store.dispatch({ type: 'SET_GERAETE_SERVER', server: 'https://ntfy.example.org' })
    const w = mount(SettingsView, { global: { provide: { [storeKey as symbol]: store, [geraeteHostKey as symbol]: host } } })
    wrappers.push(w)
    await nextTick()
    expect(w.find('[data-hinweis="geraete-raum-server"]').text()).toContain(SERVER)
    store.dispatch({ type: 'SET_GERAETE_SERVER', server: SERVER })
    await nextTick()
    expect(w.find('[data-hinweis="geraete-raum-server"]').exists()).toBe(false)
  })
})
