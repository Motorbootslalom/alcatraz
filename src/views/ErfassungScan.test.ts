import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from '../App.vue'
import ErfassungView from './ErfassungView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { emptyState } from '../state/reducer'
import { STATE_KEY } from '../persistenz/storage'
import { meldeScan, scanBeenden } from '../lib/scan'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'

/** Erfundene Starter: `n` je Klasse, klassenbasierte Startnummern. */
function starter(klassen: ClassId[], n = 3): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: 'Musterclub',
      bundesland: 'Musterland',
      geburtsdatum: '',
      groesse: '',
      klasse,
    })),
  )
}

const ansicht = (store: Store) => mount(ErfassungView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
const titel = (wrapper: VueWrapper) => wrapper.findAll('.erf-titel span').map((s) => s.text()).join(' | ')
const hinweis = (wrapper: VueWrapper) => wrapper.find('.scan-hinweis')
/** Wo der Fokus steht: „Zeile|Spalte“. */
function fokus(): string {
  const a = document.activeElement as HTMLElement | null
  return `${a?.closest('tr')?.getAttribute('data-zeile') ?? ''}|${a?.closest('td')?.getAttribute('data-spalte') ?? ''}`
}
const warte = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}
/** Ein Code über das Scan-Feld: getippt oder eingefügt, dann Enter. */
async function scanne(wrapper: VueWrapper, code: string) {
  const feld = wrapper.find('input[data-scan-feld]')
  await feld.setValue(code)
  await feld.trigger('keydown', { key: 'Enter' })
  await warte()
}

