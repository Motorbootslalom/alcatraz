/// <reference types="node" />
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import AnzeigeTafel from './AnzeigeTafel.vue'
import { reducer } from '../../state/reducer'
import { sichtOeffentlich } from '../../betrieb/sicht'
import { PARALLEL_BEREICH } from '../../betrieb/folge'
import { fahreRunde, parallelStarter, uimParallelStand } from '../../testHilfen'
import type { AppState, BereichId, ParallelAnordnung, ParallelRunde } from '../../types'

// Von der Platte gelesen: Vitest liefert für CSS-Importe (auch „?raw“) leeren Text (wie styles/blatt.test.ts).
const anzeigeCss = readFileSync(`${process.cwd()}/src/styles/anzeige.css`, 'utf8')
/** Eine Regel der Tafel am CSS-Text: Stelle in der Datei und Rumpf (happy-dom rechnet kein CSS). */
function regel(selektor: string) {
  const i = anzeigeCss.indexOf(`\n${selektor} {`)
  expect(i, selektor).toBeGreaterThan(0)
  return { i, rumpf: anzeigeCss.slice(i, anzeigeCss.indexOf('}', i)) }
}

// Die Anzeigetafel im Parallelslalom (Etappe E4) – wie der Aushang nach UIM 960 (views/UimAushang.test.ts) auf
// Englisch nach dem Rulebook: „racecourse“, „attempt“ (Pkt. 4.4), die Runden „Preliminary heat“, „Semi-finals“,
// „Finals“, „Re-run“ (Pkt. 5.2.2, 5.2.6), Klasse E heißt „Dolphin“. Racecourse A und B stehen gleichzeitig da.
// Alle Starter sind erfunden (Vor<klasse><n>/Nach<klasse><n>, Musterclub).

const P = PARALLEL_BEREICH
const beginne = (s: AppState, runde: ParallelRunde) => reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P, punkt: `runde:${runde}` })
function naechster(s: AppState, zeit: number): AppState {
  const b = sichtOeffentlich(s).bereiche.find((x) => x.id === P)!
  return reducer(s, { type: 'BETRIEB_ZEIGEN', bereich: P, ref: b.offen[0].key, vorher: b.aktuell?.key ?? null, zeit })
}

const offen: { unmount: () => void }[] = []
/** Nur der Parallelslalom (`#/anzeige/parallel`); `null` = die gemeinsame Tafel. */
function tafel(s: AppState, bereiche: BereichId[] | null = [P]) {
  const w = mount(AnzeigeTafel, { props: { sicht: sichtOeffentlich(s), ...(bereiche ? { bereiche } : {}) } })
  offen.push(w)
  return w
}
/** Fenstergröße des Bildschirms (happy-dom; Vorgabe 1024 × 768). */
const fenster = (width: number, height: number) => (window as unknown as { happyDOM: { setViewport: (v: { width: number; height: number }) => void } }).happyDOM.setViewport({ width, height })
afterEach(() => {
  offen.splice(0).forEach((w) => w.unmount())
  fenster(1024, 768)
})

const text = (el: { text: () => string }) => el.text().replace(/\s+/g, ' ').trim()
/** Wörter, die auf der englischen Tafel nie stehen dürfen – die deutschen Fassungen derselben Angaben. */
const DEUTSCH = ['Parcours', 'Klasse', 'Lauf', 'Versuch', 'Vorlauf', 'Halbfinale', 'Finale ', 'Kleines', 'Wiederholung', 'davor', 'bereit', 'Parallel-Slalom']

