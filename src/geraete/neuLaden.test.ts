import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { starteGeraeteHost, type GeraeteHost, type HostUmgebung } from './host'
import { oeffneLeseLink, type LeseGeraet, type LeseUmgebung } from './geraet'
import { ABLAGE, type Ablage } from './ablage'
import { nachgebauterBrowser } from './testBrowser'
import { bis, grosserBetrieb, NachgebauterSocket, nachgebautesFetch, neuesNtfy, ruhe, SERVER, type NachgebautesNtfy } from './transport/ntfy/testNtfy'
import type { NtfyZeiten } from './transport/ntfy/leitung'
import { reducer, type Action } from '../state/reducer'
import { zeigeNaechsten } from '../testHilfen'
import type { AppState } from '../types'

/**
 * E8 (20.11.2026): „Alle Geräte neu laden“ (Bedienrechner → signierte Meldung `neu-laden` → Geräte laden je Befehl
 * einmal), Hinweis nach einem Update des Bedienrechners und Kontingent-Zähler – Ende zu Ende über den nachgebauten ntfy.
 * Starter erfunden (grosserBetrieb).
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }

let ntfy: NachgebautesNtfy
const hosts: GeraeteHost[] = []
const geraete: LeseGeraet[] = []

beforeEach(() => {
  ntfy = neuesNtfy()
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', nachgebautesFetch)
})

afterEach(() => {
  for (const g of geraete.splice(0)) g.stop()
  for (const h of hosts.splice(0)) h.stop()
  vi.unstubAllGlobals()
})

function store(anfang: AppState) {
  const state = shallowRef(anfang)
  return {
    state,
    dispatch(action: Action) {
      state.value = reducer(state.value, { ...action, zeit: action.zeit ?? 1 } as Action)
    },
  }
}

async function bedienrechner(mehr: HostUmgebung = {}, b = nachgebauterBrowser()) {
  const { stand, bereich } = grosserBetrieb()
  const f = b.fenster()
  const s = store({ ...stand, kennung: 'MUSTERK8', geraeteServer: SERVER })
  const h = starteGeraeteHost(s, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, ...mehr })
  hosts.push(h)
  const info = h.oeffne()
  await bis(() => h.verbindung.value?.status === 'verbunden')
  return { b, f, s, h, info, bereich }
}

function handy(): Ablage & { daten: Map<string, string> } {
  const daten = new Map<string, string>()
  return { daten, getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => void daten.set(k, String(v)), removeItem: (k) => void daten.delete(k) }
}

function lese(link: string, speicher: Ablage | null, mehr: LeseUmgebung = {}): LeseGeraet {
  const r = oeffneLeseLink(link, { ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20, ...mehr })
  if (!r.ok) throw new Error(`Link: ${r.code}`)
  geraete.push(r.geraet)
  return r.geraet
}

/**
 * Eine Sicht NACH allem bisher Gesendeten auslösen und warten, bis das Gerät sie zeigt: Was davor ging (etwa ein
 * Befehl), ist dann sicher angekommen – ohne Zählung mit der Uhr.
 */
async function kommtNach(s: { state: { value: AppState } }, bereich: string, g: LeseGeraet): Promise<void> {
  await ruhe()
  const vorher = JSON.stringify(g.anzeige.value)
  s.state.value = zeigeNaechsten(s.state.value, bereich, 90_000)
  await bis(() => JSON.stringify(g.anzeige.value) !== vorher, 5000)
}

