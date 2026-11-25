import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { oeffneUebung } from '../../geraete/uebung'
import { liesAnsicht, mitMaskenWahl, schreibeAnsicht, type Ablage } from '../../geraete/ablage'
import type { ErfassungsQuelle } from '../../geraete/erfassen'
import type { MaskenWahl } from '../../wkr/maskenWahl'
import WkrGeraet from './WkrGeraet.vue'
import WkrTabelle from './WkrTabelle.vue'
import { configFor } from '../../config/konfig'
import { leererEntwurf, maskeFuer } from '../../wkr/maske'
import { maskenJeKlasse, type ListenSicht } from '../../wkr/sicht'
import { tabellenSpalten } from '../../wkr/tabelle'
import { defineComponent, h, ref } from 'vue'

/**
 * Maske „Tabelle“ für Geübte (W5.5, Plan docs/plan-wkr-w5.md §8, 22.11.2026, TB1–TB5) über die Übung ohne Netz: Zeile
 * des Bogens, Enter = nächste Zelle, Enter in der letzten Zelle = Abschicken (Overlay/Takt wie die Knöpfe), Fehler je
 * Zelle sperren, „Korrigieren“ an einer gesendeten Zeile mit Rückfrage alt → neu, auf dem Handy ausgegraut (TB1).
 * Keine festen Pausen: Die Übung quittiert über Zeitgeber, hier mit Fake-Uhr weitergedreht.
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

/** Übung einer Liste mit gewählter Maske (wie WkrUebung: Wahl unter dem Übungsraum). */
async function uebung(typeId: string, maske: MaskenWahl, breite = 1024, hoehe = 768) {
  fenster(breite, hoehe)
  const q = oeffneUebung({ regelwerk: 'dm-2026', typeId, taktMs: 3_600_000, folgeMs: [0, 0] })
  quellen.push(q)
  const a = ablage()
  for (const l of q.listen.value) schreibeAnsicht(mitMaskenWahl(liesAnsicht(a), null, l.liste, maske), a)
  const w = mount(WkrGeraet, { attachTo: document.body, props: { quelle: q, ablage: a } })
  wrappers.push(w)
  await nextTick()
  await nextTick()
  return { q, w }
}

const eingaben = (w: VueWrapper) => w.findAll('[data-teil="tabelle-aktiv"] input')
const feldVon = (w: VueWrapper, feld: string) => w.find(`[data-teil="tabelle-aktiv"] [data-feld="${feld}"] input`)
async function tippe(w: VueWrapper, feld: string, text: string): Promise<void> {
  await feldVon(w, feld).setValue(text)
}
async function enter(w: VueWrapper, feld: string): Promise<void> {
  await feldVon(w, feld).trigger('keydown', { key: 'Enter' })
  await nextTick()
}
const haupt = (w: VueWrapper) => w.find('[data-action="haupt"]')

