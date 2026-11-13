import type { ClassId, Einteilung, Parcours } from '../types'

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
// Es sind Personennamen: Sie gehören in die Sicherung, nicht in die Vorlage (persistenz/backup.ts).

/** Was {@link wkrName} vom Stand braucht. */
export type EinteilungsStand = { einteilung: Einteilung; parcoursList: readonly Pick<Parcours, 'id' | 'classIds'>[] }

/** Was die Funktionen hier von der Konfiguration brauchen (config/konfig.ts `Konfig`). */
export interface ListenKonfig {
  getAufbau(id: string): { order: string[]; zusatz: string[]; kombi?: { positionId: string } }
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
 * Tabelle (WkrEinteilung.vue) und Bogenkopf (WkrVorschau.vue) schreiben beide mit
 * `SET_WKR_NAME` an diese Stelle – deshalb zeigen sie stets denselben Stand.
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
    if (parcoursId === UNBRAUCHBAR || (parcoursIds && !parcoursIds.includes(parcoursId))) continue
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
export function haengeUm(e: Einteilung, alt: readonly string[], neu: readonly string[]): Einteilung {
  const namen = new Map(Object.entries(e))
  const paare: Array<[string, Record<string, string>]> = []
  neu.forEach((id, i) => {
    const quelle = alt.includes(id) ? id : alt[i] !== undefined && !neu.includes(alt[i]) ? alt[i] : undefined
    const liste = quelle === undefined ? undefined : namen.get(quelle)
    if (liste && id !== UNBRAUCHBAR) paare.push([id, liste])
  })
  return Object.fromEntries(paare)
}

/** Die Einteilung ohne einen Parcours (er wurde entfernt). */
export function ohneParcours(e: Einteilung, parcoursId: string): Einteilung {
  return Object.fromEntries(Object.entries(e).filter(([id]) => id !== parcoursId))
}

export interface EinteilungsListe {
  id: string
  titel: string
}

/**
 * Die Zeilen der Einteilung: die Listen des Aufbaus in seiner Reihenfolge, darunter die
 * weiteren, die sich ebenfalls drucken lassen (Schnellauswahl, zusammengelegte Liste).
 * Teilen sich mehrere denselben Titel (z. B. „Tor 1 / 3 / 5“ mit und ohne Start/Ziel),
 * steht der ausführliche Name aus dem Menü.
 */
export function einteilungsListen(konfig: ListenKonfig, aufbauId: string): { aufbau: EinteilungsListe[]; weitere: EinteilungsListe[] } {
  const a = konfig.getAufbau(aufbauId)
  const kombi = a.kombi && !a.order.includes(a.kombi.positionId) && !a.zusatz.includes(a.kombi.positionId) ? [a.kombi.positionId] : []
  const weitere = [...kombi, ...a.zusatz]
  const defs = [...a.order, ...weitere].map((id) => konfig.getSheetDef(id))
  const anzahl = new Map<string, number>()
  for (const d of defs) anzahl.set(d.title, (anzahl.get(d.title) ?? 0) + 1)
  const zeile = (id: string): EinteilungsListe => {
    const d = defs.find((x) => x.typeId === id)!
    return { id, titel: (anzahl.get(d.title) ?? 0) > 1 ? d.menuLabel : d.title }
  }
  return { aufbau: a.order.map(zeile), weitere: weitere.map(zeile) }
}

/** Hat eine Klasse dieses Parcours die Liste (z. B. Mann-über-Bord erst ab Klasse 4)? */
export function listeGilt(konfig: Pick<ListenKonfig, 'positionAllowsClass'>, typeId: string, klassen: readonly ClassId[]): boolean {
  return klassen.some((k) => konfig.positionAllowsClass(typeId, k))
}
