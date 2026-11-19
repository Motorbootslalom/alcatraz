import { describe, expect, it } from 'vitest'
import { BESETZUNG_HOECHSTENS, beispielBoote, beispielCoPiloten, beispielEinteilung, beispielGewichte, besetzungsText } from './beispieldaten'
import { BOOTSNAMEN } from '../data/boote'
import { zufallAus } from './beispielwerte'
import { einteilungsZellen } from './einteilung'
import { beschreibe } from './verlauf'
import { NACHNAMEN, VORNAMEN_M, VORNAMEN_W } from '../data/names'
import { configFor } from '../config/konfig'
import { parallelListen } from './parallelBogen'
import { RACECOURSE_PARCOURS } from './parallelSchluessel'
import { ausgleichKg, parseGewicht } from '../domain/gewicht'
import { makeFile, parseFile } from '../persistenz/backup'
import { emptyState, reducer } from '../state/reducer'
import type { AppState, ClassId, Starter } from '../types'

const vornamen = new Set([...VORNAMEN_M, ...VORNAMEN_W])
const nachnamen = new Set(NACHNAMEN)

/** Die Personen eines Eintrags: „Vorname Nachname“ oder abgekürzt „V. Nachname“. */
const personen = (eintrag: string) => eintrag.split(', ').map((p) => p.split(' '))

function starter(id: string, klasse: ClassId, extra: Partial<Starter> = {}): Starter {
  return { id, startNr: id, vorname: `Vor${id}`, nachname: `Nach${id}`, verein: 'Musterclub', bundesland: '', geburtsdatum: '', klasse, groesse: '', ...extra }
}

