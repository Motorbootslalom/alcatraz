import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SettingsView from './SettingsView.vue'
import { downloadText, makeFile } from '../persistenz/backup'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import { configFor } from '../config/konfig'
import type { RawAufbau } from '../config/schema'
import { LogoFehler, verkleinereLogo } from '../lib/logoBild'
import { betriebsStand, festgeschrieben, TEST_PNG_2X1, testLogo } from '../testHilfen'

/** Erfundener eigener Aufbau. */
const hafenfest: RawAufbau = {
  id: 'hafenfestq3m8',
  name: 'Hafenfest',
  positionen: [
    'zeit',
    'steg',
    { id: 'hf135', titel: 'Tor 1 / 3 / 5', blick: 'hinten', bojen: ['StartZiel_unten', 'Tor1', 'Tor3', 'Tor5_unten', 'Speedboje_unten'], aufgaben: ['tor5'] },
    { id: 'hf245', titel: 'Tor 2 / 4 / 5', blick: 'links', bojen: ['StartZiel_oben', 'Tor2', 'Tor4', 'Tor5_oben', 'Speedboje_oben'] },
    'mueb',
  ],
}

// Verkleinern braucht Canvas (nur im Browser geprüft): Hier kommt immer das Testbild zurück. LogoFehler bleibt echt.
vi.mock('../lib/logoBild', async (original) => ({
  ...(await original<typeof import('../lib/logoBild')>()),
  verkleinereLogo: vi.fn(async () => testLogo()),
}))

// Der Download selbst braucht einen Browser; geprüft wird, was heruntergeladen würde.
vi.mock('../persistenz/backup', async (original) => ({
  ...(await original<typeof import('../persistenz/backup')>()),
  downloadText: vi.fn(),
}))

/** Wie aus einer beschädigten Sicherung: Die Form stimmt, die Prüfung stolpert (`klassen` muss eine Liste sein). */
const kaputt = { id: 'kk', name: 'Kaputt', positionen: [{ id: 'pz', titel: 'x', bojen: ['Tor1'], klassen: 5 }] } as unknown as RawAufbau

function settings(store: Store, optionen: { attachTo?: HTMLElement } = {}) {
  return mount(SettingsView, { ...optionen, global: { provide: { [storeKey as symbol]: store } } })
}

