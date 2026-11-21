import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { starteGeraeteHost, type GeraeteHost } from './host'
import { ABLAGE, legeRaumAn, schreibeHerkunft, schreibeWkrEingang } from './ablage'
import { nachgebauterBrowser, type TestFenster } from './testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, ruhe, SERVER, type NachgebautesNtfy } from './transport/ntfy/testNtfy'
import { parseHostWire } from './transport/ntfy/wire'
import { liesLeseLink } from './paket'
import { OEFFENTLICH, ZUSCHAUER } from './transport/protokoll'
import type { NtfyZeiten } from './transport/ntfy/leitung'
import { verbindungsLage } from './transport/typen'
import { reducer, type Action } from '../state/reducer'
import { betriebsStand, festgeschrieben } from '../testHilfen'
import type { AppState } from '../types'

/**
 * Der Host des Gerätebetriebs im Bedienfenster (E6, geraete/host.ts) gegen den nachgebauten ntfy (testNtfy.ts) und
 * einen nachgebauten Browser mit mehreren Fenstern (testBrowser.ts) – kein echtes Netz. Starter erfunden
 * (Vor<id>/Nach<id>, Musterclub). Ende-zu-Ende mit Geräten: geraet.test.ts.
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }
const KENNUNG = 'MUSTERK1'

let ntfy: NachgebautesNtfy
let abrufe: ReturnType<typeof vi.fn>
const laufend: GeraeteHost[] = []

beforeEach(() => {
  ntfy = neuesNtfy()
  abrufe = vi.fn(nachgebautesFetch)
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', abrufe)
})

afterEach(() => {
  for (const h of laufend.splice(0)) h.stop()
  vi.unstubAllGlobals()
})

/** Ein festgeschriebener Betrieb mit Kennung und dem nachgebauten Server als Einstellung. */
function stand(): AppState {
  return { ...festgeschrieben(betriebsStand()), kennung: KENNUNG, geraeteServer: SERVER }
}

/** Ein Store, wie der Host ihn braucht: der Stand als Ref, Actions mit Zeit wie im echten Store. */
function store(anfang: AppState = stand()) {
  const state = shallowRef(anfang)
  let uhr = 10_000
  return {
    state,
    dispatch(action: Action) {
      uhr += 1000
      state.value = reducer(state.value, { ...action, zeit: action.zeit ?? uhr } as Action)
    },
  }
}

function hostIn(f: TestFenster, s: ReturnType<typeof store>, mehr: Parameters<typeof starteGeraeteHost>[1] = {}): GeraeteHost {
  const h = starteGeraeteHost(s, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, endeWartenMs: 2000, ...mehr })
  laufend.push(h)
  return h
}

const verbunden = (h: GeraeteHost) => h.verbindung.value?.status === 'verbunden'

