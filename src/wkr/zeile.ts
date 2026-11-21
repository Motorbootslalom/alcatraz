import type { AppState, WkrZeile } from '../types'
import type { Konfig } from '../config/konfig'
import { betriebVon, lage, liesRef } from '../betrieb/folge'
import { erfasstKennung, listenFelder, type Feld, type ListenTeil } from '../lib/eingaben'
import { bojenWert, codeDisqs, disqCodes } from '../lib/scoring'
import { NICHT_GESTARTET } from '../lib/abmeldung'
import { parseTime } from '../lib/time'
import { WKR_ANNAHMEN } from './annahmen'
import { listenKennung, startAufListe, teileVon, teilHaken, teilVonZelle, type Liste } from './liste'
import { naechsteFreie } from './schlange'

// Eine Zeile vom WKR-Gerät und ihre Prüfung am Bedienrechner – rein, ohne DOM, ohne Store, nichts aus geraete/
// (Plan §3.1). Das Gerät schickt je Start eine Zeile mit kurzen Schlüsseln; `pruefeZeile` prüft sie wie die
// Erfassungstabelle eine Eingabe (dieselben Sanierer, components/erfassung/ErfassungTabelle.vue) und löst sie auf das
// auf, was der Reducer übernimmt (types/wkr.ts WkrZeile). Ein Wert gilt nur, wenn die Sanierung ihn NICHT ändert:
// Das Gerät rechnet nichts, der Bedienrechner verbessert nichts still.

export type { WkrZeile }

/** So schickt das Gerät eine Zeile (kurze Schlüssel, Leitung). */
export interface GeraeteZeile {
  /** Fortlaufende Nummer der Zeile auf dem Gerät (ab 1). */
  z: number
  /** Kennung des Starts (`refKey`). */
  s: string
  /** Teil der Liste (Steg: Ablegen/Anlegen), wenn das Gerät nur diesen schickt. */
  t?: ListenTeil
  /** Korrektur einer schon geschickten Zeile. */
  k?: true
  /** Im Parallelslalom die Seite, die das Gerät erfasst (zur Gegenprobe). */
  seite?: 'A' | 'B'
  /** Zellen: Feld-Kennung, neuer Wert, erwarteter Wert (`vorher`, beim ersten Abschicken leer). */
  c: [feld: string, wert: string, vorher: string][]
  /**
   * „Nicht vorbeigekommen“ (W4.3, 21.11.2026, P16, löst G15 ein): Das Boot kam an diesem Platz nicht vorbei (vorher
   * aufgegeben, Abbruch). Nur mit leerem `c` – die Zeile trägt keinen Wert, nur Haken und Kennzeichen; nicht am Vorsteg
   * und nicht im Steg-Ablegen (dort ist es X, F5).
   */
  n?: true
}

/**
 * Warum eine Zeile abgelehnt wird (Codes, nie Texte – geraete/ gibt sie als Ablehnung zurück):
 * - `start-unbekannt`: Kennung unlesbar, Start nicht im Bereich der Liste, eigene Seite leer, Starter gelöscht.
 * - `feld-fremd`: Feld steht nicht auf dieser Liste für die Klasse (oder doppelt), Klasse hat die Liste nicht.
 * - `wert-ungueltig`: Wert, den die Erfassungstabelle so nicht stehen ließe; kaputte Form der Zeile.
 * - `x-nicht-erlaubt`: X „nicht gestartet“ außerhalb von Steg-Ablegen und Vorsteg (F5).
 * - `teil-fremd`: Teil passt nicht zur Liste oder zur Kopplung; Feld eines anderen Teils.
 * - `seite-anders`: Im Parallelslalom eine andere Seite als die der Liste.
 * - `nv-nicht-erlaubt`: „Nicht vorbeigekommen“ am Vorsteg oder im Steg-Ablegen (dort gibt es X, F5) – W4.3, P16.
 */
export type ZeilenFehler = 'start-unbekannt' | 'feld-fremd' | 'wert-ungueltig' | 'x-nicht-erlaubt' | 'teil-fremd' | 'seite-anders' | 'nv-nicht-erlaubt'

const istText = (x: unknown): x is string => typeof x === 'string'
const istTeil = (x: unknown): x is ListenTeil => x === 'ab' || x === 'an'

