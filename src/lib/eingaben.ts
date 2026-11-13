import type { CellKind, Eingaben, ErrorDef, Geraet, SheetDef } from '../types'
import { defFuerKlasse } from './bogen'
import { normalizeCodeCell } from './codes'
import { allowedSet, sanitizeBuoy, sanitizeDisq } from './disq'
import { columnCellKeys } from './scoring'

// Die erfassten Werte der Wettkampfrichter-Listen – rein, ohne DOM und ohne Stand. Vorbild:
// lib/eingaben.ts im Fehlerpunkte-Prototyp.
//
// Ein Wert steht je Disziplin, Lauf und Starter im Feld mit seiner Kennung (config/feld.ts).
// Er hängt weder an der Bogen-Auswahl noch am Aufbau: Bojen, Fehler und Zeiten sind in jedem
// Aufbau einer Disziplin dasselbe Feld, egal auf welcher Liste es dort steht. Disq.,
// Bemerkung und der Haken „erfasst“ gehören zu ihrer Liste („disq@steg“).
//
// Anders als im Prototyp ist die Zeile die Starter-ID (dort die Startnummer), und die Klasse
// steht nicht im Lauf-Schlüssel – sie folgt aus dem Starter. So überlebt eine Eingabe das
// Umnummerieren, und eine gemeinsame Liste mehrerer Klassen (Clubmeisterschaft) braucht
// keine Sonderbehandlung.
//
// Erfassung an mehreren Geräten (kommt später): Eine Zelle ist durch Lauf-Schlüssel,
// Starter-ID und Feld-Kennung vollständig benannt ({@link EingabeZelle}). Zwei Geräte, die
// verschiedene Listen erfassen, schreiben verschiedene Zellen; `setzeWerte` führt beliebig
// viele Zellen in einem Schritt zusammen.

/** Lauf-Nummer im Lauf-Schlüssel für Listen ohne Lauf (Knoten). */
export const OHNE_LAUF = 0

/** Was die Eingaben von der Konfiguration brauchen (config/konfig.ts `Konfig`). */
export interface EingabenKonfig {
  getSheetDef(typeId: string): SheetDef
  getPositions(): SheetDef[]
  positionAllowsClass(typeId: string, klasse: string): boolean
  getAufbau(id: string): { disziplin: string }
  aufbauOrder(id: string, kombiAktiv: boolean): string[]
}

/** Eine einzelne Eingabe, so wie sie eine Action trägt. Ein leerer Wert löscht die Zelle. */
export interface EingabeZelle {
  /** Lauf-Schlüssel, siehe {@link laufSchluessel}. */
  lauf: string
  /** Starter-ID. */
  starter: string
  /** Feld-Kennung, z. B. „t1a|hin seiteA“ oder „disq@steg“. */
  feld: string
  wert: string
}

export interface Feld {
  /** Zelle auf dem Bogen: Spalten-Key, bei Unter-Spalten mit „#<n>“ (z. B. „t1a#0“). */
  zelle: string
  kennung: string
  kind: CellKind
  /** Überschrift der Spalte, bei Unter-Spalten mit deren Kürzel („Tor 1 H R“). */
  label: string
  /** Fehler-Katalog der Spalte (nur `code`). */
  katalog?: ErrorDef[]
  /** Gerät der Zeitspalte (nur `time`); fehlt = Stoppuhr. */
  geraet?: Geraet
  /** Der noch gültige Teil des Werts, '' wenn nichts mehr gilt. */
  gueltig: (wert: string) => string
}

export function laufSchluessel(disziplin: string, lauf: number): string {
  return `${disziplin}/${lauf}`
}

export function zerlegeLauf(schluessel: string): { disziplin: string; lauf: number } {
  const i = schluessel.lastIndexOf('/')
  return { disziplin: schluessel.slice(0, i), lauf: Number(schluessel.slice(i + 1)) }
}

