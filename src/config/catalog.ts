import type { ClassId } from '../types'
import { CLASS_IDS } from '../domain/classes'
import type { KuerzelNorm } from '../domain/kuerzel'
import { configFor, eigeneAuswahl, ROH_QUELLE, ROH_REGELWERKE, type RohRegelwerk } from './konfig'
import { regelwerkInfo, type DisziplinWertung } from './build'
import type { RawAufbau, StichKriterium } from './schema'

/**
 * Was eine Veranstaltung zur Auswahl hat: Regelwerke (aus der Ausschreibung) und
 * Aufbauten (wie die Wettkampfrichter am Austragungsort sitzen).
 *
 * Eine schmale Sicht auf die Konfiguration der Wettkampfrichter-Listen
 * (config/konfig.ts) – dieselben YAML-Dateien, dieselbe Lesart. Hier steht nur,
 * was Zustand und Planung brauchen, ohne Positionen und Fehlerkataloge. Zu den
 * mitgelieferten Aufbauten kommen die eigenen aus dem Stand der Veranstaltung.
 */
export const MANOEVRIEREN = 'manoevrieren'
export const PARALLEL = 'parallel'

export interface Regelwerk {
  id: string
  /** Anzeige, z. B. „DM 2026“. */
  label: string
  klassen: ClassId[]
  /** Eigene Klassennamen, z. B. E → „Dolphin“. */
  klassenNamen: Partial<Record<ClassId, string>>
  /** Eigene Kurzzeichen der Klassen für die runden Marken der Oberfläche, z. B. E → „D“; sonst die Kennung. */
  klassenKurz: Partial<Record<ClassId, string>>
  /** Was vor der laufenden Nummer klassenbezogener Startnummern steht, z. B. E → „E“ (E01); sonst die Kennung. */
  startNrPraefix: Partial<Record<ClassId, string>>
  /** Kennungen der Disziplinen, die nach diesem Regelwerk gefahren werden. */
  disziplinen: string[]
  /** Statistisches Durchschnittsgewicht je Klasse in kg (Grundlage des Ausgleichsgewichts). */
  gewichte: Partial<Record<ClassId, number>>
  /** Klassen, in denen ein Co-Pilot an Bord sein muss (lib/besetzung.ts). */
  coPilotKlassen: ClassId[]
  /** Was bei gleichem Ergebnis entscheidet (lib/ergebnis.ts); leer = der Platz wird geteilt. */
  stichentscheid: StichKriterium[]
  /** Disziplin → Listen, die das Regelwerk in jedem ihrer Aufbauten vorsieht – abwählbare Vorgabe (lib/listen.ts). */
  vorgabeListen: Record<string, string[]>
  /** Läufe und Streichläufe, die das Regelwerk vorsieht: Voreinstellung bei der Wahl des Regelwerks und – ohne `nurVorgabe` – Maß für den Hinweis bei Abweichung. */
  wertungslaeufe?: { laeufe: number; streichlaeufe: number; nurVorgabe?: true; nachRegel?: Record<number, number> }
  /**
   * Disziplin → was für sie statt `stichentscheid` und `wertungslaeufe` gilt (lib/ergebnis.ts
   * `wertungDer`). Eine Disziplin ohne Eintrag folgt den Angaben oben.
   */
  wertungJeDisziplin: Record<string, DisziplinWertung>
  /**
   * Was das Regelwerk für den Aushang verlangt (UIM 960, Pkt. 5.2): `unterschrift` = Zeile für
   * den O.O.D. und Feld für die Uhrzeit des Aushangs unter jeder Wertungsliste; `punkte` =
   * Spalte mit den Punkten des Platzes auf der Gesamtliste.
   */
  aushang: { unterschrift: boolean; punkte: boolean }
  /**
   * Vorgabe für „Läufe direkt nacheinander“ (UIM 960, Pkt. 4.3.2). `undefined`: Das Regelwerk
   * kennt den Schalter nicht – er ist dann weder sichtbar noch wirksam ({@link versucheNacheinander}).
   */
  versucheNacheinander?: boolean
  /** Kürzel der Länder auf den Listen: IOC (DM und UIM, Regel 209) oder ISO – domain/kuerzel.ts `KuerzelNorm`. */
  laenderKuerzel: KuerzelNorm
  /** Eigene Startabstände des Regelwerks je Klasse in Sekunden; ersetzen die allgemeinen ({@link STARTABSTAENDE}). */
  startabstaende: Partial<Record<ClassId, number>>
}

