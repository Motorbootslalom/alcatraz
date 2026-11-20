import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import BetriebView from './BetriebView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import { vergissAlles } from '../lib/merken'
import { geraeteHostKey, starteGeraeteHost, type GeraeteHost } from '../geraete/host'
import { oeffneKoppelLink, type GekoppeltesGeraet } from '../geraete/gekoppelt'
import { formatiereCode } from '../geraete/koppeln'
import { liesKoppelLink, type KoppelLink } from '../geraete/paket'
import type { Ablage } from '../geraete/ablage'
import { nachgebauterBrowser } from '../geraete/testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, SERVER } from '../geraete/transport/ntfy/testNtfy'
import type { NtfyZeiten } from '../geraete/transport/ntfy/leitung'
import { betriebsStand, festgeschrieben } from '../testHilfen'
import type { AppState } from '../types'

/**
 * Betrieb → Geräte, Koppeln und Geräteliste (E7, Oberfläche): echter Host (geraete/host.ts mit dem Store) im
 * nachgebauten Browser, nachgebauter ntfy; das Handy ist geraete/gekoppelt.ts mit eigenem Speicher (die Oberfläche des
 * Geräts prüft src/GeraetKoppeln.test.ts). Starter erfunden (testHilfen).
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }

let store: Store
const hosts: GeraeteHost[] = []
const geraete: GekoppeltesGeraet[] = []
const wrappers: VueWrapper[] = []

beforeEach(() => {
  localStorage.clear()
  vergissAlles()
  setLocale('de')
  location.hash = '#/betrieb/geraete'
  neuesNtfy()
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', nachgebautesFetch)
  store = createStore()
  const stand: AppState = { ...festgeschrieben(betriebsStand()), kennung: 'MUSTERK7', geraeteServer: SERVER }
  store.dispatch({ type: 'LOAD_STATE', state: stand })
})

afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  for (const g of geraete.splice(0)) g.stop()
  for (const h of hosts.splice(0)) h.stop()
  store.beende()
  vi.unstubAllGlobals()
  location.hash = ''
  document.body.innerHTML = ''
})

function handy(): Ablage {
  const daten = new Map<string, string>()
  return { getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => void daten.set(k, String(v)), removeItem: (k) => void daten.delete(k) }
}

async function offen() {
  const f = nachgebauterBrowser().fenster()
  const h = starteGeraeteHost(store, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, endeWartenMs: 2000, koppelTaktMs: 50 })
  hosts.push(h)
  const w = mount(BetriebView, { attachTo: document.body, global: { provide: { [storeKey as symbol]: store, [geraeteHostKey as symbol]: h } } })
  wrappers.push(w)
  await nextTick()
  await w.find('[data-action="geraete-einschalten"]').trigger('click')
  await zeigt(() => h.verbindung.value?.status === 'verbunden')
  return { h, w }
}

async function zeigt(bedingung: () => boolean, ms = 3000): Promise<void> {
  await bis(bedingung, ms)
  await nextTick()
}

const paketAus = (url: string): KoppelLink => liesKoppelLink(url.split('#/koppeln/')[1])

describe('Betrieb → Geräte: Koppeln', () => {
  it('Bereiche wählen, dann Geräte-Code (mit Ablauf) und QR-Code mit Token; Koppel-Link zum Weitergeben', async () => {
    const { h, w } = await offen()
    const k = w.find('[data-teil="koppeln"]')
    // Zwei Parcours: erst wählen, vorher keine Knöpfe.
    expect(k.findAll('[data-teil="koppeln-bereiche"] input').length).toBe(2)
    expect(k.find('[data-hinweis="bereiche-fehlen"]').exists()).toBe(true)
    expect(k.find<HTMLButtonElement>('[data-action="koppeln-code"]').element.disabled).toBe(true)
    await k.find('[data-teil="koppeln-bereiche"] input[data-bereich="par_1"]').setValue(true)
    expect(k.find<HTMLButtonElement>('[data-action="koppeln-code"]').element.disabled).toBe(false)

    // Koppel-Link: ohne Token, mit Box-Schlüssel.
    const link = w.find('.lese-link[data-link="koppeln"] .lese-link-text').element as HTMLInputElement
    const gelesen = paketAus(link.value)
    expect(gelesen.ok && !gelesen.paket.q).toBe(true)

    await k.find('[data-action="koppeln-code"]').trigger('click')
    await zeigt(() => w.find('[data-teil="koppeln-code"]').exists())
    const code = h.raum.value!.koppeln.code!
    expect(code.aufgaben).toEqual([{ art: 'startfreigabe', bereiche: ['par_1'] }])
    expect(w.find('[data-teil="code"]').text()).toBe(formatiereCode(code.wert))
    expect(w.find('[data-teil="code-zeit"]').text()).toMatch(/Gültig noch [45]:\d\d/)
    expect(w.find('[data-teil="code-fuer"]').text()).toContain('Freigabe für:')

    await w.find('[data-action="koppeln-qr"]').trigger('click')
    await zeigt(() => w.find('[data-teil="koppeln-qr"] .qr-code').exists())
    const qr = paketAus(w.find('[data-teil="koppeln-qr"] .qr-code').attributes('data-qr')!)
    expect(qr.ok && !!qr.paket.q?.token).toBe(true)
    expect(w.find('[data-teil="qr-zeit"]').text()).toMatch(/Wechselt in \d+ s · schließt sich in \d+:\d\d/)

    await w.find('[data-action="qr-beenden"]').trigger('click')
    await zeigt(() => !w.find('[data-teil="koppeln-qr"]').exists())
    await w.find('[data-action="code-beenden"]').trigger('click')
    await zeigt(() => !w.find('[data-teil="koppeln-code"]').exists())
  })

  it('Geräteliste: gekoppeltes Gerät mit Name und Bereichen; ändern wirkt sofort, entziehen mit Rückfrage', async () => {
    const { h, w } = await offen()
    expect(w.find('[data-hinweis="keine-geraete"]').exists()).toBe(true)
    await w.find('[data-teil="koppeln-bereiche"] input[data-bereich="par_1"]').setValue(true)
    await w.find('[data-action="koppeln-code"]').trigger('click')
    await zeigt(() => !!h.raum.value?.koppeln.code)

    const r = oeffneKoppelLink(h.raum.value!.koppelLink, { ablage: handy(), zeiten: SCHNELL, ablaufTaktMs: 20 })
    if (!r.ok) throw new Error(r.code)
    const g = r.geraet
    geraete.push(g)
    await g.start()
    g.koppeln('Steg Nord', h.raum.value!.koppeln.code!.wert)
    await zeigt(() => w.find('.geraete-eintrag').exists())
    // Der Code ist benutzt.
    expect(w.find('[data-teil="koppeln-code"]').attributes('data-lage')).toBe('benutzt')

    const e = w.find('.geraete-eintrag')
    expect(e.find<HTMLInputElement>('input[data-feld="name"]').element.value).toBe('Steg Nord')
    expect(e.find<HTMLInputElement>('input[data-bereich="par_1"]').element.checked).toBe(true)
    expect(e.find<HTMLInputElement>('input[data-bereich="par_2"]').element.checked).toBe(false)
    expect(e.find('[data-teil="zuletzt"]').text()).toMatch(/zuletzt gehört \d\d:\d\d/)

    // Bereiche: sofort auf dem Gerät.
    await e.find('input[data-bereich="par_2"]').setValue(true)
    await bis(() => g.aufgaben.value[0]?.bereiche.includes('par_2') ?? false)
    expect(g.aufgaben.value[0].bereiche.sort()).toEqual(['par_1', 'par_2'])

    // Umbenennen.
    await e.find('input[data-feld="name"]').setValue('Steg Süd')
    await zeigt(() => h.raum.value!.geraete[0].name === 'Steg Süd')

    // Entziehen: erst fragen.
    await w.find('.geraete-eintrag [data-action="entziehen"]').trigger('click')
    expect(document.body.querySelector('[data-dialog="entziehen"]')?.textContent).toContain('„Steg Süd“')
    await w.find('[data-action="entziehen-nein"]').trigger('click')
    expect(h.raum.value!.geraete).toHaveLength(1)
    await w.find('.geraete-eintrag [data-action="entziehen"]').trigger('click')
    await w.find('[data-action="entziehen-ja"]').trigger('click')
    await zeigt(() => g.lage.value === 'entzogen' && !w.find('.geraete-eintrag').exists())
    expect(w.find('[data-teil="entzogen"]').text()).toContain('Steg Süd')
  })
})