/** Der Lauf, unter dem die Werte einer Liste stehen: Listen ohne Lauf im Kopf (Knoten) unter 0. */
export function listenLauf(def: Pick<SheetDef, 'showLauf'>, lauf: number): number {
  return def.showLauf === false ? OHNE_LAUF : lauf
}

/**
 * Kennung des Hakens „erfasst“ einer Liste. Eine Zeile ohne Fehler bleibt auf einer Tor-Liste
 * leer – genau wie eine, die noch niemand abgetippt hat. Der Haken unterscheidet beides; in
 * die Wertung geht er nicht ein.
 */
export function erfasstKennung(typeId: string): string {
  return `erfasst@${typeId}`
}

interface ListenFelder {
  liste: Feld[]
  jeZelle: Map<string, Feld>
}

// Je Konfigurationsstand: Jede Konfiguration hat ihre eigenen (eingefrorenen) SheetDef-Objekte.
const felderCache = new WeakMap<SheetDef, Map<string, ListenFelder>>()

function felderVon(konfig: Pick<EingabenKonfig, 'getSheetDef'>, typeId: string, klasse: string): ListenFelder {
  const basis = konfig.getSheetDef(typeId)
  const jeKlasse = felderCache.get(basis) ?? new Map<string, ListenFelder>()
  felderCache.set(basis, jeKlasse)
  const bekannt = jeKlasse.get(klasse)
  if (bekannt) return bekannt

  const def = defFuerKlasse(basis, klasse)
  const disqs = allowedSet(def.disqTable)
  const liste = def.columns
    .filter((col) => col.kind !== 'sum')
    .flatMap((col) => {
      const katalog = col.kind === 'code' ? (col.errorTable ?? def.errorTable ?? []) : undefined
      const gueltig = (wert: string): string => {
        if (col.kind === 'buoy') return sanitizeBuoy(wert, disqs)
        if (col.kind === 'disq') return sanitizeDisq(wert, disqs)
        if (katalog) return normalizeCodeCell(wert, new Set(katalog.map((e) => e.code)), disqs)
        return wert
      }
      return columnCellKeys('', col).map(
        (schluessel, i): Feld => ({
          zelle: schluessel.slice(1),
          kennung: col.felder?.[i] ?? col.key,
          kind: col.kind,
          label: col.sub && col.sub.length > 0 ? `${col.label} ${col.sub[i]}` : col.label,
          katalog,
          geraet: col.geraet,
          gueltig,
        }),
      )
    })
  const felder = { liste, jeZelle: new Map(liste.map((f) => [f.zelle, f])) }
  jeKlasse.set(klasse, felder)
  return felder
}

/** Die Felder einer Liste für eine Klasse, wie sie der Bogen zeigt. */
export function listenFelder(konfig: Pick<EingabenKonfig, 'getSheetDef'>, typeId: string, klasse: string): Feld[] {
  return felderVon(konfig, typeId, klasse).liste
}

/** Das Feld einer Zelle des Bogens; `undefined`, wenn die Klasse die Spalte nicht hat oder sie nur anzeigt (Σ). */
export function feldVon(
  konfig: Pick<EingabenKonfig, 'getSheetDef'>,
  typeId: string,
  klasse: string,
  colKey: string,
  subIndex?: number,
): Feld | undefined {
  return felderVon(konfig, typeId, klasse).jeZelle.get(subIndex === undefined ? colKey : `${colKey}#${subIndex}`)
}

/** Alle Felder einer Klasse nach Kennung; bei Dopplungen zählt die erste Liste aus `vorrang`. */
export function felderJeKennung(konfig: EingabenKonfig, klasse: string, vorrang: readonly string[] = []): Map<string, Feld> {
  const out = new Map<string, Feld>()
  for (const typeId of [...vorrang, ...konfig.getPositions().map((p) => p.typeId)]) {
    if (!konfig.positionAllowsClass(typeId, klasse)) continue
    for (const feld of felderVon(konfig, typeId, klasse).liste) if (!out.has(feld.kennung)) out.set(feld.kennung, feld)
  }
  return out
}

