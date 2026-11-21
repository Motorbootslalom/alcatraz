import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import BetriebView from './BetriebView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import { vergissAlles } from '../lib/merken'
import { geraeteHostKey, starteGeraeteHost, type GeraeteHost, type RaumInfo } from '../geraete/host'
import type { RegisterEintrag } from '../geraete/register'
import type { WkrEingang, WkrHerkunft } from '../geraete/wkrEingang'
import { listenKennung } from '../wkr/liste'
import { oeffneKoppelLink, type GekoppeltesGeraet } from '../geraete/gekoppelt'
import { formatiereCode } from '../geraete/koppeln'
import { liesKoppelLink, type KoppelLink } from '../geraete/paket'
import type { Ablage } from '../geraete/ablage'
import { nachgebauterBrowser } from '../geraete/testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, SERVER } from '../geraete/transport/ntfy/testNtfy'
import type { NtfyZeiten } from '../geraete/transport/ntfy/leitung'
import { betriebsStand, festgeschrieben } from '../testHilfen'
import type { AppState } from '../types'
import { freigabeBereiche, type Aufgabe } from '../geraete/aufgaben'

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

    // Befund 6 (Feldtest 21.11.2026): QR-Code ist der Hauptweg; Geräte-Code und Koppel-Link stehen zugeklappt im
    // zweiten Weg – der Link (ohne Token) ist erst nach dem Aufklappen da, damit ihn niemand statt des QR-Codes scannt.
    expect(k.find('[data-teil="koppeln-hauptweg"]').text()).toContain('kein Code nötig')
    const weg = k.find<HTMLDetailsElement>('[data-teil="koppeln-weg-code"]')
    expect(weg.element.open).toBe(false)
    expect(w.find('.lese-link[data-link="koppeln"]').exists()).toBe(false)
    weg.element.open = true
    await weg.trigger('toggle')
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

  it('Befund 6: „Geräte-Code ausgeben“ klappt den zweiten Weg mit dem Koppel-Link auf', async () => {
    const { w } = await offen()
    const k = w.find('[data-teil="koppeln"]')
    await k.find('[data-teil="koppeln-bereiche"] input[data-bereich="par_1"]').setValue(true)
    expect(k.find<HTMLDetailsElement>('[data-teil="koppeln-weg-code"]').element.open).toBe(false)
    await k.find('[data-action="koppeln-code"]').trigger('click')
    await zeigt(() => w.find('[data-teil="koppeln-code"]').exists())
    expect(k.find<HTMLDetailsElement>('[data-teil="koppeln-weg-code"]').element.open).toBe(true)
    expect(w.find('[data-teil="koppeln-weg-code"] .lese-link[data-link="koppeln"]').exists()).toBe(true)
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
    await bis(() => freigabeBereiche(g.aufgaben.value).includes('par_2'))
    expect(freigabeBereiche(g.aufgaben.value).sort()).toEqual(['par_1', 'par_2'])

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

// --- W3.2 (21.11.2026): WKR-Liste zuweisen -----------------------------------------------------------------------

const L = (bereich: string, typeId: string) => listenKennung({ bereich, typeId, racecourse: null })
const STEG = L('par_1', 'steg')
const TOR5 = L('par_1', 'tor5')
const GATE = L('par_1', 'gate135')

/** Host-Doppel (Muster views/BetriebWkr.test.ts): Register zum Vorgeben, Befehle als Spione. */
function hostDoppel(geraeteListe: RegisterEintrag[]) {
  const raum = shallowRef<RaumInfo | null>({
    server: SERVER, anzeige: 'a', zuschauer: 'z', fingerabdruck: 'abcd', koppelLink: 'k', koppeln: { code: null, qr: null }, geraete: geraeteListe, entzogen: [],
  })
  const setzeAufgaben = vi.fn<(id: string, aufgaben: Aufgabe[]) => void>()
  const gibCode = vi.fn<(aufgaben: Aufgabe[]) => void>()
  const host = {
    raum,
    fuehrt: shallowRef(true),
    verbindung: shallowRef(null),
    oeffne: () => raum.value!,
    erneuereZuschauer: () => {},
    beende: async () => 'gemeldet' as const,
    gibCode,
    oeffneQr: () => {},
    beendeKoppeln: () => {},
    setzeAufgaben,
    benenne: () => {},
    entziehe: () => {},
    hinweis: () => {},
    merkeEntscheid: () => {},
    ladeAlleNeu: () => 'gesendet' as const,
    neueFassung: shallowRef(false),
    fassungGesehen: () => {},
    kontingent: shallowRef({ tag: '2026-11-21', gesendet: 0, anfragen: 0, gedrosselt: null }),
    herkunft: shallowRef<WkrHerkunft>({ kennung: 'MUSTERK7', zellen: {} }),
    eingang: shallowRef<WkrEingang>({ kennung: 'MUSTERK7', n: 0, geraete: {} }),
    stop: () => {},
  } satisfies GeraeteHost
  return { host, setzeAufgaben, gibCode }
}

function mitDoppel(host: GeraeteHost): VueWrapper {
  const w = mount(BetriebView, { attachTo: document.body, global: { provide: { [storeKey as symbol]: store, [geraeteHostKey as symbol]: host } } })
  wrappers.push(w)
  return w
}

const eintrag = (id: string, name: string, aufgaben: Aufgabe[]): RegisterEintrag => ({ id, name, aufgaben, seit: 1, zuletzt: 1 })

describe('Betrieb → Geräte: WKR-Liste zuweisen (W3.2)', () => {
  it('Koppeln: Listen nach Parcours, ohne Maske gekennzeichnet; Code und QR mit Liste und Teil, „Für“ nennt beides', async () => {
    const { h, w } = await offen()
    const k = w.find('[data-teil="koppeln"]')
    const wahl = k.find('select[data-feld="koppeln-liste"]')
    // Gruppen je Parcours, Titel in Oberflächensprache; Bojen-Listen „Maske folgt – Papier“, Steg nicht.
    expect(wahl.findAll('optgroup').length).toBe(2)
    expect(wahl.find(`option[value='${STEG}']`).text()).toBe('Steg')
    // Seit W4.2 (21.11.2026) haben Bojen-Listen eine Maske; ohne bleiben Listen mit Zeitfeldern (W5).
    expect(wahl.find(`option[value='${GATE}']`).text()).toBe('Tor 1 / 3 / 5')
    expect(wahl.find(`option[value='${GATE}']`).attributes('data-ohne-maske')).toBeUndefined()
    expect(wahl.find(`option[value='${L('par_1', 'zeit')}']`).text()).toMatch(/\(Maske folgt – Papier\)$/)
    expect(wahl.find(`option[value='${L('par_1', 'zeit')}']`).attributes('data-ohne-maske')).toBe('')

    // Nur eine Liste genügt zum Koppeln (keine Freigabe).
    await wahl.setValue(STEG)
    expect(k.find('[data-hinweis="bereiche-fehlen"]').exists()).toBe(false)
    expect(k.find('[data-teil="koppeln-teil"]').exists()).toBe(true)
    await k.find('[data-wahl-teil="an"]').trigger('click')
    await k.find('[data-action="koppeln-code"]').trigger('click')
    await zeigt(() => !!h.raum.value?.koppeln.code)
    expect(h.raum.value!.koppeln.code!.aufgaben).toEqual([{ art: 'liste', liste: STEG, teil: 'an' }])
    expect(w.find('[data-teil="code-fuer"]').text()).toBe('Liste: Steg (Parcours 1, nur Anlegen)')

    // QR: Freigabe dazu, Liste ohne Teil (Tor 5 ist nicht geteilt – kein Teil-Wahl).
    await k.find('[data-teil="koppeln-bereiche"] input[data-bereich="par_2"]').setValue(true)
    await wahl.setValue(TOR5)
    expect(k.find('[data-teil="koppeln-teil"]').exists()).toBe(false)
    await k.find('[data-action="koppeln-qr"]').trigger('click')
    await zeigt(() => !!h.raum.value?.koppeln.qr && w.find('[data-teil="koppeln-qr"]').exists())
    expect(h.raum.value!.koppeln.qr!.aufgaben).toEqual([{ art: 'startfreigabe', bereiche: ['par_2'] }, { art: 'liste', liste: TOR5 }])
    expect(w.find('[data-teil="qr-fuer"]').text()).toMatch(/^Freigabe für: .+ · Liste: Tor 5 \(Parcours 1\)$/)
  })

  it('Geräteliste: Teil ändern, Liste dazu (höchstens zwei), entfernen – jeweils setzeAufgaben; Maske und Handy-Hinweis', async () => {
    const freigabe: Aufgabe = { art: 'startfreigabe', bereiche: ['par_1'] }
    const { host, setzeAufgaben } = hostDoppel([eintrag('gPad', 'Pad Steg', [freigabe, { art: 'liste', liste: STEG }]), eintrag('gHandy', 'iPhone', [{ art: 'liste', liste: TOR5 }])])
    const w = mitDoppel(host)
    await nextTick()
    const pad = w.find('.geraete-eintrag[data-geraet="gPad"]')
    const zeile = pad.find(`.geraete-liste-eintrag[data-liste='${STEG}']`)
    expect(zeile.find('[data-teil="liste-titel"]').text()).toBe('Steg (Parcours 1)')
    expect(zeile.find('[data-teil="liste-maske"]').text()).toBe('Maske: Knöpfe')
    expect(pad.find('[data-hinweis="nichts-frei"]').exists()).toBe(false)

    // Teil: nur Ablegen – die Freigabe bleibt vorn.
    await zeile.find('[data-wahl-teil="ab"]').trigger('click')
    expect(setzeAufgaben).toHaveBeenLastCalledWith('gPad', [freigabe, { art: 'liste', liste: STEG, teil: 'ab' }])

    // Zweite Liste dazu: Auswahl + Knopf; der Knopf erst nach der Wahl.
    expect(pad.find<HTMLButtonElement>('[data-action="liste-dazu"]').element.disabled).toBe(true)
    await pad.find('select[data-feld="liste-dazu"]').setValue(GATE)
    await pad.find('[data-action="liste-dazu"]').trigger('click')
    expect(setzeAufgaben).toHaveBeenLastCalledWith('gPad', [freigabe, { art: 'liste', liste: STEG }, { art: 'liste', liste: GATE }])

    // Das Register meldet zwei Listen: kein „dazu“ mehr, Hinweis höchstens zwei; Bojen-Liste „Maske folgt“.
    host.raum.value = { ...host.raum.value!, geraete: [eintrag('gPad', 'Pad Steg', [freigabe, { art: 'liste', liste: STEG }, { art: 'liste', liste: GATE }]), host.raum.value!.geraete[1]] }
    await nextTick()
    const pad2 = w.find('.geraete-eintrag[data-geraet="gPad"]')
    expect(pad2.find('select[data-feld="liste-dazu"]').exists()).toBe(false)
    expect(pad2.find('[data-hinweis="listen-voll"]').text()).toBe('Höchstens 2 Listen je Gerät.')
    expect(pad2.find('[data-hinweis="pad-zwei"]').exists()).toBe(true)
    expect(pad2.find(`.geraete-liste-eintrag[data-liste='${GATE}'] [data-teil="liste-maske"]`).text()).toBe('Maske: Knöpfe')

    // Entfernen.
    await pad2.find(`.geraete-liste-eintrag[data-liste='${STEG}'] [data-action="liste-entfernen"]`).trigger('click')
    expect(setzeAufgaben).toHaveBeenLastCalledWith('gPad', [freigabe, { art: 'liste', liste: GATE }])

    // Handy (Name = Geräteart): Hinweis „eine Liste“; Liste ohne Teilung hat keine Teil-Wahl.
    const handyEintrag = w.find('.geraete-eintrag[data-geraet="gHandy"]')
    expect(handyEintrag.find('[data-hinweis="handy-eine"]').text()).toContain('Handy: eine Liste')
    expect(handyEintrag.find(`.geraete-liste-eintrag[data-liste='${TOR5}'] [data-wahl-teil]`).exists()).toBe(false)
    // Freigabe umschalten behält die Liste.
    await handyEintrag.find('input[data-bereich="par_1"]').setValue(true)
    expect(setzeAufgaben).toHaveBeenLastCalledWith('gHandy', [{ art: 'startfreigabe', bereiche: ['par_1'] }, { art: 'liste', liste: TOR5 }])
    expect(setzeAufgaben).toHaveBeenCalledTimes(4)
  })

  it('Verweis mit Liste in der Adresse (`#/betrieb/geraete/<liste>`) wählt sie fürs Koppeln vor', async () => {
    location.hash = `#/betrieb/geraete/${encodeURIComponent(STEG)}`
    const { host, gibCode } = hostDoppel([])
    const w = mitDoppel(host)
    await nextTick()
    const wahl = w.find<HTMLSelectElement>('select[data-feld="koppeln-liste"]')
    expect(wahl.element.value).toBe(STEG)
    await w.find('[data-action="koppeln-code"]').trigger('click')
    expect(gibCode).toHaveBeenCalledWith([{ art: 'liste', liste: STEG }])
  })
})
