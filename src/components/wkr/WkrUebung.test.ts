import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { oeffneUebung } from '../../geraete/uebung'
import type { Ablage } from '../../geraete/ablage'
import type { ErfassungsQuelle } from '../../geraete/erfassen'
import WkrGeraet from './WkrGeraet.vue'
import WkrUebung from './WkrUebung.vue'

/**
 * Übung: Kopf aus dem Bild nach dem Abschicken (Nutzer 24.11.2026, WKR_ANNAHMEN UK1–UK6): „Bei dem Header ‚So läuft
 * die Übung‘ und ‚ÜBUNG Tor X …‘ soll beim Klicken auf ‚Fehlerfrei/weiter‘ aus dem Screen rutschen, so dass der Block
 * mit der Startnummer am Bildschirmrand ist.“ Im Test-DOM rollt nichts wirklich – geprüft wird, WAS an den oberen Rand
 * soll (das erste Element nach dem Kopf) und wie (block start, Gleiten bzw. ohne Bewegung).
 */
const quellen: ErfassungsQuelle[] = []
const wrappers: VueWrapper[] = []
afterEach(() => {
  for (const w of wrappers.splice(0)) w.unmount()
  for (const q of quellen.splice(0)) q.stop()
  vi.restoreAllMocks()
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

/** Wohin gerollt wurde: das Element (this) und die Optionen je Aufruf. */
function rollSpion() {
  const aufrufe: { el: Element; o: ScrollIntoViewOptions | boolean | undefined }[] = []
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element, o?: ScrollIntoViewOptions | boolean) {
    aufrufe.push({ el: this, o })
  })
  return aufrufe
}

async function geraet(quelle: ErfassungsQuelle) {
  const w = mount(WkrGeraet, { attachTo: document.body, props: { quelle, ablage: ablage() } })
  wrappers.push(w)
  await nextTick()
  await nextTick()
  return w
}

async function haupt(w: VueWrapper): Promise<void> {
  await w.find('[data-action="haupt"]').trigger('click')
  await nextTick()
  await nextTick()
}

