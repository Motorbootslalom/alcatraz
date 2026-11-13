import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { emptyState } from '../state/reducer'
import { bogenSeiten } from './bogen'
import { bogenCode, laufzettelCode, leseCode, type QrBekannt } from './qr'
import { scanBogen } from './scan'
import { wkrBoegenZumStand } from './wkrListen'
import type { AppState, ClassId, Starter } from '../types'

// Vom gedruckten Code zurück zum Bogen: Jeder Code, der auf einem Bogen steht, muss genau
// diesen Bogen wiederfinden. Alle Starter sind erfunden.

function starter(klassen: ClassId[], n = 3): Starter[] {
  return klassen.flatMap((klasse) =>
    Array.from({ length: n }, (_, i) => ({ id: `id-${klasse}-${i + 1}`, startNr: `${klasse}${String(i + 1).padStart(2, '0')}`, vorname: 'V', nachname: 'N', verein: 'Musterclub', bundesland: 'Musterland', geburtsdatum: '', groesse: '', klasse })),
  )
}
const ALLE: ClassId[] = ['E', '1', '2', '3', '4', '5', '6', '7']
const dm = configFor({ regelwerk: 'dm-2026' })
const stand = (mehr: Partial<AppState> = {}): AppState => ({ ...emptyState(), kennung: 'K7Q4', starters: starter(ALLE), ...mehr })
const ohneLauf = (typeId: string) => dm.getSheetDef(typeId).showLauf === false
const bekannt = (s: AppState): QrBekannt => ({
  kennung: s.kennung,
  regelwerk: s.regelwerk,
  aufbau: s.aufbau,
  regelwerke: dm.getRegelwerke().map((r) => r.id),
  aufbauten: dm.getAufbauten().map((a) => a.id),
  parcours: s.parcoursList.map((p) => p.id),
  listen: dm.aufbauOrder(s.aufbau, false),
  laufCount: s.laufCount,
})
const EIN_PARCOURS = [{ id: 'par_1', name: 'Parcours 1', classIds: ALLE, wechselFaktor: 2 as const }]

