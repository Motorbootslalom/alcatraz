import type { BogenTexte } from '../config/sprache'
import type { CellKind, Column, SheetDef, TrennerDesign } from '../types'
import { blockSeiten, gruppenKapazitaet, gruppenSeiten, pageChunks } from './paging'
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
  /**
   * Nur auf Listen einer Runde ({@link BogenAuftrag.runde}): die Position des Starts im Plan
   * (ab 1), der Attempt der Zeile und der Block der Startreihenfolge. `dummy`: Auf diesem
   * Racecourse fährt ein Dummy; `entfaellt`: Der Start hat keinen Starter mehr. Beide Zeilen
   * bleiben stehen, damit Zeile n auf allen Listen derselbe Start ist.
   */
  start?: number
  attempt?: number
  gruppe?: number
  dummy?: boolean
  entfaellt?: boolean
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
   * Ein fest vorgegebenes Bild statt des Bildes der Klasse (`bildErzeugen` der Position): die Parallelslalom-Zeichnung
   * auf dem Fahrweg-Bogen eines Racecourse (lib/parallelBogen.ts PARALLEL_BOGEN_BILD, 23.11.2026, R9-05 bis R9-07) –
   * eine Liste einer Runde gehört zu keiner Klasse, und für A und B gilt dieselbe eine Bahn. {@link ohneBild} gewinnt.
   */
  bild?: BogenBild
  /**
   * Inhalt des QR-Codes ohne Seite (lib/qr.ts `bogenCode`); jede Druckseite hängt ihre Nummer
   * an. Fehlt = kein Code im Kopf.
   */
  qr?: string
  /**
   * Liste einer Runde des Parallelslaloms (lib/parallelBogen.ts) statt einer Klasse in einem
   * Lauf: Die Zeilen sind die Starts des Plans in ihrer Reihenfolge, über alle Klassen. Vorn
   * stehen Start, Nr., Klasse und Attempt; im Kopf steht die Runde (z. B. „Vorlauf“) an der
   * Stelle der Klasse und der Racecourse an der des Parcours – beides in der Sprache des
   * Bogens. Einen Lauf nennt der Kopf nicht, er steht je Zeile. Leerzeilen gibt es nicht (jede
   * Zeile ist ein fester Start), geteilt wird nur am Ende eines Blocks (`BogenZeile.gruppe`).
   */
  runde?: { runde: string; racecourse: string }
  /**
   * Die Disziplin, unter der die Werte dieses Bogens stehen, wenn es nicht die des Aufbaus der
   * Veranstaltung ist (Parallelslalom: `parallel:pre`, lib/parallelSchluessel.ts).
   */
  disziplin?: string
  /**
   * „Versuche direkt nacheinander“ (UIM 960, Pkt. 4.3.2: „2 attempts, run consecutively“; Option
   * der Veranstaltung): Jeder Starter steht mit so vielen Versuchen direkt nacheinander auf dem
   * Bogen – 1. und 2. Versuch auf einem Klassenzettel, weil er am Steg nur anlegt und gleich
   * noch einmal fährt. `zeilen` nennt jeden Starter einmal; der Bogen macht daraus je Versuch
   * eine Zeile ({@link auftragZeilen}), hinter der Startnummer steht die Spalte „Versuch“, und
   * die Werte jeder Zeile stehen unter ihrem Versuch (Lauf). Einen Lauf nennt der Kopf nicht.
   * Fehlt oder 1 = ein Bogen je Lauf, wie bisher. Gilt nicht für Listen ohne Lauf (Knoten).
   */
  versuche?: number
  /**
   * Mit {@link versuche}: Der Starter kommt an dieser Liste nur einmal vorbei, auch wenn er seine
   * Versuche direkt nacheinander fährt (Vorsteg; config `einmalJeStarter`). Dann steht er nur
   * EINMAL auf dem Bogen, ohne Spalte „Versuch“ – wie auf der Knoten-Liste –, und was in seiner
   * Zeile steht, gilt für jeden Versuch: Die Erfassung schreibt es unter jeden
   * (lib/erfassung.ts `zeilenSchluesselAlle`). Auch dann nennt der Kopf keinen Lauf.
   */
  einmal?: boolean
  /**
   * Spalten (Keys), die dieser Bogen nicht hat, obwohl die Liste sie kennt – der Aufbau lässt
   * sie weg (config/aufbauten/parallel.yaml `ohneSpalten`: die Steg-Liste des Parallelslaloms
   * ohne „Bemerkung“). Der Platz geht an die übrigen Spalten.
   */
  ohneSpalten?: readonly string[]
}