describe('Einstellungen: eigene Aufbauten', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    setLocale('de')
  })

  it('zeigt einen eigenen Aufbau und löscht ihn nach Rückfrage', async () => {
    store.dispatch({ type: 'SET_EIGENE_AUFBAUTEN', aufbauten: [hafenfest], aufbau: 'hafenfestq3m8' })
    const wrapper = settings(store)
    const panel = wrapper.find('.own-setups')
    expect(panel.text()).toContain('Eigene Aufbauten')
    expect(panel.find('[data-aufbau="hafenfestq3m8"]').text()).toContain('Hafenfest')
    expect(panel.find('[data-aufbau="hafenfestq3m8"]').text()).toContain('5 Listen')
    expect(panel.find('.own-active').exists()).toBe(true)

    // Ohne Zustimmung bleibt alles, wie es ist.
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    await panel.find('[data-action="delete"]').trigger('click')
    expect(confirm).toHaveBeenCalledOnce()
    expect(confirm.mock.calls[0].join()).toContain('Hafenfest')
    expect(store.state.value.eigeneAufbauten).toHaveLength(1)

    confirm.mockReturnValue(true)
    await panel.find('[data-action="delete"]').trigger('click')
    await nextTick()
    expect(store.state.value.eigeneAufbauten).toEqual([])
    // Der gelöschte war gewählt: Die Wahl fällt auf die Vorgabe zurück.
    expect(store.state.value.aufbau).toBe('alcatraz')
    expect(wrapper.find('[data-aufbau="hafenfestq3m8"]').exists()).toBe(false)
    expect(wrapper.find('.own-setups').text()).toContain('Noch kein eigener Aufbau.')
    wrapper.unmount()
  })

  it('spricht auch Englisch', async () => {
    store.dispatch({ type: 'SET_EIGENE_AUFBAUTEN', aufbauten: [hafenfest] })
    const wrapper = settings(store)
    setLocale('en')
    await nextTick()
    const text = wrapper.find('.own-setups').text()
    expect(text).toContain('Own setups')
    expect(text).toContain('5 lists')
    expect(text).not.toContain('Eigene Aufbauten')
    wrapper.unmount()
  })

  it('der Assistent legt aus einer Vorlage einen neuen Aufbau an', async () => {
    const wrapper = settings(store)
    await wrapper.find('.own-setups select#own-vorlage').setValue('moewe')
    await wrapper.find('[data-action="derive"]').trigger('click')
    const assistent = wrapper.find('.assistent')
    expect(assistent.exists()).toBe(true)
    expect(assistent.text()).toContain('Eigenen Aufbau anlegen')
    // Die Möwe-Vorlage ist vollständig: nichts fehlt, nichts ist doppelt.
    expect(assistent.find('.assistent-pruefung').text()).toContain('Jede Boje und Aufgabe steht auf genau einer Liste.')

    await assistent.find('#as-name').setValue('Hafenfest')
    await assistent.find('.btn.primary').trigger('click')
    await nextTick()

    const [neu] = store.state.value.eigeneAufbauten
    expect(neu.name).toBe('Hafenfest')
    expect(neu.id).toMatch(/^hafenfest[a-z0-9]{4}$/)
    expect(neu.kurs).toBe('moewe')
    // Speichern wählt nicht um; das geschieht bewusst über „Für diese Veranstaltung wählen“.
    expect(store.state.value.aufbau).toBe('alcatraz')
    expect(wrapper.find('.assistent').exists()).toBe(false)
    expect(wrapper.find(`[data-aufbau="${neu.id}"]`).text()).toContain('Hafenfest')
    wrapper.unmount()
  })

  it('der Assistent nennt Lücken verständlich und merkt sich „Im Bild“ im Browser', async () => {
    localStorage.removeItem('alcatraz:assistent-zuordnen')
    const wrapper = settings(store)
    await wrapper.find('[data-action="new"]').trigger('click')
    const assistent = wrapper.find('.assistent')
    // Leerer Entwurf: Alles fehlt – genannt wie in der Tabelle, nicht mit der Kennung der Prüfung.
    const luecken = assistent.find('.assistent-pruefung').text()
    expect(luecken).toContain('Tor 1 rechts · außen (alle Klassen)')
    expect(luecken).toContain('Speed 2 (Tonne 8) (Kl. 7)')
    expect(luecken).not.toMatch(/seite[AB]|hin |rueck /)

    // Vorgabe ist die Tabelle; „Im Bild“ zeigt die Zeichnung, und der Browser merkt sich die Wahl.
    expect(assistent.find('.assistent-tabelle').exists()).toBe(true)
    const imBild = assistent.findAll('.assistent-ansicht button')[1]
    expect(imBild.text()).toBe('Im Bild')
    await imBild.trigger('click')
    expect(localStorage.getItem('alcatraz:assistent-zuordnen')).toBe('bild')
    expect(assistent.find('.assistent-tabelle').exists()).toBe(false)
    expect(assistent.find('.zib-quelle svg #Tor1_innen').exists()).toBe(true)
    expect(assistent.find('.zib-ueberlage').attributes('aria-label')).toContain('zuerst eine Position anlegen')

    // Eine Position anlegen, eine Aufgabe anhaken, zurücknehmen.
    await assistent.findAll('.zib-leiste button').find((b) => b.text() === '+ Position')!.trigger('click')
    expect(assistent.find('.zib-spalte.aktiv').text()).toBe('Position 1')
    expect(assistent.find('.zib-ueberlage').attributes('aria-label')).toContain('„Position 1“')
    const mueb = assistent.findAll('.zib-aufgaben input[type="checkbox"]')[1]
    await mueb.setValue(true)
    expect(assistent.find('.assistent-pruefung').text()).not.toContain('Mann-über-Bord')
    await assistent.find('.zib-zurueck').trigger('click')
    expect(assistent.find('.assistent-pruefung').text()).toContain('Mann-über-Bord (Kl. 4, 5, 6, 7)')
    wrapper.unmount()

    // Beim nächsten Öffnen steht der Assistent wieder im Bild.
    const wieder = settings(store)
    await wieder.find('[data-action="new"]').trigger('click')
    expect(wieder.find('.zib').exists()).toBe(true)
    wieder.unmount()
    localStorage.removeItem('alcatraz:assistent-zuordnen')
  })

  it('spielt eine YAML-Datei nur ein, wenn sie die Prüfung besteht', async () => {
    const wrapper = settings(store)
    const input = wrapper.find('.own-setups input[type="file"]')
    const waehle = async (text: string, ausgang: 'ok' | 'warn') => {
      Object.defineProperty(input.element, 'files', { value: [new File([text], 'aufbau.yaml')], configurable: true })
      await input.trigger('change')
      await vi.waitFor(() => expect(wrapper.find(`.own-setups .boat-banner.${ausgang}`).exists()).toBe(true))
    }

    await waehle('aufbauten:\n  - id: alcatraz\n    name: Doppelt\n    positionen: [steg]\n', 'warn')
    expect(store.state.value.eigeneAufbauten).toEqual([])
    expect(wrapper.find('.own-setups .boat-banner.warn').text()).toContain('gibt es schon unter den mitgelieferten')

    const yaml = configFor({ eigeneAufbauten: [hafenfest] }).aufbauAlsYaml('hafenfestq3m8', { datum: '2026-11-12', version: 'test' })!
    await waehle(yaml, 'ok')
    expect(store.state.value.eigeneAufbauten).toEqual([hafenfest])
    expect(wrapper.find('.own-setups .boat-banner.ok').text()).toContain('1 Aufbau eingespielt: Hafenfest')
    wrapper.unmount()
  })

  it('Abbrechen im Assistenten ändert nichts', async () => {
    const wrapper = settings(store)
    await wrapper.find('[data-action="new"]').trigger('click')
    expect(wrapper.find('.assistent').exists()).toBe(true)
    // Ein leerer Entwurf beobachtet noch nichts.
    expect(wrapper.find('.assistent-pruefung').text()).toContain('Noch nicht beobachtet')
    await wrapper.findAll('.assistent .btn').at(-2)!.trigger('click')
    expect(wrapper.find('.assistent').exists()).toBe(false)
    expect(store.state.value.eigeneAufbauten).toEqual([])
    wrapper.unmount()
  })

  it('ein abgelehnter Aufbau ist gekennzeichnet und legt Assistent und Einspielen nicht lahm', async () => {
    store.dispatch({ type: 'SET_EIGENE_AUFBAUTEN', aufbauten: [kaputt, hafenfest], aufbau: 'kk' })
    // Nicht wählbar: Die Wahl ist auf die Vorgabe gefallen.
    expect(store.state.value.aufbau).toBe('alcatraz')
    const wrapper = settings(store)
    const zeile = wrapper.find('[data-aufbau="kk"]')
    expect(zeile.classes()).toContain('own-rejected')
    expect(zeile.text()).toContain('Besteht die Prüfung nicht')
    expect(zeile.text()).toContain('Aufbau „kk“ lässt sich nicht lesen')
    // Nur Herunterladen und Löschen.
    expect(zeile.findAll('button').map((b) => b.attributes('data-action'))).toEqual(['download', 'delete'])
    // Der intakte daneben bleibt voll bedienbar.
    expect(wrapper.find('[data-aufbau="hafenfestq3m8"]').findAll('button').map((b) => b.attributes('data-action'))).toEqual([
      'use',
      'edit',
      'download',
      'delete',
    ])

    await wrapper.find('[data-aufbau="hafenfestq3m8"] [data-action="edit"]').trigger('click')
    expect(wrapper.find('.assistent-tabelle').exists()).toBe(true)
    expect(wrapper.findAll('.assistent .assistent-tabelle thead th input.spalte-titel').length).toBeGreaterThan(0)
    await wrapper.find('.assistent .btn.primary').trigger('click')
    await nextTick()
    expect(wrapper.find('.assistent').exists()).toBe(false)
    // Der abgelehnte bleibt gespeichert, bis er gelöscht wird.
    expect(store.state.value.eigeneAufbauten.map((a) => a.id)).toEqual(['kk', 'hafenfestq3m8'])

    await wrapper.find('[data-action="new"]').trigger('click')
    expect(wrapper.find('.assistent-tabelle').exists()).toBe(true)
    await wrapper.findAll('.assistent .btn').at(-2)!.trigger('click')

    // Einspielen: eine gültige Datei mit der Kennung des abgelehnten ersetzt ihn.
    const yaml = 'aufbauten:\n  - id: kk\n    name: Heil\n    positionen: [zeit, steg]\n'
    vi.stubGlobal('confirm', () => true)
    const input = wrapper.find('.own-setups input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File([yaml], 'aufbau.yaml')], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper.find('.own-setups .boat-banner.ok').exists()).toBe(true))
    expect(store.state.value.eigeneAufbauten.map((a) => a.name)).toEqual(['Heil', 'Hafenfest'])
    expect(wrapper.find('[data-aufbau="kk"]').classes()).not.toContain('own-rejected')
    wrapper.unmount()
  })

  it('die Zuordnung im Assistenten ist mit der Tastatur bedienbar: Schaltflächen mit Namen und Zustand', async () => {
    const wrapper = settings(store)
    await wrapper.find('[data-action="derive"]').trigger('click')
    const zellen = wrapper.findAll('.assistent .assistent-tabelle tbody td:not(.rand)')
    expect(zellen.length).toBeGreaterThan(0)
    // Jede Zelle der Zuordnung trägt genau eine Schaltfläche.
    for (const zelle of zellen) expect(zelle.findAll('button.zelle')).toHaveLength(1)

    const knoepfe = wrapper.findAll('.assistent .assistent-tabelle tbody button.zelle')
    const titel = (wrapper.find('.assistent .assistent-tabelle thead input.spalte-titel').element as HTMLInputElement).value
    expect(knoepfe[0].attributes('aria-label')).toBe(`Start / Ziel: beobachtet von ${titel}`)
    const frei = knoepfe.find((k) => k.attributes('aria-pressed') === 'false')!
    const name = frei.attributes('aria-label')
    await frei.trigger('click')
    const danach = wrapper.findAll('.assistent .assistent-tabelle tbody button.zelle').find((k) => k.attributes('aria-label') === name)!
    expect(danach.attributes('aria-pressed')).toBe('true')
    expect(danach.text()).toBe('●')

    // Aufgeklappt: die einzelnen Bojen, ebenfalls als Schaltflächen; das halbe Tor heißt „mixed“.
    await wrapper.find('.assistent .assistent-tabelle .aufklappen').trigger('click')
    const haelfte = wrapper.find('.assistent .assistent-tabelle tr.haelfte button.zelle')
    expect(haelfte.attributes('aria-label')).toContain('Start / Ziel rechts: beobachtet von')
    const vorher = haelfte.attributes('aria-pressed')
    await haelfte.trigger('click')
    expect(wrapper.find('.assistent .assistent-tabelle tr.haelfte button.zelle').attributes('aria-pressed')).toBe(vorher === 'true' ? 'false' : 'true')
    expect(wrapper.findAll('.assistent .assistent-tabelle tbody button.zelle')[0].attributes('aria-pressed')).toBe('mixed')
    wrapper.unmount()
  })

  it('„Einspielen“ sind echte Schaltflächen, die das Dateifeld öffnen', async () => {
    const wrapper = settings(store)
    for (const [knopf, feld] of [
      ['.own-setups [data-action="upload"]', '.own-setups input[type="file"]'],
      ['[data-action="upload-file"]', 'input[type="file"][accept*="json"]'],
      ['[data-action="logo-waehlen|links"]', 'input[data-feld="logo|links"]'],
    ]) {
      expect(wrapper.find(knopf).element.tagName).toBe('BUTTON')
      // Kein Dateifeld mit `hidden` in einem `label`: Das wäre mit Tab nicht erreichbar.
      expect(wrapper.find(feld).element.closest('label')).toBeNull()
      const click = vi.spyOn(wrapper.find(feld).element as HTMLInputElement, 'click').mockImplementation(() => {})
      await wrapper.find(knopf).trigger('click')
      expect(click).toHaveBeenCalledOnce()
    }
    wrapper.unmount()
  })

  it('ohne Namen wird nicht gespeichert – und kein deutscher Ersatzname gesetzt', async () => {
    setLocale('en')
    const wrapper = settings(store)
    await wrapper.find('[data-action="derive"]').trigger('click')
    await wrapper.find('#as-name').setValue('   ')
    await wrapper.find('.assistent .btn.primary').trigger('click')
    await nextTick()
    expect(wrapper.find('.assistent').exists()).toBe(true)
    expect(wrapper.find('.assistent-pruefung [role="alert"]').text()).toContain('Please enter a name for the setup.')
    expect(store.state.value.eigeneAufbauten).toEqual([])

    await wrapper.find('#as-name').setValue('Harbour cup')
    await wrapper.find('.assistent .btn.primary').trigger('click')
    await nextTick()
    expect(store.state.value.eigeneAufbauten.map((a) => a.name)).toEqual(['Harbour cup'])
    wrapper.unmount()
  })

  it('die YAML-Datei nennt das Datum in Ortszeit, auch kurz nach Mitternacht', async () => {
    vi.stubEnv('TZ', 'Europe/Berlin')
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      // 00:15 Uhr in Berlin ist in UTC noch der Vortag.
      vi.setSystemTime(new Date('2026-11-12T23:15:00Z'))
      store.dispatch({ type: 'SET_EIGENE_AUFBAUTEN', aufbauten: [hafenfest] })
      const wrapper = settings(store)
      await wrapper.find('[data-aufbau="hafenfestq3m8"] [data-action="download"]').trigger('click')
      const [name, text] = vi.mocked(downloadText).mock.lastCall!
      expect(name).toBe('aufbau-hafenfestq3m8.yaml')
      expect(text).toContain('# Datum: 2026-11-13 ·')
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
      vi.unstubAllEnvs()
    }
  })

  it('die Vorlage zum Ableiten folgt nicht einem gelöschten Aufbau', async () => {
    store.dispatch({ type: 'SET_EIGENE_AUFBAUTEN', aufbauten: [hafenfest], aufbau: 'hafenfestq3m8' })
    const wrapper = settings(store)
    const wahl = () => wrapper.find('#own-vorlage').element as HTMLSelectElement
    expect(wahl().value).toBe('hafenfestq3m8')
    vi.stubGlobal('confirm', () => true)
    await wrapper.find('[data-action="delete"]').trigger('click')
    await nextTick()
    expect(wahl().value).toBe('alcatraz')
    // „Ableiten“ beginnt mit der Vorgabe statt mit einem leeren Assistenten.
    await wrapper.find('[data-action="derive"]').trigger('click')
    expect(wrapper.findAll('.assistent .assistent-tabelle thead input.spalte-titel').length).toBeGreaterThan(0)
    wrapper.unmount()
  })

  it('die Meldung nach dem Einspielen wechselt mit der Sprache', async () => {
    const wrapper = settings(store)
    const input = wrapper.find('.own-setups input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['aufbauten: ['], 'aufbau.yaml')], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper.find('.own-setups > .boat-banner.warn').exists()).toBe(true))
    expect(wrapper.find('.own-setups > .boat-banner.warn').text()).toContain('Nicht eingespielt:')
    setLocale('en')
    await nextTick()
    const text = wrapper.find('.own-setups > .boat-banner.warn').text()
    expect(text).toContain('Not loaded:')
    expect(text).not.toContain('Nicht eingespielt')
    wrapper.unmount()
  })

  it('unter UIM lässt sich ein eigener Aufbau mit frei benannten Positionen speichern – mit oder ohne englischen Namen', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    const wrapper = settings(store)
    await wrapper.find('.own-setups select#own-vorlage').setValue('moewe')
    await wrapper.find('[data-action="derive"]').trigger('click')
    const assistent = wrapper.find('.assistent')
    await assistent.find('#as-name').setValue('Harbour Cup')
    const titel = assistent.findAll('input.spalte-titel')
    const erste = (titel[0].element as HTMLInputElement).value
    await titel[0].setValue('Am Kran')
    await titel[1].setValue('Hinter der Mole')
    // Das Regelwerk bietet Englisch an: je Position ein beschriftetes, freiwilliges Feld.
    const englisch = assistent.find('input[aria-label="Englischer Name für Am Kran"]')
    expect(englisch.exists()).toBe(true)
    expect(assistent.find('.assistent-pruefung').text()).toContain('Ohne englischen Namen – auf englischen Listen steht der deutsche: Am Kran, Hinter der Mole')
    await englisch.setValue('At the crane')
    expect(assistent.find('.assistent-pruefung').text()).toContain('steht der deutsche: Hinter der Mole')

    await assistent.find('.btn.primary').trigger('click')
    await nextTick()
    expect(wrapper.find('.assistent').exists()).toBe(false)
    const [neu] = store.state.value.eigeneAufbauten
    expect(neu.name).toBe('Harbour Cup')
    const positionen = neu.positionen.filter((p): p is Exclude<typeof p, string> => typeof p === 'object')
    expect(positionen.find((p) => p.titel === 'Am Kran')).toMatchObject({ titelEn: 'At the crane' })
    expect(positionen.find((p) => p.titel === 'Hinter der Mole')).not.toHaveProperty('titelEn')
    expect(erste).not.toBe('Am Kran')
    // Er gilt: nicht abgelehnt und für die Veranstaltung wählbar.
    const k = configFor({ regelwerk: 'uim-2026', eigeneAufbauten: store.state.value.eigeneAufbauten })
    expect(k.abgelehnteEigene).toEqual([])
    expect(k.getAufbau(neu.id).eigen).toBe(true)
    wrapper.unmount()
  })

  it('unter DM fragt der Assistent keinen englischen Namen ab', async () => {
    const wrapper = settings(store)
    await wrapper.find('.own-setups select#own-vorlage').setValue('moewe')
    await wrapper.find('[data-action="derive"]').trigger('click')
    expect(wrapper.find('.assistent input[lang="en"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('unter UIM wird eine YAML-Datei mit frei benannter Position eingespielt; der fehlende englische Name ist ein Hinweis', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    const frei: RawAufbau = {
      id: 'freix2k7',
      name: 'Frei',
      positionen: ['zeit', 'steg', { id: 'fr1', titel: 'Alle Tore am Stadthafen', blick: 'rechts', bojen: ['StartZiel', 'Tor1', 'Tor2', 'Tor3', 'Tor4', 'Tor5'] }],
    }
    const wrapper = settings(store)
    const input = wrapper.find('.own-setups input[type="file"]')
    const yaml = configFor({ eigeneAufbauten: [frei] }).aufbauAlsYaml('freix2k7', { datum: '2026-11-13', version: 'test' })!
    Object.defineProperty(input.element, 'files', { value: [new File([yaml], 'aufbau.yaml')], configurable: true })
    await input.trigger('change')
    await vi.waitFor(() => expect(wrapper.find('.own-setups .boat-banner.ok').exists()).toBe(true))
    expect(store.state.value.eigeneAufbauten).toEqual([frei])
    expect(wrapper.find('.own-setups').text()).toContain('Position „Alle Tore am Stadthafen“ hat keinen englischen Titel.')
    setLocale('en')
    await nextTick()
    expect(wrapper.find('.own-setups').text()).toContain('Position “Alle Tore am Stadthafen” has no English title.')
    wrapper.unmount()
  })
})

