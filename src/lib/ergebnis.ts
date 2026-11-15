import type { RawDisziplin, StichKriterium } from '../config/schema'
import type { AppState, ClassId, Starter, Streichlaeufe } from '../types'
import { columnsForClass } from './bogen'
import { codeEntries, parseCodeEntry } from './codes'
import { erfasstKennung, felderJeKennung, laufSchluessel, listenFelder, OHNE_LAUF, vergleicheNr, werteVon, type EingabenKonfig, type Feld } from './eingaben'
import { bojenWert, codeDisqs, disqCodes, errorParts } from './scoring'
import { parseTime } from './time'
import { veranstaltungsListen, type ListenWahl } from './listen'
import { versucheNacheinander } from '../config/catalog'

// Wertungslisten aus den Eingaben – rein, ohne DOM. Vorbild: lib/ergebnis.ts im
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
  getRegelwerk?(): RegelwerkWertung & { vorgabeListen?: Readonly<Record<string, readonly string[]>> }
}

/** Was das Regelwerk zur Wertung sagt: allgemein und – wo es abweicht – je Disziplin (`wertungJeDisziplin`). */
export interface RegelwerkWertung {
  stichentscheid?: readonly StichKriterium[]
  wertungslaeufe?: { laeufe?: number; streichlaeufe?: number; nachRegel?: StreichRegel }
  wertungJeDisziplin?: Readonly<Record<string, { stichentscheid?: readonly StichKriterium[]; wertungslaeufe?: { laeufe: number; streichlaeufe: number } }>>
}

/**
 * Stichentscheid und Wertungsläufe einer Disziplin: was das Regelwerk für sie eigens nennt
 * (`wertungJeDisziplin`), sonst seine allgemeine Angabe. Das Manövrieren hat in keinem
 * mitgelieferten Regelwerk einen eigenen Eintrag – für es gilt, was immer galt.
 */
export function wertungDer(regelwerk: RegelwerkWertung | undefined, disziplin: string): { stichentscheid: readonly StichKriterium[]; wertungslaeufe?: { laeufe?: number; streichlaeufe?: number; nachRegel?: StreichRegel } } {
  const je = regelwerk?.wertungJeDisziplin ?? {}
  // Nur eigene Einträge: „constructor“ o. Ä. als Disziplin träfe sonst das Objekt-Urbild.
  const eigen = Object.prototype.hasOwnProperty.call(je, disziplin) ? je[disziplin] : undefined
  return { stichentscheid: eigen?.stichentscheid ?? regelwerk?.stichentscheid ?? [], wertungslaeufe: eigen?.wertungslaeufe ?? regelwerk?.wertungslaeufe }
}

/**
 * Was gewertet wird, wenn es nicht die Disziplin des Aufbaus der Veranstaltung ist (das
 * Manövrieren): eine Runde des Parallelslaloms (lib/parallelErgebnis.ts). Fehlt die Angabe,
 * rechnet {@link klassenErgebnis} wie immer – Disziplin und Listen aus `stand.aufbau`, Läufe
 * und Streichläufe aus der Veranstaltung.
 */
export interface WertungsEinheit {
  /** Die Disziplin der Konfiguration: Spalten der Liste, Stichentscheid (`parallel`). */
  disziplin: string
  /** Unter dieser Kennung stehen die Werte (`laufSchluessel`): `parallel:pre`. */
  schluessel: string
  /** Die Wettkampfrichter-Listen, aus denen die Werte kommen, in ihrer Reihenfolge. */
  listen: readonly string[]
  /** So viele Läufe hat die Einheit. Sie zählen alle von Anfang an: Wer einen noch nicht gefahren ist, ist offen. */
  laeufe: number
  /** So viele davon werden gestrichen. */
  streichlaeufe: number
}

/** `regelwerk` und `versucheNacheinander` dürfen fehlen (Tests, Stände ohne die Option): Dann gilt der Schalter als aus. */
export type ErgebnisStand = ListenWahl & Pick<AppState, 'eingaben' | 'starters' | 'laufCount' | 'streichlaeufe'> & Partial<Pick<AppState, 'regelwerk' | 'versucheNacheinander'>>

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
  /**
   * Die Knoten des Starters sind erfasst: Auf jeder Liste ohne Lauf mit Summe (Knoten) steht bei
   * ihm ein Wert oder der Haken „erfasst“ – ohne solche Liste immer `true`. Die Gesamtliste
   * rechnet fehlende Knoten wie bisher als 0 Strafpunkte; unter Regel 960 gibt es die UIM points
   * des Manövrierens aber erst mit den Knoten (lib/pokal.ts `klasseFertig`; Pkt. 5.2.1 „best
   * times including knots test penalties, ranking, UIM points“).
   */
  knotenErfasst: boolean
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