describe('Ohne bewusstes Einschalten keine Verbindung', () => {
  it('kein WebSocket, kein fetch, kein Schloss, kein Fensterbus – auch nicht bei Änderungen am Stand', async () => {
    const b = nachgebauterBrowser()
    const f = b.fenster()
    // Ein Raum einer ANDEREN Veranstaltung im Speicher ändert daran nichts.
    legeRaumAn('ANDERE01', SERVER, f.ablage)
    const kanal = vi.fn(f.bus.kanal!)
    const s = store()
    const h = hostIn(f, s, { bus: { ...f.bus, kanal } })
    s.dispatch({ type: 'BETRIEB_BEGINNEN', bereich: 'par_1', punkt: 'lauf:1' })
    s.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Musterpokal am See' } })
    s.dispatch({ type: 'SET_GERAETE_SERVER', server: 'ntfy.example.org' })
    await ruhe(100)
    expect(ntfy.abos).toEqual([])
    expect(abrufe).not.toHaveBeenCalled()
    expect(b.sperren.anfragen).toBe(0)
    expect(kanal).not.toHaveBeenCalled()
    expect(h.raum.value).toBeNull()
    expect(h.verbindung.value).toBeNull()
    expect(h.fuehrt.value).toBe(false)
  })

  it('erst „Raum öffnen“ verbindet – mit zwei Lese-Links und dem Fingerabdruck', async () => {
    const f = nachgebauterBrowser().fenster()
    const h = hostIn(f, store())
    const info = h.oeffne()
    expect(h.raum.value).toEqual(info)
    expect(info.server).toBe(SERVER)
    expect(info.fingerabdruck).toMatch(/^[A-Za-z0-9_-]{8}$/)
    const a = liesLeseLink(info.anzeige)
    const z = liesLeseLink(info.zuschauer)
    expect(a.ok && a.welches === 'a' && a.paket.g === OEFFENTLICH).toBe(true)
    expect(z.ok && z.welches === 'z' && z.paket.g === ZUSCHAUER).toBe(true)
    await bis(() => verbunden(h))
    expect(h.fuehrt.value).toBe(true)
    // Gleich nach dem Verbinden steht die Sicht auf beiden Themen bereit (für Geräte, die erst später kommen).
    const raum = JSON.parse(f.ablage.getItem(ABLAGE.raum)!).raum
    await bis(() => ntfy.bodies(raum.oeffentlich.a).length > 0 && ntfy.bodies(raum.oeffentlich.z).length > 0)
    // Ein zweites „öffnen“ legt keinen neuen Raum an.
    expect(h.oeffne()).toEqual(info)
  })

  it('ein unbrauchbarer Server lässt sich nicht öffnen (Fehlercode)', () => {
    const f = nachgebauterBrowser().fenster()
    const s = store({ ...stand(), geraeteServer: 'ftp://x' })
    const h = hostIn(f, s)
    expect(() => h.oeffne()).toThrow('server-ungueltig')
    expect(f.ablage.getItem(ABLAGE.raum)).toBeNull()
  })
})

describe('Raum an der Kennung, Server, Neuladen', () => {
  it('eine andere Veranstaltung trennt; zurück zur alten verbindet wieder mit demselben Raum', async () => {
    const f = nachgebauterBrowser().fenster()
    const s = store()
    const h = hostIn(f, s)
    const info = h.oeffne()
    await bis(() => verbunden(h))
    s.state.value = { ...s.state.value, kennung: 'ANDERE01' }
    await bis(() => h.verbindung.value === null)
    expect(h.raum.value).toBeNull()
    expect(ntfy.sockets.size).toBe(0)
    s.state.value = { ...s.state.value, kennung: KENNUNG }
    await bis(() => verbunden(h))
    expect(h.raum.value).toEqual(info)
  })

  it('anderer Server in den Einstellungen: Meldung `raum-anderer-server`, der Raum bleibt', async () => {
    const f = nachgebauterBrowser().fenster()
    const s = store()
    const h = hostIn(f, s)
    h.oeffne()
    await bis(() => verbunden(h))
    s.dispatch({ type: 'SET_GERAETE_SERVER', server: 'https://anderer.test' })
    await bis(() => h.verbindung.value?.fehler?.code === 'raum-anderer-server')
    expect(h.raum.value).not.toBeNull()
    s.dispatch({ type: 'SET_GERAETE_SERVER', server: SERVER })
    await bis(() => verbunden(h))
  })

  it('Neuladen des Bedienfensters: derselbe Raum, wieder verbunden, die Nummern laufen weiter', async () => {
    const b = nachgebauterBrowser()
    const f = b.fenster()
    const s = store()
    const h1 = hostIn(f, s)
    const info = h1.oeffne()
    await bis(() => verbunden(h1))
    const raum = JSON.parse(f.ablage.getItem(ABLAGE.raum)!).raum
    await bis(() => ntfy.bodies(raum.oeffentlich.a).length > 0)
    const n = () => ntfy.bodies(raum.oeffentlich.a).map((x) => parseHostWire(x)!).filter((w) => !w.l).map((w) => w.n)
    const vorher = Math.max(...n())
    h1.stop()

    const h2 = hostIn(b.fenster(), s)
    expect(h2.raum.value).toEqual(info)
    await bis(() => verbunden(h2))
    s.dispatch({ type: 'BETRIEB_BEGINNEN', bereich: 'par_1', punkt: 'lauf:1' })
    await bis(() => Math.max(...n()) > vorher)
  })
})

