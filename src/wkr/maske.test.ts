import { describe, expect, it } from 'vitest'
import { configFor, type Konfig } from '../config/konfig'
import { listenFelder } from '../lib/eingaben'
import { reducer } from '../state/reducer'
import { uimParallelStand } from '../testHilfen'
import type { ClassId } from '../types'
import { WKR_ANNAHMEN } from './annahmen'
import {
  listeMitMaske,
  bojenVon,
  disqFuer,
  eintraegeAuf,
  maskenZeilen,
  tippeBoje,
  tippeBojenDisq,
  disqAnBojen,
  bojenDisqVon,
  bojenDisqZahl,
  BOJEN_FOLGE_VORGABE,
  BOJEN_FOLGEN,
  bojenAbschnitte,
  bojenAbschnitteAlle,
  mitUmschalter,
  type MaskenAbschnitt,
  wegVon,
  eintraege,
  entwurfAus,
  leererEntwurf,
  maskeFuer,
  maskenArt,
  mitBemerkung,
  probeMaske,
  punkteVon,
  tippe,
  tippeDisq,
  codeAnzahl,
  codeStand,
  codeTippPrellt,
  wechselNach,
  wechselTakt,
  zellenAus,
  zurueck,
  type Entwurf,
  type MaskenAufbau,
  attemptWechsel,
  listeMitBojen,
  entwurfZellen,
  fertig,
  keineZeitAus,
  setzeKeineZeit,
  setzeZeit,
  zeitDeutung,
  zeitenOffen,
  zeitPflicht,
  zeitVollstaendig,
  zeitUhr,
  zeitUnlesbar,
  nichtGestartetZellen,
  istNichtGestartet,
  ohneFremdesX,
} from './maske'
import { parseTime, sanitizeTimeInput } from '../lib/time'
import { maskenJeKlasse, sichtListe, type ListenSicht } from './sicht'
import { wertGilt } from './zeile'
import { listenKennung, type ListenTeil } from './liste'
import { bildWege, bildZiel, bildZuordnung } from './bild'

// Maske „Knöpfe“ (W3.1, Plan docs/plan-wkr-w3.md §3.1): Aufbau je Position unter DM und UIM, Schreibweise wie die
// Erfassung (jede Tipp-Folge besteht wertGilt unverändert), X nur Steg-Ablegen und Vorsteg (F5), Takt des
// Weiterspringens. Keine Starter, keine Namen – nur Konfiguration.

const DM = configFor({ regelwerk: 'dm-2026' })
const UIM = configFor({ regelwerk: 'uim-2026' })
const KLASSEN: ClassId[] = ['1', '2', '3', '4', '5', '6', '7', 'E']

/** Eine Sicht nur mit den Masken (mehr liest maskeFuer nicht). */
function sichtMit(konfig: Konfig, typeId: string): ListenSicht {
  return { klassen: maskenJeKlasse(konfig, konfig, typeId, KLASSEN, WKR_ANNAHMEN.xListen.includes(typeId)) } as ListenSicht
}

/** Kleiner fester Zufall (keine echten Zufallszahlen in Tests). */
function folge(saat: number) {
  let x = saat
  return (n: number) => {
    x = (x * 1103515245 + 12345) % 2147483648
    return x % n
  }
}

/** Eine zufällige Tipp-Folge auf einer Maske (Codes, Disq., zurück, Bemerkung). */
function zufallsEntwurf(aufbau: MaskenAufbau, teil: ListenTeil | undefined, saat: number): Entwurf {
  const r = folge(saat)
  let e = leererEntwurf()
  const teile = aufbau.teile.filter((t) => teil === undefined || t.teil === null || t.teil === teil)
  const disq = disqFuer(aufbau, teil)
  const bojen = bojenVon(aufbau)
  for (let i = 0; i < 12; i++) {
    const w = r(10)
    // Bojen-Listen: etwa die Hälfte der Tipps auf Bojen (Schalter setzen und wegnehmen, Zähler hoch).
    if (bojen.length > 0 && r(2) === 0) e = tippeBoje(e, bojen[r(bojen.length)])
    // Zeit (W5.4): Tasten einzeln wie auf dem Ziffernblock, ⌫ und ab und zu „keine Zeit“.
    else if (aufbau.zeiten.length > 0 && r(2) === 0) {
      const z = aufbau.zeiten[r(aufbau.zeiten.length)].feld
      const t = e.zeiten[z] ?? ''
      const k = r(14)
      e = k < 11 ? setzeZeit(e, aufbau, z, t + '0123456789,'[k]) : k < 13 ? setzeZeit(e, aufbau, z, t.slice(0, -1)) : setzeKeineZeit(e, aufbau, z, 'anlage')
    } else if (w < 6 && teile.length > 0) {
      const t = teile[r(teile.length)]
      if (t.codes.length) e = tippe(e, aufbau, t.feld, t.codes[r(t.codes.length)].code)
    } else if (w < 8 && disq.length > 0) e = tippeDisq(e, disq[r(disq.length)].code)
    else if (w < 9) e = zurueck(e)
    else e = mitBemerkung(e, '  Boje berührt ')
  }
  return e
}

describe('Aufbau je Position (G2: an den Feldarten erkannt)', () => {
  it('DM: Steg zweiteilig, Tor 5 / Tor 5 + Parcours / MüB ein Teil, Vorsteg ohne Codes, Bojen-Listen später', () => {
    const steg = maskeFuer(sichtMit(DM, 'steg'), '5')!
    expect(steg.art).toBe('katalog')
    expect(steg.teile.map((t) => [t.teil, t.feld])).toEqual([['ab', 'katalog:stegAblegen'], ['an', 'katalog:stegAnlegen']])
    expect(steg.teile[0].codes[0]).toEqual({ code: '3', text: expect.any(String), punkte: 5, max: WKR_ANNAHMEN.codeMaxAllgemein })
    expect([steg.disq!.feld, steg.disq!.teil, steg.bemerkung]).toEqual(['disq@steg', null, 'bemerkung@steg'])
    for (const typeId of ['tor5', 'tor5pue', 'mueb']) {
      const m = maskeFuer(sichtMit(DM, typeId), '5')!
      expect([m.art, m.teile.length, m.teile[0].teil, m.disq!.feld], typeId).toEqual(['katalog', 1, null, `disq@${typeId}`])
    }
    expect(maskeFuer(sichtMit(DM, 'tor5'), '5')!.teile[0].codes.map((c) => [c.code, c.punkte])).toEqual([['1', 20], ['2', 5], ['20', 5]])
    const vorsteg = maskeFuer(sichtMit(DM, 'vorsteg'), '5')!
    expect([vorsteg.art, vorsteg.teile, vorsteg.disq!.codes.map((c) => c.code), vorsteg.bemerkung]).toEqual(['vorsteg', [], ['M', 'X'], 'bemerkung@vorsteg'])
    // W4.1: Bojen auf dem Fahrweg → `bojen`; Knoten (Bojen-Art ohne Fahrweg) ohne Bestand bleibt später.
    for (const typeId of ['tor5puems', 'gate135', 'parcoursms']) expect(maskeFuer(sichtMit(DM, typeId), '5')!.art, typeId).toBe('bojen')
    const knoten = maskeFuer(sichtMit(DM, 'knoten'), '5')
    expect([knoten?.art, knoten?.teile, knoten?.disq, knoten?.abschnitte, knoten?.umschalter, knoten?.zeiten]).toEqual(['spaeter', [], null, [], false, []])
    // W5.4 (22.11.2026, ZT1): reine Zeit → `zeit` mit allen Zeitfeldern; Start/Ziel mit Zeit → Bojen mit Zeit-Abschnitt.
    const zeit = maskeFuer(sichtMit(DM, 'zeit'), '5')!
    expect([zeit.art, zeit.zeiten.map((z) => [z.feld, z.titel]), zeit.abschnitte]).toEqual(['zeit', [['zeit1', 'Zeit 1'], ['zeit2', 'Zeit 2'], ['zeit3', 'Zeit 3']], []])
    for (const typeId of ['bstartziel', 'moewezeit']) {
      const m = maskeFuer(sichtMit(DM, typeId), '5')!
      expect([m.art, m.zeiten.length > 0, bojenVon(m).length > 0], typeId).toEqual(['bojen', true, true])
    }
  })

  it('UIM: dieselben Masken mit den UIM-Katalogen (englisch)', () => {
    const steg = maskeFuer(sichtMit(UIM, 'steg'), '1')!
    expect(steg.teile.map((t) => t.codes.map((c) => c.code))).toEqual([['3', '6'], ['7', '9', '11', '12']])
    expect(steg.disq!.codes.map((c) => c.code)).toEqual(['D', 'E', 'F', 'X'])
    expect(maskeFuer(sichtMit(UIM, 'vorsteg'), '1')!.disq!.codes.map((c) => c.code)).toEqual(['X'])
    expect(maskeFuer(sichtMit(UIM, 'mueb'), '5')!.teile[0].codes.map((c) => c.code)).toEqual(['14', '15', '17', '18', '19', '21', '22'])
    expect(maskeFuer(sichtMit(UIM, 'parallelparcours'), '1')!.art).toBe('bojen')
  })

  it('maskenArt: nur Code/Disq./Text → katalog bzw. vorsteg; Boje mit Angabe → bojen; Boje ohne, Zeit, Punkte → später', () => {
    expect(maskenArt([{ kind: 'code' }, { kind: 'disq' }, { kind: 'text' }])).toBe('katalog')
    expect(maskenArt([{ kind: 'disq' }, { kind: 'text' }])).toBe('vorsteg')
    for (const kind of ['buoy', 'time', 'points'] as const) expect(maskenArt([{ kind: 'code' }, { kind }])).toBe('spaeter')
    expect(maskenArt([{ kind: 'buoy', boje: {} }, { kind: 'code' }, { kind: 'disq' }])).toBe('bojen')
    // W5.4 (ZT1): Zeit allein (+ Disq./Text) → zeit; neben Bojen des Fahrwegs → bojen; neben Katalog ohne Bojen → später.
    expect(maskenArt([{ kind: 'time' }, { kind: 'disq' }, { kind: 'text' }])).toBe('zeit')
    expect(maskenArt([{ kind: 'buoy', boje: {} }, { kind: 'time' }])).toBe('bojen')
    expect(maskenArt([{ kind: 'code' }, { kind: 'time' }])).toBe('spaeter')
    expect(maskenArt([{ kind: 'buoy' }, { kind: 'time' }])).toBe('spaeter')
    expect(maskenArt([{ kind: 'buoy', boje: {} }, { kind: 'buoy' }])).toBe('spaeter')
  })

  it('Liste ohne eigenes Disq.-Feld: Buchstaben ins erste Code-Feld, hinter die Codes (H1)', () => {
    const sicht = {
      klassen: { '5': { titel: 'Klasse 5', felder: [{ kennung: 'katalog:eigen', kind: 'code', label: 'Eigen', katalog: [{ code: '4', punkte: 5, text: 'a', max: 3 }, { code: '2', punkte: 5, text: 'b', max: 3 }], disq: [{ code: 'A', text: 'x' }, { code: 'B', text: 'y' }] }] } },
    } as unknown as ListenSicht
    const m = maskeFuer(sicht, '5')!
    expect([m.art, m.disq?.feld, m.disq?.teil, m.bemerkung]).toEqual(['katalog', 'katalog:eigen', null, null])
    const e = tippeDisq(tippeDisq(tippe(tippe(leererEntwurf(), m, 'katalog:eigen', '4'), m, 'katalog:eigen', '2'), 'B'), 'A')
    expect(zellenAus(e, m)).toEqual({ 'katalog:eigen': '2, 4, A, B' })
    expect(entwurfAus({ 'katalog:eigen': '2, 4, A, B' }, m)).toMatchObject({ codes: { 'katalog:eigen': ['2', '4'] }, disq: ['A', 'B'] })
  })

  it('Klasse ohne Liste (MüB unter Klasse 4) und unbekannte Klasse → null', () => {
    const sicht = sichtMit(DM, 'mueb')
    expect(DM.positionAllowsClass('mueb', '1')).toBe(false)
    expect(maskeFuer(sicht, '1')).toBeNull()
    expect(maskeFuer({ klassen: {} } as ListenSicht, '5')).toBeNull()
  })
})

