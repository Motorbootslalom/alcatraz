import type { RawDisziplin, StichKriterium } from '../config/schema'
import type { AppState, ClassId, Starter, Streichlaeufe } from '../types'
import { columnsForClass } from './bogen'
import { codeEntries, parseCodeEntry } from './codes'
import { felderJeKennung, laufSchluessel, OHNE_LAUF, vergleicheNr, werteVon, type EingabenKonfig, type Feld } from './eingaben'
import { bojenWert, codeDisqs, disqCodes, errorParts } from './scoring'
import { parseTime } from './time'
import { veranstaltungsListen, type ListenWahl } from './listen'

// Ergebnislisten aus den Eingaben – rein, ohne DOM. Vorbild: lib/ergebnis.ts im
// Fehlerpunkte-Prototyp, nachgebaut nach den Auswertungs-Listen der DM 2026.
//
// Lauf: Die Zeit ist die der elektronischen Zeiterfassung, ohne sie der Mittelwert der
// Stoppuhren. Eine Sekunde zählt einen Punkt, dazu die Strafpunkte. Bei gleichen Punkten
// entscheidet der Stichentscheid des Regelwerks (siehe unten); erst wenn auch er nichts
// trennt, teilen sich die Starter den Platz. Drei Fälle je Starter:
//   • gewertet        – Zeit vorhanden, keine Disqualifikation.
//   • offen           – noch keine Zeit und keine Disqualifikation: „noch nicht gefahren“.
//                       Steht ohne Zeit auf Platz 1 (Entscheidung des Nutzers, wie in der
//                       Excel-Mappe): Wer nachholt, wird danach einsortiert – die anderen
//                       können dadurch nur aufrücken, nie abrutschen.
//   • disqualifiziert – ein Disq-Buchstabe irgendwo im Lauf, auch X „Nicht gestartet“
//                       (am Steg oder Vorsteg eingetragen). Steht ohne Punkte hinter allen.
//
// Gesamt: Gewertet werden die Läufe, in denen in der Klasse schon jemand gefahren ist: eine
// Zeit oder eine Disqualifikation aus der Fahrt. Haken und Fehlerpunkte allein machen noch
// keinen gefahrenen Lauf, ein X „Nicht gestartet“ auch nicht – es lässt sich im Voraus
// eintragen (der Starter ist abgereist) und setzte sonst die ganze Klasse auf „offen“.
// Am Ende zählen `laufCount − Streichläufe` Läufe; solange weniger gefahren sind, wird nichts
// gestrichen. Gestrichen werden zuerst disqualifizierte Läufe, dann die schlechtesten (bei
// Gleichstand der frühere). Disqualifiziert (letzter Platz) ist, wer mehr disqualifizierte
// Läufe hat, als beim jetzigen Stand gestrichen werden – auch im Zwischenstand: Ein X oder
// eine Disqualifikation steht hinten, bis der Streichlauf sie aufnimmt (Entscheidung des
// Nutzers: „X und nicht gestartet“ ist etwas anderes als „leer und oben“). Auf Platz 1 ohne
// Ergebnis steht nur, wer einen gewerteten Lauf noch nachholt (leere Zeile) – n solche
// Starter, und der beste Gefahrene hat Platz n + 1. Knoten zählen zusätzlich.
//
// Stichentscheid: Was bei gleichem Ergebnis entscheidet, steht im Regelwerk (`stichentscheid`
// in config/regelwerke/*.yaml), nicht hier – DM und UIM regeln es verschieden. Die Kriterien
// gelten der Reihe nach, für die Liste eines Laufs wie für die Gesamtliste:
//   • schnellsterLauf   – die kürzeste gefahrene Zeit unter den gewerteten (nicht gestrichenen)
//                         Läufen. In der Liste eines Laufs ist das seine gefahrene Zeit.
//   • besterLauf        – das beste Ergebnis (Zeit und Strafpunkte) unter den gewerteten Läufen.
//   • summeAllerLaeufe  – die Summe aller Läufe der Liste mit ihren Strafpunkten, auch der
//                         gestrichenen; wer nicht in jedem ein gültiges Ergebnis hat, steht
//                         dahinter (UIM 960, Pkt. 5.2.6).
// Die entscheidenden Werte stehen ohnehin auf der Liste (gefahrene Zeit, Ergebnis je Lauf).
//
// Punkte stehen als ganze Hundertstel in den Zeilen, damit nichts durch Rundung kippt.

