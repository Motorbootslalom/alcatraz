import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { oeffneUebung } from '../../geraete/uebung'
import type { Ablage } from '../../geraete/ablage'
import type { ErfassungsQuelle } from '../../geraete/erfassen'
import { WKR_ANNAHMEN } from '../../wkr/annahmen'
import WkrGeraet from './WkrGeraet.vue'
import WkrZiffern from './WkrZiffern.vue'

/**
 * Knoten-Prüfliste am Tisch (W5.3, Plan docs/plan-wkr-w5.md §6.2, 22.11.2026, KN7/KN8) über die Übung ohne Netz (20
 * erfundene Starter): Nummer über WkrZiffern, Kopf Nr./Klasse/offen, ✓ / ✗ · 5 je Knoten, Abschicken erst bei allen
 * gesetzt, danach leeres Nummernfeld ohne Takt (kein Overlay), erledigte Nummer = Korrektur, Pad mit offenen Nummern.
 */
const quellen: ErfassungsQuelle[] = []
const wrappers: VueWrapper[] = []
afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  for (const q of quellen.splice(0)) q.stop()
  vi.useRealTimers()
})

function handy(): Ablage {
  const d = new Map<string, string>()
  return { getItem: (k) => d.get(k) ?? null, setItem: (k, v) => void d.set(k, String(v)), removeItem: (k) => void d.delete(k) }
}

function fenster(breite: number, hoehe: number): void {
  ;(window as unknown as { happyDOM: { setViewport: (v: { width: number; height: number }) => void } }).happyDOM.setViewport({ width: breite, height: hoehe })
  window.dispatchEvent(new Event('resize'))
}

async function knoten(breite = 390, hoehe = 844) {
  fenster(breite, hoehe)
  const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'knoten', folgeMs: [0, 0] })
  quellen.push(q)
  const w = mount(WkrGeraet, { attachTo: document.body, props: { quelle: q, ablage: handy() } })
  wrappers.push(w)
  await nextTick()
  return { q, w }
}

const tippe = async (w: VueWrapper, ziffern: string) => {
  for (const z of ziffern) await w.find(`[data-teil="ziffern"] [data-taste="${z}"]`).trigger('click')
}
const klick = (w: VueWrapper, sel: string) => w.find(sel).trigger('click')

describe('WkrZiffern (Grundform)', () => {
  it('eigene Tasten 0–9, Buchstaben, ⌫; Länge begrenzt; jeder Knopf ein großes Ziel', async () => {
    let wert = ''
    const w = mount(WkrZiffern, { props: { modelValue: '', buchstaben: ['E'], max: 3, 'onUpdate:modelValue': (v: string) => void w.setProps({ modelValue: (wert = v) }) } })
    expect(w.findAll('button').map((b) => b.attributes('data-taste'))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'E', '0', '⌫'])
    expect(w.findAll('button').every((b) => b.classes('wkr-knopf') && b.attributes('data-ziel') === 'gross')).toBe(true)
    for (const k of ['E', '0', '1', '2']) await w.find(`[data-taste="${k}"]`).trigger('click')
    expect(wert).toBe('E01')
    await w.find('[data-taste="⌫"]').trigger('click')
    expect(wert).toBe('E0')
    expect(w.find('[data-teil="ziffern-anzeige"]').text()).toContain('E0')
    w.unmount()
  })
})

