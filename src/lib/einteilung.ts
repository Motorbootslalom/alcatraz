import type { ClassId, Einteilung, Parcours, Sprache, WkrSprachen } from '../types'
import { isSprache } from '../config/sprache'
import { veranstaltungsListen, type ListenWahl, type ListenWahlKonfig } from './listen'
import { RACECOURSE_PARCOURS, RACECOURSES, istRacecourseParcours } from './parallelSchluessel'

// WKR-Einteilung (KONZEPT-NAMEN-FREIHAND.md §1 im Fehlerpunkte-Prototyp): Wer an welcher
// Liste sitzt, einmal für die Veranstaltung statt auf jedem Bogen. Jeder Parcours hat eigene
// Wettkampfrichter; welcher Name auf eine Liste kommt, folgt aus ihrer Klasse.
//
// Anders als im Prototyp fragt die Einteilung nicht selbst nach „Zwei Parcours“ und der
// Zuordnung der Klassen: Beides steht hier schon in der Verzahnung (`parcoursList`). Die
// Namen hängen deshalb an der Kennung des Parcours – beliebig viele – und an der Liste
// (`typeId`), nicht am Aufbau: Nach einem Aufbauwechsel gelten sie für die Listen, die es
// dort auch gibt, die übrigen bleiben gespeichert.
//
// Parallelslalom: Die race officials der beiden Racecourses A und B stehen in derselben
// Einteilung, unter den festen Kennungen der Racecourses statt der eines Parcours
// (lib/parallelSchluessel.ts `RACECOURSE_PARCOURS`) – je Racecourse Zeit, Steg (pontoon) und
// Fahrweg. Das ist Organisation, nicht Regel 960. Diese Einträge hängen an keinem Parcours der
// Verzahnung und bleiben deshalb, wenn deren Parcours wechseln.
//
// Es sind Personennamen: Sie gehören in die Sicherung, nicht in die Vorlage (persistenz/backup.ts).
//
// Die Sprache der Bögen (AppState.wkrSprachen) hängt genauso an Parcours und Liste: Auf jedem
// Parcours – im Parallelslalom auf jedem Racecourse – sitzt eine eigene Gruppe (Entscheidung des
// Nutzers vom 15.11.2026). Sie ist keine Personenangabe und reist auch in der Vorlage mit; deshalb
// stehen hier dieselben Bausteine für beide (`haengeUm`, `ohneParcours`) und für die Sprache
// `setzeSprache`, `normalisiereSprachen`.

/** Was {@link wkrName} vom Stand braucht. */
export type EinteilungsStand = { einteilung: Einteilung; parcoursList: readonly Pick<Parcours, 'id' | 'classIds'>[] }

/** Was die Funktionen hier von der Konfiguration brauchen (config/konfig.ts `Konfig`). */
export interface ListenKonfig extends ListenWahlKonfig {
  getAufbau(id: string): { order: string[]; zusatz: string[]; kombi?: { positionId: string; ersetzt: string[] } }
  getSheetDef(typeId: string): { typeId: string; titelDe: string; title: string; menuLabel: string }
  positionAllowsClass(typeId: string, klasse: string): boolean
}

/**
 * Der Parcours, auf dem eine Klasse fährt. Steht sie in der Verzahnung auf mehreren, gilt der
 * erste – wie überall, wo die Reihenfolge der Parcours zählt. Auf keinem: `undefined`.
 */
export function parcoursVon<P extends Pick<Parcours, 'id' | 'classIds'>>(parcoursList: readonly P[], klasse: string): P | undefined {
  return parcoursList.find((p) => (p.classIds as string[]).includes(klasse))
}

/**
 * Wo der Name einer Liste für eine Klasse steht: Klasse → Parcours → Eintrag. `eingabe` ist
 * der Eintrag, wie er getippt wurde (ein Eingabefeld darf beim Tippen kein Leerzeichen
 * verlieren). `undefined`, wenn die Klasse auf keinem Parcours fährt – oder, mit `konfig`,
 * wenn sie die Liste gar nicht hat (z. B. Mann-über-Bord in Klasse 1): Sonst erbte sie den
 * Namen, der für die anderen Klassen des Parcours gilt.
 *
 * Geschrieben wird nur aus der Tabelle (WkrEinteilung.vue, `SET_WKR_NAME`); die Beispielansicht
 * (WkrVorschau.vue) liest hier und zeigt den Namen nur an (Entscheidung des Nutzers vom 15.11.2026).
 */
