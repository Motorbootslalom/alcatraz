import type { AppState, ClassId, OriginMode, Starter } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { flaggeVon } from '../domain/flaggen'
import { vergleicheNr } from './eingaben'
import { klassenErgebnis, wertungVon, type ErgebnisKonfig, type ErgebnisStand, type GesamtListe } from './ergebnis'

// Pokalauswertung (Mannschaftswertung je Herkunft) – rein, ohne DOM und ohne Zustand.
//
// Grundlage sind die Plätze der Gesamtliste jeder Klasse (lib/ergebnis.ts `klassenErgebnis`),
// so wie sie dort stehen – mit Stichentscheid und geteilten Plätzen: Teilen sich zwei den
// 2. Platz, bekommen beide die Punkte des 2. Platzes, und der 3. entfällt. Wer disqualifiziert
// ist oder noch kein Ergebnis hat („offen“ – er steht in der Gesamtliste ohne Zeit auf Platz 1),
// bekommt keine Punkte.
//
// Herkunft ist, was für die Veranstaltung gewählt ist (Verein, Bundesland, Land). Starter
// ohne Herkunft gehören zu keiner Mannschaft: Sie behalten ihren Platz in der Klasse (die
// Plätze dahinter rücken nicht auf), bekommen aber nichts gutgeschrieben; die Wertung nennt
// ihre Zahl, damit die Oberfläche darauf hinweisen kann. Anders als auf den Listen gilt in der
// Vereinswertung nur das Feld Verein: Ein Starter ohne Verein bildet keine Mannschaft mit dem
// Namen seines Bundeslands. Zusammengefasst wird ohne Rücksicht auf Groß-/Kleinschreibung und
// überzählige Leerzeichen („MBC Nord“ = „mbc  nord“) – sonst teilte ein Tippfehler aus dem
// Import eine Mannschaft stillschweigend; auf der Liste steht die häufigste Schreibweise.
// Bei Herkunft Bundesland und Land gehören außerdem alle Schreibweisen zusammen, die als
// dasselbe Land erkannt werden („NRW“ = „Nordrhein-Westfalen“, „GER“ = „Germany“): Die Listen
// zeigen für sie dieselbe Flagge und dasselbe Kürzel – zwei Zeilen, die gleich aussehen und
// verschiedene Punkte haben, kann niemand lesen. Was nicht erkannt wird, bleibt für sich.
//
// „Nur ausgewählte Starter zählen“: Wer nicht gewählt ist, behält ebenfalls seinen Platz und
// bekommt keine Punkte – so rechnet die Excel-Mappe der DM 2026 (Blatt „Mannschaftswertung_neu“:
// Punkte = Punkte des Platzes, wenn „MW ja“ gesetzt ist, sonst 0; der Platz bleibt, wie er ist).
//
// Zwei Arten der Wertung:
//   • Plätze (Varianten „plaetze3“, „plaetze6“): Die ersten n Plätze je Klasse bekommen Punkte;
//     je Herkunft werden alle Punkte zusammengezählt.
//   • UIM: Jeder Platz von 1 bis 20 bekommt Punkte (Regel 960, Pkt. 5.1); je Herkunft zählen
//     nur die besten fünf Starter. Eine Herkunft mit weniger Startern als der Mindestzahl wird
//     nicht gewertet (Pkt. 5.1: „a minimum of five drivers“) – sie steht mit ihren Punkten
//     dahinter, ohne Platz. Gezählt werden dafür die Starter, die für die Pokalauswertung
//     zählen (auch Disqualifizierte und Offene): Mit „nur ausgewählte Starter zählen“ ist die
//     Auswahl die gemeldete Mannschaft, und wer abgewählt ist, gehört nicht dazu.
//     Wird unter Regel 960 auch der Parallelslalom gewertet, zählen je Starter die addierten
//     Punkte beider Stages (Pkt. 5.1: „the five best results of the team in the overall
//     individual competitions“; Pkt. 5.2.4) – die Zeilen kommen dann aus der Einzelwertung
//     (lib/einzelwertung.ts `einzelPokalKlassen`) und tragen ihre Punkte selbst (`punkte`).
// Punktgleiche Herkünfte trennt der Stichentscheid des Regelwerks (YAML `pokal.stichentscheid`,
// `PokalStich`): DM C6 „Bei Gleichstand zählt die Anzahl der 1. Plätze. Sollte weiterhin
// gleichstand bestehen, wird mit den Plätzen 2 und 3 ebenso verfahren.“ – UIM 960, Pkt. 5.2.6
// „the sum of points of 1st places are added, if the dead heat situation continues, the same
// procedure must been followed for the 2nd place until a winner can be defined.“ Gezählt
// werden die Plätze aller Starter der Herkunft, die für die Wertung zählen. Erst wenn auch das
// nichts trennt (oder das Regelwerk nichts nennt), teilen sie sich den Platz, der nächste
// entfällt. Die Regel des Regelwerks gilt für jede Variante – auch für die nach Plätzen, die in
// keinem Regelbuch steht. Wessen Platz so entstand, trägt `stich` (Sternchen auf dem Blatt).
//
// Zwischenstand: Die Wertung lässt sich jederzeit rechnen. Solange nicht jede Klasse mit
// Startern ein vollständiges Gesamtergebnis hat, nennt sie die offenen Klassen (`offen`) – die
// Liste kennzeichnet sich dann deutlich als Zwischenstand.
//
// Im Zwischenstand zählt eine Klasse mit ihrer Gesamtliste, wie sie gerade steht – auch
// mitten in einem angefangenen Lauf (Entscheidung des Nutzers: „Ich finde einen springenden
// Zwischenstand okay“). Die Gesamtliste stellt alle Offenen (noch nicht Gefahrenen) ohne Zeit
// auf Platz 1 und den besten Gewerteten dahinter; für die Mannschaftswertung werden die Plätze
// deshalb UNTER DEN GEFAHRENEN gebildet (Platz der Gesamtliste minus Zahl der Offenen): Wer
// bisher der Beste ist, hat Platz 1 und dessen Punkte. Offene bekommen nichts und schieben
// niemanden nach hinten. Die Reihenfolge der Herkünfte kann damit von Starter zu Starter
// springen – am Ende ist es die Gesamtliste selbst.

