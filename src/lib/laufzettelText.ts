import { t, type MessageKey } from '../i18n'

// Die Arbeitsschritte der Auswertung auf dem Laufzettel stehen in config/einstellungen.yaml –
// deutsch, wie alles dort. In einer anderen Sprache der Oberfläche werden die mitgelieferten
// Schritte übersetzt (wie die Spaltenkürzel in lib/ergebnisText.ts); eigene bleiben, wie sie sind.
// Der Laufzettel ist eine Liste: Er reicht die Übersetzung der Listensprache herein
// (lib/listensprache.ts); ohne sie gilt die Oberfläche.
const SCHRITTE: Record<string, MessageKey> = {
  Auswertung: 'runsheet.steps',
  'Wertungsliste sortiert nach Startnummer drucken (geheftet mit den WKR-Listen)': 'runsheet.step.byNumber',
  'Wertungsliste sortiert nach Platz': 'runsheet.step.byPlace',
  Kontrolliert: 'runsheet.step.checked',
  Unterschrieben: 'runsheet.step.signed',
  Ausgehangen: 'runsheet.step.posted',
  'An die ML geschickt': 'runsheet.step.sent',
  // Nur auf dem Zettel des letzten Laufs:
  'Einsicht der Mannschaftsleiter (kein Aushang)': 'runsheet.step.review',
  'Gesamtergebnis gedruckt': 'runsheet.step.overallPrinted',
  'Gesamtergebnis kontrolliert': 'runsheet.step.overallChecked',
}

/** Ein Arbeitsschritt (oder die Überschrift darüber), übersetzt mit `uebersetze`. */
export const schrittText = (text: string, uebersetze: (key: MessageKey) => string = t) => (SCHRITTE[text] ? uebersetze(SCHRITTE[text]) : text)

/**
 * Ein Arbeitsschritt in der Sprache der Liste: Nennt das Regelwerk den englischen Wortlaut
 * selbst (`en`, nach dem Regelbuch formuliert), gilt er auf englischen Zetteln; sonst die
 * Übersetzung der mitgelieferten Schritte.
 */
export const schrittIn = (schritt: { text: string; en?: string }, sprache: 'de' | 'en', uebersetze: (key: MessageKey) => string = t) =>
  sprache === 'en' && schritt.en ? schritt.en : schrittText(schritt.text, uebersetze)
