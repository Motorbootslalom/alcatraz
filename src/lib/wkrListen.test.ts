import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { planEvent } from '../planung/plan'
import { emptyState, reducer } from '../state/reducer'
import { bogenSeiten } from './bogen'
import { klassenInStartfolge, waehleBoegen, wkrBoegenZumStand, WKR_DRUCKFOLGE } from './wkrListen'
import { bogenCode } from './qr'
import type { AppState, ClassId, Starter } from '../types'
import { veranstaltungsListen } from './listen'
import { verteileAufKlassen } from '../domain/generate'

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
  it('zwei Parcours: je Parcours, Klasse, Lauf und Liste ein Bogen – nach Parcours, Position, Lauf, Klasse', () => {
    const s0 = stand()
    const { boegen, ohneListe } = wkrBoegenZumStand(s0, dm)
    expect(ohneListe).toEqual([])
    const listen = dm.aufbauOrder('alcatraz', false)
    // Mann-über-Bord gibt es erst ab Klasse 4: acht Klassen × 3 Läufe × Listen, vier Klassen ohne MüB.
    // Dazu je Klasse einmal die Knoten (Vorgabe des Regelwerks, ohne Lauf).
    expect(boegen).toHaveLength(8 * 3 * listen.length - 4 * 3 + 8)
    // Sie liegen im Stapel des letzten Laufs: Die Knoten zählen erst zum Gesamtergebnis.
    expect(boegen.filter((b) => b.typeId === 'knoten').every((b) => b.lauf === 3)).toBe(true)
    expect(new Set(boegen.map((b) => b.id)).size).toBe(boegen.length)
    // Druckfolge (Nutzer 21.11.2026, WKR_DRUCKFOLGE): je Parcours erst alle Bögen der ersten Position, dann die der
    // nächsten – darin die zeitliche Folge: 1. Lauf in der Klassenfolge der Verzahnung, dann der 2. … So wird der
    // Stapel nur an den Positionen getrennt und verteilt, nie sortiert.
    expect(WKR_DRUCKFOLGE.innen).toBe('lauf')
    const plan = planEvent(stand()).plans
    const klassenFolge = new Map(plan.map((p) => [p.parcoursId, [...new Set(p.sequence.map((x) => x.klasse))]]))
    expect(klassenFolge.get('par_1')!.slice(0, 2)).not.toEqual(['E', '1'])
    const erwartet = plan.flatMap((p) =>
      veranstaltungsListen(dm, stand()).flatMap((typeId) => {
        const ks = klassenFolge.get(p.parcoursId)!.filter((k) => dm.positionAllowsClass(typeId, k))
        const laeufe = dm.getSheetDef(typeId).showLauf === false ? [3] : [1, 2, 3]
        return laeufe.flatMap((lauf) => ks.map((k) => `${p.parcoursId}/${typeId}/${lauf}/${k}`))
      }),
    )
    expect(boegen.map((b) => `${b.parcoursId}/${b.typeId}/${b.lauf}/${b.klassen[0]}`)).toEqual(erwartet)
    // Die QR-Kennungen der Bögen folgen derselben Ordnung (jeder Bogen findet in der Erfassung sich selbst).
    expect(boegen.map((b) => b.auftrag.qr)).toEqual(boegen.map((b) => bogenCode({ kennung: s0.kennung, regelwerk: s0.regelwerk, aufbau: 'alcatraz' }, { parcoursId: b.parcoursId, klassen: b.klassen, lauf: b.lauf, typeId: b.typeId })))
    expect(boegen[0]).toMatchObject({ parcoursId: 'par_1', klassen: [klassenFolge.get('par_1')![0]], lauf: 1, typeId: listen[0] })
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
    expect(bawue.filter((b) => b.typeId === 'knoten' && b.klassen[0] === '7').map((b) => b.lauf)).toEqual([3])
    expect(zwei.filter((b) => b.typeId === 'knoten' && b.klassen[0] === '7').map((b) => b.lauf)).toEqual([2])
    const einer = wkrBoegenZumStand(stand({ laufCount: 1 }), dm).boegen
    expect(einer.filter((b) => b.typeId === 'knoten' && b.klassen[0] === '7').map((b) => b.lauf)).toEqual([1])
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

  it('UIM, „Versuche direkt nacheinander“: je Liste EIN Bogen, jeder Starter mit 1. und 2. Versuch direkt nacheinander', () => {
    const uim = configFor({ regelwerk: 'uim-2026', sprache: 'en' })
    const basis = stand({ regelwerk: 'uim-2026', laufCount: 2, starters: starter(['1']), kennung: 'ABCD2345' })
    // Aus (Vorgabe): je Versuch ein Bogen, wie bisher.
    const aus = wkrBoegenZumStand(basis, uim).boegen
    expect(aus.filter((b) => b.typeId === 'steg').map((b) => [b.lauf, b.versuche])).toEqual([
      [1, undefined],
      [2, undefined],
    ])
    expect(bogenSeiten(uim, aus[0].auftrag, aus[0].optionen)[0]).toMatchObject({ versuchForm: false, laufText: 'Attempt 1' })
    // An: ein Bogen je Liste, alle im selben Stapel (Lauf 1) – auch die Knoten.
    const an = wkrBoegenZumStand({ ...basis, versucheNacheinander: true }, uim).boegen
    expect([...new Set(an.map((b) => b.lauf))]).toEqual([1])
    expect(an.filter((b) => b.typeId === 'steg').map((b) => b.versuche)).toEqual([2])
    expect(an.find((b) => b.typeId === 'knoten')?.versuche).toBeUndefined()
    const steg = an.find((b) => b.typeId === 'steg')!
    const seite = bogenSeiten(uim, steg.auftrag, { ...steg.optionen, leerzeilen: 0 })[0]
    expect(seite).toMatchObject({ versuchForm: true, startForm: false, laufText: undefined })
    // Jeder Starter zweimal direkt nacheinander; die Werte hängen an Starter und Versuch.
    expect(seite.rows.map((r) => [r.nr, r.lauf, r.starter, r.key, r.blockEnde === true])).toEqual([
      ['101', 1, 'id-1-1', 'id-1-1#1', false],
      ['101', 2, 'id-1-1', 'id-1-1#2', true],
      ['102', 1, 'id-1-2', 'id-1-2#1', false],
      ['102', 2, 'id-1-2', 'id-1-2#2', true],
      ['103', 1, 'id-1-3', 'id-1-3#1', false],
      ['103', 2, 'id-1-3', 'id-1-3#2', true],
    ])
    // Die Knoten werden nur einmal abgenommen: eine Zeile je Starter, ohne Spalte „Versuch“.
    const knoten = an.find((b) => b.typeId === 'knoten')!
    expect(bogenSeiten(uim, knoten.auftrag, { ...knoten.optionen, leerzeilen: 0 })[0]).toMatchObject({ versuchForm: false })
    expect(bogenSeiten(uim, knoten.auftrag, { ...knoten.optionen, leerzeilen: 0 })[0].rows).toHaveLength(3)
    // Geteilt wird nach Startern: Die Versuche eines Starters bleiben auf einer Seite (Platz für 5 Zeilen = 2 Starter).
    const geteilt = bogenSeiten(uim, steg.auftrag, { leerzeilen: 0, kapazitaet: 5 })
    expect(geteilt.map((s) => s.rows.map((r) => `${r.nr}/${r.lauf}`))).toEqual([['101/1', '101/2', '102/1', '102/2'], ['103/1', '103/2']])
    // Am Vorsteg kommt der Starter nur einmal vorbei: eine Zeile je Starter wie bei den Knoten,
    // ohne Spalte „Versuch“ und ohne Lauf im Kopf – der Bogen gilt für beide Versuche.
    const vorsteg = an.find((b) => b.typeId === 'vorsteg')!
    expect([vorsteg.lauf, vorsteg.versuche, vorsteg.auftrag.versuche, vorsteg.auftrag.einmal]).toEqual([1, 2, 2, true])
    expect(steg.auftrag.einmal).toBeUndefined()
    const vs = bogenSeiten(uim, vorsteg.auftrag, { ...vorsteg.optionen, leerzeilen: 0 })[0]
    expect(vs).toMatchObject({ versuchForm: false, laufText: undefined })
    expect(vs.rows.map((r) => [r.nr, r.key, r.lauf])).toEqual([
      ['101', 'id-1-1', undefined],
      ['102', 'id-1-2', undefined],
      ['103', 'id-1-3', undefined],
    ])
    // Ohne die Option hat auch der Vorsteg je Versuch seinen Bogen.
    expect(aus.filter((b) => b.typeId === 'vorsteg').map((b) => [b.lauf, b.auftrag.einmal])).toEqual([
      [1, undefined],
      [2, undefined],
    ])
    // Der QR-Code nennt den Stapel (Lauf 1) – die Erfassung findet darüber den einen Bogen.
    expect(steg.auftrag.qr).toMatch(/\.1\.STEG$/i)
    expect(vorsteg.auftrag.qr).toMatch(/\.1\.VORSTEG$/i)
    // Unter der DM gibt es die Option nicht: Der Schalter wirkt dort nicht.
    const unterDm = wkrBoegenZumStand(stand({ laufCount: 2, starters: starter(['1']), versucheNacheinander: true }), dm).boegen
    expect([...new Set(unterDm.map((b) => b.lauf))]).toEqual([1, 2])
  })

  it('Auswahl: Parcours, Klasse, Lauf und Liste grenzen ein; nichts gewählt heißt alle', () => {
    const { boegen } = wkrBoegenZumStand(stand(), dm)
    expect(waehleBoegen(boegen, {})).toHaveLength(boegen.length)
    expect(waehleBoegen(boegen, { parcours: 'par_2' }).every((b) => b.parcoursId === 'par_2')).toBe(true)
    const wahl = waehleBoegen(boegen, { klasse: '7', lauf: 2, liste: 'steg' })
    expect(wahl.map((b) => b.id)).toEqual(['par_2|7|2|steg'])
    expect(waehleBoegen(boegen, { klasse: '7', lauf: 3 })).toHaveLength(dm.aufbauOrder('alcatraz', false).length + 1)
    expect(waehleBoegen(boegen, { klasse: '7', lauf: 2 })).toHaveLength(dm.aufbauOrder('alcatraz', false).length)
  })
})