/** Ein Starter mit seinem Platz in der Gesamtliste seiner Klasse. */
export interface PokalZeile {
  starter: Starter
  /** Platz in der Gesamtliste; 0, solange die Klasse noch kein Ergebnis hat. */
  platz: number
  disq: boolean
  /** Noch kein vergleichbares Ergebnis (in der Gesamtliste ohne Zeit auf Platz 1). */
  offen: boolean
  /**
   * Nur für die Wertung nach UIM-Punkten über beide Stages (lib/einzelwertung.ts
   * `einzelPokalKlassen`): die Punkte des Starters aus der Einzelwertung – sie gelten dann statt
   * der Punkte seines Platzes, und `platz` ist der Platz der Einzelwertung. Fehlt = Punkte des
   * Platzes (eine Stage, alle Wertungen nach Plätzen).
   */
  punkte?: number
}

export interface PokalKlasse {
  klasse: ClassId
  /** Alle Läufe der Wertung sind gefahren, niemand ist mehr offen. */
  fertig: boolean
  /** Die Läufe, auf denen die Plätze beruhen: die der Gesamtliste, auch ein angefangener. Leer = noch keiner. */
  laeufe: number[]
  /** So viele Starter stehen mit einem Platz da (gewertet oder disqualifiziert); die übrigen sind offen. */
  gefahren: number
  /** Alle Starter der Klasse. */
  zeilen: PokalZeile[]
}

/**
 * Die Gesamtlisten als Grundlage der Pokalauswertung: je Klasse mit Startern ein Eintrag, in
 * der Reihenfolge von `klassen`. Eine Klasse ohne jedes Ergebnis ist dabei – ihre Starter
 * zählen zur Herkunft (UIM: Mindestzahl), haben aber noch keinen Platz. Die Plätze sind die
 * unter den Gefahrenen (siehe oben): Offene haben Platz 0 und zählen bei niemandem mit.
 */