/** Hat die Zeile die Form einer GeraeteZeile (sie kommt von außen)? */
function formOk(zeile: unknown): zeile is GeraeteZeile {
  if (!zeile || typeof zeile !== 'object') return false
  const z = zeile as Record<string, unknown>
  if (typeof z.z !== 'number' || !Number.isSafeInteger(z.z) || z.z < 1 || !istText(z.s)) return false
  if (z.t !== undefined && !istTeil(z.t)) return false
  if (z.k !== undefined && z.k !== true) return false
  if (z.seite !== undefined && z.seite !== 'A' && z.seite !== 'B') return false
  // „Nicht vorbeigekommen“ nur ohne Zellen (W4.3): ein Wert dabei hieße doch vorbei – widersprüchlich, nicht raten.
  if (z.n !== undefined && (z.n !== true || !Array.isArray(z.c) || z.c.length > 0)) return false
  return Array.isArray(z.c) && z.c.every((c) => Array.isArray(c) && c.length === 3 && c.every(istText))
}

/**
 * Gilt der Wert so, wie er ist? Dieselben Sanierer wie die Erfassungstabelle: Boje, Fehlercode, Disq über
 * `Feld.gueltig` (sanitizeBuoy, normalizeCodeCell, sanitizeDisq mit den Buchstaben der Klasse), Punkte nur Ziffern,
 * Zeit lesbar (parseTime), Text getrimmt und höchstens WKR_ANNAHMEN.textMax Zeichen. Leer gilt immer (Zelle leeren).
 */
export function wertGilt(feld: Feld, wert: string): boolean {
  if (wert === '') return true
  if (wert.length > WKR_ANNAHMEN.textMax) return false
  switch (feld.kind) {
    case 'buoy':
    case 'code':
    case 'disq':
      return feld.gueltig(wert) === wert
    case 'points':
      return /^\d+$/.test(wert)
    case 'time':
      return wert === wert.trim() && parseTime(wert) !== null
    case 'text':
      return wert === wert.trim()
    default:
      return false
  }
}

/** Enthält der Wert eines Felds ein X „nicht gestartet“? */
function hatX(feld: Feld, wert: string): boolean {
  if (feld.kind === 'buoy') return bojenWert(wert).disq === NICHT_GESTARTET
  if (feld.kind === 'code') return codeDisqs(wert).includes(NICHT_GESTARTET)
  if (feld.kind === 'disq') return disqCodes(wert).includes(NICHT_GESTARTET)
  return false
}

/**
 * Prüft eine Zeile eines Geräts für eine Liste (gekoppelt mit `teil`, Steg F16) und löst sie auf. Prüft: Form,
 * Kennung des Starts und dass er im Bereich vorkommt (Folge oder gezeigt), die eigene Seite im Parallelslalom
 * (`seite-anders`), Klasse hat die Liste, jedes Feld gehört zur Liste (am Steg nur Felder des eigenen Teils plus
 * gemeinsame), jeder Wert unverändert gültig, X nur Steg-Ablegen/Vorsteg. Löst auf: Lauf-Schlüssel (Vorsteg mit
 * „Versuche nacheinander“: alle Versuche), Haken bzw. Teilhaken, `vereinige` für die gemeinsamen Zellen des Stegs
 * (Disq., Bemerkung), `gezeigt` (am Vorsteg auch die nächsten freien).
 */