export function wkrFeld(
  stand: EinteilungsStand,
  typeId: string,
  klasse: string,
  konfig?: Pick<ListenKonfig, 'positionAllowsClass'>,
): { parcoursId: string; eingabe: string } | undefined {
  if (konfig && !konfig.positionAllowsClass(typeId, klasse)) return undefined
  const parcours = parcoursVon(stand.parcoursList, klasse)
  return parcours && { parcoursId: parcours.id, eingabe: stand.einteilung[parcours.id]?.[typeId] ?? '' }
}

/**
 * Der Name des Wettkampfrichters für eine Liste in einer Klasse, wie er gedruckt wird
 * (ohne Leerraum am Rand). Leer, wenn es kein {@link wkrFeld} gibt oder dort niemand steht.
 */
export function wkrName(stand: EinteilungsStand, typeId: string, klasse: string, konfig?: Pick<ListenKonfig, 'positionAllowsClass'>): string {
  return wkrFeld(stand, typeId, klasse, konfig)?.eingabe.trim() ?? ''
}

/** Setzt den Namen einer Liste auf einem Parcours; leer entfernt ihn. */
export function setzeName(e: Einteilung, parcoursId: string, typeId: string, name: string): Einteilung {
  const { [typeId]: _alt, ...liste } = e[parcoursId] ?? {}
  if (name.trim()) return { ...e, [parcoursId]: { ...liste, [typeId]: name } }
  // Ohne Namen bleibt auch kein leerer Eintrag des Parcours zurück.
  const { [parcoursId]: _weg, ...rest } = e
  return Object.keys(liste).length > 0 ? { ...rest, [parcoursId]: liste } : rest
}

/**
 * Ein Schlüssel, der in einem gewöhnlichen Objekt kein Eintrag wäre: `e['__proto__'] = …`
 * ersetzt den Prototyp, statt einen Eintrag anzulegen. Aus einer Datei (JSON) kann er kommen.
 */
const UNBRAUCHBAR = '__proto__'

/**
 * Eine gespeicherte Einteilung, bereinigt; Unbrauchbares entfällt. Mit `parcoursIds` bleiben
 * nur die Namen der Parcours, die es gibt: Verwaiste wären Personennamen, die niemand sieht
 * und niemand löschen kann, die aber in jede Sicherung wanderten.
 */
export function normalisiereEinteilung(raw: unknown, parcoursIds?: readonly string[]): Einteilung {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const paare: Array<[string, Record<string, string>]> = []
  for (const [parcoursId, liste] of Object.entries(raw)) {
    if (parcoursId === UNBRAUCHBAR || (parcoursIds && !parcoursIds.includes(parcoursId) && !istRacecourseParcours(parcoursId))) continue
    if (!liste || typeof liste !== 'object' || Array.isArray(liste)) continue
    const namen = Object.entries(liste).filter(
      (x): x is [string, string] => x[0] !== UNBRAUCHBAR && typeof x[1] === 'string' && x[1].trim() !== '',
    )
    if (namen.length > 0) paare.push([parcoursId, Object.fromEntries(namen)])
  }
  return Object.fromEntries(paare)
}

/**
 * Hängt die Namen um, wenn die Liste der Parcours ersetzt wird (Schnellauswahl der
 * Verzahnung, eingespielte Vorlage): Die Einteilung hängt an der Kennung, die Kennungen
 * können dabei aber wechseln – eine Vorlage bringt die des anderen Rechners mit.
 *
 * Ein Parcours, den es weiter gibt, behält seine Namen. Ein neuer übernimmt die des
 * Parcours, der bisher an seiner Stelle stand (Parcours 1 bleibt Parcours 1), sofern es
 * diesen nicht mehr gibt. Was danach zu keinem Parcours gehört, entfällt – siehe
 * {@link normalisiereEinteilung}.
 */
export function haengeUm<T>(e: Readonly<Record<string, T>>, alt: readonly string[], neu: readonly string[]): Record<string, T> {
  const namen = new Map(Object.entries(e))
  const paare: Array<[string, T]> = []
  neu.forEach((id, i) => {
    const quelle = alt.includes(id) ? id : alt[i] !== undefined && !neu.includes(alt[i]) ? alt[i] : undefined
    const liste = quelle === undefined ? undefined : namen.get(quelle)
    if (liste && id !== UNBRAUCHBAR) paare.push([id, liste])
  })
  // Die race officials der Racecourses (Parallelslalom) hängen an keinem Parcours: Sie bleiben.
  for (const [id, liste] of namen) if (istRacecourseParcours(id) && !neu.includes(id)) paare.push([id, liste])
  return Object.fromEntries(paare)
}