/** Was die Wertung von der Konfiguration braucht (config/konfig.ts `Konfig`). */
export interface ErgebnisKonfig extends EingabenKonfig {
  getDisziplin(id: string): RawDisziplin
  /** Der Stichentscheid des Regelwerks; fehlt die Angabe, teilen sich Punktgleiche den Platz. */
  getRegelwerk?(): { stichentscheid?: readonly StichKriterium[]; vorgabeListen?: Readonly<Record<string, readonly string[]>> }
}

export type ErgebnisStand = ListenWahl & Pick<AppState, 'eingaben' | 'starters' | 'laufCount' | 'streichlaeufe'>

/** Eine Zelle je Zeile: die Punkte und Buchstaben ihrer Felder. */
export interface ErgebnisBlatt {
  label: string
  felder: string[]
}

export interface ErgebnisGruppe {
  label: string
  blaetter: ErgebnisBlatt[]
  /** Kopf zweizeilig: Gruppe und darunter die Kürzel der Blätter. */
  mitUnter: boolean
}

/** Wie ein Starter in einer Liste steht, siehe oben. */
export type Wertung = 'gewertet' | 'offen' | 'disq'

export interface LaufZeile {
  starter: Starter
  /** Gefahrene Zeit in Hundertstel; null = keine eingetragen. */
  zeit: number | null
  strafpunkte: number
  /** Zeit + Strafpunkte in Hundertstel; null = disqualifiziert oder ohne Zeit. */
  gesamt: number | null
  disq: boolean
  /** Noch nicht gefahren: keine Zeit, keine Disqualifikation. */
  offen: boolean
  /** X „Nicht gestartet“ ist eingetragen. */
  nichtGestartet: boolean
  platz: number
  /** Punktgleich mit einem anderen – den Platz hat der Stichentscheid des Regelwerks bestimmt. */
  stich: boolean
  /** Inhalt je Blatt der Gruppen. */
  zellen: string[]
  /** Fehlercodes und Disq-Buchstaben, z. B. „3, 17, 18, J“. */
  schluessel: string
}

export interface LaufListe {
  klasse: ClassId
  lauf: number
  gruppen: ErgebnisGruppe[]
  nachNummer: LaufZeile[]
  nachPlatz: LaufZeile[]
}

export interface GesamtZeile {
  starter: Starter
  /** Je Lauf der Gesamtliste eine Zeile, in derselben Reihenfolge. */
  laeufe: LaufZeile[]
  /** Die gestrichenen Läufe. */
  gestrichen: number[]
  /** Summe der gewerteten Läufe; null = disqualifiziert oder noch offen. */
  ergebnis: number | null
  disq: boolean
  /** Noch kein vergleichbares Ergebnis: Ein Lauf der Wertung ist noch nicht gefahren (leere Zeile). */
  offen: boolean
  /** Knoten-Strafpunkte. */
  knoten: number
  gesamt: number | null
  platz: number
  /** Punktgleich mit einem anderen – den Platz hat der Stichentscheid des Regelwerks bestimmt. */
  stich: boolean
}

export interface GesamtListe {
  klasse: ClassId
  laeufe: number[]
  /** So viele Läufe sind beim jetzigen Stand je Starter gestrichen. */
  streichen: number
  /** Der Aufbau hat für die Klasse eine Liste ohne Lauf (Knoten): Die Spalte wird gezeigt. */
  mitKnoten: boolean
  nachNummer: GesamtZeile[]
  nachPlatz: GesamtZeile[]
}

export interface KlassenErgebnis {
  klasse: ClassId
  laeufe: LaufListe[]
  gesamt: GesamtListe
}

type Werte = Readonly<Record<string, string>>

