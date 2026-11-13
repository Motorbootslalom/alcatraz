import { t, type MessageKey } from '../i18n'

// Die Arbeitsschritte der Auswertung auf dem Laufzettel stehen in config/einstellungen.yaml –
// deutsch, wie alles dort. In einer anderen Sprache der Oberfläche werden die mitgelieferten
// Schritte übersetzt (wie die Spaltenkürzel in lib/ergebnisText.ts); eigene bleiben, wie sie sind.
const SCHRITTE: Record<string, MessageKey> = {
  Auswertung: 'runsheet.steps',
  'Ergebnis sortiert nach Startnummer drucken (geheftet mit den WKR-Listen)': 'runsheet.step.byNumber',
  'Ergebnis sortiert nach Platz': 'runsheet.step.byPlace',
  Kontrolliert: 'runsheet.step.checked',
  Unterschrieben: 'runsheet.step.signed',
  Ausgehangen: 'runsheet.step.posted',
  'An die ML geschickt': 'runsheet.step.sent',
}

/** Ein Arbeitsschritt (oder die Überschrift darüber) in der Sprache der Oberfläche. */
export const schrittText = (text: string) => (SCHRITTE[text] ? t(SCHRITTE[text]) : text)
