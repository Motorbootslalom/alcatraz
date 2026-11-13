import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { emptyState } from '../state/reducer'
import { bogenSeiten } from './bogen'
import { buildLaufzettel, listenZeilen, messBoegen, messKennung, waehleLaufzettel } from './laufzettel'
import { wkrBoegenZumStand, type WkrBogen } from './wkrListen'
import type { AppState, ClassId, Starter } from '../types'
import { veranstaltungsListen } from './listen'

// Laufzettel aus den Bögen der Veranstaltung. Alle Starter sind erfunden.

function starter(klassen: ClassId[], n = 3): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({ id: `id-${klasse}-${i + 1}`, startNr: `${klasse}${String(i + 1).padStart(2, '0')}`, vorname: 'V', nachname: 'N', verein: 'Musterclub', bundesland: 'Musterland', geburtsdatum: '', groesse: '', klasse })),
  )
}
const ALLE: ClassId[] = ['E', '1', '2', '3', '4', '5', '6', '7']
const dm = configFor({ regelwerk: 'dm-2026' })
const stand = (mehr: Partial<AppState> = {}): AppState => ({ ...emptyState(), starters: starter(ALLE), ...mehr })
const EIN_PARCOURS = [{ id: 'par_1', name: 'Parcours 1', classIds: ALLE, wechselFaktor: 2 as const }]
const zettelVon = (s: AppState, seitenVon: (b: WkrBogen) => number = () => 1) => {
  const { boegen } = wkrBoegenZumStand(s, dm)
  return { boegen, zettel: buildLaufzettel(boegen, veranstaltungsListen(dm, s), seitenVon, { jeParcours: s.eventKind === 'club' && s.wkrClubGemeinsam }) }
}

