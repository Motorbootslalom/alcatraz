import type { OriginMode, OriginStyle, Starter } from '../types'
import { kuerzelOf } from '../domain/kuerzel'
import type { MessageKey } from '../i18n'

/** Herkunft eines Starters in der gewählten Darstellung; leer bei `none`. */
export function originOf(p: Starter, mode: OriginMode): string {
  if (mode === 'none') return ''
  return mode === 'bundesland' ? p.bundesland : p.verein || p.bundesland
}

/** Spaltenüberschrift der Herkunft als Katalogschlüssel. */
export function originLabelKey(mode: OriginMode): MessageKey {
  return mode === 'bundesland' ? 'common.state' : 'common.club'
}

/**
 * Herkunft für eine Liste: als Kürzel, wenn das gewünscht ist und es eines gibt,
 * sonst der ausgeschriebene Name.
 */
export function originText(p: Starter, mode: OriginMode, style: OriginStyle, own: Record<string, string>): string {
  const name = originOf(p, mode)
  return (style === 'kurz' && name && kuerzelOf(name, own)) || name
}
