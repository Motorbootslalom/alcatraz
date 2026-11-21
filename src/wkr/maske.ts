import type { CellKind, ClassId } from '../types'
import type { Konfig } from '../config/konfig'
import { codeEntries, normalizeCodeCell, parseCodeEntry } from '../lib/codes'
import { listenFelder } from '../lib/eingaben'
import { CLASS_IDS } from '../domain/classes'
import { WKR_ANNAHMEN } from './annahmen'
import type { ListenTeil } from './liste'
import type { ListenSicht, MaskenFeld } from './sicht'

// Die Maske „Knöpfe“ der WKR-Geräte (W3, Plan docs/plan-wkr-w3.md §3.1, 21.11.2026) – rein, ohne DOM, ohne Store,
// nichts aus geraete/. Aus der Sicht der Liste (wkr/sicht.ts) entsteht der Aufbau der Maske einer Klasse; die Tipps
// des Wettkampfrichters sammelt ein Entwurf, und `zellenAus` macht daraus GENAU die Zellwerte, die der Bedienrechner
// unverändert annimmt (wkr/zeile.ts wertGilt: dieselben Sanierer wie die Erfassungstabelle, lib/codes.ts
// normalizeCodeCell, lib/disq.ts sanitizeDisq). Das Gerät rechnet nichts, was der Bedienrechner anders sähe.

/**
 * Welche Maske eine Liste bekommt (G2: an den Feldarten erkannt, nicht an der Listen-ID): nur Katalog, Disq. und Text
 * → `katalog` (mit Codes) bzw. `vorsteg` (ohne Codes: nur Disq. und Bemerkung); irgendein Feld mit Bojen, Zeit oder
 * Punkten → `spaeter` (Masken W4/W5, bis dahin Papier, G14).
 */
export type MaskenArt = 'katalog' | 'vorsteg' | 'spaeter'

export interface MaskenCode {
  code: string
  text: string
  punkte: number
}

/** Ein Teil der Maske: ein Code-Feld mit seinem Katalog (Steg: Ablegen/Anlegen, Tor 5 und MüB: eines). */
export interface MaskenTeil {
  /** Steg-Teil (F16); `null` bei ungeteilten Listen. */
  teil: ListenTeil | null
  /** Feld-Kennung (z. B. `katalog:tor5`). */
  feld: string
  /** Überschrift des Felds in der gewählten Sprache. */
  titel: string
  codes: MaskenCode[]
  /** Disq.-Buchstaben, die dieses Feld annimmt (für die Schreibweise, H1). */
  buchstaben: string[]
}

export interface MaskenDisq {
  /** Das Feld der Disq.-Buchstaben: das eigene Disq.-Feld der Liste, sonst das erste Code-Feld (H1). */
  feld: string
  /** Gemeinsam für beide Teile (Steg `disq@steg`), sonst gehört es zum Teil des Code-Felds. */
  teil: ListenTeil | null
  /** `nurIn`: nur in diesen Teilen anzubieten (X am Steg nur im Ablegen, F5). */
  codes: { code: string; text: string; nurIn?: ListenTeil[] }[]
}

export interface MaskenAufbau {
  art: MaskenArt
  /** Titel der Klasse („Klasse 5“). */
  titel: string
  /** Steg: [ab, an]; Tor 5 / MüB: [ein Teil]; Vorsteg und `spaeter`: []. */
  teile: MaskenTeil[]
  /** `null`: Die Liste kennt keine Disq. (oder `spaeter`). X nur, wo die Sicht es anbietet (F5). */
  disq: MaskenDisq | null
  /** Feld-Kennung der Bemerkung, sonst `null`. */
  bemerkung: string | null
}

/** Feldarten, die die Maske „Knöpfe“ abdeckt (G2). */
const KNOPF_ARTEN: readonly CellKind[] = ['code', 'disq', 'text']

/** Die Art der Maske aus den Feldern einer Klasse (G2). */
export function maskenArt(felder: readonly Pick<MaskenFeld, 'kind'>[]): MaskenArt {
  if (felder.some((f) => !KNOPF_ARTEN.includes(f.kind))) return 'spaeter'
  return felder.some((f) => f.kind === 'code') ? 'katalog' : 'vorsteg'
}