/**
 * Die Zeilen eines Bogens, wie sie auf dem Papier stehen: mit {@link BogenAuftrag.versuche} je
 * Starter eine Zeile je Versuch, direkt nacheinander (`attempt` 1, 2 …); sonst – auch mit
 * {@link BogenAuftrag.einmal} – die Zeilen selbst.
 */
export function auftragZeilen(auftrag: Pick<BogenAuftrag, 'zeilen' | 'versuche' | 'runde' | 'einmal'>): BogenZeile[] {
  const n = auftrag.runde === undefined && !auftrag.einmal ? Math.floor(auftrag.versuche ?? 1) : 1
  if (n <= 1) return [...auftrag.zeilen]
  return auftrag.zeilen.flatMap((z) => Array.from({ length: n }, (_, i): BogenZeile => ({ ...z, attempt: i + 1 })))
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
  /**
   * Gemeinsame Bögen mehrerer Klassen: Die Klassen einer Seite teilen sich die Leerzeilen.
   * Mit `klassenBloecke` (Clubmeisterschaft, Papier sparen) stehen so viele statt nach jeder
   * Klasse einmal am Ende jeder Seite, unter einer eigenen Zwischenüberschrift
   * („Nachmeldungen“) – sonst sähen sie aus wie Zeilen der letzten Klasse. Ohne Blöcke (Klassen
   * gemischt in der Startfolge der Verzahnung, 24.11.2026) stehen sie ohne Überschrift am Ende
   * jeder Seite: Ihre Klassenzelle ist leer, das genügt. `leerzeilen` und `leerzeilenJeKlasse`
   * gelten dann nicht. Kosteten sie allein ein weiteres Blatt, entfallen sie bis auf eine (wie
   * bei den Zeilen je Klasse).
   */
  leerzeilenJeSeite?: number
  /** Gemessen: so viele Tabellenzeilen (Starter, Leerzeilen, Zwischenüberschriften) passen auf ein Blatt. */
  zeilenKapazitaet?: number
  /**
   * Nur für Listen einer Runde: jede zweite Zeile grau (Listen-Option der Veranstaltung,
   * `AppState.parallelZebra`; Vorgabe an). Die Zeile ohne Eingabe (Dummy, entfallener Start)
   * bleibt schraffiert.
   */
  zebra?: boolean
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
  /**
   * Nur auf Listen einer Runde: Die Zeile ist ein Start. Ihr Schlüssel ist dann `s<Start>` –
   * auf allen Listen der Runde derselbe –, und die Werte hängen an `starter` (Starter-ID) und
   * `lauf` (Attempt). Ohne `starter` (Dummy, entfallener Start) gibt es nichts einzutragen.
   */
  start?: number
  starter?: string
  lauf?: number
  dummy?: boolean
  entfaellt?: boolean
  /** Letzte Zeile ihres Blocks: Darunter steht die Trennlinie. */
  blockEnde?: boolean
}

