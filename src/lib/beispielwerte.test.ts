import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import type { ClassId, Eingaben, Starter } from '../types'
import { beispielEingaben, zufallAus, type BeispielStand } from './beispielwerte'
import { erfasstKennung, felderJeKennung, laufSchluessel } from './eingaben'
import { bogenFortschritt } from './erfassung'
import { klassenErgebnis } from './ergebnis'
import { parseTime } from './time'
import { veranstaltungsListen } from './listen'

// Aus dem Fehlerpunkte-Prototyp (lib/beispielwerte.test.ts), hier für die ganze Veranstaltung
// und mit dem Zufall aus einer Saat. Alle Starter sind erfunden.

const konfig = configFor()
const starter = (klasse: ClassId, n: number): Starter[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${klasse}-${i + 1}`, startNr: `${klasse}${String(i + 1).padStart(2, '0')}`, vorname: 'V', nachname: 'N', verein: '', bundesland: '', geburtsdatum: '', klasse, groesse: '' }))
const stand = (extra: Partial<BeispielStand> = {}): BeispielStand => ({ regelwerk: 'dm-2026', aufbau: 'alcatraz', starters: [...starter('4', 20), ...starter('E', 10)], laufCount: 3, eingaben: {}, ...extra })
const lauf = (n: number) => laufSchluessel('manoevrieren', n)

describe('zufallAus', () => {
  it('gleiche Saat, gleiche Folge; Werte in [0, 1)', () => {
    const a = zufallAus(42)
    const b = zufallAus(42)
    const folge = Array.from({ length: 200 }, () => a())
    expect(Array.from({ length: 200 }, () => b())).toEqual(folge)
    expect(folge.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(new Set(folge).size).toBeGreaterThan(190)
    expect(zufallAus(43)()).not.toBe(folge[0])
  })
})

describe('beispielEingaben', () => {
  it('ist deterministisch und ändert den Stand nicht', () => {
    const s = stand()
    const a = beispielEingaben(s, konfig, { zeitnahme: 'stoppuhr' }, zufallAus(7))
    expect(beispielEingaben(s, konfig, { zeitnahme: 'stoppuhr' }, zufallAus(7))).toEqual(a)
    expect(beispielEingaben(s, konfig, { zeitnahme: 'stoppuhr' }, zufallAus(8))).not.toEqual(a)
    expect(s.eingaben).toEqual({})
  })

  it('füllt jeden Starter in jedem Lauf; jede Liste gilt als erfasst', () => {
    const s = stand()
    const eingaben = beispielEingaben(s, konfig, { zeitnahme: 'stoppuhr' }, zufallAus(1))
    // Lauf 0 sind die Knoten: Die Liste gehört unter den DM-Regeln zu jedem Aufbau.
    expect(Object.keys(eingaben).sort()).toEqual([lauf(0), lauf(1), lauf(2), lauf(3)])
    for (const l of [1, 2, 3]) expect(Object.keys(eingaben[lauf(l)])).toHaveLength(30)
    const zeilen = s.starters.filter((x) => x.klasse === '4').map((x) => ({ id: x.id, klasse: x.klasse }))
    for (const typeId of veranstaltungsListen(konfig, s)) {
      expect(bogenFortschritt(konfig, eingaben, 'alcatraz', { typeId, lauf: 2, zeilen }), typeId).toEqual({ erfasst: 20, gesamt: 20 })
    }
    // Klasse E hat kein Mann-über-Bord: kein Haken, kein Wert dafür.
    expect(eingaben[lauf(1)]['sE-1'][erfasstKennung('mueb')]).toBeUndefined()
    expect(eingaben[lauf(1)]['s4-1'][erfasstKennung('mueb')]).toBe('1')
  })

  it('Stoppuhr: 2 bis 3 Zeiten als Minuten,SekundenHundertstel, die nah beieinander liegen', () => {
    const eingaben = beispielEingaben(stand(), konfig, { zeitnahme: 'stoppuhr' }, zufallAus(1))
    const anzahlen = new Set<number>()
    for (const werte of Object.values(eingaben[lauf(1)])) {
      const zeiten = Object.entries(werte).filter(([k]) => /^zeit\d$/.test(k)).map(([, v]) => v)
      anzahlen.add(zeiten.length)
      for (const z of zeiten) expect(z).toMatch(/^\d,\d{4}$/)
      const centis = zeiten.map((z) => parseTime(z)!.centis)
      expect(Math.max(...centis) - Math.min(...centis)).toBeLessThan(150)
    }
    expect(anzahlen).toEqual(new Set([2, 3]))
  })

  it('Lichtschranke: genau eine Zeit als Sekunden,Hundertstel – in der elektronischen Spalte, wenn der Aufbau eine hat', () => {
    const einfach = beispielEingaben(stand(), konfig, { zeitnahme: 'lichtschranke' }, zufallAus(2))
    for (const werte of Object.values(einfach[lauf(1)])) {
      expect(Object.keys(werte).filter((k) => k.startsWith('zeit'))).toEqual(['zeit1'])
      expect(werte.zeit1).toMatch(/^\d{2,3},\d{2}$/)
    }
    const dm = stand({ aufbau: 'alcatrazdm26' })
    const felder = felderJeKennung(konfig, '4', konfig.aufbauOrder('alcatrazdm26', false))
    const elektro = [...felder.values()].find((f) => f.geraet === 'elektronisch')!.kennung
    for (const [id, werte] of Object.entries(beispielEingaben(dm, konfig, { zeitnahme: 'lichtschranke' }, zufallAus(2))[lauf(1)])) {
      const zeiten = Object.keys(werte).filter((k) => felder.get(k)?.kind === 'time')
      expect(zeiten, id).toEqual([elektro])
    }
  })

  it('nur die gewählten Läufe; andere Läufe und Bemerkungen bleiben', () => {
    const vorher: Eingaben = { [lauf(3)]: { 's4-1': { zeit1: '99,00' } }, [lauf(1)]: { 's4-1': { 'bemerkung@steg': 'Motor aus', zeit1: '50,00' } } }
    const eingaben = beispielEingaben(stand({ eingaben: vorher }), konfig, { zeitnahme: 'lichtschranke', laeufe: [1, 2] }, zufallAus(3))
    expect(eingaben[lauf(3)]).toEqual(vorher[lauf(3)])
    expect(eingaben[lauf(1)]['s4-1']['bemerkung@steg']).toBe('Motor aus')
    expect(eingaben[lauf(1)]['s4-1'].zeit1).not.toBe('50,00')
    expect(Object.keys(eingaben[lauf(2)])).toHaveLength(30)
  })

  it('dieselbe Person bleibt über die Läufe ähnlich schnell', () => {
    const eingaben = beispielEingaben(stand(), konfig, { zeitnahme: 'lichtschranke' }, zufallAus(5))
    const zeit = (l: number, id: string) => parseTime(eingaben[lauf(l)][id].zeit1)!.centis
    const nah = starter('4', 20).filter((s) => Math.abs(zeit(1, s.id) - zeit(2, s.id)) < 1500).length
    expect(nah).toBeGreaterThanOrEqual(12)
  })

  it('Knoten werden mit dem 1. Lauf gefüllt, wenn die Veranstaltung die Liste hat', () => {
    const bawue = stand({ aufbau: 'bawue' })
    expect(beispielEingaben(bawue, konfig, { zeitnahme: 'stoppuhr' }, zufallAus(1))[lauf(0)]['s4-1'][erfasstKennung('knoten')]).toBe('1')
    expect(beispielEingaben(bawue, konfig, { zeitnahme: 'stoppuhr', laeufe: [2] }, zufallAus(1))[lauf(0)]).toBeUndefined()
    // Alcatraz nennt die Knoten nicht selbst; sie kommen als Vorgabe des Regelwerks dazu – bis sie abgewählt sind.
    expect(beispielEingaben(stand(), konfig, { zeitnahme: 'stoppuhr' }, zufallAus(1))[lauf(0)]['s4-1'][erfasstKennung('knoten')]).toBe('1')
    expect(beispielEingaben(stand({ zusatzListen: { knoten: false } }), konfig, { zeitnahme: 'stoppuhr' }, zufallAus(1))[lauf(0)]).toBeUndefined()
  })

  it('ergibt glaubhafte Ergebnislisten: Zeiten im Bereich der Klasse, einige Disqualifikationen, nur gültige Werte', () => {
    const s = stand({ starters: starter('4', 60) })
    const eingaben = beispielEingaben(s, konfig, { zeitnahme: 'stoppuhr' }, zufallAus(11))
    const ergebnis = klassenErgebnis({ ...s, eingaben, streichlaeufe: 'auto' }, konfig, '4')!
    const l1 = ergebnis.laeufe[0].nachNummer
    expect(l1.every((z) => z.zeit !== null && z.zeit > 5000 && z.zeit < 16000)).toBe(true)
    const disq = l1.filter((z) => z.disq).length
    expect(disq).toBeGreaterThan(3)
    expect(disq).toBeLessThan(30)
    expect(l1.some((z) => z.strafpunkte > 0)).toBe(true)
    expect(ergebnis.gesamt.nachPlatz.some((z) => z.ergebnis !== null)).toBe(true)
    // Jeder Wert übersteht die Prüfung seines Felds unverändert.
    const felder = felderJeKennung(konfig, '4', konfig.aufbauOrder('alcatraz', false))
    for (const werte of Object.values(eingaben[lauf(1)])) {
      for (const [kennung, wert] of Object.entries(werte)) {
        if (kennung.startsWith('erfasst@')) continue
        expect(felder.get(kennung)?.gueltig(wert), `${kennung}=${wert}`).toBe(wert)
      }
    }
  })

  it('UIM: eigene Kennzahlen, Klassen ohne Profil fallen auf Klasse 5', () => {
    const uim = configFor({ regelwerk: 'uim-2026' })
    const s = stand({ regelwerk: 'uim-2026', starters: starter('E', 12) })
    const eingaben = beispielEingaben(s, uim, { zeitnahme: 'lichtschranke' }, zufallAus(4))
    expect(Object.keys(eingaben[lauf(1)])).toHaveLength(12)
  })
})
