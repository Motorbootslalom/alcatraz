import { beforeAll, describe, expect, it } from 'vitest'
import { setLocale } from '../i18n'
import { configFor } from '../config/konfig'
import type { ClassId, Starter } from '../types'
import { feldVon, laufSchluessel, listenLauf, setzeWerte, verborgeneZellen } from './eingaben'
import {
  abstaende,
  ergebnisGruppen,
  klassenErgebnis,
  streichlaeufeVon,
  streichZahl,
  type ErgebnisStand,
  type GesamtZeile,
  type LaufZeile,
} from './ergebnis'
import { abstandZelle, punkteZelle } from './ergebnisText'

// Die Wertung: aus dem Fehlerpunkte-Prototyp übernommen (lib/ergebnis.test.ts) und um die
// Entscheidungen des Nutzers erweitert – jede hat unten ihren eigenen Abschnitt. Alle Starter
// sind erfunden.

const konfig = configFor()

// Die Zellen-Texte folgen der Sprache der Oberfläche.
beforeAll(() => setLocale('de'))

function starter(nr: string, klasse: ClassId = '4'): Starter {
  return { id: `id-${nr}`, startNr: nr, vorname: `Vor${nr}`, nachname: `Nach${nr}`, verein: 'Musterclub', bundesland: 'Musterland', geburtsdatum: '', klasse, groesse: '' }
}

const basis = (nummern: string[], extra: Partial<ErgebnisStand> = {}, klasse: ClassId = '4'): ErgebnisStand => ({
  aufbau: 'alcatraz',
  eingaben: {},
  starters: nummern.map((nr) => starter(nr, klasse)),
  laufCount: 3,
  streichlaeufe: 'auto',
  ...extra,
})

/** Trägt für einen Starter Zellen je Liste ein, so wie es die Erfassung tut (Zelle → Feld-Kennung). */
function eintragen(stand: ErgebnisStand, lauf: number, nr: string, je: Record<string, Record<string, string>>): ErgebnisStand {
  const s = stand.starters.find((x) => x.startNr === nr)!
  const k = configFor()
  const disziplin = k.getAufbau(stand.aufbau).disziplin
  const zellen = Object.entries(je).flatMap(([typeId, werte]) =>
    Object.entries(werte).map(([zelle, wert]) => {
      const [colKey, sub] = zelle.split('#')
      const feld = feldVon(k, typeId, s.klasse, colKey, sub === undefined ? undefined : Number(sub))
      if (!feld) throw new Error(`Kein Feld ${typeId}/${zelle} für Klasse ${s.klasse}`)
      return { lauf: laufSchluessel(disziplin, listenLauf(k.getSheetDef(typeId), lauf)), starter: s.id, feld: feld.kennung, wert }
    }),
  )
  return { ...stand, eingaben: setzeWerte(stand.eingaben, zellen) }
}

/** Ein Lauf mit Zeiten in Sekunden; Strafpunkte und Disq. kommen über die Listen dazu. */
function laufMitZeiten(stand: ErgebnisStand, lauf: number, zeiten: Record<string, number>): ErgebnisStand {
  return Object.entries(zeiten).reduce((s, [nr, sek]) => eintragen(s, lauf, nr, { zeit: { zeit1: `${sek},00` } }), stand)
}

/** Die Läufe je Starter in Sekunden; `null` = disqualifiziert, `undefined` = noch nicht gefahren. */
function gefahren(zeiten: Record<string, Array<number | null | undefined>>, extra: Partial<ErgebnisStand> = {}): ErgebnisStand {
  let stand = basis(Object.keys(zeiten), extra)
  for (const [nr, jeLauf] of Object.entries(zeiten)) {
    jeLauf.forEach((sek, i) => {
      if (sek === undefined) return
      stand = eintragen(stand, i + 1, nr, { zeit: { zeit1: `${sek ?? 80},00` } })
      if (sek === null) stand = eintragen(stand, i + 1, nr, { parcours: { disq: 'J' } })
    })
  }
  return stand
}

const ergebnis = (stand: ErgebnisStand, klasse: ClassId = '4') => klassenErgebnis(stand, konfig, klasse)!
const nr = (z: { starter: Starter }) => z.starter.startNr
const zeile = (zeilen: LaufZeile[], nummer: string) => zeilen.find((z) => nr(z) === nummer)!
const gesamt = (stand: ErgebnisStand, nummer: string): GesamtZeile => ergebnis(stand).gesamt.nachPlatz.find((z) => nr(z) === nummer)!
const reihenfolge = (zeilen: Array<{ starter: Starter }>) => zeilen.map(nr)