/**
 * Hat eine Liste in W3 eine Maske auf dem Gerät? (W3.2, Bedienrechner beim Zuweisen, G14.) Nein, sobald eine der
 * `klassen`, die die Liste hat, ein Feld außerhalb von Katalog/Disq./Text trägt (`spaeter`: Bojen, Zeit, Knoten) –
 * dann zeigt das Gerät „Maske folgt – Papier“. Eine unbekannte Liste hat keine Maske. Klassen ohne die Liste zählen
 * nicht; ohne eine einzige passende Klasse entscheidet die Liste über alle ihre Klassen (Auslegung J1, 21.11.2026).
 */
export function listeMitMaske(konfig: Konfig, typeId: string, klassen: Iterable<ClassId>): boolean {
  if (!konfig.getPositions().some((p) => p.typeId === typeId)) return false
  const passend = [...new Set(klassen)].filter((k) => konfig.positionAllowsClass(typeId, k))
  const pruefe = passend.length > 0 ? passend : CLASS_IDS.filter((k) => konfig.positionAllowsClass(typeId, k))
  return pruefe.every((k) => maskenArt(listenFelder(konfig, typeId, k)) !== 'spaeter')
}

/**
 * Der Aufbau der Maske einer Klasse. `sprache`: `liste` (Vorgabe) = die Texte der Sicht; `andere` = die zweite
 * Sprache (F13), wenn die Sicht sie trägt – sonst ebenfalls die der Liste. `null`: Die Klasse hat diese Liste nicht
 * (entfällt) oder kommt in der Sicht nicht vor.
 */
export function maskeFuer(sicht: ListenSicht, klasse: ClassId, sprache: 'liste' | 'andere' = 'liste'): MaskenAufbau | null {
  const k = sicht.klassen[klasse]
  if (!k || !k.felder) return null
  const anders = sprache === 'andere' ? sicht.andere?.klassen[klasse] : undefined
  const andereFelder = new Map((anders?.felder ?? []).map((f) => [f.kennung, f]))
  const titel = anders?.titel ?? k.titel
  const art = maskenArt(k.felder)
  if (art === 'spaeter') return { art, titel, teile: [], disq: null, bemerkung: null }

  const textVon = (feld: MaskenFeld, code: string, art: 'katalog' | 'disq', vorgabe: string) =>
    andereFelder.get(feld.kennung)?.[art]?.find((e) => e.code === code)?.text ?? vorgabe

  const teile: MaskenTeil[] = k.felder
    .filter((f) => f.kind === 'code')
    .map((f) => ({
      teil: f.teil ?? null,
      feld: f.kennung,
      titel: andereFelder.get(f.kennung)?.label ?? f.label,
      codes: (f.katalog ?? []).map((e) => ({ code: e.code, punkte: e.punkte, text: textVon(f, e.code, 'katalog', e.text) })),
      buchstaben: (f.disq ?? []).map((d) => d.code),
    }))

  // Das Disq.-Feld: das eigene der Liste; ohne eines das erste Code-Feld (dort sortiert normalizeCodeCell die
  // Buchstaben hinter die Codes, H1).
  const disqFeld = k.felder.find((f) => f.kind === 'disq') ?? k.felder.find((f) => f.kind === 'code' && (f.disq ?? []).length > 0)
  let disq: MaskenDisq | null = null
  if (disqFeld && (disqFeld.disq ?? []).length > 0) {
    const gemeinsam = disqFeld.kind === 'disq'
    const geteilt = teile.some((t) => t.teil !== null)
    disq = {
      feld: disqFeld.kennung,
      teil: gemeinsam ? null : (disqFeld.teil ?? null),
      codes: disqFeld.disq!.map((d) => {
        const out: MaskenDisq['codes'][number] = { code: d.code, text: textVon(disqFeld, d.code, 'disq', d.text) }
        // Gemeinsames Feld einer geteilten Liste: ein Buchstabe nur in den Teilen, deren Code-Feld ihn auch annimmt –
        // so bleibt X am Steg im Ablegen (die Sicht nimmt es dem Anlegen schon weg, F5).
        if (gemeinsam && geteilt) {
          const nurIn = teile.filter((t) => t.teil !== null && t.buchstaben.includes(d.code)).map((t) => t.teil as ListenTeil)
          if (nurIn.length < teile.filter((t) => t.teil !== null).length) out.nurIn = nurIn
        }
        return out
      }),
    }
  }
  const bemerkung = k.felder.find((f) => f.kind === 'text')?.kennung ?? null
  return { art, titel, teile, disq, bemerkung }
}