describe('Einstellungen: Teilnehmerdaten einspielen', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('eine Datei mit einem Starter, dessen Jahrgang nicht zur Klasse passt, wird abgewiesen – wie beim Einfügen aus Excel', async () => {
    localStorage.clear()
    setLocale('de')
    vi.stubGlobal('confirm', () => true)
    const store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventJahr: 2026 } })
    const wrapper = settings(store)
    const input = wrapper.find('input[type="file"][accept*="json"]')
    const spiele = async (geburtsdatum: string) => {
      const starters = [{ id: 'x', startNr: '401', vorname: 'Vor', nachname: 'Nach', verein: '', bundesland: '', geburtsdatum, klasse: '4', groesse: '' }]
      const text = JSON.stringify({ app: 'alcatraz', version: 1, savedAt: '2026-01-01T00:00:00.000Z', kind: 'starter', starters })
      Object.defineProperty(input.element, 'files', { value: [new File([text], 'starter.json')], configurable: true })
      await input.trigger('change')
    }
    // Klasse 4 im Jahr 2026: Jahrgang 2019 ist zu jung.
    await spiele('2019-05-05')
    await vi.waitFor(() => expect(wrapper.find('#dateien .boat-banner.warn, .boat-banner.warn[role="status"]').exists()).toBe(true))
    expect(wrapper.text()).toContain('Nichts übernommen: 1 Starter der Datei steht in einer Klasse, die nicht zum Geburtsjahr passt (Vor Nach: Klasse 4, 2019)')
    expect(store.state.value.starters).toEqual([])
    // Ohne Geburtsdatum lässt sich nichts prüfen: Die Datei wird übernommen.
    await spiele('')
    await vi.waitFor(() => expect(store.state.value.starters).toHaveLength(1))
    wrapper.unmount()
  })
})