export function pokalKlassen(stand: ErgebnisStand, konfig: ErgebnisKonfig, klassen: readonly ClassId[] = CLASS_IDS, optionen: { knoten?: boolean } = {}): PokalKlasse[] {
  const laufCount = Math.max(1, stand.laufCount)
  const knoten = optionen.knoten === true
  return klassen.flatMap((klasse): PokalKlasse[] => {
    const starter = stand.starters.filter((p) => p.klasse === klasse)
    if (starter.length === 0) return []
    const gesamt = klassenErgebnis(stand, konfig, klasse)?.gesamt
    if (!gesamt) return [{ klasse, fertig: false, laeufe: [], gefahren: 0, zeilen: starter.map((p) => ({ starter: p, platz: 0, disq: false, offen: true })) }]
    // Die Gesamtliste zählt die Offenen vor den Gewerteten mit (alle auf Platz 1).
    // „Offen“ ist, wen die Gesamtliste so einordnet (`wertungVon`) – genau die zählt sie vorn mit.
    // `knoten` (Regel 960): Wer gefahren ist, dessen Knoten aber noch nicht erfasst sind, ist für
    // die Punkte ebenfalls offen – sein Platz kann sich mit den Strafsekunden der Knoten ändern.
    const istOffen = (z: (typeof gesamt.nachPlatz)[number]) => wertungVon(z) === 'offen' || (knoten && knotenFehlen(z))
    const offene = gesamt.nachPlatz.filter(istOffen).length
    const gefahrene = gesamt.nachPlatz.filter((z) => !istOffen(z))
    // Der Platz unter den Gefahrenen: 1 + die Zahl derer, die vor ihm stehen. Ohne fehlende Knoten
    // dasselbe wie „Platz minus Zahl der Offenen“ (die Offenen stehen alle auf Platz 1).
    const zeilen = gesamt.nachPlatz.map((z) => ({ starter: z.starter, platz: istOffen(z) ? 0 : 1 + gefahrene.filter((y) => y.platz < z.platz).length, disq: z.disq, offen: istOffen(z) }))
    return [{ klasse, fertig: klasseFertig(gesamt, laufCount, knoten), laeufe: gesamt.laeufe, gefahren: zeilen.length - offene, zeilen }]
  })
}

/** Was {@link klasseFertig} und {@link gesamtPunkte} von einer Gesamtliste brauchen. */
export interface GesamtStand {
  laeufe: GesamtListe['laeufe']
  nachPlatz: ReadonlyArray<{ starter: { id: string }; platz: number; disq: boolean; gesamt: number | null; knotenErfasst?: boolean }>
}

/** Gewertet gefahren, aber die Knoten sind noch nicht erfasst (lib/ergebnis.ts `knotenErfasst`). */
const knotenFehlen = (z: GesamtStand['nachPlatz'][number]) => wertungVon(z) === 'gewertet' && z.knotenErfasst === false

/**
 * Steht das Gesamtergebnis der Klasse fest? Alle Läufe der Wertung sind gefahren, niemand ist
 * mehr offen. Mit `knoten` (Regel 960) außerdem: Die Knoten jedes Gewerteten sind erfasst – Pkt.
 * 5.2.1 nennt die UIM points des Manövrierens für „best times including knots test penalties“,
 * vorher steht der Platz nicht fest (Entscheidung des Nutzers vom 15.11.2026). Disqualifizierte
 * brauchen keine Knoten: Sie haben ohnehin 0 Punkte. Unter der DM bleibt es ohne `knoten`.
 */
export function klasseFertig(gesamt: GesamtStand, laufCount: number, knoten = false): boolean {
  return gesamt.laeufe.length >= Math.max(1, laufCount) && gesamt.nachPlatz.every((z) => wertungVon(z) !== 'offen' && !(knoten && knotenFehlen(z)))
}

/**
 * Die Punkte je Starter für die Spalte „UIM points“ der Gesamtliste (UIM 960, Pkt. 5.2.1:
 * „… best times including knots test penalties, ranking, UIM points“; Tabelle Pkt. 5.1).
 *
 * - `null`, solange die Klasse nicht vollständig ist ({@link klasseFertig}, mit den Knoten): Vorher sind die
 *   Plätze vorläufig (Offene stehen ohne Zeit auf Platz 1), und Punkte, die sich beim nächsten
 *   Starter ändern, gehören nicht auf einen Aushang. Die Mannschaftswertung zeigt für diese
 *   Zeit ihren eigenen Zwischenstand.
 * - Sonst je Starter die Punkte seines Platzes. Ein geteilter Platz gibt beiden die vollen
 *   Punkte dieses Platzes, der nächste entfällt (Pkt. 5.2.6 „dead-heat result“) – wie in der
 *   Mannschaftswertung ({@link uimWertung}), damit beide Listen dieselben Punkte nennen.
 * - Disqualifizierte haben 0 Punkte (Pkt. 5.1: „Drivers must complete the relevant stage and
 *   cross the finishing line in order to be classified for the stage.“), ebenso Plätze hinter
 *   dem Ende der Tabelle.
 */
