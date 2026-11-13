import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { planEvent } from '../planung/plan'
import { emptyState, reducer } from '../state/reducer'
import { bogenSeiten } from './bogen'
import { waehleBoegen, wkrBoegenZumStand } from './wkrListen'
import type { AppState, ClassId, Starter } from '../types'

/** Erfundene Starter: `n` je Klasse, klassenbasierte Startnummern. */
function starter(klassen: ClassId[], n = 3): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${klasse}-${i + 1}`,
      startNr: `${klasse}${String(i + 1).padStart(2, '0')}`,
      vorname: 'V',
      nachname: 'N',
      verein: 'Musterclub',
      bundesland: 'Musterland',
      geburtsdatum: '',
      groesse: '',
      klasse,
    })),
  )
}

const ALLE: ClassId[] = ['E', '1', '2', '3', '4', '5', '6', '7']
const stand = (mehr: Partial<AppState> = {}): AppState => ({ ...emptyState(), eventName: 'Hafenpokal', starters: starter(ALLE), ...mehr })
const dm = configFor({ regelwerk: 'dm-2026' })
const sortiert = (k: readonly ClassId[]) => [...k].sort((a, b) => ALLE.indexOf(a) - ALLE.indexOf(b))
const EIN_PARCOURS = [{ id: 'par_1', name: 'Parcours 1', classIds: ALLE, wechselFaktor: 2 as const }]

describe('Wettkampfrichter-Listen aus Stand und Verzahnung', () => {
  it('zwei Parcours: je Parcours, Klasse, Lauf und Liste ein Bogen – in dieser Reihenfolge', () => {
    const { boegen, ohneListe } = wkrBoegenZumStand(stand(), dm)
    expect(ohneListe).toEqual([])
    const listen = dm.aufbauOrder('alcatraz', false)
    // Mann-über-Bord gibt es erst ab Klasse 4: acht Klassen × 3 Läufe × Listen, vier Klassen ohne MüB.
    expect(boegen).toHaveLength(8 * 3 * listen.length - 4 * 3)
    expect(new Set(boegen.map((b) => b.id)).size).toBe(boegen.length)
    const erster = boegen[0]
    expect(erster).toMatchObject({ parcoursId: 'par_1', klassen: ['E'], lauf: 1, typeId: listen[0] })
    expect(boegen[1]).toMatchObject({ klassen: ['E'], lauf: 1, typeId: listen[1] })
    // Erst alle Läufe einer Klasse, dann die nächste Klasse, zuletzt der nächste Parcours.
    const folge = boegen.map((b) => `${b.parcoursId}/${b.klassen[0]}/${b.lauf}`).filter((x, i, a) => a.indexOf(x) === i)
    // Die Klassen eines Parcours in der Reihenfolge, in der sie laut Verzahnung zuerst starten:
    // So liegt der Stapel aus dem Drucker schon richtig und muss nur getrennt werden.
    const plan = planEvent(stand()).plans
    const startfolge = plan.flatMap((p) => [...new Set(p.sequence.map((x) => x.klasse))].map((k) => `${p.parcoursId}/${k}`))
    expect(startfolge.slice(0, 2)).not.toEqual(['par_1/E', 'par_1/1'])
    expect(folge).toEqual(startfolge.flatMap((pk) => [1, 2, 3].map((lauf) => `${pk}/${lauf}`)))
    expect(boegen.filter((b) => b.typeId === 'mueb').map((b) => b.klassen[0])).not.toContain('3')
  })

  it('Kopf: Veranstaltung mit Jahr, Parcours nur bei mehreren, Name aus der Einteilung des Parcours', () => {
    const s = stand({ einteilung: { par_1: { steg: ' A. Muster ' }, par_2: { steg: 'B. Beispiel' } } })
    const { boegen } = wkrBoegenZumStand(s, dm)
    const steg = (klasse: ClassId) => boegen.find((b) => b.typeId === 'steg' && b.klassen[0] === klasse && b.lauf === 2)!
    expect(steg('1').auftrag).toMatchObject({ eventName: 'Hafenpokal 2026', parcours: 'Parcours 1', wkr: 'A. Muster', lauf: 2, aufbauId: 'alcatraz' })
    expect(steg('7').auftrag).toMatchObject({ parcours: 'Parcours 2', wkr: 'B. Beispiel' })
    const seite = bogenSeiten(dm, steg('7').auftrag, steg('7').optionen)[0]
    expect(seite).toMatchObject({ titel: 'Steg', klassenText: 'Klasse 7', laufText: '2. Lauf', parcours: 'Parcours 2', wkr: 'B. Beispiel' })
    expect(seite.bild).toBeUndefined()
    const tor = boegen.find((b) => b.typeId === 'gate135' && b.klassen[0] === '7')!
    expect(bogenSeiten(dm, tor.auftrag, tor.optionen)[0].bild?.datei).toBe('Klasse7')

    const einer = wkrBoegenZumStand(stand({ parcoursList: EIN_PARCOURS }), dm).boegen
    expect(einer.every((b) => b.auftrag.parcours === undefined)).toBe(true)
  })

  it('Zeilen: Startnummern in der Startreihenfolge der Verzahnung, mit der Starter-ID als Schlüssel', () => {
    // Größe bestimmt hier nichts; die Reihenfolge der Verzahnung weicht von der Nummernfolge ab, sobald jemand umgestellt wird.
    const s = reducer(stand(), { type: 'MOVE_STARTER', id: 'id-3-3', target: 'first' })
    const folge = planEvent(s).plans.find((p) => p.parcoursId === 'par_1')!.sequence
    const erwartet = folge.filter((x) => x.klasse === '3').map((x) => x.startNr)
    const bogen = wkrBoegenZumStand(s, dm).boegen.find((b) => b.typeId === 'steg' && b.klassen[0] === '3')!
    expect(bogen.auftrag.zeilen.map((z) => z.nr)).toEqual(erwartet)
    expect(bogen.auftrag.zeilen.every((z) => z.id?.startsWith('id-3-'))).toBe(true)
    // Auf dem Bogen stehen nur Nummern – keine Namen.
    expect(JSON.stringify(bogen.auftrag)).not.toContain('Musterclub')
    const zeilen = bogenSeiten(dm, bogen.auftrag, bogen.optionen)[0].rows
    expect(zeilen.filter((z) => z.fixed).map((z) => z.key)).toEqual(folge.filter((x) => x.klasse === '3').map((x) => x.id))
  })

  it('Leerzeilen: die allgemeine Zahl, für einzelne Klassen abweichend', () => {
    const s = stand({ wkrLeerzeilen: 2, wkrLeerzeilenKlasse: { '7': 5 } })
    const { boegen } = wkrBoegenZumStand(s, dm)
    const leer = (klasse: ClassId) => {
      const b = boegen.find((x) => x.typeId === 'steg' && x.klassen[0] === klasse)!
      return bogenSeiten(dm, b.auftrag, b.optionen)[0].rows.filter((z) => !z.fixed).length
    }
    expect(leer('1')).toBe(2)
    expect(leer('7')).toBe(5)
  })

  it('Klassen ohne Starter entfallen; Klassen ohne Parcours werden gemeldet', () => {
    const ohne = wkrBoegenZumStand(stand({ starters: starter(['1', '7']) }), dm)
    expect([...new Set(ohne.boegen.flatMap((b) => b.klassen))]).toEqual(['1', '7'])
    const s = stand({ parcoursList: [{ id: 'par_1', name: 'Parcours 1', classIds: ['E', '1', '2', '3'], wechselFaktor: 2 }] })
    const { boegen, ohneListe } = wkrBoegenZumStand(s, dm)
    expect(ohneListe).toEqual(['4', '5', '6', '7'])
    expect(boegen.some((b) => b.klassen.includes('4'))).toBe(false)
    expect(wkrBoegenZumStand(stand({ starters: [] }), dm)).toEqual({ boegen: [], ohneListe: [] })
  })

  it('Anzahl der Läufe aus dem Stand; eine Liste ohne Lauf im Kopf gibt es nur einmal', () => {
    const zwei = wkrBoegenZumStand(stand({ laufCount: 2 }), dm).boegen
    expect([...new Set(zwei.map((b) => b.lauf))]).toEqual([1, 2])
    const bawue = wkrBoegenZumStand(stand({ aufbau: 'bawue' }), dm).boegen
    expect(dm.getSheetDef('knoten').showLauf).toBe(false)
    expect(bawue.filter((b) => b.typeId === 'knoten' && b.klassen[0] === '7').map((b) => b.lauf)).toEqual([1])
    expect(bawue.filter((b) => b.typeId === 'steg' && b.klassen[0] === '7').map((b) => b.lauf)).toEqual([1, 2, 3])
  })

  it('UIM: nur die Klassen des Regelwerks, englische Listen, „Dolphin“ im Kopf', () => {
    const uim = configFor({ regelwerk: 'uim-2026', sprache: 'en' })
    const { boegen, ohneListe } = wkrBoegenZumStand(stand({ regelwerk: 'uim-2026' }), uim)
    // Klassen 6 und 7 kennt das Regelwerk nicht: Sie bekommen keinen Bogen und werden gemeldet.
    expect(ohneListe).toEqual(['6', '7'])
    expect(new Set(boegen.flatMap((b) => b.klassen))).toEqual(new Set(['E', '1', '2', '3', '4', '5']))
    const b = boegen.find((x) => x.typeId === 'steg' && x.klassen[0] === 'E')!
    expect(bogenSeiten(uim, b.auftrag, b.optionen)[0]).toMatchObject({ klassenText: 'Class Dolphin', laufText: 'Attempt 1' })
  })

  it('Auswahl: Parcours, Klasse, Lauf und Liste grenzen ein; nichts gewählt heißt alle', () => {
    const { boegen } = wkrBoegenZumStand(stand(), dm)
    expect(waehleBoegen(boegen, {})).toHaveLength(boegen.length)
    expect(waehleBoegen(boegen, { parcours: 'par_2' }).every((b) => b.parcoursId === 'par_2')).toBe(true)
    const wahl = waehleBoegen(boegen, { klasse: '7', lauf: 2, liste: 'steg' })
    expect(wahl.map((b) => b.id)).toEqual(['par_2|7|2|steg'])
    expect(waehleBoegen(boegen, { klasse: '7', lauf: 1 })).toHaveLength(dm.aufbauOrder('alcatraz', false).length)
  })
})

describe('Clubmeisterschaft: mehrere Klassen je Bogen', () => {
  // Hier ohne „Papier sparen“ (die Vorgabe): geprüft wird das Zusammenlegen nach gleichem Aufbau.
  const club = (mehr: Partial<AppState> = {}) => stand({ eventKind: 'club', wkrClubGemeinsam: false, starters: starter(['E', '1', '3', '4', '7']), ...mehr })

  it('Klassen mit gleichem Aufbau teilen sich einen Bogen, Klassen ohne Starter entfallen', () => {
    const { boegen } = wkrBoegenZumStand(club(), dm)
    const steg = boegen.filter((b) => b.typeId === 'steg' && b.lauf === 1)
    expect(steg.map((b) => sortiert(b.klassen))).toEqual([['E', '1', '3'], ['4', '7']])
    expect(steg[0].optionen).toMatchObject({ klassenBloecke: true })
    // Mann-über-Bord: nur die Klassen ab 4 – mit Parcoursbild, also je Klasse (siehe unten).
    expect(boegen.filter((b) => b.typeId === 'mueb' && b.lauf === 1).map((b) => b.klassen)).toEqual([['4'], ['7']])
    // Weniger Papier als mit einem Bogen je Klasse.
    expect(boegen.length).toBeLessThan(wkrBoegenZumStand(club({ eventKind: 'meisterschaft' }), dm).boegen.length)
  })

  it('eine Klasse mit anderen Spalten bekommt ihren eigenen Bogen', () => {
    const { boegen } = wkrBoegenZumStand(club(), dm)
    // Tor 1 / 3 / 5: Die Speed-Spalten hängen an der Klasse (Klasse 4 anders als Klasse 7).
    const tor = boegen.filter((b) => b.typeId === 'gate135' && b.lauf === 1 && b.parcoursId === 'par_2')
    expect(tor.map((b) => b.klassen)).toEqual([['4'], ['7']])
    expect(tor[0].optionen.klassenBloecke).toBeUndefined()
  })

  it('Listen mit Parcoursbild bleiben je Klasse: Jede Klasse sieht ihre eigene Zeichnung', () => {
    for (const aufbau of ['alcatraz', 'moewe', 'bawue']) {
      const s = stand({ eventKind: 'club', wkrClubGemeinsam: false, aufbau, parcoursList: EIN_PARCOURS })
      const { boegen } = wkrBoegenZumStand(s, dm)
      expect(boegen.some((b) => b.klassen.length > 1), aufbau).toBe(true)
      for (const b of boegen) {
        const seite = bogenSeiten(dm, b.auftrag, b.optionen)[0]
        if (!seite.bild) continue
        // Das Bild des Bogens ist die Zeichnung jeder Klasse, die auf ihm steht.
        for (const k of b.klassen) expect(dm.bildDatei(aufbau, k), `${aufbau} ${b.typeId} ${b.klassen}`).toBe(seite.bild.datei)
      }
    }
    // Möwe: Der Kurs der Klassen 5 bis 7 steht nicht auf dem Bogen der Klassen E bis 4.
    const moewe = wkrBoegenZumStand(stand({ eventKind: 'club', wkrClubGemeinsam: false, aufbau: 'moewe', parcoursList: EIN_PARCOURS }), dm).boegen
    const parcours = moewe.filter((b) => b.typeId === 'parcours' && b.lauf === 1)
    expect(parcours.map((b) => b.klassen).sort((a, b) => ALLE.indexOf(a[0]) - ALLE.indexOf(b[0]))).toEqual(ALLE.map((k) => [k]))
    const fuerE = parcours.find((b) => b.klassen[0] === 'E')!
    expect(bogenSeiten(dm, fuerE.auftrag, fuerE.optionen)[0].bild?.datei).toBe(dm.bildDatei('moewe', 'E'))
  })

  it('Gruppen müssen nicht zusammenhängen: Die Bögen folgen der ersten Klasse der Gruppe', () => {
    // Steg: Klasse 4 … 7 haben andere Spalten als E … 3; ohne 5 und 6 stehen 4 und 7 zusammen.
    const s = club({ parcoursList: EIN_PARCOURS })
    const { boegen } = wkrBoegenZumStand(s, dm)
    const lauf1 = boegen.filter((b) => b.lauf === 1)
    // „Erste Klasse“ heißt: die, die laut Verzahnung zuerst startet.
    const startfolge = [...new Set(planEvent(s).plans[0].sequence.map((x) => x.klasse))]
    const erste = lauf1.map((b) => startfolge.indexOf(b.klassen[0]))
    expect(erste).toEqual([...erste].sort((a, b) => a - b))
    // Jede Klasse steht je Liste auf genau einem Bogen.
    for (const typeId of new Set(lauf1.map((b) => b.typeId))) {
      const k = lauf1.filter((b) => b.typeId === typeId).flatMap((b) => b.klassen)
      expect(new Set(k).size, typeId).toBe(k.length)
    }
  })

  it('auf dem Bogen: Zwischenüberschrift je Klasse, Startreihenfolge je Klasse, Leerzeilen am Ende jeder Klasse', () => {
    const s = club({ wkrLeerzeilen: 1, wkrLeerzeilenKlasse: { '3': 2 } })
    const b = wkrBoegenZumStand(s, dm).boegen.find((x) => x.typeId === 'steg' && x.klassen.length === 3)!
    const seiten = bogenSeiten(dm, b.auftrag, b.optionen)
    expect(seiten).toHaveLength(1)
    const seite = seiten[0]
    // In der Startreihenfolge der Verzahnung: hier 1, E, 3.
    expect(seite.klassenText).toBe('Klassen 1, E, 3')
    expect(seite.zeigtKlasse).toBe(false)
    expect(seite.rows.map((z) => z.zwischen ?? (z.nr || '·'))).toEqual([
      'Klasse 1', '101', '102', '103', '·',
      'Klasse E', 'E01', 'E02', 'E03', '·',
      'Klasse 3', '301', '302', '303', '·', '·',
    ])
    // Jede fünfte Zeile grau, Zwischenüberschriften zählen nicht mit.
    expect(seite.rows.filter((z) => z.shaded).map((z) => z.nr || '·')).toEqual(['E01', '302'])
    expect(new Set(seite.rows.map((z) => z.key)).size).toBe(seite.rows.length)
    expect(seite.rows.filter((z) => z.fixed).every((z) => z.key.startsWith('id-'))).toBe(true)
  })

  it('Seitenaufteilung: Eine Klasse bleibt zusammen; nur eine zu große wird geteilt', () => {
    const s = club({ starters: [...starter(['E'], 5), ...starter(['1'], 6), ...starter(['3'], 25)], wkrLeerzeilen: 0 })
    const b = wkrBoegenZumStand(s, dm).boegen.find((x) => x.typeId === 'steg')!
    const seiten = bogenSeiten(dm, b.auftrag, { ...b.optionen, zeilenKapazitaet: 12 })
    // Die Blöcke stehen in der Startreihenfolge der Verzahnung (hier 3, E, 1). Klasse 3 braucht
    // ohnehin drei Stücke; unter ihrem letzten ist noch Platz für Klasse E.
    expect(seiten.map((x) => x.rows.map((z) => z.zwischen).filter(Boolean))).toEqual([
      ['Klasse 3'],
      ['Klasse 3 (Fortsetzung)'],
      ['Klasse 3 (Fortsetzung)', 'Klasse E'],
      ['Klasse 1'],
    ])
    expect(seiten.every((x) => x.rows.length <= 12)).toBe(true)
    expect(seiten.map((x) => x.pageCount)).toEqual([4, 4, 4, 4])
    // Im Kopf stehen die Klassen der Seite, nicht alle des Bogens.
    expect(seiten.map((x) => x.klassenText)).toEqual(['Klasse 3', 'Klasse 3', 'Klassen 3, E', 'Klasse 1'])
    // Mit mehr Platz stehen E und 1 zusammen, hinter Klasse 3.
    const weit = bogenSeiten(dm, b.auftrag, { ...b.optionen, zeilenKapazitaet: 30 })
    expect(weit.map((x) => x.rows.map((z) => z.zwischen).filter(Boolean))).toEqual([['Klasse 3'], ['Klasse E', 'Klasse 1']])
  })

  it('Leerzeilen kosten kein eigenes Blatt: Sie entfallen bis auf eine, Starter nie', () => {
    // 14 Starter + 3 Leerzeilen + Überschrift bräuchten 18 Zeilen; bei 16 bleibt eine Leerzeile.
    const s = club({ starters: [...starter(['E'], 14), ...starter(['1'], 14)] })
    const b = wkrBoegenZumStand(s, dm).boegen.find((x) => x.typeId === 'steg')!
    const seiten = bogenSeiten(dm, b.auftrag, { ...b.optionen, zeilenKapazitaet: 16 })
    expect(seiten.map((x) => x.rows.map((z) => z.zwischen).filter(Boolean))).toEqual([['Klasse E'], ['Klasse 1']])
    expect(seiten.map((x) => x.rows.filter((z) => z.fixed).length)).toEqual([14, 14])
    expect(seiten.map((x) => x.rows.filter((z) => !z.fixed && z.zwischen === undefined).length)).toEqual([1, 1])
    // Mit Platz stehen alle drei da.
    const weit = bogenSeiten(dm, b.auftrag, { ...b.optionen, zeilenKapazitaet: 18 })
    expect(weit.map((x) => x.rows.filter((z) => !z.fixed && z.zwischen === undefined).length)).toEqual([3, 3])
  })

  it('ein Parcours für alle: der Name des Wettkampfrichters gilt für den gemeinsamen Bogen', () => {
    const s = club({ parcoursList: EIN_PARCOURS, einteilung: { par_1: { steg: 'A. Muster' } } })
    const steg = wkrBoegenZumStand(s, dm).boegen.filter((b) => b.typeId === 'steg' && b.lauf === 1)
    expect(steg.map((b) => sortiert(b.klassen))).toEqual([['E', '1', '3', '4', '7']])
    expect(steg[0].auftrag.wkr).toBe('A. Muster')
    expect(steg[0].auftrag.parcours).toBeUndefined()
  })

  it('Club, Papier sparen: alle Klassen einer Liste auf einem Bogen, ohne Bild, fehlende Spalten schraffiert', () => {
    const s = stand({ eventKind: 'club', wkrClubGemeinsam: true, parcoursList: EIN_PARCOURS, laufCount: 1 })
    const { boegen } = wkrBoegenZumStand(s, dm)
    const listen = dm.aufbauOrder('alcatraz', false)
    // Je Liste genau ein Bogen – statt je Klasse einer bei Listen mit Bild.
    expect(boegen.map((b) => b.typeId).sort()).toEqual([...listen].sort())
    const tor = boegen.find((b) => b.typeId === 'gate135')!
    expect(sortiert(tor.klassen)).toEqual(ALLE)
    const seiten = bogenSeiten(dm, tor.auftrag, tor.optionen)
    expect(seiten.every((x) => x.bild === undefined)).toBe(true)
    // Mann-über-Bord fahren nur die Klassen ab 4: Sie teilen sich den Bogen, die anderen stehen nicht darauf.
    expect(boegen.find((b) => b.typeId === 'mueb')!.klassen).toEqual(['4', '5', '6', '7'])
    // Irgendwo im Aufbau hat eine Klasse eine Spalte nicht, die eine andere hat: Dort ist die Zelle gesperrt.
    const zeilen = boegen.flatMap((b) => bogenSeiten(dm, b.auftrag, b.optionen).flatMap((x) => x.rows))
    expect(zeilen.some((z) => z.fixed && z.cells.some((c) => !c.gilt))).toBe(true)
    // Leerzeilen gehören keiner Klasse: Dort ist jedes Feld beschreibbar.
    expect(zeilen.filter((z) => !z.fixed && z.zwischen === undefined).every((z) => z.cells.every((c) => c.gilt))).toBe(true)
  })

  it('Club ohne Papier sparen: Listen mit Bild bleiben je Klasse und behalten ihre Zeichnung', () => {
    const s = stand({ eventKind: 'club', wkrClubGemeinsam: false, parcoursList: EIN_PARCOURS, laufCount: 1 })
    const tore = wkrBoegenZumStand(s, dm).boegen.filter((b) => b.typeId === 'gate135')
    expect(tore.length).toBeGreaterThan(1)
    expect(tore.every((b) => b.auftrag.ohneBild === false)).toBe(true)
  })

})