// R6-01 (Nutzer 21.11.2026): „Clubmeisterschaft ist eine Meisterschaft ohne Vereine, jedoch mit mehreren Klassen
// auf einem Blatt.“ Das Blatt mit mehreren Klassen ist der gemeinsame WKR-Bogen – geprüft an einem Feld in der
// Größe des Beispiels (10–20, domain/generate.ts); die Wertungslisten bleiben je Klasse (Rangliste je Klasse).
describe('Clubmeisterschaft im Umfang des Beispielfelds: mehrere Klassen auf einem Blatt', () => {
  it('15 Starter, Papier sparen: je Position und Parcours ein Steg-Bogen mit allen Klassen des Parcours', () => {
    const jeKlasse = verteileAufKlassen(15, ALLE)
    const starters = ALLE.flatMap((k) => starter([k], jeKlasse[k]))
    const s = stand({ eventKind: 'club', originMode: 'none', wkrClubGemeinsam: true, laufCount: 1, starters })
    const steg = wkrBoegenZumStand(s, dm).boegen.filter((b) => b.typeId === 'steg')
    expect(steg.length).toBe(s.parcoursList.length)
    for (const b of steg) expect(b.klassen.length).toBeGreaterThan(1)
    const mitStartern = ALLE.filter((k) => jeKlasse[k] > 0)
    expect(sortiert(steg.flatMap((b) => b.klassen))).toEqual(mitStartern)
  })
})