export function gesamtPunkte(gesamt: GesamtStand, laufCount: number, punkte: readonly number[]): Map<string, number> | null {
  if (!klasseFertig(gesamt, laufCount, true)) return null
  return new Map(gesamt.nachPlatz.map((z) => [z.starter.id, wertungVon(z) === 'gewertet' ? platzPunkte(punkte, z.platz) : 0]))
}

/** Wer zu welcher Herkunft gehört und wer zählt. */
export interface PokalZuordnung {
  /** Herkunft eines Starters, wie sie bei ihm steht; leer = keine (er gehört zu keiner Mannschaft). */
  herkunft: (p: Starter) => string
  /** Zählt der Starter für die Pokalauswertung? */
  zaehlt: (p: Starter) => boolean
  /** Unter welchem Schlüssel Schreibweisen einer Herkunft zusammengehören; ohne Angabe `herkunftSchluessel`. */
  schluessel?: (herkunft: string) => string
}

/** Die Zuordnung zum Stand der Veranstaltung: gewählte Herkunft und – wenn eingeschaltet – die Auswahl der Starter. */
export function pokalZuordnung(stand: Pick<AppState, 'originMode'>, nurAuswahl: boolean): PokalZuordnung {
  return {
    herkunft: (p) => pokalHerkunft(p, stand.originMode),
    zaehlt: (p) => !nurAuswahl || p.pokal !== false,
    schluessel: (name) => mannschaftSchluessel(name, stand.originMode),
  }
}

/**
 * Die Herkunft eines Starters für die Pokalauswertung: genau das gewählte Feld, ohne den
 * Rückfall der Listen von „Verein“ auf „Bundesland“ (lib/origin.ts `originOf`) – ein
 * Bundesland ist kein Verein und soll in der Vereinswertung nicht als Mannschaft auftauchen.
 */
export function pokalHerkunft(p: Starter, mode: OriginMode): string {
  const feld = mode === 'none' ? '' : mode === 'land' ? p.land : mode === 'bundesland' ? p.bundesland : p.verein
  return (feld ?? '').replace(/\s+/g, ' ').trim()
}

/** Der Schlüssel, unter dem Schreibweisen einer Herkunft zusammengehören. */
export const herkunftSchluessel = (name: string) => name.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Der Schlüssel einer Mannschaft: das erkannte Bundesland oder der erkannte Staat (dieselbe
 * Zuordnung wie für die Flaggen, domain/flaggen.ts), sonst die Schreibweise. Für Vereine gibt
 * es keine Zuordnung – dort zählt nur die Schreibweise.
 */
export function mannschaftSchluessel(name: string, mode: OriginMode): string {
  const flagge = flaggeVon(name, mode)
  // Der Doppelpunkt trennt beide Arten: Keine Schreibweise kann wie ein erkannter Code aussehen.
  return flagge ? `${flagge.art}:${flagge.code}` : `text:${herkunftSchluessel(name)}`
}

/**
 * Sammelt Einträge je Herkunft; Schreibweisen, die sich nur in Groß-/Kleinschreibung oder
 * Leerzeichen unterscheiden, sind dieselbe. Angezeigt wird die häufigste Schreibweise, bei
 * Gleichstand die zuerst genannte.
 */
export function jeHerkunft<T>(schluessel: (name: string) => string = herkunftSchluessel): { zu: (name: string, neu: () => T) => T; alle: () => { herkunft: string; wert: T }[] } {
  const gruppen = new Map<string, { wert: T; namen: Map<string, number> }>()
  return {
    zu(name, neu) {
      const k = schluessel(name)
      const g = gruppen.get(k) ?? { wert: neu(), namen: new Map<string, number>() }
      gruppen.set(k, g)
      g.namen.set(name, (g.namen.get(name) ?? 0) + 1)
      return g.wert
    },
    alle: () =>
      [...gruppen.values()].map((g) => ({
        // Map behält die Reihenfolge des Einfügens: Bei gleicher Häufigkeit gewinnt die erste.
        herkunft: [...g.namen].reduce((a, b) => (b[1] > a[1] ? b : a))[0],
        wert: g.wert,
      })),
  }
}

