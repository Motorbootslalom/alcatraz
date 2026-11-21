import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import GeraetApp from './GeraetApp.vue'
import { starteGeraeteHost, type GeraeteHost } from './geraete/host'
import type { Ablage } from './geraete/ablage'
import type { Aufgabe } from './geraete/aufgaben'
import { formatiereCode } from './geraete/koppeln'
import { koppelnAdresse } from './geraete/paket'
import { nachgebauterBrowser } from './geraete/testBrowser'
import { bis, NachgebauterSocket, nachgebautesFetch, neuesNtfy, ruhe, SERVER } from './geraete/transport/ntfy/testNtfy'
import type { NtfyZeiten } from './geraete/transport/ntfy/leitung'
import { reducer, type Action } from './state/reducer'
import { PARALLEL_BEREICH, refKey } from './betrieb/folge'
import { setLocale } from './i18n'
import { vergissAlles } from './lib/merken'
import { uimParallelStand } from './testHilfen'
import type { AppState } from './types'

/**
 * Start-Freigabe vom Handy im Parallelslalom (UIM, Etappe E8 20.11.2026): src/GeraetApp.vue mit Koppel-Link und eigenem
 * Speicher wie ein Handy (components/betrieb/GeraetFreigabe.vue) gegen einen Bedienrechner (geraete/host.ts) über den
 * nachgebauten ntfy. Paare mit Racecourse A und B, Paar als Einheit, Sperre bis zur Quittung, „Keine Bestätigung“ nach
 * 10 s. Starter erfunden (testHilfen). Zählungen nach Zustand, nicht nach Nachrichten.
 */

const SCHNELL: Partial<NtfyZeiten> = { abstandMs: 0, wiederholenMs: [20], zuVieleMs: 30, neuVerbindenMs: [10], quittungMs: 150, einstiegAbstandMs: 0 }
const P = PARALLEL_BEREICH
const NUR_PARALLEL: Aufgabe[] = [{ art: 'startfreigabe', bereiche: [P] }]
const paar = (attempt: 1 | 2, a: string | null, b: string | null) => refKey({ art: 'p', runde: 'pre', attempt, a, b })

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
  vi.useRealTimers()
  vi.unstubAllGlobals()
  location.hash = ''
  document.title = ''
  document.body.innerHTML = ''
})

function handy(): Ablage {
  const daten = new Map<string, string>()
  return { getItem: (k) => daten.get(k) ?? null, setItem: (k, v) => void daten.set(k, String(v)), removeItem: (k) => void daten.delete(k) }
}

/** Ein Bedienrechner (UIM, Vorlauf festgeschrieben) mit offenem, verbundenem Raum; `neu()` = ein neues Fenster desselben Rechners. */
async function bedienrechner() {
  const state = shallowRef<AppState>({ ...uimParallelStand(), kennung: 'MUSTERE8', geraeteServer: SERVER })
  let uhr = 10_000
  const dispatch = (action: Action) => {
    uhr += 1000
    state.value = reducer(state.value, { ...action, zeit: action.zeit ?? uhr } as Action)
  }
  const b = nachgebauterBrowser()
  const starte = () => {
    const f = b.fenster()
    const h = starteGeraeteHost({ state, dispatch }, { ablage: f.ablage, fenster: f.fenster, fuehrung: f.fuehrung, bus: f.bus, zeiten: SCHNELL, sammelnMs: 0, endeWartenMs: 2000, koppelTaktMs: 50 })
    hosts.push(h)
    return h
  }
  const h = starte()
  h.oeffne()
  await bis(() => h.verbindung.value?.status === 'verbunden')
  return { state, h, neu: starte }
}

// Grenze wie bis() (10 s, Prüfung unter Last 21.11.2026): Vorher 3 s – auf zwei Kernen mit voller Suite lief z. B.
// GeraetWkr „Probe … einmal je Raum“ hinein. Ein grüner Test wartet nicht länger.
async function zeigt(bedingung: () => boolean): Promise<void> {
  await bis(bedingung)
  await nextTick()
}

const karte = (w: VueWrapper, bereich: string) => w.find(`.betrieb-karte[data-bereich="${bereich}"]`)
const gesperrt = (w: VueWrapper) => w.find('fieldset.geraet-sperre').attributes('disabled') !== undefined
const seiten = (w: VueWrapper, teil: 'imboot' | 'naechster') =>
  karte(w, P)
    .findAll(`[data-teil="${teil}"] .betrieb-seite`)
    .map((x): [string, string] => [x.attributes('data-racecourse') ?? '', x.text().replace(/\s+/g, ' ').trim()])

