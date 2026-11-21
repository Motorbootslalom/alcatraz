import { CLASS_IDS } from '../domain/classes'
import { vergleicheStartNr } from '../domain/startnumbers'
import type { AppState, CellKind, Eingaben, ErrorDef, Geraet, SheetDef, Starter } from '../types'
import { defFuerKlasse } from './bogen'
import { normalizeCodeCell } from './codes'
import { allowedSet, sanitizeBuoy, sanitizeDisq } from './disq'
import { columnCellKeys } from './scoring'
import { veranstaltungsListen, type ListenWahl, type ListenWahlKonfig } from './listen'
import { parseTime } from './time'
import { parallelListen } from './parallelBogen'
import { attemptsImPlan, zerlegeAttempt } from './parallelSchluessel'

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
  /** Für die Werte des Parallelslaloms (lib/parallelBogen.ts); fehlt = es gibt dort keine Listen. */
  getAufbauten?(): ReadonlyArray<{ id: string; disziplin: string }>
  rohRegelwerk?: { disziplinen?: readonly string[] }
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

/**
 * Ein Teil einer Liste, den ein Wettkampfrichter für sich abschickt: am Steg Ablegen (`ab`) und Anlegen
 * (`an`) – digitale Erfassung W1 (21.11.2026, Antwort F16; welche Spalten wozu gehören: wkr/annahmen.ts).
 */
export type ListenTeil = 'ab' | 'an'

/**
 * Der Teilhaken einer Liste: „Ablegen erfasst“ bzw. „Anlegen erfasst“ (`erfasst.ab@steg`). Wie der
 * Haken „erfasst“ geht er nie in die Wertung ein; sind beide Teile da, setzt die Übernahme auch den
 * ganzen Haken (state/reducer/wkr.ts).
 */
export function teilHaken(typeId: string, teil: ListenTeil): string {
  return `erfasst.${teil}@${typeId}`
}

const HAKEN_MUSTER = /^erfasst(\.(ab|an))?@(.+)$/

/** Ist die Kennung ein Haken „erfasst“ – der ganzen Liste oder eines Teils? Keiner davon zählt in der Wertung. */
export function istHaken(kennung: string): boolean {
  return HAKEN_MUSTER.test(kennung)
}

