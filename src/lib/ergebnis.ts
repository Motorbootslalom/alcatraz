import type { RawDisziplin } from '../config/schema'
import type { AppState, ClassId, Starter, Streichlaeufe } from '../types'
import { columnsForClass } from './bogen'
import { codeEntries, parseCodeEntry } from './codes'
import { felderJeKennung, laufSchluessel, OHNE_LAUF, vergleicheNr, werteVon, type EingabenKonfig, type Feld } from './eingaben'
import { bojenWert, codeDisqs, disqCodes, errorParts } from './scoring'
import { formatSeconds, parseTime } from './time'

// Ergebnislisten aus den Eingaben – rein, ohne DOM. Vorbild: lib/ergebnis.ts im
// Fehlerpunkte-Prototyp, nachgebaut nach den Auswertungs-Listen der DM 2026.
//
// Lauf: Die Zeit ist die der elektronischen Zeiterfassung, ohne sie der Mittelwert der
// Stoppuhren. Eine Sekunde zählt einen Punkt, dazu die Strafpunkte. Gleiche Punkte teilen
// sich den Platz. Drei Fälle je Starter:
//   • gewertet        – Zeit vorhanden, keine Disqualifikation.
//   • offen           – noch keine Zeit und keine Disqualifikation: „noch nicht gefahren“.
//                       Steht ohne Zeit auf Platz 1 (Entscheidung des Nutzers, wie in der
//                       Excel-Mappe): Wer nachholt, wird danach einsortiert – die anderen
//                       können dadurch nur aufrücken, nie abrutschen.
//   • disqualifiziert – ein Disq-Buchstabe irgendwo im Lauf, auch X „Nicht gestartet“
//                       (am Steg oder Vorsteg eingetragen). Steht ohne Punkte hinter allen.
//
// Gesamt: Gewertet werden die Läufe, für die es in der Klasse schon Eingaben gibt. Am Ende
// zählen `laufCount − Streichläufe` Läufe; solange weniger gefahren sind, wird nichts
// gestrichen. Gestrichen werden zuerst disqualifizierte Läufe, dann die schlechtesten (bei
// Gleichstand der frühere). Bleibt danach noch ein disqualifizierter Lauf in der Wertung
// (zu wenige gültige Läufe), ist der Starter insgesamt disqualifiziert und steht auf dem
// letzten Platz. Hat er noch einen offenen Lauf, steht er wie im Lauf auf Platz 1. Knoten
// zählen zusätzlich.
//
// Punkte stehen als ganze Hundertstel in den Zeilen, damit nichts durch Rundung kippt.

/** Was die Wertung von der Konfiguration braucht (config/konfig.ts `Konfig`). */
export interface ErgebnisKonfig extends EingabenKonfig {
  getDisziplin(id: string): RawDisziplin
}

export type ErgebnisStand = Pick<AppState, 'aufbau' | 'eingaben' | 'starters' | 'laufCount' | 'streichlaeufe'>

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
  /** Ein Lauf, der zählen kann, ist noch nicht gefahren. */
  offen: boolean
  /** Knoten-Strafpunkte. */
  knoten: number
  gesamt: number | null
  platz: number
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

/** Ein Abstand als Zelle: „+12,34“, leer ohne Abstand. */
export function abstandText(abstand: number | null): string {
  return abstand === null ? '' : `+${formatSeconds(abstand)}`
}