describe('Einstellungen: WKR-Einteilung und Beispielansicht', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })
  afterEach(() => setLocale('de'))

  it('die WKR-Einteilung steht nicht mehr hier, sondern bei der Veranstaltung (Besetzung) – hier bleibt der Verweis', async () => {
    const wrapper = settings(store)
    expect(wrapper.find('#wkr-einteilung').exists()).toBe(false)
    expect(wrapper.find('.wkr-tabelle').exists()).toBe(false)
    const verweis = wrapper.find('#wkr-listen [data-hinweis="besetzung"]')
    expect(verweis.text()).toContain('Wer an welcher Liste sitzt (WKR-Einteilung), die Co-Piloten und die Boote stehen unter')
    expect(verweis.find('a').attributes('href')).toBe('#/veranstaltung?besetzung')
    expect(verweis.find('a').text()).toBe('Veranstaltung → Besetzung')
    // Ohne offenen Assistenten gibt es hier keine Beispielansicht (sie steht bei der Veranstaltung).
    expect(wrapper.find('.wkr-vorschau').exists()).toBe(false)
    const reihenfolge = wrapper.findAll('.panel > h2, details.panel > summary').map((h) => h.text())
    expect(reihenfolge).not.toContain('WKR-Einteilung')
    // Die Einstellungen der Wettkampfrichter-Listen stehen vor den Durchschnittsgewichten (Begriff des Reglements, C3).
    expect(reihenfolge.indexOf('Durchschnittsgewichte')).toBe(reihenfolge.indexOf('Wettkampfrichter-Listen') + 1)
    expect(reihenfolge).not.toContain('Standardgewichte')
    expect(reihenfolge.indexOf('Wettkampfrichter-Listen')).toBeLessThan(reihenfolge.indexOf('Eigene Aufbauten'))
    // Die Beispieldaten stehen bei der Veranstaltung, nicht mehr hier.
    expect(reihenfolge).not.toContain('Beispieldaten')
    // Ganz am Ende, zugeklappt: die Lizenzvermerke fremder Bestandteile (Flaggen, Parcours-Zeichnungen).
    expect(reihenfolge.slice(-2)).toEqual(['Dateien', 'Fremde Bestandteile und Lizenzen'])
    expect(wrapper.find('#lizenzen').text()).toContain('Permission is hereby granted')
    expect(wrapper.find('#lizenzen .parcours-nachweis').text()).toContain('CC BY-NC-SA 4.0')
    expect(wrapper.find('[data-action="beispielwerte"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('der Assistent zeigt die Listen des Entwurfs als Beispielansicht – ohne Namenspflege', async () => {
    vi.useFakeTimers()
    try {
      const wrapper = settings(store)
      await wrapper.find('[data-action="derive"]').trigger('click')
      const vorschau = wrapper.find('.assistent-vorschau')
      // Sie gehört zum Assistenten und steht ohne Aufklappen da: je Position ein Reiter, ein Blatt.
      await nextTick()
      expect(vorschau.find('h3').text()).toContain('So sehen die Listen aus')
      expect(vorschau.findAll('.bogen')).toHaveLength(1)
      const listen = () => vorschau.findAll('.wkr-vorschau-tabs button').map((b) => b.text())
      // Die Knoten hat der Entwurf nicht selbst: Sie kommen als Vorgabe des Regelwerks dazu, und der Assistent sagt es.
      expect(listen()).toEqual(['Zeit', 'Vorsteg', 'Steg', 'Tor 1 / 3 / 5', 'Tor 2 / 4 / 5', 'Tor 5', 'Mann-über-Bord', 'Parcours', 'Knoten'])
      expect(wrapper.find('[data-hinweis="knoten-vorgabe"]').text()).toContain('DM 2026')
      expect(vorschau.find('.bogen-kennzeichen').text()).toBe('Beispielansicht')
      expect(vorschau.find('input.bk-wkr-input').exists()).toBe(false)
      // Der QR-Code steht als Muster da, trifft aber keinen Bogen: An der Stelle der Veranstaltung steht „MUSTER“.
      expect(vorschau.find('svg.qr-code').attributes('data-qr')).toMatch(/^ALC1\.MUSTER\.DM2026\.[A-Z0-9]+\.PAR2\.7\.1\.[A-Z0-9]+\.S1$/)
      expect(vorschau.find('svg.qr-code').attributes('data-qr')).not.toContain(store.state.value.kennung)
      // Eine Änderung am Entwurf erscheint in der Ansicht, ohne dass etwas gespeichert wäre.
      const titel = wrapper.findAll('.assistent input.spalte-titel')
      if (titel.length === 0) await wrapper.findAll('.assistent-ansicht button')[0].trigger('click')
      await wrapper.findAll('.assistent input.spalte-titel')[0].setValue('Am Kran')
      vi.advanceTimersByTime(250)
      await nextTick()
      expect(listen()).toContain('Am Kran')
      expect(store.state.value.eigeneAufbauten).toEqual([])
      expect(store.state.value.einteilung).toEqual({})
      // Ohne Namen besteht der Entwurf die Prüfung nicht: Hinweis statt Listen.
      await wrapper.find('#as-name').setValue('')
      vi.advanceTimersByTime(250)
      await nextTick()
      expect(vorschau.find('.bogen').exists()).toBe(false)
      expect(vorschau.find('.boat-banner.warn').text()).toContain('sobald der Entwurf die Prüfung besteht')
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Einstellungen: Wettkampfrichter-Listen', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })
  afterEach(() => setLocale('de'))

  it('Leerzeilen je Klasse: eine Zahl für alle, abweichend für einzelne Klassen', async () => {
    const wrapper = settings(store)
    const feld = wrapper.find('input[data-feld="wkr-leerzeilen"]')
    expect((feld.element as HTMLInputElement).value).toBe('3')
    await feld.setValue('2')
    expect(store.state.value.wkrLeerzeilen).toBe(2)
    const sieben = wrapper.find('input[data-feld="wkr-leerzeilen|7"]')
    expect((sieben.element as HTMLInputElement).value).toBe('2')
    expect(sieben.attributes('aria-label')).toBe('Leerzeilen Klasse 7')
    await sieben.setValue('6')
    expect(store.state.value.wkrLeerzeilenKlasse).toEqual({ '7': 6 })
    expect(sieben.classes()).toContain('own')
    // Ein geleertes Feld heißt: wieder die allgemeine Zahl.
    await sieben.setValue('')
    expect(store.state.value.wkrLeerzeilenKlasse).toEqual({})
    wrapper.unmount()
  })

  it('Beschreibung auf die Rückseite; beides reist in der Vorlage mit', async () => {
    const wrapper = settings(store)
    await wrapper.find('input[data-feld="wkr-rueckseite"]').setValue(true)
    expect(store.state.value.wkrRueckseite).toBe(true)
    store.dispatch({ type: 'SET_WKR_LEERZEILEN', anzahl: 5 })
    const vorlage = makeFile('vorlage', store.state.value, '2026-11-13T00:00:00.000Z')
    expect(vorlage.kind === 'vorlage' && vorlage.settings).toMatchObject({ wkrRueckseite: true, wkrLeerzeilen: 5 })
    wrapper.unmount()
  })
})

describe('Einstellungen: Streichläufe „nach Regel“ je Regelwerk', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })
  afterEach(() => setLocale('de'))

  const wahl = (wrapper: ReturnType<typeof settings>) => wrapper.find('select[data-feld="streichlaeufe"]')

  it('DM, zwei Läufe (C6): „nach Regel“ streicht einen – die Auswahl nennt die Regel, es gibt keine Warnung', async () => {
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 2 } })
    const wrapper = settings(store)
    await nextTick()
    expect(store.state.value.streichlaeufe).toBe('auto')
    expect(wahl(wrapper).find('option[value="auto"]').text()).toBe('nach Regel (DM 2026: bei 2 Läufen 1; sonst ab 3 Läufen einer)')
    expect(wrapper.find('[data-hinweis="streichlaeufe"]').text()).toBe('Es zählt 1 Lauf von 2.')
    expect(wrapper.find('[data-hinweis="regel-laeufe"]').exists()).toBe(false)
    // Von Hand abweichen bleibt möglich (Abbruch wegen Unwetter) – ebenfalls ohne Warnung.
    await wahl(wrapper).setValue('0')
    expect(store.state.value.streichlaeufe).toBe(0)
    expect(wrapper.find('[data-hinweis="streichlaeufe"]').text()).toBe('Es zählen 2 Läufe von 2.')
    expect(wrapper.find('[data-hinweis="regel-laeufe"]').exists()).toBe(false)
    // Drei Läufe: wie bisher einer.
    store.dispatch({ type: 'SET_STREICHLAEUFE', streichlaeufe: 'auto' })
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 3 } })
    await nextTick()
    expect(wrapper.find('[data-hinweis="streichlaeufe"]').text()).toBe('Es zählen 2 Läufe von 3.')
    wrapper.unmount()
  })

  it('ein Regelwerk ohne eigene Angabe nennt nur die allgemeine Regel', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    const wrapper = settings(store)
    await nextTick()
    expect(wahl(wrapper).find('option[value="auto"]').text()).toBe('nach Regel (ab 3 Läufen einer)')
    wrapper.unmount()
  })
})