async function mitCode(h: GeraeteHost, aufgaben: Aufgabe[]) {
  h.gibCode(aufgaben)
  await bis(() => !!h.raum.value?.koppeln.code && h.raum.value.koppeln.code.benutzt === null)
  const code = h.raum.value!.koppeln.code!.wert
  location.hash = koppelnAdresse(h.raum.value!.koppelLink)
  const w = mount(GeraetApp, { attachTo: document.body, props: { umgebung: { ablage: handy(), zeiten: SCHNELL, ablaufTaktMs: 20 } } })
  wrappers.push(w)
  await zeigt(() => w.find('input[data-feld="code"]').exists())
  await w.find('input[data-feld="code"]').setValue(formatiereCode(code))
  await w.find('input[data-feld="name"]').setValue('Steg Parallel')
  await w.find('.geraet-koppel-form').trigger('submit')
  await zeigt(() => w.find('.geraet-freigabe').attributes('data-lage') === 'gekoppelt' && w.find('.betrieb-karte').exists())
  return w
}

/** Knopf der Karte drücken und warten, bis die Quittung die Sperre wieder löst. */
async function druecke(w: VueWrapper, action: string) {
  await karte(w, P).find(`[data-action="${action}"]`).trigger('click')
  await nextTick()
  expect(gesperrt(w)).toBe(true)
  await zeigt(() => !gesperrt(w))
}

describe('Gerät: Start-Freigabe im Parallelslalom (UIM, E8)', () => {
  it('nur die Karte des Parallelslaloms; Paare mit Racecourse A und B; Zurückstellen nimmt das Paar; gesperrt bis zur Quittung', async () => {
    const { h, state } = await bedienrechner()
    const w = await mitCode(h, NUR_PARALLEL)
    expect(karte(w, 'par_1').exists()).toBe(false)
    // Umstellen gibt es im Parallelslalom nicht – der Hinweis statt „Klassen aussetzen“, wie am Bedienrechner.
    expect(karte(w, P).find('[data-hinweis="parallel"]').exists()).toBe(true)
    expect(karte(w, P).find('[data-teil="klassen"]').exists()).toBe(false)

    await druecke(w, 'beginnen')
    expect(state.value.betrieb.bereiche[P].begonnen).toEqual(['runde:pre'])
    await zeigt(() => seiten(w, 'naechster').length === 2)
    expect(seiten(w, 'naechster').map(([rc]) => rc)).toEqual(['A', 'B'])

    await druecke(w, 'zeigen')
    await zeigt(() => seiten(w, 'imboot').length === 2)
    expect(seiten(w, 'imboot').map(([rc, text]) => [rc, text.includes('E01'), text.includes('E02')])).toEqual([
      ['A', true, false],
      ['B', false, true],
    ])
    await zeigt(() => seiten(w, 'naechster')[0]?.[1].includes('E02') === true)
    await druecke(w, 'zeigen')
    // Dolphin 3 gegen den Dummy: die Seite B ist leer.
    await zeigt(() => seiten(w, 'naechster')[0]?.[1].includes('E03') === true)
    expect(seiten(w, 'naechster')[1][1]).toContain('leer')

    await druecke(w, 'zurueckstellen')
    expect(state.value.betrieb.bereiche[P].zurueckgestellt).toEqual([paar(1, 'E-3', null), paar(2, null, 'E-3')])
    await zeigt(() => karte(w, P).findAll('[data-teil="zurueckgestellt"] li').length === 2)
    expect(w.find('[data-teil="rueckmeldung"]').exists()).toBe(false)
  })

  it('Bedienrechner antwortet nicht: „Wird gesendet …“, nach 10 s „Keine Bestätigung“, gesperrt; kommt er wieder, frei', async () => {
    const { h, state, neu } = await bedienrechner()
    const w = await mitCode(h, NUR_PARALLEL)
    await druecke(w, 'beginnen')
    await zeigt(() => karte(w, P).find<HTMLButtonElement>('[data-action="zeigen"]').element.disabled === false)

    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], shouldAdvanceTime: true })
    hosts.splice(hosts.indexOf(h), 1)
    h.stop()
    await karte(w, P).find('[data-action="zeigen"]').trigger('click')
    await nextTick()
    expect(gesperrt(w)).toBe(true)
    expect(w.find('[data-teil="sendet"]').attributes('data-ohne-quittung')).toBe('false')
    expect(w.find('[data-teil="sendet"]').text()).toContain('Wird gesendet')

    await vi.advanceTimersByTimeAsync(11_000)
    await zeigt(() => w.find('[data-teil="sendet"]').attributes('data-ohne-quittung') === 'true')
    expect(gesperrt(w)).toBe(true)
    expect(w.find('[data-teil="sendet"]').text()).toContain('Keine Bestätigung')
    expect(state.value.betrieb.bereiche[P].gezeigt).toHaveLength(0)

    // Der Bedienrechner kommt wieder: holt die Action nach, wendet sie einmal an, quittiert – die Knöpfe sind frei.
    neu()
    await zeigt(() => !gesperrt(w))
    expect(state.value.betrieb.bereiche[P].gezeigt.map((x) => x.ref)).toEqual([paar(1, 'E-1', 'E-2')])
    expect(w.find('[data-teil="sendet"]').exists()).toBe(false)
    await ruhe(50)
    expect(state.value.betrieb.bereiche[P].gezeigt).toHaveLength(1)
  })
})
