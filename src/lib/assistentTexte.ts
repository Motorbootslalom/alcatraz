import type { Blick } from '../config/schema'
import { t, type MessageKey } from '../i18n'
import { ZEILEN, type EntwurfsLuecke, type Zeile } from './assistent'

// Die Namen im Assistenten in der Sprache der Bedienoberfläche. lib/assistent.ts trägt
// deutsche Namen (wie der Prototyp); Tabelle und Bild übersetzen hier über die IDs.

export const BLICK_NAME: Record<Blick | '', MessageKey> = {
  '': 'assist.view.none',
  hinten: 'assist.view.hinten',
  vorne: 'assist.view.vorne',
  rechts: 'assist.view.rechts',
  links: 'assist.view.links',
}

export const ZEITNAHME_NAME: Record<string, MessageKey> = {
  '': 'assist.timing.none',
  e: 'assist.timing.e',
  s: 'assist.timing.s',
  e2s: 'assist.timing.e2s',
  '3s': 'assist.timing.3s',
}

const ZEILEN_NAME: Record<string, MessageKey> = {
  StartZiel: 'assist.row.StartZiel',
  Speedboje_oben: 'assist.row.Speedboje_oben',
  Speedboje_unten: 'assist.row.Speedboje_unten',
  tor5: 'assist.row.tor5',
  mueb: 'assist.row.mueb',
  parcours: 'assist.row.parcours',
}

/** Für welche Klassen es eine Zeile gibt, als Hinweis hinter dem Namen. */
export const ZEILEN_KLASSEN: Record<string, MessageKey> = {
  Speedboje_oben: 'assist.rowNote.Speedboje_oben',
  Speedboje_unten: 'assist.rowNote.Speedboje_unten',
  mueb: 'assist.rowNote.mueb',
}

/** Lücken ohne Zeile in der Tabelle: Sie schließt der Baustein „Steg“. */
const KATALOG_NAME: Record<string, MessageKey> = {
  stegAblegen: 'assist.gap.stegAblegen',
  stegAnlegen: 'assist.gap.stegAnlegen',
}

export function zeilenName(z: Zeile): string {
  const tor = z.id.match(/^Tor(\d)$/)
  if (tor) return t('assist.row.gate', { n: tor[1] })
  return ZEILEN_NAME[z.id] ? t(ZEILEN_NAME[z.id]) : z.name
}

/** „rechts · außen“: die erste Hälfte ist die rechte Seite auf der Hinfahrt. */
export function haelfteName(z: Zeile, id: string): string {
  const seite = t(z.haelften?.[0].id === id ? 'assist.side.right' : 'assist.side.left')
  const lage = id.endsWith('_innen') ? t('assist.side.inner') : id.endsWith('_aussen') ? t('assist.side.outer') : ''
  return lage ? `${seite} · ${lage}` : seite
}

/** Der Name eines Feldes, z. B. „Tor 1 rechts · außen“ oder „Mann-über-Bord“. */
export function feldName(f: string): string {
  for (const z of ZEILEN) {
    if (z.id === f) return zeilenName(z)
    if (z.haelften?.some((x) => x.id === f)) return `${zeilenName(z)} ${haelfteName(z, f)}`
  }
  return f
}

/** Eine Lücke so, wie die Tabelle die Boje oder Aufgabe nennt – nicht mit der Kennung der Prüfung. */
export function lueckenName(l: EntwurfsLuecke): string {
  const name = l.feld ? feldName(l.feld) : l.katalog && KATALOG_NAME[l.katalog] ? t(KATALOG_NAME[l.katalog]) : l.element
  return l.nurZusammengelegt ? t('assist.gap.combinedOnly', { name }) : name
}