/** Das Parcoursbild eines Bogens: Zeichnung und Abblendung (lib/parcoursQuelle.ts). */
export interface BogenBild {
  datei: string
  vorgabe: { dim: string[]; aus: string[] }
  drehung: number
  /**
   * Eine flache Zeichnung (breit, wenig hoch – die eine Bahn des Parallelslaloms, etwa 4 : 1; 23.11.2026): Vorn steht
   * sie RECHTS NEBEN der Legende und ist höchstens so hoch wie diese (styles/bogen.css `.bogen--bild-streifen`) – sie
   * belegt nur Platz, der neben der Legende ohnehin frei ist, und kostet so keine Zeile je Blatt. Auf der Rückseite
   * steht sie unter der Legende in ihrer eigenen Höhe statt in einem Rahmen über die ganze Blatthälfte.
   */
  streifen?: boolean
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
  /** Liste einer Runde: vorn die Spalte Start, hinter der Klasse die Spalte Attempt. */
  startForm: boolean
  /** „Versuche direkt nacheinander“: hinter Nr. (und Klasse) die Spalte Versuch – jeder Starter steht je Versuch einmal da. */
  versuchForm: boolean
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
 * Wie {@link hasDescription} für eine Druckseite: Auch ein Bild, das der Auftrag mitbringt ({@link BogenAuftrag.bild},
 * Parallelslalom), ist Beschreibung – es steht mit der Legende vorn bzw. auf der Rückseite.
 */
export function seiteMitBeschreibung(seite: Pick<BogenSeite, 'def' | 'bild'>): boolean {
  return hasDescription(seite.def) || !!seite.bild
}

/**
 * Trägt der Bogen eines Auftrags ein Parcoursbild? Dieselbe Regel wie in {@link bogenSeiten} – für die Namensnennung
 * am Bildschirm (components/ParcoursNachweis.vue unter WkrListen, ParallelWkrListen, WkrVorschau).
 */
export function bogenMitBild(konfig: Pick<BogenKonfig, 'getSheetDef'>, auftrag: Pick<BogenAuftrag, 'typeId' | 'ohneBild' | 'bild'>): boolean {
  return !auftrag.ohneBild && (!!auftrag.bild || !!konfig.getSheetDef(auftrag.typeId).bildErzeugen)
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
  const ganz = defFuerKlassen(konfig.getSheetDef(auftrag.typeId), klassen)
  const ohne = auftrag.ohneSpalten ?? []
  const def = ohne.length > 0 ? { ...ganz, columns: ganz.columns.filter((c) => !ohne.includes(c.key)) } : ganz
  const leaves = blattSpalten(def.columns)
  const texte = konfig.getBogenTexte()
  const zeigtKlasse = klassen.length > 1
  // Mehrere Klassen: Das Bild der letzten – die höhere Klasse zeigt den längeren Parcours.
  const bildKlasse = klassen[klassen.length - 1]
  // Ein Bild, das der Auftrag mitbringt (Parallelslalom), geht dem der Klasse vor.
  const bild: BogenBild | undefined = auftrag.ohneBild
    ? undefined
    : (auftrag.bild ??
      (def.bildErzeugen && bildKlasse !== undefined
        ? { datei: konfig.bildDatei(auftrag.aufbauId, bildKlasse), vorgabe: def.bildErzeugen, drehung: def.bildDrehung ?? 0 }
        : undefined))

  type Roh = Omit<BogenModellZeile, 'shaded' | 'cells'>
  const rundenListe = auftrag.runde !== undefined
  const bloecke = !rundenListe && !!optionen.klassenBloecke && klassen.length > 1
  // „Versuche direkt nacheinander“: Der Bogen gilt für alle Versuche, je Starter steht eine Zeile
  // je Versuch da – nicht auf Listen ohne Lauf (Knoten) und nicht dort, wo der Starter nur einmal
  // vorbeikommt (Vorsteg, `einmal`): Dort hat er eine Zeile für alle Versuche.
  const fuerVersuche = !rundenListe && def.showLauf !== false ? Math.max(1, Math.floor(auftrag.versuche ?? 1)) : 1
  const versuche = auftrag.einmal ? 1 : fuerVersuche
  const jeVersuch = (zeilen: readonly BogenZeile[]): BogenZeile[] => auftragZeilen({ zeilen, versuche })
  const starter = (z: BogenZeile): Roh => {
    const klasse = z.klasse ?? (zeigtKlasse ? undefined : klassen[0])
    const key = z.id ?? (zeigtKlasse && klasse ? `${klasse}:${z.nr}` : z.nr)
    return {
      // Mit mehreren Versuchen steht der Starter mehrfach da: Der Versuch gehört zum Schlüssel der
      // Zeile, die Werte hängen an `starter` und `lauf` (wie auf den Listen einer Runde).
      key: z.attempt === undefined ? key : `${key}#${z.attempt}`,
      nr: z.nr,
      klasse,
      klasseText: klasse === undefined ? undefined : texte.klasseName(klasse),
      fixed: true,
      // Unter dem letzten Versuch eines Starters steht die Trennlinie: So liest sich das Paar als eines.
      ...(z.attempt === undefined ? {} : { starter: z.id, lauf: z.attempt, blockEnde: z.attempt === versuche || undefined }),
    }
  }
  /** Zellen und graue Zeilen; `nummer` zählt Starter und Leerzeilen, Zwischenüberschriften nicht. */
  const fertig = (z: Roh, nummer: number): BogenModellZeile => {
    if (z.zwischen !== undefined) return { ...z, shaded: false, cells: [] }
    const listeGilt = z.klasse === undefined || konfig.positionAllowsClass(auftrag.typeId, z.klasse)
    return {
      ...z,
      // Mit mehreren Versuchen je Starter gliedert die Trennlinie unter jedem Starter – eine graue
      // fünfte Zeile schnitte mitten durch ein Paar.
      shaded: versuche === 1 && nummer % 5 === 0,
      cells: leaves.map((leaf) => ({
        kind: leaf.kind,
        display: optionen.anzeige?.(z.key, leaf.colKey, leaf.subIndex) ?? '',
        gilt: spalteGilt(leaf, z.klasse, listeGilt),
      })),
    }
  }

  let seitenZeilen: BogenModellZeile[][]
  /** Mehrere Klassen (Blöcke oder Startfolge): die Klassen, die auf der Seite stehen. */
  let seitenKlassen: string[][] | undefined
  const zeilenKap = optionen.zeilenKapazitaet ?? 0
  if (rundenListe) {
    // Liste einer Runde: jede Zeile ein Start, keine Leerzeilen. Geteilt wird nur am Ende eines
    // Blocks. Jede Liste teilt für sich, mit so wenigen Seiten wie möglich und darauf
    // ausgeglichen (Entscheidungen des Nutzers vom 15.11.2026) – die Zeit-Liste fasst mehr Starts
    // als die Listen mit Legende. „Zeilen je Seite“ und „Teilen ab“ gelten als Obergrenze
    // (lib/paging.ts `gruppenSeiten`, `gruppenKapazitaet`).
    const gruppen: BogenZeile[][] = []
    for (const z of auftrag.zeilen) {
      const letzte = gruppen[gruppen.length - 1]
      if (letzte && letzte[0].gruppe === z.gruppe) letzte.push(z)
      else gruppen.push([z])
    }
    const kap = gruppenKapazitaet(auftrag.zeilen.length, zeilenKap, zeilenJeSeite, teilenAb)
    let nummer = 0
    seitenZeilen = gruppenSeiten(
      gruppen.map((g) => g.length),
      kap,
    ).map((seite) =>
      seite.flatMap((g) =>
        gruppen[g].map((z, i): BogenModellZeile => {
          const frei = z.dummy || z.entfaellt || z.id === undefined
          const listeGilt = !frei && (z.klasse === undefined || konfig.positionAllowsClass(auftrag.typeId, z.klasse))
          return {
            key: `s${z.start ?? 0}`,
            nr: z.nr,
            klasse: frei ? undefined : z.klasse,
            klasseText: frei || z.klasse === undefined ? undefined : texte.klasseName(z.klasse),
            fixed: true,
            // Keine graue fünfte Zeile; auf Wunsch jede zweite (`zebra`). Die Zeile ohne Eingabe
            // (Dummy, entfallener Start) ist schraffiert und zählt für das Grau mit.
            shaded: ++nummer % 2 === 0 && !!optionen.zebra && !frei,
            start: z.start,
            starter: frei ? undefined : z.id,
            lauf: z.attempt,
            dummy: z.dummy || undefined,
            entfaellt: z.entfaellt || undefined,
            blockEnde: i === gruppen[g].length - 1 || undefined,
            cells: leaves.map((leaf) => ({
              kind: leaf.kind,
              display: frei ? '' : (optionen.anzeige?.(`s${z.start ?? 0}`, leaf.colKey, leaf.subIndex) ?? ''),
              gilt: !frei && spalteGilt(leaf, z.klasse, listeGilt),
            })),
          }
        }),
      ),
    )
  } else if (bloecke) {
    // Je Klasse ein Block: ihre Starter in der gegebenen Reihenfolge, dann ihre Leerzeilen –
    // außer die Klassen einer Seite teilen sie sich (`leerzeilenJeSeite`, siehe unten).
    const geteilt = optionen.leerzeilenJeSeite !== undefined
    const jeKlasse = klassen.map((k) => {
      const zeilen: Roh[] = jeVersuch(auftrag.zeilen.filter((z) => z.klasse === k)).map(starter)
      const leer = geteilt ? 0 : (optionen.leerzeilenJeKlasse?.[k] ?? leerzeilen)
      // Die Leerzeile gehört zur Klasse, hat aber keine Klasse im Sinn der Spalten: Jede Zelle ist beschreibbar.
      for (let i = 0; i < leer; i++) zeilen.push({ key: `_k${k}_x${i}`, nr: '', fixed: false })
      return zeilen
    })
    let nummer = 0
    const leerJe = jeKlasse.map((z) => z.filter((x) => !x.fixed).length)
    const laengen = jeKlasse.map((z) => z.length)
    // Geteilte Leerzeilen: Am Ende jeder Seite bleibt Platz für sie und ihre Überschrift.
    const mitLeer = (n: number) => blockSeiten(laengen, zeilenKap > 0 ? Math.max(2, zeilenKap - (n > 0 ? n + 1 : 0)) : 0)
    let leerJeSeite = geteilt ? Math.max(0, Math.floor(optionen.leerzeilenJeSeite ?? 0)) : 0
    if (geteilt && zeilenKap > 0) {
      // Neben ihnen müssen eine Klassen-Überschrift und eine Zeile auf das Blatt passen.
      leerJeSeite = Math.min(leerJeSeite, Math.max(0, zeilenKap - 3))
      // Leerzeilen sind kein Grund für ein weiteres Blatt: so viele, wie ohne Mehrverbrauch
      // gehen – mindestens eine, wenn welche gewünscht sind.
      const blaetter = mitLeer(Math.min(1, leerJeSeite)).length
      while (leerJeSeite > 1 && mitLeer(leerJeSeite).length > blaetter) leerJeSeite--
    }
    const teileJeSeite = geteilt ? mitLeer(leerJeSeite) : blockSeiten(laengen, zeilenKap, leerJe)
    seitenKlassen = teileJeSeite.map((teile) => teile.map((t) => klassen[t.block]))
    seitenZeilen = teileJeSeite.map((teile, pageIndex) => {
      const zeilen = teile.flatMap(({ block, von, bis }) => {
        const k = klassen[block]
        const kopf: Roh = {
          key: `_k${k}_kopf${von}`,
          nr: '',
          klasse: k,
          zwischen: von > 0 ? `${texte.klasse(k)} (${texte.fortsetzung})` : texte.klasse(k),
          fixed: false,
        }
        return [fertig(kopf, 0), ...jeKlasse[block].slice(von, bis).map((z) => fertig(z, ++nummer))]
      })
      if (leerJeSeite > 0) {
        // Ohne Klasse: Jede Zelle ist beschreibbar – wer nachgemeldet wird, kann in jeder Klasse
        // fahren. Gezählt wird für die graue Zeile wie sonst: auf der Seite weiter, nicht darüber hinaus.
        zeilen.push(fertig({ key: `_p${pageIndex}_nach`, nr: '', zwischen: texte.nachmeldungen, fixed: false }, 0))
        for (let i = 0; i < leerJeSeite; i++) zeilen.push(fertig({ key: `_p${pageIndex}_x${i}`, nr: '', fixed: false }, nummer + i + 1))
      }
      return zeilen
    })
  } else if (versuche === 1 && zeilenJeSeite <= 0 && leerzeilen > 0 && zeilenKap > 0 && auftrag.zeilen.length + leerzeilen > zeilenKap && zeilenKap - leerzeilen <= leerzeilen) {
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
    // Geteilt wird nach Startern: Die Versuche eines Starters bleiben auf einer Seite. Auf ein
    // Blatt passen dann entsprechend weniger Starter (jeder braucht `versuche` Zeilen).
    const teile = (kap: number) => pageChunks([...auftrag.zeilen], zeilenJeSeite, teilenAb, versuche > 1 && kap > 0 ? Math.max(1, Math.floor(kap / versuche)) : kap)
    let kapazitaet = optionen.kapazitaet ?? 0
    let leer = leerzeilen
    if (optionen.leerzeilenJeSeite !== undefined) {
      // Klassen gemischt in der Startfolge (Clubmeisterschaft, Nutzer 24.11.2026): Die Leerzeilen gehören zur Seite,
      // nicht zu einer Klasse. Wie auf den Blöcken mit geteilten Leerzeilen kosten sie kein weiteres Blatt – so viele,
      // wie ohne Mehrverbrauch gehen, mindestens eine, wenn welche gewünscht sind. Die gemessene Kapazität zählt
      // Tabellenzeilen; die der Starter ist der Rest neben den Leerzeilen.
      leer = Math.max(0, Math.floor(optionen.leerzeilenJeSeite))
      if (zeilenKap > 0) {
        leer = Math.min(leer, Math.max(0, zeilenKap - 1))
        const mitLeer = (n: number) => teile(Math.max(1, zeilenKap - n)).length
        const blaetter = mitLeer(Math.min(1, leer))
        while (leer > 1 && mitLeer(leer) > blaetter) leer--
        kapazitaet = Math.max(1, zeilenKap - leer)
      } else kapazitaet = 0
    }
    const chunks = teile(kapazitaet)
    let davor = 0
    seitenZeilen = chunks.map((starterDerSeite, pageIndex) => {
      const chunk = jeVersuch(starterDerSeite)
      const roh: Roh[] = chunk.map(starter)
      // Der Seiten-Präfix hält die Schlüssel der Leerzeilen je Seite eindeutig. Ohne Klasse: Jede Zelle ist
      // beschreibbar, und auf einem Bogen mehrerer Klassen bleibt die Klassenzelle für die Nachmeldung frei.
      // Auslegung (Prüfbefund 24.11.2026, offen beim Nutzer): Mit „Versuche direkt nacheinander“ ist eine Leerzeile
      // eine Zeile ohne Versuch – eine Nachmeldung füllt zwei davon und trägt den Versuch von Hand ein. So war es
      // auf Bögen einer Klasse schon immer; Leerzeilen in Paaren je Versuch kosteten je Seite doppelt so viel Platz.
      for (let i = 0; i < leer; i++) roh.push({ key: `_p${pageIndex}_x${i}`, nr: '', fixed: false })
      const start = davor
      davor += chunk.length
      return roh.map((z, i) => fertig(z, start + i + 1))
    })
    // Mehrere Klassen ohne Blöcke (in der Startfolge): Auch hier nennt der Kopf die Klassen der Seite – der
    // Wettkampfrichter sucht das Blatt nach der Klasse heraus. Eine Seite ohne Starter nennt alle.
    if (zeigtKlasse) {
      seitenKlassen = seitenZeilen.map((rows) => {
        const da = klassen.filter((k) => rows.some((r) => r.klasse === k))
        return da.length > 0 ? da : klassen
      })
    }
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
      klassenText: auftrag.runde ? texte.runde(auftrag.runde.runde) : kopfKlassen(seitenKlassen?.[pageIndex] ?? klassen),
      lauf: auftrag.lauf,
      laufText: def.showLauf === false || rundenListe || fuerVersuche > 1 ? undefined : texte.lauf(auftrag.lauf),
      parcours: auftrag.runde ? texte.racecourse(auftrag.runde.racecourse) : auftrag.parcours?.trim() ? texte.parcoursName(auftrag.parcours) : undefined,
      wkr: auftrag.wkr ?? '',
      qr: auftrag.qr ? seitenCode(auftrag.qr, pageIndex + 1) : undefined,
      orientation: def.orientation,
      columns: def.columns,
      leaves,
      twoRow: def.columns.some((c) => c.sub && c.sub.length > 0),
      // Mit Zwischenüberschriften braucht es die Klassen-Spalte nicht.
      zeigtKlasse: rundenListe || (zeigtKlasse && !bloecke),
      startForm: rundenListe,
      versuchForm: versuche > 1,
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
