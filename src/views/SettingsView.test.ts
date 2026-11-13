import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import SettingsView from './SettingsView.vue'
import { downloadText, makeFile } from '../persistenz/backup'
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

describe('Einstellungen: WKR-Einteilung und Beispielansicht', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
  })
  afterEach(() => setLocale('de'))

  it('die WKR-Einteilung ist ein eigener Abschnitt; die Beispielansicht gehört zum Assistenten und zur Veranstaltung', async () => {
    const wrapper = settings(store)
    const abschnitt = wrapper.find('#wkr-einteilung')
    expect(abschnitt.find('h2').text()).toBe('WKR-Einteilung')
    expect(abschnitt.find('.wkr-tabelle').exists()).toBe(true)
    // Ohne offenen Assistenten gibt es hier keine Beispielansicht (sie steht bei der Veranstaltung).
    expect(wrapper.find('.wkr-vorschau').exists()).toBe(false)
    // Sie steht vor den eigenen Aufbauten und den Dateien.
    const reihenfolge = wrapper.findAll('.panel > h2, details.panel > summary').map((h) => h.text())
    expect(reihenfolge.indexOf('WKR-Einteilung')).toBeGreaterThan(reihenfolge.indexOf('Listen'))
    expect(reihenfolge.indexOf('WKR-Einteilung')).toBeLessThan(reihenfolge.indexOf('Eigene Aufbauten'))
    // Einstellungen der Wettkampfrichter-Listen und die Namen stehen zusammen, vor den Standardgewichten.
    expect(reihenfolge.indexOf('WKR-Einteilung')).toBe(reihenfolge.indexOf('Wettkampfrichter-Listen') + 1)
    expect(reihenfolge.indexOf('WKR-Einteilung')).toBeLessThan(reihenfolge.indexOf('Standardgewichte'))
    // Die Beispieldaten stehen bei der Veranstaltung, nicht mehr hier.
    expect(reihenfolge).not.toContain('Beispieldaten')
    expect(reihenfolge.at(-1)).toBe('Dateien')
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