/** Die Werte eines Starters in einem Lauf; leer, wenn nichts erfasst ist. */
export function werteVon(eingaben: Eingaben, lauf: string, starter: string): Readonly<Record<string, string>> {
  return eingaben[lauf]?.[starter] ?? LEER
}
const LEER: Readonly<Record<string, string>> = Object.freeze({})

/**
 * Die Eingaben, nachdem Zellen gesetzt wurden. Ein leerer Wert löscht die Zelle; leere Zeilen
 * und Läufe verschwinden, damit die Sicherung nur enthält, was erfasst ist. Ändert sich
 * nichts, kommt dasselbe Objekt zurück (der Store speichert dann nicht).
 */
export function setzeWerte(eingaben: Eingaben, zellen: readonly EingabeZelle[]): Eingaben {
  let out = eingaben
  for (const { lauf, starter, feld, wert } of zellen) {
    if (!lauf || !starter || !feld) continue
    if ((out[lauf]?.[starter]?.[feld] ?? '') === wert) continue
    const werte = { ...out[lauf]?.[starter] }
    if (wert === '') delete werte[feld]
    else werte[feld] = wert
    const zeilen = { ...out[lauf] }
    if (Object.keys(werte).length > 0) zeilen[starter] = werte
    else delete zeilen[starter]
    out = { ...out }
    if (Object.keys(zeilen).length > 0) out[lauf] = zeilen
    else delete out[lauf]
  }
  return out
}

/** Nur die Eingaben der genannten Starter: Wer gelöscht ist, nimmt seine Werte mit. */
export function nurStarter(eingaben: Eingaben, ids: ReadonlySet<string>): Eingaben {
  let geaendert = false
  const out: Eingaben = {}
  for (const [lauf, zeilen] of Object.entries(eingaben)) {
    const bleiben = Object.entries(zeilen).filter(([id]) => ids.has(id))
    if (bleiben.length !== Object.keys(zeilen).length) geaendert = true
    if (bleiben.length > 0) out[lauf] = Object.fromEntries(bleiben)
  }
  return geaendert ? out : eingaben
}

/** Die Eingaben ohne einen Lauf (alle Disziplinen) bzw. ganz leer. */
export function ohneLauf(eingaben: Eingaben, lauf?: number): Eingaben {
  if (lauf === undefined) return Object.keys(eingaben).length > 0 ? {} : eingaben
  const bleiben = Object.entries(eingaben).filter(([schluessel]) => zerlegeLauf(schluessel).lauf !== lauf)
  return bleiben.length === Object.keys(eingaben).length ? eingaben : Object.fromEntries(bleiben)
}

/**
 * Gelesene Eingaben (localStorage, Sicherung) in die erwartete Form bringen: nur
 * Zeichenketten, keine leeren Werte, Zeilen oder Läufe. Unbrauchbares entfällt.
 */
export function normalisiereEingaben(raw: unknown): Eingaben {
  const out: Eingaben = {}
  if (!istObjekt(raw)) return out
  for (const [lauf, zeilen] of Object.entries(raw)) {
    if (!istObjekt(zeilen) || !/^[^/]+\/\d+$/.test(lauf)) continue
    for (const [starter, werte] of Object.entries(zeilen)) {
      if (!istObjekt(werte)) continue
      for (const [feld, wert] of Object.entries(werte)) {
        if (typeof wert === 'string' && wert !== '') ((out[lauf] ??= {})[starter] ??= {})[feld] = wert
      }
    }
  }
  return out
}

const istObjekt = (wert: unknown): wert is Record<string, unknown> => !!wert && typeof wert === 'object' && !Array.isArray(wert)

/** Startnummern in natürlicher Reihenfolge (E2 vor E10, 99 vor 401). */
export function vergleicheNr(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true })
}
