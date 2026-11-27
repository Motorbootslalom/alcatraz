import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import EventView from './EventView.vue'
import ListsView from './ListsView.vue'
import SettingsView from './SettingsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { reducer } from '../state/reducer'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import { configFor } from '../config/konfig'
import { sichtOeffentlich, sichtZuschauer } from '../betrieb/sicht'
import { sichtListe } from '../wkr/sicht'
import { erfassungsLage } from '../wkr/lage'
import { sichtFreigabe } from '../wkr/freigabe'
import { parcoursAmpel } from '../wkr/ampel'
import { listenKennung, type Liste } from '../wkr/liste'
import { BETRIEB_STARTER, wkrBetriebsStand, zeigeNaechsten } from '../testHilfen'
import type { ClassId, Starter } from '../types'

// Co-Pilot und Ersatz-Co-Pilot je Klasse, je Person optional mit Gewicht, und ihr Ausgleichsgewicht in Klammern auf
// den Listen (Antwort des Nutzers vom 26.11.2026, R11-07). Alle Namen und Gewichte sind erfunden.

function starter(klassen: ClassId[], n: number): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: 'Musterclub',
      bundesland: 'Bayern',
      land: 'Estland',
      geburtsdatum: '2014-05-01',
      groesse: '',
      klasse,
    })),
  )
}
const mounte = (view: typeof ListsView, store: Store) => mount(view, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
const koepfe = (wrapper: VueWrapper) => wrapper.findAll('.listen-seite[data-seite="1"] .sheet-title-box').map((b) => b.findAll('[data-feld]').map((f) => f.text().replace(/\s+/g, ' ')).join(' | '))
async function steg(wrapper: VueWrapper) {
  await wrapper.find('.list-kinds button[data-kind="gewicht"]').trigger('click')
  await nextTick()
  await wrapper.find('.gewicht-arten button[data-art="steg"]').trigger('click')
  await nextTick()
}

describe('Co-Piloten mit Ersatz und Gewicht (R11-07)', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal', eventJahr: 2026 } })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['E', '1'], 2) })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
    location.hash = ''
  })

  it('Besetzung: je Klasse Co-Pilot und Ersatz mit Gewicht; daneben das Ausgleichsgewicht, „Gewicht fehlt“ und der Verweis auf die Wahl', async () => {
    const wrapper = mounte(EventView, store)
    const feld = (name: string) => wrapper.find(`[data-block="besetzung"] input[data-feld="${name}"]`)
    expect(wrapper.findAll('.besetzung-tabelle thead th').map((th) => th.text())).toEqual(['Klasse', 'Boot', 'Co-Pilot', 'Gewicht', 'Ersatz-Co-Pilot', 'Gewicht'])
    await feld('coPilot|E').setValue('Vor1 Nach1')
    await feld('ersatz|E').setValue('Vor2 Nach2')
    // Gewicht wie in der Verwiegung: Komma, „kg“ darf dabei stehen; das Feld zeigt danach, was gilt.
    await feld('coPilotKg|E').setValue('78,2 kg')
    await feld('coPilotKg|E').trigger('change')
    expect((feld('coPilotKg|E').element as HTMLInputElement).value).toBe('78,2')
    // Noch ohne Gewicht des Ersatzes: „Gewicht fehlt“, beim schwersten nichts.
    expect(wrapper.find('[data-ag="E|ersatz"]').text()).toBe('Gewicht fehlt')
    expect(wrapper.find('[data-ag="E|haupt"]').exists()).toBe(false)
    await feld('ersatzKg|E').setValue('74.6')
    await feld('ersatzKg|E').trigger('change')
    expect(store.state.value.coPiloten).toEqual({ E: { haupt: { name: 'Vor1 Nach1', gewicht: 78.2 }, ersatz: { name: 'Vor2 Nach2', gewicht: 74.6 } } })
    expect(wrapper.find('[data-ag="E|ersatz"]').text()).toBe('+4 kg Ausgleich')
    // Unlesbares entfernt das Gewicht; der Name bleibt.
    await feld('ersatzKg|E').setValue('schwer')
    await feld('ersatzKg|E').trigger('change')
    expect(store.state.value.coPiloten.E?.ersatz).toEqual({ name: 'Vor2 Nach2' })
    expect((feld('ersatzKg|E').element as HTMLInputElement).value).toBe('')
    // Der Satz nennt die Wahl und führt in die Einstellungen.
    expect(wrapper.find('[data-hinweis="co-pilot-ausgleich"]').text()).toContain('je Klasse')
    expect(wrapper.find('[data-verweis="co-pilot-ausgleich"]').attributes('href')).toBe('#/einstellungen?durchschnittsgewichte')
    wrapper.unmount()
  })

  it('Besetzung „über alle“: Bezug aus den fahrenden Klassen; ein Gewicht ohne Namen zählt erst mit Namen (Prüfbefund 27.11.2026)', async () => {
    store.dispatch({ type: 'SET_CO_PILOT_AUSGLEICH', ausgleich: 'alle' })
    store.dispatch({ type: 'SET_CO_PILOT', klasse: 'E', text: 'Vor1 Nach1' })
    store.dispatch({ type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'haupt', gewicht: 70 })
    store.dispatch({ type: 'SET_CO_PILOT', klasse: '1', text: 'Vor3 Nach3' })
    store.dispatch({ type: 'SET_CO_PILOT_GEWICHT', klasse: '1', rolle: 'haupt', gewicht: 90 })
    // Klasse 3 hat keine Starter: Ihr schwerer Co-Pilot zieht den Bezug nicht hoch.
    store.dispatch({ type: 'SET_CO_PILOT', klasse: '3', text: 'Vor5 Nach5' })
    store.dispatch({ type: 'SET_CO_PILOT_GEWICHT', klasse: '3', rolle: 'haupt', gewicht: 110 })
    const wrapper = mounte(EventView, store)
    expect(wrapper.find('[data-hinweis="co-pilot-ausgleich"]').text()).toContain('über alle Klassen')
    expect(wrapper.find('[data-ag="E|haupt"]').text()).toBe('+20 kg Ausgleich')
    expect(wrapper.find('[data-ag="1|haupt"]').exists()).toBe(false)
    // Der Ersatz fällt weg: Name gelöscht, das Gewicht bleibt stehen – zählt aber nicht mehr.
    store.dispatch({ type: 'SET_CO_PILOT', klasse: 'E', text: 'Vor2 Nach2', rolle: 'ersatz' })
    store.dispatch({ type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'ersatz', gewicht: 95 })
    await nextTick()
    expect(wrapper.find('[data-ag="1|haupt"]').text()).toBe('+5 kg Ausgleich')
    await wrapper.find('[data-block="besetzung"] input[data-feld="ersatz|E"]').setValue('')
    expect(store.state.value.coPiloten.E?.ersatz).toEqual({ name: '', gewicht: 95 })
    expect(wrapper.find('[data-ag="E|ersatz"]').text()).toBe('zählt erst mit Namen')
    expect(wrapper.find('[data-ag="1|haupt"]').exists()).toBe(false)
    expect(wrapper.find('[data-ag="E|haupt"]').text()).toBe('+20 kg Ausgleich')
    wrapper.unmount()
  })

  it('Besetzung: Enter geht die Spalten hinunter – Boote, Co-Piloten, ihre Gewichte, Ersatz, dessen Gewichte', async () => {
    const wrapper = mounte(EventView, store)
    const spalte = (name: string) => wrapper.findAll(`[data-block="besetzung"] input[data-spalte="${name}"]`)
    const enter = async (name: string, i: number) => {
      const feld = spalte(name).at(i)!
      ;(feld.element as HTMLInputElement).focus()
      await feld.trigger('keydown', { key: 'Enter' })
      return document.activeElement
    }
    expect(await enter('coPilot', 0)).toBe(spalte('coPilot')[1].element)
    for (const [von, nach] of [['boot', 'coPilot'], ['coPilot', 'coPilotKg'], ['coPilotKg', 'ersatz'], ['ersatz', 'ersatzKg']]) {
      expect(await enter(von, -1), `${von} → ${nach}`).toBe(spalte(nach)[0].element)
    }
    // Im letzten Feld der letzten Spalte bleibt der Fokus stehen.
    expect(await enter('ersatzKg', -1)).toBe(spalte('ersatzKg').at(-1)!.element)
    wrapper.unmount()
  })

  it('Einstellungen: „je Klasse“ (Vorgabe) oder „über alle Co-Piloten“ – im Abschnitt Durchschnittsgewichte', async () => {
    const wrapper = mounte(SettingsView, store)
    const wahl = wrapper.find('[data-feld="co-pilot-ausgleich"]')
    expect(wahl.element.closest('#gewichte')).not.toBeNull()
    expect((wahl.find('input[data-wert="klasse"]').element as HTMLInputElement).checked).toBe(true)
    await wahl.find('input[data-wert="alle"]').setValue(true)
    expect(store.state.value.coPilotAusgleich).toBe('alle')
    expect(wrapper.find('[data-hinweis="co-pilot-ausgleich"] a').attributes('href')).toBe('#/veranstaltung?besetzung')
    wrapper.unmount()
  })

  it('Ausgleichsgewichte: beide Co-Piloten untereinander im Kopf, das Ausgleichsgewicht in Klammern – nie das Körpergewicht', async () => {
    store.dispatch({ type: 'SET_CO_PILOT', klasse: 'E', text: 'Vor1 Nach1' })
    store.dispatch({ type: 'SET_CO_PILOT', klasse: 'E', text: 'Vor2 Nach2', rolle: 'ersatz' })
    store.dispatch({ type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'haupt', gewicht: 78.2 })
    store.dispatch({ type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'ersatz', gewicht: 74.6 })
    store.dispatch({ type: 'SET_CO_PILOT', klasse: '1', text: 'Vor3 Nach3' })
    store.dispatch({ type: 'SET_CO_PILOT_GEWICHT', klasse: '1', rolle: 'haupt', gewicht: 90 })
    store.dispatch({ type: 'SET_AUSGLEICH_STUFE', kg: 0.5 })
    const wrapper = mounte(ListsView, store)
    await steg(wrapper)
    expect(koepfe(wrapper)).toEqual([
      'Ausgleichsgewichte | Klasse E | Boot | Co-Pilot Vor1 Nach1 Ersatz-Co-Pilot Vor2 Nach2 (+3,5 kg) | Hafenpokal 2026',
      'Ausgleichsgewichte | Klasse 1 | Boot | Co-Pilot Vor3 Nach3 | Hafenpokal 2026',
    ])
    const kopf = wrapper.find('[data-liste="ausgleich:E"] [data-feld="coPilot"]')
    expect(kopf.findAll('[data-co-pilot]').map((w) => w.attributes('data-co-pilot'))).toEqual(['haupt', 'ersatz'])
    // Über alle Co-Piloten: Bezug ist Klasse 1 (90 kg).
    store.dispatch({ type: 'SET_CO_PILOT_AUSGLEICH', ausgleich: 'alle' })
    await nextTick()
    expect(koepfe(wrapper)[0]).toBe('Ausgleichsgewichte | Klasse E | Boot | Co-Pilot Vor1 Nach1 (+12 kg) Ersatz-Co-Pilot Vor2 Nach2 (+15,5 kg) | Hafenpokal 2026')
    expect(wrapper.find('.sheet.ausgleich').text()).not.toMatch(/78,2|74,6|90 kg/)
    wrapper.unmount()
  })

  it('UIM: englisch auf der Liste („Substitute co-driver“, „not weighed“) – auch in der Liste nach Pkt. 3.7', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'SET_ORIGIN_MODE', originMode: 'land' })
    store.dispatch({ type: 'SET_CO_PILOT', klasse: 'E', text: 'Vor1 Nach1' })
    store.dispatch({ type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'haupt', gewicht: 70 })
    store.dispatch({ type: 'SET_CO_PILOT', klasse: 'E', text: 'Vor2 Nach2', rolle: 'ersatz' })
    const wrapper = mounte(ListsView, store)
    await steg(wrapper)
    expect(koepfe(wrapper)[0]).toBe('Extra weights | Dolphin | Boat | Co-driver Vor1 Nach1 Substitute co-driver Vor2 Nach2 (not weighed) | Hafenpokal 2026')
    await wrapper.find('.gewicht-arten button[data-art="team"]').trigger('click')
    await nextTick()
    const zelle = wrapper.find('.team-liste tr[data-starter="id-E-1"] td[data-spalte="co-driver"]')
    expect(zelle.findAll('.co-pilot-zeile').map((z) => z.text())).toEqual(['Vor1 Nach1', 'Substitute co-driver: Vor2 Nach2 (not weighed)'])
    // Schriftgröße je Zeile, ohne die kleine Vorsilbe gemessen (Prüfbefund 27.11.2026): Der eingeteilte bleibt normal
    // groß, der Ersatz („Vor2 Nach2 (not weighed)“, 24 Zeichen) nur eine Stufe kleiner.
    expect(zelle.classes()).not.toContain('fit-3')
    expect(zelle.find('[data-co-pilot="haupt"]').classes()).toEqual(['co-pilot-zeile'])
    expect(zelle.find('[data-co-pilot="ersatz"]').classes()).toEqual(['co-pilot-zeile', 'fit-1'])
    expect(zelle.find('[data-co-pilot="ersatz"] small[data-rolle="ersatz"]').text()).toBe('Substitute co-driver:')
    wrapper.unmount()
  })
})