describe('Erfassung: Scannen', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    scanBeenden()
    store = createStore()
    store.dispatch({ type: 'LOAD_STATE', state: { ...emptyState(), kennung: 'K7Q4', eventName: 'Hafenpokal', starters: starter(['1', '4', '7']) } })
  })
  afterEach(() => {
    setLocale('de')
    scanBeenden()
    document.body.innerHTML = ''
    location.hash = ''
  })

  it('der Code eines Bogens wählt Parcours, Klasse, Lauf und Liste und stellt den Cursor in die erste Zelle', async () => {
    const wrapper = ansicht(store)
    expect(titel(wrapper)).toBe('Zeit | Klasse 1 | 1. Lauf | Parcours 1')
    await scanne(wrapper, 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.7.2.MUEB.S1')
    expect(titel(wrapper)).toBe('Mann-über-Bord | Klasse 7 | 2. Lauf | Parcours 2')
    expect(fokus()).toMatch(/^id-7-\d\|/)
    expect(document.activeElement?.closest('tr')).toBe(wrapper.find('.erf-tabelle tbody tr[data-zeile]').element)
    expect(hinweis(wrapper).text()).toContain('Mann-über-Bord · Parcours 2 · Klasse 7 · 2. Lauf · Seite 1')
    expect(hinweis(wrapper).classes()).toContain('scan-hinweis--ok')
    // Das Feld ist wieder frei für das nächste Blatt.
    expect((wrapper.find('input[data-scan-feld]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('getippt in Kleinbuchstaben oder mit Leerraum eingefügt geht genauso; der Knopf auch', async () => {
    const wrapper = ansicht(store)
    await wrapper.find('input[data-scan-feld]').setValue('  alc1.k7q4.dm2026.alcatraz.par2.4.3.steg.s2 ')
    await wrapper.find('button[data-action="scan"]').trigger('click')
    await warte()
    expect(titel(wrapper)).toBe('Steg | Klasse 4 | 3. Lauf | Parcours 2')
    expect(hinweis(wrapper).find('.scan-code').text()).toBe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.4.3.STEG.S2')
    wrapper.unmount()
  })

  it('der Code eines Laufzettels führt zur ersten Liste der Klasse in dem Lauf', async () => {
    const wrapper = ansicht(store)
    await scanne(wrapper, 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.4.2')
    expect(titel(wrapper)).toBe('Zeit | Klasse 4 | 2. Lauf | Parcours 2')
    expect(fokus()).toMatch(/^id-4-\d\|zeit1$/)
    expect(hinweis(wrapper).text()).toContain('Laufzettel · Parcours 2 · Klasse 4 · 2. Lauf')
    wrapper.unmount()
  })

  it('ein Scanner mit vertauschtem Y/Z trifft trotzdem', async () => {
    const wrapper = ansicht(store)
    await scanne(wrapper, 'ALC1.K7Q4.DM2026.ALCATRAY.PAR1.1.3.YEIT.S1')
    expect(titel(wrapper)).toBe('Zeit | Klasse 1 | 3. Lauf | Parcours 1')
    wrapper.unmount()
  })

  it.each([
    ['ALC1.ABCD.DM2026.ALCATRAZ.PAR2.4.1.STEG.S1', 'Das Blatt gehört zu einer anderen Veranstaltung (Kennung ABCD, hier K7Q4).'],
    ['ALC1.K7Q4.DM2026.BAWUE.PAR2.4.1.STEG.S1', 'Gedruckt mit Aufbau Baden-Württemberg, eingestellt ist Alcatraz.'],
    ['ALC1.K7Q4.UIM2026.ALCATRAZ.PAR2.4.1', 'Gedruckt mit Regelwerk UIM 2026, eingestellt ist DM 2026.'],
    ['ALC1.MUSTER.DM2026.ALCATRAZ.PAR2.4.1.STEG.S1', 'Das ist der Code einer Beispielansicht, kein gedruckter Bogen.'],
    ['FP2.DM2026.ALCATRAZ.4.1.STEG.S1', 'Fehlerpunkte-Prototyp'],
    ['4006381333931', 'Kein Code dieser Anwendung'],
    ['ALC1.K7Q4.DM2026.ALCATRAZ.PAR9.4.1', 'Den Parcours des Blatts (PAR9) gibt es in dieser Veranstaltung nicht (mehr).'],
    ['ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.4.5', 'Lauf 5 gibt es hier nicht (Zahl der Läufe: 3).'],
    ['ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.4.1.GATE135OS.S1', 'Die Liste „GATE135OS“ gibt es im eingestellten Aufbau nicht.'],
    ['ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.4.1.STEG.S1', 'Für Klasse 4 gibt es auf diesem Parcours keinen Bogen (mehr).'],
    ['ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.4.1.STEG', 'Code unvollständig oder beschädigt.'],
  ])('weist %s verständlich ab und bleibt beim gewählten Bogen', async (code, meldung) => {
    const wrapper = ansicht(store)
    await scanne(wrapper, code)
    expect(titel(wrapper)).toBe('Zeit | Klasse 1 | 1. Lauf | Parcours 1')
    expect(hinweis(wrapper).classes()).toContain('scan-hinweis--fehler')
    expect(hinweis(wrapper).attributes('role')).toBe('alert')
    expect(hinweis(wrapper).text()).toContain('Code nicht erkannt:')
    expect(hinweis(wrapper).text()).toContain(meldung)
    // Zum Berichtigen bleibt stehen, was nicht erkannt wurde.
    expect((wrapper.find('input[data-scan-feld]').element as HTMLInputElement).value).toBe(code)
    wrapper.unmount()
  })

  it('die Meldungen gibt es auch englisch', async () => {
    setLocale('en')
    const wrapper = ansicht(store)
    await scanne(wrapper, 'ALC1.ABCD.DM2026.ALCATRAZ.PAR2.4.1.STEG.S1')
    expect(hinweis(wrapper).text()).toContain('Code not recognised: This sheet belongs to a different event (code ABCD, here K7Q4).')
    await scanne(wrapper, 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.4.1')
    expect(hinweis(wrapper).text()).toContain('Checklist · Parcours 2 · Class 4 · Attempt 1')
    wrapper.unmount()
  })

  it('wer danach selbst wählt, bleibt bei seiner Wahl – auch nach einem Wechsel der Ansicht', async () => {
    const wrapper = ansicht(store)
    await scanne(wrapper, 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.7.2.MUEB.S1')
    await wrapper.find('select[data-feld="erf-liste"]').setValue('steg')
    await warte()
    expect(titel(wrapper)).toBe('Steg | Klasse 7 | 2. Lauf | Parcours 2')
    // Der Hinweis auf das gescannte Blatt ist weg.
    expect(hinweis(wrapper).exists()).toBe(false)
    wrapper.unmount()
    const wieder = ansicht(store)
    await warte()
    expect(titel(wieder)).toBe('Steg | Klasse 7 | 2. Lauf | Parcours 2')
    wieder.unmount()
  })

  it('derselbe Code noch einmal springt wieder zum Bogen; „Schließen“ nimmt nur den Hinweis weg', async () => {
    const wrapper = ansicht(store)
    await scanne(wrapper, 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.7.2.MUEB.S1')
    await hinweis(wrapper).find('button[data-action="scan-schliessen"]').trigger('click')
    expect(hinweis(wrapper).exists()).toBe(false)
    expect(titel(wrapper)).toBe('Mann-über-Bord | Klasse 7 | 2. Lauf | Parcours 2')
    await wrapper.find('select[data-feld="erf-liste"]').setValue('zeit')
    await scanne(wrapper, 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.7.2.MUEB.S1')
    expect(titel(wrapper)).toBe('Mann-über-Bord | Klasse 7 | 2. Lauf | Parcours 2')
    wrapper.unmount()
  })

  it('Clubmeisterschaft: Der Code eines gemeinsamen Bogens führt zu diesem Bogen', async () => {
    store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
    const wrapper = ansicht(store)
    await scanne(wrapper, 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.47.1.STEG.S1')
    expect(titel(wrapper)).toMatch(/^Steg \| Klassen [47], [47] \| 1\. Lauf \| Parcours 2$/)
    expect(hinweis(wrapper).classes()).toContain('scan-hinweis--ok')
    // Nach dem Druck auf Einzelbögen umgestellt: Die Zeit-Liste bleibt gemeinsam, die Tor-Liste nicht mehr.
    store.dispatch({ type: 'SET_WKR_CLUB_GEMEINSAM', gemeinsam: false })
    await scanne(wrapper, 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.47.1.GATE135.S1')
    expect(titel(wrapper)).toMatch(/^Tor 1 \/ 3 \/ 5 \| Klasse [47] \| 1\. Lauf \| Parcours 2$/)
    expect(hinweis(wrapper).text()).toContain('seit dem Druck anders zusammengefasst')
    wrapper.unmount()
  })
})

describe('App: Handscanner in jeder Ansicht', () => {
  it('ein gemeldeter Scan führt in die Erfassung zum Bogen', async () => {
    localStorage.clear()
    setLocale('de')
    scanBeenden()
    const store = createStore()
    store.dispatch({ type: 'LOAD_STATE', state: { ...emptyState(), kennung: 'K7Q4', starters: starter(['1', '4', '7']) } })
    location.hash = '#/starter'
    window.dispatchEvent(new Event('hashchange'))
    const wrapper = mount(App, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
    await nextTick()
    expect(wrapper.find('.erf-tabelle').exists()).toBe(false)
    // Der Scanner tippt wie eine Tastatur: schnelle Tastendrücke am Fenster, ohne Fokus in einem Feld.
    for (const key of [...'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.4.3.TOR5.S1', 'Enter']) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    }
    window.dispatchEvent(new Event('hashchange'))
    await warte()
    expect(location.hash).toBe('#/erfassung')
    expect(titel(wrapper)).toBe('Tor 5 | Klasse 4 | 3. Lauf | Parcours 2')
    expect(fokus()).toMatch(/^id-4-\d\|/)
    wrapper.unmount()
    document.body.innerHTML = ''
    location.hash = ''
    // meldeScan ist derselbe Weg, den der Mitschnitt nimmt.
    expect(typeof meldeScan).toBe('function')
  })

  it('ein Scan bei Cursor in einer Zelle hinterlässt keine Spur: Wert und „Letzte Änderung“ bleiben', async () => {
    localStorage.clear()
    setLocale('de')
    scanBeenden()
    const store = createStore()
    store.dispatch({ type: 'LOAD_STATE', state: { ...emptyState(), kennung: 'K7Q4', starters: starter(['1', '4', '7']) } })
    location.hash = '#/erfassung'
    window.dispatchEvent(new Event('hashchange'))
    const wrapper = mount(App, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
    await warte()
    await wrapper.find('input[data-scan-feld]').setValue('ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.4.1.STEG.S1')
    await wrapper.find('input[data-scan-feld]').trigger('keydown', { key: 'Enter' })
    await warte()
    // Eine Eingabe von Hand, mit bekanntem Zeitpunkt; der Cursor bleibt in der Zelle.
    const zelle = document.activeElement as HTMLInputElement
    zelle.value = 'X'
    zelle.dispatchEvent(new Event('input', { bubbles: true }))
    await warte()
    const vorher = store.state.value
    expect(Object.values(vorher.listenStand).some((e) => e.zeit !== undefined)).toBe(true)

    // Der Scanner tippt: Die ersten Zeichen landen in der Zelle (und im Stand), bevor „ALC1.“ erkannt ist.
    for (const key of [...'ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.7.2.MUEB.S1', 'Enter']) {
      const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      const ziel = document.activeElement as HTMLInputElement
      ziel.dispatchEvent(e)
      if (!e.defaultPrevented && key.length === 1) {
        ziel.value += key
        ziel.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }
    await warte()
    expect(titel(wrapper)).toBe('Mann-über-Bord | Klasse 7 | 2. Lauf | Parcours 2')
    // Derselbe Stand wie vor dem Scan – nicht nur dieselben Werte: kein neuer Zeitpunkt.
    expect(store.state.value).toBe(vorher)
    expect(JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null').listenStand).toEqual(vorher.listenStand)
    expect(zelle.value).toBe('X')
    wrapper.unmount()
    document.body.innerHTML = ''
    location.hash = ''
  })
})
