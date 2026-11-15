import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { laufSchluessel } from '../lib/eingaben'
import { SEITEN_VORGABE } from '../lib/seiten'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'

// Doppelseitig drucken (lib/doppelseitig.ts): Jedes Dokument beginnt auf einem neuen Blatt –
// nach einem Dokument mit ungerader Seitenzahl folgt eine leere Seite, nach dem letzten keine.
// Ohne Layout (happy-dom) bildet die Vorgabe der Zeilen je Seite die Seiten (lib/seiten.ts).
// Alle Starter und Vereine sind erfunden.

const JE_SEITE = SEITEN_VORGABE.starterHerkunft

/** `n` erfundene Starter eines Vereins in Klasse `klasse`. */
function starter(verein: string, klasse: ClassId, n: number): Starter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `id-${verein}-${i + 1}`,
    startNr: `${klasse}${String(i + 1).padStart(2, '0')}${verein.slice(-1)}`,
    vorname: `Vor${i + 1}`,
    nachname: `Nach${verein.slice(-1)}${i + 1}`,
    verein,
    bundesland: 'Musterland',
    geburtsdatum: '',
    groesse: '',
    klasse,
  }))
}
/** Vier Vereine: 1 Seite, 3 Seiten, 2 Seiten, 1 Seite. */
const FELD = [...starter('Club A', '1', 3), ...starter('Club B', '2', 2 * JE_SEITE + 4), ...starter('Club C', '3', JE_SEITE + 4), ...starter('Club D', '4', 2)]

