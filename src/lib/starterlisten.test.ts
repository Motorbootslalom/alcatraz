import { describe, expect, it } from 'vitest'
import { ALLE, gewaehlteHerkuenfte, herkuenfte, istStarterWahl, nachStartnummer, ohneHerkunft, STARTER_WAHL } from './starterlisten'
import type { ClassId, Starter } from '../types'

// Die Starterlisten: Herkünfte und Reihenfolge. Alle Starter sind erfunden.

let lfd = 0
const starter = (startNr: string, klasse: ClassId, extra: Partial<Starter> = {}): Starter => ({
  id: `s${++lfd}`,
  startNr,
  vorname: 'Vor',
  nachname: `Nach${startNr}`,
  verein: 'Musterclub',
  bundesland: 'Bayern',
  geburtsdatum: '',
  klasse,
  groesse: '',
  ...extra,
})

describe('Herkünfte des Starterfelds', () => {
  it('nach Namen sortiert, jede mit ihren Startern in der Reihenfolge des Felds', () => {
    const feld = [starter('101', '1', { verein: 'WSV Ost' }), starter('102', '1', { verein: 'MBC Nord' }), starter('201', '2', { verein: 'WSV Ost' })]
    expect(herkuenfte(feld, 'verein').map((h) => [h.name, h.starter.map((p) => p.startNr)])).toEqual([
      ['MBC Nord', ['102']],
      ['WSV Ost', ['101', '201']],
    ])
  })

  it('gleichbedeutende Schreibweisen sind eine Herkunft – wie in der Mannschaftswertung; es gilt die häufigste', () => {
    const feld = [
      starter('101', '1', { bundesland: 'NRW' }),
      starter('102', '1', { bundesland: 'Nordrhein-Westfalen' }),
      starter('103', '1', { bundesland: 'nordrhein-westfalen ' }),
      starter('104', '1', { bundesland: 'Nordrhein-Westfalen' }),
      starter('105', '1', { bundesland: 'Bayern' }),
    ]
    const h = herkuenfte(feld, 'bundesland')
    expect(h.map((x) => [x.name, x.starter.length])).toEqual([
      ['Bayern', 1],
      ['Nordrhein-Westfalen', 4],
    ])
    // Staaten ebenso: Kürzel, deutscher und englischer Name.
    const laender = herkuenfte([starter('1', '1', { land: 'GER' }), starter('2', '1', { land: 'Germany' }), starter('3', '1', { land: 'Deutschland' }), starter('4', '1', { land: 'Austria' })], 'land')
    expect(laender.map((x) => x.starter.length).sort()).toEqual([1, 3])
    // Vereine haben keine Zuordnung: Dort zählt nur die Schreibweise (ohne Groß-/Kleinschreibung und doppelte Leerzeichen).
    expect(herkuenfte([starter('1', '1', { verein: 'MBC  Nord' }), starter('2', '1', { verein: 'mbc nord' }), starter('3', '1', { verein: 'MBC Nord e.V.' })], 'verein').map((x) => x.starter.length)).toEqual([2, 1])
  })

  it('ohne gewählte Herkunft gibt es keine; wer nichts eingetragen hat, gehört zu keiner', () => {
    const feld = [starter('101', '1', { land: 'Latvia' }), starter('102', '1', { land: '' }), starter('103', '1')]
    expect(herkuenfte(feld, 'none')).toEqual([])
    expect(ohneHerkunft(feld, 'none')).toEqual([])
    expect(herkuenfte(feld, 'land').map((h) => h.name)).toEqual(['Latvia'])
    expect(ohneHerkunft(feld, 'land').map((p) => p.startNr)).toEqual(['102', '103'])
    // „Verein“ fällt wie auf den Listen auf das Bundesland zurück (lib/origin.ts).
    expect(herkuenfte([starter('1', '1', { verein: '' })], 'verein').map((h) => h.name)).toEqual(['Bayern'])
  })

  it('die Auswahl: alle, eine – und eine, die es nicht mehr gibt, zählt wie „alle“', () => {
    const h = herkuenfte([starter('101', '1', { verein: 'A' }), starter('102', '1', { verein: 'B' })], 'verein')
    expect(gewaehlteHerkuenfte(h, ALLE).map((x) => x.name)).toEqual(['A', 'B'])
    expect(gewaehlteHerkuenfte(h, h[1].schluessel).map((x) => x.name)).toEqual(['B'])
    expect(gewaehlteHerkuenfte(h, 'text:gibt es nicht').map((x) => x.name)).toEqual(['A', 'B'])
    // Kein Schlüssel einer Herkunft sieht aus wie „alle“.
    expect(h.some((x) => x.schluessel === ALLE)).toBe(false)
  })
})

describe('Nach Startnummer', () => {
  const nummern = (liste: Starter[]) => nachStartnummer(liste).map((p) => p.startNr)

  it('Klasse E zuerst: E01 kommt vor 101', () => {
    expect(nummern([starter('101', '1'), starter('E01', 'E'), starter('703', '7'), starter('E10', 'E'), starter('E02', 'E'), starter('201', '2')])).toEqual(['E01', 'E02', 'E10', '101', '201', '703'])
  })

  it('natürlich sortiert, auch fortlaufende Nummern; ohne Nummer zuletzt', () => {
    expect(nummern([starter('12', '3'), starter('', '1'), starter('7', '1'), starter('100', '5'), starter('9', '2')])).toEqual(['7', '9', '12', '100', ''])
  })

  it('Klasse E steht auch mit reinen Zahlen als Startnummer vorn', () => {
    expect(nachStartnummer([starter('3', '1'), starter('12', 'E'), starter('5', '4'), starter('M7', '2'), starter('2', 'E'), starter('', 'E')]).map((p) => `${p.klasse}:${p.startNr}`)).toEqual(['E:2', 'E:12', 'E:', '2:M7', '1:3', '4:5'])
  })

  it('ändert die übergebene Liste nicht', () => {
    const liste = [starter('201', '2'), starter('E01', 'E')]
    nachStartnummer(liste)
    expect(liste.map((p) => p.startNr)).toEqual(['201', 'E01'])
  })
})

describe('Die gemerkte Auswahl', () => {
  it('nur eine vollständige Auswahl mit bekannter Art gilt', () => {
    expect(istStarterWahl(STARTER_WAHL)).toBe(true)
    expect(STARTER_WAHL).toEqual({ art: 'verzahnt', markierung: '', herkunft: ALLE })
    expect(istStarterWahl({ art: 'klasse', markierung: 'text:a', herkunft: ALLE })).toBe(true)
    for (const kaputt of [null, undefined, 'verzahnt', {}, { art: 'byClass', markierung: '', herkunft: ALLE }, { art: 'verzahnt', markierung: 1, herkunft: ALLE }, { art: 'verzahnt', markierung: '' }]) expect(istStarterWahl(kaputt)).toBe(false)
  })
})
