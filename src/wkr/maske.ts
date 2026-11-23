import type { CellKind, ClassId, KeineZeitGrund } from '../types'
import type { Konfig } from '../config/konfig'
import { codeEntries, normalizeCodeCell, parseCodeEntry } from '../lib/codes'
import { listenFelder } from '../lib/eingaben'
import { bojenWert } from '../lib/scoring'
import { bojenZelle } from '../lib/disq'
import { parseTime, sanitizeTimeInput } from '../lib/time'
import { CLASS_IDS } from '../domain/classes'
import { WKR_ANNAHMEN } from './annahmen'
import { bojenHalt, katalogFolge, type Weg } from './bojen'
import type { ListenTeil } from './liste'
import { liesRef } from '../betrieb/folge'
import type { ListenSicht, MaskenFeld } from './sicht'

// Die Maske „Knöpfe“ der WKR-Geräte (W3, Plan docs/plan-wkr-w3.md §3.1, 21.11.2026) – rein, ohne DOM, ohne Store,
// nichts aus geraete/. Aus der Sicht der Liste (wkr/sicht.ts) entsteht der Aufbau der Maske einer Klasse; die Tipps
// des Wettkampfrichters sammelt ein Entwurf, und `zellenAus` macht daraus GENAU die Zellwerte, die der Bedienrechner
// unverändert annimmt (wkr/zeile.ts wertGilt: dieselben Sanierer wie die Erfassungstabelle, lib/codes.ts
// normalizeCodeCell, lib/disq.ts sanitizeDisq). Das Gerät rechnet nichts, was der Bedienrechner anders sähe.

/**
 * Welche Maske eine Liste bekommt (G2: an den Feldarten erkannt, nicht an der Listen-ID): nur Katalog, Disq. und Text
 * → `katalog` (mit Codes) bzw. `vorsteg` (ohne Codes: nur Disq. und Bemerkung); seit W4.1 (21.11.2026, P1) Bojen auf
 * dem Fahrweg (mit `boje` in der Sicht), auch gemischt mit Katalog, Disq. und Text → `bojen`; ein Feld mit Zeit oder
 * Punkten oder eine Boje außerhalb des Fahrwegs (Knoten) → `spaeter` (Masken W5, bis dahin Papier, G14). Seit W5.3
 * (22.11.2026, KN7): auf einer Liste OHNE Lauf nur Bojen ohne Fahrweg (+ Text) → `pruefliste` (Knoten: ✓/✗ je Feld).
 * Seit W5.4 (22.11.2026, ZT1, noch zu bestätigen): nur Zeit (+ Disq./Text) → `zeit` (Ziffernblock je Zeitfeld); Bojen
 * auf dem Fahrweg MIT Zeit (`moewezeit`, `bstartziel`) → `bojen` mit Zeit-Abschnitt (`zeiten` im Aufbau).
 */
export type MaskenArt = 'katalog' | 'vorsteg' | 'bojen' | 'pruefliste' | 'zeit' | 'spaeter'

