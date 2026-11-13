import type { BogenTexte } from '../config/sprache'
import type { CellKind, Column, SheetDef, TrennerDesign } from '../types'
import { blockSeiten, pageChunks } from './paging'
import { seitenCode } from './qr'
import { veranstaltungsListen, type ListenWahl, type ListenWahlKonfig } from './listen'

// Reines Modell eines Wettkampfrichter-Bogens (WKR-Liste, Beobachtungsbogen): Spalten je
// Klasse, Blatt-/Unterspalten, Zeilen, Kopf, Bild und Seitenaufteilung – ohne DOM und ohne
// Stand. Vorbild: lib/sheetModel.ts, scoring.ts (columnsForClass, defFuerKlasse) und
// backside.ts im Fehlerpunkte-Prototyp.
//
// Anders als dort hängt das Modell nicht am Zustand: Zeilen, Klasse(n), Kopfangaben und
// Konfiguration kommen von außen. So zeichnet dieselbe Funktion die Beispielansicht
// (Muster-Startnummern) und später die echten Listen – auch die der Clubmeisterschaft, auf
// denen mehrere Klassen auf einer Seite stehen.
//
// Eingabe der Werte und Wertung gehören nicht dazu (lib/eingaben.ts, lib/ergebnis.ts). Jede
// Zeile trägt einen Schlüssel (`key`, die Starter-ID), jede Zelle `colKey`/`subIndex` –
// daraus entsteht der Zellschlüssel der Erfassung –, und `anzeige` füllt die Zellen. Den
// QR-Code bringt der Auftrag als Text mit (lib/qr.ts); hier kommt nur die Seite dazu.

/** Was das Modell von der Konfiguration braucht (config/konfig.ts `Konfig`). */
export interface BogenKonfig {
  getSheetDef(typeId: string): SheetDef
  /** Hat die Klasse diese Liste überhaupt (z. B. Mann-über-Bord erst ab Klasse 4)? */
  positionAllowsClass(typeId: string, klasse: string): boolean
  bildDatei(aufbauId: string, klasse: string): string
  getBogenTexte(): BogenTexte
}

/** Eine Zeile des Bogens, wie sie von außen kommt. */
export interface BogenZeile {
  /** Startnummer, wie sie gedruckt wird. */
  nr: string
  /** Kennung des Starters: Daran hängen später die Eingaben, nicht an der Startnummer. */
  id?: string
  /** Klasse des Starters; nötig, wenn mehrere Klassen auf dem Bogen stehen. */
  klasse?: string
}

/** Ein Bogen: eine Liste (Position) für eine oder mehrere Klassen in einem Lauf. */
export interface BogenAuftrag {
  typeId: string
  /** Die Klassen auf dem Bogen; meist eine, bei der Clubmeisterschaft mehrere. */
  klassen: readonly string[]
  lauf: number
  zeilen: readonly BogenZeile[]
  eventName: string
  /** Der Aufbau: Er bestimmt über seine Kursvariante das Parcoursbild. */
  aufbauId: string
  /** Name des Parcours im Kopf; leer lassen, wenn es nur einen gibt. */
  parcours?: string
  /** Name des Wettkampfrichters im Kopf. */
  wkr?: string
  /**
   * Ohne Parcoursbild: für gemeinsame Bögen von Klassen mit verschiedenen Zeichnungen
   * (Clubmeisterschaft, Papier sparen) – ein fremdes Bild wäre schlimmer als keines.
   */
  ohneBild?: boolean
  /**
   * Inhalt des QR-Codes ohne Seite (lib/qr.ts `bogenCode`); jede Druckseite hängt ihre Nummer
   * an. Fehlt = kein Code im Kopf.
   */
  qr?: string
}

