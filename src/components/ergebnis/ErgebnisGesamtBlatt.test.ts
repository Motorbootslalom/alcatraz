import { herkunftAnzeige } from '../../lib/origin'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ErgebnisGesamtBlatt from './ErgebnisGesamtBlatt.vue'
import type { GesamtZeile, LaufZeile } from '../../lib/ergebnis'
import type { Starter } from '../../types'

// Name und Vorname teilen sich auf der Gesamtliste, was die festen Spalten übrig lassen. Bei
// drei Läufen und ausgeschriebenem Vereinsnamen blieben ihnen 17 mm – „Schumacher B“ stand
// am Zellenrand abgeschnitten da. Die Namen haben deshalb Vorrang vor der Herkunft, und
// kleiner gesetzt wird nach der tatsächlichen Spaltenbreite.

const LANGER_VEREIN = 'Motorbootclub Beispielhausen an der Musterau e. V.'
const starter = (i: number, nachname: string, verein = 'MBC Muster'): Starter => ({
  id: `id-${i}`,
  startNr: `4${String(i).padStart(2, '0')}`,
  vorname: 'Erika',
  nachname,
  verein,
  bundesland: 'Musterland',
  geburtsdatum: '2012-03-04',
  groesse: '',
  klasse: '4',
})
const lauf = (p: Starter): LaufZeile => ({ starter: p, zeit: 8000, strafpunkte: 0, gesamt: 8000, disq: false, nichtGestartet: false, offen: false, platz: 1, stich: false, zellen: [], schluessel: '' }) as unknown as LaufZeile
const zeile = (p: Starter, laeufe: number): GesamtZeile => ({
  starter: p,
  laeufe: Array.from({ length: laeufe }, () => lauf(p)),
  gestrichen: [],
  ergebnis: 16000,
  disq: false,
  offen: false,
  knoten: 0,
  gesamt: 16000,
  platz: 1,
  stich: false,
})

function blatt(namen: string[], opt: { laeufe: number; verein?: string; geburtsdatum?: boolean; mitKnoten?: boolean; abstand?: boolean }) {
  const leute = namen.map((n, i) => starter(i + 1, n, opt.verein))
  const zeichen = Math.max(...leute.map((p) => p.verein.length))
  return mount(ErgebnisGesamtBlatt, {
    props: {
      klasseText: 'Klasse 4',
      eventName: 'Hafenpokal',
      laeufe: Array.from({ length: opt.laeufe }, (_, i) => i + 1),
      zeilen: leute.map((p) => zeile(p, opt.laeufe)),
      mitKnoten: opt.mitKnoten ?? true,
      abstand: opt.abstand ? 'davor' : undefined,
      herkunft: { titel: 'Verein', anzeige: (p: Starter) => herkunftAnzeige(p.verein, 'verein', 'lang', {}), zeichen },
      geburtsdatum: opt.geburtsdatum,
      sprache: 'de',
    },
  })
}
const herkunftMm = (w: ReturnType<typeof blatt>) => parseFloat(w.find('col.erg-w-herkunft').attributes('style')!.match(/width: ([\d.]+)mm/)![1])
/** Die Klassen der Zellen Name, Vorname, Herkunft der ersten Zeile. */
const klassen = (w: ReturnType<typeof blatt>, z = 0) => w.findAll('tbody tr')[z].findAll('td').slice(2, 5).map((c) => c.classes().join(' '))
/** Was den Spalten Name und Vorname je bleibt (mm) – gerechnet wie in styles/ergebnis.css. */
const nameMm = (w: ReturnType<typeof blatt>, opt: { laeufe: number; geburtsdatum?: boolean; mitKnoten?: boolean; abstand?: boolean }) =>
  (279.8 - 9.5 - 9 - herkunftMm(w) - (opt.geburtsdatum ? 18 : 0) - opt.laeufe * 46.5 - 28 - (opt.mitKnoten === false ? 0 : 12) - (opt.abstand ? 13 : 0)) / 2

describe('Gesamtliste: Namen werden nicht am Zellenrand abgeschnitten', () => {
  it('zwei Läufe, kurze Herkunft: viel Platz, nichts kleiner gesetzt', () => {
    const w = blatt(['Schumacher B', 'Beispielhausen-Muster'], { laeufe: 2 })
    expect(herkunftMm(w)).toBe(20)
    expect(klassen(w, 0)).toEqual(['', '', ''])
    expect(klassen(w, 1)).toEqual(['', '', ''])
  })

  it('drei Läufe, ausgeschriebener Verein: Die Herkunft gibt nach, den Namen bleiben mindestens 22 mm', () => {
    const opt = { laeufe: 3, verein: LANGER_VEREIN }
    const w = blatt(['Schumacher B'], opt)
    // Früher 48 mm für die Herkunft und 17 mm je Namensspalte.
    expect(herkunftMm(w)).toBeLessThan(48)
    expect(nameMm(w, opt)).toBeGreaterThanOrEqual(22)
    // „Schumacher B“ (12 Zeichen, rund 20 mm) steht in voller Größe und passt.
    expect(klassen(w)[0]).toBe('')
    // Die Herkunft bekam weniger als gewünscht: kleiner gesetzt oder zweizeilig, nie abgeschnitten.
    expect(klassen(w)[2]).toMatch(/fit-1|fit-2|erg-zweizeilig/)
  })

  it('wird es trotzdem eng (Geburtsdatum, Abstand), setzt die Liste die Namen nach der Spaltenbreite kleiner', () => {
    const opt = { laeufe: 3, verein: LANGER_VEREIN, geburtsdatum: true, abstand: true }
    const w = blatt(['Schumacher B', 'Li'], opt)
    // Die Herkunft ist auf ihrem Minimum, die Namen bekommen den Rest.
    expect(herkunftMm(w)).toBe(14)
    const mm = nameMm(w, opt)
    expect(mm).toBeLessThan(22)
    // Zwölf Zeichen passen in dieser Breite nicht mehr in voller Größe: kleiner oder zweizeilig.
    expect(Math.floor((mm - 1) / 1.65)).toBeLessThan(12)
    expect(klassen(w, 0)[0]).toMatch(/fit-1|fit-2|erg-zweizeilig/)
    // Ein kurzer Name bleibt, wie er ist.
    expect(klassen(w, 1)[0]).toBe('')
  })

  it('ein Name, der auch kleiner gesetzt nicht passt, steht zweizeilig statt abgeschnitten', () => {
    const w = blatt(['Freiherr von und zu Beispielhausen-Musterstadt am Beispielsee'], { laeufe: 3, verein: LANGER_VEREIN })
    expect(klassen(w)[0]).toBe('erg-zweizeilig')
  })
})