/**
 * Zieht den Namen einer Liste auf eine andere um, auf jedem Parcours (Tor 5 ↔ Tor 5 +
 * Parcours). Steht am Ziel schon jemand, bleibt beides, wie es ist. Ändert sich nichts,
 * kommt dasselbe Objekt zurück.
 */
export function nameUmziehen(e: Einteilung, von: string, nach: string): Einteilung {
  if (von === nach || von === UNBRAUCHBAR || nach === UNBRAUCHBAR) return e
  let geaendert = false
  const paare = Object.entries(e).map(([parcoursId, liste]): [string, Record<string, string>] => {
    if (liste[von] === undefined || liste[nach]?.trim()) return [parcoursId, liste]
    geaendert = true
    const { [von]: name, [nach]: _leer, ...rest } = liste
    return [parcoursId, { ...rest, [nach]: name }]
  })
  return geaendert ? Object.fromEntries(paare) : e
}

/** Die Einteilung (oder die Sprachen der Bögen) ohne einen Parcours (er wurde entfernt). */
export function ohneParcours<T>(e: Readonly<Record<string, T>>, parcoursId: string): Record<string, T> {
  return Object.fromEntries(Object.entries(e).filter(([id]) => id !== parcoursId))
}

/** Eine Zelle der Einteilung: Liste auf einem Parcours (oder Racecourse). */
export interface WkrZelle {
  parcoursId: string
  typeId: string
}

/**
 * Setzt die Sprache des Bogens für die genannten Zellen; `null` – oder eine unbekannte
 * Sprache – entfernt den Eintrag (dann gilt wieder die Sprache des Regelwerks). Ein Parcours
 * ohne Eintrag bleibt nicht leer zurück. Ändert sich nichts, kommt dasselbe Objekt zurück.
 */
export function setzeSprache(s: WkrSprachen, zellen: readonly WkrZelle[], sprache: Sprache | null): WkrSprachen {
  const wert = sprache !== null && isSprache(sprache) ? sprache : undefined
  let neu: WkrSprachen = s
  for (const { parcoursId, typeId } of zellen) {
    if (parcoursId === UNBRAUCHBAR || typeId === UNBRAUCHBAR) continue
    const liste = Object.prototype.hasOwnProperty.call(neu, parcoursId) ? neu[parcoursId] : {}
    const hat = Object.prototype.hasOwnProperty.call(liste, typeId)
    if (wert !== undefined ? hat && liste[typeId] === wert : !hat) continue
    const { [typeId]: _alt, ...rest } = liste
    const naechste: Record<string, Sprache> = wert !== undefined ? { ...rest, [typeId]: wert } : rest
    const { [parcoursId]: _weg, ...andere } = neu
    neu = Object.keys(naechste).length > 0 ? { ...andere, [parcoursId]: naechste } : andere
  }
  return neu
}

/**
 * Gespeicherte Sprachen der Bögen, bereinigt (Muster {@link normalisiereEinteilung}): nur gültige
 * Sprachen, mit `parcoursIds` nur die der Parcours, die es gibt, und die der Racecourses.
 *
 * Bis zum 15.11.2026 galt die Sprache je Liste für alle Parcours (`{ steg: 'de' }`). Ein solcher
 * Eintrag gilt jetzt für jeden Parcours und beide Racecourses – genau dort galt er bisher
 * (Entscheidung des Nutzers vom 15.11.2026). Ein Eintrag je Parcours hat Vorrang.
 */
export function normalisiereSprachen(raw: unknown, parcoursIds?: readonly string[]): WkrSprachen {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const ergebnis: Record<string, Record<string, Sprache>> = {}
  const setze = (parcoursId: string, typeId: string, sprache: Sprache, vorrang: boolean) => {
    if (parcoursId === UNBRAUCHBAR || typeId === UNBRAUCHBAR) return
    if (parcoursIds && !parcoursIds.includes(parcoursId) && !istRacecourseParcours(parcoursId)) return
    // Nur eigene Einträge: „constructor“ als Kennung träfe sonst das Objekt-Urbild.
    const liste = Object.prototype.hasOwnProperty.call(ergebnis, parcoursId) ? ergebnis[parcoursId] : (ergebnis[parcoursId] = {})
    if (vorrang || !Object.prototype.hasOwnProperty.call(liste, typeId)) liste[typeId] = sprache
  }
  const alle = [...(parcoursIds ?? []), ...Object.values(RACECOURSE_PARCOURS)]
  for (const [schluessel, wert] of Object.entries(raw)) {
    if (isSprache(wert)) {
      // Die frühere Form: eine Sprache je Liste für alle Parcours.
      for (const parcoursId of alle) setze(parcoursId, schluessel, wert, false)
    } else if (wert && typeof wert === 'object' && !Array.isArray(wert)) {
      for (const [typeId, sprache] of Object.entries(wert)) if (isSprache(sprache)) setze(schluessel, typeId, sprache, true)
    }
  }
  return Object.fromEntries(Object.entries(ergebnis).filter(([, liste]) => Object.keys(liste).length > 0))
}