describe('Alle Geräte neu laden (E8)', () => {
  it('beide Lese-Links laden auf den Befehl – je Befehl einmal, auch nach dem eigenen Neuladen nicht wieder', async () => {
    const { s, h, info, bereich } = await bedienrechner()
    const tafelSpeicher = handy()
    const ladeTafel = vi.fn()
    const ladeZuschauer = vi.fn()
    const tafel = lese(info.anzeige, tafelSpeicher, { aktualisiere: ladeTafel })
    const zuschauer = lese(info.zuschauer, handy(), { aktualisiere: ladeZuschauer })
    await tafel.start()
    await zuschauer.start()
    await bis(() => !!tafel.anzeige.value && !!zuschauer.zuschauer.value)

    h.ladeAlleNeu()
    await bis(() => ladeTafel.mock.calls.length === 1 && ladeZuschauer.mock.calls.length === 1)
    expect(tafelSpeicher.getItem(ABLAGE.neuGeladen)).toMatch(/:ko:\d+$/)

    // „Neu geladen“: dasselbe Handy öffnet den Link wieder und holt nach – derselbe Befehl wirkt nicht noch einmal.
    tafel.stop()
    const wieder = lese(info.anzeige, tafelSpeicher, { aktualisiere: ladeTafel })
    await wieder.start()
    s.state.value = zeigeNaechsten(s.state.value, bereich, 50_000)
    await bis(() => wieder.anzeige.value?.bereiche.length === tafel.anzeige.value?.bereiche.length)
    await ruhe()
    expect(ladeTafel).toHaveBeenCalledOnce()
    // Die Sicht kommt nach dem Befehl weiter (die wartende wird als Vollstand nachgeschickt).
    expect(wieder.anzeige.value).not.toBeNull()

    // Ein zweiter Befehl wirkt wieder.
    h.ladeAlleNeu()
    await bis(() => ladeTafel.mock.calls.length === 2)
  })

  it('aus einem zweiten Fenster: der Befehl geht über das Führungsfenster', async () => {
    const { b, s, info } = await bedienrechner()
    const f2 = b.fenster()
    const h2 = starteGeraeteHost(s, { ablage: f2.ablage, fenster: f2.fenster, fuehrung: f2.fuehrung, bus: f2.bus, zeiten: SCHNELL, sammelnMs: 0 })
    hosts.push(h2)
    expect(h2.fuehrt.value).toBe(false)
    const lade = vi.fn()
    const tafel = lese(info.anzeige, handy(), { aktualisiere: lade })
    await tafel.start()
    await bis(() => !!tafel.anzeige.value)
    h2.ladeAlleNeu()
    await bis(() => lade.mock.calls.length === 1)
  })

  it('ohne Speicher auf dem Gerät: kein Neuladen (sonst womöglich eine Schleife)', async () => {
    const { s, h, info, bereich } = await bedienrechner()
    const lade = vi.fn()
    const tafel = lese(info.anzeige, null, { aktualisiere: lade })
    await tafel.start()
    await bis(() => !!tafel.anzeige.value)
    expect(h.ladeAlleNeu()).toBe('gesendet')
    // Erst eine Sicht NACH dem Befehl abwarten – dann ist der Befehl sicher angekommen (Prüfung 21.11.2026).
    await kommtNach(s, bereich, tafel)
    expect(lade).not.toHaveBeenCalled()
  })

  it('ohne Verbindung: nichts gesendet, und ein liegengebliebener Befehl geht auch später nicht hinaus (Prüfung 21.11.2026)', async () => {
    let jetzt = Date.now()
    const { s, h, info, bereich } = await bedienrechner({ uhr: () => jetzt })
    const lade = vi.fn()
    const tafel = lese(info.anzeige, handy(), { aktualisiere: lade })
    await tafel.start()
    await bis(() => !!tafel.anzeige.value)
    // Das Netz fällt aus: kein Abo, kein POST.
    let weg = true
    vi.stubGlobal('fetch', async (u: string, init?: { method?: string; body?: string }) => {
      if (weg) throw new TypeError('offline')
      return nachgebautesFetch(u, init)
    })
    vi.stubGlobal('WebSocket', class extends NachgebauterSocket {
      constructor(url: string) {
        super(url)
        if (weg) this.close()
      }
    })
    for (const sock of [...ntfy.sockets]) sock.close()
    // Im selben Augenblick gedrückt: die Oberfläche hält die Verbindung noch für stehend – der Befehl reiht sich ein.
    expect(h.ladeAlleNeu()).toBe('gesendet')
    await bis(() => h.verbindung.value?.status !== 'verbunden')
    // Später gedrückt: nichts gesendet.
    expect(h.ladeAlleNeu()).toBe('nicht-verbunden')
    // 20 Minuten später ist das Netz wieder da.
    jetzt += 20 * 60_000
    weg = false
    await bis(() => h.verbindung.value?.status === 'verbunden', 5000)
    await kommtNach(s, bereich, tafel)
    expect(lade).not.toHaveBeenCalled()
  })

  it('nur frische Befehle: einen alten holt ein Gerät nach, lädt aber nicht', async () => {
    const { s, h, info, bereich } = await bedienrechner()
    h.ladeAlleNeu()
    await bis(() => ntfy.gespeichert.length >= 4)
    await ruhe()
    // Gegenprobe: mit richtiger Uhr wirkt der eben gesendete Befehl auch beim Einstieg.
    const frisch = vi.fn()
    const g1 = lese(info.anzeige, handy(), { aktualisiere: frisch })
    await g1.start()
    await bis(() => frisch.mock.calls.length === 1)
    // Mit einer Uhr 20 Minuten weiter ist derselbe Befehl zu alt.
    const alt = vi.fn()
    const g2 = lese(info.anzeige, handy(), { aktualisiere: alt, uhr: () => Date.now() + 20 * 60_000 })
    await g2.start()
    await bis(() => !!g2.anzeige.value)
    await kommtNach(s, bereich, g2)
    expect(alt).not.toHaveBeenCalled()
  })
})

