import type { ClassId } from './starter'
import type { Sprache } from './bogen'

// Einstellungen der Veranstaltung und ihrer Listen: Herkunft, Art der Veranstaltung, WKR-Einteilung und
// -Sprachen, Besetzung je Klasse, Form der Laufzettel, Logos der Listen.

/** Welche Herkunft gezeigt wird. `none` blendet sie aus (Clubmeisterschaft). */
export type OriginMode = 'verein' | 'bundesland' | 'land' | 'none'

/**
 * Darstellung der Herkunft auf Listen: ausgeschrieben, als Kürzel – oder mit Flagge (Flagge +
 * Kürzel, Flagge + ausgeschrieben, nur Flagge). Flaggen gibt es für die Herkunft „Bundesland“
 * und „Land“; für Vereine gilt eine Flaggen-Darstellung wie die ohne (lib/origin.ts).
 */
export type OriginStyle = 'lang' | 'kurz' | 'flagge-kurz' | 'flagge-lang' | 'flagge'

/** Art der Veranstaltung – steuert Vorgaben für Listen und Wertung. */
export type EventKind = 'meisterschaft' | 'club'

/**
 * WKR-Einteilung: Name des Wettkampfrichters je Parcours (Kennung aus der Verzahnung) und
 * Liste (`SheetTypeId`), siehe lib/einteilung.ts. Personennamen – nicht für die Vorlage.
 */
export type Einteilung = Record<string, Record<string, string>>

/**
 * Sprache der Wettkampfrichter-Bögen je Parcours (Kennung aus der Verzahnung, im
 * Parallelslalom die des Racecourse) und Liste (`SheetTypeId`) – gebaut wie die
 * {@link Einteilung}, siehe lib/einteilung.ts. Keine Personendaten: eine Einstellung.
 */
export type WkrSprachen = Record<string, Record<string, Sprache>>

/** Eine Angabe je Klasse als freier Text (Boot); eine Klasse ohne Angabe fehlt. */
export type Besetzung = Partial<Record<ClassId, string>>

/**
 * Rolle eines Co-Piloten in seiner Klasse (Antwort des Nutzers vom 26.11.2026, R11-07: „pro Klasse auch einen
 * Ersatz-Co-Piloten eintragen“): `haupt` = der eingeteilte Co-Pilot, `ersatz` = der, der für ihn einspringt.
 */
export type CoPilotRolle = 'haupt' | 'ersatz'

/**
 * Ein Co-Pilot: Name, wie getippt (leer, solange nur ein Gewicht steht), und – wenn gewogen – sein Gewicht in kg auf
 * 0,1 kg wie in der Verwiegung (R11-07: „Jeder Co-Pilot kann dann optional auch ein Gewicht eingetragen bekommen.“).
 */
export interface CoPilot {
  name: string
  gewicht?: number
}

/** Co-Pilot und Ersatz-Co-Pilot einer Klasse; eine Rolle ohne Name und Gewicht fehlt. */
export type CoPilotPaar = Partial<Record<CoPilotRolle, CoPilot>>

/** Co-Piloten je Klasse (lib/besetzung.ts); eine Klasse ohne Co-Piloten fehlt. */
export type CoPiloten = Partial<Record<ClassId, CoPilotPaar>>

/**
 * Wogegen das Ausgleichsgewicht eines Co-Piloten rechnet (R11-07: „ob das Ausgleichsgewicht über alle Co-Piloten zählt
 * oder nur pro Klasse“): `klasse` (Vorgabe, DM-Reglement C3 „in der jeweiligen Klasse“) = der schwerste Co-Pilot
 * seiner Klasse, `alle` = der schwerste Co-Pilot der Klassen, in denen Starter stehen (lib/ausgleich.ts
 * coPilotAusgleichVon; Prüfbefund 27.11.2026: nicht auch Klassen ohne Starter).
 */
export type CoPilotAusgleich = 'klasse' | 'alle'

export type LaufzettelLayout = 'seite' | 'liste'

/**
 * Wie die Klassen auf einem gemeinsamen WKR-Bogen stehen (Clubmeisterschaft, Wunsch des Nutzers vom 24.11.2026):
 * `getrennt` = je Klasse ein Block mit der Klasse als Überschrift, `verzahnung` = alle Zeilen gemischt in der
 * Startfolge der Verzahnung, mit der Klasse in einer Spalte hinter der Startnummer.
 */
export type WkrGemeinsamFolge = 'getrennt' | 'verzahnung'

/**
 * Gemeinsame WKR-Bögen mehrerer Klassen bei einer Meisterschaft (DM, UIM; Antwort des Nutzers vom 26.11.2026, R11-03:
 * „Wenn es schon da ist, kann man das auch bei den anderen nutzen.“). Die Clubmeisterschaft hat ihre eigene Angabe
 * (`wkrClubGemeinsam`), dort teilen sich Klassen immer Bögen.
 * - `aus` (Vorgabe): je Klasse ein Bogen, wie vor dem 26.11.2026.
 * - `gleich`: Klassen, deren Bogen gleich aufgebaut ist (gleiche Spalten, gleiche Zeichnung), stehen auf einem Bogen –
 *   wie bei der Clubmeisterschaft ohne „Papier sparen“; Listen mit verschiedener Zeichnung bleiben je Klasse.
 * - `alle`: „Papier sparen“ – alle Klassen einer Liste auf einem Bogen, ohne Parcoursbild.
 */
export type WkrMeisterschaftGemeinsam = 'aus' | 'gleich' | 'alle'

/** Platz eines Logos im Kopf der gedruckten Listen. */
export type LogoSeite = 'links' | 'rechts'

/**
 * Ein Logo: verkleinertes Bild als data-URL und seine Pixelmaße. Mit den Maßen steht die Breite
 * auf dem Blatt schon vor dem Laden des Bildes fest – die Seitenteilung hängt so nie davon ab.
 * Prüfung: lib/logo.ts `logoWert`.
 */
export interface LogoBild {
  src: string
  breite: number
  hoehe: number
}

/** Die beiden Logos der Listen; `null` = an diesem Platz keins. */
export type Logos = Record<LogoSeite, LogoBild | null>
