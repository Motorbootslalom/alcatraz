import { describe, expect, it } from 'vitest'
import { emptyState, reducer } from './reducer'
import { migrate } from './migrate'
import { makeFile, parseFile } from '../persistenz/backup'
import { startNrBereicheOf } from '../config/catalog'
import type { AppState, ClassId, Starter } from '../types'

/** Erfundener Starter (Muster Vor1/Nach1). */
function st(klasse: ClassId, i: number, groesse: string, startNr = ''): Starter {
  return { id: `${klasse}-${i}`, startNr, vorname: `Vor${i}`, nachname: `Nach${i}`, verein: 'Musterclub', bundesland: '', geburtsdatum: '', klasse, groesse }
}

function dmMit(starters: Starter[]): AppState {
  const s = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
  return reducer(s, { type: 'ADD_STARTERS', starters })
}

const nrVon = (s: AppState) => Object.fromEntries(s.starters.map((p) => [p.id, p.startNr]))

describe('Startnummern-Bereiche im Zustand (19.11.2026)', () => {
  it('Vorgabe des Regelwerks: DM mit der DMYV-Liste, UIM ohne', () => {
    const dm = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    expect(startNrBereicheOf(dm, '6').map((b) => `${b.von}-${b.bis} ${b.gruppe}`)).toEqual(['601-610 S-M', '611-625 L-XL', '626-630 XXL'])
    expect(startNrBereicheOf(dm, 'E')[0]).toEqual({ von: 'E101', bis: 'E130', gruppe: 'S-M' })
    const uim = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    expect(startNrBereicheOf(uim, '6')).toEqual([])
  })

  it('„Startnummern vergeben“ nimmt die Bereiche und überspringt fehlende Westen', () => {
    let s = dmMit([st('6', 1, 'XL'), st('6', 2, 'S'), st('6', 3, 'XXL'), st('E', 1, 'M')])
    s = reducer(s, { type: 'SET_FEHLENDE_START_NR', nummern: ['611', 'e101'] })
    expect(s.fehlendeStartNr).toEqual(['611', 'E101'])
    s = reducer(s, { type: 'ASSIGN_START_NUMBERS' })
    expect(nrVon(s)).toEqual({ '6-1': '612', '6-2': '601', '6-3': '626', 'E-1': 'E102' })
  })

  it('eigene Bereiche je Klasse ersetzen die Vorgabe; null stellt sie wieder her; Unverändertes bleibt derselbe Stand', () => {
    let s = dmMit([st('3', 1, 'L')])
    s = reducer(s, { type: 'SET_START_NR_BEREICHE', klasse: '3', bereiche: [{ von: '301', bis: '320', gruppe: 'S-M' }, { von: '321', bis: '330', gruppe: 'L-XL' }] })
    expect(reducer(s, { type: 'ASSIGN_START_NUMBERS' }).starters[0].startNr).toBe('321')
    expect(reducer(s, { type: 'SET_START_NR_BEREICHE', klasse: '3', bereiche: [...s.startNrBereiche['3']!] })).toBe(s)
    const ohne = reducer(s, { type: 'SET_START_NR_BEREICHE', klasse: '3', bereiche: [] })
    expect(reducer(ohne, { type: 'ASSIGN_START_NUMBERS' }).starters[0].startNr).toBe('301')
    const zurueck = reducer(s, { type: 'SET_START_NR_BEREICHE', klasse: '3', bereiche: null })
    expect(zurueck.startNrBereiche).toEqual({})
    expect(reducer(zurueck, { type: 'SET_FEHLENDE_START_NR', nummern: [] })).toBe(zurueck)
  })

  it('Verschieben, Sortieren und Zufall lassen jede Nummer in ihrem Größenbereich', () => {
    let s = dmMit([st('5', 1, 'S'), st('5', 2, 'M'), st('5', 3, 'L'), st('5', 4, 'XXL')])
    s = reducer(s, { type: 'ASSIGN_START_NUMBERS' })
    expect(nrVon(s)).toEqual({ '5-1': '501', '5-2': '502', '5-3': '511', '5-4': '529' })
    const hoch = reducer(s, { type: 'MOVE_STARTER', id: '5-4', target: 'first' })
    // Der XXL-Starter ist in seinem Bereich schon vorn: nichts ändert sich.
    expect(hoch).toBe(s)
    const getauscht = reducer(s, { type: 'MOVE_STARTER', id: '5-2', target: 'first' })
    expect(nrVon(getauscht)).toEqual({ '5-1': '502', '5-2': '501', '5-3': '511', '5-4': '529' })
    const gemischt = reducer(s, { type: 'SHUFFLE_STARTERS', klassen: ['5'], saat: 7 })
    expect(new Set(gemischt.starters.filter((p) => p.groesse === 'XXL').map((p) => p.startNr))).toEqual(new Set(['529']))
    expect(new Set(gemischt.starters.filter((p) => p.groesse === 'L').map((p) => p.startNr))).toEqual(new Set(['511']))
  })

  it('in eine andere Klasse verschieben: nächste freie Nummer aus dem Bereich der Größe', () => {
    let s = dmMit([st('6', 1, 'XL', '611'), st('7', 1, 'XL', '')])
    s = reducer(s, { type: 'MOVE_STARTER_TO_CLASS', id: '7-1', klasse: '6' })
    expect(s.starters.find((p) => p.id === '7-1')?.startNr).toBe('612')
  })

  it('migrate prüft beide Felder; Sicherung und Vorlage tragen sie als Einstellung', () => {
    const roh = { ...emptyState(), startNrBereiche: { 5: [{ von: 501, bis: '510', gruppe: 'S-M' }, { von: '511', gruppe: 'L-XL' }], Q: [], 6: 'x' }, fehlendeStartNr: ['512', 7, '', null, '512'] }
    const m = migrate(JSON.parse(JSON.stringify(roh)))!
    expect(m.startNrBereiche).toEqual({ 5: [{ von: '501', bis: '510', gruppe: 'S-M' }] })
    expect(m.fehlendeStartNr).toEqual(['512', '7'])
    const alt = migrate(JSON.parse(JSON.stringify({ ...emptyState(), startNrBereiche: undefined, fehlendeStartNr: undefined })))!
    expect([alt.startNrBereiche, alt.fehlendeStartNr]).toEqual([{}, []])

    const stand: AppState = { ...emptyState(), startNrBereiche: { 3: [{ von: '301', bis: '330', gruppe: 'L-XL' }] }, fehlendeStartNr: ['305'] }
    const vorlage = parseFile(JSON.stringify(makeFile('vorlage', stand, '2026-11-19T10:00:00.000Z')))
    if (!vorlage.ok || vorlage.kind !== 'vorlage') throw new Error('keine Vorlage')
    const danach = vorlage.apply(emptyState())
    expect([danach.startNrBereiche, danach.fehlendeStartNr]).toEqual([stand.startNrBereiche, ['305']])
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', stand, '2026-11-19T10:00:00.000Z')))
    expect(sicherung.ok && sicherung.kind === 'sicherung' && sicherung.state.fehlendeStartNr).toEqual(['305'])
  })
})