describe('Einstellungen: Logos', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    vi.mocked(verkleinereLogo).mockClear()
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  /** Eine Datei ins Feld eines Platzes legen, wie es der Dateidialog täte. */
  async function waehle(wrapper: ReturnType<typeof settings>, seite: 'links' | 'rechts', datei: File) {
    const feld = wrapper.find(`input[data-feld="logo|${seite}"]`)
    Object.defineProperty(feld.element, 'files', { value: [datei], configurable: true })
    await feld.trigger('change')
    await flushPromises()
  }
  const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' })

  it('ein eigener Block mit Überschrift, unter DM und UIM', async () => {
    const wrapper = settings(store)
    expect(wrapper.find('#logos.panel > h2').text()).toBe('Logos auf den Listen')
    expect(wrapper.findAll('#logos fieldset.logo-slot').map((f) => f.attributes('data-logo'))).toEqual(['links', 'rechts'])
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    expect(wrapper.find('#logos').exists()).toBe(true)
    wrapper.unmount()
  })

  it('Bild wählen: verkleinert, gesetzt, mit Vorschau und Auskunft', async () => {
    const wrapper = settings(store)
    expect(wrapper.find('[data-logo="links"] .logo-leer').text()).toBe('Kein Logo')
    const datei = png()
    await waehle(wrapper, 'links', datei)
    expect(verkleinereLogo).toHaveBeenCalledWith(datei)
    expect(store.state.value.logos.links).toEqual(testLogo())
    expect(store.state.value.logos.rechts).toBeNull()
    const platz = wrapper.find('[data-logo="links"]')
    expect(platz.find('img.logo-vorschau').attributes('src')).toBe(TEST_PNG_2X1)
    expect(platz.find('img.logo-vorschau').attributes('alt')).toBe('Vorschau: Logo links')
    expect(platz.find('[data-hinweis="logo-info"]').text()).toContain('2 × 1 px')
    expect(platz.find('[data-hinweis="logo-info"]').text()).toContain('PNG')
    // Zwei Pixel bei 15 mm sind kaum Auflösung: Darauf weist der Platz hin.
    expect(platz.find('[data-hinweis="logo-aufloesung"]').exists()).toBe(true)
    expect(platz.find('[data-action="logo-waehlen|links"]').text()).toBe('Ersetzen …')
    // Name = sichtbarer Text (WCAG 2.5.3); den Platz nennt die legend des fieldset.
    expect(platz.find('[data-action="logo-waehlen|links"]').attributes('aria-label')).toBeUndefined()
    expect(platz.find('[data-action="logo-entfernen|links"]').attributes('aria-label')).toBeUndefined()
    expect(platz.element.tagName).toBe('FIELDSET')
    expect(platz.find('legend').text()).toBe('Logo links')
    wrapper.unmount()
  })

  it('ein Format, das nicht geht: kein Verkleinern, eine Meldung, der Stand bleibt', async () => {
    const wrapper = settings(store)
    const vorher = store.state.value
    await waehle(wrapper, 'links', new File(['x'], 'x.heic', { type: 'image/heic' }))
    expect(verkleinereLogo).not.toHaveBeenCalled()
    expect(wrapper.find('[data-logo="links"] .boat-banner.warn').text()).toContain('Dieses Dateiformat geht nicht')
    expect(store.state.value).toBe(vorher)
    wrapper.unmount()
  })

  it('ein Bild, das sich nicht lesen lässt: Meldung, das bisherige Logo bleibt', async () => {
    store.dispatch({ type: 'SET_LOGO', seite: 'rechts', logo: testLogo(4, 2) })
    const wrapper = settings(store)
    vi.mocked(verkleinereLogo).mockRejectedValueOnce(new LogoFehler('lesbar'))
    await waehle(wrapper, 'rechts', png())
    expect(wrapper.find('[data-logo="rechts"] [data-fehler="lesbar"]').text()).toContain('ließ sich nicht lesen')
    expect(store.state.value.logos.rechts).toEqual(testLogo(4, 2))
    wrapper.unmount()
  })

  it('Entfernen: das Logo ist weg, der Fokus steht auf dem Wahl-Knopf', async () => {
    store.dispatch({ type: 'SET_LOGO', seite: 'links', logo: testLogo() })
    const wrapper = settings(store, { attachTo: document.body })
    await wrapper.find('[data-action="logo-entfernen|links"]').trigger('click')
    await flushPromises()
    expect(store.state.value.logos.links).toBeNull()
    expect(wrapper.find('[data-action="logo-entfernen|links"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.find('[data-action="logo-waehlen|links"]').element)
    expect(wrapper.find('[data-action="logo-waehlen|links"]').text()).toBe('Bild wählen …')
    wrapper.unmount()
  })

  it('Höhe: gerundet und geklemmt, leer ist die Vorgabe; ein eigener Wert ist hervorgehoben', async () => {
    const wrapper = settings(store)
    const feld = wrapper.find('input[data-feld="logo-hoehe"]')
    expect((feld.element as HTMLInputElement).value).toBe('15')
    await feld.setValue('3')
    expect(store.state.value.logoHoeheMm).toBe(8)
    expect((feld.element as HTMLInputElement).value).toBe('8')
    await feld.setValue('')
    expect(store.state.value.logoHoeheMm).toBe(15)
    expect(feld.classes()).not.toContain('own')
    await feld.setValue('20')
    expect(store.state.value.logoHoeheMm).toBe(20)
    expect(feld.classes()).toContain('own')
    wrapper.unmount()
  })

  it('wäre der Speicher voll: das vorige Logo kommt zurück, mit Meldung', async () => {
    const wrapper = settings(store)
    // Am Speicher dieser Tests selbst (src/test-setup.ts: eigene Klasse, nicht Storage.prototype).
    const setItem = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key: string, wert: string) => {
      if (wert.includes(TEST_PNG_2X1)) throw new DOMException('voll', 'QuotaExceededError')
      setItem(key, wert)
    })
    await waehle(wrapper, 'links', png())
    expect(store.state.value.logos.links).toBeNull()
    expect(store.saved.value).toBe(true)
    expect(wrapper.find('[data-logo="links"] [data-fehler="speicher"]').text()).toContain('Speicher des Browsers voll')
    spy.mockRestore()
    wrapper.unmount()
  })
})

