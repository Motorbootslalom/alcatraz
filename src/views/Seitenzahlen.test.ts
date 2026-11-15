/// <reference types="node" />
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { readFileSync, readdirSync } from 'node:fs'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { laufSchluessel } from '../lib/eingaben'
import { SEITEN_VORGABE } from '../lib/seiten'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'

// Zusage an den Nutzer: Keine Seitenzahl kommt mehr vom Browser. Jede Liste, die für sich ein
// Dokument ist, zählt ihre Seiten selbst – „Seite 1 / 2“ und „Seite 2 / 2“ auf dem ersten
// Parcours, auf dem zweiten wieder von vorn – und nur, wenn sie mehr als eine Seite hat. Nie
// eine Zahl über den ganzen Druck („Seite 58 von 178“).
//
// Ohne Layout (happy-dom) gilt die Vorgabe der Zeilen je Seite (lib/seiten.ts); im Browser
// misst die Liste nach.

/** Erfundene Starter: `n` je Klasse, klassenbasierte Startnummern. */
function starter(klassen: ClassId[], n: number | Partial<Record<ClassId, number>>): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: typeof n === 'number' ? n : (n[klasse] ?? 3) }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: `Vor${klasse}${i + 1}`,
      nachname: `Nach${klasse}${i + 1}`,
      verein: `Musterclub ${klasse}`,
      bundesland: 'Musterland',
      geburtsdatum: '',
      groesse: '',
      klasse,
    })),
  )
}

