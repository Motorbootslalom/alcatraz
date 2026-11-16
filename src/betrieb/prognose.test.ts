import { afterEach, describe, expect, it, vi } from 'vitest'
import { reducer } from '../state/reducer'
import { laufSchluessel } from '../lib/eingaben'
import { betriebsStand, betriebStarter, festgeschrieben, zeigeNaechsten } from '../testHilfen'
import type { AppState, PunktId } from '../types'
import { refKey } from './folge'
import { sichtOeffentlich, sichtZuschauer } from './sicht'
import {
  freieFolge,
  klassenMessungen,
  messungen,
  messwerteAlsVorgabe,
  mmss,
  seitSekunden,
  startabstandImBetrieb,
  startabstandZeilen,
  wartezeitAnzeige,
  wartezeiten,
  type Wartezeit,
} from './prognose'

// Startabstände und Wartezeiten (E3), sinngemäß nach den Tests des Tafel-Prototyps (lib/timing.test.ts), auf
// die Folge des Betriebs umgestellt. Erfundene Starter (Vor<id>/Nach<id>, Musterclub): je fünf der Klassen E und 1
// auf Parcours 1, verzahnt e1 k1 e2 k2 …; DM, drei Läufe.

const P1 = 'par_1'
const S = 1000
const m = (starter: string, lauf: number) => refKey({ art: 'm', starter, lauf })

/** Festgeschrieben, die genannten Läufe auf Parcours 1 begonnen. */
function bereit(laeufe: PunktId[] = ['lauf:1']): AppState {
  const starter = [1, 2, 3, 4, 5].flatMap((i) => [betriebStarter(`e${i}`, 'E', `E0${i}`), betriebStarter(`k${i}`, '1', `10${i}`)])
  let s = festgeschrieben(betriebsStand(starter))
  for (const punkt of laeufe) s = reducer(s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt })
  return s
}

/** Wie `running` im Prototyp: der erste Start bei 0 s, nach jeder Lücke (Sekunden) der nächste. */
function laufend(luecken: number[], s = bereit()) {
  let t = 0
  s = zeigeNaechsten(s, P1, t)
  for (const l of luecken) {
    t += l * S
    s = zeigeNaechsten(s, P1, t)
  }
  return { s, jetzt: t }
}

const mitAbstaenden = (s: AppState, abstaende: AppState['anzeige']['abstaende']) => reducer(s, { type: 'SET_ANZEIGE', patch: { abstaende } })
const sekunden = (s: AppState) => messungen(s).map((x) => x.sekunden)

