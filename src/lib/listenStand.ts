import { configFor } from '../config/konfig'
import { CLASS_IDS } from '../domain/classes'
import type { AppState, ClassId, ListenStand } from '../types'
import { klassenErgebnis, type GesamtListe, type LaufListe } from './ergebnis'
import { OHNE_LAUF, zerlegeLauf } from './eingaben'

// Wann sich eine Ergebnisliste zuletzt geändert hat – rein, ohne Uhr. Vorbild:
// `aktuellerListenStand` im Fehlerpunkte-Prototyp (lib/ergebnis.ts). Der Zeitpunkt steht auf
// der Liste: Hängen zwei Fassungen aus, sagt er, welche die neuere ist – anders als der
// Druckzeitpunkt, der sich bei jedem Nachdruck änderte (im Seitenrand steht deshalb keiner mehr).
//
// Die Regel: Je Liste wird eine Prüfsumme dessen gemerkt, was auf ihr steht. Ändert eine
// Action die Prüfsumme, bekommt die Liste den Zeitpunkt der Action. Damit zählt alles, was
// die Liste wirklich verändert – und nur das:
//   • jede Eingabe, die sie betrifft, auch das Löschen eines Werts;
//   • ein Starter, der dazukommt oder entfernt wird, eine geänderte Startnummer, ein
//     berichtigter Name oder Verein;
//   • für die Gesamtliste zusätzlich Streichläufe und Zahl der Läufe.
// Nicht dazu zählt, wie die Liste gezeigt wird (Fassung Aushang/Intern, Kürzel, Sprache,
// Reihenfolge, Abstand-Spalte): Das ändert nichts am Ergebnis.
//
// Die Gesamtliste zählt alle Lauf-Listen ihrer Klasse mit, auch wenn eine Änderung bei ihr
// nicht zu sehen ist (anderer Fehlercode, gleiche Punkte): Wer die Listen vergleicht, darf
// keinen Lauf finden, der neuer ist als die Gesamtliste.
//
// Die Kette (Vorgabe des Nutzers): Je Klasse und Lauf gibt es einen Zeitpunkt der letzten
// Änderung. Die Gesamtliste der Klasse trägt den jüngsten ihrer Läufe (oder ihren eigenen, wenn
// sie sich ohne einen Lauf geändert hat: Knoten, Streichläufe), die Mannschaftswertung den
// jüngsten der Gesamtlisten aller Klassen ({@link gesamtZeit}, {@link wertungZeit}). JEDE
// Eingabe einer Zeit, eines Fehlers, einer Disqualifikation oder der Knoten setzt den Zeitpunkt
// ihrer Klasse und ihres Laufs – auch wenn die Liste danach gleich aussieht (ein Wert, der an
// Punkten und Platz nichts ändert): Dafür nennt der Reducer die betroffenen Listen
// ({@link geaenderteListen}, `erzwungen`), die Prüfsumme allein sähe das nicht.
//
// Nie rückwärts: Entfallen alle Listen einer Klasse, bleibt der Zeitpunkt des Wegfalls stehen
// ({@link KEINE_LISTE}) – ein Aushang der Mannschaftswertung von vorher darf nicht jünger wirken
// als der Stand danach.
//
// Unbekannt statt erfunden: Eine Liste, die es schon gab, deren Zeitpunkt aber nie notiert
// wurde (Stand aus der Zeit vor dieser Angabe), bekommt die Prüfsumme ohne Zeitpunkt – erst
// ihre nächste Änderung setzt einen. Ebenso eine Änderung durch eine Action ohne `zeit`.

/** Was die Ergebnislisten bestimmt; ändert sich davon nichts, bleibt der Stand, wie er ist. */
const WERTUNG = ['eingaben', 'starters', 'laufCount', 'streichlaeufe', 'aufbau', 'regelwerk', 'eigeneAufbauten', 'tor5MitParcours', 'zusatzListen'] as const
export type WertungsStand = Pick<AppState, (typeof WERTUNG)[number]>

/** Schlüssel der Liste eines Laufs in `AppState.listenStand`. */
export function laufListenSchluessel(disziplin: string, klasse: string, lauf: number): string {
  return `${disziplin}/${klasse}/${lauf}`
}