/** Eine Punkte-Zelle: „disq.“ statt einer Zahl, leer solange die Zeit fehlt. */
export function punkteText(disq: boolean, punkte: number | null): string {
  if (disq) return 'disq.'
  return punkte === null ? '' : formatSeconds(punkte)
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

/** Die Spalten der Ergebnisliste: Felder, die es im Aufbau für die Klasse nicht gibt, entfallen. */
export function ergebnisGruppen(konfig: ErgebnisKonfig, aufbau: string, klasse: string): ErgebnisGruppe[] {
  const kuerzel = new Map<string, string>()
  for (const typeId of konfig.aufbauOrder(aufbau, false)) {
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
 * Sortiert und vergibt die Plätze: Offene zuerst (alle Platz 1), dann nach Punkten,
 * Disqualifizierte gemeinsam dahinter. Innerhalb gleicher Punkte nach Startnummer.
 */
function platziert<T extends { starter: Starter; gesamt: number | null; disq: boolean; platz: number }>(zeilen: T[]): T[] {
  const stufe = (z: T) => STUFE[wertungVon(z)]
  const offene = zeilen.filter((z) => stufe(z) === 0).length
  const gewertet = zeilen.filter((z) => stufe(z) === 1)
  return [...zeilen]
    .sort((a, b) => stufe(a) - stufe(b) || (stufe(a) === 1 ? a.gesamt! - b.gesamt! : 0) || vergleicheNr(a.starter.startNr, b.starter.startNr))
    .map((z) => ({
      ...z,
      platz: stufe(z) === 0 ? 1 : stufe(z) === 1 ? offene + 1 + gewertet.filter((g) => g.gesamt! < z.gesamt!).length : offene + gewertet.length + 1,
    }))
}

function laufListe(
  klasse: ClassId,
  lauf: number,
  zeilenVon: (id: string) => Werte,
  starter: Starter[],
  gruppen: ErgebnisGruppe[],
  felder: Map<string, Feld>,
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
      zellen,
      schluessel: schluesselText(codes, disqs),
    }
  })
  const nachPlatz = platziert(nachNummer)
  const platzVon = new Map(nachPlatz.map((z) => [z.starter.id, z.platz]))
  return { klasse, lauf, gruppen, nachNummer: nachNummer.map((z) => ({ ...z, platz: platzVon.get(z.starter.id) ?? 1 })), nachPlatz }
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

function gesamtListe(klasse: ClassId, laeufe: LaufListe[], knotenVon: ((id: string) => Werte) | null, felder: Map<string, Feld>, streichen: number): GesamtListe {
  const nachNummer = laeufe[0].nachNummer.map((kopf, i): GesamtZeile => {
    const jeLauf = laeufe.map((l) => l.nachNummer[i])
    const disqs = jeLauf.filter((l) => l.disq).length
    // Zu wenige gültige Läufe: Auch nach dem Streichen bliebe eine Disqualifikation in der Wertung.
    const disq = disqs > streichen
    const offen = !disq && jeLauf.some((l) => l.offen)
    // Solange ein Lauf offen ist, gelten nur Disqualifikationen als gestrichen: Welcher gültige
    // Lauf der schlechteste ist, steht erst fest, wenn alle gefahren sind.
    const gestrichen = streichIndizes(jeLauf, offen ? Math.min(streichen, disqs) : streichen)
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
    }
  })
  const nachPlatz = platziert(nachNummer)
  const platzVon = new Map(nachPlatz.map((z) => [z.starter.id, z.platz]))
  return {
    klasse,
    laeufe: laeufe.map((l) => l.lauf),
    streichen,
    mitKnoten: knotenVon !== null,
    nachNummer: nachNummer.map((z) => ({ ...z, platz: platzVon.get(z.starter.id) ?? 1 })),
    nachPlatz,
  }
}

/** Die Starter einer Klasse nach Startnummer. */
function starterDerKlasse(stand: Pick<ErgebnisStand, 'starters'>, klasse: ClassId): Starter[] {
  return stand.starters.filter((s) => s.klasse === klasse).sort((a, b) => vergleicheNr(a.startNr, b.startNr))
}

/** Die Läufe einer Klasse mit Eingaben, in der Disziplin des Aufbaus – höchstens `laufCount`. */
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
  const listen = konfig.aufbauOrder(stand.aufbau, false)
  const felder = felderJeKennung(konfig, klasse, listen)
  const gruppen = ergebnisGruppen(konfig, stand.aufbau, klasse)
  const werte = (lauf: number) => (id: string) => werteVon(stand.eingaben, laufSchluessel(disziplin, lauf), id)
  const laufListen = laeufe.map((l) => laufListe(klasse, l, werte(l), starter, gruppen, felder))
  const mitKnoten = listen.some((typeId) => konfig.positionAllowsClass(typeId, klasse) && konfig.getSheetDef(typeId).showLauf === false)
  const streichen = streichZahl(Math.max(1, stand.laufCount), stand.streichlaeufe, laeufe.length)
  return { klasse, laeufe: laufListen, gesamt: gesamtListe(klasse, laufListen, mitKnoten ? werte(OHNE_LAUF) : null, felder, streichen) }
}
