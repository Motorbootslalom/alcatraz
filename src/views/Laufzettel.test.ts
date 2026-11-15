import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import LaufzettelBlatt from '../components/LaufzettelBlatt.vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { emptyState } from '../state/reducer'
import { leseCode } from '../lib/qr'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'

/** Erfundene Starter: `n` je Klasse, klassenbasierte Startnummern. */
function starter(klassen: ClassId[], n = 3): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: 'Musterclub',
      bundesland: 'Musterland',
      geburtsdatum: '',
      groesse: '',
      klasse,
    })),
  )
}

const ansicht = (store: Store) => mount(ListsView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
async function laufzettel(wrapper: VueWrapper) {
  await wrapper.find('.list-kinds button[data-kind="laufzettel"]').trigger('click')
  await nextTick()
  await nextTick()
}
async function waehle(wrapper: VueWrapper, feld: string, wert: string) {
  await wrapper.find(`select[data-feld="lz-${feld}"]`).setValue(wert)
  await nextTick()
}
const zettel = (wrapper: VueWrapper) => wrapper.findAll('.laufzettel-stapel .laufzettel')
const ruecken = (wrapper: VueWrapper) => zettel(wrapper).map((z) => z.findAll('.lz-ruecken span').map((s) => s.text()).join(' | '))
const zeilen = (z: ReturnType<typeof zettel>[number]) => z.findAll('.lz-oben li').map((li) => li.text())

describe('Listen: Laufzettel', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'LOAD_STATE', state: { ...emptyState(), kennung: 'K7Q4', eventName: 'Hafenpokal', starters: starter(['1', '3', '4', '7']) } })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('die Reihenfolge der Listenarten: Laufzettel hinter den Wettkampfrichter-Listen', () => {
    const wrapper = ansicht(store)
    expect(wrapper.findAll('.list-kinds button').map((b) => b.attributes('data-kind'))).toEqual(['starter', 'gewicht', 'vorsteg', 'wkr', 'laufzettel', 'codes', 'ergebnis', 'pokal', 'druckdatei'])
    expect(wrapper.find('.list-kinds button[data-kind="laufzettel"]').text()).toBe('Laufzettel')
    wrapper.unmount()
  })

  it('je Parcours, Klasse und Lauf ein Zettel mit einem Kästchen je Liste, Arbeitsschritten und QR-Code', async () => {
    const wrapper = ansicht(store)
    await laufzettel(wrapper)
    expect(zettel(wrapper)).toHaveLength(4 * 3)
    expect(wrapper.find('.wkr-listen-stand').text()).toBe('12 Laufzettel')
    expect(ruecken(wrapper)[0]).toMatch(/^Klasse [13] \| 1\. Lauf \| Parcours 1$/)
    expect(ruecken(wrapper).at(-1)).toMatch(/^Klasse [47] \| 3\. Lauf \| Parcours 2$/)
    const erster = zettel(wrapper)[0]
    expect(erster.find('.lz-titel').text()).toBe('Laufzettel · Hafenpokal 2026')
    // Ohne Layout (Test-DOM) hat jeder Bogen eine Seite: eine Zeile je Liste, das Kästchen vorn, ohne Seitenangabe.
    expect(erster.attributes('data-layout')).toBe('seite')
    expect(zeilen(erster)).toEqual(['Zeit', 'Vorsteg', 'Steg', 'Tor 1 / 3 / 5', 'Tor 2 / 4 / 5', 'Tor 5', 'Parcours'])
    expect(erster.findAll('.lz-oben li').every((li) => li.element.firstElementChild?.classList.contains('lz-kasten'))).toBe(true)
    expect(erster.findAll('.lz-oben .lz-kasten')).toHaveLength(7)
    expect(erster.find('.lz-schritte-titel').text()).toBe('Auswertung')
    expect(erster.findAll('.lz-schritte li').map((li) => li.text()).at(-1)).toBe('An die ML geschickt')
    // Die Knoten (ohne Lauf) zählen erst zum Gesamtergebnis: Sie liegen im Stapel des letzten Laufs.
    expect(zeilen(zettel(wrapper)[1])).not.toContain('Knoten')
    expect(zeilen(zettel(wrapper)[2])).toEqual([...zeilen(erster), 'Knoten'])
    // Die Klassen ab 4 haben zusätzlich Mann-über-Bord.
    expect(zeilen(zettel(wrapper).at(-1)!)).toContain('Mann-über-Bord')
    // Die anderen Listen stehen nicht daneben; die Bögen zum Messen sind unsichtbar und werden nie gedruckt.
    expect(wrapper.find('.sheet').exists()).toBe(false)
    expect(wrapper.find('.wkr-listen').exists()).toBe(false)
    expect(wrapper.find('.lz-messung').classes()).toContain('no-print')
    expect(wrapper.find('.lz-messung').attributes('aria-hidden')).toBe('true')
    wrapper.unmount()
  })

  const schritte = (z: ReturnType<typeof zettel>[number]) => z.findAll('.lz-schritte li').map((li) => li.text())
  const LETZTER = [
    'Ergebnis sortiert nach Startnummer drucken (geheftet mit den WKR-Listen)',
    'Ergebnis sortiert nach Platz',
    'Kontrolliert',
    'Unterschrieben',
    'Einsicht der Mannschaftsleiter (kein Aushang)',
    'Gesamtergebnis gedruckt',
    'Gesamtergebnis kontrolliert',
  ]

  it('der Zettel des letzten Laufs hat eigene Arbeitsschritte: kein Aushang, dafür Einsicht und Gesamtergebnis', async () => {
    const wrapper = ansicht(store)
    await laufzettel(wrapper)
    await waehle(wrapper, 'klasse', '3')
    const [erster, zweiter, dritter] = zettel(wrapper)
    expect(schritte(erster)).toEqual(schritte(zweiter))
    expect(schritte(erster)).toContain('Ausgehangen')
    expect(schritte(dritter)).toEqual(LETZTER)
    expect(schritte(dritter).some((s) => s === 'Ausgehangen' || s === 'An die ML geschickt')).toBe(false)
    expect(zettel(wrapper).map((z) => z.attributes('data-letzter-lauf'))).toEqual([undefined, undefined, 'true'])
    wrapper.unmount()
  })

  it('bei nur einem Lauf ist dieser der letzte: Knoten und die Schritte des letzten Laufs', async () => {
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 1 } })
    const wrapper = ansicht(store)
    await laufzettel(wrapper)
    expect(zettel(wrapper)).toHaveLength(4)
    for (const z of zettel(wrapper)) {
      expect(zeilen(z)).toContain('Knoten')
      expect(schritte(z)).toEqual(LETZTER)
    }
    wrapper.unmount()
  })

  it('UIM: zwei Versuche – Knoten und die Schritte des letzten Laufs auf dem Zettel des zweiten, englisch', async () => {
    store.dispatch({ type: 'LOAD_STATE', state: { ...store.state.value, regelwerk: 'uim-2026', laufCount: 2, starters: starter(['1', '3', '4', '5']) } })
    const wrapper = ansicht(store)
    await laufzettel(wrapper)
    await waehle(wrapper, 'klasse', '3')
    const [erster, zweiter] = zettel(wrapper)
    expect(zettel(wrapper)).toHaveLength(2)
    expect(zeilen(erster)).not.toContain('Knots')
    expect(zeilen(zweiter)).toContain('Knots')
    expect(schritte(erster).at(-2)).toBe('Posted')
    expect(schritte(zweiter)).toEqual([
      "Print results sorted by start number (stapled to the judges' sheets)",
      'Results sorted by place',
      'Checked',
      'Signed',
      'Reviewed by the team managers (not posted)',
      'Overall results printed',
      'Overall results checked',
    ])
    wrapper.unmount()
  })

  it('der QR-Code nennt Veranstaltung, Regelwerk, Aufbau, Parcours, Klasse und Lauf – eindeutig je Zettel', async () => {
    const wrapper = ansicht(store)
    await laufzettel(wrapper)
    const codes = zettel(wrapper).map((z) => z.find('svg.qr-code').attributes('data-qr')!)
    expect(new Set(codes).size).toBe(12)
    expect(codes.every((c) => /^ALC1\.K7Q4\.DM2026\.ALCATRAZ\.PAR[12]\.[1347]\.[123]$/.test(c))).toBe(true)
    const s = store.state.value
    const lesung = leseCode(codes.at(-1)!, { kennung: s.kennung, regelwerk: s.regelwerk, aufbau: s.aufbau, regelwerke: [], aufbauten: [], parcours: ['par_1', 'par_2'], listen: [], laufCount: 3 })
    expect(lesung).toMatchObject({ ok: true, ziel: { parcoursId: 'par_2', lauf: 3 } })
    // Schwarz auf weiß, als Vektor – unabhängig vom Farbschema.
    const svg = zettel(wrapper)[0].find('svg.qr-code')
    expect(svg.find('rect').attributes('fill')).toBe('#fff')
    expect(svg.find('path').attributes('fill')).toBe('#000')
    expect(svg.find('title').text()).toBe(codes[0])
    wrapper.unmount()
  })

  it('die Auswahl grenzt ein, was gezeigt und gedruckt wird, und bleibt beim Wechsel der Listenart', async () => {
    const wrapper = ansicht(store)
    await laufzettel(wrapper)
    await waehle(wrapper, 'parcours', 'par_2')
    expect(zettel(wrapper)).toHaveLength(6)
    await waehle(wrapper, 'klasse', '7')
    await waehle(wrapper, 'lauf', '2')
    expect(ruecken(wrapper)).toEqual(['Klasse 7 | 2. Lauf | Parcours 2'])
    await wrapper.find('.list-kinds button[data-kind="vorsteg"]').trigger('click')
    await laufzettel(wrapper)
    expect(ruecken(wrapper)).toEqual(['Klasse 7 | 2. Lauf | Parcours 2'])
    wrapper.unmount()
  })

  it('Fenstertitel beim Drucken: Listenart, Auswahl und Veranstaltung in der Sprache der Oberfläche; der Zettel in der des Regelwerks', async () => {
    vi.stubGlobal('print', vi.fn())
    const wrapper = ansicht(store)
    await laufzettel(wrapper)
    await waehle(wrapper, 'klasse', '4')
    await waehle(wrapper, 'lauf', '1')
    const vorher = document.title
    await wrapper.find('button.primary').trigger('click')
    expect(document.title).toMatch(/^Laufzettel - Klasse 4 - 1\. Lauf - Hafenpokal 2026 - \d{4}-\d\d-\d\d_\d{4}$/)
    window.dispatchEvent(new Event('afterprint'))
    expect(document.title).toBe(vorher)

    setLocale('en')
    await nextTick()
    expect(wrapper.find('.list-kinds button[data-kind="laufzettel"]').text()).toBe('Checklists')
    // DM: Der Zettel bleibt deutsch, nur Bedienung und Fenstertitel folgen der Oberfläche.
    expect(ruecken(wrapper)).toEqual(['Klasse 4 | 1. Lauf | Parcours 2'])
    expect(zettel(wrapper)[0].find('.lz-titel').text()).toBe('Laufzettel · Hafenpokal 2026')
    await wrapper.find('button.primary').trigger('click')
    expect(document.title).toMatch(/^Checklists - Class 4 - Attempt 1 - Hafenpokal 2026 - /)
    window.dispatchEvent(new Event('afterprint'))
    // UIM: Der Zettel ist englisch – auch bei deutscher Oberfläche.
    setLocale('de')
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    await waehle(wrapper, 'lauf', '1')
    expect(wrapper.find('.list-kinds button[data-kind="laufzettel"]').text()).toBe('Laufzettel')
    expect(ruecken(wrapper)).toEqual(['Class 4 | Attempt 1 | Parcours 2'])
    expect(zettel(wrapper)[0].find('.lz-titel').text()).toBe('Checklist · Hafenpokal 2026')
    expect(zettel(wrapper)[0].find('.lz-schritte-titel').text()).toBe('Scoring')
    expect(zettel(wrapper)[0].findAll('.lz-schritte li').map((li) => li.text()).at(-1)).toBe('Sent to the team managers')
    vi.unstubAllGlobals()
    wrapper.unmount()
  })

  it('Clubmeisterschaft, Papier sparen: ein Zettel je Parcours und Lauf – der Stapel der gemeinsamen Bögen', async () => {
    store.dispatch({ type: 'SET_EVENT_KIND', eventKind: 'club' })
    const wrapper = ansicht(store)
    await laufzettel(wrapper)
    // Zwei Parcours mit je zwei Klassen, drei Läufe.
    expect(zettel(wrapper)).toHaveLength(2 * 3)
    expect(ruecken(wrapper)[0]).toMatch(/^Klassen [13], [13] \| 1\. Lauf \| Parcours 1$/)
    expect(zettel(wrapper)[0].find('svg.qr-code').attributes('data-qr')).toBe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.13.1')
    // Mit der Auswahl einer Klasse erscheint der Zettel, auf dem sie steht.
    await waehle(wrapper, 'klasse', '7')
    expect(zettel(wrapper)).toHaveLength(3)
    wrapper.unmount()
  })

  const BLATT = {
    klassenText: 'Klassen E, 1, 4',
    laufText: '1. Lauf',
    titel: 'Laufzettel',
    qr: 'ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.E14.1',
    schritte: ['Kontrolliert'],
    zeilen: [
      { key: 'zeit', label: 'Zeit', gruppen: [{ key: 'a', seiten: 1 }] },
      { key: 'steg', label: 'Steg', gruppen: [{ key: 'b', seiten: 3 }] },
      { key: 'mueb', label: 'Mann-über-Bord', gruppen: [{ key: 'c', label: 'Kl. E, 1', seiten: 2 }, { key: 'd', label: 'Kl. 4', seiten: 1 }] },
    ],
  }
  const text = (el: { text(): string }) => el.text().replace(/\s+/g, ' ')

  it('eine Zeile je Seite (Vorgabe, wie im Prototyp): das Kästchen vorn, dahinter Liste und Seite', () => {
    const wrapper = mount(LaufzettelBlatt, { props: BLATT })
    expect(wrapper.find('.laufzettel').attributes('data-layout')).toBe('seite')
    const li = wrapper.findAll('.lz-je-seite li')
    // Ein einseitiger Bogen nennt keine Seite; Bögen nur eines Teils der Klassen nennen sie.
    expect(li.map(text)).toEqual(['Zeit', 'Steg – Seite 1', 'Steg – Seite 2', 'Steg – Seite 3', 'Mann-über-Bord · Kl. E, 1 – Seite 1', 'Mann-über-Bord · Kl. E, 1 – Seite 2', 'Mann-über-Bord · Kl. 4'])
    // Nur die Nummer der Seite, nie „Seite 1 von 3“: Die Zeilen stehen ohnehin untereinander.
    expect(li.some((x) => /\bvon\b|\bof\b|\//.test(text(x).replace(/^.* – /, '')))).toBe(false)
    expect(li.filter((x) => text(x).includes(' – ')).every((x) => /– Seite \d+$/.test(text(x)))).toBe(true)
    // Jede Zeile beginnt mit genau einem leeren Kästchen.
    expect(li.every((x) => x.findAll('.lz-kasten').length === 1 && x.element.firstElementChild?.classList.contains('lz-kasten') && x.find('.lz-kasten').text() === '')).toBe(true)
    expect(wrapper.find('.lz-seiten').exists()).toBe(false)
    wrapper.unmount()
  })

  it('eine Zeile je Liste: Kästchen nebeneinander, die Seitenzahl daneben – nicht darin; Teil-Klassen stehen davor', () => {
    const wrapper = mount(LaufzettelBlatt, { props: { ...BLATT, layout: 'liste' as const } })
    expect(wrapper.find('.laufzettel').attributes('data-layout')).toBe('liste')
    const li = wrapper.findAll('.lz-seiten li')
    expect(li.map((x) => x.find('.lz-name').text())).toEqual(['Zeit', 'Steg', 'Mann-über-Bord'])
    // Kein Kästchen enthält Text: Der Haken soll nicht auf der Zahl sitzen.
    expect(wrapper.findAll('.lz-oben .lz-kasten').every((k) => k.text() === '')).toBe(true)
    expect(li.map((x) => x.findAll('.lz-kasten').length)).toEqual([1, 3, 3])
    // Eine Seite: keine Zahl; mehrere: 1, 2, 3 jeweils hinter ihrem Kästchen.
    expect(li.map((x) => x.findAll('.lz-seite').map((k) => k.text()))).toEqual([[''], ['1', '2', '3'], ['1', '2', '']])
    expect(li[1].findAll('.lz-seite').every((x) => x.element.firstElementChild?.classList.contains('lz-kasten') && x.element.lastElementChild?.classList.contains('lz-nr'))).toBe(true)
    expect(li[2].findAll('.lz-gruppe').map((g) => g.find('.lz-gruppe-name').text())).toEqual(['Kl. E, 1', 'Kl. 4'])
    expect(li[0].find('.lz-gruppe-name').exists()).toBe(false)
    wrapper.unmount()
  })

  it('die Form wird in den Einstellungen gewählt und gilt für alle Zettel; englisch heißt die Seite „page“', async () => {
    store.dispatch({ type: 'SET_LAUFZETTEL_LAYOUT', layout: 'liste' })
    const wrapper = ansicht(store)
    await laufzettel(wrapper)
    expect(zettel(wrapper).every((z) => z.attributes('data-layout') === 'liste')).toBe(true)
    expect(wrapper.find('[data-hinweis="lz-layout"]').text()).toContain('eine Zeile je Liste')
    store.dispatch({ type: 'SET_LAUFZETTEL_LAYOUT', layout: 'seite' })
    await nextTick()
    expect(zettel(wrapper).every((z) => z.attributes('data-layout') === 'seite')).toBe(true)
    const en = mount(LaufzettelBlatt, { props: { ...BLATT, sprache: 'en' as const } })
    expect(text(en.findAll('.lz-je-seite li')[1])).toBe('Steg – page 1')
    expect(en.findAll('.lz-je-seite li').map(text).filter((x) => x.includes(' – ')).every((x) => /– page \d+$/.test(x))).toBe(true)
    en.unmount()
    wrapper.unmount()
  })

  it('zusammengelegt und mit zusätzlichen Listen: Der Zettel zählt, was gedruckt wird', async () => {
    store.dispatch({ type: 'SET_TOR5_MIT_PARCOURS', on: true })
    store.dispatch({ type: 'SET_ZUSATZ_LISTE', liste: 'knoten', an: false })
    store.dispatch({ type: 'SET_ZUSATZ_LISTE', liste: 'parcoursms', an: true })
    const wrapper = ansicht(store)
    await laufzettel(wrapper)
    // „Tor 5 + Parcours“ statt Tor 5 und Parcours; die zusätzliche Parcoursliste am Ende, mit dem Namen aus dem Menü.
    expect(zeilen(zettel(wrapper)[0])).toEqual(['Zeit', 'Vorsteg', 'Steg', 'Tor 1 / 3 / 5', 'Tor 2 / 4 / 5', 'Tor 5 + Parcours', 'Parcours'])
    wrapper.unmount()
  })

  it('gesperrt, solange Startnummern fehlen: Hinweis, kein Zettel, kein Druck', async () => {
    store.dispatch({ type: 'UPDATE_STARTER', id: 'id-4-2', patch: { startNr: '' } })
    const wrapper = ansicht(store)
    await laufzettel(wrapper)
    expect(wrapper.find('.boat-banner.warn').text()).toContain('1 Starter hat noch keine Startnummer.')
    expect(zettel(wrapper)).toHaveLength(0)
    expect(wrapper.findAll('.lz-messung .bogen')).toHaveLength(0)
    expect(wrapper.find('button.primary').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