describe('X „nicht gestartet“ nur Steg-Ablegen und Vorsteg (F5)', () => {
  it('Steg: X nur im Ablegen und für das Gerät des ganzen Stegs, nie im Anlegen', () => {
    for (const konfig of [DM, UIM]) {
      const steg = maskeFuer(sichtMit(konfig, 'steg'), '1')!
      expect(disqFuer(steg, 'ab').map((d) => d.code)).toContain('X')
      expect(disqFuer(steg).map((d) => d.code)).toContain('X')
      expect(disqFuer(steg, 'an').map((d) => d.code)).not.toContain('X')
      // Andere Buchstaben gelten in beiden Teilen.
      expect(disqFuer(steg, 'an').length).toBe(disqFuer(steg, 'ab').length - 1)
      // Ein X aus einem Ablegen-Entwurf fällt in einer Anlegen-Zeile weg.
      const e = tippeDisq(tippeDisq(leererEntwurf(), 'X'), 'D')
      expect(zellenAus(e, steg, 'an')['disq@steg']).toBe('D')
      expect(zellenAus(e, steg, 'ab')['disq@steg']).toBe('X, D')
    }
  })

  it('Vorsteg mit X; Tor 5, MüB, Tor 5 + Parcours ohne X', () => {
    for (const konfig of [DM, UIM]) {
      expect(disqFuer(maskeFuer(sichtMit(konfig, 'vorsteg'), '5')!).map((d) => d.code)).toContain('X')
      for (const typeId of ['tor5', 'tor5pue', 'mueb']) {
        const m = maskeFuer(sichtMit(konfig, typeId), '5')!
        expect(disqFuer(m).map((d) => d.code), typeId).not.toContain('X')
        expect(m.teile[0].buchstaben, typeId).not.toContain('X')
      }
    }
  })
})

describe('Schreibweise: jede Tipp-Folge besteht wertGilt unverändert', () => {
  it('DM und UIM, jede Position mit Maske, jede Klasse und jeder Teil', () => {
    // Fehler sammeln statt je Wert ein expect (Prüfung unter Last 21.11.2026): Zehntausende expect mit Text liefen auf
    // zwei belegten Kernen über die 30 s des Tests; geprüft wird dasselbe.
    let geprueft = 0
    const fehler: string[] = []
    for (const konfig of [DM, UIM]) {
      for (const p of konfig.getPositions()) {
        const sicht = sichtMit(konfig, p.typeId)
        for (const k of KLASSEN) {
          const aufbau = maskeFuer(sicht, k)
          if (!aufbau || aufbau.art === 'spaeter') continue
          const felder = new Map(listenFelder(konfig, p.typeId, k).map((f) => [f.kennung, f]))
          const teile: (ListenTeil | undefined)[] = aufbau.teile.some((t) => t.teil) ? [undefined, 'ab', 'an'] : [undefined]
          for (const teil of teile) {
            for (let saat = 1; saat <= 40; saat++) {
              const zellen = zellenAus(zufallsEntwurf(aufbau, teil, saat * 7 + k.charCodeAt(0)), aufbau, teil)
              for (const [kennung, wert] of Object.entries(zellen)) {
                const feld = felder.get(kennung)
                if (!feld) fehler.push(`${p.typeId}/${k}: ${kennung} fehlt`)
                else if (!wertGilt(feld, wert)) fehler.push(`${p.typeId}/${k}/${teil}: ${kennung} = „${wert}“`)
                geprueft++
              }
            }
          }
        }
      }
    }
    expect(fehler).toEqual([])
    expect(geprueft).toBeGreaterThan(1000)
  })

  it('„2x6“: Mehrfachtipps zählen, sortiert wie die Erfassung; Disq. am Steg im gemeinsamen Feld, nie in den Codes', () => {
    const steg = maskeFuer(sichtMit(DM, 'steg'), '5')!
    let e = tippe(leererEntwurf(), steg, 'katalog:stegAblegen', '6')
    e = tippe(e, steg, 'katalog:stegAblegen', '3')
    e = tippe(e, steg, 'katalog:stegAblegen', '6')
    e = tippeDisq(e, 'A')
    e = tippe(e, steg, 'katalog:stegAnlegen', '12')
    expect(zellenAus(e, steg, 'ab')).toEqual({ 'katalog:stegAblegen': '3, 2x6', 'disq@steg': 'A', 'bemerkung@steg': '' })
    expect(zellenAus(e, steg, 'an')).toEqual({ 'katalog:stegAnlegen': '12', 'disq@steg': 'A', 'bemerkung@steg': '' })
    expect(zellenAus(e, steg)).toEqual({ 'katalog:stegAblegen': '3, 2x6', 'katalog:stegAnlegen': '12', 'disq@steg': 'A', 'bemerkung@steg': '' })
    // Tor 5: „2x20“, Disq. im Disq.-Feld der Liste.
    const tor5 = maskeFuer(sichtMit(DM, 'tor5'), '5')!
    const t = tippeDisq(tippe(tippe(tippe(leererEntwurf(), tor5, 'katalog:tor5', '20'), tor5, 'katalog:tor5', '1'), tor5, 'katalog:tor5', '20'), 'P')
    expect(zellenAus(t, tor5)).toEqual({ 'katalog:tor5': '1, 2x20', 'disq@tor5': 'P', 'bemerkung@tor5': '' })
  })

  it('Fehlerfrei = leere Felder des Teils; Bemerkung getrimmt und gekürzt', () => {
    const steg = maskeFuer(sichtMit(DM, 'steg'), '5')!
    expect(zellenAus(leererEntwurf(), steg, 'ab')).toEqual({ 'katalog:stegAblegen': '', 'disq@steg': '', 'bemerkung@steg': '' })
    const lang = mitBemerkung(leererEntwurf(), `  ${'x'.repeat(300)}  `)
    expect(zellenAus(lang, steg, 'ab')['bemerkung@steg']).toHaveLength(WKR_ANNAHMEN.textMax)
    const vorsteg = maskeFuer(sichtMit(DM, 'vorsteg'), '5')!
    expect(zellenAus(leererEntwurf(), vorsteg)).toEqual({ 'disq@vorsteg': '', 'bemerkung@vorsteg': '' })
    expect(zellenAus(tippeDisq(leererEntwurf(), 'X'), vorsteg)['disq@vorsteg']).toBe('X')
  })
})

describe('Entwurf: zurück, Disq. als Schalter, Punkte, entwurfAus', () => {
  const tor5 = maskeFuer(sichtMit(DM, 'tor5'), '5')!

  it('„↩ Rückgängig“ nimmt den letzten Tipp – Code oder Disq.; zweiter Disq.-Tipp nimmt ihn heraus', () => {
    let e = tippe(leererEntwurf(), tor5, 'katalog:tor5', '1')
    e = tippeDisq(e, 'A')
    e = tippe(e, tor5, 'katalog:tor5', '20')
    expect([eintraege(e), punkteVon(e, tor5)]).toEqual([3, 25])
    e = zurueck(e)
    expect(zellenAus(e, tor5)['katalog:tor5']).toBe('1')
    e = zurueck(e)
    expect(e.disq).toEqual([])
    e = tippeDisq(tippeDisq(e, 'B'), 'C')
    e = tippeDisq(e, 'B')
    expect(e.disq).toEqual(['C'])
    e = zurueck(e)
    expect(e.disq).toEqual([])
    e = zurueck(e)
    expect([eintraege(e), e.codes]).toEqual([0, {}])
    expect(zurueck(e)).toBe(e)
  })

  it('Prüfbefund W3: Herausnehmen eines Disq.-Buchstabens nimmt SEINEN Merker – „zurück“ danach = wirklich letzter Tipp', () => {
    // Disq. A, Code 1, Disq. B, dann A wieder heraus: letzter Tipp ist B, nicht Code 1.
    let e = tippeDisq(leererEntwurf(), 'A')
    e = tippe(e, tor5, 'katalog:tor5', '1')
    e = tippeDisq(e, 'B')
    e = tippeDisq(e, 'A')
    expect(e.disq).toEqual(['B'])
    e = zurueck(e)
    expect([e.disq, e.codes]).toEqual([[], { 'katalog:tor5': ['1'] }])
    e = zurueck(e)
    expect([e.disq, e.codes, e.folge]).toEqual([[], {}, []])
  })

  it('Punkte nur der Codes des Teils (Steg je Teil)', () => {
    const steg = maskeFuer(sichtMit(DM, 'steg'), '5')!
    const e = tippe(tippe(tippeDisq(leererEntwurf(), 'A'), steg, 'katalog:stegAblegen', '3'), steg, 'katalog:stegAnlegen', '9')
    expect([punkteVon(e, steg, 'ab'), punkteVon(e, steg, 'an'), punkteVon(e, steg)]).toEqual([5, 10, 15])
  })

  it('entwurfAus ist rund: zellenAus(entwurfAus(z)) = z', () => {
    for (const konfig of [DM, UIM]) {
      for (const typeId of ['steg', 'tor5', 'mueb', 'vorsteg', 'gate135', 'moewe135', 'brechts', 'tor5puems', ...(konfig === UIM ? ['parallelparcours'] : [])]) {
        // Bojen-Listen an der Klasse mit den meisten Zeilen, die übrigen an der ersten mit Maske.
        const aufbau = probeMaske(sichtMit(konfig, typeId))!
        for (let saat = 1; saat <= 30; saat++) {
          const zellen = zellenAus(zufallsEntwurf(aufbau, undefined, saat), aufbau)
          expect(zellenAus(entwurfAus(zellen, aufbau), aufbau), `${typeId} ${saat}`).toEqual(zellen)
        }
      }
    }
    expect(entwurfAus({ 'katalog:tor5': '1, 2x20', 'disq@tor5': 'P, A' }, tor5)).toMatchObject({ codes: { 'katalog:tor5': ['1', '20', '20'] }, disq: ['P', 'A'] })
  })
})