/** Die Bojen heißen hier immer R und L: Andere Bezeichnungen dienen nur den WKR zur Orientierung am Parcours. */
const BOJEN_SEITE: Record<string, string> = { seiteA: 'R', seiteB: 'L' }

/** Abstand in den Ergebnislisten: zum nächstbesseren Ergebnis oder zum Ersten. */
export type AbstandArt = 'davor' | 'erster'

/**
 * Der Abstand jeder Zeile in Hundertstel, in derselben Reihenfolge: zum nächstbesseren
 * Ergebnis (bei Gleichstand zum nächsten, das wirklich besser ist) oder zum Ersten. Leer
 * (null) beim Ersten, bei Disqualifizierten und bei Startern ohne Ergebnis.
 */
export function abstaende(zeilen: ReadonlyArray<{ gesamt: number | null; disq: boolean }>, art: AbstandArt): Array<number | null> {
  const werte = zeilen.filter((z) => !z.disq && z.gesamt !== null).map((z) => z.gesamt!)
  const bester = Math.min(...werte)
  return zeilen.map((z) => {
    if (z.disq || z.gesamt === null) return null
    const besser = werte.filter((w) => w < z.gesamt!)
    if (besser.length === 0) return null
    return z.gesamt - (art === 'erster' ? bester : Math.max(...besser))
  })
}

/**
 * So viele Läufe werden je Starter gestrichen, wenn `gefahren` Läufe in der Wertung sind.
 * Am Ende zählen `laufCount − Streichläufe`; vorher wird nichts gestrichen, was noch zählen
 * könnte (zwei von drei gefahren → beide zählen).
 */
export function streichZahl(laufCount: number, streichlaeufe: Streichlaeufe, gefahren: number): number {
  return Math.max(0, gefahren - (laufCount - streichlaeufeVon(laufCount, streichlaeufe)))
}

/** Die geltende Zahl der Streichläufe: `auto` = ab drei Läufen einer; nie mehr als `laufCount − 1`. */
export function streichlaeufeVon(laufCount: number, streichlaeufe: Streichlaeufe): number {
  const gewuenscht = streichlaeufe === 'auto' ? (laufCount >= 3 ? 1 : 0) : streichlaeufe
  return Math.max(0, Math.min(Math.max(1, laufCount) - 1, Math.round(gewuenscht) || 0))
}

/**
 * Was das Regelwerk an Läufen und Streichläufen vorsieht, wenn die Veranstaltung anders
 * eingestellt ist; sonst null (auch wenn das Regelwerk nichts vorgibt). Gewertet wird immer
 * das Eingestellte – der Rennleiter entscheidet –, die Oberfläche weist nur darauf hin: Unter
 * UIM zählte mit „Streichläufe nach Regel“ sonst die Summe beider Versuche statt des besseren.
 */
export function laeufeLautRegelwerk(
  regelwerk: { wertungslaeufe?: { laeufe: number; streichlaeufe: number } },
  stand: Pick<AppState, 'laufCount' | 'streichlaeufe'>,
): { laeufe: number; streichlaeufe: number } | null {
  const soll = regelwerk.wertungslaeufe
  if (!soll) return null
  const laeufe = Math.max(1, stand.laufCount)
  return soll.laeufe === laeufe && soll.streichlaeufe === streichlaeufeVon(laeufe, stand.streichlaeufe) ? null : soll
}

