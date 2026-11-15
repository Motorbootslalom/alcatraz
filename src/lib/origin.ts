import type { OriginMode, OriginStyle, Starter } from '../types'
import { defaultKuerzel, eigenesKuerzel, iocKuerzel, type KuerzelNorm } from '../domain/kuerzel'
import { flaggeVon, flaggenName, hatFlaggen, type Flagge } from '../domain/flaggen'
import type { MessageKey } from '../i18n'

/** Das Feld des Starters, in dem die gewählte Herkunft steht. */
export function originField(mode: OriginMode): 'verein' | 'bundesland' | 'land' {
  return mode === 'bundesland' ? 'bundesland' : mode === 'land' ? 'land' : 'verein'
}

/** Herkunft eines Starters in der gewählten Darstellung; leer bei `none`. */
export function originOf(p: Starter, mode: OriginMode): string {
  if (mode === 'none') return ''
  if (mode === 'land') return p.land ?? ''
  return mode === 'bundesland' ? p.bundesland : p.verein || p.bundesland
}

/**
 * Spaltenüberschrift der Herkunft als Katalogschlüssel – auf allen Listen dieselbe, und
 * genau das, was unter „Veranstaltung“ gewählt ist („Bundesland“ heißt nicht „Land“).
 */
export function originLabelKey(mode: OriginMode): MessageKey {
  return mode === 'bundesland' ? 'common.state' : mode === 'land' ? 'common.country' : 'common.club'
}

/** Alle Darstellungen der Herkunft, in der Reihenfolge der Auswahl. */
export const ORIGIN_STYLES: readonly OriginStyle[] = ['lang', 'kurz', 'flagge-lang', 'flagge-kurz', 'flagge']

export function istOriginStyle(wert: unknown): wert is OriginStyle {
  return (ORIGIN_STYLES as readonly unknown[]).includes(wert)
}

/**
 * Die Darstellung, die tatsächlich gilt: Für Vereine gibt es keine Flaggen – dort steht eine
 * Flaggen-Darstellung wie die ohne Flagge da („nur Flagge“ als Kürzel). Die Einstellung selbst
 * bleibt, damit sie nach dem Wechsel zurück zu Bundesland oder Land wieder gilt.
 */
export function wirksamerStil(style: OriginStyle, mode: OriginMode): OriginStyle {
  if (hatFlaggen(mode)) return style
  return style === 'flagge-lang' ? 'lang' : style === 'lang' ? 'lang' : 'kurz'
}

/** So viele Zeichen Breite rechnen die Listen für eine Flagge samt Abstand (Spaltenbreite, kleiner setzen). */
const FLAGGE_ZEICHEN = 'XXX'

/** Eine Herkunft, wie sie auf einer Liste steht – was `HerkunftText.vue` zeichnet. */
export interface HerkunftAnzeige {
  /** Die Herkunft, wie sie am Starter steht. */
  name: string
  /** Die Flagge; fehlt bei Darstellungen ohne Flagge, bei Vereinen und bei nicht erkannter Herkunft. */
  flagge?: Flagge
  /** Textalternative der Flagge; leer, wenn der Name ohnehin daneben steht (sonst läse ihn ein Vorleseprogramm doppelt). */
  alt: string
  /** Der Text neben der Flagge oder allein; leer bei „nur Flagge“. */
  text: string
  /**
   * Nur bei „nur Flagge“: das Kürzel, das im Druck neben der Flagge steht. Eine Liste muss in
   * Schwarz-Weiß brauchbar sein, und dort sind viele Flaggen nicht zu unterscheiden (Hessen und
   * Thüringen, Niederlande und Luxemburg) – auf Papier steht die Flagge deshalb nie allein.
   */
  druck: string
  /** Dasselbe als reiner Text (Fließtext wie „Fortsetzung: …“, Breite schätzen): nie leer, solange es eine Herkunft gibt. */
  klartext: string
  /** Ersatztext gleicher Breite für die Schätzung der Spaltenbreite: der gedruckte Text, mit Flagge um deren Breite länger. */
  mass: string
}