describe('Maske „Tabelle“ (W5.5)', () => {
  it('Zeile wie der Bogen: Kopf, aktive Zeile mit Fokus, nächste Starts; DISQ entfällt (Buchstaben in der Zelle)', async () => {
    const { w } = await uebung('tor5', 'text')
    expect(w.find('.wkr-maske').attributes('data-maske')).toBe('text')
    expect(w.find('[data-teil="tabelle"]').exists()).toBe(true)
    const felder = w.findAll('[data-teil="tabelle-aktiv"] [data-feld]').map((x) => x.attributes('data-feld'))
    expect(felder[0]).toBe('katalog:tor5')
    expect(document.activeElement).toBe(eingaben(w)[0].element)
    expect(w.find('[data-action="disq"]').exists()).toBe(false)
    expect(w.findAll('[data-teil="tabelle-kopf"]').length).toBeGreaterThan(0)
  })

  // „1, 2x20“ statt „2x1, 20“ seit der Höchstzahl je Code (Nutzer 24.11.2026, CM5): Code 1 an Tor 5 höchstens 1×.
  it('Enter springt in die nächste Zelle; Enter in der letzten schickt ab – die Zellen genau wie in der Tabelle, „1, 2x20“', async () => {
    vi.useFakeTimers()
    const { q, w } = await uebung('tor5', 'text')
    const felder = eingaben(w).map((x) => x.element.closest('[data-feld]')!.getAttribute('data-feld')!)
    await tippe(w, felder[0], '20 1 20')
    await enter(w, felder[0])
    // Beim Verlassen steht der Wert so da, wie er hinausgeht.
    expect((feldVon(w, felder[0]).element as HTMLInputElement).value).toBe('1, 2x20')
    expect(document.activeElement).toBe(eingaben(w)[1]?.element ?? eingaben(w)[0].element)
    expect(haupt(w).text()).toContain('Abschicken')
    const vorher = q.zuletzt.value.length
    for (const f of felder.slice(1)) await enter(w, f)
    if (felder.length === 1) await enter(w, felder[0])
    expect(q.zuletzt.value.length).toBe(vorher + 1)
    expect(q.zuletzt.value[0].zellen['katalog:tor5']).toBe('1, 2x20')
    // Overlay wie bei den Knöpfen.
    expect(w.find('[data-teil="uebertragen"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    await nextTick()
    // Die gesendete Zeile steht oben mit ihrem Zeichen, darunter die neue aktive Zeile.
    const gesendet = w.findAll('[data-teil="tabelle-gesendet"]')
    expect(gesendet.length).toBe(1)
    expect(gesendet[0].text()).toContain('1, 2x20')
    expect(['✓', '↑']).toContain(gesendet[0].find('[data-teil="tabelle-zeichen"]').text())
    expect((feldVon(w, 'katalog:tor5').element as HTMLInputElement).value).toBe('')
  })

  it('Fehler je Zelle: unbekannter Code → Satz an der Zelle, Hauptknopf gesperrt „1 Zelle prüfen“, Enter schickt nicht', async () => {
    const { q, w } = await uebung('tor5', 'text')
    const felder = eingaben(w).map((x) => x.element.closest('[data-feld]')!.getAttribute('data-feld')!)
    await tippe(w, 'katalog:tor5', '999')
    // Beim Tippen noch kein Satz (sonst stünde bei „2x“ schon einer), erst nach dem Verlassen.
    expect(w.find('[data-teil="tabelle-fehler"]').exists()).toBe(false)
    expect(haupt(w).attributes('disabled')).toBeDefined()
    expect(haupt(w).text()).toBe('1 Zelle prüfen')
    await feldVon(w, 'katalog:tor5').trigger('blur')
    expect(w.find('[data-feld="katalog:tor5"]').attributes('data-fehler')).toBe('code-unbekannt')
    expect(w.find('[data-teil="tabelle-fehler"]').text()).toBe('Kein Fehlercode dieser Liste')
    const vorher = q.zuletzt.value.length
    await enter(w, felder.at(-1)!)
    expect(q.zuletzt.value.length).toBe(vorher)
    // Der Fokus steht in der Zelle mit dem Fehler.
    expect(document.activeElement).toBe(feldVon(w, 'katalog:tor5').element)
    await tippe(w, 'katalog:tor5', '1')
    expect(haupt(w).attributes('disabled')).toBeUndefined()
  })

  it('Korrektur in der Tabelle: „Korrigieren“ an der Zeile → bearbeitbar an ihrem Platz → Enter in der letzten Zelle fragt alt → neu', async () => {
    vi.useFakeTimers()
    const { q, w } = await uebung('tor5', 'text')
    const felder = eingaben(w).map((x) => x.element.closest('[data-feld]')!.getAttribute('data-feld')!)
    await tippe(w, 'katalog:tor5', '1')
    await enter(w, felder.at(-1)!)
    await vi.advanceTimersByTimeAsync(5000)
    await nextTick()
    const z = q.zuletzt.value[0].z
    await w.find(`[data-teil="tabelle-gesendet"][data-z="${z}"] [data-action="tabelle-korrigieren"]`).trigger('click')
    await nextTick()
    const aktiv = w.find('[data-teil="tabelle-aktiv"]')
    expect(aktiv.attributes('data-z')).toBe(String(z))
    expect(w.find(`[data-teil="tabelle-gesendet"][data-z="${z}"]`).exists()).toBe(false)
    expect((feldVon(w, 'katalog:tor5').element as HTMLInputElement).value).toBe('1')
    await tippe(w, 'katalog:tor5', '1 20')
    await enter(w, felder.at(-1)!)
    const d = w.find('[data-dialog="wkr-korrektur"]')
    expect(d.exists()).toBe(true)
    expect(d.find('[data-teil="neu"]').text()).toContain('1, 20')
    await w.find('[data-action="korrektur-ja"]').trigger('click')
    await nextTick()
    const k = q.zuletzt.value[0]
    expect([k.korrektur, k.zellen['katalog:tor5']]).toEqual([true, '1, 20'])
    expect(w.find('[data-teil="tabelle-aktiv"]').attributes('data-z')).toBeUndefined()
  })

  it('Esc bricht die Korrektur ab', async () => {
    vi.useFakeTimers()
    const { q, w } = await uebung('tor5', 'text')
    const felder = eingaben(w).map((x) => x.element.closest('[data-feld]')!.getAttribute('data-feld')!)
    await enter(w, felder.at(-1)!)
    await vi.advanceTimersByTimeAsync(5000)
    await nextTick()
    await w.find(`[data-teil="tabelle-gesendet"][data-z="${q.zuletzt.value[0].z}"] [data-action="tabelle-korrigieren"]`).trigger('click')
    await nextTick()
    await feldVon(w, 'katalog:tor5').trigger('keydown', { key: 'Escape' })
    await nextTick()
    expect(w.find('[data-teil="tabelle-aktiv"]').attributes('data-z')).toBeUndefined()
    expect(w.findAll('[data-teil="tabelle-gesendet"]').length).toBe(1)
  })

  it('Bojen als Punkte bzw. „5, J“ (gate135, BZ6 22.11.2026): „3“ ist ein Fehler, „j5“ wird „5, J“', async () => {
    vi.useFakeTimers()
    const { q, w } = await uebung('gate135', 'text')
    const boje = w.findAll('[data-teil="tabelle-aktiv"] [data-feld]').map((x) => x.attributes('data-feld')!).find((f) => f.startsWith('t3a|hin'))!
    await tippe(w, boje, '3')
    await feldVon(w, boje).trigger('blur')
    expect(w.find(`[data-teil="tabelle-aktiv"] [data-feld="${boje}"]`).attributes('data-fehler')).toBe('boje-punkte')
    await tippe(w, boje, 'j5')
    await feldVon(w, boje).trigger('blur')
    expect((feldVon(w, boje).element as HTMLInputElement).value).toBe('5, J')
    await haupt(w).trigger('click')
    expect(q.zuletzt.value[0].zellen[boje]).toBe('5, J')
  })

  it('TB1: auf dem Handy ist „Tabelle“ unter „Mehr“ ausgegraut und eine Wahl zeigt die Knöpfe', async () => {
    const { w } = await uebung('tor5', 'text', 390, 844)
    expect(w.find('[data-teil="tabelle"]').exists()).toBe(false)
    expect(w.find('.wkr-maske').attributes('data-maske')).toBe('knoepfe')
    await w.find('[data-action="mehr"]').trigger('click')
    const knopf = w.find('[data-action="maske"][data-maske="text"]')
    expect(knopf.exists()).toBe(true)
    expect(knopf.attributes('disabled')).toBeDefined()
    expect(knopf.text()).toBe('Tabelle (nur Pad)')
  })

  it('zwei Tabellen nebeneinander (Pad): ein neuer Start in B zieht den Fokus nicht aus A (Prüfbefund 22.11.2026)', async () => {
    const DM = configFor({ regelwerk: 'dm-2026' })
    const sicht = { klassen: maskenJeKlasse(DM, DM, 'tor5', ['1'], false) } as ListenSicht
    const aufbau = maskeFuer(sicht, '1')!
    const spalten = tabellenSpalten(sicht, '1', aufbau, undefined)
    const tabelle = (startNr: string) =>
      h(WkrTabelle, { key: startNr, spalten, aufbau, entwurf: leererEntwurf(), startNr, klasse: '1', gesperrt: sperreB.value && startNr !== '11', gesendet: [], korrektur: null, naechste: [] })
    const startB = ref('21')
    const sperreB = ref(false)
    const Pad = defineComponent({
      setup: () => () => h('div', [h('div', { class: 'wkr-spalte', 'data-liste': 'A' }, [tabelle('11')]), h('div', { class: 'wkr-spalte', 'data-liste': 'B' }, [tabelle(startB.value)])]),
    })
    const w = mount(Pad, { attachTo: document.body })
    wrappers.push(w)
    await nextTick()
    const inA = () => w.find('[data-liste="A"] input').element as HTMLInputElement
    const inB = () => w.find('[data-liste="B"] input').element as HTMLInputElement
    inA().focus()
    expect(document.activeElement).toBe(inA())
    // Neuer Start in B (neuer :key, neu eingehängt): Fokus bleibt in A.
    startB.value = '22'
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(inA())
    // Ende der Sperre in B ebenso.
    sperreB.value = true
    await nextTick()
    sperreB.value = false
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(inA())
    // Ohne Fokus irgendwo (nach dem eigenen Abschicken) nimmt B ihn wie bisher.
    inA().blur()
    startB.value = '23'
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(inB())
  })
})
