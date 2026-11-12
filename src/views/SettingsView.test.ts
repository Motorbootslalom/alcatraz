import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SettingsView from './SettingsView.vue'
import { downloadText } from '../persistenz/backup'
import { createStore, storeKey, type Store } from '../state/store'
import { setLocale } from '../i18n'
import { configFor } from '../config/konfig'
import type { RawAufbau } from '../config/schema'

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

// Der Download selbst braucht einen Browser; geprüft wird, was heruntergeladen würde.
vi.mock('../persistenz/backup', async (original) => ({
  ...(await original<typeof import('../persistenz/backup')>()),
  downloadText: vi.fn(),
}))

/** Wie aus einer beschädigten Sicherung: Die Form stimmt, die Prüfung stolpert (`klassen` muss eine Liste sein). */
const kaputt = { id: 'kk', name: 'Kaputt', positionen: [{ id: 'pz', titel: 'x', bojen: ['Tor1'], klassen: 5 }] } as unknown as RawAufbau

function settings(store: Store) {
  return mount(SettingsView, { global: { provide: { [storeKey as symbol]: store } } })
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
    expect(wrapper.findAll('.assistent-tabelle thead th input.spalte-titel').length).toBeGreaterThan(0)
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
    const zellen = wrapper.findAll('.assistent-tabelle tbody td:not(.rand)')
    expect(zellen.length).toBeGreaterThan(0)
    // Jede Zelle der Zuordnung trägt genau eine Schaltfläche.
    for (const zelle of zellen) expect(zelle.findAll('button.zelle')).toHaveLength(1)

    const knoepfe = wrapper.findAll('.assistent-tabelle tbody button.zelle')
    const titel = (wrapper.find('.assistent-tabelle thead input.spalte-titel').element as HTMLInputElement).value
    expect(knoepfe[0].attributes('aria-label')).toBe(`Start / Ziel: beobachtet von ${titel}`)
    const frei = knoepfe.find((k) => k.attributes('aria-pressed') === 'false')!
    const name = frei.attributes('aria-label')
    await frei.trigger('click')
    const danach = wrapper.findAll('.assistent-tabelle tbody button.zelle').find((k) => k.attributes('aria-label') === name)!
    expect(danach.attributes('aria-pressed')).toBe('true')
    expect(danach.text()).toBe('●')

    // Aufgeklappt: die einzelnen Bojen, ebenfalls als Schaltflächen; das halbe Tor heißt „mixed“.
    await wrapper.find('.assistent-tabelle .aufklappen').trigger('click')
    const haelfte = wrapper.find('.assistent-tabelle tr.haelfte button.zelle')
    expect(haelfte.attributes('aria-label')).toContain('Start / Ziel rechts: beobachtet von')
    const vorher = haelfte.attributes('aria-pressed')
    await haelfte.trigger('click')
    expect(wrapper.find('.assistent-tabelle tr.haelfte button.zelle').attributes('aria-pressed')).toBe(vorher === 'true' ? 'false' : 'true')
    expect(wrapper.findAll('.assistent-tabelle tbody button.zelle')[0].attributes('aria-pressed')).toBe('mixed')
    wrapper.unmount()
  })

  it('„Einspielen“ sind echte Schaltflächen, die das Dateifeld öffnen', async () => {
    const wrapper = settings(store)
    for (const [knopf, feld] of [
      ['.own-setups [data-action="upload"]', '.own-setups input[type="file"]'],
      ['[data-action="upload-file"]', 'input[type="file"][accept*="json"]'],
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
    expect(wrapper.findAll('.assistent-tabelle thead input.spalte-titel').length).toBeGreaterThan(0)
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
})
