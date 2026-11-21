import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ListsView from './ListsView.vue'
import VerzahnungView from './VerzahnungView.vue'
import ErfassungView from './ErfassungView.vue'
import { meldeScan, scanBeenden } from '../lib/scan'
import { createStore, storeKey, type Store } from '../state/store'
import { attemptSchluessel } from '../lib/parallelSchluessel'
import { PARALLEL_ANNAHMEN } from '../lib/parallelErgebnis'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, ParallelRunde, Starter } from '../types'
import { ohneLogos, seitenKoepfe, setzeTestLogos } from '../testHilfen'

// Halbfinale, Kleines Finale, Finale und Wiederholung in der Oberfläche (seit 21.11.2026 zwei Runden): festschreiben und löschen unter
// „Verzahnung“, die Wertungslisten je Runde, das Gesamtergebnis und die Druckdatei.
// Erfundene Starter – keine echten Personen.
function mk(klasse: ClassId, n: number): Starter[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${klasse}-${i + 1}`,
    startNr: klasse + String(i + 1).padStart(2, '0'),
    vorname: 'Vor',
    nachname: `Nach${klasse}${i + 1}`,
    verein: 'Club',
    bundesland: '',
    geburtsdatum: '2015-01-01',
    groesse: '',
    klasse,
  }))
}

const mit = (store: Store) => ({ global: { provide: { [storeKey as symbol]: store } }, attachTo: document.body })
const warte = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}
const warteAufDruckdatei = async (wrapper: VueWrapper) => {
  // Erst die Auswahl wirken lassen: Eine andere Folge beginnt den Aufbau von vorn.
  await warte()
  for (let i = 0; i < 200 && wrapper.find('.druckdatei').attributes('data-fertig') === undefined; i++) await new Promise((r) => setTimeout(r, 0))
  await warte()
}

describe('Parallelslalom: Runden nach dem Vorlauf', () => {
  let store: Store

  /** Je Starter die beiden Attempts einer Runde in Sekunden. */
  const fahre = (runde: ParallelRunde, zeiten: Record<string, number[]>, zeit = 1000) =>
    store.dispatch({
      type: 'SET_EINGABEN',
      zellen: Object.entries(zeiten).flatMap(([id, je]) => je.map((sek, i) => ({ lauf: attemptSchluessel(runde, i + 1), starter: id, feld: 'zeit1', wert: `${sek},00` }))),
      zeit,
    })
  const VORLAUF = { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43], '1-5': [50, 50], '1-6': [55, 55] }
  const bisEnde = () => {
    fahre('pre', VORLAUF)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    fahre('semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] }, 2000)
    // Kleines Finale und Finale: zwei in sich geschlossene Runden (21.11.2026), das Kleine zuerst.
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'small' })
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'final' })
    fahre('small', { '1-3': [30, 30], '1-4': [44, 45] }, 3000)
    fahre('final', { '1-1': [41, 41], '1-2': [40, 43] }, 3500)
  }

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vergissAlles()
    scanBeenden()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    store.dispatch({ type: 'SET_EVENT', patch: { eventName: 'Hafenpokal' } })
    store.dispatch({ type: 'ADD_STARTERS', starters: mk('1', 6) })
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  const verzahnung = async (): Promise<VueWrapper> => {
    location.hash = '#/verzahnung/parallel'
    const wrapper = mount(VerzahnungView, mit(store))
    await warte()
    if (!wrapper.find('[data-panel="parallel-runden"]').exists()) {
      await wrapper.findAll('.subnav button')[1].trigger('click')
      await warte()
    }
    return wrapper
  }
  const weg = (wrapper: VueWrapper) => wrapper.findAll('.parallel-klasse[data-klasse="1"] .parallel-weg li').map((l) => `${l.attributes('data-runde')}=${l.attributes('data-zustand')}`)

  it('Halbfinale und Finale festschreiben – auch bei festgeschriebener Verzahnung; die Pläne stehen darunter', async () => {
    const wrapper = await verzahnung()
    // Reihenfolge der Panels (21.11.2026): das Aktuelle oben, Erledigtes darunter, der Vorlauf ganz unten.
    // Aus dem Dokument gelesen: findAll eines Wrappers mit mehreren Wurzeln nennt die Wurzeln vor den verschachtelten.
    const folge = () => [...document.querySelectorAll<HTMLElement>('.panel')].map((p) => p.dataset.runde ?? p.dataset.panel ?? '').filter(Boolean)
    // Der Vorlauf läuft: noch nichts festzuschreiben – er ist das Aktuelle und steht über den Runden.
    expect(folge()).toEqual(['pre', 'parallel-runden'])
    expect(weg(wrapper)).toEqual(['pre=leer'])
    expect(wrapper.find('[data-action="runde-fest"]').exists()).toBe(false)
    fahre('pre', VORLAUF)
    await warte()
    const knopf = wrapper.find('[data-action="runde-fest"]')
    expect(knopf.text()).toBe('Halbfinale festschreiben')
    // Die Runden liegen außerhalb der Sperre der Verzahnung: Der Knopf ist bedienbar.
    expect(knopf.element.closest('fieldset[disabled]')).toBeNull()
    expect(wrapper.find('[data-hinweis="runde-naechste"]').text()).toContain('101 ↔ 102 · 103 ↔ 104')
    await knopf.trigger('click')
    await warte()
    expect(weg(wrapper)).toEqual(['pre=fertig', 'semi=leer'])
    expect(wrapper.find('.panel[data-runde="semi"] h2').text()).toBe('Halbfinale')
    expect(wrapper.findAll('.panel[data-runde="semi"] tbody tr')).toHaveLength(4)
    expect(wrapper.find('[data-hinweis="runde-laeuft"]').text()).toContain('Halbfinale')

    fahre('semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] })
    await warte()
    // Nach dem Halbfinale stehen beide Finals an (21.11.2026): je ein Knopf, das Kleine zuerst.
    const naechste = () => wrapper.findAll('[data-hinweis="runde-naechste"]').map((p) => p.text())
    expect(naechste()).toEqual(['Als Nächstes: Kleines Finale – 103 ↔ 104 Kleines Finale festschreiben', 'Als Nächstes: Finale – 101 ↔ 102 Finale festschreiben'])
    // Eine Klasse mit zwei Finals ist noch keine zweite Klasse: kein „Alle Klassen weiter“.
    expect(wrapper.find('[data-action="runden-alle-fest"]').exists()).toBe(false)
    // Erst das Finale – die Finals hängen nur am Halbfinale, die Folge des Festschreibens ist frei.
    await wrapper.find('[data-action="runde-fest"][data-runde="final"]').trigger('click')
    await warte()
    expect(naechste()).toEqual(['Als Nächstes: Kleines Finale – 103 ↔ 104 Kleines Finale festschreiben'])
    // Die Runde sagt, um welche Plätze es geht: In der Klasse-Spalte steht nur noch die Klasse.
    expect(wrapper.findAll('.panel[data-runde="final"] td[data-spalte="vermerk"]').map((z) => z.text())).toEqual(['Klasse 1', 'Klasse 1'])
    await wrapper.find('[data-action="runde-fest"][data-runde="small"]').trigger('click')
    await warte()
    expect(wrapper.find('.panel[data-runde="small"] h2').text()).toBe('Kleines Finale')
    expect(wrapper.findAll('.panel[data-runde="small"] td[data-spalte="vermerk"]').map((z) => z.text())).toEqual(['Klasse 1', 'Klasse 1'])
    expect(weg(wrapper)).toEqual(['pre=fertig', 'semi=fertig', 'small=leer', 'final=leer'])
    // Beide festgeschrieben, nichts erfasst: Jetzt erst „wird erfasst“ – das Kleine Finale, es wird zuerst gefahren.
    expect(wrapper.find('[data-hinweis="runde-laeuft"]').text()).toContain('Kleines Finale')
    // Beide sind löschbar (Geschwister), das Halbfinale nicht mehr.
    expect(wrapper.findAll('[data-action="runde-loeschen"]').map((k) => k.attributes('data-runde'))).toEqual(['small', 'final'])
    fahre('small', { '1-3': [30, 30], '1-4': [44, 45] })
    await warte()
    expect(wrapper.find('.parallel-klasse[data-klasse="1"]').attributes('data-fertig')).toBe('false')
    fahre('final', { '1-1': [41, 41], '1-2': [40, 43] })
    await warte()
    expect(folge()).toEqual(['parallel-runden', 'final', 'small', 'semi', 'pre'])
    expect(wrapper.find('.parallel-klasse[data-klasse="1"]').attributes('data-fertig')).toBe('true')
    expect(wrapper.find('[data-hinweis="runde-fertig"]').exists()).toBe(true)
  })

  it('Kleines Finale wird erfasst, Finale noch festzuschreiben: nur „Als Nächstes: Finale“, kein „geht es weiter“ daneben (21.11.2026)', async () => {
    fahre('pre', VORLAUF)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    fahre('semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] }, 2000)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'small' })
    fahre('small', { '1-3': [30], '1-4': [44] }, 3000)
    const wrapper = await verzahnung()
    expect(weg(wrapper)).toEqual(['pre=fertig', 'semi=fertig', 'small=laeuft'])
    expect(wrapper.findAll('[data-hinweis="runde-naechste"]').map((p) => p.attributes('data-runde'))).toEqual(['final'])
    expect(wrapper.find('[data-hinweis="runde-laeuft"]').exists()).toBe(false)
  })

  it('„Alle Klassen weiter“ (19.11.2026): ein Knopf für alle Klassen, die so weit sind; die übrigen stehen im Hinweis', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: false })
    store.dispatch({ type: 'ADD_STARTERS', starters: [...mk('4', 4), ...mk('2', 4)] })
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const wrapper = await verzahnung()
    expect(wrapper.find('[data-action="runden-alle-fest"]').exists()).toBe(false)
    fahre('pre', { ...VORLAUF, '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43], '2-1': [40, 40] })
    await warte()
    const knopf = wrapper.find('[data-action="runden-alle-fest"]')
    expect(knopf.text()).toBe('Alle Klassen weiter: Halbfinale festschreiben')
    expect(wrapper.find('[data-hinweis="runden-alle"]').text()).toContain('Klasse 1, Klasse 4')
    // Nach dem Vorlauf kein Satz über die Finals (Prüfung 21.11.2026).
    expect(wrapper.find('[data-hinweis="runden-alle-text"]').text()).not.toContain('Finale')
    expect(wrapper.find('[data-hinweis="runden-alle-bleiben"]').text()).toBe('Bleiben noch, wo sie sind: Klasse 2 (Vorlauf noch nicht vollständig)')
    await knopf.trigger('click')
    await warte()
    // Ein Schritt für beide Klassen; die Runde fährt klein/groß im Wechsel.
    expect(store.state.value.parallelPlaene.semi!.starts.map((s) => s.klasse)).toEqual(['1', '4', '1', '4', '1', '4', '1', '4'])
    expect(wrapper.find('[data-action="runden-alle-fest"]').exists()).toBe(false)
    expect(wrapper.findAll('.panel[data-runde="semi"] tbody tr')).toHaveLength(8)
  })

  it('„Alle Klassen weiter“ nach dem Halbfinale schreibt Kleines Finale und Finale zusammen fest (Auslegung 21.11.2026)', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: false })
    store.dispatch({ type: 'ADD_STARTERS', starters: mk('4', 4) })
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    fahre('pre', { ...VORLAUF, '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    store.dispatch({ type: 'PARALLEL_RUNDEN_ALLE_FESTSCHREIBEN', schritte: [{ klasse: '1', runde: 'semi' }, { klasse: '4', runde: 'semi' }] })
    fahre('semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45], '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] }, 2000)
    const wrapper = await verzahnung()
    const knopf = wrapper.find('[data-action="runden-alle-fest"]')
    // Die Runden in der Folge des Wettkampfs, jede Klasse nur einmal genannt – obwohl sie zwei Schritte hat.
    expect(knopf.text()).toBe('Alle Klassen weiter: Kleines Finale, Finale festschreiben')
    expect(wrapper.find('[data-hinweis="runden-alle"]').text()).toContain('für Klasse 1, Klasse 4 in einem Schritt')
    // Der Satz zu den Finals steht nur hier und nur mit der Auslegung (PARALLEL_ANNAHMEN.finalsZusammen).
    expect(PARALLEL_ANNAHMEN.finalsZusammen).toBe(true)
    expect(wrapper.find('[data-hinweis="runden-alle-text"]').text()).toContain('Nach dem Halbfinale Kleines Finale und Finale zusammen.')
    expect(wrapper.find('[data-hinweis="parallel-annahmen"]').text()).toContain('„Alle Klassen weiter“ schreibt nach dem Halbfinale Kleines Finale und Finale zusammen fest')
    await knopf.trigger('click')
    await warte()
    const plaene = store.state.value.parallelPlaene
    expect(plaene.small!.starts.map((s) => s.klasse)).toEqual(['1', '4', '1', '4'])
    expect(plaene.final!.starts.map((s) => s.klasse)).toEqual(['1', '4', '1', '4'])
    expect(wrapper.find('[data-action="runden-alle-fest"]').exists()).toBe(false)
    expect(wrapper.find('[data-hinweis="runde-naechste"]').exists()).toBe(false)
  })

  it('ordnet das Festschreiben einer Klasse eine Runde mit anderen Klassen neu, fragt es erst (gedruckte Listen, 19.11.2026)', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: false })
    store.dispatch({ type: 'ADD_STARTERS', starters: mk('4', 4) })
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    fahre('pre', { ...VORLAUF, '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '4', runde: 'semi' })
    const wrapper = await verzahnung()
    const vorher = store.state.value.parallelPlaene.semi
    await wrapper.find('.parallel-klasse[data-klasse="1"] [data-action="runde-fest"]').trigger('click')
    await warte()
    const dialog = wrapper.find('[data-dialog="runde-neu-ordnen"]')
    expect(dialog.text()).toContain('Halbfinale neu ordnen?')
    expect(store.state.value.parallelPlaene.semi).toBe(vorher)
    // Abbrechen ändert nichts; bestätigt wird verzahnt.
    await dialog.find('[data-action="dialog-abbrechen"]').trigger('click')
    await warte()
    expect(wrapper.find('[data-dialog="runde-neu-ordnen"]').exists()).toBe(false)
    expect(store.state.value.parallelPlaene.semi).toBe(vorher)
    await wrapper.find('.parallel-klasse[data-klasse="1"] [data-action="runde-fest"]').trigger('click')
    await warte()
    await wrapper.find('[data-action="runde-neu-ordnen-bestaetigen"]').trigger('click')
    await warte()
    expect(store.state.value.parallelPlaene.semi!.starts.map((s) => s.klasse)).toEqual(['1', '4', '1', '4', '1', '4', '1', '4'])
    // Ist in der Runde schon etwas erfasst, rückt nichts mehr: keine Rückfrage.
    store.dispatch({ type: 'PARALLEL_RUNDE_LOESEN', klasse: '1', runde: 'semi' })
    fahre('semi', { '4-1': [40] }, 5000)
    await warte()
    await wrapper.find('.parallel-klasse[data-klasse="1"] [data-action="runde-fest"]').trigger('click')
    await warte()
    expect(wrapper.find('[data-dialog="runde-neu-ordnen"]').exists()).toBe(false)
    expect(store.state.value.parallelPlaene.semi!.starts.map((s) => s.klasse)).toEqual(['4', '4', '4', '4', '1', '1', '1', '1'])
  })

  it('gedruckte Runde (20.11.2026): Drucken unter „Listen“ bindet sie, „Druck lösen“ fragt und gibt sie wieder frei', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: false })
    store.dispatch({ type: 'ADD_STARTERS', starters: mk('4', 4) })
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    fahre('pre', { ...VORLAUF, '4-1': [40, 40], '4-2': [41, 41], '4-3': [42, 42], '4-4': [43, 43] })
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '4', runde: 'semi' })
    // Die Laufzettel des Parallelslaloms drucken (Strg+P oder Knopf: beides löst `beforeprint` aus).
    const liste = mount(ListsView, mit(store))
    await liste.find('.list-kinds button[data-kind="laufzettel"]').trigger('click')
    await liste.find('.disziplin-wahl button[data-disziplin="parallel"]').trigger('click')
    await warte()
    expect(store.state.value.parallelGedruckt).toEqual({})
    window.dispatchEvent(new Event('beforeprint'))
    await warte()
    // Der Vorlauf zählt nicht (er hängt an der Verzahnung); den Zeitpunkt setzt der Store.
    expect(Object.keys(store.state.value.parallelGedruckt)).toEqual(['semi'])
    expect(store.state.value.parallelGedruckt.semi).toBeGreaterThan(0)
    liste.unmount()

    const wrapper = await verzahnung()
    expect(wrapper.find('[data-hinweis="runden-gedruckt"]').text()).toContain('Halbfinale: Listen gedruckt am')
    expect(wrapper.find('.parallel-klasse[data-klasse="4"] li[data-runde="semi"] [data-gedruckt]').exists()).toBe(true)
    // Gedruckt: Klasse 1 kommt ohne Rückfrage ans Ende, nichts rückt.
    await wrapper.find('.parallel-klasse[data-klasse="1"] [data-action="runde-fest"]').trigger('click')
    await warte()
    expect(wrapper.find('[data-dialog="runde-neu-ordnen"]').exists()).toBe(false)
    expect(store.state.value.parallelPlaene.semi!.starts.map((s) => s.klasse)).toEqual(['4', '4', '4', '4', '1', '1', '1', '1'])

    // „Druck lösen“: erst Rückfrage, Abbrechen lässt den Vermerk stehen.
    await wrapper.find('[data-action="druck-loesen"][data-runde="semi"]').trigger('click')
    expect(wrapper.find('[data-dialog="druck-loesen"] h2').text()).toBe('Druck von Halbfinale lösen?')
    await wrapper.find('[data-dialog="druck-loesen"] [data-action="dialog-abbrechen"]').trigger('click')
    expect(store.state.value.parallelGedruckt.semi).toBeDefined()
    await wrapper.find('[data-action="druck-loesen"][data-runde="semi"]').trigger('click')
    await wrapper.find('[data-action="druck-loesen-bestaetigen"]').trigger('click')
    await warte()
    expect(store.state.value.parallelGedruckt).toEqual({})
    expect(wrapper.find('[data-hinweis="runden-gedruckt"]').exists()).toBe(false)
    expect(wrapper.find('[data-gedruckt]').exists()).toBe(false)
    // Jetzt ordnet ein neues Festschreiben wieder neu – nach der bisherigen Rückfrage.
    store.dispatch({ type: 'PARALLEL_RUNDE_LOESEN', klasse: '1', runde: 'semi' })
    await warte()
    await wrapper.find('.parallel-klasse[data-klasse="1"] [data-action="runde-fest"]').trigger('click')
    await warte()
    expect(wrapper.find('[data-dialog="runde-neu-ordnen"]').exists()).toBe(true)
  })

  it('gedruckte Runde: auch über WKR-Bögen, Startlisten und Druckdatei; bei gesperrtem Druck nichts', async () => {
    fahre('pre', VORLAUF)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    const drucke = async (wahl: (liste: VueWrapper) => Promise<void>) => {
      store.dispatch({ type: 'PARALLEL_DRUCK_LOESEN', runde: 'semi' })
      const liste = mount(ListsView, mit(store))
      await wahl(liste)
      await warte()
      window.dispatchEvent(new Event('beforeprint'))
      await warte()
      liste.unmount()
      return Object.keys(store.state.value.parallelGedruckt)
    }
    // WKR-Bögen des Parallelslaloms (ParallelWkrListen.vue meldet ihre Runden).
    expect(
      await drucke(async (l) => {
        await l.find('.list-kinds button[data-kind="wkr"]').trigger('click')
        await l.find('.disziplin-wahl button[data-disziplin="parallel"]').trigger('click')
      }),
    ).toEqual(['semi'])
    // Startlisten der Runden.
    expect(
      await drucke(async (l) => {
        await l.find('.list-kinds button[data-kind="starter"]').trigger('click')
        await l.find('.starter-arten button[data-art="parallel"]').trigger('click')
      }),
    ).toEqual(['semi'])
    // Druckdatei (Regel 960): Vor den Wertungslisten jeder Runde steht ihre Startliste.
    fahre('semi', { '1-1': [40, 40] }, 2000)
    expect(
      await drucke(async (l) => {
        await l.find('.list-kinds button[data-kind="druckdatei"]').trigger('click')
        await warteAufDruckdatei(l)
        expect(l.find('.druckdatei-teil[data-teil="startliste"][data-runde="semi"]').exists()).toBe(true)
      }),
    ).toEqual(['semi'])
    // Fehlt eine Startnummer, ist der Druck gesperrt: nichts vermerkt.
    store.dispatch({ type: 'UPDATE_STARTER', id: '1-6', patch: { startNr: '' } })
    expect(
      await drucke(async (l) => {
        await l.find('.list-kinds button[data-kind="wkr"]').trigger('click')
        await l.find('.disziplin-wahl button[data-disziplin="parallel"]').trigger('click')
      }),
    ).toEqual([])
  })

  it('unter DM vermerkt Drucken nichts', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: false })
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const vorher = store.state.value
    const liste = mount(ListsView, mit(store))
    await liste.find('.list-kinds button[data-kind="wkr"]').trigger('click')
    await warte()
    window.dispatchEvent(new Event('beforeprint'))
    await warte()
    expect(store.state.value).toBe(vorher)
    liste.unmount()
  })

  it('Löschen fragt nach und nennt, wie viele erfasste Werte der Runde mitgehen', async () => {
    fahre('pre', VORLAUF)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    const wrapper = await verzahnung()
    // Ohne Werte: Rückfrage ohne Warnung; Abbrechen lässt alles, wie es ist.
    await wrapper.find('[data-action="runde-loeschen"][data-runde="semi"]').trigger('click')
    expect(wrapper.find('[data-dialog="runde-loeschen"] h2').text()).toBe('Halbfinale für Klasse 1 löschen?')
    expect(wrapper.find('[data-warnung="runde-werte"]').exists()).toBe(false)
    await wrapper.find('[data-dialog="runde-loeschen"] [data-action="dialog-abbrechen"]').trigger('click')
    expect(store.state.value.parallelPlaene.semi).toBeDefined()

    fahre('semi', { '1-1': [40, 40], '1-2': [39] })
    await warte()
    await wrapper.find('[data-action="runde-loeschen"][data-runde="semi"]').trigger('click')
    expect(wrapper.find('[data-warnung="runde-werte"]').text()).toContain('Dabei gehen 3 erfasste Werte verloren')
    expect(wrapper.find('[data-warnung="runde-werte"]').text()).toContain('von 2 Startern')
    expect(wrapper.find('[data-action="runde-loeschen-bestaetigen"]').text()).toBe('Runde und 3 Werte löschen')
    await wrapper.find('[data-action="runde-loeschen-bestaetigen"]').trigger('click')
    await warte()
    expect(store.state.value.parallelPlaene.semi).toBeUndefined()
    expect(store.state.value.eingaben[attemptSchluessel('semi', 1)]).toBeUndefined()
    expect(wrapper.find('[data-dialog="runde-loeschen"]').exists()).toBe(false)
    expect(wrapper.find('[data-action="runde-fest"]').text()).toBe('Halbfinale festschreiben')
  })

  it('Gleichstand an der Grenze: Warnung, und angeboten wird die Wiederholung; ein veralteter Plan wird gemeldet', async () => {
    fahre('pre', { ...VORLAUF, '1-4': [43, 45], '1-5': [45, 43] })
    const wrapper = await verzahnung()
    expect(wrapper.find('[data-hinweis="runde-gleichstand"]').text()).toContain('104, 105')
    expect(wrapper.find('[data-action="runde-fest"]').text()).toBe('Vorlauf – Wiederholung festschreiben')
    await wrapper.find('[data-action="runde-fest"]').trigger('click')
    await warte()
    expect(wrapper.find('.panel[data-runde="rerun-pre-1"] h2').text()).toBe('Vorlauf – Wiederholung')
    expect(wrapper.find('[data-warnung="runde-veraltet"]').exists()).toBe(false)
    // Ein Protest hebt den Gleichstand auf: Die Wiederholung bleibt stehen, als veraltet gemeldet.
    fahre('pre', { '1-5': [45, 44] })
    await warte()
    expect(wrapper.find('[data-warnung="runde-veraltet"]').exists()).toBe(true)
    expect(wrapper.find('.parallel-weg li[data-runde="rerun-pre-1"]').attributes('data-veraltet')).toBe('true')
  })

  const listen = async (kind: string): Promise<VueWrapper> => {
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find(`.list-kinds button[data-kind="${kind}"]`).trigger('click')
    if (kind !== 'druckdatei') await wrapper.find('.disziplin-wahl button[data-disziplin="parallel"]').trigger('click')
    await warte()
    return wrapper
  }
  const blaetter = (wrapper: VueWrapper) => wrapper.findAll('.ergebnis-stapel[data-stapel="parallel"] .listen-seite').map((s) => `${s.find('.erg-kopf-titel').text()}`)
  /** Die Zellen der Spalte „UIM points“ einer Liste „Results“ (sonst der ersten); eine zusammengefasste mit „×n“ (über n Zeilen). */
  const uimZellen = (w: VueWrapper | ReturnType<VueWrapper['find']>) =>
    (w.classes().includes('listen-seite') ? w : w.find('.listen-seite[data-art="gesamt"]'))
      .findAll('tbody td[data-spalte="uim-punkte"]')
      .map((t) => (t.attributes('rowspan') ? `${t.text()} ×${t.attributes('rowspan')}` : t.text()))

  it('Wertungslisten je Runde und das Gesamtergebnis – englisch, mit Zeitstempel, O.O.D. und eigener Seitenzählung', async () => {
    bisEnde()
    const wrapper = await listen('ergebnis')
    expect(blaetter(wrapper)).toEqual(['Preliminary heat – Attempts', 'Preliminary heat – Results', 'Semi-finals – Attempts', 'Semi-finals – Results', 'Small final – Attempts', 'Small final – Results', 'Final – Attempts', 'Final – Results', 'Overall results'])
    expect(wrapper.findAll('[data-feld="perg-runde"] option').map((o) => o.text())).toEqual(['alle', 'Vorlauf', 'Halbfinale', 'Kleines Finale', 'Finale', 'Gesamtergebnis'])
    expect(wrapper.find('[data-hinweis="parallel-stage-fertig"]').text()).toContain('Klasse 1')
    expect(wrapper.find('[data-hinweis="parallel-stage-offen"]').exists()).toBe(false)

    // Halbfinale: wer um welche Plätze fährt, steht in der letzten Spalte.
    await wrapper.find('[data-feld="perg-runde"]').setValue('semi')
    await warte()
    expect(blaetter(wrapper)).toEqual(['Semi-finals – Attempts', 'Semi-finals – Results'])
    const letzte = (art: string) => wrapper.findAll(`.listen-seite[data-art="${art}"] tbody tr[data-starter]`).map((r) => `${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()} ${r.findAll('td').at(-1)!.text()}`)
    // Wer um welche Plätze fährt, steht als Block: eine Zelle je Finale über seine zwei Zeilen.
    expect(uimZellen(wrapper)).toEqual(['Final 1–2 ×2', 'Small final ×2'])
    expect(wrapper.findAll('.listen-seite[data-art="gesamt"] tbody tr[data-starter]').map((r) => `${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()}`)).toEqual(['1 102', '2 101', '3 104', '4 103'])
    // Jede Runde trägt ihren eigenen Zeitstempel.
    const stand = wrapper.find('.listen-seite[data-art="gesamt"] .erg-stand').text()
    // Kleines Finale und Finale: je eine eigene Liste „Results“ (21.11.2026) – Plätze 3/4 bzw. 1/2.
    await wrapper.find('[data-feld="perg-runde"]').setValue('small')
    await warte()
    expect(blaetter(wrapper)).toEqual(['Small final – Attempts', 'Small final – Results'])
    expect(letzte('gesamt')).toEqual(['3 103 225', '4 104 169'])
    await wrapper.find('[data-feld="perg-runde"]').setValue('final')
    await warte()
    expect(blaetter(wrapper)).toEqual(['Final – Attempts', 'Final – Results'])
    expect(letzte('gesamt')).toEqual(['1 101 400', '2 102 300'])
    expect(wrapper.find('.listen-seite[data-art="gesamt"] .erg-stand').text()).not.toBe(stand)

    // Gesamtergebnis: Plätze 1 bis 4 aus den Finals, ab Platz 5 aus dem Vorlauf.
    await wrapper.find('[data-feld="perg-runde"]').setValue('stage')
    await warte()
    const stage = wrapper.find('.listen-seite[data-art="stage"]')
    // Keine Spalte „Heat“ (Entscheidung des Nutzers): Der Platz sagt, aus welcher Runde die Summe stammt.
    expect(stage.findAll('.erg-spaltenkopf th').map((t) => t.text())).toEqual(['Rank.', 'No.', 'Surname', 'First name', 'Club', 'Combined time', 'UIM points'])
    expect(stage.findAll('tbody tr').map((r) => [0, 1, -2, -1].map((i) => r.findAll('td').at(i)!.text()).join(' | '))).toEqual([
      '1 | 101 | 82.00 | 400',
      '2 | 102 | 83.00 | 300',
      '3 | 103 | 60.00 | 225',
      '4 | 104 | 89.00 | 169',
      '5 | 105 | 100.00 | 127',
      '6 | 106 | 110.00 | 95',
    ])
    expect(stage.text()).not.toContain('Heat')
    expect(stage.find('[data-feld="unterschrift"]').text()).toContain('O.O.D.')
    expect(stage.find('.erg-stand').text()).not.toBe('')
  })

  it('mit Logos (16.11.2026): Attempts, Results jeder Runde und Overall results tragen sie auf jeder Seite, sonst alles wie ohne', async () => {
    bisEnde()
    const KOPF = ['.erg-kopf span:not(.erg-stand)', 'th.erg-kopfzelle'] as const
    const vorher = await listen('ergebnis')
    const ohne = seitenKoepfe(vorher.find('.ergebnis-stapel[data-stapel="parallel"]').element, ...KOPF)
    vorher.unmount()
    expect(ohne).toHaveLength(9)
    expect(ohne.every((x) => x.logos.length === 0)).toBe(true)
    setzeTestLogos(store)
    const wrapper = await listen('ergebnis')
    expect(blaetter(wrapper)).toEqual(['Preliminary heat – Attempts', 'Preliminary heat – Results', 'Semi-finals – Attempts', 'Semi-finals – Results', 'Small final – Attempts', 'Small final – Results', 'Final – Attempts', 'Final – Results', 'Overall results'])
    const mit = seitenKoepfe(wrapper.find('.ergebnis-stapel[data-stapel="parallel"]').element, ...KOPF)
    expect(mit.map((x) => x.logos)).toEqual(mit.map(() => ['links', 'rechts']))
    expect(ohneLogos(mit)).toEqual(ohneLogos(ohne))
    expect(wrapper.find('.listen-seite[data-art="stage"] th.erg-kopfzelle > .kopf-logos > .kopf-logos-mitte > .erg-kopf').exists()).toBe(true)
    wrapper.unmount()
  })

  it('hat eine Wiederholung Plätze entschieden, tragen sie ein Sternchen mit Fußnote – im Vorlauf und in den Overall results', async () => {
    fahre('pre', { ...VORLAUF, '1-4': [43, 45], '1-5': [45, 43] })
    const wrapper = await listen('ergebnis')
    const plaetze = (blatt: ReturnType<VueWrapper['find']>) => blatt.findAll('tbody tr[data-starter]').map((r) => `${r.findAll('td')[0].text()} ${r.findAll('td')[1].text()}`)
    // Vor dem Re-run: „Re-run“ steht je Zeile, noch kein Sternchen, keine Fußnote.
    expect(uimZellen(wrapper)).toEqual(['', '', '', 'Re-run', 'Re-run', '95'])
    expect(wrapper.find('.listen-seite[data-art="gesamt"] .erg-fuss').text()).not.toContain('re-run')
    expect(wrapper.find('[data-hinweis="parallel-gleichstand"]').text()).toContain('104, 105')
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'rerun-pre-1' })
    fahre('rerun-pre-1', { '1-4': [60, 60], '1-5': [50, 59] }, 2000)
    await warte()
    expect(blaetter(wrapper)).toEqual(['Preliminary heat – Attempts', 'Preliminary heat – Results', 'Preliminary heat – Re-run – Attempts', 'Preliminary heat – Re-run – Results'])
    const vorlauf = wrapper.findAll('.listen-seite[data-art="gesamt"]')[0]
    // Die Plätze 4 und 5 hat der Re-run entschieden: Sternchen daran, die Fußnote nach Pkt. 5.2.6 – statt eines Hinweises ohne Zeichen.
    expect(plaetze(vorlauf)).toEqual(['1 101', '2 102', '3 103', '4* 105', '5* 104', '6 106'])
    expect(vorlauf.findAll('tbody tr[data-wiederholt]').map((r) => r.attributes('data-starter'))).toEqual(['1-5', '1-4'])
    expect(vorlauf.find('[data-hinweis="stich"]').text()).toBe('* Ranking decided by the re-run (pt. 5.2.6): still a dead-heat situation where a decision was required – after running again only the time of the re-run is taken into account.')
    expect(vorlauf.find('[data-hinweis="fuss"]').exists()).toBe(false)
    expect(uimZellen(vorlauf)).toEqual(['Qualified ×4', '127', '95'])
    // Die Liste der Wiederholung selbst trägt keinen Vermerk: Dort entscheidet ihre eigene Zeit.
    const rerun = wrapper.findAll('.listen-seite[data-art="gesamt"]')[1]
    expect(rerun.find('tbody tr[data-wiederholt]').exists()).toBe(false)
    expect(rerun.find('.erg-fuss').text()).not.toContain('re-run')
    expect(wrapper.find('[data-hinweis="parallel-gleichstand"]').exists()).toBe(false)

    // Bis zum Ende: In den Overall results steht 104 auf Platz 5 – mit der Summe der Wiederholung und dem Sternchen.
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    fahre('semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-5': [44, 45] }, 3000)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'small' })
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'final' })
    fahre('small', { '1-3': [30, 30], '1-5': [44, 45] }, 4000)
    fahre('final', { '1-1': [41, 41], '1-2': [40, 43] }, 4500)
    await wrapper.find('[data-feld="perg-runde"]').setValue('stage')
    await warte()
    const stage = wrapper.find('.listen-seite[data-art="stage"]')
    expect(stage.findAll('tbody tr').map((r) => [0, 1, -2].map((i) => r.findAll('td').at(i)!.text()).join(' | '))).toEqual([
      '1 | 101 | 82.00',
      '2 | 102 | 83.00',
      '3 | 103 | 60.00',
      '4 | 105 | 89.00',
      '5* | 104 | 120.00',
      '6 | 106 | 110.00',
    ])
    expect(stage.find('[data-hinweis="stich"]').text()).toContain('only the time of the re-run is taken into account')
    // Halbfinale, Kleines Finale und Finale hat kein Re-run entschieden: dort kein Sternchen.
    await wrapper.find('[data-feld="perg-runde"]').setValue('semi')
    await warte()
    expect(wrapper.find('tbody tr[data-wiederholt]').exists()).toBe(false)
  })

  it('solange eine Klasse nicht alle Runden gefahren ist, gibt es kein Gesamtergebnis – der Hinweis nennt die Runde', async () => {
    fahre('pre', VORLAUF)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    const wrapper = await listen('ergebnis')
    expect(blaetter(wrapper)).toEqual(['Preliminary heat – Attempts', 'Preliminary heat – Results'])
    expect(wrapper.find('[data-hinweis="parallel-stage-offen"]').text()).toContain('Klasse 1 (Halbfinale)')
  })

  it('Druckdatei: Gesamtergebnis und Runden einzeln wählbar; unfertig nennt die offenen Klassen des Parallelslaloms', async () => {
    fahre('pre', VORLAUF)
    const wrapper = await listen('druckdatei')
    await warteAufDruckdatei(wrapper)
    expect(wrapper.find('[data-hinweis="druckdatei-unfertig"]').text()).toContain('Parallel-Slalom ohne Gesamtergebnis – Klasse 1 (Halbfinale)')
    bisEnde()
    await warteAufDruckdatei(wrapper)
    // Nur der Parallelslalom ist gefahren und fertig: Ohne Werte zählt das Manövrieren nicht – nichts ist mehr offen.
    expect(wrapper.find('[data-hinweis="druckdatei-unfertig"]').exists()).toBe(false)
    expect(wrapper.findAll('.druckdatei-wahl input[data-runde]').map((i) => i.attributes('data-runde'))).toEqual(['stage', 'pre', 'semi', 'small', 'final'])
    const teil = () => wrapper.findAll('.druckdatei [data-teil="parallel"] .listen-seite').map((s) => s.find('.erg-kopf-titel').text())
    // Erst das Gesamtergebnis, dann die Runden in ihrer Folge.
    expect(teil()).toEqual(['Overall results', 'Preliminary heat – Attempts', 'Preliminary heat – Results', 'Semi-finals – Attempts', 'Semi-finals – Results', 'Small final – Attempts', 'Small final – Results', 'Final – Attempts', 'Final – Results'])
    await wrapper.find('.druckdatei-wahl input[data-runde="pre"]').setValue(false)
    await wrapper.find('.druckdatei-wahl input[data-runde="semi"]').setValue(false)
    await wrapper.find('.druckdatei-wahl input[data-runde="small"]').setValue(false)
    await warteAufDruckdatei(wrapper)
    expect(teil()).toEqual(['Overall results', 'Final – Attempts', 'Final – Results'])
  })

  it('Erfassung und Scan (21.11.2026): Kleines Finale und Finale haben je eigene Bögen und Laufzettel – SMALL und FINAL verwechseln sich nicht', async () => {
    fahre('pre', VORLAUF)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    fahre('semi', { '1-1': [40, 40], '1-2': [39, 40], '1-3': [45, 45], '1-4': [44, 45] }, 2000)
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'small' })
    const wrapper = mount(ErfassungView, mit(store))
    const k = store.state.value.kennung
    const abschnitte = () => wrapper.findAll('.eingabe-stapel [data-abschnitt]').map((a) => a.attributes('data-abschnitt'))
    meldeScan(`ALC2.${k}.UIM2026.PARALLEL.SMALL.A`)
    await warte()
    expect(wrapper.find('.scan-hinweis').text()).toContain('Kleines Finale')
    expect(abschnitte()).toEqual(['parallel|small|A|zeit', 'parallel|small|A|steg', 'parallel|small|A|parallelparcours'])
    // Das Finale ist noch nicht festgeschrieben: sein Code wird abgewiesen, obwohl das Kleine Finale steht.
    meldeScan(`ALC2.${k}.UIM2026.PARALLEL.FINAL.A`)
    await warte()
    expect(wrapper.find('.scan-hinweis--fehler').text()).toContain('FINAL')
    store.dispatch({ type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'final' })
    await warte()
    meldeScan(`ALC2.${k}.UIM2026.PARALLEL.FINAL.B.STEG.S1`)
    await warte()
    expect(wrapper.findAll('.erf-titel span').map((s) => s.text()).join(' | ')).toBe('Steg | Finale | Parcours B')
    // Je Runde nur ihre eigenen Starter: im Finale die beiden Ersten des Halbfinales.
    expect(wrapper.findAll('.erf-tabelle tbody tr[data-zeile]').map((z) => z.attributes('data-starter')).sort()).toEqual(['1-1', '1-2'])
    wrapper.unmount()
  })

  it('ohne erfasste Werte im Parallelslalom mahnt die Druckdatei ihn nicht an (nur Manövrieren gefahren)', async () => {
    const wrapper = await listen('druckdatei')
    await warteAufDruckdatei(wrapper)
    expect(wrapper.find('[data-hinweis="druckdatei-unfertig"]').exists() && wrapper.find('[data-hinweis="druckdatei-unfertig"]').text().includes('Parallel-Slalom')).toBe(false)
  })
})