/** Punkte eines Platzes: `punkte[0]` für Platz 1 …; hinter dem Ende der Tabelle gibt es keine. */
export function platzPunkte(punkte: readonly number[], platz: number): number {
  return Number.isInteger(platz) && platz >= 1 ? (punkte[platz - 1] ?? 0) : 0
}

/** Bekommt diese Zeile überhaupt Punkte? Nur mit einem gewerteten Ergebnis. */
const gewertet = (z: PokalZeile) => z.platz >= 1 && !z.disq && !z.offen

/** Die Klassen, deren Gesamtergebnis noch nicht feststeht. */
const offeneKlassen = (klassen: readonly PokalKlasse[]) => klassen.filter((k) => !k.fertig).map((k) => k.klasse)

/**
 * Der Stichentscheid der Mannschaftswertung, wie ihn das Regelwerk nennt (YAML
 * `pokal.stichentscheid`): Bei gleicher Punktzahl steht vorn, wer mehr 1. Plätze hat, dann
 * mehr 2. Plätze … bis Platz `plaetze` (fehlt = jeder Platz der Punktetabelle der Wertung).
 *   • anzahl – verglichen wird die Zahl der Plätze (DM C6);
 *   • punkte – die Summe der Punkte dieser Plätze (UIM 960, Pkt. 5.2.6). Mit der UIM-Tabelle
 *     dasselbe; mit eigenen Punkten kann ein Platz ohne Punkte dann nichts entscheiden.
 */
export interface PokalStich {
  zaehlt: 'anzahl' | 'punkte'
  plaetze?: number
}

/** Die Plätze der Starter einer Herkunft als Zahl je Platz (Index 0 = 1. Platz), `bis` Plätze weit. */
function platzZahlen(plaetze: readonly number[], bis: number): number[] {
  const zahl = Array.from({ length: bis }, () => 0)
  for (const platz of plaetze) if (platz >= 1 && platz <= bis) zahl[platz - 1]++
  return zahl
}

/** Der Reihe nach verglichen; negativ = `a` steht vorn (mehr vom besseren Platz). */
const vergleicheStich = (a: readonly number[], b: readonly number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i]
  return 0
}

/**
 * Plätze vergeben. `sortiert` steht schon nach Punkten (die meisten zuerst), bei Gleichstand
 * nach Namen. Punktgleiche trennt der Stichentscheid; was er nicht trennt, teilt sich den
 * Platz – der nächste entfällt (1, 1, 3). `stich`: Der Platz dieser Zeile hat sich im
 * Stichentscheid ergeben (sie ist punktgleich mit einer, von der er sie trennt).
 */
function mitPlatz<T>(
  sortiert: readonly T[],
  punkte: (x: T) => number,
  entscheid?: { regel: PokalStich; plaetze: (x: T) => readonly number[]; tabelle: readonly number[] },
): { x: T; platz: number; stich: boolean }[] {
  const bis = entscheid ? Math.max(0, Math.min(entscheid.regel.plaetze ?? entscheid.tabelle.length, 200)) : 0
  const schluessel = new Map(
    sortiert.map((x): [T, number[]] => {
      if (!entscheid) return [x, []]
      const zahl = platzZahlen(entscheid.plaetze(x), bis)
      return [x, entscheid.regel.zaehlt === 'punkte' ? zahl.map((n, i) => n * platzPunkte(entscheid.tabelle, i + 1)) : zahl]
    }),
  )
  const vergleiche = (a: T, b: T) => punkte(b) - punkte(a) || vergleicheStich(schluessel.get(a)!, schluessel.get(b)!)
  // Stabil: Was auch der Stichentscheid nicht trennt, bleibt in der Reihenfolge der Namen.
  const reihe = [...sortiert].sort(vergleiche)
  return reihe.map((x) => ({
    x,
    platz: 1 + reihe.filter((y) => vergleiche(y, x) < 0).length,
    stich: reihe.some((y) => punkte(y) === punkte(x) && vergleicheStich(schluessel.get(y)!, schluessel.get(x)!) !== 0),
  }))
}

const nachName = (a: string, b: string) => a.localeCompare(b, 'de')

// ---------------------------------------------------------------------------
// Plätze 1 bis n je Klasse
// ---------------------------------------------------------------------------

