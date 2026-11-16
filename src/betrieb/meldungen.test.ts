import { describe, expect, it } from 'vitest'
import { tIn } from '../i18n'
import { MELDUNG_MAX } from '../state/reducer/betrieb'
import { reducer } from '../state/reducer'
import { betriebsStand } from '../testHilfen'
import { sichtOeffentlich } from './sicht'
import { ALLE_VORLAGEN, MELDUNGS_VORLAGEN, gruppenTitel, vorlagenMeldung, vorlagenText, vorlagenTitel } from './meldungen'

// Meldungsvorlagen (B-8): Daten hier, Texte in i18n de/ und en/betrieb.ts.

describe('Meldungsvorlagen', () => {
  it('nach Anlass gruppiert, jede mit Titel und Text in beiden Sprachen, eindeutig', () => {
    expect(MELDUNGS_VORLAGEN.map((g) => g.gruppe)).toEqual(['begruessung', 'dank', 'pause', 'stoerung'])
    expect(new Set(ALLE_VORLAGEN.map((v) => v.id)).size).toBe(ALLE_VORLAGEN.length)
    for (const sprache of ['de', 'en'] as const) {
      for (const g of MELDUNGS_VORLAGEN) expect(tIn(sprache, gruppenTitel(g.gruppe)).trim(), g.gruppe).not.toBe('')
      const titel = ALLE_VORLAGEN.map((v) => tIn(sprache, vorlagenTitel(v.id)))
      expect(new Set(titel).size, sprache).toBe(titel.length)
      for (const v of ALLE_VORLAGEN) {
        const text = vorlagenText(v.id, sprache, 'Musterpokal')
        expect(text.trim(), v.id).not.toBe('')
        // Passt ungekürzt auf die Tafel – auch mit einem langen Namen.
        expect(vorlagenText(v.id, sprache, 'x'.repeat(60)).length, v.id).toBeLessThanOrEqual(MELDUNG_MAX)
        expect(text, v.id).not.toContain('{')
      }
    }
  })

  it('Begrüßungen groß auf der Tafel (Pause), Störungen als Störung', () => {
    for (const v of MELDUNGS_VORLAGEN.find((g) => g.gruppe === 'begruessung')!.vorlagen) expect(v.art, v.id).toBe('pause')
    for (const v of MELDUNGS_VORLAGEN.find((g) => g.gruppe === 'stoerung')!.vorlagen) expect(v.art, v.id).toBe('stoerung')
  })

  it('setzt den Namen der Veranstaltung ein; ohne Namen ein allgemeines Wort statt einer Lücke', () => {
    expect(vorlagenText('gutenMorgen', 'de', ' Musterpokal ')).toBe('Guten Morgen und herzlich willkommen\nzum Musterpokal')
    expect(vorlagenText('verabschiedung', 'en', 'Musterpokal')).toBe('Thank you for racing –\nsee you next time at the Musterpokal')
    expect(vorlagenText('gutenMorgen', 'de', '  ')).toBe('Guten Morgen und herzlich willkommen\nzum Wettkampf')
  })

  it('aus der Sicht: Sprache der Anzeigetafel und der Name der Veranstaltung', () => {
    const dm = betriebsStand()
    expect(vorlagenMeldung(sichtOeffentlich(dm), { id: 'gutenMorgen', art: 'pause' })).toEqual({ text: 'Guten Morgen und herzlich willkommen\nzum Musterpokal', art: 'pause' })
    const uim = reducer(dm, { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    expect(vorlagenMeldung(sichtOeffentlich(uim), { id: 'vielErfolg', art: 'pause' }).text).toBe('Good luck to all drivers!')
    // Die Meldung geht so unverändert durch den Reducer (mehrzeilig bleibt mehrzeilig).
    const mit = reducer(dm, { type: 'BETRIEB_MELDUNG', bereich: 'par_1', meldung: vorlagenMeldung(sichtOeffentlich(dm), { id: 'mittag', art: 'pause' }) })
    expect(mit.betrieb.bereiche.par_1.meldung?.text).toBe('Mittagspause –\nweiter geht es um 13:00 Uhr')
  })
})