describe('Punkte-Zelle und Abstand', () => {
  it('zeigt Punkte, „disq.“ statt einer Zahl und bleibt leer, solange die Zeit fehlt', () => {
    expect(punkteZelle(false, 8169)).toBe('81,69')
    expect(punkteZelle(true, null)).toBe('disq.')
    expect(punkteZelle(false, null)).toBe('')
  })

  it('Abstand zum Platz davor oder zum Ersten; leer beim Ersten, bei Disq. und ohne Ergebnis', () => {
    const zeilen = [
      { gesamt: 7000, disq: false },
      { gesamt: 7000, disq: false },
      { gesamt: 7250, disq: false },
      { gesamt: 8000, disq: false },
      { gesamt: null, disq: true },
      { gesamt: null, disq: false },
    ]
    expect(abstaende(zeilen, 'davor')).toEqual([null, null, 250, 750, null, null])
    expect(abstaende(zeilen, 'erster')).toEqual([null, null, 250, 1000, null, null])
    expect(abstandZelle(250)).toBe('+2,50')
    expect(abstandZelle(null)).toBe('')
  })
})

describe('Spalten der Ergebnisliste', () => {
  const titel = (aufbau: string, klasse: string) => ergebnisGruppen(konfig, aufbau, klasse).map((g) => g.label)

  it('folgt für Klasse 4 der Liste der DM', () => {
    expect(titel('alcatraz', '4')).toEqual(['Steg AB', 'Start', '1 H', '2 H', '3 H', '4 H', '5', '4 R', '3 R', '2 R', 'MüB', 'Ziel', 'Steg AN'])
    const tor5 = ergebnisGruppen(konfig, 'alcatraz', '4').find((g) => g.label === '5')!
    expect(tor5.blaetter.map((b) => b.label)).toEqual(['L', 'R', 'E', 'L', 'R'])
  })

  it('zeigt je Klasse nur, was sie fährt', () => {
    expect(titel('alcatraz', '3')).toEqual(['Steg AB', 'Start', '1 H', '2 H', '3 H', '4 H', '5', '4 R', '3 R', '2 R', '1 R', 'Ziel', 'Steg AN'])
    expect(titel('alcatraz', '5')).toContain('S1')
    expect(titel('alcatraz', '5')).not.toContain('S2')
    expect(titel('alcatraz', '7').filter((t) => t === '1 R')).toHaveLength(2)
    expect(titel('alcatraz', '7').slice(-8)).toEqual(['2 R', '1 R', 'MüB', 'S1', 'S2', '1 R', 'Ziel', 'Steg AN'])
  })

  it('gilt für jeden Aufbau derselben Disziplin gleich', () => {
    for (const aufbau of ['frontal', 'berlin', 'bawue', 'alcatrazdm26']) expect(titel(aufbau, '7')).toEqual(titel('alcatraz', '7'))
  })
})

