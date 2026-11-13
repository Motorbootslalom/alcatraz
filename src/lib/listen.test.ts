import { describe, expect, it } from 'vitest'
import { configFor } from '../config/konfig'
import { emptyState, reducer } from '../state/reducer'
import { erfasstKennung, laufSchluessel, listeUmziehen, verborgeneZellen } from './eingaben'
import { nameUmziehen } from './einteilung'
import { klassenErgebnis } from './ergebnis'
import { buildLaufzettel } from './laufzettel'
import { normalisiereZusatzListen, veranstaltungsListen, zusatzListen } from './listen'
import { wkrBoegenZumStand } from './wkrListen'
import type { AppState, ClassId, Eingaben, Starter } from '../types'
import type { RawAufbau } from '../config/schema'

// Welche Listen eine Veranstaltung hat: Aufbau, zusammengelegte Liste (Tor 5 + Parcours),
// zusätzliche Listen und die Vorgabe des Regelwerks (Knoten). Alle Starter sind erfunden.

const dm = configFor({ regelwerk: 'dm-2026' })
const uim = configFor({ regelwerk: 'uim-2026' })
const ALCATRAZ = ['zeit', 'vorsteg', 'steg', 'gate135', 'gate245', 'tor5', 'mueb', 'parcours']

function starter(klassen: ClassId[], n = 2): Starter[] {
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
const stand = (mehr: Partial<AppState> = {}): AppState => ({ ...emptyState(), starters: starter(['1', '4']), ...mehr })
const L1 = laufSchluessel('manoevrieren', 1)

describe('Listen der Veranstaltung', () => {
  it('der Aufbau, dahinter die Vorgabe des Regelwerks: die Knoten – unter DM und UIM', () => {
    expect(veranstaltungsListen(dm, { aufbau: 'alcatraz' })).toEqual([...ALCATRAZ, 'knoten'])
    expect(veranstaltungsListen(uim, { aufbau: 'alcatraz' })).toEqual([...ALCATRAZ, 'knoten'])
    // Die Vorgabe steht in der Konfiguration, nicht im Code.
    expect(dm.getRegelwerk().vorgabeListen).toEqual({ manoevrieren: ['knoten'] })
    expect(uim.getRegelwerk().vorgabeListen).toEqual({ manoevrieren: ['knoten'] })
  })

  it('die Vorgabe gilt je Disziplin: Der Parallelslalom bekommt keine Knoten (UIM 960, Pkt. 4.3)', () => {
    expect(uim.getAufbau('parallel').disziplin).toBe('parallel')
    expect(uim.getAufbau('parallel').zusatz).toContain('knoten')
    expect(veranstaltungsListen(uim, { aufbau: 'parallel' })).not.toContain('knoten')
    expect(zusatzListen(uim, { aufbau: 'parallel' }).find((z) => z.id === 'knoten')).toEqual({ id: 'knoten', an: false, vorgabe: false })
    // Von Hand dazuwählen ließe sie sich weiter.
    expect(veranstaltungsListen(uim, { aufbau: 'parallel', zusatzListen: { knoten: true } })).toContain('knoten')
  })

  it('nennt ein Aufbau die Knoten selbst, stehen sie dort, wo er sie nennt – und nur einmal', () => {
    const listen = veranstaltungsListen(dm, { aufbau: 'bawue' })
    expect(listen).toEqual(dm.getAufbau('bawue').order)
    expect(listen.filter((l) => l === 'knoten')).toHaveLength(1)
    expect(zusatzListen(dm, { aufbau: 'bawue' }).map((z) => z.id)).not.toContain('knoten')
  })

  it('die Vorgabe lässt sich abwählen, weitere Listen lassen sich dazuwählen – in der Reihenfolge der Konfiguration', () => {
    expect(veranstaltungsListen(dm, { aufbau: 'alcatraz', zusatzListen: { knoten: false } })).toEqual(ALCATRAZ)
    const mehr = veranstaltungsListen(dm, { aufbau: 'alcatraz', zusatzListen: { parcoursms: true, gate135os: true } })
    expect(mehr.slice(0, ALCATRAZ.length)).toEqual(ALCATRAZ)
    expect(mehr.slice(ALCATRAZ.length)).toEqual(dm.getAufbau('alcatraz').zusatz.filter((id) => ['knoten', 'parcoursms', 'gate135os'].includes(id)))
    // Zur Wahl steht, was der Aufbau nicht selbst hat; der Vorsteg gehört bei Alcatraz dazu, bei Frontal nicht.
    expect(zusatzListen(dm, { aufbau: 'alcatraz' }).map((z) => z.id)).not.toContain('vorsteg')
    expect(zusatzListen(dm, { aufbau: 'frontal' }).find((z) => z.id === 'vorsteg')).toEqual({ id: 'vorsteg', an: false, vorgabe: false })
    expect(zusatzListen(dm, { aufbau: 'frontal' }).find((z) => z.id === 'knoten')).toEqual({ id: 'knoten', an: true, vorgabe: true })
  })

  it('„Tor 5 übernimmt die Parcoursüberwachung“: eine Liste statt zweier, nur wo der Aufbau beide hat', () => {
    expect(veranstaltungsListen(dm, { aufbau: 'alcatraz', tor5MitParcours: true })).toEqual(['zeit', 'vorsteg', 'steg', 'gate135', 'gate245', 'tor5pue', 'mueb', 'knoten'])
    expect(veranstaltungsListen(dm, { aufbau: 'alcatrazdm26', tor5MitParcours: true })).toContain('tor5puems')
    expect(dm.getAufbau('alcatraz').kombi?.positionId).toBe('tor5pue')
    expect(dm.getAufbau('bawue').kombi).toBeUndefined()
    // Ohne Kombi im Aufbau wirkt die Wahl nicht.
    expect(veranstaltungsListen(dm, { aufbau: 'bawue', tor5MitParcours: true })).toEqual(dm.getAufbau('bawue').order)
  })

  it('die gespeicherte Wahl wird bereinigt', () => {
    expect(normalisiereZusatzListen({ knoten: false, vorsteg: true, x: 'ja', '': true })).toEqual({ knoten: false, vorsteg: true })
    expect(normalisiereZusatzListen(['knoten'])).toEqual({})
    expect(normalisiereZusatzListen(null)).toEqual({})
    expect(Object.keys(normalisiereZusatzListen(JSON.parse('{"__proto__": true, "knoten": true}')))).toEqual(['knoten'])
  })
})

describe('Bögen, Wertung und Laufzettel folgen den Listen der Veranstaltung', () => {
  it('gedruckt wird die zusammengelegte Liste statt Tor 5 und Parcours, dazu die gewählten zusätzlichen', () => {
    const s = stand({ tor5MitParcours: true, zusatzListen: { parcoursms: true }, laufCount: 1 })
    const typen = (klasse: ClassId) => wkrBoegenZumStand(s, dm).boegen.filter((b) => b.klassen[0] === klasse).map((b) => b.typeId)
    expect(typen('4')).toEqual(['zeit', 'vorsteg', 'steg', 'gate135', 'gate245', 'tor5pue', 'mueb', 'parcoursms', 'knoten'])
    expect(typen('1')).not.toContain('mueb')
  })

  it('der QR-Code eines zusätzlichen Bogens nennt seine Liste', () => {
    const knoten = wkrBoegenZumStand(stand({ kennung: 'K7Q4' }), dm).boegen.find((b) => b.typeId === 'knoten' && b.klassen[0] === '4')!
    expect(knoten).toMatchObject({ lauf: 1, titel: 'Knoten' })
    expect(knoten.auftrag.qr).toContain('.KNOTEN')
  })

  it('eine Disqualifikation auf einer zusätzlichen Liste zählt in der Wertung', () => {
    const basis = stand({ aufbau: 'frontal', zusatzListen: { vorsteg: true } })
    const s = reducer(basis, {
      type: 'SET_EINGABEN',
      zellen: [
        { lauf: L1, starter: 'id-4-1', feld: 'zeit1', wert: '80' },
        { lauf: L1, starter: 'id-4-1', feld: 'disq@vorsteg', wert: 'X' },
        { lauf: L1, starter: 'id-4-2', feld: 'zeit1', wert: '90' },
      ],
    })
    const lauf = klassenErgebnis(s, dm, '4')!.laeufe[0]
    expect(lauf.nachPlatz.map((z) => [z.starter.id, z.disq])).toEqual([['id-4-2', false], ['id-4-1', true]])
    expect(verborgeneZellen(s, dm)).toEqual([])
    // Abgewählt zeigt keine Ansicht die Eingabe mehr: Sie wird als verborgen gemeldet.
    expect(verborgeneZellen({ ...s, zusatzListen: {} }, dm).map((z) => z.feld)).toEqual(['disq@vorsteg'])
  })

  it('Laufzettel: Club mit „Papier sparen“ – ein Zettel je Parcours und Lauf, auch wenn die Bögen die Klassen nicht verbinden', () => {
    const s = stand({ eventKind: 'club', laufCount: 2, parcoursList: [{ id: 'par_1', name: 'Parcours 1', classIds: ['1', '4'], wechselFaktor: 2 }] })
    const { boegen } = wkrBoegenZumStand(s, dm)
    const listen = veranstaltungsListen(dm, s)
    const zettel = buildLaufzettel(boegen, listen, () => 2, { jeParcours: true })
    expect(zettel.map((z) => [z.parcoursId, [...z.klassen].sort().join('+'), z.lauf])).toEqual([['par_1', '1+4', 1], ['par_1', '1+4', 2]])
    // Jede Druckseite jedes Bogens hat ihr Kästchen; die Knoten nur im 1. Lauf.
    expect(zettel[0].zeilen).toHaveLength(boegen.filter((b) => b.lauf === 1).length * 2)
    expect(zettel[0].zeilen.at(-1)).toMatchObject({ typeId: 'knoten', seite: 2, seiten: 2 })
    expect(zettel[1].zeilen.some((z) => z.typeId === 'knoten')).toBe(false)
    // Selbst Bögen einzelner Klassen ergäben mit `jeParcours` einen Stapel.
    const einzeln = wkrBoegenZumStand({ ...s, eventKind: 'meisterschaft' }, dm).boegen
    expect(buildLaufzettel(einzeln, listen, () => 1, { jeParcours: true })).toHaveLength(2)
    expect(buildLaufzettel(einzeln, listen, () => 1)).toHaveLength(4)
  })
})

describe('Umschalten „Tor 5 übernimmt die Parcoursüberwachung“', () => {
  const klasseVon = (id: string) => (id.startsWith('id-4') ? '4' : id.startsWith('id-1') ? '1' : undefined)
  const eingaben: Eingaben = {
    [L1]: {
      'id-4-1': { 'disq@tor5': 'G', 'bemerkung@tor5': 'zu spät', [erfasstKennung('tor5')]: '1', 'disq@parcours': 'J', 'disq@steg': 'I', zeit1: '80' },
      'id-1-1': { [erfasstKennung('tor5')]: '1' },
    },
    'parallel/1': { 'id-4-1': { 'disq@tor5': 'G' } },
  }

  it('was zur Liste Tor 5 gehört, zieht auf die zusammengelegte um und zurück; anderes bleibt', () => {
    const an = listeUmziehen(eingaben, dm, 'manoevrieren', klasseVon, 'tor5', 'tor5pue')
    expect(an[L1]['id-4-1']).toEqual({ 'disq@tor5pue': 'G', 'bemerkung@tor5pue': 'zu spät', [erfasstKennung('tor5pue')]: '1', 'disq@parcours': 'J', 'disq@steg': 'I', zeit1: '80' })
    expect(an[L1]['id-1-1']).toEqual({ [erfasstKennung('tor5pue')]: '1' })
    // Eine andere Disziplin ist nicht betroffen.
    expect(an['parallel/1']).toBe(eingaben['parallel/1'])
    expect(listeUmziehen(an, dm, 'manoevrieren', klasseVon, 'tor5pue', 'tor5')).toEqual(eingaben)
  })

  it('ein belegtes Ziel wird nicht überschrieben, ein unbekannter Starter nicht angefasst; ohne Änderung dasselbe Objekt', () => {
    const belegt = { [L1]: { 'id-4-1': { 'disq@tor5': 'G', 'disq@tor5pue': 'D' }, fremd: { 'disq@tor5': 'G' } } }
    expect(listeUmziehen(belegt, dm, 'manoevrieren', klasseVon, 'tor5', 'tor5pue')).toBe(belegt)
    expect(listeUmziehen(eingaben, dm, 'manoevrieren', klasseVon, 'tor5', 'tor5')).toBe(eingaben)
  })

  it('der Name des Wettkampfrichters zieht mit, wenn am Ziel niemand steht', () => {
    const e = { par_1: { tor5: 'Erika Muster', steg: 'Max Beispiel' }, par_2: { tor5: 'A', tor5pue: 'B' } }
    expect(nameUmziehen(e, 'tor5', 'tor5pue')).toEqual({ par_1: { tor5pue: 'Erika Muster', steg: 'Max Beispiel' }, par_2: { tor5: 'A', tor5pue: 'B' } })
    expect(nameUmziehen({ par_1: { steg: 'x' } }, 'tor5', 'tor5pue')).toEqual({ par_1: { steg: 'x' } })
  })

  it('Reducer: Umschalten zieht Eingaben und Namen um; Bojen, Fehler und Zeiten bleiben, wo sie sind', () => {
    let s = stand({ einteilung: { par_2: { tor5: 'Erika Muster' } } })
    s = reducer(s, {
      type: 'SET_EINGABEN',
      zellen: [
        { lauf: L1, starter: 'id-4-1', feld: 'disq@tor5', wert: 'G' },
        { lauf: L1, starter: 'id-4-1', feld: erfasstKennung('tor5'), wert: '1' },
        { lauf: L1, starter: 'id-4-1', feld: 'zeit1', wert: '80' },
      ],
    })
    const an = reducer(s, { type: 'SET_TOR5_MIT_PARCOURS', on: true })
    expect(an.tor5MitParcours).toBe(true)
    expect(an.eingaben[L1]['id-4-1']).toEqual({ 'disq@tor5pue': 'G', [erfasstKennung('tor5pue')]: '1', zeit1: '80' })
    expect(an.einteilung).toEqual({ par_2: { tor5pue: 'Erika Muster' } })
    // Nichts ist verborgen, und die Disqualifikation zählt weiter.
    expect(verborgeneZellen(an, dm)).toEqual([])
    // Der Haken der ruhenden Parcoursliste bleibt für das Trennen stehen und ist kein Fund;
    // eine Disqualifikation dort zählt aber weiter und wird gemeldet.
    const mitParcours = reducer(an, {
      type: 'SET_EINGABEN',
      zellen: [
        { lauf: L1, starter: 'id-4-2', feld: erfasstKennung('parcours'), wert: '1' },
        { lauf: L1, starter: 'id-4-2', feld: 'disq@parcours', wert: 'J' },
      ],
    })
    expect(verborgeneZellen(mitParcours, dm).map((z) => z.feld)).toEqual(['disq@parcours'])
    expect(klassenErgebnis(an, dm, '4')!.laeufe[0].nachNummer[0].disq).toBe(true)
    expect(reducer(an, { type: 'SET_TOR5_MIT_PARCOURS', on: true })).toBe(an)
    const aus = reducer(an, { type: 'SET_TOR5_MIT_PARCOURS', on: false })
    expect(aus.eingaben).toEqual(s.eingaben)
    expect(aus.einteilung).toEqual(s.einteilung)
  })

  it('Reducer: Ein Aufbauwechsel bei zusammengelegter Liste zieht auf die dortige Liste um', () => {
    let s = stand({ tor5MitParcours: true })
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: L1, starter: 'id-4-1', feld: 'disq@tor5pue', wert: 'G' }] })
    // Alcatraz-DM26 legt mit der Parcoursliste samt Start/Ziel zusammen: eine andere Kombi-Liste.
    const dm26 = reducer(s, { type: 'SET_AUFBAU', aufbau: 'alcatrazdm26' })
    expect(dm26.eingaben[L1]['id-4-1']).toEqual({ 'disq@tor5puems': 'G' })
    // Baden-Württemberg kann nichts zusammenlegen: Dort gilt wieder die einzelne Liste Tor 5.
    expect(reducer(s, { type: 'SET_AUFBAU', aufbau: 'bawue' }).eingaben[L1]['id-4-1']).toEqual({ 'disq@tor5': 'G' })
    // Frontal legt dieselben Listen zusammen: nichts zu tun.
    expect(reducer(s, { type: 'SET_AUFBAU', aufbau: 'frontal' }).eingaben).toBe(s.eingaben)
  })

  it('Reducer: Hin und zurück über einen Aufbau ohne zusammengelegte Liste – alles steht wieder an seinem Platz', () => {
    let s = reducer(stand({ tor5MitParcours: true }), { type: 'SET_WKR_NAME', parcoursId: 'par_2', typeId: 'tor5pue', name: 'Erika Muster' })
    s = reducer(s, {
      type: 'SET_EINGABEN',
      zellen: [
        { lauf: L1, starter: 'id-4-1', feld: 'disq@tor5pue', wert: 'G' },
        { lauf: L1, starter: 'id-4-1', feld: 'bemerkung@tor5pue', wert: 'x' },
        { lauf: L1, starter: 'id-4-1', feld: erfasstKennung('tor5pue'), wert: '1' },
      ],
    })
    expect(dm.getAufbau('berlin').kombi).toBeUndefined()
    const berlin = reducer(s, { type: 'SET_AUFBAU', aufbau: 'berlin' })
    expect(Object.keys(berlin.eingaben[L1]['id-4-1']).sort()).toEqual(['bemerkung@tor5', 'disq@tor5', erfasstKennung('tor5')].sort())
    expect(berlin.einteilung).toEqual({ par_2: { tor5: 'Erika Muster' } })
    // Zurück: Der alte Aufbau kennt keine zusammengelegte Liste – umgezogen wird von der
    // einzelnen Liste, die der neue zusammenlegt.
    const zurueck = reducer(berlin, { type: 'SET_AUFBAU', aufbau: 'alcatraz' })
    expect(zurueck.tor5MitParcours).toBe(true)
    expect(zurueck.eingaben).toEqual(s.eingaben)
    expect(zurueck.einteilung).toEqual(s.einteilung)
    expect(verborgeneZellen(zurueck, dm)).toEqual([])
  })

  it('Reducer: Ohne die Option zieht ein Aufbauwechsel nichts um', () => {
    let s = stand()
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: L1, starter: 'id-4-1', feld: 'disq@tor5', wert: 'G' }] })
    for (const aufbau of ['berlin', 'alcatrazdm26', 'frontal']) expect(reducer(s, { type: 'SET_AUFBAU', aufbau }).eingaben).toBe(s.eingaben)
  })

  it('Reducer: Ändert sich der gewählte eigene Aufbau, zieht mit, was an der Liste für Tor 5 hing', () => {
    const mit: RawAufbau = { id: 'eigenq3m8', name: 'Eigen', positionen: ['zeit', 'steg', 'tor5', 'parcours'] }
    const ohne: RawAufbau = { ...mit, positionen: ['zeit', 'steg', 'tor5'] }
    let s = stand({ eigeneAufbauten: [mit], aufbau: mit.id, tor5MitParcours: true })
    const k = configFor({ eigeneAufbauten: [mit] })
    expect(veranstaltungsListen(k, s)).toEqual(['zeit', 'steg', 'tor5pue', 'knoten'])
    s = reducer(s, { type: 'SET_EINGABEN', zellen: [{ lauf: L1, starter: 'id-4-1', feld: 'disq@tor5pue', wert: 'G' }] })
    // Die Parcoursliste entfällt: Zusammenlegen geht nicht mehr, es gilt die einzelne Liste Tor 5.
    const danach = reducer(s, { type: 'SET_EIGENE_AUFBAUTEN', aufbauten: [ohne] })
    expect(danach.aufbau).toBe(mit.id)
    expect(danach.eingaben[L1]['id-4-1']).toEqual({ 'disq@tor5': 'G' })
    expect(verborgeneZellen(danach, configFor({ eigeneAufbauten: [ohne] }))).toEqual([])
    // Und wieder dazu: zurück auf die zusammengelegte.
    expect(reducer(danach, { type: 'SET_EIGENE_AUFBAUTEN', aufbauten: [mit] }).eingaben).toEqual(s.eingaben)
  })

  it('Reducer: Ein geladener Stand bleibt, wie er ist', () => {
    const geladen = stand({ tor5MitParcours: true, eingaben: { [L1]: { 'id-4-1': { 'disq@tor5': 'G' } } } })
    expect(reducer(stand(), { type: 'LOAD_STATE', state: geladen }).eingaben).toEqual(geladen.eingaben)
  })
})
