import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import ErfassungView from './ErfassungView.vue'
import ListsView from './ListsView.vue'
import WkrEinteilung from '../components/WkrEinteilung.vue'
import { createStore, storeKey, type Store } from '../state/store'
import { meldeScan, scanBeenden } from '../lib/scan'
import { vergissAlles } from '../lib/merken'
import { setLocale } from '../i18n'
import type { ClassId, Starter } from '../types'

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
  await nextTick()
  await nextTick()
  await nextTick()
}

describe('Parallelslalom: Listen, Laufzettel, Einteilung und Erfassung des Vorlaufs', () => {
  let store: Store

  beforeEach(() => {
    localStorage.clear()
    vergissAlles()
    scanBeenden()
    setLocale('de')
    store = createStore()
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    // E: 3 Starter (ein Dummy), 1: zwei, 4: zwei → 4 Paare, 8 Starts.
    store.dispatch({ type: 'ADD_STARTERS', starters: [...mk('E', 3), ...mk('1', 2), ...mk('4', 2)] })
  })
  afterEach(() => {
    setLocale('de')
    document.body.innerHTML = ''
  })

  const listen = async (kind: string, disziplin = 'parallel'): Promise<VueWrapper> => {
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find(`.list-kinds button[data-kind="${kind}"]`).trigger('click')
    await wrapper.find(`.disziplin-wahl button[data-disziplin="${disziplin}"]`).trigger('click')
    await warte()
    return wrapper
  }

  it('Listen: ohne festgeschriebenen Plan nur der Hinweis; danach sechs Listen je Runde', async () => {
    const wrapper = await listen('wkr')
    expect(wrapper.find('[data-hinweis="parallel-plan"]').text()).toContain('festgeschrieben')
    // Die Sperre bis zur festgeschriebenen Verzahnung gilt den Bögen des Manövrierens; die des
    // Parallelslaloms hängen an ihren festgeschriebenen Runden (Entscheidung des Nutzers vom 15.11.2026).
    expect(wrapper.find('[data-hinweis="vor-verzahnung"]').exists()).toBe(false)
    await wrapper.find('.disziplin-wahl button[data-disziplin="manoever"]').trigger('click')
    await warte()
    expect(wrapper.find('[data-hinweis="vor-verzahnung"]').exists()).toBe(true)
    await wrapper.find('.disziplin-wahl button[data-disziplin="parallel"]').trigger('click')
    await warte()
    expect(wrapper.findAll('.wkr-listen .bogen')).toHaveLength(0)
    expect(wrapper.find('.btn.primary').attributes('disabled')).toBeDefined()

    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    await warte()
    expect(wrapper.find('[data-hinweis="parallel-plan"]').exists()).toBe(false)
    const boegen = wrapper.findAll('.wkr-listen .bogen')
    expect(boegen.map((b) => b.attributes('data-liste'))).toEqual(['zeit', 'steg', 'parallelparcours', 'zeit', 'steg', 'parallelparcours'])
    // Kopf: Runde und Racecourse in der Sprache des Bogens (UIM: englisch); Spalten Start, Nr., Klasse, Attempt vorn.
    expect(boegen[0].findAll('.bk-zelle').map((z) => z.text())).toEqual(['Time', 'Preliminary heat', 'Racecourse A'])
    expect(boegen[3].findAll('.bk-zelle').map((z) => z.text())).toEqual(['Time', 'Preliminary heat', 'Racecourse B'])
    expect(boegen[0].findAll('thead tr:nth-child(2) th').slice(0, 4).map((t) => t.text())).toEqual(['Start', 'No.', 'Cl.', 'Attempt'])
    // Zeile n ist auf allen sechs Listen derselbe Start; keine Leerzeilen.
    for (const b of boegen) expect(b.findAll('tbody tr[data-zeile]').map((r) => r.attributes('data-zeile'))).toEqual(['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'])
    // Dummy: schraffierte Zeile ohne Eingabe, auf A und B in je einem Start; Linie am Blockende.
    expect(boegen[0].findAll('tr[data-ohne="dummy"]').length + boegen[3].findAll('tr[data-ohne="dummy"]').length).toBe(2)
    const dummy = [boegen[0], boegen[3]].flatMap((b) => b.findAll('tr[data-ohne="dummy"]'))[0]
    expect(dummy.classes()).toContain('bt-ohne')
    expect(dummy.find('.bt-dummy').text()).toBe('Dummy')
    expect(boegen[0].findAll('tbody tr[data-zeile]').at(-1)!.classes()).toContain('bt-blockende')
    // Auswahl: ein Racecourse, eine Liste.
    await wrapper.find('select[data-feld="pwkr-racecourse"]').setValue('B')
    await wrapper.find('select[data-feld="pwkr-liste"]').setValue('steg')
    await warte()
    expect(wrapper.findAll('.wkr-listen .bogen').map((b) => b.findAll('.bk-zelle').map((z) => z.text()).join('|'))).toEqual(['Pontoon|Preliminary heat|Racecourse B'])
    wrapper.unmount()
  })

  it('Listen: Die Sprache gilt je Racecourse – A deutsch, B englisch; das Manövrieren bleibt davon unberührt', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    store.dispatch({ type: 'SET_WKR_SPRACHE', zellen: [{ parcoursId: 'racecourse-a', typeId: 'zeit' }], sprache: 'de' })
    const wrapper = await listen('wkr')
    const zeit = wrapper.findAll('.wkr-listen .bogen[data-liste="zeit"]')
    expect(zeit.map((b) => b.findAll('.bk-zelle').map((z) => z.text()))).toEqual([
      ['Zeit', 'Vorlauf', 'Parcours A'],
      ['Time', 'Preliminary heat', 'Racecourse B'],
    ])
    // Die Auswahl nennt die Liste in der Sprache des Regelwerks, weil A und B verschieden sind.
    expect(wrapper.findAll('select[data-feld="pwkr-liste"] option').map((o) => o.text())).toEqual(['alle', 'Time', 'Pontoon', 'Parallel slalom'])
    // Gleiche Sprache auf A und B: dann so, wie sie auf beiden Bögen heißt.
    store.dispatch({ type: 'SET_WKR_SPRACHE', zellen: [{ parcoursId: 'racecourse-b', typeId: 'zeit' }], sprache: 'de' })
    await warte()
    expect(wrapper.findAll('select[data-feld="pwkr-liste"] option').map((o) => o.text())[1]).toBe('Zeit')
    wrapper.unmount()
    const manoever = await listen('wkr', 'manoever')
    expect(manoever.find('.wkr-listen .bogen[data-liste="zeit"] .bk-liste').text()).toBe('Time')
    manoever.unmount()
  })

  it('Listen des Manövrierens bleiben, wie sie sind: keine Spalten Start/Attempt, Klasse und Lauf im Kopf', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const wrapper = await listen('wkr', 'manoever')
    const boegen = wrapper.findAll('.wkr-listen .bogen')
    expect(boegen.length).toBeGreaterThan(6)
    expect(wrapper.findAll('.wkr-listen .bt-start')).toHaveLength(0)
    expect(wrapper.findAll('.wkr-listen .bt-blockende')).toHaveLength(0)
    expect(boegen[0].findAll('.bk-zelle').map((z) => z.text())).toContain('Attempt 1')
    wrapper.unmount()
  })

  it('Starterlisten: die Startliste der Runde – A und B nebeneinander oder je Racecourse eine eigene, mit denselben Start-Nummern', async () => {
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find('.list-kinds button[data-kind="starter"]').trigger('click')
    await wrapper.find('.starter-arten button[data-art="parallel"]').trigger('click')
    await warte()
    // Ohne festgeschriebenen Plan: der Hinweis, keine Liste.
    expect(wrapper.find('[data-hinweis="parallel-plan"]').exists()).toBe(true)
    expect(wrapper.find('.parallel-startliste .sheet-section').exists()).toBe(false)
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    await warte()
    // Vorgabe: die gemeinsame Liste (wie in der Druckdatei).
    expect(wrapper.findAll('.parallel-startliste .sheet-section').map((d) => d.attributes('data-liste'))).toEqual(['startliste:pre'])
    const gemeinsam = wrapper.findAll('.parallel-startliste tr[data-start]').map((r) => r.attributes('data-start'))
    await wrapper.find('select[data-feld="start-racecourse"]').setValue('je')
    await warte()
    const listen = wrapper.findAll('.parallel-startliste .sheet-section')
    expect(listen.map((d) => d.attributes('data-liste'))).toEqual(['startliste:pre:A', 'startliste:pre:B'])
    expect(listen[0].find('[data-feld="runde"]').text()).toBe('Parallel slalom · Preliminary heat · Racecourse A')
    expect(listen[0].findAll('.sheet-cols th').map((t) => t.text())).toEqual(['Start', 'Attempt', 'Class', 'No.', 'Surname', 'First name', 'Club'])
    for (const l of listen) {
      // Je Start eine Zeile, die Start-Nummern wie auf der gemeinsamen Liste und den Listen der race officials.
      expect(l.findAll('tr[data-start]').map((r) => r.attributes('data-start'))).toEqual(gemeinsam)
    }
    // Der Dummy (Klasse E, drei Starter) ist auf genau einer der beiden Listen eine schraffierte Zeile.
    const dummys = listen.flatMap((l) => l.findAll('tr[data-ohne="dummy"]'))
    expect(dummys).toHaveLength(2)
    expect(dummys[0].find('.psl-dummy').text()).toBe('Dummy')
    // Wer auf A fährt, steht auf der Liste von A – der Partner im selben Start auf der von B.
    const nummer = (l: VueWrapper | ReturnType<VueWrapper['find']>, start: string) => l.find(`tr[data-start="${start}"] td:nth-child(4)`).text()
    expect(new Set([nummer(listen[0], '1'), nummer(listen[1], '1')]).size).toBe(2)
    await wrapper.find('select[data-feld="start-racecourse"]').setValue('B')
    await warte()
    expect(wrapper.findAll('.parallel-startliste .sheet-section').map((d) => d.attributes('data-liste'))).toEqual(['startliste:pre:B'])
    wrapper.unmount()
  })

  const startlisten = async (racecourse?: 'je'): Promise<VueWrapper> => {
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find('.list-kinds button[data-kind="starter"]').trigger('click')
    await wrapper.find('.starter-arten button[data-art="parallel"]').trigger('click')
    await warte()
    if (racecourse) await wrapper.find('select[data-feld="start-racecourse"]').setValue(racecourse)
    await warte()
    return wrapper
  }

  it('Startlisten: abwechselnd weiß und grau wie die Listen der race officials – Dummy und entfallener Start bleiben weiß und schraffiert', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    // Das Paar der Klasse 4 gibt es nicht mehr: Seine beiden Starts entfallen, die Zeilen bleiben.
    store.dispatch({ type: 'REMOVE_STARTER', id: '4-1' })
    store.dispatch({ type: 'REMOVE_STARTER', id: '4-2' })
    const wrapper = await startlisten()
    /** Je Zeile: grau („g“) oder weiß („w“), dahinter „x“ für eine Zeile ohne Starter (Dummy, entfallen). */
    const muster = (liste: ReturnType<VueWrapper['find']>, ohne: (r: ReturnType<VueWrapper['find']>) => boolean) =>
      liste.findAll('tr[data-start]').map((r) => `${r.classes().includes('shade') ? 'g' : 'w'}${ohne(r) ? 'x' : ''}`)
    const gemeinsam = muster(wrapper.find('.parallel-startliste .sheet-section'), (r) => r.classes().includes('psl-entfaellt'))
    expect(gemeinsam).toHaveLength(8)
    // Jede zweite Zeile grau, über die ganze Liste gezählt; ein entfallener Start zählt mit, bleibt aber weiß.
    gemeinsam.forEach((z, i) => expect(z, `Zeile ${i + 1}`).toBe(z.endsWith('x') ? 'wx' : (i + 1) % 2 === 0 ? 'g' : 'w'))
    expect(gemeinsam.filter((z) => z === 'wx')).toHaveLength(2)
    expect(gemeinsam.some((z, i) => z === 'wx' && (i + 1) % 2 === 0)).toBe(true)
    // Der Dummy steht in einer seiner Zeilen neben einem Starter: Dessen Zeile wird grau, die Zelle des Dummys bleibt schraffiert.
    const dummy = wrapper.findAll('.parallel-startliste tr[data-start]').filter((r) => r.find('td.psl-dummy').exists() && !r.classes().includes('psl-entfaellt'))
    expect(dummy.length).toBeGreaterThan(0)
    expect(dummy.some((r) => r.classes().includes('shade'))).toBe(true)

    // Je Racecourse: dieselbe Regel; die Zeile ohne Starter (Dummy, entfallener Start) ist weiß.
    await wrapper.find('select[data-feld="start-racecourse"]').setValue('je')
    await warte()
    const je = wrapper.findAll('.parallel-startliste .sheet-section').map((l) => muster(l, (r) => r.classes().includes('psl-ohne')))
    expect(je).toHaveLength(2)
    for (const liste of je) liste.forEach((z, i) => expect(z, `Zeile ${i + 1}`).toBe(z.endsWith('x') ? 'wx' : (i + 1) % 2 === 0 ? 'g' : 'w'))
    // Zwei entfallene Starts auf jeder Liste, dazu der Dummy auf einer der beiden.
    expect(je.flat().filter((z) => z === 'wx')).toHaveLength(6)

    // Dieselbe Einstellung wie auf den Listen der race officials: aus = alles weiß.
    store.dispatch({ type: 'SET_PARALLEL_ZEBRA', zebra: false })
    await warte()
    expect(wrapper.findAll('.parallel-startliste tr.shade')).toHaveLength(0)
    wrapper.unmount()
  })

  describe('Startlisten im Browser: Ein Block bleibt auf einer Seite, ausgeglichen wird nicht', () => {
    /** Höhe einer Zeile in px; Kopf 104 px – Platz für die Zeilen: (1024,25 − 104) / Zeile (wie components/ListenDokument.test.ts). */
    let zeilePx = 100
    function rect(this: HTMLElement): DOMRect {
      let height = 0
      if (this.matches('.parallel-startliste tbody tr')) height = zeilePx
      else if (this.classList.contains('listen-seite-inhalt') && this.closest('.parallel-startliste')) height = 104 + this.querySelectorAll('tbody tr').length * zeilePx
      return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: height, width: 0, height, toJSON: () => ({}) }
    }
    afterEach(() => vi.restoreAllMocks())

    it.each([
      // 9 Zeilen je Seite: Der dritte 4er-Block passt nicht mehr – 8 + 8 statt 9 + 7.
      [100, [8, 8]],
      // 13 Zeilen je Seite: Der erste 2er-Block passt nicht mehr – 12 + 4; die kurze letzte Seite bleibt (kein Ausgleich auf 8 + 8).
      [70, [12, 4]],
    ])('Zeile %i px → Zeilen je Seite %j – gemeinsam und je Racecourse', async (px, erwartet) => {
      zeilePx = px
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rect)
      // Klein: E (2 Paare, eins mit Dummy), 1 (1 Paar), 2 (2 Paare) → 5 Paare; groß: 4 (1 Paar), 5 (2 Paare) → 3.
      // Blöcke: drei 4er (je ein kleines und ein großes Paar), dann zwei 2er – 16 Starts.
      store.dispatch({ type: 'ADD_STARTERS', starters: [...mk('2', 4), ...mk('5', 4)] })
      store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
      for (const art of [undefined, 'je'] as const) {
        const wrapper = await startlisten(art)
        const listen = wrapper.findAll('.parallel-startliste .sheet-section')
        expect(listen).toHaveLength(art ? 2 : 1)
        for (const liste of listen) {
          const seiten = liste.findAll('.listen-seite')
          expect(seiten.map((s) => s.findAll('tbody tr').length)).toEqual(erwartet)
          // Jeder Block steht ganz auf einer Seite: kein Block auf zwei Seiten, keiner gekürzt.
          const bloecke = seiten.flatMap((s, i) => s.findAll('tbody.psl-block').map((b) => ({ seite: i, block: b.attributes('data-block'), zeilen: b.findAll('tr').length })))
          expect(new Set(bloecke.map((b) => b.block)).size).toBe(bloecke.length)
          expect(bloecke.map((b) => b.zeilen)).toEqual([4, 4, 4, 2, 2])
          expect(seiten.map((s) => s.attributes('data-seiten'))).toEqual(erwartet.map(() => String(erwartet.length)))
        }
        wrapper.unmount()
      }
    })
  })

  it('unter der DM gibt es keine Wahl der Disziplin', async () => {
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    const wrapper = mount(ListsView, mit(store))
    await wrapper.find('.list-kinds button[data-kind="wkr"]').trigger('click')
    await warte()
    expect(wrapper.find('.disziplin-wahl').exists()).toBe(false)
    wrapper.unmount()
  })

  it('Laufzettel: je Runde zwei, einer je Racecourse mit den Kästchen seiner Listen; die Schritte nur auf A', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const wrapper = await listen('laufzettel')
    const zettel = wrapper.findAll('.laufzettel')
    expect(zettel.map((z) => z.attributes('data-zettel'))).toEqual(['parallel|pre|A', 'parallel|pre|B'])
    expect(zettel.map((z) => z.find('.lz-klasse').text())).toEqual(['Preliminary heat', 'Preliminary heat'])
    expect(zettel.map((z) => z.find('.lz-parcours').text())).toEqual(['Racecourse A', 'Racecourse B'])
    for (const z of zettel) expect(z.findAll('.lz-oben .lz-liste li').map((l) => l.text().replace(/\s+/g, ' '))).toEqual(['Time', 'Pontoon', 'Parallel slalom'])
    expect(zettel[0].find('.lz-schritte').exists()).toBe(true)
    expect(zettel[1].find('.lz-schritte').exists()).toBe(false)
    // Zettel B sagt, wo die Schritte stehen (Entscheidung 16.11.2026); A braucht den Verweis nicht.
    expect(zettel[1].find('.lz-verweis').text()).toBe('Scoring: see the checklist for Racecourse A')
    expect(zettel[0].find('.lz-verweis').exists()).toBe(false)
    wrapper.unmount()
  })

  it('Einteilung: race officials je Racecourse A und B für Zeit, Steg und Fahrweg – mit Sprache je Racecourse und Liste', async () => {
    const wrapper = mount(WkrEinteilung, mit(store))
    const tabelle = wrapper.find('[data-tabelle="wkr-parallel"]')
    expect(tabelle.findAll('thead th').map((t) => t.text())).toEqual(['Liste', 'Parcours A', 'Parcours B'])
    expect(tabelle.findAll('tbody th').map((t) => t.text())).toEqual(['Time', 'Pontoon', 'Parallel slalom'])
    await tabelle.find('input[data-feld="racecourse-b|parallelparcours"]').setValue('Tom Test')
    expect(store.state.value.einteilung).toEqual({ 'racecourse-b': { parallelparcours: 'Tom Test' } })
    // Die Sprache steht neben dem Namen und gilt nur für diesen Racecourse – nicht für A, nicht für das Manövrieren.
    await tabelle.find('select[data-feld="wkr-sprache|racecourse-b|parallelparcours"]').setValue('de+en')
    expect(store.state.value.wkrSprachen).toEqual({ 'racecourse-b': { parallelparcours: 'de+en' } })
    await tabelle.find('select[data-feld="wkr-sprache|racecourse-a|zeit"]').setValue('de')
    expect(store.state.value.wkrSprachen).toEqual({ 'racecourse-b': { parallelparcours: 'de+en' }, 'racecourse-a': { zeit: 'de' } })
    expect((wrapper.find('select[data-feld="wkr-sprache|par_1|zeit"]').element as HTMLSelectElement).value).toBe('en')
    // Unter der DM gibt es die Tabelle nicht.
    store.dispatch({ type: 'SET_REGELWERK', regelwerk: 'dm-2026' })
    await nextTick()
    expect(wrapper.find('[data-tabelle="wkr-parallel"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('Erfassung: je Racecourse und Liste; die Werte hängen an Starter und Attempt, der Dummy hat keine Felder', async () => {
    const wrapper = mount(ErfassungView, mit(store))
    await wrapper.find('.eingabe-disziplin button[data-disziplin="parallel"]').trigger('click')
    await warte()
    // Ohne festgeschriebenen Plan: Hinweis, keine Tabelle – die Wahl der Disziplin bleibt.
    expect(wrapper.find('[data-hinweis="parallel-plan"]').exists()).toBe(true)
    expect(wrapper.find('.erf-tabelle').exists()).toBe(false)
    expect(wrapper.find('.eingabe-disziplin').exists()).toBe(true)

    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    await warte()
    expect(wrapper.findAll('.eingabe-wahl select').map((s) => s.attributes('data-feld'))).toEqual(['erf-parcours', 'erf-liste'])
    expect(wrapper.findAll('.erf-titel span').map((s) => s.text()).join(' | ')).toBe('Zeit | Vorlauf | Parcours A')
    expect(wrapper.findAll('.erf-tabelle thead tr:first-child th').slice(0, 4).map((t) => t.text())).toEqual(['Start', 'Nr.', 'Kl.', 'Versuch'])
    const zeilen = wrapper.findAll('.erf-tabelle tbody tr[data-zeile]')
    expect(zeilen).toHaveLength(8)
    const plan = store.state.value.parallelPlaene.pre!
    // Zeile n = Start n des Plans auf Racecourse A.
    expect(zeilen.map((z) => z.attributes('data-starter') ?? null)).toEqual(plan.starts.map((s) => s.a))
    const ohne = zeilen.filter((z) => z.attributes('data-ohne') === 'dummy')
    expect(ohne).toHaveLength(plan.starts.filter((s) => s.a === null).length)
    expect(ohne.every((z) => z.findAll('input').length === 0)).toBe(true)
    const gesamt = plan.starts.filter((s) => s.a !== null).length
    expect(wrapper.find('.erf-stand-text').text()).toBe(`0 von ${gesamt} erfasst`)
    // Tippen: unter parallel:pre/<Attempt> und der Starter-ID.
    const zeile = zeilen.find((z) => z.attributes('data-starter') !== undefined)!
    const id = zeile.attributes('data-starter')!
    const attempt = zeile.attributes('data-attempt')!
    const eingabe = zeile.find('td[data-spalte="zeit1"] input')
    await eingabe.setValue('1,0512')
    await eingabe.trigger('change')
    await eingabe.trigger('blur')
    await warte()
    expect(Object.keys(store.state.value.eingaben)).toEqual([`parallel:pre/${attempt}`])
    expect(Object.keys(store.state.value.eingaben[`parallel:pre/${attempt}`])).toEqual([id])
    // Auf Racecourse B steht derselbe Starter mit dem anderen Attempt – dort ist nichts erfasst.
    await wrapper.find('select[data-feld="erf-parcours"]').setValue('racecourse-b')
    await warte()
    expect(wrapper.findAll('.erf-titel span').map((s) => s.text()).join(' | ')).toBe('Zeit | Vorlauf | Parcours B')
    const drueben = wrapper.findAll('.erf-tabelle tbody tr[data-zeile]').find((z) => z.attributes('data-starter') === id)!
    expect(drueben.attributes('data-attempt')).toBe(attempt === '1' ? '2' : '1')
    expect(wrapper.find('.erf-stand-text').text()).toMatch(/^0 von /)
    wrapper.unmount()
  })

  it('Scan: Der Laufzettel eines Racecourse zeigt nur dessen drei Listen untereinander, ein Bogen-Code seine Liste; ALC1 führt zum Manövrieren', async () => {
    store.dispatch({ type: 'SET_VERZAHNUNG_LOCK', locked: true })
    const wrapper = mount(ErfassungView, mit(store))
    // Die Kennung der Veranstaltung vergibt der Store selbst.
    const k = store.state.value.kennung
    meldeScan(`ALC2.${k}.UIM2026.PARALLEL.PRE.A`)
    await warte()
    expect(wrapper.find('.scan-hinweis').text()).toContain('Laufzettel')
    expect(wrapper.find('.scan-hinweis').text()).toContain('Vorlauf')
    expect(wrapper.find('.scan-hinweis').text()).toContain('Parcours A')
    const abschnitte = () => wrapper.findAll('.eingabe-stapel [data-abschnitt]').map((a) => a.attributes('data-abschnitt'))
    expect(abschnitte()).toEqual(['parallel|pre|A|zeit', 'parallel|pre|A|steg', 'parallel|pre|A|parallelparcours'])
    // Auch die Sprungleiste nennt nichts von B.
    expect(wrapper.findAll('.eingabe-sprung [data-sprung]').map((a) => a.attributes('data-sprung'))).toEqual(abschnitte())
    expect(wrapper.find('.eingabe-disziplin .active').attributes('data-disziplin')).toBe('parallel')
    meldeScan(`ALC2.${k}.UIM2026.PARALLEL.PRE.B`)
    await warte()
    expect(abschnitte()).toEqual(['parallel|pre|B|zeit', 'parallel|pre|B|steg', 'parallel|pre|B|parallelparcours'])
    meldeScan(`ALC2.${k}.UIM2026.PARALLEL.PRE.B.STEG.S1`)
    await warte()
    expect(wrapper.findAll('.erf-titel span').map((s) => s.text()).join(' | ')).toBe('Steg | Vorlauf | Parcours B')
    // Eine Runde ohne Plan wird abgewiesen.
    meldeScan(`ALC2.${k}.UIM2026.PARALLEL.SEMI.A`)
    await warte()
    expect(wrapper.find('.scan-hinweis--fehler').text()).toContain('SEMI')
    // Ein alter Code des Manövrierens bleibt lesbar und führt dorthin zurück.
    const parcours = store.state.value.parcoursList[0]
    meldeScan(`ALC1.${k}.UIM2026.${store.state.value.aufbau.toUpperCase()}.${parcours.id.replace(/[^a-z0-9]/gi, '').toUpperCase()}.${parcours.classIds[0]}.1`)
    await warte()
    expect(wrapper.find('.scan-hinweis--ok').exists()).toBe(true)
    expect(wrapper.find('.eingabe-disziplin .active').attributes('data-disziplin')).toBe('manoever')
    wrapper.unmount()
  })
})