describe('Höchstzahl je Code und Disq. danach (Nutzer 24.11.2026, CM1–CM5)', () => {
  const tor5 = maskeFuer(sichtMit(DM, 'tor5'), '5')!
  const T5 = 'katalog:tor5'

  it('Tor 5 Code 1 höchstens 1×: der zweite Tipp nimmt nichts an, der Knopf sagt es', () => {
    const e = tippe(leererEntwurf(), tor5, T5, '1')
    const c1 = tor5.teile[0].codes.find((c) => c.code === '1')!
    expect([c1.max, c1.danach]).toEqual([1, undefined])
    expect(tippe(e, tor5, T5, '1')).toBe(e)
    expect(codeStand(e, T5, c1)).toEqual({ anzahl: 1, voll: true, naechster: 'nichts', danachGesetzt: false })
    expect(zellenAus(e, tor5)[T5]).toBe('1')
  })

  it('„2. und 3. Versuch“: der dritte Tipp setzt Disq. D, der vierte nichts; Rückgängig nimmt D, Zähler wieder 2', () => {
    const c20 = tor5.teile[0].codes.find((c) => c.code === '20')!
    expect([c20.max, c20.danach]).toEqual([2, 'D'])
    let e = tippe(tippe(leererEntwurf(), tor5, T5, '20'), tor5, T5, '20')
    expect(codeStand(e, T5, c20)).toEqual({ anzahl: 2, voll: true, naechster: 'danach', danachGesetzt: false })
    e = tippe(e, tor5, T5, '20')
    expect([codeAnzahl(e, T5, '20'), e.disq, e.folge.at(-1)]).toEqual([2, ['D'], '#disq:D'])
    expect(codeStand(e, T5, c20)).toEqual({ anzahl: 2, voll: true, naechster: 'nichts', danachGesetzt: true })
    expect(zellenAus(e, tor5)).toEqual({ [T5]: '2x20', 'disq@tor5': 'D', 'bemerkung@tor5': '' })
    expect(tippe(e, tor5, T5, '20')).toBe(e)
    e = zurueck(e)
    expect([codeAnzahl(e, T5, '20'), e.disq]).toEqual([2, []])
    e = zurueck(e)
    expect(codeAnzahl(e, T5, '20')).toBe(1)
    // D schon über DISQ gesetzt: Der dritte Tipp ändert nichts, der Knopf zeigt „Disq. D gesetzt“.
    const mitD = tippe(tippe(tippeDisq(leererEntwurf(), 'D'), tor5, T5, '20'), tor5, T5, '20')
    expect(tippe(mitD, tor5, T5, '20')).toBe(mitD)
    expect(codeStand(mitD, T5, c20).danachGesetzt).toBe(true)
  })

  it('Prellschutz (CM8, Prüfbefund 24.11.2026): nur an Codes mit `danach`, nur derselbe Code, nur innerhalb von bojenSchalterPrellMs', () => {
    const ms = WKR_ANNAHMEN.bojenSchalterPrellMs
    // Erster Tipp nie verworfen; gleich danach auf 20 („2. und 3. Versuch“) verworfen, ab der Grenze wieder angenommen.
    expect(codeTippPrellt(tor5, T5, '20', undefined, 1000)).toBe(false)
    expect(codeTippPrellt(tor5, T5, '20', 1000, 1000 + ms - 1)).toBe(true)
    expect(codeTippPrellt(tor5, T5, '20', 1000, 1000 + ms)).toBe(false)
    // Codes ohne `danach` zählen jeden Tipp (wie die Tor-5-Zähler, S1); unbekannte Codes und Felder prellen nicht.
    expect(codeTippPrellt(tor5, T5, '1', 1000, 1001)).toBe(false)
    expect(codeTippPrellt(tor5, T5, '99', 1000, 1001)).toBe(false)
    expect(codeTippPrellt(tor5, 'katalog:fremd', '20', 1000, 1001)).toBe(false)
    // Am Steg ebenso: 6 im Ablegen, 7 im Anlegen – DM und UIM.
    for (const konfig of [DM, UIM]) {
      const steg = maskeFuer(sichtMit(konfig, 'steg'), '5')!
      expect(codeTippPrellt(steg, 'katalog:stegAblegen', '6', 1000, 1100)).toBe(true)
      expect(codeTippPrellt(steg, 'katalog:stegAnlegen', '7', 1000, 1100)).toBe(true)
    }
    // Wo das Disq.-Feld D nicht annimmt, fehlt `danach` – dann auch kein Prellschutz.
    const sicht = {
      klassen: { '5': { titel: 'Klasse 5', felder: [{ kennung: 'katalog:eigen', kind: 'code', label: 'Eigen', katalog: [{ code: '6', punkte: 5, text: 'a', max: 2, danach: 'D' }], disq: [{ code: 'A', text: 'x' }] }] } },
    } as unknown as ListenSicht
    expect(codeTippPrellt(maskeFuer(sicht, '5')!, 'katalog:eigen', '6', 1000, 1001)).toBe(false)
  })

  it('Steg: 6 im Ablegen und 7 im Anlegen setzen D ins gemeinsame Disq.-Feld – DM und UIM', () => {
    for (const konfig of [DM, UIM]) {
      const steg = maskeFuer(sichtMit(konfig, 'steg'), '5')!
      const ab = tippe(tippe(tippe(leererEntwurf(), steg, 'katalog:stegAblegen', '6'), steg, 'katalog:stegAblegen', '6'), steg, 'katalog:stegAblegen', '6')
      expect(zellenAus(ab, steg, 'ab')).toMatchObject({ 'katalog:stegAblegen': '2x6', 'disq@steg': 'D' })
      const an = tippe(tippe(tippe(leererEntwurf(), steg, 'katalog:stegAnlegen', '7'), steg, 'katalog:stegAnlegen', '7'), steg, 'katalog:stegAnlegen', '7')
      expect(zellenAus(an, steg, 'an')).toMatchObject({ 'katalog:stegAnlegen': '2x7', 'disq@steg': 'D' })
    }
  })

  it('allgemeine Grenze (CM2) für Codes ohne eigene Angabe; ein unbekannter Code ändert nichts', () => {
    const mueb = maskeFuer(sichtMit(DM, 'mueb'), '5')!
    const c13 = mueb.teile[0].codes.find((c) => c.code === '13')!
    expect([c13.max, c13.danach]).toEqual([WKR_ANNAHMEN.codeMaxAllgemein, undefined])
    let e = leererEntwurf()
    for (let i = 0; i < WKR_ANNAHMEN.codeMaxAllgemein; i++) e = tippe(e, mueb, 'katalog:mueb', '13')
    expect(tippe(e, mueb, 'katalog:mueb', '13')).toBe(e)
    expect(codeStand(e, 'katalog:mueb', c13)).toMatchObject({ voll: true, naechster: 'nichts' })
    expect(tippe(e, mueb, 'katalog:mueb', '99')).toBe(e)
  })

  it('jede Tipp-Folge mit Grenze und D-Übergang besteht wertGilt – jeder Code jeder Liste, DM und UIM, jede Klasse und jeder Teil', () => {
    const fehler: string[] = []
    let geprueft = 0
    for (const konfig of [DM, UIM]) {
      for (const p of konfig.getPositions()) {
        const sicht = sichtMit(konfig, p.typeId)
        for (const k of KLASSEN) {
          const aufbau = maskeFuer(sicht, k)
          if (!aufbau || aufbau.art === 'spaeter') continue
          const felder = new Map(listenFelder(konfig, p.typeId, k).map((f) => [f.kennung, f]))
          for (const t of aufbau.teile)
            for (const c of t.codes) {
              // Zwei Tipps mehr als erlaubt: am Ende genau `max`, D genau bei `danach`.
              let e = leererEntwurf()
              for (let i = 0; i < c.max + 2; i++) e = tippe(e, aufbau, t.feld, c.code)
              if (codeAnzahl(e, t.feld, c.code) !== c.max) fehler.push(`${p.typeId}/${k}/${c.code}: ${codeAnzahl(e, t.feld, c.code)}×`)
              if (e.disq.includes('D') !== (c.danach === 'D')) fehler.push(`${p.typeId}/${k}/${c.code}: D ${e.disq}`)
              for (const [kennung, wert] of Object.entries(zellenAus(e, aufbau, t.teil ?? undefined))) {
                if (!wertGilt(felder.get(kennung)!, wert)) fehler.push(`${p.typeId}/${k}/${c.code}: ${kennung} = „${wert}“`)
                geprueft++
              }
            }
        }
      }
    }
    expect(fehler).toEqual([])
    expect(geprueft).toBeGreaterThan(100)
  })

  it('entwurfAus zählt höchstens bis max und setzt nie den Buchstaben danach', () => {
    expect(entwurfAus({ [T5]: '2x1, 3x20' }, tor5)).toMatchObject({ codes: { [T5]: ['1', '20', '20'] }, disq: [] })
    // Derselbe Code in zwei Einträgen zählt zusammen – auch dann kein D.
    expect(entwurfAus({ [T5]: '20, 2x20' }, tor5)).toMatchObject({ codes: { [T5]: ['20', '20'] }, disq: [] })
  })

  it('der Buchstabe danach nur, wo das Disq.-Feld des Teils ihn annimmt', () => {
    const sicht = {
      klassen: { '5': { titel: 'Klasse 5', felder: [{ kennung: 'katalog:eigen', kind: 'code', label: 'Eigen', katalog: [{ code: '6', punkte: 5, text: 'a', max: 2, danach: 'D' }], disq: [{ code: 'A', text: 'x' }] }] } },
    } as unknown as ListenSicht
    const m = maskeFuer(sicht, '5')!
    expect(m.teile[0].codes[0].danach).toBeUndefined()
    const e = tippe(tippe(leererEntwurf(), m, 'katalog:eigen', '6'), m, 'katalog:eigen', '6')
    expect(tippe(e, m, 'katalog:eigen', '6')).toBe(e)
  })
})

