import { describe, expect, it } from 'vitest'
import { alterAm, geburtstagMit, geburtstagsHinweise, jahrgaengeText, klassenFuerJahr, pruefeKlassen, startendeJahrgaenge } from './klassenPruefung'
import { birthYearRange, CLASS_IDS } from '../domain/classes'
import { istTag } from '../lib/datum'
import type { ClassId, Starter } from '../types'

// Erfundene Starter.
const s = (klasse: ClassId, geburtsdatum: string, nachname = 'Muster'): Starter => ({ id: nachname + klasse, startNr: '', vorname: 'Max', nachname, verein: '', bundesland: '', geburtsdatum, groesse: '', klasse })

describe('Klasse gegen Geburtsjahr prüfen', () => {
  const [von, bis] = birthYearRange('3', 2026)

  it('ein Jahrgang innerhalb der Klasse ist in Ordnung – an beiden Rändern', () => {
    expect(pruefeKlassen([s('3', `${von}-01-01`), s('3', `${bis}-12-31`)], 2026, CLASS_IDS).fehler).toEqual([])
  })

  it('ein falscher Jahrgang wird gemeldet, mit der Klasse, in die er gehört', () => {
    const { fehler } = pruefeKlassen([s('3', `${von - 1}-06-15`, 'Zualt'), s('3', `${bis + 1}-06-15`, 'Zujung')], 2026, CLASS_IDS)
    expect(fehler.map((f) => [f.starter.nachname, f.jahr, f.erlaubt, f.passend])).toEqual([
      ['Zualt', von - 1, [von, bis], ['4']],
      ['Zujung', bis + 1, [von, bis], ['2']],
    ])
  })

  it('ohne Geburtsdatum lässt sich nichts prüfen: gezählt, aber kein Fehler', () => {
    expect(pruefeKlassen([s('3', '')], 2026, CLASS_IDS)).toEqual({ fehler: [], ohneDatum: 1 })
  })

  it('ein Jahrgang, der in keine Klasse des Regelwerks gehört', () => {
    expect(pruefeKlassen([s('3', '1990-01-01')], 2026, CLASS_IDS).fehler[0].passend).toEqual([])
  })

  it('die Jahrgänge, die überhaupt starten, folgen aus Regelwerk und Jahr der Veranstaltung', () => {
    // DM: Klasse E bis 7 (6–27 Jahre), UIM: Dolphin bis 5 (6–18 Jahre).
    expect(jahrgaengeText(startendeJahrgaenge(2026, CLASS_IDS))).toBe('1999–2020')
    expect(jahrgaengeText(startendeJahrgaenge(2026, ['E', '1', '2', '3', '4', '5']))).toBe('2008–2020')
    // Fehlt eine Klasse dazwischen, sind es zwei Bereiche.
    expect(jahrgaengeText(startendeJahrgaenge(2026, ['E', '2']))).toBe('2015–2016, 2019–2020')
    expect(klassenFuerJahr(2019, 2026, CLASS_IDS)).toEqual(['E'])
    expect(klassenFuerJahr(2023, 2026, CLASS_IDS)).toEqual([])
    // Klasse 6 gibt es unter UIM nicht.
    expect(klassenFuerJahr(2006, 2026, ['E', '1', '2', '3', '4', '5'])).toEqual([])
  })
})