describe('Hinweis nach einem Update des Bedienrechners (E8)', () => {
  it('andere Fassung als zuletzt im Gerätebetrieb → Hinweis; „Nicht nötig“ bzw. „neu laden“ blendet ihn aus', async () => {
    const b = nachgebauterBrowser()
    const { s, h } = await bedienrechner({ fassung: 'abc1234 2026-11-20T10:00:00Z' }, b)
    expect(h.neueFassung.value).toBe(false)
    h.stop()
    // „Update“: dasselbe Fenster mit neuer Fassung.
    const f = b.fenster()
    const neu = starteGeraeteHost(s, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, fassung: 'def5678 2026-11-21T08:00:00Z' })
    hosts.push(neu)
    expect(neu.neueFassung.value).toBe(true)
    await bis(() => neu.verbindung.value?.status === 'verbunden')
    neu.ladeAlleNeu()
    expect(neu.neueFassung.value).toBe(false)
    neu.stop()
    const f3 = b.fenster()
    const danach = starteGeraeteHost(s, { ablage: f3.ablage, fenster: f3.fenster, fuehrung: f3.fuehrung, bus: f3.bus, zeiten: SCHNELL, fassung: 'def5678 2026-11-21T08:00:00Z' })
    hosts.push(danach)
    expect(danach.neueFassung.value).toBe(false)
  })

  it('ohne Raum kein Hinweis; ein neuer Raum merkt die laufende Fassung', async () => {
    const b = nachgebauterBrowser()
    const f = b.fenster()
    f.ablage.setItem(ABLAGE.fassung, 'alt')
    const s = store({ ...grosserBetrieb().stand, kennung: 'MUSTERK8', geraeteServer: SERVER })
    const h = starteGeraeteHost(s, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, fassung: 'neu' })
    hosts.push(h)
    expect(h.neueFassung.value).toBe(false)
    h.oeffne()
    expect(h.neueFassung.value).toBe(false)
    expect(f.ablage.getItem(ABLAGE.fassung)).toBe('neu')
  })
})

describe('Kontingent-Zähler am Bedienrechner (E8)', () => {
  it('zählt angenommene Nachrichten und Anfragen und vermerkt „zu viele Anfragen“ (429)', async () => {
    const jetzt = new Date(2026, 10, 21, 9, 30).getTime()
    const { s, h, bereich, f } = await bedienrechner({ uhr: () => jetzt })
    await bis(() => h.kontingent.value.gesendet >= 2)
    expect(h.kontingent.value.tag).toBe('2026-11-21')
    expect(h.kontingent.value.anfragen).toBeGreaterThan(h.kontingent.value.gesendet)
    expect(h.kontingent.value.gedrosselt).toBeNull()
    const vorher = h.kontingent.value.gesendet

    ntfy.antworten.push(429)
    s.state.value = zeigeNaechsten(s.state.value, bereich, 60_000)
    await bis(() => h.kontingent.value.gedrosselt === jetzt)
    // Nach der Pause geht es weiter, gezählt wird nur Angenommenes.
    await bis(() => h.kontingent.value.gesendet >= vorher + 2)
    expect(JSON.parse(f.ablage.getItem(ABLAGE.kontingent)!).gesendet).toBe(h.kontingent.value.gesendet)
  })
})