describe('Laufzettel', () => {
  it('je Parcours, Klasse und Lauf ein Zettel – in der Druckreihenfolge der Bögen', () => {
    const { boegen, zettel } = zettelVon(stand())
    expect(zettel).toHaveLength(8 * 3)
    expect(new Set(zettel.map((z) => z.id)).size).toBe(zettel.length)
    // Erst Parcours, dann die Klassen so, wie sie laut Verzahnung zuerst starten, dann der Lauf.
    const folge = boegen.map((b) => `${b.parcoursId}|${b.klassen[0]}|${b.lauf}`).filter((x, i, a) => a.indexOf(x) === i)
    expect(zettel.map((z) => z.id)).toEqual(folge)
    expect(zettel[0]).toMatchObject({ parcoursId: 'par_1', parcoursName: 'Parcours 1', lauf: 1 })
    expect(zettel.at(-1)).toMatchObject({ parcoursId: 'par_2', lauf: 3 })
  })

  it('je Liste des Aufbaus eine Zeile, in dessen Reihenfolge; Listen, die die Klasse nicht hat, fehlen', () => {
    const { zettel } = zettelVon(stand())
    const listen = dm.aufbauOrder('alcatraz', false)
    const von = (klasse: ClassId, lauf = 2) => zettel.find((z) => z.klassen[0] === klasse && z.lauf === lauf)!.zeilen.map((z) => z.typeId)
    expect(von('7')).toEqual(listen)
    expect(von('1')).toEqual(listen.filter((l) => l !== 'mueb'))
    // Die Knoten (zusätzliche Liste, Vorgabe des Regelwerks) stehen am Ende – und nur im 1. Lauf.
    expect(von('7', 1)).toEqual([...listen, 'knoten'])
  })

  it('ein Kästchen je Druckseite: so viele Zeilen wie der Bogen Seiten hat', () => {
    const { zettel } = zettelVon(stand(), (b) => (b.typeId === 'steg' ? 3 : b.typeId === 'zeit' ? 2 : 1))
    const z = zettel.find((x) => x.klassen[0] === '4' && x.lauf === 1)!
    expect(z.zeilen.filter((r) => r.typeId === 'steg').map((r) => [r.seite, r.seiten])).toEqual([[1, 3], [2, 3], [3, 3]])
    expect(z.zeilen.filter((r) => r.typeId === 'zeit').map((r) => [r.seite, r.seiten])).toEqual([[1, 2], [2, 2]])
    expect(z.zeilen.filter((r) => r.typeId === 'vorsteg')).toHaveLength(1)
    expect(new Set(z.zeilen.map((r) => r.key)).size).toBe(z.zeilen.length)
  })

  it('auf dem Blatt: je Liste eine Zeile, je Bogen so viele Kästchen wie Seiten – keines geht verloren', () => {
    const seitenVon = (b: WkrBogen) => (b.typeId === 'steg' ? 3 : b.typeId === 'zeit' ? 2 : 1)
    const { zettel } = zettelVon(stand(), seitenVon)
    const z = zettel.find((x) => x.klassen[0] === '4' && x.lauf === 1)!
    const listen = listenZeilen(z.zeilen)
    expect(listen.map((l) => l.typeId)).toEqual([...dm.aufbauOrder('alcatraz', false), 'knoten'])
    expect(listen.find((l) => l.typeId === 'steg')!.boegen.map((b) => b.seiten)).toEqual([3])
    expect(listen.find((l) => l.typeId === 'zeit')!.boegen.map((b) => b.seiten)).toEqual([2])
    for (const x of zettel) expect(listenZeilen(x.zeilen).reduce((n, l) => n + l.boegen.reduce((m, b) => m + b.seiten, 0), 0)).toBe(x.zeilen.length)

    // Clubmeisterschaft auf Einzelbögen: mehrere Bögen einer Liste stehen in einer Zeile, jeder mit seinen Klassen.
    const club = zettelVon(stand({ eventKind: 'club', wkrClubGemeinsam: false, parcoursList: EIN_PARCOURS }), seitenVon)
    for (const x of club.zettel) {
      const zeilen = listenZeilen(x.zeilen)
      expect(new Set(zeilen.map((l) => l.typeId)).size).toBe(zeilen.length)
      expect(zeilen.reduce((n, l) => n + l.boegen.reduce((m, b) => m + b.seiten, 0), 0)).toBe(x.zeilen.length)
      for (const l of zeilen) expect(new Set(l.boegen.map((b) => b.bogenId)).size).toBe(l.boegen.length)
    }
    const mehrere = club.zettel.flatMap((x) => listenZeilen(x.zeilen)).filter((l) => l.boegen.length > 1)
    if (mehrere.length > 0) expect(mehrere.every((l) => l.boegen.every((b) => b.klassen.length > 0))).toBe(true)
  })

  it('die Seitenzahlen stimmen mit der Aufteilung der Bögen überein, wenn dieselbe Messung sie liefert', () => {
    // Dieselbe Funktion, die den Bogen beim Drucken aufteilt – hier mit einer festen statt einer gemessenen Kapazität.
    const s = stand({ starters: starter(ALLE, 13) })
    const seitenVon = (b: WkrBogen) => bogenSeiten(dm, b.auftrag, { ...b.optionen, kapazitaet: 5, zeilenKapazitaet: 8 }).length
    const { boegen, zettel } = zettelVon(s, seitenVon)
    expect(zettel.reduce((n, z) => n + z.zeilen.length, 0)).toBe(boegen.reduce((n, b) => n + seitenVon(b), 0))
    for (const z of zettel) {
      for (const b of boegen.filter((x) => x.parcoursId === z.parcoursId && x.lauf === z.lauf && z.klassen.includes(x.klassen[0]))) {
        expect(z.zeilen.filter((r) => r.bogenId === b.id).map((r) => r.seite)).toEqual(Array.from({ length: seitenVon(b) }, (_, i) => i + 1))
      }
    }
  })

  it('unbekannte oder unbrauchbare Seitenzahl zählt als eine Seite', () => {
    for (const n of [0, -2, Number.NaN]) {
      const { zettel } = zettelVon(stand(), () => n)
      expect(zettel[0].zeilen.every((r) => r.seiten === 1 && r.seite === 1)).toBe(true)
    }
  })

  it('eine Liste ohne Lauf (Knoten) steht nur auf dem Zettel des 1. Laufs', () => {
    const { zettel } = zettelVon(stand({ aufbau: 'bawue' }))
    const knoten = dm.aufbauOrder('bawue', false).filter((l) => dm.getSheetDef(l).showLauf === false)
    expect(knoten.length).toBeGreaterThan(0)
    const hat = (lauf: number) => zettel.find((z) => z.klassen[0] === '3' && z.lauf === lauf)!.zeilen.some((r) => knoten.includes(r.typeId))
    expect([hat(1), hat(2), hat(3)]).toEqual([true, false, false])
  })

  it('Clubmeisterschaft, Papier sparen: ein Zettel je Lauf für alle Klassen; Listen nur eines Teils nennen ihre Klassen', () => {
    const { zettel } = zettelVon(stand({ eventKind: 'club', parcoursList: EIN_PARCOURS }))
    expect(zettel).toHaveLength(3)
    expect([...zettel[0].klassen].sort()).toEqual([...ALLE].sort())
    const mueb = zettel[0].zeilen.find((r) => r.typeId === 'mueb')!
    expect([...mueb.klassen].sort()).toEqual(['4', '5', '6', '7'])
    expect(zettel[0].zeilen.find((r) => r.typeId === 'steg')!.klassen).toEqual([])
  })

  it('Clubmeisterschaft, Listen mit Bild je Klasse: je Klasse eine Zeile, in der Reihenfolge des Aufbaus', () => {
    const s = stand({ eventKind: 'club', wkrClubGemeinsam: false, parcoursList: EIN_PARCOURS })
    const { boegen, zettel } = zettelVon(s)
    // Die Klassen hängen über die gemeinsamen Listen (Zeit, Steg) zusammen.
    expect(zettel).toHaveLength(3)
    const z = zettel[0]
    expect(z.zeilen).toHaveLength(boegen.filter((b) => b.lauf === 1).length)
    const listen = veranstaltungsListen(dm, s)
    const raenge = z.zeilen.map((r) => listen.indexOf(r.typeId))
    expect(raenge).toEqual([...raenge].sort((a, b) => a - b))
    const tor = z.zeilen.filter((r) => r.typeId === 'gate135')
    expect(tor.length).toBeGreaterThan(1)
    expect(tor.every((r) => r.klassen.length >= 1)).toBe(true)
  })

  it('gemessen wird ein Bogen je Parcours, Klassen und Liste – die Läufe unterscheiden sich nur im Kopf', () => {
    const { boegen } = wkrBoegenZumStand(stand(), dm)
    const mess = messBoegen(boegen)
    expect(mess).toHaveLength(boegen.filter((b) => b.lauf === 1).length)
    expect(mess.every((b) => b.lauf === 1)).toBe(true)
    // Jeder Bogen findet seine Messung, und bis auf den Lauf ist er derselbe.
    const je = new Map(mess.map((b) => [messKennung(b), b]))
    for (const b of boegen) {
      const m = je.get(messKennung(b))!
      expect(m.auftrag.zeilen).toEqual(b.auftrag.zeilen)
      expect(m.optionen).toEqual(b.optionen)
      expect({ ...m.auftrag, lauf: 0, qr: '' }).toEqual({ ...b.auftrag, lauf: 0, qr: '' })
    }
  })

  it('die Auswahl grenzt ein: Parcours, Klasse, Lauf', () => {
    const { zettel } = zettelVon(stand())
    expect(waehleLaufzettel(zettel, {})).toHaveLength(24)
    expect(waehleLaufzettel(zettel, { parcours: 'par_2' })).toHaveLength(12)
    expect(waehleLaufzettel(zettel, { klasse: '3' }).map((z) => z.lauf)).toEqual([1, 2, 3])
    expect(waehleLaufzettel(zettel, { klasse: '3', lauf: 2 })).toHaveLength(1)
    expect(waehleLaufzettel(zettel, { parcours: 'par_2', klasse: '3' })).toEqual([])
  })
})