export interface Aufbau {
  id: string
  name: string
  disziplin: string
  /** Ein eigener Aufbau aus dem Stand der Veranstaltung, nicht mitgeliefert. */
  eigen?: boolean
}

const isClassId = (value: string): value is ClassId => (CLASS_IDS as string[]).includes(value)

/** Texte je Klasse aus dem YAML: nur bekannte Klassen, nur nicht leere Texte (Zahlen als Text). */
function texteJeKlasse(roh: unknown): Partial<Record<ClassId, string>> {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {}
  return Object.fromEntries(
    Object.entries(roh)
      .filter(([klasse, text]) => isClassId(klasse) && (typeof text === 'string' || typeof text === 'number') && String(text).trim() !== '')
      .map(([klasse, text]) => [klasse, String(text).trim()]),
  )
}

/** Zahlen je Klasse aus dem YAML: nur bekannte Klassen, nur endliche Zahlen (geprüft in validate.ts). */
function zahlenJeKlasse(roh: unknown): Partial<Record<ClassId, number>> {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {}
  return Object.fromEntries(Object.entries(roh).filter(([klasse, zahl]) => isClassId(klasse) && typeof zahl === 'number' && Number.isFinite(zahl)))
}

function readRegelwerk(raw: RohRegelwerk): Regelwerk {
  const info = regelwerkInfo(raw)
  return {
    id: info.id,
    label: info.label,
    klassen: info.klassen.filter(isClassId),
    klassenNamen: raw.klassenNamen ?? {},
    klassenKurz: texteJeKlasse(raw.klassenKurz),
    startNrPraefix: texteJeKlasse(raw.startNrPraefix),
    disziplinen: raw.disziplinen ?? [MANOEVRIEREN],
    gewichte: raw.gewichte ?? {},
    coPilotKlassen: (raw.coPilot ?? []).map(String).filter(isClassId),
    stichentscheid: info.stichentscheid,
    vorgabeListen: info.vorgabeListen,
    wertungslaeufe: info.wertungslaeufe,
    wertungJeDisziplin: info.wertungJeDisziplin,
    aushang: info.aushang,
    ...(info.versucheNacheinander === undefined ? {} : { versucheNacheinander: info.versucheNacheinander }),
    laenderKuerzel: info.laenderKuerzel,
    startabstaende: zahlenJeKlasse(raw.startabstaende),
  }
}

/** Regelwerke in Menü-Reihenfolge; das erste ist die Vorgabe. */
export const REGELWERKE: Regelwerk[] = ROH_REGELWERKE.map(readRegelwerk)

/** Mitgelieferte Aufbauten in Menü-Reihenfolge; der erste ist die Vorgabe. */
export const AUFBAUTEN: Aufbau[] = configFor().aufbauten.map(({ id, name, disziplin }) => ({ id, name, disziplin }))

/** Mitgelieferte Aufbauten für das Manövrieren; der Parallelslalom hat einen festen. */
export const MANOEVER_AUFBAUTEN = AUFBAUTEN.filter((a) => a.disziplin === MANOEVRIEREN)

/**
 * Die Bezeichnungs-Schemata der Bojen-Seiten (R/L, Land/See …) in Menü-Reihenfolge; das erste
 * ist die Vorgabe. Die Namen stehen in `einstellungen.yaml` – wie die der Aufbauten – und
 * nicht noch einmal in src/i18n.
 */