describe('WkrPruefliste in der Übung (KN7/KN8)', () => {
  it('Nummer → Klasse und Knoten; Abschicken erst bei allen gesetzt; danach leeres Feld, kein Overlay', async () => {
    const { q, w } = await knoten()
    expect(w.find('[data-maske="pruefliste"]').exists()).toBe(true)
    // Keine Probe und keine Starterkarte am Tisch.
    expect(w.find('[data-teil="probe"]').exists()).toBe(false)
    expect(w.find('[data-teil="pruef-offen"]').text()).toBe(`offen ${WKR_ANNAHMEN.uebungStarts} / ${WKR_ANNAHMEN.uebungStarts}`)
    expect(w.find('[data-action="haupt"]').attributes('disabled')).toBeDefined()
    await tippe(w, '7')
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. 7')
    expect(w.find('[data-teil="pruef-klasse"]').text()).toMatch(/^Klasse /)
    const zeilen = w.findAll('[data-teil="pruef-knoten"] li')
    expect(zeilen).toHaveLength(5)
    // Zwei offen → gesperrt mit „noch 2 offen“.
    for (const z of zeilen.slice(0, 3)) await z.find('[data-action="pruef-ok"]').trigger('click')
    expect(w.find('[data-action="haupt"]').text()).toBe('noch 2 offen')
    expect(w.find('[data-action="haupt"]').attributes('disabled')).toBeDefined()
    await zeilen[3].find('[data-action="pruef-ok"]').trigger('click')
    await zeilen[4].find('[data-action="pruef-fehler"]').trigger('click')
    expect(zeilen[4].attributes('data-wahl')).toBe('fehler')
    expect(w.find('[data-action="haupt"]').text()).toBe('Abschicken · Σ 5')
    await klick(w, '[data-action="haupt"]')
    // KN8: kein Takt – das Feld ist sofort leer, kein Overlay, die Rückmeldung steht klein darunter.
    expect(w.find('[data-teil="uebertragen"]').exists()).toBe(false)
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. –')
    expect(w.find('[data-teil="pruef-letzte"]').text()).toMatch(/^Zuletzt: 7 /)
    expect(Object.values(q.zuletzt.value[0].zellen).filter((x) => x !== '')).toEqual(['5'])
    expect(w.find('[data-teil="pruef-offen"]').text()).toBe(`offen ${WKR_ANNAHMEN.uebungStarts - 1} / ${WKR_ANNAHMEN.uebungStarts}`)
  })

  it('erledigte Nummer öffnet die Korrektur mit den gesendeten Werten; unbekannte Nummer sagt es', async () => {
    const { q, w } = await knoten()
    await tippe(w, '3')
    for (const z of w.findAll('[data-teil="pruef-knoten"] li')) await z.find('[data-action="pruef-ok"]').trigger('click')
    await klick(w, '[data-action="haupt"]')
    await tippe(w, '3')
    expect(w.find('[data-teil="pruef-korrektur"]').exists()).toBe(true)
    // Alle Knoten ✓ aus dem eigenen Stand (leere Zellen gingen nie hinaus – fehlend heißt ✓).
    expect(w.findAll('[data-teil="pruef-knoten"] li').every((z) => z.attributes('data-wahl') === 'ok')).toBe(true)
    await w.findAll('[data-teil="pruef-knoten"] li')[0].find('[data-action="pruef-fehler"]').trigger('click')
    expect(w.find('[data-action="haupt"]').text()).toBe('Korrektur abschicken · Σ 5')
    await klick(w, '[data-action="haupt"]')
    expect(q.zuletzt.value[0].korrektur).toBe(true)
    await tippe(w, '99')
    expect(w.find('[data-teil="pruef-unbekannt"]').text()).toBe('Nr. 99 steht nicht auf dieser Liste.')
  })

  it('Pad: offene Nummern rechts antippbar; „Liste abschließen“ mit „Rest auf Papier“ (KN5)', async () => {
    const { w } = await knoten(1024, 768)
    expect(w.find('.wkr-pruefliste').attributes('data-pad')).toBeDefined()
    const offene = w.findAll('[data-teil="pruef-offene"] [data-action="pruef-waehle"]')
    expect(offene).toHaveLength(WKR_ANNAHMEN.uebungStarts)
    await offene[4].trigger('click')
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. 5')
    await klick(w, '[data-action="pruef-abschliessen"]')
    expect(w.find('[data-teil="abschluss"]').attributes('data-punkt')).toBe('ohne')
    expect(w.find('[data-teil="rest-papier"]').exists()).toBe(true)
  })
})
