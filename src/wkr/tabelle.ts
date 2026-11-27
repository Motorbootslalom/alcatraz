import type { ClassId, KeineZeitGrund } from '../types'
import { codeEntries, codesUeberMax, normalizeCodeCell, parseCodeEntry } from '../lib/codes'
import { sanitizeBuoy, sanitizeCodeInput, sanitizeDisq } from '../lib/disq'
import { bojenWert } from '../lib/scoring'
import { sanitizeTimeInput } from '../lib/time'
import { WKR_ANNAHMEN } from './annahmen'
import type { ListenTeil } from './liste'
import { bojenVon, disqFuer, entwurfAus, leererEntwurf, zeitDeutung, zellenAus, type Entwurf, type MaskenAufbau } from './maske'
import type { ListenSicht } from './sicht'

// Maske „Tabelle“ für Geübte (W5.5, Plan docs/plan-wkr-w5.md §8, 22.11.2026, TB1–TB4 bestätigt 22.11.2026, R8-38 bis R8-41) – rein, ohne
// DOM, nichts aus geraete/. Die Zeile des Bogens zum Eintippen: Spalten in Reihenfolge und mit den Köpfen wie der Bogen
// der Klasse (aus der Sicht), jede Eingabe geht durch DIESELBEN Sanierer wie die Erfassungstabelle am Rechner
// (lib/disq.ts, lib/codes.ts, lib/time.ts – wkr/zeile.ts wertGilt nimmt das Ergebnis unverändert an). Was die Sanierer
// still wegließen oder was der Entwurf der Maske nicht so tragen kann, wird nicht verbessert, sondern als Fehler je
// Zelle (Code) gemeldet – das Gerät rechnet nichts, was der Bedienrechner anders sähe. Abgeschickt wird über denselben
// Entwurf wie bei den Knöpfen (wkr/maske.ts entwurfAus → zellenAus): eine Leitung, ein Weg.

/** Art einer Spalte – bestimmt den Sanierer (wie ErfassungTabelle.vue onInput/onBlur). */
export type SpaltenArt = 'boje' | 'code' | 'disq' | 'zeit' | 'text'

export interface TabellenSpalte {
  /** Feld-Kennung (wie in der Zeile `c`). */
  feld: string
  art: SpaltenArt
  /** Kopf der Spalte wie auf dem Bogen („Tor 1“, „Fehler“, „Disq.“). */
  titel: string
  /** Kopf der Unterspalte („H L“), '' ohne. */
  unter: string
  /** Steg-Teil des Felds; fehlt bei gemeinsamen Spalten und ungeteilten Listen. */
  teil?: ListenTeil
}

/**
 * Warum eine Zelle so nicht gilt (Codes, Texte `wkr.geraet.tabelle.fehler.*`):
 * - `zeichen-fremd`: ein Zeichen bzw. Buchstabe, den diese Zelle nicht annimmt (der Sanierer ließe ihn still weg).
 * - `code-unbekannt`: eine Zahl, die auf dieser Liste kein Fehlercode ist.
 * - `boje-punkte`: Punkte, die keine Berührungen sind (nicht durch die Punkte je Berührung teilbar, zu viele).
 * - `zeit-unlesbar`: die Zeit liest lib/time.ts parseTime nicht.
 * - `zu-lang`: länger als WKR_ANNAHMEN.textMax.
 * - `nicht-darstellbar`: einzeln gültig, aber die Zeile als Ganzes ergäbe einen anderen Wert (z. B. ein
 *   Disq.-Buchstabe im Code-Feld, wo die Liste ein eigenes Disq.-Feld hat, oder derselbe Buchstabe zweimal).
 * - `code-zu-oft` (Nutzer 24.11.2026, WKR_ANNAHMEN CM5): ein Code öfter als sein `max` („2x1“ an Tor 5).
 * - `code-danach`: ebenso, aber der Code hat einen Buchstaben danach („3x20“ – der 4. Versuch ist Disq. D); die Tabelle
 *   wandelt nicht um, den Buchstaben trägt der WKR unter „Disq.“ ein (TB3: nichts still verbessern).
 */
export type TabellenFehler = 'zeichen-fremd' | 'code-unbekannt' | 'boje-punkte' | 'zeit-unlesbar' | 'zu-lang' | 'nicht-darstellbar' | 'code-zu-oft' | 'code-danach'

export interface TabellenZelle {
  /** Der Wert nach dem Sanierer – so ginge er hinaus. */
  wert: string
  fehler: TabellenFehler | null
}

/** Feldarten der Sicht → Spaltenart; was die Tabelle nicht kennt (Punkte, Summen), fällt weg. */
const ART: Partial<Record<string, SpaltenArt>> = { buoy: 'boje', code: 'code', disq: 'disq', time: 'zeit', text: 'text' }

/**
 * Die Spalten der Zeile einer Klasse (TB3): Reihenfolge und Köpfe wie der Bogen (MaskenFeld in der Folge der Sicht =
 * Spalten des Bogens), Texte der gewählten Sprache (`andere`, F13). Nur Felder, die die Maske dieses Teils trägt (am
 * Steg die eigenen plus die gemeinsamen) – so schickt die Tabelle nie ein Feld, das die Knöpfe nicht auch schicken.
 */
