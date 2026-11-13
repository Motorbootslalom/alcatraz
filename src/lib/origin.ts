import type { OriginMode, OriginStyle, Starter } from '../types'
import { kuerzelOf } from '../domain/kuerzel'
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

/**
 * Herkunft für eine Liste: als Kürzel, wenn das gewünscht ist und es eines gibt,
 * sonst der ausgeschriebene Name.
 */
export function originText(p: Starter, mode: OriginMode, style: OriginStyle, own: Record<string, string>): string {
  const name = originOf(p, mode)
  return (style === 'kurz' && name && kuerzelOf(name, own)) || name
}