/** Die Spalten der Ergebnisliste: Felder, die es im Aufbau für die Klasse nicht gibt, entfallen. */
export function ergebnisGruppen(konfig: ErgebnisKonfig, wahl: ListenWahl, klasse: string): ErgebnisGruppe[] {
  const aufbau = wahl.aufbau
  const kuerzel = new Map<string, string>()
  for (const typeId of veranstaltungsListen(konfig, wahl)) {
    if (!konfig.positionAllowsClass(typeId, klasse)) continue
    for (const col of columnsForClass(konfig.getSheetDef(typeId).columns, klasse)) {
      // Kennung „t1a|hin seiteA“: Das letzte Wort ist die Bojen-Seite.
      col.felder?.forEach((feld) => kuerzel.set(feld, BOJEN_SEITE[feld.split(' ').pop() ?? ''] ?? col.label))
    }
  }
  return (konfig.getDisziplin(konfig.getAufbau(aufbau).disziplin).ergebnisspalten ?? []).flatMap((sp): ErgebnisGruppe[] => {
    if (sp.unter) {
      const blaetter = sp.unter
        .map((u) => (typeof u === 'string' ? { feld: u, label: kuerzel.get(u) ?? '' } : u))
        .filter((u) => kuerzel.has(u.feld))
        .map((u) => ({ label: u.label, felder: [u.feld] }))
      return blaetter.length > 0 ? [{ label: sp.label, blaetter, mitUnter: true }] : []
    }
    const felder = (sp.felder ?? []).filter((f) => kuerzel.has(f))
    return felder.length > 0 ? [{ label: sp.label, blaetter: [{ label: sp.label, felder }], mitUnter: false }] : []
  })
}

/** Was eine Zeile eines Laufs ergibt: Punkte und Buchstaben einer Menge von Feldern. */
function bewerte(werte: Werte, kennungen: Iterable<string>, felder: Map<string, Feld>): { punkte: number; disqs: string[]; codes: string[] } {
  let punkte = 0
  const disqs: string[] = []
  const codes: string[] = []
  for (const kennung of kennungen) {
    const wert = werte[kennung]
    const feld = felder.get(kennung)
    if (!wert || !feld) continue
    if (feld.kind === 'buoy') {
      const boje = bojenWert(wert)
      punkte += boje.punkte
      if (boje.disq) disqs.push(boje.disq)
    } else if (feld.kind === 'code') {
      punkte += errorParts(feld.katalog, wert).reduce((s, p) => s + p.anzahl * p.punkte, 0)
      disqs.push(...codeDisqs(wert))
      codes.push(...codeEntries(wert).filter((e) => parseCodeEntry(e)))
    } else if (feld.kind === 'points') {
      punkte += parseInt(wert, 10) || 0
    } else if (feld.kind === 'disq') {
      disqs.push(...disqCodes(wert))
    }
  }
  return { punkte, disqs, codes }
}

/**
 * Die Zeit eines Laufs, auf Hundertstel gerundet: die elektronische Zeiterfassung, ohne sie der
 * Mittelwert der Stoppuhren. Zeitspalten ohne Gerät zählen als Stoppuhr.
 */
export function mittlereZeit(werte: Werte, felder: Map<string, Feld>): number | null {
  const zeiten = Object.entries(werte).flatMap(([kennung, wert]) => {
    const feld = felder.get(kennung)
    const zeit = feld?.kind === 'time' ? parseTime(wert) : null
    return zeit ? [{ centis: zeit.centis, elektronisch: feld?.geraet === 'elektronisch' }] : []
  })
  const elektronisch = zeiten.filter((z) => z.elektronisch)
  const gewertet = elektronisch.length > 0 ? elektronisch : zeiten
  return gewertet.length > 0 ? Math.round(gewertet.reduce((a, z) => a + z.centis, 0) / gewertet.length) : null
}

/** „J“ oder „5, J“: die Punkte einer Zelle, dahinter ihre Buchstaben. */
function zellText(punkte: number, disqs: string[]): string {
  return [...(punkte > 0 ? [String(punkte)] : []), ...[...new Set(disqs)].sort()].join(', ')
}

/** Der Code eines Eintrags: „2x6“ → „6“. */
const codeVon = (eintrag: string) => parseCodeEntry(eintrag)?.code ?? eintrag

/** Fehler-Schlüssel in natürlicher Reihenfolge: die Codes der Zahl nach, dahinter die Buchstaben. */
function schluesselText(codes: string[], disqs: string[]): string {
  const sortiert = [...codes].sort((a, b) => vergleicheNr(codeVon(a), codeVon(b)))
  return [...sortiert, ...[...new Set(disqs)].sort()].join(', ')
}

const STUFE: Record<Wertung, number> = { offen: 0, gewertet: 1, disq: 2 }

/** In welchem der drei Fälle eine Zeile steht. */
export function wertungVon(z: { disq: boolean; gesamt: number | null }): Wertung {
  return z.disq ? 'disq' : z.gesamt === null ? 'offen' : 'gewertet'
}

