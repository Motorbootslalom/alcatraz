import { computed, inject, provide, type ComputedRef, type InjectionKey } from 'vue'
import { tIn, tnIn, type Locale, type MessageKey } from '../../i18n'
import type { MaskenAufbau } from '../../wkr/maske'
import type { ZeilenStufe } from '../../geraete/erfassen'

/**
 * Texte der WKR-Maske auf dem Handy (W3.3, Plan docs/plan-wkr-w3.md §5, 21.11.2026). Die Maske spricht die Sprache
 * der Liste (F13, G9: `de+en` → `de`), nicht die der Geräte-Oberfläche – deshalb tIn mit der Sprache, die WkrGeraet
 * bereitstellt (provide/inject), nie t(). Dazu die kleinen Formate, die mehrere Teile brauchen (Stufenzeichen,
 * Zellwerte als Text).
 */

type Params = Record<string, string | number>

export interface WkrText {
  sprache: ComputedRef<Locale>
  w(key: MessageKey, params?: Params): string
  wn(key: MessageKey, n: number, params?: Params): string
}

const WKR_TEXT: InjectionKey<WkrText> = Symbol('wkr-text')

function textFuer(sprache: ComputedRef<Locale>): WkrText {
  return {
    sprache,
    w: (key, params) => tIn(sprache.value, key, params),
    wn: (key, n, params) => tnIn(sprache.value, key, n, params),
  }
}

/** In WkrGeraet: die Sprache der Maske für alle Teile darunter. */
export function stelleWkrText(sprache: ComputedRef<Locale>): WkrText {
  const text = textFuer(sprache)
  provide(WKR_TEXT, text)
  return text
}

/** In jedem Teil der Maske; ohne WkrGeraet darüber (Tests einzelner Teile) deutsch. */
export function useWkrText(): WkrText {
  return inject(WKR_TEXT, () => textFuer(computed<Locale>(() => 'de')), true)
}

/** Stufe einer eigenen Zeile als Zeichen – nie nur Farbe (§5.2): ✓ übernommen, ↑ unterwegs, ! Rückfrage, ✗ abgelehnt, V Vorschlag. */
export function stufeZeichen(s: ZeilenStufe): string {
  switch (s.stufe) {
    case 'uebernommen':
      return '✓'
    case 'unterwegs':
      return '↑'
    case 'rueckfrage':
      return '!'
    case 'abgelehnt':
      return '✗'
    case 'vorschlag':
      return 'V'
  }
}

/**
 * Zellwerte einer Zeile als kurzer Text für Rückfragen und „Zuletzt“: „Einfahrt Tor 5: 1, 2x20 · Disq.: A“; leere
 * Felder fallen weg, ganz leer = `leer` („fehlerfrei“). Ohne Aufbau (Klasse unbekannt) nur die Werte.
 */
export function zellenText(zellen: Readonly<Record<string, string>>, aufbau: MaskenAufbau | null, t: WkrText, leer: string): string {
  const teile: string[] = []
  const titel = new Map<string, string>()
  for (const m of aufbau?.teile ?? []) titel.set(m.feld, m.titel.replace(/:\s*$/, ''))
  if (aufbau?.disq && !titel.has(aufbau.disq.feld)) titel.set(aufbau.disq.feld, t.w('wkr.geraet.disq'))
  if (aufbau?.bemerkung) titel.set(aufbau.bemerkung, t.w('wkr.geraet.bemerkung'))
  for (const [feld, wert] of Object.entries(zellen)) {
    if (!wert) continue
    const name = titel.get(feld)
    teile.push(name ? `${name}: ${feld === aufbau?.bemerkung ? `„${wert}“` : wert}` : wert)
  }
  return teile.length > 0 ? teile.join(' · ') : leer
}
