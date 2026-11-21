import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import GeraetApp from './GeraetApp.vue'
import { starteGeraeteHost, type GeraeteHost } from './geraete/host'
import { ABLAGE, type Ablage } from './geraete/ablage'
import type { Aufgabe } from './geraete/aufgaben'
import { formatiereCode } from './geraete/koppeln'
import { koppelnAdresse } from './geraete/paket'
import { nachgebauterBrowser } from './geraete/testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, SERVER } from './geraete/transport/ntfy/testNtfy'
import type { NtfyZeiten } from './geraete/transport/ntfy/leitung'
import { reducer, type Action } from './state/reducer'
import { setLocale } from './i18n'
import { vergissAlles } from './lib/merken'
import { betriebStarter, betriebsStand, festgeschrieben } from './testHilfen'
import { sichtOeffentlich } from './betrieb/sicht'
import { listenKennung } from './wkr/liste'
import { configFor } from './config/konfig'
import type { AppState } from './types'

/**
 * Start-Freigabe vom Handy (E7, Oberfläche): Bedienrechner (geraete/host.ts mit dispatch, nachgebauter Browser) →
 * nachgebauter ntfy (kein Netz) → src/GeraetApp.vue mit Koppel-Link bzw. `#/geraet` und eigenem Speicher wie ein Handy
 * (components/betrieb/GeraetFreigabe.vue mit derselben StartFreigabe wie am Bedienrechner). Starter erfunden
 * (testHilfen). Zählungen nach Zustand, nicht nach Nachrichten (unter Last kommen Wiederholungen dazu).
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }
const NUR_1: Aufgabe[] = [{ art: 'startfreigabe', bereiche: ['par_1'] }]
const NUR_2: Aufgabe[] = [{ art: 'startfreigabe', bereiche: ['par_2'] }]

const hosts: GeraeteHost[] = []
const wrappers: VueWrapper[] = []

beforeEach(() => {
  vergissAlles()
  setLocale('de')
  neuesNtfy()
  vi.stubGlobal('WebSocket', NachgebauterSocket)
  vi.stubGlobal('fetch', nachgebautesFetch)
})

afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  for (const h of hosts.splice(0)) h.stop()
  vi.unstubAllGlobals()
  location.hash = ''
  document.title = ''
  document.body.innerHTML = ''
})

function handy(): Ablage & { daten: Map<string, string> } {
  const daten = new Map<string, string>()
  return { daten, getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => void daten.set(k, String(v)), removeItem: (k) => void daten.delete(k) }
}

/** Ein Bedienrechner mit offenem, verbundenem Raum und dispatch (wendet Geräte-Actions an). */
async function bedienrechner(start: AppState = festgeschrieben(betriebsStand())) {
  const state = shallowRef<AppState>({ ...start, kennung: 'MUSTERK7', geraeteServer: SERVER })
  let uhr = 10_000
  const dispatch = (action: Action) => {
    uhr += 1000
    state.value = reducer(state.value, { ...action, zeit: action.zeit ?? uhr } as Action)
  }
  const f = nachgebauterBrowser().fenster()
  const h = starteGeraeteHost({ state, dispatch }, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, endeWartenMs: 2000, koppelTaktMs: 50 })
  hosts.push(h)
  h.oeffne()
  await bis(() => h.verbindung.value?.status === 'verbunden')
  return { state, h }
}

function geraet(hash: string, speicher: Ablage = handy()): VueWrapper {
  location.hash = hash
  const w = mount(GeraetApp, { attachTo: document.body, props: { umgebung: { ablage: speicher, zeiten: SCHNELL, ablaufTaktMs: 20 } } })
  wrappers.push(w)
  return w
}

async function zeigt(bedingung: () => boolean, ms = 3000): Promise<void> {
  await bis(bedingung, ms)
  await nextTick()
}

const lage = (w: VueWrapper) => w.find('.geraet-freigabe').attributes('data-lage')
const karte = (w: VueWrapper, bereich: string) => w.find(`.betrieb-karte[data-bereich="${bereich}"]`)
const begonnen = (s: AppState, bereich: string) => s.betrieb.bereiche[bereich]?.begonnen ?? []