const ansicht = (store: Store) => mount(ListsView, { global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
async function ruhe() {
  for (let i = 0; i < 4; i++) await nextTick()
  // Der Beobachter des DOM meldet sich nach dem laufenden Schritt.
  await new Promise((fertig) => setTimeout(fertig))
  for (let i = 0; i < 4; i++) await nextTick()
}
async function art(wrapper: VueWrapper, wahl: string) {
  const [kind, starterArt = ''] = wahl.split(':')
  await wrapper.find(`.list-kinds button[data-kind="${kind}"]`).trigger('click')
  await nextTick()
  if (starterArt) await wrapper.find(`.starter-arten button[data-art="${starterArt}"]`).trigger('click')
  await ruhe()
}
const schalter = (wrapper: VueWrapper) => wrapper.find('input[data-feld="doppelseitig"]')
async function schalte(wrapper: VueWrapper, an: boolean) {
  await schalter(wrapper).setValue(an)
  await ruhe()
}
/** Die Seiten des Drucks in ihrer Reihenfolge: die Seitenzahl einer echten Seite („1/3“, „-“ = keine) oder „leer“. */
const folge = (wrapper: VueWrapper) =>
  wrapper.findAll('.listen-seite, .leere-rueckseite').map((s) => (s.classes('leere-rueckseite') ? 'leer' : s.find('.listen-seitenzahl').exists() ? s.find('.listen-seitenzahl').text().replace('Seite ', '').replace(/\s/g, '') : '-'))
/** Auf welcher Seite des Drucks (ab 1) jedes Dokument beginnt. */
const beginn = (wrapper: VueWrapper) =>
  wrapper
    .findAll('.listen-seite, .leere-rueckseite')
    .map((s, i) => (s.classes('listen-seite') && s.attributes('data-seite') === '1' ? i + 1 : 0))
    .filter(Boolean)

describe('Doppelseitig drucken: jedes Dokument beginnt auf einem neuen Blatt', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    location.hash = ''
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'ADD_STARTERS', starters: FELD })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  it('den Schalter haben die Listenarten mit mehreren Dokumenten – nicht die Bögen der Wettkampfrichter, die Laufzettel und der Aushang der Codes', async () => {
    const wrapper = ansicht(store)
    const mit: string[] = []
    for (const k of ['starter', 'gewicht', 'vorsteg', 'wkr', 'laufzettel', 'codes', 'ergebnis', 'pokal', 'druckdatei']) {
      await art(wrapper, k)
      if (schalter(wrapper).exists()) mit.push(k)
    }
    expect(mit).toEqual(['starter', 'gewicht', 'vorsteg', 'ergebnis', 'pokal', 'druckdatei'])
    wrapper.unmount()
    // Baut neun Listenarten nacheinander auf; läuft die ganze Suite zugleich, reichen 30 s nicht.
  }, 90_000)

  it('Vorgabe aus: keine leere Seite; eingeschaltet folgt jedem Dokument mit ungerader Seitenzahl eine – dem letzten nicht', async () => {
    const wrapper = ansicht(store)
    await art(wrapper, 'starter:herkunft')
    expect(schalter(wrapper).element).toHaveProperty('checked', false)
    expect(schalter(wrapper).element.closest('label')?.textContent).toContain('doppelseitig drucken')
    const ohne = ['-', '1/3', '2/3', '3/3', '1/2', '2/2', '-']
    expect(folge(wrapper)).toEqual(ohne)
    await schalte(wrapper, true)
    // Club A (1 Seite) + leer, Club B (3 Seiten) + leer, Club C (2 Seiten), Club D (1 Seite, das letzte Dokument).
    expect(folge(wrapper)).toEqual(['-', 'leer', '1/3', '2/3', '3/3', 'leer', '1/2', '2/2', '-'])
    // Jedes Dokument beginnt auf einer ungeraden Seite des Drucks, also auf der Vorderseite eines Blatts.
    expect(beginn(wrapper)).toEqual([1, 3, 7, 9])
    expect(beginn(wrapper).every((n) => n % 2 === 1)).toBe(true)
    await schalte(wrapper, false)
    expect(folge(wrapper)).toEqual(ohne)
    wrapper.unmount()
  })

  it('die leere Seite ist leer: kein Kopf, keine Tabelle, keine Seitenzahl – nur der Vermerk für den Bildschirm; sie zählt im Dokument nicht mit', async () => {
    const wrapper = ansicht(store)
    await art(wrapper, 'starter:herkunft')
    await schalte(wrapper, true)
    const leere = wrapper.findAll('.leere-rueckseite')
    expect(leere).toHaveLength(2)
    for (const l of leere) {
      expect(l.find('table').exists()).toBe(false)
      expect(l.find('.sheet-title-box').exists()).toBe(false)
      expect(l.find('.listen-seitenzahl').exists()).toBe(false)
      expect(l.text()).toBe('leere Rückseite')
      expect(l.attributes('data-druckseite')).toBeUndefined()
      // Die Seitenart (hoch/quer) kommt über die Klasse des Dokuments.
      expect(l.classes()).toContain('sheet-page')
    }
    // Die Zählung des dreiseitigen Dokuments bleibt „1 / 3“ bis „3 / 3“.
    expect(wrapper.findAll('.listen-seite[data-seiten="3"]')).toHaveLength(3)
    wrapper.unmount()
  })

  it('ändert sich die Auswahl, zieht die leere Seite mit: Das letzte Dokument bekommt nie eine', async () => {
    const wrapper = ansicht(store)
    await art(wrapper, 'starter:herkunft')
    await schalte(wrapper, true)
    // Nur Club B (drei Seiten, das einzige und damit letzte Dokument).
    const wahl = wrapper.find('select[data-feld="starter-herkunft"]')
    await wahl.setValue((wahl.findAll('option').find((o) => o.text() === 'Club B')!.element as HTMLOptionElement).value)
    await ruhe()
    expect(folge(wrapper)).toEqual(['1/3', '2/3', '3/3'])
    // Kommt ein Starter für einen neuen Verein dazu, ist Club D nicht mehr das letzte Dokument.
    await wahl.setValue('*')
    store.dispatch({ type: 'ADD_STARTERS', starters: starter('Club E', '5', 1) })
    await ruhe()
    expect(folge(wrapper)).toEqual(['-', 'leer', '1/3', '2/3', '3/3', 'leer', '1/2', '2/2', '-', 'leer', '-'])
    wrapper.unmount()
  })

  it('die Wahl gilt je Listenart und übersteht Ansichtswechsel und Neuladen', async () => {
    const wrapper = ansicht(store)
    await art(wrapper, 'starter:herkunft')
    await schalte(wrapper, true)
    await art(wrapper, 'gewicht')
    expect(schalter(wrapper).element).toHaveProperty('checked', false)
    expect(wrapper.findAll('.leere-rueckseite')).toHaveLength(0)
    await art(wrapper, 'starter')
    expect(schalter(wrapper).element).toHaveProperty('checked', true)
    expect(JSON.parse(sessionStorage.getItem('alcatraz.merke.listen.doppelseitig') ?? '{}')).toEqual({ starter: true })
    wrapper.unmount()
    // Neuladen: Das Gemerkte im Fenster ist weg, der sessionStorage bleibt.
    vergissAlles()
    sessionStorage.setItem('alcatraz.merke.listen.doppelseitig', JSON.stringify({ starter: true }))
    const neu = ansicht(store)
    await art(neu, 'starter:herkunft')
    expect(schalter(neu).element).toHaveProperty('checked', true)
    expect(neu.findAll('.leere-rueckseite').length).toBeGreaterThan(0)
    neu.unmount()
  })

  it('Gewichtslisten je Herkunft (quer): die leere Seite steht im Blatt der Liste und erbt damit das Querformat', async () => {
    const wrapper = ansicht(store)
    await art(wrapper, 'gewicht')
    await schalte(wrapper, true)
    const leere = wrapper.findAll('.leere-rueckseite')
    expect(leere.length).toBeGreaterThan(0)
    expect(leere.every((l) => l.element.closest('.sheet.weights') !== null)).toBe(true)
    expect(beginn(wrapper).every((n) => n % 2 === 1)).toBe(true)
    wrapper.unmount()
  })

  it('Wertungslisten, Mannschaftswertung und Druckdatei: jedes Dokument beginnt auf einer ungeraden Seite, die leere Seite trägt die Klasse des Blatts davor', async () => {
    store.dispatch({ type: 'SET_EVENT', patch: { laufCount: 1 } })
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: FELD.map((p, i) => ({ lauf: laufSchluessel('manoevrieren', 1), starter: p.id, feld: 'zeit1', wert: String(60 + i) })),
      zeit: 1,
    })
    const wrapper = ansicht(store)
    for (const k of ['ergebnis', 'pokal', 'druckdatei']) {
      await art(wrapper, k)
      await schalte(wrapper, true)
      // Die Druckdatei baut sich in Schritten auf.
      for (let i = 0; i < 40 && wrapper.find('.druckdatei').exists() && wrapper.find('.druckdatei').attributes('data-fertig') === undefined; i++) await ruhe()
      await ruhe()
      const seiten = wrapper.findAll('.listen-seite, .leere-rueckseite, .lg-blatt')
      expect(seiten.length, k).toBeGreaterThan(1)
      expect(seiten.at(-1)!.classes(), k).not.toContain('leere-rueckseite')
      // Dokumentanfänge: erste Seite einer Liste oder der Aushang der Codes.
      const anfaenge = seiten.map((s, i) => ((s.classes('listen-seite') && s.attributes('data-seite') === '1') || s.classes('lg-blatt') ? i + 1 : 0)).filter(Boolean)
      expect(anfaenge.length, k).toBeGreaterThan(1)
      expect(anfaenge.every((n) => n % 2 === 1), `${k}: ${anfaenge.join(',')}`).toBe(true)
      // Quer bleibt quer: Hinter einem Blatt der Wertungsliste trägt die leere Seite dessen Klasse.
      for (const [i, s] of seiten.entries()) if (s.classes('leere-rueckseite') && seiten[i - 1].classes('ergebnis-blatt')) expect(s.classes()).toContain('ergebnis-blatt')
    }
    wrapper.unmount()
  })
})