export const BESCHRIFTUNGEN: { id: string; name: string }[] = configFor().beschriftungen.map(({ id, name }) => ({ id, name }))
export const DEFAULT_BESCHRIFTUNG = BESCHRIFTUNGEN[0]?.id ?? ''

/** Die Kennung, falls es das Schema gibt, sonst die Vorgabe (z. B. alte oder fremde Sicherung). */
export function beschriftungOf(id: unknown): string {
  return BESCHRIFTUNGEN.some((b) => b.id === id) ? (id as string) : DEFAULT_BESCHRIFTUNG
}

export const DEFAULT_REGELWERK = REGELWERKE[0].id
export const DEFAULT_AUFBAU = MANOEVER_AUFBAUTEN[0].id

/**
 * Die Aufbauten, unter denen für das Manövrieren gewählt wird: die mitgelieferten, dahinter
 * die eigenen, die die Prüfung bestehen (`eigeneAuswahl` in konfig.ts). Es ist dieselbe
 * Auswahl, mit der die Konfiguration gebaut wird – was hier wählbar ist, liefert sie auch.
 * Nicht wählbar sind deshalb: ein eigener mit der Kennung eines mitgelieferten (der
 * mitgelieferte gilt), ein beschädigter und einer für eine andere Disziplin.
 */
export function manoeverAufbauten(eigene: readonly RawAufbau[] = []): Aufbau[] {
  const dazu = eigeneAuswahl(eigene).gut.map((a): Aufbau => ({ id: a.id, name: a.name, disziplin: MANOEVRIEREN, eigen: true }))
  return [...MANOEVER_AUFBAUTEN, ...dazu]
}

/** Das Regelwerk mit dieser Kennung; unbekannte fallen auf die Vorgabe zurück. */
export function regelwerkOf(id: string): Regelwerk {
  return REGELWERKE.find((r) => r.id === id) ?? REGELWERKE[0]
}

/**
 * Werden die Läufe eines Starters direkt nacheinander gefahren (kein Aushang dazwischen)? Der
 * Schalter der Veranstaltung gilt nur unter einem Regelwerk, das ihn kennt – unter jedem
 * anderen bleibt er gespeichert, aber ohne Wirkung, und die Listen sind wie bisher.
 */
export function versucheNacheinander(stand: { regelwerk: string; versucheNacheinander?: boolean }): boolean {
  return regelwerkOf(stand.regelwerk).versucheNacheinander !== undefined && stand.versucheNacheinander === true
}

/**
 * Was vor der laufenden Nummer klassenbezogener Startnummern steht: die Angabe des Regelwerks –
 * und für die Klasse Dolphin (ein Regelwerk, das die Klasse E so nennt) der in den Einstellungen
 * gewählte Buchstabe, E oder D (`AppState.dolphinPraefix`; Entscheidung des Nutzers vom
 * 15.11.2026). Regel 960, Pkt. 3.7 sagt nur: „Each driver shall receive a personal number“.
 */
export function startNrPraefixe(stand: { regelwerk: string; dolphinPraefix?: 'E' | 'D' }): Partial<Record<ClassId, string>> {
  const rw = regelwerkOf(stand.regelwerk)
  return rw.klassenNamen.E === undefined || stand.dolphinPraefix === undefined ? rw.startNrPraefix : { ...rw.startNrPraefix, E: stand.dolphinPraefix }
}

/** Der wählbare Aufbau mit dieser Kennung; unbekannte (auch gelöschte oder abgelehnte eigene) fallen auf die Vorgabe zurück. */
export function aufbauOf(id: string, eigene: readonly RawAufbau[] = []): Aufbau {
  return manoeverAufbauten(eigene).find((a) => a.id === id) ?? MANOEVER_AUFBAUTEN[0]
}

