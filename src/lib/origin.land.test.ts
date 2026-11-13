import { describe, expect, it } from 'vitest'
import { originField, originLabelKey, originOf, originText } from './origin'
import { parseStartersTsv } from '../import/tsv'
import { gewichtsGruppen } from '../domain/gewicht'
import { migrate } from '../state/migrate'
import de from '../i18n/de'
import type { Starter } from '../types'

// Erfundene Starter.
const s = (mehr: Partial<Starter>): Starter => ({ id: 'a', startNr: '1', vorname: 'V', nachname: 'N', verein: 'Musterclub', bundesland: 'Bayern', geburtsdatum: '', groesse: '', klasse: '3', ...mehr })

describe('Herkunft: Verein, Bundesland, Land', () => {
  it('die Spalte heißt wie die gewählte Herkunft – „Bundesland“ nie nur „Land“', () => {
    expect(de[originLabelKey('bundesland')]).toBe('Bundesland')
    expect(de[originLabelKey('land')]).toBe('Land')
    expect(de[originLabelKey('verein')]).toBe('Verein')
  })

  it('Land ist ein eigenes Feld des Starters, mit ISO-Kürzel als Vorgabe', () => {
    const p = s({ land: 'Österreich' })
    expect(originField('land')).toBe('land')
    expect(originOf(p, 'land')).toBe('Österreich')
    expect(originOf(p, 'bundesland')).toBe('Bayern')
    expect(originOf(s({}), 'land')).toBe('')
    expect(originText(p, 'land', 'kurz', {})).toBe('AUT')
    expect(originText(p, 'land', 'kurz', { Österreich: 'A' })).toBe('A')
  })

  it('Import: „Country“ ist immer der Staat; „Land“ nur, wenn die Herkunft der Veranstaltung Land ist', () => {
    const text = 'Klasse\tNachname\tVorname\tLand\n3\tMuster\tMax\tPolen'
    expect(parseStartersTsv(text).starters[0]).toMatchObject({ bundesland: 'Polen' })
    expect(parseStartersTsv(text).starters[0].land).toBeUndefined()
    expect(parseStartersTsv(text, { landIstStaat: true }).starters[0]).toMatchObject({ land: 'Polen', bundesland: '' })
    expect(parseStartersTsv(text.replace('Land', 'Country')).starters[0]).toMatchObject({ land: 'Polen' })
  })

  it('Gewichtslisten gruppieren nach Land; eine Sicherung behält das Feld', () => {
    const gruppen = gewichtsGruppen([s({ id: 'a', land: 'Polen' }), s({ id: 'b', land: 'Lettland' }), s({ id: 'c', land: 'Polen' })], 'land')
    expect(gruppen.map((g) => g.origin).sort()).toEqual(['Lettland', 'Polen'])
    const geladen = migrate({ originMode: 'land', starters: [s({ land: 'Polen' }), s({ id: 'b' })] })!
    expect(geladen.originMode).toBe('land')
    expect(geladen.starters.map((x) => x.land)).toEqual(['Polen', undefined])
  })
})