/**
 * Der Schlüssel des Stichentscheids einer Zeile: je Kriterium Zahlen, kleiner ist besser,
 * verglichen wird der Reihe nach. `laeufe` sind alle Läufe der Liste, `gewertet` die davon
 * zählenden (nicht gestrichenen) mit gültigem Ergebnis.
 */
function stichSchluessel(kriterien: readonly StichKriterium[], laeufe: LaufZeile[], gewertet: LaufZeile[]): number[] {
  const kleinste = (werte: Array<number | null>) => Math.min(...werte.map((w) => w ?? Number.POSITIVE_INFINITY))
  return kriterien.flatMap((k) => {
    if (k === 'schnellsterLauf') return [kleinste(gewertet.map((l) => l.zeit))]
    if (k === 'besterLauf') return [kleinste(gewertet.map((l) => l.gesamt))]
    // UIM 960, Pkt. 5.2.6: erst wer in jedem Versuch ein gültiges Ergebnis hat, dann die Summe.
    const gueltig = laeufe.filter((l) => l.gesamt !== null)
    return [laeufe.length - gueltig.length, gueltig.reduce((s, l) => s + l.gesamt!, 0)]
  })
}

/** Der Reihe nach verglichen; negativ = `a` steht vorn. */
function vergleicheSchluessel(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    // Unendlich gegen unendlich (beide ohne Wert) ist gleich – die Differenz wäre NaN.
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return 0
}

/**
 * Sortiert und vergibt die Plätze: Offene zuerst (alle Platz 1), dann nach Punkten – der beste
 * Gewertete steht damit auf Platz „Zahl der Offenen + 1“ –, Disqualifizierte gemeinsam
 * dahinter. Bei gleichen Punkten entscheidet `schluessel` (der Stichentscheid des Regelwerks);
 * trennt auch er nichts, teilen sich die Zeilen den Platz und stehen nach Startnummer.
 */
function platziert<T extends { starter: Starter; gesamt: number | null; disq: boolean; platz: number; stich: boolean }>(zeilen: T[], schluessel: (z: T) => number[]): T[] {
  const stufe = (z: T) => STUFE[wertungVon(z)]
  const offene = zeilen.filter((z) => stufe(z) === 0).length
  const gewertet = zeilen.filter((z) => stufe(z) === 1)
  const stich = new Map(gewertet.map((z) => [z, schluessel(z)]))
  const imStich = (a: T, b: T) => vergleicheSchluessel(stich.get(a)!, stich.get(b)!)
  const vergleiche = (a: T, b: T) => a.gesamt! - b.gesamt! || imStich(a, b)
  return [...zeilen]
    .sort((a, b) => stufe(a) - stufe(b) || (stufe(a) === 1 ? vergleiche(a, b) : 0) || vergleicheNr(a.starter.startNr, b.starter.startNr))
    .map((z) => ({
      ...z,
      platz: stufe(z) === 0 ? 1 : stufe(z) === 1 ? offene + 1 + gewertet.filter((g) => vergleiche(g, z) < 0).length : offene + gewertet.length + 1,
      stich: stufe(z) === 1 && gewertet.some((g) => g.gesamt === z.gesamt && imStich(g, z) !== 0),
    }))
}

function laufListe(
  klasse: ClassId,
  lauf: number,
  zeilenVon: (id: string) => Werte,
  starter: Starter[],
  gruppen: ErgebnisGruppe[],
  felder: Map<string, Feld>,
  stich: readonly StichKriterium[],
): LaufListe {
  const blaetter = gruppen.flatMap((g) => g.blaetter)
  const nachNummer = starter.map((s): LaufZeile => {
    const werte = zeilenVon(s.id)
    const { punkte, disqs, codes } = bewerte(werte, Object.keys(werte), felder)
    const zeit = mittlereZeit(werte, felder)
    const disq = disqs.length > 0
    const zellen = blaetter.map((blatt) => {
      const zelle = bewerte(werte, blatt.felder, felder)
      return zellText(zelle.punkte, zelle.disqs)
    })
    return {
      starter: s,
      zeit,
      strafpunkte: punkte,
      gesamt: disq || zeit === null ? null : zeit + punkte * 100,
      disq,
      offen: !disq && zeit === null,
      nichtGestartet: disqs.includes('X'),
      platz: 1,
      stich: false,
      zellen,
      schluessel: schluesselText(codes, disqs),
    }
  })
  const nachPlatz = platziert(nachNummer, (z) => stichSchluessel(stich, [z], [z]))
  const platzVon = new Map(nachPlatz.map((z) => [z.starter.id, z]))
  return { klasse, lauf, gruppen, nachNummer: nachNummer.map((z) => platzVon.get(z.starter.id) ?? z), nachPlatz }
}

