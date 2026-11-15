import { PRINT_RESERVE_MM, PX_PER_MM, printableHeightPx } from './paging'

// Seitenteilung der Listen, die keine Wettkampfrichter-Bögen sind: Starter-, Vorsteg-,
// Gewichts- und Ergebnislisten. Früher überließen sie den Umbruch dem Browser und ließen ihn
// im Seitenrand zählen – über den ganzen Druckauftrag („Seite 58 von 178“). Jetzt ist jede
// Liste ein Dokument, das sich selbst in Seiten teilt und seine Seitenzahl selbst schreibt
// (components/ListenDokument.vue). Hier steht nur die Rechnung, ohne DOM.

/** Ein Stück eines Blocks auf einer Seite: die Zeilen `von` (einschließlich) bis `bis` (ausschließlich). */
export interface SeitenTeil {
  block: number
  von: number
  bis: number
}

/** So viele Zeilen stehen mindestens auf dem letzten Stück eines geteilten Blocks – kein Blatt für eine einzelne Zeile. */
const MIN_REST = 3

/**
 * Zeilenblöcke auf Seiten verteilen. `laengen` = Zeilen je Block (bei der Liste nach Klasse
 * je Klasse einer, sonst ein einziger), `kapazitaet` = Platz je Seite; 0 = unbekannt → alles
 * auf eine Seite.
 *
 * Ohne `hoehe` zählt jede Zeile 1, die Kapazität ist dann die Zahl der Zeilen je Seite. Mit
 * `hoehe` (gemessene Höhe jeder Zeile) ist sie der Platz in derselben Einheit: So stimmt die
 * Teilung auch, wenn einzelne Zeilen höher sind als die anderen (zweizeilige Herkunft auf
 * der Ergebnisliste).
 *
 * - Ein Block bleibt zusammen: Passt er nicht mehr auf die laufende Seite, aber auf eine
 *   ganze, beginnt er auf der nächsten.
 * - Ein Block, der größer ist als eine Seite, wird geteilt. Er beginnt auf der laufenden
 *   Seite, wenn dort noch mindestens {@link MIN_REST} Zeilen Platz haben; die Seiten werden
 *   gefüllt. Auf dem letzten Stück stehen mindestens {@link MIN_REST} Zeilen, soweit die
 *   Seite davor sie abgeben kann, ohne selbst darunter zu fallen.
 * - Eine Zeile, die allein höher ist als eine Seite, bekommt trotzdem eine – sonst ginge sie
 *   verloren.
 * - Leere Blöcke belegen nichts.
 * - `wiederholt` (Höhe je Block, sonst 0): Platz, den eine Seite zusätzlich braucht, wenn sie
 *   mit der FORTSETZUNG dieses Blocks beginnt – dort wiederholt die Liste etwas im Kopf (die
 *   Spaltenköpfe des Herkunftsblocks der UIM-Mannschaftswertung). Er geht vom Platz dieser
 *   Seite ab, auch für die Blöcke, die danach auf ihr stehen.
 *
 * Liefert immer mindestens eine (ggf. leere) Seite; keine Seite außer dieser ist leer.
 */
export function listenSeiten(
  laengen: readonly number[],
  kapazitaet: number,
  hoehe: (block: number, zeile: number) => number = () => 1,
  wiederholt: (block: number) => number = () => 0,
): SeitenTeil[][] {
  if (!(kapazitaet > 0)) return [laengen.flatMap((n, block) => (n > 0 ? [{ block, von: 0, bis: n }] : []))]
  const kap = kapazitaet
  const seiten: SeitenTeil[][] = [[]]
  let frei = kap
  const neueSeite = () => {
    if (seiten[seiten.length - 1].length === 0) return
    seiten.push([])
    frei = kap
  }
  laengen.forEach((n, block) => {
    if (n <= 0) return
    const h = Array.from({ length: n }, (_, zeile) => Math.max(0, hoehe(block, zeile)))
    const summe = (von: number, bis: number) => h.slice(von, bis).reduce((x, y) => x + y, 0)
    const ganz = summe(0, n)
    const abzug = Math.max(0, wiederholt(block))
    if (ganz <= frei) {
      seiten[seiten.length - 1].push({ block, von: 0, bis: n })
      frei -= ganz
      return
    }
    // Passt er auf eine ganze Seite, bleibt er zusammen. Sonst beginnt er hier nur, wenn Platz für ein ordentliches Stück ist.
    if (ganz <= kap || summe(0, Math.min(MIN_REST, n)) > frei) neueSeite()
    // Grenzen der Stücke: Seiten füllen, der Rest steht zuletzt.
    const grenzen = [0]
    let platz = frei
    let belegt = 0
    for (let zeile = 0; zeile < n; zeile++) {
      // Mindestens eine Zeile je Stück – auch eine, die höher ist als das Blatt.
      if (belegt + h[zeile] > platz && zeile > grenzen[grenzen.length - 1]) {
        grenzen.push(zeile)
        platz = kap - abzug
        belegt = 0
      }
      belegt += h[zeile]
    }
    grenzen.push(n)
    // Kein Blatt für eine einzelne Zeile: Das letzte Stück holt sich Zeilen vom vorletzten,
    // solange diesem selbst genug bleiben und das letzte auf seine (eigene) Seite passt.
    const letztes = grenzen.length - 2
    while (
      letztes > 0 &&
      n - grenzen[letztes] < MIN_REST &&
      grenzen[letztes] - grenzen[letztes - 1] > MIN_REST &&
      summe(grenzen[letztes] - 1, n) <= kap - abzug
    ) {
      grenzen[letztes]--
    }
    for (let i = 0; i + 1 < grenzen.length; i++) {
      if (i > 0) {
        neueSeite()
        frei -= abzug
      }
      seiten[seiten.length - 1].push({ block, von: grenzen[i], bis: grenzen[i + 1] })
      frei -= summe(grenzen[i], grenzen[i + 1])
    }
  })
  return seiten
}