/** Code ausgeben, Koppel-Link öffnen, Code tippen – bis die Start-Freigabe dasteht. */
async function mitCode(h: GeraeteHost, aufgaben: Aufgabe[], speicher: Ablage = handy()) {
  h.gibCode(aufgaben)
  await bis(() => !!h.raum.value?.koppeln.code && h.raum.value.koppeln.code.benutzt === null)
  const code = h.raum.value!.koppeln.code!.wert
  const w = geraet(koppelnAdresse(h.raum.value!.koppelLink), speicher)
  await zeigt(() => w.find('[data-teil="koppeln"] input[data-feld="code"]').exists())
  await w.find('input[data-feld="code"]').setValue(formatiereCode(code).toLowerCase())
  await w.find('input[data-feld="name"]').setValue('Steg Nord')
  await w.find('.geraet-koppel-form').trigger('submit')
  await zeigt(() => lage(w) === 'gekoppelt' && w.find('.betrieb-karte').exists())
  return { w, code, speicher }
}

describe('Gerät: koppeln', () => {
  it('Koppel-Link + Geräte-Code: Adresse ohne Paket, nur der eigene Bereich, ohne „Meldung auf allen“', async () => {
    const { h } = await bedienrechner()
    const { w } = await mitCode(h, NUR_1)
    // Das Paket ist aus der Adresse (Verlauf, Lesezeichen); die Kopplung liegt gerätelokal.
    expect(location.hash).toBe('#/geraet')
    expect(karte(w, 'par_1').exists()).toBe(true)
    expect(karte(w, 'par_2').exists()).toBe(false)
    expect(w.find('[data-action="meldung-alle"]').exists()).toBe(false)
    expect(w.find('[data-action="betrieb-zuruecksetzen"]').exists()).toBe(false)
    expect(w.find('[data-teil="leiste"] [data-action="entkoppeln"]').exists()).toBe(true)
    expect(w.find('[data-teil="fingerabdruck"]').text()).toContain('Fingerabdruck')
    await bis(() => h.raum.value!.geraete.some((g) => g.name === 'Steg Nord'))
    expect(document.title).toContain('Start-Freigabe')
  })

  it('Befund 6: Koppel-Link ohne Token nennt den QR-Code am Bedienrechner; gescannter QR-Code braucht den Hinweis nicht', async () => {
    const { h } = await bedienrechner()
    const w = geraet(koppelnAdresse(h.raum.value!.koppelLink))
    await zeigt(() => w.find('input[data-feld="code"]').exists())
    expect(w.find('[data-teil="ohne-token"]').text()).toContain('„QR-Code zeigen“')
    expect(w.find('[data-teil="ohne-token"]').text()).toContain('Geräte-Code eingeben')
    h.oeffneQr(NUR_2)
    await bis(() => !!h.raum.value?.koppeln.qr)
    const w2 = geraet(koppelnAdresse(h.raum.value!.koppeln.qr!.paket))
    await zeigt(() => karte(w2, 'par_2').exists())
    expect(w2.find('[data-teil="ohne-token"]').exists()).toBe(false)
  })

  it('kein Code-Format: Hinweis, nichts gesendet', async () => {
    const { h } = await bedienrechner()
    const w = geraet(koppelnAdresse(h.raum.value!.koppelLink))
    await zeigt(() => w.find('input[data-feld="code"]').exists())
    await w.find('input[data-feld="code"]').setValue('AB')
    await w.find('.geraet-koppel-form').trigger('submit')
    expect(w.find('[data-teil="code-falsch"]').exists()).toBe(true)
    expect(lage(w)).toBe('ungekoppelt')
  })

  it('ein schon benutzter Code: abgelehnt, mit Grund als Satz', async () => {
    const { h } = await bedienrechner()
    const { code } = await mitCode(h, NUR_1)
    const w2 = geraet(koppelnAdresse(h.raum.value!.koppelLink))
    await zeigt(() => w2.find('input[data-feld="code"]').exists())
    await w2.find('input[data-feld="code"]').setValue(code)
    await w2.find('.geraet-koppel-form').trigger('submit')
    await zeigt(() => w2.find('[data-teil="abgelehnt"]').exists())
    expect(w2.find('[data-teil="abgelehnt"]').attributes('data-grund')).toBe('code-abgelaufen')
    expect(w2.find('[data-teil="abgelehnt"]').text()).toContain('abgelaufen oder schon benutzt')
    // Das Formular bleibt für einen neuen Code.
    expect(w2.find('input[data-feld="code"]').exists()).toBe(true)
  })

  it('QR-Code: koppelt ohne Eingabe, mit den Rechten der QR-Sitzung', async () => {
    const { h } = await bedienrechner()
    h.oeffneQr(NUR_2)
    await bis(() => !!h.raum.value?.koppeln.qr)
    const w = geraet(koppelnAdresse(h.raum.value!.koppeln.qr!.paket))
    await zeigt(() => karte(w, 'par_2').exists())
    expect(karte(w, 'par_1').exists()).toBe(false)
    expect(location.hash).toBe('#/geraet')
    await bis(() => h.raum.value!.geraete.length === 1)
  })

  it('englisch: Formular und Start-Freigabe ohne deutsche Wörter', async () => {
    setLocale('en')
    const { h } = await bedienrechner()
    const { w } = await mitCode(h, NUR_1)
    expect(document.title).toContain('Start release')
    expect(w.find('[data-teil="leiste"] [data-action="entkoppeln"]').text()).toBe('Unpair device')
    for (const wort of ['Gerät', 'Start-Freigabe', 'Wird gesendet', 'Bedienrechner', 'Koppeln', 'entkoppeln']) expect(w.text()).not.toContain(wort)
  })

  it('#/geraet ohne Kopplung: Hinweis, wie man koppelt', async () => {
    const w = geraet('#/geraet')
    await nextTick()
    expect(w.find('.geraet-meldung').attributes('data-meldung')).toBe('ohne')
    expect(w.text()).toContain('nicht gekoppelt')
  })
})

