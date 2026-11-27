import type { AppState, KeineZeitGrund, WkrStand } from '../types'
import { werteVon } from '../lib/eingaben'

// „Keine Zeit“ (W5.4, Plan docs/plan-wkr-w5.md §7, 22.11.2026, WKR_ANNAHMEN ZT4 – bestätigt 22.11.2026, R8-36): das Kennzeichen
// je Zeitfeld im Stand (WkrStand.keineZeit) lesen, schreiben, aufheben und beim Laden prüfen – rein, ohne DOM, ohne
// Store, nichts aus geraete/. EINE Stelle, damit Reducer, lage.ts (Matrix, „Papier ansehen“) und migrate gleich lesen.
// Warum ein eigenes Kennzeichen und kein Wert in der Zelle: Die Zelle einer Zeit nimmt nur Lesbares (wkr/zeile.ts
// wertGilt = parseTime), und die Wertung soll eine fehlende Zeit wie bisher als fehlend sehen – der Grund ist nur ein
// Hinweis für den Bedienrechner, auf dem Bogen nachzusehen.

/** Die Gründe in der Folge der Knöpfe auf dem Gerät. */
export const KEINE_ZEIT_GRUENDE: readonly KeineZeitGrund[] = ['anlage', 'nichtImZiel', 'anderes']

export const istKeineZeitGrund = (x: unknown): x is KeineZeitGrund => typeof x === 'string' && (KEINE_ZEIT_GRUENDE as readonly string[]).includes(x)

/**
 * Schlüssel einer Zelle: `${lauf}|${starter}`. Bis 24.11.2026 teilte er sich die Form mit dem Kennzeichen „nicht
 * vorbeigekommen“ (wkr/nichtVorbei.ts, entfallen – WKR_ANNAHMEN NG6); Zeitlisten sind nie geteilt, also ohne Teil.
 */
export function kzSchluessel(lauf: string, starter: string): string {
  return `${lauf}|${starter}`
}

/** Lauf und Starter eines Schlüssels; `null`, wenn er nicht von {@link kzSchluessel} stammen kann. */
function liesKzSchluessel(k: unknown): { lauf: string; starter: string } | null {
  if (typeof k !== 'string') return null
  const teile = k.split('|')
  // Lauf-Schlüssel und Starter-IDs enthalten kein „|“ (lib/eingaben.ts gueltigeZellen prüft den Lauf beim Laden).
  if (teile.length !== 2 || teile[0] === '' || teile[1] === '') return null
  return { lauf: teile[0], starter: teile[1] }
}

/** Das Kennzeichen eines Starts auf einer Liste: je Zeitfeld der Grund (leer = keins). */
export function keineZeitVon(wkr: WkrStand, liste: string, lauf: string, starter: string): Readonly<Record<string, KeineZeitGrund>> {
  const jeListe = Object.hasOwn(wkr.keineZeit, liste) ? wkr.keineZeit[liste] : undefined
  const k = kzSchluessel(lauf, starter)
  return (jeListe && Object.hasOwn(jeListe, k) ? jeListe[k] : undefined) ?? {}
}

/**
 * Setzt das Kennzeichen eines Starts (ersetzt es ganz – die Zeile trägt immer alle Zeitfelder, ZT3); `{}` hebt es auf.
 * Unverändert = dasselbe Objekt.
 */
export function mitKeineZeit(kz: WkrStand['keineZeit'], liste: string, lauf: string, starter: string, felder: Readonly<Record<string, KeineZeitGrund>>): WkrStand['keineZeit'] {
  const k = kzSchluessel(lauf, starter)
  const jeListe = Object.hasOwn(kz, liste) ? kz[liste] : {}
  const alt = Object.hasOwn(jeListe, k) ? jeListe[k] : {}
  if (gleich(alt, felder)) return kz
  const neuListe = { ...jeListe }
  if (Object.keys(felder).length > 0) neuListe[k] = { ...felder }
  else delete neuListe[k]
  if (Object.keys(neuListe).length > 0) return { ...kz, [liste]: neuListe }
  const { [liste]: _weg, ...rest } = kz
  return rest
}

