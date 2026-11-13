import { locale, t, type MessageKey } from '../i18n'
import type { AbstandArt } from './ergebnis'
import { formatClock, formatSeconds, formatTimeDisplay } from './time'

// Texte der Ergebnislisten in der Sprache der Oberfläche: Zahlen mit Komma oder Punkt,
// „disq.“, und die wenigen Spaltenkürzel des Fahrwegs, die ein deutsches Wort sind. Reaktiv,
// weil `t()` und `locale` es sind.

/** Dezimalkomma im Deutschen, Punkt im Englischen. */
const dezimal = (text: string) => (locale.value === 'de' ? text : text.replaceAll(',', '.'))

/** Das Dezimalzeichen der Sprache – so erscheinen Zeiten auch beim Tippen. */
export const dezimalZeichen = (): ',' | '.' => (locale.value === 'de' ? ',' : '.')

/** Eine Zeit in der Erfassung nach dem Verlassen des Feldes: „mm:ss,00 (ss,00)“. */
export const zeitAnzeige = (centis: number) => dezimal(formatTimeDisplay(centis))

/** Eine Roh-Eingabe („1,2345“) mit dem Dezimalzeichen der Sprache, zum Weitertippen. */
export const zeitRoh = (roh: string) => (locale.value === 'de' ? roh : roh.replace(',', '.'))

/** Gefahrene Zeit als „mm:ss,00“. */
export const zeitText = (centis: number | null) => (centis === null ? '' : dezimal(formatClock(centis)))

/** Punkte (Sekunden) als „ss,00“. */
export const sekundenText = (centis: number | null) => (centis === null ? '' : dezimal(formatSeconds(centis)))

/** Eine Punkte-Zelle: „disq.“ statt einer Zahl, leer solange das Ergebnis offen ist. */
export const punkteZelle = (disq: boolean, centis: number | null) => (disq ? t('results.dsq') : sekundenText(centis))

/** Ein Abstand als Zelle: „+12,34“, leer ohne Abstand. */
export const abstandZelle = (centis: number | null | undefined) => (centis === null || centis === undefined ? '' : `+${sekundenText(centis)}`)

export const abstandTitel = (art: AbstandArt) => t(`results.gap.${art}`)

// Die Kürzel kommen aus dem Fahrweg (config/kurzform.ts) und sind deutsch; übersetzt wird nur, was ein Wort ist.
const SPALTEN: Record<string, MessageKey> = {
  'Steg AB': 'results.col.stegAb',
  'Steg AN': 'results.col.stegAn',
  Ziel: 'results.col.ziel',
  MüB: 'results.col.mueb',
}

/** Kopf einer Fahrweg-Spalte in der Sprache der Oberfläche. */
export const spaltenText = (label: string) => (SPALTEN[label] ? t(SPALTEN[label]) : label)