/**
 * Die Indizes der zu streichenden Läufe: zuerst die disqualifizierten, dann die schlechtesten
 * (bei Gleichstand der frühere). Offene Läufe werden nicht gestrichen – wer noch fährt, steht
 * auf Platz 1, bis er gefahren ist.
 */
function streichIndizes(laeufe: LaufZeile[], anzahl: number): number[] {
  if (anzahl <= 0) return []
  const rang = (l: LaufZeile) => (l.disq ? Number.POSITIVE_INFINITY : (l.gesamt ?? Number.NEGATIVE_INFINITY))
  return laeufe
    .map((l, i) => ({ i, rang: rang(l) }))
    .sort((a, b) => b.rang - a.rang || a.i - b.i)
    .slice(0, anzahl)
    .map((x) => x.i)
    .sort((a, b) => a - b)
}

function gesamtListe(
  klasse: ClassId,
  laeufe: LaufListe[],
  knotenVon: ((id: string) => Werte) | null,
  felder: Map<string, Feld>,
  streichen: number,
  stich: readonly StichKriterium[],
): GesamtListe {
  const nachNummer = laeufe[0].nachNummer.map((kopf, i): GesamtZeile => {
    const jeLauf = laeufe.map((l) => l.nachNummer[i])
    const disqs = jeLauf.filter((l) => l.disq).length
    // Mehr Disqualifikationen (auch X „Nicht gestartet“), als der jetzige Stand streicht: Ein
    // gültiger Lauf fehlt. Das gilt auch im Zwischenstand – wer ausgefallen ist, steht hinten
    // und nicht bei denen, die noch nachholen; greift später der Streichlauf, wird er gewertet.
    const disq = disqs > streichen
    // Offen ist nur, wer einen Lauf der Wertung noch nachholt (leere Zeile).
    const offen = !disq && jeLauf.some((l) => l.offen)
    // Solange das Ergebnis offen ist, gelten nur Disqualifikationen als gestrichen: Welcher
    // gültige Lauf der schlechteste ist, steht erst fest, wenn alle gefahren sind.
    const gestrichen = streichIndizes(jeLauf, offen ? disqs : streichen)
    const zaehlen = jeLauf.filter((_, k) => !gestrichen.includes(k))
    const ergebnis = disq || offen ? null : zaehlen.reduce((s, l) => s + l.gesamt!, 0)
    const werte = knotenVon?.(kopf.starter.id) ?? {}
    const knoten = bewerte(werte, Object.keys(werte), felder).punkte
    return {
      starter: kopf.starter,
      laeufe: jeLauf,
      gestrichen: gestrichen.map((k) => laeufe[k].lauf),
      ergebnis,
      disq,
      offen,
      knoten,
      gesamt: ergebnis === null ? null : ergebnis + knoten * 100,
      platz: 1,
      stich: false,
    }
  })
  const gestrichen = (z: GesamtZeile, lauf: number) => z.gestrichen.includes(lauf)
  const nachPlatz = platziert(nachNummer, (z) =>
    stichSchluessel(
      stich,
      z.laeufe,
      z.laeufe.filter((l, k) => l.gesamt !== null && !gestrichen(z, laeufe[k].lauf)),
    ),
  )
  const platzVon = new Map(nachPlatz.map((z) => [z.starter.id, z]))
  return {
    klasse,
    laeufe: laeufe.map((l) => l.lauf),
    streichen,
    mitKnoten: knotenVon !== null,
    nachNummer: nachNummer.map((z) => platzVon.get(z.starter.id) ?? z),
    nachPlatz,
  }
}