export interface EinteilungsListe {
  id: string
  titel: string
}

/**
 * Die Zeilen der Einteilung: die Listen der Veranstaltung in ihrer Reihenfolge (lib/listen.ts
 * – die des Aufbaus, wahlweise zusammengelegt, und die gewählten zusätzlichen). Darunter
 * `weitere`: Listen, die gerade nicht gelten, an denen aber noch ein Name steht (etwa die
 * Parcoursliste, seit Tor 5 sie übernimmt) – Personennamen sollen sichtbar und löschbar bleiben.
 * Teilen sich mehrere denselben Titel (z. B. „Tor 1 / 3 / 5“ mit und ohne Start/Ziel),
 * steht der ausführliche Name aus dem Menü.
 */
export function einteilungsListen(konfig: ListenKonfig, wahl: ListenWahl, einteilung: Einteilung = {}): { aufbau: EinteilungsListe[]; weitere: EinteilungsListe[] } {
  const a = konfig.getAufbau(wahl.aufbau)
  const gelten = veranstaltungsListen(konfig, wahl)
  const mitNamen = new Set(Object.values(einteilung).flatMap((liste) => Object.keys(liste).filter((id) => liste[id].trim() !== '')))
  const moeglich = [...a.order, ...(a.kombi ? [a.kombi.positionId] : []), ...a.zusatz]
  const weitere = [...new Set(moeglich)].filter((id) => !gelten.includes(id) && mitNamen.has(id))
  const defs = [...gelten, ...weitere].map((id) => konfig.getSheetDef(id))
  const anzahl = new Map<string, number>()
  for (const d of defs) anzahl.set(d.title, (anzahl.get(d.title) ?? 0) + 1)
  const zeile = (id: string): EinteilungsListe => {
    const d = defs.find((x) => x.typeId === id)!
    return { id, titel: (anzahl.get(d.title) ?? 0) > 1 ? d.menuLabel : d.title }
  }
  return { aufbau: gelten.map(zeile), weitere: weitere.map(zeile) }
}

/** Hat eine Klasse dieses Parcours die Liste (z. B. Mann-über-Bord erst ab Klasse 4)? */
export function listeGilt(konfig: Pick<ListenKonfig, 'positionAllowsClass'>, typeId: string, klassen: readonly ClassId[]): boolean {
  return klassen.some((k) => konfig.positionAllowsClass(typeId, k))
}

/**
 * Alle Zellen der Einteilung, deren Bogen gedruckt wird: je Parcours der Verzahnung die Listen
 * der Veranstaltung, die eine seiner Klassen hat, und je Racecourse die Listen des
 * Parallelslaloms (`parallelTypen`, lib/parallelBogen.ts `parallelListen`; leer ohne
 * Parallelslalom). Darauf wirken „alle auf …“ (Sprache, WkrEinteilung.vue) und die
 * Beispiel-Besetzung (lib/beispieldaten.ts) – nicht auf Listen, die gerade nicht gelten.
 */
export function einteilungsZellen(
  konfig: ListenWahlKonfig & Pick<ListenKonfig, 'positionAllowsClass'>,
  stand: ListenWahl & { parcoursList: readonly Pick<Parcours, 'id' | 'classIds'>[] },
  parallelTypen: readonly string[],
): WkrZelle[] {
  const listen = veranstaltungsListen(konfig, stand)
  return [
    ...stand.parcoursList.flatMap((p) => listen.filter((typeId) => listeGilt(konfig, typeId, p.classIds)).map((typeId) => ({ parcoursId: p.id, typeId }))),
    ...RACECOURSES.flatMap((rc) => parallelTypen.map((typeId) => ({ parcoursId: RACECOURSE_PARCOURS[rc], typeId }))),
  ]
}
