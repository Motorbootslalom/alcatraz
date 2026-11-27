import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { oeffneUebung } from '../../geraete/uebung'
import type { Ablage } from '../../geraete/ablage'
import type { ErfassungsQuelle } from '../../geraete/erfassen'
import WkrGeraet from './WkrGeraet.vue'
import WkrUebung from './WkrUebung.vue'
import { wachHinweisWeg } from './gedaechtnis'

/**
 * Übung: Erklärung aus dem Bild nach dem Abschicken (Nutzer 24.11.2026: „Bei dem Header ‚So läuft die Übung‘ und
 * ‚ÜBUNG Tor X …‘ soll beim Klicken auf ‚Fehlerfrei/weiter‘ aus dem Screen rutschen …“) – seit 26.11.2026 (R11-14,
 * WKR_ANNAHMEN UK7) bleibt der Kopf: „Oh, dann besser wieder raus damit. Ich dachte, es ist eine extra Zeile.“ Nur die
 * Erklärung geht oben hinaus, an den Rand kommt die Spalte der Liste (also der Kopf mit „ÜBUNG“). Im Test-DOM rollt
 * nichts wirklich – geprüft wird, WAS an den oberen Rand soll und wie (block start, Gleiten bzw. ohne Bewegung).
 * Dazu „↩ Rückgängig“ im Fuß (R11-30 (2)): Pfeil nach links als Zeichnung.
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

/** Die Spalte der Liste – Ziel des Rollens (UK7); der Kopf steht darin zuoberst. */
const spalteVon = (el: Element) => el.closest('.wkr-spalte')

