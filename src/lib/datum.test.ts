import { describe, expect, it } from 'vitest'
import { excelSeriennummer, liesDatum, tageImMonat } from './datum'

// Datumsfelder ohne Datumswahl des Browsers (Entscheidung des Nutzers vom 15.11.2026): Gelesen
// werden JJJJ-MM-TT, TT.MM.JJJJ und TT/MM/JJJJ – Schrägstrich immer Tag zuerst, nie Monat/Tag.

describe('liesDatum', () => {
  it('liest die drei Schreibweisen, auch ohne führende Null', () => {
    for (const text of ['2019-12-01', '2019-12-1', '01.12.2019', '1.12.2019', '01/12/2019', '1/12/2019', ' 1. 12. 2019 ']) {
      expect(liesDatum(text), text).toEqual({ art: 'ok', iso: '2019-12-01' })
    }
  })

  it('Schrägstrich heißt immer Tag zuerst – nie Monat/Tag', () => {
    expect(liesDatum('12/01/2019')).toEqual({ art: 'ok', iso: '2019-01-12' })
    // Wer Monat/Tag meint, bekommt kein falsches Datum, sondern eine Meldung.
    expect(liesDatum('12/31/2019')).toEqual({ art: 'ungueltig' })
  })

  it('meldet Tage, die es nicht gibt', () => {
    expect(liesDatum('31.02.2019')).toEqual({ art: 'ungueltig' })
    expect(liesDatum('29.02.2019')).toEqual({ art: 'ungueltig' })
    expect(liesDatum('29.02.2020')).toEqual({ art: 'ok', iso: '2020-02-29' })
    expect(liesDatum('31.04.2019')).toEqual({ art: 'ungueltig' })
    expect(liesDatum('2019-13-01')).toEqual({ art: 'ungueltig' })
    expect(liesDatum('00.01.2019')).toEqual({ art: 'ungueltig' })
  })

  it('Unbekanntes ist unbekannt, Leeres leer', () => {
    expect(liesDatum('')).toEqual({ art: 'leer' })
    expect(liesDatum('   ')).toEqual({ art: 'leer' })
    for (const text of ['1.12.19', '2019/12/01', '01-12-2019', 'Mai 2019', '01.12/2019', '2019']) expect(liesDatum(text).art, text).toBe('unbekannt')
  })

  it('Schaltjahre nach dem gregorianischen Kalender', () => {
    expect([2019, 2020, 1900, 2000].map((j) => tageImMonat(j, 2))).toEqual([28, 29, 28, 29])
  })
})

describe('excelSeriennummer', () => {
  it('rechnet wie Excel (Nullpunkt 30.12.1899 ab dem 1.3.1900)', () => {
    expect(excelSeriennummer(43800)).toBe('2019-12-01')
    expect(excelSeriennummer(61)).toBe('1900-03-01')
    expect(excelSeriennummer(60)).toBeNull()
    expect(excelSeriennummer(43800.5)).toBeNull()
  })
})
