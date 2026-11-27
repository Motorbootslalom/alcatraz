import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { oeffneUebung } from '../../geraete/uebung'
import { liesAnsicht, mitMaskenWahl, schreibeAnsicht, type Ablage, type GeraetAnsicht } from '../../geraete/ablage'
import type { ErfassungsQuelle } from '../../geraete/erfassen'
import type { MaskenWahl } from '../../wkr/maskenWahl'
import WkrGeraet from './WkrGeraet.vue'

/**
 * „Mehr → Ansicht“ und „Klasse vorziehen“ (Nutzer 24.11.2026) über die Übung ohne Netz:
 * - BL1: die Bojen-Folge nur mit Bojen-Knöpfen; bei der Maske „Bild“ statt ihrer die Lage der Zeichnung;
 * - BL7/BL3: „Start/Ziel links/oben/rechts/unten“ (seit 26.11.2026, R11-13 – vorher „Steg …“; Parallelslalom „Start …“)
 *   dreht die Zeichnung, gemerkt je Liste,
 *   auch auf dem Handy und auch in der Probe am Bild;
 * - Y5: „Klasse vorziehen“ ganz unten unter „Übung verlassen“.
 * Im Test-DOM gibt es keine Lage der Bojen – geprüft wird die Drehung an `data-drehung` und am inline-SVG.
 */
const quellen: ErfassungsQuelle[] = []
const wrappers: VueWrapper[] = []
afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  for (const q of quellen.splice(0)) q.stop()
  vi.useRealTimers()
})

function ablage(): Ablage {
  const d = new Map<string, string>()
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, String(v)), removeItem: (k) => void d.delete(k) }
}

function fenster(breite: number, hoehe: number): void {
  ;(window as unknown as { happyDOM: { setViewport: (v: { width: number; height: number }) => void } }).happyDOM.setViewport({ width: breite, height: hoehe })
  window.dispatchEvent(new Event('resize'))
}

/**
 * Übung einer Liste mit gewählter Maske (wie WkrUebung: Wahl unter dem Übungsraum); Vorgabe Handy 390 × 844. `vorher`
 * legt vor dem Aufbau weitere Ansicht ab (WkrGeraet liest sie nur beim Aufbau).
 */
async function uebung(regelwerk: 'dm-2026' | 'uim-2026', typeId: string, maske: MaskenWahl, breite = 390, hoehe = 844, vorher?: (liste: string) => Partial<GeraetAnsicht>) {
  fenster(breite, hoehe)
  const q = oeffneUebung({ regelwerk, typeId, taktMs: 3_600_000, folgeMs: [0, 0] })
  quellen.push(q)
  const a = ablage()
  const l = q.listen.value[0].liste
  for (const x of q.listen.value) schreibeAnsicht(mitMaskenWahl(liesAnsicht(a), null, x.liste, maske), a)
  if (vorher) schreibeAnsicht(vorher(l), a)
  const w = mount(WkrGeraet, { attachTo: document.body, props: { quelle: q, ablage: a } })
  wrappers.push(w)
  await nextTick()
  await nextTick()
  return { q, w, a, l }
}

async function klick(w: VueWrapper, sel: string): Promise<void> {
  await w.find(sel).trigger('click')
  await nextTick()
  await nextTick()
}
const lagen = (w: VueWrapper) => w.findAll('[data-action="bild-lage"]')
const gedrueckt = (w: VueWrapper) => lagen(w).filter((b) => b.attributes('aria-pressed') === 'true').map((b) => b.attributes('data-lage'))