/** Abstand in den Wertungslisten: zum nächstbesseren Ergebnis oder zum Ersten. */
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
export function streichZahl(laufCount: number, streichlaeufe: Streichlaeufe, gefahren: number, nachRegel?: StreichRegel): number {
  return Math.max(0, gefahren - (laufCount - streichlaeufeVon(laufCount, streichlaeufe, nachRegel)))
}

/**
 * Was „Streichläufe nach Regel“ je Zahl der Läufe streicht, soweit das Regelwerk es sagt
 * (YAML `wertungslaeufe.nachRegel`; DM C6: zwei Läufe, einer gewertet → { 2: 1 }).
 */
export type StreichRegel = Readonly<Record<number, number>>

/**
 * Die geltende Zahl der Streichläufe; nie mehr als `laufCount − 1`. `auto` („nach Regel“) =
 * was das Regelwerk für diese Zahl von Läufen nennt (`nachRegel`), sonst ab drei Läufen einer.
 * Eine Zahl von Hand gilt immer wie eingestellt – der Rennleiter entscheidet.
 */
export function streichlaeufeVon(laufCount: number, streichlaeufe: Streichlaeufe, nachRegel?: StreichRegel): number {
  const gewuenscht = streichlaeufe === 'auto' ? (nachRegel?.[Math.max(1, laufCount)] ?? (laufCount >= 3 ? 1 : 0)) : streichlaeufe
  return Math.max(0, Math.min(Math.max(1, laufCount) - 1, Math.round(gewuenscht) || 0))
}

/**
 * Was das Regelwerk an Läufen und Streichläufen vorsieht, wenn die Veranstaltung anders
 * eingestellt ist; sonst null (auch wenn das Regelwerk nichts vorgibt). Gewertet wird immer
 * das Eingestellte – der Rennleiter entscheidet –, die Oberfläche weist nur darauf hin: Unter
 * UIM zählte mit „Streichläufe nach Regel“ sonst die Summe beider Versuche statt des besseren.
 */
export function laeufeLautRegelwerk(
  regelwerk: { wertungslaeufe?: { laeufe: number; streichlaeufe: number; nurVorgabe?: true; nachRegel?: StreichRegel } },
  stand: Pick<AppState, 'laufCount' | 'streichlaeufe'>,
): { laeufe: number; streichlaeufe: number } | null {
  const soll = regelwerk.wertungslaeufe
  // `nurVorgabe` (DM): nur die Voreinstellung bei der Wahl des Regelwerks – kein Maß.
  if (!soll || soll.nurVorgabe) return null
  const laeufe = Math.max(1, stand.laufCount)
  return soll.laeufe === laeufe && soll.streichlaeufe === streichlaeufeVon(laeufe, stand.streichlaeufe, soll.nachRegel) ? null : { laeufe: soll.laeufe, streichlaeufe: soll.streichlaeufe }
}

