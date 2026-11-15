import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { emptyState } from '../state/reducer'
import { bogenSeiten } from './bogen'
import { buildLaufzettel, listenZeilen, messBoegen, messKennung, stapelBoegen, waehleLaufzettel, zettelSchritte } from './laufzettel'
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
    // Die Knoten (zusätzliche Liste, Vorgabe des Regelwerks) stehen am Ende – und nur im letzten Lauf.
    expect(von('7', 1)).toEqual(listen)
    expect(von('7', 3)).toEqual([...listen, 'knoten'])
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
    const z = zettel.find((x) => x.klassen[0] === '4' && x.lauf === 3)!
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

  it('eine Liste ohne Lauf (Knoten) steht nur auf dem Zettel des letzten Laufs', () => {
    const { zettel } = zettelVon(stand({ aufbau: 'bawue' }))
    const knoten = dm.aufbauOrder('bawue', false).filter((l) => dm.getSheetDef(l).showLauf === false)
    expect(knoten.length).toBeGreaterThan(0)
    const hat = (lauf: number) => zettel.find((z) => z.klassen[0] === '3' && z.lauf === lauf)!.zeilen.some((r) => knoten.includes(r.typeId))
    // Die Knoten zählen erst zum Gesamtergebnis: Ihr Bogen liegt im Stapel des letzten Laufs.
    expect([hat(1), hat(2), hat(3)]).toEqual([false, false, true])
    // Zwei Läufe (UIM: zwei Versuche): der zweite. Ein Lauf: Er ist zugleich der letzte.
    const zwei = zettelVon(stand({ aufbau: 'bawue', laufCount: 2 })).zettel.filter((z) => z.klassen[0] === '3')
    expect(zwei.map((z) => [z.lauf, z.zeilen.some((r) => knoten.includes(r.typeId))])).toEqual([[1, false], [2, true]])
    const einer = zettelVon(stand({ aufbau: 'bawue', laufCount: 1 })).zettel.filter((z) => z.klassen[0] === '3')
    expect(einer.map((z) => [z.lauf, z.zeilen.some((r) => knoten.includes(r.typeId))])).toEqual([[1, true]])
  })

  it('der Zettel des letzten Laufs ist als solcher gekennzeichnet – bei nur einem Lauf dieser', () => {
    expect(zettelVon(stand()).zettel.every((z) => z.letzterLauf === (z.lauf === 3))).toBe(true)
    expect(zettelVon(stand({ laufCount: 2 })).zettel.every((z) => z.letzterLauf === (z.lauf === 2))).toBe(true)
    const einer = zettelVon(stand({ laufCount: 1 })).zettel
    expect(einer.length).toBeGreaterThan(0)
    expect(einer.every((z) => z.lauf === 1 && z.letzterLauf)).toBe(true)
    // Auch im gemeinsamen Stapel der Clubmeisterschaft.
    const club = zettelVon(stand({ eventKind: 'club', parcoursList: EIN_PARCOURS })).zettel
    expect(club.map((z) => z.letzterLauf)).toEqual([false, false, true])
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
    // Der Bogen des frühesten Laufs; eine Liste ohne Lauf (Knoten) gibt es nur im letzten.
    const ohneLauf = (b: WkrBogen) => dm.getSheetDef(b.typeId).showLauf === false
    expect(mess).toHaveLength(boegen.filter((b) => b.lauf === 1 || ohneLauf(b)).length)
    expect(mess.every((b) => b.lauf === (ohneLauf(b) ? 3 : 1))).toBe(true)
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

describe('Blattstapel eines Laufzettels (Erfassung: alle Listen untereinander)', () => {
  const stapel = (s: AppState, klasse: ClassId, lauf: number, parcoursId = 'par_1') => {
    const { boegen, zettel } = zettelVon(s)
    const liste = stapelBoegen(boegen, veranstaltungsListen(dm, s), { parcoursId, klasse, lauf }, { jeParcours: s.eventKind === 'club' && s.wkrClubGemeinsam })
    return { liste, zettel: zettel.find((z) => z.parcoursId === parcoursId && z.lauf === lauf && z.klassen.includes(klasse)) }
  }

  it('genau die Bögen des Zettels, in dessen Reihenfolge; die Knoten nur im letzten Lauf', () => {
    const s = stand({ parcoursList: EIN_PARCOURS })
    for (const lauf of [1, 3]) {
      const { liste, zettel } = stapel(s, '7', lauf)
      expect(liste.map((b) => b.id)).toEqual(zettel!.zeilen.map((z) => z.bogenId))
      expect(liste.every((b) => b.klassen.includes('7') && b.parcoursId === 'par_1')).toBe(true)
    }
    expect(stapel(s, '7', 1).liste.map((b) => b.typeId)).not.toContain('knoten')
    expect(stapel(s, '7', 3).liste.at(-1)!.typeId).toBe('knoten')
  })

  it('ein mehrseitiger Bogen steht einmal im Stapel', () => {
    const s = stand({ parcoursList: EIN_PARCOURS })
    const { boegen } = wkrBoegenZumStand(s, dm)
    const liste = stapelBoegen(boegen, veranstaltungsListen(dm, s), { parcoursId: 'par_1', klasse: '4', lauf: 1 })
    expect(new Set(liste.map((b) => b.id)).size).toBe(liste.length)
  })

  it('Clubmeisterschaft: der Stapel des Parcours – mit „Papier sparen“ gemeinsame Bögen, ohne auch die Bögen der anderen Klassen', () => {
    const sparen = stand({ parcoursList: EIN_PARCOURS, eventKind: 'club', wkrClubGemeinsam: true })
    const gemeinsam = stapel(sparen, '4', 1).liste
    expect(gemeinsam.find((b) => b.typeId === 'zeit')!.klassen).toHaveLength(8)
    // Gleich, von welcher Klasse aus gefragt wird.
    expect(stapel(sparen, 'E', 1).liste.map((b) => b.id)).toEqual(gemeinsam.map((b) => b.id))
    const einzeln = stapel({ ...sparen, wkrClubGemeinsam: false }, '4', 1).liste
    expect(einzeln.filter((b) => b.typeId === 'zeit')).toHaveLength(1)
    expect(einzeln.filter((b) => b.typeId === 'gate135').length).toBeGreaterThan(1)
    expect(einzeln.some((b) => !b.klassen.includes('4'))).toBe(true)
  })

  it('leer, wenn es den Stapel nicht gibt: Klasse nicht auf dem Parcours, Lauf jenseits der Läufe', () => {
    const s = stand()
    const { boegen } = wkrBoegenZumStand(s, dm)
    const eine = boegen.find((b) => b.parcoursId === 'par_2')!.klassen[0]
    expect(stapelBoegen(boegen, veranstaltungsListen(dm, s), { parcoursId: 'par_1', klasse: eine, lauf: 1 })).toEqual([])
    expect(stapelBoegen(boegen, veranstaltungsListen(dm, s), { parcoursId: 'par_2', klasse: eine, lauf: 9 })).toEqual([])
  })
})

describe('Arbeitsschritte: Versuche direkt nacheinander (UIM 960, Pkt. 4.3.2)', () => {
  const texte = (regelwerk: string, letzterLauf: boolean, nacheinander: boolean) =>
    zettelSchritte(configFor({ regelwerk }).getLaufzettelConfig(), { letzterLauf }, nacheinander).map((s) => s.text)

  it('der Zettel vor dem letzten Versuch verliert die Schritte für Aushang und Verschicken', () => {
    expect(texte('uim-2026', false, false).slice(-3)).toEqual(['Unterschrieben', 'Ausgehangen', 'An die ML geschickt'])
    const ohne = texte('uim-2026', false, true)
    expect(ohne).not.toContain('Ausgehangen')
    expect(ohne).not.toContain('An die ML geschickt')
    expect(ohne).toEqual(texte('uim-2026', false, false).slice(0, -2))
  })

  it('der Zettel des letzten Versuchs bleibt: Dort wird ausgehängt – mit Unterschrift des O.O.D. und Uhrzeit', () => {
    expect(texte('uim-2026', true, true)).toEqual(texte('uim-2026', true, false))
    expect(texte('uim-2026', true, true).some((s) => s.includes('O.O.D.'))).toBe(true)
  })

  it('ohne den Schalter bleibt alles, wie es ist – die Zettel der DM ändern sich nicht', () => {
    expect(texte('dm-2026', false, false)).toEqual([
      'Wertungsliste sortiert nach Startnummer drucken (geheftet mit den WKR-Listen)',
      'Wertungsliste sortiert nach Platz',
      'Kontrolliert',
      'Unterschrieben',
      'Ausgehangen',
      'An die ML geschickt',
    ])
  })
})
