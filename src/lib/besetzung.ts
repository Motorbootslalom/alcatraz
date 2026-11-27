import type { Besetzung, ClassId, CoPilot, CoPilotAusgleich, CoPilotPaar, CoPilotRolle, CoPiloten } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { regelwerkOf } from '../config/catalog'

// Besetzung je Klasse: welches Boot die Klasse fährt und wer als Co-Pilot mitfährt. Beides
// legt die Regattaleitung für die Veranstaltung fest (DM-Reglement A2: „Die Zuordnung der
// Boote für die verschiedenen Klassen bzw. Parcours wird durch die Regattaleitung
// festgelegt.“; C3 „Co-Pilot und Gewichte“; UIM 960 Pkt. 2: „A co-driver is mandatory for
// Classes Dolphin, 1 - 3. […] Within the same class is to be the same co-driver.“).
//
// Das Boot ist freier Text je Klasse, keine Personenangabe und reist mit der Vorlage. Die Co-Piloten
// sind Personen – je Klasse der eingeteilte und (seit 26.11.2026, R11-07) ein Ersatz-Co-Pilot, je
// Person optional mit Gewicht – und stehen wie die Wettkampfrichter nur in der Sicherung
// (persistenz/backup.ts). Ihr Ausgleichsgewicht rechnet lib/ausgleich.ts coPilotAusgleichVon.

/** So lang darf eine Angabe sein: Sie muss in ein Feld des Listenkopfs passen. */
export const BESETZUNG_MAX = 60

const istKlasse = (x: string): x is ClassId => (CLASS_IDS as readonly string[]).includes(x)

/** Setzt die Angabe einer Klasse, wie sie getippt wurde (ein Feld darf beim Tippen kein Leerzeichen verlieren); leer entfernt sie. */
export function setzeBesetzung(b: Besetzung, klasse: ClassId, text: string): Besetzung {
  const { [klasse]: _alt, ...rest } = b
  return text.trim() ? { ...rest, [klasse]: text.slice(0, BESETZUNG_MAX) } : rest
}

/** Eine gespeicherte Besetzung, bereinigt: nur bekannte Klassen mit nicht leerem Text. */
export function normalisiereBesetzung(roh: unknown): Besetzung {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {}
  const b: Besetzung = {}
  for (const [klasse, text] of Object.entries(roh)) {
    if (istKlasse(klasse) && typeof text === 'string' && text.trim()) b[klasse] = text.slice(0, BESETZUNG_MAX)
  }
  return b
}

/** Die Angabe einer Klasse, wie sie gedruckt wird (ohne Leerraum am Rand); leer, wenn es keine gibt. */
export function besetzungText(b: Besetzung, klasse: ClassId): string {
  return b[klasse]?.trim() ?? ''
}

/** Sieht das Regelwerk in dieser Klasse einen Co-Piloten vor (`coPilot` im YAML)? */
export function coPilotVorgesehen(regelwerk: string, klasse: ClassId): boolean {
  return regelwerkOf(regelwerk).coPilotKlassen.includes(klasse)
}

/**
 * Hat ein Blatt der Klasse ein Feld für den Co-Piloten? Ja, wo das Regelwerk ihn vorsieht –
 * auch leer, zum Eintragen von Hand – und überall, wo einer eingetragen ist (das Reglement
 * lässt für Club- und Landesmeisterschaften begründete Abweichungen zu). Eingetragen heißt seit
 * 26.11.2026 auch: nur ein Ersatz-Co-Pilot oder nur ein Gewicht.
 */
export function zeigtCoPilot(stand: { regelwerk: string; coPiloten: CoPiloten }, klasse: ClassId): boolean {
  return coPilotVorgesehen(stand.regelwerk, klasse) || stand.coPiloten[klasse] !== undefined
}

// --- Co-Piloten (R11-07, 26.11.2026): je Klasse Co-Pilot und Ersatz-Co-Pilot, je Person optional das Gewicht ---

/** Die Rollen in der Folge, in der sie überall stehen: erst der eingeteilte Co-Pilot, darunter sein Ersatz. */
export const CO_PILOT_ROLLEN: readonly CoPilotRolle[] = ['haupt', 'ersatz']

/** Die beiden Wahlen der Einstellung „Ausgleich der Co-Piloten“; die erste ist die Vorgabe (DM-Reglement C3). */
export const CO_PILOT_AUSGLEICHE: readonly CoPilotAusgleich[] = ['klasse', 'alle']

/** Eine gespeicherte Wahl oder die Vorgabe `klasse` – für Reducer und migrate (EINE Prüfung). */
export function coPilotAusgleichWert(wert: unknown): CoPilotAusgleich {
  return wert === 'alle' ? 'alle' : 'klasse'
}

const istRolle = (x: unknown): x is CoPilotRolle => x === 'haupt' || x === 'ersatz'

/**
 * Ein brauchbares Gewicht eines Co-Piloten in kg oder `undefined`: wie in der Verwiegung (domain/gewicht.ts
 * parseGewicht) über 0 und unter 300 kg, auf 0,1 kg. Für Reducer und migrate – die Oberfläche liest das Feld mit
 * parseGewicht und schickt die Zahl.
 */
export function coPilotGewichtWert(kg: unknown): number | undefined {
  return typeof kg === 'number' && Number.isFinite(kg) && kg > 0 && kg < 300 ? Math.round(kg * 10) / 10 : undefined
}