describe('Gerät: Start-Freigabe vom Handy', () => {
  it('Knöpfe schalten am Bedienrechner; gesperrt bis zur Quittung', async () => {
    const { h, state } = await bedienrechner()
    const { w } = await mitCode(h, NUR_1)
    await karte(w, 'par_1').find('[data-action="beginnen"]').trigger('click')
    // Sofort gesperrt: Ein zweiter Klick ginge nicht durch.
    await nextTick()
    expect(w.find('fieldset.geraet-sperre').attributes('disabled')).toBeDefined()
    expect(w.find('[data-teil="sendet"]').text()).toContain('Wird gesendet')
    await zeigt(() => begonnen(state.value, 'par_1').length === 1 && w.find('fieldset.geraet-sperre').attributes('disabled') === undefined)
    expect(begonnen(state.value, 'par_1')).toEqual(['lauf:1'])

    // „Nächster Start“ aus der empfangenen Sicht.
    await zeigt(() => karte(w, 'par_1').find<HTMLButtonElement>('[data-action="zeigen"]').element.disabled === false)
    await karte(w, 'par_1').find('[data-action="zeigen"]').trigger('click')
    await zeigt(() => (state.value.betrieb.bereiche.par_1?.gezeigt.length ?? 0) > 0)
    // Was am Bedienrechner gezeigt ist, kommt über die Sicht zurück aufs Handy.
    await zeigt(() => karte(w, 'par_1').find('[data-teil="imboot"] .betrieb-nr').exists())
    expect(begonnen(state.value, 'par_2')).toEqual([])
  })

  it('Rechte ändern wirkt sofort; Entzug: Hinweis, nur lesend, neu koppeln möglich', async () => {
    const { h } = await bedienrechner()
    const { w } = await mitCode(h, NUR_1)
    const id = h.raum.value!.geraete[0].id
    h.setzeAufgaben(id, NUR_2)
    await zeigt(() => karte(w, 'par_2').exists() && !karte(w, 'par_1').exists())

    h.entziehe(id)
    await zeigt(() => lage(w) === 'entzogen')
    expect(w.find('[data-teil="entzogen"]').text()).toContain('entzogen')
    expect(w.find('.betrieb-karte').exists()).toBe(false)
    expect(w.findAll('.geraet-lesend-bereich').length).toBe(2)
    expect(w.find('details[data-teil="koppeln"]').exists()).toBe(true)
    await bis(() => h.raum.value!.geraete.length === 0 && h.raum.value!.entzogen.length === 1)
  })

  it('Selbstanmeldung nach dem Neuladen bei ausgeschaltetem Bedienrechner: „Verbinde …“, Knöpfe frei (Prüfung E7)', async () => {
    const { h } = await bedienrechner()
    const { w, speicher } = await mitCode(h, NUR_1)
    w.unmount()
    wrappers.splice(wrappers.indexOf(w), 1)
    hosts.splice(hosts.indexOf(h), 1)
    h.stop()

    const w2 = geraet('#/geraet', speicher)
    await zeigt(() => karte(w2, 'par_1').exists() && w2.find('[data-teil="verbinde"]').exists())
    // Niemand hat etwas gedrückt: kein „Wird gesendet …“, nichts gesperrt.
    expect(w2.find('[data-teil="sendet"]').exists()).toBe(false)
    expect(w2.find('fieldset.geraet-sperre').attributes('disabled')).toBeUndefined()
    expect(w2.find('[data-teil="verbinde"]').text()).toContain('Verbinde mit dem Bedienrechner')
  })

  it('Neuladen: #/geraet findet die Kopplung wieder; „Gerät entkoppeln“ löscht sie', async () => {
    const { h } = await bedienrechner()
    const { w, speicher } = await mitCode(h, NUR_1)
    w.unmount()
    wrappers.splice(wrappers.indexOf(w), 1)

    const w2 = geraet('#/geraet', speicher)
    await zeigt(() => karte(w2, 'par_1').exists())
    await w2.find('[data-action="entkoppeln"]').trigger('click')
    await w2.find('[data-action="entkoppeln-ja"]').trigger('click')
    await nextTick()
    expect(w2.find('.geraet-meldung').attributes('data-meldung')).toBe('entkoppelt')
    expect(speicher.getItem(ABLAGE.kopplung)).toBeNull()
  })
})

