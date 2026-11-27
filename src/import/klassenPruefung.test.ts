import { describe, expect, it } from 'vitest'
import { alterAm, GEBURTSTAG_FENSTER, geburtstagMit, geburtstagsArtMitDatum, geburtstagsHinweise, jahrgaengeText, klassenFuerJahr, knappAmErstenTagAusserhalb, pruefeKlassen, startendeJahrgaenge, tageZwischen } from './klassenPruefung'
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

describe('Starterlaubnis nach Geburtstag (DM-Reglement C8, Warnung vom 24.11.2026, zwei Stufen vom 26.11.2026)', () => {
  // DM: Klasse E ab dem 6., Klasse 7 bis zum 27. Geburtstag (config/regelwerke/dm-2026.yaml).
  const grenzen = { E: { ab: 6 }, '7': { bis: 27 } }
  const hinweise = (starters: Starter[], datum: string, jahr = 2026) => geburtstagsHinweise(starters, grenzen, jahr, datum).map((h) => [h.starter.nachname, h.art, h.alter, h.geburtstag])
  /** Kurz: Name, Art, Stufe, Abstand in Tagen. */
  const stufen = (starters: Starter[], datum: string) => geburtstagsHinweise(starters, grenzen, 2026, datum).map((h) => [h.starter.nachname, h.art, h.stufe, h.abstand])

  it('Alter in vollendeten Jahren: am Geburtstag selbst schon ein Jahr älter', () => {
    expect(alterAm('2020-09-05', '2026-09-04')).toBe(5)
    expect(alterAm('2020-09-05', '2026-09-05')).toBe(6)
    expect(alterAm('2020-09-05', '2026-12-31')).toBe(6)
    expect([alterAm('', '2026-09-05'), alterAm('2020-09-05', ''), alterAm('2020-02-30', '2026-09-05')]).toEqual([null, null, null])
  })

  it('Tage zwischen zwei Tagen: über Monats- und Jahreswechsel und den 29.02., in beide Richtungen', () => {
    expect(tageZwischen('2026-09-05', '2026-09-07')).toBe(2)
    expect(tageZwischen('2026-09-07', '2026-09-05')).toBe(-2)
    expect(tageZwischen('2026-09-05', '2026-09-05')).toBe(0)
    expect(tageZwischen('2026-12-31', '2027-01-02')).toBe(2)
    expect(tageZwischen('2026-02-28', '2026-03-01')).toBe(1)
    expect(tageZwischen('2028-02-28', '2028-03-01')).toBe(2)
    expect(tageZwischen('2026-01-01', '2027-01-01')).toBe(365)
    expect(tageZwischen('2028-01-01', '2029-01-01')).toBe(366)
    expect(tageZwischen('1999-09-05', '2026-09-05')).toBe(9862)
    expect([tageZwischen('', '2026-09-05'), tageZwischen('2026-09-05', '2026-02-30')]).toEqual([null, null])
  })

  it('die zwei Zahlen stehen an EINER Stelle: deutliche Warnung bis 2 Tage, Hinweis bis 14 Tage', () => {
    expect(GEBURTSTAG_FENSTER).toEqual({ warnungTage: 2, hinweisTage: 14 })
    const ab = [-15, -14, -3, -2, 0, 2, 3, 14, 15].map((d) => geburtstagsArtMitDatum(d, 'ab'))
    expect(ab).toEqual([null, 'nahAb', 'nahAb', 'knappAb', 'knappAb', 'knappAb', 'zuJung', 'zuJung', 'zuJung'])
    const bis = [-15, -14, -3, -2, 0, 2, 3, 14, 15].map((d) => geburtstagsArtMitDatum(d, 'bis'))
    expect(bis).toEqual(['zuAlt', 'zuAlt', 'zuAlt', 'knappBis', 'knappBis', 'knappBis', 'nahBis', 'nahBis', null])
  })

  it('Klasse E am 05.09.: klar zu jung, knapp (bis 2 Tage davor oder danach), nah (3–14 Tage davor), sonst nichts', () => {
    const starter = [
      s('E', '2020-09-20', 'Plus15'),
      s('E', '2020-09-19', 'Plus14'),
      s('E', '2020-09-08', 'Plus3'),
      s('E', '2020-09-07', 'Plus2'),
      s('E', '2020-09-06', 'Plus1'),
      s('E', '2020-09-05', 'Null'),
      s('E', '2020-09-03', 'Minus2'),
      s('E', '2020-09-02', 'Minus3'),
      s('E', '2020-08-22', 'Minus14'),
      s('E', '2020-08-21', 'Minus15'),
      s('E', '2019-12-31', 'Sieben'),
    ]
    expect(stufen(starter, '2026-09-05')).toEqual([
      // Am ersten Tag zu jung und der Geburtstag mehr als 2 Tage weg: klar außerhalb – auch innerhalb von 14 Tagen.
      ['Plus15', 'zuJung', 'warnung', 15],
      ['Plus14', 'zuJung', 'warnung', 14],
      ['Plus3', 'zuJung', 'warnung', 3],
      // Bis 2 Tage: deutlich, auch wenn er am ersten Tag schon starten darf (Null, Minus2).
      ['Plus2', 'knappAb', 'warnung', 2],
      ['Plus1', 'knappAb', 'warnung', 1],
      ['Null', 'knappAb', 'warnung', 0],
      ['Minus2', 'knappAb', 'warnung', -2],
      ['Minus3', 'nahAb', 'hinweis', -3],
      ['Minus14', 'nahAb', 'hinweis', -14],
    ])
  })

  it('Klasse 7 am 05.09.: klar zu alt, knapp (bis 2 Tage), nah (3–14 Tage danach), letzter Tag mit Starterlaubnis', () => {
    const starter = [
      s('7', '1999-08-21', 'Minus15'),
      s('7', '1999-09-02', 'Minus3'),
      s('7', '1999-09-03', 'Minus2'),
      s('7', '1999-09-05', 'Null'),
      s('7', '1999-09-07', 'Plus2'),
      s('7', '1999-09-08', 'Plus3'),
      s('7', '1999-09-19', 'Plus14'),
      s('7', '1999-09-20', 'Plus15'),
      s('7', '2000-01-01', 'Jung'),
    ]
    expect(stufen(starter, '2026-09-05')).toEqual([
      ['Minus15', 'zuAlt', 'warnung', -15],
      ['Minus3', 'zuAlt', 'warnung', -3],
      ['Minus2', 'knappBis', 'warnung', -2],
      ['Null', 'knappBis', 'warnung', 0],
      ['Plus2', 'knappBis', 'warnung', 2],
      ['Plus3', 'nahBis', 'hinweis', 3],
      ['Plus14', 'nahBis', 'hinweis', 14],
    ])
    // „bis zum 27. Geburtstag“ = am 27. Geburtstag selbst nicht mehr (bestätigt 26.11.2026, R11-01): letzter Tag = Tag davor.
    const [plus2] = geburtstagsHinweise([s('7', '1999-09-07')], grenzen, 2026, '2026-09-05')
    expect([plus2.geburtstag, plus2.letzterTag, plus2.alter]).toEqual(['2026-09-07', '2026-09-06', 26])
    expect(geburtstagsHinweise([s('E', '2020-09-06')], grenzen, 2026, '2026-09-05')[0].letzterTag).toBeNull()
  })

  it('knapp, aber am ersten Wettkampftag schon außerhalb: E 1–2 Tage danach, 7 am Tag bis 2 Tage davor (Prüfbefund 26.11.2026)', () => {
    const aussen = (starter: Starter[], datum: string) => geburtstagsHinweise(starter, grenzen, 2026, datum).map((h) => [h.art, h.abstand, knappAmErstenTagAusserhalb(h)])
    const e = ['2020-09-07', '2020-09-06', '2020-09-05', '2020-09-03'].map((d) => s('E', d))
    expect(aussen(e, '2026-09-05')).toEqual([
      ['knappAb', 2, true],
      ['knappAb', 1, true],
      ['knappAb', 0, false],
      ['knappAb', -2, false],
    ])
    const sieben = ['1999-09-03', '1999-09-04', '1999-09-05', '1999-09-06', '1999-09-07'].map((d) => s('7', d))
    expect(aussen(sieben, '2026-09-05')).toEqual([
      ['knappBis', -2, true],
      ['knappBis', -1, true],
      ['knappBis', 0, true],
      ['knappBis', 1, false],
      ['knappBis', 2, false],
    ])
    // 29.02.: Der 6. Geburtstag ist 2026 der 01.03. – am 28.02. also noch zu jung, am 01.03. nicht mehr.
    expect(aussen([s('E', '2020-02-29')], '2026-02-28')).toEqual([['knappAb', 1, true]])
    expect(aussen([s('E', '2020-02-29')], '2026-03-01')).toEqual([['knappAb', 0, false]])
    // Nur `knapp…` fragt das: Klar außerhalb und Hinweise sagen es schon selbst, ohne Datum gibt es keinen Tag.
    expect(knappAmErstenTagAusserhalb({ art: 'zuJung', abstand: 3 })).toBe(false)
    expect(knappAmErstenTagAusserhalb({ art: 'nahBis', abstand: 3 })).toBe(false)
    expect(knappAmErstenTagAusserhalb({ art: 'knappBis', abstand: null })).toBe(false)
  })

  it('über den Jahreswechsel zählen die Tage weiter', () => {
    expect(stufen([s('E', '2021-01-02', 'Januar')], '2026-12-31')).toEqual([['Januar', 'knappAb', 'warnung', 2]])
    expect(stufen([s('7', '2000-01-02', 'Januar')], '2026-12-31')).toEqual([['Januar', 'knappBis', 'warnung', 2]])
    expect(stufen([s('7', '2000-01-14', 'Januar')], '2026-12-31')).toEqual([['Januar', 'nahBis', 'hinweis', 14]])
  })

  it('29. Februar: in Jahren ohne 29.02. erst am 01.03. ein Jahr älter (BGB § 188), im Schaltjahr am 29.02.', () => {
    expect(geburtstagMit('2020-02-29', 6)).toBe('2026-03-01')
    expect(geburtstagMit('2020-02-29', 8)).toBe('2028-02-29')
    expect(alterAm('2020-02-29', '2026-02-28')).toBe(5)
    expect(alterAm('2020-02-29', '2026-03-01')).toBe(6)
    expect(alterAm('2020-02-29', '2028-02-28')).toBe(7)
    expect(alterAm('2020-02-29', '2028-02-29')).toBe(8)
    const schalt = [s('E', '2020-02-29', 'Schalt')]
    expect(hinweise(schalt, '2026-02-28')).toEqual([['Schalt', 'knappAb', 5, '2026-03-01']])
    // Der Abstand zählt vom 01.03. an: 26.02. = 3 Tage davor (klar zu jung), 03.03. = 2 Tage danach, 04.03. = 3 Tage.
    expect(stufen(schalt, '2026-02-26')).toEqual([['Schalt', 'zuJung', 'warnung', 3]])
    expect(stufen(schalt, '2026-02-27')).toEqual([['Schalt', 'knappAb', 'warnung', 2]])
    expect(stufen(schalt, '2026-03-03')).toEqual([['Schalt', 'knappAb', 'warnung', -2]])
    expect(stufen(schalt, '2026-03-04')).toEqual([['Schalt', 'nahAb', 'hinweis', -3]])
    expect(stufen(schalt, '2026-03-15')).toEqual([['Schalt', 'nahAb', 'hinweis', -14]])
    expect(stufen(schalt, '2026-03-16')).toEqual([])
    // Klasse 7: letzter Tag vor dem 27. Geburtstag – 28.02. bzw. im Schaltjahr der 29.02.
    const [ohneSchalttag] = geburtstagsHinweise([s('7', '2000-02-29')], grenzen, 2027, '2027-02-28')
    expect([ohneSchalttag.art, ohneSchalttag.geburtstag, ohneSchalttag.letzterTag, ohneSchalttag.abstand]).toEqual(['knappBis', '2027-03-01', '2027-02-28', 1])
    const [imSchaltjahr] = geburtstagsHinweise([s('7', '2001-03-01')], grenzen, 2028, '2028-02-28')
    expect([imSchaltjahr.art, imSchaltjahr.letzterTag, imSchaltjahr.abstand]).toEqual(['knappBis', '2028-02-29', 2])
  })

  it('ohne Datum der Veranstaltung: nur die Grenz-Jahrgänge zum Prüfen (Hinweis) – und wer sicher außerhalb liegt (Warnung)', () => {
    const starter = [s('E', '2020-03-01', 'Grenze6'), s('E', '2019-03-01', 'Sieben'), s('E', '2021-03-01', 'Fuenf'), s('7', '1999-03-01', 'Grenze27'), s('7', '1998-03-01', 'Achtundzwanzig'), s('7', '2000-03-01', 'Sechsundzwanzig')]
    expect(hinweise(starter, '')).toEqual([
      ['Grenze6', 'pruefenAb', null, '2026-03-01'],
      ['Fuenf', 'zuJung', null, '2027-03-01'],
      ['Grenze27', 'pruefenBis', null, '2026-03-01'],
      ['Achtundzwanzig', 'zuAlt', null, '2025-03-01'],
    ])
    expect(stufen(starter, '').map(([name, , stufe, abstand]) => [name, stufe, abstand])).toEqual([
      ['Grenze6', 'hinweis', null],
      ['Fuenf', 'warnung', null],
      ['Grenze27', 'hinweis', null],
      ['Achtundzwanzig', 'warnung', null],
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