/** Ein Co-Pilot zählt, solange er einen Namen ODER ein Gewicht hat – sonst fällt die Rolle weg. */
const zaehlt = (c: CoPilot | undefined): c is CoPilot => c !== undefined && (c.name.trim() !== '' || c.gewicht !== undefined)

/** Setzt eine Rolle einer Klasse; fällt sie leer, entfällt sie, und ohne Rolle entfällt die Klasse. */
function mitRolle(c: CoPiloten, klasse: ClassId, rolle: CoPilotRolle, neu: CoPilot): CoPiloten {
  const { [klasse]: altPaar, ...rest } = c
  const { [rolle]: _alt, ...andere } = altPaar ?? {}
  const paar: CoPilotPaar = zaehlt(neu) ? { ...andere, [rolle]: neu } : andere
  return Object.keys(paar).length > 0 ? { ...rest, [klasse]: paar } : rest
}

/** Der Name einer Rolle, wie getippt (ein Feld darf beim Tippen kein Leerzeichen verlieren); leer entfernt ihn – ein Gewicht bleibt. */
export function setzeCoPilotName(c: CoPiloten, klasse: ClassId, rolle: CoPilotRolle, text: string): CoPiloten {
  const alt = c[klasse]?.[rolle]
  const name = text.trim() ? text.slice(0, BESETZUNG_MAX) : ''
  // Unverändert: derselbe Stand (der Reducer gibt dann dieselbe Referenz zurück).
  if ((alt?.name ?? '') === name) return c
  return mitRolle(c, klasse, rolle, { ...alt, name })
}

/**
 * Das Gewicht einer Rolle in kg; `undefined` entfernt es (der Name bleibt). Unbrauchbares ändert nichts – derselbe
 * Stand kommt zurück, ebenso bei unverändertem Wert.
 */
export function setzeCoPilotGewicht(c: CoPiloten, klasse: ClassId, rolle: CoPilotRolle, kg: number | undefined): CoPiloten {
  const alt = c[klasse]?.[rolle]
  const gewicht = kg === undefined ? undefined : coPilotGewichtWert(kg)
  if ((kg !== undefined && gewicht === undefined) || alt?.gewicht === gewicht) return c
  const { gewicht: _g, ...ohne } = alt ?? { name: '' }
  return mitRolle(c, klasse, rolle, gewicht === undefined ? ohne : { ...ohne, gewicht })
}

/**
 * Gespeicherte Co-Piloten, bereinigt: nur bekannte Klassen und Rollen, Namen als Text (höchstens
 * {@link BESETZUNG_MAX} Zeichen), Gewichte nach {@link coPilotGewichtWert}; leere Rollen und Klassen entfallen.
 * Ein Stand vor dem 26.11.2026 (je Klasse nur ein Name als Text) wird der eingeteilte Co-Pilot (`haupt`).
 */
export function normalisiereCoPiloten(roh: unknown): CoPiloten {
  if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {}
  let c: CoPiloten = {}
  for (const [klasse, wert] of Object.entries(roh)) {
    if (!istKlasse(klasse)) continue
    if (typeof wert === 'string') {
      c = setzeCoPilotName(c, klasse, 'haupt', wert)
      continue
    }
    if (!wert || typeof wert !== 'object' || Array.isArray(wert)) continue
    for (const [rolle, person] of Object.entries(wert)) {
      if (!istRolle(rolle) || !person || typeof person !== 'object') continue
      const { name, gewicht } = person as { name?: unknown; gewicht?: unknown }
      c = setzeCoPilotName(c, klasse, rolle, typeof name === 'string' ? name : '')
      c = setzeCoPilotGewicht(c, klasse, rolle, coPilotGewichtWert(gewicht))
    }
  }
  return c
}

/** Der Name einer Rolle, wie er gedruckt wird (ohne Leerraum am Rand); leer, wenn es keinen gibt. */
export function coPilotName(c: CoPiloten, klasse: ClassId, rolle: CoPilotRolle = 'haupt'): string {
  return c[klasse]?.[rolle]?.name.trim() ?? ''
}

/** In wie vielen der genannten Klassen steht schon ein Co-Pilot (Name, Ersatz oder Gewicht)? Für Kopfzeile und Rückfrage. */
export function coPilotKlassenBesetzt(c: CoPiloten, klassen: readonly ClassId[]): number {
  return klassen.filter((k) => c[k] !== undefined).length
}

/**
 * Die Klassen, deren Boot die Beispiel-Boote füllen: die des Regelwerks und jede, in der noch
 * Starter stehen – dieselben, die der Block „Besetzung“ zeigt (lib/event.ts `classes`), in
 * derselben Folge. Rein, damit Oberfläche (Rückfrage) und Reducer dieselben zählen.
 */
export function besetzungsKlassen(stand: { regelwerk: string; starters: readonly { klasse: ClassId }[] }): ClassId[] {
  const rw = regelwerkOf(stand.regelwerk).klassen
  const benutzt = new Set(stand.starters.map((p) => p.klasse))
  return CLASS_IDS.filter((k) => rw.includes(k) || benutzt.has(k))
}

/** Die Klassen, deren Co-Piloten die Beispiel-Co-Piloten füllen: davon die, in denen das Regelwerk einen vorsieht. */
export function coPilotKlassen(stand: { regelwerk: string; starters: readonly { klasse: ClassId }[] }): ClassId[] {
  return besetzungsKlassen(stand).filter((k) => coPilotVorgesehen(stand.regelwerk, k))
}
