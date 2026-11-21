import { describe, expect, it } from 'vitest'
import { configFor, type Konfig } from '../config/konfig'
import { listenFelder } from '../lib/eingaben'
import { reducer } from '../state/reducer'
import { uimParallelStand } from '../testHilfen'
import type { ClassId } from '../types'
import { WKR_ANNAHMEN } from './annahmen'
import {
  listeMitMaske,
  disqFuer,
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
  wechselNach,
  wechselTakt,
  zellenAus,
  zurueck,
  type Entwurf,
  type MaskenAufbau,
} from './maske'
import { maskenJeKlasse, sichtListe, type ListenSicht } from './sicht'
import { wertGilt } from './zeile'
import type { ListenTeil } from './liste'

// Maske „Knöpfe“ (W3.1, Plan docs/plan-wkr-w3.md §3.1): Aufbau je Position unter DM und UIM, Schreibweise wie die
// Erfassung (jede Tipp-Folge besteht wertGilt unverändert), X nur Steg-Ablegen und Vorsteg (F5), Takt des
// Weiterspringens. Keine Starter, keine Namen – nur Konfiguration.

const DM = configFor({ regelwerk: 'dm-2026' })
const UIM = configFor({ regelwerk: 'uim-2026' })
const KLASSEN: ClassId[] = ['1', '2', '3', '4', '5', 'E']

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
  for (let i = 0; i < 12; i++) {
    const w = r(10)
    if (w < 6 && teile.length > 0) {
      const t = teile[r(teile.length)]
      if (t.codes.length) e = tippe(e, t.feld, t.codes[r(t.codes.length)].code)
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
    expect(steg.teile[0].codes[0]).toEqual({ code: '3', text: expect.any(String), punkte: 5 })
    expect([steg.disq!.feld, steg.disq!.teil, steg.bemerkung]).toEqual(['disq@steg', null, 'bemerkung@steg'])
    for (const typeId of ['tor5', 'tor5pue', 'mueb']) {
      const m = maskeFuer(sichtMit(DM, typeId), '5')!
      expect([m.art, m.teile.length, m.teile[0].teil, m.disq!.feld], typeId).toEqual(['katalog', 1, null, `disq@${typeId}`])
    }
    expect(maskeFuer(sichtMit(DM, 'tor5'), '5')!.teile[0].codes.map((c) => [c.code, c.punkte])).toEqual([['1', 20], ['2', 5], ['20', 5]])
    const vorsteg = maskeFuer(sichtMit(DM, 'vorsteg'), '5')!
    expect([vorsteg.art, vorsteg.teile, vorsteg.disq!.codes.map((c) => c.code), vorsteg.bemerkung]).toEqual(['vorsteg', [], ['M', 'X'], 'bemerkung@vorsteg'])
    for (const typeId of ['tor5puems', 'gate135', 'parcoursms', 'knoten', 'zeit', 'bstartziel']) {
      const m = maskeFuer(sichtMit(DM, typeId), '5')
      expect([m?.art, m?.teile, m?.disq], typeId).toEqual(['spaeter', [], null])
    }
  })

  it('UIM: dieselben Masken mit den UIM-Katalogen (englisch)', () => {
    const steg = maskeFuer(sichtMit(UIM, 'steg'), '1')!
    expect(steg.teile.map((t) => t.codes.map((c) => c.code))).toEqual([['3', '6'], ['7', '9', '11', '12']])
    expect(steg.disq!.codes.map((c) => c.code)).toEqual(['D', 'E', 'F', 'X'])
    expect(maskeFuer(sichtMit(UIM, 'vorsteg'), '1')!.disq!.codes.map((c) => c.code)).toEqual(['X'])
    expect(maskeFuer(sichtMit(UIM, 'mueb'), '5')!.teile[0].codes.map((c) => c.code)).toEqual(['14', '15', '17', '18', '19', '21', '22'])
    expect(maskeFuer(sichtMit(UIM, 'parallelparcours'), '1')!.art).toBe('spaeter')
  })

  it('maskenArt: nur Code/Disq./Text → katalog bzw. vorsteg; Boje, Zeit, Punkte → später', () => {
    expect(maskenArt([{ kind: 'code' }, { kind: 'disq' }, { kind: 'text' }])).toBe('katalog')
    expect(maskenArt([{ kind: 'disq' }, { kind: 'text' }])).toBe('vorsteg')
    for (const kind of ['buoy', 'time', 'points'] as const) expect(maskenArt([{ kind: 'code' }, { kind }])).toBe('spaeter')
  })

  it('Liste ohne eigenes Disq.-Feld: Buchstaben ins erste Code-Feld, hinter die Codes (H1)', () => {
    const sicht = {
      klassen: { '5': { titel: 'Klasse 5', felder: [{ kennung: 'katalog:eigen', kind: 'code', label: 'Eigen', katalog: [{ code: '4', punkte: 5, text: 'a' }, { code: '2', punkte: 5, text: 'b' }], disq: [{ code: 'A', text: 'x' }, { code: 'B', text: 'y' }] }] } },
    } as unknown as ListenSicht
    const m = maskeFuer(sicht, '5')!
    expect([m.art, m.disq?.feld, m.disq?.teil, m.bemerkung]).toEqual(['katalog', 'katalog:eigen', null, null])
    const e = tippeDisq(tippeDisq(tippe(tippe(leererEntwurf(), 'katalog:eigen', '4'), 'katalog:eigen', '2'), 'B'), 'A')
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
    let geprueft = 0
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
                expect(feld, `${p.typeId}/${k}: ${kennung}`).toBeDefined()
                expect(wertGilt(feld!, wert), `${p.typeId}/${k}/${teil}: ${kennung} = „${wert}“`).toBe(true)
                geprueft++
              }
            }
          }
        }
      }
    }
    expect(geprueft).toBeGreaterThan(1000)
  })

  it('„2x6“: Mehrfachtipps zählen, sortiert wie die Erfassung; Disq. am Steg im gemeinsamen Feld, nie in den Codes', () => {
    const steg = maskeFuer(sichtMit(DM, 'steg'), '5')!
    let e = tippe(leererEntwurf(), 'katalog:stegAblegen', '6')
    e = tippe(e, 'katalog:stegAblegen', '3')
    e = tippe(e, 'katalog:stegAblegen', '6')
    e = tippeDisq(e, 'A')
    e = tippe(e, 'katalog:stegAnlegen', '12')
    expect(zellenAus(e, steg, 'ab')).toEqual({ 'katalog:stegAblegen': '3, 2x6', 'disq@steg': 'A', 'bemerkung@steg': '' })
    expect(zellenAus(e, steg, 'an')).toEqual({ 'katalog:stegAnlegen': '12', 'disq@steg': 'A', 'bemerkung@steg': '' })
    expect(zellenAus(e, steg)).toEqual({ 'katalog:stegAblegen': '3, 2x6', 'katalog:stegAnlegen': '12', 'disq@steg': 'A', 'bemerkung@steg': '' })
    // Tor 5: „2x20“, Disq. im Disq.-Feld der Liste.
    const tor5 = maskeFuer(sichtMit(DM, 'tor5'), '5')!
    const t = tippeDisq(tippe(tippe(tippe(leererEntwurf(), 'katalog:tor5', '20'), 'katalog:tor5', '1'), 'katalog:tor5', '20'), 'P')
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

  it('„− letzte zurück“ nimmt den letzten Tipp – Code oder Disq.; zweiter Disq.-Tipp nimmt ihn heraus', () => {
    let e = tippe(leererEntwurf(), 'katalog:tor5', '1')
    e = tippeDisq(e, 'A')
    e = tippe(e, 'katalog:tor5', '20')
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
    e = tippe(e, 'katalog:tor5', '1')
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
    const e = tippe(tippe(tippeDisq(leererEntwurf(), 'A'), 'katalog:stegAblegen', '3'), 'katalog:stegAnlegen', '9')
    expect([punkteVon(e, steg, 'ab'), punkteVon(e, steg, 'an'), punkteVon(e, steg)]).toEqual([5, 10, 15])
  })

  it('entwurfAus ist rund: zellenAus(entwurfAus(z)) = z', () => {
    for (const konfig of [DM, UIM]) {
      for (const typeId of ['steg', 'tor5', 'mueb', 'vorsteg']) {
        const aufbau = maskeFuer(sichtMit(konfig, typeId), '5')!
        for (let saat = 1; saat <= 30; saat++) {
          const zellen = zellenAus(zufallsEntwurf(aufbau, undefined, saat), aufbau)
          expect(zellenAus(entwurfAus(zellen, aufbau), aufbau), `${typeId} ${saat}`).toEqual(zellen)
        }
      }
    }
    expect(entwurfAus({ 'katalog:tor5': '1, 2x20', 'disq@tor5': 'P, A' }, tor5)).toMatchObject({ codes: { 'katalog:tor5': ['1', '20', '20'] }, disq: ['P', 'A'] })
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
    for (const typeId of ['gate135', 'gate245', 'zeit']) expect(listeMitMaske(dm, typeId, klassen)).toBe(false)
    expect(listeMitMaske(dm, 'gibt-es-nicht', klassen)).toBe(false)
  })
  it('ohne Starter zählen alle Klassen der Liste', () => {
    expect(listeMitMaske(dm, 'steg', [])).toBe(true)
    expect(listeMitMaske(dm, 'gate135', [])).toBe(false)
  })
})

describe('probeMaske (W3.4, G10)', () => {
  it('erste Klasse mit Maske; Bojen-Liste und Klassen ohne Liste → keine Probe', () => {
    expect(probeMaske(sichtMit(DM, 'tor5'))?.art).toBe('katalog')
    expect(probeMaske(sichtMit(DM, 'vorsteg'))?.art).toBe('vorsteg')
    expect(probeMaske(sichtMit(UIM, 'steg'))?.teile.map((t) => t.teil)).toEqual(['ab', 'an'])
    expect(probeMaske(sichtMit(DM, 'gate135'))).toBeNull()
    expect(probeMaske({ klassen: { '1': { titel: 'Klasse 1', felder: null } } } as unknown as ListenSicht)).toBeNull()
  })
})