describe('Ergebnisliste eines Laufs', () => {
  it('liefert nichts, solange nichts eingetragen ist – und nichts für eine Klasse ohne Starter', () => {
    expect(klassenErgebnis(basis(['401']), konfig, '4')).toBeNull()
    expect(klassenErgebnis(laufMitZeiten(basis(['401']), 1, { '401': 80 }), konfig, '5')).toBeNull()
  })

  it('rechnet die Zeit in Punkte um und zählt die Strafpunkte dazu', () => {
    const stand = eintragen(basis(['401']), 1, '401', {
      zeit: { zeit1: '1,2169' },
      gate135: { 't1a#0': '5' },
      gate245: { 't2a#1': '5' },
      steg: { fehlerAB: '3', fehlerAN: '9' },
      mueb: { fehler: '13, 14' },
      tor5: { fehler: '1' },
    })
    const z = ergebnis(stand).laeufe[0].nachNummer[0]
    expect(z.zeit).toBe(8169)
    expect(z.strafpunkte).toBe(5 + 5 + 5 + 10 + 10 + 20)
    expect(z.gesamt).toBe(8169 + 5500)
  })

  it('mittelt die Stoppuhren einer Zeit-Liste', () => {
    const stand = eintragen(basis(['401']), 1, '401', { zeit: { zeit1: '81,00', zeit2: '82,00', zeit3: '83,00' } })
    expect(ergebnis(stand).laeufe[0].nachNummer[0].zeit).toBe(8200)
  })

  it('Zeitnahme: nimmt die elektronische Zeit (Lichtschranke), ohne sie den Mittelwert der Stoppuhren', () => {
    const dm26 = basis(['401'], { aufbau: 'alcatrazdm26' })
    const alle = eintragen(dm26, 1, '401', { 'zeit-1': { zeit1: '81,00' }, 'zeit-2': { zeit1: '82,00' }, 'zeit-3': { zeit1: '84,00' } })
    expect(ergebnis(alle).laeufe[0].nachNummer[0].zeit).toBe(8100)
    const ohneLichtschranke = eintragen(dm26, 1, '401', { 'zeit-2': { zeit1: '82,00' }, 'zeit-3': { zeit1: '84,00' } })
    expect(ergebnis(ohneLichtschranke).laeufe[0].nachNummer[0].zeit).toBe(8300)
  })

  it('sortiert nach Startnummer und nach Platz', () => {
    const stand = laufMitZeiten(basis(['403', '401', '402']), 1, { '401': 90, '402': 70, '403': 80 })
    const { nachNummer, nachPlatz } = ergebnis(stand).laeufe[0]
    expect(reihenfolge(nachNummer)).toEqual(['401', '402', '403'])
    expect(nachNummer.map((z) => z.platz)).toEqual([3, 1, 2])
    expect(reihenfolge(nachPlatz)).toEqual(['402', '403', '401'])
    expect(nachPlatz.map((z) => z.platz)).toEqual([1, 2, 3])
  })

  it('gibt bei gleichen Punkten denselben Platz und überspringt den nächsten', () => {
    const stand = laufMitZeiten(basis(['401', '402', '403', '404']), 1, { '401': 80, '402': 70, '403': 70, '404': 90 })
    expect(ergebnis(stand).laeufe[0].nachPlatz.map((z) => [nr(z), z.platz])).toEqual([['402', 1], ['403', 1], ['401', 3], ['404', 4]])
  })

  it('setzt Disqualifizierte ohne Punkte gemeinsam hinter alle anderen', () => {
    let stand = laufMitZeiten(basis(['401', '402', '403', '404']), 1, { '401': 90, '402': 60, '403': 70, '404': 80 })
    stand = eintragen(stand, 1, '402', { gate135: { 't1a#0': 'J' } })
    stand = eintragen(stand, 1, '403', { steg: { disq: 'C' } })
    expect(ergebnis(stand).laeufe[0].nachPlatz.map((z) => [nr(z), z.platz, z.gesamt])).toEqual([
      ['404', 1, 8000],
      ['401', 2, 9000],
      ['402', 3, null],
      ['403', 3, null],
    ])
  })

  it('zeigt Punkte und Buchstaben an ihrer Stelle (Tor und Boje), Disq. aus der Disq-Spalte nur im Schlüssel', () => {
    let stand = laufMitZeiten(basis(['401']), 1, { '401': 80 })
    stand = eintragen(stand, 1, '401', {
      gate135: { 't1a#0': '5', 't1a#1': 'J', 'start#0': '5', disq: 'C' },
      gate245: { 'start#0': '10' },
      tor5: { fehler: '2' },
      mueb: { fehler: '17, D' },
    })
    const { gruppen, nachNummer } = ergebnis(stand).laeufe[0]
    const zelleVon = (gruppe: string, blatt = 0) => {
      const blaetter = gruppen.flatMap((g) => g.blaetter.map((_, i) => ({ g: g.label, i })))
      return nachNummer[0].zellen[blaetter.findIndex((b) => b.g === gruppe && b.i === blatt)]
    }
    expect(zelleVon('1 H', 0)).toBe('J') // Links
    expect(zelleVon('1 H', 1)).toBe('5') // Rechts
    expect(zelleVon('Start')).toBe('15')
    expect(zelleVon('5', 2)).toBe('5') // Einfahrt: Code 2
    expect(zelleVon('MüB')).toBe('5, D')
    expect(nachNummer[0].zellen.join('|')).not.toContain('C')
    expect(nachNummer[0].disq).toBe(true)
    expect(nachNummer[0].schluessel).toBe('2, 17, C, D, J')
  })

  it('sortiert den Fehler-Schlüssel natürlich, nennt Buchstaben einmal und Mehrfache nach dem Code', () => {
    let stand = laufMitZeiten(basis(['401']), 1, { '401': 80 })
    stand = eintragen(stand, 1, '401', {
      steg: { fehlerAB: '3', fehlerAN: '7', disq: 'C' },
      mueb: { fehler: '2x17, 18' },
      parcours: { disq: 'A' },
      gate135: { 't1a#0': 'J', 't1a#1': 'J' },
    })
    expect(ergebnis(stand).laeufe[0].nachNummer[0].schluessel).toBe('3, 7, 2x17, 18, A, C, J')
  })

  it('hängt an der Starter-ID, nicht an der Startnummer: Umnummerieren ändert nichts', () => {
    const stand = laufMitZeiten(basis(['401', '402']), 1, { '401': 80, '402': 70 })
    const umnummeriert = { ...stand, starters: stand.starters.map((s) => (s.startNr === '401' ? { ...s, startNr: '17' } : s)) }
    const z = ergebnis(umnummeriert).laeufe[0].nachNummer
    expect(z.map((x) => [x.starter.id, nr(x), x.gesamt])).toEqual([
      ['id-401', '17', 8000],
      ['id-402', '402', 7000],
    ])
  })

  it('wertet gelöschte Starter nicht mit', () => {
    const stand = laufMitZeiten(basis(['401', '402']), 1, { '401': 80, '402': 70 })
    const ohne = { ...stand, starters: stand.starters.filter((s) => s.startNr !== '402') }
    expect(ergebnis(ohne).laeufe[0].nachPlatz.map((z) => [nr(z), z.platz])).toEqual([['401', 1]])
  })

  it('bleibt beim Wechsel des Aufbaus gleich', () => {
    let stand = laufMitZeiten(basis(['401', '402']), 1, { '401': 80, '402': 70 })
    stand = eintragen(stand, 1, '401', { gate135: { 't1a#0': '5', 't5#0': '10' }, tor5: { fehler: '1' }, parcours: { disq: 'J' } })
    stand = eintragen(stand, 1, '402', { gate245: { 't2a#0': '5' }, mueb: { fehler: '13' } })
    const vorher = ergebnis(stand).laeufe[0].nachNummer
    for (const aufbau of ['frontal', 'berlin', 'bawue', 'alcatrazdm26']) expect(ergebnis({ ...stand, aufbau }).laeufe[0].nachNummer, aufbau).toEqual(vorher)
  })

  it('zeigt nur Läufe bis zur Zahl der Läufe der Veranstaltung', () => {
    let stand = laufMitZeiten(basis(['401']), 1, { '401': 80 })
    stand = laufMitZeiten(stand, 3, { '401': 81 })
    expect(ergebnis(stand).laeufe.map((l) => l.lauf)).toEqual([1, 3])
    expect(ergebnis({ ...stand, laufCount: 2 }).laeufe.map((l) => l.lauf)).toEqual([1])
  })
})