export function tabellenSpalten(sicht: ListenSicht, klasse: ClassId, aufbau: MaskenAufbau, teil: ListenTeil | undefined, sprache: 'liste' | 'andere' = 'liste'): TabellenSpalte[] {
  const felder = sicht.klassen[klasse]?.felder
  if (!felder) return []
  const traegt = new Set(Object.keys(zellenAus(leererEntwurf(), aufbau, teil)))
  const andere = new Map((sprache === 'andere' ? (sicht.andere?.klassen[klasse]?.felder ?? []) : []).map((f) => [f.kennung, f]))
  const out: TabellenSpalte[] = []
  for (const f of felder) {
    const art = ART[f.kind]
    if (!art || !traegt.has(f.kennung)) continue
    const a = andere.get(f.kennung)
    const titel = f.boje ? (a?.boje?.titel ?? f.boje.titel) : (a?.label ?? f.label)
    const unter = f.boje ? (a?.boje?.unter ?? f.boje.unter) : ''
    out.push({ feld: f.kennung, art, titel: titel.replace(/:\s*$/, ''), unter, ...(f.teil ? { teil: f.teil } : {}) })
  }
  return out
}

/** Köpfe für eine zweizeilige Kopfzeile wie auf dem Bogen: gleiche Titel nebeneinander zusammengefasst. */
export function kopfGruppen(spalten: readonly TabellenSpalte[]): { titel: string; breite: number; mitUnter: boolean }[] {
  const out: { titel: string; breite: number; mitUnter: boolean }[] = []
  for (const s of spalten) {
    const letzte = out.at(-1)
    if (letzte && letzte.titel === s.titel && letzte.mitUnter && s.unter !== '') letzte.breite++
    else out.push({ titel: s.titel, breite: 1, mitUnter: s.unter !== '' })
  }
  return out
}

/** Buchstaben, die eine Zelle annimmt – aus dem Aufbau (dieselben wie bei den Knöpfen, X nur wo F5 es erlaubt). */
function buchstabenVon(spalte: TabellenSpalte, aufbau: MaskenAufbau, teil: ListenTeil | undefined): Set<string> {
  if (spalte.art === 'boje') return new Set(bojenVon(aufbau).find((b) => b.feld === spalte.feld)?.disq.map((d) => d.code) ?? [])
  if (spalte.art === 'code') return new Set(aufbau.teile.find((t) => t.feld === spalte.feld)?.buchstaben ?? [])
  if (spalte.art === 'disq') return new Set(disqFuer(aufbau, teil).map((d) => d.code))
  return new Set()
}

/** Kommt in der Eingabe ein Buchstabe vor, den die Zelle nicht kennt (abgesehen von Trennern und Ziffern)? */
const fremd = (eingabe: string, erlaubt: Set<string>, auch = /[\s,;/]/) => [...eingabe.toUpperCase()].some((c) => !/\d/.test(c) && !auch.test(c) && !erlaubt.has(c))

/**
 * Eine Eingabe → Zellwert (TB3: dieselben Sanierer wie ErfassungTabelle). Leer gilt immer (Zelle leeren). Der Wert ist
 * stets das, was der Sanierer daraus macht; `fehler` sagt, wenn dabei etwas verloren ginge oder er so nicht gilt.
 */
