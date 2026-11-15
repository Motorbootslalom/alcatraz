// Aufteilung der Zeilen eines Wettkampfrichter-Bogens auf Druckseiten. Unverändert aus dem
// Fehlerpunkte-Prototyp (lib/paging.ts): Das reine Modell (lib/bogen.ts) und die Ansicht
// (components/bogen/BogenBlatt.vue) teilen sich diese Regeln, damit Bildschirm und Druck
// dieselben Seiten bilden.

/** CSS-Pixel je Millimeter (CSS rechnet fest mit 96 dpi). */
export const PX_PER_MM = 96 / 25.4

/** Druckrand (@page margin) - die Bildschirm-Ansicht nutzt denselben Innenrand. */
export const PRINT_MARGIN_MM = 8

/**
 * Sicherheitsreserve je Druckseite für die automatische Aufteilung. Vorschau
 * und Druck setzen minimal verschieden (Schrift-Hinting, Pixelraster, Browser,
 * Druckertreiber): Eine Seite, die in der Vorschau auf den Zehntelmillimeter
 * passt (z. B. Steg mit 20 Startern + 3 Leerzeilen), bricht beim Drucken mit
 * Standard-Rändern sonst um.
 */
export const PRINT_RESERVE_MM = 5

/** Blatthöhe in mm: A4 hoch 297, quer 210. */
export function pageHeightMm(orientation: 'portrait' | 'landscape'): number {
  return orientation === 'landscape' ? 210 : 297
}

/** Nutzbare Höhe einer Druckseite in px (Blatthöhe minus Rand oben und unten). */
export function printableHeightPx(heightMm: number): number {
  return (heightMm - 2 * PRINT_MARGIN_MM) * PX_PER_MM
}

/**
 * Wie viele Zeilen zu viel stehen auf einer Seite, damit sie noch auf ein
 * A4-Blatt passt? `contentPx` = Höhe des Bogen-Inhalts (Tabelle) am
 * Bildschirm, der dieselben Maße wie die Druckseite hat. 0 = passt
 * (1 px Toleranz für Rundung).
 */
export function overflowRows(contentPx: number, heightMm: number, rowPx: number): number {
  const overflow = contentPx - printableHeightPx(heightMm)
  if (overflow <= 1) return 0
  return rowPx > 0 ? Math.ceil(overflow / rowPx) : 1
}

/**
 * Wie viele Tabellenzeilen (Starter + Leerzeilen) passen auf eine Druckseite?
 * `fixedPx` = alles außer den Zeilen: Kopf, Spaltenköpfe, Legende/Bild,
 * Unterschrift. Unten bleibt {@link PRINT_RESERVE_MM} frei.
 */
export function rowsThatFit(fixedPx: number, rowPx: number, heightMm: number): number {
  if (rowPx <= 0) return 0
  const usablePx = printableHeightPx(heightMm) - PRINT_RESERVE_MM * PX_PER_MM
  return Math.max(0, Math.floor((usablePx - fixedPx) / rowPx))
}

/**
 * Automatische Seitengröße: Passen alle `n` Starter auf eine Seite (höchstens
 * `capacity`), bleibt es eine. Sonst so wenige Seiten wie möglich, gleichmäßig
 * geteilt und auf 5er-Schritte aufgerundet (Mitte, Drittel, …): 24 Starter bei
 * höchstens 20 pro Seite → 15 + 9, 58 → 20 + 20 + 18. Kostete das Aufrunden
 * eine zusätzliche Seite, bleibt es beim gleichmäßigen Teilen: 20 bei
 * höchstens 9 → 7 + 7 + 6 (statt 5 + 5 + 5 + 5).
 * `capacity` 0 = unbekannt → eine Seite.
 */
export function autoPageSize(n: number, capacity: number): number {
  if (capacity <= 0 || n <= capacity) return n
  const pages = Math.ceil(n / capacity)
  const even = Math.ceil(n / pages)
  const rounded = Math.ceil(even / 5) * 5
  return rounded <= capacity ? rounded : even
}