/** Schlüssel der Gesamtliste einer Klasse. */
export function gesamtListenSchluessel(disziplin: string, klasse: string): string {
  return `${disziplin}/${klasse}/gesamt`
}

/** FNV-1a: Der Listeninhalt selbst wäre für den Speicher im Browser unnötig groß. */
export function pruefsumme(text: string): number {
  let summe = 0x811c9dc5
  for (let i = 0; i < text.length; i++) summe = Math.imul(summe ^ text.charCodeAt(i), 0x01000193)
  return summe >>> 0
}

// Bewusst einzeln aufgezählt statt die ganze Liste zu nehmen: Die Prüfsummen stehen in
// Sicherungen. Käme in lib/ergebnis.ts ein Feld für die Anzeige dazu, änderten sich sonst
// alle Prüfsummen, und jede geladene Sicherung verlöre ihre Zeitpunkte.
const laufInhalt = (l: LaufListe) =>
  JSON.stringify([
    l.gruppen.map((g) => [g.label, g.blaetter.map((b) => b.label)]),
    l.nachNummer.map((z) => [
      z.starter.id,
      z.starter.startNr,
      z.starter.nachname,
      z.starter.vorname,
      z.starter.verein,
      z.starter.bundesland,
      z.starter.land ?? '',
      z.zeit,
      z.strafpunkte,
      z.gesamt,
      z.disq,
      z.platz,
      z.zellen,
      z.schluessel,
    ]),
  ])

const gesamtInhalt = (g: GesamtListe, laeufe: number[]) =>
  JSON.stringify([g.laeufe, g.streichen, g.mitKnoten, laeufe, g.nachNummer.map((z) => [z.starter.id, z.gestrichen, z.ergebnis, z.disq, z.offen, z.knoten, z.gesamt, z.platz])])

/** Die Prüfsummen aller Ergebnislisten der genannten Klassen, unter ihren Schlüsseln. */
export function listenInhalte(stand: WertungsStand, klassen: readonly ClassId[] = CLASS_IDS): Map<string, number> {
  const konfig = configFor({ regelwerk: stand.regelwerk, eigeneAufbauten: stand.eigeneAufbauten })
  const disziplin = konfig.getAufbau(stand.aufbau).disziplin
  const inhalte = new Map<string, number>()
  for (const klasse of klassen) {
    const ergebnis = klassenErgebnis(stand, konfig, klasse)
    if (!ergebnis) continue
    const laeufe = ergebnis.laeufe.map((l) => {
      const summe = pruefsumme(laufInhalt(l))
      inhalte.set(laufListenSchluessel(disziplin, klasse, l.lauf), summe)
      return summe
    })
    inhalte.set(gesamtListenSchluessel(disziplin, klasse), pruefsumme(gesamtInhalt(ergebnis.gesamt, laeufe)))
  }
  return inhalte
}

/**
 * Der Stand der Ergebnislisten nach einer Änderung von `vorher` zu `jetzt`; `zeit` ist der
 * Zeitpunkt der Action (fehlt = unbekannt). `klassen` grenzt ein, was neu gerechnet wird –
 * eine Eingabe betrifft nur die Klasse ihres Starters. Liefert `jetzt.listenStand` selbst,
 * wenn sich nichts geändert hat.
 *
 * Beim Laden eines Stands ist `vorher` der geladene Stand selbst: Seine Zeitpunkte gelten,
 * und Listen ohne Eintrag bleiben ohne Zeitpunkt. Nur wo die mitgebrachte Prüfsumme nicht zum
 * Inhalt passt, hat sich die Liste mit dem Laden geändert (eine Vorlage stellt Aufbau oder
 * Streichläufe um) – sie bekommt den Zeitpunkt des Ladens.
 */
