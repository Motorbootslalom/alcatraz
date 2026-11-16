import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AnzeigeTafel from './AnzeigeTafel.vue'
import { reducer } from '../../state/reducer'
import { sichtOeffentlich } from '../../betrieb/sicht'
import { betriebsStand, festgeschrieben, testLogo, testSvgLogo, zeigeNaechsten } from '../../testHilfen'
import type { AppState, BereichId } from '../../types'

// Die Anzeigetafel zeichnet nur die öffentliche Sicht. Alle Starter sind erfunden (Vor<id>/Nach<id>, Musterclub):
// Parcours 1 fährt e1, k1, e2, k2 (E und 1), Parcours 2 v1, f1, v2 (4 und 5).

const P1 = 'par_1'
const P2 = 'par_2'
const beginne = (s: AppState, bereich: BereichId, lauf = 1) => reducer(s, { type: 'BETRIEB_BEGINNEN', bereich, punkt: `lauf:${lauf}` })
const anzeige = (s: AppState, patch: Partial<AppState['anzeige']>) => reducer(s, { type: 'SET_ANZEIGE', patch })
const meldung = (s: AppState, bereich: string, text: string, art: 'info' | 'stoerung' | 'pause') => reducer(s, { type: 'BETRIEB_MELDUNG', bereich, meldung: { text, art } })

/** Parcours 1: Lauf 1 begonnen, e1 und k1 gezeigt (k1 im Boot); Parcours 2 noch nicht begonnen. */
function imBetrieb(regelwerk = 'dm-2026'): AppState {
  let s = festgeschrieben(reducer(betriebsStand(), { type: 'SET_REGELWERK', regelwerk }))
  s = beginne(s, P1)
  return zeigeNaechsten(zeigeNaechsten(s, P1, 1000), P1, 2000)
}

const offen: { unmount: () => void }[] = []
function tafel(s: AppState, bereiche?: BereichId[]) {
  const w = mount(AnzeigeTafel, { props: { sicht: sichtOeffentlich(s), ...(bereiche ? { bereiche } : {}) } })
  offen.push(w)
  return w
}
afterEach(() => offen.splice(0).forEach((w) => w.unmount()))

const text = (el: { text: () => string }) => el.text().replace(/\s+/g, ' ').trim()

