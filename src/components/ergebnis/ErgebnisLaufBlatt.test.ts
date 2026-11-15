import { herkunftAnzeige } from '../../lib/origin'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ErgebnisLaufBlatt from './ErgebnisLaufBlatt.vue'
import type { LaufZeile } from '../../lib/ergebnis'
import type { Starter } from '../../types'

// Auf der Laufliste konnte ein langer Vereinsname am Zellenrand um wenige Pixel abgeschnitten
// sein: Die Breite eines Zeichens war zu knapp geschätzt (1,2 bzw. 1,37 mm), der Name stand
// unverkleinert da. Jetzt wird – wie auf der Gesamtliste – nach der tatsächlichen Spaltenbreite
// kleiner gesetzt und notfalls zweizeilig. Alle Namen sind erfunden.

const starter = (i: number, nachname: string, verein: string, vorname = 'Erika'): Starter => ({
  id: `id-${i}`,
  startNr: `4${String(i).padStart(2, '0')}`,
  vorname,
  nachname,
  verein,
  bundesland: 'Musterland',
  geburtsdatum: '2012-03-04',
  groesse: '',
  klasse: '4',
})
const zeile = (p: Starter): LaufZeile => ({ starter: p, zeit: 8000, strafpunkte: 0, gesamt: 8000, disq: false, nichtGestartet: false, offen: false, platz: 1, stich: false, zellen: [], schluessel: '' }) as unknown as LaufZeile

function blatt(leute: Starter[]) {
  return mount(ErgebnisLaufBlatt, {
    props: {
      klasseText: 'Klasse 4',
      laufText: '1. Lauf',
      eventName: 'Hafenpokal',
      gruppen: [],
      zeilen: leute.map(zeile),
      herkunft: { titel: 'Verein', anzeige: (p: Starter) => herkunftAnzeige(p.verein, 'verein', 'lang', {}), zeichen: Math.max(...leute.map((p) => p.verein.length)) },
      sprache: 'de',
    },
  })
}
const herkunftMm = (w: ReturnType<typeof blatt>) => parseFloat(w.find('col.erg-w-herkunft').attributes('style')!.match(/width: ([\d.]+)mm/)![1])
/** Die Klassen der Zellen Name, Vorname, Herkunft einer Zeile. */
const klassen = (w: ReturnType<typeof blatt>, z = 0) => w.findAll('tbody tr')[z].findAll('td').slice(2, 5).map((c) => c.classes().join(' '))
/** Breite eines Zeichens in mm bei 7,5 pt je Stufe – so rechnet das Blatt. */
const MM = { '': 1.46, 'fit-1': 1.46 * 0.85, 'fit-2': 1.46 * 0.7 } as Record<string, number>

describe('Laufliste: Herkunft und Namen werden nicht am Zellenrand abgeschnitten', () => {
  it('ein Kürzel steht in voller Größe in schmaler Spalte', () => {
    const w = blatt([starter(1, 'Muster', 'MBC')])
    expect(herkunftMm(w)).toBe(11)
    expect(klassen(w)).toEqual(['', '', ''])
  })

  it('der Text passt in jeder Stufe in seine Spalte – gerechnet mit breiten Buchstaben; sonst steht er zweizeilig', () => {
    const vereine = ['MBC Weser Nienburg e.V.', 'MYWSC Schwielochsee e.V.', 'Motorbootclub Beispielhausen an der Musterau e. V.', 'WSV Ost', 'Wassersportfreunde Musterstadt']
    const w = blatt(vereine.map((v, i) => starter(i + 1, 'Muster', v)))
    const mm = herkunftMm(w)
    // Die Spalte ist höchstens 30 mm breit (die Bojen haben Vorrang).
    expect(mm).toBe(30)
    vereine.forEach((v, i) => {
      const stufe = klassen(w, i)[2]
      if (stufe !== 'erg-zweizeilig') expect(v.length * MM[stufe], v).toBeLessThanOrEqual(mm - 1.5)
    })
    // 23 Zeichen brauchen in voller Größe rund 34 mm – früher standen sie unverkleinert in 30 mm.
    expect(klassen(w, 0)[2]).toBe('fit-2')
    expect(klassen(w, 2)[2]).toBe('erg-zweizeilig')
    expect(klassen(w, 3)[2]).toBe('')
  })

  it('auch Name und Vorname richten sich nach ihrer Spaltenbreite (22 mm und 18,5 mm)', () => {
    const w = blatt([starter(1, 'Schumacher-Beispiel', 'MBC', 'Maximiliane-Sophie'), starter(2, 'Li', 'MBC', 'Bo'), starter(3, 'Beispielhausen-Musterfrau-Lang', 'MBC', 'Anna')])
    // 19 Zeichen in 22 mm: früher eine Stufe kleiner (23,6 mm – abgeschnitten), jetzt zwei.
    expect(klassen(w, 0).slice(0, 2)).toEqual(['fit-2', 'erg-zweizeilig'])
    expect(klassen(w, 1).slice(0, 2)).toEqual(['', ''])
    expect(klassen(w, 2)[0]).toBe('erg-zweizeilig')
  })
})
