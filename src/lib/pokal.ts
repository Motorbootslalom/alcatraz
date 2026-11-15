import type { AppState, ClassId, OriginMode, Starter } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { flaggeVon } from '../domain/flaggen'
import { laufSchluessel, vergleicheNr } from './eingaben'
import { klassenErgebnis, type ErgebnisKonfig, type ErgebnisStand, type GesamtListe } from './ergebnis'

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
// Punktgleiche Herkünfte teilen sich den Platz, der nächste entfällt (Vorgabe des Veranstalters;
// kein weiteres Kriterium – auch nicht das aus Pkt. 5.2.6 der UIM).
//
// Zwischenstand: Die Wertung lässt sich jederzeit rechnen. Solange nicht jede Klasse mit
// Startern ein vollständiges Gesamtergebnis hat, nennt sie die offenen Klassen (`offen`) – die
// Liste kennzeichnet sich dann deutlich als Zwischenstand.
//
// Eine Klasse zählt im Zwischenstand mit ihrem Stand nach den vollständig gefahrenen Läufen;
// ein angefangener Lauf zählt erst, wenn niemand mehr offen ist. Der Grund: Die Gesamtliste
// stellt alle Offenen auf Platz 1 und den besten Gewerteten dahinter (Platz „Zahl der Offenen
// + 1“). Dieser Platz ist weder der vorläufige noch der schlechtestmögliche – der Erste von
// acht stünde nach seiner Fahrt auf Platz 8 und bekäme keinen Punkt, und im zweiten Lauf
// stünde der zuerst Gefahrene allein vorn. Die Reihenfolge der Herkünfte spränge mit jedem
// Starter um. Mit den vollständigen Läufen steht dagegen genau das da, was die Gesamtliste
// nach dem letzten fertigen Lauf gezeigt hat; am Ende ist es die Gesamtliste selbst.

/** Ein Starter mit seinem Platz in der Gesamtliste seiner Klasse. */
export interface PokalZeile {
  starter: Starter
  /** Platz in der Gesamtliste; 0, solange die Klasse noch kein Ergebnis hat. */
  platz: number
  disq: boolean
  /** Noch kein vergleichbares Ergebnis (in der Gesamtliste ohne Zeit auf Platz 1). */
  offen: boolean
}

export interface PokalKlasse {
  klasse: ClassId
  /** Alle Läufe der Wertung sind gefahren, niemand ist mehr offen. */
  fertig: boolean
  /** Die Läufe, auf denen die Plätze beruhen: die vollständig gefahrenen. Leer = noch keiner. */
  laeufe: number[]
  /** Alle Starter der Klasse. */
  zeilen: PokalZeile[]
}

/**
 * Die Gesamtlisten als Grundlage der Pokalauswertung: je Klasse mit Startern ein Eintrag, in
 * der Reihenfolge von `klassen`. Eine Klasse ohne jedes Ergebnis ist dabei – ihre Starter
 * zählen zur Herkunft (UIM: Mindestzahl), haben aber noch keinen Platz.
 */
export function pokalKlassen(stand: ErgebnisStand, konfig: ErgebnisKonfig, klassen: readonly ClassId[] = CLASS_IDS): PokalKlasse[] {
  const laufCount = Math.max(1, stand.laufCount)
  return klassen.flatMap((klasse): PokalKlasse[] => {
    const starter = stand.starters.filter((p) => p.klasse === klasse)
    if (starter.length === 0) return []
    const gesamt = klassenErgebnis(stand, konfig, klasse)?.gesamt
    const voll = gesamt && gesamt.nachPlatz.some((z) => z.offen) ? nachVollenLaeufen(stand, konfig, klasse, gesamt) : gesamt
    if (!voll) return [{ klasse, fertig: false, laeufe: [], zeilen: starter.map((p) => ({ starter: p, platz: 0, disq: false, offen: true })) }]
    const zeilen = voll.nachPlatz.map((z) => ({ starter: z.starter, platz: z.platz, disq: z.disq, offen: z.offen }))
    return [{ klasse, fertig: voll === gesamt && voll.laeufe.length >= laufCount, laeufe: voll.laeufe, zeilen }]
  })
}

/**
 * Die Gesamtliste einer Klasse ohne ihre angefangenen Läufe (in denen noch jemand offen ist) –
 * so, wie sie nach dem letzten vollständigen Lauf stand; `undefined`, wenn noch keiner
 * vollständig ist. Gerechnet wird mit der echten Wertung über einen Stand ohne die Eingaben
 * dieser Läufe: Streichläufe und Stichentscheid gelten damit wie auf der Gesamtliste.
 */