describe('Datenschutz: Co-Piloten nie auf Anzeigetafel, Zuschauerliste, Start-Freigabe oder Geräte (R11-07)', () => {
  it('weder Namen noch Gewichte noch Ausgleichsgewichte der Co-Piloten in den Sichten', () => {
    let s = wkrBetriebsStand(BETRIEB_STARTER)
    s = reducer(s, { type: 'SET_CO_PILOT', klasse: 'E', text: 'Geheim Copilotin' })
    s = reducer(s, { type: 'SET_CO_PILOT', klasse: 'E', text: 'Geheim Ersatzmann', rolle: 'ersatz' })
    s = reducer(s, { type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'haupt', gewicht: 87.3 })
    s = reducer(s, { type: 'SET_CO_PILOT_GEWICHT', klasse: 'E', rolle: 'ersatz', gewicht: 61.9 })
    const STEG: Liste = { bereich: 'par_1', typeId: 'steg', racecourse: null }
    s = reducer(s, { type: 'WKR_LISTE', liste: listenKennung(STEG), modus: 'digital', zeit: 100 })
    s = zeigeNaechsten(s, 'par_1', 1000)
    const oeffentlich = sichtOeffentlich(s)
    const dm = configFor({ regelwerk: 'dm-2026' })
    // Die Start-Freigabe (auch auf dem gekoppelten Handy) liest dazu die Freigabe-Sicht der Erfassung (Prüfbefund 27.11.2026).
    const lagen = erfassungsLage(s, dm, 'par_1', [], 2000).listen
    const freigabe = sichtFreigabe('par_1', lagen, s.anzeige.wkrWarnung, parcoursAmpel(s, dm, 'par_1', lagen))
    expect(freigabe.listen.length).toBeGreaterThan(0)
    const texte = [JSON.stringify(oeffentlich), JSON.stringify(sichtZuschauer(oeffentlich)), JSON.stringify(sichtListe(s, dm, STEG, { geraete: {} })), JSON.stringify(freigabe)]
    // 87,3 − 61,9 = 25,4 → 25 kg Ausgleich des Ersatzes.
    for (const text of texte) for (const verboten of ['Geheim', 'Copilotin', 'Ersatzmann', '87.3', '61.9', 'coPilot', 'ersatz']) expect(text, verboten).not.toContain(verboten)
  })
})