describe('Mehrere Fenster: eines führt, die anderen befehlen über den Fensterbus', () => {
  async function zweiFenster() {
    const b = nachgebauterBrowser()
    const s = store()
    const f1 = b.fenster()
    const f2 = b.fenster()
    const h1 = hostIn(f1, s)
    h1.oeffne()
    const h2 = hostIn(f2, s)
    await bis(() => verbunden(h1) && verbunden(h2))
    return { b, s, f1, f2, h1, h2 }
  }

  it('nur ein Fenster verbindet sich; alle sehen den Stand der Verbindung und den Raum', async () => {
    const { h1, h2 } = await zweiFenster()
    expect([h1.fuehrt.value, h2.fuehrt.value].filter(Boolean)).toHaveLength(1)
    expect(ntfy.sockets.size).toBe(1)
    expect(h2.raum.value).toEqual(h1.raum.value)
  })

  it('„Zuschauer-Link erneuern“ aus dem anderen Fenster: neuer Zuschauer-Link überall, der Anzeigetafel-Link bleibt', async () => {
    const { h1, h2 } = await zweiFenster()
    const [fuehrend, anderes] = h1.fuehrt.value ? [h1, h2] : [h2, h1]
    const vorher = anderes.raum.value!
    anderes.erneuereZuschauer()
    await bis(() => anderes.raum.value!.zuschauer !== vorher.zuschauer && fuehrend.raum.value!.zuschauer !== vorher.zuschauer)
    expect(anderes.raum.value!.anzeige).toBe(vorher.anzeige)
    expect(fuehrend.raum.value).toEqual(anderes.raum.value)
  })

  it('„Raum beenden“ aus dem anderen Fenster: Raum weg, keine Verbindung mehr, in allen Fenstern', async () => {
    const { h1, h2, f1 } = await zweiFenster()
    const anderes = h1.fuehrt.value ? h2 : h1
    expect(await anderes.beende()).toBe('gemeldet')
    await bis(() => h1.raum.value === null && h2.raum.value === null)
    expect(f1.ablage.getItem(ABLAGE.raum)).toBeNull()
    await bis(() => ntfy.sockets.size === 0 && h1.verbindung.value === null && h2.verbindung.value === null)
  })

  it('schließt das führende Fenster, übernimmt das andere und verteilt weiter', async () => {
    const { h1, h2, s, f1 } = await zweiFenster()
    const [fuehrend, anderes] = h1.fuehrt.value ? [h1, h2] : [h2, h1]
    const raum = JSON.parse(f1.ablage.getItem(ABLAGE.raum)!).raum
    fuehrend.stop()
    await bis(() => anderes.fuehrt.value && verbunden(anderes))
    const zahl = ntfy.bodies(raum.oeffentlich.a).length
    s.dispatch({ type: 'BETRIEB_BEGINNEN', bereich: 'par_1', punkt: 'lauf:1' })
    await bis(() => ntfy.bodies(raum.oeffentlich.a).length > zahl)
  })
})

describe('Verbindungsanzeige', () => {
  it('verbunden, gestört, Kontingent, Fehler – aus Stand und Code', () => {
    expect(verbindungsLage('verbunden', null)).toBe('verbunden')
    expect(verbindungsLage('verbunden', { code: 'ablage-voll' })).toBe('verbunden')
    expect(verbindungsLage('neu-verbinden', null)).toBe('gestoert')
    expect(verbindungsLage('verbunden', { code: 'verbindung-gestoert' })).toBe('gestoert')
    expect(verbindungsLage('verbunden', { code: 'zu-viele-anfragen' })).toBe('kontingent')
    expect(verbindungsLage('fehler', { code: 'raum-anderer-server' })).toBe('fehler')
    expect(verbindungsLage('verbinde', null)).toBe('verbinde')
    expect(verbindungsLage('aus', null)).toBe('aus')
  })
})

