import { describe, expect, it } from 'vitest'
import { ausgleichKg, gewichtsGruppen, parseGewicht } from './gewicht'
import type { ClassId, Starter } from '../types'

const s = (klasse: ClassId, nachname: string, vorname: string, verein: string): Starter => ({
  id: `${klasse}-${nachname}-${vorname}`,
  startNr: '',
  klasse,
  nachname,
  vorname,
  verein,
  bundesland: '',
  geburtsdatum: '',
  groesse: '',
})

describe('Zusatzgewicht', () => {
  it('rundet auf ganze kg, ab ,5 aufwärts', () => {
    expect(ausgleichKg(30.5, 33)).toBe(3)
    expect(ausgleichKg(32.6, 33)).toBe(0)
    expect(ausgleichKg(9, 33)).toBe(24)
  })

  it('braucht keines, wer das Standardgewicht erreicht', () => {
    expect(ausgleichKg(33, 33)).toBeNull()
    expect(ausgleichKg(40, 33)).toBeNull()
  })

  it('nennt für Ungewogene keinen Wert – nicht das volle Standardgewicht', () => {
    expect(ausgleichKg(undefined, 33)).toBeUndefined()
  })

  it('liest Gewichte mit Komma, Punkt und Einheit', () => {
    expect(parseGewicht('45')).toBe(45)
    expect(parseGewicht('45,5')).toBe(45.5)
    expect(parseGewicht(' 45.5 kg')).toBe(45.5)
    expect(parseGewicht('')).toBeUndefined()
    expect(parseGewicht('schwer')).toBeUndefined()
    expect(parseGewicht('0')).toBeUndefined()
  })
})

describe('Gewichtslisten', () => {
  const starters = [
    s('2', 'Zeh', 'Anna', 'Club B'),
    s('E', 'Meier', 'Tom', 'Club B'),
    s('2', 'Abel', 'Zoe', 'Club B'),
    s('2', 'Abel', 'Ben', 'Club B'),
    s('1', 'Lang', 'Ida', 'Club A'),
  ]

  it('je Herkunft eine Liste, darin nach Klasse, Nachname, Vorname', () => {
    const groups = gewichtsGruppen(starters, 'verein')
    expect(groups.map((g) => g.origin)).toEqual(['Club A', 'Club B'])
    expect(groups[1].starters.map((p) => `${p.klasse} ${p.nachname} ${p.vorname}`)).toEqual([
      'E Meier Tom',
      '2 Abel Ben',
      '2 Abel Zoe',
      '2 Zeh Anna',
    ])
  })

  it('ohne Herkunft eine einzige Liste', () => {
    const groups = gewichtsGruppen(starters, 'none')
    expect(groups).toHaveLength(1)
    expect(groups[0].starters).toHaveLength(5)
  })
})