/**
 * Die Aufbauten, unter denen für eine Disziplin gewählt wird: für das Manövrieren
 * {@link manoeverAufbauten} (mit den eigenen), für jede andere die mitgelieferten dieser
 * Disziplin. Eigene Aufbauten gibt es bisher nur für das Manövrieren (`eigeneAuswahl`).
 */
export function aufbautenFuer(disziplin: string, eigene: readonly RawAufbau[] = []): Aufbau[] {
  return disziplin === MANOEVRIEREN ? manoeverAufbauten(eigene) : AUFBAUTEN.filter((a) => a.disziplin === disziplin)
}

/**
 * Der Aufbau einer Disziplin: der mit dieser Kennung, sonst ihr erster (die Vorgabe).
 * `undefined`, wenn es für die Disziplin keinen gibt. Neben {@link aufbauOf} (Manövrieren, im
 * Stand als `aufbau`): Der Parallelslalom hat seinen eigenen Aufbau – bisher genau einen
 * (config/aufbauten/parallel.yaml), deshalb steht für ihn nichts im Stand.
 */
export function aufbauFuer(disziplin: string, id?: string, eigene: readonly RawAufbau[] = []): Aufbau | undefined {
  const liste = aufbautenFuer(disziplin, eigene)
  return liste.find((a) => a.id === id) ?? liste[0]
}

/** Wird nach diesem Regelwerk ein Parallelslalom gefahren? */
export function hasParallel(regelwerkId: string): boolean {
  return regelwerkOf(regelwerkId).disziplinen.includes(PARALLEL)
}

/**
 * Durchschnittsgewicht einer Klasse in kg: der eigene Wert der Veranstaltung, sonst
 * der des Regelwerks. `0`, wenn das Regelwerk für die Klasse keines nennt.
 */
export function sollgewichtOf(regelwerkId: string, eigene: Partial<Record<ClassId, number>>, klasse: ClassId): number {
  return eigene[klasse] ?? regelwerkOf(regelwerkId).gewichte[klasse] ?? 0
}

/** Die allgemeinen Startabstände je Klasse in Sekunden (einstellungen.yaml `startabstaende`). */
export const STARTABSTAENDE: Readonly<Partial<Record<ClassId, number>>> = Object.freeze(zahlenJeKlasse(ROH_QUELLE.startabstaende))

/**
 * Startabstand einer Klasse, die weder einstellungen.yaml noch das Regelwerk nennt. validate.test.ts
 * hält die Dateien so, dass es nie dazu kommt; 125 s ist das Mittel der allgemeinen Werte (124,4 s),
 * auf 5 s gerundet wie diese (berichtigt nach der Prüfung von E3, 16.11.2026; vorher stand 120 da).
 */
export const STARTABSTAND_RUECKFALL = 125

/**
 * Die Vorgabe des Startabstands einer Klasse in Sekunden, ohne eigenen Wert der Veranstaltung: der des
 * Regelwerks, sonst der allgemeine (einstellungen.yaml) – das Regelwerk ersetzt je Klasse.
 */
export function startabstandVorgabe(regelwerkId: string, klasse: ClassId): number {
  return regelwerkOf(regelwerkId).startabstaende[klasse] ?? STARTABSTAENDE[klasse] ?? STARTABSTAND_RUECKFALL
}

/**
 * Startabstand einer Klasse in Sekunden, wie die Prognose ihn nimmt, solange zu wenig gemessen ist
 * (betrieb/prognose.ts): der eigene Wert der Veranstaltung (`anzeige.abstaende`), sonst der des
 * Regelwerks, sonst der allgemeine. Wie {@link sollgewichtOf} wird die Vorgabe erst beim Lesen
 * aufgelöst – im Stand stehen nur eigene Werte, ein Wechsel des Regelwerks muss nichts nachziehen.
 */
export function startabstandOf(stand: { regelwerk: string; anzeige: { abstaende: Partial<Record<ClassId, number>> } }, klasse: ClassId): number {
  return stand.anzeige.abstaende[klasse] ?? startabstandVorgabe(stand.regelwerk, klasse)
}
