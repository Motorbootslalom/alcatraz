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
    else if (w < 6 && teile.length > 0) {
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
    // W4.1: Bojen auf dem Fahrweg → `bojen`; Knoten (Bojen-Art ohne Fahrweg), Zeit und Start/Ziel mit Zeit bleiben später.
    for (const typeId of ['tor5puems', 'gate135', 'parcoursms']) expect(maskeFuer(sichtMit(DM, typeId), '5')!.art, typeId).toBe('bojen')
    for (const typeId of ['knoten', 'zeit', 'bstartziel', 'moewezeit']) {
      const m = maskeFuer(sichtMit(DM, typeId), '5')
      expect([m?.art, m?.teile, m?.disq, m?.abschnitte, m?.umschalter], typeId).toEqual(['spaeter', [], null, [], false])
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
    expect(maskenArt([{ kind: 'buoy', boje: {} }, { kind: 'time' }])).toBe('spaeter')
    expect(maskenArt([{ kind: 'buoy', boje: {} }, { kind: 'buoy' }])).toBe('spaeter')
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
    // W4.1: Bojen-Listen haben jetzt eine Maske; Zeit, Knoten und Start/Ziel mit Zeit noch nicht.
    for (const typeId of ['gate135', 'gate245', 'frontal135', 'parcoursms', 'moewe135']) expect(listeMitMaske(dm, typeId, klassen), typeId).toBe(true)
    for (const typeId of ['zeit', 'knoten', 'moewezeit', 'bstartziel']) expect(listeMitMaske(dm, typeId, klassen), typeId).toBe(false)
    expect(listeMitMaske(dm, 'gibt-es-nicht', klassen)).toBe(false)
  })
  it('ohne Starter zählen alle Klassen der Liste', () => {
    expect(listeMitMaske(dm, 'steg', [])).toBe(true)
    expect(listeMitMaske(dm, 'gate135', [])).toBe(true)
    expect(listeMitMaske(dm, 'knoten', [])).toBe(false)
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

  it('„− letzte zurück“ kennt Bojen (Zähler: ein Tipp), Codes und Disq.; Punkte und Einträge je Seite', () => {
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

  it('entwurfAus: Punkte → Berührungen gerundet, Schalter höchstens 1, Zähler höchstens bojenZaehlerMax, Buchstaben übergangen', () => {
    const e = entwurfAus({ 't1a|hin seiteA': '10', 't5|hin seiteA': '14', 't5|rueck seiteA': '500', 't3a|hin seiteB': 'G', 'disq@gate135': 'G' }, k7)
    expect(e.bojen).toEqual({ 't1a|hin seiteA': 1, 't5|hin seiteA': 3, 't5|rueck seiteA': WKR_ANNAHMEN.bojenZaehlerMax })
    expect(e.disq).toEqual(['G'])
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
            for (let i = 0; i < 15; i++) e = tippeBoje(e, bojen[r(bojen.length)])
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
