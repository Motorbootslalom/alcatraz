import { beforeAll, describe, expect, it } from 'vitest'
import { setLocale } from '../i18n'
import { configFor } from '../config/konfig'
import type { ClassId, Starter } from '../types'
import { feldVon, laufSchluessel, listenLauf, setzeWerte, verborgeneZellen } from './eingaben'
import {
  abstaende,
  ergebnisGruppen,
  klassenErgebnis,
  laeufeLautRegelwerk,
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
  const titel = (aufbau: string, klasse: string) => ergebnisGruppen(konfig, { aufbau }, klasse).map((g) => g.label)

  it('folgt für Klasse 4 der Liste der DM', () => {
    expect(titel('alcatraz', '4')).toEqual(['Steg AB', 'Start', '1 H', '2 H', '3 H', '4 H', '5', '4 R', '3 R', '2 R', 'MüB', 'Ziel', 'Steg AN'])
    const tor5 = ergebnisGruppen(konfig, { aufbau: 'alcatraz' }, '4').find((g) => g.label === '5')!
    expect(tor5.blaetter.map((b) => b.label)).toEqual(['L', 'R', 'E', 'L', 'R'])
  })

  it('zeigt je Klasse nur, was sie fährt', () => {
    expect(titel('alcatraz', '3')).toEqual(['Steg AB', 'Start', '1 H', '2 H', '3 H', '4 H', '5', '4 R', '3 R', '2 R', '1 R', 'Ziel', 'Steg AN'])
    expect(titel('alcatraz', '5')).toContain('S1')
    expect(titel('alcatraz', '5')).not.toContain('S2')
    expect(titel('alcatraz', '7').filter((t) => t === '1 R')).toHaveLength(2)
    expect(titel('alcatraz', '7').slice(-8)).toEqual(['2 R', '1 R', 'MüB', 'S1', 'S2', '1 R', 'Ziel', 'Steg AN'])
  })

  it('nennt die Bojen immer R und L, egal welche Bezeichnung und Sprache die Bögen haben', () => {
    const standard = ergebnisGruppen(konfig, { aufbau: 'alcatraz' }, '7')
    for (const { id } of konfig.getBeschriftungen()) expect(ergebnisGruppen(configFor({ beschriftung: id }), { aufbau: 'alcatraz' }, '7'), id).toEqual(standard)
    // Die Bögen selbst tragen die gewählte Bezeichnung.
    const koepfe = configFor({ beschriftung: 'ls' }).getSheetDef('gate135').columns.flatMap((c) => c.sub ?? [])
    expect(koepfe.length).toBeGreaterThan(0)
    expect(koepfe.every((k) => /[LS]$/.test(k))).toBe(true)
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
    // Ohne Streichlauf ist die Disqualifikation nicht zu streichen: hinten statt offen.
    expect(gesamt({ ...stand, streichlaeufe: 0 }, '401')).toMatchObject({ offen: false, disq: true, platz: 2, gestrichen: [] })
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

  it('Zwischenstand: Eine Disqualifikation steht hinten, bis der Streichlauf sie aufnimmt', () => {
    // 3 Läufe, einer wird gestrichen. Nach zwei Läufen zählen beide – 401 fehlt ein gültiger
    // Lauf: hinten wie in der Liste des Laufs, nicht auf Platz 1 bei den Nachholern.
    const zwei = gefahren({ '401': [null, 60], '402': [90, 90], '403': [95, 95] })
    expect(gesamt(zwei, '401')).toMatchObject({ disq: true, offen: false, ergebnis: null, platz: 3, gestrichen: [] })
    expect(gesamt(zwei, '402')).toMatchObject({ ergebnis: 18000, platz: 1 })
    expect(gesamt(zwei, '403')).toMatchObject({ platz: 2 })
    // Nach dem dritten Lauf ist der disqualifizierte gestrichen und 401 gewertet.
    const drei = gefahren({ '401': [null, 60, 60], '402': [90, 90, 90], '403': [95, 95, 95] })
    expect(gesamt(drei, '401')).toMatchObject({ disq: false, offen: false, ergebnis: 12000, platz: 1, gestrichen: [1] })
    expect(gesamt(drei, '402').platz).toBe(2)
    expect(gesamt(drei, '403').platz).toBe(3)
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
    // Mit der ersten Zeit (oder einer Disqualifikation aus der Fahrt) ist der Lauf gefahren.
    expect(ergebnis(laufMitZeiten(stand, 3, { '401': 81 })).gesamt.laeufe).toEqual([1, 2, 3])
    expect(ergebnis(eintragen(stand, 3, '401', { parcours: { disq: 'J' } })).gesamt.laeufe).toEqual([1, 2, 3])
    // Ein X „Nicht gestartet“ allein nicht: Es wird oft eingetragen, bevor der Lauf beginnt.
    expect(ergebnis(eintragen(stand, 3, '401', { vorsteg: { disq: 'X' } })).gesamt.laeufe).toEqual([1, 2])
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

  it('gehören nach den Regeln zu jedem Aufbau: Die Liste kommt als Vorgabe des Regelwerks dazu', () => {
    // Alcatraz nennt die Knoten nicht selbst.
    expect(konfig.getAufbau('alcatraz').order).not.toContain('knoten')
    let stand = gefahren({ '401': [70, 70, 90], '402': [71, 71, 90] })
    expect(ergebnis(stand).gesamt.mitKnoten).toBe(true)
    stand = eintragen(stand, 1, '401', { knoten: { palstek: '5' } })
    expect(gesamt(stand, '401')).toMatchObject({ knoten: 5, ergebnis: 14000, gesamt: 14500 })
    expect(reihenfolge(ergebnis(stand).gesamt.nachPlatz)).toEqual(['402', '401'])
  })

  it('abgewählt gibt es keine Knoten-Spalte, und schon erfasste Knoten zählen nicht', () => {
    const stand = { ...eintragen(gefahren({ '401': [70, 70, 90] }), 1, '401', { knoten: { palstek: '5' } }), zusatzListen: { knoten: false } }
    expect(ergebnis(stand).gesamt.mitKnoten).toBe(false)
    expect(gesamt(stand, '401')).toMatchObject({ knoten: 0, gesamt: 14000 })
  })

  it('UIM: Knoten gehören zum Manövrieren (Regel 960, Pkt. 4.3) und zählen zum besten Versuch (Pkt. 5.2.1)', () => {
    const uim = configFor({ regelwerk: 'uim-2026' })
    expect(uim.getRegelwerk().vorgabeListen).toEqual({ manoevrieren: ['knoten'] })
    const basis = { ...gefahren({ '401': [70, 80], '402': [72, 90] }), regelwerk: 'uim-2026', laufCount: 2, streichlaeufe: 1 as const }
    const stand = eintragen(basis, 1, '401', { knoten: { palstek: '5' } })
    const liste = klassenErgebnis(stand, uim, '4')!.gesamt
    expect(liste.mitKnoten).toBe(true)
    // 401: bester Versuch 70 s + 5 s Knoten = 75 s; 402: 72 s.
    expect(liste.nachPlatz.map((z) => [z.starter.startNr, z.gesamt])).toEqual([['402', 7200], ['401', 7500]])
  })
})

describe('Entscheidung: n noch nicht Gefahrene stehen auf Platz 1, der beste Gefahrene auf Platz n + 1', () => {
  const nummern = (n: number) => Array.from({ length: n }, (_, i) => String(401 + i))

  it.each([3, 10])('Liste eines Laufs mit %i Offenen', (n) => {
    // Die letzten beiden sind gefahren, alle davor noch nicht.
    const alle = nummern(n + 2)
    const [besser, schlechter] = alle.slice(-2)
    const { nachPlatz } = ergebnis(laufMitZeiten(basis(alle), 1, { [besser]: 70, [schlechter]: 80 })).laeufe[0]
    expect(nachPlatz.slice(0, n).map((z) => [z.platz, z.offen, z.zeit])).toEqual(Array.from({ length: n }, () => [1, true, null]))
    expect(nachPlatz.slice(n).map((z) => [nr(z), z.platz])).toEqual([[besser, n + 1], [schlechter, n + 2]])
  })

  it.each([3, 10])('Gesamtliste mit %i Offenen', (n) => {
    const alle = nummern(n + 2)
    const [besser, schlechter] = alle.slice(-2)
    // Der erste Lauf ist für alle gefahren; den zweiten holen n Starter noch nach.
    let stand = laufMitZeiten(basis(alle), 1, Object.fromEntries(alle.map((nummer) => [nummer, 75])))
    stand = laufMitZeiten(stand, 2, { [besser]: 70, [schlechter]: 80 })
    const { nachPlatz } = ergebnis(stand).gesamt
    expect(nachPlatz.slice(0, n).map((z) => [z.platz, z.offen, z.gesamt])).toEqual(Array.from({ length: n }, () => [1, true, null]))
    expect(nachPlatz.slice(n).map((z) => [nr(z), z.platz])).toEqual([[besser, n + 1], [schlechter, n + 2]])
  })

  it('ein x (nicht gestartet) zählt nicht zu den Offenen: Es steht hinten', () => {
    let stand = laufMitZeiten(basis(nummern(5)), 1, { '404': 70 })
    stand = eintragen(stand, 1, '405', { steg: { disq: 'X' } })
    expect(ergebnis(stand).laeufe[0].nachPlatz.map((z) => [nr(z), z.platz])).toEqual([['401', 1], ['402', 1], ['403', 1], ['404', 4], ['405', 5]])
  })
})

describe('Läufe laut Regelwerk', () => {
  const uim = configFor({ regelwerk: 'uim-2026' }).getRegelwerk()
  it('UIM 960, Pkt. 4.3.2: zwei Versuche, der bessere zählt – die Angabe steht im Regelwerk', () => {
    expect(uim.wertungslaeufe).toEqual({ laeufe: 2, streichlaeufe: 1 })
    expect(konfig.getRegelwerk().wertungslaeufe).toBeUndefined()
  })
  it('gemeldet wird nur die Abweichung', () => {
    expect(laeufeLautRegelwerk(uim, { laufCount: 2, streichlaeufe: 1 })).toBeNull()
    expect(laeufeLautRegelwerk(uim, { laufCount: 2, streichlaeufe: 'auto' })).toEqual({ laeufe: 2, streichlaeufe: 1 })
    expect(laeufeLautRegelwerk(uim, { laufCount: 3, streichlaeufe: 'auto' })).toEqual({ laeufe: 2, streichlaeufe: 1 })
    expect(laeufeLautRegelwerk(konfig.getRegelwerk(), { laufCount: 5, streichlaeufe: 0 })).toBeNull()
  })
})

describe('Entscheidung: X „Nicht gestartet“ steht auch in der Gesamtliste hinten, nicht bei den Offenen', () => {
  const x = (stand: ErgebnisStand, lauf: number, nummer: string, liste = 'vorsteg') => eintragen(stand, lauf, nummer, { [liste]: { disq: 'X' } })
  const plaetze = (stand: ErgebnisStand) => ergebnis(stand).gesamt.nachPlatz.map((z) => [nr(z), z.platz])

  it('nach dem 1. Lauf: drei Offene auf Platz 1, der Gefahrene auf Platz 4, das X dahinter', () => {
    let stand = laufMitZeiten(basis(['401', '402', '403', '407', '408']), 1, { '408': 60 })
    stand = x(stand, 1, '407')
    expect(plaetze(stand)).toEqual([['401', 1], ['402', 1], ['403', 1], ['408', 4], ['407', 5]])
    expect(gesamt(stand, '407')).toMatchObject({ disq: true, offen: false, gesamt: null })
    // Die Gesamtliste folgt damit der Liste des Laufs.
    expect(ergebnis(stand).laeufe[0].nachPlatz.map((z) => [nr(z), z.platz])).toEqual(plaetze(stand))
  })

  it('während des 2. Laufs: drei Offene, ein X, zwei Gefahrene – Platz 1, 1, 1, 4, 5 und das X auf 6', () => {
    const alle = ['401', '402', '403', '404', '405', '406']
    let stand = laufMitZeiten(basis(alle), 1, Object.fromEntries(alle.map((n) => [n, 75])))
    stand = laufMitZeiten(stand, 2, { '405': 70, '406': 80 })
    stand = x(stand, 2, '402', 'steg')
    expect(plaetze(stand)).toEqual([['401', 1], ['403', 1], ['404', 1], ['405', 4], ['406', 5], ['402', 6]])
    // Der nicht gestartete Lauf ist (noch) nicht gestrichen: Im Zwischenstand zählen beide.
    expect(gesamt(stand, '402')).toMatchObject({ disq: true, gestrichen: [] })
  })

  it('am Ende nimmt der Streichlauf das X auf: gewertet mit den beiden gültigen Läufen', () => {
    let stand = gefahren({ '401': [70, undefined, 72], '402': [80, 81, 82] })
    stand = x(stand, 2, '401')
    expect(gesamt(stand, '401')).toMatchObject({ disq: false, offen: false, gestrichen: [2], ergebnis: 14200, platz: 1 })
  })

  it('ein X nur im 1. Lauf, die übrigen Läufe leer: Die leeren gelten als „holt nach“ – das X gehört in jeden Lauf', () => {
    let stand = gefahren({ '401': [undefined, undefined, undefined], '402': [80, 81, 82], '403': [90, 91, 92] })
    stand = x(stand, 1, '401')
    expect(gesamt(stand, '401')).toMatchObject({ offen: true, disq: false, platz: 1 })
    // In jedem Lauf eingetragen, steht der Abgereiste hinten.
    stand = x(x(stand, 2, '401'), 3, '401')
    expect(plaetze(stand)).toEqual([['402', 1], ['403', 2], ['401', 3]])
  })

  it('ein X im Voraus für alle Läufe macht die späteren Läufe nicht „gefahren“: Die Zwischenwertung bleibt', () => {
    let stand = laufMitZeiten(basis(['401', '402', '403']), 1, { '402': 80, '403': 70 })
    stand = x(x(x(stand, 1, '401'), 2, '401'), 3, '401')
    const { gesamt: g, laeufe } = ergebnis(stand)
    expect(laeufe.map((l) => l.lauf)).toEqual([1, 2, 3])
    expect(g.laeufe).toEqual([1])
    expect(plaetze(stand)).toEqual([['403', 1], ['402', 2], ['401', 3]])
    // Beginnt der 2. Lauf, sind die anderen offen – der Abgereiste bleibt hinten.
    stand = laufMitZeiten(stand, 2, { '403': 71 })
    expect(plaetze(stand)).toEqual([['402', 1], ['403', 2], ['401', 3]])
    expect(gesamt(stand, '401')).toMatchObject({ disq: true, offen: false })
  })

  it('hat in der Klasse niemand eine Zeit, steht das X trotzdem hinten', () => {
    const stand = x(basis(['401', '402']), 1, '402')
    expect(plaetze(stand)).toEqual([['401', 1], ['402', 2]])
  })
})

describe('Entscheidung: Stichentscheid bei Punktgleichheit – die Regel steht im Regelwerk', () => {
  const uim = configFor({ regelwerk: 'uim-2026' })
  const plaetze = (zeilen: Array<{ starter: Starter; platz: number; stich: boolean }>) => zeilen.map((z) => [nr(z), z.platz, z.stich])
  /** Strafpunkte an einer Boje. */
  const strafe = (stand: ErgebnisStand, lauf: number, nummer: string, punkte: number) => eintragen(stand, lauf, nummer, { gate135: { 't1a#0': String(punkte) } })

  it('DM nennt den schnellsten gewerteten Lauf, die UIM die Summe aller Versuche', () => {
    expect(konfig.getRegelwerk().stichentscheid).toEqual(['schnellsterLauf'])
    expect(uim.getRegelwerk().stichentscheid).toEqual(['summeAllerLaeufe'])
  })

  describe('DM: der schnellste gewertete Lauf', () => {
    it('Liste eines Laufs: Bei gleichen Punkten steht vorn, wer schneller gefahren ist', () => {
      // Alle 80,00 Punkte: 401 = 80 s, 402 = 70 s + 10, 403 = 75 s + 5, 404 = 80 s.
      let stand = laufMitZeiten(basis(['401', '402', '403', '404', '405']), 1, { '401': 80, '402': 70, '403': 75, '404': 80, '405': 79 })
      stand = strafe(strafe(stand, 1, '402', 10), 1, '403', 5)
      const { nachPlatz, nachNummer } = ergebnis(stand).laeufe[0]
      // 401 und 404 trennt auch die Zeit nicht: geteilter Platz, der nächste entfällt.
      expect(plaetze(nachPlatz)).toEqual([
        ['405', 1, false],
        ['402', 2, true],
        ['403', 3, true],
        ['401', 4, true],
        ['404', 4, true],
      ])
      expect(nachPlatz.slice(1).map((z) => z.gesamt)).toEqual([8000, 8000, 8000, 8000])
      // Dieselben Plätze stehen in der Liste nach Startnummer.
      expect(plaetze(nachNummer)).toEqual([['401', 4, true], ['402', 2, true], ['403', 3, true], ['404', 4, true], ['405', 1, false]])
    })

    it('ohne Gleichstand entscheidet nichts: Niemand ist „im Stich“', () => {
      const stand = laufMitZeiten(basis(['401', '402']), 1, { '401': 80, '402': 70 })
      expect(plaetze(ergebnis(stand).laeufe[0].nachPlatz)).toEqual([['402', 1, false], ['401', 2, false]])
    })

    it('gleiche Punkte und gleiche Zeit: geteilter Platz, nach Startnummer', () => {
      const stand = laufMitZeiten(basis(['402', '401', '403']), 1, { '401': 70, '402': 70, '403': 90 })
      expect(plaetze(ergebnis(stand).laeufe[0].nachPlatz)).toEqual([['401', 1, false], ['402', 1, false], ['403', 3, false]])
    })

    it('Gesamtliste: Bei gleicher Summe entscheidet die kürzeste gefahrene Zeit unter den gewerteten Läufen', () => {
      // Alle 160,00 aus zwei gewerteten Läufen; der dritte ist gestrichen.
      const stand = gefahren({ '401': [80, 80, 85], '402': [78, 82, 90], '403': [79, 81, 95] })
      expect(ergebnis(stand).gesamt.nachPlatz.map((z) => [nr(z), z.platz, z.gesamt, z.stich])).toEqual([
        ['402', 1, 16000, true],
        ['403', 2, 16000, true],
        ['401', 3, 16000, true],
      ])
    })

    it('Gesamtliste: Ein gestrichener Lauf entscheidet nicht, auch wenn er der schnellste war', () => {
      // 402 fuhr im 3. Lauf 60 s, aber mit 40 Strafpunkten: 100 Punkte, gestrichen.
      let stand = gefahren({ '401': [80, 80, 99], '402': [80, 80, 60] })
      stand = strafe(stand, 3, '402', 40)
      expect(gesamt(stand, '402').gestrichen).toEqual([3])
      expect(plaetze(ergebnis(stand).gesamt.nachPlatz)).toEqual([['401', 1, false], ['402', 1, false]])
    })

    it('Gesamtliste: Es zählt die gefahrene Zeit, nicht das Ergebnis des Laufs', () => {
      // Beide 160,00. 401: 70 s + 10 und 80 s; 402: 75 s und 85 s. Schnellster Lauf: 401 mit 70 s.
      let stand = gefahren({ '401': [70, 80, 99], '402': [75, 85, 99] })
      stand = strafe(stand, 1, '401', 10)
      expect(plaetze(ergebnis(stand).gesamt.nachPlatz)).toEqual([['401', 1, true], ['402', 2, true]])
    })

    it('Gesamtliste: Der Stichentscheid ändert nichts an Offenen (Platz 1) und Disqualifizierten (hinten)', () => {
      const stand = gefahren({ '401': [80, 80, 85], '402': [78, 82, 90], '403': [70, undefined, 70], '404': [null, null, 70] })
      expect(plaetze(ergebnis(stand).gesamt.nachPlatz)).toEqual([['403', 1, false], ['402', 2, true], ['401', 3, true], ['404', 4, false]])
    })
  })

  describe('UIM 960, Pkt. 5.2.6: Manövrieren', () => {
    const zweiVersuche = { laufCount: 2, streichlaeufe: 1 } as const
    const uimErgebnis = (stand: ErgebnisStand) => klassenErgebnis(stand, uim, '4')!

    it('gleicher bester Versuch: Die bessere Summe beider Versuche steht vorn', () => {
      const stand = gefahren({ '401': [50, 60], '402': [55, 50], '403': [50, 60], '404': [49, 70] }, zweiVersuche)
      const { nachPlatz } = uimErgebnis(stand).gesamt
      expect(nachPlatz.map((z) => [nr(z), z.platz, z.gesamt, z.stich])).toEqual([
        ['404', 1, 4900, false],
        ['402', 2, 5000, true], // 105
        ['401', 3, 5000, true], // 110
        ['403', 3, 5000, true], // 110 – auch die Summe trennt nicht: geteilter Platz
      ])
    })

    it('wer nur einen gültigen Versuch hat, steht bei Gleichstand dahinter', () => {
      const stand = gefahren({ '401': [50, null], '402': [50, 90], '403': [null, 50] }, zweiVersuche)
      expect(plaetze(uimErgebnis(stand).gesamt.nachPlatz)).toEqual([['402', 1, true], ['401', 2, true], ['403', 2, true]])
    })

    it('die Summe zählt die Fahrstrafen beider Versuche', () => {
      // Bester Versuch je 50,00. Zweiter Versuch: 401 = 60 s, 402 = 55 s + 10 Strafsekunden.
      let stand = gefahren({ '401': [50, 60], '402': [50, 55] }, zweiVersuche)
      stand = strafe(stand, 2, '402', 10)
      expect(plaetze(uimErgebnis(stand).gesamt.nachPlatz)).toEqual([['401', 1, true], ['402', 2, true]])
    })

    it('Knoten gehören zum Ergebnis, aber zu keinem Versuch: Die Summe zählt sie nicht', () => {
      // 401: bester Versuch 50 + 5 Knoten = 55, Summe 50 + 70 = 120. 402: bester 55, Summe 55 + 60 = 115.
      let stand = gefahren({ '401': [50, 70], '402': [55, 60] }, { ...zweiVersuche, aufbau: 'bawue' })
      stand = eintragen(stand, 1, '401', { knoten: { palstek: '5' } })
      const { nachPlatz } = uimErgebnis(stand).gesamt
      expect(nachPlatz.map((z) => [nr(z), z.platz, z.gesamt])).toEqual([['402', 1, 5500], ['401', 2, 5500]])
    })

    it('für den einzelnen Versuch nennt die Regel nichts: Gleiche Punkte teilen sich den Platz', () => {
      let stand = laufMitZeiten(basis(['401', '402'], zweiVersuche), 1, { '401': 80, '402': 70 })
      stand = strafe(stand, 1, '402', 10)
      expect(plaetze(uimErgebnis(stand).laeufe[0].nachPlatz)).toEqual([['401', 1, false], ['402', 1, false]])
    })
  })

  it('ohne Angabe im Regelwerk teilen sich Punktgleiche den Platz; „besterLauf“ nimmt das Ergebnis des Laufs', () => {
    let stand = gefahren({ '401': [70, 80, 99], '402': [75, 85, 99] })
    stand = strafe(stand, 1, '401', 10) // 401: 80 + 80, 402: 75 + 85
    const mit = (stichentscheid: Array<'besterLauf' | 'schnellsterLauf' | 'summeAllerLaeufe'>) =>
      klassenErgebnis(stand, { ...konfig, getRegelwerk: () => ({ ...konfig.getRegelwerk(), stichentscheid }) }, '4')!.gesamt.nachPlatz
    expect(plaetze(mit([]))).toEqual([['401', 1, false], ['402', 1, false]])
    expect(plaetze(mit(['besterLauf']))).toEqual([['402', 1, true], ['401', 2, true]])
    // Der Reihe nach: Trennt das erste Kriterium nicht, gilt das nächste.
    expect(plaetze(mit(['summeAllerLaeufe', 'besterLauf']))).toEqual([['402', 1, true], ['401', 2, true]])
  })
})