export interface MaskenCode {
  code: string
  text: string
  punkte: number
  /** Gilt laut Regelwerk in dieser Klasse nicht (Sicht `aus`) – ausgegraut, drückbar (Nutzer 21.11.2026, W3-07, GF2). */
  aus?: true
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

/** Ein Knopf der Bojen-Maske: eine Boje in einer Richtung (W4.1, P2, P7). */
export interface MaskenBoje {
  /** Feld-Kennung (`t1a|hin seiteB`). */
  feld: string
  /** Kopf der Unterspalte wie auf dem Bogen („H L“), '' ohne Unterspalte (Speedboje, Parallel-Bojen 1–5). */
  unter: string
  /** Knopfspalte aus Sicht des WKR; `null` = volle Breite. */
  spalte: 0 | 1 | null
  /** Zähler (Torbojen Tor 5, F2) statt Schalter. */
  zaehler: boolean
  /** Punkte je Berührung (P4). */
  punkte: number
  /**
   * Disq.-Buchstaben, die DIESE Bojenzelle annimmt (lib/disq.ts sanitizeBuoy, wie beim Abtippen) – Disq. an der Boje
   * (Nutzer 21.11.2026, WKR_ANNAHMEN.disqAnBoje, U1). Leer: an dieser Boje kein Disq.
   */
  disq: { code: string; text: string }[]
}

/** Eine Zeile der Bojen-Maske: ein Tor (bzw. Start, Ziel, Speedboje, Parallel-Boje) in einer Richtung. */
export interface MaskenHalt {
  halt: string
  /** Kopf der Spalte („Tor 1“). */
  titel: string
  weg: Weg
  /** Zweite Durchfahrt desselben Tores (Tor 1 der Speedrunde, P3). */
  durchfahrt?: 2
  /** Die Bojen in der Reihenfolge der Knopfspalten (0, 1, dann volle Breite). */
  bojen: MaskenBoje[]
}

/** Ein Feld der Prüfliste (W5.3, KN7): ein Knoten – ✓ (leere Zelle) oder ✗ (Fehlerpunkte). */
export interface MaskenPruef {
  feld: string
  titel: string
  /** Punkte bei ✗ (WKR_ANNAHMEN.knotenPunkte, „5“ wie P4). */
  punkte: number
}

/** Ein Zeitfeld der Maske (W5.4, ZT3): Kennung und Überschrift wie auf dem Bogen („Zeit 1“). */
export interface MaskenZeit {
  feld: string
  titel: string
}

/** Ein Abschnitt der Bojen-Maske in Fahrtfolge: ein Halt oder ein Katalog-Teil an seinem Platz (Einfahrt Tor 5, MüB). */
export type MaskenAbschnitt = { art: 'halt'; halt: MaskenHalt } | { art: 'katalog'; teil: MaskenTeil; weg: Weg }

export interface MaskenAufbau {
  art: MaskenArt
  /** Titel der Klasse („Klasse 5“). */
  titel: string
  /** Steg: [ab, an]; Tor 5 / MüB: [ein Teil]; Vorsteg und `spaeter`: []; `bojen`: die Katalog-Teile (auch in `abschnitte`). */
  teile: MaskenTeil[]
  /** `null`: Die Liste kennt keine Disq. (oder `spaeter`). X nur, wo die Sicht es anbietet (F5). */
  disq: MaskenDisq | null
  /** Feld-Kennung der Bemerkung, sonst `null`. */
  bemerkung: string | null
  /** Nur `bojen`: Halte und Katalog-Teile in Fahrtfolge (P6); sonst leer. */
  abschnitte: MaskenAbschnitt[]
  /** Nur `bojen`: mehr Zeilen als `bojenZeilenEineSeite` → Umschalter Hinweg/Rückweg (P8). */
  umschalter: boolean
  /** Nur `pruefliste` (W5.3): die Knoten in der Folge der Liste; sonst leer. */
  pruef: MaskenPruef[]
  /** `zeit` und gemischte `bojen` (W5.4, ZT1/ZT3): die Zeitfelder in der Folge der Liste; sonst leer. */
  zeiten: MaskenZeit[]
}

/** Feldarten, die die Maske „Knöpfe“ abdeckt (G2); `buoy` nur mit Bojen-Angabe (W4.1). */
const KNOPF_ARTEN: readonly CellKind[] = ['code', 'disq', 'text']

/**
 * Die Art der Maske aus den Feldern einer Klasse (G2, P1). Ein `buoy`-Feld ist eine Boje der Maske, wenn es eine
 * Bojen-Angabe trägt (`boje` aus der Sicht bzw. aus wkr/bojen.ts bojenHalt) – Knoten (auch `buoy`) bleiben `spaeter`.
 */
export function maskenArt(felder: readonly { kind: CellKind; boje?: unknown }[], ohneLauf = false): MaskenArt {
  // Knoten (W5.3, KN7, Merker WKR_ANNAHMEN.prueflisteRestRichtig, KN10): auf einer Liste ohne Lauf Bojen ohne Fahrweg (+ Text).
  if (ohneLauf && felder.some((f) => f.kind === 'buoy') && felder.every((f) => (f.kind === 'buoy' && !f.boje) || f.kind === 'text')) return 'pruefliste'
  // Zeit (W5.4, ZT1): nur Zeit, Disq., Text → Ziffernblock; Zeit neben Bojen des Fahrwegs → Bojen-Maske mit Zeit-Abschnitt.
  const zeit = felder.some((f) => f.kind === 'time')
  if (zeit && felder.every((f) => f.kind === 'time' || f.kind === 'disq' || f.kind === 'text')) return 'zeit'
  if (felder.some((f) => (f.kind === 'buoy' ? !f.boje : f.kind !== 'time' && !KNOPF_ARTEN.includes(f.kind)))) return 'spaeter'
  if (felder.some((f) => f.kind === 'buoy')) return 'bojen'
  // Zeit neben Katalog ohne Bojen gibt es in keinem Aufbau – lieber Papier als eine geratene Maske.
  if (zeit) return 'spaeter'
  return felder.some((f) => f.kind === 'code') ? 'katalog' : 'vorsteg'
}

/**
 * Hat eine Liste in W3 eine Maske auf dem Gerät? (W3.2, Bedienrechner beim Zuweisen, G14.) Nein, sobald eine der
 * `klassen`, die die Liste hat, ein Feld außerhalb von Katalog/Disq./Text trägt (`spaeter`: Zeit, Knoten, Bojen außerhalb des Fahrwegs) –
 * dann zeigt das Gerät „Maske folgt – Papier“. Eine unbekannte Liste hat keine Maske. Klassen ohne die Liste zählen
 * nicht; ohne eine einzige passende Klasse entscheidet die Liste über alle ihre Klassen (Auslegung J1, 21.11.2026).
 */
export function listeMitMaske(konfig: Konfig, typeId: string, klassen: Iterable<ClassId>): boolean {
  if (!konfig.getPositions().some((p) => p.typeId === typeId)) return false
  const passend = [...new Set(klassen)].filter((k) => konfig.positionAllowsClass(typeId, k))
  const pruefe = passend.length > 0 ? passend : CLASS_IDS.filter((k) => konfig.positionAllowsClass(typeId, k))
  const ohneLauf = konfig.getSheetDef(typeId).showLauf === false
  return pruefe.every((k) => maskenArt(listenFelder(konfig, typeId, k).map((f) => ({ kind: f.kind, boje: f.kind === 'buoy' ? bojenHalt(f.kennung) : null })), ohneLauf) !== 'spaeter')
}

/**
 * Hat eine Liste Bojen auf dem Fahrweg (Maskenart `bojen`) in einer der `klassen` mit der Liste – dann darf der
 * Bedienrechner „Bild“ vorgeben (F14, W5.1, wkr/maskenWahl.ts, 22.11.2026). Klassen wie {@link listeMitMaske}.
 */
export function listeMitBojen(konfig: Konfig, typeId: string, klassen: Iterable<ClassId>): boolean {
  if (!konfig.getPositions().some((p) => p.typeId === typeId)) return false
  const passend = [...new Set(klassen)].filter((k) => konfig.positionAllowsClass(typeId, k))
  const pruefe = passend.length > 0 ? passend : CLASS_IDS.filter((k) => konfig.positionAllowsClass(typeId, k))
  return pruefe.some((k) => maskenArt(listenFelder(konfig, typeId, k).map((f) => ({ kind: f.kind, boje: f.kind === 'buoy' ? bojenHalt(f.kennung) : null }))) === 'bojen')
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
  // Liste ohne Lauf: die Sicht trägt dann den Bestand statt einer Schlange (W5.3).
  const art = maskenArt(k.felder, !!sicht.bestand)
  if (art === 'spaeter') return { art, titel, teile: [], disq: null, bemerkung: null, abschnitte: [], umschalter: false, pruef: [], zeiten: [] }
  if (art === 'pruefliste') {
    const pruef = k.felder
      .filter((f) => f.kind === 'buoy')
      .map((f) => ({ feld: f.kennung, titel: andereFelder.get(f.kennung)?.label ?? f.label, punkte: WKR_ANNAHMEN.knotenPunkte }))
    return { art, titel, teile: [], disq: null, bemerkung: k.felder.find((f) => f.kind === 'text')?.kennung ?? null, abschnitte: [], umschalter: false, pruef, zeiten: [] }
  }
  // Zeitfelder (W5.4, ZT3): alle Zeitfelder der Liste in ihrer Folge – eine Zeile je Start trägt sie alle.
  const zeiten: MaskenZeit[] = k.felder.filter((f) => f.kind === 'time').map((f) => ({ feld: f.kennung, titel: andereFelder.get(f.kennung)?.label ?? f.label }))

  const textVon = (feld: MaskenFeld, code: string, art: 'katalog' | 'disq', vorgabe: string) =>
    andereFelder.get(feld.kennung)?.[art]?.find((e) => e.code === code)?.text ?? vorgabe

  const teile: MaskenTeil[] = k.felder
    .filter((f) => f.kind === 'code')
    .map((f) => ({
      teil: f.teil ?? null,
      feld: f.kennung,
      titel: andereFelder.get(f.kennung)?.label ?? f.label,
      codes: (f.katalog ?? []).map((e) => ({ code: e.code, punkte: e.punkte, text: textVon(f, e.code, 'katalog', e.text), ...(e.aus ? { aus: true as const } : {}) })),
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
  if (art !== 'bojen') return { art, titel, teile, disq, bemerkung, abschnitte: [], umschalter: false, pruef: [], zeiten }

  // Bojen (W4.1): Felder gleichen Halts und Wegs zu einer Zeile, Zeilen und Katalog-Teile nach dem Fahrweg (P6).
  const halte = new Map<string, MaskenHalt & { folge: number }>()
  for (const f of k.felder) {
    if (f.kind !== 'buoy' || !f.boje) continue
    const b = f.boje
    const anderes = andereFelder.get(f.kennung)?.boje
    const schluessel = `${b.halt}|${b.weg}`
    const halt = halte.get(schluessel) ?? { halt: b.halt, titel: anderes?.titel ?? b.titel, weg: b.weg, ...(b.durchfahrt ? { durchfahrt: b.durchfahrt } : {}), bojen: [], folge: b.folge }
    const disq = (f.disq ?? []).map((d) => ({ code: d.code, text: textVon(f, d.code, 'disq', d.text) }))
    halt.bojen.push({ feld: f.kennung, unter: anderes?.unter ?? b.unter, spalte: b.spalte, zaehler: !!b.zaehler, punkte: WKR_ANNAHMEN.bojenPunkte, disq })
    halte.set(schluessel, halt)
  }
  const platz = (s: number | null) => (s === null ? 2 : s)
  const mitFolge: { folge: number; abschnitt: MaskenAbschnitt }[] = [...halte.values()].map(({ folge, ...halt }) => ({
    folge,
    abschnitt: { art: 'halt', halt: { ...halt, bojen: [...halt.bojen].sort((a, b) => platz(a.spalte) - platz(b.spalte)) } },
  }))
  for (const t of teile) {
    // Ein Katalog ohne Platz im Fahrweg (eigener Aufbau) kommt ans Ende des Rückwegs.
    const p = katalogFolge(t.feld) ?? { folge: Number.MAX_SAFE_INTEGER, weg: 'rueck' as const }
    mitFolge.push({ folge: p.folge, abschnitt: { art: 'katalog', teil: t, weg: p.weg } })
  }
  const abschnitte = mitFolge.sort((a, b) => a.folge - b.folge).map((x) => x.abschnitt)
  const aufbau: MaskenAufbau = { art, titel, teile, disq, bemerkung, abschnitte, umschalter: false, pruef: [], zeiten }
  aufbau.umschalter = maskenZeilen(aufbau) > WKR_ANNAHMEN.bojenZeilenEineSeite
  return aufbau
}

/** Zeilen der Bojen-Maske (P8): je Halt eine, je Code eines Katalog-Abschnitts eine. */
export function maskenZeilen(aufbau: MaskenAufbau): number {
  return aufbau.abschnitte.reduce((n, a) => n + (a.art === 'halt' ? 1 : a.teil.codes.length), 0)
}

/**
 * Reihenfolge der Bojen-Maske einer Liste, gemerkt je Gerät und Liste (Nutzer 22.11.2026, WKR_ANNAHMEN.bojenFolge,
 * ersetzt „Wie der Parcours liegt“/Spiegeln V1/V2 vom 21.11.2026): „Deine Implementierung ‚Wie der Parcours liegt‘
 * ist leider Müll. Es ging mir bei dem Punkt darum, dass du bei Hin eine andere Zeilenreihenfolge (Start/Ziel, Tor 1,
 * Tor 3, Tor 5) hast als beim Rück-Tab (Tor 5, Tor 3, Tor 1, Start/Ziel). Den zweiten Tab wollte ich gedreht haben.“
 * - `gedreht` (Vorgabe): der Rück-Reiter in umgekehrter Fahrtfolge – jedes Tor steht auf beiden Reitern an derselben
 *   Stelle (Start/Ziel, Tor 1, Tor 3, Tor 5);
 * - `fahrt`: beide Reiter in Fahrtfolge (Rück: Tor 5, Tor 3, Tor 1, Ziel – der Stand vor dem 22.11.2026);
 * - `untereinander`: ein Reiter ohne Umschalter, alles in Fahrtfolge (Start, Tor 1, Tor 3, Tor 5, Tor 5, Tor 3, Tor 1,
 *   Ziel).
 * Die Folge ordnet nur um – Felder, Zellen, Zahlen am Reiter und Texte bleiben dieselben.
 */
export type BojenFolge = 'gedreht' | 'fahrt' | 'untereinander'
export const BOJEN_FOLGEN: readonly BojenFolge[] = ['gedreht', 'fahrt', 'untereinander']
export const BOJEN_FOLGE_VORGABE: BojenFolge = 'gedreht'

/** Zeigt die Maske den Umschalter Hinweg/Rückweg? Nur bei vielen Zeilen (P8) und nicht „Alles untereinander“. */
export function mitUmschalter(aufbau: MaskenAufbau, folge: BojenFolge): boolean {
  return aufbau.umschalter && folge !== 'untereinander'
}

/**
 * Gegenstück eines Abschnitts auf dem anderen Weg: dasselbe Tor (`t3a` ↔ `t3b`, `t5` ↔ `t5`), dieselbe Parallel-Boje
 * (`b2a` ↔ `b2b`), Start ↔ Ziel. Ohne Gegenstück (`null`): Katalog-Teile (Einfahrt Tor 5, MüB), Speedbojen und die
 * 2. Durchfahrt von Tor 1 (Speedrunde) – sie gibt es nur auf einem Weg.
 */
function gegenstueck(a: MaskenAbschnitt): string | null {
  if (a.art !== 'halt' || a.halt.durchfahrt) return null
  const h = a.halt.halt
  if (h === 'start' || h === 'ziel') return 'start-ziel'
  return /^([tb]\d)[ab]?$/.exec(h)?.[1] ?? null
}

/**
 * Die Abschnitte, die die Mitte zeigt, in der Folge des Bildschirms: ohne Umschalter alle in Fahrtfolge; mit Umschalter
 * die der gewählten Seite. Unter `gedreht` (22.11.2026) steht auf dem Rückweg jedes Tor dort, wo sein Gegenstück auf
 * dem Hinweg steht (Ziel unter Start, Tor 1 R unter Tor 1 H …) – bei einfachen Listen genau die umgekehrte Fahrtfolge.
 * Was kein Gegenstück auf dem Hinweg hat (Speedbojen, Tor 1 der Speedrunde, MüB), steht direkt vor seinem Vorgänger in
 * der Fahrtfolge – der ganze Reiter ist dann die umgekehrte Fahrtfolge, die Tore stehen untereinander wie auf Hin
 * (Prüfbefund 22.11.2026, ersetzt „danach in Fahrtfolge“; noch zu bestätigen).
 */
export function bojenAbschnitte(aufbau: MaskenAufbau, folge: BojenFolge, weg: Weg): MaskenAbschnitt[] {
  if (!mitUmschalter(aufbau, folge)) return aufbau.abschnitte
  const seite = aufbau.abschnitte.filter((a) => wegVon(a) === weg)
  if (weg === 'hin' || folge !== 'gedreht') return seite
  const platz = new Map<string, number>()
  for (const [i, a] of aufbau.abschnitte.filter((x) => wegVon(x) === 'hin').entries()) {
    const g = gegenstueck(a)
    if (g !== null && !platz.has(g)) platz.set(g, i)
  }
  const stelle = (a: MaskenAbschnitt) => {
    const g = gegenstueck(a)
    return g === null ? undefined : platz.get(g)
  }
  const gespiegelt = seite.filter((a) => stelle(a) !== undefined).sort((a, b) => stelle(a)! - stelle(b)!)
  // Ohne Gegenstück (Prüfbefund 22.11.2026): jeder Abschnitt steht direkt VOR seinem Vorgänger in der Fahrtfolge –
  // so liest sich der Reiter von oben nach unten als umgekehrte Fahrtfolge (Ziel, Tor 1 (2.), Speed, Tor 1 R …), wie
  // der Nutzer „gedreht“ meinte; die Tore bleiben untereinander in der Folge des Hinwegs. Ohne Vorgänger (erster
  // Abschnitt des Rückwegs) ganz ans Ende.
  const zeilen = [...gespiegelt]
  for (const [i, a] of seite.entries()) {
    if (stelle(a) !== undefined) continue
    const vorher = i > 0 ? zeilen.indexOf(seite[i - 1]) : -1
    if (vorher >= 0) zeilen.splice(vorher, 0, a)
    else zeilen.push(a)
  }
  return zeilen
}

/**
 * Alle Abschnitte in einer Liste (Ortswahl „Disq. – an welcher Boje?“): wie die Maske sie zeigt, der Hinweg vor dem
 * Rückweg – unter `gedreht` (mit Umschalter) der Rückweg umgekehrt wie sein Reiter (22.11.2026, noch zu bestätigen).
 */
export function bojenAbschnitteAlle(aufbau: MaskenAufbau, folge: BojenFolge): MaskenAbschnitt[] {
  if (!mitUmschalter(aufbau, folge)) return aufbau.abschnitte
  return [...bojenAbschnitte(aufbau, folge, 'hin'), ...bojenAbschnitte(aufbau, folge, 'rueck')]
}

/** Weg eines Abschnitts (für den Umschalter). */
export function wegVon(a: MaskenAbschnitt): Weg {
  return a.art === 'halt' ? a.halt.weg : a.weg
}

/**
 * Die Maske für die Probe beim Einrichten (W3.4, G10, Plan §5.9): die der ersten Klasse (in der Folge der Sicht), die
 * eine Maske „Knöpfe“ hat – Katalog vor Vorsteg ist egal, eine Liste hat nur eine Art. Bei Bojen-Listen (W4.1, P11)
 * die Klasse mit den MEISTEN Zeilen (zeigt Speedrunde und Umschalter; bei Gleichstand die erste). `null`: Die Liste
 * hat keine (nur Zeit/Knoten oder keine Klasse mit der Liste) – dann gibt es keine Probe.
 */
export function probeMaske(sicht: ListenSicht, sprache: 'liste' | 'andere' = 'liste'): MaskenAufbau | null {
  let beste: MaskenAufbau | null = null
  for (const k of Object.keys(sicht.klassen) as ClassId[]) {
    const a = maskeFuer(sicht, k, sprache)
    // Keine Probe für die Prüfliste am Tisch (W5.3): kein Start, kein Takt – die Maske erklärt sich selbst.
    if (!a || a.art === 'spaeter' || a.art === 'pruefliste') continue
    if (a.art !== 'bojen') return a
    if (!beste || maskenZeilen(a) > maskenZeilen(beste)) beste = a
  }
  return beste
}

/** Alle Bojen-Knöpfe einer Maske in Fahrtfolge. */
export function bojenVon(aufbau: MaskenAufbau): MaskenBoje[] {
  return aufbau.abschnitte.flatMap((a) => (a.art === 'halt' ? a.halt.bojen : []))
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
/** Merker für einen Bojen-Tipp in `folge` (`#boje:t1a|hin seiteB`, W4.1) – „zurück“ nimmt genau diesen Tipp. */
const BOJE = '#boje:'
/**
 * Merker für einen Disq.-Buchstaben an einer Boje (`#bdisq:t3a|hin seiteB=G`, U1, 21.11.2026): je Buchstabe einer
 * (BZ7, 22.11.2026 – R7-14, mehrere Disq. je Boje). „− letzte zurück“ nimmt genau den zuletzt gesetzten Buchstaben
 * heraus (H2 „zurück = letzter Tipp“); ein ersetzter Buchstabe, den „zurück“ wiederherstellen müsste, kommt nicht mehr
 * vor – ein Tipp schaltet nur seinen eigenen Buchstaben an oder aus. Die Berührungen berührt der Buchstabe seit W4-12
 * (21.11.2026, BZ1) nicht – sie bleiben mit ihren eigenen Merkern stehen.
 */
const BOJEN_DISQ = '#bdisq:'
const bojenDisqMerker = (feld: string, code: string) => `${BOJEN_DISQ}${feld}=${code}`
/** Feld und Buchstabe eines Bojen-Disq.-Merkers (der Buchstabe hinter dem letzten „=“ – Kennungen tragen keins). */
function liesBojenDisqMerker(m: string): { feld: string; code: string } {
  const rest = m.slice(BOJEN_DISQ.length)
  const i = rest.lastIndexOf('=')
  return { feld: rest.slice(0, i), code: rest.slice(i + 1) }
}

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
  /** Berührungen je Bojen-Feld (W4.1): Schalter 0/1, Zähler bis `bojenZaehlerMax`; 0 steht nie drin. */
  bojen: Record<string, number>
  /**
   * Disq.-Buchstaben je Bojen-Feld (U1, 21.11.2026): an dieser Boje disqualifiziert. Seit W4-12 (21.11.2026, BZ1)
   * NEBEN den Berührungen – die Zelle trägt beides („5, J“), vorher (U2) ersetzte der Buchstabe die Punkte. Seit
   * R7-14 (22.11.2026, BZ6/BZ7) mehrere je Boje, in Tipp-Folge (die Zelle ordnet nach dem Katalog); nie leer – ohne
   * Buchstaben fehlt der Eintrag.
   */
  bojenDisq: Record<string, string[]>
  /** Prüfliste (W5.3, KN7): je Knoten ✓ `ok` oder ✗ `fehler`; fehlt = noch nicht gesetzt. */
  pruef: Record<string, PruefWahl>
  /**
   * Zeiten (W5.4, ZT2): je Zeitfeld die Ziffernfolge wie getippt („83,45“, „1,2345“) – die Zelle bekommt genau sie
   * (die Erfassung am Rechner speichert ebenso die Roh-Eingabe, components/erfassung/ZeitZelle.vue). Fehlt = leer.
   */
  zeiten: Record<string, string>
  /** „Keine Zeit“ (W5.4, ZT4) je Zeitfeld mit Grund; schließt eine Zeit im selben Feld aus. */
  keineZeit: Record<string, KeineZeitGrund>
}

/** Ein Knoten der Prüfliste: ✓ gebunden bzw. ✗ Fehler. */
export type PruefWahl = 'ok' | 'fehler'

export function leererEntwurf(): Entwurf {
  return { codes: {}, disq: [], bemerkung: '', folge: [], bojen: {}, bojenDisq: {}, pruef: {}, zeiten: {}, keineZeit: {} }
}

/** Höchstens so viele Zeichen in einem Zeitfeld („10:23,45“ hat 8) – mehr tippt niemand, der eine Uhr abliest. */
export const ZEIT_ZEICHEN_MAX = 8

/**
 * Eine Zeit eintippen (W5.4, ZT2): `text` ist die ganze neue Ziffernfolge des Felds; erlaubt ist, was die Erfassung am
 * Rechner beim Tippen stehen lässt (lib/time.ts sanitizeTimeInput mit Komma – so steht es im Stand), gekürzt auf
 * {@link ZEIT_ZEICHEN_MAX}. Eine Zeit hebt „keine Zeit“ dieses Felds auf; leer = Feld wieder offen. Ein Feld, das die
 * Maske nicht kennt, ändert nichts (gleiche Referenz).
 */
export function setzeZeit(e: Entwurf, aufbau: Pick<MaskenAufbau, 'zeiten'>, feld: string, text: string): Entwurf {
  if (!aufbau.zeiten.some((z) => z.feld === feld)) return e
  const neu = sanitizeTimeInput(text, ',').slice(0, ZEIT_ZEICHEN_MAX)
  if ((e.zeiten[feld] ?? '') === neu && !(feld in e.keineZeit)) return e
  const zeiten = { ...e.zeiten }
  if (neu === '') delete zeiten[feld]
  else zeiten[feld] = neu
  const keineZeit = { ...e.keineZeit }
  if (neu !== '') delete keineZeit[feld]
  return { ...e, zeiten, keineZeit }
}

/**
 * „Keine Zeit“ für ein Feld (W5.4, ZT4): setzt den Grund und leert die Zeit; `null` bzw. derselbe Grund noch einmal
 * nimmt ihn heraus (Feld wieder offen). Unbekanntes Feld → gleiche Referenz.
 */
export function setzeKeineZeit(e: Entwurf, aufbau: Pick<MaskenAufbau, 'zeiten'>, feld: string, grund: KeineZeitGrund | null): Entwurf {
  if (!aufbau.zeiten.some((z) => z.feld === feld)) return e
  const alt = e.keineZeit[feld]
  const keineZeit = { ...e.keineZeit }
  if (grund === null || grund === alt) {
    if (alt === undefined) return e
    delete keineZeit[feld]
    return { ...e, keineZeit }
  }
  keineZeit[feld] = grund
  const zeiten = { ...e.zeiten }
  delete zeiten[feld]
  return { ...e, zeiten, keineZeit }
}

/**
 * Die Deutung einer getippten Zeit (W5.4, F9: wie die Erfassung am Rechner sie liest, lib/time.ts parseTime): Hundertstel
 * oder `null` = so nicht lesbar (Anzeige rot, Hauptknopf gesperrt). Leer → `null`.
 */
export function zeitDeutung(text: string): number | null {
  return parseTime(text)?.centis ?? null
}

/**
 * Eine Zeit für die Anzeige auf dem Gerät (W5.4): „1:23,45“ – Minuten ohne führende Null, wie eine Stoppuhr sie zeigt;
 * `komma` nach der Sprache der Liste („,“ bzw. „.“). Dazu die Teile der Deutung „= 1 min 23,45 s“.
 */
export function zeitUhr(centis: number, komma: ',' | '.' = ','): string {
  const { min, sek } = zeitTeile(centis, komma)
  return `${min}:${sek.padStart(5, '0')}`
}

export function zeitTeile(centis: number, komma: ',' | '.' = ','): { min: number; sek: string } {
  const s = Math.floor(centis / 100)
  return { min: Math.floor(s / 60), sek: `${s % 60}${komma}${String(centis % 100).padStart(2, '0')}` }
}

/** Ist das Feld erledigt – lesbare Zeit oder „keine Zeit“ (ZT3)? */
export function zeitFertig(e: Entwurf, feld: string): boolean {
  return feld in e.keineZeit || zeitDeutung(e.zeiten[feld] ?? '') !== null
}

/**
 * Muss dieses Zeitfeld vor dem Abschicken fertig sein (ZT5, 22.11.2026, R8-35: „die anderen Zeiten sind optional“)?
 * Nur das ERSTE Zeitfeld der Liste (Folge von `aufbau.zeiten`, wie der Bogen) – die Hauptzeit; weitere (Stoppuhr,
 * zweite Anlage) dürfen leer bleiben.
 */
export function zeitPflicht(aufbau: Pick<MaskenAufbau, 'zeiten'>, feld: string): boolean {
  return aufbau.zeiten[0]?.feld === feld
}

/**
 * Was das Abschicken noch aufhält („noch 1 Zeit“, ZT5): das Pflichtfeld ohne lesbare Zeit und ohne „keine Zeit“ – und
 * jedes weitere Feld, in dem etwas Unlesbares steht (befüllt muss es lesbar sein; leer ist erlaubt).
 */
export function zeitenOffen(e: Entwurf, aufbau: Pick<MaskenAufbau, 'zeiten'>): number {
  return aufbau.zeiten.filter((z) => (zeitPflicht(aufbau, z.feld) ? !zeitFertig(e, z.feld) : zeitUnlesbar(e, z.feld))).length
}

/**
 * Ist die getippte Zeit „fertig“, sodass der Block ins nächste Feld springen darf (ZT6, 22.11.2026, R8-35: „Weiter
 * springen ist okay“)? Lesbar UND alle Stellen der Deutung von lib/time.ts parseTime da: Sekunden (ab 20 vor dem Komma)
 * mit zwei Hundertsteln („83,45“), Minuten mit Sekunden und Hundertsteln („1,2345“), „m:ss,hh“ mit zwei Hundertsteln.
 * Bei „1,23“ springt nichts – dort fehlen noch die Hundertstel (1:23,00 wäre nur aufgefüllt).
 */
export function zeitVollstaendig(text: string): boolean {
  if (zeitDeutung(text) === null) return false
  const m = /[.,](\d*)$/.exec(text)
  if (!m) return false
  if (text.includes(':')) return m[1].length === 2
  const vor = text.split(/[.,]/)[0]
  return m[1].length === ((vor === '' ? 0 : parseInt(vor, 10)) >= 20 ? 2 : 4)
}

/** Ein Zeitfeld mit getipptem, aber unlesbarem Text (rot, sperrt den Hauptknopf)? */
export function zeitUnlesbar(e: Entwurf, feld: string): boolean {
  const text = e.zeiten[feld] ?? ''
  return text !== '' && zeitDeutung(text) === null
}

/** „Keine Zeit“ des Entwurfs in der Folge der Maske – so geht es als `kz` auf die Leitung (wkr/zeile.ts). */
export function keineZeitAus(e: Entwurf, aufbau: Pick<MaskenAufbau, 'zeiten'>): [string, KeineZeitGrund][] {
  return aufbau.zeiten.flatMap((z) => (e.keineZeit[z.feld] ? [[z.feld, e.keineZeit[z.feld]] as [string, KeineZeitGrund]] : []))
}

/**
 * Ein Tipp der Prüfliste (W5.3, KN7): setzt ✓ bzw. ✗; derselbe Tipp noch einmal bzw. `null` nimmt die Wahl heraus
 * (wieder offen). Ein Feld, das die Maske nicht kennt, ändert nichts (gleiche Referenz).
 */
export function tippePruef(e: Entwurf, aufbau: Pick<MaskenAufbau, 'pruef'>, feld: string, wahl: PruefWahl | null): Entwurf {
  if (!aufbau.pruef.some((p) => p.feld === feld)) return e
  const alt = e.pruef[feld]
  if (wahl === null || wahl === alt) {
    if (alt === undefined) return e
    const pruef = { ...e.pruef }
    delete pruef[feld]
    return { ...e, pruef }
  }
  return { ...e, pruef: { ...e.pruef, [feld]: wahl } }
}

/** Wie viele Knoten der Prüfliste noch weder ✓ noch ✗ haben (Hauptknopf „Alle richtig“/„Rest richtig“, KN10). */
export function pruefOffen(e: Entwurf, aufbau: Pick<MaskenAufbau, 'pruef'>): number {
  return aufbau.pruef.filter((p) => e.pruef[p.feld] === undefined).length
}

/**
 * „Alle richtig“ bzw. „Rest richtig“ (Nutzer 22.11.2026, R8-31, KN10): setzt jeden noch offenen Knoten auf ✓, ein
 * gesetztes ✓/✗ bleibt. Der WKR markiert so nur die falschen. Nichts offen → gleiche Referenz.
 */
export function restRichtig(e: Entwurf, aufbau: Pick<MaskenAufbau, 'pruef'>): Entwurf {
  const offen = aufbau.pruef.filter((p) => e.pruef[p.feld] === undefined)
  if (offen.length === 0) return e
  return { ...e, pruef: { ...e.pruef, ...Object.fromEntries(offen.map((p) => [p.feld, 'ok' as const])) } }
}

/**
 * Darf die Zeile hinaus? Prüfliste: seit R8-31 (22.11.2026, KN10, WKR_ANNAHMEN.prueflisteRestRichtig) sobald die
 * Maske Knoten hat – offene gelten beim Abschicken als ✓ (restRichtig; zellenAus macht aus offen ohnehin ''); vorher
 * (KN7) erst, wenn jeder Knoten gesetzt war. Zeit (ZT5, umgebaut 22.11.2026 R8-35):
 * erst, wenn das erste Zeitfeld fertig ist und kein weiteres Unlesbares trägt. Andere Masken: immer (dort ist „nichts
 * getippt“ = fehlerfrei).
 */
export function fertig(e: Entwurf, aufbau: Pick<MaskenAufbau, 'art' | 'pruef'> & Partial<Pick<MaskenAufbau, 'zeiten'>>): boolean {
  // Zeit (ZT5): das erste Zeitfeld mit lesbarer Zeit oder „keine Zeit“, weitere leer oder lesbar – auch auf gemischten
  // Listen (Bojen + Zeit).
  if (aufbau.zeiten && zeitenOffen(e, { zeiten: aufbau.zeiten }) > 0) return false
  return aufbau.art !== 'pruefliste' || (aufbau.pruef.length > 0 && (WKR_ANNAHMEN.prueflisteRestRichtig || pruefOffen(e, aufbau) === 0))
}

/**
 * Ein Bojen-Tipp (W4.1, P2, P5): Schalter – der erste setzt, der zweite nimmt weg (samt SEINEM Merker, wie Disq.);
 * Zähler – jeder Tipp +1 bis `bojenZaehlerMax`, danach nimmt der Knopf nichts mehr an (gleiche Referenz zurück).
 */
export function tippeBoje(e: Entwurf, boje: Pick<MaskenBoje, 'feld' | 'zaehler'>): Entwurf {
  // Eine Boje mit Disq.-Buchstaben nimmt weiter Berührungen an (W4-12, 21.11.2026: Punkte und Buchstabe in einer Zelle).
  const n = e.bojen[boje.feld] ?? 0
  if (boje.zaehler) {
    if (n >= WKR_ANNAHMEN.bojenZaehlerMax) return e
    return { ...e, bojen: { ...e.bojen, [boje.feld]: n + 1 }, folge: [...e.folge, BOJE + boje.feld] }
  }
  if (n === 0) return { ...e, bojen: { ...e.bojen, [boje.feld]: 1 }, folge: [...e.folge, BOJE + boje.feld] }
  const bojen = { ...e.bojen }
  delete bojen[boje.feld]
  const i = e.folge.lastIndexOf(BOJE + boje.feld)
  return { ...e, bojen, folge: e.folge.filter((_, j) => j !== i) }
}

/**
 * Disq. an einer Boje (U1, Nutzer 21.11.2026; W4-12/BZ1 21.11.2026; BZ7 22.11.2026 – R7-14): `code` schaltet EINEN
 * Buchstaben an bzw. wieder aus, die übrigen Buchstaben und die Berührungen bleiben; `null` nimmt alle Buchstaben der
 * Boje heraus. Ein Buchstabe, den die Zelle nicht annimmt, ändert nichts (gleiche Referenz). X „nicht gestartet“ steht
 * in einer Zelle immer allein (BZ2) – das prüft wertGilt; Bojen bieten X nicht an (nur Vorsteg/Steg-Ablegen, F5).
 */
export function tippeBojenDisq(e: Entwurf, boje: Pick<MaskenBoje, 'feld' | 'disq'>, code: string | null): Entwurf {
  const alt = e.bojenDisq[boje.feld] ?? []
  const istDieseBoje = (m: string) => m.startsWith(BOJEN_DISQ) && liesBojenDisqMerker(m).feld === boje.feld
  if (code === null) {
    if (alt.length === 0) return e
    const bojenDisq = { ...e.bojenDisq }
    delete bojenDisq[boje.feld]
    return { ...e, bojenDisq, folge: e.folge.filter((m) => !istDieseBoje(m)) }
  }
  if (alt.includes(code)) return ohneBojenDisq(e, boje.feld, code, e.folge.filter((m) => m !== bojenDisqMerker(boje.feld, code)))
  if (!boje.disq.some((d) => d.code === code)) return e
  return { ...e, bojenDisq: { ...e.bojenDisq, [boje.feld]: [...alt, code] }, folge: [...e.folge, bojenDisqMerker(boje.feld, code)] }
}

/** Einen Buchstaben an einer Boje herausnehmen (mit der gegebenen Folge); ohne Buchstaben fällt der Eintrag weg. */
function ohneBojenDisq(e: Entwurf, feld: string, code: string, folge: string[]): Entwurf {
  const rest = (e.bojenDisq[feld] ?? []).filter((d) => d !== code)
  const bojenDisq = { ...e.bojenDisq }
  if (rest.length > 0) bojenDisq[feld] = rest
  else delete bojenDisq[feld]
  return { ...e, bojenDisq, folge }
}

/** Die Disq.-Buchstaben an Bojen in der Folge der Maske, je Buchstabe ein Eintrag (Fuß, Texte): `{feld, code}`. */
export function disqAnBojen(e: Entwurf, aufbau: MaskenAufbau): { feld: string; code: string }[] {
  return bojenVon(aufbau).flatMap((b) => (e.bojenDisq[b.feld] ?? []).map((code) => ({ feld: b.feld, code })))
}

/**
 * Die Disq.-Buchstaben einer Boje in der Folge ihres Katalogs – wie die Zelle sie schreibt (BZ6). Für Knöpfe und
 * Stand („Disq. J, D“), damit Maske, Bild und Zelle dieselbe Folge zeigen, gleich in welcher Folge getippt wurde.
 */
export function bojenDisqVon(e: Entwurf, boje: Pick<MaskenBoje, 'feld' | 'disq'>): string[] {
  const gesetzt = e.bojenDisq[boje.feld] ?? []
  return boje.disq.map((d) => d.code).filter((c) => gesetzt.includes(c))
}

/** Zahl der Disq.-Buchstaben an einer Boje (Zählungen am Reiter, „Abschicken · n“). */
export function bojenDisqZahl(e: Entwurf, feld: string): number {
  return (e.bojenDisq[feld] ?? []).length
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
  if (letzt.startsWith(BOJEN_DISQ)) {
    const { feld, code } = liesBojenDisqMerker(letzt)
    return ohneBojenDisq(e, feld, code, folge)
  }
  if (letzt.startsWith(BOJE)) {
    const feld = letzt.slice(BOJE.length)
    const bojen = { ...e.bojen }
    const n = (bojen[feld] ?? 0) - 1
    if (n > 0) bojen[feld] = n
    else delete bojen[feld]
    return { ...e, bojen, folge }
  }
  const codes = { ...e.codes, [letzt]: (e.codes[letzt] ?? []).slice(0, -1) }
  if (codes[letzt].length === 0) delete codes[letzt]
  return { ...e, codes, folge }
}

/** Zahl der Einträge (Code-Tipps, Bojen-Berührungen, Disq. – auch an Bojen) – „Abschicken · n“. */
export function eintraege(e: Entwurf): number {
  return (
    Object.values(e.codes).reduce((n, c) => n + c.length, 0) +
    Object.values(e.bojen).reduce((n, b) => n + b, 0) +
    e.disq.length +
    Object.values(e.bojenDisq).reduce((n, b) => n + b.length, 0) +
    // Prüfliste (W5.3): ein ✗ ist ein Eintrag wie eine Berührung; ✓ nicht (wie „fehlerfrei“).
    Object.values(e.pruef).filter((w) => w === 'fehler').length +
    // Zeit (W5.4): jede getippte Zeit und jedes „keine Zeit“ – sonst hieße der Knopf einer Zeit-Liste „Fehlerfrei“.
    Object.values(e.zeiten).filter((t) => t !== '').length +
    Object.keys(e.keineZeit).length
  )
}

/** Einträge einer Seite des Umschalters (Zahl am Reiter, P8): Bojen (auch Disq. an Bojen, U1) und Codes dieses Wegs, ohne die Disq.-Liste. */
export function eintraegeAuf(e: Entwurf, aufbau: MaskenAufbau, weg: Weg): number {
  let n = 0
  for (const a of aufbau.abschnitte) {
    if (wegVon(a) !== weg) continue
    if (a.art === 'halt') for (const b of a.halt.bojen) n += (e.bojen[b.feld] ?? 0) + bojenDisqZahl(e, b.feld)
    else n += (e.codes[a.teil.feld] ?? []).length
  }
  return n
}

/**
 * Punkte der Code-Tipps und Bojen im Teil (ohne Disq.; die Wertung rechnet am Bedienrechner, das hier ist nur die
 * Anzeige, P13). Bojen-Listen sind nie geteilt.
 */
export function punkteVon(e: Entwurf, aufbau: MaskenAufbau, teil?: ListenTeil): number {
  let summe = 0
  for (const t of teileFuer(aufbau, teil)) {
    const punkte = new Map(t.codes.map((c) => [c.code, c.punkte]))
    for (const code of e.codes[t.feld] ?? []) summe += punkte.get(code) ?? 0
  }
  // Auch neben einem Disq.-Buchstaben (W4-12, BZ3): Die Punkte bleiben sichtbar, die Wertung disqualifiziert.
  for (const b of bojenVon(aufbau)) summe += (e.bojen[b.feld] ?? 0) * b.punkte
  for (const p of aufbau.pruef) if (e.pruef[p.feld] === 'fehler') summe += p.punkte
  return summe
}

/**
 * Die Zellwerte der Zeile: je Feld des Teils (ohne Teil: alle) und die gemeinsamen (Disq., Bemerkung) – auch leere,
 * denn „Fehlerfrei“ ist eine Zeile mit leeren Feldern (geraete/erfassen.ts schicke lässt leere ohne `vorher` weg).
 * Code-Felder in der Schreibweise der Erfassung („2x6, 20“, normalizeCodeCell), Disq. in Tipp-Reihenfolge („A, X“,
 * sanitizeDisq lässt sie so), Bemerkung getrimmt und gekürzt. Am Steg gehen Disq. ins gemeinsame `disq@steg`.
 * Bojen (W4.1, P4): Berührungen × Punkte („5“, Zähler „10“) bzw. ''; seit U1 (21.11.2026) ein Disq. an der Boje als
 * Buchstabe dahinter (seit W4-12/BZ1 mit Punkten, seit R7-14/BZ6 22.11.2026 mehrere: „G“, „5, G“, „10, G, J“) – über
 * lib/disq.ts bojenZelle, also genau das, was sanitizeBuoy unverändert lässt. Disq. „keine Boje“ (BZ4) weiter ins Disq.-Feld der Liste.
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
  for (const b of bojenVon(aufbau)) {
    const n = e.bojen[b.feld] ?? 0
    // Dieselbe Schreibweise wie beim Abtippen (lib/disq.ts bojenZelle, BZ6): „5, J, D“ in Katalogfolge der Zelle.
    out[b.feld] = bojenZelle(n * b.punkte, e.bojenDisq[b.feld] ?? [], new Set(b.disq.map((d) => d.code)))
  }
  // Prüfliste (W5.3, KN7): ✓ → leere Zelle, ✗ → Punkte („5“, wie die Boje P4 – sanitizeBuoy lässt es so); offen → leer.
  for (const p of aufbau.pruef) out[p.feld] = e.pruef[p.feld] === 'fehler' ? String(p.punkte) : ''
  // Zeit (W5.4, ZT2): die Ziffernfolge wie getippt, mit Komma – genau die Roh-Eingabe, die die Erfassung am Rechner
  // speichert und wertGilt (parseTime) unverändert annimmt; unlesbar bzw. „keine Zeit“ → leer (fertig sperrt vorher).
  // Ein leeres optionales Feld (ZT5) steht als '' hier – überschrieben wird damit nichts: geraete/erfassen.ts schickt
  // ein leeres Feld nur, wenn das Gerät dort vorher selbst etwas gesendet hatte (`vorher`, Korrektur), eine Papierzeit
  // am Bedienrechner bleibt also stehen (geprüft 22.11.2026, R8-35; die Rund-Probe bleibt unverändert).
  for (const z of aufbau.zeiten) {
    const text = e.zeiten[z.feld] ?? ''
    out[z.feld] = z.feld in e.keineZeit || zeitDeutung(text) === null ? '' : sanitizeTimeInput(text, ',')
  }
  if (aufbau.bemerkung) out[aufbau.bemerkung] = e.bemerkung.trim().slice(0, WKR_ANNAHMEN.textMax).trim()
  return out
}

/**
 * Die Zellen eines Entwurfs zum Ablegen auf dem Gerät (merkeEntwurf, H4): wie {@link zellenAus}, aber Zeitfelder mit
 * dem Text, wie er getippt ist – auch halb („1,2“) bzw. unlesbar; so steht er nach einem Wechsel wieder da. Nie für
 * die Leitung (dort nur zellenAus). „Keine Zeit“ bleibt draußen (ZT4, beim Bau: der Entwurf ist eine Zellzeile).
 */
export function entwurfZellen(e: Entwurf, aufbau: MaskenAufbau, teil?: ListenTeil): Record<string, string> {
  const out = zellenAus(e, aufbau, teil)
  for (const z of aufbau.zeiten) if (!(z.feld in e.keineZeit)) out[z.feld] = e.zeiten[z.feld] ?? ''
  return out
}

/**
 * Ein Entwurf aus Zellwerten – Korrektur einer Zeile aus „Zuletzt“ (F7). Rund: `zellenAus(entwurfAus(z))` gibt die
 * Zellen zurück (soweit die Maske sie kennt). Codes in Katalogfolge der Zelle, Buchstaben im Code-Feld zählen als Disq.
 */
export function entwurfAus(zellen: Readonly<Record<string, string>>, aufbau: MaskenAufbau, keineZeit: Readonly<Record<string, KeineZeitGrund>> = {}): Entwurf {
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
  // Bojen (lib/scoring.ts bojenWert, W4-12): Punkte → Berührungen, gerundet; Schalter höchstens 1, Zähler höchstens
  // bojenZaehlerMax. Jeder Buchstabe, den die Zelle annimmt, ist ein Disq. an dieser Boje (U1) – NEBEN den Punkten
  // („5, J“, BZ1; mehrere „5, J, D“ seit R7-14/BZ6); andere Buchstaben werden übergangen.
  for (const b of bojenVon(aufbau)) {
    const { punkte, disq: buchstaben } = bojenWert(zellen[b.feld] ?? '')
    if (punkte > 0 && b.punkte > 0) {
      const n = Math.min(Math.round(punkte / b.punkte), b.zaehler ? WKR_ANNAHMEN.bojenZaehlerMax : 1)
      for (let i = 0; i < n; i++) e = tippeBoje(e, b)
    }
    for (const code of buchstaben) e = tippeBojenDisq(e, b, code)
  }
  for (const d of disq) e = tippeDisq(e, d)
  // Prüfliste (W5.3): Punkte > 0 → ✗; eine vorhandene leere Zelle → ✓ (so schickt das Gerät ✓); fehlt sie → offen.
  for (const p of aufbau.pruef) {
    if (!(p.feld in zellen)) continue
    e = tippePruef(e, aufbau, p.feld, bojenWert(zellen[p.feld]).punkte > 0 ? 'fehler' : 'ok')
  }
  // Zeit (W5.4): der Zellwert wird wieder die Ziffernfolge (ein Punkt als Komma, wie die Erfassung tippt); „keine Zeit“
  // kommt nicht aus der Zelle (die ist leer), sondern aus dem Kennzeichen des Geräts (`keineZeit`).
  for (const z of aufbau.zeiten) {
    if (keineZeit[z.feld]) e = setzeKeineZeit(e, aufbau, z.feld, keineZeit[z.feld])
    else if (zellen[z.feld]) e = { ...e, zeiten: { ...e.zeiten, [z.feld]: zellen[z.feld].replace('.', ',') } }
  }
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

/**
 * Attempt-Wechsel bei derselben Startnummer (W5.1, PD5, Vorschlag §4.8, 22.11.2026): Folgt auf den gezeigten Start
 * ein anderer Start (andere Kennung) mit DERSELBEN Nummer im Parallelslalom, ist es sein nächster Attempt – der WKR
 * soll das nicht übersehen (Band „23 · ATTEMPT 2“ und Sperrsekunde). Liefert die Nummer des Attempts, sonst `null`.
 */
export function attemptWechsel(vorher: { key: string; startNr: string } | null, jetzt: { key: string; startNr: string }): number | null {
  if (!vorher || vorher.key === jetzt.key || vorher.startNr !== jetzt.startNr) return null
  const r = liesRef(jetzt.key)
  return r?.art === 'p' ? r.attempt : null
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
