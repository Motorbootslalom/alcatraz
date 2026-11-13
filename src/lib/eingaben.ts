import type { AppState, CellKind, Eingaben, ErrorDef, Geraet, SheetDef } from '../types'
import { defFuerKlasse } from './bogen'
import { normalizeCodeCell } from './codes'
import { allowedSet, sanitizeBuoy, sanitizeDisq } from './disq'
import { columnCellKeys } from './scoring'
import { veranstaltungsListen, type ListenWahl, type ListenWahlKonfig } from './listen'

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
  getAufbau(id: string): { disziplin: string; zusatz?: string[]; kombi?: { positionId: string; ersetzt: string[] } }
  aufbauOrder(id: string, kombiAktiv: boolean): string[]
  getRegelwerk?: ListenWahlKonfig['getRegelwerk']
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
    if (!lauf || !starter || !feld || [lauf, starter, feld].some(gesperrt)) continue
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

/** Die Liste eines Felds, das zu seiner Liste gehört („disq@steg“ → „steg“); sonst `undefined`. */
function listeVon(kennung: string): string | undefined {
  const i = kennung.lastIndexOf('@')
  return i < 0 ? undefined : kennung.slice(i + 1)
}

/**
 * Zieht um, was in einer Disziplin zu einer Liste gehört (Disq., Bemerkung, Haken „erfasst“):
 * von `von` nach `nach`, etwa Tor 5 → Tor 5 + Parcours. Vorbild: `listenUmziehen` im Prototyp.
 * Ein Wert zieht nur um, wenn die neue Liste das Feld für die Klasse des Starters hat, er
 * dort gilt und das Ziel noch frei ist – sonst bleibt er, wo er ist (er zählt weiter und
 * erscheint unter den verborgenen Eingaben). Ändert sich nichts, kommt dasselbe Objekt zurück.
 */