/**
 * Die Maske für die Probe beim Einrichten (W3.4, G10, Plan §5.9): die der ersten Klasse (in der Folge der Sicht), die
 * eine Maske „Knöpfe“ hat – Katalog vor Vorsteg ist egal, eine Liste hat nur eine Art. `null`: Die Liste hat keine
 * (nur Bojen/Zeit/Knoten oder keine Klasse mit der Liste) – dann gibt es keine Probe.
 */
export function probeMaske(sicht: ListenSicht, sprache: 'liste' | 'andere' = 'liste'): MaskenAufbau | null {
  for (const k of Object.keys(sicht.klassen) as ClassId[]) {
    const a = maskeFuer(sicht, k, sprache)
    if (a && a.art !== 'spaeter') return a
  }
  return null
}

/** Die Teile, die eine Zeile dieses Teils beschreibt (ohne Teil: alle). */
export function teileFuer(aufbau: MaskenAufbau, teil?: ListenTeil): MaskenTeil[] {
  return aufbau.teile.filter((t) => teil === undefined || t.teil === null || t.teil === teil)
}

/** Die Disq.-Buchstaben, die in diesem Teil angeboten werden (X am Steg nur im Ablegen, F5). */
export function disqFuer(aufbau: MaskenAufbau, teil?: ListenTeil): MaskenDisq['codes'] {
  if (!aufbau.disq) return []
  if (aufbau.disq.teil !== null && teil !== undefined && aufbau.disq.teil !== teil) return []
  return aufbau.disq.codes.filter((c) => !c.nurIn || teil === undefined || c.nurIn.includes(teil))
}

// ---------------------------------------------------------------------------
// Entwurf: die Tipps eines Starts (je Teil)
// ---------------------------------------------------------------------------

/**
 * Merker für einen Disq.-Tipp in `folge`, mit dem Buchstaben (`#disq:A`): Nimmt ein zweiter Tipp einen Buchstaben
 * heraus, fällt genau sein Merker – „zurück“ nimmt danach wirklich den letzten Tipp (H2; Prüfbefund W3, 21.11.2026).
 */
const DISQ = '#disq:'

/**
 * Was der Wettkampfrichter für einen Start (und Teil) getippt hat. `codes`: je Feld die Code-Tipps in Reihenfolge
 * (ein Tipp = +1, H2); `disq`: Buchstaben in Tipp-Reihenfolge, jeder höchstens einmal (Schalter, H1); `folge`: die
 * Reihenfolge aller Tipps (Feld bzw. Disq.) für „− letzte zurück“.
 */
export interface Entwurf {
  codes: Record<string, string[]>
  disq: string[]
  bemerkung: string
  folge: string[]
}

export function leererEntwurf(): Entwurf {
  return { codes: {}, disq: [], bemerkung: '', folge: [] }
}

/** Ein Code-Tipp: +1 für diesen Code im Feld. */
export function tippe(e: Entwurf, feld: string, code: string): Entwurf {
  return { ...e, codes: { ...e.codes, [feld]: [...(e.codes[feld] ?? []), code] }, folge: [...e.folge, feld] }
}

/** Ein Disq.-Tipp: setzt den Buchstaben; ein zweiter Tipp nimmt ihn wieder heraus (H1). */
export function tippeDisq(e: Entwurf, code: string): Entwurf {
  if (!e.disq.includes(code)) return { ...e, disq: [...e.disq, code], folge: [...e.folge, DISQ + code] }
  // Herausnehmen: den Buchstaben und SEINEN Merker – die übrigen Tipps behalten ihre Reihenfolge.
  const i = e.folge.lastIndexOf(DISQ + code)
  return { ...e, disq: e.disq.filter((d) => d !== code), folge: e.folge.filter((_, j) => j !== i) }
}

