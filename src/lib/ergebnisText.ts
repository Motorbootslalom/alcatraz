import { locale, tIn, type Locale, type MessageKey } from '../i18n'
import type { AbstandArt } from './ergebnis'
import { formatClock, formatSeconds, formatTimeDisplay } from './time'

// Texte der Ergebnislisten und der Erfassung: Zahlen mit Komma oder Punkt, „disq.“, und die
// wenigen Spaltenkürzel des Fahrwegs, die ein deutsches Wort sind. Reaktiv, weil die Sprache
// bei jedem Aufruf gefragt wird.
//
// Die Erfassung ist Bedienung und nimmt die Sprache der Oberfläche (die Funktionen unten);
// die Ergebnislisten sind Listen und binden dieselben Funktionen mit {@link ergebnisTexte}
// an die Listensprache (lib/listensprache.ts).

// Die Kürzel kommen aus dem Fahrweg (config/kurzform.ts) und sind deutsch; übersetzt wird nur, was ein Wort ist.
const SPALTEN: Record<string, MessageKey> = {
  'Steg AB': 'results.col.stegAb',
  'Steg AN': 'results.col.stegAn',
  Ziel: 'results.col.ziel',
  MüB: 'results.col.mueb',
}

/** Die Texte in einer Sprache; `sprache` wird bei jedem Aufruf gefragt. */
export function ergebnisTexte(sprache: () => Locale) {
  /** Dezimalkomma im Deutschen, Punkt im Englischen. */
  const dezimal = (text: string) => (sprache() === 'de' ? text : text.replaceAll(',', '.'))
  /** Punkte (Sekunden) als „ss,00“. */
  const sekundenText = (centis: number | null) => (centis === null ? '' : dezimal(formatSeconds(centis)))
  return {
    /** Das Dezimalzeichen der Sprache – so erscheinen Zeiten auch beim Tippen. */
    dezimalZeichen: (): ',' | '.' => (sprache() === 'de' ? ',' : '.'),
    /** Eine Zeit in der Erfassung nach dem Verlassen des Feldes: „mm:ss,00 (ss,00)“. */
    zeitAnzeige: (centis: number) => dezimal(formatTimeDisplay(centis)),
    /** Eine Roh-Eingabe („1,2345“) mit dem Dezimalzeichen der Sprache, zum Weitertippen. */
    zeitRoh: (roh: string) => (sprache() === 'de' ? roh : roh.replace(',', '.')),
    /** Gefahrene Zeit als „mm:ss,00“. */
    zeitText: (centis: number | null) => (centis === null ? '' : dezimal(formatClock(centis))),
    sekundenText,
    /** Eine Punkte-Zelle: „disq.“ statt einer Zahl, leer solange das Ergebnis offen ist. */
    punkteZelle: (disq: boolean, centis: number | null) => (disq ? tIn(sprache(), 'results.dsq') : sekundenText(centis)),
    /** Ein Abstand als Zelle: „+12,34“, leer ohne Abstand. */
    abstandZelle: (centis: number | null | undefined) => (centis === null || centis === undefined ? '' : `+${sekundenText(centis)}`),
    abstandTitel: (art: AbstandArt) => tIn(sprache(), `results.gap.${art}`),
    /** Kopf einer Fahrweg-Spalte. */
    spaltenText: (label: string) => (SPALTEN[label] ? tIn(sprache(), SPALTEN[label]) : label),
  }
}

/** In der Sprache der Oberfläche. */
export const { dezimalZeichen, zeitAnzeige, zeitRoh, zeitText, sekundenText, punkteZelle, abstandZelle, abstandTitel, spaltenText } = ergebnisTexte(() => locale.value)
