/**
 * Namen gekoppelter Geräte (Etappe E7; aus tafel lib/deviceName.ts, 16.11.2026 übernommen).
 *
 * Am Steg soll niemand ein Namensfeld ausfüllen müssen, während der nächste Starter wartet: Das Gerät schlägt etwas
 * vor („iPhone“), der Host macht den Namen eindeutig – nur er kennt alle Geräte. Der Name ist eine Beschriftung in der
 * Geräteliste, kein Ausweis: Wer was darf, hängt am Schlüssel (Register des Hosts).
 *
 * Der Vorschlag ist eine Art, kein Text: Die Oberfläche übersetzt ihn (`geraete.name.<art>`, de/en betrieb.ts) und
 * schickt den übersetzten Namen mit der Anmeldung.
 */

import type { GeraeteTyp } from './transport/protokoll'

export const GERAETE_ARTEN = ['iphone', 'ipad', 'android-handy', 'android-tablet', 'mac', 'windows', 'linux', 'geraet'] as const
export type GeraeteArt = (typeof GERAETE_ARTEN)[number]

/** Längster Gerätename (Protokoll: `hallo.name` ≤ 60 Zeichen). */
export const NAME_MAX = 40

/**
 * Art aus der Kennung des Browsers – bewusst grob: „iPhone“ oder „Android-Handy“ genügt, um in der Geräteliste das
 * Telefon zu erkennen. Neuere iPads melden sich als Mac; das klärt {@link geraeteArt} über die Touch-Punkte.
 */
export function artAusKennung(ua: string): GeraeteArt {
  if (/iPhone/i.test(ua)) return 'iphone'
  if (/iPad/i.test(ua)) return 'ipad'
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? 'android-handy' : 'android-tablet'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac'
  if (/Windows/i.test(ua)) return 'windows'
  if (/Linux|X11/i.test(ua)) return 'linux'
  return 'geraet'
}

/** Art dieses Geräts. Ein „Mac“ mit Mehrfinger-Bedienung ist ein iPad (seit iPadOS meldet es sich als Mac). */
export function geraeteArt(
  ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  touchPunkte: number = typeof navigator === 'undefined' ? 0 : (navigator.maxTouchPoints ?? 0),
): GeraeteArt {
  const art = artAusKennung(ua)
  return art === 'mac' && touchPunkte > 1 ? 'ipad' : art
}

/** Ein Name, wie ein Gerät ihn schicken darf: getrimmt, ohne Steuerzeichen, gekürzt. Leer → `ersatz`. */
export function saubererName(name: string, ersatz: string): string {
  const sauber = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, NAME_MAX).trim()
  return sauber || ersatz
}

/**
 * Macht einen Namen eindeutig mit einer angehängten Zahl: „iPhone“, „iPhone 2“, „iPhone 3“. Endet der Wunsch auf eine
 * Zahl, wird ab dort weitergezählt („Steg 2“ → „Steg 3“, nicht „Steg 2 2“); Lücken werden wieder benutzt. Groß- und
 * Kleinschreibung zählen nicht. `ersatz` gilt für einen leeren Wunsch (übersetzt, etwa „Gerät“).
 */
export function eindeutigerName(wunsch: string, vergeben: Iterable<string>, ersatz: string): string {
  const gewuenscht = saubererName(wunsch, ersatz)
  const belegt = new Set([...vergeben].map((n) => n.trim().toLowerCase()))
  if (!belegt.has(gewuenscht.toLowerCase())) return gewuenscht
  const treffer = /^(.*?)\s*(\d+)$/.exec(gewuenscht)
  const stamm = (treffer ? treffer[1] : gewuenscht).trim() || ersatz
  const ab = treffer ? Number(treffer[2]) + 1 : 2
  // Endlich: Mehr als tausend gleichnamige Geräte gibt es nicht; sonst bleibt der Name eben doppelt.
  for (let n = ab; n < ab + 1000; n++) {
    const kandidat = `${stamm} ${n}`
    if (!belegt.has(kandidat.toLowerCase())) return kandidat
  }
  return gewuenscht
}

/**
 * Art des Geräts für die Anmeldung (Nutzer 21.11.2026, W3-25, WKR_ANNAHMEN GF7, noch zu bestätigen): aus der kurzen
 * Seite des Bildschirms und dem Zeiger – Finger (`pointer: coarse`) und kurze Seite unter 600 px = Handy, Finger und
 * mehr = Pad, sonst (Maus) Rechner. Der Name des Browsers allein trügt (iPad meldet sich als Mac, umbenannte Geräte).
 */
export function typAus(kurzeSeite: number, finger: boolean): GeraeteTyp {
  if (!finger) return 'rechner'
  return kurzeSeite > 0 && kurzeSeite < 600 ? 'handy' : 'pad'
}

/** Art dieses Geräts (Browser); ohne Fenster „rechner“. */
export function dieserTyp(): GeraeteTyp {
  if (typeof window === 'undefined') return 'rechner'
  const s = window.screen
  const kurz = s ? Math.min(s.width || 0, s.height || 0) : 0
  const finger = typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)').matches : false
  return typAus(kurz, finger)
}
