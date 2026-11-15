import type { AppState } from '../types'
import { fromVerzahnungPrototyp, migrate } from '../state/migrate'
import { locale } from '../i18n'
import type { Speichermarke } from '../lib/verlauf'

/**
 * Der Zustand liegt ausschließlich in diesem Browser: im localStorage und – als zweiter Speicher
 * mit Verlauf – in einer IndexedDB (persistenz/zweitspeicher.ts). Es gibt keinen Server und
 * keine Anmeldung.
 */
export const STATE_KEY = 'alcatraz:state:v1'
/**
 * Merker: „Alles zurücksetzen“ konnte den Verlauf im zweiten Speicher nicht leeren (der
 * Schreibvorgang ist gescheitert). Solange er liegt, holt state/zweit.ts das Leeren nach –
 * auch nach einem Neuladen. Enthält nichts über die Veranstaltung.
 */
export const VERLAUF_LEEREN_KEY = 'alcatraz:verlauf-leeren'

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
  return liesGespeichert().state
}

/** Aus dem Text eines gespeicherten Stands den Stand; `null`, wenn er nicht zu lesen ist. */
export function standAus(json: string | null): AppState | null {
  if (!json) return null
  try {
    // Die Sprache der Oberfläche nur für alte Stände, deren Bögen ihr folgten (state/migrate.ts).
    return migrate(JSON.parse(json), { oberflaeche: locale.value })
  } catch {
    return null
  }
}

/**
 * Die Speichermarke im Text eines gespeicherten Stands. Sie steht am Anfang
 * ({@link serialisiere}) und wird von dort gelesen, ohne den ganzen Stand zu zerlegen – das
 * `storage`-Ereignis eines anderen Fensters fragt bei jeder Änderung danach.
 */
export function markeAus(json: string | null): Speichermarke | null {
  const treffer = json ? /^\{"gespeichert":\{"folge":(\d+),"zeit":(\d+)\}/.exec(json) : null
  return treffer ? { folge: Number(treffer[1]), zeit: Number(treffer[2]) } : null
}

/**
 * Der Stand als Text, wie er in beiden Speichern liegt. Die Speichermarke reist IM Text mit:
 * So gehören Stand und Marke immer zusammen, auch wenn der Browser mitten im Schreiben abbricht
 * (zwei getrennte Schlüssel könnten auseinanderlaufen). `migrate` nimmt sie beim Laden wieder
 * heraus – sie gehört nicht zum Stand und nie in eine Datei.
 */
export function serialisiere(state: AppState, marke: Speichermarke): string {
  return JSON.stringify({ gespeichert: { folge: marke.folge, zeit: marke.zeit }, ...state })
}

/** Was im localStorage liegt: der Text, die Marke darin (fehlt bei Ständen vor dem zweiten Speicher) und der Stand. */
export function liesGespeichert(): { json: string | null; marke: Speichermarke | null; state: AppState | null } {
  let json: string | null = null
  try {
    json = localStorage.getItem(STATE_KEY)
  } catch {
    // Gesperrter Speicher: wie leer.
  }
  return { json, marke: markeAus(json), state: standAus(json) }
}

/** Speichert einen Stand ohne Speichermarke (wie vor dem zweiten Speicher); der Store schreibt mit {@link schreibeText}. */
export function saveState(state: AppState): boolean {
  return schreibeText(JSON.stringify(state))
}

/** Liefert `false`, wenn nicht gespeichert werden konnte (Speicher voll oder gesperrt). */
export function schreibeText(json: string): boolean {
  try {
    localStorage.setItem(STATE_KEY, json)
    return true
  } catch {
    return false
  }
}

/** Stand aus dem Verzahnungs-Prototyp in diesem Browser, falls vorhanden. */
export function loadLegacyVerzahnung(): AppState | null {
  return fromVerzahnungPrototyp(readJson(LEGACY_VERZAHNUNG_KEY), { oberflaeche: locale.value })
}