describe('Entscheidung: Noch nicht gefahren steht ohne Zeit auf Platz 1', () => {
  it('im Lauf: Offene teilen sich Platz 1, die Gefahrenen folgen dahinter', () => {
    const stand = laufMitZeiten(basis(['401', '402', '403', '404']), 1, { '402': 80, '404': 70 })
    const { nachPlatz } = ergebnis(stand).laeufe[0]
    expect(nachPlatz.map((z) => [nr(z), z.platz, z.gesamt, z.offen])).toEqual([
      ['401', 1, null, true],
      ['403', 1, null, true],
      ['404', 3, 7000, false],
      ['402', 4, 8000, false],
    ])
    expect(zeile(nachPlatz, '401').zeit).toBeNull()
  })

  it('nach dem Nachholen wird einsortiert – die anderen rücken nur auf, nie ab', () => {
    const vorher = laufMitZeiten(basis(['401', '402', '403']), 1, { '402': 80, '403': 70 })
    const platzVorher = Object.fromEntries(ergebnis(vorher).laeufe[0].nachPlatz.map((z) => [nr(z), z.platz]))
    expect(platzVorher).toEqual({ '401': 1, '403': 2, '402': 3 })
    // Der Nachholer fährt die schlechteste Zeit: Beide anderen rücken auf.
    const langsam = Object.fromEntries(ergebnis(laufMitZeiten(vorher, 1, { '401': 95 })).laeufe[0].nachPlatz.map((z) => [nr(z), z.platz]))
    expect(langsam).toEqual({ '403': 1, '402': 2, '401': 3 })
    // Er fährt die beste: Die anderen behalten ihren Platz.
    const schnell = Object.fromEntries(ergebnis(laufMitZeiten(vorher, 1, { '401': 60 })).laeufe[0].nachPlatz.map((z) => [nr(z), z.platz]))
    expect(schnell).toEqual({ '401': 1, '403': 2, '402': 3 })
    for (const n of ['402', '403']) {
      expect(langsam[n]).toBeLessThanOrEqual(platzVorher[n])
      expect(schnell[n]).toBeLessThanOrEqual(platzVorher[n])
    }
  })

  it('Strafpunkte ohne Zeit gelten weiter als offen (die Zeit fehlt noch)', () => {
    let stand = laufMitZeiten(basis(['401', '402']), 1, { '402': 80 })
    stand = eintragen(stand, 1, '401', { gate135: { 't1a#0': '5' } })
    const z = zeile(ergebnis(stand).laeufe[0].nachPlatz, '401')
    expect([z.platz, z.gesamt, z.offen, z.strafpunkte]).toEqual([1, null, true, 5])
  })

  it('in der Gesamtliste: Wer einen Lauf noch nachholt, steht ohne Ergebnis auf Platz 1', () => {
    const stand = gefahren({ '401': [70, 71, 72], '402': [60, undefined, 61], '403': [80, 81, 82] })
    expect(gesamt(stand, '402')).toMatchObject({ offen: true, disq: false, ergebnis: null, gesamt: null, platz: 1, gestrichen: [] })
    expect(ergebnis(stand).gesamt.nachPlatz.map((z) => [nr(z), z.platz])).toEqual([['402', 1], ['401', 2], ['403', 3]])
    // Nachgeholt: normal einsortiert, der schlechteste Lauf gestrichen.
    const danach = laufMitZeiten(stand, 2, { '402': 90 })
    expect(gesamt(danach, '402')).toMatchObject({ offen: false, ergebnis: 12100, platz: 1, gestrichen: [2] })
  })

  it('in der Gesamtliste zählen nur Läufe mit Eingaben: Vor dem dritten Lauf ist niemand „offen“', () => {
    const stand = gefahren({ '401': [70, 71], '402': [60, 61] })
    expect(ergebnis(stand).gesamt.laeufe).toEqual([1, 2])
    expect(ergebnis(stand).gesamt.nachPlatz.map((z) => [nr(z), z.platz, z.offen])).toEqual([['402', 1, false], ['401', 2, false]])
  })

  it('ein offener Lauf wird nicht gestrichen, eine Disqualifikation daneben schon', () => {
    const stand = gefahren({ '401': [null, undefined, 70], '402': [80, 81, 82] })
    expect(gesamt(stand, '401')).toMatchObject({ offen: true, disq: false, platz: 1, gestrichen: [1] })
  })
})