describe('Einstellungen: Anzeigetafel', () => {
  // Erfundene Starter (Vor<id>/Nach<id>, Musterclub) auf zwei Parcours, Verzahnung festgeschrieben.
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'LOAD_STATE', state: festgeschrieben(betriebsStand()) })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  const anzeige = () => store.state.value.anzeige

  it('ein eigener Abschnitt mit Verweis auf die Start-Freigabe; jedes Feld wirkt über SET_ANZEIGE', async () => {
    const wrapper = settings(store)
    const abschnitt = wrapper.find('#anzeigetafel.panel')
    expect(abschnitt.find('h2').text()).toBe('Anzeigetafel')
    expect(abschnitt.find('.hint a').attributes('href')).toBe('#/betrieb')

    await abschnitt.find('[data-feld="anzeige-davor"]').setValue(false)
    await abschnitt.find('[data-feld="anzeige-parcours-name"]').setValue(false)
    await abschnitt.find('[data-feld="anzeige-namen|kurz"]').trigger('click')
    await abschnitt.find('[data-feld="anzeige-herkunft"]').setValue('aus')
    await abschnitt.find('[data-feld="anzeige-sprache"]').setValue('en')
    await abschnitt.find('[data-feld="anzeige-logos"]').setValue(false)
    expect(anzeige()).toMatchObject({ davor: false, parcoursName: false, namen: 'kurz', herkunft: 'aus', sprache: 'en', logos: false })
    expect(abschnitt.find('[data-feld="anzeige-namen|kurz"]').classes()).toContain('active')

    // Größe in Prozent, geklemmt auf 70–130.
    await abschnitt.find('[data-feld="anzeige-skala"]').setValue('120')
    expect(anzeige().skala).toBe(1.2)
    const skala = abschnitt.find('[data-feld="anzeige-skala"]')
    await skala.setValue('300')
    expect(anzeige().skala).toBe(1.3)
    expect((skala.element as HTMLInputElement).value).toBe('130')
    // Noch einmal zu groß: Der Stand ändert sich nicht – das Feld zeigt trotzdem den geltenden Wert.
    await skala.setValue('250')
    expect((skala.element as HTMLInputElement).value).toBe('130')
    await skala.setValue('40')
    expect([anzeige().skala, (skala.element as HTMLInputElement).value]).toEqual([0.7, '70'])
    await skala.setValue('abc')
    expect((skala.element as HTMLInputElement).value).toBe('70')
    expect(abschnitt.text()).toContain('70 bis 130 %')
    wrapper.unmount()
  })

  it('Kopfzeile: leer = Name und Jahr (Vorgabe im Feld), eigener Text, oder keine', async () => {
    const wrapper = settings(store)
    const feld = wrapper.find('[data-feld="anzeige-kopfzeile"]')
    expect(feld.attributes('placeholder')).toBe('Musterpokal 2026')
    await feld.setValue('1. Musterregatta')
    expect(anzeige().kopfzeile).toBe('1. Musterregatta')
    await feld.setValue('  ')
    expect(anzeige().kopfzeile).toBeNull()
    await wrapper.find('[data-feld="anzeige-kopfzeile-zeigen"]').setValue(false)
    expect(anzeige().kopfzeile).toBe('')
    expect(wrapper.find('[data-feld="anzeige-kopfzeile"]').attributes('disabled')).toBeDefined()
    await wrapper.find('[data-feld="anzeige-kopfzeile-zeigen"]').setValue(true)
    expect(anzeige().kopfzeile).toBeNull()
    wrapper.unmount()
  })

  it('Parcours der gemeinsamen Anzeigetafel: alle (leer) oder eine Auswahl; einer bleibt immer', async () => {
    const wrapper = settings(store)
    const haken = () => wrapper.findAll('[data-feld="anzeige-bereiche"] input')
    expect(haken().map((h) => [h.attributes('data-bereich'), (h.element as HTMLInputElement).checked])).toEqual([
      ['par_1', true],
      ['par_2', true],
    ])
    await haken()[0].setValue(false)
    expect(anzeige().bereiche).toEqual(['par_2'])
    // Der letzte gewählte lässt sich nicht abwählen.
    expect(haken()[1].attributes('disabled')).toBeDefined()
    await haken()[0].setValue(true)
    expect(anzeige().bereiche).toEqual([])
    wrapper.unmount()
  })

  it('Namen „wie der Aushang“ nennt, was der Aushang gerade zeigt; Sprache „wie die Listen“ nennt die des Regelwerks', async () => {
    const wrapper = settings(store)
    expect(wrapper.find('[data-feld="anzeige-namen|aushang"]').text()).toBe('wie der Aushang (voll)')
    expect(wrapper.find('[data-feld="anzeige-sprache"] option[value="regelwerk"]').text()).toBe('wie die Listen (Deutsch)')
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    expect(wrapper.find('[data-feld="anzeige-sprache"] option[value="regelwerk"]').text()).toBe('wie die Listen (English)')
    wrapper.unmount()
  })

  it('Sprungziel #/einstellungen?anzeigetafel rollt zum Abschnitt', async () => {
    const vorher = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
    const scroll = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scroll, configurable: true, writable: true })
    location.hash = '#/einstellungen?anzeigetafel'
    try {
      const wrapper = settings(store, { attachTo: document.body })
      await flushPromises()
      expect(scroll.mock.contexts).toContain(wrapper.find('#anzeigetafel').element)
      wrapper.unmount()
    } finally {
      location.hash = ''
      if (vorher) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', vorher)
      else delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })
})