describe('Anzeigetafel im Parallelslalom (UIM, englisch)', () => {
  it('Racecourse A und B gleichzeitig: Nummer, Name, Herkunft je Seite; oben Class, Runde und Attempt', () => {
    let s = beginne(uimParallelStand(), 'pre')
    s = naechster(naechster(s, 1000), 61_000)
    const w = tafel(s)
    const b = w.find('.anzeige-bereich')
    expect(b.attributes('data-bereich')).toBe(P)
    expect(text(b.find('.anzeige-parcours'))).toBe('Parallel slalom')
    expect(text(b.find('[data-klasse]'))).toBe('Class Dolphin')
    expect(text(b.find('[data-lauf]'))).toBe('Preliminary heat · Attempt 2')
    const seiten = b.findAll('.anzeige-bahn')
    expect(seiten.map((x) => x.attributes('data-racecourse'))).toEqual(['A', 'B'])
    expect(seiten.map((x) => text(x.find('[data-teil="racecourse"]')))).toEqual(['Racecourse A', 'Racecourse B'])
    // Im 2. Attempt sind die Racecourses getauscht (Pkt. 4.4).
    expect(seiten.map((x) => text(x.find('[data-startnr]')))).toEqual(['E02', 'E01'])
    expect(seiten.map((x) => text(x.find('[data-name]')))).toEqual(['VorE2 NachE2', 'VorE1 NachE1'])
    expect(seiten.map((x) => text(x.find('[data-herkunft]')))).toEqual(['Musterclub', 'Musterclub'])
    expect(text(b.find('[data-vorig]'))).toBe('previous: E01 / E02 · Class Dolphin')
    expect(w.find('.anzeige').attributes('lang')).toBe('en')
    for (const wort of DEUTSCH) expect(text(w), wort).not.toContain(wort)
  })

  it('eine leere Seite (Dummy) zeigt nur ihren Racecourse und „–“; die andere fährt', () => {
    let s = beginne(uimParallelStand(), 'pre')
    for (const zeit of [1000, 2000, 3000]) s = naechster(s, zeit)
    const seiten = tafel(s).findAll('.anzeige-bahn')
    expect(seiten.map((x) => [x.classes('leer'), text(x.find('[data-startnr]')), x.find('[data-name]').exists()])).toEqual([
      [false, 'E03', true],
      [true, '–', false],
    ])
  })

  it('Halbfinale, Finals und Re-run heißen wie im Rulebook; das kleine Finale nennt seine Plätze', () => {
    let s = uimParallelStand([...parallelStarter('E', 5), ...parallelStarter('1', 6)])
    s = fahreRunde(s, 'pre', {
      'E-1': [40, 40], 'E-2': [41, 41], 'E-3': [42, 42], 'E-4': [43, 43], 'E-5': [43, 43],
      '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43], '1-5': [50, 50], '1-6': [55, 55],
    })
    s = reducer(s, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'semi' })
    s = reducer(s, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: 'E', runde: 'rerun-pre-1' })
    s = fahreRunde(s, 'semi', { '1-1': [40, 40], '1-2': [41, 41], '1-3': [42, 42], '1-4': [43, 43] })
    s = reducer(s, { type: 'PARALLEL_RUNDE_FESTSCHREIBEN', klasse: '1', runde: 'final' })
    const titel = (runde: ParallelRunde) => {
      const t = naechster(beginne(s, runde), 1000)
      return text(tafel(t).find('[data-lauf]'))
    }
    expect(titel('rerun-pre-1')).toBe('Preliminary heat – Re-run · Attempt 1')
    expect(titel('semi')).toBe('Semi-finals · Attempt 1')
    expect(titel('final')).toBe('Small final (3rd and 4th place) · Attempt 1')
    // Das Finale um Platz 1 und 2 kommt nach den beiden Attempts des kleinen.
    let f = beginne(s, 'final')
    for (const zeit of [1000, 2000, 3000]) f = naechster(f, zeit)
    const w = tafel(f)
    expect(text(w.find('[data-lauf]'))).toBe('Final · Attempt 1')
    expect(text(w.find('[data-klasse]'))).toBe('Class 1')
    for (const wort of DEUTSCH) expect(text(w), wort).not.toContain(wort)
  })

  it('Schriftgrößen der Seiten gelten auch auf der eigenen Tafel (gestapelt) – happy-dom rechnet kein CSS, daher am Text', () => {
    // Die eigene Tafel des Parallelslaloms ist immer gestapelt. Die Regeln dafür (0,3,0) rechnen mit --angaben-skala, die
    // es nur in `.anzeige-angaben` gibt; gewännen sie gegen die der Seiten, fielen Name, Herkunft und „previous“ auf 16 px
    // (Prüfung E4, 16.11.2026). Also: gleiche Spezifität, später in der Datei, ohne --angaben-skala.
    for (const [seite, gestapelt] of [
      ['.anzeige-inhalt .anzeige-bahn .anzeige-startnr', '.anzeige-inhalt.gestapelt .anzeige-startnr'],
      ['.anzeige-inhalt .anzeige-bahn .anzeige-name', '.anzeige-inhalt.gestapelt .anzeige-name'],
      ['.anzeige-inhalt .anzeige-bahn .anzeige-herkunft', '.anzeige-inhalt.gestapelt .anzeige-herkunft'],
      ['.anzeige-inhalt .anzeige-vorig.anzeige-vorig-paar', '.anzeige-inhalt.gestapelt .anzeige-vorig'],
    ]) {
      expect(regel(seite).i, seite).toBeGreaterThan(regel(gestapelt).i)
      expect(regel(seite).rumpf, seite).not.toContain('angaben-skala')
    }
    // Beide Seiten oben ausgerichtet: Der Racecourse einer leeren Seite steht so hoch wie der der anderen.
    expect(regel('.anzeige-bahn').rumpf).toContain('justify-content: flex-start')
  })

  it('gemeinsame Tafel: der Parallelslalom erst mit seiner ersten begonnenen Runde; nie Geburtsdatum', () => {
    let s = uimParallelStand()
    s = { ...s, starters: s.starters.map((p) => ({ ...p, geburtsdatum: '2015-04-03', gewicht: 38.4 })) }
    expect(tafel(s, null).findAll('.anzeige-bereich').map((b) => b.attributes('data-bereich'))).toEqual(['par_1'])
    const laeuft = naechster(beginne(s, 'pre'), 1000)
    const w = tafel(laeuft, null)
    expect(w.findAll('.anzeige-bereich').map((b) => b.attributes('data-bereich'))).toEqual(['par_1', P])
    for (const verboten of ['2015', '03.04', '38.4', '38,4']) expect(w.html()).not.toContain(verboten)
  })
})