/** Die Wartezeiten des Bereichs zu `jetzt`, nach Art sortiert gezählt, und die Liste der freigegebenen. */
function prognose(s: AppState, jetzt: number) {
  const sicht = sichtOeffentlich(s)
  const b = sicht.bereiche.find((x) => x.id === P1)!
  const w = wartezeiten(sicht, b, jetzt)
  const zeit = [...w.entries()].filter((e): e is [string, Extract<Wartezeit, { art: 'zeit' }>] => e[1].art === 'zeit')
  const arten = (art: Wartezeit['art']) => [...w.values()].filter((x) => x.art === art).length
  return { sicht, b, w, zeit, arten }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Messung', () => {
  it('schreibt den Abstand dem vorigen Start zu', () => {
    // Verzahnt e1 k1 … – der erste Abstand gehört also Klasse E.
    expect(messungen(laufend([60, 80]).s)).toEqual([
      { bereich: P1, klasse: 'E', sekunden: 60 },
      { bereich: P1, klasse: '1', sekunden: 80 },
    ])
  })

  it('verwirft unplausible Abstände (Pause, Störung, Mittag) und zu kurze (Durchklicken) – 30 und 300 s zählen noch', () => {
    expect(sekunden(laufend([60, 3600, 70]).s)).toEqual([60, 70])
    expect(sekunden(laufend([60, 3, 70]).s)).toEqual([60, 70])
    expect(sekunden(laufend([30, 300, 29, 301]).s)).toEqual([30, 300])
  })

  it('liefert nichts, solange nur ein Start gezeigt wurde', () => {
    expect(messungen(laufend([]).s)).toEqual([])
  })

  it('„Zurück“ nimmt den Start auch aus der Messung', () => {
    const { s } = laufend([60])
    const zurueck = reducer(s, { type: 'BETRIEB_ZURUECK', bereich: P1, ref: m('k1', 1) })
    expect(messungen(zeigeNaechsten(zurueck, P1, 200 * S))).toEqual([{ bereich: P1, klasse: 'E', sekunden: 200 }])
  })

  it('„ohne Anzeige“ ist keine Messung, und ein Abstand darüber hinweg zählt nicht', () => {
    // e1 und k1 gezeigt, dann eingestiegen bei k2: e2 ist ohne Anzeige erledigt. k1 → k2 umfasste zwei Läufe.
    const { s } = laufend([60])
    const ab = reducer(s, { type: 'BETRIEB_AB', bereich: P1, ref: m('k2', 1) })
    expect(ab.betrieb.bereiche[P1].ohneAnzeige).toEqual([m('e2', 1)])
    const weiter = zeigeNaechsten(zeigeNaechsten(ab, P1, 160 * S), P1, 250 * S)
    expect(messungen(weiter)).toEqual([
      { bereich: P1, klasse: 'E', sekunden: 60 },
      { bereich: P1, klasse: '1', sekunden: 90 },
    ])
  })

  it('kein Abstand über die Laufgrenze: Darin steckt der Laufwechsel („Lauf beginnen“, Bögen tauschen)', () => {
    // Lauf 1 im Abstand von 110 s durchgezeigt (e1 … k5), dann Lauf 2 begonnen, sein erster Start nach 280 s.
    const lauf1 = laufend(Array<number>(9).fill(110))
    const jetzt = lauf1.jetzt
    let s = reducer(lauf1.s, { type: 'BETRIEB_BEGINNEN', bereich: P1, punkt: 'lauf:2' })
    s = zeigeNaechsten(s, P1, jetzt + 280 * S)
    // Die 280 s (k5 → e1 in Lauf 2) zählen nicht – sonst hätte Klasse 1 ein Mittel von 144 statt 110 s.
    expect(sekunden(s)).toEqual(Array<number>(9).fill(110))
    expect(klassenMessungen(messungen(s))['1']).toEqual({ klasse: '1', mittel: 110, anzahl: 4, zuletzt: 110 })
    expect(startabstandImBetrieb(s, '1')).toBe(110)
    // Innerhalb von Lauf 2 wird wieder gemessen.
    expect(sekunden(zeigeNaechsten(s, P1, jetzt + 400 * S)).at(-1)).toBe(120)
  })

  it('ein Start, der danach entfällt (X), hat keinen Lauf gekostet', () => {
    const { s } = laufend([60, 80])
    const x = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: laufSchluessel('manoevrieren', 1), starter: 'k1', feld: 'disq@steg', wert: 'X' }] })
    expect(messungen(x)).toEqual([{ bereich: P1, klasse: 'E', sekunden: 60 }])
  })
})

describe('Startabstand je Klasse', () => {
  it('mittelt je Klasse, mit Zahl und letztem Abstand', () => {
    const gemessen = klassenMessungen(messungen(laufend([60, 80, 100, 40]).s))
    expect(gemessen.E).toEqual({ klasse: 'E', mittel: 80, anzahl: 2, zuletzt: 100 })
    expect(gemessen['1']).toEqual({ klasse: '1', mittel: 60, anzahl: 2, zuletzt: 40 })
  })

  it('nimmt die Vorgabe, solange weniger als drei Messungen vorliegen – ohne zu mischen', () => {
    const { s } = laufend([60, 80, 100, 40])
    // Vorgabe aus einstellungen.yaml (DM nennt keine eigenen); der eigene Wert der Veranstaltung geht vor.
    expect([startabstandImBetrieb(s, 'E'), startabstandImBetrieb(s, '1')]).toEqual([120, 110])
    expect(startabstandImBetrieb(mitAbstaenden(s, { E: 95 }), 'E')).toBe(95)
  })

  it('nimmt ab drei Messungen das gerundete Mittel, auch vor dem eigenen Wert', () => {
    // E: 60, 100, 90 → 83,3; Klasse 1: nur zwei (80, 40) → Vorgabe.
    const { s } = laufend([60, 80, 100, 40, 90])
    const eigen = mitAbstaenden(s, { E: 95, '1': 100 })
    expect([startabstandImBetrieb(eigen, 'E'), startabstandImBetrieb(eigen, '1')]).toEqual([83, 100])
    expect(startabstandZeilen(eigen, ['E', '1', '2'])).toEqual([
      { klasse: 'E', vorgabe: 120, eigen: 95, gemessen: { klasse: 'E', mittel: 250 / 3, anzahl: 3, zuletzt: 90 }, wirksam: 83, quelle: 'messung' },
      { klasse: '1', vorgabe: 110, eigen: 100, gemessen: { klasse: '1', mittel: 60, anzahl: 2, zuletzt: 40 }, wirksam: 100, quelle: 'eigen' },
      { klasse: '2', vorgabe: 115, eigen: null, gemessen: null, wirksam: 115, quelle: 'vorgabe' },
    ])
    // Dasselbe steht in der Sicht – für die Wartezeit auf dem Bildschirm.
    expect(sichtOeffentlich(eigen).abstaende).toEqual({ E: 83, '1': 100 })
  })

  it('„Messwerte als Vorgabe übernehmen“: Klassen mit genug Messungen, gerundet; was der Vorgabe gleicht, ist kein eigener Wert', () => {
    const { s } = laufend([60, 80, 100, 40, 90])
    const eigen = mitAbstaenden(s, { '1': 100, '2': 115 })
    // E gemessen (83), 1 behält den eigenen Wert (nur zwei Messungen), 2 gleicht der Vorgabe und fällt weg.
    expect(messwerteAlsVorgabe(eigen)).toEqual({ E: 83, '1': 100 })
    const danach = reducer(eigen, { type: 'SET_ANZEIGE', patch: { abstaende: messwerteAlsVorgabe(eigen) } })
    expect(danach.anzeige.abstaende).toEqual({ E: 83, '1': 100 })
    // Nichts gemessen: nichts dazu.
    expect(messwerteAlsVorgabe(bereit())).toEqual({})
  })
})