describe('Entscheidung: Nicht gestartet (x am Steg oder Vorsteg) ist disqualifiziert', () => {
  it('ein x am Vorsteg ohne Zeit: letzter Platz im Lauf, nicht „offen“', () => {
    let stand = laufMitZeiten(basis(['401', '402', '403']), 1, { '401': 80 })
    stand = eintragen(stand, 1, '402', { vorsteg: { disq: 'X' } })
    const { nachPlatz } = ergebnis(stand).laeufe[0]
    expect(nachPlatz.map((z) => [nr(z), z.platz, z.offen, z.disq])).toEqual([
      ['403', 1, true, false], // holt noch nach
      ['401', 2, false, false],
      ['402', 3, false, true], // nicht gestartet
    ])
    const z = zeile(nachPlatz, '402')
    expect([z.gesamt, z.zeit, z.schluessel, z.nichtGestartet]).toEqual([null, null, 'X', true])
  })

  it('ebenso am Steg; der Unterschied zu „noch offen“ ist allein das x', () => {
    const offen = laufMitZeiten(basis(['401', '402']), 1, { '401': 80 })
    expect(zeile(ergebnis(offen).laeufe[0].nachPlatz, '402')).toMatchObject({ offen: true, disq: false, platz: 1 })
    const x = eintragen(offen, 1, '402', { steg: { disq: 'X' } })
    expect(zeile(ergebnis(x).laeufe[0].nachPlatz, '402')).toMatchObject({ offen: false, disq: true, platz: 2, nichtGestartet: true })
  })

  it('in der Gesamtliste wird der nicht gestartete Lauf gestrichen wie jede Disqualifikation', () => {
    let stand = gefahren({ '401': [70, undefined, 72], '402': [80, 81, 82] })
    stand = eintragen(stand, 2, '401', { vorsteg: { disq: 'X' } })
    expect(gesamt(stand, '401')).toMatchObject({ disq: false, offen: false, gestrichen: [2], ergebnis: 14200, platz: 1 })
  })
})