export interface PlaetzeZeile {
  herkunft: string
  platz: number
  /** Punktgleich mit einer anderen Herkunft – den Platz hat der Stichentscheid des Regelwerks bestimmt. */
  stich: boolean
  /** Summe aller Punkte. */
  gesamt: number
  /**
   * Je Klasse (in der Reihenfolge von `PlaetzeWertung.klassen`) die Punkte für Platz 1 bis n –
   * 0, wo die Herkunft den Platz nicht belegt; die Summe, wo zwei ihrer Starter ihn teilen.
   */
  punkte: number[][]
}

export interface PlaetzeWertung {
  /** Die Klassen mit Startern. */
  klassen: ClassId[]
  /** So viele Plätze je Klasse bekommen Punkte (Länge der Punktetabelle). */
  plaetze: number
  /** Jede Herkunft mit mindestens einem Starter, der zählt – nach Platz, bei Gleichstand nach Name. */
  zeilen: PlaetzeZeile[]
  /** Starter ohne Herkunft: Sie zählen nirgends mit. */
  ohneHerkunft: number
  /** Klassen, deren Gesamtergebnis noch nicht feststeht: Die Wertung ist ein Zwischenstand. */
  offen: ClassId[]
}

export function plaetzeWertung(klassen: readonly PokalKlasse[], punkte: readonly number[], zuordnung: PokalZuordnung, stich?: PokalStich): PlaetzeWertung {
  const je = jeHerkunft<{ zellen: number[][]; plaetze: number[] }>(zuordnung.schluessel)
  let ohneHerkunft = 0
  klassen.forEach((k, ki) => {
    for (const z of k.zeilen) {
      const herkunft = zuordnung.herkunft(z.starter)
      if (!herkunft) {
        ohneHerkunft++
        continue
      }
      if (!zuordnung.zaehlt(z.starter)) continue
      const { zellen, plaetze } = je.zu(herkunft, () => ({ zellen: klassen.map(() => punkte.map(() => 0)), plaetze: [] }))
      // Wer zählt, aber keine Punkte holt, macht seine Herkunft trotzdem zur Zeile der Liste.
      if (gewertet(z)) plaetze.push(z.platz)
      if (gewertet(z) && z.platz <= punkte.length) zellen[ki][z.platz - 1] += platzPunkte(punkte, z.platz)
    }
  })
  const summe = (zellen: number[][]) => zellen.reduce((n, klasse) => n + klasse.reduce((a, b) => a + b, 0), 0)
  const sortiert = je
    .alle()
    .map(({ herkunft, wert }) => ({ herkunft, punkte: wert.zellen, gesamt: summe(wert.zellen), plaetze: wert.plaetze }))
    .sort((a, b) => b.gesamt - a.gesamt || nachName(a.herkunft, b.herkunft))
  return {
    klassen: klassen.map((k) => k.klasse),
    plaetze: punkte.length,
    zeilen: mitPlatz(sortiert, (z) => z.gesamt, stich && { regel: stich, plaetze: (z) => z.plaetze, tabelle: punkte }).map(({ x: { plaetze: _, ...zeile }, platz, stich: imStich }) => ({ ...zeile, platz, stich: imStich })),
    ohneHerkunft,
    offen: offeneKlassen(klassen),
  }
}

// ---------------------------------------------------------------------------
// UIM: Punkte für die Plätze 1 bis 20, je Herkunft zählen die Besten
// ---------------------------------------------------------------------------

export interface UimStarter extends PokalZeile {
  klasse: ClassId
  punkte: number
  /** Gehört zu den Besten der Herkunft: Seine Punkte zählen für die Mannschaft. */
  top: boolean
}

export interface UimGruppe {
  herkunft: string
  /** Platz der Herkunft; `null` = nicht gewertet (weniger Starter als die Mindestzahl). */
  platz: number | null
  /** Punktgleich mit einer anderen Herkunft – den Platz hat der Stichentscheid des Regelwerks bestimmt. */
  stich: boolean
  /** Alle Starter der Herkunft, die zählen – nach Punkten, dann Klasse und Startnummer. */
  starter: UimStarter[]
  /** Summe der Punkte aller Starter. */
  summe: number
  /** Summe der Besten: das Ergebnis der Mannschaft. */
  summeBeste: number
}

