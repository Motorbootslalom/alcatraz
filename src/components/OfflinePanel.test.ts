import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import OfflinePanel from './OfflinePanel.vue'
import { offline } from '../lib/offline'
import { setLocale } from '../i18n'

const AUSGANG = { lage: 'vorbereiten', grund: undefined, fassung: '', dateien: 0, eindatei: false, neu: false, neuFassung: '', laedtNeu: false, ersetzt: false, suche: '', dauerhaft: 'unbekannt', abgelehnt: false } as const

beforeEach(() => {
  setLocale('de')
  Object.assign(offline, AUSGANG)
})

describe('OfflinePanel', () => {
  it('nennt die Lage in Worten', async () => {
    const w = mount(OfflinePanel)
    const lage = () => w.find('[data-offline-lage]').text()
    expect(lage()).toBe('Offline-Speicher wird vorbereitet …')

    Object.assign(offline, { lage: 'bereit', fassung: 'abc1234', dateien: 7 })
    await nextTick()
    expect(lage()).toBe('Offline bereit')
    expect(w.text()).toContain('7 Dateien, Codestand abc1234')

    Object.assign(offline, { lage: 'nicht-verfuegbar', grund: 'datei' })
    await nextTick()
    expect(lage()).toBe('Ein-Datei-Fassung – läuft ohne Internet')
    // Ohne Speicher gibt es nichts zu suchen.
    expect(w.find('[data-action="offline-suchen"]').exists()).toBe(false)

    Object.assign(offline, { grund: 'browser' })
    await nextTick()
    expect(lage()).toBe('Kein Offline-Speicher')
    expect(w.text()).toContain('privaten Fenster')
  })

  it('bietet die neue Fassung nur zum Übernehmen an', async () => {
    Object.assign(offline, { lage: 'bereit', neu: true, neuFassung: 'def5678' })
    const w = mount(OfflinePanel)
    expect(w.text()).toContain('Neue Fassung von Alcatraz verfügbar (Codestand def5678)')
    expect(w.find('[data-action="offline-uebernehmen"]').exists()).toBe(true)

    Object.assign(offline, { neu: false, ersetzt: true })
    await nextTick()
    expect(w.find('[data-action="offline-uebernehmen"]').exists()).toBe(false)
    expect(w.find('[data-action="offline-neu-laden"]').exists()).toBe(true)
  })

  it('nennt die Zusage des Browsers und verweist immer auf die Sicherung', async () => {
    const w = mount(OfflinePanel)
    const zusage = () => w.find('[data-offline-dauerhaft]')
    expect(zusage().find('button').exists()).toBe(false)

    Object.assign(offline, { dauerhaft: 'nein' })
    await nextTick()
    expect(zusage().text()).toContain('nicht zugesagt')
    expect(zusage().find('[data-action="offline-dauerhaft"]').exists()).toBe(true)

    Object.assign(offline, { dauerhaft: 'ja' })
    await nextTick()
    expect(zusage().text()).toContain('hat zugesagt')
    expect(zusage().find('button').exists()).toBe(false)
    expect(w.text()).toContain('Sicherungsdatei')
  })

  it('bietet die Ein-Datei-Fassung nur an, wenn sie im Speicher liegt', async () => {
    const w = mount(OfflinePanel)
    expect(w.find('a[download]').exists()).toBe(false)
    Object.assign(offline, { lage: 'bereit', eindatei: true })
    await nextTick()
    expect(w.find('a[download]').attributes('href')).toBe('./alcatraz.html')
  })
})