describe('Entscheidung: Ein disqualifizierter Lauf wird gestrichen, zu wenige gültige Läufe → letzte Plätze', () => {
  it('streicht genau den schlechtesten Lauf', () => {
    const z = gesamt(gefahren({ '401': [70, 90, 80] }), '401')
    expect(z).toMatchObject({ gestrichen: [2], ergebnis: 15000, gesamt: 15000, disq: false })
  })

  it('streicht eine Disqualifikation und wertet den Starter normal', () => {
    const stand = gefahren({ '401': [null, 70, 80], '402': [71, 72, 73] })
    expect(gesamt(stand, '401')).toMatchObject({ gestrichen: [1], ergebnis: 15000, platz: 2, disq: false })
    expect(gesamt(stand, '402').platz).toBe(1)
  })

  it('zwei Disqualifikationen: nur eine wird gestrichen, der Starter steht auf dem letzten Platz', () => {
    const stand = gefahren({ '401': [null, null, 60], '402': [90, 91, 92], '403': [80, 81, null] })
    expect(gesamt(stand, '401')).toMatchObject({ gestrichen: [1], disq: true, ergebnis: null, gesamt: null, platz: 3 })
    expect(reihenfolge(ergebnis(stand).gesamt.nachPlatz)).toEqual(['403', '402', '401'])
  })

  it('auch bei drei Disqualifikationen der letzte Platz, ohne mehr zu streichen', () => {
    const stand = gefahren({ '401': [null, null, null], '402': [90, 91, 92] })
    expect(gesamt(stand, '401')).toMatchObject({ gestrichen: [1], disq: true, platz: 2 })
  })

  it('mehrfach Disqualifizierte teilen sich den letzten Platz, nach Startnummer', () => {
    const stand = gefahren({ '403': [null, 70, null], '401': [90, null, null], '402': [80, 81, 82], '404': [70, 71, 72] })
    expect(ergebnis(stand).gesamt.nachPlatz.map((z) => [nr(z), z.platz])).toEqual([['404', 1], ['402', 2], ['401', 3], ['403', 3]])
    // Bei gleich schlechten Läufen ist der frühere gestrichen.
    expect(gesamt(stand, '401').gestrichen).toEqual([2])
    expect(gesamt(stand, '403').gestrichen).toEqual([1])
  })

  it('zu wenige gültige Läufe schlagen „offen“: Wer nicht mehr zu retten ist, steht hinten, nicht auf Platz 1', () => {
    const stand = gefahren({ '401': [null, null, undefined], '402': [80, 81, 82] })
    expect(gesamt(stand, '401')).toMatchObject({ disq: true, offen: false, platz: 2 })
  })

  it('bei nur einem gefahrenen Lauf wird nichts gestrichen', () => {
    const stand = laufMitZeiten(basis(['401', '402']), 1, { '401': 80, '402': 90 })
    expect(gesamt(stand, '401')).toMatchObject({ gestrichen: [], ergebnis: 8000, platz: 1 })
  })

  it('Zwischenstand: Eine Disqualifikation, die der Streichlauf am Ende aufnimmt, ist noch keine Gesamt-Disqualifikation', () => {
    // 3 Läufe, einer wird gestrichen. Nach zwei Läufen hat 401 erst einen gültigen – kein
    // vergleichbares Ergebnis, also Platz 1 ohne Ergebnis wie ein Nachholer, nicht „disq.“.
    const zwei = gefahren({ '401': [null, 60], '402': [90, 90], '403': [95, 95] })
    expect(gesamt(zwei, '401')).toMatchObject({ disq: false, offen: true, ergebnis: null, platz: 1, gestrichen: [1] })
    expect(gesamt(zwei, '402')).toMatchObject({ ergebnis: 18000, platz: 2 })
    expect(gesamt(zwei, '403')).toMatchObject({ platz: 3 })
    // Nach dem dritten Lauf ist der disqualifizierte gestrichen – und niemand ist abgerutscht.
    const drei = gefahren({ '401': [null, 60, 60], '402': [90, 90, 90], '403': [95, 95, 95] })
    expect(gesamt(drei, '401')).toMatchObject({ disq: false, offen: false, ergebnis: 12000, platz: 1, gestrichen: [1] })
    expect(gesamt(drei, '402').platz).toBe(2)
    expect(gesamt(drei, '403').platz).toBe(3)
    // Fährt 401 im dritten Lauf schlecht, rücken die anderen auf.
    const schlecht = gefahren({ '401': [null, 60, 200], '402': [90, 90, 90], '403': [95, 95, 95] })
    expect(reihenfolge(ergebnis(schlecht).gesamt.nachPlatz)).toEqual(['402', '403', '401'])
  })

  it('Zwischenstand: Mehr Disqualifikationen, als am Ende gestrichen werden, stehen sofort hinten', () => {
    // Zwei Disqualifikationen bei einem Streichlauf sind nicht mehr zu retten.
    const zwei = gefahren({ '401': [null, null], '402': [90, 90] })
    expect(gesamt(zwei, '401')).toMatchObject({ disq: true, offen: false, platz: 2 })
    // Ohne Streichlauf (zwei Läufe nach Regel) gilt schon die erste.
    const ohne = gefahren({ '401': [null], '402': [90] }, { laufCount: 2 })
    expect(gesamt(ohne, '401')).toMatchObject({ disq: true, offen: false, platz: 2 })
    // Alle zählen (0 Streichläufe bei drei Läufen): ebenso.
    const alle = gefahren({ '401': [null, 60], '402': [90, 90] }, { streichlaeufe: 0 })
    expect(gesamt(alle, '401')).toMatchObject({ disq: true, platz: 2 })
  })
})

describe('Was als gefahrener Lauf zählt', () => {
  it('Haken, Bemerkung oder Fehlerpunkte allein machen noch keinen Lauf der Gesamtwertung', () => {
    let stand = gefahren({ '401': [80, 70], '402': [75, 76] })
    const vorher = ergebnis(stand).gesamt
    expect(vorher.laeufe).toEqual([1, 2])
    // Das Abtippen von Lauf 3 beginnt mit einer Tor-Liste: ein Haken und ein Bojenfehler.
    stand = { ...stand, eingaben: setzeWerte(stand.eingaben, [{ lauf: laufSchluessel('manoevrieren', 3), starter: 'id-401', feld: 'erfasst@steg', wert: '1' }]) }
    stand = eintragen(stand, 3, '402', { gate135: { 't1a#0': '5' } })
    const danach = ergebnis(stand)
    // Die Lauf-Liste gibt es schon, die Gesamtliste bleibt beim Stand nach zwei Läufen.
    expect(danach.laeufe.map((l) => l.lauf)).toEqual([1, 2, 3])
    expect(danach.gesamt.laeufe).toEqual([1, 2])
    expect(danach.gesamt.nachPlatz.map((z) => [nr(z), z.platz, z.offen, z.ergebnis])).toEqual(vorher.nachPlatz.map((z) => [nr(z), z.platz, z.offen, z.ergebnis]))
    // Mit der ersten Zeit (oder einer Disqualifikation) ist der Lauf gefahren.
    expect(ergebnis(laufMitZeiten(stand, 3, { '401': 81 })).gesamt.laeufe).toEqual([1, 2, 3])
    expect(ergebnis(eintragen(stand, 3, '401', { vorsteg: { disq: 'X' } })).gesamt.laeufe).toEqual([1, 2, 3])
  })

  it('ist noch gar kein Lauf gefahren, zeigt die Gesamtliste den ersten – alle offen auf Platz 1', () => {
    const stand = eintragen(basis(['401', '402']), 1, '401', { gate135: { 't1a#0': '5' } })
    const { gesamt: g } = ergebnis(stand)
    expect(g.laeufe).toEqual([1])
    expect(g.nachPlatz.map((z) => [z.platz, z.offen])).toEqual([[1, true], [1, true]])
  })
})

