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
 * erfundene Starter): Nummer über WkrZiffern, Kopf Nr./Klasse/offen, ✓ / ✗ · 5 je Knoten, danach leeres Nummernfeld
 * ohne Takt (kein Overlay), Pad mit offenen Nummern. Seit 22.11.2026 (R8-27/R8-31/R8-32): Vorschlag (KN9), Hauptknopf
 * „Alle richtig“/„Rest richtig“ (KN10), Rückfrage vor der Korrektur einer erfassten Nummer (KN11).
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

describe('WkrPruefliste in der Übung (KN7/KN8, umgebaut 22.11.2026 KN9–KN11)', () => {
  it('Nummer → Klasse und Knoten; Hauptknopf „Alle richtig“ → „Rest richtig“ → „Abschicken“; danach leeres Feld, kein Overlay', async () => {
    const { q, w } = await knoten()
    expect(w.find('[data-maske="pruefliste"]').exists()).toBe(true)
    // Keine Probe und keine Starterkarte am Tisch.
    expect(w.find('[data-teil="probe"]').exists()).toBe(false)
    expect(w.find('[data-teil="pruef-offen"]').text()).toBe(`offen ${WKR_ANNAHMEN.uebungStarts} / ${WKR_ANNAHMEN.uebungStarts}`)
    // KN12: der Vorschlag ist vorbelegt – Hauptknopf gleich aktiv.
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. 1')
    expect(w.find('[data-action="haupt"]').text()).toBe('✓ Alle richtig')
    await tippe(w, '7')
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. 7')
    expect(w.find('[data-teil="pruef-klasse"]').text()).toMatch(/^Klasse /)
    const zeilen = w.findAll('[data-teil="pruef-knoten"] li')
    expect(zeilen).toHaveLength(5)
    // KN10: nichts gesetzt → „Alle richtig“, aktiv; teils gesetzt → „Rest richtig“ mit Summe.
    expect(w.find('[data-action="haupt"]').text()).toBe('✓ Alle richtig')
    expect(w.find('[data-action="haupt"]').attributes('disabled')).toBeUndefined()
    for (const z of zeilen.slice(0, 3)) await z.find('[data-action="pruef-ok"]').trigger('click')
    expect(w.find('[data-action="haupt"]').text()).toBe('✓ Rest richtig · Σ 0')
    await zeilen[3].find('[data-action="pruef-ok"]').trigger('click')
    await zeilen[4].find('[data-action="pruef-fehler"]').trigger('click')
    expect(zeilen[4].attributes('data-wahl')).toBe('fehler')
    expect(w.find('[data-action="haupt"]').text()).toBe('Abschicken · Σ 5')
    await klick(w, '[data-action="haupt"]')
    // KN8: kein Takt – das Feld ist sofort leer, kein Overlay, die Rückmeldung steht klein darunter.
    expect(w.find('[data-teil="uebertragen"]').exists()).toBe(false)
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. 8')
    expect(w.find('[data-action="pruef-vorschlag"]').text()).toMatch(/^Nächster: 8 /)
    expect(w.find('[data-teil="pruef-letzte"]').text()).toMatch(/^Zuletzt: 7 /)
    expect(Object.values(q.zuletzt.value[0].zellen).filter((x) => x !== '')).toEqual(['5'])
    expect(w.find('[data-teil="pruef-offen"]').text()).toBe(`offen ${WKR_ANNAHMEN.uebungStarts - 1} / ${WKR_ANNAHMEN.uebungStarts}`)
  })

  it('„Rest richtig“ setzt nur die offenen auf ✓ und schickt ab – das ✗ bleibt (KN10)', async () => {
    const { q, w } = await knoten()
    await tippe(w, '4')
    await w.findAll('[data-teil="pruef-knoten"] li')[1].find('[data-action="pruef-fehler"]').trigger('click')
    expect(w.find('[data-action="haupt"]').text()).toBe('✓ Rest richtig · Σ 5')
    await klick(w, '[data-action="haupt"]')
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. 5')
    expect(Object.values(q.zuletzt.value[0].zellen).filter((x) => x !== '')).toEqual(['5'])
    // „Alle richtig“ ohne einen Tipp: eine Zeile ohne Fehler.
    await tippe(w, '6')
    await klick(w, '[data-action="haupt"]')
    expect(q.zuletzt.value[0].s).not.toBe(q.zuletzt.value[1].s)
    expect(Object.values(q.zuletzt.value[0].zellen).filter((x) => x !== '')).toEqual([])
  })

  it('Vorschlag (KN9): leeres Feld zeigt den nächsten offenen; Beispiel des Nutzers 8 → 9, 10 → 11, 9 → 11', async () => {
    const { w } = await knoten()
    const vorschlag = () => w.find('[data-action="pruef-vorschlag"]')
    expect(vorschlag().text()).toMatch(/^Nächster: 1 \(Klasse .+\)$/)
    // Antippen übernimmt; dann ist kein Vorschlag mehr da.
    await vorschlag().trigger('click')
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. 1')
    expect(vorschlag().exists()).toBe(false)
    await klick(w, '[data-action="haupt"]')
    expect(vorschlag().text()).toMatch(/^Nächster: 2 /)
    const schicke = async (nr: string) => {
      await tippe(w, nr)
      await klick(w, '[data-action="haupt"]')
    }
    await schicke('8')
    expect(vorschlag().text()).toMatch(/^Nächster: 9 /)
    await schicke('10')
    expect(vorschlag().text()).toMatch(/^Nächster: 11 /)
    await schicke('9')
    expect(vorschlag().text()).toMatch(/^Nächster: 11 /)
    // Eintippen ersetzt den Vorschlag.
    await tippe(w, '1')
    expect(vorschlag().exists()).toBe(false)
  })

  it('Vorschlag vorbelegt (KN12, Prüfbefund 22.11.2026): „Alle richtig“ mit einem Tipp je Starter, ein ✗ ohne Nummer zu tippen', async () => {
    const { q, w } = await knoten()
    // Drei fehlerfreie Starter: je ein Tipp auf den Hauptknopf.
    for (const n of ['1', '2', '3']) {
      expect(w.find('[data-teil="pruef-nr"]').text()).toBe(`Nr. ${n}`)
      expect(w.find('[data-action="haupt"]').text()).toBe('✓ Alle richtig')
      await klick(w, '[data-action="haupt"]')
    }
    expect(q.zuletzt.value.map((z) => Object.values(z.zellen).filter((x) => x !== '').length)).toEqual([0, 0, 0])
    // Nr. 4 mit einem falschen Knoten: nur das ✗, dann „Rest richtig“.
    expect(w.find('[data-teil="pruef-knoten"]').exists()).toBe(true)
    await w.findAll('[data-teil="pruef-knoten"] li')[2].find('[data-action="pruef-fehler"]').trigger('click')
    await klick(w, '[data-action="haupt"]')
    expect(Object.values(q.zuletzt.value[0].zellen).filter((x) => x !== '')).toEqual(['5'])
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. 5')
    // Eintippen ersetzt den Vorschlag.
    await tippe(w, '9')
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. 9')
  })

  it('erfasste Nummer fragt erst (KN11): Nein → Feld leer, Vorschlag bleibt; Ja → Korrektur mit den gesendeten Werten', async () => {
    const { q, w } = await knoten()
    await tippe(w, '3')
    await klick(w, '[data-action="haupt"]')
    await tippe(w, '3')
    expect(w.find('[data-teil="pruef-frage"]').text()).toContain('Nr. 3 ist schon erfasst – korrigieren?')
    expect(w.find('[data-teil="pruef-knoten"]').exists()).toBe(false)
    expect(w.find('[data-action="haupt"]').attributes('disabled')).toBeDefined()
    await klick(w, '[data-action="pruef-frage-nein"]')
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. 4')
    expect(w.find('[data-action="pruef-vorschlag"]').text()).toMatch(/^Nächster: 4 /)
    // Wieder 3 → wieder die Frage; Ja → Korrektur.
    await tippe(w, '3')
    await klick(w, '[data-action="pruef-frage-ja"]')
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

  it('Weitertippen nach einer erfassten Teilnummer geht ohne Antwort („1“ → „12“, KN11)', async () => {
    const { w } = await knoten()
    await tippe(w, '1')
    await klick(w, '[data-action="haupt"]')
    await tippe(w, '1')
    expect(w.find('[data-teil="pruef-frage"]').exists()).toBe(true)
    await tippe(w, '2')
    expect(w.find('[data-teil="pruef-nr"]').text()).toBe('Nr. 12')
    expect(w.find('[data-teil="pruef-frage"]').exists()).toBe(false)
    expect(w.find('[data-action="haupt"]').text()).toBe('✓ Alle richtig')
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

describe('Übung: Klasse vorziehen (Nutzer 22.11.2026, R7-45, Y4)', () => {
  it('Knoten: aufklappbar ganz unten unter dem Fuß (Y5); Wahl → Vorschlag auf den ersten offenen der Klasse', async () => {
    const { q, w } = await knoten()
    const liste = q.listen.value[0].liste
    const letzte = q.bestand.value[liste].at(-1)!
    expect(w.find('[data-teil="pruef-vorziehen"]').exists()).toBe(true)
    // Y5 (Nutzer 24.11.2026): ganz unten – unter dem Fuß mit dem Hauptknopf, nach den offenen Nummern.
    const vorziehen = w.find('[data-teil="pruef-vorziehen"]').element
    const fuss = w.find('[data-maske="pruefliste"] [data-teil="fuss"]').element
    expect(fuss.compareDocumentPosition(vorziehen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(vorziehen.parentElement!.lastElementChild).toBe(vorziehen)
    await klick(w, `[data-action="uebung-vorziehen"][data-klasse="${letzte.klasse}"]`)
    const erste = q.bestand.value[liste].find((b) => b.klasse === letzte.klasse)!
    expect(w.find('[data-action="pruef-vorschlag"]').attributes('data-start')).toBe(erste.key)
  })

  it('Maske mit Schlange: „Mehr“ nennt die Klassen; Wahl zeigt sofort einen Start der Klasse', async () => {
    fenster(360, 740)
    const q = oeffneUebung({ regelwerk: 'uim-2026', typeId: 'tor5', folgeMs: [0, 0] })
    quellen.push(q)
    const w = mount(WkrGeraet, { attachTo: document.body, props: { quelle: q, ablage: handy() } })
    wrappers.push(w)
    await nextTick()
    await klick(w, '[data-action="mehr"]')
    const knoepfe = w.findAll('[data-action="uebung-vorziehen"]')
    expect(knoepfe.length).toBeGreaterThan(1)
    // UIM: Klasse E heißt „Dolphin“, nie „ME“.
    const texte = knoepfe.map((k) => k.text())
    expect(texte.some((t) => /Dolphin/.test(t))).toBe(true)
    expect(texte.some((t) => /\bME\b/.test(t))).toBe(false)
    const dolphin = knoepfe.find((k) => /Dolphin/.test(k.text()))!
    const klasse = dolphin.attributes('data-klasse')
    await dolphin.trigger('click')
    // „Mehr“ klappt zu; der nächste gezeigte Start ist einer dieser Klasse.
    expect(w.find('[data-teil="uebung-vorziehen"]').exists()).toBe(false)
    const liste = q.listen.value[0].liste
    const erster = q.schlange.value[liste][0]
    q.schicke(liste, { s: erster.key, zellen: {} })
    // Der nächste kommt über den Übungstakt (hier 0 ms) – warten, bis er da ist, keine feste Pause.
    await vi.waitFor(() => expect(q.schlange.value[liste][0]?.klasse).toBe(klasse))
  })
})