const ansicht = (store: Store) => mount(ListsView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
/** Wählt den Reiter; `starter:klasse` wählt im Reiter „Starterlisten“ auch die Art. */
async function art(wrapper: VueWrapper, wahl: string) {
  const [kind, starterArt = kind === 'starter' ? 'verzahnt' : ''] = wahl.split(':')
  await wrapper.find(`.list-kinds button[data-kind="${kind}"]`).trigger('click')
  await nextTick()
  if (starterArt) await wrapper.find(`.starter-arten button[data-art="${starterArt}"]`).trigger('click')
  await nextTick()
}
/** Der Kopf jeder Druckseite: seine Felder, mit „|“ getrennt. */
const kopf = (wrapper: VueWrapper) => wrapper.findAll('.listen-seite .sheet-title-box').map((b) => b.findAll('[data-feld]').map((f) => f.text()).join(' | '))
/** Je Druckseite die Seitenzahl, wie sie auf dem Blatt steht („-“ = keine). */
const zahlen = (wrapper: VueWrapper | DOMWrapper<Element>) => wrapper.findAll('.listen-seite').map((s) => (s.find('.listen-seitenzahl').exists() ? s.find('.listen-seitenzahl').text() : '-'))
const zeilenJeSeite = (wrapper: VueWrapper) => wrapper.findAll('.listen-seite').map((s) => s.findAll('tbody tr').length)
const css = (wrapper: VueWrapper) => wrapper.findAll('style').map((s) => s.text()).join('\n')
const ZAEHLER = /counter\(\s*pages?\b/

describe('Seitenzahlen: jede Liste zählt ihre Seiten selbst', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
  })
  afterEach(() => setLocale('de'))

  it('zwei Parcours, je mehr Starter als auf eine Seite passen: 1/2, 2/2 und auf dem zweiten Parcours wieder 1/2, 2/2', async () => {
    // Je Parcours zwei Klassen zu 30 Startern = 60 Zeilen, mehr als eine Seite fasst.
    expect(60).toBeGreaterThan(SEITEN_VORGABE.starter)
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '3', '4', '7'], 30) })
    const wrapper = ansicht(store)
    expect(wrapper.findAll('.sheet-section')).toHaveLength(2)
    expect(zahlen(wrapper)).toEqual(['Seite 1 / 2', 'Seite 2 / 2', 'Seite 1 / 2', 'Seite 2 / 2'])
    expect(zeilenJeSeite(wrapper)).toEqual([40, 20, 40, 20])
    // Jede Seite trägt den Kopf ihres Parcours und die Spaltenköpfe.
    expect(kopf(wrapper)).toEqual([
      'Starterliste | Parcours 1 | Hafenpokal 2026',
      'Starterliste | Parcours 1 | Hafenpokal 2026',
      'Starterliste | Parcours 2 | Hafenpokal 2026',
      'Starterliste | Parcours 2 | Hafenpokal 2026',
    ])
    expect(wrapper.findAll('.listen-seite .sheet-cols')).toHaveLength(4)
    // Die graue fünfte Zeile zählt über die Seiten des Parcours weiter und beginnt beim nächsten neu.
    const grau = wrapper.findAll('.listen-seite').map((s) => s.findAll('tbody tr').flatMap((z, i) => (z.classes('shade') ? [i + 1] : [])))
    expect(grau[0]).toEqual([5, 10, 15, 20, 25, 30, 35, 40])
    expect(grau[1]).toEqual([5, 10, 15, 20])
    expect(grau[2]).toEqual(grau[0])
    // Keine Zeile fehlt, keine steht doppelt.
    const nummern = wrapper.findAll('.sheet-table tbody tr td:first-child').map((z) => z.text())
    expect(nummern).toHaveLength(120)
    expect(new Set(nummern).size).toBe(120)

    // Vorsteg-Liste: dieselbe Teilung je Parcours.
    await art(wrapper, 'vorsteg')
    expect(zahlen(wrapper)).toEqual(['Seite 1 / 2', 'Seite 2 / 2', 'Seite 1 / 2', 'Seite 2 / 2'])
    expect(css(wrapper)).not.toMatch(ZAEHLER)
    wrapper.unmount()
  })

  it('eine Liste mit einer Seite trägt keine Seitenzahl', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '3', '4', '7'], 3) })
    const wrapper = ansicht(store)
    for (const kind of ['starter', 'starter:herkunft', 'starter:klasse', 'vorsteg', 'gewicht', 'ergebnis', 'codes']) {
      await art(wrapper, kind)
      expect(wrapper.find('.listen-seitenzahl').exists(), kind).toBe(false)
      expect(wrapper.text(), kind).not.toMatch(/Seite \d/)
    }
    wrapper.unmount()
  })

  it('nur das mehrseitige Dokument trägt Seitenzahlen: ein langer und ein kurzer Parcours', () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '4'], { '1': 45, '4': 4 }) })
    const wrapper = ansicht(store)
    expect(zahlen(wrapper)).toEqual(['Seite 1 / 2', 'Seite 2 / 2', '-'])
    wrapper.unmount()
  })

  it('Starter nach Klasse: ein Dokument; eine Klasse, die nicht mehr auf die Seite passt, beginnt auf der nächsten', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '3', '4'], { '1': 25, '3': 25, '4': 5 }) })
    const wrapper = ansicht(store)
    await art(wrapper, 'starter:klasse')
    expect(wrapper.findAll('.sheet-section')).toHaveLength(1)
    expect(kopf(wrapper)[0]).toBe('Starterliste | nach Klasse | Hafenpokal 2026')
    expect(zahlen(wrapper)).toEqual(['Seite 1 / 2', 'Seite 2 / 2'])
    expect(zeilenJeSeite(wrapper)).toEqual([25, 30])
    expect(wrapper.findAll('.listen-seite')[1].findAll('tbody')).toHaveLength(2)
    wrapper.unmount()
  })

  it('Gewichtslisten: je Herkunft ein Dokument mit eigener Zählung', async () => {
    // Zwei Vereine: einer mit mehr Startern, als auf ein Querblatt passen.
    expect(20).toBeGreaterThan(SEITEN_VORGABE.gewicht)
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '4'], { '1': 20, '4': 4 }) })
    const wrapper = ansicht(store)
    await art(wrapper, 'gewicht')
    // Liste, Herkunft und Veranstaltung stehen je in einem eigenen Feld.
    expect(kopf(wrapper)).toEqual(['Gewichtsliste | Musterclub 1 | Hafenpokal 2026', 'Gewichtsliste | Musterclub 1 | Hafenpokal 2026', 'Gewichtsliste | Musterclub 4 | Hafenpokal 2026'])
    expect(zahlen(wrapper)).toEqual(['Seite 1 / 2', 'Seite 2 / 2', '-'])
    wrapper.unmount()
  })

  it('Ergebnislisten: je Liste ein Dokument; der Zeitstempel „Letzte Änderung“ steht auf jeder Seite', async () => {
    const n = SEITEN_VORGABE.ergebnisLauf + 6
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '4'], { '1': n, '4': 3 }) })
    for (const p of store.state.value.starters) {
      store.dispatch({ type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: p.id, feld: 'zeit1', wert: '80' }], zeit: new Date(2026, 4, 1, 10, 0, 0).getTime() })
    }
    const wrapper = ansicht(store)
    await art(wrapper, 'ergebnis')
    await wrapper.find('select[data-feld="erg-lauf"]').setValue('1')
    await nextTick()
    // Klasse 1, 1. Lauf: zwei Seiten; Klasse 4, 1. Lauf: eine – ohne Zahl.
    expect(wrapper.find('.ergebnis-zahl').text()).toContain('2')
    expect(zahlen(wrapper)).toEqual(['Seite 1 / 2', 'Seite 2 / 2', '-'])
    const seiten = wrapper.findAll('.ergebnis-blatt')
    expect(seiten).toHaveLength(3)
    expect(seiten.map((s) => s.find('.erg-kopf-klasse').text())).toEqual(['Klasse 1', 'Klasse 1', 'Klasse 4'])
    expect(seiten.map((s) => s.findAll('tbody tr').length)).toEqual([SEITEN_VORGABE.ergebnisLauf, 6, 3])
    for (const s of seiten) {
      expect(s.attributes('data-art')).toBe('lauf')
      expect(s.attributes('data-ordnung')).toBe('platz')
      expect(s.find('.erg-spaltenkopf').exists()).toBe(true)
    }
    // Das Feld „Letzte Änderung“ steht unter der Tabelle – auf beiden Seiten derselben Liste, mit
    // demselben Zeitpunkt, in einer Zeile mit der Seitenzahl; im Kopf steht es nicht mehr.
    const stand = seiten.map((s) => (s.find('.erg-fuss .erg-stand').exists() ? s.find('.erg-fuss .erg-stand').text() : ''))
    expect(seiten.every((s) => s.find('.erg-fuss .listen-seitenzahl').exists() === (s.attributes('data-seiten') !== '1'))).toBe(true)
    expect(wrapper.find('.erg-kopf .erg-stand').exists()).toBe(false)
    expect(stand[0]).toMatch(/^Letzte Änderung: \d\d\.\d\d\.\d{4}, \d\d:\d\d:\d\d$/)
    expect(seiten[0].find('.erg-stand .sr-only').text()).toBe('Letzte Änderung:')
    expect(stand[1]).toBe(stand[0])
    // Die graue fünfte Zeile zählt über die Seiten weiter: Auf Seite 2 ist es wieder die fünfte der Liste.
    const grau2 = seiten[1].findAll('tbody tr').flatMap((z, i) => (z.classes('grau') ? [SEITEN_VORGABE.ergebnisLauf + i + 1] : []))
    expect(grau2.every((nr) => nr % 5 === 0)).toBe(true)
    expect(grau2.length).toBeGreaterThan(0)
    // Beide Reihenfolgen: je Reihenfolge ein Dokument, jedes zählt für sich.
    await wrapper.find('select[data-feld="erg-ordnung"]').setValue('beide')
    await nextTick()
    expect(zahlen(wrapper)).toEqual(['Seite 1 / 2', 'Seite 2 / 2', 'Seite 1 / 2', 'Seite 2 / 2', '-', '-'])
    // Gesamtliste ebenso.
    await wrapper.find('select[data-feld="erg-ordnung"]').setValue('platz')
    await wrapper.find('select[data-feld="erg-umfang"]').setValue('gesamt')
    await nextTick()
    expect(wrapper.findAll('.ergebnis-blatt').map((s) => s.attributes('data-art'))).toEqual(['gesamt', 'gesamt', 'gesamt'])
    expect(zahlen(wrapper)).toEqual(['Seite 1 / 2', 'Seite 2 / 2', '-'])
    expect(css(wrapper)).not.toMatch(ZAEHLER)
    wrapper.unmount()
  })

  it('englische Listen (UIM): derselbe Wortlaut wie auf den Bögen – die Sprache der Oberfläche zählt nicht', async () => {
    setLocale('en')
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '4'], 45) })
    const wrapper = ansicht(store)
    expect(zahlen(wrapper)).toEqual(['Seite 1 / 2', 'Seite 2 / 2', 'Seite 1 / 2', 'Seite 2 / 2'])
    setLocale('de')
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    await nextTick()
    expect(zahlen(wrapper)).toEqual(['Page 1 / 2', 'Page 2 / 2', 'Page 1 / 2', 'Page 2 / 2'])
    wrapper.unmount()
  })

  it('Wettkampfrichter-Listen: nur die Seiten des zweiseitigen Bogens tragen 1/2 und 2/2 – Rückseiten zählen nicht mit', async () => {
    // Ein Lauf, fest 5 Starter je Seite: Klasse 7 hat 8 Starter (zwei Seiten je Bogen), die anderen 3 (eine).
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 1 } })
    store.dispatch({ type: 'SET_WKR_SEITEN', patch: { zeilenJeSeite: 5 } })
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '3', '4', '7'], { '7': 8 }) })
    const wrapper = ansicht(store)
    await art(wrapper, 'wkr')
    const pruefe = () => {
      const vorn = wrapper.findAll('.wkr-listen .bogen:not(.bogen--rueck)')
      expect(vorn.length).toBeGreaterThan(20)
      const kopf = (b: DOMWrapper<Element>) => b.findAll('.bk-links .bk-zelle').map((z) => z.text()).join(' | ')
      const zahl = (b: DOMWrapper<Element>) => (b.find('.bogen-seitenzahl').exists() ? b.find('.bogen-seitenzahl').text() : '-')
      const klasse7 = vorn.filter((b) => kopf(b).includes('Klasse 7'))
      const andere = vorn.filter((b) => !kopf(b).includes('Klasse 7'))
      expect(klasse7.length).toBeGreaterThan(0)
      expect(andere.length).toBeGreaterThan(0)
      // Jeder Bogen der Klasse 7: zwei Seiten hintereinander, je Bogen neu gezählt.
      expect(klasse7.length % 2).toBe(0)
      expect(klasse7.map(zahl)).toEqual(klasse7.map((_, i) => `Seite ${(i % 2) + 1} / 2`))
      klasse7.forEach((b, i) => {
        expect(b.attributes('data-seite')).toBe(String((i % 2) + 1))
        if (i % 2 === 1) expect(kopf(b)).toBe(kopf(klasse7[i - 1]))
      })
      // Alle einseitigen Bögen: nichts.
      expect(andere.map(zahl).every((z) => z === '-')).toBe(true)
      // Nirgends eine Zahl über den ganzen Druck.
      const alle = wrapper.findAll('.wkr-listen .bogen-seitenzahl').map((z) => z.text())
      expect(new Set(alle)).toEqual(new Set(['Seite 1 / 2', 'Seite 2 / 2']))
      expect(wrapper.find('.wkr-listen').text()).not.toMatch(/Seite \d+ von \d+/)
      return vorn.length
    }
    const vorderseiten = pruefe()
    expect(css(wrapper)).not.toMatch(ZAEHLER)
    // Mit der Beschreibung auf der Rückseite: je Vorderseite eine Rückseite, ohne Seitenzahl – die Zählung bleibt.
    store.dispatch({ type: 'SET_WKR_RUECKSEITE', rueckseite: true })
    await nextTick()
    await nextTick()
    expect(pruefe()).toBe(vorderseiten)
    const rueck = wrapper.findAll('.wkr-listen .bogen--rueck')
    expect(rueck).toHaveLength(vorderseiten)
    expect(rueck.some((b) => b.find('.bogen-seitenzahl').exists())).toBe(false)
    expect(rueck.some((b) => /Seite \d/.test(b.text()))).toBe(false)
    wrapper.unmount()
  }, 30_000)

  it('im Seitenrand steht nichts mehr: Keine Listenart erzeugt ein Stylesheet, also auch keine Randbox', async () => {
    store.dispatch({ type: 'ADD_STARTERS', starters: starter(['1', '4'], 3) })
    const wrapper = ansicht(store)
    for (const kind of ['starter', 'starter:herkunft', 'starter:klasse', 'gewicht', 'vorsteg', 'codes', 'ergebnis', 'wkr', 'laufzettel']) {
      await art(wrapper, kind)
      expect(wrapper.find('style').exists(), kind).toBe(false)
      expect(wrapper.html(), kind).not.toMatch(/@(top|bottom)-|@page/)
    }
    wrapper.unmount()
  })
})

