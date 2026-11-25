import { describe, expect, it } from 'vitest'
import { AUSGLEICH_STUFE_VORGABE, ausgleichKg, ausgleichStufeWert, gewichtsGruppen, gewichtText, parseAusgleichStufe, parseGewicht, rundeAufStufe } from './gewicht'
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

describe('Ausgleichsgewicht', () => {
  const kg1 = (gewicht: number | undefined, soll: number) => ausgleichKg(gewicht, soll, AUSGLEICH_STUFE_VORGABE)

  it('rundet mit der Vorgabe (1 kg) wie vorher auf ganze kg, ab ,5 aufwärts', () => {
    expect(AUSGLEICH_STUFE_VORGABE).toBe(1)
    expect(kg1(30.5, 33)).toBe(3)
    expect(kg1(32.6, 33)).toBe(0)
    expect(kg1(9, 33)).toBe(24)
    // Kein grundsätzliches Aufrunden (Nutzer 24.11.2026): 2,4 kg leichter → 2, 2,5 → 3.
    expect(kg1(30.6, 33)).toBe(2)
    expect(kg1(42.5, 45)).toBe(3)
  })

  it('braucht keines, wer das Durchschnittsgewicht erreicht', () => {
    expect(kg1(33, 33)).toBeNull()
    expect(kg1(40, 33)).toBeNull()
  })

  it('nennt für Ungewogene keinen Wert – nicht das volle Durchschnittsgewicht', () => {
    expect(kg1(undefined, 33)).toBeUndefined()
  })

  it('liest Gewichte mit Komma, Punkt und Einheit', () => {
    expect(parseGewicht('45')).toBe(45)
    expect(parseGewicht('45,5')).toBe(45.5)
    expect(parseGewicht(' 45.5 kg')).toBe(45.5)
    expect(parseGewicht('')).toBeUndefined()
    expect(parseGewicht('schwer')).toBeUndefined()
    expect(parseGewicht('0')).toBeUndefined()
  })

  it('schreibt Gewichte mit dem Dezimalzeichen der Listensprache', () => {
    expect(gewichtText(28.7, 'de')).toBe('28,7')
    expect(gewichtText(28.7, 'en')).toBe('28.7')
    expect(gewichtText(26, 'de')).toBe('26')
    expect(gewichtText(26, 'en')).toBe('26')
  })
})

describe('Kleinstes Zusatzgewicht – Rundung auf die Stufe (Nutzer 24.11.2026)', () => {
  it('rundet auf das nächste Vielfache, genau in der Mitte aufwärts (Beispiele des Auftrags)', () => {
    // Stufe 2 kg: 2,9 → 2; 3,0 → 4; 3,1 → 4; 0,9 → 0; 1,0 → 2.
    expect([2.9, 3.0, 3.1, 0.9, 1.0].map((kg) => rundeAufStufe(kg, 2))).toEqual([2, 4, 4, 0, 2])
    // Stufe 0,5 kg: 1,2 → 1,0; 1,25 → 1,5; 1,3 → 1,5.
    expect([1.2, 1.25, 1.3].map((kg) => rundeAufStufe(kg, 0.5))).toEqual([1, 1.5, 1.5])
    // Stufe 0,1 kg: das Gewicht selbst (auf 0,1 kg gewogen).
    expect([0.3, 2.7, 0.05].map((kg) => rundeAufStufe(kg, 0.1))).toEqual([0.3, 2.7, 0.1])
  })

  it('rechnet in Gramm: kein Gleitkomma-Rest, die Mitte ist wirklich die Mitte', () => {
    // 30,3 − 27,8 ist im Gleitkomma nicht genau 2,5 – in Gramm schon.
    expect(ausgleichKg(27.8, 30.3, 1)).toBe(3)
    expect(ausgleichKg(27.8, 30.3, 5)).toBe(5)
    expect(ausgleichKg(28.0, 30.3, 0.1)).toBe(2.3)
    expect(ausgleichKg(29.9, 30.3, 0.1)).toBe(0.4)
    // Ungerade Grammzahl der Stufe (0,25 kg): 0,125 ist die Mitte → aufwärts.
    expect([0.12, 0.125, 0.37, 0.375].map((kg) => rundeAufStufe(kg, 0.25))).toEqual([0, 0.25, 0.25, 0.5])
    expect(String(ausgleichKg(44.3, 45, 0.1))).toBe('0.7')
  })

  it('Ausgleichsgewicht mit Stufe: weniger als eine halbe Stufe leichter = 0, gewogen und nicht leichter = keines', () => {
    expect(ausgleichKg(64.1, 65, 2)).toBe(0)
    expect(ausgleichKg(64, 65, 2)).toBe(2)
    expect(ausgleichKg(58.4, 65, 2)).toBe(6)
    expect(ausgleichKg(58.4, 65, 0.5)).toBe(6.5)
    expect(ausgleichKg(65, 65, 2)).toBeNull()
    expect(ausgleichKg(undefined, 65, 2)).toBeUndefined()
  })

  it('prüft die Stufe: Zahl in 0,1–10 kg, auf 10 g; Eingabe mit Komma', () => {
    expect([0.1, 0.5, 1, 2, 10, 0.25].map(ausgleichStufeWert)).toEqual([0.1, 0.5, 1, 2, 10, 0.25])
    expect([0, -1, 0.09, 10.5, NaN, Infinity, '1', null, undefined].map(ausgleichStufeWert)).toEqual(Array(9).fill(undefined))
    expect(ausgleichStufeWert(0.333)).toBe(0.33)
    expect(parseAusgleichStufe('0,5')).toBe(0.5)
    expect(parseAusgleichStufe(' 2 kg')).toBe(2)
    expect(parseAusgleichStufe('2.5')).toBe(2.5)
    expect(parseAusgleichStufe('')).toBeUndefined()
    expect(parseAusgleichStufe('viel')).toBeUndefined()
    expect(parseAusgleichStufe('0')).toBeUndefined()
    expect(parseAusgleichStufe('12')).toBeUndefined()
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

  it('gleichbedeutende Schreibweisen sind eine Liste, benannt nach der häufigsten', () => {
    const feld = [s('1', 'Abel', 'Ben', 'NRW'), s('2', 'Zeh', 'Anna', 'Nordrhein-Westfalen'), s('E', 'Meier', 'Tom', 'Nordrhein-Westfalen'), s('1', 'Kurz', 'Ida', 'Bayern')]
    const gleich = (name: string) => (name === 'NRW' ? 'nordrhein-westfalen' : name.toLowerCase())
    const groups = gewichtsGruppen(feld, 'verein', gleich)
    expect(groups.map((g) => [g.origin, g.starters.map((p) => p.nachname)])).toEqual([
      ['Bayern', ['Kurz']],
      ['Nordrhein-Westfalen', ['Meier', 'Abel', 'Zeh']],
    ])
    // Ohne Schlüssel bleibt jede Schreibweise für sich.
    expect(gewichtsGruppen(feld, 'verein').map((g) => g.origin)).toEqual(['Bayern', 'Nordrhein-Westfalen', 'NRW'])
  })

  it('ohne Herkunft eine einzige Liste', () => {
    const groups = gewichtsGruppen(starters, 'none')
    expect(groups).toHaveLength(1)
    expect(groups[0].starters).toHaveLength(5)
  })
})
