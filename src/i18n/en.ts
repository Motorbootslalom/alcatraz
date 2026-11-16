import type { Catalog } from './index'
import allgemein from './en/allgemein'
import veranstaltung from './en/veranstaltung'
import starter from './en/starter'
import verzahnung from './en/verzahnung'
import parallel from './en/parallel'
import erfassung from './en/erfassung'
import wertung from './en/wertung'
import listen from './en/listen'
import listenoptionen from './en/listenoptionen'
import aufbauten from './en/aufbauten'
import verlauf from './en/verlauf'

/**
 * English catalogue. Must provide exactly the keys of `de.ts`.
 * Die Teile in en/ sind wie in de/ geschnitten; jeder prüft seine Schlüssel gegen den deutschen Teil.
 */
const en: Catalog = {
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
}

export default en