describe('Zweite Sprache (F13)', () => {
  it('UIM: Titel und Katalogtexte aus `andere`, Codes und Punkte gleich; DM ohne `andere` bleibt bei der Liste', () => {
    let u = uimParallelStand()
    u = reducer(u, { type: 'BETRIEB_BEGINNEN', bereich: 'parallel', punkt: 'runde:pre', zeit: 500 })
    const sicht = sichtListe(u, UIM, { bereich: 'parallel', typeId: 'steg', racecourse: 'A' }, { geraete: {} })
    const en = maskeFuer(sicht, '1')!
    const de = maskeFuer(sicht, '1', 'andere')!
    expect(de.titel).toBe('Klasse 1')
    expect(en.titel).toBe('Class 1')
    expect(de.teile.map((t) => t.codes.map((c) => [c.code, c.punkte]))).toEqual(en.teile.map((t) => t.codes.map((c) => [c.code, c.punkte])))
    expect(de.teile[0].codes.map((c) => c.text)).not.toEqual(en.teile[0].codes.map((c) => c.text))
    expect(de.teile[0].titel).not.toBe(en.teile[0].titel)
    const dm = sichtMit(DM, 'steg')
    expect(maskeFuer(dm, '5', 'andere')).toEqual(maskeFuer(dm, '5'))
  })
})

describe('Takt des Weiterspringens (G5, Overlay seit dem Feldtest 21.11.2026: N1)', () => {
  const A = WKR_ANNAHMEN
  it('ohne Quittung: Overlay bis uebertragenMaxMs, dann 1 s Sperre, dann frei – an den Grenzen genau', () => {
    expect(wechselTakt(null, 5000)).toBe('frei')
    const t0 = 10_000
    expect(wechselTakt(t0, t0)).toBe('gesendet')
    expect(wechselTakt(t0, t0 + A.uebertragenMaxMs - 1)).toBe('gesendet')
    expect(wechselTakt(t0, t0 + A.uebertragenMaxMs)).toBe('sperre')
    expect(wechselTakt(t0, t0 + A.uebertragenMaxMs + A.sperreMs - 1)).toBe('sperre')
    expect(wechselTakt(t0, t0 + A.uebertragenMaxMs + A.sperreMs)).toBe('frei')
    // Uhr rückwärts: lieber warten.
    expect(wechselTakt(t0, t0 - 500)).toBe('gesendet')
    expect([A.uebertragenMinMs, A.uebernommenMs, A.uebertragenMaxMs, A.sperreMs]).toEqual([600, 800, 3000, 1000])
  })

  it('schnelle Quittung: „übernommen“ erst ab uebertragenMinMs, dann uebernommenMs, dann Sperre', () => {
    const t0 = 10_000
    const q = t0 + 100
    expect(wechselNach(t0, q)).toBe(A.uebertragenMinMs + A.uebernommenMs)
    expect(wechselTakt(t0, t0 + A.uebertragenMinMs - 1, q)).toBe('gesendet')
    expect(wechselTakt(t0, t0 + A.uebertragenMinMs, q)).toBe('uebernommen')
    expect(wechselTakt(t0, t0 + A.uebertragenMinMs + A.uebernommenMs - 1, q)).toBe('uebernommen')
    expect(wechselTakt(t0, t0 + A.uebertragenMinMs + A.uebernommenMs, q)).toBe('sperre')
    expect(wechselTakt(t0, t0 + A.uebertragenMinMs + A.uebernommenMs + A.sperreMs, q)).toBe('frei')
  })

  it('späte Quittung: ab ihr „übernommen“; nach dem Höchstwert ändert sie nichts mehr', () => {
    const t0 = 10_000
    expect(wechselTakt(t0, t0 + 2000, t0 + 1500)).toBe('uebernommen')
    expect(wechselNach(t0, t0 + 1500)).toBe(1500 + A.uebernommenMs)
    expect(wechselNach(t0, t0 + A.uebertragenMaxMs + 10)).toBe(A.uebertragenMaxMs)
    expect(wechselTakt(t0, t0 + A.uebertragenMaxMs + 20, t0 + A.uebertragenMaxMs + 10)).toBe('sperre')
  })
})

describe('listeMitMaske (W3.2, J1)', () => {
  const dm = configFor({ regelwerk: 'dm-2026' })
  it('Steg, Vorsteg, Tor 5, MüB mit Maske; Bojen- und Zeitlisten ohne; unbekannte Liste ohne', () => {
    const klassen: ClassId[] = ['1', '4', '5', 'E']
    for (const typeId of ['steg', 'vorsteg', 'tor5', 'mueb']) expect(listeMitMaske(dm, typeId, klassen)).toBe(true)
    // W4.1: Bojen-Listen haben jetzt eine Maske; Zeit und Start/Ziel mit Zeit noch nicht; Knoten seit W5.3 (Prüfliste).
    for (const typeId of ['gate135', 'gate245', 'frontal135', 'parcoursms', 'moewe135', 'knoten']) expect(listeMitMaske(dm, typeId, klassen), typeId).toBe(true)
    // W5.4 (22.11.2026): Zeit-Listen und Start/Ziel mit Zeit haben jetzt eine Maske.
    for (const typeId of ['zeit', 'moewezeit', 'bstartziel']) expect(listeMitMaske(dm, typeId, klassen), typeId).toBe(true)
    expect(listeMitMaske(dm, 'gibt-es-nicht', klassen)).toBe(false)
  })
  it('ohne Starter zählen alle Klassen der Liste', () => {
    expect(listeMitMaske(dm, 'steg', [])).toBe(true)
    expect(listeMitMaske(dm, 'gate135', [])).toBe(true)
    expect(listeMitMaske(dm, 'knoten', [])).toBe(true)
  })
})

