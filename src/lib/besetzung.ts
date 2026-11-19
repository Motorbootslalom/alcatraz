import type { Besetzung, ClassId } from '../types'
import { CLASS_IDS } from '../domain/classes'
import { regelwerkOf } from '../config/catalog'

// Besetzung je Klasse: welches Boot die Klasse fährt und wer als Co-Pilot mitfährt. Beides
// legt die Regattaleitung für die Veranstaltung fest (DM-Reglement A2: „Die Zuordnung der
// Boote für die verschiedenen Klassen bzw. Parcours wird durch die Regattaleitung
// festgelegt.“; C3 „Co-Pilot und Gewichte“; UIM 960 Pkt. 2: „A co-driver is mandatory for
// Classes Dolphin, 1 - 3. […] Within the same class is to be the same co-driver.“).
//
// Beides ist freier Text je Klasse. Das Boot ist keine Personenangabe und reist mit der
// Vorlage; der Co-Pilot ist ein Personenname und steht – wie die Wettkampfrichter – nur in
// der Sicherung (persistenz/backup.ts).

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
 * lässt für Club- und Landesmeisterschaften begründete Abweichungen zu).
 */
export function zeigtCoPilot(stand: { regelwerk: string; coPiloten: Besetzung }, klasse: ClassId): boolean {
  return coPilotVorgesehen(stand.regelwerk, klasse) || besetzungText(stand.coPiloten, klasse) !== ''
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
