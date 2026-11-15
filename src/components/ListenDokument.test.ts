import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import ListenDokument from './ListenDokument.vue'
import type { SeitenTeil } from '../lib/seiten'

// Im Browser bildet die Messung die Seiten, nicht die Vorgabe. happy-dom hat kein Layout –
// die Ansichtstests (views/Seitenzahlen.test.ts) sehen deshalb nur die Vorgabe. Hier bekommt
// das Test-DOM Maße: Kopf und Zeilen melden eine Höhe, wie es der Browser täte. So fiele auf,
// wenn eine Änderung am Messen die Teilung verfälscht, pendeln lässt oder Zeilen verliert.

/** A4 hoch: 281 mm nutzbar, minus 5 mm Reserve und 5 mm Seitenzahl = 1024,25 px für Kopf und Zeilen. */
const VORGABE = 40

/** Das „Layout“ des Test-DOMs. */
let mass: { kopf: number; zeile: number; hoch: Record<number, number>; layout: boolean }
const hoeheDerZeile = (i: number) => mass.hoch[i] ?? mass.zeile

function rect(this: HTMLElement): DOMRect {
  let height = 0
  if (mass.layout && this.matches('tbody tr')) height = hoeheDerZeile(Number(this.dataset.i))
  else if (mass.layout && this.classList.contains('listen-seite-inhalt')) {
    height = mass.kopf + [...this.querySelectorAll<HTMLElement>('tbody tr')].reduce((n, z) => n + hoeheDerZeile(Number(z.dataset.i)), 0)
  }
  return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: height, width: 0, height, toJSON: () => ({}) }
}

/** Wie oft der Inhalt einer Seite gezeichnet wurde – eine Schleife aus Messen und Neuzeichnen fiele hier auf. */
let gezeichnet = 0
function dokument(laengen: number[], format: 'portrait' | 'landscape' = 'portrait') {
  return mount(ListenDokument, {
    attachTo: document.body,
    props: { laengen, format, vorgabe: VORGABE, sprache: 'de' },
    slots: {
      default: ({ teile }: { teile: SeitenTeil[] }) => {
        gezeichnet++
        // Die Zeile kennt ihre Stelle in der ganzen Liste – daran hängt im Test ihre Höhe.
        const beginn = laengen.map((_, b) => laengen.slice(0, b).reduce((n, l) => n + l, 0))
        return h('table', [
          h('thead', [h('tr', [h('th', 'Kopf')])]),
          ...teile.map((teil) =>
            h(
              'tbody',
              Array.from({ length: teil.bis - teil.von }, (_, j) => h('tr', { 'data-i': beginn[teil.block] + teil.von + j }, [h('td', 'x')])),
            ),
          ),
        ])
      },
    },
  })
}
const zeilenJeSeite = (w: VueWrapper) => w.findAll('.listen-seite').map((s) => s.findAll('tbody tr').length)
const zahlen = (w: VueWrapper) => w.findAll('.listen-seite').map((s) => (s.find('.listen-seitenzahl').exists() ? s.find('.listen-seitenzahl').text() : '-'))
const nummern = (w: VueWrapper) => w.findAll('tbody tr').map((z) => Number(z.attributes('data-i')))
/** Warten, bis Messen und Neuzeichnen zur Ruhe gekommen sind. */
async function ruhe() {
  for (let i = 0; i < 5; i++) await nextTick()
}