describe('Starterlaubnis nach Geburtstag (DM-Reglement C8, Warnung vom 24.11.2026)', () => {
  // DM: Klasse E ab dem 6., Klasse 7 bis zum 27. Geburtstag (config/regelwerke/dm-2026.yaml).
  const grenzen = { E: { ab: 6 }, '7': { bis: 27 } }
  const hinweise = (starters: Starter[], datum: string, jahr = 2026) => geburtstagsHinweise(starters, grenzen, jahr, datum).map((h) => [h.starter.nachname, h.art, h.alter, h.geburtstag])

  it('Alter in vollendeten Jahren: am Geburtstag selbst schon ein Jahr älter', () => {
    expect(alterAm('2020-09-05', '2026-09-04')).toBe(5)
    expect(alterAm('2020-09-05', '2026-09-05')).toBe(6)
    expect(alterAm('2020-09-05', '2026-12-31')).toBe(6)
    expect([alterAm('', '2026-09-05'), alterAm('2020-09-05', ''), alterAm('2020-02-30', '2026-09-05')]).toEqual([null, null, null])
  })

  it('29. Februar: in Jahren ohne 29.02. erst am 01.03. ein Jahr älter (BGB § 188), im Schaltjahr am 29.02.', () => {
    expect(geburtstagMit('2020-02-29', 6)).toBe('2026-03-01')
    expect(geburtstagMit('2020-02-29', 8)).toBe('2028-02-29')
    expect(alterAm('2020-02-29', '2026-02-28')).toBe(5)
    expect(alterAm('2020-02-29', '2026-03-01')).toBe(6)
    expect(alterAm('2020-02-29', '2028-02-28')).toBe(7)
    expect(alterAm('2020-02-29', '2028-02-29')).toBe(8)
    expect(hinweise([s('E', '2020-02-29', 'Schalt')], '2026-02-28')).toEqual([['Schalt', 'zuJung', 5, '2026-03-01']])
    expect(hinweise([s('E', '2020-02-29', 'Schalt')], '2026-03-01')).toEqual([])
  })

  it('Klasse E: am Wettkampftag noch nicht 6 → Warnung; am 6. Geburtstag selbst nicht mehr', () => {
    const starter = [s('E', '2020-09-06', 'Morgen'), s('E', '2020-09-05', 'Heute'), s('E', '2020-01-01', 'Frueh'), s('E', '2019-12-31', 'Sieben')]
    expect(hinweise(starter, '2026-09-05')).toEqual([['Morgen', 'zuJung', 5, '2026-09-06']])
  })

  it('Klasse 7: „bis zum 27. Geburtstag“ – am 27. Geburtstag selbst schon nicht mehr', () => {
    const starter = [s('7', '1999-09-06', 'Morgen'), s('7', '1999-09-05', 'Heute'), s('7', '1999-01-01', 'Frueh'), s('7', '2000-01-01', 'Jung')]
    expect(hinweise(starter, '2026-09-05')).toEqual([
      ['Heute', 'zuAlt', 27, '2026-09-05'],
      ['Frueh', 'zuAlt', 27, '2026-01-01'],
    ])
  })

  it('ohne Datum der Veranstaltung: nur die Grenz-Jahrgänge zum Prüfen – und wer sicher außerhalb liegt', () => {
    const starter = [s('E', '2020-03-01', 'Grenze6'), s('E', '2019-03-01', 'Sieben'), s('E', '2021-03-01', 'Fuenf'), s('7', '1999-03-01', 'Grenze27'), s('7', '1998-03-01', 'Achtundzwanzig'), s('7', '2000-03-01', 'Sechsundzwanzig')]
    expect(hinweise(starter, '')).toEqual([
      ['Grenze6', 'pruefenAb', null, '2026-03-01'],
      ['Fuenf', 'zuJung', null, '2027-03-01'],
      ['Grenze27', 'pruefenBis', null, '2026-03-01'],
      ['Achtundzwanzig', 'zuAlt', null, '2025-03-01'],
    ])
    // Ein unbrauchbares Datum gilt wie keins.
    expect(hinweise([s('E', '2020-03-01', 'Grenze6')], '2026-02-30')).toEqual([['Grenze6', 'pruefenAb', null, '2026-03-01']])
  })

  it('ohne Geburtsdatum, ohne Grenze der Klasse oder unter einem Regelwerk ohne Grenzen: kein Hinweis', () => {
    expect(hinweise([s('E', ''), s('3', '2014-09-06')], '2026-09-05')).toEqual([])
    expect(geburtstagsHinweise([s('E', '2020-09-06')], {}, 2026, '2026-09-05')).toEqual([])
  })

  it('istTag: nur Tage, die es gibt, als JJJJ-MM-TT', () => {
    expect([istTag('2026-09-05'), istTag('2026-02-29'), istTag('2028-02-29'), istTag('05.09.2026'), istTag(''), istTag(20260905)]).toEqual([true, false, true, false, false, false])
  })
})
