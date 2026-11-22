import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { oeffneUebung } from '../../geraete/uebung'
import type { Ablage } from '../../geraete/ablage'
import type { ErfassungsQuelle } from '../../geraete/erfassen'
import { maskeFuer } from '../../wkr/maske'
import type { ClassId } from '../../types'
import WkrGeraet from './WkrGeraet.vue'
import WkrProbe from './WkrProbe.vue'
import WkrZiffern from './WkrZiffern.vue'

/**
 * Zeit-Listen mit Ziffernblock (W5.4, Plan docs/plan-wkr-w5.md §7.2, 22.11.2026, ZT1–ZT4) über die Übung ohne Netz:
 * Ziffernblock mit Komma, Uhr und Deutung wie am Rechner, unlesbar rot, Abschicken erst bei allen Feldern, „Keine
 * Zeit“ mit Grund, Feld-Reiter auf dem Handy, Felder nebeneinander auf dem Pad, Zuletzt mit Zeiten, Probe „83,45“.
 * Keine festen Pausen: Die Übung quittiert über Zeitgeber, hier mit Fake-Uhr weitergedreht.
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

async function zeitUebung(breite = 390, hoehe = 844) {
  fenster(breite, hoehe)
  const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'zeit', taktMs: 3_600_000, folgeMs: [0, 0] })
  quellen.push(q)
  const w = mount(WkrGeraet, { attachTo: document.body, props: { quelle: q, ablage: handy() } })
  wrappers.push(w)
  await nextTick()
  return { q, w }
}

const tippe = async (w: VueWrapper, tasten: string) => {
  for (const k of tasten) await w.find(`[data-teil="zeiten"] [data-taste="${k}"]`).trigger('click')
}
const klick = (w: VueWrapper, sel: string) => w.find(sel).trigger('click')
const haupt = (w: VueWrapper) => w.find('[data-action="haupt"]')

describe('WkrZiffern (Zeit, W5.4)', () => {
  it('Komma-Taste, Uhr „1:23,45“ und Deutung „= 1 min 23,45 s“; „,“ nur einmal; unlesbar rot', async () => {
    let wert = ''
    const w = mount(WkrZiffern, { props: { modelValue: '', zeit: true, 'onUpdate:modelValue': (v: string) => void w.setProps({ modelValue: (wert = v) }) } })
    expect(w.findAll('button').map((b) => b.attributes('data-taste'))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'])
    expect(w.findAll('button').every((b) => b.classes('wkr-knopf') && b.attributes('data-ziel') === 'gross')).toBe(true)
    await w.find('[data-taste=","]').trigger('click')
    expect(w.find('[data-teil="ziffern-anzeige"]').attributes('data-lesbar')).toBe('nein')
    expect(w.find('[data-teil="ziffern-deutung"]').text()).toContain('so nicht lesbar')
    expect(w.find('[data-taste=","]').attributes('disabled')).toBeDefined()
    await w.find('[data-taste="⌫"]').trigger('click')
    for (const k of '83,45') await w.find(`[data-taste="${k}"]`).trigger('click')
    expect(wert).toBe('83,45')
    expect(w.find('[data-teil="ziffern-anzeige"]').text()).toBe('1:23,45')
    expect(w.find('[data-teil="ziffern-deutung"]').text()).toContain('= 1 min 23,45 s')
    expect(w.find('[data-teil="ziffern-getippt"]').text()).toBe('(getippt: 83,45)')
    await w.setProps({ modelValue: '45,6' })
    expect(w.find('[data-teil="ziffern-deutung"]').text()).toContain('= 45,60 s')
    w.unmount()
  })
})

describe('Zeit-Maske in der Übung (W5.4)', () => {
  it('Handy: Feld-Reiter, gesperrt bis jedes Feld fertig, „Keine Zeit“ mit Grund, Zeile mit allen Zeiten, Zuletzt mit Uhr', async () => {
    vi.useFakeTimers()
    const { q, w } = await zeitUebung()
    expect(w.find('[data-teil="zeiten"]').attributes('data-anordnung')).toBe('reiter')
    const felder = w.findAll('[data-action="zeit-feld"]')
    expect(felder.map((f) => f.attributes('data-feld'))).toEqual(['zeit1', 'zeit2', 'zeit3'])
    expect(felder[0].attributes('data-aktiv')).toBeDefined()
    expect(haupt(w).attributes('disabled')).toBeDefined()
    expect(haupt(w).text()).toBe('noch 3 Zeiten')

    await tippe(w, '83,45')
    expect(w.find('[data-action="zeit-feld"][data-feld="zeit1"]').attributes('data-stand')).toBe('zeit')
    expect(w.find('[data-action="zeit-feld"][data-feld="zeit1"] [data-teil="zeit-feld-wert"]').text()).toBe('1:23,45')
    // Kein Sprung von selbst (ZT3): Feld 1 bleibt aktiv.
    expect(w.find('[data-action="zeit-feld"][data-feld="zeit1"]').attributes('data-aktiv')).toBeDefined()
    await klick(w, '[data-action="zeit-feld"][data-feld="zeit2"]')
    await tippe(w, ',')
    expect(w.find('[data-action="zeit-feld"][data-feld="zeit2"]').attributes('data-stand')).toBe('unlesbar')
    expect(haupt(w).text()).toBe('noch 2 Zeiten')
    await tippe(w, '⌫1,2345')
    await klick(w, '[data-action="zeit-feld"][data-feld="zeit3"]')
    await klick(w, '[data-action="keine-zeit"]')
    expect(w.findAll('[data-action="keine-zeit-grund"]').map((b) => b.attributes('data-grund'))).toEqual(['anlage', 'nichtImZiel', 'anderes'])
    await klick(w, '[data-action="keine-zeit-grund"][data-grund="anlage"]')
    expect(w.find('[data-teil="keine-zeit-stand"]').text()).toContain('Zeit 3: keine Zeit – Zeitanlage ausgefallen')
    expect(w.find('[data-action="zeit-feld"][data-feld="zeit3"]').attributes('data-stand')).toBe('keine')
    expect(haupt(w).attributes('disabled')).toBeUndefined()
    expect(haupt(w).text()).toBe('Zeiten abschicken ✓')

    await klick(w, '[data-action="haupt"]')
    const z = q.zuletzt.value[0]
    expect([z.zellen, z.kz]).toEqual([{ zeit1: '83,45', zeit2: '1,2345', zeit3: '' }, { zeit3: 'anlage' }])
    await vi.advanceTimersByTimeAsync(5000)
    await nextTick()
    await klick(w, '[data-action="zuletzt"]')
    const zuletzt = w.find('[data-teil="zuletzt-liste"]').text()
    expect(zuletzt).toContain('Zeit 1: 1:23,45')
    expect(zuletzt).toContain('Zeit 3: keine Zeit')
  })

  it('„Keine Zeit“ aufheben macht das Feld wieder offen; eine Zeit ersetzt „keine Zeit“ nie still (erst aufheben)', async () => {
    const { w } = await zeitUebung()
    await klick(w, '[data-action="keine-zeit"]')
    await klick(w, '[data-action="keine-zeit-grund"][data-grund="nichtImZiel"]')
    expect(w.find('[data-teil="zeiten"] [data-teil="ziffern"]').exists()).toBe(false)
    await klick(w, '[data-action="keine-zeit-weg"]')
    expect(w.find('[data-action="zeit-feld"][data-feld="zeit1"]').attributes('data-stand')).toBe('offen')
    expect(w.find('[data-teil="zeiten"] [data-teil="ziffern"]').exists()).toBe(true)
  })

  it('Pad: Felder nebeneinander, das aktive umrandet', async () => {
    const { w } = await zeitUebung(1024, 768)
    expect(w.find('[data-teil="zeiten"]').attributes('data-anordnung')).toBe('nebeneinander')
    await klick(w, '[data-action="zeit-feld"][data-feld="zeit2"]')
    expect(w.findAll('.wkr-zeit-feld--aktiv').map((x) => x.attributes('data-feld'))).toEqual(['zeit2'])
  })
})

describe('Probe der Zeit-Liste (W5.4)', () => {
  it('„Tippe 83,45 ein“ → übrige Felder → Hauptknopf; ohne Quelle, nichts gesendet', async () => {
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'zeit', taktMs: 3_600_000, folgeMs: [0, 0] })
    quellen.push(q)
    const sicht = Object.values(q.sichten.value)[0]!
    const klasse = Object.keys(sicht.klassen).find((k) => sicht.klassen[k as ClassId]?.felder) as ClassId
    const aufbau = maskeFuer(sicht, klasse)!
    const w = mount(WkrProbe, { props: { aufbau, hand: 'rechts', uebung: true } })
    wrappers.push(w)
    expect(w.find('[data-teil="probe"]').attributes('data-schritt')).toBe('zeit')
    expect(w.find('[data-teil="probe-schritt"]').text()).toContain('Tippe bei „Zeit 1“ 83,45 ein')
    // Eine andere Zeit bringt den Schritt nicht weiter.
    await tippe(w, '84')
    expect(w.find('[data-teil="probe"]').attributes('data-schritt')).toBe('zeit')
    await tippe(w, '⌫⌫83,45')
    expect(w.find('[data-teil="probe"]').attributes('data-schritt')).toBe('zeitRest')
    await klick(w, '[data-action="zeit-feld"][data-feld="zeit2"]')
    await tippe(w, '83,4')
    await klick(w, '[data-action="zeit-feld"][data-feld="zeit3"]')
    await klick(w, '[data-action="keine-zeit"]')
    await klick(w, '[data-action="keine-zeit-grund"][data-grund="anderes"]')
    expect(w.find('[data-teil="probe"]').attributes('data-schritt')).toBe('haupt')
    expect(w.find('[data-action="haupt"]').text()).toBe('Zeiten abschicken ✓')
    await klick(w, '[data-action="haupt"]')
    expect(w.find('[data-teil="probe"]').attributes('data-schritt')).toBe('takt')
    expect(q.zuletzt.value).toEqual([])
  })
})