describe('Seitenzahlen: kein Seitenzähler des Browsers im Quelltext', () => {
  // Von der Platte gelesen: Vitest liefert für CSS-Importe leeren Text (siehe styles/blatt.test.ts).
  const wurzel = `${process.cwd()}/src`
  const dateien = (readdirSync(wurzel, { recursive: true }) as string[]).filter((d) => /\.(css|vue|ts)$/.test(d) && !/\.test\.ts$/.test(d))

  it('weder in src/styles noch in erzeugtem CSS: counter(page) und counter(pages) kommen nirgends vor', () => {
    expect(dateien.filter((d) => d.endsWith('.css')).length).toBeGreaterThan(5)
    expect(dateien.some((d) => d.endsWith('ListsView.vue'))).toBe(true)
    const treffer = dateien.filter((d) => ZAEHLER.test(readFileSync(`${wurzel}/${d}`, 'utf8')))
    expect(treffer).toEqual([])
  })

  it('keine Randbox, nirgends: weder in src/styles noch in erzeugtem CSS steht @top-… oder @bottom-…', () => {
    // Auch kein Druckzeitpunkt im Rand; counter-increment/-reset für eigene Zähler gibt es ebenso wenig.
    const treffer = dateien.filter((d) => /counter-(increment|reset)|@(top|bottom)-/.test(readFileSync(`${wurzel}/${d}`, 'utf8')))
    expect(treffer).toEqual([])
  })

  it('die Blätter der Starterlisten sind am Bildschirm fest so breit wie der Druckbereich – die Teilung hängt nicht am Fenster', () => {
    // Mit einer Höchstbreite würde das Blatt im schmalen Fenster schmaler, die Zeilen höher,
    // und derselbe Stand teilte sich je nach Fenster anders (gemessen wird am Bildschirm).
    const regel = (css: string, selektor: string) => css.match(new RegExp(`(?:^|\\n)${selektor.replace(/\./g, '\\.')} \\{([^}]*)\\}`))?.[1] ?? ''
    const app = readFileSync(`${wurzel}/styles/app.css`, 'utf8')
    // A4 hoch 210 − 2 × 12 mm Rand, quer 297 − 2 × 12 mm (styles/print.css).
    expect(regel(app, '.sheet-section')).toMatch(/\bwidth: 186mm;/)
    expect(regel(app, '.sheet-section')).not.toContain('max-width')
    expect(regel(app, '.sheet.weights .sheet-section')).toMatch(/\bwidth: 273mm;/)
    // Das Blatt rollt in sich, nicht die Seite.
    expect(regel(app, '.sheet')).toContain('overflow-x: auto')
    const print = readFileSync(`${wurzel}/styles/print.css`, 'utf8')
    expect(print).toMatch(/margin: 8mm 12mm;/)
  })
})