describe('Wartezeit', () => {
  it('rechnet die Restzeit des Starts im Boot mit', () => {
    const s = mitAbstaenden(laufend([]).s, { E: 100, '1': 100 })
    // 30 s nach dem Start von e1: 70 s Rest bis k1, dann 100 s je Start.
    const { zeit } = prognose(s, 30 * S)
    expect(zeit.slice(0, 2).map(([key, w]) => [key, w.bisStart])).toEqual([
      [m('k1', 1), 70],
      [m('e2', 1), 170],
    ])
  })

  it('wird nicht negativ, wenn der Start im Boot überzieht; je Klasse ihr Abstand', () => {
    const { zeit } = prognose(laufend([]).s, 500 * S)
    // Vorgabe: E 120 s, Klasse 1 110 s. k1 ist gleich dran, e2 nach k1 (110), k2 nach e2 (120).
    expect(zeit.slice(0, 3).map(([, w]) => w.bisStart)).toEqual([0, 110, 230])
  })

  it('jeder freigegebene Start bekommt eine Zeit; spätere Läufe keine – ihr Beginn steht nicht fest', () => {
    const { s, jetzt } = laufend([60, 60])
    const { b, zeit, arten } = prognose(s, jetzt)
    expect(zeit.map(([key]) => key)).toEqual(freieFolge(b).map((x) => x.key))
    expect([zeit.length, arten('spaeter')]).toEqual([7, 20])
    expect(zeit.every(([key]) => JSON.parse(key)[2] === 1)).toBe(true)
    // Sind zwei Läufe begonnen, läuft die Zeit über die Grenze: Lauf 2 folgt ohne Pause.
    const zwei = prognose(laufend([60, 60], bereit(['lauf:1', 'lauf:2'])).s, jetzt)
    expect([zwei.zeit.length, zwei.arten('spaeter')]).toEqual([17, 10])
  })

  it('nennt für eine ausgesetzte Klasse keine Zeit („Boot fehlt“), für Zurückgestellte und Nachzuholende auch nicht', () => {
    const { s, jetzt } = laufend([60])
    const aus = reducer(s, { type: 'BETRIEB_AUSSETZEN', bereich: P1, klasse: 'E', an: true })
    const p = prognose(aus, jetzt)
    expect(p.zeit.every(([, w]) => w.art === 'zeit') && p.zeit.every(([key]) => p.sicht.starter[JSON.parse(key)[1]].klasse === '1')).toBe(true)
    expect(p.w.get(m('e2', 1))).toEqual({ art: 'bootFehlt' })
    const zurueck = prognose(reducer(s, { type: 'BETRIEB_ZURUECKSTELLEN', bereich: P1, ref: m('e2', 1) }), jetzt)
    expect(zurueck.w.get(m('e2', 1))).toEqual({ art: 'ohne' })
    expect(zurueck.zeit[0][0]).toBe(m('k2', 1))
  })

  it('Zeit bis zum Vorsteg: die Wartezeit des Starts „am Steg + vor Steg“ Stellen davor; wer dazugehört, gleich', () => {
    // 2 am Steg, 2 vor Steg (Vorgabe); je Start 100 s, e1 gerade ins Boot.
    const s = mitAbstaenden(laufend([]).s, { E: 100, '1': 100 })
    const { zeit } = prognose(s, 0)
    expect(zeit.slice(0, 7).map(([, w]) => [w.stelle, w.bisStart, w.bisVorsteg, w.steg])).toEqual([
      [0, 100, 0, 'amSteg'],
      [1, 200, 0, 'amSteg'],
      [2, 300, 0, 'vorSteg'],
      [3, 400, 0, 'vorSteg'],
      [4, 500, 100, null],
      [5, 600, 200, null],
      [6, 700, 300, null],
    ])
    // Ohne „vor Steg“ ist der Vorsteg nur der Weg zum Steg: zwei Stellen davor.
    const knapp = prognose(reducer(s, { type: 'SET_ANZEIGE', patch: { amSteg: 2, vorSteg: 0 } }), 0)
    expect(knapp.zeit.slice(1, 4).map(([, w]) => [w.bisVorsteg, w.steg])).toEqual([
      [0, 'amSteg'],
      [100, null],
      [200, null],
    ])
  })

  it('Pause oder Störung auf der Tafel: keine Zahl, Stelle und Steg bleiben; ein Hinweis hält nichts an', () => {
    const { s, jetzt } = laufend([60])
    const mit = (art: 'pause' | 'stoerung' | 'info') => reducer(s, { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: { text: 'Mittagspause bis 13:30', art } })
    for (const art of ['pause', 'stoerung'] as const) {
      // 20 Minuten später – weiterzuzählen hieße „gleich“ für alle.
      const p = prognose(mit(art), jetzt + 20 * 60 * S)
      expect(p.zeit).toEqual([])
      expect([...p.w.values()].filter((w) => w.art === 'angehalten').slice(0, 5)).toEqual([
        { art: 'angehalten', stelle: 0, steg: 'amSteg' },
        { art: 'angehalten', stelle: 1, steg: 'amSteg' },
        { art: 'angehalten', stelle: 2, steg: 'vorSteg' },
        { art: 'angehalten', stelle: 3, steg: 'vorSteg' },
        { art: 'angehalten', stelle: 4, steg: null },
      ])
      // Spätere Läufe bleiben ohne Zahl wie sonst.
      expect(p.arten('spaeter')).toBe(prognose(s, jetzt).arten('spaeter'))
    }
    expect(prognose(mit('info'), jetzt).zeit).toEqual(prognose(s, jetzt).zeit)
    // Ist die Meldung weg, rechnet die Liste vom Start im Boot weiter: sein Rest ist abgelaufen, der Nächste „gleich“.
    const weiter = reducer(mit('pause'), { type: 'BETRIEB_MELDUNG', bereich: P1, meldung: null })
    expect(prognose(weiter, jetzt + 20 * 60 * S).zeit[0][1].bisStart).toBe(0)
  })

  it('die Zuschauersicht rechnet dieselben Zeiten', () => {
    const { s, jetzt } = laufend([60, 80])
    const { sicht, zeit } = prognose(s, jetzt + 45 * S)
    const z = sichtZuschauer(sicht)
    const zw = wartezeiten(z, z.bereiche[0], jetzt + 45 * S)
    expect([...zw.entries()]).toEqual(zeit)
  })

  it('„seit“ nie negativ – die Uhr des Geräts kann nachgehen', () => {
    const b = sichtOeffentlich(laufend([]).s).bereiche[0]
    expect(seitSekunden({ ...b, seit: 10 * S }, 75 * S)).toBe(65)
    expect(seitSekunden({ ...b, seit: 10 * S }, 5 * S)).toBe(0)
    expect(seitSekunden({ ...b, aktuell: null }, 5 * S)).toBeNull()
  })

  it('die Sicht bleibt zeitunabhängig: Gerechnet wird mit der Uhr des Bildschirms, nie in Stand oder Sicht (K28)', () => {
    const { s } = laufend([60, 80])
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const frueh = JSON.stringify(sichtZuschauer(sichtOeffentlich(s)))
    vi.setSystemTime(3_600_000)
    expect(JSON.stringify(sichtZuschauer(sichtOeffentlich(s)))).toBe(frueh)
  })
})

describe('Anzeige', () => {
  it('Wartezeit lesbar: gleich, Minuten, Stunden', () => {
    expect(wartezeitAnzeige(20)).toEqual({ art: 'gleich' })
    expect(wartezeitAnzeige(600)).toEqual({ art: 'min', min: 10 })
    expect(wartezeitAnzeige(4500)).toEqual({ art: 'h', h: 1, min: 15 })
  })

  it('Dauer als m:ss', () => {
    expect([mmss(75), mmss(9), mmss(-3)]).toEqual(['1:15', '0:09', '0:00'])
  })
})
