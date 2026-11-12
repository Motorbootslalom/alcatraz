import type { AppState } from '../types'
import { fromVerzahnungPrototyp, migrate } from '../state/migrate'

/**
 * Der Zustand liegt ausschließlich im localStorage dieses Browsers. Es gibt
 * keinen Server und keine Anmeldung.
 */
export const STATE_KEY = 'alcatraz:state:v1'

/** Schlüssel des Verzahnungs-Prototyps – liegt auf GitHub Pages in derselben Origin. */
const LEGACY_VERZAHNUNG_KEY = 'verzahnung-prototyp:v1'

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function loadState(): AppState | null {
  return migrate(readJson(STATE_KEY))
}

/** Liefert `false`, wenn nicht gespeichert werden konnte (Speicher voll oder gesperrt). */
export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

/** Stand aus dem Verzahnungs-Prototyp in diesem Browser, falls vorhanden. */
export function loadLegacyVerzahnung(): AppState | null {
  return fromVerzahnungPrototyp(readJson(LEGACY_VERZAHNUNG_KEY))
}