export function listeUmziehen(
  eingaben: Eingaben,
  konfig: Pick<EingabenKonfig, 'getSheetDef' | 'positionAllowsClass'>,
  disziplin: string,
  klasseVon: (starter: string) => string | undefined,
  von: string,
  nach: string,
): Eingaben {
  if (von === nach) return eingaben
  let geaendert = false
  const out: Eingaben = {}
  for (const [lauf, zeilen] of Object.entries(eingaben)) {
    out[lauf] = zeilen
    if (zerlegeLauf(lauf).disziplin !== disziplin) continue
    const neu: Record<string, Record<string, string>> = {}
    for (const [starter, werte] of Object.entries(zeilen)) {
      neu[starter] = werte
      const klasse = klasseVon(starter)
      if (klasse === undefined || !konfig.positionAllowsClass(nach, klasse)) continue
      const ziele = listenFelder(konfig, nach, klasse)
      let zeile: Record<string, string> | undefined
      for (const [kennung, wert] of Object.entries(werte)) {
        if (listeVon(kennung) !== von) continue
        const ziel = `${kennung.slice(0, kennung.lastIndexOf('@'))}@${nach}`
        if (ziel in werte) continue
        // Der Haken „erfasst“ ist kein Feld des Bogens; alles andere muss dort gelten.
        const gueltig = ziel === erfasstKennung(nach) ? wert : (ziele.find((f) => f.kennung === ziel)?.gueltig(wert) ?? '')
        if (!gueltig) continue
        zeile ??= { ...werte }
        delete zeile[kennung]
        zeile[ziel] = gueltig
      }
      if (zeile) {
        neu[starter] = zeile
        geaendert = true
      }
    }
    out[lauf] = neu
  }
  return geaendert ? out : eingaben
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

/** Die Starter, für die irgendetwas erfasst ist. */
export function starterMitEingaben(eingaben: Eingaben): Set<string> {
  return new Set(Object.values(eingaben).flatMap((zeilen) => Object.keys(zeilen)))
}

/** So ist ein Lauf-Schlüssel gebaut: „Disziplin/Lauf“. */
const LAUF_MUSTER = /^[^/]+\/\d+$/

// Als Schlüssel eines gewöhnlichen Objekts träfen diese Namen dessen Prototyp – aus einer
// präparierten Sicherung heraus sogar den aller Objekte.
const gesperrt = (schluessel: string) => schluessel === '__proto__' || schluessel === 'constructor' || schluessel === 'prototype'

/**
 * Nur Zellen, die in den Stand gehören: Lauf-Schlüssel nach Muster und ein bekannter Starter.
 * Dieselbe Regel wendet `migrate` beim Laden an – ohne sie stünde im Speicher etwas anderes
 * als nach dem Neuladen, etwa wenn später ein Bündel von einem Gerät eintrifft, nachdem der
 * Starter gelöscht wurde.
 */
export function gueltigeZellen(zellen: readonly EingabeZelle[], starter: ReadonlySet<string>): EingabeZelle[] {
  return zellen.filter((z) => LAUF_MUSTER.test(z.lauf) && starter.has(z.starter) && typeof z.feld === 'string' && z.feld !== '' && typeof z.wert === 'string')
}

/**
 * Erfasste Werte, die keine Ansicht mehr zeigt: aus einem Lauf jenseits der Zahl der Läufe,
 * aus einer anderen Disziplin, oder in einem Feld, das der Aufbau für die Klasse des Starters
 * nicht hat (nach einem Wechsel des Aufbaus oder der Klasse). Sie stehen weiter im Stand und
 * in jeder Sicherung, und Zeiten oder Disqualifikationen darunter zählen in der Wertung mit –
 * deshalb zeigt die Oberfläche ihre Zahl und bietet an, sie zu entfernen.
 */
export function verborgeneZellen(stand: ListenWahl & Pick<AppState, 'eingaben' | 'starters' | 'laufCount'>, konfig: EingabenKonfig): EingabeZelle[] {
  const disziplin = konfig.getAufbau(stand.aufbau).disziplin
  const listen = veranstaltungsListen(konfig, stand)
  // Listen, die durch „Tor 5 übernimmt die Parcoursüberwachung“ gerade ruhen (die Parcoursliste
  // bzw. die zusammengelegte): Ihr Haken „erfasst“ bleibt für das Zurückschalten stehen. Er
  // zählt nie in der Wertung und ist deshalb kein Fund, den jemand prüfen müsste.
  const kombi = konfig.getAufbau(stand.aufbau).kombi
  const ruhend = new Set((kombi ? [kombi.positionId, ...kombi.ersetzt] : []).filter((id) => !listen.includes(id)).map(erfasstKennung))
  const klasseVon = new Map(stand.starters.map((s) => [s.id, s.klasse]))
  // Je Klasse die Kennungen, die die Erfassung zeigt: mit Lauf und ohne (Knoten).
  const sichtbar = new Map<string, Set<string>>()
  const kennungen = (klasse: string, ohneLauf: boolean): Set<string> => {
    const schluessel = `${klasse}|${ohneLauf}`
    let menge = sichtbar.get(schluessel)
    if (!menge) {
      menge = new Set<string>()
      for (const typeId of listen) {
        if (!konfig.positionAllowsClass(typeId, klasse) || (konfig.getSheetDef(typeId).showLauf === false) !== ohneLauf) continue
        menge.add(erfasstKennung(typeId))
        for (const feld of felderVon(konfig, typeId, klasse).liste) menge.add(feld.kennung)
      }
      sichtbar.set(schluessel, menge)
    }
    return menge
  }
  const out: EingabeZelle[] = []
  for (const [schluessel, zeilen] of Object.entries(stand.eingaben)) {
    const { disziplin: d, lauf } = zerlegeLauf(schluessel)
    const laufFehlt = d !== disziplin || lauf > Math.max(1, stand.laufCount)
    for (const [starter, werte] of Object.entries(zeilen)) {
      const klasse = klasseVon.get(starter)
      for (const [feld, wert] of Object.entries(werte)) {
        if (!laufFehlt && ruhend.has(feld)) continue
        if (laufFehlt || klasse === undefined || !kennungen(klasse, lauf === OHNE_LAUF).has(feld)) out.push({ lauf: schluessel, starter, feld, wert })
      }
    }
  }
  return out
}

/**
 * Gelesene Eingaben (localStorage, Sicherung) in die erwartete Form bringen: nur
 * Zeichenketten, keine leeren Werte, Zeilen oder Läufe. Unbrauchbares entfällt.
 */
export function normalisiereEingaben(raw: unknown): Eingaben {
  const out: Eingaben = {}
  if (!istObjekt(raw)) return out
  for (const [lauf, zeilen] of Object.entries(raw)) {
    if (!istObjekt(zeilen) || !LAUF_MUSTER.test(lauf)) continue
    for (const [starter, werte] of Object.entries(zeilen)) {
      if (!istObjekt(werte) || gesperrt(starter)) continue
      for (const [feld, wert] of Object.entries(werte)) {
        if (typeof wert === 'string' && wert !== '' && !gesperrt(feld)) ((out[lauf] ??= {})[starter] ??= {})[feld] = wert
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