export function pruefeZeile(stand: AppState, konfig: Konfig, liste: Liste, teil: ListenTeil | undefined, geraetId: string, zeile: unknown): WkrZeile | { fehler: ZeilenFehler } {
  if (!formOk(zeile)) return { fehler: 'wert-ungueltig' }
  const teile = teileVon(liste.typeId)
  // Der Teil der Zeile: was die Kopplung vorgibt; ein Gerät für den ganzen Steg darf je Teil schicken.
  if ((teil !== undefined || zeile.t !== undefined) && !teile) return { fehler: 'teil-fremd' }
  if (teil !== undefined && zeile.t !== undefined && zeile.t !== teil) return { fehler: 'teil-fremd' }
  const eigenerTeil = zeile.t ?? teil
  // „Nicht vorbeigekommen“ (W4.3, WKR_ANNAHMEN.nichtVorbeiNichtBeiX): Wo X erlaubt ist (Vorsteg, Steg-Ablegen, F5),
  // kommt jedes Boot vorbei oder startet nicht – dort ist es X. Ein Gerät für den ganzen Steg schickt es nur mit Teil `an`.
  const xHier = WKR_ANNAHMEN.xListen.includes(liste.typeId) && (!teile || eigenerTeil === undefined || eigenerTeil === WKR_ANNAHMEN.xTeil)
  if (zeile.n && xHier) return { fehler: 'nv-nicht-erlaubt' }

  if (zeile.seite !== undefined && zeile.seite !== liste.racecourse) return { fehler: 'seite-anders' }
  const ref = liesRef(zeile.s)
  if (!ref) return { fehler: 'start-unbekannt' }
  // Nur Starts, die es im Bereich gibt: in der Folge des Betriebs oder schon gezeigt.
  const l = lage(stand, liste.bereich)
  if (!l.gezeigtKeys.has(zeile.s) && !l.folge.some((e) => e.key === zeile.s)) return { fehler: 'start-unbekannt' }
  const start = startAufListe(stand, konfig, liste, ref)
  if (!start) return { fehler: 'start-unbekannt' }
  const klasse = start.starter.klasse
  if (!konfig.positionAllowsClass(liste.typeId, klasse)) return { fehler: 'feld-fremd' }

  const felder = new Map(listenFelder(konfig, liste.typeId, klasse).map((f) => [f.kennung, f]))
  const zellen: WkrZeile['zellen'] = []
  const gesehen = new Set<string>()
  for (const [kennung, wert, vorher] of zeile.c) {
    const feld = felder.get(kennung)
    if (!feld || gesehen.has(kennung)) return { fehler: 'feld-fremd' }
    gesehen.add(kennung)
    const teilDerZelle = teilVonZelle(liste.typeId, feld.zelle)
    if (eigenerTeil !== undefined && teilDerZelle !== eigenerTeil && teilDerZelle !== 'gemeinsam') return { fehler: 'teil-fremd' }
    if (!wertGilt(feld, wert) || vorher.length > WKR_ANNAHMEN.textMax) return { fehler: 'wert-ungueltig' }
    if (hatX(feld, wert)) {
      const xListe = WKR_ANNAHMEN.xListen.includes(liste.typeId)
      // Am Steg nur im Teil Ablegen – auch ein Gerät für den ganzen Steg nicht in der Spalte des Anlegens.
      const xTeil = !teile || ((eigenerTeil === undefined || eigenerTeil === WKR_ANNAHMEN.xTeil) && (teilDerZelle === 'gemeinsam' || teilDerZelle === WKR_ANNAHMEN.xTeil))
      if (!xListe || !xTeil) return { fehler: 'x-nicht-erlaubt' }
    }
    zellen.push({ feld: kennung, wert, vorher, ...(teilDerZelle === 'gemeinsam' ? { vereinige: true as const } : {}) })
  }

  return {
    id: `${geraetId}.${zeile.z}`,
    liste: listenKennung(liste),
    ref: zeile.s,
    lauf: start.lauf,
    weitere: start.weitere,
    starter: start.starter.id,
    zellen,
    ...(eigenerTeil !== undefined ? { teil: eigenerTeil } : {}),
    haken: [eigenerTeil === undefined ? erfasstKennung(liste.typeId) : teilHaken(liste.typeId, eigenerTeil)],
    gezeigt: istGezeigt(stand, liste, zeile.s, start.starter.id, start.weitere.length > 0),
    korrektur: zeile.k === true,
    ...(zeile.n ? { nichtVorbei: true as const } : {}),
  }
}

/**
 * Ist der Start im Betrieb gezeigt? Am Vorsteg (WKR_ANNAHMEN.vorabListen) zählen auch die nächsten freien, und gilt
 * die Zeile für jeden Versuch (`einmal`), auch ein anderer Versuch desselben Starters.
 */
function istGezeigt(stand: AppState, liste: Liste, key: string, starter: string, einmal: boolean): boolean {
  const gezeigt = betriebVon(stand, liste.bereich).gezeigt.map((g) => g.ref)
  if (gezeigt.includes(key)) return true
  if (!WKR_ANNAHMEN.vorabListen.includes(liste.typeId)) return false
  const kandidaten = [...gezeigt, ...naechsteFreie(stand, liste.bereich).map((e) => e.key)]
  if (kandidaten.includes(key)) return true
  if (!einmal) return false
  return kandidaten.some((k) => {
    const r = liesRef(k)
    return r?.art === 'm' && r.starter === starter
  })
}