export function listenStandNach(
  vorher: WertungsStand,
  jetzt: WertungsStand & Pick<AppState, 'listenStand'>,
  zeit: number | undefined,
  klassen: readonly ClassId[] = CLASS_IDS,
  /** Listen, die den Zeitpunkt auch bei gleicher Prüfsumme bekommen: Dort wurde ein Wert eingegeben ({@link geaenderteListen}). */
  erzwungen: ReadonlySet<string> = KEINE,
): AppState['listenStand'] {
  const bisher = jetzt.listenStand
  if (vorher !== jetzt && WERTUNG.every((feld) => vorher[feld] === jetzt[feld])) return bisher
  const inhalte = listenInhalte(jetzt, klassen)
  const disziplin = configFor({ regelwerk: jetzt.regelwerk, eigeneAufbauten: jetzt.eigeneAufbauten }).getAufbau(jetzt.aufbau).disziplin
  const gerechnet = klassen.map((k) => `${disziplin}/${k}/`)
  // Nur was neu gerechnet wurde, kann entfallen: Listen anderer Klassen und Disziplinen bleiben.
  const neu: AppState['listenStand'] = Object.fromEntries(Object.entries(bisher).filter(([schluessel]) => !gerechnet.some((p) => schluessel.startsWith(p))))
  let geaendert = false
  // Was die Listen vor der Änderung enthielten – nur nötig für Listen ohne Eintrag, also selten.
  let davor: Map<string, number> | undefined
  for (const [schluessel, inhalt] of inhalte) {
    const eintrag: ListenStand | undefined = bisher[schluessel]
    const eingabe = erzwungen.has(schluessel)
    if (eintrag?.inhalt === inhalt && !eingabe) {
      neu[schluessel] = eintrag
      continue
    }
    geaendert = true
    // Ohne Eintrag, aber schon vorher mit diesem Inhalt da: Der Zeitpunkt wurde nie notiert.
    // Eine Eingabe dagegen ist eine Änderung, auch wenn die Liste gleich aussieht.
    const gabEsSchon = !eingabe && !eintrag && (davor ??= vorher === jetzt ? inhalte : listenInhalte(vorher, klassen)).get(schluessel) === inhalt
    const unbekannt = gabEsSchon || zeit === undefined || !Number.isFinite(zeit)
    neu[schluessel] = unbekannt ? { inhalt } : { inhalt, zeit }
  }
  // Eine Klasse, deren Listen alle entfallen (ihr letzter Wert gelöscht, alle Eingaben gelöscht,
  // ihr letzter Starter weg), verlöre sonst ihren Zeitpunkt – und die Mannschaftswertung fiele
  // auf den der übrigen Klassen ZURÜCK, obwohl sie sich gerade geändert hat. Deshalb bleibt für
  // die Klasse ein Eintrag ohne Liste stehen ({@link KEINE_LISTE}) mit dem Zeitpunkt des
  // Wegfalls; ist der nicht bekannt, mit dem jüngsten, den ihre Listen trugen.
  for (const klasse of klassen) {
    const schluessel = gesamtListenSchluessel(disziplin, klasse)
    if (inhalte.has(schluessel)) continue
    const vorsatz = `${disziplin}/${klasse}/`
    const alte = Object.entries(bisher).filter(([k]) => k.startsWith(vorsatz))
    if (alte.length === 0) continue
    if (alte.length === 1 && alte[0][0] === schluessel && alte[0][1].inhalt === KEINE_LISTE) {
      neu[schluessel] = alte[0][1]
      continue
    }
    geaendert = true
    const wann = zeit !== undefined && Number.isFinite(zeit) ? zeit : juengste(alte.map(([, eintrag]) => zeitVon(eintrag)))
    neu[schluessel] = wann === undefined ? { inhalt: KEINE_LISTE } : { inhalt: KEINE_LISTE, zeit: wann }
  }
  if (!geaendert && Object.keys(neu).length === Object.keys(bisher).length) return bisher
  return neu
}

/**
 * „Prüfsumme“ des Eintrags einer Klasse, die gerade keine Ergebnisliste hat: Er hält nur den
 * Zeitpunkt fest, zu dem ihre Listen entfielen. Keine echte Liste trägt diesen Wert (ihre
 * Prüfsumme geht über einen nie leeren Text); bekommt die Klasse wieder Werte, passt er nicht
 * zur neuen Liste, und die erhält wie jede geänderte den Zeitpunkt der Eingabe.
 */
export const KEINE_LISTE = 0

const KEINE: ReadonlySet<string> = new Set()

/** Der Haken „erfasst“ geht nicht in die Wertung ein (lib/eingaben.ts `erfasstKennung`) – er ist keine Änderung der Liste. */
const zaehlt = (feld: string) => !feld.startsWith('erfasst@')