describe('Gerät: Stand der WKR-Erfassung in der Start-Freigabe (W2.4)', () => {
  it('Leiste und Rückstand aus der Freigabe-Gruppe; „nachfragen“ fragt auch auf dem Handy, gesperrt wird nie', async () => {
    const starter = Array.from({ length: 6 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))
    const { state, h } = await bedienrechner(festgeschrieben(betriebsStand(starter)))
    const TOR = listenKennung({ bereich: 'par_1', typeId: 'gate135', racecourse: null })
    const TITEL = configFor({ regelwerk: 'dm-2026' }).getSheetDef('gate135').title
    const dispatch = (a: Action) => (state.value = reducer(state.value, { ...a, zeit: 20_000 } as Action))
    dispatch({ type: 'BETRIEB_BEGINNEN', bereich: 'par_1', punkt: 'lauf:1' })
    dispatch({ type: 'WKR_LISTE', liste: TOR, modus: 'digital' })
    // „nachfragen“ ist seit dem Feldtest 21.11.2026 die Vorgabe (N8) – kein SET_ANZEIGE nötig.
    const zeigeAmHost = () => {
      const b = sichtOeffentlich(state.value).bereiche.find((x) => x.id === 'par_1')!
      dispatch({ type: 'BETRIEB_ZEIGEN', bereich: 'par_1', ref: b.offen[0].key, vorher: b.aktuell?.key ?? null })
    }
    for (let i = 0; i < 3; i++) zeigeAmHost()
    const { w } = await mitCode(h, NUR_1)
    await zeigt(() => karte(w, 'par_1').find('[data-teil="wkr-rueckstand"]').exists())
    const feld = karte(w, 'par_1').find(`[data-teil="wkr-leiste"] [data-liste="${TITEL}"]`)
    // Ohne Gerät an der Liste sendet niemand: ✕ rot „kein Gerät · wartet 3“ statt „⧗ wartet“ (Prüfbefund 21.11.2026).
    expect(feld.text()).toContain('kein Gerät · wartet 3')
    expect(feld.attributes('data-erf')).toBe('weg')
    expect(feld.attributes('data-rot')).toBeDefined()
    // Auf dem Handy kein Sprung zum Unterreiter (kein Knopf), keine Gerätenamen.
    expect(karte(w, 'par_1').find('[data-action="zur-erfassung"]').exists()).toBe(false)
    expect(karte(w, 'par_1').find('[data-teil="wkr-leiste"]').classes()).not.toContain('klickbar')
    expect(karte(w, 'par_1').find('[data-teil="naechster"]').classes()).toContain('betrieb-naechster--rueckstand')
    const vorher = state.value.betrieb.bereiche.par_1.gezeigt.length
    await karte(w, 'par_1').find('[data-action="zeigen"]').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).not.toBeNull()
    // N10: der Satz mit Liste und Startnummern auch auf dem Handy.
    expect(document.querySelector('[data-teil="frage-liste"]')!.textContent).toContain(`${TITEL} hat 101–103 noch nicht abgeschickt (3 Starts).`)
    expect(state.value.betrieb.bereiche.par_1.gezeigt.length).toBe(vorher)
    ;(document.querySelector('[data-action="trotzdem-freigeben"]') as HTMLButtonElement).click()
    await bis(() => state.value.betrieb.bereiche.par_1.gezeigt.length === vorher + 1)
  })

  it('N8 auf dem Handy: schon EIN offener Start fragt mit seiner Nummer; abgeschickt → ✓, Zeigen ohne Frage', async () => {
    const starter = Array.from({ length: 6 }, (_, i) => betriebStarter(`m${i + 1}`, '1', String(101 + i)))
    const { state, h } = await bedienrechner(festgeschrieben(betriebsStand(starter)))
    const TOR = listenKennung({ bereich: 'par_1', typeId: 'gate135', racecourse: null })
    const TITEL = configFor({ regelwerk: 'dm-2026' }).getSheetDef('gate135').title
    const dispatch = (a: Action) => (state.value = reducer(state.value, { ...a, zeit: 20_000 } as Action))
    dispatch({ type: 'BETRIEB_BEGINNEN', bereich: 'par_1', punkt: 'lauf:1' })
    dispatch({ type: 'WKR_LISTE', liste: TOR, modus: 'digital' })
    for (let i = 0; i < 3; i++) {
      const b = sichtOeffentlich(state.value).bereiche.find((x) => x.id === 'par_1')!
      dispatch({ type: 'BETRIEB_ZEIGEN', bereich: 'par_1', ref: b.offen[0].key, vorher: b.aktuell?.key ?? null })
    }
    // „Abgeschickt“ wie vom WKR-Gerät: der Haken der Liste in der Erfassung (DM, Lauf 1 Manövrieren).
    const erfasse = (nr: string) => {
      const id = state.value.starters.find((x) => x.startNr === nr)!.id
      dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: 'manoevrieren/1', starter: id, feld: 'erfasst@gate135', wert: '1' }] } as Action)
    }
    erfasse('101')
    erfasse('102')
    const { w } = await mitCode(h, NUR_1)
    const feld = () => karte(w, 'par_1').find(`[data-teil="wkr-leiste"] [data-liste="${TITEL}"]`)
    await zeigt(() => feld().exists() && feld().text().includes('wartet 1'))
    await karte(w, 'par_1').find('[data-action="zeigen"]').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-teil="frage-liste"]')!.textContent!.trim()).toBe(`${TITEL} hat 103 noch nicht abgeschickt.`)
    ;(document.querySelector('[data-action="trotzdem-nein"]') as HTMLButtonElement).click()
    await nextTick()
    erfasse('103')
    await zeigt(() => feld().attributes('data-erf') === 'fertig')
    expect(feld().find('.wkr-leiste-erf').text()).toBe('✓')
    const vorher = state.value.betrieb.bereiche.par_1.gezeigt.length
    await karte(w, 'par_1').find('[data-action="zeigen"]').trigger('click')
    await nextTick()
    expect(document.querySelector('[data-dialog="trotzdem-freigeben"]')).toBeNull()
    await bis(() => state.value.betrieb.bereiche.par_1.gezeigt.length === vorher + 1)
  })
})
