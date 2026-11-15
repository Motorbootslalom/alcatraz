import { herkunftAnzeige } from '../../lib/origin'
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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
  knotenErfasst: true, knoten: 0,
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

describe('Gesamtliste nach UIM: ohne Spalte „Result“', () => {
  it('die Knoten folgen gleich auf die Läufe (mit der kräftigen Linie); Kopf und Zeilen passen zu den Spalten', () => {
    const mit = blatt(['Muster'], { laeufe: 2 })
    const ohne = mount(ErgebnisGesamtBlatt, { props: { ...mit.props(), ohneErgebnis: true } })
    const kopf = (w: typeof mit) => w.findAll('.erg-spaltenkopf th').map((t) => t.text())
    expect(kopf(mit).slice(-3)).toEqual(['Ergebnis', 'Knoten', 'Gesamt'])
    expect(kopf(ohne).slice(-3)).toEqual(['2. Lauf', 'Knoten', 'Gesamt'])
    expect(ohne.find('th[data-spalte="knoten"]').classes()).toContain('erg-gruppe')
    expect(ohne.find('tbody td[data-spalte="knoten"]').classes()).toContain('erg-gruppe')
    expect(mit.find('th[data-spalte="knoten"]').classes()).not.toContain('erg-gruppe')
    // Der Kopf überspannt genau die Spalten, jede Zeile füllt sie.
    for (const w of [mit, ohne]) {
      expect(w.find('th.erg-kopfzelle').attributes('colspan')).toBe(String(w.findAll('colgroup col').length))
      expect(w.findAll('tbody tr')[0].findAll('td')).toHaveLength(w.findAll('colgroup col').length)
    }
    expect(ohne.findAll('colgroup col')).toHaveLength(mit.findAll('colgroup col').length - 1)
    // „Result“ und „Gesamt“ sind gleich breit (`erg-w-ergebnis`); ohne „Result“ bleibt eine.
    expect([mit, ohne].map((w) => w.findAll('col.erg-w-ergebnis').length)).toEqual([2, 1])
  })
})