/**
 * Höhe der Zeile mit der Seitenzahl unter der Tabelle (styles/app.css `.listen-seitenzahl`).
 * Sie zählt bei der Messung immer mit – auch solange die Liste nur eine Seite hat und keine
 * Zahl zeigt: Sonst passte eine Zeile mehr auf das Blatt, sobald die Zahl verschwindet, und
 * die Aufteilung spränge hin und her.
 */
export const SEITENZAHL_MM = 5

/**
 * Höhe des Fußes der Ergebnislisten (styles/ergebnis.css `.erg-fuss`): 4 mm Abstand zur
 * Tabelle, darunter eine Zeile mit dem Hinweis zum Stichentscheid, der Seitenzahl und dem
 * Feld mit dem Zeitstempel der letzten Änderung. Fest wie {@link SEITENZAHL_MM}, auch wenn auf einer Seite nichts
 * davon steht – sonst hinge die Aufteilung davon ab, ob es gerade einen Stichentscheid gibt.
 */
export const ERGEBNIS_FUSS_MM = 12

/**
 * Platz für die Zeilen einer Seite in px, aus der Messung der ersten Seite: `fixedPx` = alles
 * außer den Zeilen (Kopf, Spaltenköpfe), `hoeheMm` = Blatthöhe. Abgezogen werden wie bei den
 * Bögen der Druckrand und die Reserve (lib/paging.ts), dazu der Fuß der Seite: `fussMm`,
 * ohne Angabe die Zeile der Seitenzahl.
 */
export function zeilenPlatzPx(fixedPx: number, hoeheMm: number, fussMm: number = SEITENZAHL_MM): number {
  return printableHeightPx(hoeheMm) - (PRINT_RESERVE_MM + fussMm) * PX_PER_MM - fixedPx
}

/**
 * Toleranzen beim Nachmessen (components/ListenDokument.vue): Eine neue Messung gilt nur,
 * wenn sie sich um mehr als das von der alten unterscheidet – Rundungsrauschen des Browsers
 * soll die Aufteilung nicht hin- und herschalten. Enger als bei den Bögen (BogenBlatt.vue:
 * 2 px / 0,5 px), weil hier die Höhen vieler Zeilen zusammengezählt werden.
 */
export const MESS_TOLERANZ_KOPF_PX = 1
export const MESS_TOLERANZ_ZEILE_PX = 0.25

/**
 * Die Zeilen einer Seite aus einer Liste mit einem einzigen Block (Ergebnislisten): je Zeile
 * auch ihre Stelle `i` in der ganzen Liste – daran hängen graue Zeile und Abstand, nicht an
 * der Stelle auf der Seite.
 */
export function zeilenDerSeite<T>(zeilen: readonly T[], teile: readonly SeitenTeil[]): { z: T; i: number }[] {
  return teile.flatMap((teil) => zeilen.slice(teil.von, teil.bis).map((z, j) => ({ z, i: teil.von + j })))
}

/**
 * Zeilen je Seite, solange nichts gemessen ist: vor dem ersten Zeichnen und überall, wo es
 * kein Layout gibt (Tests). In Chromium gemessen und knapp darunter angesetzt – der Browser
 * misst gleich nach dem Einhängen nach.
 */
export const SEITEN_VORGABE = {
  /** Starter komplett, Vorsteg, nach Klasse (A4 hoch). */
  starter: 40,
  /** Gewichtslisten (A4 quer, hohe Zeilen). */
  gewicht: 15,
  /** Ausgleichsgewichte für den Steg (A4 hoch, je Klasse ein Dokument). */
  ausgleich: 30,
  /** Ergebnisliste eines Laufs (A4 quer). */
  ergebnisLauf: 30,
  /** Gesamtliste einer Klasse (A4 quer). */
  ergebnisGesamt: 30,
  /** Starterliste einer Herkunft nach Startnummer (A4 hoch). */
  starterHerkunft: 40,
  /** Mannschaftswertung nach Plätzen (A4 quer): eine Zeile je Herkunft. */
  pokalPlaetze: 30,
  /** Mannschaftswertung UIM (A4 hoch): Titel, Spaltenköpfe, Starter und Summe je Herkunft. */
  pokalUim: 50,
} as const