/** Bemerkung setzen (zählt nicht als Tipp, H2). */
export function mitBemerkung(e: Entwurf, text: string): Entwurf {
  return { ...e, bemerkung: text }
}

/** „− letzte zurück“: nimmt den letzten Tipp – Code oder Disq. – zurück (H2). */
export function zurueck(e: Entwurf): Entwurf {
  const letzt = e.folge[e.folge.length - 1]
  if (letzt === undefined) return e
  const folge = e.folge.slice(0, -1)
  if (letzt.startsWith(DISQ)) {
    const code = letzt.slice(DISQ.length)
    return { ...e, disq: e.disq.filter((d) => d !== code), folge }
  }
  const codes = { ...e.codes, [letzt]: (e.codes[letzt] ?? []).slice(0, -1) }
  if (codes[letzt].length === 0) delete codes[letzt]
  return { ...e, codes, folge }
}

/** Zahl der Einträge (Code-Tipps und Disq.) – „Abschicken · n“. */
export function eintraege(e: Entwurf): number {
  return Object.values(e.codes).reduce((n, c) => n + c.length, 0) + e.disq.length
}

/** Punkte der Code-Tipps im Teil (ohne Disq.; die Wertung rechnet am Bedienrechner, das hier ist nur die Anzeige). */
export function punkteVon(e: Entwurf, aufbau: MaskenAufbau, teil?: ListenTeil): number {
  let summe = 0
  for (const t of teileFuer(aufbau, teil)) {
    const punkte = new Map(t.codes.map((c) => [c.code, c.punkte]))
    for (const code of e.codes[t.feld] ?? []) summe += punkte.get(code) ?? 0
  }
  return summe
}

/**
 * Die Zellwerte der Zeile: je Feld des Teils (ohne Teil: alle) und die gemeinsamen (Disq., Bemerkung) – auch leere,
 * denn „Fehlerfrei“ ist eine Zeile mit leeren Feldern (geraete/erfassen.ts schicke lässt leere ohne `vorher` weg).
 * Code-Felder in der Schreibweise der Erfassung („2x6, 20“, normalizeCodeCell), Disq. in Tipp-Reihenfolge („A, X“,
 * sanitizeDisq lässt sie so), Bemerkung getrimmt und gekürzt. Am Steg gehen Disq. ins gemeinsame `disq@steg`.
 */
export function zellenAus(e: Entwurf, aufbau: MaskenAufbau, teil?: ListenTeil): Record<string, string> {
  const out: Record<string, string> = {}
  const angeboten = new Set(disqFuer(aufbau, teil).map((d) => d.code))
  const disq = e.disq.filter((d) => angeboten.has(d))
  for (const t of teileFuer(aufbau, teil)) {
    const roh = [...(e.codes[t.feld] ?? []), ...(aufbau.disq?.feld === t.feld ? disq : [])].join(', ')
    out[t.feld] = normalizeCodeCell(roh, new Set(t.codes.map((c) => c.code)), new Set(t.buchstaben))
  }
  if (aufbau.disq && !(aufbau.disq.feld in out) && (aufbau.disq.teil === null || teil === undefined || aufbau.disq.teil === teil)) {
    out[aufbau.disq.feld] = disq.join(', ')
  }
  if (aufbau.bemerkung) out[aufbau.bemerkung] = e.bemerkung.trim().slice(0, WKR_ANNAHMEN.textMax).trim()
  return out
}

/**
 * Ein Entwurf aus Zellwerten – Korrektur einer Zeile aus „Zuletzt“ (F7). Rund: `zellenAus(entwurfAus(z))` gibt die
 * Zellen zurück (soweit die Maske sie kennt). Codes in Katalogfolge der Zelle, Buchstaben im Code-Feld zählen als Disq.
 */