describe('Lage von Racecourse A und B auf der Anzeigetafel (Einstellung nach dem Standort, 16.11.2026)', () => {
  /** Vorlauf, 2. Attempt im Boot: A = E02, B = E01 (getauscht, Pkt. 4.4); davor der 1. Attempt mit A = E01, B = E02. */
  function imBoot(lage: ParallelAnordnung): AppState {
    const s = reducer(beginne(uimParallelStand(), 'pre'), { type: 'SET_ANZEIGE', patch: { parallelAnordnung: lage } })
    return naechster(naechster(s, 1000), 61_000)
  }
  const IM_BOOT = { A: 'E02', B: 'E01' }
  const DAVOR = { A: 'E01', B: 'E02' }

  it.each([
    ['a-links', ['A', 'B'], false],
    ['b-links', ['B', 'A'], false],
    ['a-oben', ['A', 'B'], true],
    ['b-oben', ['B', 'A'], true],
  ] as const)('%s: Seiten in der Folge %j (DOM), untereinander: %s – jede Seite behält Überschrift und Starter', (lage, folge, untereinander) => {
    const b = tafel(imBoot(lage)).find('.anzeige-bereich')
    const paar = b.find('.anzeige-paar')
    expect(paar.attributes('data-lage')).toBe(lage)
    expect(paar.classes('untereinander')).toBe(untereinander)
    const seiten = paar.findAll('.anzeige-bahn')
    expect(seiten.map((x) => x.attributes('data-racecourse'))).toEqual(folge)
    // Nur die Lage wechselt: „Racecourse A“ steht über dem Starter auf A, wo immer A liegt.
    expect(seiten.map((x) => [text(x.find('[data-teil="racecourse"]')), text(x.find('[data-startnr]')), text(x.find('[data-name]'))])).toEqual(
      folge.map((rc) => [`Racecourse ${rc}`, IM_BOOT[rc], `VorE${IM_BOOT[rc].slice(-1)} NachE${IM_BOOT[rc].slice(-1)}`]),
    )
    // „previous“ nennt die Nummern in der Folge der Seiten auf der Tafel (BETRIEB_ANNAHMEN.parallelAnordnungNurTafel).
    expect(text(b.find('[data-vorig]'))).toBe(`previous: ${folge.map((rc) => DAVOR[rc]).join(' / ')} · Class Dolphin`)
    // Klasse, Runde und Attempt bleiben oben über beiden Seiten.
    expect(text(b.find('[data-lauf]'))).toBe('Preliminary heat · Attempt 2')
  })

  it('eine leere Seite bleibt an ihrem Platz – auch oben', () => {
    let s = reducer(beginne(uimParallelStand(), 'pre'), { type: 'SET_ANZEIGE', patch: { parallelAnordnung: 'b-oben' } })
    for (const zeit of [1000, 2000, 3000]) s = naechster(s, zeit)
    const seiten = tafel(s).findAll('.anzeige-bahn')
    // 1. Attempt des zweiten Paares: E03 auf A, B leer (Dummy) – B steht oben, leer.
    expect(seiten.map((x) => [x.attributes('data-racecourse'), x.classes('leer'), text(x.find('[data-startnr]'))])).toEqual([
      ['B', true, '–'],
      ['A', false, 'E03'],
    ])
  })

  it('untereinander im Querformat: je Seite Nummer neben den Angaben („flach“); hochkant gestapelt – nach dem Umschalten neu gemessen', async () => {
    // 1024 × 768, nur der Parallelslalom: ein Bereich, jede Seite doppelt so breit wie er – Nummer und Angaben nebeneinander.
    const w = tafel(imBoot('a-oben'))
    expect(w.find('.anzeige-paar').classes()).toEqual(expect.arrayContaining(['untereinander', 'flach']))
    expect(w.find('.anzeige-bereich').attributes('data-anordnung')).toContain('paar-flach')
    // Hochkant reicht die Breite nicht: Die Seiten stehen gestapelt untereinander, alles schrumpft gemeinsam (lib/fit.ts).
    fenster(540, 960)
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(w.find('.anzeige-paar').classes('untereinander')).toBe(true)
    expect(w.find('.anzeige-paar').classes('flach')).toBe(false)
    // Die geänderte Anordnung reicht AnzeigeTafel an den Bereich: Er zeichnet neu, und lib/fit.ts misst in `updated`.
    expect(w.find('.anzeige-bereich').attributes('data-anordnung')).toContain('paar-hoch')
    // Nebeneinander gibt es kein „flach“ – jede Seite ist dort ohnehin hoch.
    expect(tafel(imBoot('b-links')).find('.anzeige-paar').classes()).not.toContain('flach')
  })

  it('auch auf der gemeinsamen Tafel mit dem Parcours: Lage nach der Einstellung, der Parcours bleibt, wie er ist', () => {
    const w = tafel(imBoot('b-oben'), null)
    expect(w.findAll('.anzeige-bereich').map((b) => b.attributes('data-bereich'))).toEqual(['par_1', P])
    const paar = w.find(`[data-bereich="${P}"] .anzeige-paar`)
    expect([paar.attributes('data-lage'), paar.classes('untereinander'), paar.classes('flach')]).toEqual(['b-oben', true, true])
    expect(paar.findAll('.anzeige-bahn').map((x) => x.attributes('data-racecourse'))).toEqual(['B', 'A'])
    for (const wort of DEUTSCH) expect(text(w), wort).not.toContain(wort)
  })

  it('Trennlinie nebeneinander senkrecht, untereinander waagerecht; „flach“ gilt vor Seiten-Regeln und „gestapelt“ (am CSS-Text)', () => {
    expect(regel('.anzeige-bahn + .anzeige-bahn').rumpf).toContain('border-left: 3px solid var(--anzeige-trenner)')
    const unten = regel('.anzeige-paar.untereinander .anzeige-bahn + .anzeige-bahn').rumpf
    expect(unten).toContain('border-left: 0')
    expect(unten).toContain('border-top: 3px solid var(--anzeige-trenner)')
    // Gleich hohe Zeilen: Die untere Seite springt nicht, wenn die obere leer ist.
    expect(regel('.anzeige-paar.untereinander').rumpf).toContain('grid-auto-rows: 1fr')
    // Die Nummer der flachen Seite: eigene Größe (Spezifität 0,4,0 gegen 0,3,0), ohne --angaben-skala (gibt es dort nicht).
    const nummer = regel('.anzeige-paar.untereinander.flach .anzeige-startnr').rumpf
    expect(nummer).toContain('font-size: calc(var(--anzeige-u) * 0.28 * var(--fit-scale))')
    expect(nummer).not.toContain('angaben-skala')
    // Beide flachen Seiten teilen die Spalten: Nummern und „Racecourse A/B“ stehen genau untereinander, auch neben „–“.
    const seite = regel('.anzeige-paar.untereinander.flach .anzeige-bahn').rumpf
    expect(seite).toContain('grid-template-columns: subgrid')
    // Farben nur aus --anzeige-*.
    for (const r of [unten, nummer, seite]) expect(r).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i)
  })
})