describe('W2.2: Herkunft ◆ und Gesprächsstand reaktiv', () => {
  const HERKUNFT = { kennung: KENNUNG, zellen: { 'manoevrieren/1|k1|t1a|hin seiteA': { g: 'Handy Nord', l: 'liste', z: 1000, w: '5' } } }

  it('ohne Raum lesbar – beim Start und nach dem storage-Ereignis eines anderen Fensters –, ohne Netz, Schloss, Fensterbus', async () => {
    const b = nachgebauterBrowser()
    const f = b.fenster()
    const anderes = b.fenster()
    schreibeHerkunft(HERKUNFT, f.ablage)
    const kanal = vi.fn(f.bus.kanal!)
    const h = hostIn(f, store(), { bus: { ...f.bus, kanal } })
    expect(h.raum.value).toBeNull()
    expect(h.herkunft.value.zellen).toEqual(HERKUNFT.zellen)
    expect(h.eingang.value).toEqual({ kennung: KENNUNG, n: 0, geraete: {} })
    // Ein anderes Fenster schreibt (Führungsfenster): hier kommt es über das storage-Ereignis an.
    schreibeWkrEingang({ kennung: KENNUNG, n: 1, geraete: { gNord: { abgelehnt: [], hinweise: [{ id: 1, l: 'liste', code: 'pruefen', startNr: '101' }] } } }, anderes.ablage)
    schreibeHerkunft({ kennung: KENNUNG, zellen: {} }, anderes.ablage)
    await bis(() => h.eingang.value.n === 1 && Object.keys(h.herkunft.value.zellen).length === 0)
    await ruhe(50)
    expect(ntfy.abos).toEqual([])
    expect(abrufe).not.toHaveBeenCalled()
    expect(b.sperren.anfragen).toBe(0)
    expect(kanal).not.toHaveBeenCalled()
  })

  it('eine andere Veranstaltung liest ihre eigene (leere) Herkunft; ohne Kennung wird nichts gelöscht', () => {
    const f = nachgebauterBrowser().fenster()
    schreibeHerkunft(HERKUNFT, f.ablage)
    const ohne = hostIn(f, store({ ...stand(), kennung: '' }))
    expect(ohne.herkunft.value.zellen).toEqual({})
    expect(f.ablage.getItem(ABLAGE.herkunft)).not.toBeNull()
    const s = store()
    const h = hostIn(f, s)
    expect(Object.keys(h.herkunft.value.zellen)).toHaveLength(1)
    s.state.value = { ...s.state.value, kennung: 'ANDERE02' }
    return Promise.resolve().then(() => {
      expect(h.herkunft.value).toEqual({ kennung: 'ANDERE02', zellen: {} })
    })
  })
  it('merkeEntscheid (Prüfbefund 21.11.2026): ◆ nach „Gerät übernehmen“ nur, wo jetzt der Gerätewert steht – ohne Raum, ohne Netz', async () => {
    const f = nachgebauterBrowser().fenster()
    const s = store()
    const h = hostIn(f, s)
    const lauf = 'manoevrieren/1'
    s.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf, starter: 'k1', feld: 'a', wert: '5' }, { lauf, starter: 'k1', feld: 'b', wert: '9' }] })
    h.merkeEntscheid('liste', 'Handy Nord', [{ lauf, weitere: [], starter: 'k1', zellen: [{ feld: 'a', wert: '5' }, { feld: 'b', wert: '7' }, { feld: 'c', wert: '' }] }])
    expect(Object.keys(h.herkunft.value.zellen)).toEqual([`${lauf}|k1|a`])
    expect(h.herkunft.value.zellen[`${lauf}|k1|a`]).toMatchObject({ g: 'Handy Nord', l: 'liste', w: '5' })
    await ruhe(20)
    expect(ntfy.abos).toEqual([])
    expect(abrufe).not.toHaveBeenCalled()
  })
})