/** Der Haken der ganzen Liste zu einem Haken oder Teilhaken (`erfasst.ab@steg` → `erfasst@steg`); sonst `undefined`. */
export function ganzerHaken(kennung: string): string | undefined {
  const m = HAKEN_MUSTER.exec(kennung)
  return m ? erfasstKennung(m[3]) : undefined
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
        // Der Haken „erfasst“ (auch ein Teilhaken) ist kein Feld des Bogens; alles andere muss dort gelten.
        const gueltig = istHaken(ziel) ? wert : (ziele.find((f) => f.kennung === ziel)?.gueltig(wert) ?? '')
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
 *
 * Die Werte des Parallelslaloms (Lauf-Schlüssel `parallel:<runde>/<attempt>`,
 * lib/parallelSchluessel.ts) sind KEINE andere Disziplin in diesem Sinn: Sie stehen neben denen
 * des Manövrierens. Verborgen sind sie nur, wenn ihre Liste sie nicht zeigt – die Runde hat
 * keinen festgeschriebenen Plan (mehr), der Starter hat dort diesen Attempt nicht, oder die
 * Listen des Parallelslaloms haben das Feld für seine Klasse nicht.
 */
export function verborgeneZellen(
  stand: ListenWahl & Pick<AppState, 'eingaben' | 'starters' | 'laufCount'> & Partial<Pick<AppState, 'parallelPlaene'>>,
  konfig: EingabenKonfig,
): EingabeZelle[] {
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
  // Parallelslalom: je Klasse die Kennungen seiner Listen, je Runde die Attempts der Starter laut Plan.
  const getAufbauten = konfig.getAufbauten
  const parallel = getAufbauten ? parallelListen({ getAufbauten, aufbauOrder: konfig.aufbauOrder, rohRegelwerk: konfig.rohRegelwerk }) : []
  const parallelSichtbar = new Map<string, Set<string>>()
  const parallelKennungen = (klasse: string): Set<string> => {
    let menge = parallelSichtbar.get(klasse)
    if (!menge) {
      menge = new Set<string>()
      for (const typeId of parallel) {
        if (!konfig.positionAllowsClass(typeId, klasse)) continue
        menge.add(erfasstKennung(typeId))
        for (const feld of felderVon(konfig, typeId, klasse).liste) menge.add(feld.kennung)
      }
      parallelSichtbar.set(klasse, menge)
    }
    return menge
  }
  const attemptsJeRunde = new Map<string, Map<string, Set<number>>>()
  const imPlan = (runde: string, starter: string, attempt: number): boolean => {
    let attempts = attemptsJeRunde.get(runde)
    if (!attempts) {
      const plan = parallel.length > 0 ? stand.parallelPlaene?.[runde as keyof NonNullable<typeof stand.parallelPlaene>] : undefined
      attemptsJeRunde.set(runde, (attempts = plan ? attemptsImPlan(plan) : new Map()))
    }
    return attempts.get(starter)?.has(attempt) === true
  }

  // Ein Teilhaken (Steg: Ablegen/Anlegen erfasst, digitale Erfassung W1) ist sichtbar, wo der Haken seiner Liste es ist –
  // er ist nie ein „unbekanntes“ Feld und zählt nie in der Wertung.
  const alsGanzerHaken = (feld: string) => ganzerHaken(feld) ?? feld
  const out: EingabeZelle[] = []
  for (const [schluessel, zeilen] of Object.entries(stand.eingaben)) {
    const attempt = zerlegeAttempt(schluessel)
    if (attempt) {
      for (const [starter, werte] of Object.entries(zeilen)) {
        const klasse = klasseVon.get(starter)
        const gezeigt = klasse !== undefined && imPlan(attempt.runde, starter, attempt.attempt) ? parallelKennungen(klasse) : undefined
        for (const feld in werte) {
          if (!Object.prototype.hasOwnProperty.call(werte, feld) || gezeigt?.has(alsGanzerHaken(feld))) continue
          out.push({ lauf: schluessel, starter, feld, wert: werte[feld] })
        }
      }
      continue
    }
    const { disziplin: d, lauf } = zerlegeLauf(schluessel)
    const laufFehlt = d !== disziplin || lauf > Math.max(1, stand.laufCount)
    for (const [starter, werte] of Object.entries(zeilen)) {
      const klasse = klasseVon.get(starter)
      // Je Zeile nachgeschlagen, nicht je Feld: Die Oberfläche fragt bei jeder Eingabe, über alle erfassten Werte.
      const gezeigt = laufFehlt || klasse === undefined ? undefined : kennungen(klasse, lauf === OHNE_LAUF)
      for (const feld in werte) {
        if (!Object.prototype.hasOwnProperty.call(werte, feld)) continue
        if ((!laufFehlt && ruhend.has(alsGanzerHaken(feld))) || gezeigt?.has(alsGanzerHaken(feld))) continue
        out.push({ lauf: schluessel, starter, feld, wert: werte[feld] })
      }
    }
  }
  return out
}

/**
 * Warum keine Liste einen Wert mehr zeigt – in der Reihenfolge, in der geprüft wird:
 * - `disziplin`: Er gehört zu einer anderen Disziplin als der des jetzigen Aufbaus.
 * - `lauf`: Sein Lauf liegt über der eingestellten Zahl der Läufe.
 * - `starter`: Den Starter gibt es nicht (mehr).
 * - `klasseFehlt`: Die Klasse des Starters gibt es im eingestellten Regelwerk nicht (keine
 *   seiner Listen gilt für sie) – etwa nach einem Wechsel des Regelwerks.
 * - `klasse`: Die Klasse des Starters hat das Feld nicht – etwa nach einem Klassenwechsel.
 * - `abgewaehlt`: Die Liste gehört zum Aufbau, gilt aber gerade nicht (zusätzliche Liste
 *   abgewählt, oder sie ruht, weil Tor 5 die Parcoursüberwachung übernimmt bzw. nicht mehr).
 * - `aufbau`: Die Liste gibt es im jetzigen Aufbau nicht.
 * - `unbekannt`: Das Feld steht auf keiner Liste des Regelwerks (oder dort nicht unter diesem Lauf).
 */
export type VerborgenGrund = 'disziplin' | 'lauf' | 'starter' | 'klasseFehlt' | 'klasse' | 'abgewaehlt' | 'aufbau' | 'unbekannt'

/** Ein verborgener Wert, so weit erklärt, dass man ihn prüfen kann. */
export interface VerborgenerWert {
  /** Die Zelle, wie sie im Stand steht – und wie `SET_EINGABEN` sie entfernt. */
  zelle: EingabeZelle
  disziplin: string
  /** Der Lauf; {@link OHNE_LAUF} bei Listen ohne Lauf (Knoten). */
  lauf: number
  /** `erfasst`: der Haken „Zeile ist abgetippt“ einer Liste (auch ein Teilhaken); sonst ein Feld eines Bogens. */
  art: 'feld' | 'erfasst'
  /** Die Liste, auf der das Feld stand – soweit das Regelwerk sie kennt. */
  liste?: string
  /** Das Feld mit Überschrift und Art; fehlt beim Haken und bei unbekannten Kennungen. */
  feld?: Feld
  /**
   * Geht der Wert weiter in die Wertungslisten ein? Gerechnet wird wie in lib/ergebnis.ts: Die
   * Wertung liest je Starter alle Felder seines Laufs, die irgendeine Liste des Regelwerks für
   * seine Klasse kennt – auch solche, die der Aufbau nicht (mehr) zeigt. Haken und Bemerkungen
   * zählen nie; eine Stoppuhr-Zeit zählt nicht neben einer elektronischen; unter den Werten
   * ohne Lauf zählen nur Punkte (Knoten), und nur, wenn die Veranstaltung eine solche Liste hat.
   *
   * „Zählt nicht“ heißt: Punkte, Zeit und Disqualifikation ändern sich nicht. Eine Spur bleibt
   * dennoch möglich: Ist ein solcher Wert (Haken, Bemerkung) der EINZIGE Eintrag seiner Klasse
   * in einem Lauf, gibt es für den Lauf eine Wertungsliste, auf der alle „offen“ sind
   * (lib/ergebnis.ts `laeufeMitEingaben` – so beginnt jede Liste, sobald irgendetwas abgetippt
   * ist; allein ein X „Nicht gestartet“ beginnt sie noch nicht). In die Gesamtwertung geht ein
   * solcher Lauf nicht ein; er gilt nicht als gefahren.
   */
  zaehlt: boolean
  grund: VerborgenGrund
}

/** Die verborgenen Werte eines Starters. */
export interface VerborgeneGruppe {
  starterId: string
  /** Fehlt, wenn es den Starter nicht mehr gibt. */
  starter?: Starter
  werte: VerborgenerWert[]
}

/**
 * {@link verborgeneZellen}, je Starter erklärt: zu welchem Lauf, welcher Liste und welchem
 * Feld ein Wert gehört, ob er in der Wertung weiter mitzählt und warum ihn keine Liste mehr
 * zeigt. Starter nach Startnummer (unbekannte zuletzt), ihre Werte nach Lauf und in der
 * Reihenfolge der Listen des Regelwerks.
 */
export function verborgeneEinzelheiten(stand: ListenWahl & Pick<AppState, 'eingaben' | 'starters' | 'laufCount'>, konfig: EingabenKonfig): VerborgeneGruppe[] {
  const zellen = verborgeneZellen(stand, konfig)
  if (zellen.length === 0) return []
  const aufbau = konfig.getAufbau(stand.aufbau)
  const listen = veranstaltungsListen(konfig, stand)
  const positionen = konfig.getPositions().map((p) => p.typeId)
  const reihenfolge = [...new Set([...listen, ...positionen])]
  const rang = (liste: string | undefined) => (liste === undefined ? reihenfolge.length : reihenfolge.indexOf(liste))
  // Alles, was der Aufbau anbieten kann: mit und ohne zusammengelegtes Tor 5, dazu die zusätzlichen Listen.
  const moeglich = new Set([...konfig.aufbauOrder(stand.aufbau, false), ...konfig.aufbauOrder(stand.aufbau, true), ...(aufbau.zusatz ?? [])])
  const ohneLauf = (liste: string) => konfig.getSheetDef(liste).showLauf === false
  const starterVon = new Map(stand.starters.map((s) => [s.id, s]))
  const laufCount = Math.max(1, stand.laufCount)

  /** Die erste Liste (zuerst die der Veranstaltung), auf der die Kennung für die Klasse steht. */
  const suche = (kennung: string, klasse: string): { liste: string; feld: Feld } | undefined => {
    for (const liste of reihenfolge) {
      if (!konfig.positionAllowsClass(liste, klasse)) continue
      const feld = felderVon(konfig, liste, klasse).liste.find((f) => f.kennung === kennung)
      if (feld) return { liste, feld }
    }
    return undefined
  }
  // Eine Klasse, für die keine Liste des Regelwerks gilt, kennt das Regelwerk nicht (DM-Klassen 6 und 7 unter UIM).
  const bekannteKlassen = new Map<string, boolean>()
  const klasseBekannt = (klasse: string) => {
    let bekannt = bekannteKlassen.get(klasse)
    if (bekannt === undefined) bekannteKlassen.set(klasse, (bekannt = positionen.some((liste) => konfig.positionAllowsClass(liste, klasse))))
    return bekannt
  }
  /** Der Grund für eine Liste, die das Regelwerk kennt und die die Klasse des Starters hat. */
  const listenGrund = (liste: string): VerborgenGrund => (listen.includes(liste) ? 'unbekannt' : moeglich.has(liste) ? 'abgewaehlt' : 'aufbau')

  // Was die Wertung für eine Klasse liest (lib/ergebnis.ts `klassenErgebnis`).
  const wertungsFelder = new Map<string, Map<string, Feld>>()
  const felderDerWertung = (klasse: string) => {
    let felder = wertungsFelder.get(klasse)
    if (!felder) wertungsFelder.set(klasse, (felder = felderJeKennung(konfig, klasse, listen)))
    return felder
  }
  const mitKnoten = (klasse: string) => listen.some((liste) => konfig.positionAllowsClass(liste, klasse) && ohneLauf(liste))
  const zaehlt = (zelle: EingabeZelle, lauf: number, klasse: string): boolean => {
    const felder = felderDerWertung(klasse)
    const feld = felder.get(zelle.feld)
    if (!feld || feld.kind === 'text') return false
    if (lauf === OHNE_LAUF) return mitKnoten(klasse) && (feld.kind === 'buoy' || feld.kind === 'code' || feld.kind === 'points')
    if (feld.kind !== 'time') return true
    if (!parseTime(zelle.wert)) return false
    if (feld.geraet === 'elektronisch') return true
    const zeile = werteVon(stand.eingaben, zelle.lauf, zelle.starter)
    return !Object.entries(zeile).some(([kennung, wert]) => {
      const anderes = felder.get(kennung)
      return anderes?.kind === 'time' && anderes.geraet === 'elektronisch' && !!parseTime(wert)
    })
  }

  const erklaere = (zelle: EingabeZelle): VerborgenerWert => {
    const { disziplin, lauf } = zerlegeLauf(zelle.lauf)
    const klasse = starterVon.get(zelle.starter)?.klasse
    const eigene = listeVon(zelle.feld)
    const art = eigene !== undefined && istHaken(zelle.feld) ? 'erfasst' : 'feld'
    const bekannt = eigene !== undefined && positionen.includes(eigene)
    // Wo das Feld steht: für die Klasse des Starters, sonst für irgendeine Klasse.
    const hier = klasse === undefined ? undefined : art === 'erfasst' ? undefined : suche(zelle.feld, klasse)
    const woanders = hier || art === 'erfasst' ? undefined : CLASS_IDS.map((k) => suche(zelle.feld, k)).find((f) => f !== undefined)
    const liste = bekannt ? eigene : (hier ?? woanders)?.liste
    const feld = (hier ?? woanders)?.feld
    const laufFehlt = disziplin !== aufbau.disziplin || lauf > laufCount
    let grund: VerborgenGrund
    if (disziplin !== aufbau.disziplin) grund = 'disziplin'
    else if (lauf > laufCount) grund = 'lauf'
    else if (klasse === undefined) grund = 'starter'
    else if (!klasseBekannt(klasse)) grund = 'klasseFehlt'
    else if (liste === undefined) grund = 'unbekannt'
    else if (art === 'erfasst' ? !konfig.positionAllowsClass(liste, klasse) : !hier) grund = 'klasse'
    else grund = listenGrund(liste)
    return { zelle, disziplin, lauf, art, liste, feld, zaehlt: !laufFehlt && klasse !== undefined && zaehlt(zelle, lauf, klasse), grund }
  }

  const gruppen = new Map<string, VerborgeneGruppe>()
  for (const zelle of zellen) {
    let gruppe = gruppen.get(zelle.starter)
    if (!gruppe) gruppen.set(zelle.starter, (gruppe = { starterId: zelle.starter, starter: starterVon.get(zelle.starter), werte: [] }))
    gruppe.werte.push(erklaere(zelle))
  }
  for (const gruppe of gruppen.values()) {
    // Werte ohne Lauf (Knoten) zuletzt, wie auf dem Laufzettel. `sort` ist stabil: Gleiches bleibt in der Reihenfolge des Stands.
    const laufRang = (lauf: number) => (lauf === OHNE_LAUF ? Number.MAX_SAFE_INTEGER : lauf)
    gruppe.werte.sort((a, b) => a.disziplin.localeCompare(b.disziplin) || laufRang(a.lauf) - laufRang(b.lauf) || rang(a.liste) - rang(b.liste))
  }
  return [...gruppen.values()].sort((a, b) => {
    if (!a.starter || !b.starter) return a.starter ? -1 : b.starter ? 1 : a.starterId.localeCompare(b.starterId)
    return vergleicheNr(a.starter.startNr, b.starter.startNr) || a.starterId.localeCompare(b.starterId)
  })
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

/** Startnummern in natürlicher Reihenfolge (E2 vor E10, 99 vor 401, E01 vor 101) – domain/startnumbers.ts `vergleicheStartNr`. */
export function vergleicheNr(a: string, b: string): number {
  return vergleicheStartNr(a, b)
}

/**
 * Sobald Ergebnisse erfasst sind, steht das Starterfeld fest: Listen sind gedruckt, die Werte
 * hängen an den Startern. Starter kommen dann weder dazu noch weg (Import, von Hand, Klasse
 * leeren, Beispiel-Starterfeld); ihre Angaben lassen sich weiter ändern. Gelöst wird die Sperre
 * durch das Löschen der erfassten Werte oder das Zurücksetzen. Dieselbe Frage stellen die
 * Oberfläche (Knöpfe, Hinweis) und der Reducer (state/reducer.ts).
 */
export function starterfeldFest(stand: Pick<AppState, 'eingaben'>): boolean {
  return Object.keys(stand.eingaben).length > 0
}

/**
 * Ein Stand, in dem es nichts zu schützen gibt: keine Starter (Entscheidung des Nutzers vom
 * 15.11.2026: „als leerer Stand gilt: keine Starter“) – vor dem Anlegen einer Veranstaltung oder
 * nach „Alles zurücksetzen“. Erfasste Werte gibt es ohne Starter nicht (state/reducer/starter.ts
 * `mitStartern`, state/migrate.ts). Nur dann übernimmt die Anwendung eine neue Fassung von selbst
 * (lib/offline.ts); sonst wechselt sie allein auf „Update“.
 */
export function standLeer(stand: Pick<AppState, 'starters'>): boolean {
  return stand.starters.length === 0
}