export function zelleAusEingabe(spalte: TabellenSpalte, eingabe: string, aufbau: MaskenAufbau, teil?: ListenTeil): TabellenZelle {
  const roh = eingabe.trim()
  if (roh === '') return { wert: '', fehler: null }
  if (roh.length > WKR_ANNAHMEN.textMax) return { wert: roh.slice(0, WKR_ANNAHMEN.textMax).trim(), fehler: 'zu-lang' }
  switch (spalte.art) {
    case 'boje': {
      const erlaubt = buchstabenVon(spalte, aufbau, teil)
      const wert = sanitizeBuoy(roh, erlaubt)
      // Mehrere Buchstaben seit R7-14 (22.11.2026, BZ6): Fehler nur für einen Buchstaben, den die Zelle nicht kennt
      // (sanitizeBuoy ließe ihn still weg); doppelte fallen still weg, die Folge richtet sanitizeBuoy (Katalogfolge).
      if (fremd(roh, erlaubt)) return { wert, fehler: 'zeichen-fremd' }
      const boje = bojenVon(aufbau).find((b) => b.feld === spalte.feld)
      const { punkte } = bojenWert(wert)
      // Bojen als Zahl der Punkte (TB4): ein Vielfaches der Punkte je Berührung (nicht 0 – leer heißt fehlerfrei),
      // Schalter höchstens eine, Zähler bis zum Höchststand. Die Schreibweise („j5d“ → „5, J, D“) richtet sanitizeBuoy.
      if (/\d/.test(roh) && (!boje || punkte === 0 || punkte % boje.punkte !== 0 || punkte / boje.punkte > (boje.zaehler ? WKR_ANNAHMEN.bojenZaehlerMax : 1))) {
        return { wert, fehler: 'boje-punkte' }
      }
      return { wert, fehler: null }
    }
    case 'code': {
      const t = aufbau.teile.find((x) => x.feld === spalte.feld)
      const codes = new Set(t?.codes.map((c) => c.code) ?? [])
      const erlaubt = buchstabenVon(spalte, aufbau, teil)
      const vorher = sanitizeCodeInput(roh)
      const wert = normalizeCodeCell(vorher, codes, erlaubt)
      // Wie ErfassungTabelle onBlur „verworfen“: unbekannte Zahlen bzw. Buchstaben – hier ein Fehler statt einer Meldung.
      for (const eintrag of codeEntries(vorher)) {
        const code = parseCodeEntry(eintrag)
        if (code ? !codes.has(code.code) || code.anzahl < 1 : ![...eintrag.toUpperCase()].every((b) => erlaubt.has(b))) {
          return { wert, fehler: code ? 'code-unbekannt' : 'zeichen-fremd' }
        }
      }
      if (vorher !== roh.replace(/×/g, 'x').toUpperCase().replace(/(\d)X(\d)/g, '$1x$2')) return { wert, fehler: 'zeichen-fremd' }
      // Höchstzahl je Code (CM5): dieselbe Grenze wie die Knöpfe und wertGilt am Bedienrechner.
      const zuOft = codesUeberMax(wert, t?.codes ?? [])
      if (zuOft.length > 0) return { wert, fehler: zuOft.some((z) => z.danach !== undefined) ? 'code-danach' : 'code-zu-oft' }
      return { wert, fehler: null }
    }
    case 'disq': {
      const erlaubt = buchstabenVon(spalte, aufbau, teil)
      const wert = sanitizeDisq(roh, erlaubt)
      return { wert, fehler: fremd(roh, erlaubt) || /\d/.test(roh) ? 'zeichen-fremd' : null }
    }
    case 'zeit': {
      const wert = sanitizeTimeInput(roh, ',')
      if (zeitDeutung(wert) === null) return { wert, fehler: 'zeit-unlesbar' }
      return { wert, fehler: /[^\d.,:]/.test(roh) ? 'zeichen-fremd' : null }
    }
    case 'text':
      return { wert: roh, fehler: null }
  }
}

export interface TabellenZeile {
  /** Zellwert je Spalte (auch leere). */
  zellen: Record<string, string>
  /** Fehler je Feld (nur Zellen mit Fehler). */
  fehler: Record<string, TabellenFehler>
  /**
   * Der Entwurf der Maske aus den fehlerfreien Zellen (Zellen mit Fehler zählen als leer) – über ihn schickt WkrMaske
   * die Zeile wie bei den Knöpfen (zellenAus). „Keine Zeit“ bleibt für leere Zeitfelder stehen.
   */
  entwurf: Entwurf
}

/**
 * Die ganze Zeile aus den Eingaben je Spalte. Rund-Probe (TB3): Der Entwurf muss über zellenAus GENAU die Zellen der
 * Tabelle ergeben – sonst schickte das Gerät etwas anderes, als dasteht; solche Zellen bekommen `nicht-darstellbar`.
 */
export function zeileAusEingaben(
  spalten: readonly TabellenSpalte[],
  eingaben: Readonly<Record<string, string>>,
  aufbau: MaskenAufbau,
  teil?: ListenTeil,
  keineZeit: Readonly<Record<string, KeineZeitGrund>> = {},
): TabellenZeile {
  const zellen: Record<string, string> = {}
  const fehler: Record<string, TabellenFehler> = {}
  const gut: Record<string, string> = {}
  for (const s of spalten) {
    const z = zelleAusEingabe(s, eingaben[s.feld] ?? '', aufbau, teil)
    zellen[s.feld] = z.wert
    if (z.fehler) fehler[s.feld] = z.fehler
    else gut[s.feld] = z.wert
  }
  const kz = Object.fromEntries(Object.entries(keineZeit).filter(([f]) => !gut[f]))
  const entwurf = entwurfAus(gut, aufbau, kz)
  const rund = zellenAus(entwurf, aufbau, teil)
  for (const s of spalten) if (!fehler[s.feld] && (rund[s.feld] ?? '') !== zellen[s.feld]) fehler[s.feld] = 'nicht-darstellbar'
  return { zellen, fehler, entwurf }
}

/** Die Eingaben einer Zeile aus einem Entwurf (Start mit Entwurf, Korrektur): Codes „2x6, 20“, Bojen „5, J“, Zeit wie getippt. */
export function eingabenAus(spalten: readonly TabellenSpalte[], entwurf: Entwurf, aufbau: MaskenAufbau, teil?: ListenTeil): Record<string, string> {
  const zellen = zellenAus(entwurf, aufbau, teil)
  const out: Record<string, string> = {}
  for (const s of spalten) out[s.feld] = s.art === 'zeit' && !(s.feld in entwurf.keineZeit) ? (entwurf.zeiten[s.feld] ?? '') : (zellen[s.feld] ?? '')
  return out
}