/**
 * Die Listen, in denen sich zwischen zwei Ständen der Eingaben ein Wert geändert hat (gesetzt,
 * geändert, gelöscht): die Liste von Klasse und Lauf und die Gesamtliste der Klasse; ein Wert
 * ohne Lauf (Knoten) nur die Gesamtliste. Für `listenStandNach(…, erzwungen)`.
 */
export function geaenderteListen(vorher: Pick<AppState, 'eingaben' | 'starters'>, jetzt: Pick<AppState, 'eingaben' | 'starters'>): Set<string> {
  const listen = new Set<string>()
  if (vorher.eingaben === jetzt.eingaben) return listen
  const klasseVon = new Map<string, ClassId>([...vorher.starters, ...jetzt.starters].map((p) => [p.id, p.klasse]))
  for (const lauf of new Set([...Object.keys(vorher.eingaben), ...Object.keys(jetzt.eingaben)])) {
    const alt = vorher.eingaben[lauf] ?? {}
    const neu = jetzt.eingaben[lauf] ?? {}
    if (alt === neu) continue
    const { disziplin, lauf: nr } = zerlegeLauf(lauf)
    for (const starter of new Set([...Object.keys(alt), ...Object.keys(neu)])) {
      const a = alt[starter] ?? {}
      const b = neu[starter] ?? {}
      if (a === b) continue
      const anders = [...new Set([...Object.keys(a), ...Object.keys(b)])].some((feld) => zaehlt(feld) && (a[feld] ?? '') !== (b[feld] ?? ''))
      const klasse = klasseVon.get(starter)
      if (!anders || klasse === undefined) continue
      if (nr !== OHNE_LAUF) listen.add(laufListenSchluessel(disziplin, klasse, nr))
      listen.add(gesamtListenSchluessel(disziplin, klasse))
    }
  }
  return listen
}

const zeitVon = (eintrag: ListenStand | undefined) => (typeof eintrag?.zeit === 'number' && Number.isFinite(eintrag.zeit) ? eintrag.zeit : undefined)
const iso = (zeit: number | undefined) => (zeit === undefined ? '' : new Date(zeit).toISOString())
const juengste = (zeiten: (number | undefined)[]) => zeiten.reduce<number | undefined>((a, b) => (b !== undefined && (a === undefined || b > a) ? b : a), undefined)

/**
 * Der Zeitpunkt der Gesamtliste einer Klasse: der jüngste ihrer Lauf-Listen und ihr eigener
 * (Knoten, Streichläufe ändern sie ohne einen Lauf). Als ISO-Text; leer, wenn keiner bekannt ist.
 */
export function gesamtZeit(listenStand: AppState['listenStand'], disziplin: string, klasse: string): string {
  const vorsatz = `${disziplin}/${klasse}/`
  return iso(juengste(Object.entries(listenStand).filter(([schluessel]) => schluessel.startsWith(vorsatz)).map(([, eintrag]) => zeitVon(eintrag))))
}

/**
 * Der Zeitpunkt der Mannschaftswertung: der jüngste der Gesamtlisten aller Klassen der
 * Disziplin – und damit jeder Ergebnisliste. Sie führt keinen eigenen Stand: Niemand soll eine
 * Ergebnisliste finden, die neuer ist als die Mannschaftswertung, auch wenn eine Eingabe deren
 * Punkte gar nicht verändert. Als ISO-Text; leer, wenn keiner bekannt ist.
 */
export function wertungZeit(listenStand: AppState['listenStand'], disziplin: string): string {
  const vorsatz = `${disziplin}/`
  return iso(juengste(Object.entries(listenStand).filter(([schluessel]) => schluessel.startsWith(vorsatz)).map(([, eintrag]) => zeitVon(eintrag))))
}

/** Der Zeitpunkt einer Liste als ISO-Text für `formatDateTime`; leer, wenn er nicht bekannt ist. */
export function standZeit(listenStand: AppState['listenStand'], schluessel: string): string {
  const zeit = listenStand[schluessel]?.zeit
  return typeof zeit === 'number' && Number.isFinite(zeit) ? new Date(zeit).toISOString() : ''
}