describe('Übung: Kopf nach dem Abschicken aus dem Bild (Nutzer 24.11.2026, UK1–UK6)', () => {
  it('WkrUebung → „Fehlerfrei“: das erste Element nach dem Kopf an den oberen Rand, gleitend; Erklärung und „ÜBUNG“ liegen darüber', async () => {
    fenster(390, 844)
    const rollen = rollSpion()
    const w = mount(WkrUebung, { attachTo: document.body, props: { ablage: ablage(), taktMs: 3_600_000 } })
    wrappers.push(w)
    await w.find('[data-action="uebung-start"]').trigger('click')
    await nextTick()
    await nextTick()
    expect(w.find('[data-teil="uebung-erklaerung"]').exists()).toBe(true)
    const kopf = w.find('[data-teil="wkr-kopf"]')
    expect(kopf.find('[data-teil="uebung"]').text()).toBe('ÜBUNG')
    // Vor dem Abschicken rollt nichts.
    expect(rollen).toHaveLength(0)
    await haupt(w)
    expect(rollen).toHaveLength(1)
    expect(rollen[0].el).toBe(kopf.element.nextElementSibling)
    expect(rollen[0].o).toEqual({ block: 'start', behavior: 'smooth' })
    // Ziel ist „Zuletzt“ (UK3) – „Rückgängig“ bleibt so sichtbar, die Karte steht direkt darunter.
    expect(rollen[0].el.getAttribute('data-teil')).toBe('zuletzt')
    // Die Erklärung und der Kopf stehen im Dokument davor (rollen also mit hinaus).
    const erklaerung = w.find('[data-teil="uebung-erklaerung"]').element
    expect(erklaerung.compareDocumentPosition(rollen[0].el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('nach dem Wechsel zum nächsten Start noch einmal ausgerichtet (UK2); „Bewegung reduzieren“ ohne Gleiten', async () => {
    vi.useFakeTimers()
    fenster(390, 844)
    const echt = window.matchMedia
    const still = () => {}
    window.matchMedia = ((media: string) => ({
      media,
      matches: media.includes('prefers-reduced-motion'),
      onchange: null,
      addEventListener: still,
      removeEventListener: still,
      addListener: still,
      removeListener: still,
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia
    try {
      const rollen = rollSpion()
      const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'tor5', taktMs: 3_600_000, folgeMs: [0, 0] })
      quellen.push(q)
      const w = await geraet(q)
      await haupt(w)
      expect(rollen.map((r) => r.o)).toEqual([{ block: 'start', behavior: 'auto' }])
      // Quittung der Übung, Overlay, Wechsel mit Blitz – danach noch einmal (ohne Bewegung).
      await vi.advanceTimersByTimeAsync(4000)
      await nextTick()
      expect(rollen.length).toBe(2)
      expect(rollen[1].o).toEqual({ block: 'start', behavior: 'auto' })
    } finally {
      window.matchMedia = echt
    }
  })

  it('im Übungstakt (nächster Start erst 2 s nach dem Abschicken): ausgerichtet, sobald die neue Karte steht; bis dahin hält die Maske ihre Höhe (UK5)', async () => {
    vi.useFakeTimers()
    fenster(390, 844)
    const rollen = rollSpion()
    // Höhe der Maske beim Abschicken (im Test-DOM sonst 0 = nichts zu halten).
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(900)
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'tor5', taktMs: 3_600_000, folgeMs: [2000, 2000] })
    quellen.push(q)
    const w = await geraet(q)
    const erste = w.find('[data-teil="karte"]').text()
    await haupt(w)
    expect(rollen).toHaveLength(1)
    const maske = () => w.find('[data-teil="maske"]').element as HTMLElement
    expect(maske().style.minHeight).toBe('900px')
    // Overlay vorbei, der nächste Start ist noch nicht da: „Kein Boot unterwegs.“, nichts gerollt, Höhe gehalten.
    await vi.advanceTimersByTimeAsync(1500)
    await nextTick()
    expect(w.find('[data-teil="karte"]').exists()).toBe(false)
    expect(w.find('[data-teil="ruhe"]').attributes('data-ruhe')).toBe('leer')
    expect(rollen).toHaveLength(1)
    expect(maske().style.minHeight).toBe('900px')
    // Die neue Karte kommt: jetzt noch einmal an den Rand („Zuletzt“ über der Karte), Höhe wieder frei.
    await vi.advanceTimersByTimeAsync(1000)
    await nextTick()
    await nextTick()
    expect(w.find('[data-teil="karte"]').text()).not.toBe(erste)
    expect(rollen).toHaveLength(2)
    expect(rollen[1].el.getAttribute('data-teil')).toBe('zuletzt')
    expect(maske().style.minHeight).toBe('')
    // Danach rollt nichts mehr von selbst (erst wieder nach dem nächsten Abschicken).
    await vi.advanceTimersByTimeAsync(10_000)
    expect(rollen).toHaveLength(2)
  })

  it('Pad mit eigener Seitenspalte rechts: bis zur Oberkante der Maske – der Kopf bleibt, die Seitenspalte ganz zu sehen (UK4)', async () => {
    fenster(1024, 768)
    const rollen = rollSpion()
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'tor5', taktMs: 3_600_000, folgeMs: [0, 0] })
    quellen.push(q)
    const w = await geraet(q)
    const maske = w.find('[data-teil="maske"]')
    expect(maske.attributes('data-seite')).toBe('rechts')
    await haupt(w)
    expect(rollen).toHaveLength(1)
    expect(rollen[0].el).toBe(maske.element)
  })

  it('nicht auf dem Pad mit mehreren Spalten (ganzer Steg: Ablegen und Anlegen nebeneinander)', async () => {
    fenster(1024, 768)
    const rollen = rollSpion()
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'steg', taktMs: 3_600_000, folgeMs: [0, 0] })
    quellen.push(q)
    const w = await geraet(q)
    expect(w.find('[data-teil="wkr-geraet"]').attributes('data-spalten')).toBe('2')
    await w.find('[data-steg-teil="ab"] [data-action="haupt"]').trigger('click')
    await nextTick()
    await nextTick()
    expect(rollen).toHaveLength(0)
  })

  it('Knoten am Tisch: nach „Alle richtig“ steht der Block „Nr. · Klasse · offen“ am Rand (UK6)', async () => {
    fenster(390, 844)
    const rollen = rollSpion()
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'knoten', folgeMs: [0, 0] })
    quellen.push(q)
    const w = await geraet(q)
    expect(w.find('[data-maske="pruefliste"]').exists()).toBe(true)
    expect(rollen).toHaveLength(0)
    await haupt(w)
    expect(rollen).toHaveLength(1)
    const kopf = w.find('[data-maske="pruefliste"] [data-teil="wkr-kopf"]')
    expect(rollen[0].el).toBe(kopf.element.nextElementSibling)
    expect(rollen[0].el.querySelector('[data-teil="pruef-kopf"]')).not.toBeNull()
    expect(rollen[0].o).toEqual({ block: 'start', behavior: 'smooth' })
  })

  it('die echte Maske (keine Übung) rollt nicht – Verbindung und „Keine Bestätigung“ stehen im Kopf', async () => {
    fenster(390, 844)
    const rollen = rollSpion()
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'tor5', taktMs: 3_600_000, folgeMs: [0, 0] })
    quellen.push(q)
    const w = await geraet({ ...q, uebung: false })
    await haupt(w)
    expect(w.find('[data-teil="uebertragen"]').exists()).toBe(true)
    expect(rollen).toHaveLength(0)
  })
})