describe('Clubmeisterschaft, Papier sparen: Leerzeilen je Seite statt je Klasse', () => {
  const sparen = (mehr: Partial<AppState> = {}) => stand({ eventKind: 'club', wkrClubGemeinsam: true, wkrLeerzeilen: 1, laufCount: 1, starters: starter(['E', '1', '2', '3'], 5), ...mehr })
  const steg = (s: AppState) => wkrBoegenZumStand(s, dm).boegen.find((b) => b.typeId === 'steg')!
  /** Je Seite die Zeilen in Kurzform: Überschrift, „s“ = Starter, „_“ = Leerzeile. */
  const bild = (s: AppState, zeilenKapazitaet = 0) => {
    const b = steg(s)
    return bogenSeiten(dm, b.auftrag, { ...b.optionen, zeilenKapazitaet }).map((seite) => seite.rows.map((r) => r.zwischen ?? (r.fixed ? 's' : '_')).join(' '))
  }

  it('gemeinsame Bögen tragen die Zahl je Seite; die Zahl je Klasse gilt dort nicht', () => {
    const b = steg(sparen({ wkrLeerzeilenSeite: 4, wkrLeerzeilenKlasse: { '1': 7 } }))
    expect(b.klassen).toHaveLength(4)
    expect(b.optionen).toEqual({ klassenBloecke: true, leerzeilen: 0, leerzeilenJeSeite: 4 })
    // Fehlt die Angabe (Aufrufer ohne ganzen Stand), gilt die Vorgabe: drei.
    const { wkrLeerzeilenSeite: _weg, ...ohne } = sparen()
    expect(wkrBoegenZumStand(ohne as AppState, dm).boegen.find((x) => x.typeId === 'steg')!.optionen.leerzeilenJeSeite).toBe(3)
  })

  it('ohne „Papier sparen“ und auf Bögen mit nur einer Klasse bleibt es bei den Leerzeilen je Klasse', () => {
    const getrennt = steg(sparen({ wkrClubGemeinsam: false, wkrLeerzeilenKlasse: { '1': 7 } }))
    expect(getrennt.optionen).toEqual({ klassenBloecke: true, leerzeilen: 1, leerzeilenJeKlasse: { '1': 7 } })
    // Mann-über-Bord hat auf Parcours 2 nur eine Klasse mit Startern: ein Bogen einer Klasse.
    const allein = wkrBoegenZumStand(sparen({ starters: starter(['1', '4'], 5), wkrLeerzeilen: 2 }), dm).boegen.find((b) => b.typeId === 'mueb')!
    expect(allein.klassen).toEqual(['4'])
    expect(allein.optionen).toMatchObject({ leerzeilen: 2 })
    expect(allein.optionen.leerzeilenJeSeite).toBeUndefined()
  })

  it('eine Seite: die Leerzeilen stehen einmal am Ende, unter „Nachmeldungen“ – nicht nach jeder Klasse', () => {
    const seiten = bild(sparen())
    expect(seiten).toHaveLength(1)
    const klassen = seiten[0].match(/Klasse \S+/g)!
    expect(klassen).toHaveLength(4)
    expect(seiten[0].endsWith('s Nachmeldungen _ _ _')).toBe(true)
    expect(seiten[0].match(/_/g)).toHaveLength(3)
    // Vorher: eine je Klasse, also vier, jeweils hinter ihrer Klasse.
    expect(bild(sparen({ wkrClubGemeinsam: false }))[0].match(/_/g)).toHaveLength(4)
  })

  it('mehrere Seiten: auf jeder Seite stehen sie am Ende; ihr Platz zählt bei der Teilung mit', () => {
    // 4 Klassen × (Überschrift + 5 Starter) = 24 Zeilen. Auf ein Blatt mit 20 Zeilen passen
    // neben „Nachmeldungen“ + 3 Leerzeilen noch 16: zwei Klassen je Seite.
    const seiten = bild(sparen(), 20)
    expect(seiten).toHaveLength(2)
    for (const s of seiten) {
      expect(s.match(/Klasse \S+/g)).toHaveLength(2)
      expect(s.endsWith('s Nachmeldungen _ _ _')).toBe(true)
      expect(s.split(' ').length).toBeLessThanOrEqual(20)
    }
    // Die Schlüssel der Leerzeilen sind je Seite eindeutig.
    const b = steg(sparen())
    const schluessel = bogenSeiten(dm, b.auftrag, { ...b.optionen, zeilenKapazitaet: 20 }).flatMap((s) => s.rows.map((r) => r.key))
    expect(new Set(schluessel).size).toBe(schluessel.length)
  })

  it('Leerzeilen sind kein Grund für ein weiteres Blatt: Sie entfallen bis auf eine', () => {
    // 24 Zeilen auf Blättern mit 14: zwei Klassen (12 Zeilen) je Seite – daneben bleibt Platz
    // für die Überschrift und genau eine Leerzeile. Drei kosteten ein drittes Blatt.
    const seiten = bild(sparen(), 14)
    expect(seiten).toHaveLength(2)
    for (const s of seiten) expect(s.endsWith('s Nachmeldungen _')).toBe(true)
    // Wer keine will, bekommt keine – auch keine Überschrift.
    const ohne = bild(sparen({ wkrLeerzeilenSeite: 0 }), 20)
    expect(ohne.join(' ')).not.toMatch(/Nachmeldungen|_/)
  })

  it('zweisprachiger Bogen: die Überschrift in beiden Sprachen', () => {
    const b = steg(sparen({ regelwerk: 'uim-2026', starters: starter(['E', '1', '2', '3'], 5) }))
    const texte = (sprache: 'de' | 'en' | 'de+en') => bogenSeiten(configFor({ regelwerk: 'uim-2026', sprache }), b.auftrag, b.optionen)[0].rows.flatMap((r) => (r.zwischen !== undefined && r.klasse === undefined ? [r.zwischen] : []))
    expect(texte('en')).toEqual(['Late entries'])
    expect(texte('de+en')).toEqual(['Nachmeldungen / Late entries'])
  })
})