describe('ListenDokument: die Messung im Browser bildet die Seiten', () => {
  beforeEach(() => {
    // Kopf 104 px, Zeilen 20 px: (1024,25 − 104) / 20 → 46 Zeilen je Seite, nicht die 40 der Vorgabe.
    mass = { kopf: 104, zeile: 20, hoch: {}, layout: true }
    gezeichnet = 0
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rect)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('ohne Layout gilt die Vorgabe', async () => {
    mass.layout = false
    const w = dokument([100])
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([40, 40, 20])
    w.unmount()
  })

  it('die Teilung folgt der Messung statt der Vorgabe und zählt die eigenen Seiten', async () => {
    const w = dokument([100])
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([46, 46, 8])
    expect(zahlen(w)).toEqual(['Seite 1 / 3', 'Seite 2 / 3', 'Seite 3 / 3'])
    expect(nummern(w)).toEqual(Array.from({ length: 100 }, (_, i) => i))
    w.unmount()
  })

  it('eigener Fuß: steht auf jeder Seite, bekommt die Seitenzahl gereicht – und sein Platz zählt bei der Teilung mit', async () => {
    const mitFuss = (fussMm: number | undefined) =>
      mount(ListenDokument, {
        attachTo: document.body,
        props: { laengen: [100], format: 'portrait', vorgabe: VORGABE, sprache: 'de', fussMm },
        slots: {
          default: ({ teile }: { teile: SeitenTeil[] }) =>
            h('table', [h('thead', [h('tr', [h('th', 'Kopf')])]), ...teile.map((teil) => h('tbody', Array.from({ length: teil.bis - teil.von }, (_, j) => h('tr', { 'data-i': teil.von + j }, [h('td', 'x')]))))]),
          fuss: ({ teile, seitenzahl }: { teile: SeitenTeil[]; seitenzahl: string }) => h('p', { class: 'mein-fuss' }, `${seitenzahl} | ab ${teile[0].von}`),
        },
      })
    // Ohne Angabe ist der Fuß so hoch wie die Zeile der Seitenzahl: dieselbe Teilung wie ohne Slot.
    const w = mitFuss(undefined)
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([46, 46, 8])
    expect(w.findAll('.listen-seite').map((s) => s.find('.listen-fuss .mein-fuss').text())).toEqual(['Seite 1 / 3 | ab 0', 'Seite 2 / 3 | ab 46', 'Seite 3 / 3 | ab 92'])
    expect(w.findAll('.listen-fuss').map((f) => f.attributes('style'))).toEqual(Array(3).fill('height: 5mm;'))
    // Die Seitenzahl schreibt dann der Fuß, nicht das Dokument ein zweites Mal.
    expect(w.find('.listen-seitenzahl').exists()).toBe(false)
    w.unmount()
    // 12 mm statt 5 mm: 7 mm = 26,5 px weniger – (920,25 − 26,5) / 20 → 44 Zeilen je Seite statt 46.
    const hoch = mitFuss(12)
    await ruhe()
    expect(zeilenJeSeite(hoch)).toEqual([44, 44, 12])
    expect(hoch.find('.listen-fuss').attributes('style')).toBe('height: 12mm;')
    hoch.unmount()
    // Eine Seite: Der Fuß steht trotzdem da (er trägt mehr als die Zahl), die Seitenzahl ist leer.
    mass.layout = false
    const kurz = mount(ListenDokument, {
      props: { laengen: [3], format: 'portrait', vorgabe: VORGABE, sprache: 'de', fussMm: 12 },
      slots: { default: () => h('table'), fuss: ({ seitenzahl }: { seitenzahl: string }) => h('p', { class: 'mein-fuss' }, `[${seitenzahl}]`) },
    })
    expect(kurz.find('.mein-fuss').text()).toBe('[]')
    kurz.unmount()
  })

  it('Querformat hat weniger Platz', async () => {
    // 210 mm hoch: (194 − 10) mm = 695,4 px, minus Kopf 104 → 29 Zeilen. 60 Zeilen wären
    // 29 + 29 + 2; das letzte Blatt bekommt aber mindestens drei (lib/seiten.ts).
    const w = dokument([60], 'landscape')
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([29, 28, 3])
    w.unmount()
  })

  it('höhere Zeilen zählen mit ihrer eigenen Höhe – auch auf den Folgeseiten', async () => {
    // Zeile 10 (Seite 1) und Zeile 50 (Seite 2) sind doppelt so hoch: je eine Zeile weniger.
    mass.hoch = { 10: 40, 50: 40 }
    const w = dokument([100])
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([45, 45, 10])
    w.unmount()
  })

  it('die Höhen gehören zu den Blöcken: Ein Block, der nicht mehr passt, beginnt auf der nächsten Seite', async () => {
    // Block 2 beginnt bei Zeile 30; seine Zeilen sind hoch (40 px): 30 × 20 + 10 × 40 = 1000 > 920.
    mass.hoch = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [30 + i, 40]))
    const w = dokument([30, 10, 5])
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([30, 15])
    expect(nummern(w)).toEqual(Array.from({ length: 45 }, (_, i) => i))
    w.unmount()
  })

  it('zweites Messen ändert nichts mehr: keine Schleife aus Messen und Neuzeichnen', async () => {
    const w = dokument([100])
    await ruhe()
    const vorher = gezeichnet
    await ruhe()
    expect(gezeichnet).toBe(vorher)
    // Ein Neuzeichnen aus anderem Grund (Sprache) misst neu, teilt aber gleich – einmal zeichnen, nicht öfter.
    await w.setProps({ sprache: 'en' })
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([46, 46, 8])
    expect(zahlen(w)).toEqual(['Page 1 / 3', 'Page 2 / 3', 'Page 3 / 3'])
    expect(gezeichnet).toBe(vorher + 3)
    w.unmount()
  })

  it('Rundungsrauschen schaltet die Teilung nicht um, eine echte Änderung schon', async () => {
    const w = dokument([100])
    await ruhe()
    // 0,9 px mehr Kopf hieße rechnerisch nur noch 45 Zeilen – liegt aber in der Toleranz.
    mass.kopf = 104.9
    await w.setProps({ sprache: 'en' })
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([46, 46, 8])
    // Zwei Pixel mehr sind kein Rauschen.
    mass.kopf = 106
    await w.setProps({ sprache: 'de' })
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([45, 45, 10])
    w.unmount()
  })

  it('geänderte Zeilenzahl: Die alte Messung gilt nicht mehr – bis zur nächsten Messung die Vorgabe', async () => {
    const w = dokument([100])
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([46, 46, 8])
    // Solange nicht gemessen werden kann, darf die Messung der 100 Zeilen nicht auf 101 angewandt werden.
    mass.layout = false
    await w.setProps({ laengen: [101] })
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([40, 40, 21])
    // Mit Layout misst das nächste Zeichnen wieder nach.
    mass.layout = true
    await w.setProps({ sprache: 'en' })
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([46, 46, 9])
    w.unmount()
  })

  it('eine Zeile, die höher ist als das Blatt, bekommt trotzdem eine Seite – keine geht verloren', async () => {
    mass.hoch = { 3: 2000 }
    const w = dokument([8])
    await ruhe()
    expect(nummern(w)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(w.findAll('.listen-seite').length).toBeGreaterThan(1)
    expect(zahlen(w)).not.toContain('-')
    w.unmount()
  })

  it('eine Liste, die gemessen auf ein Blatt passt, trägt keine Seitenzahl – auch wenn die Vorgabe sie teilte', async () => {
    const w = dokument([45])
    await ruhe()
    expect(zeilenJeSeite(w)).toEqual([45])
    expect(zahlen(w)).toEqual(['-'])
    w.unmount()
  })
})