describe('Anzeigetafel', () => {
  it('zeigt je Parcours Klasse, Lauf, Startnummer, Name, Herkunft und den Start davor', () => {
    const w = tafel(imBetrieb())
    const bereiche = w.findAll('.anzeige-bereich')
    expect(bereiche.map((b) => b.attributes('data-bereich'))).toEqual([P1, P2])
    const b1 = bereiche[0]
    expect(text(b1.find('.anzeige-parcours'))).toBe('Parcours 1')
    expect(text(b1.find('[data-klasse]'))).toBe('Klasse 1')
    expect(b1.find('.anzeige-klassenfarbe').attributes('style')).toContain('background')
    expect(text(b1.find('[data-lauf]'))).toBe('1. Lauf')
    expect(text(b1.find('[data-startnr]'))).toBe('101')
    expect(text(b1.find('[data-name]'))).toBe('Vork1 Nachk1')
    expect(text(b1.find('[data-herkunft]'))).toBe('Musterclub')
    expect(text(b1.find('[data-vorig]'))).toBe('davor: E01 · Klasse E · Vore1 Nache1')
    // Parcours 2 hat nicht begonnen: „bereit“, mit seinem Namen an derselben Stelle.
    expect(text(bereiche[1].find('.anzeige-parcours'))).toBe('Parcours 2')
    expect(text(bereiche[1].find('[data-leer]'))).toBe('bereit')
    // Zwischen den Bereichen die Trennlinie; Kopfzeile Name und Jahr.
    expect(w.findAll('.anzeige-trenner')).toHaveLength(1)
    expect(text(w.find('[data-kopf]'))).toBe('Musterpokal 2026')
  })

  it('nie Geburtsdatum oder Werte – die Tafel kennt nur die Sicht', () => {
    let s = imBetrieb()
    s = { ...s, starters: s.starters.map((p) => ({ ...p, geburtsdatum: '2015-04-03', gewicht: 38.4 })) }
    const html = tafel(s).html()
    for (const verboten of ['2015', '03.04', '38.4', '38,4']) expect(html).not.toContain(verboten)
  })

  it('Einstellungen: ohne davor, ohne Parcours-Namen, ohne Namen, ohne Herkunft, ohne Kopfzeile', () => {
    const s = anzeige(imBetrieb(), { davor: false, parcoursName: false, namen: 'ohne', herkunft: 'aus', kopfzeile: '' })
    const w = tafel(s)
    const b1 = w.find('.anzeige-bereich')
    expect(b1.find('[data-vorig]').exists()).toBe(false)
    expect(text(b1.find('.anzeige-parcours'))).toBe('')
    expect(b1.find('[data-name]').exists()).toBe(false)
    expect(b1.find('[data-herkunft]').exists()).toBe(false)
    expect(text(b1.find('[data-startnr]'))).toBe('101')
    expect(w.find('.anzeige-kopf').exists()).toBe(false)
    // Namen gekürzt.
    expect(text(tafel(anzeige(imBetrieb(), { namen: 'kurz' })).find('[data-name]'))).toBe('Vork1 N.')
  })

  it('Meldungen: Störung und Pause ersetzen den Starter, ein Hinweis steht darunter; der Parcours bleibt', () => {
    const stoerung = tafel(meldung(imBetrieb(), P1, 'Kurze Störung', 'stoerung')).find('.anzeige-bereich')
    expect(stoerung.find('[data-startnr]').exists()).toBe(false)
    expect(text(stoerung.find('[data-meldung]'))).toBe('Kurze Störung')
    expect(stoerung.find('[data-meldung]').classes()).toContain('stoerung')
    expect(text(stoerung.find('.anzeige-parcours'))).toBe('Parcours 1')

    const pause = tafel(meldung(imBetrieb(), P1, 'Mittagspause', 'pause')).find('[data-meldung]')
    expect(pause.classes()).toContain('pause')

    const info = tafel(meldung(imBetrieb(), P1, 'Siegerehrung um 16 Uhr', 'info')).find('.anzeige-bereich')
    expect(text(info.find('[data-startnr]'))).toBe('101')
    expect(info.find('[data-meldung]').classes()).toEqual(expect.arrayContaining(['info', 'darunter']))
    // Ein Hinweis steht auch unter „bereit“.
    const leer = tafel(meldung(imBetrieb(), P2, 'Gleich geht es los', 'info')).findAll('.anzeige-bereich')[1]
    expect(text(leer.find('[data-leer]'))).toBe('bereit')
    expect(text(leer.find('[data-meldung]'))).toBe('Gleich geht es los')
    // Ein Hinweis schrumpft selbst auf höchstens zwei Zeilen, statt die Startnummer mitzuverkleinern.
    for (const b of [info, leer]) expect(b.find('[data-meldung]').attributes('data-fit-zeilen')).toBe('2')
    expect(stoerung.find('[data-meldung]').attributes('data-fit-zeilen')).toBeUndefined()
  })

  it('der Parcours steht in jedem Zustand oben, der Rest darunter – er springt nicht (Prüfung E1)', () => {
    const s = meldung(imBetrieb(), P1, 'Kurze Störung', 'stoerung')
    const zustaende = [
      tafel(imBetrieb()).findAll('.anzeige-bereich')[0], // mit Starter
      tafel(imBetrieb()).findAll('.anzeige-bereich')[1], // bereit
      tafel(s).findAll('.anzeige-bereich')[0], // Störung
    ]
    for (const b of zustaende) {
      const kinder = [...b.find('.anzeige-inhalt').element.children]
      expect(kinder.map((k) => k.classList.contains('anzeige-meta') || k.classList.contains('anzeige-rumpf'))).toEqual([true, true])
      expect(kinder[0].classList.contains('anzeige-meta')).toBe(true)
    }
  })

  it('ein neuer Start ist ein neuer Block (misst sich neu, kein Überblenden); eine Info ändert nur den Text', async () => {
    const s = imBetrieb()
    const w = tafel(s)
    const vorher = w.find('.anzeige-inhalt').element
    await w.setProps({ sicht: sichtOeffentlich(meldung(s, P1, 'Hinweis', 'info')) })
    expect(w.find('.anzeige-inhalt').element).toBe(vorher)
    await w.setProps({ sicht: sichtOeffentlich(zeigeNaechsten(s, P1, 3000)) })
    expect(w.find('.anzeige-inhalt').element).not.toBe(vorher)
    expect(text(w.find('[data-startnr]'))).toBe('E02')
  })

  it('Auswahl der Bereiche: Einstellung oder nur ein Bereich (#/anzeige/<bereich>)', () => {
    expect(tafel(imBetrieb(), [P2]).findAll('.anzeige-bereich').map((b) => b.attributes('data-bereich'))).toEqual([P2])
    const nurZwei = anzeige(imBetrieb(), { bereiche: [P2] })
    expect(tafel(nurZwei).findAll('.anzeige-bereich').map((b) => b.attributes('data-bereich'))).toEqual([P2])
    expect(tafel(nurZwei).findAll('.anzeige-trenner')).toHaveLength(0)
    // Ohne Starter: ein Hinweis statt leerer Fläche.
    expect(text(tafel(festgeschrieben({ ...betriebsStand([]) })).find('[data-leer]'))).toBe('Noch keine Starter')
  })

  it('UIM: englisch nach dem Rulebook – Course, Class Dolphin, Attempt', () => {
    let s = imBetrieb('uim-2026')
    s = zeigeNaechsten(zeigeNaechsten(s, P1, 3000), P1, 4000)
    const w = tafel(s)
    const b1 = w.find('.anzeige-bereich')
    expect(text(b1.find('.anzeige-parcours'))).toBe('Course 1')
    expect(text(b1.find('[data-klasse]'))).toBe('Class 1')
    expect(text(b1.find('[data-lauf]'))).toBe('Attempt 1')
    expect(text(b1.find('[data-vorig]'))).toBe('previous: E02 · Class Dolphin · Vore2 Nache2')
    expect(text(w.findAll('.anzeige-bereich')[1].find('[data-leer]'))).toBe('ready')
    expect(w.find('.anzeige').attributes('lang')).toBe('en')
  })

  it('Logos links und rechts neben der Kopfzeile – nur, wenn die Sicht sie trägt', () => {
    let s = reducer(imBetrieb(), { type: 'SET_LOGO', seite: 'links', logo: testLogo() })
    s = reducer(s, { type: 'SET_LOGO', seite: 'rechts', logo: testSvgLogo() })
    const w = tafel(s)
    const logos = w.findAll('.anzeige-kopf img')
    expect(logos.map((l) => l.attributes('data-logo'))).toEqual(['links', 'rechts'])
    // Ein SVG bleibt data-URL (lib/listenLogos.ts), alt leer (Schmuck).
    expect(logos[1].attributes('src')).toBe(testSvgLogo().src)
    expect(logos.every((l) => l.attributes('alt') === '')).toBe(true)
    // Ausgeschaltet: keine Logos; ohne Kopfzeile, aber mit Logos bleibt der Kopf.
    expect(tafel(anzeige(s, { logos: false })).findAll('.anzeige-kopf img')).toHaveLength(0)
    const nurLogos = tafel(anzeige(s, { kopfzeile: '' }))
    expect(nurLogos.findAll('.anzeige-kopf img')).toHaveLength(2)
  })

  it('Größe: Feinjustage als Faktor der Schrift; Bereiche teilen sich die Höhe', () => {
    const w = tafel(anzeige(imBetrieb(), { skala: 1.2 }))
    const stil = w.find('.anzeige').attributes('style') ?? ''
    expect(stil).toContain('--anzeige-skala: 1.2')
    expect(stil).toContain('--anzeige-bereiche: 2')
  })
})