function gleich(a: Readonly<Record<string, string>>, b: Readonly<Record<string, string>>): boolean {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((f) => a[f] === b[f])
}

/** Nur die Kennzeichen, deren Zelle `bleibt`; unverändert = dasselbe Objekt (Löschen von Läufen bzw. Startern). */
export function keineZeitNur(kz: WkrStand['keineZeit'], bleibt: (z: { lauf: string; starter: string }) => boolean): WkrStand['keineZeit'] {
  let geaendert = false
  const out: WkrStand['keineZeit'] = {}
  for (const [liste, jeZelle] of Object.entries(kz)) {
    const rest = Object.entries(jeZelle).filter(([k]) => {
      const z = liesKzSchluessel(k)
      return !!z && bleibt(z)
    })
    if (rest.length !== Object.keys(jeZelle).length) geaendert = true
    if (rest.length > 0) out[liste] = Object.fromEntries(rest)
  }
  return geaendert ? out : kz
}

/**
 * Hebt „keine Zeit“ für jedes Feld auf, das inzwischen einen Wert hat (abgetippt, Rückfrage für das Gerät, spätere
 * Zeile mit Zeit): Die Zeit ist dann doch da. Ohne Kennzeichen oder unverändert: derselbe Stand.
 */
export function ohneUeberholteKeineZeit(stand: AppState): AppState {
  const kz = stand.wkr.keineZeit
  if (Object.keys(kz).length === 0) return stand
  let out = kz
  for (const [liste, jeZelle] of Object.entries(kz)) {
    for (const [k, felder] of Object.entries(jeZelle)) {
      const z = liesKzSchluessel(k)
      if (!z) continue
      const werte = werteVon(stand.eingaben, z.lauf, z.starter)
      const rest = Object.fromEntries(Object.entries(felder).filter(([f]) => !werte[f]))
      if (Object.keys(rest).length !== Object.keys(felder).length) out = mitKeineZeit(out, liste, z.lauf, z.starter, rest)
    }
  }
  return out === kz ? stand : { ...stand, wkr: { ...stand.wkr, keineZeit: out } }
}

/**
 * Beim Laden (migrate über state/reducer/wkr.ts normalisiereWkr): je lesbarer Liste (`listeGilt`) die lesbaren
 * Schlüssel gültiger Zellen (`zelleGilt`, ohne Teil – Zeitlisten sind nie geteilt) mit bekannten Gründen; Kaputtes
 * fällt einzeln.
 */
export function normalisiereKeineZeit(raw: unknown, listeGilt: (k: string) => boolean, zelleGilt: (lauf: string, starter: string) => boolean): WkrStand['keineZeit'] {
  if (!istObj(raw)) return {}
  const out: WkrStand['keineZeit'] = {}
  for (const [liste, jeZelle] of Object.entries(raw)) {
    if (!listeGilt(liste) || !istObj(jeZelle)) continue
    const zellen: Record<string, Record<string, KeineZeitGrund>> = {}
    for (const [k, felder] of Object.entries(jeZelle)) {
      const z = liesKzSchluessel(k)
      if (!z || !zelleGilt(z.lauf, z.starter) || !istObj(felder)) continue
      const gut = Object.entries(felder).filter((e): e is [string, KeineZeitGrund] => e[0] !== '' && istKeineZeitGrund(e[1]))
      if (gut.length > 0) zellen[k] = Object.fromEntries(gut)
    }
    if (Object.keys(zellen).length > 0) out[liste] = zellen
  }
  return out
}

/** „Keine Zeit“ einer Rückfrage bzw. eines Vorschlags beim Laden: nur bekannte Gründe, sonst fällt es weg. */
export function liesKeineZeitFelder(raw: unknown): Record<string, KeineZeitGrund> | undefined {
  if (!istObj(raw)) return undefined
  return Object.fromEntries(Object.entries(raw).filter((e): e is [string, KeineZeitGrund] => e[0] !== '' && istKeineZeitGrund(e[1])))
}

const istObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
