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

/** Eine Angabe je Klasse als freier Text (Boot, Co-Pilot); eine Klasse ohne Angabe fehlt. */
export type Besetzung = Partial<Record<ClassId, string>>

export type LaufzettelLayout = 'seite' | 'liste'

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