describe('Ergebnis einer Runde: „Qualified“ und das Finale in EINER Zelle, schräg', () => {
  /** Ein Ergebnis einer Runde mit `n` Startern; `bloecke`: Zeile (ab 0) → Vermerk über mehrere Zeilen. */
  function runde(n: number, bloecke: Record<number, string>, werte: Record<number, number | string> = {}) {
    const leute = Array.from({ length: n }, (_, i) => starter(i + 1, `Nach${i + 1}`))
    const id = (i: number) => leute[i].id
    return mount(ErgebnisGesamtBlatt, {
      attachTo: document.body,
      props: {
        klasseText: 'Class 4',
        eventName: 'Parallel slalom · Hafenpokal',
        laeufe: [1, 2],
        zeilen: leute.map((p) => zeile(p, 2)),
        mitKnoten: false,
        runde: { titel: 'Preliminary heat – Results', laufTitel: (l: number) => `${l}. attempt`, racecourse: new Map() },
        punkte: {
          werte: new Map(Object.entries(werte).map(([i, w]) => [id(Number(i)), w])),
          bloecke: new Map(Object.entries(bloecke).map(([i, t]) => [id(Number(i)), t])),
        },
        sprache: 'en',
      },
    })
  }
  /** Die Zellen der Spalte je Seite; eine zusammengefasste mit „×n“. */
  const zellen = (w: ReturnType<typeof runde>) =>
    w.findAll('.listen-seite').map((s) => s.findAll('td[data-spalte="uim-punkte"]').map((t) => (t.attributes('rowspan') ? `${t.text()} ×${t.attributes('rowspan')}` : t.text())))

  it('aufeinanderfolgende Zeilen mit demselben Vermerk teilen sich eine Zelle; „Re-run“ und eine einzelne Zeile bleiben einzeln', () => {
    const w = runde(8, { 0: 'Qualified', 1: 'Qualified', 3: 'Qualified', 4: 'Qualified', 5: 'Qualified' }, { 2: 'Re-run', 6: 127, 7: 95 })
    expect(zellen(w)).toEqual([['Qualified ×2', 'Re-run', 'Qualified ×3', '127', '95']])
    // Jede Zeile hat so viele Zellen, wie die Tabelle Spalten hat – die zusammengefasste zählt in ihren Zeilen mit.
    const spalten = w.findAll('colgroup col').length
    const zeilen = w.findAll('tbody tr')
    expect(zeilen.map((r) => r.findAll('td').length)).toEqual([spalten, spalten - 1, spalten, spalten, spalten - 1, spalten - 1, spalten, spalten])
    // Die fünfte Zeile ist grau – die Zelle über ihr bleibt weiß (styles/ergebnis.css).
    expect(zeilen[4].classes()).toContain('grau')
    expect(zeilen[3].find('td.erg-block').attributes('data-zeilen')).toBe('3')
    w.unmount()
  })

  it('schräg und so groß, wie er in die Zelle passt: in zwei Zeilen flacher und kleiner als in vier, höchstens 9 pt', () => {
    const w = runde(6, { 0: 'Final 1–2', 1: 'Final 1–2', 2: 'Qualified', 3: 'Qualified', 4: 'Qualified', 5: 'Qualified' })
    const stil = w.findAll('.erg-schraeg').map((s) => s.attributes('style')!)
    const winkel = stil.map((s) => Number(s.match(/rotate\((-[\d.]+)deg\)/)![1]))
    const groesse = stil.map((s) => Number(s.match(/font-size: ([\d.]+)mm/)![1]))
    expect(winkel[0]).toBeGreaterThan(winkel[1])
    expect(winkel[1]).toBeGreaterThan(-90)
    expect(winkel[0]).toBeLessThan(0)
    expect(groesse[0]).toBeLessThan(groesse[1])
    expect(groesse[1]).toBeLessThanOrEqual(3.175)
    // Zwei Zeilen (9,2 mm hoch, 18 mm breit): gut lesbar, ab rund 6 pt (2,1 mm).
    expect(groesse[0]).toBeGreaterThan(2.1)
    w.unmount()
  })

  it('Re-run: Sternchen am Platz wie beim Stichentscheid; die Fußnote nennt auf jeder Seite, was dort entschieden hat', async () => {
    // 34 Zeilen → zwei Seiten (Vorgabe 30). Stichentscheid auf Zeile 2, Re-run auf den Zeilen 4 und 32.
    const w = runde(34, {})
    const ids = w.props('zeilen').map((z) => z.starter.id)
    const zeilen = w.props('zeilen').map((z, i) => (i === 1 ? { ...z, stich: true } : z))
    await w.setProps({ zeilen, stichText: 'Ranking decided by the dead-heat rule. Better single attempt.', wiederholt: { ids: new Set([ids[3], ids[31]]), text: 'Ranking decided by the re-run.' } })
    await nextTick()
    const seiten = w.findAll('.listen-seite')
    expect(seiten).toHaveLength(2)
    expect(seiten[0].findAll('tbody td.erg-platz').slice(0, 5).map((t) => t.text())).toEqual(['1', '1*', '1', '1*', '1'])
    // Ein Zeichen für beides – beides ist Pkt. 5.2.6 („Dead-heat situations“) –, die Fußnote erklärt, was auf der Seite vorkommt.
    expect(seiten[0].find('[data-hinweis="stich"]').text()).toBe('* Ranking decided by the dead-heat rule. Better single attempt. Ranking decided by the re-run.')
    expect(seiten[1].find('[data-hinweis="stich"]').text()).toBe('* Ranking decided by the re-run.')
    expect(seiten[1].findAll('tbody tr[data-wiederholt]').map((r) => r.attributes('data-starter'))).toEqual([ids[31]])
    w.unmount()
  })

  it('ein Seitenwechsel trennt die Zelle nicht: Die Seite endet vor ihr (Vorgabe 30 Zeilen je Seite)', () => {
    // Nach Startnummer: „Qualified“ auf den Zeilen 29 bis 32 von 34 – ohne Bindung stünde die Grenze nach Zeile 30.
    const w = runde(34, { 28: 'Qualified', 29: 'Qualified', 30: 'Qualified', 31: 'Qualified' })
    expect(w.findAll('.listen-seite').map((s) => s.findAll('tbody tr').length)).toEqual([28, 6])
    expect(zellen(w)[1].slice(0, 1)).toEqual(['Qualified ×4'])
    w.unmount()
  })
})