export interface BogenOptionen {
  /**
   * Leere Zeilen nach den Startern, auf jeder Seite (Nachmeldungen, Wiederholer). Nähmen sie
   * auf einem Blatt mit wenig Platz mindestens so viele Zeilen ein wie die Starter, stehen
   * sie nur einmal am Ende des Bogens (siehe {@link bogenSeiten}).
   */
  leerzeilen?: number
  /** Starter je Seite; 0 = automatisch nach `kapazitaet`. */
  zeilenJeSeite?: number
  /** Erst ab so vielen Startern nach `zeilenJeSeite` teilen. */
  teilenAb?: number
  /** Gemessen: so viele Starter passen auf ein Blatt (0 = unbekannt, eine Seite). */
  kapazitaet?: number
  /**
   * Mehrere Klassen untereinander, jede mit Zwischenüberschrift (Clubmeisterschaft) – statt
   * einer Klassen-Spalte. Die Zeilen bleiben je Klasse in ihrer Reihenfolge; die Leerzeilen
   * stehen einmal am Ende jeder Klasse. Aufgeteilt wird nach `zeilenKapazitaet`, ohne eine
   * Klasse unnötig zu trennen; Leerzeilen, die allein ein weiteres Blatt kosteten, entfallen
   * bis auf eine (lib/paging.ts `blockSeiten`).
   */
  klassenBloecke?: boolean
  /** Abweichende Zahl der Leerzeilen je Klasse (nur mit `klassenBloecke`); fehlt = `leerzeilen`. */
  leerzeilenJeKlasse?: Readonly<Record<string, number>>
  /** Gemessen: so viele Tabellenzeilen (Starter, Leerzeilen, Zwischenüberschriften) passen auf ein Blatt. */
  zeilenKapazitaet?: number
  /** Füllt die Zellen, sobald es Eingaben gibt: Zeilenschlüssel, Spalte, Unter-Spalte → Text. */
  anzeige?: (zeile: string, colKey: string, subIndex?: number) => string
}

/** Vorgaben wie im Prototyp (`emptyRows: 3`, automatische Aufteilung). */
export const BOGEN_VORGABEN = { leerzeilen: 3, zeilenJeSeite: 0, teilenAb: 0 } as const

/** Ein „Blatt“ = genau eine Zelle je Zeile (Bojen-Unterspalten flach). */
export interface BogenBlattSpalte {
  colKey: string
  subIndex?: number
  kind: CellKind
  label: string
  grow?: number
  einzeln?: boolean
  /** Trennlinie am linken Rand; beim ersten Unter-Blatt die der Gruppe. */
  trenner?: TrennerDesign
  /** Trennlinie am rechten Rand (zwischen Unter-Spalten beidseitig getragen). */
  trennerR?: TrennerDesign
  /** Klassen, für die es die Spalte gibt; fehlt = alle. */
  klassen?: string[]
}

export interface BogenZelle {
  kind: CellKind
  /** Anzeigetext; ohne Eingaben leer. */
  display: string
  /** `false`: Die Klasse dieser Zeile hat die Spalte nicht (nur bei mehreren Klassen). */
  gilt: boolean
}

export interface BogenModellZeile {
  /**
   * Schlüssel der Zeile: die Starter-ID. Ohne ID (Muster-Zeilen) die Startnummer, bei
   * mehreren Klassen mit der Klasse davor – dieselbe Nummer in zwei Klassen ergäbe sonst
   * doppelte Schlüssel. Leerzeilen: `_p<Seite>_x<n>`.
   */
  key: string
  nr: string
  klasse?: string
  /** Die Klasse, wie sie in der Klassen-Spalte steht: der Name aus dem Regelwerk („Dolphin“), nicht die Kennung („E“). */
  klasseText?: string
  /** Zwischenüberschrift einer Klasse statt einer Starterzeile; `cells` ist dann leer. */
  zwischen?: string
  /** `false` = Leerzeile zum Nachtragen von Hand. */
  fixed: boolean
  /** Jede fünfte Zeile ist grau. */
  shaded: boolean
  /** Deckungsgleich zu `leaves`. */
  cells: BogenZelle[]
}

/** Das Parcoursbild eines Bogens: Zeichnung und Abblendung (lib/parcoursQuelle.ts). */
export interface BogenBild {
  datei: string
  vorgabe: { dim: string[]; aus: string[] }
  drehung: number
}

/** Eine Druckseite eines Bogens. */
export interface BogenSeite {
  typeId: string
  eventName: string
  titel: string
  klassen: string[]
  klassenText: string
  lauf: number
  /** Fehlt bei Listen ohne Lauf (Knoten). */
  laufText?: string
  parcours?: string
  wkr: string
  /** Inhalt des QR-Codes dieser Druckseite; fehlt = kein Code. */
  qr?: string
  orientation: 'portrait' | 'landscape'
  /** Oberste Spalten (für gruppierte Kopfzeilen), schon auf die Klassen beschränkt. */
  columns: Column[]
  leaves: BogenBlattSpalte[]
  /** Zweizeiliger Kopf: Mindestens eine Spalte hat Unter-Spalten. */
  twoRow: boolean
  /** Mehrere Klassen: Eine Spalte nennt die Klasse jeder Zeile. */
  zeigtKlasse: boolean
  rows: BogenModellZeile[]
  /** Die Position für diese Klassen: Legende, Hinweise, Bildlage. */
  def: SheetDef
  bild?: BogenBild
  texte: BogenTexte
  pageIndex: number
  pageCount: number
}