describe('probeMaske (W3.4, G10)', () => {
  it('erste Klasse mit Maske; Bojen-Liste: Klasse mit den meisten Zeilen (P11); Knoten und Klassen ohne Liste → keine Probe', () => {
    expect(probeMaske(sichtMit(DM, 'tor5'))?.art).toBe('katalog')
    expect(probeMaske(sichtMit(DM, 'vorsteg'))?.art).toBe('vorsteg')
    expect(probeMaske(sichtMit(UIM, 'steg'))?.teile.map((t) => t.teil)).toEqual(['ab', 'an'])
    const gate = probeMaske(sichtMit(DM, 'gate135'))!
    expect([gate.art, gate.titel, gate.umschalter]).toEqual(['bojen', 'Klasse 7', true])
    expect(probeMaske(sichtMit(DM, 'knoten'))).toBeNull()
    expect(probeMaske({ klassen: { '1': { titel: 'Klasse 1', felder: null } } } as unknown as ListenSicht)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// W4.1 Bojen-Maske (Plan docs/plan-wkr-w4.md §4.3, P1–P13)
// ---------------------------------------------------------------------------

/** Die Zeilen einer Bojen-Maske kurz: „Tor 1 hin“, „2. Tor 1 rueck“, „[katalog:tor5]“. */
function zeilen(a: MaskenAufbau): string[] {
  return a.abschnitte.map((x) => (x.art === 'halt' ? `${x.halt.durchfahrt ? '2. ' : ''}${x.halt.titel} ${x.halt.weg}` : `[${x.teil.feld}]`))
}

describe('Bojen-Maske: Aufbau in Fahrtfolge (P3, P6, P7, P8)', () => {
  it('gate135: Kl. 4 ohne Tor 1 R und ohne Umschalter; Kl. 7 mit Sp. 2 und 2. Durchfahrt nach Sp. 2, Umschalter', () => {
    const sicht = sichtMit(DM, 'gate135')
    const k4 = maskeFuer(sicht, '4')!
    expect(zeilen(k4)).toEqual(['Start hin', 'Tor 1 hin', 'Tor 3 hin', 'Tor 5 hin', 'Tor 5 rueck', 'Tor 3 rueck', 'Ziel rueck'])
    expect([maskenZeilen(k4), k4.umschalter]).toEqual([7, false])
    const k7 = maskeFuer(sicht, '7')!
    expect(zeilen(k7)).toEqual(['Start hin', 'Tor 1 hin', 'Tor 3 hin', 'Tor 5 hin', 'Tor 5 rueck', 'Tor 3 rueck', 'Tor 1 rueck', 'Sp. 2 rueck', '2. Tor 1 rueck', 'Ziel rueck'])
    expect([maskenZeilen(k7), k7.umschalter]).toEqual([10, true])
    // Klassen 5/6: Tor 1 R, aber weder Sp. 2 noch Speedrunde – 8 Zeilen, ab da Umschalter.
    expect([maskenZeilen(maskeFuer(sicht, '5')!), maskeFuer(sicht, '5')!.umschalter]).toEqual([8, true])
    // Knöpfe: zwei Bojen je Tor in der Folge des Bogens, Tor 5 Zähler, sonst Schalter, Disq. ins Disq.-Feld.
    const tor1 = k7.abschnitte[1]
    expect(tor1.art === 'halt' && tor1.halt.bojen.map((b) => [b.feld, b.unter, b.spalte, b.zaehler, b.punkte])).toEqual([
      ['t1a|hin seiteA', 'H R', 0, false, 5],
      ['t1a|hin seiteB', 'H L', 1, false, 5],
    ])
    const tor5 = k7.abschnitte[3]
    expect(tor5.art === 'halt' && tor5.halt.bojen.map((b) => [b.feld, b.zaehler])).toEqual([['t5|hin seiteA', true]])
    const sp2 = k7.abschnitte[7]
    expect(sp2.art === 'halt' && sp2.halt.bojen.map((b) => [b.unter, b.spalte])).toEqual([['', null]])
    expect([k7.disq!.feld, k7.bemerkung, k7.teile]).toEqual(['disq@gate135', null, []])
    expect(k7.abschnitte.map(wegVon)).toEqual(['hin', 'hin', 'hin', 'hin', 'rueck', 'rueck', 'rueck', 'rueck', 'rueck', 'rueck'])
  })

  it('frontal135: gleiche Fahrtfolge wie gate135 (Bogen stellt Tor 5 rück vor hin), Seiten nach Blick gespiegelt', () => {
    for (const konfig of [DM, UIM]) {
      for (const k of KLASSEN) {
        const gate = maskeFuer(sichtMit(konfig, 'gate135'), k)
        const frontal = maskeFuer(sichtMit(konfig, 'frontal135'), k)
        if (!gate || !frontal) {
          expect(frontal, k).toBe(gate)
          continue
        }
        expect(zeilen(frontal), k).toEqual(zeilen(gate))
        expect(bojenVon(frontal).map((b) => b.feld).sort(), k).toEqual(bojenVon(gate).map((b) => b.feld).sort())
      }
    }
    const k7 = maskeFuer(sichtMit(DM, 'frontal135'), '7')!
    const tor1 = k7.abschnitte[1]
    expect(tor1.art === 'halt' && tor1.halt.bojen.map((b) => [b.feld, b.unter, b.spalte])).toEqual([
      ['t1a|hin seiteB', 'H L', 0],
      ['t1a|hin seiteA', 'H R', 1],
    ])
  })

  it('moewe135: Einfahrt Tor 5 (Katalog) zwischen Tor 5 hin und rück, zum Hinweg; Zeilen zählen die Codes', () => {
    const k7 = maskeFuer(sichtMit(DM, 'moewe135'), '7')!
    expect(zeilen(k7)).toEqual(['Tor 1 hin', 'Tor 3 hin', 'Tor 5 hin', '[katalog:tor5]', 'Tor 5 rueck', 'Tor 3 rueck', 'Tor 1 rueck', 'Sp. 2 rueck', '2. Tor 1 rueck'])
    const einfahrt = k7.abschnitte[3]
    expect(einfahrt.art === 'katalog' && [einfahrt.weg, einfahrt.teil.codes.length]).toEqual(['hin', 3])
    expect(maskenZeilen(k7)).toBe(8 + 3)
    // Tor 5 mit nur einer Boje (Einzelboje): Spalte ihrer Seite.
    const t5 = k7.abschnitte[2]
    expect(t5.art === 'halt' && t5.halt.bojen.map((b) => [b.feld, b.spalte, b.zaehler])).toEqual([['t5|hin seiteA', 0, true]])
  })

  it('MüB (brechts, bawuewasser1) nach Tor 1 R auf dem Rückweg; Start/Ziel-Listen ohne Blick: L links, R rechts', () => {
    const b = maskeFuer(sichtMit(DM, 'brechts'), '7')!
    expect(zeilen(b)).toEqual(['Tor 1 hin', 'Tor 3 hin', 'Tor 3 rueck', 'Tor 1 rueck', '[katalog:mueb]', '2. Tor 1 rueck'])
    const p = maskeFuer(sichtMit(DM, 'tor5puems'), '5')!
    expect(zeilen(p)).toEqual(['Start hin', '[katalog:tor5]', 'Ziel rueck'])
    const start = p.abschnitte[0]
    expect(start.art === 'halt' && start.halt.bojen.map((x) => [x.unter, x.spalte])).toEqual([['L', 0], ['R', 1]])
    expect(p.bemerkung).toBe('bemerkung@tor5puems')
    // Nur Einzelbojen (Baden-Württemberg Land 1): kein zweibojiges Tor → volle Breite.
    expect(bojenVon(maskeFuer(sichtMit(DM, 'bawueland1'), '7')!).every((x) => x.spalte === null)).toBe(true)
  })

  it('Parallelslalom (UIM): Start, Boje 1–5 hin (Boje 5 Wende), Boje 4–1 und Ziel zurück; Bojen volle Breite', () => {
    // sichtMit nimmt die Konfiguration ohne Sprachwahl (deutsch); die englischen Köpfe prüft sicht.test.ts.
    const a = maskeFuer(sichtMit(UIM, 'parallelparcours'), '1')!
    expect(zeilen(a)).toEqual(['Start hin', 'Boje 1 hin', 'Boje 2 hin', 'Boje 3 hin', 'Boje 4 hin', 'Boje 5 hin', 'Boje 4 rueck', 'Boje 3 rueck', 'Boje 2 rueck', 'Boje 1 rueck', 'Ziel rueck'])
    expect(a.umschalter).toBe(true)
    const b3 = a.abschnitte[3]
    expect(b3.art === 'halt' && b3.halt.bojen.map((x) => [x.feld, x.spalte, x.zaehler])).toEqual([['b3a', null, false]])
  })
})

describe('Bojen-Maske: Tipps, Zellen, zurück (P2, P4, P5, P9, P13)', () => {
  const k7 = maskeFuer(sichtMit(DM, 'gate135'), '7')!
  const B = (feld: string) => bojenVon(k7).find((b) => b.feld === feld)!

  it('Schalter: erster Tipp setzt 5, zweiter nimmt weg (samt Merker); Zähler: +5 bis bojenZaehlerMax', () => {
    let e = tippeBoje(leererEntwurf(), B('t1a|hin seiteB'))
    expect(zellenAus(e, k7)['t1a|hin seiteB']).toBe('5')
    e = tippeBoje(e, B('t3a|hin seiteA'))
    e = tippeBoje(e, B('t1a|hin seiteB'))
    expect([e.bojen, e.folge]).toEqual([{ 't3a|hin seiteA': 1 }, ['#boje:t3a|hin seiteA']])
    let z = leererEntwurf()
    for (let i = 0; i < 3; i++) z = tippeBoje(z, B('t5|hin seiteA'))
    expect(zellenAus(z, k7)['t5|hin seiteA']).toBe('15')
    for (let i = 0; i < 20; i++) z = tippeBoje(z, B('t5|hin seiteA'))
    expect(z.bojen['t5|hin seiteA']).toBe(WKR_ANNAHMEN.bojenZaehlerMax)
    expect(tippeBoje(z, B('t5|hin seiteA'))).toBe(z)
    expect(zellenAus(z, k7)['t5|hin seiteA']).toBe(String(WKR_ANNAHMEN.bojenZaehlerMax * 5))
  })

  it('„↩ Rückgängig“ kennt Bojen (Zähler: ein Tipp), Codes und Disq.; Punkte und Einträge je Seite', () => {
    let e = tippeBoje(leererEntwurf(), B('t5|hin seiteA'))
    e = tippeBoje(e, B('t5|hin seiteA'))
    e = tippeDisq(e, 'G')
    e = tippeBoje(e, B('t1b|rueck seiteB'))
    expect([eintraege(e), punkteVon(e, k7), eintraegeAuf(e, k7, 'hin'), eintraegeAuf(e, k7, 'rueck')]).toEqual([4, 15, 2, 1])
    e = zurueck(e)
    expect(e.bojen).toEqual({ 't5|hin seiteA': 2 })
    e = zurueck(zurueck(e))
    expect([e.bojen, e.disq]).toEqual([{ 't5|hin seiteA': 1 }, []])
    e = zurueck(e)
    expect([e.bojen, e.folge, eintraege(e)]).toEqual([{}, [], 0])
  })

  it('t1b und t1c getrennt; Disq. nur ins Disq.-Feld; Fehlerfrei = alle Felder leer', () => {
    let e = tippeBoje(leererEntwurf(), B('t1b|rueck seiteA'))
    e = tippeBoje(e, B('t1c|rueck seiteA'))
    e = tippeBoje(e, B('t1c|rueck seiteB'))
    e = tippeDisq(e, 'G')
    const zellen = zellenAus(e, k7)
    expect([zellen['t1b|rueck seiteA'], zellen['t1b|rueck seiteB'], zellen['t1c|rueck seiteA'], zellen['t1c|rueck seiteB'], zellen['disq@gate135']]).toEqual(['5', '', '5', '5', 'G'])
    for (const b of bojenVon(k7)) expect(zellen[b.feld], b.feld).toMatch(/^\d*$/)
    const leer = zellenAus(leererEntwurf(), k7)
    expect(Object.values(leer).every((w) => w === '')).toBe(true)
    expect(Object.keys(leer).sort()).toEqual([...bojenVon(k7).map((b) => b.feld), 'disq@gate135'].sort())
  })

  it('entwurfAus: Punkte → Berührungen gerundet, Schalter höchstens 1, Zähler höchstens bojenZaehlerMax; Buchstaben der Zelle = Disq. an der Boje (U1), mit Punkten (W4-12), mehrere (R7-14), fremde übergangen', () => {
    const b = B('t1b|rueck seiteA')
    const [x, y] = b.disq.map((d) => d.code)
    const e = entwurfAus(
      { 't1a|hin seiteA': '10', 't5|hin seiteA': '14', 't5|rueck seiteA': '500', 't3a|hin seiteB': 'G', 't3b|rueck seiteB': 'X', 't1b|rueck seiteA': `5, ${x}, ${y}`, 'disq@gate135': 'G' },
      k7,
    )
    expect(e.bojen).toEqual({ 't1a|hin seiteA': 1, 't5|hin seiteA': 3, 't5|rueck seiteA': WKR_ANNAHMEN.bojenZaehlerMax, 't1b|rueck seiteA': 1 })
    expect(e.bojenDisq).toEqual({ 't3a|hin seiteB': ['G'], 't1b|rueck seiteA': [x, y] })
    expect(e.disq).toEqual(['G'])
    // Rund-Probe (BZ6): die Zelle kommt in derselben Form zurück.
    expect(zellenAus(e, k7)['t1b|rueck seiteA']).toBe(`5, ${x}, ${y}`)
  })

  it('Disq. an der Boje (W4-12, 21.11.2026, BZ1/BZ3): Buchstabe NEBEN den Punkten, Boje nimmt weiter Tipps, Herausnehmen nur des Buchstabens', () => {
    const b = B('t3a|hin seiteB')
    expect(b.disq.map((d) => d.code)).toContain('G')
    expect(b.disq.map((d) => d.code)).not.toContain('X')
    let e = tippeBoje(leererEntwurf(), b)
    e = tippeBoje(e, B('t1a|hin seiteA'))
    e = tippeBojenDisq(e, b, 'G')
    expect(e.bojen).toEqual({ 't1a|hin seiteA': 1, 't3a|hin seiteB': 1 })
    expect(e.bojenDisq).toEqual({ 't3a|hin seiteB': ['G'] })
    expect(zellenAus(e, k7)['t3a|hin seiteB']).toBe('5, G')
    expect(zellenAus(e, k7)['disq@gate135']).toBe('')
    // Punkte zählen weiter (die Wertung disqualifiziert, die Punkte bleiben sichtbar).
    expect([eintraege(e), punkteVon(e, k7), eintraegeAuf(e, k7, 'hin')]).toEqual([3, 10, 3])
    expect(disqAnBojen(e, k7)).toEqual([{ feld: 't3a|hin seiteB', code: 'G' }])
    // Die Boje nimmt weiter Tipps an: Schalter nimmt die Berührung weg, der Buchstabe bleibt.
    const ohne = tippeBoje(e, b)
    expect([ohne.bojen['t3a|hin seiteB'], ohne.bojenDisq['t3a|hin seiteB'], zellenAus(ohne, k7)['t3a|hin seiteB']]).toEqual([undefined, ['G'], 'G'])
    // Ein fremder Buchstabe ändert nichts; ein anderer kommt DAZU (BZ7, R7-14 – vorher ersetzte er).
    expect(tippeBojenDisq(e, b, 'X')).toBe(e)
    expect(tippeBojenDisq(e, b, 'N').bojenDisq).toEqual({ 't3a|hin seiteB': ['G', 'N'] })
    // Derselbe Buchstabe nimmt NUR ihn heraus (samt Merker); null alle – die Berührungen bleiben.
    expect(tippeBojenDisq(e, b, 'G').bojenDisq).toEqual({})
    expect(tippeBojenDisq(e, b, null).bojen).toEqual(e.bojen)
    expect(tippeBojenDisq(e, b, null).folge).toEqual(['#boje:t3a|hin seiteB', '#boje:t1a|hin seiteA'])
    // „zurück“ nimmt den Buchstaben, danach je eine Berührung.
    expect([zurueck(e).bojenDisq, zurueck(e).bojen]).toEqual([{}, { 't1a|hin seiteA': 1, 't3a|hin seiteB': 1 }])
    expect(zurueck(zurueck(zurueck(e)))).toEqual(leererEntwurf())
    expect(tippeBojenDisq(leererEntwurf(), b, null)).toEqual(leererEntwurf())
  })

  it('mehrere Disq. an einer Boje (R7-14, 22.11.2026, BZ6/BZ7): an/aus je Buchstabe, Zelle in Katalogfolge, „zurück“ nimmt den zuletzt gesetzten', () => {
    const b = B('t3a|hin seiteB')
    const [x, y, z] = b.disq.map((d) => d.code)
    // In umgekehrter Folge getippt – die Zelle ordnet nach dem Katalog, der Entwurf merkt die Tippfolge.
    let e = tippeBojenDisq(tippeBojenDisq(tippeBoje(leererEntwurf(), b), b, y), b, x)
    expect(e.bojenDisq).toEqual({ 't3a|hin seiteB': [y, x] })
    expect(zellenAus(e, k7)['t3a|hin seiteB']).toBe(`5, ${x}, ${y}`)
    expect(bojenDisqVon(e, b)).toEqual([x, y])
    expect(disqAnBojen(e, k7).map((d) => d.code)).toEqual([y, x])
    expect([eintraege(e), eintraegeAuf(e, k7, 'hin'), bojenDisqZahl(e, b.feld)]).toEqual([3, 3, 2])
    // Ein dritter dazu, dann der mittlere wieder aus: die übrigen bleiben.
    e = tippeBojenDisq(e, b, z)
    expect(zellenAus(e, k7)['t3a|hin seiteB']).toBe(`5, ${x}, ${y}, ${z}`)
    e = tippeBojenDisq(e, b, y)
    expect(zellenAus(e, k7)['t3a|hin seiteB']).toBe(`5, ${x}, ${z}`)
    // „zurück“ = der zuletzt gesetzte Buchstabe (z), dann x, dann die Berührung.
    e = zurueck(e)
    expect(e.bojenDisq).toEqual({ 't3a|hin seiteB': [x] })
    e = zurueck(e)
    expect([e.bojenDisq, e.bojen]).toEqual([{}, { 't3a|hin seiteB': 1 }])
    expect(zurueck(e)).toEqual(leererEntwurf())
    // null nimmt alle Buchstaben samt Merkern.
    const alle = tippeBojenDisq(tippeBojenDisq(tippeBojenDisq(leererEntwurf(), b, x), b, y), b, z)
    expect(tippeBojenDisq(alle, b, null)).toEqual(leererEntwurf())
    // Rund-Probe mit „5, x, y, z“.
    const zellen = zellenAus(tippeBoje(alle, b), k7)
    expect(zellenAus(entwurfAus(zellen, k7), k7)).toEqual(zellen)
    expect(zellen['t3a|hin seiteB']).toBe(`5, ${x}, ${y}, ${z}`)
  })

  it('Disq. an der Boje, „zurück“ (H2): Punkte → Disq. → zurück = Punkte; Zähler „10, G“', () => {
    const b = B('t3a|hin seiteB')
    const z = B('t5|hin seiteA')
    let e = tippeBojenDisq(tippeBoje(leererEntwurf(), b), b, 'G')
    expect(zellenAus(e, k7)['t3a|hin seiteB']).toBe('5, G')
    e = zurueck(e)
    expect(zellenAus(e, k7)['t3a|hin seiteB']).toBe('5')
    expect(zurueck(e)).toEqual(leererEntwurf())
    // Zähler mit zwei Berührungen und Buchstabe: „10, G“; zurück nimmt den Buchstaben, dann die Berührungen einzeln.
    const code = z.disq[0].code
    let f = tippeBojenDisq(tippeBoje(tippeBoje(leererEntwurf(), z), z), z, code)
    expect([f.bojen, zellenAus(f, k7)['t5|hin seiteA']]).toEqual([{ 't5|hin seiteA': 2 }, `10, ${code}`])
    f = zurueck(f)
    expect([f.bojen, f.bojenDisq]).toEqual([{ 't5|hin seiteA': 2 }, {}])
    expect(zurueck(zurueck(f))).toEqual(leererEntwurf())
  })

  it('Bojen-Folge (Nutzer 22.11.2026): „gedreht“ = Rück-Reiter in derselben Folge wie Hin, „fahrt“ = Fahrtfolge, „untereinander“ = ein Reiter', () => {
    const halte = (xs: MaskenAbschnitt[]) => xs.map((a) => (a.art === 'halt' ? `${a.halt.halt}${a.halt.durchfahrt ?? ''}` : a.teil.feld))
    // Tor 1/3/5, Klasse 5 (ohne Speedrunde): genau das Beispiel des Nutzers.
    const k5 = maskeFuer(sichtMit(DM, 'gate135'), '5')!
    expect(k5.umschalter).toBe(true)
    expect(BOJEN_FOLGE_VORGABE).toBe('gedreht')
    expect(halte(bojenAbschnitte(k5, 'gedreht', 'hin'))).toEqual(['start', 't1a', 't3a', 't5', 'katalog:tor5'].filter((h) => halte(k5.abschnitte).includes(h)))
    const rueckFahrt = halte(bojenAbschnitte(k5, 'fahrt', 'rueck'))
    expect(rueckFahrt).toEqual(['t5', 't3b', 't1b', 'ziel'])
    // Gedreht: Ziel unter Start, Tor 1 R unter Tor 1 H … – hier genau umgekehrt.
    const rueckGedreht = halte(bojenAbschnitte(k5, 'gedreht', 'rueck'))
    expect(rueckGedreht).toEqual(['ziel', 't1b', 't3b', 't5'])
    // Klasse 7 (Prüfbefund 22.11.2026): Speedrunde (Sp. 2, Tor 1 2. Durchfahrt) an ihrer Stelle der umgekehrten Fahrtfolge.
    const k7g = maskeFuer(sichtMit(DM, 'gate135'), '7')!
    expect(halte(bojenAbschnitte(k7g, 'gedreht', 'rueck'))).toEqual(['ziel', 't1c2', 'speed2', 't1b', 't3b', 't5'])
    expect(halte(bojenAbschnitte(k7g, 'fahrt', 'rueck'))).toEqual(['t5', 't3b', 't1b', 'speed2', 't1c2', 'ziel'])
    // Hin ist in beiden Folgen gleich; jedes Tor steht unter „gedreht“ auf beiden Reitern in derselben Folge.
    expect(bojenAbschnitte(k5, 'fahrt', 'hin')).toEqual(bojenAbschnitte(k5, 'gedreht', 'hin'))
    const tore = (xs: MaskenAbschnitt[]) => xs.flatMap((a) => (a.art === 'halt' && !a.halt.durchfahrt && a.halt.bojen.length === 2 ? [a.halt.titel] : []))
    expect(tore(bojenAbschnitte(k5, 'gedreht', 'rueck'))).toEqual(tore(bojenAbschnitte(k5, 'gedreht', 'hin')))
    expect(tore(bojenAbschnitte(k5, 'gedreht', 'hin'))).toEqual(['Start', 'Tor 1', 'Tor 3', 'Tor 5'].filter((t) => tore(k5.abschnitte).includes(t)))
    // Untereinander: ein Reiter, alles in Fahrtfolge; die Umschalter-Frage hängt an der Folge.
    expect([mitUmschalter(k5, 'gedreht'), mitUmschalter(k5, 'fahrt'), mitUmschalter(k5, 'untereinander')]).toEqual([true, true, false])
    expect(bojenAbschnitte(k5, 'untereinander', 'rueck')).toBe(k5.abschnitte)
    // Die Ortswahl (Disq.) zeigt alles: Hin, dann Rück wie sein Reiter.
    expect(halte(bojenAbschnitteAlle(k5, 'gedreht'))).toEqual([...halte(bojenAbschnitte(k5, 'gedreht', 'hin')), ...rueckGedreht])
    expect(bojenAbschnitteAlle(k5, 'fahrt')).toEqual(k5.abschnitte)
    // Parallelslalom: Rück-Reiter Boje 4 … 1, Ziel umgekehrt → Ziel, Boje 1 … Boje 4 (unter Start, Boje 1 … 4).
    const par = maskeFuer(sichtMit(UIM, 'parallelparcours'), '1')!
    expect(halte(bojenAbschnitte(par, 'gedreht', 'hin'))).toEqual(['start', 'b1a', 'b2a', 'b3a', 'b4a', 'b5'])
    expect(halte(bojenAbschnitte(par, 'gedreht', 'rueck'))).toEqual(['ziel', 'b1b', 'b2b', 'b3b', 'b4b'])
    expect(halte(bojenAbschnitte(par, 'fahrt', 'rueck'))).toEqual(['b4b', 'b3b', 'b2b', 'b1b', 'ziel'])
    // Jede Bojen-Maske, jede Folge: jeder Abschnitt genau einmal, beide Seiten zusammen = alle; die Folge ordnet nur um.
    for (const konfig of [DM, UIM])
      for (const p of konfig.getPositions())
        for (const k of KLASSEN) {
          const a = maskeFuer(sichtMit(konfig, p.typeId), k)
          if (!a || a.art !== 'bojen') continue
          // Seit dem Prüfbefund 22.11.2026 jede Liste: gedreht = genau die umgekehrte Fahrtfolge, sobald die Tore auf
          // dem Hinweg in umgekehrter Folge ihrer Gegenstücke stehen (bei allen Bojen-Listen so).
          if (mitUmschalter(a, 'gedreht'))
            expect(bojenAbschnitte(a, 'gedreht', 'rueck'), `${p.typeId}/${k}`).toEqual([...bojenAbschnitte(a, 'fahrt', 'rueck')].reverse())
          for (const f of BOJEN_FOLGEN) {
            const alle = mitUmschalter(a, f) ? [...bojenAbschnitte(a, f, 'hin'), ...bojenAbschnitte(a, f, 'rueck')] : bojenAbschnitte(a, f, 'hin')
            expect(new Set(alle).size, `${p.typeId}/${k}/${f}`).toBe(a.abschnitte.length)
            expect(bojenAbschnitteAlle(a, f).length, `${p.typeId}/${k}/${f}`).toBe(a.abschnitte.length)
          }
        }
  })

  it('jede Bojen-Position DM/UIM × Klasse: Tipp-Folgen nur aus Bojen-Tipps bestehen wertGilt unverändert', () => {
    let geprueft = 0
    for (const konfig of [DM, UIM]) {
      for (const p of konfig.getPositions()) {
        for (const k of KLASSEN) {
          const aufbau = maskeFuer(sichtMit(konfig, p.typeId), k)
          if (!aufbau || aufbau.art !== 'bojen') continue
          const felder = new Map(listenFelder(konfig, p.typeId, k).map((f) => [f.kennung, f]))
          const bojen = bojenVon(aufbau)
          expect(bojen.length, `${p.typeId}/${k}`).toBeGreaterThan(0)
          const r = folge(k.charCodeAt(0) + p.typeId.length)
          for (let runde = 0; runde < 10; runde++) {
            let e = leererEntwurf()
            for (let i = 0; i < 15; i++) {
              const b = bojen[r(bojen.length)]
              // Seit U1 (21.11.2026) auch Disq. an der Boje: jeder Buchstabe der Zelle, mal gesetzt, mal herausgenommen –
              // seit W4-12 neben den Punkten, seit R7-14 (22.11.2026) mehrere („5, J, D“, „10, G“); dazu „alle weg“ und „zurück“.
              const wurf = r(12)
              if (wurf < 3 && b.disq.length > 0) e = tippeBojenDisq(e, b, b.disq[r(b.disq.length)].code)
              else if (wurf === 3) e = tippeBojenDisq(e, b, null)
              else if (wurf === 4) e = zurueck(e)
              else e = tippeBoje(e, b)
            }
            const zellen = zellenAus(e, aufbau)
            for (const [kennung, wert] of Object.entries(zellen)) {
              expect(wertGilt(felder.get(kennung)!, wert), `${p.typeId}/${k}: ${kennung} = „${wert}“`).toBe(true)
              geprueft++
            }
            expect(zellenAus(entwurfAus(zellen, aufbau), aufbau)).toEqual(zellen)
          }
        }
      }
    }
    expect(geprueft).toBeGreaterThan(2000)
  })
})

describe('W5.1 Attempt-Wechsel bei derselben Startnummer (PD5, 22.11.2026)', () => {
  const p = (attempt: 1 | 2, a: string | null, b: string | null) => JSON.stringify(['p', 'pre', attempt, a, b])
  it('dieselbe Nummer, anderer Start im Parallelslalom → Attempt; sonst null', () => {
    expect(attemptWechsel({ key: p(1, 's1', 's2'), startNr: '23' }, { key: p(2, 's2', 's1'), startNr: '23' })).toBe(2)
    expect(attemptWechsel(null, { key: p(2, 's2', 's1'), startNr: '23' })).toBeNull()
    expect(attemptWechsel({ key: p(1, 's1', 's2'), startNr: '23' }, { key: p(1, 's1', 's2'), startNr: '23' })).toBeNull()
    expect(attemptWechsel({ key: p(1, 's1', 's2'), startNr: '23' }, { key: p(2, 's3', 's1'), startNr: '24' })).toBeNull()
    // Kein Parallelslalom (Lauf-Kennung): nie ein Attempt-Band.
    expect(attemptWechsel({ key: JSON.stringify(['m', 's1', 1]), startNr: '23' }, { key: JSON.stringify(['m', 's1', 2]), startNr: '23' })).toBeNull()
  })
})

describe('W5.1 listeMitBojen (F14: „Bild“ nur auf Bojen-Listen, 22.11.2026)', () => {
  it('Tor-Listen mit Bojen auf dem Fahrweg ja, Steg/Vorsteg/Tor 5/MüB nein; Parallelslalom ja', () => {
    expect(listeMitBojen(DM, 'gate135', ['7'])).toBe(true)
    for (const typeId of ['steg', 'vorsteg', 'tor5', 'mueb', 'unbekannt']) expect(listeMitBojen(DM, typeId, ['7']), typeId).toBe(false)
    expect(listeMitBojen(UIM, 'parallelparcours', [])).toBe(true)
  })
})

// W5.2 (Plan docs/plan-wkr-w5.md §5, 22.11.2026): Die Maske „Bild“ hat keine eigene Schreibweise – ein Tipp ins Bild
// wird über wkr/bild.ts bildZiel zu DERSELBEN MaskenBoje, Entwurf und Zellen entstehen über tippeBoje/tippeBojenDisq/
// zellenAus. Gleiche Tipps im Bild und in den Knöpfen → gleiche Zellen, und die bestehen wertGilt unverändert.
describe('W5.2 Maske „Bild“: gleiche Tipps → gleiche Zellen wie die Knöpfe', () => {
  it('jede Bojen-Position DM/UIM × Klasse (mit Bild bzw. Schema)', () => {
    let geprueft = 0
    for (const konfig of [DM, UIM]) {
      for (const p of konfig.getPositions()) {
        const sicht = { ...sichtMit(konfig, p.typeId), liste: listenKennung({ bereich: 'b', typeId: p.typeId, racecourse: null }) } as ListenSicht
        for (const k of KLASSEN) {
          const aufbau = maskeFuer(sicht, k)
          if (!aufbau || aufbau.art !== 'bojen') continue
          // Zeichnung wie auf dem Bogen des Aufbaus „alcatraz“; nur die Zuordnung zählt, nicht das SVG.
          const z = bildZuordnung(aufbau, { bild: { datei: `Klasse${k}`, dim: [], aus: [], drehung: 0 } })
          if (!z) continue
          const felder = new Map(listenFelder(konfig, p.typeId, k).map((f) => [f.kennung, f]))
          const wege = bildWege(aufbau)
          const r = folge(k.charCodeAt(0) * 7 + p.typeId.length)
          for (let runde = 0; runde < 6; runde++) {
            let knoepfe = leererEntwurf()
            let bild = leererEntwurf()
            let weg = wege[0]
            for (let i = 0; i < 15; i++) {
              // Der WKR stellt den Umschalter, dann tippt er eine Boje im Bild – die Knöpfe bekommen dieselbe Boje.
              if (r(4) === 0) weg = wege[r(wege.length)]
              const id = z.ids[r(z.ids.length)]
              const ziel = bildZiel(aufbau, z, id, weg)!
              expect(z.treffer[ziel.boje.feld]).toBe(id)
              if (r(5) === 0 && ziel.boje.disq.length > 0) {
                const code = ziel.boje.disq[r(ziel.boje.disq.length)].code
                bild = tippeBojenDisq(bild, ziel.boje, code)
                knoepfe = tippeBojenDisq(knoepfe, ziel.boje, code)
              } else {
                bild = tippeBoje(bild, ziel.boje)
                knoepfe = tippeBoje(knoepfe, ziel.boje)
              }
            }
            const zellen = zellenAus(bild, aufbau)
            expect(zellen).toEqual(zellenAus(knoepfe, aufbau))
            for (const [kennung, wert] of Object.entries(zellen)) {
              expect(wertGilt(felder.get(kennung)!, wert), `${p.typeId}/${k}: ${kennung} = „${wert}“`).toBe(true)
              geprueft++
            }
          }
        }
      }
    }
    expect(geprueft).toBeGreaterThan(1000)
  })

  it('jede Boje der Liste ist im Bild erreichbar (über ihre ID und eine Seite des Umschalters)', () => {
    for (const konfig of [DM, UIM]) {
      for (const p of konfig.getPositions()) {
        for (const k of KLASSEN) {
          const aufbau = maskeFuer(sichtMit(konfig, p.typeId), k)
          if (!aufbau || aufbau.art !== 'bojen') continue
          const z = bildZuordnung(aufbau, { bild: { datei: `Klasse${k}`, dim: [], aus: [], drehung: 0 } })
          if (!z) continue
          const erreichbar = new Set(z.ids.flatMap((id) => bildWege(aufbau).map((w) => bildZiel(aufbau, z, id, w)!.boje.feld)))
          for (const b of bojenVon(aufbau)) expect(erreichbar.has(b.feld), `${p.typeId}/${k}: ${b.feld}`).toBe(true)
        }
      }
    }
  })
})

describe('Zeit-Listen mit Ziffernblock (W5.4, 22.11.2026, ZT1–ZT4)', () => {
  const zeit = maskeFuer(sichtMit(DM, 'zeit'), '5')!
  const felder = new Map(listenFelder(DM, 'zeit', '5').map((f) => [f.kennung, f]))

  it('ZT2: jede Tipp-Folge (0–9, „,“ bis 5 Tasten) → Zelle besteht wertGilt unverändert und liest sich wie die Erfassung', () => {
    const tasten = ['0', '1', '2', '5', '9', ',']
    const fehler: string[] = []
    let folgen = ['']
    let geprueft = 0
    for (let n = 1; n <= 5; n++) {
      folgen = folgen.flatMap((f) => tasten.map((t) => f + t))
      for (const getippt of folgen) {
        let e = leererEntwurf()
        // Taste für Taste, wie WkrZiffern sie schickt.
        for (let i = 1; i <= getippt.length; i++) e = setzeZeit(e, zeit, 'zeit1', getippt.slice(0, i))
        const zelle = zellenAus(e, zeit).zeit1
        const lesbar = parseTime(sanitizeTimeInput(getippt, ','))
        if (!wertGilt(felder.get('zeit1')!, zelle)) fehler.push(`${getippt} → „${zelle}“ gilt nicht`)
        else if (lesbar === null ? zelle !== '' : zelle !== sanitizeTimeInput(getippt, ',')) fehler.push(`${getippt} → „${zelle}“ ≠ Erfassung`)
        else if (zelle !== '' && parseTime(zelle)!.centis !== zeitDeutung(e.zeiten.zeit1 ?? '')) fehler.push(`${getippt}: Deutung weicht ab`)
        else if (zeitUnlesbar(e, 'zeit1') !== (e.zeiten.zeit1 !== undefined && lesbar === null)) fehler.push(`${getippt}: unlesbar falsch`)
        geprueft++
      }
    }
    expect(fehler).toEqual([])
    expect(geprueft).toBeGreaterThan(9000)
  })

  it('Lesart wie am Rechner: „83,45“ und „1,2345“ = 1:23,45; „,“ nur einmal; Punkt wird Komma; höchstens 8 Zeichen', () => {
    let e = setzeZeit(leererEntwurf(), zeit, 'zeit1', '83,45')
    expect([zellenAus(e, zeit).zeit1, zeitDeutung('83,45'), zeitUhr(8345), zeitUhr(8345, '.')]).toEqual(['83,45', 8345, '1:23,45', '1:23.45'])
    e = setzeZeit(e, zeit, 'zeit2', '1,2345')
    expect(zeitDeutung(e.zeiten.zeit2)).toBe(8345)
    expect(setzeZeit(leererEntwurf(), zeit, 'zeit1', '45.6,7').zeiten.zeit1).toBe('45,67')
    expect(setzeZeit(leererEntwurf(), zeit, 'zeit1', '1234567890').zeiten.zeit1).toBe('12345678')
    expect(setzeZeit(e, zeit, 'fremd', '1')).toBe(e)
    expect(zeitUhr(4567)).toBe('0:45,67')
  })

  it('ZT5 (22.11.2026, R8-35): Pflicht nur das erste Zeitfeld; weitere leer erlaubt, befüllt nur lesbar', () => {
    let e = leererEntwurf()
    expect([zeitPflicht(zeit, 'zeit1'), zeitPflicht(zeit, 'zeit2'), zeitPflicht(zeit, 'zeit3')]).toEqual([true, false, false])
    expect([fertig(e, zeit), zeitenOffen(e, zeit)]).toEqual([false, 1])
    // Nur ein weiteres Feld gesetzt: Das erste fehlt weiter.
    expect(fertig(setzeZeit(e, zeit, 'zeit2', '83,45'), zeit)).toBe(false)
    e = setzeZeit(e, zeit, 'zeit1', '83,45')
    expect([fertig(e, zeit), zeitenOffen(e, zeit)]).toEqual([true, 0])
    expect(zellenAus(e, zeit)).toMatchObject({ zeit1: '83,45', zeit2: '', zeit3: '' })
    // Unlesbares in einem weiteren Feld sperrt.
    e = setzeZeit(e, zeit, 'zeit2', ',')
    expect([fertig(e, zeit), zeitenOffen(e, zeit), zeitUnlesbar(e, 'zeit2')]).toEqual([false, 1, true])
    e = setzeZeit(e, zeit, 'zeit2', '83,4')
    e = setzeKeineZeit(e, zeit, 'zeit3', 'nichtImZiel')
    expect([fertig(e, zeit), zeitenOffen(e, zeit)]).toEqual([true, 0])
    // Eine Zeile mit allen Feldern: „keine Zeit“ leer, die Zeiten wie getippt.
    expect(zellenAus(e, zeit)).toMatchObject({ zeit1: '83,45', zeit2: '83,4', zeit3: '' })
    expect(keineZeitAus(e, zeit)).toEqual([['zeit3', 'nichtImZiel']])
    // „Keine Zeit“ im ersten Feld genügt ebenso.
    expect(fertig(setzeKeineZeit(leererEntwurf(), zeit, 'zeit1', 'anlage'), zeit)).toBe(true)
    // Gemischte Liste (moewezeit): Bojen-Maske, aber ebenso erst mit Zeit.
    const moewe = maskeFuer(sichtMit(DM, 'moewezeit'), '5')!
    expect(fertig(leererEntwurf(), moewe)).toBe(false)
    const mz = moewe.zeiten[0].feld
    expect(fertig(setzeZeit(leererEntwurf(), moewe, mz, '75,12'), moewe)).toBe(true)
  })

  it('ZT6 (22.11.2026, R8-35): zeitVollstaendig – alle Stellen der Deutung von lib/time.ts', () => {
    const faelle: [string, boolean][] = [
      ['83,45', true],
      ['83,4', false],
      ['83', false],
      ['83,', false],
      ['20,00', true],
      ['1,2345', true],
      ['1,23', false],
      ['1,234', false],
      ['12,3456', true],
      ['12,34', false],
      [',4567', true],
      ['1:23,45', true],
      ['1:23,4', false],
      [',', false],
      ['', false],
    ]
    expect(faelle.map(([t]) => [t, zeitVollstaendig(t)])).toEqual(faelle)
  })

  it('ZT4: „keine Zeit“ leert die Zeit, eine Zeit hebt „keine Zeit“ auf; derselbe Grund bzw. null nimmt ihn heraus', () => {
    let e = setzeZeit(leererEntwurf(), zeit, 'zeit1', '83,45')
    e = setzeKeineZeit(e, zeit, 'zeit1', 'anlage')
    expect([e.zeiten.zeit1, e.keineZeit.zeit1, zellenAus(e, zeit).zeit1]).toEqual([undefined, 'anlage', ''])
    expect(setzeKeineZeit(e, zeit, 'zeit1', 'anlage').keineZeit).toEqual({})
    expect(setzeKeineZeit(e, zeit, 'zeit1', null).keineZeit).toEqual({})
    expect(setzeKeineZeit(e, zeit, 'zeit1', 'anderes').keineZeit).toEqual({ zeit1: 'anderes' })
    e = setzeZeit(e, zeit, 'zeit1', '9')
    expect([e.zeiten.zeit1, e.keineZeit.zeit1]).toEqual(['9', undefined])
    // Einträge zählen Zeiten und „keine Zeit“ (der Knopf heißt dann nie „Fehlerfrei“).
    expect(eintraege(setzeKeineZeit(e, zeit, 'zeit2', 'anlage'))).toBe(2)
  })

  it('entwurfAus ist rund mit „keine Zeit“ aus dem Kennzeichen; Entwürfe merken auch halb getippte Zeiten', () => {
    let e = setzeZeit(leererEntwurf(), zeit, 'zeit1', '1:23,45')
    e = setzeZeit(e, zeit, 'zeit2', '83,45')
    e = setzeKeineZeit(e, zeit, 'zeit3', 'anderes')
    const zellen = zellenAus(e, zeit)
    const zurueck = entwurfAus(zellen, zeit, Object.fromEntries(keineZeitAus(e, zeit)))
    expect([zellenAus(zurueck, zeit), zurueck.keineZeit]).toEqual([zellen, { zeit3: 'anderes' }])
    // „,“ allein ist (noch) nicht lesbar – die Zelle bleibt leer, der Entwurf behält es.
    const halb = setzeZeit(leererEntwurf(), zeit, 'zeit1', ',')
    expect([zellenAus(halb, zeit).zeit1, entwurfZellen(halb, zeit).zeit1]).toEqual(['', ','])
    expect(entwurfAus(entwurfZellen(halb, zeit), zeit).zeiten.zeit1).toBe(',')
  })
})

// Nutzer 24.11.2026 (WKR_ANNAHMEN NG1–NG3): „Nicht gestartet · Disq. X“ – auf jeder Liste mit eigenem Disq.-Feld, in
// beiden Regelwerken; die Disq.-Knöpfe bieten X weiter nur am Steg-Ablegen und am Vorsteg an.
describe('„Nicht gestartet · Disq. X“ (24.11.2026, NG1–NG3)', () => {
  it('jede Liste beider Regelwerke: mit Disq.-Feld X allein dort (der Bedienrechner nimmt es), ohne (Zeit, Knoten) nichts', () => {
    const mit = new Set<string>()
    const ohne = new Set<string>()
    for (const konfig of [DM, UIM]) {
      for (const { typeId } of konfig.getPositions()) {
        const sicht = sichtMit(konfig, typeId)
        for (const k of KLASSEN) {
          const a = maskeFuer(sicht, k)
          if (!a || !konfig.positionAllowsClass(typeId, k)) continue
          const disqFeld = listenFelder(konfig, typeId, k).find((f) => f.kind === 'disq')
          const zellen = nichtGestartetZellen(a)
          if (!disqFeld) {
            expect(zellen, `${typeId} ${k}`).toBeNull()
            ohne.add(typeId)
            continue
          }
          expect(zellen, `${typeId} ${k}`).toEqual({ [disqFeld.kennung]: 'X' })
          expect(wertGilt(disqFeld, 'X'), `${typeId} ${k}`).toBe(true)
          expect(istNichtGestartet(zellen!)).toBe(true)
          // X als Knopf nur am Steg (Ablegen) und am Vorsteg (F5, NG3).
          const knopfX = (teil?: ListenTeil) => disqFuer(a, teil).some((d) => d.code === 'X')
          if (typeId === 'vorsteg') expect(knopfX()).toBe(true)
          else if (typeId === 'steg') expect([knopfX('ab'), knopfX('an')]).toEqual([true, false])
          else expect(knopfX(), `${typeId} ${k}`).toBe(false)
          mit.add(typeId)
        }
      }
    }
    for (const t of ['gate135', 'tor5', 'mueb', 'steg', 'vorsteg', 'parcoursms', 'moewe135', 'parallelparcours']) expect(mit.has(t), t).toBe(true)
    for (const t of ['zeit', 'knoten']) expect(ohne.has(t), t).toBe(true)
  })

  it('istNichtGestartet: genau ein X und sonst nichts', () => {
    expect(istNichtGestartet({ 'disq@gate135': 'X', 't1a|hin seiteA': '' })).toBe(true)
    expect(istNichtGestartet({ 'disq@gate135': 'X', 't1a|hin seiteA': '5' })).toBe(false)
    expect(istNichtGestartet({ 'disq@gate135': 'A, X' })).toBe(false)
    expect(istNichtGestartet({})).toBe(false)
  })

  it('ohneFremdesX: der Entwurf aus einer X-Zeile verliert X, wo die Knöpfe es nicht anbieten (Korrektur, Rückgängig – Prüfbefund 24.11.2026)', () => {
    for (const [typeId, teil, bleibt] of [['gate135', undefined, false], ['tor5', undefined, false], ['steg', 'an', false], ['steg', 'ab', true], ['vorsteg', undefined, true]] as const) {
      const a = maskeFuer(sichtMit(DM, typeId), '7')!
      const e = entwurfAus(nichtGestartetZellen(a)!, a)
      expect(e.disq, typeId).toEqual(['X'])
      const ohne = ohneFremdesX(e, a, teil)
      expect(ohne.disq, `${typeId} ${teil}`).toEqual(bleibt ? ['X'] : [])
      if (bleibt) expect(ohne).toBe(e)
      // Abgeschickt kommt dasselbe heraus wie aus dem bereinigten Entwurf – nie ein still verschwundenes X im Fuß.
      expect(zellenAus(ohne, a, teil)[a.disq!.feld]).toBe(bleibt ? 'X' : '')
    }
  })
})