function sliceBy<T>(items: T[], size: number): T[][] {
  if (size <= 0 || items.length <= size) return [items]
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Startnummern in Seiten-Blöcke aufteilen.
 *
 * - `rowsPerPage` 0 = automatisch: mit gemessener `autoCapacity` (Starter je
 *   Seite) nach {@link autoPageSize}; ohne Messung (react-pdf-Insel,
 *   pdfmake/jsPDF) eine durchlaufende Seite.
 * - `rowsPerPage` > 0 = fest nach so vielen Startern; mit `splitFrom` > 0 nur
 *   Klassen mit **mindestens** so vielen Startern (z. B. ab 25 je 15 pro Seite,
 *   16-24 bleiben zusammen). Ergäbe das eine Seite, die laut Messung nicht aufs
 *   Blatt passt, gilt die automatische Aufteilung - Beschreibung und
 *   Unterschrift sollen nie auf eine eigene Seite rutschen.
 *
 * Liefert immer mindestens einen (ggf. leeren) Block.
 */
export function pageChunks<T>(items: T[], rowsPerPage: number, splitFrom = 0, autoCapacity = 0): T[][] {
  const auto = () => sliceBy(items, autoPageSize(items.length, autoCapacity))
  if (rowsPerPage <= 0) return auto()
  const split = items.length > rowsPerPage && items.length >= splitFrom
  const fixed = split ? sliceBy(items, rowsPerPage) : [items]
  return autoCapacity > 0 && fixed.some((c) => c.length > autoCapacity) ? auto() : fixed
}

/** Ein Stück eines Blocks auf einer Seite: die Zeilen `von` (einschließlich) bis `bis` (ausschließlich). */
export interface BlockTeil {
  block: number
  von: number
  bis: number
}

/** So viele Starter stehen mindestens auf dem letzten Stück einer geteilten Klasse. */
const MIN_REST = 3

/**
 * Mehrere Blöcke (Klassen) auf Seiten verteilen – für Listen, auf denen mehrere Klassen
 * untereinander stehen (Clubmeisterschaft). `laengen` = Zeilen je Block (Starter und
 * Leerzeilen); jedes Stück kostet zusätzlich eine Zeile für seine Zwischenüberschrift.
 * `kapazitaet` = Tabellenzeilen je Seite, 0 = unbekannt → alles auf eine Seite.
 * `leer` = wie viele Zeilen am Ende jedes Blocks Leerzeilen sind (fehlt = keine).
 *
 * Papier sparen und doch keine Klasse unnötig trennen:
 * - Ein Block bleibt zusammen und rückt auf die nächste Seite, wenn er auf der laufenden
 *   keinen Platz mehr hat.
 * - Leerzeilen sind kein Grund für ein weiteres Blatt: Passt ein Block nur wegen seiner
 *   Leerzeilen nicht auf eine Seite, entfallen so viele, dass er passt – mindestens eine
 *   bleibt. Starter entfallen nie. Die Stücke enden dann vor der Länge des Blocks.
 * - Nur ein Block, dessen Starter allein nicht auf eine Seite passen, wird geteilt. Er
 *   beginnt auf der laufenden Seite, wenn er dadurch nicht in mehr Stücke zerfällt (das spart
 *   ein Blatt); die Seiten werden gefüllt, damit hinter dem Rest die nächste Klasse Platz
 *   hat. Auf dem letzten Stück stehen aber mindestens {@link MIN_REST} Starter – kein Blatt
 *   nur für eine Zeile oder nur für Leerzeilen.
 *
 * Liefert immer mindestens eine (ggf. leere) Seite.
 */
export function blockSeiten(laengen: readonly number[], kapazitaet: number, leer: readonly number[] = []): BlockTeil[][] {
  if (kapazitaet <= 0) return [laengen.map((n, block) => ({ block, von: 0, bis: n }))]
  // Überschrift und mindestens eine Zeile müssen auf eine Seite passen.
  const kap = Math.max(2, kapazitaet)
  /** Zeilen eines Stücks auf einer leeren Seite. */
  const voll = kap - 1
  const seiten: BlockTeil[][] = [[]]
  let frei = kap
  const neueSeite = () => {
    if (seiten[seiten.length - 1].length === 0) return
    seiten.push([])
    frei = kap
  }
  laengen.forEach((n, block) => {
    if (n + 1 <= frei) {
      seiten[seiten.length - 1].push({ block, von: 0, bis: n })
      frei -= n + 1
      return
    }
    const leerzeilen = Math.max(0, Math.min(n, leer[block] ?? 0))
    const starter = n - leerzeilen
    // Was mindestens unterkommen muss: alle Starter und, wenn es Leerzeilen gibt, eine davon.
    const mindestens = starter + Math.min(1, leerzeilen)
    const stuecke = Math.max(1, Math.ceil(mindestens / voll))
    let platz = Array.from({ length: stuecke }, () => voll)
    // Auf der laufenden Seite beginnen: nur ein geteilter Block, nur mit genug Platz für ein
    // ordentliches Stück, und nur wenn dadurch weder ein Stück noch eine Leerzeile mehr entfällt.
    const angefangen = [frei - 1, ...platz.slice(1)]
    const summe = (a: number[]) => a.reduce((x, y) => x + y, 0)
    if (stuecke > 1 && frei - 1 >= Math.min(MIN_REST, voll) && summe(angefangen) >= Math.min(n, summe(platz))) platz = angefangen
    else neueSeite()
    const zeilen = Math.min(n, summe(platz))
    // Seiten füllen; der Rest steht auf dem letzten Stück.
    const teile: number[] = []
    let rest = zeilen
    for (const p of platz) {
      teile.push(Math.min(p, rest))
      rest -= teile[teile.length - 1]
    }
    if (stuecke > 1) {
      const letztes = stuecke - 1
      const leerDort = Math.min(teile[letztes], zeilen - starter)
      const fehlen = Math.min(MIN_REST, starter) - (teile[letztes] - leerDort)
      const schieben = Math.max(0, Math.min(fehlen, teile[letztes - 1] - 1, platz[letztes] - teile[letztes]))
      teile[letztes - 1] -= schieben
      teile[letztes] += schieben
    }
    let von = 0
    teile.forEach((laenge, i) => {
      if (i > 0) neueSeite()
      seiten[seiten.length - 1].push({ block, von, bis: von + laenge })
      frei -= laenge + 1
      von += laenge
    })
  })
  return seiten
}

/**
 * Unteilbare Gruppen auf Seiten verteilen – für Listen, deren Zeilen in Blöcken
 * zusammengehören (Parallelslalom: ein Block der Startreihenfolge, lib/parallelBogen.ts).
 * `laengen` = Zeilen je Gruppe, `kapazitaet` = Tabellenzeilen je Seite, 0 = unbekannt → alles
 * auf eine Seite. Liefert je Seite die Nummern ihrer Gruppen, immer mindestens eine (ggf.
 * leere) Seite.
 *
 * - Eine Seite endet **nur am Ende einer Gruppe**: Keine Gruppe wird geteilt. Eine Gruppe, die
 *   allein nicht auf eine Seite passt, steht für sich auf einer – die Ansicht meldet dann, dass
 *   das Blatt überläuft, statt die Gruppe zu zerreißen.
 * - So wenige Seiten wie möglich (Entscheidung des Nutzers vom 15.11.2026): so viele, wie es
 *   braucht, wenn jede Seite der Reihe nach so voll wie möglich gefüllt wird.
 * - Seiten ausgleichen (Entscheidung des Nutzers vom 15.11.2026, abends): Auf diese Zahl von
 *   Seiten werden die Gruppen gleichmäßig verteilt – statt 32 + 34 + 4 Starts also 24 + 24 + 22.
 *   Erst wird die kleinste Obergrenze je Seite gesucht, mit der es bei dieser Seitenzahl bleibt.
 *   Dann werden die Gruppen so auf die Seiten gelegt, dass die kürzeste Seite so lang wie möglich
 *   ist ({@link gruppenVerteilen}): 40 Starts in Blöcken zu 4 auf vier Seiten zu höchstens 12
 *   also 12 + 12 + 8 + 8, nicht 12 + 12 + 12 + 4. Der Reihe nach bis zur Obergrenze zu füllen,
 *   ließe den ganzen Rest auf dem letzten Blatt. Keine Seite trägt mehr als `kapazitaet`.
 *
 * Anders als {@link blockSeiten} kostet eine Gruppe keine Zwischenüberschrift, und es gibt
 * keine Leerzeilen.
 */
export function gruppenSeiten(laengen: readonly number[], kapazitaet: number): number[][] {
  const alle = laengen.map((_, i) => i)
  if (kapazitaet <= 0 || alle.length === 0) return [alle]
  const seiten = gruppenFuellen(laengen, kapazitaet)
  if (seiten.length < 2) return seiten
  // Die kleinste Obergrenze, mit der es bei so vielen Seiten bleibt. Weniger als die größte
  // Gruppe geht nicht (sie stünde sonst allein und zählte doppelt), weniger als der Schnitt auch nicht.
  const summe = laengen.reduce((a, b) => a + b, 0)
  let unten = Math.max(Math.ceil(summe / seiten.length), ...laengen.filter((n) => n <= kapazitaet))
  let oben = kapazitaet
  while (unten < oben) {
    const mitte = Math.floor((unten + oben) / 2)
    if (gruppenFuellen(laengen, mitte).length <= seiten.length) oben = mitte
    else unten = mitte + 1
  }
  return gruppenVerteilen(laengen, seiten.length, oben) ?? gruppenFuellen(laengen, oben)
}

/**
 * Die Gruppen der Reihe nach auf genau `seitenzahl` Seiten mit höchstens `grenze` Zeilen (eine
 * zu große Gruppe steht für sich), so dass die kürzeste Seite so lang wie möglich ist. Unter
 * gleich guten Verteilungen gilt die mit den volleren vorderen Seiten (28 + 24 + 24 + 24, nicht
 * 24 + 24 + 24 + 28): Der Rest steht hinten wie bisher, nur eben nicht mehr allein.
 * `undefined`, wenn es so nicht geht.
 *
 * Gerechnet wird über die Grenzen zwischen den Gruppen von hinten nach vorn: Für jede Gruppe und
 * jede Zahl übriger Seiten die längste kürzeste Seite, die ab dort erreichbar ist. Eine Liste
 * hat höchstens einige Dutzend Blöcke, das ist schnell.
 */
function gruppenVerteilen(laengen: readonly number[], seitenzahl: number, grenze: number): number[][] | undefined {
  const n = laengen.length
  const bis = [0]
  for (const l of laengen) bis.push(bis[bis.length - 1] + l)
  const zeilen = (von: number, ende: number) => bis[ende] - bis[von]
  const passt = (von: number, ende: number) => ende - von === 1 || zeilen(von, ende) <= grenze
  // beste[r][i]: die längste kürzeste Seite, wenn die Gruppen ab i auf genau r Seiten stehen; -1 = geht nicht.
  const beste = Array.from({ length: seitenzahl + 1 }, () => new Array<number>(n + 1).fill(-1))
  beste[0][n] = Infinity
  for (let r = 1; r <= seitenzahl; r++) {
    for (let i = n - 1; i >= 0; i--) {
      for (let ende = i + 1; ende <= n && passt(i, ende); ende++) {
        if (beste[r - 1][ende] >= 0) beste[r][i] = Math.max(beste[r][i], Math.min(zeilen(i, ende), beste[r - 1][ende]))
      }
    }
  }
  const ziel = beste[seitenzahl][0]
  if (ziel < 0) return undefined
  // Von vorn: jede Seite so voll wie möglich, solange die übrigen das Ziel noch erreichen.
  const seiten: number[][] = []
  let i = 0
  for (let r = seitenzahl; r > 0; r--) {
    let ende = i + 1
    for (let weiter = i + 1; weiter <= n && passt(i, weiter); weiter++) {
      if (zeilen(i, weiter) >= ziel && beste[r - 1][weiter] >= ziel) ende = weiter
    }
    seiten.push(Array.from({ length: ende - i }, (_, k) => i + k))
    i = ende
  }
  return seiten
}

/** Die Gruppen der Reihe nach auf Seiten mit höchstens `grenze` Zeilen; eine zu große Gruppe steht für sich. */
function gruppenFuellen(laengen: readonly number[], grenze: number): number[][] {
  const seiten: number[][] = [[]]
  let belegt = 0
  laengen.forEach((n, gruppe) => {
    if (belegt > 0 && belegt + n > grenze) {
      seiten.push([])
      belegt = 0
    }
    seiten[seiten.length - 1].push(gruppe)
    belegt += n
  })
  return seiten
}

/**
 * Wie viele Zeilen eine Seite einer Liste aus unteilbaren Gruppen höchstens trägt
 * ({@link gruppenSeiten}): das, was gemessen auf ein Blatt passt (`gemessen`, 0 = unbekannt) –
 * und, wenn „Zeilen je Seite“ fest gewählt ist (`zeilenJeSeite` > 0), höchstens so viele. Wie
 * bei den Bögen einer Klasse ({@link pageChunks}) gilt die feste Zahl erst für Listen mit mehr
 * Zeilen als das und mit mindestens `teilenAb` Zeilen. Die Zahl ist eine Obergrenze: Weil eine
 * Seite nur am Ende einer Gruppe endet, stehen dort so viele Zeilen, wie ganze Gruppen
 * hineinpassen. 0 = unbekannt und nichts gewählt → eine Seite.
 */
export function gruppenKapazitaet(zeilen: number, gemessen: number, zeilenJeSeite = 0, teilenAb = 0): number {
  const fest = zeilenJeSeite > 0 && zeilen > zeilenJeSeite && zeilen >= teilenAb ? zeilenJeSeite : 0
  if (fest <= 0) return Math.max(0, gemessen)
  return gemessen > 0 ? Math.min(fest, gemessen) : fest
}
