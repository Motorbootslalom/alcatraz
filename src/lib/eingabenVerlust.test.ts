import { beforeAll, describe, expect, it } from 'vitest'
import { setLocale } from '../i18n'
import { laufSchluessel, setzeWerte } from './eingaben'
import { verlustBeimErsetzen, verlustText, verlustZahl } from './eingabenVerlust'
import type { ClassId, Starter } from '../types'

// Mit einem Starter gehen seine erfassten Werte – jede Rückfrage davor muss das sagen.
// Alle Starter sind erfunden.

const starter = (id: string, klasse: ClassId = '4', nr = id): Starter => ({ id, startNr: nr, vorname: 'Vor', nachname: `Nach-${id}`, verein: 'Musterclub', bundesland: '', geburtsdatum: '', klasse, groesse: '' })
const L1 = laufSchluessel('manoevrieren', 1)

describe('Verlust erfasster Werte', () => {
  beforeAll(() => setLocale('de'))

  const starters = [starter('a'), starter('b'), starter('c', '1')]
  const stand = { starters, eingaben: setzeWerte({}, [{ lauf: L1, starter: 'a', feld: 'zeit1', wert: '80' }, { lauf: L1, starter: 'c', feld: 'erfasst@steg', wert: '1' }]) }

  it('zählt die Starter mit Werten unter denen, die wegfallen', () => {
    expect(verlustZahl(stand, starters)).toBe(2)
    expect(verlustZahl(stand, [starters[1]])).toBe(0)
    expect(verlustText(stand, [starters[1]])).toBe('')
    expect(verlustText(stand, starters)).toContain('Für 2 dieser Starter sind schon Zeiten oder Fehler erfasst')
  })

  it('Ersetzen der Liste: Wiedererkannte behalten ihre Werte, wer fehlt, verliert sie', () => {
    // a und c stehen wieder in der Liste (neue IDs, gleiche Klasse und Nummer) – nichts geht verloren.
    expect(verlustBeimErsetzen(stand, [starter('x', '4', 'a'), starter('y', '4', 'b'), starter('z', '1', 'c')])).toEqual({ zahl: 0, text: '' })
    const ohneA = verlustBeimErsetzen(stand, [starter('y', '4', 'b'), starter('z', '1', 'c')])
    expect(ohneA.zahl).toBe(1)
    expect(ohneA.text).toContain('1 Starter mit schon erfassten Zeiten')
  })

  it('wer in der neuen Liste in einer anderen Klasse steht, gilt als neu – auch das wird gemeldet', () => {
    const korrigiert = verlustBeimErsetzen(stand, [{ ...starters[0], id: 'neu', klasse: '5' }, starters[1], starters[2]])
    expect(korrigiert.zahl).toBe(1)
    expect(korrigiert.text).toContain('in einer anderen Klasse')
  })
})