function nachVollenLaeufen(stand: ErgebnisStand, konfig: ErgebnisKonfig, klasse: ClassId, gesamt: GesamtListe): GesamtListe | undefined {
  const disziplin = konfig.getAufbau(stand.aufbau).disziplin
  let eingaben = stand.eingaben
  let liste: GesamtListe | undefined = gesamt
  // Jede Runde nimmt mindestens einen Lauf heraus – nach höchstens so vielen Runden, wie die
  // Liste Läufe hat, ist niemand mehr offen oder kein Lauf mehr übrig.
  while (liste) {
    const aktuell: GesamtListe = liste
    const offene = aktuell.nachNummer.filter((z) => z.offen)
    if (offene.length === 0) return aktuell
    const angefangen = new Set(aktuell.laeufe.filter((_, k) => offene.some((z) => z.laeufe[k].offen)).map((lauf) => laufSchluessel(disziplin, lauf)))
    if (angefangen.size === 0) return undefined
    eingaben = Object.fromEntries(Object.entries(eingaben).filter(([schluessel]) => !angefangen.has(schluessel)))
    liste = klassenErgebnis({ ...stand, eingaben }, konfig, klasse)?.gesamt
  }
  return undefined
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
 * Plätze vergeben: gleiche Punkte, gleicher Platz – der nächste entfällt (1, 1, 3).
 * `sortiert` steht schon in der Reihenfolge der Punkte, die meisten zuerst.
 */
function mitPlatz<T>(sortiert: readonly T[], punkte: (x: T) => number): { x: T; platz: number }[] {
  let platz = 0
  return sortiert.map((x, i) => {
    if (i === 0 || punkte(x) !== punkte(sortiert[i - 1])) platz = i + 1
    return { x, platz }
  })
}

const nachName = (a: string, b: string) => a.localeCompare(b, 'de')

// ---------------------------------------------------------------------------
// Plätze 1 bis n je Klasse
// ---------------------------------------------------------------------------

export interface PlaetzeZeile {
  herkunft: string
  platz: number
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

export function plaetzeWertung(klassen: readonly PokalKlasse[], punkte: readonly number[], zuordnung: PokalZuordnung): PlaetzeWertung {
  const je = jeHerkunft<number[][]>(zuordnung.schluessel)
  let ohneHerkunft = 0
  klassen.forEach((k, ki) => {
    for (const z of k.zeilen) {
      const herkunft = zuordnung.herkunft(z.starter)
      if (!herkunft) {
        ohneHerkunft++
        continue
      }
      if (!zuordnung.zaehlt(z.starter)) continue
      const zellen = je.zu(herkunft, () => klassen.map(() => punkte.map(() => 0)))
      // Wer zählt, aber keine Punkte holt, macht seine Herkunft trotzdem zur Zeile der Liste.
      if (gewertet(z) && z.platz <= punkte.length) zellen[ki][z.platz - 1] += platzPunkte(punkte, z.platz)
    }
  })
  const summe = (zellen: number[][]) => zellen.reduce((n, klasse) => n + klasse.reduce((a, b) => a + b, 0), 0)
  const sortiert = je
    .alle()
    .map(({ herkunft, wert: zellen }) => ({ herkunft, punkte: zellen, gesamt: summe(zellen) }))
    .sort((a, b) => b.gesamt - a.gesamt || nachName(a.herkunft, b.herkunft))
  return {
    klassen: klassen.map((k) => k.klasse),
    plaetze: punkte.length,
    zeilen: mitPlatz(sortiert, (z) => z.gesamt).map(({ x, platz }) => ({ ...x, platz })),
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
  regeln: { punkte: readonly number[]; beste: number; mindestens: number },
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
      je.zu(herkunft, () => []).push({ ...z, klasse: k.klasse, punkte: gewertet(z) ? platzPunkte(regeln.punkte, z.platz) : 0 })
    }
  }
  const rang = (klasse: ClassId) => CLASS_IDS.indexOf(klasse)
  const gruppen = je.alle().map(({ herkunft, wert: liste }) => {
    const sortiert = [...liste].sort((a, b) => b.punkte - a.punkte || rang(a.klasse) - rang(b.klasse) || vergleicheNr(a.starter.startNr, b.starter.startNr))
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
      ...mitPlatz(mitWertung, (g) => g.summeBeste).map(({ x, platz }): UimGruppe => ({ ...x, platz })),
      ...ohnePlatz.map((g): UimGruppe => ({ ...g, platz: null })),
    ],
    ohneHerkunft,
    offen: offeneKlassen(klassen),
  }
}