describe('Sprache der Bögen: der Titel in der Auswahl folgt der Sprache der Liste', () => {
  it('`titelVon` nennt jede Liste, wie sie auf ihrem Bogen heißt; ohne Angabe gilt die Konfiguration', () => {
    const uim = stand({ regelwerk: 'uim-2026', starters: starter(['1']), laufCount: 1 })
    const en = configFor({ regelwerk: 'uim-2026', sprache: 'en' })
    const de = configFor({ regelwerk: 'uim-2026', sprache: 'de' })
    const titel = (boegen: { typeId: string; titel: string }[]) => Object.fromEntries(boegen.map((b) => [b.typeId, b.titel]))
    expect(titel(wkrBoegenZumStand(uim, en).boegen)).toMatchObject({ steg: 'Pontoon', zeit: 'Time' })
    const gemischt = wkrBoegenZumStand(uim, en, (typeId) => (typeId === 'steg' ? de : en).getSheetDef(typeId).title)
    expect(titel(gemischt.boegen)).toMatchObject({ steg: 'Steg', zeit: 'Time' })
    // Sonst ändert sich nichts: dieselben Bögen in derselben Reihenfolge.
    expect(gemischt.boegen.map((b) => b.id)).toEqual(wkrBoegenZumStand(uim, en).boegen.map((b) => b.id))
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
    // „Erste Klasse“ heißt: die, die laut Verzahnung zuerst startet – je Position (Druckfolge WKR_DRUCKFOLGE).
    const startfolge = [...new Set(planEvent(s).plans[0].sequence.map((x) => x.klasse))]
    for (const typeId of new Set(lauf1.map((b) => b.typeId))) {
      const erste = lauf1.filter((b) => b.typeId === typeId).map((b) => startfolge.indexOf(b.klassen[0]))
      expect(erste, typeId).toEqual([...erste].sort((a, b) => a - b))
    }
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
    const listen = veranstaltungsListen(dm, s)
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

  it('Druckreihenfolge der Klassen: erst Parcours, dann wie sie laut Verzahnung zuerst starten; Klassen ohne Parcours am Ende', () => {
    const s = stand()
    const erwartet = planEvent(s).plans.flatMap((p) => [...new Set(p.sequence.map((x) => x.klasse))])
    expect(klassenInStartfolge(s)).toEqual(erwartet)
    // Dieselbe Reihenfolge wie die der Bögen.
    const boegen = wkrBoegenZumStand(s, dm).boegen.map((b) => b.klassen[0]).filter((k, i, a) => a.indexOf(k) === i)
    expect(klassenInStartfolge(s)).toEqual(boegen)
    // Nimmt man Klasse 3 von ihrem Parcours, steht sie hinten – ihre Ergebnisse gibt es weiter.
    const ohne = stand({ parcoursList: s.parcoursList.map((p) => ({ ...p, classIds: p.classIds.filter((k) => k !== '3') })) })
    expect(klassenInStartfolge(ohne).at(-1)).toBe('3')
    expect(klassenInStartfolge({ ...ohne, starters: ohne.starters.filter((p) => p.klasse !== '3') })).not.toContain('3')
  })

  it('jeder Bogen trägt seinen QR-Code: Veranstaltung, Regelwerk, Aufbau, Parcours, Klassen, Lauf und Liste', () => {
    const { boegen } = wkrBoegenZumStand(stand({ kennung: 'K7Q4' }), dm)
    const steg = boegen.find((b) => b.typeId === 'steg' && b.klassen[0] === '7' && b.lauf === 2)!
    expect(steg.auftrag.qr).toBe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR2.7.2.STEG')
    expect(new Set(boegen.map((b) => b.auftrag.qr)).size).toBe(boegen.length)
    // Clubmeisterschaft: Der gemeinsame Bogen nennt alle seine Klassen.
    const club = wkrBoegenZumStand(stand({ kennung: 'K7Q4', eventKind: 'club', parcoursList: EIN_PARCOURS }), dm).boegen
    expect(club.find((b) => b.typeId === 'steg' && b.lauf === 1)!.auftrag.qr).toBe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.E1234567.1.STEG')
    expect(club.find((b) => b.typeId === 'mueb' && b.lauf === 3)!.auftrag.qr).toBe('ALC1.K7Q4.DM2026.ALCATRAZ.PAR1.4567.3.MUEB')
    expect(new Set(club.map((b) => b.auftrag.qr)).size).toBe(club.length)
  })
})

describe('Seitenaufteilung: Starter je Seite und „Teilen ab“', () => {
  const eineKlasse = (n: number, mehr: Partial<AppState> = {}) => stand({ starters: starter(['4'], n), ...mehr })
  const seiten = (s: AppState, typeId = 'steg') => {
    const b = wkrBoegenZumStand(s, dm).boegen.find((x) => x.typeId === typeId && x.lauf === 1)!
    return bogenSeiten(dm, b.auftrag, b.optionen).map((p) => p.rows.filter((r) => r.fixed).length)
  }

  it('ohne Angabe steht alles auf einer Seite, bis gemessen ist (automatisch)', () => {
    const b = wkrBoegenZumStand(eineKlasse(24), dm).boegen[0]
    expect(b.optionen).toMatchObject({ zeilenJeSeite: 0, teilenAb: 0 })
    expect(seiten(eineKlasse(24))).toEqual([24])
  })

  it('eine feste Zahl teilt jeden Bogen einer Klasse; die Leerzeilen stehen auf jeder Seite', () => {
    const s = eineKlasse(24, { wkrZeilenJeSeite: 10 })
    expect(seiten(s)).toEqual([10, 10, 4])
    const b = wkrBoegenZumStand(s, dm).boegen[0]
    for (const p of bogenSeiten(dm, b.auftrag, b.optionen)) expect(p.rows.filter((r) => !r.fixed)).toHaveLength(3)
  })

  it('„Teilen ab“: kleinere Klassen bleiben auf einem Blatt', () => {
    expect(seiten(eineKlasse(24, { wkrZeilenJeSeite: 15, wkrTeilenAb: 25 }))).toEqual([24])
    expect(seiten(eineKlasse(25, { wkrZeilenJeSeite: 15, wkrTeilenAb: 25 }))).toEqual([15, 10])
  })

  it('Clubmeisterschaft: gemeinsame Bögen mehrerer Klassen teilen sich immer automatisch', () => {
    const club = stand({ eventKind: 'club', wkrZeilenJeSeite: 5, wkrTeilenAb: 0, starters: starter(ALLE, 8) })
    const { boegen } = wkrBoegenZumStand(club, dm)
    const gemeinsam = boegen.filter((b) => b.klassen.length > 1)
    expect(gemeinsam.length).toBeGreaterThan(0)
    for (const b of gemeinsam) {
      expect(b.optionen.klassenBloecke).toBe(true)
      expect(b.optionen.zeilenJeSeite).toBeUndefined()
      // Ohne Messung eine Seite – die feste Zahl (5) risse hier jede Klasse entzwei.
      expect(bogenSeiten(dm, b.auftrag, b.optionen)).toHaveLength(1)
    }
    // Ein Bogen einer einzelnen Klasse (ohne „Papier sparen“ die Listen mit Bild) folgt der festen Zahl.
    const einzeln = wkrBoegenZumStand({ ...club, wkrClubGemeinsam: false }, dm).boegen.find((b) => b.klassen.length === 1)!
    expect(einzeln.optionen).toMatchObject({ zeilenJeSeite: 5 })
    expect(bogenSeiten(dm, einzeln.auftrag, einzeln.optionen)).toHaveLength(2)
  })
})