export function entwurfAus(zellen: Readonly<Record<string, string>>, aufbau: MaskenAufbau): Entwurf {
  let e = leererEntwurf()
  const disq: string[] = []
  for (const t of aufbau.teile) {
    const wert = zellen[t.feld]
    if (!wert) continue
    for (const eintrag of codeEntries(wert)) {
      const c = parseCodeEntry(eintrag)
      if (c) {
        for (let i = 0; i < c.anzahl && i < 99; i++) e = tippe(e, t.feld, String(Number(c.code)))
      } else {
        for (const ch of eintrag.toUpperCase()) if (t.buchstaben.includes(ch) && !disq.includes(ch)) disq.push(ch)
      }
    }
  }
  if (aufbau.disq && aufbau.disq.teil === null) {
    for (const ch of (zellen[aufbau.disq.feld] ?? '').toUpperCase()) if (/[A-Z]/.test(ch) && !disq.includes(ch)) disq.push(ch)
  }
  for (const d of disq) e = tippeDisq(e, d)
  if (aufbau.bemerkung && zellen[aufbau.bemerkung]) e = mitBemerkung(e, zellen[aufbau.bemerkung])
  return e
}

// ---------------------------------------------------------------------------
// Takt des Weiterspringens (Doppeltipp-Schutz, G5)
// ---------------------------------------------------------------------------

/**
 * Wo die Maske nach dem Abschicken steht (G5, neu nach dem Feldtest 21.11.2026, Befund 13 – N1 in WKR_ANNAHMEN):
 *
 * - `gesendet`: Overlay „wird übertragen …“ über der ganzen Maske, die Nummer steht noch – mindestens
 *   `uebertragenMinMs`, bis die Quittung da ist, höchstens `uebertragenMaxMs`.
 * - `uebernommen`: Quittung da – „✓ übernommen“ (bzw. Rückfrage/abgelehnt) `uebernommenMs` lang.
 * - `sperre`: Nummer gewechselt (Blitz), `sperreMs` keine Eingabe (Doppeltipp-Schutz bleibt).
 * - `frei`.
 *
 * Ohne Quittung geht das Overlay nach `uebertragenMaxMs` trotzdem weg (die Maske sperrt nie bis zur Quittung, §5.2);
 * eine spätere Quittung ändert am Takt nichts mehr. Die Uhr wird hineingereicht (kein Date.now()).
 */
export type Takt = 'gesendet' | 'uebernommen' | 'sperre' | 'frei'

/** Ab wann nach dem Abschicken (ms) die Nummer wechselt – mit Quittung früher, ohne nach `uebertragenMaxMs`. */
export function wechselNach(gesendetUm: number, quittungUm: number | null = null): number {
  const q = quittungAb(gesendetUm, quittungUm)
  return q === null ? WKR_ANNAHMEN.uebertragenMaxMs : q + WKR_ANNAHMEN.uebernommenMs
}

/** Ab wann (ms nach dem Abschicken) „✓ übernommen“ steht – nie vor `uebertragenMinMs`; `null` = keine Quittung bis zum Höchstwert. */
function quittungAb(gesendetUm: number, quittungUm: number | null): number | null {
  if (quittungUm === null) return null
  const q = Math.max(quittungUm - gesendetUm, WKR_ANNAHMEN.uebertragenMinMs)
  return q < WKR_ANNAHMEN.uebertragenMaxMs ? q : null
}

export function wechselTakt(gesendetUm: number | null, jetzt: number, quittungUm: number | null = null): Takt {
  if (gesendetUm === null) return 'frei'
  const d = jetzt - gesendetUm
  const q = quittungAb(gesendetUm, quittungUm)
  const wechsel = wechselNach(gesendetUm, quittungUm)
  // Eine rückwärts gestellte Uhr gilt als „gerade gesendet“ – lieber kurz warten als einen Tropfen durchlassen.
  if (d < wechsel) return q !== null && d >= q ? 'uebernommen' : 'gesendet'
  if (d < wechsel + WKR_ANNAHMEN.sperreMs) return 'sperre'
  return 'frei'
}