/**
 * Spalten, die für eine Klasse sichtbar sind. Spalten ohne `klassen` gelten für alle; sonst
 * nur, wenn die Klasse enthalten ist (z. B. Speed/MüB je Klasse).
 */
export function columnsForClass(columns: Column[], klasse: string): Column[] {
  return columnsForClasses(columns, [klasse])
}

/** Wie {@link columnsForClass} für mehrere Klassen: jede Spalte, die eine von ihnen hat. */
export function columnsForClasses(columns: Column[], klassen: readonly string[]): Column[] {
  return columns.filter((c) => !c.klassen || c.klassen.length === 0 || c.klassen.some((k) => klassen.includes(k)))
}

/**
 * Eine Position für eine Klasse: nur deren Spalten. Bleibt keine Fehler-Spalte übrig (z. B.
 * Berlin Rechts unter Klasse 4 ohne MüB), entfallen auch die Fehlerpunkte, der Hinweis dazu
 * und die Disqualifikationen, die nur dorthin gehören.
 */
export function defFuerKlasse(def: SheetDef, klasse: string): SheetDef {
  return defFuerKlassen(def, [klasse])
}

/** Wie {@link defFuerKlasse} für mehrere Klassen auf einem Bogen. */
export function defFuerKlassen(def: SheetDef, klassen: readonly string[]): SheetDef {
  const columns = columnsForClasses(def.columns, klassen)
  if (!def.ohneCodes || columns.some((c) => c.kind === 'code')) return { ...def, columns }
  return { ...def, columns, errorTable: undefined, errorTableTitle: undefined, errorGroups: undefined, ...def.ohneCodes }
}

/** Hat der Bogen überhaupt eine Beschreibung (sonst bleibt die Rückseite leer)? */
export function hasDescription(def: SheetDef): boolean {
  return !!(def.errorGroups?.length || def.errorTable?.length || def.legendNote || def.disqTable?.length || def.bildErzeugen)
}

/**
 * Beschreibung auf der Rückseite („Anne-Feature“ im Prototyp): Muss die Rückseite um 180°
 * gedreht werden, damit sie beim Nach-oben-Klappen am Klemmbrett richtig herum steht?
 * Hochformat: ja – Wenden an der langen Kante legt die Rückseite für seitliches Umblättern
 * aus. Querformat: nein – dort ist die lange Papierkante die Ober-/Unterkante des Bogens.
 */
export function backNeedsFlip(orientation: SheetDef['orientation']): boolean {
  return orientation === 'portrait'
}

function blattSpalten(columns: Column[]): BogenBlattSpalte[] {
  return columns.flatMap((col) =>
    col.sub && col.sub.length > 0
      ? col.sub.map((s, i) => ({
          colKey: col.key,
          subIndex: i,
          kind: col.kind,
          label: `${col.label} ${s}`,
          grow: col.grow,
          einzeln: col.einzeln,
          // Erstes Unter-Blatt: linke Kante der Gruppe. Weitere: Linie zwischen den Unter-Spalten.
          trenner: i === 0 ? col.trenner : col.subTrenner,
          // Zusätzlich rechts, außer beim letzten Unter-Blatt.
          trennerR: i < col.sub!.length - 1 ? col.subTrenner : undefined,
          klassen: col.klassen,
        }))
      : [{ colKey: col.key, kind: col.kind, label: col.label, grow: col.grow, einzeln: col.einzeln, trenner: col.trenner, klassen: col.klassen }],
  )
}

/**
 * Gilt die Spalte für die Klasse einer Zeile? Ohne Klasse (Leerzeile) immer. Hat die Klasse
 * die ganze Liste nicht (`listeGilt` false, z. B. Mann-über-Bord unter Klasse 4), gilt keine
 * Spalte: Auf einer gemeinsamen Liste ist die Zeile dann durchgehend schraffiert.
 */
function spalteGilt(leaf: BogenBlattSpalte, klasse: string | undefined, listeGilt: boolean): boolean {
  if (!klasse) return true
  return listeGilt && (!leaf.klassen || leaf.klassen.length === 0 || leaf.klassen.includes(klasse))
}