describe('Übung: Erklärung nach dem Abschicken aus dem Bild, der Kopf bleibt (Nutzer 26.11.2026, R11-14, UK7, UK2, UK5, UK6)', () => {
  it('WkrUebung → „Fehlerfrei“: die Spalte mit dem Kopf („ÜBUNG“) an den oberen Rand, gleitend; nur die Erklärung liegt darüber', async () => {
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
    expect(rollen[0].el.classList.contains('wkr-spalte')).toBe(true)
    expect(rollen[0].el).toBe(spalteVon(kopf.element))
    expect(rollen[0].o).toEqual({ block: 'start', behavior: 'smooth' })
    // Der Kopf steht IN der Spalte ganz oben (bleibt also am Rand stehen), „Zuletzt“ und die Karte darunter.
    const maske = rollen[0].el.querySelector('[data-teil="maske"]')!
    expect(rollen[0].el.firstElementChild).toBe(maske)
    expect(maske.querySelector('[data-teil="wkr-kopf"]')).toBe(kopf.element)
    expect(kopf.element.compareDocumentPosition(w.find('[data-teil="karte"]').element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Nur die Erklärung steht im Dokument davor (rollt also hinaus) – nicht in der Spalte.
    const erklaerung = w.find('[data-teil="uebung-erklaerung"]').element
    expect(erklaerung.compareDocumentPosition(rollen[0].el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(rollen[0].el.contains(erklaerung)).toBe(false)
  })

  it('nach dem Wechsel zum nächsten Start noch einmal ausgerichtet (UK5); „Bewegung reduzieren“ ohne Gleiten', async () => {
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
    // Die neue Karte kommt: jetzt noch einmal an den Rand (die Spalte samt Kopf), Höhe wieder frei.
    await vi.advanceTimersByTimeAsync(1000)
    await nextTick()
    await nextTick()
    expect(w.find('[data-teil="karte"]').text()).not.toBe(erste)
    expect(rollen).toHaveLength(2)
    expect(rollen[1].el).toBe(spalteVon(maske()))
    expect(maske().style.minHeight).toBe('')
    // Danach rollt nichts mehr von selbst (erst wieder nach dem nächsten Abschicken).
    await vi.advanceTimersByTimeAsync(10_000)
    expect(rollen).toHaveLength(2)
  })

  it('Pad mit eigener Seitenspalte rechts: ebenso die Spalte – der Kopf bleibt, die Seitenspalte ganz zu sehen (UK4, bestätigt R11-30 (8))', async () => {
    fenster(1024, 768)
    const rollen = rollSpion()
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'tor5', taktMs: 3_600_000, folgeMs: [0, 0] })
    quellen.push(q)
    const w = await geraet(q)
    const maske = w.find('[data-teil="maske"]')
    expect(maske.attributes('data-seite')).toBe('rechts')
    await haupt(w)
    expect(rollen).toHaveLength(1)
    expect(rollen[0].el).toBe(spalteVon(maske.element))
    expect(rollen[0].el.contains(maske.find('[data-teil="seite"]').element)).toBe(true)
  })

  it('nicht auf dem Pad mit mehreren Spalten (ganzer Steg: Ablegen und Anlegen nebeneinander; UK2, bestätigt R11-30 (8))', async () => {
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

  it('Knoten am Tisch: nach „Alle richtig“ steht der Kopf am Rand, darunter der Block „Nr. · Klasse · offen“ (UK6 seit R11-14)', async () => {
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
    expect(rollen[0].el).toBe(spalteVon(kopf.element))
    expect(rollen[0].el.querySelector('[data-teil="wkr-kopf"]')).toBe(kopf.element)
    expect(rollen[0].el.querySelector('[data-teil="pruef-kopf"]')).not.toBeNull()
    expect(rollen[0].el.contains(w.find('[data-teil="uebung-erklaerung"]').element)).toBe(false)
    expect(rollen[0].o).toEqual({ block: 'start', behavior: 'smooth' })
  })

  it('der Hinweis „Bildschirm kann ausgehen“ steht unter der Erklärung und bleibt über dem Kopf stehen (Prüfbefund 27.11.2026, UK7)', async () => {
    fenster(390, 844)
    wachHinweisWeg.weg = false
    for (const typeId of ['tor5', 'knoten']) {
      const rollen = rollSpion()
      const q = oeffneUebung({ regelwerk: 'dm-2026', typeId, taktMs: 3_600_000, folgeMs: [0, 0] })
      quellen.push(q)
      const w = mount(WkrGeraet, { attachTo: document.body, props: { quelle: q, ablage: ablage(), bildschirmKannAus: true } })
      wrappers.push(w)
      await nextTick()
      await nextTick()
      const erklaerung = w.find('[data-teil="uebung-erklaerung"]').element
      const band = w.find('[data-teil="wach-hinweis"]').element
      const kopf = w.find('[data-teil="wkr-kopf"]').element
      // Folge im Dokument: Erklärung → Band → Spalte mit dem Kopf.
      expect(erklaerung.compareDocumentPosition(band) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(band.compareDocumentPosition(kopf) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      await haupt(w)
      // An den Rand kommt das Band: Nur die Erklärung geht hinaus, Band und Kopf bleiben zu sehen.
      expect(rollen.map((r) => r.el)).toEqual([band])
      vi.restoreAllMocks()
    }
    // Ausgeblendet: wieder die Spalte mit dem Kopf.
    const rollen = rollSpion()
    const q = oeffneUebung({ regelwerk: 'dm-2026', typeId: 'tor5', taktMs: 3_600_000, folgeMs: [0, 0] })
    quellen.push(q)
    const w = mount(WkrGeraet, { attachTo: document.body, props: { quelle: q, ablage: ablage(), bildschirmKannAus: true } })
    wrappers.push(w)
    await nextTick()
    await w.find('[data-action="wach-ausblenden"]').trigger('click')
    await nextTick()
    expect(w.find('[data-teil="wach-hinweis"]').exists()).toBe(false)
    await haupt(w)
    expect(rollen).toHaveLength(1)
    expect(rollen[0].el).toBe(spalteVon(w.find('[data-teil="wkr-kopf"]').element))
    wachHinweisWeg.weg = false
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

describe('„↩ Rückgängig“ im Fuß: Pfeil nach links (Nutzer 26.11.2026, R11-30 (2))', () => {
  it('der Pfeil ist eine Zeichnung (für Vorleser stumm), der Text nur „Rückgängig“ bzw. „Undo“ – kein Schriftzeichen, das als Emoji käme', async () => {
    fenster(390, 844)
    for (const [regelwerk, text] of [
      ['dm-2026', 'Rückgängig'],
      ['uim-2026', 'Undo'],
    ] as const) {
      const q = oeffneUebung({ regelwerk, typeId: 'tor5', taktMs: 3_600_000, folgeMs: [0, 0] })
      quellen.push(q)
      const w = await geraet(q)
      const knopf = w.find('[data-teil="fuss"] [data-action="zurueck"]')
      expect(knopf.text()).toBe(text)
      expect(knopf.text()).not.toMatch(/[↶↩←]/)
      const pfeil = knopf.find('svg[data-teil="pfeil-links"]')
      expect(pfeil.exists()).toBe(true)
      expect(pfeil.classes()).toContain('wkr-pfeil')
      expect(pfeil.attributes('aria-hidden')).toBe('true')
      // Pfeil und Wort sind EIN Flex-Element (Prüfung 27.11.2026): sonst nimmt der Pfeil dem Wort die Breite, und
      // „Rückgängig“ bricht auf dem Handy mitten im Wort um (gemessen in Chromium, happy-dom kennt kein Layout).
      expect(knopf.element.children).toHaveLength(1)
      const huelle = knopf.find('.wkr-mit-pfeil')
      expect(huelle.element.firstElementChild?.tagName.toLowerCase()).toBe('svg')
      expect(huelle.text()).toBe(text)
      // Die Spitze zeigt nach links: der Pfad beginnt mit dem Winkel um den Punkt ganz links (x = 4), der Haken ist rechts.
      expect(pfeil.find('path').attributes('d')).toMatch(/^M8\.5 11\.5 4 16l4\.5 4\.5M4 16h/)
      // Die Leiste „Zuletzt“ hat nach dem Abschicken ihr eigenes „Rückgängig“ (G8) – ohne Zeichen.
      await haupt(w)
      expect(w.find('[data-action="rueckgaengig"]').text()).toBe(text)
      expect(w.find('[data-action="rueckgaengig"] svg').exists()).toBe(false)
    }
  })
})