describe('Wechsel des Aufbaus mit schon erfassten Werten', () => {
  // Kein stiller Fehler mehr: Die Oberfläche fragt vor dem Wechsel nach (EventView) und zeigt
  // danach, was keine Liste mehr zeigt (EingabenHinweis). Hier steht, was dabei geschieht.
  it('die erste Zeit ist je nach Aufbau Stoppuhr oder Lichtschranke – dieselben Werte ergeben eine andere Zeit', () => {
    let stand = basis(['401'])
    stand = eintragen(stand, 1, '401', { zeit: { zeit1: '80,00', zeit2: '83,00', zeit3: '83,00' } })
    expect(ergebnis(stand).laeufe[0].nachNummer[0].zeit).toBe(8200)
    const dm26 = { ...stand, aufbau: 'alcatrazdm26' }
    expect(ergebnis(dm26).laeufe[0].nachNummer[0].zeit).toBe(8000)
    // Die zweite und dritte Stoppuhr zeigt der neue Aufbau nicht mehr: Sie sind als verborgen gemeldet.
    expect(verborgeneZellen(dm26, konfig).map((z) => z.feld).sort()).toEqual(['zeit2', 'zeit3'])
    expect(verborgeneZellen(stand, konfig)).toEqual([])
  })

  it('ein x am Vorsteg zählt weiter, auch wenn der neue Aufbau keinen Vorsteg hat – und ist als verborgen gemeldet', () => {
    let stand = laufMitZeiten(basis(['401', '402']), 1, { '401': 80 })
    stand = eintragen(stand, 1, '402', { vorsteg: { disq: 'X' } })
    const frontal = { ...stand, aufbau: 'frontal' }
    expect(zeile(ergebnis(frontal).laeufe[0].nachNummer, '402')).toMatchObject({ disq: true, nichtGestartet: true })
    const verborgen = verborgeneZellen(frontal, konfig)
    expect(verborgen.map((z) => [z.starter, z.feld])).toEqual([['id-402', 'disq@vorsteg']])
    // Entfernt man das Verborgene, ist der Starter wieder offen.
    const bereinigt = { ...frontal, eingaben: setzeWerte(frontal.eingaben, verborgen.map((z) => ({ ...z, wert: '' }))) }
    expect(zeile(ergebnis(bereinigt).laeufe[0].nachNummer, '402')).toMatchObject({ disq: false, offen: true })
  })
})

