import allgemein from './de/allgemein'
import veranstaltung from './de/veranstaltung'
import starter from './de/starter'
import verzahnung from './de/verzahnung'
import parallel from './de/parallel'
import erfassung from './de/erfassung'
import wertung from './de/wertung'
import listen from './de/listen'
import listenoptionen from './de/listenoptionen'
import aufbauten from './de/aufbauten'
import verlauf from './de/verlauf'

/**
 * Deutscher Katalog – zugleich die Quelle aller Schlüssel. Jede weitere Sprache
 * muss genau diese Schlüssel liefern (siehe index.ts).
 *
 * Schreibweisen: `{name}` ist ein Platzhalter; „Einzahl | Mehrzahl“ wird von
 * `tn()` nach der Zahl `{n}` ausgewählt.
 *
 * Die Texte stehen nach Bereichen in de/ (welcher Präfix wo: CLAUDE.md); hier werden sie nur
 * zusammengesetzt, damit man für eine Änderung nur den einen Bereich lesen muss.
 */
export default {
  ...allgemein,
  ...veranstaltung,
  ...starter,
  ...verzahnung,
  ...parallel,
  ...erfassung,
  ...wertung,
  ...listen,
  ...listenoptionen,
  ...aufbauten,
  ...verlauf,
} as const satisfies Record<string, string>