describe('Beispiel-Besetzung', () => {
  const dm = () => emptyState()
  const uim = (): AppState => reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
  const zellenVon = (stand: AppState, parallel: boolean) => {
    const konfig = configFor({ regelwerk: stand.regelwerk, eigeneAufbauten: stand.eigeneAufbauten })
    return einteilungsZellen(konfig, stand, parallel ? parallelListen(konfig) : [])
  }

  it('füllt jede Liste jedes Parcours mit zwei bis drei erfundenen Personen aus src/data', () => {
    const stand = reducer(dm(), { type: 'FILL_BEISPIEL_BESETZUNG', saat: 7 })
    const zellen = zellenVon(stand, false)
    expect(zellen.length).toBeGreaterThan(10)
    // Unter der DM keine Racecourses.
    expect(Object.keys(stand.einteilung).sort()).toEqual(['par_1', 'par_2'])
    const zahlen = new Set<number>()
    for (const z of zellen) {
      const eintrag = stand.einteilung[z.parcoursId][z.typeId]
      expect(eintrag, `${z.parcoursId}/${z.typeId}`).toBeTruthy()
      const ps = personen(eintrag)
      zahlen.add(ps.length)
      expect(ps.length).toBeGreaterThanOrEqual(2)
      expect(ps.length).toBeLessThanOrEqual(3)
      for (const [vor, nach] of ps) {
        expect(vornamen.has(vor) || /^\p{Lu}\.$/u.test(vor), vor).toBe(true)
        expect(nachnamen.has(nach), nach).toBe(true)
      }
      expect(eintrag.length).toBeLessThanOrEqual(BESETZUNG_HOECHSTENS)
    }
    // Beide Größen kommen vor.
    expect([...zahlen].sort()).toEqual([2, 3])
    // Auf jeder Position sitzen andere Leute: kein Nachname doppelt.
    const alle = zellen.flatMap((z) => personen(stand.einteilung[z.parcoursId][z.typeId]).map(([, nach]) => nach))
    expect(new Set(alle).size).toBe(alle.length)
  })

  it('unter UIM auch die Listen des Parallelslaloms je Racecourse', () => {
    const stand = reducer(uim(), { type: 'FILL_BEISPIEL_BESETZUNG', saat: 3 })
    for (const rc of Object.values(RACECOURSE_PARCOURS)) {
      expect(Object.keys(stand.einteilung[rc]).sort()).toEqual(['parallelparcours', 'steg', 'zeit'])
    }
    for (const z of zellenVon(stand, true)) expect(personen(stand.einteilung[z.parcoursId][z.typeId]).length).toBeGreaterThanOrEqual(2)
  })

  it('deterministisch über die Saat: gleiche Saat, gleiche Namen; eine andere Saat, andere', () => {
    const a = reducer(dm(), { type: 'FILL_BEISPIEL_BESETZUNG', saat: 11 })
    const b = reducer(dm(), { type: 'FILL_BEISPIEL_BESETZUNG', saat: 11 })
    const c = reducer(dm(), { type: 'FILL_BEISPIEL_BESETZUNG', saat: 12 })
    expect(a.einteilung).toEqual(b.einteilung)
    expect(a.einteilung).not.toEqual(c.einteilung)
  })

  it('ersetzt die gefüllten Zellen; Namen an Listen, die gerade nicht gelten, bleiben', () => {
    let stand = reducer(dm(), { type: 'SET_WKR_NAME', parcoursId: 'par_1', typeId: 'steg', name: 'Erika Muster' })
    stand = reducer(stand, { type: 'SET_WKR_NAME', parcoursId: 'par_1', typeId: 'gibtEsNicht', name: 'Max Muster' })
    stand = reducer(stand, { type: 'FILL_BEISPIEL_BESETZUNG', saat: 5 })
    expect(stand.einteilung.par_1.steg).not.toBe('Erika Muster')
    expect(stand.einteilung.par_1.gibtEsNicht).toBe('Max Muster')
  })

  it('zu lang für eine Zeile im Bogenkopf: die Vornamen abgekürzt, notfalls nur zwei Personen', () => {
    const p = (vorname: string, nachname: string) => ({ vorname, nachname })
    expect(besetzungsText([p('Ben', 'Koch'), p('Mia', 'Wolf')])).toBe('Ben Koch, Mia Wolf')
    expect(besetzungsText([p('Maximilian', 'Koch'), p('Alexandra', 'Wolf'), p('Konstantin', 'Bach')])).toBe('M. Koch, A. Wolf, K. Bach')
    expect(besetzungsText([p('Maximilian', 'Zimmermann'), p('Konstantin', 'Schumacher'), p('Alexandra', 'Hoffmann')])).toBe('M. Zimmermann, K. Schumacher')
    // Über viele Saaten: nie länger als eine Zeile, nie weniger als zwei Personen.
    for (let saat = 0; saat < 200; saat++) {
      for (const eintrag of Object.values(beispielEinteilung({}, [{ parcoursId: 'p', typeId: 'steg' }], zufallAus(saat)).p)) {
        expect(eintrag.length, eintrag).toBeLessThanOrEqual(BESETZUNG_HOECHSTENS)
        expect(personen(eintrag).length, eintrag).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('wie echte Besetzung: in der Sicherung, nie in der Vorlage', () => {
    const stand = reducer(dm(), { type: 'FILL_BEISPIEL_BESETZUNG', saat: 9 })
    const eintrag = stand.einteilung.par_1.steg
    const sicherung = parseFile(JSON.stringify(makeFile('sicherung', stand, '2026-11-15T20:00:00.000Z')))
    expect(sicherung.ok && sicherung.kind === 'sicherung' && sicherung.state.einteilung).toEqual(stand.einteilung)
    const vorlage = JSON.stringify(makeFile('vorlage', stand, '2026-11-15T20:00:00.000Z'))
    expect(vorlage).not.toContain(eintrag)
    expect(vorlage).not.toContain('"einteilung"')
  })

  it('im Verlauf ein eigener Eintrag', () => {
    expect(beschreibe({ type: 'FILL_BEISPIEL_BESETZUNG', saat: 1 }, dm())).toEqual({ art: 'beispielBesetzung' })
    expect(beschreibe({ type: 'FILL_BEISPIELGEWICHTE', saat: 1 }, dm())).toEqual({ art: 'beispielGewichte' })
  })

  it('beispielEinteilung allein: ohne Zellen bleibt alles, wie es ist', () => {
    const e = { par_1: { steg: 'Erika Muster' } }
    expect(beispielEinteilung(e, [], zufallAus(1))).toBe(e)
  })
})

describe('Beispielgewichte', () => {
  const feld = (je: number, klassen: ClassId[]) => klassen.flatMap((k) => Array.from({ length: je }, (_, i) => starter(`${k}${i + 1}`, k)))

  it('um das Durchschnittsgewicht der Klasse nach Regelwerk, ein Teil leichter – mit Ausgleichsgewicht', () => {
    const klassen: ClassId[] = ['E', '1', '2', '3', '4', '5', '6', '7']
    const stand = reducer({ ...emptyState(), starters: feld(10, klassen) }, { type: 'FILL_BEISPIELGEWICHTE', saat: 21 })
    const soll: Record<ClassId, number> = { E: 26, 1: 33, 2: 42, 3: 52, 4: 65, 5: 72, 6: 75, 7: 78 }
    for (const k of klassen) {
      const gewichte = stand.starters.filter((p) => p.klasse === k).map((p) => p.gewicht!)
      expect(gewichte).toHaveLength(10)
      // Vier von zehn leichter, jeder davon mit einem Ausgleichsgewicht von mindestens 1 kg.
      const leichter = gewichte.filter((g) => g < soll[k])
      expect(leichter, k).toHaveLength(4)
      for (const g of leichter) expect(ausgleichKg(g, soll[k])).toBeGreaterThanOrEqual(1)
      for (const g of gewichte) {
        // Glaubhaft nahe am Durchschnitt: höchstens gut 15 % darunter, 25 % darüber.
        expect(g).toBeGreaterThanOrEqual(soll[k] * 0.84 - 1)
        expect(g).toBeLessThanOrEqual(soll[k] * 1.25 + 0.05)
        // Format wie bei der Eingabe in der Verwiegung: auf 0,1 kg.
        expect(parseGewicht(String(g).replace('.', ','))).toBe(g)
      }
    }
  })

  it('folgt den abweichenden Durchschnittsgewichten der Veranstaltung und dem Regelwerk (UIM)', () => {
    let stand: AppState = { ...emptyState(), regelwerk: 'uim-2026', starters: feld(6, ['1', '5']) }
    stand = reducer(stand, { type: 'SET_SOLLGEWICHT', klasse: '5', kg: 90 })
    stand = reducer(stand, { type: 'FILL_BEISPIELGEWICHTE', saat: 4 })
    const von = (k: ClassId) => stand.starters.filter((p) => p.klasse === k).map((p) => p.gewicht!)
    // Klasse 1 nach UIM 32 kg (die DM hat 33), Klasse 5 nach der Veranstaltung 90 kg.
    expect(von('1').every((g) => g > 25 && g < 41)).toBe(true)
    expect(von('1').some((g) => g < 32)).toBe(true)
    expect(von('5').every((g) => g > 74 && g < 113)).toBe(true)
    expect(von('5').some((g) => g < 90)).toBe(true)
  })

  it('ersetzt vorhandene Gewichte, sonst ändert sich am Starter nichts; deterministisch über die Saat', () => {
    const vorher = [starter('a', '3', { gewicht: 99, geschlecht: 'F' }), starter('b', '3'), starter('c', '3')]
    const a = beispielGewichte(vorher, () => 52, zufallAus(8))
    expect(a.map((p) => p.gewicht)).toEqual(beispielGewichte(vorher, () => 52, zufallAus(8)).map((p) => p.gewicht))
    expect(a[0].gewicht).not.toBe(99)
    expect({ ...a[0], gewicht: undefined }).toEqual({ ...vorher[0], gewicht: undefined })
    expect(a.map((p) => p.gewicht)).not.toEqual(beispielGewichte(vorher, () => 52, zufallAus(9)).map((p) => p.gewicht))
  })

  it('eine Klasse ohne Durchschnittsgewicht bleibt, wie sie ist; ohne Starter ändert sich nichts', () => {
    const vorher = [starter('a', '6'), starter('b', '6', { gewicht: 70 })]
    expect(beispielGewichte(vorher, () => 0, zufallAus(1))).toEqual(vorher)
    const leer = emptyState()
    expect(reducer(leer, { type: 'FILL_BEISPIELGEWICHTE', saat: 1 })).toBe(leer)
  })
})

describe('Beispiel-Boote und -Co-Piloten (19.11.2026)', () => {
  it('DM: ein erfundener Bootsname für jede Klasse, keiner doppelt; Co-Piloten nur, wo das Regelwerk einen vorsieht', () => {
    const stand = reducer(reducer(emptyState(), { type: 'FILL_BEISPIEL_BOOTE', saat: 3 }), { type: 'FILL_BEISPIEL_CO_PILOTEN', saat: 3 })
    expect(Object.keys(stand.boote).sort()).toEqual(['1', '2', '3', '4', '5', '6', '7', 'E'])
    const namen = Object.values(stand.boote)
    expect(namen.every((n) => BOOTSNAMEN.includes(n!))).toBe(true)
    expect(new Set(namen).size).toBe(namen.length)
    // DM-Reglement C3 bzw. coPilot im YAML: E, 1, 2, 3.
    expect(Object.keys(stand.coPiloten).sort()).toEqual(['1', '2', '3', 'E'])
    for (const co of Object.values(stand.coPiloten)) {
      const [vorname, nachname] = co!.split(' ')
      expect(vornamen.has(vorname)).toBe(true)
      expect(nachnamen.has(nachname)).toBe(true)
    }
    expect(new Set(Object.values(stand.coPiloten).map((c) => c!.split(' ')[1])).size).toBe(4)
  })

  it('UIM: nur die Klassen des Regelwerks; Klassen mit Startern außerhalb bekommen auch ein Boot', () => {
    let stand = reducer(emptyState(), { type: 'SET_REGELWERK', regelwerk: 'uim-2026' })
    expect(Object.keys(reducer(stand, { type: 'FILL_BEISPIEL_BOOTE', saat: 1 }).boote).sort()).toEqual(['1', '2', '3', '4', '5', 'E'])
    stand = { ...stand, starters: [starter('a', '7')] }
    expect(Object.keys(reducer(stand, { type: 'FILL_BEISPIEL_BOOTE', saat: 1 }).boote)).toContain('7')
  })

  it('ersetzt die Angaben der gefüllten Klassen, übrige bleiben; deterministisch über die Saat', () => {
    const vorher = { '4': 'Boot von Hand' }
    const a = beispielBoote(vorher, ['E', '1'], zufallAus(5))
    expect(a['4']).toBe('Boot von Hand')
    expect(a).toEqual(beispielBoote(vorher, ['E', '1'], zufallAus(5)))
    const co = beispielCoPiloten({ '5': 'Vor1 Nach1', E: 'Vor2 Nach2' }, ['E'], zufallAus(5))
    expect(co['5']).toBe('Vor1 Nach1')
    expect(co.E).not.toBe('Vor2 Nach2')
    expect(co).toEqual(beispielCoPiloten({ '5': 'Vor1 Nach1', E: 'Vor2 Nach2' }, ['E'], zufallAus(5)))
  })

  it('reicht der Vorrat nicht, kommen Namen wieder – jede Klasse bekommt trotzdem einen', () => {
    const klassen = Array.from({ length: BOOTSNAMEN.length + 2 }, () => 'E' as ClassId)
    expect(() => beispielBoote({}, klassen, zufallAus(2))).not.toThrow()
  })

  it('steht im Verlauf als eigener Eintrag', () => {
    expect(beschreibe({ type: 'FILL_BEISPIEL_BOOTE', saat: 1 }, emptyState())?.art).toBe('beispielBoote')
    expect(beschreibe({ type: 'FILL_BEISPIEL_CO_PILOTEN', saat: 1 }, emptyState())?.art).toBe('beispielCoPiloten')
  })
})
