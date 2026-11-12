import { describe, expect, it } from 'vitest'
import { fileStamp, filename, makeFile, parseFile } from './backup'
import { loadState, saveState, STATE_KEY } from './storage'
import { emptyState } from '../state/reducer'
import type { AppState, Starter } from '../types'

const AT = '2026-11-11T22:15:00.000Z'
const starter: Starter = {
  id: 'st_1',
  startNr: '101',
  vorname: 'A',
  nachname: 'B',
  verein: 'Club',
  bundesland: '',
  geburtsdatum: '2017-01-01',
  klasse: '1',
  groesse: 'M',
}
const filled = (): AppState => ({
  ...emptyState(),
  eventName: '30. Möwepokal',
  starters: [starter],
  regelwerk: 'uim-2026',
  showBirthdate: false,
  originShort: { Club: 'CLB' },
})
const roundTrip = (kind: Parameters<typeof makeFile>[0]) => parseFile(JSON.stringify(makeFile(kind, filled(), AT)))

describe('Dateien', () => {
  it('Sicherung: der ganze Stand kommt zurück', () => {
    expect(roundTrip('sicherung')).toEqual({ ok: true, kind: 'sicherung', state: filled(), savedAt: AT })
  })

  it('Vorlage: enthält keine Starter und keinen Namen, setzt nur die Einstellungen', () => {
    const file = makeFile('vorlage', filled(), AT)
    expect(JSON.stringify(file)).not.toContain('Möwepokal')
    expect(JSON.stringify(file)).not.toContain('st_1')

    const result = roundTrip('vorlage')
    if (!result.ok || result.kind !== 'vorlage') throw new Error('keine Vorlage')
    const other: Starter = { ...starter, id: 'st_9', nachname: 'Anders' }
    const applied = result.apply({ ...emptyState(), eventName: 'Neuer Pokal', eventJahr: 2027, starters: [other] })
    expect(applied).toMatchObject({ eventName: 'Neuer Pokal', eventJahr: 2027, regelwerk: 'uim-2026', showBirthdate: false })
    expect(applied.originShort).toEqual({ Club: 'CLB' })
    expect(applied.starters).toEqual([other])
  })

  it('Teilnehmerdaten: nur die Starter', () => {
    const file = makeFile('starter', filled(), AT)
    expect(file).not.toHaveProperty('state')
    expect(roundTrip('starter')).toEqual({ ok: true, kind: 'starter', starters: [starter], savedAt: AT })
  })

  it('liest ältere Sicherungen ohne Angabe der Art', () => {
    const old = { app: 'alcatraz', version: 1, savedAt: AT, state: emptyState() }
    expect(parseFile(JSON.stringify(old))).toMatchObject({ ok: true, kind: 'sicherung' })
  })

  it('weist fremde und kaputte Dateien ab', () => {
    expect(parseFile('kein json').ok).toBe(false)
    expect(parseFile(JSON.stringify({ app: 'tafel', state: emptyState() })).ok).toBe(false)
    expect(parseFile(JSON.stringify({ app: 'alcatraz', kind: 'sicherung', state: {} })).ok).toBe(false)
    expect(parseFile(JSON.stringify({ app: 'alcatraz', kind: 'starter', starters: 'nein' })).ok).toBe(false)
    expect(parseFile(JSON.stringify({ app: 'alcatraz', kind: 'unbekannt' })).ok).toBe(false)
  })

  it('bildet Dateinamen ohne Sonderzeichen', () => {
    const at = new Date(2026, 10, 11, 23, 5)
    expect(fileStamp(at)).toBe('2026-11-11_2305')
    expect(filename('sicherung', 'Sicherung', filled(), at)).toBe('alcatraz-sicherung-30-mowepokal-2026-2026-11-11_2305.json')
    expect(filename('vorlage', 'Vorlage', filled(), at)).toBe('alcatraz-vorlage-2026-11-11_2305.json')
    // In der englischen Oberfläche heißen auch die Dateien englisch.
    expect(filename('sicherung', 'Backup', filled(), at)).toBe('alcatraz-backup-30-mowepokal-2026-2026-11-11_2305.json')
  })
})

describe('Speicher im Browser', () => {
  it('speichert und lädt den Stand', () => {
    localStorage.clear()
    expect(loadState()).toBeNull()
    const state = { ...emptyState(), eventName: 'Test' }
    expect(saveState(state)).toBe(true)
    expect(loadState()).toEqual(state)
  })

  it('beginnt leer, wenn der gespeicherte Stand kaputt ist', () => {
    localStorage.setItem(STATE_KEY, '{kaputt')
    expect(loadState()).toBeNull()
  })
})
