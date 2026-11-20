import { describe, expect, it } from 'vitest'
import {
  ausweichFolge,
  gruppeDerGroesse,
  liesFehlende,
  naechsteStartNr,
  nummerDerKlasse,
  startNrAbweichungen,
  vergibKlasse,
  verteileInBereichen,
  type StartNrRegeln,
} from './startnrBereiche'
import { startNrBereicheVorgabe } from '../config/catalog'
import { vergleicheStartNr } from './startnumbers'
import type { ClassId, Starter } from '../types'

/** Erfundener Starter (Muster Vor1/Nach1). */
function st(klasse: ClassId, i: number, groesse: string, startNr = ''): Starter {
  return { id: `${klasse}-${i}`, startNr, vorname: `Vor${i}`, nachname: `Nach${i}`, verein: 'Musterclub', bundesland: '', geburtsdatum: '', klasse, groesse }
}

const dm = (klasse: ClassId, fehlend: string[] = []): StartNrRegeln => ({ bereiche: startNrBereicheVorgabe('dm-2026', klasse), fehlend, praefixe: { E: 'E' } })
const nummern = (liste: Starter[]) => liste.map((p) => p.startNr)

describe('Startnummern nach Größenbereichen (DMYV-Liste, 19.11.2026)', () => {
  it('liest Nummern nur in der Schreibweise der Klasse', () => {
    expect(nummerDerKlasse('512', '5')).toBe(12)
    expect(nummerDerKlasse('E101', 'E', { E: 'E' })).toBe(101)
    expect(nummerDerKlasse('d105', 'E', { E: 'E' })).toBe(105)
    expect([nummerDerKlasse('51', '5'), nummerDerKlasse('5012', '5'), nummerDerKlasse('612', '5')]).toEqual([null, null, null])
  })

  it('Größengruppen: XS zu S–M, XXXL zu XXL; Ausweichen erst nach oben, dann nach unten', () => {
    expect(['XS', 'm', 'XL', '3XL', '', 'Kind'].map(gruppeDerGroesse)).toEqual(['S-M', 'S-M', 'L-XL', 'XXL', null, null])
    expect(ausweichFolge('L-XL')).toEqual(['XXL', 'S-M'])
    expect(ausweichFolge('S-M')).toEqual(['L-XL', 'XXL'])
    expect(ausweichFolge(null)).toEqual(['XXL', 'L-XL', 'S-M'])
  })

  it('vergibt je Größe aus ihrem Bereich, in der Folge der Liste, und überspringt fehlende Westen', () => {
    const liste = [st('5', 1, 'XL'), st('5', 2, 'S'), st('5', 3, 'XXXL'), st('5', 4, 'L'), st('5', 5, 'XS')]
    expect(nummern(vergibKlasse(liste, '5', dm('5', ['512', '502'])))).toEqual(['511', '501', '529', '513', '503'])
  })

  it('Überlauf: voller Bereich weicht in den größeren aus, dann in den kleineren, dann hinter alle Bereiche', () => {
    // Klasse 5: XXL hat nur 529 und 530 (530 fehlt) – der zweite XXL bekommt eine L–XL-Weste, der dritte auch.
    const xxl = [st('5', 1, 'XXL'), st('5', 2, 'XXL'), st('5', 3, 'XXL')]
    expect(nummern(vergibKlasse(xxl, '5', dm('5', ['530'])))).toEqual(['529', '511', '512'])
    // Klasse 3 hat keinen L–XL-Bereich (Zettel unleserlich): L weicht nach unten in S–M aus.
    expect(nummern(vergibKlasse([st('3', 1, 'L'), st('3', 2, 'S')], '3', dm('3')))).toEqual(['302', '301'])
    // Alle Westen der Klasse 1 vergeben: fortlaufend hinter 130, fehlende übersprungen.
    const viele = Array.from({ length: 32 }, (_, i) => st('1', i + 1, 'M'))
    expect(nummern(vergibKlasse(viele, '1', dm('1', ['131']))).slice(-2)).toEqual(['132', '133'])
  })

  it('erst die Passenden, dann die Ausweichenden: Ein früher Großer nimmt einem späten Kleinen nichts weg', () => {
    // Klasse 4: L–XL 421–430. Der XXL (kein Bereich) steht vorn, weicht aber erst nach den S–M-Startern nach unten aus.
    const regeln: StartNrRegeln = { bereiche: [{ von: '401', bis: '402', gruppe: 'S-M' }], fehlend: [] }
    expect(nummern(vergibKlasse([st('4', 1, 'XXL'), st('4', 2, 'S'), st('4', 3, 'M')], '4', regeln))).toEqual(['403', '401', '402'])
  })

  it('ohne Größe: wie die größte Gruppe, also XXL zuerst', () => {
    expect(nummern(vergibKlasse([st('6', 1, ''), st('6', 2, 'M')], '6', dm('6')))).toEqual(['626', '601'])
  })

  it('Klasse E: E01–E30; auch mit dem Buchstaben D', () => {
    expect(nummern(vergibKlasse([st('E', 1, 'S'), st('E', 2, 'M')], 'E', dm('E', ['E01'])))).toEqual(['E02', 'E03'])
    expect(nummern(vergibKlasse([st('E', 1, 'S')], 'E', { ...dm('E'), praefixe: { E: 'D' } }))).toEqual(['D01'])
  })

  it('ohne Bereiche fortlaufend wie bisher – fehlende Westen trotzdem übersprungen', () => {
    const regeln: StartNrRegeln = { bereiche: [], fehlend: ['102', '502'] }
    expect(nummern(vergibKlasse([st('1', 1, 'L'), st('1', 2, 'S'), st('1', 3, '')], '1', regeln))).toEqual(['101', '103', '104'])
  })

  it('nächste freie Nummer für einen neuen Starter', () => {
    const da = [st('5', 1, 'S', '501'), st('5', 2, 'L', '511')]
    expect(naechsteStartNr(da, '5', 'XL', dm('5', ['512']))).toBe('513')
    expect(naechsteStartNr(da, '5', 'M', dm('5'))).toBe('502')
    expect(naechsteStartNr(da, '5', '', dm('5'))).toBe('529')
    expect(naechsteStartNr(da, '5', 'S', { bereiche: [], fehlend: ['512'] })).toBe('513')
  })

  it('eine verschriebene Nummer („5012“) belegt keine Weste und gilt als außerhalb (Korrektur 19.11.2026)', () => {
    const da = [st('5', 1, 'L', '511'), st('5', 2, 'XL', '5012')]
    expect(naechsteStartNr(da, '5', 'XL', dm('5'))).toBe('512')
    expect(startNrAbweichungen(da, '5', dm('5')).map((a) => [a.starter.startNr, a.art])).toEqual([['5012', 'ausserhalb']])
    // Beim Neuverteilen tauscht sie nicht mit einer Nummer des L–XL-Bereichs.
    const neu = verteileInBereichen([da[1], da[0]], '5', dm('5'))
    expect(Object.fromEntries(neu.map((p) => [p.id, p.startNr]))).toEqual({ '5-1': '511', '5-2': '5012' })
  })

  it('neu verteilen (Verschieben, Sortieren, Zufall) bleibt in den Bereichen', () => {
    const vorher = [st('5', 1, 'S', '501'), st('5', 2, 'M', '502'), st('5', 3, 'L', '511'), st('5', 4, 'XL', '512')]
    // Der XL-Starter nach vorn: Er bleibt im L–XL-Bereich, nur dort wechselt die Folge.
    const neu = verteileInBereichen([vorher[3], vorher[0], vorher[1], vorher[2]], '5', dm('5'))
    expect(Object.fromEntries(neu.map((p) => [p.id, p.startNr]))).toEqual({ '5-4': '511', '5-1': '501', '5-2': '502', '5-3': '512' })
  })

  it('meldet, wessen Nummer nicht zur Westengröße passt', () => {
    const liste = [st('5', 1, 'S', '501'), st('5', 2, 'XXL', '511'), st('5', 3, 'L', '531'), st('5', 4, '', '502'), st('5', 5, 'M', '503')]
    const arten = startNrAbweichungen(liste, '5', dm('5', ['503'])).map((a) => [a.starter.startNr, a.art])
    expect(arten).toEqual([
      ['502', 'ohneGroesse'],
      ['503', 'fehlend'],
      ['511', 'fremd'],
      ['531', 'ausserhalb'],
    ])
  })

  it('liest fehlende Nummern tolerant und nennt Unbekanntes', () => {
    expect(liesFehlende('512, 517;623  e105 512 99x 51', ['E', '1', '5', '6'], { E: 'E' })).toEqual({ nummern: ['512', '517', '623', 'E105'], unbekannt: ['99X', '51'] })
  })

  it('Sortierung: E101 vor 101, die Klasse E bleibt vorn', () => {
    expect(['102', 'E102', '101', 'E101'].sort(vergleicheStartNr)).toEqual(['E101', '101', 'E102', '102'])
  })
})