/** Die Starter einer Klasse nach Startnummer. */
function starterDerKlasse(stand: Pick<ErgebnisStand, 'starters'>, klasse: ClassId): Starter[] {
  return stand.starters.filter((s) => s.klasse === klasse).sort((a, b) => vergleicheNr(a.startNr, b.startNr))
}

/**
 * Die Läufe einer Klasse mit Eingaben, in der Disziplin des Aufbaus – höchstens `laufCount`.
 * Für jeden gibt es eine Lauf-Liste; in die Gesamtwertung kommt er erst, wenn er gefahren wird
 * (siehe {@link klassenErgebnis}).
 */
export function laeufeMitEingaben(stand: ErgebnisStand, konfig: ErgebnisKonfig, klasse: ClassId): number[] {
  const disziplin = konfig.getAufbau(stand.aufbau).disziplin
  const ids = stand.starters.filter((s) => s.klasse === klasse).map((s) => s.id)
  const out: number[] = []
  for (let lauf = 1; lauf <= Math.max(1, stand.laufCount); lauf++) {
    const zeilen = stand.eingaben[laufSchluessel(disziplin, lauf)]
    if (zeilen && ids.some((id) => zeilen[id] && Object.keys(zeilen[id]).length > 0)) out.push(lauf)
  }
  return out
}

/**
 * Die Ergebnislisten einer Klasse für die Disziplin des Aufbaus; null, solange es keine
 * Starter gibt oder noch nichts eingetragen ist. Gewertet wird je Klasse – auch bei der
 * Clubmeisterschaft, wo mehrere Klassen auf einem Bogen stehen.
 */
export function klassenErgebnis(stand: ErgebnisStand, konfig: ErgebnisKonfig, klasse: ClassId): KlassenErgebnis | null {
  const starter = starterDerKlasse(stand, klasse)
  if (starter.length === 0) return null
  const laeufe = laeufeMitEingaben(stand, konfig, klasse)
  if (laeufe.length === 0) return null
  const disziplin = konfig.getAufbau(stand.aufbau).disziplin
  const listen = veranstaltungsListen(konfig, stand)
  const felder = felderJeKennung(konfig, klasse, listen)
  const gruppen = ergebnisGruppen(konfig, stand, klasse)
  const werte = (lauf: number) => (id: string) => werteVon(stand.eingaben, laufSchluessel(disziplin, lauf), id)
  const stich = konfig.getRegelwerk?.().stichentscheid ?? []
  const laufListen = laeufe.map((l) => laufListe(klasse, l, werte(l), starter, gruppen, felder, stich))
  const mitKnoten = listen.some((typeId) => konfig.positionAllowsClass(typeId, klasse) && konfig.getSheetDef(typeId).showLauf === false)
  // Ein Lauf, in dem erst Haken, Bemerkungen oder Fehlerpunkte stehen (das Abtippen beginnt mit
  // einer Tor-Liste), ist noch nicht gefahren: Er würde sonst die ganze Klasse auf „offen“
  // setzen. Dasselbe gilt für ein X „Nicht gestartet“ ohne Zeit – es steht oft schon da, bevor
  // der Lauf beginnt. Ist noch gar keiner gefahren, zeigt die Gesamtliste den ersten.
  const gefahren = laufListen.filter((l) => l.nachNummer.some((z) => z.zeit !== null || (z.disq && !z.nichtGestartet)))
  const gesamtLaeufe = gefahren.length > 0 ? gefahren : laufListen.slice(0, 1)
  const laufCount = Math.max(1, stand.laufCount)
  const streichen = streichZahl(laufCount, stand.streichlaeufe, gesamtLaeufe.length)
  const gesamt = gesamtListe(klasse, gesamtLaeufe, mitKnoten ? werte(OHNE_LAUF) : null, felder, streichen, stich)
  return { klasse, laeufe: laufListen, gesamt }
}