describe('scanBogen', () => {
  it.each([
    ['Meisterschaft, zwei Parcours', stand()],
    ['Meisterschaft, Aufbau mit Knoten (Liste ohne Lauf)', stand({ aufbau: 'bawue' })],
    ['Meisterschaft, dreimal Zeit (zeit-1 … zeit-3)', stand({ aufbau: 'alcatrazdm26' })],
    ['Clubmeisterschaft, gemeinsame Bögen', stand({ eventKind: 'club', parcoursList: EIN_PARCOURS })],
    ['Clubmeisterschaft, Listen mit Bild je Klasse', stand({ eventKind: 'club', wkrClubGemeinsam: false, parcoursList: EIN_PARCOURS })],
  ])('%s: Der Code jeder Druckseite jedes Bogens führt zu genau diesem Bogen', (_name, s) => {
    const { boegen } = wkrBoegenZumStand(s, dm)
    expect(boegen.length).toBeGreaterThan(10)
    const codes = new Set<string>()
    for (const b of boegen) {
      // Der Code steht im Auftrag und kommt mit der Seite auf jede Druckseite.
      expect(b.auftrag.qr).toBe(bogenCode(s, b))
      const seiten = bogenSeiten(dm, b.auftrag, { ...b.optionen, kapazitaet: 2, zeilenKapazitaet: 6 })
      expect(seiten.length).toBeGreaterThan(1)
      seiten.forEach((seite, i) => {
        expect(codes.has(seite.qr!), seite.qr).toBe(false)
        codes.add(seite.qr!)
        const lesung = leseCode(seite.qr!, bekannt(s))
        if (!lesung.ok) throw new Error(`${seite.qr}: ${lesung.fehler.art}`)
        expect(lesung.ziel.seite).toBe(i + 1)
        const treffer = scanBogen(lesung.ziel, boegen, ohneLauf)
        expect(treffer?.bogen.id, seite.qr).toBe(b.id)
        expect(treffer?.genau).toBe(true)
        expect(b.klassen).toContain(treffer?.klasse)
      })
    }
  })

  it('ein umbenannter Parcours ändert nichts: Der Code hängt an der Kennung', () => {
    const s = stand()
    const code = `${wkrBoegenZumStand(s, dm).boegen.find((b) => b.parcoursId === 'par_2' && b.typeId === 'steg' && b.lauf === 2)!.auftrag.qr}.S1`
    const umbenannt = stand({ parcoursList: s.parcoursList.map((p) => (p.id === 'par_2' ? { ...p, name: 'Hafenbecken Süd' } : p)) })
    const lesung = leseCode(code, bekannt(umbenannt))
    if (!lesung.ok) throw new Error(lesung.fehler.art)
    const treffer = scanBogen(lesung.ziel, wkrBoegenZumStand(umbenannt, dm).boegen, ohneLauf)
    expect(treffer?.bogen).toMatchObject({ parcoursId: 'par_2', parcoursName: 'Hafenbecken Süd', typeId: 'steg', lauf: 2 })
  })

  it('Laufzettel: die erste Liste der Klasse in dem Lauf', () => {
    const s = stand()
    const { boegen } = wkrBoegenZumStand(s, dm)
    const lesung = leseCode(laufzettelCode(s, { parcoursId: 'par_2', klassen: ['5'], lauf: 3 }), bekannt(s))
    if (!lesung.ok) throw new Error(lesung.fehler.art)
    const treffer = scanBogen(lesung.ziel, boegen, ohneLauf)
    expect(treffer).toMatchObject({ klasse: '5', genau: true, bogen: { parcoursId: 'par_2', klassen: ['5'], lauf: 3, typeId: dm.aufbauOrder('alcatraz', false)[0] } })
  })

  it('Liste ohne Lauf (Knoten): passt zu jedem Lauf', () => {
    const s = stand({ aufbau: 'bawue' })
    const { boegen } = wkrBoegenZumStand(s, dm)
    const knoten = boegen.find((b) => ohneLauf(b.typeId))!
    const treffer = scanBogen({ parcoursId: knoten.parcoursId, klassen: knoten.klassen, lauf: 3, typeId: knoten.typeId, seite: 1 }, boegen, ohneLauf)
    expect(treffer?.bogen.id).toBe(knoten.id)
  })

  it('nach dem Druck anders zusammengefasst: der Bogen, auf dem die Klasse jetzt steht – als ungenau gemeldet', () => {
    const gedruckt = stand({ eventKind: 'club', parcoursList: EIN_PARCOURS })
    const gemeinsam = wkrBoegenZumStand(gedruckt, dm).boegen.find((b) => b.typeId === 'gate135' && b.lauf === 1)!
    expect(gemeinsam.klassen.length).toBeGreaterThan(1)
    const jetzt = wkrBoegenZumStand({ ...gedruckt, wkrClubGemeinsam: false }, dm).boegen
    const treffer = scanBogen({ parcoursId: 'par_1', klassen: gemeinsam.klassen, lauf: 1, typeId: 'gate135', seite: 1 }, jetzt, ohneLauf)
    expect(treffer?.genau).toBe(false)
    expect(treffer?.bogen.typeId).toBe('gate135')
    expect(treffer?.bogen.klassen).toContain(gemeinsam.klassen[0])
  })

  it('kein Bogen: Die Klasse fährt nicht (mehr) auf dem Parcours', () => {
    const s = stand()
    const { boegen } = wkrBoegenZumStand(s, dm)
    expect(scanBogen({ parcoursId: 'par_1', klassen: ['7'], lauf: 1 }, boegen, ohneLauf)).toBeNull()
    expect(scanBogen({ parcoursId: 'par_1', klassen: ['1'], lauf: 1, typeId: 'mueb', seite: 1 }, boegen, ohneLauf)).toBeNull()
  })
})
