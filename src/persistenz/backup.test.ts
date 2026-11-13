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
  it('Beispiel-Starterfeld: steht in der Sicherung, nicht in der Vorlage – es gehört zu den Startern', () => {
    const beispiel: AppState = { ...filled(), beispielStarter: true }
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', beispiel, AT)))
    expect(sicherung.ok && sicherung.kind === 'sicherung' && sicherung.state.beispielStarter).toBe(true)

    const datei = makeFile('vorlage', beispiel, AT)
    expect(JSON.stringify(datei)).not.toContain('beispielStarter')
    const vorlage = parseFile(JSON.stringify(datei))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    // Die Vorlage ändert nichts daran, woher die hiesigen Starter stammen – in beide Richtungen.
    expect(vorlage.apply(beispiel).beispielStarter).toBe(true)
    expect(vorlage.apply(filled()).beispielStarter).toBe(false)
    // Auch eine von Hand ergänzte Vorlage macht echte Starter nicht zu Beispieldaten.
    const ergaenzt = parseFile(JSON.stringify({ ...datei, settings: { ...(datei as { settings: object }).settings, beispielStarter: true } }))
    if (!ergaenzt.ok || ergaenzt.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(ergaenzt.apply(filled()).beispielStarter).toBe(false)
  })

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

describe('Listenoptionen in den Dateien', () => {
  const optionen = {
    wkrZeilenJeSeite: 15,
    wkrTeilenAb: 25,
    beschriftung: 'ls',
    listenSprache: 'de+en',
    tor5MitParcours: true,
    zusatzListen: { knoten: false, vorsteg: true },
    laufzettelLayout: 'liste',
  } as const

  it('sind Einstellungen: Sie stehen in Sicherung und Vorlage', () => {
    const stand: AppState = { ...filled(), ...optionen }
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', stand, AT)))
    expect(sicherung.ok && sicherung.kind === 'sicherung' && sicherung.state).toMatchObject(optionen)
    const datei = makeFile('vorlage', stand, AT)
    expect(datei.kind === 'vorlage' && datei.settings).toMatchObject(optionen)
    const vorlage = parseFile(JSON.stringify(datei))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    // Die Vorlage stellt eine andere Veranstaltung so ein, deren Starter bleiben.
    const danach = vorlage.apply(filled())
    expect(danach).toMatchObject(optionen)
    expect(danach.starters).toEqual(filled().starters)
  })

  it('eine Vorlage, die Tor 5 und Parcours zusammenlegt, zieht die hiesigen Eingaben und Namen mit', () => {
    const lauf = 'manoevrieren/1'
    // Die Disq-Buchstaben sind die der DM.
    const dm = (): AppState => ({ ...filled(), regelwerk: 'dm-2026' })
    const hier: AppState = {
      ...dm(),
      eingaben: { [lauf]: { [starter.id]: { 'disq@tor5': 'G', 'bemerkung@tor5': 'x', 'erfasst@tor5': '1', zeit1: '80' } } },
      einteilung: Object.fromEntries(filled().parcoursList.map((p) => [p.id, { tor5: 'Erika Muster' }])),
    }
    const vorlage = parseFile(JSON.stringify(makeFile('vorlage', { ...dm(), tor5MitParcours: true }, AT)))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const danach = vorlage.apply(hier)
    expect(danach.tor5MitParcours).toBe(true)
    expect(danach.eingaben[lauf][starter.id]).toEqual({ 'disq@tor5pue': 'G', 'bemerkung@tor5pue': 'x', 'erfasst@tor5pue': '1', zeit1: '80' })
    expect(Object.values(danach.einteilung)).toEqual(filled().parcoursList.map(() => ({ tor5pue: 'Erika Muster' })))
    // Und zurück mit einer Vorlage ohne die Option.
    const ohne = parseFile(JSON.stringify(makeFile('vorlage', dm(), AT)))
    if (!ohne.ok || ohne.kind !== 'vorlage') throw new Error('keine Vorlage')
    expect(ohne.apply(danach).eingaben).toEqual(hier.eingaben)
  })
})