/** Die Spalten der Wertungsliste: Felder, die es im Aufbau für die Klasse nicht gibt, entfallen. */
export function ergebnisGruppen(konfig: ErgebnisKonfig, wahl: ListenWahl, klasse: string, einheit?: Pick<WertungsEinheit, 'disziplin' | 'listen'>): ErgebnisGruppe[] {
  const kuerzel = new Map<string, string>()
  for (const typeId of einheit?.listen ?? veranstaltungsListen(konfig, wahl)) {
    if (!konfig.positionAllowsClass(typeId, klasse)) continue
    for (const col of columnsForClass(konfig.getSheetDef(typeId).columns, klasse)) {
      // Kennung „t1a|hin seiteA“: Das letzte Wort ist die Bojen-Seite.
      col.felder?.forEach((feld) => kuerzel.set(feld, BOJEN_SEITE[feld.split(' ').pop() ?? ''] ?? col.label))
    }
  }
  return (konfig.getDisziplin(einheit?.disziplin ?? konfig.getAufbau(wahl.aufbau).disziplin).ergebnisspalten ?? []).flatMap((sp): ErgebnisGruppe[] => {
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
  const sortiert = [...codes].sort((a, b) => codeVon(a).localeCompare(codeVon(b), undefined, { numeric: true }))
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
  knotenErfasst: (id: string) => boolean = () => true,
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
      knotenErfasst: knotenVon === null || knotenErfasst(kopf.starter.id),
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
 * Ein Lauf, in dem für die Klasse nur „Nicht gestartet“ steht, zählt noch nicht.
 * Für jeden gibt es eine Lauf-Liste; in die Gesamtwertung kommt er erst, wenn er gefahren wird
 * (siehe {@link klassenErgebnis}).
 */
export function laeufeMitEingaben(stand: ErgebnisStand, konfig: ErgebnisKonfig, klasse: ClassId, einheit?: WertungsEinheit): number[] {
  const disziplin = einheit?.schluessel ?? konfig.getAufbau(stand.aufbau).disziplin
  const ids = stand.starters.filter((s) => s.klasse === klasse).map((s) => s.id)
  const felder = felderJeKennung(konfig, klasse)
  // Eine Zeile, in der allein das X „Nicht gestartet“ steht, ist noch keine Eingabe zum Lauf:
  // Wer nach Wettkampfbeginn abgemeldet wird, bekommt das X in JEDEM kommenden Lauf
  // (lib/abmeldung.ts) – sonst entstünden sofort Lauf-Listen aller künftigen Läufe, auf denen
  // alle anderen ohne Zeit auf Platz 1 stehen, samt Zeitstempel und Blatt im Druck „alle“.
  const nurNichtGestartet = (eintraege: [string, string][]) => eintraege.every(([kennung, wert]) => felder.get(kennung)?.kind === 'disq' && wert.trim().toUpperCase() === 'X')
  // „Versuche direkt nacheinander“: Was an einer Position steht, an der der Starter nur einmal
  // vorbeikommt (Vorsteg, config `einmalJeStarter`), steht in jedem Versuch
  // (components/erfassung/ErfassungTabelle.vue `zellenVon`). In einem späteren Versuch ist es noch
  // keine Eingabe zu diesem – sonst legte der erste Haken am Vorsteg schon die Liste des 2.
  // Versuchs samt Zeitstempel an, bevor jemand ihn gefahren ist.
  const einmal = einheit ? KEINE_KENNUNG : einmalKennungen(stand, konfig, klasse)
  const out: number[] = []
  for (let lauf = 1; lauf <= Math.max(1, einheit?.laeufe ?? stand.laufCount); lauf++) {
    const zeilen = stand.eingaben[laufSchluessel(disziplin, lauf)]
    const zaehlt = (werte: Readonly<Record<string, string>> | undefined) => {
      const eintraege = Object.entries(werte ?? {}).filter(([kennung]) => lauf === 1 || !einmal.has(kennung))
      return eintraege.length > 0 && !nurNichtGestartet(eintraege)
    }
    if (zeilen && ids.some((id) => zaehlt(zeilen[id]))) out.push(lauf)
  }
  return out
}

const KEINE_KENNUNG: ReadonlySet<string> = new Set()

/**
 * Die Kennungen der Felder, die bei „Versuche direkt nacheinander“ in jedem Versuch stehen: die
 * der Positionen mit `einmalJeStarter` samt Haken „erfasst“. Leer, solange der Schalter aus ist –
 * dann hat der Vorsteg wie bisher einen Bogen je Lauf, und jeder zählt für sich.
 */
function einmalKennungen(stand: ErgebnisStand, konfig: ErgebnisKonfig, klasse: ClassId): ReadonlySet<string> {
  if (stand.laufCount < 2 || !versucheNacheinander({ regelwerk: stand.regelwerk ?? '', versucheNacheinander: stand.versucheNacheinander })) return KEINE_KENNUNG
  const out = new Set<string>()
  for (const pos of konfig.getPositions()) {
    if (pos.einmalJeStarter !== true || !konfig.positionAllowsClass(pos.typeId, klasse)) continue
    for (const feld of listenFelder(konfig, pos.typeId, klasse)) out.add(feld.kennung)
    out.add(erfasstKennung(pos.typeId))
  }
  return out
}

/**
 * Die Wertungslisten einer Klasse für die Disziplin des Aufbaus; null, solange es keine
 * Starter gibt oder noch nichts eingetragen ist. Gewertet wird je Klasse – auch bei der
 * Clubmeisterschaft, wo mehrere Klassen auf einem Bogen stehen.
 *
 * Mit `einheit` wird statt der Disziplin des Aufbaus eine andere Wertungseinheit gerechnet
 * (eine Runde des Parallelslaloms): mit ihren Listen, ihren Läufen und dem Stichentscheid ihrer
 * Disziplin. Dort zählen alle Läufe von Anfang an – einen Zwischenstand nach dem ersten gibt
 * es nicht (UIM 960, Pkt. 5.2.2: „the required two valid attempts“).
 */
export function klassenErgebnis(stand: ErgebnisStand, konfig: ErgebnisKonfig, klasse: ClassId, einheit?: WertungsEinheit): KlassenErgebnis | null {
  const starter = starterDerKlasse(stand, klasse)
  if (starter.length === 0) return null
  const mitEingaben = laeufeMitEingaben(stand, konfig, klasse, einheit)
  if (mitEingaben.length === 0) return null
  // In einer Einheit gibt es zu jedem ihrer Läufe eine Liste, sobald irgendeiner Eingaben hat.
  const laeufe = einheit ? Array.from({ length: Math.max(1, einheit.laeufe) }, (_, i) => i + 1) : mitEingaben
  const disziplin = einheit?.disziplin ?? konfig.getAufbau(stand.aufbau).disziplin
  const schluessel = einheit?.schluessel ?? disziplin
  const listen = einheit ? [...einheit.listen] : veranstaltungsListen(konfig, stand)
  const felder = felderJeKennung(konfig, klasse, listen)
  const gruppen = ergebnisGruppen(konfig, stand, klasse, einheit)
  const werte = (lauf: number) => (id: string) => werteVon(stand.eingaben, laufSchluessel(schluessel, lauf), id)
  const regel = wertungDer(konfig.getRegelwerk?.(), disziplin)
  const stich = regel.stichentscheid
  const laufListen = laeufe.map((l) => laufListe(klasse, l, werte(l), starter, gruppen, felder, stich))
  const mitKnoten = listen.some((typeId) => konfig.positionAllowsClass(typeId, klasse) && konfig.getSheetDef(typeId).showLauf === false)
  // Ein Lauf, in dem erst Haken, Bemerkungen oder Fehlerpunkte stehen (das Abtippen beginnt mit
  // einer Tor-Liste), ist noch nicht gefahren: Er würde sonst die ganze Klasse auf „offen“
  // setzen. Dasselbe gilt für ein X „Nicht gestartet“ ohne Zeit – es steht oft schon da, bevor
  // der Lauf beginnt. Ist noch gar keiner gefahren, zeigt die Gesamtliste den ersten.
  const gefahren = laufListen.filter((l) => l.nachNummer.some((z) => z.zeit !== null || (z.disq && !z.nichtGestartet)))
  const gesamtLaeufe = einheit ? laufListen : gefahren.length > 0 ? gefahren : laufListen.slice(0, 1)
  const laufCount = Math.max(1, einheit?.laeufe ?? stand.laufCount)
  const streichen = streichZahl(laufCount, einheit?.streichlaeufe ?? stand.streichlaeufe, gesamtLaeufe.length, regel.wertungslaeufe?.nachRegel)
  // Erfasst sind die Knoten eines Starters, wenn auf jeder Liste ohne Lauf mit Summe bei ihm ein
  // Wert oder der Haken steht (wie lib/erfassung.ts `zeileErfasst`): Fehlerfreie Knoten lassen
  // die Zeile leer, erst der Haken sagt, dass sie abgenommen sind.
  const knotenListen = listen.filter((typeId) => konfig.positionAllowsClass(typeId, klasse) && konfig.getSheetDef(typeId).showLauf === false && konfig.getSheetDef(typeId).sumColumnKey !== undefined)
  const knotenErfasst = (id: string) => {
    const w = werte(OHNE_LAUF)(id)
    return knotenListen.every((typeId) => !!w[erfasstKennung(typeId)] || listenFelder(konfig, typeId, klasse).some((f) => !!w[f.kennung]))
  }
  const gesamt = gesamtListe(klasse, gesamtLaeufe, mitKnoten ? werte(OHNE_LAUF) : null, felder, streichen, stich, knotenErfasst)
  return { klasse, laeufe: laufListen, gesamt }
}
