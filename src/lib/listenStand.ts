import { configFor } from '../config/konfig'
import { CLASS_IDS } from '../domain/classes'
import type { AppState, ClassId, ListenStand } from '../types'
import { klassenErgebnis, type GesamtListe, type LaufListe } from './ergebnis'

// Wann sich eine Ergebnisliste zuletzt geändert hat – rein, ohne Uhr. Vorbild:
// `aktuellerListenStand` im Fehlerpunkte-Prototyp (lib/ergebnis.ts). Der Zeitpunkt steht auf
// der Liste: Hängen zwei Fassungen aus, sagt er, welche die neuere ist – anders als der
// Druckzeitpunkt im Seitenrand, der sich bei jedem Nachdruck ändert.
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
// Unbekannt statt erfunden: Eine Liste, die es schon gab, deren Zeitpunkt aber nie notiert
// wurde (Stand aus der Zeit vor dieser Angabe), bekommt die Prüfsumme ohne Zeitpunkt – erst
// ihre nächste Änderung setzt einen. Ebenso eine Änderung durch eine Action ohne `zeit`.

/** Was die Ergebnislisten bestimmt; ändert sich davon nichts, bleibt der Stand, wie er ist. */
const WERTUNG = ['eingaben', 'starters', 'laufCount', 'streichlaeufe', 'aufbau', 'regelwerk', 'eigeneAufbauten'] as const
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
    if (eintrag?.inhalt === inhalt) {
      neu[schluessel] = eintrag
      continue
    }
    geaendert = true
    // Ohne Eintrag, aber schon vorher mit diesem Inhalt da: Der Zeitpunkt wurde nie notiert.
    const gabEsSchon = !eintrag && (davor ??= vorher === jetzt ? inhalte : listenInhalte(vorher, klassen)).get(schluessel) === inhalt
    const unbekannt = gabEsSchon || zeit === undefined || !Number.isFinite(zeit)
    neu[schluessel] = unbekannt ? { inhalt } : { inhalt, zeit }
  }
  if (!geaendert && Object.keys(neu).length === Object.keys(bisher).length) return bisher
  return neu
}

/** Der Zeitpunkt einer Liste als ISO-Text für `formatDateTime`; leer, wenn er nicht bekannt ist. */
export function standZeit(listenStand: AppState['listenStand'], schluessel: string): string {
  const zeit = listenStand[schluessel]?.zeit
  return typeof zeit === 'number' && Number.isFinite(zeit) ? new Date(zeit).toISOString() : ''
}