/**
 * Die eine Stelle, an der entschieden wird, wie eine Herkunft auf einer Liste steht: Text,
 * Kürzel, Flagge. Alle Listen (Starter-, Vorsteg-, Wertungslisten, Pokalauswertung) und der
 * Starter-Reiter zeigen, was hier herauskommt, über `HerkunftText.vue`.
 *
 * Kürzel: das eigene des Veranstalters, sonst die Vorgabe zum Namen, sonst – wenn die
 * Herkunft als Bundesland oder Staat erkannt ist – dessen Kürzel („Holland“ → NLD). Ist die
 * Angabe selbst schon ein Kürzel („GER“), bleibt sie stehen. Ohne Kürzel steht der Name da.
 * Länder bekommen ihr Kürzel nach der Norm des Regelwerks (`norm`, domain/kuerzel.ts
 * `KuerzelNorm`): unter der UIM das des IOC (Regel 209) – dort wird jeder erkannte Staat zu
 * diesem Kürzel, gleich wie er eingetragen ist („Germany“, „Deutschland“, „DEU“ und „GER“ → GER),
 * damit eine Nation auf einer Liste nicht unter zwei Codes steht.
 *
 * Nationen sind international (Entscheidung des Nutzers vom 15.11.2026): Auf einer englischen
 * Liste steht ein erkannter Staat mit seinem englischen Namen („Litauen“ → „Lithuania“) bzw.
 * seinem Kürzel – nie der deutsche Name. Auf einer deutschen Liste steht er, wie er eingetragen ist.
 * `eingabe`: keine Liste, sondern die Angabe selbst (Starter-Reiter, Tabelle der Kürzel) – dort
 * steht der Name immer so, wie er eingetragen ist; `sprache` gilt dann nur für die Textalternative.
 */
export function herkunftAnzeige(
  name: string,
  mode: OriginMode,
  style: OriginStyle,
  own: Record<string, string>,
  sprache: string = 'de',
  eingabe = false,
  norm: KuerzelNorm = 'iso',
): HerkunftAnzeige {
  const stil = wirksamerStil(style, mode)
  const erkannt = name ? flaggeVon(name, mode) : undefined
  const kurz = (name && kurzVon(name, erkannt, own, norm)) || name
  const mitFlagge = stil !== 'lang' && stil !== 'kurz'
  const flagge = mitFlagge ? erkannt : undefined
  /** Der ausgeschriebene Name auf der Liste: englisch der englische des erkannten Staates. */
  const lang = !eingabe && sprache === 'en' && erkannt?.art === 'staat' ? flaggenName(erkannt, 'en') : name
  // Ohne Flagge (nicht erkannt) bleibt von „nur Flagge“ das Kürzel – sonst stünde nichts da.
  const text = stil === 'lang' || stil === 'flagge-lang' ? lang : stil === 'flagge' && flagge ? '' : kurz
  const druck = stil === 'flagge' && flagge ? kurz : ''
  const klartext = text || druck
  return {
    name,
    flagge,
    // Steht die Angabe ausgeschrieben daneben – in welcher Schreibweise auch immer („Czech
    // Republic“ neben der Flagge von Tschechien) –, bleibt die Flagge stumm: Sonst läse ein
    // Vorleseprogramm „Czechia Czech Republic“. Ein Kürzel daneben (auch eine Angabe wie „GER“,
    // bis drei Zeichen) ist kein Name: Dann nennt die Flagge ihn.
    alt: flagge && !(text === lang && lang.trim().length > 3) ? flaggenName(flagge, sprache) : '',
    text,
    druck,
    klartext,
    mass: (flagge ? FLAGGE_ZEICHEN : '') + klartext,
  }
}

/** Das Kürzel einer Herkunft (siehe `herkunftAnzeige`); `''`, wenn es keins gibt. */
function kurzVon(name: string, erkannt: Flagge | undefined, own: Record<string, string>, norm: KuerzelNorm): string {
  const eigen = eigenesKuerzel(name, own)
  if (eigen) return eigen
  if (norm === 'ioc' && erkannt?.art === 'staat') return iocKuerzel(erkannt.code) ?? erkannt.kuerzel
  return defaultKuerzel(name, norm) || (erkannt && name.trim().length > 3 ? erkannt.kuerzel : '')
}

/** Die Herkunft eines Starters, wie sie auf einer Liste steht (siehe `herkunftAnzeige`). */
export function starterHerkunft(p: Starter, mode: OriginMode, style: OriginStyle, own: Record<string, string>, sprache?: string, norm?: KuerzelNorm): HerkunftAnzeige {
  return herkunftAnzeige(originOf(p, mode), mode, style, own, sprache, false, norm)
}

/**
 * Nur die Flagge, als Schmuck neben einem Feld, das die Herkunft selbst zeigt (Eingabefeld im
 * Starter-Reiter): ohne Textalternative – das Feld nennt den Namen – und ohne Kürzel für den Druck.
 */
export function flaggeAllein(name: string, mode: OriginMode): HerkunftAnzeige {
  return { ...herkunftAnzeige(name, mode, 'flagge', {}), alt: '', druck: '' }
}

/**
 * Herkunft für eine Liste als reiner Text: als Kürzel, wenn das gewünscht ist und es eines
 * gibt, sonst der ausgeschriebene Name.
 */
export function originText(p: Starter, mode: OriginMode, style: OriginStyle, own: Record<string, string>): string {
  return starterHerkunft(p, mode, style, own).klartext
}
