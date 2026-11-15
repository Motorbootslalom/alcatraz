import { parcoursName, bogenTexte } from '../config/sprache'
import { geburtsdatumAufListe } from './index'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LOCALES, setLocale, t, tn, formatDate, formatDateTime } from './index'
import de from './de'

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

beforeEach(() => setLocale('de'))
afterEach(() => setLocale('de'))

describe('Sprachkataloge', () => {
  for (const { id, catalog } of LOCALES) {
    it(`${id}: gleiche Schlüssel, Platzhalter und Zahlformen wie der deutsche Katalog`, () => {
      expect(Object.keys(catalog).sort()).toEqual(Object.keys(de).sort())
      for (const key of Object.keys(de) as (keyof typeof de)[]) {
        expect(catalog[key].trim(), key).not.toBe('')
        expect(new Set(placeholders(catalog[key])), key).toEqual(new Set(placeholders(de[key])))
        expect(catalog[key].includes(' | '), key).toBe(de[key].includes(' | '))
      }
    })
  }
})

describe('t()', () => {
  it('setzt Platzhalter ein und wechselt die Sprache zur Laufzeit', () => {
    expect(t('common.class', { id: 'E' })).toBe('Klasse E')
    setLocale('en')
    expect(t('common.class', { id: 'E' })).toBe('Class E')
  })

  it('wählt die Zahlform', () => {
    setLocale('en')
    expect(tn('app.starters', 1)).toBe('1 driver')
    expect(tn('app.starters', 12)).toBe('12 drivers')
  })

  it('schreibt das Datum in der gewählten Sprache', () => {
    expect(formatDate('2015-03-09')).toBe('09.03.2015')
    expect(formatDate('kein Datum')).toBe('kein Datum')
    setLocale('en')
    expect(formatDate('2015-03-09')).toBe('2015-03-09')
    expect(formatDateTime(new Date(2026, 10, 12, 23, 2).toISOString())).toBe('2026-11-12 23:02')
    setLocale('de')
    expect(formatDateTime(new Date(2026, 10, 12, 23, 2).toISOString())).toBe('12.11.2026, 23:02')
    // Mit Sekunden: für den Stand der Wertungslisten.
    expect(formatDateTime(new Date(2026, 10, 12, 23, 2, 7).toISOString(), true)).toBe('12.11.2026, 23:02:07')
    setLocale('en')
    expect(formatDateTime(new Date(2026, 10, 12, 23, 2, 7).toISOString(), true)).toBe('2026-11-12 23:02:07')
    expect(formatDateTime('', true)).toBe('')
  })

  it('Geburtsdatum auf Listen: englisch Tag/Monat/Jahr (Regel 960 Pkt. 3.7), deutsch wie überall', () => {
    expect(geburtsdatumAufListe('en', '2015-03-09')).toBe('09/03/2015')
    expect(geburtsdatumAufListe('de', '2015-03-09')).toBe('09.03.2015')
    expect(geburtsdatumAufListe('en', 'kein Datum')).toBe('kein Datum')
  })

  it('der Vorgabename „Parcours n“ steht englisch als „Course n“; eigene Namen bleiben', () => {
    expect(parcoursName('Parcours 2', 'de')).toBe('Parcours 2')
    expect(parcoursName('Parcours 2', 'en')).toBe('Course 2')
    expect(parcoursName('Parcours 2', 'de+en')).toBe('Parcours 2 / Course 2')
    expect(parcoursName('Hafenbecken', 'en')).toBe('Hafenbecken')
    expect(bogenTexte('en').parcoursName('Parcours 1')).toBe('Course 1')
  })
})