describe('Entscheidung: Der Rennleiter legt Läufe und Streichläufe fest', () => {
  it('die geltende Zahl: Regel = ab drei Läufen einer; nie so viele, dass kein Lauf mehr zählt', () => {
    expect([1, 2, 3, 4].map((n) => streichlaeufeVon(n, 'auto'))).toEqual([0, 0, 1, 1])
    expect(streichlaeufeVon(2, 1)).toBe(1)
    expect(streichlaeufeVon(3, 0)).toBe(0)
    expect(streichlaeufeVon(3, 2)).toBe(2)
    expect(streichlaeufeVon(3, 7)).toBe(2)
    expect(streichlaeufeVon(1, 1)).toBe(0)
  })

  it('gestrichen wird erst, wenn mehr Läufe gefahren sind, als am Ende zählen', () => {
    expect([1, 2, 3].map((n) => streichZahl(3, 'auto', n))).toEqual([0, 0, 1])
    expect([1, 2].map((n) => streichZahl(2, 1, n))).toEqual([0, 1])
    expect([1, 2].map((n) => streichZahl(2, 'auto', n))).toEqual([0, 0])
    expect([1, 2, 3, 4].map((n) => streichZahl(4, 2, n))).toEqual([0, 0, 1, 2])
  })

  it('zwei Läufe, Regel: beide zählen; eine Disqualifikation bedeutet den letzten Platz', () => {
    const zwei = { laufCount: 2 }
    expect(gesamt(gefahren({ '401': [80, 70] }, zwei), '401')).toMatchObject({ gestrichen: [], ergebnis: 15000, platz: 1 })
    const stand = gefahren({ '401': [null, 60], '402': [90, 91], '403': [80, 81] }, zwei)
    expect(gesamt(stand, '401')).toMatchObject({ gestrichen: [], disq: true, ergebnis: null, platz: 3 })
    expect(reihenfolge(ergebnis(stand).gesamt.nachPlatz)).toEqual(['403', '402', '401'])
  })

  it('zwei Läufe, ein Streichlauf: der schlechtere wird gestrichen, eine Disqualifikation zuerst', () => {
    const zwei = { laufCount: 2, streichlaeufe: 1 }
    expect(gesamt(gefahren({ '401': [80, 70] }, zwei), '401')).toMatchObject({ gestrichen: [1], ergebnis: 7000 })
    const stand = gefahren({ '401': [null, 70], '402': [80, 81] }, zwei)
    expect(gesamt(stand, '401')).toMatchObject({ gestrichen: [1], disq: false, ergebnis: 7000, platz: 1 })
    // Nach dem ersten Lauf allein wird noch nichts gestrichen.
    expect(gesamt(gefahren({ '401': [80] }, zwei), '401')).toMatchObject({ gestrichen: [], ergebnis: 8000 })
  })

  it('drei Läufe ohne Streichlauf: alle zählen', () => {
    const stand = gefahren({ '401': [70, 90, 80], '402': [75, 75, null] }, { streichlaeufe: 0 })
    expect(gesamt(stand, '401')).toMatchObject({ gestrichen: [], ergebnis: 24000, platz: 1 })
    expect(gesamt(stand, '402')).toMatchObject({ disq: true, platz: 2 })
  })

  it('drei Läufe, zwei Streichläufe: nur der beste zählt', () => {
    const stand = gefahren({ '401': [70, null, 80], '402': [null, null, 75] }, { streichlaeufe: 2 })
    expect(gesamt(stand, '401')).toMatchObject({ gestrichen: [2, 3], ergebnis: 7000, platz: 1 })
    expect(gesamt(stand, '402')).toMatchObject({ gestrichen: [1, 2], ergebnis: 7500, platz: 2, disq: false })
  })

  it('ein einziger Lauf: der zählt', () => {
    const stand = gefahren({ '401': [80], '402': [70] }, { laufCount: 1 })
    expect(ergebnis(stand).gesamt.nachPlatz.map((z) => [nr(z), z.platz, z.ergebnis])).toEqual([['402', 1, 7000], ['401', 2, 8000]])
  })
})

describe('Entscheidung: Clubmeisterschaft – die Wertung bleibt klassenbezogen', () => {
  it('jede Klasse hat ihre eigene Rangliste; Klassen ohne Starter entfallen', () => {
    let stand: ErgebnisStand = { ...basis([]), starters: [starter('101', '1'), starter('102', '1'), starter('401', '4')] }
    stand = laufMitZeiten(stand, 1, { '101': 80, '102': 70, '401': 60 })
    expect(ergebnis(stand, '1').laeufe[0].nachPlatz.map((z) => [nr(z), z.platz])).toEqual([['102', 1], ['101', 2]])
    expect(ergebnis(stand, '4').laeufe[0].nachPlatz.map((z) => [nr(z), z.platz])).toEqual([['401', 1]])
    expect(klassenErgebnis(stand, konfig, '3')).toBeNull()
  })

  it('je Klasse nur die Spalten, die sie fährt (Mann-über-Bord erst ab Klasse 4)', () => {
    let stand: ErgebnisStand = { ...basis([]), starters: [starter('101', '1'), starter('401', '4')] }
    stand = laufMitZeiten(stand, 1, { '101': 80, '401': 60 })
    expect(ergebnis(stand, '1').laeufe[0].gruppen.map((g) => g.label)).not.toContain('MüB')
    expect(ergebnis(stand, '4').laeufe[0].gruppen.map((g) => g.label)).toContain('MüB')
  })
})

describe('Knoten', () => {
  it('zählen zur Gesamtliste, wenn der Aufbau sie hat, und können die Reihenfolge ändern', () => {
    let stand = gefahren({ '401': [70, 70, 90], '402': [71, 71, 90] }, { aufbau: 'bawue' })
    expect(ergebnis(stand).gesamt.mitKnoten).toBe(true)
    stand = eintragen(stand, 1, '401', { knoten: { palstek: '5' } })
    expect(gesamt(stand, '401')).toMatchObject({ knoten: 5, ergebnis: 14000, gesamt: 14500 })
    expect(reihenfolge(ergebnis(stand).gesamt.nachPlatz)).toEqual(['402', '401'])
  })

  it('stehen unabhängig vom Lauf des Bogens', () => {
    const stand = eintragen(gefahren({ '401': [70, 70, 90] }, { aufbau: 'bawue' }), 3, '401', { knoten: { palstek: '5', klampe: '5' } })
    expect(gesamt(stand, '401').knoten).toBe(10)
  })

  it('ohne Knoten-Liste im Aufbau gibt es keine Knoten-Spalte', () => {
    expect(ergebnis(gefahren({ '401': [70, 70, 90] })).gesamt.mitKnoten).toBe(false)
  })
})