describe('Mehr → Ansicht: Bojen-Folge nur bei Bojen-Knöpfen, beim Bild die Lage (Nutzer 24.11.2026, BL1–BL3)', () => {
  it('Bild (Handy): keine Bojen-Folge, „Automatisch“ + vier Lagen „Start/Ziel …“; ohne Wahl „Automatisch“ gedrückt, der Satz nennt die wirksame Lage', async () => {
    const { w } = await uebung('dm-2026', 'gate135', 'bild')
    expect(w.find('.wkr-maske').attributes('data-maske')).toBe('bild')
    expect(w.find('[data-teil="bild-flaeche"]').attributes('data-drehung')).toBe('0')
    await klick(w, '[data-action="mehr"]')
    expect(w.find('[data-teil="bojen-ansicht"]').exists()).toBe(false)
    const block = w.find('[data-teil="bild-lage"]')
    expect(block.attributes('data-art')).toBe('klasse')
    expect(w.find('[data-action="bild-lage-auto"]').text()).toBe('Automatisch')
    // Nutzer 26.11.2026 (R11-13): „Steg ist hier irreführend. Der steht immer anders.“ – benannt nach Start/Ziel.
    expect(lagen(w).map((b) => b.text())).toEqual(['Start/Ziel links', 'Start/Ziel oben', 'Start/Ziel rechts', 'Start/Ziel unten'])
    expect(lagen(w).map((b) => b.attributes('data-lage'))).toEqual(['0', '90', '180', '270'])
    // Prüfbefund 24.11.2026: ohne Wahl ist „Automatisch“ gedrückt, keine der vier.
    expect(w.find('[data-action="bild-lage-auto"]').attributes('aria-pressed')).toBe('true')
    expect(gedrueckt(w)).toEqual([])
    // Blick „hinten“ (Bogen 90°) liegt auf dem Handy ohne Wahl wie die Datei = „Start/Ziel links“.
    expect(w.find('[data-teil="bild-lage-text"]').text()).toBe('Start/Ziel links, Tor 5 rechts.')
    expect(w.find('[data-teil="bild-lage-vorgabe"]').text()).toContain('wie auf dem Bogen')
  })

  it('„Automatisch“ führt nach einer Wahl zurück zu „keine Wahl“ – der Eintrag der Liste fällt, andere Listen bleiben (Prüfbefund 24.11.2026)', async () => {
    // Eine andere Liste hat schon eine Lage – die bleibt stehen.
    const { w, a, l } = await uebung('dm-2026', 'gate135', 'bild', 390, 844, () => ({ bildLage: { andere: 270 } }))
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="bild-lage"][data-lage="90"]')
    expect(liesAnsicht(a).bildLage).toEqual({ andere: 270, [l]: 90 })
    expect(w.find('[data-teil="maske"] [data-teil="bild-flaeche"]').attributes('data-drehung')).toBe('90')
    await klick(w, '[data-action="bild-lage-auto"]')
    expect(liesAnsicht(a).bildLage).toEqual({ andere: 270 })
    expect(w.find('[data-teil="maske"] [data-teil="bild-flaeche"]').attributes('data-drehung')).toBe('0')
    expect(w.find('[data-action="bild-lage-auto"]').attributes('aria-pressed')).toBe('true')
    expect(gedrueckt(w)).toEqual([])
    expect(w.find('[data-teil="bild-lage-vorgabe"]').exists()).toBe(true)
  })

  it('nur diese Liste gewählt, dann „Automatisch“: die Lage fällt ganz aus der Ansicht', async () => {
    const { w, a } = await uebung('dm-2026', 'gate135', 'bild')
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="bild-lage"][data-lage="180"]')
    await klick(w, '[data-action="bild-lage-auto"]')
    expect(liesAnsicht(a).bildLage).toBeUndefined()
  })

  it('Bild: DISQ im Fuß zeigt die Ortswahl in der Vorgabe „Rückweg gedreht“, auch wenn bei den Knöpfen „Fahrtfolge“ gewählt ist (BL6)', async () => {
    const halteVon = (w: VueWrapper) => w.findAll('[data-teil="disq-ort-halt"]').map((h) => `${h.attributes('data-halt')}|${h.attributes('data-weg')}`)
    const fahrtfolge = (l: string): Partial<GeraetAnsicht> => ({ bojenFolge: { [l]: 'fahrt' } })
    // Knöpfe mit „Fahrtfolge“: die Ortswahl folgt der Wahl.
    const knoepfe = await uebung('dm-2026', 'gate135', 'knoepfe', 390, 844, fahrtfolge)
    await klick(knoepfe.w, '[data-teil="fuss"] [data-action="disq"]')
    const fahrt = halteVon(knoepfe.w)
    // Bild mit derselben abgelegten Folge: die Ortswahl wie ohne Wahl („gedreht“).
    const { w } = await uebung('dm-2026', 'gate135', 'bild', 390, 844, fahrtfolge)
    expect(w.find('.wkr-maske').attributes('data-maske')).toBe('bild')
    await klick(w, '[data-teil="fuss"] [data-action="disq"]')
    const gedreht = halteVon(w)
    expect(gedreht.length).toBe(fahrt.length)
    expect(gedreht).not.toEqual(fahrt)
    // Vorgabe „gedreht“: der Rückweg beginnt mit dem Ziel (unter dem Start), nicht mit Tor 5.
    const rueck = gedreht.filter((h) => h.endsWith('|rueck'))
    expect(rueck[0]).toMatch(/^ziel\|/)
  })

  it('„Start/Ziel oben“ dreht die Zeichnung um 90° (auch auf dem Handy), merkt es je Liste; die Probe am Bild liegt ebenso', async () => {
    const { w, a, l } = await uebung('dm-2026', 'gate135', 'bild')
    await klick(w, '[data-action="mehr"]')
    await klick(w, '[data-action="bild-lage"][data-lage="90"]')
    const flaeche = w.find('[data-teil="maske"] [data-teil="bild-flaeche"]')
    expect(flaeche.attributes('data-drehung')).toBe('90')
    expect(flaeche.attributes('data-lage')).toBe('90')
    expect(w.find('[data-teil="maske"] .wkr-bild-svg').html()).toContain('<g transform="rotate(90)">')
    expect(liesAnsicht(a).bildLage).toEqual({ [l]: 90 })
    expect(gedrueckt(w)).toEqual(['90'])
    expect(w.find('[data-teil="bild-lage-text"]').text()).toBe('Start/Ziel oben, Tor 5 unten.')
    expect(w.find('[data-teil="bild-lage-vorgabe"]').exists()).toBe(false)
    // „Start/Ziel rechts“ = 180°.
    await klick(w, '[data-action="bild-lage"][data-lage="180"]')
    expect(w.find('[data-teil="maske"] [data-teil="bild-flaeche"]').attributes('data-drehung')).toBe('180')
    expect(liesAnsicht(a).bildLage).toEqual({ [l]: 180 })
    // Probe über „Mehr“: dieselbe Lage.
    await klick(w, '[data-action="probe"]')
    expect(w.find('[data-teil="probe"]').attributes('data-maske')).toBe('bild')
    expect(w.find('[data-teil="probe"] [data-teil="bild-flaeche"]').attributes('data-drehung')).toBe('180')
  })

  it('Knöpfe: die Bojen-Folge wie bisher, keine Lage', async () => {
    const { w } = await uebung('dm-2026', 'gate135', 'knoepfe')
    await klick(w, '[data-action="mehr"]')
    expect(w.find('[data-teil="bojen-ansicht"]').exists()).toBe(true)
    expect(w.find('[data-teil="bild-lage"]').exists()).toBe(false)
  })

  it('Tabelle (Pad): weder Bojen-Folge noch Lage – keine Bojen-Knöpfe, keine Zeichnung', async () => {
    const { w } = await uebung('dm-2026', 'gate135', 'text', 1024, 768)
    expect(w.find('[data-teil="tabelle"]').exists()).toBe(true)
    await klick(w, '[data-action="mehr"]')
    expect(w.find('[data-teil="bojen-ansicht"]').exists()).toBe(false)
    expect(w.find('[data-teil="bild-lage"]').exists()).toBe(false)
  })

  it('Parallelslalom (UIM, englisch): dieselben Drehungen heißen nach dem Start, der Satz nennt Boje 5', async () => {
    const { w } = await uebung('uim-2026', 'parallelparcours', 'bild')
    expect(w.find('[data-teil="bild"]').attributes('data-art')).toBe('svg')
    await klick(w, '[data-action="mehr"]')
    expect(w.find('[data-teil="bild-lage"]').attributes('data-art')).toBe('parallel')
    expect(lagen(w).map((b) => b.text())).toEqual(['Start on the left', 'Start at the top', 'Start on the right', 'Start at the bottom'])
    await klick(w, '[data-action="bild-lage"][data-lage="270"]')
    expect(w.find('[data-teil="maske"] [data-teil="bild-flaeche"]').attributes('data-drehung')).toBe('270')
    expect(w.find('[data-teil="bild-lage-text"]').text()).toBe('Start/finish at the bottom, buoy 5 at the top.')
  })
})

describe('„Klasse vorziehen“ ganz unten (Nutzer 24.11.2026, Y5)', () => {
  it('steht in „Mehr“ unter „Probe · Übung verlassen“ und klappt „Mehr“ nach der Wahl zu', async () => {
    const { w } = await uebung('dm-2026', 'tor5', 'knoepfe')
    await klick(w, '[data-action="mehr"]')
    const ende = w.find('[data-action="uebung-ende"]').element
    const vorziehen = w.find('[data-teil="uebung-vorziehen"]').element
    expect(ende.compareDocumentPosition(vorziehen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Kein Feld der Ansicht steht mehr darunter.
    const ansicht = w.find('[data-teil="ansicht"]').element
    expect(vorziehen.compareDocumentPosition(ansicht) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
    await klick(w, '[data-action="uebung-vorziehen"]')
    expect(w.find('[data-teil="uebung-vorziehen"]').exists()).toBe(false)
  })
})
