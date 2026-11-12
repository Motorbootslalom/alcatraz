import { describe, expect, it } from 'vitest'
import { configFor } from './konfig'
import type { RawPosition } from './schema'
import { abwandlung, mitZeiten, nummerierung, zeitSpalten } from './zeitnahme'

const { getAufbau, getSheetDef } = configFor()

const zeit: RawPosition = {
  id: 'zeit',
  titel: 'Zeit',
  menue: 'Zeitnahme',
  spalten: ['zeit1', 'zeit2', 'zeit3'].map((key, i) => ({ key, label: `Zeit ${i + 1}`, typ: 'zeit' as const })),
}

describe('Zeitspalten je Gerät', () => {
  it('nennt eine einzelne Spalte nur „Zeit“, mehrere nach ihrem Gerät', () => {
    expect(zeitSpalten(['elektronisch']).map((s) => s.label)).toEqual(['Zeit'])
    expect(zeitSpalten(['elektronisch', 'stoppuhr', 'stoppuhr']).map((s) => s.label)).toEqual([
      'Elektronisch',
      'Stoppuhr 1',
      'Stoppuhr 2',
    ])
    expect(zeitSpalten(['elektronisch', 'stoppuhr']).map((s) => [s.key, s.geraet])).toEqual([
      ['zeit1', 'elektronisch'],
      ['zeit2', 'stoppuhr'],
    ])
  })

  it('ersetzt die Zeitspalten an ihrer Stelle und lässt die übrigen stehen', () => {
    const startZiel: RawPosition = {
      id: 'sz',
      titel: 'Start/Ziel',
      spalten: [...zeit.spalten, { key: 'start', typ: 'boje', sub: ['hin seiteA'] }],
    }
    expect(mitZeiten(startZiel, ['elektronisch']).spalten.map((s) => s.key)).toEqual(['zeit1', 'start'])
  })

  it('benennt eine reine Zeitliste nach ihrem Gerät, eine Liste mit Bojen nicht', () => {
    expect(abwandlung(zeit, { id: 'zeit', zeiten: ['elektronisch'] })).toMatchObject({
      titel: 'Elektronische Zeiterfassung',
      menue: 'Elektronische Zeiterfassung',
    })
    expect(abwandlung(zeit, { id: 'zeit', zeiten: ['stoppuhr', 'stoppuhr'] }).titel).toBe('Zeit')
    expect(abwandlung(zeit, { id: 'zeit', zeiten: ['stoppuhr'], titel: 'Handzeit' }).titel).toBe('Handzeit')
    const mitBoje = { ...zeit, titel: 'Start/Ziel', spalten: [...zeit.spalten, { key: 'start', typ: 'boje' as const }] }
    expect(abwandlung(mitBoje, { id: 'zeit', zeiten: ['elektronisch'] }).titel).toBe('Start/Ziel')
  })
})

describe('Nummerierung im Aufbau', () => {
  it('nummeriert mehrfache Positionen und jede Abwandlung', () => {
    expect(nummerierung(['zeit', 'steg']).map((n) => n.nid ?? n.id)).toEqual(['zeit', 'steg'])
    expect(nummerierung(['zeit', 'zeit', 'steg']).map((n) => n.nid ?? n.id)).toEqual(['zeit-1', 'zeit-2', 'steg'])
    expect(nummerierung([{ id: 'zeit', zeiten: ['elektronisch'] }, 'steg']).map((n) => n.nid ?? n.id)).toEqual(['zeit-1', 'steg'])
  })
})

describe('Alcatraz-DM26: je Gerät eine Zeitliste', () => {
  it('behält die IDs zeit-1 bis zeit-3', () => {
    expect(getAufbau('alcatrazdm26').order.slice(0, 3)).toEqual(['zeit-1', 'zeit-2', 'zeit-3'])
  })

  it('nennt das Gerät im Titel und hat je Liste eine Zeitspalte', () => {
    const listen = ['zeit-1', 'zeit-2', 'zeit-3'].map(getSheetDef)
    expect(listen.map((d) => d.titelDe)).toEqual(['Elektronische Zeiterfassung', 'Stoppuhr (1)', 'Stoppuhr (2)'])
    expect(listen.map((d) => d.columns.map((c) => [c.label, c.geraet, c.felder]))).toEqual([
      [['Zeit', 'elektronisch', ['zeit1']]],
      [['Zeit', 'stoppuhr', ['zeit1~2']]],
      [['Zeit', 'stoppuhr', ['zeit1~3']]],
    ])
  })

  it('lässt die einfache Zeitliste der anderen Aufbauten unverändert', () => {
    expect(getAufbau('alcatraz').order[0]).toBe('zeit')
    const einfach = getSheetDef('zeit')
    expect(einfach.titelDe).toBe('Zeit')
    expect(einfach.columns.map((c) => [c.label, c.geraet])).toEqual([
      ['Zeit 1', undefined],
      ['Zeit 2', undefined],
      ['Zeit 3', undefined],
    ])
  })
})