export interface UimWertung {
  beste: number
  mindestens: number
  /** Erst die gewerteten Herkünfte nach Platz, dahinter die nicht gewerteten. */
  gruppen: UimGruppe[]
  ohneHerkunft: number
  offen: ClassId[]
}

export function uimWertung(
  klassen: readonly PokalKlasse[],
  regeln: { punkte: readonly number[]; beste: number; mindestens: number; stich?: PokalStich },
  zuordnung: PokalZuordnung,
): UimWertung {
  const beste = Math.max(1, Math.round(regeln.beste))
  const mindestens = Math.max(1, Math.round(regeln.mindestens))
  const je = jeHerkunft<Omit<UimStarter, 'top'>[]>(zuordnung.schluessel)
  let ohneHerkunft = 0
  for (const k of klassen) {
    for (const z of k.zeilen) {
      const herkunft = zuordnung.herkunft(z.starter)
      if (!herkunft) {
        ohneHerkunft++
        continue
      }
      if (!zuordnung.zaehlt(z.starter)) continue
      je.zu(herkunft, () => []).push({ ...z, klasse: k.klasse, punkte: z.punkte ?? (gewertet(z) ? platzPunkte(regeln.punkte, z.platz) : 0) })
    }
  }
  const rang = (klasse: ClassId) => CLASS_IDS.indexOf(klasse)
  const gruppen = je.alle().map(({ herkunft, wert: liste }) => {
    // Bei gleichen Punkten zuerst der bessere Platz: Rechnet die Wertung aus beiden Stages, können
    // zwei Starter dieselbe Summe, aber verschiedene Plätze der Einzelwertung haben (durch die Zeit
    // getrennt, oder in verschiedenen Klassen). Stünde an der Grenze der Besten der mit dem
    // schlechteren Platz vorn, zählte der Stichentscheid („1st places“, Pkt. 5.2.6) einen 1. Platz
    // nicht mit. Aus dem Manövrieren allein ändert das nichts: Dort heißen gleiche Punkte gleicher Platz.
    const platzRang = (z: { platz: number }) => (z.platz >= 1 ? z.platz : Infinity)
    const sortiert = [...liste].sort(
      (a, b) => b.punkte - a.punkte || platzRang(a) - platzRang(b) || rang(a.klasse) - rang(b.klasse) || vergleicheNr(a.starter.startNr, b.starter.startNr),
    )
    // Die Besten sind die ersten der Reihenfolge; wer keine Punkte hat, trägt nichts bei und
    // wird nicht als „zählt“ gekennzeichnet. Bei gleichen Punkten an der Grenze ist die Summe dieselbe.
    const starter = sortiert.map((s, i): UimStarter => ({ ...s, top: i < beste && s.punkte > 0 }))
    return {
      herkunft,
      starter,
      summe: starter.reduce((n, s) => n + s.punkte, 0),
      summeBeste: starter.reduce((n, s) => n + (s.top ? s.punkte : 0), 0),
    }
  })
  const ordnung = (a: (typeof gruppen)[number], b: (typeof gruppen)[number]) => b.summeBeste - a.summeBeste || nachName(a.herkunft, b.herkunft)
  const mitWertung = gruppen.filter((g) => g.starter.length >= mindestens).sort(ordnung)
  const ohnePlatz = gruppen.filter((g) => g.starter.length < mindestens).sort(ordnung)
  return {
    beste,
    mindestens,
    gruppen: [
      // Pkt. 5.2.6: „This is only possible if both teams have enough drivers to be taken into
      // account“ – der Stichentscheid gilt unter den gewerteten Herkünften. Verglichen werden
      // nur die Plätze der Besten, deren Punkte für die Mannschaft zählen (Pkt. 5.2.4 „the top
      // five team members“): Sonst entschiede der Platz eines sechsten Starters, dessen Punkte
      // gar nicht in die Summe eingehen.
      ...mitPlatz(mitWertung, (g) => g.summeBeste, regeln.stich && { regel: regeln.stich, plaetze: (g) => g.starter.filter((s) => s.top).map((s) => s.platz), tabelle: regeln.punkte }).map(
        ({ x, platz, stich }): UimGruppe => ({ ...x, platz, stich }),
      ),
      ...ohnePlatz.map((g): UimGruppe => ({ ...g, platz: null, stich: false })),
    ],
    ohneHerkunft,
    offen: offeneKlassen(klassen),
  }
}