/**
 * Alle Druckseiten eines Bogens. Mit gemessener `kapazitaet` wird automatisch geteilt
 * (lib/paging.ts), sonst bleibt es eine Seite. Jede Seite trägt Kopf, Spalten, Leerzeilen
 * und Beschreibung.
 *
 * Jede fünfte Zeile ist grau. Gezählt wird über die Starter des ganzen Bogens (so wie auf
 * allen Listen hier), die Leerzeilen einer Seite zählen dort weiter. Weil die automatische
 * Aufteilung auf Fünfer rundet, ist das in der Regel dasselbe wie die Zählung je Seite im
 * Prototyp.
 */
export function bogenSeiten(konfig: BogenKonfig, auftrag: BogenAuftrag, optionen: BogenOptionen = {}): BogenSeite[] {
  const { leerzeilen, zeilenJeSeite, teilenAb } = { ...BOGEN_VORGABEN, ...optionen }
  const klassen = [...auftrag.klassen]
  const def = defFuerKlassen(konfig.getSheetDef(auftrag.typeId), klassen)
  const leaves = blattSpalten(def.columns)
  const texte = konfig.getBogenTexte()
  const zeigtKlasse = klassen.length > 1
  // Mehrere Klassen: Das Bild der letzten – die höhere Klasse zeigt den längeren Parcours.
  const bildKlasse = klassen[klassen.length - 1]
  const bild: BogenBild | undefined =
    def.bildErzeugen && bildKlasse !== undefined && !auftrag.ohneBild
      ? { datei: konfig.bildDatei(auftrag.aufbauId, bildKlasse), vorgabe: def.bildErzeugen, drehung: def.bildDrehung ?? 0 }
      : undefined

  type Roh = Omit<BogenModellZeile, 'shaded' | 'cells'>
  const bloecke = !!optionen.klassenBloecke && klassen.length > 1
  const starter = (z: BogenZeile): Roh => {
    const klasse = z.klasse ?? (zeigtKlasse ? undefined : klassen[0])
    return {
      key: z.id ?? (zeigtKlasse && klasse ? `${klasse}:${z.nr}` : z.nr),
      nr: z.nr,
      klasse,
      klasseText: klasse === undefined ? undefined : texte.klasseName(klasse),
      fixed: true,
    }
  }
  /** Zellen und graue Zeilen; `nummer` zählt Starter und Leerzeilen, Zwischenüberschriften nicht. */
  const fertig = (z: Roh, nummer: number): BogenModellZeile => {
    if (z.zwischen !== undefined) return { ...z, shaded: false, cells: [] }
    const listeGilt = z.klasse === undefined || konfig.positionAllowsClass(auftrag.typeId, z.klasse)
    return {
      ...z,
      shaded: nummer % 5 === 0,
      cells: leaves.map((leaf) => ({
        kind: leaf.kind,
        display: optionen.anzeige?.(z.key, leaf.colKey, leaf.subIndex) ?? '',
        gilt: spalteGilt(leaf, z.klasse, listeGilt),
      })),
    }
  }

  let seitenZeilen: BogenModellZeile[][]
  /** Mit Klassen-Blöcken: die Klassen, die auf der Seite stehen. */
  let seitenKlassen: string[][] | undefined
  const zeilenKap = optionen.zeilenKapazitaet ?? 0
  if (bloecke) {
    // Je Klasse ein Block: ihre Starter in der gegebenen Reihenfolge, dann ihre Leerzeilen.
    const jeKlasse = klassen.map((k) => {
      const zeilen: Roh[] = auftrag.zeilen.filter((z) => z.klasse === k).map(starter)
      const leer = optionen.leerzeilenJeKlasse?.[k] ?? leerzeilen
      // Die Leerzeile gehört zur Klasse, hat aber keine Klasse im Sinn der Spalten: Jede Zelle ist beschreibbar.
      for (let i = 0; i < leer; i++) zeilen.push({ key: `_k${k}_x${i}`, nr: '', fixed: false })
      return zeilen
    })
    let nummer = 0
    const leerJe = jeKlasse.map((z) => z.filter((x) => !x.fixed).length)
    const teileJeSeite = blockSeiten(jeKlasse.map((z) => z.length), zeilenKap, leerJe)
    seitenKlassen = teileJeSeite.map((teile) => teile.map((t) => klassen[t.block]))
    seitenZeilen = teileJeSeite.map((teile) =>
      teile.flatMap(({ block, von, bis }) => {
        const k = klassen[block]
        const kopf: Roh = {
          key: `_k${k}_kopf${von}`,
          nr: '',
          klasse: k,
          zwischen: von > 0 ? `${texte.klasse(k)} (${texte.fortsetzung})` : texte.klasse(k),
          fixed: false,
        }
        return [fertig(kopf, 0), ...jeKlasse[block].slice(von, bis).map((z) => fertig(z, ++nummer))]
      }),
    )
  } else if (zeilenJeSeite <= 0 && leerzeilen > 0 && zeilenKap > 0 && auftrag.zeilen.length + leerzeilen > zeilenKap && zeilenKap - leerzeilen <= leerzeilen) {
    // Wenig Platz (große Beschreibung, z. B. Baden-Württemberg „Wasser 1“ mit 5 Zeilen je
    // Blatt): Leerzeilen auf jeder Seite ließen den Startern höchstens die Hälfte – sechs
    // Starter bräuchten drei Blätter. Dann stehen die Leerzeilen einmal am Ende, und die
    // Zeilen werden gleichmäßig geteilt, damit das letzte Blatt nicht nur Leerzeilen trägt.
    const roh: Roh[] = auftrag.zeilen.map(starter)
    for (let i = 0; i < leerzeilen; i++) roh.push({ key: `_p0_x${i}`, nr: '', fixed: false })
    const jeSeite = Math.ceil(roh.length / Math.ceil(roh.length / zeilenKap))
    seitenZeilen = []
    for (let i = 0; i < roh.length; i += jeSeite) seitenZeilen.push(roh.slice(i, i + jeSeite).map((z, j) => fertig(z, i + j + 1)))
  } else {
    const chunks = pageChunks([...auftrag.zeilen], zeilenJeSeite, teilenAb, optionen.kapazitaet ?? 0)
    let davor = 0
    seitenZeilen = chunks.map((chunk, pageIndex) => {
      const roh: Roh[] = chunk.map(starter)
      // Der Seiten-Präfix hält die Schlüssel der Leerzeilen je Seite eindeutig.
      for (let i = 0; i < leerzeilen; i++) roh.push({ key: `_p${pageIndex}_x${i}`, nr: '', fixed: false })
      const start = davor
      davor += chunk.length
      return roh.map((z, i) => fertig(z, start + i + 1))
    })
  }

  // Im Kopf stehen die Klassen der Seite: Trägt eine Seite eines gemeinsamen Bogens nur eine
  // Klasse, heißt sie auch so – der Wettkampfrichter sucht das Blatt nach der Klasse heraus.
  const kopfKlassen = (k: readonly string[]) => (k.length > 1 ? texte.klassen([...k]) : k.map((x) => texte.klasse(x)).join(''))
  return seitenZeilen.map((rows, pageIndex) => {
    return {
      typeId: auftrag.typeId,
      eventName: auftrag.eventName,
      titel: def.title,
      klassen,
      klassenText: kopfKlassen(seitenKlassen?.[pageIndex] ?? klassen),
      lauf: auftrag.lauf,
      laufText: def.showLauf === false ? undefined : texte.lauf(auftrag.lauf),
      parcours: auftrag.parcours?.trim() || undefined,
      wkr: auftrag.wkr ?? '',
      qr: auftrag.qr ? seitenCode(auftrag.qr, pageIndex + 1) : undefined,
      orientation: def.orientation,
      columns: def.columns,
      leaves,
      twoRow: def.columns.some((c) => c.sub && c.sub.length > 0),
      // Mit Zwischenüberschriften braucht es die Klassen-Spalte nicht.
      zeigtKlasse: zeigtKlasse && !bloecke,
      rows,
      def,
      bild,
      texte,
      pageIndex,
      pageCount: seitenZeilen.length,
    }
  })
}

/**
 * Muster-Zeilen für die Beispielansicht: „M1“, „M2“ … Der Buchstabe davor macht sofort
 * kenntlich, dass es keine echten Startnummern sind – eine reine Zahl sähe aus wie eine.
 */
export function musterZeilen(anzahl: number, praefix: string): BogenZeile[] {
  return Array.from({ length: Math.max(0, Math.floor(anzahl)) }, (_, i) => ({ nr: `${praefix}${i + 1}` }))
}

/**
 * Die Listen, die eine Klasse in einem Aufbau hat – in der Reihenfolge der Veranstaltung
 * (lib/listen.ts): mit zusammengelegter Liste und den gewählten zusätzlichen.
 */
export function listenFuerKlasse(konfig: ListenWahlKonfig & { positionAllowsClass(typeId: string, klasse: string): boolean }, wahl: ListenWahl, klasse: string): string[] {
  return veranstaltungsListen(konfig, wahl).filter((id) => konfig.positionAllowsClass(id, klasse))
}
